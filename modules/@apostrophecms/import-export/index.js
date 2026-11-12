// modules/@apostrophecms/import-export/index.js

// Import and export (m1-070, D-DB-24; design:
// docs/milestones/m1-070-database-dashboard-design.md).
//
// - Site administrators only. The package allows anyone who may create and
//   edit a type; here the server refuses everyone else before any document
//   is read or written, and records the refusal. The menus are hidden in
//   the doc, page and piece-type overrides (lib/import-export-access.js).
// - "Import all documents as drafts" is on by default, so an import does not
//   change the public site until someone publishes.
// - Every export, import and duplicate replacement is recorded in the data
//   dashboard's activity log (modules/assurer-data-dashboard). The package
//   emits no events, so its entry methods are extended.
//
// Users are never imported or exported: the package's own
// `import-export-user` module switches both off.
import fs from 'node:fs/promises';
import path from 'node:path';
import { isSiteAdmin } from '../../../lib/site-admin.js';

const MAX_NAME = 200;

export default {
  options: {
    importDraftsOnlyDefault: true
  },
  extendMethods(self) {
    return {
      canImportOrExport(_super, req, docType, action) {
        return isSiteAdmin(self.apos, req) && _super(req, docType, action);
      },

      async export(_super, req, manager, reporting) {
        const details = {
          type: manager.__meta.name,
          documents: Array.isArray(req.body?._ids) ? req.body._ids.length : 0,
          relatedTypes: self.apos.launder.strings(req.body?.relatedTypes),
          format: self.apos.launder.string(req.body?.formatName)
        };
        await refuseNonAdmin(req, 'export', details);
        try {
          const result = await _super(req, manager, reporting);
          await record(req, 'export', {
            ...details,
            outcome: 'done'
          });
          return result;
        } catch (error) {
          await record(req, 'export', {
            ...details,
            outcome: 'failed'
          });
          throw error;
        }
      },

      // `importFile` runs inside the package's `import`, which removes the
      // upload whenever it throws; a refusal here leaves nothing behind.
      async importFile(_super, req, moduleName, artifacts) {
        const file = req.files?.file;
        const details = {
          type: moduleName,
          file: file ? path.basename(String(file.name || '')).slice(0, MAX_NAME) : null,
          bytes: await fileSize(file),
          draftsOnly: self.apos.launder.boolean(req.body?.importDraftsOnly)
        };
        await refuseNonAdmin(req, 'import', details);
        req.assurerImportCounts = null;
        try {
          const result = await _super(req, moduleName, artifacts);
          await record(req, 'import', {
            ...details,
            ...req.assurerImportCounts,
            duplicates: result?.duplicatedDocs?.length || 0,
            outcome: importOutcome(result)
          });
          return result;
        } catch (error) {
          await record(req, 'import', {
            ...details,
            outcome: 'failed'
          });
          throw error;
        }
      },

      // Counts for the activity entry of the current import.
      async insertDocs(_super, req, args) {
        const result = await _super(req, args);
        req.assurerImportCounts = {
          documents: args.docs?.length || 0,
          failed: new Set(args.failedIds || []).size
        };
        return result;
      },

      // The second step of an import that found existing documents: the
      // ones the admin chose to replace.
      async overrideDuplicates(_super, req) {
        const details = {
          replaced: self.apos.launder.strings(req.body?.docIds).length,
          draftsOnly: self.apos.launder.boolean(req.body?.importDraftsOnly)
        };
        await refuseNonAdmin(req, 'import-replace', details);
        try {
          const result = await _super(req);
          await record(req, 'import-replace', {
            ...details,
            outcome: 'done'
          });
          return result;
        } catch (error) {
          await record(req, 'import-replace', {
            ...details,
            outcome: 'failed'
          });
          throw error;
        }
      }
    };

    async function refuseNonAdmin(req, action, details) {
      if (isSiteAdmin(self.apos, req)) {
        return;
      }
      await record(req, 'refused', {
        action,
        ...details
      });
      throw self.apos.error('forbidden');
    }

    // Core's chunked upload gives the assembled file's path but no size.
    async function fileSize(file) {
      try {
        return file?.path ? (await fs.stat(file.path)).size : null;
      } catch (error) {
        return null;
      }
    }

    function record(req, kind, details) {
      return self.apos.modules['assurer-data-dashboard'].recordActivity(req, kind, details);
    }

    // What the package's import returned: finished, or waiting for the
    // admin to choose which existing documents to replace, or whether to
    // import into the current locale.
    function importOutcome(result) {
      if (result?.duplicatedDocs?.length) {
        return 'waiting-for-duplicates';
      }
      return result?.jobId === null ? 'waiting-for-locale' : 'done';
    }
  }
};
