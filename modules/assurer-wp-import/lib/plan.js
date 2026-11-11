// WordPress pages and media → the import plan (m1-067). Pure: the dry run
// prints this plan, and `apply.js` writes it. Every planned item has a
// stable `key` derived from WordPress IDs, so a re-run finds its own drafts.
import { decodeTitle, extractWidgets } from './extract.js';
import {
  createImageRegistry, slugify, tidyCase
} from './media.js';
import {
  CORPORATE_TAG, DOWNLOAD_SOURCES, ORGANIZATIONS_HEADING, PAGES, UNCONFIRMED_NOTE
} from './site-map.js';

const LIMITS = {
  title: 120,
  text: 300,
  features: 12,
  gallery: 12,
  galleryWidget: 48,
  stats: 6,
  statValue: 20,
  statLabel: 80,
  files: 48
};

const PAGE_TYPES = {
  home: '@apostrophecms/home-page',
  division: 'assurer-division-page',
  category: 'assurer-product-category-page'
};

const escapeHtml = (text) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const headingHtml = (text, level = 2) => {
  const tag = level <= 2 ? 'h2' : 'h3';
  return `<${tag}>${escapeHtml(text)}</${tag}>`;
};

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

const isPlaceholder = (text) => /lorem ipsum|safe\s*&\s*secure/i.test(text || '');

export function pagePath(link) {
  return new URL(link).pathname.replace(/\/+$/, '') || '/';
}

// Shortens to `max` characters at a sentence or word end, and says so.
function fit(text, max, where, review) {
  const value = String(text || '').trim();
  if (value.length <= max) {
    return value;
  }
  const cut = value.slice(0, max - 1);
  const sentence = cut.lastIndexOf('. ');
  const short = sentence > max / 2 ? cut.slice(0, sentence + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
  review.push(`${where}: text shortened to ${max} characters; the full text is on the WordPress page`);
  return short;
}

// Lines of a small HTML fragment ("<br>" and paragraphs), without tags.
function htmlLines(html) {
  return String(html || '')
    .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').replace(/[\s,]+$/, '').trim())
    .filter(Boolean);
}

export function buildPlan({ pages, mediaIndex }) {
  const skipped = [];
  const review = [];
  const registry = createImageRegistry();
  const wpByPath = new Map(pages.map(page => [ pagePath(page.link), page ]));
  const knownPaths = new Set(PAGES.map(entry => entry.path));
  const plan = {
    pages: [],
    products: [],
    organizations: [],
    locations: [],
    files: [],
    redirects: [],
    images: registry.images,
    skipped,
    review
  };

  const image = (url, context) => {
    if (!url) {
      return null;
    }
    const found = mediaIndex.resolve(url);
    if (!found.item) {
      skipped.push(`image: ${found.reason}`);
      return null;
    }
    return registry.add(found.item, context, skipped);
  };

  const internalPath = (href) => {
    try {
      const path = new URL(href, 'https://x.invalid').pathname.replace(/\/+$/, '') || '/';
      return knownPaths.has(path) ? path : null;
    } catch (e) {
      return null;
    }
  };

  // Home cards that link to a category page: their text and image become
  // that page's summary and header image.
  const cardsByPath = new Map();

  // Generic conversion of a page's widgets into section blocks, in order.
  function convertSections(wp, title, widgets) {
    const blocks = [];
    let open = null;
    let heading = title;
    // A heading introduces only the first group of cards after it.
    let headingUsed = false;
    let card = null;
    // The first heading of each Elementor section names its images.
    const sectionHeading = new Map();
    for (const w of widgets) {
      if (w.type === 'heading' && w.text && !sectionHeading.has(w.section)) {
        sectionHeading.set(w.section, w.text);
      }
    }

    const close = () => {
      if (!open) {
        return;
      }
      const current = open;
      open = null;
      card = null;
      if (current.kind === 'richText') {
        blocks.push({
          kind: 'richText',
          html: current.parts.join('\n')
        });
      } else if (current.kind === 'stats') {
        blocks.push({
          kind: 'stats',
          items: current.items.slice(0, LIMITS.stats)
        });
      } else if (ORGANIZATIONS_HEADING.test(current.heading || '')) {
        blocks.push({
          kind: 'organizations',
          keys: current.items.map((item, i) => addOrganization(wp, item, i))
        });
      } else {
        for (const item of current.items) {
          item.image = item.imageUrl ? image(item.imageUrl, item.title) : null;
          if (item.linkPath && item.text) {
            cardsByPath.set(item.linkPath, item);
          }
        }
        const fits = current.items.length <= LIMITS.features &&
          current.items.every(item => item.title && item.title.length <= LIMITS.title &&
            (item.text || '').length <= LIMITS.text);
        if (fits) {
          blocks.push({
            kind: 'features',
            items: current.items.map(({ imageUrl, ...item }) => item)
          });
        } else {
          // Too long for a card: kept whole as headed paragraphs.
          blocks.push({
            kind: 'richText',
            html: current.items
              .map(item => `${headingHtml(item.title, 3)}\n<p>${escapeHtml(item.text)}</p>`)
              .join('\n')
          });
        }
      }
    };
    // `variant` splits groups of different card types (Elementor and
    // ElementsKit boxes are separate sections on WordPress).
    const start = (kind, variant = null) => {
      if (open?.kind !== kind || open.variant !== variant) {
        close();
        open = {
          kind,
          variant,
          heading: (kind === 'features' && headingUsed) ? null : heading,
          parts: [],
          items: []
        };
        if (kind === 'features') {
          headingUsed = true;
        }
      }
      return open;
    };

    for (const w of widgets) {
      if (w.widget === 'slider_revolution.default') {
        skipped.push(`${wp.path}: Slider Revolution slider (its slides are not in the REST API)`);
      } else if (w.widget === 'form.default' || w.widget === 'google_maps.default') {
        skipped.push(`${wp.path}: ${w.widget.replace('.default', '')} (rebuilt on this site, CA-6)`);
      } else if (w.type === 'image' && w.href && internalPath(w.href)) {
        card = {
          title: '',
          text: '',
          imageUrl: w.src,
          linkPath: internalPath(w.href)
        };
        start('features', 'card').items.push(card);
      } else if (w.type === 'heading') {
        if (card && !card.title) {
          card.title = w.text;
        } else if (w.text && !same(w.text, title)) {
          start('richText').parts.push(headingHtml(w.text, w.level));
          heading = w.text;
          headingUsed = false;
        }
      } else if (w.type === 'text') {
        if (card && !card.text) {
          card.text = w.text;
        } else if (w.text && !same(w.text, title) && !isPlaceholder(w.text)) {
          start('richText').parts.push(w.html);
        }
      } else if (w.type === 'box') {
        card = null;
        start('features', w.widget).items.push({
          title: w.title,
          text: w.text
        });
      } else if (w.type === 'counter') {
        start('stats').items.push({
          value: `${w.prefix}${w.value}${w.suffix}`.slice(0, LIMITS.statValue),
          label: w.label.slice(0, LIMITS.statLabel),
          note: UNCONFIRMED_NOTE
        });
        review.push(`${wp.path}: figure "${w.label}" is unconfirmed (D-CONTENT-12)`);
      } else if (w.type === 'image' && w.src) {
        if (/logo/i.test(w.src)) {
          skipped.push(`${wp.path}: decorative logo ${w.src}`);
          continue;
        }
        close();
        const key = image(w.src, sectionHeading.get(w.section) || heading);
        if (key) {
          blocks.push({
            kind: 'image',
            image: key
          });
        }
      }
    }
    close();
    return blocks;
  }

  function addOrganization(wp, item, i) {
    const [ name ] = item.title.split(/\s*,\s*/);
    const key = `wordpress:page:${wp.id}:organization:${slugify(item.title)}`;
    plan.organizations.push({
      key,
      title: tidyCase(item.title),
      shortDescription: fit(item.text, LIMITS.text, `organization "${name}"`, review),
      displayOrder: (i + 1) * 10
    });
    review.push(`organization "${item.title}": facts unconfirmed (D-CONTENT-2)`);
    return key;
  }

  function category(wp, title) {
    const intro = [];
    const found = [];
    const galleries = new Map();
    let thumb = null;
    for (const w of extractWidgets(wp.content)) {
      if (w.type === 'image' && !w.href) {
        thumb = w.src;
      } else if (w.type === 'card') {
        found.push({
          name: w.name,
          text: w.text,
          anchor: w.anchor,
          thumb
        });
        thumb = null;
      } else if (w.type === 'gallery' && w.anchor) {
        galleries.set(w.anchor, w.images);
      } else if (w.type === 'figures') {
        for (const figure of w.items) {
          found.push({
            name: figure.lines[0] || '',
            // "(Emblica officinalis)" → "Emblica officinalis"
            text: figure.lines.slice(1).join(' ').replace(/^\((.*)\)$/, '$1'),
            anchor: null,
            thumb: figure.src
          });
        }
      } else if (w.type === 'text' && w.text && !isPlaceholder(w.text)) {
        intro.push(w.html);
      }
    }
    found.forEach((product, i) => {
      if (!product.name) {
        return;
      }
      const productTitle = tidyCase(product.name);
      const main = image(product.thumb, productTitle);
      const urls = galleries.get(product.anchor) || [];
      if (urls.length > LIMITS.gallery) {
        review.push(`product "${productTitle}": ${urls.length} photos on WordPress, the first ${LIMITS.gallery} imported`);
      }
      const gallery = urls.slice(0, LIMITS.gallery)
        .map(url => image(url, productTitle))
        .filter(key => key && key !== main);
      plan.products.push({
        key: `wordpress:page:${wp.id}:product:${product.anchor || slugify(product.name)}`,
        title: productTitle,
        summary: fit(product.text, LIMITS.text, `product "${productTitle}"`, review),
        image: main,
        gallery: [ ...new Set(gallery) ],
        categoryPath: wp.path,
        displayOrder: (i + 1) * 10
      });
    });
    if (!found.length && !intro.length) {
      review.push(`${wp.path}: no content on WordPress; the page is imported with its title only`);
    }
    return {
      intro: intro.length
        ? [ {
          kind: 'richText',
          html: intro.join('\n')
        } ]
        : [],
      main: []
    };
  }

  function contact(wp, title) {
    const main = [];
    const parts = [];
    let expect = null;
    let location = null;
    let email = null;
    for (const w of extractWidgets(wp.content)) {
      if (w.type === 'heading') {
        if (/location|address/i.test(w.text) && !/email/i.test(w.text)) {
          expect = 'location';
        } else if (/phone/i.test(w.text)) {
          expect = 'phone';
        } else if (/email/i.test(w.text)) {
          expect = 'email';
        } else {
          expect = null;
          if (!same(w.text, title)) {
            parts.push(headingHtml(w.text, w.level));
          }
        }
      } else if (w.type === 'text') {
        if (expect === 'location') {
          location = htmlLines(w.html);
        } else if (expect === 'phone') {
          review.push(`${wp.path}: the messaging numbers were not imported; the owner confirms which are business numbers`);
        } else if (expect === 'email') {
          email = (w.text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [])[0] || null;
        } else if (!same(w.text, title)) {
          parts.push(w.html);
        }
        expect = null;
      } else if (w.widget === 'form.default' || w.widget === 'google_maps.default') {
        skipped.push(`${wp.path}: ${w.widget.replace('.default', '')} (rebuilt on this site, CA-6)`);
      }
    }
    if (parts.length) {
      main.push({
        kind: 'richText',
        html: parts.join('\n')
      });
    }
    if (location?.length >= 2) {
      const last = location[location.length - 1];
      const before = location[location.length - 2].split(/\s*,\s*/);
      const key = `wordpress:page:${wp.id}:location:1`;
      plan.locations.push({
        key,
        title: location[0],
        city: before[before.length - 1].replace(/[-\d\s]+$/, ''),
        country: last.replace(/[-\d\s]+$/, ''),
        address: {
          line1: location.slice(1, -1).join(', '),
          postalCode: (last.match(/\d{3,}/) || [])[0] || ''
        },
        publicEmail: email || '',
        showContact: false
      });
      review.push(`location "${location[0]}": check the split into address, city and country; contact details stay hidden until "Show contact details" is on`);
      main.push({
        kind: 'locations',
        keys: [ key ]
      });
    }
    return {
      intro: [],
      main
    };
  }

  function headings(wp, title) {
    const parts = extractWidgets(wp.content)
      .filter(w => w.type === 'heading' && w.text && !same(w.text, title))
      .map(w => headingHtml(w.text, w.level));
    review.push(`${wp.path}: people not imported (D-CONTENT-4, consent); headings only`);
    return {
      intro: [],
      main: parts.length
        ? [ {
          kind: 'richText',
          html: parts.join('\n')
        } ]
        : []
    };
  }

  function gallery(wp) {
    const keys = extractWidgets(wp.content)
      .filter(w => w.type === 'gallery')
      .flatMap(w => w.images)
      .map(url => image(url, 'Gallery photo'))
      .filter(Boolean)
      .slice(0, LIMITS.galleryWidget);
    if (keys.length) {
      review.push(`${wp.path}: ${keys.length} gallery photos need real alt text (drafted as "Gallery photo")`);
    }
    return {
      intro: [],
      main: keys.length
        ? [ {
          kind: 'gallery',
          images: keys
        } ]
        : []
    };
  }

  // Files: the PDF links on the downloads pages (D-CONTENT-3 merges those
  // pages into /downloads and the category pages).
  function collectFiles() {
    const files = new Map();
    for (const [ path, categoryPath ] of Object.entries(DOWNLOAD_SOURCES)) {
      const wp = wpByPath.get(path);
      if (!wp) {
        continue;
      }
      const tag = categoryPath
        ? decodeTitle(wpByPath.get(categoryPath)?.title?.rendered) || categoryPath
        : CORPORATE_TAG;
      const sections = new Map();
      for (const w of extractWidgets(wp.content?.rendered)) {
        const section = sections.get(w.section) || {};
        sections.set(w.section, section);
        if (w.type === 'heading') {
          section.title = w.text;
        } else if (w.type === 'text' && !section.text && !isPlaceholder(w.text)) {
          section.text = w.text;
        } else if (w.type === 'button' && w.href && w.href !== '#') {
          const found = mediaIndex.resolve(w.href);
          if (!found.item) {
            skipped.push(`file: ${found.reason}`);
          } else if (found.item.mime_type !== 'application/pdf') {
            skipped.push(`file ${found.item.source_url}: ${found.item.mime_type} not imported (video: D-CONTENT-9)`);
          } else {
            const key = `wordpress:media:${found.item.id}`;
            const file = files.get(key) || {
              key,
              mediaId: found.item.id,
              url: found.item.source_url,
              bytes: found.item.media_details?.filesize || null,
              title: section.title || decodeTitle(found.item.title?.rendered),
              description: section.text || '',
              tags: new Set()
            };
            file.tags.add(tag);
            files.set(key, file);
          }
        }
      }
    }
    for (const file of files.values()) {
      // A file listed with the corporate files is not also a category file.
      const tags = file.tags.has(CORPORATE_TAG) ? [ CORPORATE_TAG ] : [ ...file.tags ];
      plan.files.push({
        ...file,
        name: `${slugify(file.title)}.pdf`,
        tags
      });
      plan.redirects.push({
        from: new URL(file.url).pathname,
        file: file.key
      });
    }
  }

  for (const entry of PAGES) {
    const wp = wpByPath.get(entry.path);
    if (!wp) {
      review.push(`${entry.path}: not found on WordPress`);
      continue;
    }
    const source = {
      id: wp.id,
      path: entry.path,
      content: wp.content?.rendered || ''
    };
    const title = decodeTitle(wp.title?.rendered);
    let blocks;
    if (entry.handler === 'home') {
      blocks = {
        intro: [],
        main: convertSections(source, title, extractWidgets(source.content))
      };
    } else if (entry.handler === 'category') {
      blocks = category(source, title);
    } else if (entry.handler === 'contact') {
      blocks = contact(source, title);
    } else if (entry.handler === 'headings') {
      blocks = headings(source, title);
    } else if (entry.handler === 'gallery') {
      blocks = gallery(source);
    } else {
      blocks = {
        intro: [],
        main: []
      };
    }
    plan.pages.push({
      key: `wordpress:page:${wp.id}`,
      handler: entry.handler,
      type: PAGE_TYPES[entry.handler] || 'default-page',
      path: entry.path,
      parentPath: entry.path === '/' ? null : (entry.parent || '/'),
      title,
      ...blocks
    });
  }

  // Category pages: summary and header image from the home card.
  for (const page of plan.pages.filter(p => p.handler === 'category')) {
    const card = cardsByPath.get(page.path);
    page.summary = card ? fit(card.text, LIMITS.text, `${page.path} summary`, review) : '';
    page.heroImage = card?.image || null;
  }

  collectFiles();
  const downloadsFor = (keys) => keys.length
    ? [ {
      kind: 'downloads',
      files: keys.slice(0, LIMITS.files)
    } ]
    : [];
  for (const page of plan.pages) {
    if (page.handler === 'downloads') {
      page.main.push(...downloadsFor(plan.files.map(f => f.key)));
    } else if (page.handler === 'category') {
      const own = plan.files.filter(f => f.tags.includes(page.title));
      page.main.push(...downloadsFor(own.map(f => f.key)));
    }
  }

  for (const path of wpByPath.keys()) {
    if (!knownPaths.has(path)) {
      const why = path in DOWNLOAD_SOURCES
        ? 'merged; its PDFs are imported'
        : 'not migrated (D-CONTENT-3)';
      skipped.push(`page ${path}: ${why}`);
    }
  }
  return plan;
}
