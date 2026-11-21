import test from "node:test";
import assert from "node:assert/strict";
import { fetchAllSummaryRows } from "./summary-pagination.mjs";

const row = (id, created_at) => ({ id, created_at, outlet_id: "outlet-a", total: 10, status: "NEW", payment_status: "PENDING" });
const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const C = "10000000-0000-4000-8000-000000000003";
const D = "10000000-0000-4000-8000-000000000004";
const t1 = "2026-11-21T10:00:00.000Z";
const t2 = "2026-11-21T09:00:00.000Z";
const t3 = "2026-11-21T08:00:00.000Z";
const t4 = "2026-11-21T07:00:00.000Z";

test("fetches all summary rows across cursor pages and deduplicates IDs", async () => {
  const calls = [];
  const result = await fetchAllSummaryRows(async (cursor, size) => {
    calls.push({ cursor, size });
    if (!cursor) return { data: [row(A, t1), row(B, t2)], error: null };
    if (cursor.id === B) return { data: [row(B, t2), row(C, t3)], error: null };
    if (cursor.id === C) return { data: [row(D, t4)], error: null };
    throw new Error("Unexpected cursor");
  }, 2);
  assert.deepEqual(result.map((r) => r.id), [A, B, C, D]);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].cursor, null);
  assert.equal(calls[1].cursor.id, B);
  assert.equal(calls[2].cursor.id, C);
  assert.equal(calls[0].size, 2);
});

test("short page and empty page terminate pagination", async () => {
  let calls = 0;
  const result = await fetchAllSummaryRows(async () => {
    calls += 1;
    return { data: [row(A, t1)], error: null };
  }, 2);
  assert.deepEqual(result, [row(A, t1)]);
  assert.equal(calls, 1);
});

test("query errors are propagated without returning partial totals", async () => {
  const failure = new Error("database unavailable");
  await assert.rejects(fetchAllSummaryRows(async () => ({ data: null, error: failure }), 2), (err) => err === failure);
});

test("repeated cursor fails closed instead of looping or returning incomplete totals", async () => {
  const repeated = [row(A, t1), row(B, t2)];
  await assert.rejects(fetchAllSummaryRows(async () => ({ data: repeated, error: null }), 2), /did not advance/);
});

test("invalid page size and malformed rows fail closed", async () => {
  await assert.rejects(fetchAllSummaryRows(async () => ({ data: [], error: null }), 0), /Invalid summary page size/);
  await assert.rejects(fetchAllSummaryRows(async () => ({ data: [{ id: "" }], error: null }), 2), /Invalid order summary row/);
});
