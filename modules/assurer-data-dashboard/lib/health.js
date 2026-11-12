// Health tab (m1-070, design §4): what the app itself can read about its
// database and media. Each value is read separately; a value the engine or
// the app's database user cannot give is `null` ("not available"), never an
// error. Backup status is not here: the app cannot read PBM's state (design
// §7).
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { COLLECTION } from './activity.js';

const require = createRequire(import.meta.url);

// Records per collection, read through each module's own handle so the
// names follow core.
function counted(apos) {
  return [
    [ 'documents', () => apos.doc.db ],
    [ 'attachments', () => apos.attachment.db ],
    [ 'versions', () => apos.docVersions.db ],
    [ 'activity', () => apos.db.collection(COLLECTION) ]
  ];
}

export async function getHealth(apos, env = process.env) {
  return {
    engine: engineName(env),
    serverVersion: await attempt(async () => {
      const info = await apos.db.command({ buildInfo: 1 });
      return info?.version || null;
    }),
    database: await attempt(async () => {
      const stats = await apos.db.stats();
      return {
        dataBytes: stats.dataSize ?? null,
        storageBytes: stats.storageSize ?? null,
        indexBytes: stats.indexSize ?? null,
        collections: stats.collections ?? null
      };
    }),
    counts: Object.fromEntries(await Promise.all(
      counted(apos).map(async ([ name, collection ]) => [
        name,
        await attempt(() => collection().countDocuments({}))
      ])
    )),
    media: await attempt(async () => {
      const [ total ] = await apos.attachment.db.aggregate([
        {
          $group: {
            _id: null,
            bytes: { $sum: '$length' },
            files: { $sum: 1 }
          }
        }
      ]).toArray();
      return {
        files: total?.files || 0,
        bytes: total?.bytes || 0
      };
    }),
    disk: await attempt(async () => {
      const stats = await fs.statfs(uploadsPath(apos));
      return {
        freeBytes: stats.bavail * stats.bsize,
        totalBytes: stats.blocks * stats.bsize
      };
    }),
    versions: {
      apostrophe: require('apostrophe/package.json').version,
      importExport: require('@apostrophecms/import-export/package.json').version,
      node: process.version
    },
    checkedAt: new Date()
  };
}

// Only the scheme of the database address: the rest holds credentials.
export function engineName(env) {
  const uri = env.APOS_DB_URI || env.APOS_MONGODB_URI || '';
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(uri)?.[1]?.toLowerCase();
  if (!scheme) {
    return 'mongodb';
  }
  return scheme === 'mongodb+srv' ? 'mongodb' : scheme;
}

function uploadsPath(apos) {
  return apos.uploadfs.options?.uploadfs?.uploadsPath ||
    path.join(apos.rootDir, 'public', 'uploads');
}

async function attempt(read) {
  try {
    return await read();
  } catch (error) {
    return null;
  }
}
