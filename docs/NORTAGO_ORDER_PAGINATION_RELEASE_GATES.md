# NORTAGO ORDER — Pagination release gate (branch-only)

This independent draft is based directly on lifecycle PR #18 head `03ac27ceb0d268826c2b76e49808a923786d9e13` to avoid inheriting PR #21/#22/#23 stack divergence. It changes Owner Order Inbox pagination and daily owner summary pagination only. No migration is included.

## Owner Inbox
- Keyset pagination in deterministic `created_at DESC, id DESC` order, 100 orders per page.
- Next page uses a validated cursor derived from the last row and an OR filter strictly older than the cursor tuple.
- Merge/deduplicate loaded IDs; reset cursor and loaded rows on business switch; reset to first page after lifecycle action.
- Search/filter remain client-side and cover loaded pages only; UI labels this limitation.
- Tests validate filter shape, tie-break cursor, full/short pages, malformed cursor and last-row inputs.

## Owner daily summary
- Fetch all daily rows in 1,000-row keyset pages with the selected business/date filters and stable ordering.
- Deduplicate IDs, propagate page errors, reject malformed rows/cursors, detect non-advancing cursor and stop at a safety cap; partial totals are not returned.
- Metrics and per-outlet groupings are computed only after all pages are successfully collected.

## CI tests
- `node --test app/otc/owner/inbox-pagination.test.mjs`
- `node --test app/otc/owner/summary-pagination.test.mjs`
- Production build and existing disposable PostgreSQL migration/security smoke tests remain in CI.

## Manual UAT — exact preview SHA
- [ ] Business A has >100 orders today; load pages and verify no duplicates/overlap and descending cursor order.
- [ ] Insert a new order at the top after page 1; page 2 still starts after page-1 cursor.
- [ ] Multiple rows share `created_at`; verify the ID tie-breaker and no overlap.
- [ ] Final short page removes the Load More action.
- [ ] Business switch clears prior loaded orders/cursor; lifecycle update returns inbox to page 1.
- [ ] Search/filter clearly applies only to loaded pages.
- [ ] Business A cannot see Business B orders; confirm every inbox and summary query retains the selected `business_id` filter and actual staging RLS is enforced.
- [ ] Business has >1,000 daily orders across outlets; verify totals/outlet metrics include later pages.
- [ ] Inject a later-page summary query error in a disposable test; UI fails closed and does not display partial totals.
- [ ] Preview URL is built from this PR's exact head SHA and desktop/mobile checks have no console errors or horizontal overflow.

## Evidence boundary

CI and unit tests are not browser UAT or live staging evidence. This branch does not authorize staging migrations, production deploys, payment/webhook activation, secret/environment changes, destructive operations, or merging. LinkBayar remains disabled. Delivery fees/courier handling and STAFF outlet policy remain separate commercial gates. NORTAGO ORDER only; excluded features remain excluded.
