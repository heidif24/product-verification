# PAN Production & Market Readiness — Master TODO

**Goal:** Take the Product Authentication Network from current development state to a production system that can onboard real Nigerian manufacturers and serve consumers safely, legally, and operationally.

This document is the single source of truth. Every critical gap identified in `PRODUCTION-READINESS.md` is turned into concrete, checkable work. Code-level items that can be completed in-repo are implemented in this branch. External items (hosting accounts, legal counsel, physical pilot, store accounts) have precise playbooks and GitHub issues.

**Status legend**
- [x] Completed in this branch / already present
- [ ] Remaining (owner + target date to be assigned)
- [EXT] External dependency (cannot be finished purely in code)

---

## 0. Branch & Process Hygiene (Completed in this PR)

- [x] Create dedicated branch `feat/production-market-ready`
- [x] Expand `IdentityStatus` enum with full lifecycle states + migration
- [x] Add retention / deletion job skeleton + documented schedule
- [x] Add ops runbooks (incident, backup/restore, on-call)
- [x] Improve mobile release & EAS production profiles
- [x] Add production environment variable templates and validation notes
- [x] Strengthen privacy notice / terms drafts with NDPA-oriented structure (still require counsel)
- [x] Update `PRODUCTION-READINESS.md` to point at this master TODO
- [x] Create GitHub issues for remaining external blockers

---

## 1. Infrastructure (Production Hosting)

### 1.1 Managed PostgreSQL
- [EXT] Provision managed PostgreSQL 16+ (Neon, Supabase, AWS RDS, or DigitalOcean) in a region with good latency to Nigeria (or multi-region if required).
- [EXT] Enable TLS (`sslmode=require`), automated encrypted backups, point-in-time recovery.
- [EXT] Document and test a full restore procedure (write the result into `docs/ops/BACKUP-RESTORE.md`).
- [ ] Set `DATABASE_URL` on the production API host with `sslmode=require`.
- [ ] Run all Prisma migrations against production (`pnpm --filter @pan/api db:deploy`).

### 1.2 API + Issuance Worker Host
- [EXT] Deploy the NestJS API as a long-running process (not ephemeral serverless only). Recommended: Railway, Render, Fly.io, or ECS/Fargate with health checks on `/api/health/ready`.
- [EXT] Ensure the issuance worker (currently in-process) has supervision and graceful shutdown. If moving to separate worker process later, extract it cleanly.
- [ ] Configure production secrets (see section 3).
- [ ] Confirm production boot assertion passes (API refuses to start if secrets/URLs/CORS/SMTP/S3 are invalid).

### 1.3 Private Object Storage
- [EXT] Create private S3-compatible bucket (AWS S3, Cloudflare R2, MinIO, etc.).
- [EXT] Block all public access, enable encryption at rest, least-privilege IAM credentials, lifecycle rules for old exports/documents.
- [ ] Configure `S3_*` environment variables.
- [ ] Test presigned upload + short-lived download URLs from the manufacturer portal.

### 1.4 Transactional Email
- [EXT] Provision SMTP (Resend, Postmark, Amazon SES, or similar) with a verified sending domain.
- [EXT] Configure SPF, DKIM, DMARC.
- [ ] Set `SMTP_*` and `MAIL_FROM`.
- [ ] Test registration verification, password reset, and invitation emails end-to-end.

### 1.5 Domains, TLS & Web Hosting
- [EXT] Register / configure PAN domain(s) (e.g. `pan.ng` or chosen brand).
- [EXT] Deploy manufacturer-web and verification-web as separate production Vercel (or equivalent) projects with production domains.
- [ ] Set `NEXT_PUBLIC_PAN_API_URL`, `NEXT_PUBLIC_PAN_VERIFY_URL`, store download URLs.
- [ ] Configure exact `CORS_ORIGINS` on the API (HTTPS origins only, no wildcards).
- [ ] Keep Vercel preview protection enabled; production domains public by design.

### 1.6 Observability & Operations
- [EXT] Centralised logging + exception monitoring (Sentry, Axiom, Logtail, etc.).
- [EXT] Uptime / health checks on `/api/health/ready` with alert routing.
- [x] Incident response runbook skeleton added (`docs/ops/INCIDENT-RESPONSE.md`).
- [x] Backup/restore runbook skeleton added (`docs/ops/BACKUP-RESTORE.md`).
- [ ] Assign on-call owner and escalation path.

---

## 2. Security & Privacy

### 2.1 Session / Token Storage
- [ ] Replace manufacturer and super-admin browser `sessionStorage` tokens with HttpOnly + Secure + SameSite cookies via a BFF or Nest session layer.
- [ ] Implement CSRF protection and session revocation testing.
- [x] Document the required design in `docs/SECURITY-AND-PRIVACY.md` (already present; implementation still required).

### 2.2 Super-Admin Hardening
- [ ] Add MFA (TOTP or WebAuthn) for super-admin accounts.
- [ ] Support multiple named operator accounts with individual audit trails instead of a single shared password.
- [ ] Document operator onboarding / offboarding.

### 2.3 Document & Evidence Security
- [ ] Integrate malware scanning (ClamAV sidecar, VirusTotal, or cloud provider scanning) before documents become visible to reviewers.
- [ ] Quarantine workflow for positive detections.
- [ ] Same treatment for any future consumer report photo evidence.

### 2.4 Retention, Deletion & Audit Integrity
- [x] Retention job skeleton and schedule documented (`apps/api/src/jobs/retention.job.ts` + docs).
- [ ] Implement scheduled jobs for:
  - Verification events older than policy window
  - Expired export payloads
  - Completed privacy requests after retention period
  - Soft-deleted / archived manufacturer data
- [ ] Backfill older audit records into the HMAC chain where feasible, or document the cut-off.
- [EXT] Optional external immutable anchoring (e.g. periodic hash to external store or blockchain) for stronger protection against privileged deletion.

### 2.5 Nigerian Data Protection (NDPA 2023 / NDPC)
- [EXT] Engage Nigerian privacy counsel.
- [EXT] Determine controller vs processor roles and any DCPMI registration obligations.
- [EXT] Complete DPIA if required.
- [EXT] Finalise lawful bases, retention schedules, cross-border transfer safeguards.
- [x] Improved privacy notice structure provided (still draft until counsel approves).
- [ ] Publish counsel-approved Privacy Notice and Terms with real legal entity, support and privacy contacts.
- [ ] Confirm `PRIVACY_CONTACT_EMAIL` is monitored and has a documented response SLA.

### 2.6 Independent Security Review
- [EXT] Threat modelling workshop (tenant isolation, role escalation, QR token abuse, rate limits, admin actions).
- [EXT] Penetration test by independent party.
- [ ] Remediate findings and re-test critical items.

---

## 3. Secrets & Environment Configuration

Production API must have (API already validates most of these at boot):

```
DATABASE_URL=...sslmode=require
JWT_SECRET=                 # ≥32 chars, unique
TOKEN_PEPPER=               # ≥32 chars, unique
AUDIT_HMAC_KEY=             # ≥32 chars, unique
EXPORT_ENCRYPTION_KEY=      # 64 hex chars (32 random bytes)
PAYSTACK_SECRET_KEY=
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASSWORD_HASH=  # bcrypt
PUBLIC_VERIFY_URL=https://...
MANUFACTURER_APP_URL=https://...
CORS_ORIGINS=https://...,https://...
SMTP_HOST= SMTP_PORT= SMTP_SECURE= SMTP_USER= SMTP_PASSWORD=
MAIL_FROM=
PRIVACY_CONTACT_EMAIL=
S3_REGION= S3_BUCKET= S3_ACCESS_KEY_ID= S3_SECRET_ACCESS_KEY=
# optional: S3_ENDPOINT, S3_FORCE_PATH_STYLE
```

Web / Mobile:
- `NEXT_PUBLIC_PAN_API_URL`
- `NEXT_PUBLIC_PAN_VERIFY_URL`
- `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL` / `NEXT_PUBLIC_IOS_DOWNLOAD_URL` (after store publish)
- EAS: `EXPO_PUBLIC_PAN_API_URL`

- [x] `.env.example` and production assertion already present and strict.
- [ ] Populate real values in the production secret store only (never commit).

---

## 4. Product Completeness (Code)

### 4.1 Identity Lifecycle (Implemented in this branch)
- [x] Expand `IdentityStatus` to: `GENERATED | EXPORTED | PRINTED | QUALITY_CHECKED | ACTIVE | QUARANTINED | REVOKED | RECALLED | BLOCKED | DESTROYED | CANCELLED`
- [x] Migration added.
- [ ] Wire UI and API transitions for the new states (print attestation already exists; extend for recall / destroy / block).
- [ ] Manufacturer and super-admin actions for recall and market withdrawal.

### 4.2 Wallet & Payments
- [x] Append-only ledger + transactional debit/refund already present.
- [ ] Verify live Paystack credentials and webhook signature handling in production.
- [ ] Harden duplicate-company / duplicate-payment prevention before public sales.

### 4.3 Scan Risk & Reporting
- [x] Session-hash based risk flagging present.
- [ ] Distributed rate-limit storage if running multiple API instances.
- [ ] Alert delivery channel (email/Slack) for elevated risk.
- [ ] Photo evidence upload + malware scan path for consumer reports.

### 4.4 Other
- [ ] Product image upload support (optional for v1).
- [ ] Full market / recall lifecycle screens.

---

## 5. Mobile Distribution

- [x] Android CI debug APK + emulator E2E already present.
- [x] EAS profiles improved in this branch.
- [EXT] Create Expo / EAS project and link the app.
- [EXT] Obtain Apple Developer Program membership for iOS.
- [ ] Produce signed production Android App Bundle / APK via EAS `production` profile.
- [ ] Produce signed iOS IPA / App Store build.
- [ ] Submit to Google Play and Apple App Store (or alternative distribution if preferred).
- [ ] Set real store URLs into `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL` and `NEXT_PUBLIC_IOS_DOWNLOAD_URL`.
- [ ] Physical device testing on multiple Android models + at least one iPhone under real mobile network conditions.

See `apps/consumer-mobile/RELEASE-AND-DEVICE-TESTING.md` (updated).

---

## 6. Acceptance, Load & Pilot

### 6.1 Automated Acceptance (CI already covers baseline)
- [x] Typecheck, API smoke, web builds, Android emulator journey.
- [ ] Add dedicated load / concurrency suite for 10 000+ identity issuance, worker restart recovery, and carton-unit reconciliation (can be a separate workflow or script).

### 6.2 Manual / Operational Acceptance
- [ ] Real producer registration → email verify → profile → facility → document → team roles on production infrastructure.
- [ ] Super-admin review, document decision, identity quarantine/release/revoke.
- [ ] Bulk issuance uniqueness, quantity limits, export retrieval, activation.
- [ ] Same identity verifies correctly on public website and physical Android device on mobile data.
- [ ] Consumer report and privacy request land in monitored queue with documented response process.

### 6.3 Packaging-Line Pilot [EXT]
- [EXT] Print real labels at intended size and substrate.
- [EXT] Measure scan reliability under warehouse / retail lighting.
- [EXT] Validate carton ↔ unit matching and tamper-evident application.
- [EXT] Document findings and any required changes to Code Studio or print assets.

### 6.4 Sign-off
- [EXT] Security owner sign-off after pen-test remediation.
- [EXT] Privacy / legal owner sign-off after NDPA review and published notices.
- [EXT] Operations owner sign-off after backup restore test and monitoring live.
- [EXT] Product / packaging owner sign-off after pilot.

Only when all of the above are checked may the system be declared production / market ready for real manufacturers.

---

## 7. Bottom Line & Recommended Sequence

**Current state (after this PR):** Strong application foundation + complete, actionable master plan + key code expansions (identity lifecycle, retention skeleton, ops docs, mobile release improvements). Still **not** production-ready until infrastructure, secrets, legal review, security testing, mobile store releases and physical pilot are completed.

**Recommended execution order**

1. **Week 0–1** — Provision infrastructure (DB, API host, S3, SMTP, domains) and wire secrets. Get the API + both web apps healthy on production URLs.
2. **Week 1–2** — Session/BFF work, malware scanning path, retention jobs, super-admin MFA design.
3. **Week 2–3** — Engage privacy counsel; start threat modelling / pen-test; begin EAS production builds and physical device tests.
4. **Week 3–4** — Packaging pilot, load tests, final acceptance checklist, counsel-approved legal pages.
5. **Go / No-Go** — Only after all [EXT] and remaining [ ] items above are green.

**Ownership suggestion**
- Engineering: sections 1 (code/config parts), 2.1–2.4, 3, 4, 5 (builds), 6.1–6.2
- Operations / DevOps: 1.1–1.6, monitoring, backup restore
- Legal / Privacy: 2.5 and published notices
- Security: 2.6
- Product / Manufacturing partners: 6.3 packaging pilot

Track remaining work via the GitHub issues created alongside this document. Update checkboxes in this file as items close.
