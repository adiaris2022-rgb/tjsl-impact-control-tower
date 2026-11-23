# NORTAGO ORDER — Release-first verification snapshot

**Refresh:** 23 Nov 2026, 12:30 WIB  
**Scope:** Order-only. This snapshot is documentation evidence only; no merge, deployment, Supabase staging/live migration, payment/webhook activation, secrets/environment change, or destructive operation.

## Primary release PRs — exact refs and CI

Fresh GitHub PR metadata, commit-associated workflow runs, and combined commit statuses were retrieved for PR #1/#12–#17. Each is open, draft, unmerged, and mergeable. The workflow run was associated with the exact current head commit; both build and PostgreSQL jobs passed (7/7 runs, 14/14 jobs).

| PR | Head SHA | Base SHA | CI | Vercel |
|---|---|---|---|---|
| [#1](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/1) | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `545f4953368d0e85d7573c609bf4abf96b041c80` | [#69 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44665343539) | success |
| [#12](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/12) | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | [#183 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44810763148) | success |
| [#13](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/13) | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | [#136 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44721352568) | success |
| [#14](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/14) | `f3a86754461b06b10250b073a38fae906bfd2777` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | [#138 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725160805) | failure — Vercel build-rate limit |
| [#15](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/15) | `e16260f8147e3b55255be6bf5163a32774abe280` | `f3a86754461b06b10250b073a38fae906bfd2777` | [#140 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725624942) | failure — Vercel build-rate limit |
| [#16](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/16) | `db3e6a43edc4edc4d3338504d87da11163594e42` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#141 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44740771154) | success |
| [#17](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/17) | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#143 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44741038747) | success |

PR #16/#17 Run #141/#143 were explicitly rechecked, and their build and PostgreSQL jobs completed successfully. #14/#15 are CI-green; their Vercel provider status is the rate-limit failure.

## Related exact-head release/security PRs

| PR | Exact head SHA | CI | Vercel |
|---|---|---|---|
| [#18 lifecycle RPC](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/18) | `03ac27ceb0d268826c2b76e49808a923786d9e13` | [#191 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44832208699), 2 jobs | success |
| [#26 RPC-only DML](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/26) | `99ca6c1b461ef267789a6eecf9ed18807b75a9f5` | [#216 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44881451219), 2 jobs | success |
| [#28 evidence docs](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/28) | `103257a9f6c5b0f06e4230146399818a0228c743` | [#265 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45060475590), 2 jobs | success |
| [#30 POS scope guard](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/30) | `751a307185dd99cd8842bc5cd54a4a3ad8352f8e` | [#250 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44960942102), 2 jobs | success |
| [#31 hourly pagination](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/31) | `c58c841b11ef35a0a6c82ef2bc4d351681c82edb` | [#254 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44967453458), 2 jobs | success |
| [#32 privilege completeness](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/32) | `de479e6b7c5bbb9cbf6b4097e0b067a49ad65cb4` | [#266 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45101492048), 2 jobs | success |
| [#33 status RPC-owner guard](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/33) | `09eea46dfb5926ccf0508d73e379c44fa0901868` | [#268 PASS](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45113627096), 2 jobs | success |

For #33 exact-head Run #268, job inspection confirms:
- Production build and Owner Inbox/summary pagination unit tests passed.
- PostgreSQL migration apply/replay, lifecycle security, RPC-only privilege checks, inherited-status privilege guard, audit RLS/append-only, edge transitions, paid-order lifecycle, Order-only scope, checkout idempotency, and tenant-isolation checks all passed.

## Lifecycle security evidence

- The baseline OTC business-membership `FOR ALL` policy did not itself validate status transitions or append audit.
- CI reproduces a direct status UPDATE bypass under simulated client DML grants before hardening.
- PR #26 revokes direct table and explicit column mutation privileges from client roles while retaining scoped reads.
- PR #33 adds a server-side trigger that compares the executing role to the SECURITY DEFINER lifecycle RPC owner, rejecting direct status changes even when CI models inherited column UPDATE privilege and a narrow UPDATE policy.
- The PR #33 regression asserts the rejected direct update leaves the order NEW and emits no audit; approved `nortago_update_order_status` advances status, writes exactly one audit, and leaves `payment_status` unchanged.

**Boundary:** PostgreSQL CI is disposable. Supabase staging/live effective grants, role inheritance, auth identities, function ownership, tenant/outlet role behavior, and real RLS are still unverified.

## Release gates

Customer/Owner browser UAT on exact preview SHA; read-only staging security and tenant verification; delivery fee/courier responsibility; owner-approved payment-before-fulfillment policy; commercial sign-off and rollback approval remain open. Checkout is order submission, not payment settlement. LinkBayar remains disabled.

No merge, production deployment, Supabase staging/live migration, payment/webhook activation, secrets/environment changes, or destructive actions. Scope remains Order-only; BOS is deferred until Order is live and stable.

## Fresh verification and release-stack topology — 23 Nov 2026, 15:22 WIB

### Exact current refs rechecked
PR #1/#12/#13/#14/#15/#16/#17 remain Open, Draft, Unmerged, and Mergeable. Commit-associated CI runs and combined statuses were fetched again for each exact head. No CI changes: all 7 workflow runs and 14 jobs PASS. PR #16 Run #141 and PR #17 Run #143 were rechecked and are exact-head PASS. Vercel remains success on #1/#12/#13/#16/#17 and build-rate-limit failure on #14/#15.

### Important branch-topology finding
The green PR #1/#12–#17 chain does not contain all later security/release work. Compare endpoints confirm:
- PR #26 RPC-only security head is 82 commits ahead of PR #15 head.
- PR #26 base branch `fix/nortago-order-pagination-release-base-18` is 8 commits ahead of PR #18 lifecycle head, 0 behind; this security stack includes later lifecycle/pagination work.
- PR #30 stacks on PR #26 and adds the POS-integrated source guard.
- PR #31 stacks on PR #30 and adds Owner pagination/hourly aggregation.
- PR #33 stacks on PR #30 and adds the status RPC-owner guard; it is a sibling to #31, so #31 alone does not contain that guard and #33 alone does not contain #31's pagination.

### New consolidated draft candidate
- [PR #34 — paginated release stack with lifecycle status guard](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/34)
- Base exact SHA: `c58c841b11ef35a0a6c82ef2bc4d351681c82edb` (PR #31 head)
- Head exact SHA: `9372fbaabb710e09504d8036a7a2a2eeca969ed0`
- Contains PR #26 RPC-only DML hardening, PR #30 Order-only POS source guard, PR #31 pagination, and PR #33 status-owner trigger + CI regression (migration apply/replay and test).
- PR #34 remains Draft/Open/Unmerged. CI workflow has not yet been returned for this newly created head; Vercel is pending. Do not claim this consolidated candidate passes until exact-head CI completes.

### Staging boundary
All current security proofs are disposable PostgreSQL CI. Actual Supabase staging effective grants, inherited role membership, RLS, function ownership, auth identities, tenant/outlet behavior, and browser UAT are still unverified. No staging/live migration or deployment was performed.
