# RBAC E2E — Staging Results

Date: 2026-09-19
Environment: Supabase staging project `tjsl-impact-control-tower`

## Auth identities

- OWNER: owner@test.nortago.id — present
- PROGRAM_MANAGER: manager@test.nortago.id — present
- PARTNER: partner-a@test.nortago.id — present
- STAFF: staff@test.nortago.id — present

## Scope fixture

- Company: NORTAGO TJSL Staging Test Company
- Program A: Program A — Staging
- Program B: Program B — Staging
- Partner A: Mitra A — Staging
- Partner B: Mitra B — Staging
- Partner C: Mitra C — Staging
- Program Manager scoped to Program A
- Partner and Staff scoped to Partner A

## Simulated authenticated RLS checks

These checks use PostgreSQL role `authenticated` plus the test user's JWT subject claim in a transaction. They validate the RLS policy behavior without exposing passwords or access tokens.

| Role | Programs visible | Partners visible | Transactions visible | Result |
|---|---:|---:|---:|---|
| OWNER | 2 | 3 | 3 | PASS |
| PROGRAM_MANAGER (Program A) | 1 | 2 | 2 | PASS |
| PARTNER (Partner A) | 0 | 1 | 1 | PASS |
| STAFF (Partner A) | 0 | 1 | 1 | PASS |

Expected isolation:
- Manager cannot see Program B.
- Partner A cannot see Partner B/C.
- Staff cannot see Partner B/C.
- Owner sees all staging fixture rows.

## Important limitation

This is an authenticated PostgreSQL/RLS simulation, not a browser sign-in test using real access tokens. A final application-level login/API E2E should still be executed before pilot.

## Security note

Supabase Security Advisor currently reports one Auth warning: leaked-password protection is disabled. Enable leaked-password protection in Supabase Auth settings before production/pilot.

## Status

RBAC/RLS policy behavior: PASS
Application-level authenticated login E2E: PENDING
Security Advisor: 1 Auth warning remaining
