# NORTAGO ORDER — Fresh exact-head and security verification

**Refresh:** 23 Nov 2026, 20:11 WIB  
**Scope:** NORTAGO ORDER only. This evidence refresh does not authorize merge, production deploy, Supabase staging/live migration, payment/webhook activation, secrets/environment change, or destructive action.

## Primary PR metadata and exact commit CI

GitHub PR metadata was refreshed for PR #1, #12, #13, #14, #15, #16, and #17. All remain Open, Draft, Unmerged, and Mergeable.

Each exact current head commit was queried for PR-triggered workflow runs and combined status. The workflow run conclusion was success, and the latest run's two jobs were individually checked: both completed success for every PR (7/7 runs, 14/14 jobs).

| PR | Head SHA | Base SHA | CI | Vercel |
|---|---|---|---|---|
| [#1](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/1) | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `545f4953368d0e85d7573c609bf4abf96b041c80` | [#69 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44665343539) | success |
| [#12](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/12) | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | [#183 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44810763148) | success |
| [#13](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/13) | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | [#136 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44721352568) | success |
| [#14](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/14) | `f3a86754461b06b10250b073a38fae906bfd2777` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | [#138 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725160805) | failure — provider build-rate limit |
| [#15](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/15) | `e16260f8147e3b55255be6bf5163a32774abe280` | `f3a86754461b06b10250b073a38fae906bfd2777` | [#140 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725624942) | failure — provider build-rate limit |
| [#16](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/16) | `db3e6a43edc4edc4d3338504d87da11163594e42` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#141 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44740771154) | success |
| [#17](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/17) | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#143 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44741038747) | success |

PR #16/#17 runs #141/#143 were explicitly rechecked on their current exact head SHAs. Both jobs for each run—production build and PostgreSQL migrations/smoke—completed successfully. PR #14/#15 GitHub Actions CI passed; their Vercel combined status points to provider build-rate-limit failure, not CI failure.

## Additional release/security exact heads

| PR | Exact head SHA | CI | Vercel |
|---|---|---|---|
| [#18 lifecycle RPC](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/18) | `03ac27ceb0d268826c2b76e49808a923786d9e13` | [#191 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44832208699), 2/2 jobs | success |
| [#26 RPC-only write](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/26) | `99ca6c1b461ef267789a6eecf9ed18807b75a9f5` | [#216 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44881451219), 2/2 jobs | success |
| [#33 status owner guard](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/33) | `09eea46dfb5926ccf0508d73e379c44fa0901868` | [#268 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45113627096), 2/2 jobs | success |
| [#34 consolidated RC](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/34) | `e2793462c6e297f36cf77ef83a4b6309dca923e` | Run #284 jobs endpoint: 2/2 success; commit-associated run lookup returned no entry | success |
| [#28 release evidence](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/28) | `c081f0ac1b1581a96e8d3b4154bf84bd92c885f1` | [#287 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45163135747), 2/2 jobs | success |

For PR #34, the Run #284 jobs endpoint was inspected in detail. PostgreSQL job steps 1–42 covering migration apply/replay, direct-write bypass baseline, RPC-only privileges, status owner guard, subscription, lifecycle, tenant isolation, checkout idempotency and scope all completed success. The build job's pagination unit tests and production build also completed success. However, the commit-associated workflow-runs endpoint returned no run for the current head, so #284 is reported as successful job evidence but not independently confirmed as associated with this exact SHA.

PR #28 Run #287 was found through the exact commit workflow lookup; both jobs completed success and Vercel exact-head status was success.

## Lifecycle source audit

Migration source files were fetched from relevant branches and inspected, not inferred from policy names:

- Core OTC migration `20260928_otc_commerce_core_v1.sql`: RLS enabled. The authenticated business-membership `FOR ALL` order policy does not enforce status transition rules. The schema status check includes `NEW`, `PAID`, `SCHEDULED`, `PROCESSING`, `FULFILLMENT_CHECK`, `FULFILLMENT_ISSUE`, `READY`, `WAITING_PICKUP`, `PICKUP_VERIFIED`, `HANDED_OVER_TO_DELIVERY`, `SUCCESS`, and `PO_SUCCESS`.
- Lifecycle migration `20261120_nortago_order_lifecycle_rpc_v1.sql`: SECURITY DEFINER RPC checks auth, business role, outlet/business consistency, row lock, fulfillment-specific transitions, then updates status and appends audit transactionally. This migration alone does not install an RPC-only status trigger.
- RPC-only migration `20261121_nortago_order_rpc_only_write_privileges_v1.sql`: revokes table and explicit column INSERT/UPDATE/DELETE from PUBLIC/anon/authenticated on orders and items; restores authenticated SELECT and scoped read policies.
- Status-owner migration `20261123_nortago_order_status_rpc_owner_guard_v1.sql`: SECURITY INVOKER trigger rejects changed status unless current_user equals the lifecycle RPC owner. PR #33's rollback-only test models inherited UPDATE(status) plus narrow RLS, proves direct write rejection/no audit, and approved RPC success/one audit/payment_status unchanged.
- PR #18 changed-file inventory and PR #26/#33/#34 migration/test inventory were refreshed. CI simulates client grants before hardening to reproduce the baseline bypass; post-hardening smoke checks direct DML denial and supported RPC paths.

**Staging boundary:** Supabase staging/live effective grants, inherited role membership, BYPASSRLS, real auth identity, actual applied migration state, function ownership, and real tenant/outlet RLS are not accessible/verified in this run. Disposable PostgreSQL CI is not a substitute for staging.

## Release gates remain open

Exact preview-SHA customer and owner browser UAT, staging read-only privilege/RLS/auth audit, delivery/courier policy, payment-before-fulfillment decision, rollback/recovery, and commercial acceptance remain pending. No merge, deployment, staging/live migration, payment/webhook activation, secrets/environment change, or destructive action was performed. LinkBayar remains disabled; NORTAGO ORDER scope remains locked; BOS deferred until Order live and stable.
