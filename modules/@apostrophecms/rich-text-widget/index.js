export default {
  styles: {
    add: {
      width: 'width',
      margin: 'margin',
      padding: 'padding'
    }
  },
  // "Style" in the link dialog (m1-071): a link can look like a button.
  // Core writes the value as an HTML attribute and allows it in the
  // sanitizer; the CSS is in _assurer.scss.
  linkFields: {
    add: {
      linkStyle: {
        label: 'project:linkStyle',
        type: 'select',
        htmlAttribute: 'data-link-style',
        def: '',
        choices: [
          {
            label: 'project:linkStyleLink',
            value: ''
          },
          {
            label: 'project:linkStyleButton',
            value: 'button'
          },
          {
            label: 'project:linkStyleButtonOutline',
            value: 'button-outline'
          }
        ]
      }
    }
  }
};
