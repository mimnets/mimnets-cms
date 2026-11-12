// Who counts as a site administrator (m1-070). Only the admin role may edit
// user accounts, so this is the same check the form submissions page uses
// (modules/assurer-forms). Server-side checks call this; it is never trusted
// from the browser.
export function isSiteAdmin(apos, req) {
  return Boolean(req?.user) && apos.permission.can(req, 'edit', '@apostrophecms/user');
}
