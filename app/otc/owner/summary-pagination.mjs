import { cursorFromPage } from "./inbox-pagination.mjs";

export const SUMMARY_PAGE_SIZE = 1000;
const MAX_SUMMARY_PAGES = 10000;

/**
 * Fetch today's summary rows with keyset pagination so Supabase/PostgREST row caps
 * do not silently truncate owner counts, paid totals, or outlet summaries.
 * fetchPage must preserve business/date scope and deterministic created_at,id order.
 */
export async function fetchAllSummaryRows(fetchPage, pageSize = SUMMARY_PAGE_SIZE) {
  if (typeof fetchPage !== "function") throw new Error("Summary page fetcher is required");
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error("Invalid summary page size");

  let cursor = null;
  const cursorKeys = new Set();
  const seenIds = new Set();
  const collected = [];

  for (let pageIndex = 0; pageIndex < MAX_SUMMARY_PAGES; pageIndex += 1) {
    const result = await fetchPage(cursor, pageSize);
    if (result?.error) throw result.error;
    const rows = Array.isArray(result?.data) ? result.data : [];

    for (const row of rows) {
      if (!row || typeof row.id !== "string" || row.id.length === 0) {
        throw new Error("Invalid order summary row");
      }
      if (!seenIds.has(row.id)) {
        seenIds.add(row.id);
        collected.push(row);
      }
    }

    const nextCursor = cursorFromPage(rows, pageSize);
    if (!nextCursor) return collected;

    const nextKey = nextCursor.created_at + "|" + nextCursor.id;
    if (cursorKeys.has(nextKey) || (cursor && cursor.created_at + "|" + cursor.id === nextKey)) {
      throw new Error("Order summary pagination did not advance");
    }
    cursorKeys.add(nextKey);
    cursor = nextCursor;
  }

  throw new Error("Order summary pagination exceeded safety limit");
}
