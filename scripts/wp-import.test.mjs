// Unit tests for the WordPress import (m1-067): parsing, planning, media
// naming and the import state rule. Synthetic HTML only: no real names,
// phone numbers or email addresses.
// Run: npm run test:unit
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IMPORT_USER, stateOf } from '../modules/assurer-wp-import/lib/apply.js';
import { decodeTitle, extractWidgets } from '../modules/assurer-wp-import/lib/extract.js';
import {
  createImageRegistry, createMediaIndex, slugify, tidyCase
} from '../modules/assurer-wp-import/lib/media.js';
import { buildPlan, pagePath } from '../modules/assurer-wp-import/lib/plan.js';
import { checkBaseUrl } from '../modules/assurer-wp-import/lib/source.js';

const SITE = 'https://wp.example.test';
const up = (path) => `${SITE}/wp-content/uploads/${path}`;
const widget = (type, inner, section = 's1') =>
  `<div data-element_type="container" data-id="${section}">` +
  `<div data-widget_type="${type}"><div class="elementor-widget-container">${inner}</div></div></div>`;

function media(id, path, extra = {}) {
  return {
    id,
    date_gmt: '2024-01-01T00:00:00',
    title: { rendered: path },
    mime_type: path.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    source_url: up(path),
    media_details: {
      filesize: 1000,
      sizes: {
        thumbnail: { source_url: up(path.replace(/(\.\w+)$/, '-150x150$1')) }
      }
    },
    ...extra
  };
}

test('source: https only, loopback http allowed for tests', () => {
  assert.equal(checkBaseUrl('https://wp.example.test/'), 'https://wp.example.test');
  assert.equal(checkBaseUrl('http://127.0.0.1:4000'), 'http://127.0.0.1:4000');
  assert.throws(() => checkBaseUrl('http://wp.example.test'), /https/);
});

test('extract: widgets in order with their content', () => {
  const html = [
    widget('heading.default', '<h2 class="elementor-heading-title">Our &amp; Range</h2>'),
    widget('text-editor.default', 'Plain text'),
    widget('counter.default', '<div class="elementor-counter-title">Offices</div>' +
      '<span class="elementor-counter-number-prefix"></span>' +
      '<span class="elementor-counter-number" data-to-value="15">1</span>' +
      '<span class="elementor-counter-number-suffix">+</span>'),
    widget('elementskit-icon-box.default', '<div class="box-body"><h3 class="elementskit-info-box-title"> Trend Watch </h3>' +
      '<p>Market research &gt;&gt;&gt;&gt;.</p></div>'),
    widget('slider_revolution.default', '<p>slides</p>')
  ].join('');
  const widgets = extractWidgets(html);
  assert.deepEqual(widgets.map(w => w.type), [ 'heading', 'text', 'counter', 'box', 'skip' ]);
  assert.equal(widgets[0].text, 'Our & Range');
  assert.equal(widgets[1].html, '<p>Plain text</p>');
  assert.equal(`${widgets[2].prefix}${widgets[2].value}${widgets[2].suffix}`, '15+');
  assert.deepEqual([ widgets[3].title, widgets[3].text ], [ 'Trend Watch', 'Market research' ]);
  assert.equal(decodeTitle('Home Tex &#038; Decor'), 'Home Tex & Decor');
});

test('media: size variants resolve; junk and the spam window are refused', () => {
  const index = createMediaIndex([
    media(1, '2023/02/caps.jpg'),
    media(2, 'elementor/screenshots/Elementor-post-screenshot_1.png'),
    media(3, '2026/11/new.jpg', { date_gmt: '2026-11-09T10:00:00' })
  ], { before: '2026-11-08' });
  assert.equal(index.resolve(up('2023/02/caps-150x150.jpg')).item.id, 1);
  assert.equal(index.resolve(up('2023/02/caps-300x300.jpg')).item.id, 1);
  assert.match(index.resolve(up('elementor/screenshots/Elementor-post-screenshot_1.png')).reason, /placeholder or editor/);
  assert.match(index.resolve(up('2026/11/new.jpg')).reason, /on or after 2026-11-08/);
  assert.match(index.resolve(up('2023/02/missing.jpg')).reason, /not in the media library/);
});

test('media: names and drafted alt text come from where the image is used', () => {
  assert.equal(slugify('Home Tex & Decor'), 'home-tex-and-decor');
  assert.equal(tidyCase('KNITTED KIDS WEAR'), 'Knitted Kids Wear');
  assert.equal(tidyCase('Health-Tex & Medi-Care'), 'Health-Tex & Medi-Care');
  const registry = createImageRegistry();
  const skipped = [];
  const a = registry.add(media(10, '2023/02/IMG_1.jpg'), 'CAPS', skipped);
  const b = registry.add(media(11, '2023/02/IMG_2.jpg'), 'CAPS', skipped);
  assert.equal(registry.add(media(10, '2023/02/IMG_1.jpg'), 'Other', skipped), a);
  assert.deepEqual([ registry.images.get(a).name, registry.images.get(a).alt ], [ 'caps-01.jpg', 'Caps' ]);
  assert.deepEqual([ registry.images.get(b).name, registry.images.get(b).title ], [ 'caps-02.jpg', 'Caps 2' ]);
  assert.equal(registry.add({
    ...media(12, '2023/02/x.svg'),
    mime_type: 'image/svg+xml'
  }, 'Logo', skipped), null);
  assert.equal(skipped.length, 1);
});

test('plan: a category page becomes products, files and a redirect', () => {
  const category = [
    widget('image.default', `<img src="${up('2023/03/caps-150x150.jpg')}">`),
    widget('html.default', '<h5><a href="#caps">CAPS</a></h5><p>Caps for every season.</p>'),
    `<div id="caps">${widget('gallery.default',
      `<a class="e-gallery-item" href="${up('2023/02/cap-a.jpg')}"></a>` +
      `<a class="e-gallery-item" href="${up('2023/02/cap-b.jpg')}"></a>`, 's2')}</div>`
  ].join('');
  const downloads = [
    widget('heading.default', '<h3 class="elementor-heading-title">Range Brochure</h3>', 'd1'),
    widget('text-editor.default', 'Our range in one file.', 'd1'),
    widget('button.default', `<a href="${up('2023/03/brochure.pdf')}">Download</a>`, 'd1'),
    widget('heading.default', '<h3 class="elementor-heading-title">Title</h3>', 'd2'),
    widget('text-editor.default', 'Lorem ipsum dolor sit amet', 'd2'),
    widget('button.default', '<a href="#">Download</a>', 'd2')
  ].join('');
  const page = (id, path, title, content) => ({
    id,
    link: `${SITE}${path}/`,
    title: { rendered: title },
    content: { rendered: content }
  });
  const plan = buildPlan({
    pages: [
      page(1, '/style', 'Style', ''),
      page(2, '/style/activewear-accessories', 'Activewear &#038; Accessories', category),
      page(3, '/downloads/active-wear-accessories', 'Downloads', downloads),
      page(4, '/presentation', 'Presentation', '')
    ],
    mediaIndex: createMediaIndex([
      media(20, '2023/03/caps.jpg'),
      media(21, '2023/02/cap-a.jpg'),
      media(22, '2023/02/cap-b.jpg'),
      media(23, '2023/03/brochure.pdf')
    ], { before: '2026-11-08' })
  });
  assert.equal(pagePath(`${SITE}/style/`), '/style');
  const [ product ] = plan.products;
  assert.equal(product.title, 'Caps');
  assert.equal(product.summary, 'Caps for every season.');
  assert.equal(product.key, 'wordpress:page:2:product:caps');
  assert.equal(product.gallery.length, 2);
  assert.equal(plan.files.length, 1, 'the placeholder card is not a file');
  assert.deepEqual(plan.files[0].tags, [ 'Activewear & Accessories' ]);
  assert.deepEqual(plan.redirects, [ {
    from: '/wp-content/uploads/2023/03/brochure.pdf',
    file: 'wordpress:media:23'
  } ]);
  const categoryPage = plan.pages.find(p => p.path === '/style/activewear-accessories');
  assert.equal(categoryPage.type, 'assurer-product-category-page');
  assert.equal(categoryPage.parentPath, '/style');
  assert.deepEqual(categoryPage.main.map(b => b.kind), [ 'downloads' ]);
  assert.ok(plan.skipped.includes('page /presentation: not migrated (D-CONTENT-3)'));
});

test('apply: the import state rule', () => {
  const ours = {
    updatedBy: { _id: IMPORT_USER._id },
    updatedAt: '2026-11-11T10:00:00Z',
    importHash: 'h1'
  };
  assert.equal(stateOf(null, 'h1'), 'new');
  assert.equal(stateOf(ours, 'h1'), 'unchanged');
  assert.equal(stateOf(ours, 'h2'), 'changed');
  assert.equal(stateOf({
    ...ours,
    updatedBy: { _id: 'someone' }
  }, 'h2'), 'kept');
  assert.equal(stateOf({
    ...ours,
    archived: true
  }, 'h2'), 'kept');
  // Published after the import saved it: a person's decision.
  assert.equal(stateOf({
    ...ours,
    lastPublishedAt: '2026-11-11T11:00:00Z'
  }, 'h2'), 'kept');
  // Published before (the parked home page): still the import's draft.
  assert.equal(stateOf({
    ...ours,
    lastPublishedAt: '2026-11-11T09:00:00Z'
  }, 'h2'), 'changed');
  // Images and files publish themselves on insert.
  assert.equal(stateOf({
    ...ours,
    lastPublishedAt: '2026-11-11T11:00:00Z'
  }, 'h2', { autopublish: true }), 'changed');
  assert.equal(stateOf({
    ...ours,
    updatedBy: { _id: 'someone' },
    importHash: 'adopted'
  }, 'h2'), 'changed');
});
