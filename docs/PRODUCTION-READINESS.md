# PAN production-readiness and release gates

This checklist distinguishes implemented application workflows from the infrastructure, credentials, testing and approvals required to operate PAN for real producers and consumers. A successful Vercel build or an Android debug APK is not, by itself, a production release.

## Current verified state

- The repository contains the manufacturer workspace, public verification website, consumer Expo app and NestJS API.
- The manufacturer root route redirects to the API-backed workspace. The former sample dashboard with fictional company details, hard-coded user information, invented scan totals and fake activity has been removed from the user-facing route.
- The API has PostgreSQL/Prisma migrations, an asynchronous issuance worker, email adapter, private S3-compatible document storage adapter and readiness endpoint.
- GitHub Actions runs API smoke tests, TypeScript checks, web builds and an Android emulator journey.
- The Vercel account currently has a linked `manufacturer-web` project only. Its environment-variable list is empty, its deployment is a preview rather than production, and preview deployments are protected by Vercel SSO.
- No production API host, managed production database, production object-storage bucket, SMTP account, public PAN domain or production secrets have been configured in the connected deployment environment.
- The repository does not yet contain a committed `pnpm-lock.yaml`; CI and the Vercel install command currently permit lockfile regeneration. Commit and review the resolved lockfile, then switch CI and Vercel to frozen installs before production.
- Privacy notice and platform terms are explicitly drafts pending Nigerian legal review.

## Infrastructure required

| Component | Production requirement |
| --- | --- |
| API and issuance worker | Long-running Node/NestJS service with HTTPS ingress, health checks, graceful shutdown and worker supervision. The issuance worker currently runs inside the API process; do not deploy it to an ephemeral function-only host without redesigning the worker. |
| Database | Managed PostgreSQL, TLS required, automated encrypted backups, point-in-time recovery and a tested restore procedure. |
| Document storage | Private S3-compatible bucket, public access blocked, encryption at rest, least-privilege credentials, lifecycle rules and malware scanning/quarantine. |
| Transactional email | Verified sender domain, authenticated SMTP credentials, SPF/DKIM/DMARC, delivery monitoring and tested verification/reset templates. |
| Web hosting | Separate production deployment for the manufacturer workspace and public verification site, each with the production API URL configured. |
| Mobile distribution | Expo/EAS project, production API URL, Android signing and Play Console release process; Apple Developer account and signing for iOS. |
| Domain and TLS | PAN-owned domain and DNS records for the manufacturer portal, public verifier and API. |
| Operations | Centralised logs, exception monitoring, uptime/health alerts, incident runbook, dependency updates and access review. |

## API production environment

Set these as secrets/environment variables on the API host; never commit real values:

- `DATABASE_URL`: managed PostgreSQL connection string containing `sslmode=require`.
- `JWT_SECRET`, `TOKEN_PEPPER`, `ADMIN_API_KEY`: three different random secrets, each at least 32 characters.
- `EXPORT_ENCRYPTION_KEY`: 32 random bytes encoded as 64 hexadecimal characters.
- `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD_HASH`: named operations mailbox and bcrypt hash; never use a plain-text password.
- `PUBLIC_VERIFY_URL` and `MANUFACTURER_APP_URL`: exact HTTPS URLs for the public verifier and manufacturer portal.
- `CORS_ORIGINS`: comma-separated exact HTTPS origins for those web applications; no wildcard.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`: verified transactional mail configuration.
- `PRIVACY_CONTACT_EMAIL`: monitored privacy mailbox.
- `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; optionally `S3_ENDPOINT` for a compatible provider and `S3_FORCE_PATH_STYLE` where required.

The API now refuses to start in production when required secrets, HTTPS URLs, TLS database configuration, exact CORS origins, SMTP or private storage settings are missing or invalid.

## Web and mobile environment

- Manufacturer and public verification Next.js deployments both require `NEXT_PUBLIC_PAN_API_URL`, set to the API base URL including `/api`.
- EAS builds require `EXPO_PUBLIC_PAN_API_URL` set to the same HTTPS API base URL. The emulator-only `10.0.2.2` address is not a public or physical-device endpoint.
- Configure separate Preview and Production values. Do not point production apps at local, test or preview databases.
- Vercel preview protection should remain enabled. Configure the production custom domains and public-access policy deliberately before inviting external users.

## Security, privacy and operational sign-off

Before onboarding real manufacturers:

1. Replace browser token storage with an HttpOnly, Secure, SameSite session/BFF design and test CSRF/session revocation.
2. Add malware scanning and quarantine for uploaded documents; test private-bucket access and signed-link expiry.
3. Implement documented retention and deletion jobs for verification events, documents, exports, privacy requests and account data.
4. Complete independent threat modelling and penetration testing, including tenant isolation, role escalation, QR token abuse, rate limits and administrative actions.
5. Run issuance load/concurrency/restart tests at the expected volume; verify idempotency, job recovery and carton-to-unit reconciliation.
6. Complete Nigerian legal/privacy review under the NDPA 2023 and NDPC GAID, including controller/processor roles, DPIA where required, cross-border transfer safeguards, DCPMI classification/registration obligations, retention, notices and contracts.
7. Replace the draft privacy notice and terms with counsel-approved versions and publish the real legal entity, support and privacy contacts.
8. Test database backup restoration, disaster recovery, incident response and alert escalation.
9. Conduct a physical packaging-line pilot for label placement, QR print quality, scan reliability, tamper-evident packaging and carton/unit matching.

## Release acceptance

A production release is approved only when all of the following pass on production-like infrastructure:

- CI typecheck, API smoke, manufacturer web build, public verification build and Android emulator end-to-end test are green.
- Real producer registration, email verification, sign-in, password reset, company profile, facility/document upload and team roles work end to end.
- Super-admin review, document decisions, identity quarantine/release/revocation and audit history work with least privilege.
- Bulk unit/carton issuance is tested for uniqueness, quantity limits, retry/recovery and exports.
- The same issued identity verifies consistently through the public website and a physical Android device on a mobile network.
- Consumer reports and privacy requests are delivered to a monitored operations queue and have a documented response process.
- Production backups, monitoring, alerts, support contacts and incident procedures are active.
- Legal, security and packaging-pilot owners have signed off.

A PAN result means a code maps to an active digital identity in a producer workspace. It must never be described as proof of physical origin, contents, quality, safety, NAFDAC registration, SON certification or government endorsement.
