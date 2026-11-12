// Division / overview page (ADR-0003), e.g. the Style and Health divisions or
// a products hub. Lists its child product category pages automatically, in
// page-tree order, so editors manage the list by moving pages in the tree.
import { pageArea } from '../../lib/area.js';

export default {
  extend: '@apostrophecms/page-type',
  options: {
    label: 'Division / overview page'
  },
  fields: {
    add: {
      intro: {
        type: 'area',
        label: 'Introduction',
        options: {
          max: 1,
          widgets: {
            '@apostrophecms/rich-text': {
              toolbar: [ 'bold', 'italic', 'link', 'bulletList' ]
            }
          }
        }
      },
      _organizations: {
        type: 'relationship',
        label: 'Group organizations in this division',
        help: 'Optional. Only published organizations appear on the website.',
        withType: 'assurer-organization',
        withRelationships: [ '_logo' ]
      },
      main: {
        type: 'area',
        label: 'More sections',
        options: pageArea
      }
    },
    group: {
      basics: {
        label: 'Basics',
        fields: [ 'title', 'intro', '_organizations', 'main' ]
      }
    }
  },
  handlers(self) {
    return {
      '@apostrophecms/page:beforeSend': {
        async loadCategoryPages(req) {
          const page = req.data.page;
          if (!page || page.type !== self.name) {
            return;
          }
          // Child category pages, including ones hidden from the menu. The
          // current mode applies: visitors only ever get published pages.
          req.data.categoryPages = await self.apos.page.find(req, {
            type: 'assurer-product-category-page',
            level: page.level + 1,
            path: new RegExp(`^${self.apos.util.regExpQuote(page.path)}/`)
          })
            .areas(false)
            .relationships([ '_heroImage' ])
            .sort({ rank: 1 })
            .toArray();
        }
      }
    };
  }
};
