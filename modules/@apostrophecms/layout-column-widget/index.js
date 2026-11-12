import { columnArea } from '../../../lib/area.js';

export default {
  // Background colour, gradient or image per column (m1-071).
  styles: {
    add: {
      background: 'background'
    }
  },
  fields: {
    add: {
      content: {
        type: 'area',
        options: columnArea
      }
    }
  }
};
