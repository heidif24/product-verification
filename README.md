# Product Authentication Network (PAN)

A product identity and verification platform designed to give every individual product unit a secure digital identity.

## Applications

- **Manufacturer portal** — account creation, product catalogue, production batches, QR identity issuance and export.
- **Consumer mobile app** — Android/iOS QR scanning, manual code lookup and plain-language verification results.
- **Public verification website** — browser-based QR and manual-code verification without an account or app installation.
- **PAN API** — shared NestJS API and PostgreSQL data store. This is the platform backend, not a fourth user-facing application.

## Current implementation

The `feat/pan-functional-core` branch contains the first connected end-to-end vertical slice, with GitHub Actions typechecking all clients and running a PostgreSQL-backed API smoke test:

1. A manufacturer creates an account and a pending workspace.
2. The manufacturer signs in and manages products and production batches.
3. The manufacturer issues unique per-unit identities, with QR images and a CSV export.
4. A consumer scans the QR with a phone camera or enters the printed PAN ID.
5. The API checks the identity record and returns a consumer-facing result.
6. Manufacturer approval is required before an identity is described as normally verified.

The dashboard at the root of the manufacturer app remains a visual prototype using illustrative data. The working manufacturer console is at `/portal`.

## Local development

- Node.js 20.11+
- pnpm 9.15.4
- Docker Desktop / Docker Engine

See [Getting started](docs/GETTING-STARTED.md) and [API setup](apps/api/README.md). Never commit secrets or real consumer data.

## Important limitations

This is an MVP development build, not a production-ready anti-counterfeiting certification service. Email verification/recovery, full administrator console, identity quarantine/revocation controls, rate limiting, audit review, large asynchronous issuance, deployment configuration, security testing and Nigerian NDPA review remain outstanding. A PAN QR identity confirms a database record, not the physical contents, product quality, or NAFDAC/SON approval.
