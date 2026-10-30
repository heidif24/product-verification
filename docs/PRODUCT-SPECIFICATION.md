# Product specification

## Manufacturer portal
- Company registration, contact and facility details; verification / approval workflow.
- Product catalogue with brand, category, image, packaging and relevant regulatory identifiers.
- Production batches: batch reference, facility, production date, expiry and quantity.
- Bulk per-unit identity issuance with quantity checks, progress, retry safety and export manifest.
- QR asset exports (CSV, SVG, PDF, ZIP); short-lived download links.
- Staff roles, scan analytics, suspicious-activity alerts and audit history.

## Consumer app (Android and iOS)
- QR scanner and manual code entry.
- Plain-language result, product details and batch information where available.
- Optional scan history, optional account sync and suspicious-product reporting.
- Optional location at scan time, with clear explanation; verification works without it.

## Public verification page
- Opens from any ordinary camera app; no app installation or account required.
- Same core verification result as mobile app.
- Never expose internal risk rules, private manufacturer data or raw token values.

## Admin operations
- Review manufacturer applications, roles and account status.
- Review consumer reports and identity alerts.
- Quarantine, release or revoke with reason and immutable audit trail.

## Explicit exclusions from initial MVP
Carton/pallet aggregation, NFC, blockchain, AI counterfeit prediction, ERP integrations, payments and automatic NAFDAC/SON validation.
