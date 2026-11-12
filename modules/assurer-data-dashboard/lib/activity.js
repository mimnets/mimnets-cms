// The activity log (m1-070, design §5.3): exports, imports and refused
// access, which core's Document Versions does not record. Content edits are
// not repeated here.
//
// Its own collection through Apostrophe's database handle, as core does for
// locks and notifications. It is not content: not a document type, not in
// any manager, never exported. Append-only: this file has no update, and
// entries are removed only by `prune` after the retention period.

// No brand in the stored name, so the staged rename to mimnets-wms needs no
// data migration (m1-070).
export const COLLECTION = 'dataDashboardActivity';
export const KINDS = [ 'export', 'import', 'import-replace', 'refused' ];
export const RETENTION_DAYS = 365;
const PAGE_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export function createActivityLog(apos) {
  const collection = apos.db.collection(COLLECTION);

  return {
    async ensureIndexes() {
      await collection.createIndex({ at: -1 });
    },

    // `details` holds counts, type names and outcomes only: no document
    // content, no file contents, no addresses.
    async record(req, kind, details = {}) {
      if (!KINDS.includes(kind)) {
        throw new Error(`Unknown activity kind: ${kind}`);
      }
      await collection.insertOne({
        _id: apos.util.generateId(),
        at: new Date(),
        kind,
        userId: req.user?._id || null,
        username: req.user?.username || null,
        details
      });
    },

    // Newest first, `PAGE_SIZE` per page, optionally one kind only.
    async list({ kind, page = 1 } = {}) {
      const query = KINDS.includes(kind) ? { kind } : {};
      const total = await collection.countDocuments(query);
      const entries = await collection.find(query)
        .sort({ at: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .toArray();
      return {
        entries,
        total,
        page,
        pages: Math.max(1, Math.ceil(total / PAGE_SIZE))
      };
    },

    // Removes entries older than `days`; returns how many.
    async prune(days = RETENTION_DAYS, now = Date.now()) {
      const result = await collection.deleteMany({
        at: { $lt: new Date(now - days * DAY_MS) }
      });
      return result.deletedCount || 0;
    }
  };
}
