// modules/@apostrophecms/piece-type/index.js

// Import and export (m1-070, D-DB-24): every piece manager shows its Import
// and Export menus to site administrators only (lib/import-export-access.js).
// The server refuses everyone else in modules/@apostrophecms/import-export.
import { importExportOperationsFor } from '../../../lib/import-export-access.js';

export default {
  extendMethods(self) {
    return {
      getBrowserData(_super, req) {
        const browserOptions = _super(req);
        browserOptions.batchOperations = importExportOperationsFor(
          self.apos, req, browserOptions.batchOperations
        );
        browserOptions.utilityOperations = importExportOperationsFor(
          self.apos, req, browserOptions.utilityOperations
        );
        return browserOptions;
      }
    };
  }
};
