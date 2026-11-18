# NORTAGO — Final Pricing & Staging Change Specification

Status: user-approved commercial decision; staging implementation only.
Scope: public pricing presentation and commercial specification. This does not activate billing, modify database catalogue rows, or authorize production release.

## 1. Product separation
- CT BOS NORTAGO: Business Operating System subscription, priced by custom quotation based on assessed business scope.
- NORTAGO Order: standalone digital ordering subscription, billed per outlet.
- Keep both catalogues, invoice references, subscriptions, and entitlement checks separate.

## 2. CT BOS — custom quotation (approved)
CT BOS must not display fixed public package prices or invented Starter/Business/Pro price tiers.

Both payment periods are supported:
- Monthly subscription.
- Annual subscription.

The public landing page may let prospects select their preferred billing period, but must not calculate or imply a price before assessment.

The quotation is based on:
- Number of business outlets and users.
- Selected modules and required access/approval roles.
- Integrations and custom workflows.
- Data migration and initial configuration.
- Training, onboarding, operational support, and any agreed SLA.

The formal quotation must separate:
1. CT BOS subscription fee (monthly or annual, as quoted).
2. One-time implementation/onboarding fee, if applicable.
3. Optional integration, migration, training, or support scope.

No amounts are approved for CT BOS until the commercial assessment and quotation are completed. Do not seed or activate fixed CT BOS prices based on the prior unapproved proposal.

## 3. NORTAGO Order — retained approved price

| Period | Price | Billing unit |
|---|---:|---|
| Monthly | IDR 50,000 | Per outlet |
| Annual | IDR 500,000 | Per outlet |

Annual saving is IDR 100,000 (16.7%) versus 12 monthly payments. Each outlet has a separate invoice, subscription period, and entitlement. Payment is prepaid/manual; no automatic recurring charge is assumed.

## 4. Staging page requirements
1. Remove all fixed CT BOS tier names/prices and any price calculator based on those tiers.
2. Present CT BOS as custom quotation after business-scope assessment.
3. Provide Monthly and Annual as preferred billing-period choices only; do not display a numeric CT BOS amount.
4. Explain the assessment dimensions: outlets, users, modules, integrations, migration/configuration, training, and support/SLA.
5. Quote implementation/onboarding separately from the subscription.
6. Keep a distinct NORTAGO Order panel showing IDR 50,000/outlet/month and IDR 500,000/outlet/year, with its separate subscription route.
7. Do not change NORTAGO Order checkout API or database prices.

## 5. Billing and release gates
- The public landing page is informational and is not the billing source of truth.
- Verify the authenticated NORTAGO Order subscription page and its database-backed plan rows before payment activation.
- CT BOS quote acceptance, subscription records, invoicing, and entitlement enforcement require a separate approved commercial configuration.
- Keep LinkBayar disabled until Supabase staging, webhook, secrets, and payment tests pass.
- No Supabase migration, payment collection activation, production environment change, or production deployment is authorized by this pricing-page change.
- Keep PR in Draft until staging validation and explicit release approval.

## 6. Commercial validation
Use qualified prospect assessments to validate willingness to pay, preferred billing period, onboarding effort, support load, and paid-pilot conversion. Adjust the quote model only from documented customer evidence and explicit commercial approval.
