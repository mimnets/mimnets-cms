// WordPress media → the images and files the import may bring in (m1-067).
// Pure: resolves any size variant of an upload URL to its media item, names
// the image after where it is used, and drafts alt text from the same
// context. Drafted alt text is for the owner's review; nothing is invented.

const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp'
};

// Uploads that are never content: Elementor editor screenshots, Slider
// Revolution assets and placeholders.
const JUNK = /\/elementor\/screenshots\/|\/revslider\/|(^|[/_-])(dummy|placeholder)[._-]/i;

export function slugify(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '') || 'image';
}

// "KNITTED KIDS WEAR" → "Knitted Kids Wear". Mixed-case text is kept as is.
export function tidyCase(text) {
  const value = String(text || '').trim();
  if (!value || value !== value.toUpperCase() || !/[A-Z]/.test(value)) {
    return value;
  }
  return value.toLowerCase().replace(/(^|[\s(/&-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

const stripOrigin = (url) => {
  try {
    return new URL(url, 'https://x.invalid').pathname;
  } catch (e) {
    return null;
  }
};

// Index of every URL variant (full size and each generated size) of every
// media item. `before` excludes uploads on or after that date (the spam
// window on the source site).
export function createMediaIndex(media, { before }) {
  const byPath = new Map();
  for (const item of media) {
    const urls = [ item.source_url ];
    for (const size of Object.values(item.media_details?.sizes || {})) {
      urls.push(size.source_url);
    }
    for (const url of urls) {
      const key = url && stripOrigin(url);
      if (key && !byPath.has(key)) {
        byPath.set(key, item);
      }
    }
  }
  const cutoff = before ? new Date(`${before}T00:00:00Z`) : null;

  return {
    // { item } or { reason } for any upload URL.
    resolve(url) {
      const path = url && stripOrigin(url);
      if (!path) {
        return { reason: 'no URL' };
      }
      // A size suffix WordPress did not list ("-300x300", "-scaled").
      const item = byPath.get(path) ||
        byPath.get(path.replace(/-\d+x\d+(\.\w+)$/, '$1')) ||
        byPath.get(path.replace(/(\.\w+)$/, '-scaled$1'));
      if (!item) {
        return { reason: `not in the media library: ${path}` };
      }
      if (JUNK.test(item.source_url)) {
        return { reason: `placeholder or editor file: ${path}` };
      }
      if (cutoff && new Date(`${item.date_gmt || item.date}Z`) >= cutoff) {
        return { reason: `uploaded on or after ${before}: ${path}` };
      }
      return { item };
    }
  };
}

// Registry of the images one run imports: one entry per media item, named
// after the first place it is used.
export function createImageRegistry() {
  const byKey = new Map();
  const names = new Set();

  return {
    images: byKey,

    // Returns the image key, or null with the reason added to `skipped`.
    add(item, context, skipped) {
      const key = `wordpress:media:${item.id}`;
      if (byKey.has(key)) {
        return key;
      }
      const ext = IMAGE_TYPES[item.mime_type];
      if (!ext) {
        skipped.push(`image ${item.source_url}: type ${item.mime_type} is not imported`);
        return null;
      }
      const label = tidyCase(context) || 'Image';
      const base = slugify(label);
      let n = 1;
      let name = `${base}-01.${ext}`;
      while (names.has(name)) {
        n++;
        name = `${base}-${String(n).padStart(2, '0')}.${ext}`;
      }
      names.add(name);
      byKey.set(key, {
        key,
        mediaId: item.id,
        url: item.source_url,
        bytes: item.media_details?.filesize || null,
        name,
        title: n === 1 ? label : `${label} ${n}`,
        alt: label
      });
      return key;
    }
  };
}
