// Organization record (ADR-0003): the group's companies and entities, reused
// wherever they are listed. Names, roles and relationships of the real
// entities are unverified until the owner confirms them (D-CONTENT-2), so
// nothing is published automatically; the WordPress import (m1-067) creates
// drafts only.
import { displayOrderField, displayOrderSort } from '../../lib/display-order.js';
import { rejectNonWebUrls, webUrlField } from '../../lib/web-url.js';

export default {
  extend: '@apostrophecms/piece-type',
  options: {
    label: 'Organization',
    // Core derives "G,<first letter>", which would clash with Pages,
    // People, Products, Forms and Organizations.
    shortcut: 'G,Z',
    pluralLabel: 'Organizations',
    sort: displayOrderSort
  },
  fields: {
    add: {
      shortDescription: {
        type: 'string',
        textarea: true,
        label: 'Short description',
        help: 'Up to 300 characters. State only facts the owner has confirmed.',
        max: 300
      },
      _logo: {
        type: 'relationship',
        label: 'Logo or image',
        help: 'SVG or transparent PNG, at least 400 px wide. The alt text should be the organization name.',
        withType: '@apostrophecms/image',
        max: 1
      },
      _parentOrganization: {
        type: 'relationship',
        label: 'Part of',
        help: 'Optional: the group entity this organization belongs to.',
        withType: 'assurer-organization',
        max: 1,
        builders: {
          project: {
            title: 1
          }
        }
      },
      websiteUrl: webUrlField('Website'),
      // Read-only here: each location record names its organization, so the
      // link has one source of truth (assurer-location `_organization`).
      _locations: {
        type: 'relationshipReverse',
        withType: 'assurer-location',
        reverseOf: '_organization'
      },
      displayOrder: displayOrderField
    },
    group: {
      basics: {
        label: 'Basics',
        fields: [ 'title', 'shortDescription', '_logo', 'websiteUrl' ]
      },
      relationships: {
        label: 'Relationships',
        fields: [ '_parentOrganization', 'displayOrder' ]
      }
    }
  },
  handlers(self) {
    return {
      beforeSave: {
        rejectNonWebUrls: rejectNonWebUrls(self, [ 'websiteUrl' ]),
        noSelfParent(req, doc) {
          const parentIds = doc.parentOrganizationIds || [];
          if (doc.aposDocId && parentIds.includes(doc.aposDocId)) {
            throw self.apos.error('invalid', 'An organization cannot be part of itself.');
          }
        }
      }
    };
  }
};
