// Publishing workflow suite (m1-037, D-CONTENT-11 option B: review before
// publish), against a running server on a DISPOSABLE database, through the
// same REST endpoints the admin UI calls. Run by `npm run test:ci` only: it
// creates records, so it refuses to run unless PUBLISH_TEST_DISPOSABLE=1.
//
//   node scripts/publishing-workflow-test.mjs                (main run)
//   node scripts/publishing-workflow-test.mjs --verify-only  (after a restart)
//
// Credentials come from the environment: APOS_TEST_USER / APOS_TEST_PASSWORD
// (admin), APOS_TEST_EDITOR_USER / APOS_TEST_EDITOR_PASSWORD (editor, the
// approver) and APOS_TEST_CONTRIBUTOR_USER / APOS_TEST_CONTRIBUTOR_PASSWORD
// (contributor). Bearer tokens are revoked at the end. Covers: a contributor
// drafts pages, pieces and Global Content but cannot publish, unpublish or
// archive published content; submit, the editors' Submitted drafts list,
// publish by an editor, dismiss and withdraw; nothing reaches visitors until
// an editor publishes; the project delete guard (modules/@apostrophecms/doc);
// areas a contributor cannot reach (redirects, Global Styles, users, form
// submissions, the media library); and persistence after a restart.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const VERIFY_ONLY = process.argv.includes('--verify-only');
const imagesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../demo-content/images');
const P = 'm1-037 test';
const SLUGS = {
  existing: '/m1-037-test-existing',
  proposed: '/m1-037-test-proposed'
};
const TITLES = {
  approved: `${P} approved product`,
  dismissed: `${P} dismissed product`,
  pending: `${P} pending product`
};

if (process.env.PUBLISH_TEST_DISPOSABLE !== '1') {
  console.error('Refusing to run: this suite writes test records. It runs from `npm run test:ci` ' +
    '(PUBLISH_TEST_DISPOSABLE=1) on a throwaway database only.');
  process.exit(2);
}
for (const name of [
  'APOS_TEST_USER', 'APOS_TEST_PASSWORD',
  'APOS_TEST_EDITOR_USER', 'APOS_TEST_EDITOR_PASSWORD',
  'APOS_TEST_CONTRIBUTOR_USER', 'APOS_TEST_CONTRIBUTOR_PASSWORD'
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
const refused = r => [ 401, 403, 404 ].includes(r.status);

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
const page = async (p) => {
  const res = await fetch(`${BASE}${p}`);
  return {
    status: res.status,
    html: await res.text()
  };
};
const findOne = async (token, type, title) => (await api(token, 'GET',
  `${type}?title=${encodeURIComponent(title)}&archived=any`)).results?.find(d => d.title === title);
const pageBySlug = async (token, slug) => ((await api(token, 'GET',
  '@apostrophecms/page?all=1&flat=1&archived=any')).results || []).find(p => p.slug === slug);
// The published version of a document, as the admin sees it, or null.
const published = async (type, doc) => {
  const r = await call(tokens.admin, 'GET', `${type}/${doc.aposDocId}:en:published`, null, { draft: false });
  return r.status === 200 ? r.json : null;
};
// The draft, as the admin sees it, or null.
const draftOf = async (type, doc) => {
  const r = await call(tokens.admin, 'GET', `${type}/${doc.aposDocId}:en:draft`);
  return r.status === 200 ? r.json : null;
};
const submittedList = async token => (await api(token, 'GET', '@apostrophecms/submitted-draft?perPage=100')).results || [];

const tokens = {};
tokens.admin = await login(process.env.APOS_TEST_USER, process.env.APOS_TEST_PASSWORD);
tokens.editor = await login(
  process.env.APOS_TEST_EDITOR_USER,
  process.env.APOS_TEST_EDITOR_PASSWORD
);
tokens.contributor = await login(
  process.env.APOS_TEST_CONTRIBUTOR_USER,
  process.env.APOS_TEST_CONTRIBUTOR_PASSWORD
);
check('admin, editor and contributor log in', Boolean(tokens.admin && tokens.editor && tokens.contributor));
const me = await api(tokens.contributor, 'POST', '@apostrophecms/login/whoami', {}, { draft: false }).catch(() => null);
check('contributor session identifies the contributor account',
  me?.username === process.env.APOS_TEST_CONTRIBUTOR_USER);
const contributorUser = (await api(tokens.admin, 'GET',
  `@apostrophecms/user?username=${encodeURIComponent(process.env.APOS_TEST_CONTRIBUTOR_USER)}`, null, { draft: false }))
  .results?.find(u => u.username === process.env.APOS_TEST_CONTRIBUTOR_USER);
check('test account has the core contributor role', contributorUser?.role === 'contributor');

if (VERIFY_ONLY) {
  await verifyAfterRestart();
  await finish();
}

const co = (method, url, body) => call(tokens.contributor, method, url, body);

// --- Pieces: draft, refused publish, submit, editor publishes --------------
let r = await co('POST', 'assurer-product', {
  title: TITLES.approved,
  summary: 'Contributor draft.'
});
check('contributor creates a product draft', r.status === 200 && r.json.aposMode === 'draft', String(r.status));
const approved = r.json;
check('the new draft is not published', !(await published('assurer-product', approved)));

r = await co('POST', `assurer-product/${approved._id}/publish`, {});
check('contributor cannot publish (refused by the server)', refused(r), String(r.status));
check('still not published after the attempt', !(await published('assurer-product', approved)));

r = await co('POST', `assurer-product/${approved._id}/submit`, {});
check('contributor submits the draft for review',
  r.status === 200 && r.json.byId === contributorUser?._id && Boolean(r.json.at),
  String(r.status));

let tray = await submittedList(tokens.editor);
const item = tray.find(d => d.aposDocId === approved.aposDocId);
check('editor sees the draft in Submitted drafts, with the submitter',
  item?.type === 'assurer-product' && item?.submitted?.byId === contributorUser?._id);
check('submitted draft is still not public', !(await published('assurer-product', approved)));

r = await call(tokens.editor, 'PATCH', `assurer-product/${approved._id}`, { summary: 'Checked by the editor.' });
check('editor can change the submitted draft before publishing', r.status === 200, String(r.status));
r = await call(tokens.editor, 'POST', `assurer-product/${approved._id}/publish`, {});
check('editor publishes the submitted draft', r.status === 200, String(r.status));
const approvedLive = await published('assurer-product', approved);
check('published version has the editor\'s text', approvedLive?.summary === 'Checked by the editor.');
tray = await submittedList(tokens.editor);
check('publishing clears the submission', !tray.some(d => d.aposDocId === approved.aposDocId));

// Editing a published piece makes a draft only.
r = await co('PATCH', `assurer-product/${approved._id}`, { summary: 'Unreviewed change.' });
check('contributor edits a published product (draft only)', r.status === 200, String(r.status));
check('published product unchanged by the contributor edit',
  (await published('assurer-product', approved))?.summary === 'Checked by the editor.');
r = await call(tokens.contributor, 'PATCH', `assurer-product/${approved.aposDocId}:en:published`,
  { summary: 'Direct write to the published version.' }, { draft: false });
check('contributor cannot write the published version directly', refused(r), String(r.status));
check('published product still unchanged',
  (await published('assurer-product', approved))?.summary === 'Checked by the editor.');

// Archive, delete and unpublish of published content need publish rights.
r = await co('POST', `assurer-product/${approved._id}/unpublish`, {});
check('contributor cannot unpublish', refused(r), String(r.status));
r = await co('DELETE', `assurer-product/${approved._id}`);
check('contributor cannot delete a published product', refused(r), String(r.status));
// Core deletes the draft before refusing the published copy; the project
// guard (modules/@apostrophecms/doc) refuses first, so nothing is lost.
check('the draft survives the refused delete', Boolean(await draftOf('assurer-product', approved)));
r = await co('PATCH', `assurer-product/${approved._id}`, { archived: true });
check('contributor cannot archive a published product', r.status !== 200, String(r.status));
const afterArchive = await published('assurer-product', approved);
check('published product still live and not archived', afterArchive && !afterArchive.archived);
await api(tokens.editor, 'POST', `assurer-product/${approved._id}/revert-draft-to-published`, {});

// --- Dismiss (editor) and withdraw (contributor) -------------------------
r = await co('POST', 'assurer-product', {
  title: TITLES.dismissed,
  summary: 'Will be dismissed.'
});
const dismissed = r.json;
await api(tokens.contributor, 'POST', `assurer-product/${dismissed._id}/submit`, {});
r = await call(tokens.editor, 'POST', `assurer-product/${dismissed._id}/dismiss-submission`, {});
check('editor dismisses a submission', r.status === 200, String(r.status));
tray = await submittedList(tokens.editor);
const dismissedDraft = await findOne(tokens.contributor, 'assurer-product', TITLES.dismissed);
check('dismissed: off the list, draft kept, not published',
  !tray.some(d => d.aposDocId === dismissed.aposDocId) && dismissedDraft?.summary === 'Will be dismissed.' &&
  !(await published('assurer-product', dismissed)));

r = await co('POST', 'assurer-product', {
  title: TITLES.pending,
  summary: 'Left waiting for review.'
});
const pending = r.json;
await api(tokens.contributor, 'POST', `assurer-product/${pending._id}/submit`, {});
r = await co('POST', `assurer-product/${pending._id}/dismiss-submission`, {});
check('contributor withdraws their own submission', r.status === 200, String(r.status));
check('withdrawn submission leaves the list',
  !(await submittedList(tokens.editor)).some(d => d.aposDocId === pending.aposDocId));
// Submit again and leave it waiting for the restart check.
await api(tokens.contributor, 'POST', `assurer-product/${pending._id}/submit`, {});
const ownList = await submittedList(tokens.contributor);
check('contributor\'s Submitted drafts list shows only their own',
  ownList.length > 0 && ownList.every(d => d.submitted?.byId === contributorUser?._id));

// --- Pages: an edit to a live page, and a proposed new page ---------------
let existing = await call(tokens.editor, 'POST', '@apostrophecms/page', {
  title: `${P} existing page`,
  type: 'default-page',
  slug: SLUGS.existing,
  _targetId: '_home',
  _position: 'lastChild'
});
existing = existing.json;
await api(tokens.editor, 'POST', `@apostrophecms/page/${existing._id}/publish`, {});
check('editor publishes a page (setup)', (await page(SLUGS.existing)).status === 200);

r = await co('PATCH', `@apostrophecms/page/${existing._id}`, { title: `${P} existing page, revised` });
check('contributor edits a live page (draft)', r.status === 200, String(r.status));
r = await co('POST', `@apostrophecms/page/${existing._id}/publish`, {});
check('contributor cannot publish the page', refused(r), String(r.status));
let live = await page(SLUGS.existing);
check('visitors still see the old page title',
  live.html.includes(`${P} existing page`) && !live.html.includes('existing page, revised'));
const anonDraft = await page(`${SLUGS.existing}?aposMode=draft`);
check('anonymous ?aposMode=draft gets no draft', !anonDraft.html.includes('existing page, revised'));
r = await co('POST', `@apostrophecms/page/${existing._id}/submit`, {});
check('contributor submits the page edit', r.status === 200, String(r.status));
tray = await submittedList(tokens.editor);
check('page appears in the editor\'s Submitted drafts',
  tray.some(d => d.aposDocId === existing.aposDocId && d.type === 'default-page'));
r = await call(tokens.editor, 'POST', `@apostrophecms/page/${existing._id}/publish`, {});
live = await page(SLUGS.existing);
check('after the editor publishes, visitors see the change',
  r.status === 200 && live.html.includes('existing page, revised'), String(r.status));

r = await co('POST', '@apostrophecms/page', {
  title: `${P} proposed page`,
  type: 'default-page',
  slug: SLUGS.proposed,
  _targetId: '_home',
  _position: 'lastChild'
});
check('contributor creates a new page draft', r.status === 200, String(r.status));
const proposed = r.json;
check('the new page is not public', (await page(SLUGS.proposed)).status === 404);
await api(tokens.contributor, 'POST', `@apostrophecms/page/${proposed._id}/submit`, {});
await api(tokens.editor, 'POST', `@apostrophecms/page/${proposed._id}/publish`, {});
check('the new page is public once an editor publishes it', (await page(SLUGS.proposed)).status === 200);
r = await co('PATCH', `@apostrophecms/page/${proposed._id}`, { archived: true });
check('contributor cannot archive the published page', (await page(SLUGS.proposed)).status === 200, String(r.status));
r = await co('DELETE', `@apostrophecms/page/${proposed._id}`);
check('contributor cannot delete the published page; page and draft kept',
  refused(r) && (await page(SLUGS.proposed)).status === 200 &&
  Boolean(await pageBySlug(tokens.admin, SLUGS.proposed)), String(r.status));

// The guard leaves never-published drafts and editors alone.
r = await co('POST', 'assurer-product', { title: `${P} throwaway draft` });
const throwaway = r.json;
r = await co('DELETE', `assurer-product/${throwaway._id}`);
check('contributor can still delete their own never-published draft',
  r.status === 200 && !(await draftOf('assurer-product', throwaway)), String(r.status));
r = await call(tokens.editor, 'POST', 'assurer-product', { title: `${P} editor delete` });
const editorDoc = r.json;
await api(tokens.editor, 'POST', `assurer-product/${editorDoc._id}/publish`, {});
r = await call(tokens.editor, 'DELETE', `assurer-product/${editorDoc._id}`);
check('editor can still delete published content (draft and published copy)',
  r.status === 200 && !(await draftOf('assurer-product', editorDoc)) &&
  !(await published('assurer-product', editorDoc)), String(r.status));

// --- Global Content: draft only (option B, not B1) -------------------------
const g = await api(tokens.admin, 'GET', '@apostrophecms/global');
const globalDoc = g._id ? g : g.results?.[0];
r = await co('PATCH', `@apostrophecms/global/${globalDoc._id}`, { footerText: `${P} unreviewed footer` });
check('contributor can draft a Global Content change', r.status === 200, String(r.status));
r = await co('POST', `@apostrophecms/global/${globalDoc._id}/publish`, {});
check('contributor cannot publish Global Content', refused(r), String(r.status));
check('visitors do not see the drafted footer', !(await page('/')).html.includes(`${P} unreviewed footer`));
await api(tokens.editor, 'POST', `@apostrophecms/global/${globalDoc._id}/revert-draft-to-published`, {});

// --- Areas a contributor cannot reach ------------------------------------
r = await call(tokens.contributor, 'POST', '@apostrophecms/redirect', {
  title: `${P} redirect`,
  redirectSlug: '/m1-037-test-redirect',
  urlType: 'external',
  externalUrl: 'https://example.com/'
});
check('contributor cannot create a redirect', refused(r), String(r.status));
r = await call(tokens.contributor, 'GET', '@apostrophecms/redirect');
check('contributor cannot list redirects', r.status !== 200 || (r.json.results || []).length === 0,
  `${r.status}, ${(r.json?.results || []).length}`);
{
  const s = await api(tokens.admin, 'GET', '@apostrophecms/styles');
  const stylesDoc = s._id ? s : s.results?.[0];
  r = await co('PATCH', `@apostrophecms/styles/${stylesDoc._id}`, { lineHeight: 2.5 });
  check('contributor cannot change Global Styles', refused(r), String(r.status));
}
r = await call(tokens.contributor, 'GET', '@apostrophecms/user', null, { draft: false });
check('contributor cannot read user accounts', r.status !== 200 || (r.json.results || []).length === 0,
  `${r.status}, ${(r.json?.results || []).length}`);
r = await call(tokens.contributor, 'POST', '@apostrophecms/user', {
  username: 'm1-037-escalation',
  title: 'escalation',
  role: 'editor',
  password: 'escalation-attempt-password'
}, { draft: false });
check('contributor cannot create a user', refused(r), String(r.status));
r = await call(tokens.contributor, 'PATCH', `@apostrophecms/user/${contributorUser._id}`, { role: 'editor' }, { draft: false });
const roleAfter = (await api(tokens.admin, 'GET', `@apostrophecms/user/${contributorUser._id}`, null, { draft: false })).role;
check('contributor cannot raise their own role', refused(r) && roleAfter === 'contributor', `${r.status}, ${roleAfter}`);
{
  const get = token => fetch(`${BASE}/assurer/form-submissions`, { headers: { authorization: `Bearer ${token}` } });
  const admin = await get(tokens.admin);
  const contributor = await get(tokens.contributor);
  check('form submissions: admin 200, contributor 404', admin.status === 200 && contributor.status === 404,
    `${admin.status}, ${contributor.status}`);
}

// --- Media: editors add it, contributors choose it ------------------------
// Core gives images, files and their tags `editRole: 'editor'`. A
// contributor may still upload a raw attachment (core `upload-attachment`).
{
  const pngForm = async () => {
    const fd = new FormData();
    fd.append('file', new Blob([ await readFile(path.join(imagesDir, 'product-home.png')) ], { type: 'image/png' }), 'm1-037.png');
    return fd;
  };
  r = await call(tokens.contributor, 'POST', '@apostrophecms/attachment/upload', await pngForm(), { draft: false });
  check('contributor may upload a raw attachment (core upload-attachment)', r.status === 200, String(r.status));
  const attachment = r.json;
  r = await co('POST', '@apostrophecms/image', {
    title: `${P} contributor image`,
    alt: `${P} contributor image alt text`,
    attachment
  });
  check('contributor cannot add an image to the media library', refused(r), String(r.status));
  check('no image was created', !(await findOne(tokens.admin, '@apostrophecms/image', `${P} contributor image`)));
  r = await co('POST', '@apostrophecms/file', {
    title: `${P} contributor file`,
    attachment
  });
  check('contributor cannot add a file to the media library', refused(r), String(r.status));
  r = await co('POST', '@apostrophecms/image-tag', { title: `${P} tag` });
  check('contributor cannot add a media tag', refused(r), String(r.status));

  const editorAttachment = await api(tokens.editor, 'POST', '@apostrophecms/attachment/upload', await pngForm(), { draft: false });
  const image = await api(tokens.editor, 'POST', '@apostrophecms/image', {
    title: `${P} editor image`,
    alt: `${P} editor image alt text`,
    attachment: editorAttachment
  });
  r = await co('PATCH', `assurer-product/${dismissed._id}`, { _image: [ image ] });
  check('contributor chooses an existing image for a draft',
    r.status === 200 && (r.json.imageIds || []).length === 1, String(r.status));
}

await finish();

async function verifyAfterRestart() {
  const a = await findOne(tokens.admin, 'assurer-product', TITLES.approved);
  check('after restart: approved product still published', a && (await published('assurer-product', a))?.summary === 'Checked by the editor.');
  const d = await findOne(tokens.admin, 'assurer-product', TITLES.dismissed);
  check('after restart: dismissed product still a draft, not submitted',
    d && !d.submitted && !(await published('assurer-product', d)));
  const p = await findOne(tokens.admin, 'assurer-product', TITLES.pending);
  const tray = await submittedList(tokens.editor);
  check('after restart: pending submission still waiting for the editor',
    p && tray.some(x => x.aposDocId === p.aposDocId) && !(await published('assurer-product', p)));
  check('after restart: approved page change still public',
    (await page(SLUGS.existing)).html.includes('existing page, revised'));
  const existing = await pageBySlug(tokens.admin, SLUGS.existing);
  check('after restart: page is found in the tree', Boolean(existing));
}

async function finish() {
  for (const token of Object.values(tokens)) {
    await call(token, 'POST', '@apostrophecms/login/logout', {}, { draft: false })
      .catch(e => console.log(`WARN  logout failed: ${e.message}`));
  }
  const failed = results.filter(ok => !ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}
