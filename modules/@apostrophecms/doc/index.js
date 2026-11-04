// modules/@apostrophecms/doc/index.js

// Delete guard for review before publish (m1-037, D-CONTENT-11).
//
// Core lets anyone who may edit a draft delete it (permission `canDelete()`),
// then deletes the published copy too (`deleteOtherModes`), which needs
// publish rights. For a contributor the second step is refused only after
// the draft is gone: the API answers 403, but the live page or piece is left
// without a draft, so editors can no longer manage it. This handler refuses
// before anything is deleted when the draft has a published copy and the
// user may not publish. Never-published drafts, editors, admins and code
// that passes `permissions: false` are unchanged. The UI's "Discard draft"
// on published content reverts instead of deleting, so it is not affected.
export default {
  handlers(self) {
    return {
      '@apostrophecms/doc-type:beforeDelete': {
        async refuseDeleteOfPublishedDraft(req, doc, options) {
          if (options.permissions === false || !doc.aposLocale?.endsWith(':draft')) {
            return;
          }
          const published = await self.db.findOne({
            _id: doc._id.replace(/:draft$/, ':published')
          });
          if (published && !self.apos.permission.can(req, 'publish', doc)) {
            throw self.apos.error('forbidden');
          }
        }
      }
    };
  }
};
