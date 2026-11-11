// Writes an import plan through Apostrophe's APIs (m1-067; ADR-0002: no raw
// database writes). Pages and records are drafts and are never published.
// Images and files publish themselves on insert (core `autopublish`); their
// upload URLs are public by design (ADR-0003 §9 as amended in m1-067).
//
// Each imported document carries two plain properties that are not schema
// fields, so editors never see them: `importSource`, a stable key such as
// `wordpress:page:2526`, and `importHash`, a fingerprint of what the import
// last wrote. Apostrophe keeps properties outside the schema when an editor
// saves, so a re-run still finds the document.
//
// Each imported document is in one of these states, decided by `stateOf`:
//   new        no document carries the import key yet       → insert
//   unchanged  ours, and the source gives the same content   → leave
//   changed    ours, the source changed, nobody edited it    → update draft
//   kept       a person edited, published or archived it    → leave, report
// "Ours" means the import was the last to save it and nobody published it
// since. Kept is final: a re-run never overwrites a person's work or brings
// back an archived document. The one exception is the home page, which
// Apostrophe creates itself: the import adopts it once, while it is empty.
import { createHash } from 'node:crypto';
import {
  mkdtemp, readFile, rm
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { REVIEW_TAG } from './site-map.js';

export const IMPORT_USER = {
  _id: 'assurer-wp-import',
  title: 'WordPress import',
  username: 'assurer-wp-import',
  role: 'admin'
};

const ADOPTED = 'adopted';

const fingerprint = (spec) => createHash('sha256').update(JSON.stringify(spec)).digest('hex');

export function stateOf(doc, hash, { autopublish = false } = {}) {
  if (!doc) {
    return 'new';
  }
  if (doc.importHash === ADOPTED) {
    return 'changed';
  }
  const publishedSince = !autopublish && doc.lastPublishedAt &&
    new Date(doc.lastPublishedAt) >= new Date(doc.updatedAt);
  if (doc.archived || doc.updatedBy?._id !== IMPORT_USER._id || publishedSince) {
    return 'kept';
  }
  return doc.importHash === hash ? 'unchanged' : 'changed';
}

export async function applyPlan(apos, plan, {
  source, execute, maxImageMb, maxFileMb
}) {
  const req = apos.task.getReq({ mode: 'draft' });
  req.user = { ...IMPORT_USER };
  const report = {
    new: [],
    changed: [],
    unchanged: [],
    kept: [],
    failed: [],
    // Findings for the owner that only the target site can show.
    notes: []
  };
  const record = (state, label) => report[state].push(label);
  const id = () => apos.util.generateId();
  const tmp = execute ? await mkdtemp(path.join(os.tmpdir(), 'assurer-wp-import-')) : null;

  // Inserts or updates one document keyed by its import key. `build`
  // returns the schema input; it runs only when something is written.
  async function upsert({
    manager, find, key, spec, label, build, insert, update, autopublish
  }) {
    const hash = fingerprint(spec);
    const existing = await find(key);
    const state = stateOf(existing, hash, { autopublish });
    record(state, label);
    if (!execute || state === 'unchanged' || state === 'kept') {
      return existing;
    }
    const doc = existing || manager.newInstance();
    const options = existing ? { presentFieldsOnly: true } : {};
    await manager.convert(req, await build(), doc, options);
    doc.importSource = key;
    doc.importHash = hash;
    return existing ? update(doc) : insert(doc);
  }

  const pieceFinder = (manager) => (key) => manager.find(req, { importSource: key })
    .archived(null)
    .toObject();
  const pageFinder = (key) => apos.page.find(req, { importSource: key })
    .archived(null)
    .toObject();

  async function ensureTag(type, title) {
    const manager = apos.modules[type];
    const existing = await manager.find(req, { title }).archived(null).toObject();
    if (existing || !execute) {
      return existing;
    }
    return manager.insert(req, {
      ...manager.newInstance(),
      title
    });
  }

  // Downloads an upload and copies it into Apostrophe. Byte-identical
  // uploads (WordPress's "-1" copies) become one attachment.
  const attachmentsByHash = new Map();
  async function attach(item, maxMb) {
    if (item.bytes && item.bytes > maxMb * 1024 * 1024) {
      throw new Error(`larger than ${maxMb} MB`);
    }
    const dest = path.join(tmp, item.name);
    await source.download(item.url, dest, maxMb);
    const hash = createHash('sha256').update(await readFile(dest)).digest('hex');
    if (!attachmentsByHash.has(hash)) {
      attachmentsByHash.set(hash, await apos.attachment.insert(req, {
        name: item.name,
        path: dest
      }));
    }
    return attachmentsByHash.get(hash);
  }

  const one = (doc) => (doc ? [ doc ] : []);
  const docs = (map, keys) => (keys || []).map(key => map.get(key)).filter(Boolean);

  try {
    // Tags for review and for the downloads lists.
    const imageTag = await ensureTag('@apostrophecms/image-tag', REVIEW_TAG);
    const fileTags = new Map();
    for (const title of new Set([ REVIEW_TAG, ...plan.files.flatMap(f => f.tags) ])) {
      fileTags.set(title, await ensureTag('@apostrophecms/file-tag', title));
    }

    const images = new Map();
    for (const item of plan.images.values()) {
      try {
        const spec = {
          title: item.title,
          alt: item.alt,
          url: item.url
        };
        const existing = await pieceFinder(apos.image)(item.key);
        // The file is downloaded only for a new image; a changed one keeps
        // its attachment and gets the new title and alt text.
        const attachment = (!existing && execute) ? await attach(item, maxImageMb) : null;
        images.set(item.key, await upsert({
          manager: apos.image,
          find: async () => existing,
          key: item.key,
          spec,
          label: `image ${item.name}`,
          autopublish: true,
          build: () => ({
            title: item.title,
            alt: item.alt,
            ...(attachment ? { attachment } : {}),
            _tags: one(imageTag)
          }),
          insert: doc => apos.image.insert(req, doc),
          update: doc => apos.image.update(req, doc)
        }));
      } catch (e) {
        record('failed', `image ${item.name}: ${e.message}`);
      }
    }

    const files = new Map();
    for (const item of plan.files) {
      try {
        const existing = await pieceFinder(apos.file)(item.key);
        const attachment = (!existing && execute) ? await attach(item, maxFileMb) : null;
        files.set(item.key, await upsert({
          manager: apos.file,
          find: async () => existing,
          key: item.key,
          spec: {
            title: item.title,
            description: item.description,
            tags: item.tags,
            url: item.url
          },
          label: `file ${item.name}`,
          autopublish: true,
          build: () => ({
            title: item.title,
            description: item.description,
            ...(attachment ? { attachment } : {}),
            _tags: [ ...item.tags, REVIEW_TAG ].map(t => fileTags.get(t)).filter(Boolean)
          }),
          insert: doc => apos.file.insert(req, doc),
          update: doc => apos.file.update(req, doc)
        }));
      } catch (e) {
        record('failed', `file ${item.name}: ${e.message}`);
      }
    }

    const pieces = async (type, items, label, build) => {
      const manager = apos.modules[type];
      const result = new Map();
      for (const item of items) {
        result.set(item.key, await upsert({
          manager,
          find: pieceFinder(manager),
          key: item.key,
          spec: item,
          label: `${label} "${item.title}"`,
          build: () => build(item),
          insert: doc => manager.insert(req, doc),
          update: doc => manager.update(req, doc)
        }));
      }
      return result;
    };

    const organizations = await pieces('assurer-organization', plan.organizations, 'organization',
      ({
        title, shortDescription, displayOrder
      }) => ({
        title,
        shortDescription,
        displayOrder
      }));
    const locations = await pieces('assurer-location', plan.locations, 'location',
      ({ key, ...input }) => input);

    // Pages: the home page exists already (Apostrophe parks it). The import
    // adopts it only while its content area is empty.
    const pages = new Map();
    const home = await apos.page.find(req, { level: 0 }).toObject();
    const homePlan = plan.pages.find(p => p.path === '/');
    if (homePlan && home && !home.importSource && (home.main?.items || []).length) {
      record('kept', 'page / (it already has content)');
    } else if (homePlan && home && !home.importSource) {
      home.importSource = homePlan.key;
      home.importHash = ADOPTED;
    }
    pages.set('/', home);

    const toWidget = (block) => {
      const widget = (type, fields) => ({
        _id: id(),
        metaType: 'widget',
        type,
        ...fields
      });
      switch (block.kind) {
        case 'richText':
          return widget('@apostrophecms/rich-text', { content: block.html });
        case 'image': {
          const image = images.get(block.image);
          return image && widget('@apostrophecms/image', { _image: [ image ] });
        }
        case 'features':
          return widget('assurer-feature-grid', {
            items: block.items.map(item => {
              const target = item.linkPath && pages.get(item.linkPath);
              return {
                _id: id(),
                title: item.title,
                text: item.text || '',
                _image: one(item.image && images.get(item.image)),
                hasLink: !!target,
                ...(target
                  ? {
                    linkText: 'More',
                    linkType: 'page',
                    _linkPage: [ target ]
                  }
                  : {})
              };
            })
          });
        case 'stats':
          return widget('assurer-stats', {
            items: block.items.map(item => ({
              _id: id(),
              ...item
            }))
          });
        case 'organizations':
          return widget('assurer-organizations', {
            mode: 'pick',
            layout: 'cards',
            _organizations: docs(organizations, block.keys)
          });
        case 'locations':
          return widget('assurer-locations', {
            mode: 'pick',
            _locations: docs(locations, block.keys)
          });
        case 'gallery': {
          const list = docs(images, block.images);
          return list.length && widget('assurer-gallery', {
            _images: list,
            captionSource: 'none'
          });
        }
        case 'downloads': {
          const list = docs(files, block.files);
          return list.length && widget('assurer-downloads', {
            mode: 'pick',
            _files: list
          });
        }
        default:
          return null;
      }
    };
    const area = (blocks) => ({
      metaType: 'area',
      items: blocks.map(toWidget).filter(Boolean)
    });

    // Parents before children; the home page last, because its cards link
    // to the other pages.
    const ordered = [
      ...plan.pages.filter(p => p.path !== '/'),
      ...(homePlan ? [ homePlan ] : [])
    ];
    for (const page of ordered) {
      const manager = apos.doc.getManager(page.type);
      const build = () => ({
        title: page.title,
        ...(page.path === '/' ? {} : { slug: page.path }),
        ...(page.intro.length ? { intro: area(page.intro) } : {}),
        main: area(page.main),
        ...(page.handler === 'category'
          ? {
            summary: page.summary || '',
            _heroImage: one(page.heroImage && images.get(page.heroImage))
          }
          : {})
      });
      const label = `page ${page.path}`;
      if (page.path === '/') {
        if (!home || home.importSource !== page.key) {
          continue;
        }
        pages.set('/', await upsert({
          manager,
          find: async () => home,
          key: page.key,
          spec: page,
          label,
          build,
          update: doc => apos.page.update(req, doc)
        }));
        continue;
      }
      // A page that is not the import's own already uses this path: Apostrophe
      // gives the draft another slug, so the owner must know.
      const taken = await apos.page.find(req, { slug: page.path })
        .archived(null)
        .toObject();
      if (taken && taken.importSource !== page.key) {
        report.notes.push(`page ${page.path}: the path is already used by "${taken.title}"; ` +
          'the imported draft gets another path (see Pages)');
      }
      const parent = pages.get(page.parentPath);
      // In a dry run a new parent is only planned, not created.
      if (!parent && execute) {
        record('failed', `${label}: parent ${page.parentPath} missing`);
        continue;
      }
      pages.set(page.path, await upsert({
        manager,
        find: pageFinder,
        key: page.key,
        spec: page,
        label,
        build: () => ({
          type: page.type,
          ...build()
        }),
        insert: doc => apos.page.insert(req, parent._id, 'lastChild', doc),
        update: doc => apos.page.update(req, doc)
      }));
    }

    await pieces('assurer-product', plan.products, 'product', (product) => ({
      title: product.title,
      summary: product.summary,
      displayOrder: product.displayOrder,
      _image: one(product.image && images.get(product.image)),
      _gallery: docs(images, product.gallery),
      _categories: one(pages.get(product.categoryPath))
    }));

    // PDF redirects: the old upload path → the new file (public on insert).
    const redirects = apos.modules['@apostrophecms/redirect'];
    const redirectReq = apos.task.getReq();
    redirectReq.user = { ...IMPORT_USER };
    for (const { from, file: fileKey } of plan.redirects) {
      const file = files.get(fileKey);
      const label = `redirect ${from}`;
      // Site-relative: a task has no request host, so the absolute URL
      // core builds would name the wrong site.
      const target = file?.attachment &&
        new URL(apos.attachment.url(file.attachment, { size: 'original' }), 'http://x.invalid').pathname;
      const existing = await redirects.find(redirectReq, { redirectSlug: from })
        .toObject();
      const state = !existing
        ? 'new'
        : existing.updatedBy?._id !== IMPORT_USER._id
          ? 'kept'
          : (!target || existing.externalUrl === target) ? 'unchanged' : 'changed';
      record(state, label);
      if (!execute || !target || state === 'unchanged' || state === 'kept') {
        continue;
      }
      const doc = existing || {
        ...redirects.newInstance(),
        title: `WordPress file: ${from}`,
        redirectSlug: from,
        urlType: 'external',
        statusCode: '301',
        ignoreQueryString: false,
        forwardQueryString: false
      };
      doc.externalUrl = target;
      await (existing
        ? redirects.update(redirectReq, doc)
        : redirects.insert(redirectReq, doc));
    }
  } finally {
    if (tmp) {
      await rm(tmp, {
        recursive: true,
        force: true
      });
    }
  }
  return report;
}
