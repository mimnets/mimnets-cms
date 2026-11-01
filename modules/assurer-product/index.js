// Product record (ADR-0003). One record per product line, shown on the
// product category pages it is assigned to. No show pages: products have no
// URL of their own (D-CONTENT-3). Publication uses Apostrophe's own
// draft/publish workflow; only published products appear publicly.
//
// Deliberately absent: prices, specifications and certifications. Add such
// fields only with owner-verified data (D-CONTENT-5).
import { displayOrderField, displayOrderSort } from '../../lib/display-order.js';

export default {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Product',
    // Core derives "G,<first letter>", which would clash with Pages,
    // People, Products, Forms and Organizations. "G,R" is core's Redirects
    // shortcut; Shift follows core's Image Tags ("G,Shift+I") pattern.
    shortcut: 'G,Shift+P',
    pluralLabel: 'Products',
    sort: displayOrderSort
  },
  fields: {
    add: {
      displayTitle: {
        type: 'string',
        label: 'Public name (if different)',
        help: 'Leave empty to show the name above on the website.',
        max: 120
      },
      summary: {
        type: 'string',
        textarea: true,
        label: 'Short description',
        help: 'One or two sentences, shown on product cards. Up to 300 characters.',
        max: 300
      },
      description: {
        type: 'area',
        label: 'Description',
        options: {
          max: 1,
          widgets: {
            '@apostrophecms/rich-text': {
              toolbar: [ 'styles', 'bold', 'italic', 'link', 'bulletList', 'orderedList' ],
              styles: [
                {
                  tag: 'p',
                  label: 'Paragraph'
                },
                {
                  tag: 'h3',
                  label: 'Heading 3'
                }
              ]
            }
          }
        }
      },
      _categories: {
        type: 'relationship',
        label: 'Product categories',
        help: 'The category pages that list this product.',
        withType: 'assurer-product-category-page',
        builders: {
          project: {
            title: 1,
            _url: 1
          }
        }
      },
      _image: {
        type: 'relationship',
        label: 'Main image',
        help: 'Ratio 4:3, at least 1200 px wide. Give the image alt text in the media library.',
        withType: '@apostrophecms/image',
        max: 1
      },
      _gallery: {
        type: 'relationship',
        label: 'Gallery',
        help: 'Optional extra images, in the order shown. Up to 12.',
        withType: '@apostrophecms/image',
        max: 12
      },
      displayOrder: displayOrderField
    },
    group: {
      basics: {
        label: 'Basics',
        fields: [ 'title', 'displayTitle', 'summary', 'description' ]
      },
      media: {
        label: 'Images',
        fields: [ '_image', '_gallery' ]
      },
      placement: {
        label: 'Placement',
        fields: [ '_categories', 'displayOrder' ]
      }
    }
  }
};
