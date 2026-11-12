// Overview tab (m1-070, design §4): per document type, the number of live
// drafts, published documents, archived documents and drafts with
// unpublished changes, and the newest change. Types without separate
// drafts (`localized: false`, such as users) have a total only.
import {
  PAGES, findFor, label, pieceManagers
} from './types.js';

export async function getOverview(apos, req) {
  const draftReq = req.clone({ mode: 'draft' });
  const publishedReq = req.clone({ mode: 'published' });
  const types = [
    {
      name: PAGES,
      label: req.t('apostrophe:pages'),
      localized: true,
      canCreate: true
    },
    ...pieceManagers(apos).map(module => ({
      name: module.__meta.name,
      label: label(req, module),
      localized: module.options.localized !== false,
      canCreate: !module.options.singleton && module.options.showCreate !== false
    }))
  ];

  const rows = [];
  for (const type of types) {
    rows.push({
      ...type,
      ...await countType(apos, type, draftReq, publishedReq)
    });
  }
  return {
    types: rows,
    formSubmissions: await countFormSubmissions(apos)
  };
}

async function countType(apos, type, draftReq, publishedReq) {
  const find = (req, criteria) => findFor(apos, req, type.name, criteria);
  const newest = await find(draftReq).archived(null)
    .sort({ updatedAt: -1 })
    .project({
      title: 1,
      updatedAt: 1,
      updatedBy: 1
    })
    .toObject();
  const counts = {
    live: await find(draftReq).archived(false).toCount(),
    archived: await find(draftReq).archived(true).toCount(),
    published: null,
    modified: null
  };
  if (type.localized) {
    counts.published = await find(publishedReq).archived(false).toCount();
    counts.modified = await find(draftReq, { modified: true }).archived(false).toCount();
  }
  return {
    ...counts,
    newest: newest && {
      title: newest.title || '',
      updatedAt: newest.updatedAt || null,
      updatedBy: newest.updatedBy?.title || newest.updatedBy?.username || null
    }
  };
}

// Form submissions are personal data with their own admin page (m1-012);
// the dashboard shows only how many there are.
async function countFormSubmissions(apos) {
  const forms = apos.modules['assurer-forms'];
  if (!forms) {
    return null;
  }
  return {
    count: await forms.collection().countDocuments({}),
    url: '/assurer/form-submissions'
  };
}
