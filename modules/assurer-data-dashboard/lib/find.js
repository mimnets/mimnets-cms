// Find tab (m1-070, design §4): search any document by title, slug or id,
// and show one document's stored data read-only. Edits go through the
// normal editor; the dashboard never writes a document.
import { findFor } from './types.js';

export const MAX_QUERY = 200;
const MAX_RESULTS = 50;
const ARCHIVED = {
  live: false,
  archived: true,
  all: null
};
// A user document shows only these fields (design §6).
const USER_FIELDS = [
  '_id', 'type', 'title', 'username', 'email', 'role', 'disabled',
  'archived', 'createdAt', 'updatedAt'
];

export function parseFindQuery(apos, query, types) {
  const q = apos.launder.string(query.q).trim().slice(0, MAX_QUERY);
  const type = apos.launder.select(query.type, types, '');
  const status = apos.launder.select(query.status, Object.keys(ARCHIVED), 'live');
  return {
    q,
    type,
    status
  };
}

export async function findDocuments(apos, req, {
  q, type, status
}) {
  const draftReq = req.clone({ mode: 'draft' });
  const criteria = q
    ? {
      $or: [
        { _id: q },
        { aposDocId: q },
        { slug: q },
        { title: matching(q) },
        { slug: matching(q) }
      ]
    }
    : {};
  const docs = await findFor(apos, draftReq, type, criteria)
    .archived(ARCHIVED[status])
    .sort({ updatedAt: -1 })
    .project({
      title: 1,
      slug: 1,
      type: 1,
      aposDocId: 1,
      archived: 1,
      modified: 1,
      lastPublishedAt: 1,
      updatedAt: 1,
      updatedBy: 1
    })
    .limit(MAX_RESULTS)
    .toArray();
  return {
    results: docs.map(doc => ({
      _id: doc._id,
      aposDocId: doc.aposDocId || doc._id,
      type: doc.type,
      title: doc.title || '',
      slug: doc.slug || '',
      archived: Boolean(doc.archived),
      modified: Boolean(doc.modified),
      lastPublishedAt: doc.lastPublishedAt || null,
      updatedAt: doc.updatedAt || null,
      updatedBy: doc.updatedBy?.title || doc.updatedBy?.username || null,
      history: hasHistory(apos, doc.type)
    })),
    limited: docs.length === MAX_RESULTS
  };
}

// The draft of one document (or the document itself for types without
// drafts), as stored, without relationships loaded.
export async function getDocument(apos, req, id) {
  const draftReq = req.clone({ mode: 'draft' });
  const doc = await apos.doc.find(draftReq, {
    $or: [ { _id: id }, { aposDocId: id } ]
  })
    .archived(null)
    .relationships(false)
    .toObject();
  if (!doc) {
    return null;
  }
  if (doc.type !== '@apostrophecms/user') {
    return doc;
  }
  return Object.fromEntries(
    USER_FIELDS.filter(key => key in doc).map(key => [ key, doc[key] ])
  );
}

// Whether Document Versions keeps a history for this type. Pages use the
// page module's options, as core does.
function hasHistory(apos, type) {
  const module = apos.modules[type];
  if (!module || !apos.docVersions) {
    return false;
  }
  const options = apos.instanceOf(module, '@apostrophecms/page-type')
    ? apos.page.options
    : module.options;
  return module.options.localized !== false && apos.docVersions.hasVersions(options);
}

function matching(text) {
  return {
    $regex: text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    $options: 'i'
  };
}
