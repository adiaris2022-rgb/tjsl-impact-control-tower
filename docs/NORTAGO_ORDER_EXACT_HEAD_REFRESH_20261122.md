# NORTAGO ORDER — exact-head refresh (22 Nov 2026, 15:26 WIB)

This snapshot supersedes prior PR/head/CI tables where values conflict. Metadata, exact commit workflow runs, job results, and commit statuses were freshly fetched from GitHub.

## Primary release PRs

All PRs #1 and #12–#17 remain **Open / Draft / Unmerged / mergeable** at this refresh.

| PR | Head SHA | Base branch | Base SHA | Exact-head CI | Jobs | Vercel commit status |
|---|---|---|---|---|---|
| [#1](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/1) | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `main` | `545f4953368d0e85d7573c609bf4abf96b041c80` | [#69 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44665343539) | success |
| [#12](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/12) | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `feature/nortago-order-audit-fix` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | [#183 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44810763148) | success |
| [#13](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/13) | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `release/nortago-order-only-20261120` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | [#136 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44721352568) | success |
| [#14](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/14) | `f3a86754461b06b10250b073a38fae906bfd2777` | `fix/nortago-order-plan-snapshot-20261120` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | [#138 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725160805) | build rate limited |
| [#15](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/15) | `e16260f8147e3b55255be6bf5163a32774abe280` | `fix/nortago-order-checkout-idempotency-20261120` | `f3a86754461b06b10250b073a38fae906bfd2777` | [#140 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725624942) | build rate limited |
| [#16](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/16) | `db3e6a43edc4edc4d3338504d87da11163594e42` | `fix/nortago-order-release-scope-20261120` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#141 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44740771154) | success |
| [#17](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/17) | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `fix/nortago-order-release-scope-20261120` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#143 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44741038747) | success |

Exact-SHA lookup confirmed each listed workflow's commit association. Job endpoints were fetched for all seven: **production build PASS (7/7), PostgreSQL migration/replay/smoke PASS (7/7)**, totaling 14/14 jobs. PR #16/#17 are specifically reconfirmed at #141/#143. Vercel failures on #14/#15 are provider build-rate limits; they are not GitHub CI failures.

## Related security/scope PRs

| PR | Exact head | Exact CI | Vercel |
|---|---|---|---|
| [#18 Lifecycle RPC](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/18) | `03ac27ceb0d268826c2b76e49808a923786d9e13` | [#191 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44832208699) | success |
| [#26 RPC-only writes](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/26) | `99ca6c1b461ef267789a6eecf9ed18807b75a9f5` | [#216 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44881451219) | success |
| [#28 release evidence](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/28) | `477eb8a6d0b20fd3cd831d8b45bbaf5cda532252` | [#259 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45002937446) | not rechecked in this run |
| [#30 POS source guard](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/30) | `751a307185dd99cd8842bc5cd54a4a3ad8352f8e` | [#250 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44960942102) | success |

Both jobs were fetched and verified for each related run: production build and PostgreSQL migration/smoke.

## Lifecycle security evidence and limitations

Source SQL review confirmed the baseline business-membership `FOR ALL` policy does not enforce transition/audit semantics; the lifecycle RPC does, but no trigger forces direct status writes through it. The baseline bypass was reproduced in disposable PostgreSQL with simulated client table/column DML grants.

PR #26's RPC-only hardening revokes client table/column mutation privileges on `otc_orders` and `otc_order_items` from `PUBLIC`, `anon`, and `authenticated`, retains authenticated SELECT with business-scoped RLS, and keeps approved SECURITY DEFINER checkout/receipt/lifecycle RPCs. Regression tests reject direct mutations and allow the approved lifecycle RPC with one audit event and unchanged payment status.

PR #30 rejects `POS_INTEGRATED` in addition to Dine-In and staff Walk-In; CI preserves online Take Away acceptance and rejects legacy POS lifecycle advancement.

**Evidence boundary:** effective grants, RLS, function ownership, auth identity, and real tenant role behavior on Supabase staging/live are not verified. These are source and disposable PostgreSQL CI results only.

## Release gates (still open)

- Current-head preview browser UAT (desktop/mobile) for Customer menu → checkout → receipt.
- Owner Inbox → lifecycle RPC → audit browser UAT.
- Approved disposable Supabase staging migration; capture effective table/column grants, RLS, auth and Business A/B isolation.
- Confirm business-level vs outlet-level staff authorization requirement.
- Delivery fee/courier handoff and payment-before-fulfillment policy.
- Commercial sign-off, production release approval, and rollback plan.

Automated CI covers checkout-to-receipt, idempotency, tenant isolation, per-outlet monthly/yearly subscription, pagination, lifecycle edges/audit, direct-DML denial, and Order scope. It does not replace deployed UAT.

No merge, production deploy, staging/live migration, payment/webhook activation, secret/environment change, or destructive action is performed. LinkBayar remains disabled. Scope remains Customer Self-Order, Take Away, Pre-Order, and Delivery only; Dine-In, Reservation, Walk-In/POS, queue, tables/seating/capacity, sessions, Control Tower, and BOS remain excluded.


## Authoritative refresh — 22 Nov 2026, 16:36 WIB

This update supersedes the earlier PR #28 row above. Fresh GitHub metadata shows PR #28 remains Open/Draft/Unmerged/mergeable at head `477eb8a6d0b20fd3cd831d8b45bbaf5cda532252`. Exact-head workflow Run #259 (ID `45002937446`) completed successfully on that SHA. Both jobs were fetched individually: **Install and production build — PASS**; **Validate PostgreSQL migrations and smoke tests — PASS**. No Vercel status was independently fetched in this refresh, and browser preview UAT remains unverified.


### Fresh exact-head job evidence
- PRs #1/#12/#13/#14/#15/#16/#17: all exact head SHA and exact workflow-run association refreshed. Both jobs fetched for every run: 7 production-build passes and 7 PostgreSQL migration/smoke passes (14/14).
- PR #16 Run #141 and PR #17 Run #143 rechecked and PASS on exact current commits.
- PR #18 Run #191, PR #26 Run #216, and PR #30 Run #250: both jobs fetched and PASS on the associated exact head SHA.
- PR #29 exact head `d63f3aa9ab0e20b972766b7215db245b8f54cccb`, Run #238: both jobs fetched and PASS. Product/Service checkout-to-receipt and catalog mutation tests are CI-only evidence.


## Superseding exact-head refresh — 23 Nov 2026, 00:11 WIB

Fresh GitHub PR metadata, exact-SHA workflow runs, run jobs, and commit status contexts were fetched during this refresh. This section supersedes older entries above where refs/statuses differ.


### Primary PRs #1 and #12–#17

All seven remain Open / Draft / Unmerged / mergeable. Both CI jobs on each exact current head passed (production build and PostgreSQL migrations/replay/smoke), **7/7 runs and 14/14 jobs PASS**.

| PR | Head branch / SHA | Base branch / SHA | Exact CI | Vercel |
|---|---|---|---|---|
| #1 | `feature/nortago-order-audit-fix` / `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `main` / `545f4953368d0e85d7573c609bf4abf96b041c80` | [#69 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44665343539) | success |
| #12 | `release/nortago-order-only-20261120` / `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `feature/nortago-order-audit-fix` / `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | [#183 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44810763148) | success |
| #13 | `fix/nortago-order-plan-snapshot-20261120` / `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `release/nortago-order-only-20261120` / `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | [#136 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44721352568) | success |
| #14 | `fix/nortago-order-checkout-idempotency-20261120` / `f3a86754461b06b10250b073a38fae906bfd2777` | `fix/nortago-order-plan-snapshot-20261120` / `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | [#138 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725160805) | failure — Vercel build-rate limit |
| #15 | `fix/nortago-order-release-scope-20261120` / `e16260f8147e3b55255be6bf5163a32774abe280` | `fix/nortago-order-checkout-idempotency-20261120` / `f3a86754461b06b10250b073a38fae906bfd2777` | [#140 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725624942) | failure — Vercel build-rate limit |
| #16 | `chore/nortago-order-scope-smoke-dedupe` / `db3e6a43edc4edc4d3338504d87da11163594e42` | `fix/nortago-order-release-scope-20261120` / `e16260f8147e3b55255be6bf5163a32774abe280` | [#141 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44740771154) | success |
| #17 | `feature/nortago-order-owner-inbox` / `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `fix/nortago-order-release-scope-20261120` / `e16260f8147e3b55255be6bf5163a32774abe280` | [#143 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44741038747) | success |

The exact PR workflow-run associations and job endpoints were re-fetched. PR #16/#17 specifically reconfirm Run #141/#143 PASS. The Vercel status targets for #14 and #15 resolve to the provider's build-rate-limit page; GitHub Actions is green on both exact commits.

### Related security/release PRs

| PR | Current head SHA | Exact CI | Vercel |
|---|---|---|---|
| #18 | `03ac27ceb0d268826c2b76e49808a923786d9e13` | [#191 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44832208699) | success |
| #26 | `99ca6c1b461ef267789a6eecf9ed18807b75a9f5` | [#216 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44881451219) | success |
| #28 (this evidence PR) | `e52b1084441f23435a00bd6aa492af00ec399b5b` | [#260 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45008523867) | success |
| #30 | `751a307185dd99cd8842bc5cd54a4a3ad8352f8e` | [#250 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44960942102) | success |

Both CI jobs (production build and PostgreSQL migrations/replay/smoke) were fetched and passed for these exact heads. PR #28's previous exact-head CI Run #259 was superseded; Run #260 is the current exact head at this refresh.

### Lifecycle privilege review — migration-source and disposable-CI evidence

- Core migration `20260928_otc_commerce_core_v1.sql` enables RLS and has business-membership `FOR ALL` policies on `otc_orders`; these policies do not validate lifecycle transitions or audit writes. Core migration does not itself grant table DML.
- PR #18 lifecycle migration `20261120_nortago_order_lifecycle_rpc_v1.sql` defines SECURITY DEFINER `nortago_update_order_status`, authenticates with `auth.uid()`, checks membership and outlet/business relationship, locks the order, validates allowed transitions, updates status and appends audit. It does not install a trigger enforcing RPC-only status mutation.
- PR #26 CI explicitly simulates table-level and status-column client DML grants before applying hardening. Its baseline test proves a direct authenticated status UPDATE can bypass lifecycle audit under that simulated grant/policy setup.
- PR #26 migration `20261121_nortago_order_rpc_only_write_privileges_v1.sql` revokes table and explicit column DML on order headers/items from PUBLIC, anon and authenticated, then restores authenticated SELECT and replaces broad write policies with business-scoped SELECT. The regression test asserts direct mutations are rejected, approved lifecycle RPC still advances status, exactly one audit row is appended, and payment_status stays unchanged.
- PR #30's `POS_INTEGRATED` scope guard rejects POS alongside Dine-In and STAFF_WALK_IN; CI verifies online Take Away is allowed and excluded legacy POS cannot lifecycle-advance.

This is migration-source and disposable PostgreSQL CI evidence. Effective grants/role inheritance, RLS, function ownership, auth identity and real tenant behavior in Supabase staging/live remain unverified.

### Release gates remain open

Browser UAT (customer checkout-to-receipt and owner lifecycle/audit), real staging effective grants/RLS/auth/tenant validation, delivery fee/courier decision, payment-before-fulfillment policy, commercial sign-off and production rollback/release approval remain outstanding. No merge, production deploy, staging/live migration, payment/webhook activation, secrets/environment change or destructive action. LinkBayar remains disabled; Dine-In/Reservation/Walk-In/POS/queue/tables/seating/capacity/sessions/Control Tower/BOS remain excluded from Order release scope.
