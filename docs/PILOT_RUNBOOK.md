# TJSL Impact Control Tower — Pilot Runbook

## Pilot scope
Pilot Cohort #1: 3 Mitra Binaan with existing daily transactions.

Objective: capture real operating data without artificially changing transaction behavior, then connect activity data to verified outcomes and an auditable impact calculation.

## Roles
- OWNER: Company/TJSL coordinator. Executive oversight and report approval.
- PROGRAM_MANAGER: Program operations and verification.
- PARTNER: Mitra Binaan representative.
- STAFF: Operational data entry where assigned.

## Pilot sequence
1. Create one TJSL Program.
2. Register the 3 Mitra Binaan.
3. Assign authenticated users to the correct roles/partners.
4. Record baseline outcome indicators before/at pilot start.
5. Connect or enter real daily transaction data.
6. Capture supporting evidence for each material outcome.
7. Submit evidence for verification.
8. Approve financial proxies only after methodology/source/assumption review.
9. Run Estimated SROI only when the SROI Gate passes.
10. Generate the Executive Impact Report.

## Minimum data per Mitra Binaan
- Business name
- Owner/contact
- Address
- Baseline period
- Baseline transaction count and/or turnover where appropriate
- Outcome definition
- Indicator and unit
- Evidence source
- Follow-up measurement period

## Evidence rule
NO EVIDENCE -> NO VERIFIED OUTCOME -> NO VERIFIED SROI.

Transaction value is activity/economic data. It is not automatically social impact. Outcome and impact claims require defined indicators, evidence, and appropriate attribution/adjustment assumptions.

## SROI rule
The application produces an ESTIMATED SROI based on configured methodology inputs. Proxy, deadweight, attribution, displacement and drop-off are assumptions/parameters that must be documented. The application does not treat transaction nominal as automatically equal to social value.

## Pilot acceptance checklist
- [ ] All 3 partners registered
- [ ] Role assignments tested
- [ ] Each partner can access only permitted data
- [ ] Real daily transactions are captured
- [ ] Outcome baseline recorded
- [ ] Evidence upload works
- [ ] Verification workflow works
- [ ] Unapproved proxy cannot pass the SROI Gate
- [ ] Unverified evidence cannot pass the SROI Gate
- [ ] Report approval is restricted to OWNER
- [ ] Audit trail is populated
- [ ] Monthly evaluation/report reviewed with coordinator

## Known staging/security note
Supabase security advisor currently reports only the Auth warning auth_leaked_password_protection: leaked-password protection is disabled. Enable it in Supabase Auth settings before treating the environment as production-ready.

The current Railway deployment is intended for pilot/staging use, not a claim of full production readiness.
