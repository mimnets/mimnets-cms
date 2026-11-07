// Backup tasks (m1-049). Command line only; there is no HTTP equivalent.
//
// - `dump` task: the same NDJSON dump as `apos-db-dump`, without Litestream's
//   `_litestream_*` tables (lib/dump.js). Restore it with `apos-db-restore`,
//   into a new, empty database only (ADR-0002).
import { checkDumpArgs, writeDump } from './lib/dump.js';

export default {
  tasks(self) {
    return {
      dump: {
        usage: 'Dump the configured database as NDJSON (the apos-db-dump format),\n' +
          'leaving out Litestream\'s _litestream_* tables. Media are not included.\n' +
          'The file is complete only when the task exits with code 0.\n' +
          'Usage: node app assurer-backup:dump --output=<new file>',
        async task(argv) {
          const { output } = checkDumpArgs(argv);
          // A new connection, as `apos-db-dump` makes. On the app's own
          // connection the SQLite adapter reports the Mongo-style names of
          // indexes created in this process (`expires_1`), and SQLite index
          // names are database-wide, so a restore would lose indexes (m1-049).
          const dbModule = self.apos.modules['@apostrophecms/db'];
          if (!dbModule.uri) {
            throw new Error('No database URI: the db module was given a client.');
          }
          const client = await dbModule.connectToAdapter(dbModule.uri);
          let result;
          try {
            result = await writeDump(client.db(), output);
          } finally {
            await client.close();
          }
          const { collections, skipped } = result;
          const docs = collections.reduce((sum, c) => sum + c.docs, 0);
          const lines = [
            `Dump of database "${self.apos.db.databaseName}" written to ${output}.`,
            ...collections.map(c => `  ${c.name}: ${c.docs}`),
            `${collections.length} collections, ${docs} documents.`,
            skipped.length
              ? `Left out: ${skipped.join(', ')}.`
              : 'No Litestream tables found.'
          ];
          self.apos.util.log(lines.join('\n'));
          return {
            output,
            collections,
            skipped
          };
        }
      }
    };
  }
};
