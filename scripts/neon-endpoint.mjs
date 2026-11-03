// Suspends or starts the Neon compute endpoint of a disposable test project
// (m1-034), for the "server-restart" scenario of pg-connection-drop-test.mjs:
//
//   node --env-file=.env scripts/neon-endpoint.mjs suspend|start|status
//
// Reads NEON_API_KEY, NEON_PROJECT_ID and NEON_ENDPOINT_ID (the "ep-..." ID,
// not the "br-..." branch ID) from the git-ignored .env. Prints the HTTP status
// and never the key. Exits 0 on an API error too: Neon starts a suspended
// compute by itself when a client connects, so "start" may find it running.

const action = process.argv[2];
const {
  NEON_API_KEY: key,
  NEON_PROJECT_ID: project,
  NEON_ENDPOINT_ID: endpoint
} = process.env;
if (![ 'suspend', 'start', 'status' ].includes(action) || !key || !project || !endpoint?.startsWith('ep-')) {
  console.error('Usage: scripts/neon-endpoint.mjs suspend|start|status, with NEON_API_KEY, NEON_PROJECT_ID and ' +
    'NEON_ENDPOINT_ID (ep-...) set.');
  process.exit(2);
}
const url = `https://console.neon.tech/api/v2/projects/${project}/endpoints/${endpoint}` +
  (action === 'status' ? '' : `/${action}`);
const res = await fetch(url, {
  method: action === 'status' ? 'GET' : 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json'
  }
});
const body = await res.json().catch(() => ({}));
console.log(`Neon ${action}: HTTP ${res.status}, state ${body.endpoint?.current_state ?? body.message ?? 'unknown'}.`);
