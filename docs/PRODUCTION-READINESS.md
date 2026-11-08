# PAN production-readiness and release gates

This checklist distinguishes implemented application workflows from the infrastructure, credentials, testing and approvals required to operate PAN for real producers and consumers. A successful Vercel build or an Android debug APK is not, by itself, a production release.

> **Master actionable TODO:** See [`docs/PRODUCTION-TODO.md`](./PRODUCTION-TODO.md) for the complete, prioritised, checkable list of every remaining gap (infrastructure, security, privacy, mobile, acceptance and sign-off). That document is the living execution plan. This file remains the architectural and policy reference.

## Current verified state

- The repository contains the manufacturer workspace, public verification website, consumer Expo app and NestJS API.
- The manufacturer root route redirects to the API-backed workspace. The former sample dashboard with fictional company details has been removed.
- The API has PostgreSQL/Prisma migrations, an asynchronous issuance worker, email adapter, private S3-compatible document storage adapter and readiness endpoint.
- GitHub Actions runs API smoke tests, TypeScript checks, web builds and an Android emulator journey.
- Identity lifecycle enum now includes the full market set (`GENERATED`, `EXPORTED`, `PRINTED`, `QUALITY_CHECKED`, `ACTIVE`, `QUARANTINED`, `REVOKED`, `RECALLED`, `BLOCKED`, `DESTROYED`, `CANCELLED`) with migration.
- Retention job skeleton, incident-response and backup-restore runbooks, improved mobile release guidance, and NDPA-oriented privacy/terms drafts have been added under `docs/`.
- The Vercel account currently has a linked `manufacturer-web` project only. Its environment-variable list is empty, its deployment is a preview rather than production, and preview deployments are protected by Vercel SSO.
- No production API host, managed production database, production object-storage bucket, SMTP account, public PAN domain or production secrets have been configured in the connected deployment environment.
- Privacy notice and platform terms remain drafts pending Nigerian legal review.

## Gaps against the expanded product plan

These are launch blockers or scoped follow-up work; the current application is not production-ready solely because CI or a build passes. Track them in `PRODUCTION-TODO.md`.

- Identity lifecycle states are now modelled; UI/API transitions for recall, block, destroy and print/quality steps still need wiring where not already present.
- Wallet credits use an append-only, database-guarded ledger; live Paystack credentials/webhooks and final duplicate-company prevention still required before public sales.
- Web and mobile verification use random session IDs; only HMAC digests are stored. Geographic analysis, alert delivery, distributed rate-limit storage and long-term risk trends are not implemented.
- Consumer reports flow into manufacturer and platform queues; photo evidence upload and malware-scanning/quarantine are not implemented.
- New audit records form a serialized HMAC chain; older records remain unchained; external immutable anchoring is not configured.
- Browser access tokens remain in `sessionStorage`; super-admin has no MFA or independent per-operator account lifecycle. HttpOnly session/BFF design remains required.
- Document uploads lack malware scanning/quarantine. Retention job skeleton exists; production schedule and legal confirmation of periods still required.
- Finance and Support roles, wallet screens, manufacturer report/scan queues and super-admin pricing/risk screens are present. Product image upload and full recall UI remain incomplete.

## Infrastructure required

| Component | Production requirement |
| --- | --- |
| API and issuance worker | Long-running Node/NestJS service with HTTPS ingress, health checks, graceful shutdown and worker supervision. |
| Database | Managed PostgreSQL, TLS required, automated encrypted backups, point-in-time recovery and a tested restore procedure. |
| Document storage | Private S3-compatible bucket, public access blocked, encryption at rest, least-privilege credentials, lifecycle rules and malware scanning/quarantine. |
| Transactional email | Verified sender domain, authenticated SMTP credentials, SPF/DKIM/DMARC, delivery monitoring and tested verification/reset templates. |
| Web hosting | Separate production deployment for the manufacturer workspace and public verification site, each with the production API URL configured. |
| Mobile distribution | Expo/EAS project, production API URL, Android signing and Play Console release process; Apple Developer account and signing for iOS. |
| Domain and TLS | PAN-owned domain and DNS records for the manufacturer portal, public verifier and API. |
| Operations | Centralised logs, exception monitoring, uptime/health alerts, incident runbook, dependency updates and access review. |

See `docs/ops/` for incident and backup/restore runbooks.

## API production environment

Set these as secrets/environment variables on the API host; never commit real values. The API refuses to start in production when required secrets, HTTPS URLs, TLS database configuration, exact CORS origins, SMTP or private storage settings are missing or invalid.

(See the full list in `PRODUCTION-TODO.md` section 3 and the existing boot-time assertion in `apps/api/src/main.ts`.)

## Web and mobile environment

- Manufacturer and public verification Next.js deployments both require `NEXT_PUBLIC_PAN_API_URL`.
- Set manufacturer-web `NEXT_PUBLIC_PAN_VERIFY_URL` to the public verification website origin.
- Set store download URLs after each app is published.
- EAS builds require `EXPO_PUBLIC_PAN_API_URL` pointing at the production API.
- Configure separate Preview and Production values. Do not point production apps at local, test or preview databases.

## Security, privacy and operational sign-off

Before onboarding real manufacturers complete the items listed under sections 2 and 6 of `PRODUCTION-TODO.md`, including:

1. HttpOnly session/BFF design and CSRF/session revocation testing.
2. Malware scanning and quarantine for uploaded documents.
3. Documented retention and deletion jobs (skeleton present).
4. Independent threat modelling and penetration testing.
5. Issuance load/concurrency/restart tests.
6. Nigerian legal/privacy review under NDPA 2023 and NDPC GAID; publish counsel-approved notices.
7. Database backup restoration test, disaster recovery and incident response readiness.
8. Physical packaging-line pilot.

## Release acceptance

A production release is approved only when all items in the **Release acceptance** section of `PRODUCTION-TODO.md` pass on production-like infrastructure and the named owners have signed off.

A PAN result means a code maps to an active digital identity in a producer workspace. It must never be described as proof of physical origin, contents, quality, safety, NAFDAC registration, SON certification or government endorsement.
