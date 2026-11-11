// WordPress import test (m1-067). Starts a small fake WordPress (public REST
// API and uploads, synthetic content, the repository's demo images and PDF)
// on a free loopback port, then:
//   default        runs `assurer-wp-import:run --execute` twice: the first
//                  run creates drafts, the second must change nothing
//   --verify-only  with the site running: the imported pages stay private
//                  and the PDF redirect points at the new file
// Needs a disposable database (WP_IMPORT_TEST_DISPOSABLE=1); run by
// scripts/run-ci-tests.mjs.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const VERIFY_ONLY = process.argv.includes('--verify-only');
const PDF_PATH = '/wp-content/uploads/2023/03/range-brochure.pdf';

if (process.env.WP_IMPORT_TEST_DISPOSABLE !== '1') {
  console.error('Refusing: this test writes drafts. Set WP_IMPORT_TEST_DISPOSABLE=1 on a disposable database.');
  process.exit(2);
}

const UPLOADS = {
  '/wp-content/uploads/2023/02/category.png': 'demo-content/images/product-home.png',
  '/wp-content/uploads/2023/03/caps.png': 'demo-content/images/product-business.png',
  '/wp-content/uploads/2023/02/cap-a.png': 'demo-content/images/product-motor.png',
  '/wp-content/uploads/2023/02/cap-b.png': 'demo-content/images/slide-1-team.png',
  [PDF_PATH]: 'demo-content/files/demo-brochure.pdf'
};

function fixture(origin) {
  const up = (p) => `${origin}${p}`;
  const w = (type, inner, section = 's1') =>
    `<div data-element_type="container" data-id="${section}"><div data-widget_type="${type}">` +
    `<div class="elementor-widget-container">${inner}</div></div></div>`;
  const page = (id, p, title, content) => ({
    id,
    link: `${origin}${p}/`,
    title: { rendered: title },
    content: { rendered: content }
  });
  const pages = [
    page(1, '', 'Home', [
      w('image.default', `<a href="${origin}/style/apparels-textiles/"><img src="${up('/wp-content/uploads/2023/02/category.png')}"></a>`),
      w('heading.default', '<h2 class="elementor-heading-title">Test Category</h2>'),
      w('text-editor.default', '<p>Test category text.</p>'),
      w('counter.default', '<div class="elementor-counter-title">Test Offices</div>' +
        '<span class="elementor-counter-number" data-to-value="3">1</span>')
    ].join('')),
    page(2, '/style', 'Style', ''),
    page(3, '/style/apparels-textiles', 'Test Category', [
      w('image.default', `<img src="${up('/wp-content/uploads/2023/03/caps-150x150.png')}">`),
      w('html.default', '<h5><a href="#caps">TEST CAPS</a></h5><p>Synthetic product for the import test.</p>'),
      `<div id="caps">${w('gallery.default',
        `<a class="e-gallery-item" href="${up('/wp-content/uploads/2023/02/cap-a.png')}"></a>` +
        `<a class="e-gallery-item" href="${up('/wp-content/uploads/2023/02/cap-b.png')}"></a>`, 's2')}</div>`
    ].join('')),
    page(4, '/downloads', 'Downloads', ''),
    page(5, '/downloads/apparels-textiles', 'Downloads', [
      w('heading.default', '<h3 class="elementor-heading-title">Test Brochure</h3>', 'd1'),
      w('button.default', `<a href="${up(PDF_PATH)}">Download</a>`, 'd1')
    ].join('')),
    page(6, '/presentation', 'Presentation', '')
  ];
  const media = Object.keys(UPLOADS).map((p, i) => ({
    id: 100 + i,
    date_gmt: '2024-01-01T00:00:00',
    title: { rendered: path.basename(p) },
    mime_type: p.endsWith('.pdf') ? 'application/pdf' : 'image/png',
    source_url: up(p),
    media_details: {
      filesize: 1000,
      sizes: {
        thumbnail: { source_url: up(p.replace(/(\.\w+)$/, '-150x150$1')) }
      }
    }
  }));
  return {
    pages,
    media
  };
}

async function startFixture() {
  // Filled once the port is known.
  const data = {};
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x.invalid');
    if (req.method !== 'GET') {
      res.writeHead(405).end();
      return;
    }
    const collection = url.pathname.match(/^\/wp-json\/wp\/v2\/(pages|media)$/)?.[1];
    if (collection) {
      res.writeHead(200, {
        'content-type': 'application/json',
        'x-wp-totalpages': '1'
      });
      res.end(JSON.stringify(url.searchParams.get('page') === '1' ? data[collection] : []));
      return;
    }
    const file = UPLOADS[url.pathname];
    if (file) {
      res.writeHead(200).end(await readFile(path.join(root, file)));
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  Object.assign(data, fixture(origin));
  return {
    server,
    origin
  };
}

function runImport(origin) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      'app', 'assurer-wp-import:run', '--execute', `--source=${origin}`
    ], {
      cwd: root,
      env: process.env,
      stdio: [ 'ignore', 'pipe', 'pipe' ]
    });
    let out = '';
    child.stdout.on('data', chunk => {
      out += chunk;
    });
    child.stderr.on('data', chunk => {
      out += chunk;
    });
    child.on('exit', code => resolve({
      code,
      out
    }));
  });
}

// Headings look like "12:00:00 Created (would be) (3)": Apostrophe's log adds the time.
const count = (out, title) => Number((out.match(new RegExp(`\\b${title}[^\\n(]*\\((\\d+)\\)`)) || [])[1] ?? NaN);

let failures = 0;
function check(ok, message) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`);
  if (!ok) {
    failures++;
  }
}

if (VERIFY_ONLY) {
  // The imported drafts are found by their import key, as admin: other tests
  // may already use the WordPress paths, and the import's drafts then get
  // other slugs.
  const login = await fetch(`${BASE_URL}/api/v1/@apostrophecms/login/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: process.env.APOS_TEST_USER,
      password: process.env.APOS_TEST_PASSWORD
    })
  });
  const { token } = await login.json();
  const api = async (p) => (await fetch(`${BASE_URL}/api/v1/${p}`, {
    headers: { authorization: `Bearer ${token}` }
  })).json();
  const imported = (docs) => (docs || []).filter(d => String(d.importSource || '').startsWith('wordpress:'));
  // The page list returns fewer fields; each page's own GET has the import key.
  const list = (await api('@apostrophecms/page?aposMode=draft&all=1&flat=1')).results || [];
  const drafts = imported(await Promise.all(list.map(p => api(`@apostrophecms/page/${p._id}?aposMode=draft`))));
  check(drafts.length >= 3, `imported draft pages found (${drafts.length})`);
  for (const page of drafts) {
    const publishedId = page._id.replace(/:draft$/, ':published');
    const res = await fetch(`${BASE_URL}/api/v1/@apostrophecms/page/${publishedId}`, {
      headers: { authorization: `Bearer ${token}` }
    });
    if (page.slug === '/') {
      // Apostrophe creates and publishes the home page itself; the import may
      // only fill its draft, so the published version must not carry the key.
      const home = await res.json();
      check(!home.importSource, 'published home page has none of the imported content');
      continue;
    }
    check(res.status === 404, `imported page ${page.slug} has no published version (${res.status})`);
    const visitor = await fetch(`${BASE_URL}${page.slug}`, { redirect: 'manual' });
    check(visitor.status === 404, `logged out, imported draft ${page.slug} is not public (${visitor.status})`);
  }
  const products = imported((await api('assurer-product?aposMode=published&perPage=100')).results);
  check(products.length === 0, `no imported product has a published version (${products.length})`);
  const res = await fetch(`${BASE_URL}${PDF_PATH}`, { redirect: 'manual' });
  const location = res.headers.get('location') || '';
  check(res.status === 301 && /\/uploads\/attachments\/[^/]+\.pdf$/.test(location),
    `old PDF URL redirects to the new file (${res.status} ${location})`);
} else {
  const { server, origin } = await startFixture();
  try {
    const first = await runImport(origin);
    check(first.code === 0, `first run exits 0 (${first.code})`);
    check(count(first.out, 'Created') >= 9, `first run creates the drafts (${count(first.out, 'Created')})`);
    check(count(first.out, 'Failed') === 0, 'first run: nothing failed');
    check(/page \/presentation: not migrated/.test(first.out), 'retired page is skipped');
    const second = await runImport(origin);
    check(second.code === 0, `second run exits 0 (${second.code})`);
    check(count(second.out, 'Created') === 0 && count(second.out, 'Updated') === 0,
      `second run changes nothing (created ${count(second.out, 'Created')}, updated ${count(second.out, 'Updated')})`);
    if (failures) {
      console.log(`\n-- first run --\n${first.out}\n-- second run --\n${second.out}`);
    }
  } finally {
    server.close();
  }
}
console.log(failures ? `\n${failures} check(s) failed` : '\nWordPress import test passed');
process.exit(failures ? 1 : 0);
