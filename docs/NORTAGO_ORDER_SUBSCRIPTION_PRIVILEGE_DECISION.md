# NORTAGO ORDER — Subscription privilege decision

## Finding

The subscription migrations create six RLS-enabled tables:

- `subscription_plans`
- `outlet_subscriptions`
- `subscription_invoices`
- `subscription_payments`
- `subscription_events`
- `subscription_webhook_deliveries`

The connected Supabase PostgreSQL 17 project has no OTC application tables, so its creator-specific default ACLs are environment evidence, not effective grants on these six tables. The observed `postgres` creator defaults grant anon/authenticated/service_role `MAINTAIN`, `REFERENCES`, `TRIGGER`, and `TRUNCATE`, but do not grant SELECT or ordinary DML. RLS policies do not grant SQL privileges.

The repository callers were inspected before choosing grants:

- `app/otc/owner/subscriptions/page.tsx` directly reads `subscription_plans` and `outlet_subscriptions` with the authenticated Supabase client.
- `app/api/nortago/subscriptions/checkout/route.ts` uses service_role to read `subscription_payments.idempotency_key`, conditionally update `idempotency_key`, and update `provider_reference` / `provider_payload`.
- `app/api/nortago/subscriptions/webhook/route.ts` uses service_role to read payment lookup fields and the related invoice identifiers before calling the settlement RPC.
- `nortago_prepare_subscription_invoice` and `nortago_settle_subscription_payment` remain SECURITY DEFINER database-owned mutation paths. The latter remains service_role EXECUTE-only.

Without explicit SELECT grants, the Owner subscription page's direct reads fail under postgres-created table defaults. Without service_role column grants, the server checkout/webhook direct queries and retry metadata writes fail. Granting broad table-level DML to service_role would be unnecessary.

## Approved least-privilege contract implemented on this feature branch

| Table | anon | authenticated | service_role |
|---|---|---|---|
| `subscription_plans` | SELECT (active rows by RLS) | SELECT (active rows by RLS) | No direct table access |
| `outlet_subscriptions` | None | SELECT (OWNER/PROGRAM_MANAGER business RLS) | No direct table access |
| `subscription_invoices` | None | None | SELECT only `id, invoice_no, amount_idr, currency` |
| `subscription_payments` | None | None | SELECT only lookup/idempotency columns; UPDATE only `idempotency_key, provider_reference, provider_payload` |
| `subscription_events` | None | None | None |
| `subscription_webhook_deliveries` | None | None | None |

All roles lose inherited/default `TRUNCATE`, `REFERENCES`, `TRIGGER`, and PostgreSQL 17 `MAINTAIN` on these app-owned subscription tables. Existing RLS remains enabled. The migration fails closed if any expected table is absent, RLS is disabled, or the executor does not own the table. It does not change global/default ACLs.

The migration clears both table-level and existing column-level privileges before restoring the reviewed allowlist. This avoids stale column grants surviving a table-level REVOKE.

## Regression evidence

The disposable PostgreSQL 17 CI fixture now models Supabase `service_role BYPASSRLS` and verifies:

- anon/authenticated can read only active plan metadata;
- authenticated Owner reads only the outlet subscription allowed by the existing business-membership RLS policy;
- client roles cannot read invoice/payment/event/webhook tables or mutate payment state;
- service_role can execute the exact invoice/payment read and retry/reference update shapes used by the API routes;
- service_role cannot directly update payment status or invoice status;
- no client/server role retains unexpected TRUNCATE/REFERENCES/TRIGGER/MAINTAIN;
- the invoice preparation RPC remains authenticated-only and settlement RPC remains service_role-only;
- migration apply/replay is idempotent.

These are disposable CI results only. They are not effective-grant evidence for a populated Supabase staging database.

## Payment safety

This migration does not activate LinkBayar, payment checkout, webhook delivery, settlement, or any secret/environment value. Existing feature flags remain unchanged. The API routes still require their existing server configuration and explicit enablement. No real payment was created or verified.

## Staging gate

The connected project `NORTAGO-ORDER-STAGING` (`aakhinaryzidzpsjeewp`) has an empty public application schema and zero application migrations. The OTC core migration references a different project ref, `tdpupelhvzxwhbqnnlxk`, which is not accessible to the current connection. Do not apply this migration until the populated staging target is identified and separately approved.
