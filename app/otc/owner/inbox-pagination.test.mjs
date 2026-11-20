import test from "node:test";
import assert from "node:assert/strict";
import { INBOX_PAGE_SIZE, buildInboxCursorFilter, cursorFromPage } from "./inbox-pagination.mjs";

const created_at = "2026-11-21T06:36:00.000Z";
const id = "10000000-0000-4000-8000-000000000100";

test("cursor filter uses created_at and ID tie-breaker in descending order", () => {
  assert.equal(
    buildInboxCursorFilter({ created_at, id }),
    `created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`,
  );
});

test("cursor is taken from the last row only when a full page is returned", () => {
  const rows = Array.from({ length: INBOX_PAGE_SIZE }, (_, i) => ({
    created_at,
    id: `10000000-0000-4000-8000-000000000${String(i + 1).padStart(3, "0")}`,
  }));
  assert.deepEqual(cursorFromPage(rows), rows.at(-1));
  assert.equal(cursorFromPage(rows.slice(0, INBOX_PAGE_SIZE - 1)), null);
});

test("invalid cursor input is rejected instead of being interpolated into PostgREST", () => {
  assert.throws(() => buildInboxCursorFilter({ created_at: `${created_at},or(id.eq.any)`, id }), /Invalid Owner Inbox pagination cursor/);
  assert.throws(() => buildInboxCursorFilter({ created_at, id: "not-a-uuid" }), /Invalid Owner Inbox pagination cursor/);
});

test("invalid last row cursor and non-positive page sizes are rejected", () => {
  assert.throws(() => cursorFromPage([{ created_at, id: "not-a-uuid" }], 1), /Invalid Owner Inbox last-row cursor/);
  assert.throws(() => cursorFromPage([], 0), /Invalid Owner Inbox page size/);
});
