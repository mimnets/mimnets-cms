// Unit tests for the m1-071 widget menus in lib/area.js: which widgets each
// place offers, the group order, and that every listed project widget exists.
// Run: npm run test:unit
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  columnArea, nestedColumnArea, pageArea
} from '../lib/area.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const types = area => Object.values(area.groups)
  .flatMap(group => Object.keys(group.widgets));

test('every place uses groups in the same order', () => {
  const order = [ 'text', 'sections', 'listings', 'forms', 'layout' ];
  for (const area of [ pageArea, columnArea, nestedColumnArea ]) {
    // Core shows group headings only in the expanded Add Content menu.
    assert.equal(area.expanded, true);
    assert.equal(area.widgets, undefined);
    const names = Object.keys(area.groups);
    assert.deepEqual(names, order.filter(name => names.includes(name)));
    for (const group of Object.values(area.groups)) {
      assert.match(group.label, /^project:group/);
    }
  }
});

test('page main areas keep every widget they had and gain the starters', () => {
  const page = types(pageArea);
  for (const type of [
    'assurer-hero', 'assurer-slideshow', 'assurer-product-grid', 'assurer-feature-grid',
    'assurer-stats', 'assurer-product-list', 'assurer-organizations', 'assurer-people',
    'assurer-locations', 'assurer-downloads', 'assurer-gallery', '@apostrophecms/form',
    '@apostrophecms/layout', '@apostrophecms/rich-text', '@apostrophecms/image',
    '@apostrophecms/video', 'layout-3', 'layout-4', 'layout-6'
  ]) {
    assert.ok(page.includes(type), type);
  }
  assert.ok(!page.includes('nested-layout'));
});

test('a layout column offers the hero and grids, no slideshow and no layout starter', () => {
  const column = types(columnArea);
  assert.ok(column.includes('assurer-hero'));
  assert.ok(column.includes('assurer-feature-grid'));
  assert.ok(column.includes('nested-layout'));
  for (const type of [ 'assurer-slideshow', '@apostrophecms/layout', 'layout-3', 'layout-4', 'layout-6' ]) {
    assert.ok(!column.includes(type), type);
  }
});

test('a nested column offers the simple set and grids, no hero and no layout', () => {
  const nested = types(nestedColumnArea);
  for (const type of [ '@apostrophecms/rich-text', 'assurer-stats', 'assurer-gallery', 'assurer-people' ]) {
    assert.ok(nested.includes(type), type);
  }
  for (const type of [ 'assurer-hero', 'assurer-slideshow', 'nested-layout', '@apostrophecms/layout' ]) {
    assert.ok(!nested.includes(type), type);
  }
});

test('every listed project widget has a module', () => {
  const all = new Set([
    ...types(pageArea), ...types(columnArea), ...types(nestedColumnArea)
  ]);
  for (const type of all) {
    if (type.startsWith('@apostrophecms/')) {
      continue;
    }
    assert.ok(existsSync(path.join(root, 'modules', `${type}-widget`, 'index.js')), type);
  }
});
