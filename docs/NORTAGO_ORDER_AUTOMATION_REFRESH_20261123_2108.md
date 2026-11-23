# NORTAGO ORDER — Automation Refresh (23 Nov 2026, 21:08 WIB)

Scope: NORTAGO ORDER only. This is evidence documentation; it does not authorize merge, deployment, staging/live migration, payment/webhook activation, secret/environment changes, or destructive actions.

## Exact PR refs and CI recheck

Refreshed GitHub PR metadata and queried workflow runs plus combined commit statuses for PR #1, #12–#17. Then fetched the latest jobs for each run and verified both jobs (production build and PostgreSQL migration/smoke) completed successfully: 7/7 runs, 14/14 jobs.

| PR | Head SHA | Base SHA | Run | Vercel |
|---|---|---|---|---|
| [#1](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/1) | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `545f4953368d0e85d7573c609bf4abf96b041c80` | [#69 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44665343539) | success |
| [#12](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/12) | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | [#183 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44810763148) | success |
| [#13](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/13) | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | [#136 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44721352568) | success |
| [#14](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/14) | `f3a86754461b06b10250b073a38fae906bfd2777` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | [#138 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725160805) | failure: provider build-rate limit |
| [#15](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/15) | `e16260f8147e3b55255be6bf5163a32774abe280` | `f3a86754461b06b10250b073a38fae906bfd2777` | [#140 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725624942) | failure: provider build-rate limit |
| [#16](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/16) | `db3e6a43edc4edc4d3338504d87da11163594e42` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#141 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44740771154) | success |
| [#17](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/17) | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#143 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44741038747) | success |

PR #16/#17 were explicitly rechecked: Run #141 and Run #143 both show 2/2 completed-success jobs on their current exact head SHAs. All seven runs and jobs were fetched for this refresh.

## Consolidated release candidate PR #34

- PR: https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/34
- Head: `e2793462c6e297f36cf77ef83a4b6309dca923e`
- Base: `c58c841b11ef35a0a6c82ef2bc4d351681c82edb`
- [Run #284 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45156977713), both jobs completed successfully.
- Run metadata directly identifies exact head and base. The commit-associated workflow lookup for the head SHA returned no PR run entry; the run's own metadata and merge checkout prove the exact PR #34 head/base tested.
- Vercel combined status on exact head: success.

The migration job's successful steps include migration apply/replay, baseline direct-status bypass, RPC-only DML, status-owner guard, subscription, checkout, tenant isolation, lifecycle/audit, pagination, and scope regression checks. The build job ran Owner pagination unit tests and production build.

## Lifecycle security source audit

Fetched and inspected SQL source from the core, lifecycle, RPC-only write, and status-owner-guard branches:

- Core migration `20260928_otc_commerce_core_v1.sql` (blob `c41fd0ac9176bff25c6e8f0d89f20c2a19611748`): `otc_orders` RLS is enabled, but authenticated business-membership `FOR ALL` policy does not enforce lifecycle transitions.
- Lifecycle migration `20261120_nortago_order_lifecycle_rpc_v1.sql` (blob `c8ec896f911cf82ee129de4f9eaa7e026b7355fb`): SECURITY DEFINER RPC checks auth, role, business/outlet relationship, row locking, fulfillment-specific transition, status update, and audit in one transaction. This migration alone does not force direct status writes through the RPC.
- RPC-only write migration `20261121_nortago_order_rpc_only_write_privileges_v1.sql` (blob `1dc594f26775a65472821c5f64c796a3dac2b857`): revokes direct order/item table and explicit column DML from PUBLIC/anon/authenticated; restores authenticated SELECT with scoped policies.
- Status-owner guard migration `20261123_nortago_order_status_rpc_owner_guard_v1.sql` (blob `19c2007c40637e99688c8d1a79c67af96d932141`): SECURITY INVOKER trigger rejects changed status unless current_user matches lifecycle RPC owner.
- PR #33 rollback-only test (blob `229de9be89bfe0f60ad03fc8df86ca2bbfcd136e`) models inherited status UPDATE privilege plus narrow RLS, proves direct write denial/no audit and approved RPC success/one audit/payment status unchanged. The CI workflow precreates the helper role and simulates Supabase client grants before hardening.

Owner-comparison trigger is defense-in-depth, not exact caller-function identity. A same-owner SECURITY DEFINER writer could potentially bypass it; strict single-RPC enforcement would require a dedicated trusted function-owner boundary and owner-reviewed migration.

Actual Supabase staging effective grants, inherited role memberships, BYPASSRLS, auth, function owner, applied migrations, and tenant/outlet RLS remain unverified. Disposable PostgreSQL CI is not live staging evidence.

## Release gates

Checkout-to-receipt, tenant isolation, per-outlet subscription, owner pagination, lifecycle/security, and Order-only scope have automated disposable-CI evidence. Still pending: staging read-only audit, Customer and Owner browser UAT on exact preview SHA, delivery/courier responsibility, payment-before-fulfillment decision, rollback/recovery, and commercial acceptance.

No merge, staging/live migration, production deployment, payment/webhook activation, secrets/environment changes, or destructive action was performed. LinkBayar remains disabled; Order-only scope remains; BOS deferred until Order live/stable.
