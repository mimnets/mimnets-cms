// Isolated end-to-end test run, used by CI and reproducible locally (m1-009).
//
//   npm run test:ci             (port 3100 by default; CI_TEST_PORT overrides)
//   npm run test:ci -- --keep   (keep the temporary directory for debugging)
//
// Each run gets a fresh temporary directory (under RUNNER_TEMP in GitHub
// Actions, otherwise the OS temp directory) holding a new SQLite database and
// uploads folder. The session secret and test-admin password are generated
// per run, masked in GitHub Actions logs and never printed. `.env` is not
// read, so the developer database, media folder and credentials are never
// used. Steps: create the test admin (assurer-test:ensure-admin), seed demo
// content, start the server, run the smoke and editor-workflow suites, restart
// the server, run the persistence check, restart with notification email
// pointed at a local SMTP sink and run the form-operations suite (m1-012),
// then the security suite, restart once more as if behind an HTTPS proxy
// (APOS_HTTPS, APOS_TRUST_PROXY, HSTS; m1-011) and run the security suite in
// proxy mode, then stop and delete everything. The sink never relays mail,
// and the SMTP password is a random per-run value the form suite checks for
// leaks. m1-014 adds a test editor (assurer-test:ensure-editor), runs the
// corporate demo seed twice (it must add nothing the second time) and runs
// the content-model suite before and after a restart. m1-018 adds the SEO
// suite, seeds the legacy redirects twice while the server is stopped and,
// after the restart, requests every legacy URL (one 301 hop each). m1-037
// adds a test contributor (assurer-test:ensure-contributor) and runs the
// publishing-workflow suite (D-CONTENT-11) before and after a restart.
// Uses Node built-ins only.

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import {
  mkdtemp, readFile, rm, writeFile
} from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = process.argv.includes('--keep');
const PORT = process.env.CI_TEST_PORT || '3100';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const START_TIMEOUT_MS = 180 * 1000;

const work = await mkdtemp(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'vcl-ci-'));
const secret = randomBytes(32).toString('hex');
const password = randomBytes(24).toString('hex');
const smtpPassword = randomBytes(24).toString('hex');
const editorPassword = randomBytes(24).toString('hex');
const contributorPassword = randomBytes(24).toString('hex');
if (process.env.GITHUB_ACTIONS === 'true') {
  // Workflow commands: these lines are consumed by the runner, not logged.
  console.log(`::add-mask::${secret}`);
  console.log(`::add-mask::${password}`);
  console.log(`::add-mask::${editorPassword}`);
  console.log(`::add-mask::${contributorPassword}`);
  console.log(`::add-mask::${smtpPassword}`);
}
const emptyEnvFile = path.join(work, 'empty.env');
await writeFile(emptyEnvFile, '');

// Start from the caller's environment minus anything that could point the
// app at other data or credentials.
const inherited = Object.fromEntries(Object.entries(process.env).filter(([ key ]) =>
  !/^(APOS_|DOTENV_|NODE_ENV$|PORT$|ADDRESS$|BASE_URL$)/.test(key)));
const env = {
  ...inherited,
  // app.js loads `.env` through dotenv/config; point it at an empty file.
  DOTENV_CONFIG_PATH: emptyEnvFile,
  DOTENV_CONFIG_QUIET: 'true',
  APOS_DB_URI: `sqlite://${path.join(work, 'ci.sqlite')}`,
  APOS_TEST_UPLOADS_PATH: path.join(work, 'media'),
  APOS_SESSION_SECRET: secret,
  APOS_TEST_USER: 'ci-admin',
  APOS_TEST_PASSWORD: password,
  APOS_TEST_EDITOR_USER: 'ci-editor',
  APOS_TEST_EDITOR_PASSWORD: editorPassword,
  APOS_TEST_CONTRIBUTOR_USER: 'ci-contributor',
  APOS_TEST_CONTRIBUTOR_PASSWORD: contributorPassword,
  PORT,
  ADDRESS: '127.0.0.1',
  BASE_URL,
  // Absolute page URLs point at this test server (m1-018). Indexing stays
  // off (APOS_ALLOW_INDEXING unset), as on every non-production site.
  APOS_BASE_URL: BASE_URL,
  // The smoke test expects the demonstration notice (m1-029,
  // lib/demo-site.js); real-content sites leave this unset.
  APOS_DEMO_SITE: '1'
};

// A free local port for the SMTP sink that scripts/form-ops-test.mjs runs.
const smtpPort = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});
const formsEnv = {
  APOS_SMTP_HOST: '127.0.0.1',
  APOS_SMTP_PORT: String(smtpPort),
  APOS_SMTP_REQUIRE_TLS: '0',
  APOS_SMTP_USER: 'ci-smtp-user',
  APOS_SMTP_PASSWORD: smtpPassword,
  APOS_EMAIL_FROM: 'website@example.test',
  APOS_FORM_NOTIFY_TO: 'forms-inbox@example.test'
};

const summary = [];
let server = null;
let serverLog = null;
let failed = false;

function header(title) {
  console.log(`\n== ${title}`);
}

function run(title, args, extraEnv = {}) {
  header(title);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: {
        ...env,
        ...extraEnv
      },
      stdio: 'inherit'
    });
    child.on('exit', (code) => {
      summary.push(`${code === 0 ? 'PASS' : 'FAIL'}  ${title}`);
      resolve(code === 0);
    });
  });
}

async function portInUse() {
  return new Promise((resolve) => {
    const socket = net.connect(Number(PORT), '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function startServer(label, extraEnv = {}) {
  header(`start server (${label})`);
  serverLog = path.join(work, `server-${label}.log`);
  const log = createWriteStream(serverLog);
  server = spawn(process.execPath, [ 'app' ], {
    cwd: root,
    env: {
      ...env,
      ...extraEnv
    },
    stdio: [ 'ignore', 'pipe', 'pipe' ]
  });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  const exited = new Promise(resolve => server.once('exit', code => resolve(code)));
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const code = await Promise.race([ exited, new Promise(resolve => setTimeout(() => resolve('wait'), 1000)) ]);
    if (code !== 'wait') {
      console.log(`server exited early (code ${code})`);
      summary.push(`FAIL  server start (${label})`);
      return false;
    }
    try {
      const res = await fetch(`${BASE_URL}/`);
      if (res.status === 200) {
        console.log(`server ready at ${BASE_URL}`);
        summary.push(`PASS  server start (${label})`);
        return true;
      }
    } catch (e) {
      // Not listening yet.
    }
  }
  console.log(`server did not return 200 within ${START_TIMEOUT_MS / 1000} s`);
  summary.push(`FAIL  server start (${label})`);
  return false;
}

async function stopServer() {
  if (!server || server.exitCode !== null) {
    server = null;
    return;
  }
  const exited = new Promise(resolve => server.once('exit', resolve));
  server.kill('SIGTERM');
  const timer = setTimeout(() => server?.kill('SIGKILL'), 15000);
  await exited;
  clearTimeout(timer);
  server = null;
}

async function printServerLogTail() {
  if (!serverLog) {
    return;
  }
  const lines = (await readFile(serverLog, 'utf8').catch(() => '')).split('\n');
  console.log(`\n-- last 60 lines of ${path.basename(serverLog)} --`);
  console.log(lines.slice(-60).join('\n'));
}

async function steps() {
  console.log(`Temporary directory: ${work}`);
  console.log(`Database: ${env.APOS_DB_URI}`);
  if (await portInUse()) {
    console.log(`Port ${PORT} is already in use; set CI_TEST_PORT to a free port.`);
    summary.push('FAIL  port check');
    return false;
  }
  return await run('create test admin (assurer-test:ensure-admin)', [ 'app', 'assurer-test:ensure-admin' ]) &&
    await run('create test editor (assurer-test:ensure-editor)', [ 'app', 'assurer-test:ensure-editor' ]) &&
    await run('create test contributor (assurer-test:ensure-contributor)', [ 'app', 'assurer-test:ensure-contributor' ]) &&
    await run('seed demo content (assurer-demo:seed)', [ 'app', 'assurer-demo:seed' ]) &&
    await run('seed corporate demo records (assurer-demo:seed-corporate)', [ 'app', 'assurer-demo:seed-corporate' ]) &&
    await run('seed corporate demo records again (must add nothing)', [ 'app', 'assurer-demo:seed-corporate' ]) &&
    await startServer('first') &&
    await run('smoke test', [ 'scripts/smoke-test.mjs' ]) &&
    await run('editor workflow test', [ 'scripts/editor-workflow-test.mjs' ]) &&
    await run('content model test', [ 'scripts/content-model-test.mjs' ], { CONTENT_TEST_DISPOSABLE: '1' }) &&
    await run('SEO test', [ 'scripts/seo-test.mjs' ], { SEO_TEST_DISPOSABLE: '1' }) &&
    await run('publishing workflow test', [ 'scripts/publishing-workflow-test.mjs' ], { PUBLISH_TEST_DISPOSABLE: '1' }) &&
    await stopServer().then(() => run('seed legacy redirects (assurer-seo:seed-redirects)', [
      'app', 'assurer-seo:seed-redirects', '--strict'
    ])) &&
    await run('seed legacy redirects again (must add nothing)', [ 'app', 'assurer-seo:seed-redirects', '--strict' ]) &&
    await startServer('restart') &&
    await run('persistence test after restart', [ 'scripts/editor-workflow-test.mjs', '--verify-only' ]) &&
    await run('content model persistence after restart', [ 'scripts/content-model-test.mjs', '--verify-only' ], {
      CONTENT_TEST_DISPOSABLE: '1'
    }) &&
    await run('publishing workflow persistence after restart', [ 'scripts/publishing-workflow-test.mjs', '--verify-only' ], {
      PUBLISH_TEST_DISPOSABLE: '1'
    }) &&
    await run('legacy redirect map test', [ 'scripts/seo-test.mjs', '--redirects' ], { SEO_TEST_DISPOSABLE: '1' }) &&
    // After the redirect map test, which expects exactly the legacy redirects:
    // the import adds one redirect per PDF (m1-067).
    await stopServer().then(() => run('WordPress import, twice (second run must change nothing)', [
      'scripts/wp-import-test.mjs'
    ], { WP_IMPORT_TEST_DISPOSABLE: '1' })) &&
    await startServer('forms', formsEnv) &&
    await run('WordPress import: drafts stay private', [ 'scripts/wp-import-test.mjs', '--verify-only' ], {
      WP_IMPORT_TEST_DISPOSABLE: '1'
    }) &&
    await run('form operations test', [ 'scripts/form-ops-test.mjs' ], {
      ...formsEnv,
      FORM_OPS_SMTP_PORT: String(smtpPort),
      FORM_OPS_DISPOSABLE: '1',
      SERVER_LOG: serverLog
    }) &&
    await run('security test', [ 'scripts/security-test.mjs' ]) &&
    await stopServer().then(() => startServer('https-proxy', {
      APOS_HTTPS: '1',
      APOS_TRUST_PROXY: 'loopback',
      APOS_HSTS_MAX_AGE: '600'
    })) &&
    await run('security test, HTTPS proxy mode', [ 'scripts/security-test.mjs', '--proxy' ]);
}

try {
  failed = !(await steps());
} catch (e) {
  console.log(`Runner error: ${e.message}`);
  failed = true;
} finally {
  if (failed) {
    await printServerLogTail();
  }
  await stopServer();
  if (KEEP) {
    console.log(`\nKept ${work} (contains the test database; delete it when done)`);
  } else {
    await rm(work, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 500
    });
  }
}

header('summary');
summary.forEach(line => console.log(line));
console.log(failed ? '\nCI test run FAILED' : '\nCI test run passed');
process.exit(failed ? 1 : 0);
