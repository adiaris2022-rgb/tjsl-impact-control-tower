# NORTAGO TJSL Impact Control Tower

Operational control tower for TJSL program monitoring, Mitra Binaan activity data, outcomes, evidence verification, financial proxies, Estimated SROI, and executive reporting.

## Pilot status

**Pilot Cohort #1: 3 Mitra Binaan with existing daily transactions.**

Current deployment is configured for staging/pilot use. The system is not being represented as fully production-ready until authentication, role-based UAT, storage/privacy controls, backup/restore, monitoring, and operational governance are tested.

## Core control chain

TJSL Program -> Mitra Binaan -> Transactions -> Outcomes -> Evidence -> Verification -> Financial Proxy -> SROI Gate -> Estimated SROI -> Executive Impact Report

### Evidence gate

NO EVIDENCE -> NO VERIFIED OUTCOME -> NO VERIFIED SROI.

Transaction data is activity/economic evidence. It is not automatically equivalent to social impact.

## Pilot runbook

See docs/PILOT_RUNBOOK.md for the field trial sequence, minimum data, role boundaries, acceptance checklist, and SROI methodology safeguards.

## Deployment

Railway tracks the main branch. The current pilot service uses a Railway-generated domain and /health as its healthcheck.

## Security note

Supabase currently reports one Auth warning: leaked-password protection is disabled. Enable leaked-password protection in Supabase Auth settings before production use.

## Attribution

Supported by NORTAGO.
