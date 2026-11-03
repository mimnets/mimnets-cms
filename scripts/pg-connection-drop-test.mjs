// D-DB-5 connection-drop test (m1-032): what the app does when PostgreSQL
// drops its connections. Implements steps 2-5 of the D-DB-5 proposal §4
// (docs/milestones/m1-d-db-5-postgresql-connection-loss-proposal.md).
//
// Written in m1-032 and NOT RUN there: no PostgreSQL was available. Run it
// only against a disposable PostgreSQL that the owner has approved, with the
// major version chosen for staging (D-DB-2, D-DB-6). m1-033: a remote
// disposable server (Neon, owner-approved) needs --allow-remote-host.
//
//   node --env-file=.env scripts/pg-connection-drop-test.mjs --database=<name>
//     [--supervise]              restart the app 2 s after it exits, like a
//                                process supervisor (mitigation A)
//     [--stop-cmd="<command>"]   also run scenario "server-restart": this
//     [--start-cmd="<command>"]  command stops PostgreSQL immediately (e.g.
//                                pg_ctl -D <dir> stop -m immediate), the other
//                                starts it again 30 s later
//     [--port=3033]
//     [--allow-remote-host=<host>]  accept this exact non-loopback host
//     [--idle-wait=<seconds>]    also run scenario "idle-wait": no requests
//                                for this long (e.g. 420 for Neon's 5-minute
//                                auto-suspend), then check (m1-034)
//     [--instances=2]            two app instances on the next two ports
//                                behind a health-checked proxy on --port
//                                (mitigation B; needs --supervise; m1-034)
//                                and scenario "one-instance"
//
// APOS_DB_URI must be a postgres:// URI on a loopback host, or on the host
// named by --allow-remote-host; --database must repeat its database name,
// because the test terminates every connection of the APOS_DB_URI user to
// that database. Admin SQL runs through the `pg` client that db-connect
// already depends on (no psql needed), with PG_ADMIN_URI, or APOS_DB_URI
// when unset. Keep both URIs in the git-ignored .env.
//
// Scenarios:
//   idle-terminate   app idle, pg_terminate_backend on all its connections
//   server-restart   (with --stop-cmd/--start-cmd) stop PostgreSQL, start it
//                    after 30 s
//   one-instance     (with --instances=2) pg_terminate_backend on the first
//                    instance's connections only
//   idle-wait        (with --idle-wait) the app gets no requests for the given
//                    time; nothing is dropped by the script
//   cursor           a separate process holds a db-connect cursor open across
//                    FETCH calls while its connection is terminated
//
// Without --supervise, a scenario passes only if the process does not exit
// (the target for a fixed db-connect release, proposal §4 step 5). With
// --supervise, it passes if the site serves again within 60 s of the drop
// (steps 2-3). With --instances=2, it passes only if no probe failed, that
// is, no visible outage (step 1). The site is probed every 0.5 s from 1 s
// after the drop until it serves again (not during idle-wait). The cursor scenario
// always passes only without an exit. Exit code 1 on any FAIL.

import {
  execSync,
  spawn
} from 'node:child_process';
import http from 'node:http';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const CRASH_SIGNATURE = /ECONNRESET|Unhandled 'error' event|terminating connection/;
const RECOVERY_LIMIT_MS = 60000;

if (process.argv[2] === '--cursor-child') {
  await cursorChild(process.argv[3]);
  process.exit(0);
}

const { values: args } = parseArgs({
  options: {
    database: { type: 'string' },
    supervise: {
      type: 'boolean',
      default: false
    },
    'stop-cmd': { type: 'string' },
    'start-cmd': { type: 'string' },
    port: {
      type: 'string',
      default: '3033'
    },
    'allow-remote-host': { type: 'string' },
    'idle-wait': { type: 'string' },
    instances: {
      type: 'string',
      default: '1'
    }
  }
});

const dbUri = process.env.APOS_DB_URI || '';
const adminUri = process.env.PG_ADMIN_URI || dbUri;
const target = checkTarget(dbUri, args.database, args['allow-remote-host']);
const appUser = decodeURIComponent(new URL(dbUri).username);
const base = `http://127.0.0.1:${args.port}`;
const instances = Number(args.instances);
const idleWait = args['idle-wait'] ? Number(args['idle-wait']) : 0;
if (![ 1, 2 ].includes(instances) || (instances === 2 && !args.supervise)) {
  throw new Error('--instances must be 1, or 2 with --supervise.');
}
if (idleWait && instances === 2) {
  // The proxy's health checks would keep the database busy.
  throw new Error('--idle-wait needs --instances=1.');
}
const results = [];

const apps = [];
let proxy = null;
if (instances === 1) {
  apps.push(startApp(args.port));
} else {
  // Start the second instance once the first serves, so that the two
  // startups do not run side by side.
  const ports = [ 1, 2 ].map(offset => String(Number(args.port) + offset));
  proxy = startProxy(ports);
  for (const port of ports) {
    apps.push(startApp(port));
    await waitForSite(RECOVERY_LIMIT_MS * 2, `http://127.0.0.1:${port}`);
  }
}
const app = {
  exits: () => apps.flatMap(each => each.state.exits),
  stop: () => apps.forEach(each => each.stop())
};
try {
  await waitForSite(RECOVERY_LIMIT_MS);
  if (idleWait) {
    await scenario('idle-wait', () => sleep(idleWait * 1000), { probe: false });
  }
  await scenario('idle-terminate', () => terminateBackends());
  if (instances === 2) {
    await scenario('one-instance', () => terminateBackends(appName(apps[0].port)));
  }
  if (args['stop-cmd'] && args['start-cmd']) {
    // The start command runs 30 s later while the site is probed, so that the
    // outage is measured from the stop (m1-034).
    let restart;
    await scenario('server-restart', () => {
      execSync(args['stop-cmd'], { stdio: 'inherit' });
      restart = sleep(30000).then(() => execSync(args['start-cmd'], { stdio: 'inherit' }));
    });
    await restart;
  } else {
    results.push({
      name: 'server-restart',
      outcome: 'NOT RUN',
      detail: 'no --stop-cmd/--start-cmd'
    });
  }
} finally {
  app.stop();
  proxy?.close();
}
await cursorScenario();

console.log('\nScenario         Outcome  Detail');
for (const result of results) {
  console.log(`${result.name.padEnd(16)} ${result.outcome.padEnd(8)} ${result.detail}`);
}
process.exit(results.some(result => result.outcome === 'FAIL') ? 1 : 0);

function checkTarget(uri, database, remoteHost) {
  let url;
  try {
    url = new URL(uri);
  } catch {
    throw new Error('APOS_DB_URI is not a postgres:// URI.');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('APOS_DB_URI is not a postgres:// URI.');
  }
  if (![ '127.0.0.1', 'localhost', '[::1]' ].includes(url.hostname) &&
    url.hostname !== remoteHost?.toLowerCase()) {
    throw new Error('Refusing: the database host is not loopback. Use a disposable local PostgreSQL, ' +
      'or name an approved disposable server exactly with --allow-remote-host.');
  }
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name || database !== name) {
    throw new Error(`--database must repeat the database name in APOS_DB_URI ("${name}").`);
  }
  return name;
}

// The pg client as db-connect resolves it, so no new dependency or tool.
function pgClient() {
  const dbConnect = createRequire(import.meta.url).resolve('@apostrophecms/db-connect');
  const { Client } = createRequire(dbConnect)('pg');
  return new Client({ connectionString: adminUri });
}

// Each app instance connects with its own application_name (PGAPPNAME,
// read by pg), so that one instance's connections can be dropped alone.
function appName(port) {
  return `pg-drop-test-${port}`;
}

async function terminateBackends(application) {
  const client = pgClient();
  await client.connect();
  try {
    // Grouped by state, so that a log shows whether they were idle (m1-034).
    const result = await client.query('SELECT state, count(pg_terminate_backend(pid)) AS count ' +
      'FROM pg_stat_activity WHERE datname = $1 AND usename = $2 AND pid <> pg_backend_pid() ' +
      'AND ($3::text IS NULL OR application_name = $3) GROUP BY state',
    [ target, appUser, application || null ]);
    const states = result.rows.map(row => `${row.state || 'no state'}: ${row.count}`).join(', ');
    console.log(`Terminated connection(s): ${states || 'none'}.`);
  } finally {
    await client.end();
  }
}

// The app as a child process. Records every exit and whether its stderr
// showed the connection error; with --supervise it starts a new process 2 s
// after an exit.
function startApp(port) {
  const state = {
    exits: [],
    stopped: false,
    child: null
  };
  const launch = () => {
    // Checked per chunk before trimming, and on 'close' rather than 'exit'
    // so that all of stderr has arrived. The crash arrives as one large chunk
    // (stack plus the pg client object), longer than the kept tail (m1-033).
    let stderr = '';
    let crash = false;
    const child = spawn(process.execPath, [ 'app' ], {
      env: {
        ...process.env,
        PORT: port,
        PGAPPNAME: appName(port)
      },
      stdio: [ 'ignore', 'ignore', 'pipe' ]
    });
    child.stderr.on('data', chunk => {
      const text = stderr + chunk;
      crash = crash || CRASH_SIGNATURE.test(text);
      stderr = text.slice(-4000);
    });
    child.on('close', code => {
      if (state.stopped) {
        return;
      }
      state.exits.push({
        at: Date.now(),
        code,
        crash
      });
      console.log(`App on :${port} exited (code ${code}).`);
      if (args.supervise) {
        setTimeout(() => !state.stopped && launch(), 2000);
      }
    });
    state.child = child;
  };
  launch();
  return {
    port,
    state,
    stop() {
      state.stopped = true;
      state.child?.kill();
    }
  };
}

// Stands in for a load balancer (mitigation B): round robin over the
// instances that answered GET / with 200 at the last check (every 1 s),
// 503 when none did. No retries, like a plain proxy.
function startProxy(ports) {
  const backends = ports.map(port => ({
    port,
    healthy: false
  }));
  let next = 0;
  const check = () => backends.forEach(backend => {
    fetch(`http://127.0.0.1:${backend.port}/`, { signal: AbortSignal.timeout(2000) })
      .then(res => {
        backend.healthy = res.status === 200;
      })
      .catch(() => {
        backend.healthy = false;
      });
  });
  const timer = setInterval(check, 1000);
  const server = http.createServer((req, res) => {
    const healthy = backends.filter(backend => backend.healthy);
    if (!healthy.length) {
      res.writeHead(503).end();
      return;
    }
    const backend = healthy[next++ % healthy.length];
    const upstream = http.request({
      host: '127.0.0.1',
      port: backend.port,
      method: req.method,
      path: req.url,
      headers: req.headers
    }, upstreamRes => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502);
      }
      res.end();
    });
    req.pipe(upstream);
  }).listen(Number(args.port), '127.0.0.1');
  return {
    close() {
      clearInterval(timer);
      server.close();
    }
  };
}

// Requests GET / every 0.5 s until stopped; counts the answers other
// than 200.
function startProbing() {
  const probes = {
    total: 0,
    failed: 0,
    stopped: false
  };
  (async () => {
    while (!probes.stopped) {
      probes.total++;
      try {
        const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(2000) });
        if (res.status !== 200) {
          probes.failed++;
        }
      } catch {
        probes.failed++;
      }
      await sleep(500);
    }
  })();
  return probes;
}

async function waitForSite(limitMs, url = base) {
  const start = Date.now();
  let failed = 0;
  while (Date.now() - start < limitMs) {
    try {
      const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(2000) });
      if (res.status === 200) {
        return {
          ms: Date.now() - start,
          failed
        };
      }
    } catch {
      // not listening yet
    }
    failed++;
    await sleep(500);
  }
  throw new Error(`The site did not answer 200 within ${limitMs / 1000} s.`);
}

async function scenario(name, drop, { probe = true } = {}) {
  const exitsBefore = app.exits().length;
  await sleep(3000);
  const droppedAt = Date.now();
  await drop();
  // Probing from the drop itself would check out the dropped connection
  // before its error arrives, which hides the idle-client crash (m1-034).
  await sleep(probe ? 1000 : 0);
  const probes = probe ? startProbing() : null;
  // idle-wait counts from the end of the wait.
  const from = probe ? droppedAt : Date.now();
  // Idle pooled connections report the loss on their own; give them time.
  await sleep(4000);
  const exits = app.exits().slice(exitsBefore);
  let recovery = null;
  try {
    recovery = await waitForSite(RECOVERY_LIMIT_MS);
  } catch {
    // reported below
  }
  if (probes) {
    probes.stopped = true;
  }
  const exited = exits.length > 0;
  const detail = [
    exited ? `exited ${exits.length}x${exits.some(exit => exit.crash) ? ' (connection error)' : ''}` : 'no exit',
    recovery
      ? `serving ${Math.round((Date.now() - from) / 1000)} s after the ${probe ? 'drop' : 'wait'}`
      : 'not serving after 60 s',
    probes ? `${probes.failed} of ${probes.total} probes failed` : 'not probed during the wait'
  ].join('; ');
  const pass = instances === 2
    ? Boolean(recovery) && probes?.failed === 0
    : args.supervise ? Boolean(recovery) : !exited && Boolean(recovery);
  if (instances === 2) {
    // Both instances up again before the next scenario.
    for (const each of apps) {
      await waitForSite(RECOVERY_LIMIT_MS * 2, `http://127.0.0.1:${each.port}`).catch(() => {});
    }
  }
  results.push({
    name,
    outcome: pass ? 'PASS' : 'FAIL',
    detail
  });
}

async function cursorScenario() {
  const child = spawn(process.execPath, [ process.argv[1], '--cursor-child', dbUri ], {
    stdio: [ 'ignore', 'pipe', 'pipe' ]
  });
  let output = '';
  child.stdout.on('data', chunk => {
    output += chunk;
    if (String(chunk).includes('CURSOR-OPEN')) {
      terminateBackends().catch(e => console.log(`Terminate failed: ${e.message}`));
    }
  });
  child.stderr.on('data', chunk => {
    output += chunk;
  });
  const code = await new Promise(resolve => child.on('close', resolve));
  const handled = output.includes('CURSOR-HANDLED');
  results.push({
    name: 'cursor',
    outcome: code === 0 && handled ? 'PASS' : 'FAIL',
    detail: code === 0
      ? (handled ? 'next() rejected, process kept running' : `unexpected: ${output.trim().split('\n').pop()}`)
      : `exited (code ${code})${CRASH_SIGNATURE.test(output) ? ' (connection error)' : ''}`
  });
}

// Holds a cursor's connection across FETCH calls, waits while the parent
// terminates it, then asks for the next document.
async function cursorChild(uri) {
  const require = createRequire(import.meta.url);
  const connect = require('@apostrophecms/db-connect');
  const client = await connect(uri);
  const cursor = client.db().collection('aposDocs').find({});
  await cursor.next();
  console.log('CURSOR-OPEN');
  await sleep(5000);
  try {
    await cursor.next();
    console.log('CURSOR-NOT-INTERRUPTED');
  } catch (e) {
    console.log(`CURSOR-HANDLED ${e.message}`);
  }
  await client.close().catch(() => {});
}
