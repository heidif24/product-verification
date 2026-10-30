# System architecture

## Three user-facing products, one backend

1. Manufacturer web portal (Next.js)
2. Consumer mobile app (Expo / React Native, iOS and Android)
3. Public verification web (Next.js, no sign-in required)

The NestJS API is the shared platform backend, not a fourth user-facing app. PostgreSQL is the source of truth. Redis is provisioned for the asynchronous issuance/export stage.

## Implemented MVP stack

- TypeScript monorepo: pnpm workspaces + Turborepo
- Manufacturer web: Next.js App Router
- Public verification: Next.js App Router
- Consumer mobile: Expo / React Native with Expo Camera
- API: NestJS modular monolith
- Data: PostgreSQL + Prisma
- QR rendering: server-generated PNG data URLs
- Auth: bcrypt password hashing + 12-hour JWT sessions
- Local infrastructure: Docker Compose PostgreSQL and Redis

## Current functional journey

Manufacturer registers -> pending workspace -> sign-in -> product catalogue -> production batch -> per-unit identity issuance -> QR/CSV export -> public web or mobile verification.

Manufacturer approval is an operator-only API action guarded by a separate API key. Pending manufacturers' identities are explicitly returned as pending, not as verified. Full administrator accounts and review UI are a later stage.

## Trust boundaries

The API owns manufacturer permissions, product identities and verification decisions. Never expose service credentials, JWT signing secrets, token HMAC pepper or internal risk rules to clients. Enforce tenant isolation in API queries.

## Product identity

Generate an opaque 256-bit random token. QR codes contain only a public verification URL with that token. Store a keyed HMAC-SHA256 digest for lookup; do not use sequential IDs or expose database keys. Manual product codes use 80 bits of random entropy. Issuance is persisted transactionally; large-scale async/idempotent job handling remains future work.

Manufacturers generate and export QR assets; they arrange their own printing and packaging. PAN is not a label printer.

## Verification

Results include verified/no known issue, previously scanned, manufacturer review pending, under review, revoked, not recognised and temporarily unavailable. A network failure must never be described as proof of counterfeiting. A valid QR confirms an identity record, not physical contents, product quality or regulatory approval.

## Fraud signals and privacy

Repeated scans are not proof of counterfeiting. Future risk review may consider time, coarse location confidence, distinct devices, frequency and impossible travel patterns. GPS is optional, noisy and consent-based; never continuously track consumers. Nigerian NDPA review is required before processing precise location/device signals.

## Remaining platform domains

Facilities, documents, multi-user invitations, admin review, audit logs, consumer reports, notifications, durable job queues, scan analytics, risk rules, object storage and regulator/ERP integrations remain planned.
