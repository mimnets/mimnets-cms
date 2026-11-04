// Unit tests for the m1-037 test-contributor guard
// (`assurer-test:ensure-contributor`, D-CONTENT-11).
// Run: npm run test:unit
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { contributorRefuseReason } from '../modules/assurer-test/lib/guard.js';

const tmp = mkdtempSync(path.join(os.tmpdir(), 'publishing-workflow-test-'));
const opts = { tmpDirs: [ tmp ] };
after(() => rmSync(tmp, {
  recursive: true,
  force: true
}));
const tempDb = `sqlite://${path.join(tmp, 'ci.sqlite')}`;

test('test contributor guard: temp database and contributor credentials required', () => {
  const env = {
    APOS_DB_URI: tempDb,
    APOS_TEST_CONTRIBUTOR_USER: 'ci-contributor',
    APOS_TEST_CONTRIBUTOR_PASSWORD: 'x'.repeat(32)
  };
  assert.equal(contributorRefuseReason(env, opts), null);
  assert.match(contributorRefuseReason({
    ...env,
    APOS_TEST_CONTRIBUTOR_PASSWORD: 'short'
  }, opts), /APOS_TEST_CONTRIBUTOR_PASSWORD/);
  assert.match(contributorRefuseReason({
    ...env,
    APOS_TEST_CONTRIBUTOR_USER: ''
  }, opts), /APOS_TEST_CONTRIBUTOR_USER/);
  assert.match(contributorRefuseReason({
    ...env,
    APOS_DB_URI: 'sqlite://./data/vcl-assurer-group.db'
  }, opts), /temporary SQLite|absolute path/);
  assert.match(contributorRefuseReason({
    ...env,
    NODE_ENV: 'production'
  }, opts), /production/);
});

test('test contributor guard: the editor and admin variables are not used', () => {
  assert.match(contributorRefuseReason({
    APOS_DB_URI: tempDb,
    APOS_TEST_USER: 'ci-admin',
    APOS_TEST_PASSWORD: 'x'.repeat(32),
    APOS_TEST_EDITOR_USER: 'ci-editor',
    APOS_TEST_EDITOR_PASSWORD: 'x'.repeat(32)
  }, opts), /APOS_TEST_CONTRIBUTOR_USER/);
});
