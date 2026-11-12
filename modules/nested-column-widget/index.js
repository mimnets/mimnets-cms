import { nestedColumnArea } from '../../lib/area.js';

export default {
  extend: '@apostrophecms/layout-column-widget',
  fields: {
    add: {
      content: {
        type: 'area',
        options: nestedColumnArea
      }
    }
  }
};
