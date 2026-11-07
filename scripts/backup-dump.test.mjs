// Unit tests for the dump without Litestream's tables (m1-049).
// Run: npm run test:unit
//
// Uses a temporary SQLite file through @apostrophecms/db-connect, with tables
// shaped like Litestream's (no `_id` column), and restores the dump with
// db-connect's own `restore()` into a second, new file. Each dump uses a new
// connection, as the task does.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  after, before, test
} from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import dbConnect, { restore } from '@apostrophecms/db-connect';
import {
  checkDumpArgs,
  isSkipped,
  writeDump
} from '../modules/assurer-backup/lib/dump.js';

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'assurer-backup-test-'));
const sourceFile = path.join(work, 'source.sqlite');
const sourceUri = `sqlite://${sourceFile}`;

async function dumpWithNewConnection(output) {
  const client = await dbConnect(sourceUri);
  try {
    return await writeDump(client.db(), output);
  } finally {
    await client.close();
  }
}

before(async () => {
  const client = await dbConnect(sourceUri);
  const db = client.db();
  await db.collection('aposDocs').insertMany([
    {
      _id: 'a',
      title: 'A',
      updatedAt: new Date('2026-11-07T00:00:00Z')
    },
    {
      _id: 'b',
      title: 'B'
    }
  ]);
  await db.collection('aposDocs').createIndex({ title: 1 });
  await db.collection('aposMigrations').insertOne({ _id: 'm1' });
  // The same key on two collections: the app's connection would name both
  // `expires_1`, and SQLite index names are database-wide.
  await db.collection('aposCache').createIndex({ expires: 1 });
  await db.collection('sessions').createIndex({ expires: 1 });
  await client.close();
  // Tables named like Litestream's, without an `_id` column.
  const raw = new DatabaseSync(sourceFile);
  raw.exec('CREATE TABLE _litestream_seq (id INTEGER PRIMARY KEY, seq INTEGER)');
  raw.exec('CREATE TABLE _litestream_lock (id INTEGER)');
  raw.exec('INSERT INTO _litestream_seq (id, seq) VALUES (1, 42)');
  raw.close();
});

after(() => {
  fs.rmSync(work, {
    recursive: true,
    force: true
  });
});

test('only _litestream_ tables are skipped', () => {
  assert.equal(isSkipped('_litestream_seq'), true);
  assert.equal(isSkipped('_litestream_lock'), true);
  assert.equal(isSkipped('aposDocs'), false);
  assert.equal(isSkipped('litestream'), false);
});

test('--output is required and must be a new file', () => {
  assert.throws(() => checkDumpArgs({}), /--output=<file> is required/);
  assert.throws(() => checkDumpArgs({ output: true }), /--output=<file> is required/);
  assert.throws(() => checkDumpArgs({ output: sourceFile }), /already exists/);
  const output = path.join(work, 'new.ndjson');
  assert.deepEqual(checkDumpArgs({ output }), { output });
});

test('dumps Apostrophe collections, leaves out Litestream tables, restores', async () => {
  const output = path.join(work, 'dump.ndjson');
  const result = await dumpWithNewConnection(output);
  assert.deepEqual(result.skipped.sort(), [ '_litestream_lock', '_litestream_seq' ]);
  const byName = Object.fromEntries(result.collections.map(c => [ c.name, c.docs ]));
  assert.equal(byName.aposDocs, 2);
  assert.equal(byName.aposMigrations, 1);
  assert.equal(Object.keys(byName).some(isSkipped), false);
  assert.equal(fs.existsSync(`${output}.partial`), false);

  const text = fs.readFileSync(output, 'utf8');
  assert.equal(text.includes('_litestream_'), false);
  const lines = text.trim().split('\n').map(line => JSON.parse(line));
  const header = lines.find(l => l._collection === 'aposDocs' && !l._doc);
  assert.ok(header._indexes.some(i => i.key?.title === 1));

  // Restore into a new, empty file only.
  const targetFile = path.join(work, 'restored.sqlite');
  assert.equal(fs.existsSync(targetFile), false);
  const target = await dbConnect(`sqlite://${targetFile}`);
  try {
    await restore(target.db(), fs.createReadStream(output));
    const docs = await target.db().collection('aposDocs').find({}).sort({ _id: 1 }).toArray();
    assert.deepEqual(docs.map(d => d.title), [ 'A', 'B' ]);
    assert.ok(docs[0].updatedAt instanceof Date);
  } finally {
    await target.close();
  }
  // Read from SQLite itself: the adapter's `indexes()` also lists indexes it
  // was asked for but SQLite did not create.
  const check = new DatabaseSync(targetFile, { readOnly: true });
  for (const name of [ 'aposCache', 'sessions' ]) {
    const found = check.prepare(
      'SELECT name FROM sqlite_master WHERE type = ? AND tbl_name = ? AND sql LIKE ?'
    ).all('index', name, '%$.expires%');
    assert.equal(found.length, 1, `${name} keeps its expires index`);
  }
  check.close();
});

test('an unknown table without _id still fails, and leaves no file', async () => {
  const raw = new DatabaseSync(sourceFile);
  raw.exec('CREATE TABLE zzOther (id INTEGER)');
  raw.close();
  const output = path.join(work, 'fails.ndjson');
  try {
    await assert.rejects(dumpWithNewConnection(output), /_id/);
    assert.equal(fs.existsSync(output), false);
    assert.equal(fs.existsSync(`${output}.partial`), false);
  } finally {
    const cleanup = new DatabaseSync(sourceFile);
    cleanup.exec('DROP TABLE zzOther');
    cleanup.close();
  }
});
