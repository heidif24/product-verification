# Product Authentication Network (PAN)

PAN is a producer-linked product identity network. It issues unique digital identities for individual product units and outer cartons, and lets consumers check whether a scanned identity exists in the PAN network under the named producer's workspace.

## User-facing applications

- Manufacturer workspace: producer onboarding, company profile, facilities, private documents, team roles, product catalogue, batches and Code Studio.
- Consumer mobile app: QR scanning and manual identity lookup.
- Public verification website: browser verification without an account or app installation.
- Super administrator console: producer review, document review, identity oversight and audit trail.

The NestJS API and PostgreSQL database are shared infrastructure, not a fourth user-facing application.

## Product identity model

- Individual-unit identity (PANU-…) is a unique identity attached to one retail/product unit.
- Carton identity (PANC-…) is a separate identity attached to an outer carton. The carton record links to the individual-unit identities assigned to that carton.
- A carton and each unit have different QR codes and public identity records. The manufacturer or its packaging supplier applies the generated assets to the correct packaging level.
- Bulk issuance is queued in the API worker. Export payloads are encrypted at rest and have a limited retrieval window.
- Exports include QR PNGs, a CSV manifest and a print-ready PDF label sheet.

## What PAN says — and does not say

A successful PAN result means the code matches an active digital identity issued under the named producer's PAN workspace. It does not independently prove that the physical item was made by that producer, that the contents are genuine, safe or of a particular quality, or that the product is registered or approved by NAFDAC, SON or another regulator.

CAC, NAFDAC and SON references submitted by a producer are displayed as producer-provided information unless and until PAN has a genuine authorised validation integration. PAN approval is PAN's own onboarding decision, not government approval.

## Development and deployment

See Getting started, API setup, system architecture, and security and privacy documentation.

The current development branch is feat/pan-market-ready-operations. CI validates Prisma migrations, the API smoke journey, and TypeScript checks for the API, manufacturer portal, public verification website and consumer app. Production deployment, SMTP, private S3 storage, super-admin credentials, threat modelling and independent privacy/security review must be configured before public launch.
