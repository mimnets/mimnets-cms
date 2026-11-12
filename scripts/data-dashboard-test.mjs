// Data dashboard suite (m1-070, D-DB-24), against a running server on a
// DISPOSABLE database, through the same REST endpoints the admin UI calls.
// Run by `npm run test:ci` only: it creates records, so it refuses to run
// unless DASHBOARD_TEST_DISPOSABLE=1.
//
//   node scripts/data-dashboard-test.mjs
//
// Credentials come from the environment: APOS_TEST_USER / APOS_TEST_PASSWORD
// (admin) and APOS_TEST_EDITOR_USER / APOS_TEST_EDITOR_PASSWORD (editor).
// The export file is read from APOS_TEST_UPLOADS_PATH, because test uploads
// are not served over HTTP (modules/@apostrophecms/uploadfs). Bearer tokens
// are revoked at the end. Covers: the dashboard routes for admin, editor and
// anonymous; the counts, the search, the read-only document view (users
// show safe fields only) and health; export and import for admins only;
// an import with "drafts only" replaces a draft and leaves the published
// document unchanged; users cannot be exported; the activity log records
// exports, imports, replacements and refusals.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const P = 'm1-070 test';
const DASHBOARD = 'assurer-data-dashboard';
const ROUTES = [ 'overview', 'find', 'document', 'activity', 'health' ];
const USER_FIELDS = [
  '_id', 'type', 'title', 'username', 'email', 'role', 'disabled',
  'archived', 'createdAt', 'updatedAt'
];

if (process.env.DASHBOARD_TEST_DISPOSABLE !== '1') {
  console.error('Refusing to run: this suite writes test records. It runs from `npm run test:ci` ' +
    '(DASHBOARD_TEST_DISPOSABLE=1) on a throwaway database only.');
  process.exit(2);
}
for (const name of [
  'APOS_TEST_USER', 'APOS_TEST_PASSWORD',
  'APOS_TEST_EDITOR_USER', 'APOS_TEST_EDITOR_PASSWORD',
  'APOS_TEST_UPLOADS_PATH'
]) {
  if (!process.env[name]) {
    console.error(`Set ${name}.`);
    process.exit(2);
  }
}

const results = [];
function check(name, ok, detail = '') {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
// Not run here; never counted as a pass.
function skip(name, reason) {
  console.log(`SKIP  ${name}  (${reason})`);
}
// @apostrophecms/import-export 3.7.2 builds uploadfs paths with `path`
// instead of `path.posix` (lib/methods/import.js, lib/methods/export.js).
// On Windows the export URL gets backslashes and an import fails with
// EINVAL. Linux, where CI and the OCI site run, is not affected.
const WINDOWS = process.platform === 'win32';
const WINDOWS_REASON = 'Windows: import-export 3.7.2 builds uploadfs paths with path, ' +
  'not path.posix; runs on Linux in CI';

// Returns { status, json } and never throws on HTTP errors.
async function call(token, method, url, body, { draft = true } = {}) {
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}/api/v1/${url}${draft ? `${sep}aposMode=draft` : ''}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {})
    },
    body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined)
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return {
    status: res.status,
    json
  };
}
// Like call(), but throws unless 2xx.
async function api(token, method, url, body, opts) {
  const r = await call(token, method, url, body, opts);
  if (r.status < 200 || r.status > 299) {
    throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
  }
  return r.json;
}
async function login(username, password) {
  return (await api(null, 'POST', '@apostrophecms/login/login', {
    username,
    password
  }, { draft: false })).token;
}
const dashboard = (token, route, qs = '') =>
  call(token, 'GET', `${DASHBOARD}/${route}${qs ? `?${qs}` : ''}`, null, { draft: false });
const bigUploadQuery = params => Object.entries(params)
  .map(([ key, value ]) => `aposBigUpload%5B${key}%5D=${encodeURIComponent(value)}`)
  .join('&');

// The import as the browser sends it: core's chunked upload protocol
// (apostrophe/modules/@apostrophecms/http/ui/apos/big-upload-client.js),
// one chunk, then `end`, which runs the import.
async function importFile(token, type, buffer, body) {
  const url = `${type}/import-export-import`;
  const start = await call(token, 'POST', `${url}?${bigUploadQuery({ type: 'start' })}`, {
    files: {
      file: {
        name: `${P}.tar.gz`,
        size: buffer.length,
        type: 'application/gzip',
        chunks: 1
      }
    }
  });
  if (start.status !== 200) {
    return start;
  }
  const { id } = start.json;
  const form = new FormData();
  form.append('chunk', new Blob([ buffer ]), 'chunk');
  const chunk = await call(token, 'POST', `${url}?${bigUploadQuery({
    type: 'chunk',
    id,
    n: 0,
    chunk: 0
  })}`, form);
  if (chunk.status !== 200) {
    return chunk;
  }
  return call(token, 'POST', `${url}?${bigUploadQuery({
    type: 'end',
    id
  })}`, body);
}

const tokens = {};
let product;

async function main() {
  tokens.admin = await login(process.env.APOS_TEST_USER, process.env.APOS_TEST_PASSWORD);
  tokens.editor = await login(
    process.env.APOS_TEST_EDITOR_USER,
    process.env.APOS_TEST_EDITOR_PASSWORD
  );

  // Access
  for (const route of ROUTES) {
    const anonymous = await dashboard(null, route);
    check(`anonymous: ${route} answers 404`, anonymous.status === 404, String(anonymous.status));
    const editor = await dashboard(tokens.editor, route);
    check(`editor: ${route} answers 404`, editor.status === 404, String(editor.status));
  }

  // Overview
  const overview = await dashboard(tokens.admin, 'overview');
  check('admin: overview answers 200', overview.status === 200, String(overview.status));
  const types = overview.json?.types || [];
  const row = name => types.find(type => type.name === name);
  check('overview lists pages and products', Boolean(row('@apostrophecms/page') && row('assurer-product')));
  check('overview leaves out core\'s cross-type views',
    !row('@apostrophecms/recently-edited') && !row('@apostrophecms/submitted-draft'));
  const products = await api(tokens.admin, 'GET', 'assurer-product?perPage=100');
  check('product count matches the REST API',
    row('assurer-product')?.live === products.results.length,
    `${row('assurer-product')?.live} / ${products.results.length}`);
  check('users have a total only (no draft/published)',
    row('@apostrophecms/user')?.published === null && row('@apostrophecms/user')?.live >= 2);
  check('form submissions: count and link only',
    Number.isInteger(overview.json?.formSubmissions?.count) &&
    overview.json.formSubmissions.url === '/assurer/form-submissions');

  // A published product for the find and import checks
  product = await api(tokens.admin, 'POST', 'assurer-product', { title: `${P} product` });
  await api(tokens.admin, 'POST', `assurer-product/${product._id}/publish`, {});

  // Find
  let found = await dashboard(tokens.admin, 'find', `q=${encodeURIComponent('m1-070 TEST prod')}&type=assurer-product`);
  check('find: title, any case, part of it', found.json?.results?.some(doc => doc.aposDocId === product.aposDocId),
    String(found.status));
  check('find: History is offered for products', found.json?.results?.[0]?.history === true);
  found = await dashboard(tokens.admin, 'find', `q=${product.aposDocId}`);
  check('find: by document ID, all types', found.json?.results?.length === 1, String(found.json?.results?.length));
  found = await dashboard(tokens.admin, 'find', `q=${encodeURIComponent('(.*[')}`);
  check('find: regex characters are plain text', found.status === 200 && found.json.results.length === 0,
    String(found.status));
  found = await dashboard(tokens.admin, 'find', 'type=not-a-type&status=archived');
  check('find: unknown type falls back to all types', found.status === 200, String(found.status));

  // Document view
  const doc = await dashboard(tokens.admin, 'document', `_id=${encodeURIComponent(product._id)}`);
  check('document: product data as stored', doc.json?.doc?.title === `${P} product` &&
    doc.json.doc.aposMode === 'draft', String(doc.status));
  const users = await api(tokens.admin, 'GET', '@apostrophecms/user', null, { draft: false });
  const admin = users.results.find(user => user.username === process.env.APOS_TEST_USER);
  const userDoc = await dashboard(tokens.admin, 'document', `_id=${encodeURIComponent(admin._id)}`);
  const keys = Object.keys(userDoc.json?.doc || {});
  check('document: a user shows safe fields only',
    keys.length > 0 && keys.every(key => USER_FIELDS.includes(key)), keys.join(','));
  const missing = await dashboard(tokens.admin, 'document', '_id=nothing-here');
  check('document: unknown ID answers 404', missing.status === 404, String(missing.status));

  // Health
  const health = await dashboard(tokens.admin, 'health');
  check('health: engine and versions', health.json?.engine === 'sqlite' &&
    typeof health.json.versions?.apostrophe === 'string', health.json?.engine);
  const counts = health.json?.counts || {};
  check('health: documents and versions counted',
    counts.documents > 0 && counts.versions > 0, JSON.stringify(counts));

  // Export: admin yes, editor no, users never
  const exportBody = {
    _ids: [ product._id ],
    relatedTypes: []
  };
  const editorExport = await call(tokens.editor, 'POST', 'assurer-product/import-export-export', exportBody);
  check('editor: export refused', editorExport.status === 403, String(editorExport.status));
  const userExport = await call(tokens.admin, 'POST', '@apostrophecms/user/import-export-export', {
    _ids: [ admin._id ],
    relatedTypes: []
  });
  check('users cannot be exported', userExport.status === 404, String(userExport.status));
  const exported = await call(tokens.admin, 'POST', 'assurer-product/import-export-export', exportBody);
  const exportUrl = WINDOWS
    ? (exported.json?.url || '').replace(/\\/g, '/')
    : exported.json?.url || '';
  check('admin: export answers a download URL', exported.status === 200 &&
    /\/uploads\/exports\//.test(exportUrl),
  `${exported.status}${WINDOWS ? ', backslashes allowed on Windows' : ''}`);
  const exportPath = new URL(exportUrl, BASE).pathname.replace(/^\/uploads\//, '');
  const archive = await readFile(path.join(process.env.APOS_TEST_UPLOADS_PATH, 'uploads', exportPath));

  // Change the product and publish, then import the old version as drafts
  const current = await api(tokens.admin, 'GET', `assurer-product/${product._id}`);
  await api(tokens.admin, 'PUT', `assurer-product/${product._id}`, {
    ...current,
    title: `${P} product changed`
  });
  await api(tokens.admin, 'POST', `assurer-product/${product._id}/publish`, {});

  const editorImport = await importFile(tokens.editor, 'assurer-product', archive, { importDraftsOnly: true });
  check('editor: import refused', editorImport.status === 403, String(editorImport.status));

  const imported = await importFile(tokens.admin, 'assurer-product', archive, { importDraftsOnly: true });
  if (WINDOWS) {
    check('admin: import fails on Windows (known package bug)', imported.status === 500,
      String(imported.status));
    for (const name of [
      'admin: import finds the existing product',
      'admin: replace existing answers 200',
      'drafts only: the draft is the imported version',
      'drafts only: the published product is unchanged'
    ]) {
      skip(name, WINDOWS_REASON);
    }
  } else {
    await replaceAsDrafts(imported);
  }
  const visitor = await fetch(`${BASE}/api/v1/assurer-product/${product.aposDocId}:en:draft?aposMode=draft`);
  check('visitors get no draft', [ 401, 403, 404 ].includes(visitor.status), String(visitor.status));

  // Activity log
  const activity = await dashboard(tokens.admin, 'activity');
  const entries = activity.json?.entries || [];
  const has = (kind, test = () => true) =>
    entries.some(entry => entry.kind === kind && test(entry));
  check('activity: export recorded', has('export', e => e.details.outcome === 'done' &&
    e.details.type === 'assurer-product' && e.username === process.env.APOS_TEST_USER));
  if (WINDOWS) {
    check('activity: failed import recorded', has('import', e => e.details.outcome === 'failed' &&
      e.details.draftsOnly === true && e.details.bytes === archive.length),
    JSON.stringify(entries.filter(e => e.kind === 'import').map(e => e.details)));
    skip('activity: import and replacement recorded', WINDOWS_REASON);
  } else {
    check('activity: import recorded', has('import', e => e.details.outcome === 'waiting-for-duplicates' &&
      e.details.draftsOnly === true && e.details.documents >= 1));
    check('activity: replacement recorded', has('import-replace', e => e.details.replaced === 1 &&
      e.details.outcome === 'done'));
  }
  const refusedBy = action => has('refused', e =>
    e.username === process.env.APOS_TEST_EDITOR_USER && e.details.action === action);
  check('activity: refused export, import and dashboard recorded',
    refusedBy('export') && refusedBy('import') && refusedBy('dashboard:overview'));
  check('activity: anonymous refusals are not recorded', !has('refused', e => e.userId === null));
  check('activity: no download URL stored', !JSON.stringify(entries).includes('/uploads/exports/'));
  const onlyImports = await dashboard(tokens.admin, 'activity', 'kind=import');
  check('activity: filter by kind', onlyImports.json?.entries?.length > 0 &&
    onlyImports.json.entries.every(entry => entry.kind === 'import'));
}

// The import found the product: replace it, as drafts only. The draft must
// become the imported version and the published product must not change.
async function replaceAsDrafts(imported) {
  const duplicates = imported.json?.duplicatedDocs || [];
  check('admin: import finds the existing product', imported.status === 200 &&
    duplicates.some(d => d.aposDocId === product.aposDocId), String(imported.status));
  const replaced = await call(tokens.admin, 'POST', '@apostrophecms/import-export/override-duplicates', {
    docIds: [ product.aposDocId ],
    duplicatedDocs: duplicates,
    importedAttachments: imported.json?.importedAttachments || [],
    exportId: imported.json?.exportId,
    jobId: imported.json?.jobId,
    importDraftsOnly: true,
    translate: false,
    overrideLocale: false,
    formatLabel: imported.json?.formatLabel
  }, { draft: false });
  check('admin: replace existing answers 200', replaced.status === 200, String(replaced.status));
  const draft = await api(tokens.admin, 'GET', `assurer-product/${product.aposDocId}:en:draft`);
  const published = await api(tokens.admin, 'GET', `assurer-product/${product.aposDocId}:en:published`,
    null, { draft: false });
  check('drafts only: the draft is the imported version', draft.title === `${P} product`, draft.title);
  check('drafts only: the published product is unchanged', published.title === `${P} product changed`,
    published.title);
}

async function finish() {
  if (product) {
    await call(tokens.admin, 'PATCH', `assurer-product/${product._id}`, { archived: true });
  }
  for (const token of Object.values(tokens)) {
    await call(token, 'POST', '@apostrophecms/login/logout', {}, { draft: false });
  }
}

try {
  await main();
} catch (error) {
  check('suite ran to the end', false, error.message);
} finally {
  await finish();
}
const failed = results.filter(ok => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
