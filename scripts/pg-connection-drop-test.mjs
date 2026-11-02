// D-DB-5 connection-drop test (m1-032): what the app does when PostgreSQL
// drops its connections. Implements steps 2-5 of the D-DB-5 proposal §4
// (docs/milestones/m1-d-db-5-postgresql-connection-loss-proposal.md).
//
// Written in m1-032 and NOT RUN there: no PostgreSQL was available. Run it
// only against a disposable, local PostgreSQL that the owner has approved,
// with the major version chosen for staging (D-DB-2, D-DB-6).
//
//   node --env-file=.env scripts/pg-connection-drop-test.mjs --database=<name>
//     [--supervise]              restart the app 2 s after it exits, like a
//                                process supervisor (mitigation A)
//     [--stop-cmd="<command>"]   also run scenario "server-restart": this
//     [--start-cmd="<command>"]  command stops PostgreSQL immediately (e.g.
//                                pg_ctl -D <dir> stop -m immediate), the other
//                                starts it again 30 s later
//     [--port=3033]
//
// APOS_DB_URI must be a postgres:// URI on a loopback host; --database must
// repeat its database name, because the test terminates every connection to
// that database. Admin SQL runs through `psql` (PostgreSQL client tools) with
// PG_ADMIN_URI, or APOS_DB_URI when unset; prefer a ~/.pgpass entry over a
// password in either URI.
//
// Scenarios:
//   idle-terminate   app idle, pg_terminate_backend on all its connections
//   server-restart   (with --stop-cmd/--start-cmd) stop PostgreSQL, start it
//                    after 30 s
//   cursor           a separate process holds a db-connect cursor open across
//                    FETCH calls while its connection is terminated
//
// Without --supervise, a scenario passes only if the process does not exit
// (the target for a fixed db-connect release, proposal §4 step 5). With
// --supervise, it passes if the site serves again within 60 s of the drop
// (steps 2-3). The cursor scenario always passes only without an exit.
// Exit code 1 on any FAIL.

import {
  execFileSync,
  execSync,
  spawn
} from 'node:child_process';
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
    }
  }
});

const dbUri = process.env.APOS_DB_URI || '';
const adminUri = process.env.PG_ADMIN_URI || dbUri;
const target = checkTarget(dbUri, args.database);
const base = `http://127.0.0.1:${args.port}`;
const results = [];

const app = startApp();
try {
  await waitForSite(RECOVERY_LIMIT_MS);
  await scenario('idle-terminate', () => terminateBackends());
  if (args['stop-cmd'] && args['start-cmd']) {
    await scenario('server-restart', async () => {
      execSync(args['stop-cmd'], { stdio: 'inherit' });
      await sleep(30000);
      execSync(args['start-cmd'], { stdio: 'inherit' });
    });
  } else {
    results.push({
      name: 'server-restart',
      outcome: 'NOT RUN',
      detail: 'no --stop-cmd/--start-cmd'
    });
  }
} finally {
  app.stop();
}
await cursorScenario();

console.log('\nScenario         Outcome  Detail');
for (const result of results) {
  console.log(`${result.name.padEnd(16)} ${result.outcome.padEnd(8)} ${result.detail}`);
}
process.exit(results.some(result => result.outcome === 'FAIL') ? 1 : 0);

function checkTarget(uri, database) {
  let url;
  try {
    url = new URL(uri);
  } catch {
    throw new Error('APOS_DB_URI is not a postgres:// URI.');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('APOS_DB_URI is not a postgres:// URI.');
  }
  if (![ '127.0.0.1', 'localhost', '[::1]' ].includes(url.hostname)) {
    throw new Error('Refusing: the database host is not loopback. Use a disposable local PostgreSQL.');
  }
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name || database !== name) {
    throw new Error(`--database must repeat the database name in APOS_DB_URI ("${name}").`);
  }
  return name;
}

function psql(sql) {
  return execFileSync('psql', [ adminUri, '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql ], {
    encoding: 'utf8'
  }).trim();
}

function terminateBackends() {
  const quoted = target.replace(/'/g, '\'\'');
  const count = psql('SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity ' +
    `WHERE datname = '${quoted}' AND pid <> pg_backend_pid()`);
  console.log(`Terminated ${count} connection(s).`);
}

// The app as a child process. Records every exit and its stderr tail; with
// --supervise it starts a new process 2 s after an exit.
function startApp() {
  const state = {
    exits: [],
    stopped: false,
    child: null
  };
  const launch = () => {
    let stderr = '';
    const child = spawn(process.execPath, [ 'app' ], {
      env: {
        ...process.env,
        PORT: args.port
      },
      stdio: [ 'ignore', 'ignore', 'pipe' ]
    });
    child.stderr.on('data', chunk => {
      stderr = (stderr + chunk).slice(-4000);
    });
    child.on('exit', code => {
      if (state.stopped) {
        return;
      }
      state.exits.push({
        at: Date.now(),
        code,
        crash: CRASH_SIGNATURE.test(stderr)
      });
      console.log(`App exited (code ${code}).`);
      if (args.supervise) {
        setTimeout(() => !state.stopped && launch(), 2000);
      }
    });
    state.child = child;
  };
  launch();
  return {
    state,
    stop() {
      state.stopped = true;
      state.child?.kill();
    }
  };
}

async function waitForSite(limitMs) {
  const start = Date.now();
  let failed = 0;
  while (Date.now() - start < limitMs) {
    try {
      const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(2000) });
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

async function scenario(name, drop) {
  const exitsBefore = app.state.exits.length;
  await sleep(3000);
  const droppedAt = Date.now();
  await drop();
  // Idle pooled connections report the loss on their own; give them time.
  await sleep(5000);
  const exits = app.state.exits.slice(exitsBefore);
  let recovery = null;
  try {
    recovery = await waitForSite(RECOVERY_LIMIT_MS);
  } catch {
    // reported below
  }
  const exited = exits.length > 0;
  const detail = [
    exited ? `exited ${exits.length}x${exits.some(exit => exit.crash) ? ' (connection error)' : ''}` : 'no exit',
    recovery
      ? `serving ${Math.round((Date.now() - droppedAt) / 1000)} s after the drop, ${recovery.failed} failed probe(s)`
      : 'not serving after 60 s'
  ].join('; ');
  const pass = args.supervise ? Boolean(recovery) : !exited && Boolean(recovery);
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
      terminateBackends();
    }
  });
  child.stderr.on('data', chunk => {
    output += chunk;
  });
  const code = await new Promise(resolve => child.on('exit', resolve));
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
