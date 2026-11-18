# NORTAGO — Final Pricing & Staging Change Specification

Status: proposed launch price for CT BOS staging validation; NORTAGO Order prices retained.
Scope: public pricing presentation and commercial specification only. This does not activate billing or change database catalogue rows.

## 1. Product separation
- CT BOS NORTAGO: Business Operating System subscription, billed per business/package.
- NORTAGO Order: standalone digital ordering subscription, billed per outlet.
- Keep both catalogues, invoice references, and entitlement checks separate.

## 2. CT BOS launch prices

| Package | Monthly | Annual | Annual saving | Limits |
|---|---:|---:|---:|---|
| STARTER | IDR 249,000 | IDR 2,490,000 | IDR 498,000 (16.7%) | 1 outlet, 5 users |
| BUSINESS | IDR 649,000 | IDR 6,490,000 | IDR 1,298,000 (16.7%) | Up to 3 outlets, 15 users |
| PRO | IDR 1,299,000 | IDR 12,990,000 | IDR 2,598,000 (16.7%) | Multi-outlet, 50 users |

Annual billing equals ten monthly payments (two months free) and is prepaid. These are proposed launch prices for market validation, not evidence-backed willingness-to-pay results.

Package scope:
- STARTER: Sales & transactions, basic Procurement, basic Finance.
- BUSINESS: Sales, Procurement, Finance, Approval & Control, Owner Control Tower.
- PRO: Full BOS, Priority Support, Control & Intelligence.

The package limits and entitlements shown publicly must be enforced in application logic before commercial launch.

## 3. NORTAGO Order (retained approved price)

| Period | Price | Billing unit |
|---|---:|---|
| Monthly | IDR 50,000 | Per outlet |
| Annual | IDR 500,000 | Per outlet |

Annual saving is IDR 100,000 (16.7%) versus 12 monthly payments. Each outlet has a separate invoice, subscription period, and entitlement. Payment is prepaid/manual; no automatic recurring charge is assumed.

## 4. Implementation and onboarding
Quote implementation and onboarding separately after a needs assessment. Do not invent or imply a fixed fee. The quote should scope outlet count, data migration, configuration, role setup, integrations, training, and go-live.

## 5. Staging changes
1. Replace old CT BOS monthly prices (IDR 499k / 999k / 1.999m) with the launch prices above.
2. Add Bulanan/Tahunan selector. Annual mode displays total annual price, effective monthly equivalent, and 16.7% saving.
3. Preserve the current package feature lists and capacity descriptions.
4. Explain that implementation/onboarding is quoted separately after assessment.
5. Add a distinct NORTAGO Order panel showing IDR 50k/outlet/month or IDR 500k/outlet/year and link to its separate subscription flow.
6. Do not change NORTAGO Order checkout API or database prices; existing Order code uses IDR 50,000 and IDR 500,000 plan codes.
7. Do not enable production collection or describe the launch prices as market-validated before pilot interviews and conversion tests.

## 6. Acceptance and release gates
- CT BOS monthly/annual UI values match its server-side catalogue and invoice amount source before billing activation.
- NORTAGO Order remains billed per outlet with separate invoices.
- Verify the authenticated subscription page and its database-backed plan rows; the public landing page is not the billing source of truth.
- Confirm implementation fee quote workflow and entitlement limits.
- Test mobile layout at 360px–430px widths and confirm no horizontal overflow.
- Keep staging separate from production; this change does not authorize merge or production release.

## 7. Commercial validation
Interview at least three target businesses: single-outlet UMKM, growing multi-outlet, and established multi-outlet. Test price acceptance, objections, preferred billing period, paid-pilot conversion, onboarding effort, and support load. Revisit pricing after 5–10 qualified sales conversations.
