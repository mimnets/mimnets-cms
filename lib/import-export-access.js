// Import and export are for site administrators only (m1-070, D-DB-24).
//
// @apostrophecms/import-export shows its menus to anyone who may create and
// edit a type. The server refuses non-admins in
// modules/@apostrophecms/import-export; the overrides of doc, page and
// piece-type call `withoutImportExport()` so non-admins do not see menus
// that would only be refused.
import { isSiteAdmin } from './site-admin.js';

const ACTIONS = new Set([
  'import-export-import',
  'import-export-export',
  'import-export-export-batch'
]);

// `operations` is a list of `{ action }` entries. A batch operation group
// (`{ action, operations: [ ... ] }`) loses the import-export entries and is
// dropped when nothing is left in it.
export function withoutImportExport(operations = []) {
  return operations
    .filter(operation => !ACTIONS.has(operation.action))
    .map(operation => (Array.isArray(operation.operations)
      ? {
        ...operation,
        operations: operation.operations.filter(op => !ACTIONS.has(op.action))
      }
      : operation))
    .filter(operation => !Array.isArray(operation.operations) ||
      operation.operations.length > 0);
}

// The operations a request may see: all of them for a site administrator.
export function importExportOperationsFor(apos, req, operations) {
  return isSiteAdmin(apos, req) ? operations : withoutImportExport(operations);
}
