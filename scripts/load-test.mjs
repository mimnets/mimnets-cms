// Load test for SQLite with Litestream (m1-050, D-DB-13 condition 2), and for
// MongoDB in one container (m1-051, D-DB-8). Disposable test data only. Runs
// inside the load-test container (docker/litestream-poc/compose.load-test.yaml
// or docker/mongodb-load-test/compose.yaml), against the app on
// http://127.0.0.1:3000, through Apostrophe's REST API only.
//
//   node load-test/load-test.mjs seed
//     Adds the agreed size (about 3x today's site, owner 2026-11-08): 100 pages
//     in a tree up to 4 levels deep, 150 pieces, 400 images, and about 10
//     versions (edit + publish) of every page and piece. All titles start
//     with "Load test". Refuses if any "Load test" page already exists.
//
//   node load-test/load-test.mjs run [--duration=60] [--readers=8]
//     First single requests with no load, then the m1-048 P6 profile:
//     <readers> logged-out readers over every published page, plus one draft
//     save a second as the admin. Prints the results as JSON. Event-loop delay
//     comes from scripts/load-test-loop-delay.mjs in the web process.
//
// Credentials: LOAD_TEST_USER (default "admin") and LOAD_TEST_PASSWORD, from
// the environment only; never logged.
import { readFileSync, readdirSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://127.0.0.1:3000';
const USER = process.env.LOAD_TEST_USER || 'admin';
const PASSWORD = process.env.LOAD_TEST_PASSWORD;
const DEMO = process.env.LOAD_TEST_DEMO_CONTENT || '/app/demo-content';
const PREFIX = 'Load test';
const args = Object.fromEntries(process.argv.slice(3)
  .map(a => a.replace(/^--/, '').split('='))
  .map(([ k, v ]) => [ k, v ?? true ]));

// Agreed size: about 3x the WordPress site (29 URLs, ~45 product lines,
// ~300 images, 8 PDFs).
const SIZE = {
  sections: 6, // 2 division pages + 4 default pages under the home page
  childrenPerSection: 5, // product categories under divisions, default pages otherwise
  grandchildrenPerChild: 2,
  deepPages: 4, // a fourth level under the first grandchildren
  products: 60,
  people: 30,
  organizations: 15,
  locations: 20,
  files: 25,
  images: 400,
  versions: 10
};

let token;
async function api(method, url, body, { draft = true } = {}) {
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}/api/v1/${url}${draft ? `${sep}aposMode=draft` : ''}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {})
    },
    body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
    signal: AbortSignal.timeout(60000)
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${url} -> ${res.status} ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function login() {
  if (!PASSWORD) {
    console.error('Set LOAD_TEST_PASSWORD.');
    process.exit(2);
  }
  token = (await api('POST', '@apostrophecms/login/login', {
    username: USER,
    password: PASSWORD
  }, { draft: false })).token;
}

// Runs fn over items with at most `limit` in flight.
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

const id = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
const area = (...items) => ({
  metaType: 'area',
  items
});
const richText = (html) => ({
  _id: id(),
  metaType: 'widget',
  type: '@apostrophecms/rich-text',
  content: html
});
const imageWidget = (image) => ({
  _id: id(),
  metaType: 'widget',
  type: '@apostrophecms/image',
  _image: [ image ]
});
const text = (n) => `<p>${PREFIX} text, paragraph ${n}. ${'Synthetic content for the load test. '.repeat(8)}</p>`;

async function seed() {
  await login();
  const pages = (await api('GET', '@apostrophecms/page?all=1&flat=1')).results || [];
  if (pages.some(p => p.title.startsWith(PREFIX))) {
    throw new Error(`"${PREFIX}" pages already exist; seed only a new, empty copy.`);
  }
  const started = Date.now();
  const log = (msg) => console.log(`[${((Date.now() - started) / 1000).toFixed(0)} s] ${msg}`);

  // Images and files: real attachments, uploaded like the media library does.
  const imageFiles = (await readdir(path.join(DEMO, 'images'))).filter(f => f.endsWith('.png'));
  const imageData = await Promise.all(imageFiles.map(f => readFile(path.join(DEMO, 'images', f))));
  const upload = async (name, data, type) => {
    const form = new FormData();
    form.append('file', new Blob([ data ], { type }), name);
    return api('POST', '@apostrophecms/attachment/upload', form, { draft: false });
  };
  const images = await pool([ ...Array(SIZE.images).keys() ], 4, async (i) => {
    const k = i % imageFiles.length;
    const attachment = await upload(`load-test-${i + 1}-${imageFiles[k]}`, imageData[k], 'image/png');
    return api('POST', '@apostrophecms/image', {
      title: `${PREFIX} image ${i + 1}`,
      attachment
    });
  });
  log(`${images.length} images`);
  const pdf = readFileSync(path.join(DEMO, 'files', readdirSync(path.join(DEMO, 'files'))[0]));
  const files = await pool([ ...Array(SIZE.files).keys() ], 4, async (i) => api('POST', '@apostrophecms/file', {
    title: `${PREFIX} file ${i + 1}`,
    attachment: await upload(`load-test-${i + 1}.pdf`, pdf, 'application/pdf')
  }));
  log(`${files.length} files`);
  const pick = (i) => images[i % images.length];

  // Pages, published, parent before child.
  const versioned = [];
  const insertPage = async (parent, type, title, i, extra = {}) => {
    const doc = await api('POST', '@apostrophecms/page', {
      title,
      type,
      _targetId: parent,
      _position: 'lastChild',
      main: area(richText(`<h2>${title}</h2>${text(1)}${text(2)}`), imageWidget(pick(i)), richText(text(3))),
      ...extra
    });
    await api('POST', `@apostrophecms/page/${doc._id}/publish`, {});
    versioned.push({
      module: '@apostrophecms/page',
      _id: doc._id,
      title
    });
    return doc;
  };
  const sections = [];
  for (let s = 0; s < SIZE.sections; s++) {
    const type = s < 2 ? 'assurer-division-page' : 'default-page';
    sections.push(await insertPage('_home', type, `${PREFIX} section ${s + 1}`, s));
  }
  const children = [];
  for (const [ s, section ] of sections.entries()) {
    for (let c = 0; c < SIZE.childrenPerSection; c++) {
      const type = s < 2 ? 'assurer-product-category-page' : 'default-page';
      const extra = type === 'assurer-product-category-page' ? { _heroImage: [ pick(c) ] } : {};
      children.push(await insertPage(section._id, type, `${PREFIX} page ${s + 1}.${c + 1}`, c, extra));
    }
  }
  const grandchildren = [];
  for (const [ c, child ] of children.entries()) {
    for (let g = 0; g < SIZE.grandchildrenPerChild; g++) {
      grandchildren.push(await insertPage(child._id, 'default-page', `${child.title}.${g + 1}`, c + g));
    }
  }
  for (let d = 0; d < SIZE.deepPages; d++) {
    await insertPage(grandchildren[d]._id, 'default-page', `${PREFIX} deep page ${d + 1}`, d);
  }
  log(`${versioned.length} pages`);

  // Pieces, published.
  const categories = children.filter(p => p.type === 'assurer-product-category-page');
  const insertPiece = async (module, input) => {
    const doc = await api('POST', module, input);
    await api('POST', `${module}/${doc._id}/publish`, {});
    versioned.push({
      module,
      _id: doc._id,
      title: input.title
    });
    return doc;
  };
  const orgs = [];
  for (let i = 0; i < SIZE.organizations; i++) {
    orgs.push(await insertPiece('assurer-organization', {
      title: `${PREFIX} organization ${i + 1}`,
      shortDescription: 'Synthetic organization for the load test.',
      _logo: [ pick(i) ]
    }));
  }
  await pool([ ...Array(SIZE.locations).keys() ], 4, (i) => insertPiece('assurer-location', {
    title: `${PREFIX} location ${i + 1}`,
    city: `Test city ${i + 1}`,
    country: 'Test country',
    _organization: [ orgs[i % orgs.length] ]
  }));
  await pool([ ...Array(SIZE.people).keys() ], 4, (i) => insertPiece('assurer-person', {
    title: `${PREFIX} person ${i + 1}`,
    jobTitle: 'Test role',
    _organization: [ orgs[i % orgs.length] ],
    _photo: [ pick(i) ]
  }));
  await pool([ ...Array(SIZE.products).keys() ], 4, (i) => insertPiece('assurer-product', {
    title: `${PREFIX} product ${i + 1}`,
    summary: 'Synthetic product for the load test.',
    description: area(richText(text(1))),
    _categories: [ categories[i % categories.length] ],
    _image: [ pick(i) ]
  }));
  log(`${versioned.length} pages and pieces`);

  // Versions: each further edit + publish keeps the doc's history growing as
  // an editor's would.
  for (let v = 2; v <= SIZE.versions; v++) {
    await pool(versioned, 4, async ({
      module, _id, title
    }) => {
      await api('PATCH', `${module}/${_id}`, { title: `${title} (v${v})` });
      await api('POST', `${module}/${_id}/publish`, {});
    });
    log(`version ${v} of ${versioned.length} docs`);
  }
  log('done');
}

function stats(values) {
  const sorted = [ ...values ].sort((a, b) => a - b);
  // Nearest-rank percentile.
  const at = (p) => sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil(p / 100 * sorted.length) - 1)]
    : null;
  const round = (n) => n == null ? null : Math.round(n);
  return {
    count: sorted.length,
    p50: round(at(50)),
    p90: round(at(90)),
    p99: round(at(99)),
    max: round(sorted[sorted.length - 1] ?? null)
  };
}

// The web process: the one whose command line is exactly `node app`.
function appPid() {
  for (const pid of readdirSync('/proc').filter(p => /^\d+$/.test(p))) {
    try {
      const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean);
      if (cmd.length === 2 && /node$/.test(cmd[0]) && cmd[1] === 'app') {
        return Number(pid);
      }
    } catch (e) {
      // The process ended while listing.
    }
  }
  throw new Error('web process not found');
}
async function loopDelay(pid) {
  process.kill(pid, 'SIGUSR2');
  await new Promise(resolve => setTimeout(resolve, 200));
  return JSON.parse(readFileSync('/tmp/loop-delay.json', 'utf8'));
}

async function timed(url) {
  const t = performance.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    await res.arrayBuffer();
    return {
      ms: performance.now() - t,
      status: res.status
    };
  } catch (e) {
    return {
      ms: performance.now() - t,
      status: 0
    };
  }
}

async function run() {
  const duration = Number(args.duration || 60) * 1000;
  const readers = Number(args.readers || 8);
  await login();
  const published = (await api('GET', '@apostrophecms/page?all=1&flat=1', null, { draft: false })).results || [];
  // `_url` is absolute on APOS_BASE_URL, which the container cannot reach; the
  // slug is the path.
  const pageUrl = (p) => `${BASE}${p.slug}`;
  const urls = published.filter(p => p.type !== '@apostrophecms/archive-page').map(pageUrl);
  const allDrafts = (await api('GET', '@apostrophecms/page?all=1&flat=1')).results || [];
  // Before the seed (baseline), saves go to the demo home page.
  const seeded = allDrafts.filter(p => p.title.startsWith(PREFIX));
  const drafts = seeded.length ? seeded : allDrafts.filter(p => p.slug === '/');
  const pid = appPid();

  // Single requests, no load: five of each kind, after one warm-up.
  const deep = published.filter(p => p.title.startsWith(`${PREFIX} deep`))[0];
  const category = published.find(p => p.type === 'assurer-product-category-page' && p.title.startsWith(PREFIX));
  const single = {};
  for (const [ name, url ] of Object.entries({
    home: `${BASE}/`,
    section: urls.find(u => /load-test-section-1$/.test(u)),
    productCategory: category && pageUrl(category),
    deepPage: deep && pageUrl(deep),
    notFound: `${BASE}/load-test-no-such-page`
  })) {
    if (!url) {
      continue;
    }
    await timed(url);
    const runs = [];
    for (let i = 0; i < 5; i++) {
      runs.push(await timed(url));
    }
    single[name] = {
      ...stats(runs.map(r => r.ms)),
      statuses: [ ...new Set(runs.map(r => r.status)) ]
    };
  }

  // Load: readers over every published page, one draft save a second.
  await loopDelay(pid); // resets the histogram
  const end = Date.now() + duration;
  const reads = [];
  const saves = [];
  const readerLoops = Array.from({ length: readers }, async (_, r) => {
    let i = r;
    while (Date.now() < end) {
      const result = await timed(urls[i % urls.length]);
      reads.push(result);
      i += readers;
    }
  });
  const pending = [];
  let n = 0;
  const timer = setInterval(() => {
    if (Date.now() >= end) {
      return;
    }
    const doc = drafts[n++ % drafts.length];
    const t = performance.now();
    const save = {
      ms: null,
      ok: false,
      inWindow: false
    };
    saves.push(save);
    pending.push(api('PATCH', `@apostrophecms/page/${doc._id}`, { title: `${doc.title} (load ${n})` })
      .then(() => {
        save.ok = true;
      }, () => {})
      .finally(() => {
        save.ms = performance.now() - t;
        save.inWindow = Date.now() <= end;
      }));
  }, 1000);
  await Promise.all(readerLoops);
  clearInterval(timer);
  const delay = await loopDelay(pid);
  await Promise.all(pending);

  const okReads = reads.filter(r => r.status >= 200 && r.status < 400);
  const result = {
    at: new Date().toISOString(),
    docs: {
      draftPages: allDrafts.length,
      publishedUrls: urls.length
    },
    single,
    load: {
      durationS: duration / 1000,
      readers,
      requests: reads.length,
      errors: reads.length - okReads.length,
      statuses: reads.reduce((acc, r) => ({
        ...acc,
        [r.status]: (acc[r.status] || 0) + 1
      }), {}),
      http: stats(reads.map(r => r.ms)),
      loopDelay: delay,
      saves: {
        started: saves.length,
        completedOkInWindow: saves.filter(s => s.ok && s.inWindow).length,
        completedOk: saves.filter(s => s.ok).length,
        ms: stats(saves.filter(s => s.ok).map(s => s.ms))
      }
    }
  };
  const l = result.load;
  result.pass = {
    httpP99: l.http.p99 <= 1000,
    loopP99: l.loopDelay.p99 <= 200,
    noErrors: l.errors === 0,
    saves90: l.saves.completedOkInWindow >= 0.9 * l.saves.started
  };
  console.log(JSON.stringify(result, null, 2));
}

const commands = {
  seed,
  run
};
const command = commands[process.argv[2]];
if (!command) {
  console.error('Usage: node load-test.mjs seed|run [--duration=60] [--readers=8]');
  process.exit(2);
}
command().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
