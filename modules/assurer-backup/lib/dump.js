// Database dump without Litestream's tables (m1-049; D-DB-13 condition 1).
//
// Litestream creates `_litestream_seq` and `_litestream_lock` in the SQLite
// file it replicates. `apos-db-dump` from @apostrophecms/db-connect 1.1.0
// treats every table as a collection, pages through it by `_id`, and stops
// with `no such column: _litestream_seq._id` (m1-048 results §3.1). Its
// restore would also clear those tables in the target (`deleteMany`).
//
// This module calls db-connect's own `dump()` on a view of the database that
// lists every collection except Litestream's, so the NDJSON format is exactly
// the one `apos-db-restore` reads. Any other table without an `_id` column
// still fails the dump, on purpose: only Litestream's tables are known to be
// safe to leave out.
//
// The dump is written to `<output>.partial` and renamed to `<output>` only
// after every collection was written, so a failed run never leaves a file that
// looks complete. Like `apos-db-dump`, it reads a live database collection by
// collection; it is not a point-in-time snapshot across collections.
import fs from 'node:fs';
import { finished } from 'node:stream/promises';
import { dump } from '@apostrophecms/db-connect';

export const SKIPPED_PREFIX = '_litestream_';

export function isSkipped(name) {
  return name.startsWith(SKIPPED_PREFIX);
}

// A database view for `dump()`, which only calls `listCollections()` and
// `collection()`.
export function withoutSkipped(db, skipped) {
  return {
    listCollections() {
      return {
        async toArray() {
          const all = await db.listCollections().toArray();
          for (const info of all) {
            if (isSkipped(info.name)) {
              skipped.push(info.name);
            }
          }
          return all.filter(info => !isSkipped(info.name));
        }
      };
    },
    collection(name) {
      return db.collection(name);
    }
  };
}

export function checkDumpArgs(argv) {
  const output = argv.output === undefined || argv.output === true
    ? null
    : String(argv.output);
  if (!output) {
    throw new Error('--output=<file> is required.');
  }
  if (fs.existsSync(output)) {
    throw new Error(`${output} already exists. Choose a new file name.`);
  }
  return { output };
}

// Writes the dump and returns `{ collections: [ { name, docs } ], skipped }`.
export async function writeDump(db, output) {
  const partial = `${output}.partial`;
  const skipped = [];
  const collections = [];
  // `wx`: never overwrite, including a `.partial` left by a crashed run.
  const sink = fs.createWriteStream(partial, { flags: 'wx' });
  const opened = new Promise((resolve, reject) => {
    sink.once('open', resolve);
    sink.once('error', reject);
  });
  await opened;
  try {
    let current = null;
    for await (const line of dump(withoutSkipped(db, skipped))) {
      // A header is `{"_collection":<name>}` or `{"_collection":<name>,"_indexes":…}`;
      // a document is `{"_collection":<name>,"_doc":…}` (db-connect lib/dump.js).
      if (current && line.startsWith(`${current.prefix},"_doc":`)) {
        current.docs++;
      } else {
        const { _collection: name } = JSON.parse(line);
        current = {
          name,
          docs: 0,
          prefix: `{"_collection":${JSON.stringify(name)}`
        };
        collections.push(current);
      }
      if (!sink.write(line + '\n')) {
        await new Promise(resolve => sink.once('drain', resolve));
      }
    }
    sink.end();
    await finished(sink);
  } catch (e) {
    sink.destroy();
    await fs.promises.rm(partial, { force: true });
    throw e;
  }
  await fs.promises.rename(partial, output);
  return {
    collections: collections.map(({ name, docs }) => ({
      name,
      docs
    })),
    skipped
  };
}
