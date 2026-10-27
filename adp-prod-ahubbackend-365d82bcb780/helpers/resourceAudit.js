const resourceAuditRepo = require('../repositories/resourceAuditRepo');
const logger = require('./logger');

/**
 * Helpers for recording Resource Tracker change history.
 *
 * The trusted actor id (esId) comes from the auth token (`req.user.id`). The
 * display name/email are passed by the authenticated client via headers
 * (`x-actor-name` / `x-actor-email`), URL-encoded so non-ASCII names survive.
 */

const decodeHeader = (value) => {
  if (!value) return '';
  try {
    return decodeURIComponent(String(value)).trim();
  } catch (err) {
    return String(value).trim();
  }
};

const getActor = (req) => ({
  esId: String(req?.user?.id || '').trim(),
  name: decodeHeader(req?.headers?.['x-actor-name']),
  email: decodeHeader(req?.headers?.['x-actor-email']).toLowerCase(),
});

// Fields that are internal/technical and should never appear in a diff.
const IGNORED_FIELDS = new Set([
  '_id',
  '__v',
  'refId',
  'rowStatus',
  'ProjectDetails',
  'createdAt',
  'updatedAt',
]);

const normalizeForCompare = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
};

/**
 * Computes the changed fields between an existing document and the incoming
 * update payload. Only keys present in `next` are considered so that partial
 * updates don't report untouched fields as removed.
 * @returns {Array<{ field, from, to }>}
 */
const diffResource = (prev = {}, next = {}) => {
  const changes = [];
  const source = prev && typeof prev.toObject === 'function' ? prev.toObject() : prev || {};
  Object.keys(next || {}).forEach((field) => {
    if (IGNORED_FIELDS.has(field)) return;
    const before = normalizeForCompare(source[field]);
    const after = normalizeForCompare(next[field]);
    if (before !== after) {
      changes.push({ field, from: source[field] ?? '', to: next[field] ?? '' });
    }
  });
  return changes;
};

/**
 * Persists audit entries. Never throws: an audit failure must not break the
 * primary resource operation, so errors are logged and swallowed.
 * @param {Array<object>} entries
 */
const recordAudit = async (entries = []) => {
  const list = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
  if (!list.length) return;
  try {
    await resourceAuditRepo.insertEntries(list);
  } catch (err) {
    logger.error('resource.audit_write_failed', { error: err?.message });
  }
};

module.exports = {
  getActor,
  diffResource,
  recordAudit,
};
