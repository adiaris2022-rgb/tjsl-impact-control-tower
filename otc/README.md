# Legacy OTC app — disabled

This nested standalone Next.js app is retained only as legacy source history. It is not the commercial NORTAGO ORDER application and must not be deployed as a customer or owner transaction surface.

The root layout intentionally renders only a static disabled notice and does not render route children. This prevents the old mock checkout, hard-coded PAID receipt, sample Owner Control Tower metrics, and legacy reservation form from being presented as real product behavior.

The active NORTAGO ORDER implementation in this repository is the root application under `app/otc`, built from the root `package.json`.

Do not enable, deploy, or reconnect this legacy package without a separately reviewed migration and release plan.
