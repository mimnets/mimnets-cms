// Test-only support tasks (m1-009).
//
//   node app assurer-test:ensure-admin
//
// Creates the admin account used by the automated editor-workflow tests,
// without an interactive prompt, so CI can run on a throwaway database.
// The username and password come from APOS_TEST_USER and APOS_TEST_PASSWORD
// and are never logged. Uses the official user API (`apos.user.insert`).
//
// Refuses to run unless APOS_DB_URI is a sqlite:// file under the OS temp
// directory or RUNNER_TEMP, NODE_ENV is not production, and a password of at
// least 16 characters is set (see lib/guard.js). Idempotent: an existing
// account with that username is left unchanged.
//
//   node app assurer-test:backdate-submissions --days=<n> --count=<n>
//
// (m1-012) Moves the creation date of the <count> oldest form submissions
// <days> days into the past, so the retention task's deletion can be tested
// on disposable data. Same safety checks as ensure-admin.
//
//   node app assurer-test:ensure-editor
//
// (m1-014) Creates a non-admin account with the core `editor` role from
// APOS_TEST_EDITOR_USER and APOS_TEST_EDITOR_PASSWORD, for the content-model
// suite's permission checks. Same safety checks; idempotent.
//
//   node app assurer-test:ensure-contributor
//
// (m1-037, D-CONTENT-11) Creates a non-admin account with the core
// `contributor` role from APOS_TEST_CONTRIBUTOR_USER and
// APOS_TEST_CONTRIBUTOR_PASSWORD, for the publishing-workflow suite.
// Same safety checks; idempotent.
import {
  contributorRefuseReason, editorRefuseReason, refuseReason
} from './lib/guard.js';

const TASKS = [
  'assurer-test:ensure-admin',
  'assurer-test:backdate-submissions',
  'assurer-test:ensure-editor',
  'assurer-test:ensure-contributor'
];
const GUARDS = {
  'assurer-test:ensure-editor': editorRefuseReason,
  'assurer-test:ensure-contributor': contributorRefuseReason
};

// Refuse before Apostrophe connects to the database or runs migrations.
// `.env` has already been loaded by app.js at this point.
for (const task of TASKS) {
  if (process.argv.includes(task)) {
    assertSafe(task);
  }
}

function assertSafe(task) {
  const check = GUARDS[task] || refuseReason;
  const reason = check(process.env);
  if (reason) {
    throw new Error(`Refusing to run ${task}: ${reason}.`);
  }
}

export default {
  tasks(self) {
    return {
      'ensure-admin': {
        usage: 'Create the CI test admin from APOS_TEST_USER / APOS_TEST_PASSWORD ' +
          'on a temporary SQLite database.\nUsage: node app assurer-test:ensure-admin',
        task: () => self.ensureAdmin()
      },
      'backdate-submissions': {
        usage: 'Test only: backdate the <count> oldest form submissions by <days> days ' +
          'on a temporary SQLite database.\n' +
          'Usage: node app assurer-test:backdate-submissions --days=400 --count=3',
        task: (argv) => self.backdateSubmissions(argv)
      },
      'ensure-editor': {
        usage: 'Create the test editor from APOS_TEST_EDITOR_USER / APOS_TEST_EDITOR_PASSWORD ' +
          'on a temporary SQLite database.\nUsage: node app assurer-test:ensure-editor',
        task: () => self.ensureEditor()
      },
      'ensure-contributor': {
        usage: 'Create the test contributor from APOS_TEST_CONTRIBUTOR_USER / ' +
          'APOS_TEST_CONTRIBUTOR_PASSWORD on a temporary SQLite database.\n' +
          'Usage: node app assurer-test:ensure-contributor',
        task: () => self.ensureContributor()
      }
    };
  },
  methods(self) {
    return {
      async ensureAdmin() {
        assertSafe(TASKS[0]);
        const req = self.apos.task.getReq();
        const username = process.env.APOS_TEST_USER;
        const existing = await self.apos.user.find(req, { username })
          .archived(null)
          .toObject();
        if (existing) {
          self.apos.util.log('Test admin already exists; nothing changed.');
          return;
        }
        await self.apos.user.insert(req, {
          username,
          title: username,
          role: 'admin',
          password: process.env.APOS_TEST_PASSWORD
        });
        self.apos.util.log('Test admin created.');
      },

      async ensureEditor() {
        assertSafe(TASKS[2]);
        const req = self.apos.task.getReq();
        const username = process.env.APOS_TEST_EDITOR_USER;
        const existing = await self.apos.user.find(req, { username })
          .archived(null)
          .toObject();
        if (existing) {
          self.apos.util.log('Test editor already exists; nothing changed.');
          return;
        }
        await self.apos.user.insert(req, {
          username,
          title: username,
          role: 'editor',
          password: process.env.APOS_TEST_EDITOR_PASSWORD
        });
        self.apos.util.log('Test editor created.');
      },

      async ensureContributor() {
        assertSafe(TASKS[3]);
        const req = self.apos.task.getReq();
        const username = process.env.APOS_TEST_CONTRIBUTOR_USER;
        const existing = await self.apos.user.find(req, { username })
          .archived(null)
          .toObject();
        if (existing) {
          self.apos.util.log('Test contributor already exists; nothing changed.');
          return;
        }
        await self.apos.user.insert(req, {
          username,
          title: username,
          role: 'contributor',
          password: process.env.APOS_TEST_CONTRIBUTOR_PASSWORD
        });
        self.apos.util.log('Test contributor created.');
      },

      async backdateSubmissions(argv) {
        assertSafe(TASKS[1]);
        const days = Number(argv.days);
        const count = Number(argv.count);
        const positive = n => Number.isInteger(n) && n > 0;
        if (!positive(days) || !positive(count)) {
          throw new Error('--days and --count must be positive whole numbers.');
        }
        const collection = self.apos.modules['@apostrophecms/form'].db;
        const rows = await collection.find({})
          .sort({ createdAt: 1 })
          .limit(count)
          .toArray();
        const createdAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        for (const row of rows) {
          await collection.updateOne({ _id: row._id }, { $set: { createdAt } });
        }
        self.apos.util.log(`Backdated ${rows.length} submissions to ${createdAt.toISOString()}.`);
      }
    };
  }
};
