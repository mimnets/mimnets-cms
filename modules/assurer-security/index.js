// Site-wide security controls not covered by core or by
// @apostrophecms/security-headers (m1-011):
//
// - Removes the `X-Powered-By: Express` header.
// - Limits contact-form submissions per client IP address.
// - `sanitize-after-restore` task: removes authentication state carried by a
//   database restore (m1-032, lib/sanitize.js).
//
// Form rate limit threat model: one source scripting bulk submissions, which
// would fill the submission store (personal data) and a future notification
// inbox. Every POST to the submit route that passes core's CSRF check counts,
// including invalid ones; requests without the CSRF cookie are already
// rejected by core (403) before this middleware runs. Over the limit, the
// route answers 429 with Retry-After and nothing is parsed or stored. Counts
// live in core's `apos.cache` (the store core's login throttle uses), so the
// limit is shared by every app process on the same database and expires on
// its own. Distributed spam needs a CAPTCHA (D-M0-5), and volumetric abuse
// needs limits at the reverse proxy; both are out of scope here. The client
// address is `req.ip`, which only honours X-Forwarded-For from proxies listed
// in APOS_TRUST_PROXY (see lib/config.js).
import { clientKey, readSecurityEnv } from './lib/config.js';
import { checkSanitizeArgs, SANITIZE_TARGETS } from './lib/sanitize.js';

const NAMESPACE = 'assurer-form-rate-limit';
const { formRateLimit } = readSecurityEnv();

export default {
  options: {
    formRateLimit
  },
  init(self) {
    self.apos.app.disable('x-powered-by');
  },
  middleware(self) {
    return {
      limitFormSubmissions: {
        url: '/api/v1/@apostrophecms/form/submit',
        async middleware(req, res, next) {
          if (req.method !== 'POST') {
            return next();
          }
          try {
            const retryAfter = await self.countFormSubmission(clientKey(req.ip));
            if (!retryAfter) {
              return next();
            }
            const message = 'Too many submissions. Please try again later.';
            res.set('Retry-After', String(retryAfter));
            // `formErrors` with a global entry, as the form module reports
            // reCAPTCHA failures: its browser code only shows an error when
            // that field is present, and shows "thank you" otherwise.
            return res.status(429).send({
              name: 'too-many-requests',
              data: {
                formErrors: [ {
                  global: true,
                  error: 'too-many-requests',
                  message
                } ]
              },
              message
            });
          } catch (e) {
            // Fail open: a cache problem must not take the form down. The
            // error is logged so it can be investigated.
            self.apos.util.error('assurer-security: form rate limit check failed', e.message);
            return next();
          }
        }
      }
    };
  },
  tasks(self) {
    return {
      // Operator tool, for example when a legitimate office behind one
      // shared address is blocked, or before re-running the HTTP test
      // suites locally. Command line only; there is no HTTP equivalent.
      'clear-form-rate-limit': {
        usage: 'Clear all contact-form rate-limit counters.\n' +
          'Usage: node app assurer-security:clear-form-rate-limit',
        async task() {
          await self.apos.cache.clear(NAMESPACE);
          self.apos.util.log('Contact-form rate-limit counters cleared.');
        }
      },
      // Run on every restored copy before it serves traffic (lib/sanitize.js,
      // database backup and restore runbook). Command line only.
      'sanitize-after-restore': {
        usage: 'Remove login sessions, bearer tokens, login-throttle counters and\n' +
          'password-reset hashes carried over by a database restore.\n' +
          'Content, users, passwords, form submissions and media are not touched.\n' +
          'Dry run (default; changes nothing):\n' +
          '  node app assurer-security:sanitize-after-restore\n' +
          'Apply (logs everyone out; --database must name the configured database):\n' +
          '  node app assurer-security:sanitize-after-restore --execute --database=<name>',
        async task(argv) {
          const databaseName = self.apos.db.databaseName;
          const { execute } = checkSanitizeArgs(argv, databaseName);
          const lines = [ `${execute ? 'SANITIZE' : 'Dry run'}: database "${databaseName}".` ];
          const report = [];
          for (const target of SANITIZE_TARGETS) {
            const collection = self.apos.db.collection(target.collection);
            const found = await collection.countDocuments(target.filter);
            let changed = 0;
            if (execute && found > 0) {
              const result = target.action === 'delete'
                ? await collection.deleteMany(target.filter)
                : await collection.updateMany(target.filter, {
                  $unset: { [target.field]: 1 }
                });
              changed = target.action === 'delete'
                ? result.deletedCount
                : result.modifiedCount;
            }
            report.push({
              collection: target.collection,
              found,
              changed
            });
            lines.push(`  ${target.label} (${target.collection}): ${found} found` +
              (execute ? `, ${changed} ${target.action === 'delete' ? 'deleted' : 'cleared'}` : ''));
          }
          if (!execute) {
            lines.push(`Nothing changed. To apply: --execute --database=${databaseName}`);
          }
          self.apos.util.log(lines.join('\n'));
          return report;
        }
      }
    };
  },
  methods(self) {
    return {
      // Records one attempt. Returns 0 when it is allowed, otherwise the
      // number of seconds until the window ends.
      async countFormSubmission(key) {
        const { max, windowMinutes } = self.options.formRateLimit;
        const windowSeconds = windowMinutes * 60;
        const cache = self.apos.cache;
        const count = await cache.get(NAMESPACE, key);
        if (count === undefined) {
          await cache.set(NAMESPACE, key, 1, windowSeconds);
          return 0;
        }
        if (count >= max) {
          const entry = await cache.cacheCollection.findOne({
            namespace: NAMESPACE,
            key
          });
          const left = entry?.expires
            ? Math.ceil((new Date(entry.expires).getTime() - Date.now()) / 1000)
            : windowSeconds;
          return Math.max(1, Math.min(left, windowSeconds));
        }
        // Same increment core's login throttle uses; keeps the expiry.
        await cache.cacheCollection.updateOne({
          namespace: NAMESPACE,
          key
        }, {
          $inc: { value: 1 }
        });
        return 0;
      }
    };
  }
};
