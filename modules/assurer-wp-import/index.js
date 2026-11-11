// WordPress import into drafts (m1-067, D-CONTENT-17; design note
// docs/content/wordpress-import-design.md). Reads the old site's public REST
// API (GET only, never a login, never a write to WordPress) and writes
// pages, products, organizations, a location, images and PDFs through
// Apostrophe's APIs. Pages and records stay drafts for the owner's review.
//
//   node app assurer-wp-import:run                 dry run: prints the plan
//   node app assurer-wp-import:run --execute       writes the drafts
//
// Re-runs update only the import's own untouched drafts (see lib/apply.js).
import { applyPlan } from './lib/apply.js';
import { createMediaIndex } from './lib/media.js';
import { buildPlan } from './lib/plan.js';
import { createSource } from './lib/source.js';

const DEFAULTS = {
  source: 'https://www.assurerworld.com',
  // Uploads on or after this date are skipped: the source site was
  // compromised and spam was published from 2026-11-09 (m1-067).
  mediaBefore: '2026-11-08',
  maxImageMb: 15,
  maxFileMb: 60
};

const PAGE_FIELDS = [ 'id', 'link', 'title', 'content' ];
const MEDIA_FIELDS = [ 'id', 'date_gmt', 'title', 'mime_type', 'media_details', 'source_url' ];

export default {
  tasks(self) {
    return {
      run: {
        usage: 'Import the WordPress site into drafts (m1-067). Dry run unless --execute.\n' +
          'Usage: node app assurer-wp-import:run [--execute] [--source=https://…] ' +
          `[--media-before=YYYY-MM-DD] [--max-image-mb=${DEFAULTS.maxImageMb}] ` +
          `[--max-file-mb=${DEFAULTS.maxFileMb}]`,
        task: (argv) => self.run(argv)
      }
    };
  },
  methods(self) {
    const number = (value, fallback) => {
      const n = Number(value ?? fallback);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`Not a positive number: ${value}`);
      }
      return n;
    };

    return {
      async run(argv) {
        const options = {
          source: argv.source || DEFAULTS.source,
          mediaBefore: argv['media-before'] || DEFAULTS.mediaBefore,
          maxImageMb: number(argv['max-image-mb'], DEFAULTS.maxImageMb),
          maxFileMb: number(argv['max-file-mb'], DEFAULTS.maxFileMb),
          execute: argv.execute === true
        };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(options.mediaBefore)) {
          throw new Error('--media-before must be a date, YYYY-MM-DD');
        }
        const source = createSource({ baseUrl: options.source });
        const log = (line = '') => self.apos.util.log(line);

        log(`WordPress import from ${source.origin} (${options.execute ? 'EXECUTE: writing drafts' : 'dry run: nothing is written'})`);
        const pages = await source.getAll('pages', PAGE_FIELDS);
        const media = await source.getAll('media', MEDIA_FIELDS);
        log(`Read ${pages.length} pages and ${media.length} media items.`);

        const plan = buildPlan({
          pages,
          mediaIndex: createMediaIndex(media, { before: options.mediaBefore })
        });
        const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        const sum = (items) => items
          .reduce((total, item) => total + (item.bytes || 0), 0);
        log(`Plan: ${plan.pages.length} pages, ${plan.products.length} products, ` +
          `${plan.organizations.length} organizations, ${plan.locations.length} locations, ` +
          `${plan.images.size} images (${mb(sum([ ...plan.images.values() ]))}), ` +
          `${plan.files.length} files (${mb(sum(plan.files))}), ${plan.redirects.length} redirects.`);

        const report = await applyPlan(self.apos, plan, {
          source,
          execute: options.execute,
          maxImageMb: options.maxImageMb,
          maxFileMb: options.maxFileMb
        });

        const section = (title, lines) => {
          log();
          log(`${title} (${lines.length})`);
          for (const line of lines) {
            log(`  ${line}`);
          }
        };
        const verb = options.execute ? '' : ' (would be)';
        section(`Created${verb}`, report.new);
        section(`Updated${verb}`, report.changed);
        section('Unchanged', report.unchanged);
        section('Kept: changed by a person, published or archived; not touched', report.kept);
        section('Skipped at the source', [ ...new Set(plan.skipped) ]);
        section('For the owner to review', [ ...new Set([ ...plan.review, ...report.notes ]) ]);
        section('Failed', report.failed);
        log();
        log('Nothing was published. The 20 legacy page redirects follow after publishing: ' +
          'node app assurer-seo:seed-redirects');
        if (!options.execute) {
          log('Dry run only. Add --execute to write the drafts.');
        }
        if (report.failed.length) {
          throw new Error(`${report.failed.length} item(s) failed; see above`);
        }
      }
    };
  }
};
