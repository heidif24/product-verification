# System architecture

## Three user-facing products, one backend

1. Manufacturer web workspace (Next.js)
2. Consumer mobile app (Expo / React Native, iOS and Android)
3. Public verification website (Next.js, no sign-in required)

The NestJS API is shared platform infrastructure, not a fourth user-facing app. PostgreSQL is the source of truth.

## Implemented platform stack

- TypeScript monorepo: pnpm workspaces + Turborepo
- Manufacturer workspace and super-admin console: Next.js App Router
- Public verification: Next.js App Router
- Consumer mobile: Expo / React Native and Expo Camera
- API: NestJS modular monolith
- Data: PostgreSQL + Prisma
- Background issuance: PostgreSQL-backed job table and API worker; no Redis dependency for the current MVP
- Transactional email: SMTP adapter
- Private documents: S3-compatible object storage with presigned uploads/downloads
- Authentication: bcrypt password hashes, email verification, single-use password reset tokens, short-lived super-admin JWT
- API protections: database membership revalidation, role checks, Helmet headers, CORS allow-list and request throttling

## Manufacturer and operations journey

Producer registration -> email verification -> pending workspace -> company profile and facilities -> private document submission -> PAN review and approval -> product catalogue -> production batch -> Code Studio -> asynchronous carton and unit identity issuance -> QR artwork, CSV manifest and print-ready PDF -> public/mobile verification.

Company workspaces have Owner, Admin, Operator and Analyst roles. A separate super-admin console reviews producer workspaces and documents, manages identity state and handles privacy requests. Privileged actions require reasons and create audit records.

The manufacturer root route (/) redirects to the live manufacturer workspace (/portal). No illustrative dashboard, sample company, fake scan count or hard-coded demo activity is served as a user-facing route.

## Identity hierarchy

- Individual unit: PANU-… code and its own QR token.
- Outer carton: PANC-… code and its own QR token.
- A carton identity links to the unit identities packed inside it. The system supports creating both levels together or creating carton codes later for previously issued, unassigned units.
- Batch quantity and carton configuration are checked before jobs are accepted. Issuance writes carton and unit identities transactionally.
- Bearer URLs are encrypted at rest in the temporary export payload and expire after 48 hours to the job creator or workspace administrators.

Manufacturers remain responsible for applying each generated QR label to the correct physical packaging. PAN generates digital identity and print assets; it does not print, apply or inspect labels.

## Trust boundaries and security

The API owns producer permissions, product identities and verification decisions. Every authenticated API request rechecks that the user still belongs to the workspace and uses the current database role. Removing a user or changing their role therefore takes effect on the next request.

QR tokens use 256 bits of cryptographically secure randomness. The identity table stores keyed HMAC digests, not raw tokens. Export payloads use AES-256-GCM encryption and expire after 48 hours. Private company documents use presigned S3 URLs, content-type and file-signature checks, and short expiry.

## Verification semantics

A successful result means the code maps to an active identity issued under the named producer's PAN workspace. It does not independently prove that the physical object was made by that producer. QR codes can be copied. PAN does not test contents, quality, safety, packaging integrity or regulatory status.

Statuses distinguish active identity, previously scanned, producer pending, under review, revoked, not recognised and unavailable. A network failure is never presented as proof of counterfeiting. Regulatory identifiers supplied by a producer are clearly labelled as producer-provided and not verified by PAN.

## Privacy and operational boundaries

Public verification does not require a consumer account or precise location. The platform records the identity result and time, not continuous consumer location. Public consumer concern reports feed a super-admin review queue. A public privacy request form and super-admin request queue support access, correction, deletion, restriction and objection requests; identity verification is required before disclosure or action.

The current privacy and terms pages are drafts. Before production, PAN must complete Nigerian data-protection/legal review, determine NDPA/NDPC registration and audit obligations, document retention and lawful bases, assess cross-border hosting and complete a DPIA where required.

## Production release gates

Production hosting and secret management, SMTP and private S3 credentials, malware scanning of uploaded documents, full browser/device acceptance testing, independent penetration testing, disaster recovery, privacy/legal approval and a formal incident-response process remain launch gates. A preview deployment is not a production release.
