export const INBOX_PAGE_SIZE = 100;

const ISO_TIMESTAMP = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildInboxCursorFilter(cursor) {
  if (!cursor || typeof cursor.created_at !== "string" || !ISO_TIMESTAMP.test(cursor.created_at) || typeof cursor.id !== "string" || !UUID.test(cursor.id)) {
    throw new Error("Invalid Owner Inbox pagination cursor");
  }
  return `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`;
}

export function cursorFromPage(rows, pageSize = INBOX_PAGE_SIZE) {
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error("Invalid Owner Inbox page size");
  if (!Array.isArray(rows) || rows.length < pageSize) return null;
  const last = rows[rows.length - 1];
  if (!last || typeof last.created_at !== "string" || !ISO_TIMESTAMP.test(last.created_at) || typeof last.id !== "string" || !UUID.test(last.id)) {
    throw new Error("Invalid Owner Inbox last-row cursor");
  }
  return { created_at: last.created_at, id: last.id };
}
