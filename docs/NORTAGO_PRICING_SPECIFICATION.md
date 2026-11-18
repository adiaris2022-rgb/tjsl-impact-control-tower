# NORTAGO — Final Pricing & Staging Change Specification

Decision status: CT BOS launch-price recommendation selected for staging validation; NORTAGO Order prices retained.
Scope: public pricing page and commercial specification only. This document does not activate billing, change database catalog rows, or enable payment collection.

## 1. Commercial architecture

Keep two separately priced products:
- **CT BOS NORTAGO**: business operating system subscription, billed per business account/package.
- **NORTAGO Order**: standalone digital ordering subscription, billed per outlet.

Do not combine the two catalogues or use CT BOS package prices in NORTAGO Order invoices.

## 2. CT BOS launch price proposal

| Package | Monthly | Annual | Annual saving | Limits |
|---|---:|---:|---:|---|
| STARTER | IDR 249,000 | IDR 2,490,000 | IDR 498,000 (16.7%) | 1 outlet, 5 users |
| BUSINESS | IDR 649,000 | IDR 6,490,000 | IDR 1,298,000 (16.7%) | Up to 3 outlets, 15 users |
| PRO | IDR 1,299,000 | IDR 12,990,000 | IDR 2,598,000 (16.7%) | Multi-outlet, 50 users |

Annual amount is ten monthly payments (two months free); annual commitment is prepaid. CT BOS package prices are per business subscription, not per outlet, unless a later commercial amendment explicitly changes the billing unit.

### Included scope shown publicly
- STARTER: Sales & transactions, basic Procurement, basic Finance.
- BUSINESS: Sales, Procurement, Finance, Approval & Control, Owner Control Tower.
- PRO: Full BOS, Priority Support, Control & Intelligence.

The package feature lists and capacity limits are the current public offer; entitlement enforcement must be verified separately before paid launch.

## 3. Separate NORTAGO Order price (already approved)

| Period | Price | Billing unit |
|---|---:|---|
| Monthly | IDR 50,000 | Per outlet |
| Annual | IDR 500,000 | Per outlet |

Annual savings: IDR 100,000 (16.7%) versus twelve monthly payments. Each outlet receives a separate invoice, subscription period, and entitlement. Prepaid/manual renewal; no automatic recurring charge is assumed.

## 4. Implementation and onboarding

Implementation and onboarding are quoted separately after a needs assessment. Do not show a fabricated fixed fee or silently include implementation in recurring subscription prices. The quote should identify outlet count, data migration, configuration, role setup, integrations, training, and go-live scope.

## 5. Staging page changes

1. Replace legacy CT BOS prices (IDR 499k / 999k / 1.999m monthly) with the launch price proposal above.
2. Add Bulanan / Tahunan selector. Annual mode shows annual total, effective monthly equivalent, and 16.7% saving.
3. Preserve current package capacity and included feature descriptions; clarify that Business is recommended.
4. Add note: implementation/onboarding is separate and quoted after assessment.
5. Add a distinct NORTAGO Order panel showing IDR 50k/outlet/month or IDR 500k/outlet/year, with a separate subscription CTA.
6. Do not change Order subscription API pricing or database catalogue; existing Order backend already uses IDR 50,000 and IDR 500,000 plan codes.
7. Do not activate production billing or represent prices as validated market willingness-to-pay until pilot interviews and conversion tests are complete.

## 6. Billing and acceptance requirements

- CT BOS supports monthly and annual billing; annual equals 10x monthly.
- NORTAGO Order remains per-outlet with separate invoices.
- UI and server-side invoice/catalog amounts must match before enabling collection.
- Verify the authenticated subscription screen and its database-backed plan rows; the public landing page is not the billing source of truth.
- Confirm implementation fee quote workflow and entitlement limits.
- Test mobile layout at 360px–430px widths and verify no horizontal overflow.
- Keep staging deployment separate from production. No merge or production release is implied by this change.

## 7. Commercial validation gates

Before calling these prices validated:
- Interview at least 3 target businesses across small single-outlet, growing multi-outlet, and established multi-outlet segments.
- Test package comprehension, preferred billing cycle, price objections, and willingness to start a paid pilot.
- Record conversion to paid pilot, activation cost, onboarding effort, and support load.
- Review after the first 5–10 qualified sales conversations; adjust prices or limits only with evidence.
