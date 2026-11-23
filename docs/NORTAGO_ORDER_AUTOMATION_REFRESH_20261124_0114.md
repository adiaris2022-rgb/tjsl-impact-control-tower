# NORTAGO ORDER — Exact PR/CI Recheck & Staging Security Audit Checklist
**Refresh:** 2026-11-24 01:14 WIB  
**Scope:** Commercial NORTAGO ORDER only; no BOS, Dine-In, Reservation, Walk-In, queue, tables/seating/capacity, sessions, or Control Tower.

## 1. Exact current PR metadata and CI

All seven PRs are Open, Draft, Unmerged, and Mergeable. Current heads/bases were refreshed from GitHub PR metadata. Commit-associated Actions runs were fetched for each exact head; both workflow jobs (production build and PostgreSQL migration/replay/smoke) are completed-success for every run.

| PR | Head SHA | Base SHA | Actions run | Run conclusion | Vercel |
|---|---|---|---|---|
| [#1](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/1) | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | `545f4953368d0e85d7573c609bf4abf96b041c80` | [#69](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44665343539) | PASS (2/2) | Success |
| [#12](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/12) | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | `a75820a8ca6d14c3f92fd3dfcfb9821f28429843` | [#183](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44810763148) | PASS (2/2) | Success |
| [#13](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/13) | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | `a323dcdedb5fd1048d9d2b2e3560c6ced889789c` | [#136](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44721352568) | PASS (2/2) | Success |
| [#14](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/14) | `f3a86754461b06b10250b073a38fae906bfd2777` | `c0a5e75cf9a8964848ad00aa4b5d57d1753140a6` | [#138](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725160805) | PASS (2/2) | Provider rate-limit failure |
| [#15](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/15) | `e16260f8147e3b55255be6bf5163a32774abe280` | `f3a86754461b06b10250b073a38fae906bfd2777` | [#140](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44725624942) | PASS (2/2) | Provider rate-limit failure |
| [#16](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/16) | `db3e6a43edc4edc4d3338504d87da11163594e42` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#141](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44740771154) | PASS (2/2) | Success |
| [#17](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/17) | `7516e1b22d5cd340b872db4bc516471a81ef74d4` | `e16260f8147e3b55255be6bf5163a32774abe280` | [#143](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/44741038747) | PASS (2/2) | Success |

**Fresh verification:** 7/7 commit-associated runs PASS, 14/14 jobs PASS. PR #16 Run #141 and PR #17 Run #143 were specifically rechecked. Vercel #14/#15 rate limits are not GitHub Actions failures.

## 2. Consolidated release candidate

PR [#34](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/pull/34) is Draft/Open/Unmerged:
- Head `e2793462c6e297f36cf77ef83a4b6309dca923e`
- Base `c58c841b11ef35a0a6c82ef2bc4d351681c82edb`
- [Run #284](https://github.com/adiaris2022-rgb/tjsl-impact-control-tower/actions/runs/45156977713) PASS, 2/2 jobs.
- Merge-checkout evidence: commit `76293b085fa2fb0dc0b319418b266da8a54ecdd9`; checkout message explicitly names PR head and base above.

## 3. Lifecycle status security — source findings

### Baseline
Migration `20260928_otc_commerce_core_v1.sql` creates `otc_orders`, RLS, and business-membership staff `FOR ALL` policy. Policy alone is not lifecycle transition enforcement. The rollback-only baseline test intentionally simulates client DML grants and proves a direct `UPDATE status` could change `NEW` to `PROCESSING` without lifecycle audit.

### RPC
`20261120_nortago_order_lifecycle_rpc_v1.sql` defines `nortago_update_order_status(uuid,text,text)` as SECURITY DEFINER. It validates `auth.uid()`, business role, outlet/business relationship, row-locks the order, validates fulfillment-specific transitions, updates status and writes audit. It never mutates payment_status. Authenticated can execute; anon/public cannot.

### Client DML hardening
`20261121_nortago_order_rpc_only_write_privileges_v1.sql` revokes table and explicit column DML from public/anon/authenticated on order headers/items, restores authenticated SELECT, and replaces broad manage policies with business-scoped read policies. Regression checks table and column privileges, RLS enabled, read policies, RPC SECURITY DEFINER and execute grants.

### Defense-in-depth trigger
`20261123_nortago_order_status_rpc_owner_guard_v1.sql` creates a SECURITY INVOKER trigger for status changes. It resolves lifecycle RPC owner and rejects a changed status when `current_user` is not that owner. CI rollback test temporarily grants inherited `UPDATE(status)` and creates a narrow RLS UPDATE policy, proving direct writes are rejected with `NORTAGO_ORDER_STATUS_RPC_ONLY`, status and audit unchanged, while the approved RPC succeeds and emits exactly one audit row.

**Security limitation:** owner comparison is a trusted-role guard, not exclusive caller-function identity. Any additional SECURITY DEFINER writer owned by the same trusted owner could potentially pass this trigger. A strict single-RPC guarantee would require a dedicated trusted owner boundary or another owner-reviewed mechanism; do not guess or change database ownership in staging/production.

### Actual staging remains unverified
CI uses disposable PostgreSQL. It does not prove effective grants, role inheritance, BYPASSRLS, auth, trigger state, function owner, or applied migrations on Supabase staging.

## 4. Read-only Supabase staging audit SQL

Run only in an approved, read-only SQL console after staging access is explicitly available. These queries inspect state; they do not change privileges or schema.

### Role attributes
```sql
select rolname, rolsuper, rolbypassrls, rolinherit, rolcreaterole, rolcreatedb
from pg_roles
where rolname in ('anon','authenticated','service_role','postgres');
```

### Inherited role membership (transitive)
```sql
with recursive memberships(role_oid, depth, path) as (
  select m.roleid, 1, array[m.roleid]
  from pg_auth_members m
  where m.member = (select oid from pg_roles where rolname='authenticated')
  union all
  select m.roleid, memberships.depth + 1, memberships.path || m.roleid
  from pg_auth_members m
  join memberships on m.member = memberships.role_oid
  where not m.roleid = any(memberships.path)
)
select distinct pg_get_userbyid(role_oid) as inherited_role, depth
from memberships
order by depth, inherited_role;
```

### Effective table and status-column grants
```sql
select role_name,
       has_table_privilege(role_name,'public.otc_orders','select') as can_select,
       has_table_privilege(role_name,'public.otc_orders','insert') as can_insert,
       has_table_privilege(role_name,'public.otc_orders','update') as can_table_update,
       has_table_privilege(role_name,'public.otc_orders','delete') as can_delete,
       has_table_privilege(role_name,'public.otc_orders','truncate') as can_truncate,
       has_any_column_privilege(role_name,'public.otc_orders','insert') as any_column_insert,
       has_any_column_privilege(role_name,'public.otc_orders','update') as any_column_update,
       has_column_privilege(role_name,'public.otc_orders','status','update') as status_update
from (values ('anon'),('authenticated'),('service_role')) as r(role_name);
```

### Actual RLS policies
```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public' and tablename in ('otc_orders','otc_order_items')
order by tablename, policyname;
```

### Trigger enabled state and definitions
```sql
select c.relname as table_name, t.tgname, t.tgenabled, t.tgfoid::regprocedure as trigger_function,
       pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='otc_orders' and not t.tgisinternal
order by t.tgname;
```

### Lifecycle RPC owner, security mode, ACL, config and definition
```sql
select p.oid::regprocedure as function_signature,
       pg_get_userbyid(p.proowner) as function_owner,
       p.prosecdef as security_definer,
       p.proacl as function_acl,
       p.proconfig as function_config,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
where p.oid=to_regprocedure('public.nortago_update_order_status(uuid,text,text)');
```

### Effective RPC execute
```sql
select role_name,
       has_function_privilege(role_name,'public.nortago_update_order_status(uuid,text,text)','execute') as can_execute
from (values ('anon'),('authenticated'),('service_role')) as r(role_name);
```

### Migration tracking table discovery (do not assume a table name)
```sql
select schemaname, tablename
from pg_tables
where schemaname not in ('pg_catalog','information_schema')
  and tablename ilike '%migration%'
order by schemaname, tablename;
```

## 5. Release-readiness evidence

CI tests/docs cover checkout-to-receipt, idempotency, tenant/outlet isolation, per-outlet subscriptions, owner pagination, lifecycle transitions/audit, direct mutation rejection, and Order-only scope. These are CI evidence, not customer UAT.

Pending commercial gates: actual staging audit, customer browser UAT, owner browser UAT, delivery/courier responsibility and fee decision, payment-before-fulfillment policy, rollback/recovery, commercial acceptance.

## 6. Safety boundaries

No merge, production deployment, Supabase staging/live migration, payment/webhook activation, secrets/environment changes, or destructive action without explicit user approval. LinkBayar remains disabled. NORTAGO ORDER only; BOS deferred until Order is live and stable.
