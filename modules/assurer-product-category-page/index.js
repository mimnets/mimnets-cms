// Product category page (ADR-0003), e.g. /style/apparels-textiles. Products
// are assigned on the product record ("Product categories"), so a product
// has one source of truth and can appear in several categories. This page
// shows the published products assigned to it, by display order.
import { pageArea } from '../../lib/area.js';

export default {
  extend: '@apostrophecms/page-type',
  options: {
    label: 'Product category page'
  },
  fields: {
    add: {
      summary: {
        type: 'string',
        textarea: true,
        label: 'Summary',
        help: 'One or two sentences. Shown on the division page card. Up to 300 characters.',
        max: 300
      },
      _heroImage: {
        type: 'relationship',
        label: 'Header image',
        help: 'Ratio 16:9, at least 2000 px wide.',
        withType: '@apostrophecms/image',
        max: 1
      },
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
      _products: {
        type: 'relationshipReverse',
        withType: 'assurer-product',
        reverseOf: '_categories',
        withRelationships: [ '_image' ]
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
        fields: [ 'title', 'summary', '_heroImage', 'intro', 'main' ]
      }
    }
  }
};
