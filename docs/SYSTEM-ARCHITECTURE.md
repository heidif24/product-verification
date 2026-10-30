# System architecture

## Three products, one platform
1. Manufacturer web portal (Next.js)
2. Consumer mobile app (Expo / React Native, iOS and Android)
3. Public verification web (Next.js, no sign-in required)

All three use a versioned API. The backend is a modular monolith for the first release, not premature microservices.

## Proposed stack
- TypeScript monorepo: pnpm workspaces + Turborepo
- Web: Next.js App Router
- Mobile: Expo / React Native
- API: NestJS
- Data: PostgreSQL; Redis + BullMQ for asynchronous issuance jobs
- Object storage: private S3-compatible storage with short-lived signed downloads
- Authentication: provider adapter; Supabase Auth is a candidate implementation
- Hosting: Vercel for web surfaces; managed Node/container runtime for API and workers

## Trust boundaries
The API is authoritative for manufacturer permissions, product identities and verification status. Never expose service-role keys or internal fraud rules to clients. Enforce tenant isolation in API services and database policy/constraints.

## Product identity
Generate an opaque, cryptographically random token (192–256 bits recommended). QR codes contain only a public verification URL with that token. Store a keyed hash/HMAC for lookup; do not use sequential IDs or expose database keys. Issuance must be transactional, unique and idempotent.

Manufacturers generate and export QR assets; they arrange their own printing and packaging. PAN is not a label printer.

## Verification
Possible results: verified / no known issue, repeat scan, under review, quarantined or revoked, not recognised, and temporarily unavailable. A network failure must never be described as proof of counterfeiting. A valid QR confirms an identity record, not the physical contents or regulatory approval.

## Fraud signals
Repeated scans are not proof of counterfeiting. Evaluate time, coarse location confidence, distinct devices, frequency and impossible travel patterns. GPS is optional, noisy and consent-based; never continuously track consumers. High-risk identities may be temporarily quarantined with reason, human review and audit history.

## Data domains
Users, manufacturers, memberships, facilities, documents, products, production batches, product identities, issuance jobs/exports, append-only verification events, fraud alerts, consumer reports, audit logs and notifications.
