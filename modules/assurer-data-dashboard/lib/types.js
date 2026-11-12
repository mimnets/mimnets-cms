// The document types the dashboard lists (m1-070): every piece type that
// owns documents, and all pages as one row. Read through Apostrophe's
// managers, so permissions, locales and draft/published apply.

export const PAGES = '@apostrophecms/page';

// Core's cross-type views: piece types that own no documents of their own.
const VIRTUAL = [ '@apostrophecms/recently-edited', '@apostrophecms/submitted-draft' ];

export function pieceManagers(apos) {
  return Object.values(apos.modules).filter(module =>
    apos.instanceOf(module, '@apostrophecms/piece-type') &&
    !VIRTUAL.includes(module.__meta.name));
}

export function typeNames(apos) {
  return [ PAGES, ...pieceManagers(apos).map(module => module.__meta.name) ];
}

// A query for `type` (a piece type or PAGES), or for every type when
// `type` is empty. The archive page itself is never listed.
export function findFor(apos, req, type, criteria = {}) {
  const notArchivePage = { type: { $ne: '@apostrophecms/archive-page' } };
  if (type === PAGES) {
    return apos.page.find(req, { $and: [ criteria, notArchivePage ] });
  }
  if (type) {
    return apos.modules[type].find(req, criteria);
  }
  return apos.doc.find(req, { $and: [ criteria, notArchivePage ] });
}

export function label(req, module) {
  return req.t(module.options.pluralLabel || module.options.label || module.__meta.name);
}
