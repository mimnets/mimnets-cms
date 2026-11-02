// "Sanitize after restore" (m1-032; D-DB-6 staging blocker, ADR-0002 §9).
//
// A database dump carries the source site's authentication state: login
// sessions, bearer tokens, login-throttle counters (keyed by username) and
// outstanding password-reset hashes. Restored into another environment, a
// copied session cookie or bearer token would still log someone in there.
// The task removes exactly that state from the database the app is configured
// for. Content, users, password hashes, form submissions and media are not
// touched. Everyone is logged out and must log in again.
//
// Collections and fields, as used by apostrophe 4.34.0:
//   sessions          express-session store (connect-mongo's default name)
//   aposBearerTokens  @apostrophecms/login API and incomplete-login tokens
//   aposCache         @apostrophecms/login throttle, namespace
//                     `@apostrophecms/loginAttempt` and
//                     `@apostrophecms/loginAttempt/<requirement>`
//   aposUsersSafe     `passwordResetHash` (@apostrophecms/login, passwordReset)
//
// Documents are deleted or fields unset through the database API; no
// collection is dropped.

export const SANITIZE_TARGETS = [
  {
    label: 'login sessions',
    collection: 'sessions',
    filter: {},
    action: 'delete'
  },
  {
    label: 'bearer and incomplete-login tokens',
    collection: 'aposBearerTokens',
    filter: {},
    action: 'delete'
  },
  {
    label: 'login-throttle counters',
    collection: 'aposCache',
    filter: { namespace: { $regex: '^@apostrophecms/loginAttempt(/|$)' } },
    action: 'delete'
  },
  {
    label: 'password-reset hashes',
    collection: 'aposUsersSafe',
    filter: { passwordResetHash: { $exists: true } },
    action: 'unset',
    field: 'passwordResetHash'
  }
];

// Deletion must name the database it runs on, so a shell pointed at the wrong
// APOS_DB_URI cannot sanitize the wrong site. A dry run prints the name.
export function checkSanitizeArgs(argv, databaseName) {
  const execute = argv.execute === true;
  const given = argv.database === undefined ? null : String(argv.database);
  if (execute && given === null) {
    throw new Error(`--execute needs --database=<name>. This app is configured for "${databaseName}".`);
  }
  if (given !== null && given !== databaseName) {
    throw new Error(`--database=${given} does not match the configured database "${databaseName}".`);
  }
  return { execute };
}
