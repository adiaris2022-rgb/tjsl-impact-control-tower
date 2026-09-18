# TJSL Impact Control Tower — Authenticated RBAC E2E Test Plan

## Test identities
Create four staging-only Supabase Auth users:
- owner@test.nortago.id
- manager@test.nortago.id
- partner-a@test.nortago.id
- staff@test.nortago.id

Do not use production credentials.

## Scope fixture
Company C1
- Program A (P1)
  - Partner A (PA)
  - Partner B (PB)
- Program B (P2)
  - Partner C (PC)

Role assignments:
- OWNER -> C1
- PROGRAM_MANAGER -> P1
- PARTNER -> PA
- STAFF -> operational scope for PA

## Access tests

| ID | Actor | Resource | Expected |
|---|---|---|---|
| RBAC-01 | OWNER | Program A | ALLOW |
| RBAC-02 | OWNER | Program B | ALLOW |
| RBAC-03 | PROGRAM_MANAGER | Program A | ALLOW |
| RBAC-04 | PROGRAM_MANAGER | Program B | DENY |
| RBAC-05 | PARTNER A | Partner A | ALLOW |
| RBAC-06 | PARTNER A | Partner B | DENY |
| RBAC-07 | PARTNER A | Partner C | DENY |
| RBAC-08 | STAFF | permitted operational scope | ALLOW |
| RBAC-09 | STAFF | SROI/executive data | DENY |

## Data isolation tests
1. Attempt direct SELECT of another partner's transaction.
2. Attempt SELECT of another program's outcome.
3. Attempt SELECT of another partner's evidence.
4. Attempt access to another program's SROI calculation.
5. Attempt access to another program's executive report.

Every unauthorized request must return no accessible row / be rejected according to the API behavior.

## Business-flow E2E
1. Create/import OCT transaction.
2. Verify transaction lifecycle.
3. Record outcome and indicator.
4. Attach evidence.
5. Submit evidence.
6. Verify evidence by an authorized verifier who is not the submitter.
7. Configure financial proxy with source note.
8. Run SROI gate.
9. Calculate estimated SROI.
10. Generate executive impact report.
11. Verify audit trail contains the material events.

## Negative tests
- Duplicate transaction external_ref -> REJECT.
- Negative transaction amount -> REJECT.
- Invalid transaction status -> REJECT.
- Unverified evidence -> SROI BLOCKED.
- Self-verification -> REJECT.
- Cross-program data access -> DENY.
- Cross-partner data access -> DENY.

## Exit criteria
Authenticated RBAC E2E is PASS only when all mandatory access-boundary tests and negative tests pass. Until staging Auth identities exist, status remains BLOCKED — not PASS.
