// Unit tests for the demonstration chrome switch (m1-029).
// Run: npm run test:unit
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readDemoSite } from '../lib/demo-site.js';

test('demo site: off unless APOS_DEMO_SITE=1', () => {
  assert.equal(readDemoSite({}), false);
  assert.equal(readDemoSite({ APOS_DEMO_SITE: '' }), false);
  assert.equal(readDemoSite({ APOS_DEMO_SITE: '0' }), false);
  assert.equal(readDemoSite({ APOS_DEMO_SITE: '1' }), true);
  assert.equal(readDemoSite({ APOS_DEMO_SITE: ' 1 ' }), true);
});

test('demo site: other values throw', () => {
  for (const value of [ 'true', 'yes', '2' ]) {
    assert.throws(() => readDemoSite({ APOS_DEMO_SITE: value }), /APOS_DEMO_SITE must be 1/);
  }
});
