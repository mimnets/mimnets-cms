// modules/assurer-data-dashboard/index.js

// The database dashboard, layer 1 (m1-070, D-DB-24; design:
// docs/milestones/m1-070-database-dashboard-design.md).
//
// An admin bar item in "Site admin" opens an admin modal with four tabs:
// Overview, Find, Activity and Health. The routes below only read. Creating,
// editing, archiving and restoring happen in Apostrophe's own editors and
// managers, which the modal opens; export and import are
// @apostrophecms/import-export, restricted to admins in
// modules/@apostrophecms/import-export.
//
// Access: site administrators only, checked on the server for every route.
// Anyone else gets 404. A refused request from a logged-in user is recorded
// in the activity log; anonymous requests are not, so visitors cannot fill
// the log.
import { isSiteAdmin } from '../../lib/site-admin.js';
import {
  KINDS, RETENTION_DAYS, createActivityLog
} from './lib/activity.js';
import {
  findDocuments, getDocument, parseFindQuery
} from './lib/find.js';
import { getHealth } from './lib/health.js';
import { getOverview } from './lib/overview.js';
import { typeNames } from './lib/types.js';

const NAME = 'assurer-data-dashboard';
const MAX_ACTIVITY_PAGE = 10000;

export default {
  options: {
    alias: 'assurerDataDashboard'
  },
  async init(self) {
    self.activity = createActivityLog(self.apos);
    await self.activity.ensureIndexes();
    // Shown only to users who may edit user accounts: the admin role
    self.apos.adminBar.add(NAME, 'project:dataDashboard', {
      action: 'edit',
      type: '@apostrophecms/user'
    });
    self.apos.modal.add(NAME, 'AssurerDataDashboard', { moduleName: NAME });
  },
  handlers(self) {
    return {
      'apostrophe:ready': {
        async pruneActivity() {
          await self.activity.prune(RETENTION_DAYS);
        }
      }
    };
  },
  methods(self) {
    return {
      // Called by modules/@apostrophecms/import-export.
      recordActivity(req, kind, details) {
        return self.activity.record(req, kind, details);
      },
      async requireAdmin(req, route) {
        if (isSiteAdmin(self.apos, req)) {
          return;
        }
        if (req.user) {
          await self.activity.record(req, 'refused', { action: `dashboard:${route}` });
        }
        throw self.apos.error('notfound');
      }
    };
  },
  apiRoutes(self) {
    return {
      get: {
        async overview(req) {
          await self.requireAdmin(req, 'overview');
          return getOverview(self.apos, req);
        },
        async find(req) {
          await self.requireAdmin(req, 'find');
          return findDocuments(
            self.apos,
            req,
            parseFindQuery(self.apos, req.query, typeNames(self.apos))
          );
        },
        async document(req) {
          await self.requireAdmin(req, 'document');
          const id = self.apos.launder.id(req.query._id);
          const doc = id && await getDocument(self.apos, req, id);
          if (!doc) {
            throw self.apos.error('notfound');
          }
          return { doc };
        },
        async activity(req) {
          await self.requireAdmin(req, 'activity');
          const page = self.apos.launder.integer(req.query.page, 1, 1, MAX_ACTIVITY_PAGE);
          const kind = self.apos.launder.select(req.query.kind, KINDS, '');
          return self.activity.list({
            kind,
            page
          });
        },
        async health(req) {
          await self.requireAdmin(req, 'health');
          return getHealth(self.apos);
        }
      }
    };
  },
  tasks(self) {
    return {
      'prune-activity': {
        usage: `Removes activity log entries older than ${RETENTION_DAYS} days. The app also does this at each start.\nUsage: node app ${NAME}:prune-activity`,
        async task() {
          const removed = await self.activity.prune(RETENTION_DAYS);
          self.apos.util.log(`Removed ${removed} activity entries older than ${RETENTION_DAYS} days`);
        }
      }
    };
  }
};
