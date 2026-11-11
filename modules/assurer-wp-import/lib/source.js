// Read-only access to a WordPress site's public REST API (m1-067).
// GET requests only, never a login. Downloads are limited by host, size and
// time, and are written to a temporary folder before Apostrophe copies them.
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MB = 1024 * 1024;

// https only, except a loopback address used by the test fixture server.
export function checkBaseUrl(baseUrl) {
  const url = new URL(baseUrl);
  const loopback = [ 'localhost', '127.0.0.1', '[::1]' ].includes(url.hostname);
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) {
    throw new Error(`The source must be an https URL (got ${url.origin})`);
  }
  return url.origin;
}

export function createSource({
  baseUrl, timeoutMs = 60 * 1000, fetchImpl = globalThis.fetch
}) {
  const origin = checkBaseUrl(baseUrl);

  async function getPage(path, page, fields) {
    const url = new URL(`/wp-json/wp/v2/${path}`, origin);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    if (fields) {
      url.searchParams.set('_fields', fields.join(','));
    }
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`GET ${url.pathname} page ${page}: HTTP ${res.status}`);
    }
    return {
      items: await res.json(),
      totalPages: Number(res.headers.get('x-wp-totalpages') || 1)
    };
  }

  return {
    origin,

    // Every item of a collection (pages, media), following the pagination;
    // `fields` limits the response to what the import reads.
    async getAll(path, fields) {
      const first = await getPage(path, 1, fields);
      const items = [ ...first.items ];
      for (let page = 2; page <= first.totalPages; page++) {
        items.push(...(await getPage(path, page, fields)).items);
      }
      return items;
    },

    // Downloads one upload to `dest`, refusing other hosts, other paths and
    // anything over `maxMb`, checked before and while streaming.
    async download(fileUrl, dest, maxMb) {
      const url = new URL(fileUrl, origin);
      if (url.origin !== origin || !url.pathname.startsWith('/wp-content/uploads/')) {
        throw new Error(`Refused: ${url.href} is not an upload of ${origin}`);
      }
      const limit = maxMb * MB;
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        throw new Error(`GET ${url.pathname}: HTTP ${res.status}`);
      }
      if (Number(res.headers.get('content-length') || 0) > limit) {
        throw new Error(`${url.pathname} is larger than ${maxMb} MB`);
      }
      let bytes = 0;
      const body = Readable.fromWeb(res.body);
      body.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > limit) {
          body.destroy(new Error(`${url.pathname} is larger than ${maxMb} MB`));
        }
      });
      try {
        await pipeline(body, createWriteStream(dest));
      } catch (e) {
        await unlink(dest).catch(() => {});
        throw e;
      }
      return bytes;
    }
  };
}
