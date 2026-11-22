import test from "node:test";
import assert from "node:assert/strict";
import { fetchAllSummaryRows } from "../owner/summary-pagination.mjs";
import { summarizeHourlyOrders } from "./hourly-summary.mjs";

const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const C = "10000000-0000-4000-8000-000000000003";
const D = "10000000-0000-4000-8000-000000000004";
const rows = [
  { id: A, created_at: "2026-11-22T03:15:00.000Z", total: 200, payment_status: "PAID" },
  { id: C, created_at: "2026-11-22T02:50:00.000Z", total: 300, payment_status: "PAID" },
  { id: B, created_at: "2026-11-22T02:50:00.000Z", total: 100, payment_status: "PAID" },
  { id: D, created_at: "2026-11-22T01:10:00.000Z", total: 50, payment_status: "PENDING" },
];

test("hourly report aggregates local hour buckets and only verified payment totals", () => {
  assert.deepEqual(summarizeHourlyOrders(rows, "Asia/Jakarta"), [
    { hour: "08", count: 1, paidTotal: 0 },
    { hour: "09", count: 2, paidTotal: 400 },
    { hour: "10", count: 1, paidTotal: 200 },
  ]);
});

test("hourly report consumes every cursor page and deduplicates overlapping rows", async () => {
  const calls = [];
  const fetched = await fetchAllSummaryRows(async (cursor, size) => {
    calls.push({ cursor, size });
    if (!cursor) return { data: rows.slice(0, 2), error: null };
    if (cursor.id === C) return { data: rows.slice(1, 3), error: null };
    if (cursor.id === B) return { data: rows.slice(3), error: null };
    throw new Error("Unexpected report cursor");
  }, 2);
  assert.deepEqual(fetched.map((order) => order.id), [A, C, B, D]);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].cursor.id, C);
  assert.equal(calls[2].cursor.id, B);
  assert.equal(calls[0].size, 2);
  assert.deepEqual(summarizeHourlyOrders(fetched, "Asia/Jakarta"), [
    { hour: "08", count: 1, paidTotal: 0 },
    { hour: "09", count: 2, paidTotal: 400 },
    { hour: "10", count: 1, paidTotal: 200 },
  ]);
});

test("hourly report rejects invalid timestamps and non-finite totals", () => {
  assert.throws(() => summarizeHourlyOrders([{ created_at: "not-a-date", total: 1, payment_status: "PAID" }]), /Invalid hourly report order timestamp/);
  assert.throws(() => summarizeHourlyOrders([{ created_at: "2026-11-22T01:00:00Z", total: "NaN", payment_status: "PAID" }]), /Invalid hourly report order total/);
});
