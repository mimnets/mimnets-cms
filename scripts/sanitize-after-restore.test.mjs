// Unit tests for the "sanitize after restore" guard and targets (m1-032).
// Run: npm run test:unit
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkSanitizeArgs,
  SANITIZE_TARGETS
} from '../modules/assurer-security/lib/sanitize.js';

test('dry run by default, with or without a matching --database', () => {
  assert.deepEqual(checkSanitizeArgs({}, 'site'), { execute: false });
  assert.deepEqual(checkSanitizeArgs({ database: 'site' }, 'site'), { execute: false });
});

test('--execute needs --database', () => {
  assert.throws(() => checkSanitizeArgs({ execute: true }, 'site'), /needs --database=<name>.*"site"/);
});

test('--database must match the configured database', () => {
  assert.throws(() => checkSanitizeArgs({
    execute: true,
    database: 'other'
  }, 'site'), /does not match/);
  assert.throws(() => checkSanitizeArgs({ database: 'other' }, 'site'), /does not match/);
  assert.deepEqual(checkSanitizeArgs({
    execute: true,
    database: 'site'
  }, 'site'), { execute: true });
});

test('a bare --execute flag value other than true does not execute', () => {
  assert.deepEqual(checkSanitizeArgs({
    execute: 'false',
    database: 'site'
  }, 'site'), { execute: false });
});

test('targets: authentication state only', () => {
  assert.deepEqual(SANITIZE_TARGETS.map(target => target.collection), [
    'sessions',
    'aposBearerTokens',
    'aposCache',
    'aposUsersSafe'
  ]);
  const cache = SANITIZE_TARGETS.find(target => target.collection === 'aposCache');
  const pattern = new RegExp(cache.filter.namespace.$regex);
  assert.ok(pattern.test('@apostrophecms/loginAttempt'));
  assert.ok(pattern.test('@apostrophecms/loginAttempt/AposTotp'));
  assert.ok(!pattern.test('assurer-form-rate-limit'));
  assert.ok(!pattern.test('@apostrophecms/loginAttempts-other'));
  const safe = SANITIZE_TARGETS.find(target => target.collection === 'aposUsersSafe');
  assert.equal(safe.action, 'unset');
  assert.equal(safe.field, 'passwordResetHash');
});
