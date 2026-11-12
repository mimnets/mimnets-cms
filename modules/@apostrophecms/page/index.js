// This configures the @apostrophecms/page module to add a "home" page type to the
// pages menu

import { importExportOperationsFor } from '../../../lib/import-export-access.js';

export default {
  options: {
    types: [
      {
        name: 'default-page',
        label: 'Default'
      },
      {
        name: 'assurer-division-page',
        label: 'Division / overview'
      },
      {
        name: 'assurer-product-category-page',
        label: 'Product category'
      },
      {
        name: '@apostrophecms/home-page',
        label: 'Home'
      }
    ],
    // Core's defaults, except that the home page's children are loaded two
    // levels deep, for the two-level main menu in views/layout.jsx (m1-014).
    // Core's `children` query skips pages marked "Hide in Navigation" and,
    // for visitors, anything unpublished. The menu reads only these fields,
    // so the children are loaded without their content (m1-053); core adds
    // what `_url` needs. A template that needs more of a menu item must add
    // the field here.
    builders: {
      ancestors: {
        children: {
          depth: 2,
          project: {
            title: 1,
            path: 1,
            aposDocId: 1,
            _url: 1
          }
        }
      },
      children: true
    }
  },
  extendMethods(self) {
    return {
      // Import and export menus for site administrators only (m1-070)
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
