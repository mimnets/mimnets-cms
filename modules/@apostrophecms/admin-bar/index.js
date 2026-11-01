// modules/@apostrophecms/admin-bar/index.js

// Admin bar menus (m1-022). Core `groups` option: each group becomes one
// dropdown; a group with only one item stays a plain button. Items the user
// may not see are left out, so editors do not see Users. Pages (the page
// tree) is always first and is not part of a group.
export default {
  options: {
    groups: [
      {
        label: 'project:adminBarContent',
        items: [
          'assurer-product',
          'assurer-organization',
          'assurer-person',
          'assurer-location'
        ]
      },
      {
        label: 'project:adminBarMedia',
        items: [
          '@apostrophecms/image',
          '@apostrophecms/image-tag',
          '@apostrophecms/file',
          '@apostrophecms/file-tag'
        ]
      },
      {
        label: 'project:adminBarForms',
        items: [ '@apostrophecms/form' ]
      },
      {
        label: 'project:adminBarSiteAdmin',
        items: [
          '@apostrophecms/user',
          '@apostrophecms/redirect'
        ]
      }
    ]
  }
};
