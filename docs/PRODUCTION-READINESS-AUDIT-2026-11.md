# PAN Production Readiness Audit — 21 November 2026

## Release decision

**NO-GO for public production launch or paid manufacturer onboarding.**

The repository has a solid product foundation, and this branch adds meaningful barcode, verification and lifecycle hardening. However, the live deployment footprint is not yet a production system. Several critical controls require implementation, and the external production services are not provisioned.

This is an engineering review of the repository and the connected Vercel project. It is not an independent penetration test, privacy/legal opinion, physical packaging-line test or production infrastructure certification.

## Scope reviewed

- Manufacturer registration, workspace, roles, facilities, documents, products, batches, wallet, issuance and Code Studio.
- Super-administrator authentication, company approvals, wallet administration, documents, reports, privacy requests, audit and identity actions.
- Consumer verification API, public verification website, manual code lookup, consumer reports and mobile scanner.
- Prisma data model, token issuance, HMAC digests, encrypted exports, storage signing, payment verification, audit chain, retention job and CI workflows.
- Connected Vercel project metadata, environment-variable inventory and deployment/build results.

## Improvements implemented in this branch

- Added the versioned `PAN1:` payload and Data Matrix ECC200 label generation to the manufacturer Code Studio, including preview, ZIP artwork and print-ready PDF output.
- Updated the consumer mobile scanner to read Data Matrix and legacy QR codes and interpret PAN1 payloads through the existing server verification endpoint.
- Added first-party browser scanning for PAN1 Data Matrix and legacy QR codes on the public verification website; manual PAN code lookup remains available.
- Retained legacy QR URL and PANU/PANC manual verification for already-issued identities.
- Retired the legacy direct-issuance API route with HTTP 410 and removed the old direct QR issuance UI path. New issuance is routed through the asynchronous, encrypted Code Studio workflow.
- Removed unknown-token database event creation and made scan metrics depend on a valid first-party scan-session identifier. Verification responses now return the database-backed scan count.
- Added manufacturer batch recall and guarded super-administrator lifecycle transitions for quarantine, release, revoke, recall, block, destroy and cancel. Consumer verification now distinguishes recalled, blocked, destroyed and cancelled identities.
- Added security response headers to the manufacturer and verification web applications and production-build checks for the required API URL.
- Made the mobile app fail closed when a production API URL is missing.
- Fixed API TypeScript issues found by CI and aligned Next.js layout child types.
- Added smoke-test coverage for retired issuance, anonymous scan accounting, batch recall and terminal lifecycle transitions.
- Added a PAN1 barcode protocol and print/security specification.

## Findings and remaining release blockers

### Critical — must close before production

1. **Production services are not provisioned.** The connected Vercel account has a manufacturer-web project, but it is marked `live: false`, has no custom domain, has no listed environment variables, and its default Vercel domains are SSO-protected. There is no separate verification-web Vercel project. The production API, managed PostgreSQL, private object store and transactional email service are not provisioned in the reviewed deployment configuration.
2. **Browser authentication tokens remain in `sessionStorage`.** This leaves manufacturer and administrator bearer tokens accessible to JavaScript in the page. Implement a same-origin BFF or secure HttpOnly/Secure/SameSite session design, CSRF protection and revocation tests before onboarding real manufacturers.
3. **Super-admin access is a single shared environment-based credential.** Add named operator accounts, MFA (preferably WebAuthn or TOTP), recovery controls and per-operator audit trails.
4. **Document uploads have no malware scanning/quarantine stage.** File signatures and private storage are useful controls, but they do not replace scanning before documents are exposed to reviewers.
5. **Rate limiting is process-local.** Use a shared store (for example Redis) and configure trusted-proxy handling before running multiple API instances. Current scan-session deduplication is a telemetry control, not proof against deliberate cloning or fraud.
6. **Issuance worker supervision needs a distributed lease/heartbeat.** The worker is in-process and uses stale-job recovery. Before horizontal scaling, add a renewable job lease or move processing to a dedicated queue/worker with safe restart and duplicate-processing tests.
7. **Payment operations need a verified Paystack webhook path.** The current user-return verification path is useful, but production settlement must also handle signed provider webhooks, retries and idempotent crediting.
8. **Retention and privacy workflows are incomplete.** The retention job is a skeleton and is not scheduled. Privacy requests are collected but require identity verification, operational ownership, completion evidence and deletion/retention execution.
9. **Dependency installation is not reproducible yet.** The main branch has no committed `pnpm-lock.yaml`; CI and Vercel use `--no-frozen-lockfile`. Generate and commit the workspace lockfile, then require frozen installs.

### High — complete before broad launch

- Finish runtime DTO/input validation and add abuse-focused tests for all public and administrative endpoints.
- Add duplicate-company registration checks backed by a database uniqueness constraint after reviewing existing data.
- Add alert delivery for suspicious scan activity, failed worker jobs, payment failures and storage errors.
- Add backup/restore verification, centralised exception monitoring, uptime alerts and a named on-call owner.
- Add load/concurrency tests for issuance, wallet debits, worker restarts, carton/unit reconciliation and public verification.
- Review all role combinations and tenant-isolation boundaries with automated negative tests.
- Complete an independent threat model and penetration test, then remediate and retest.

### External — required for market readiness

- Provision managed PostgreSQL with TLS, encrypted backups and point-in-time recovery.
- Deploy the NestJS API and issuance worker as a supervised long-running service.
- Provision private S3-compatible storage with encryption, least-privilege credentials and lifecycle policies.
- Provision transactional email and verify SPF, DKIM and DMARC.
- Create separate production hosting projects for manufacturer-web and verification-web, configure production domains, API URL, CORS allowlist and all secrets.
- Create/link the Expo EAS project, produce signed production builds and complete physical Android/iOS testing.
- Conduct Nigerian NDPA/privacy review; the current privacy notice and terms pages are drafts and must not be treated as approved legal documents.
- Complete a physical label pilot across printer types, label materials, sizes, lighting, damaged labels and low-cost Android cameras.

## Verification evidence at audit time

- The manufacturer Vercel preview initially failed on React type incompatibility and then on the Data Matrix package import. The branch was updated to use the browser-specific BWIP package and shared React namespace types. The latest preview build was still pending at the time this report was written; a successful build is not claimed here.
- A previous Android workflow run reached and passed API typecheck and Prisma deployment after an earlier syntax repair, but was cancelled before the full smoke and emulator journey completed.
- The full CI suite for the latest branch head, including API smoke, manufacturer web, public verification web and mobile typecheck, still needs a completed green run.
- No physical-device, printer, load, independent security or production restore test has been performed in this audit.

## Go-live acceptance gate

Do not merge and deploy to real manufacturers until all of the following are evidenced:

- [ ] Committed lockfile and frozen dependency installs.
- [ ] Green CI on the final commit: API typecheck/build, Prisma migration, API smoke, both web typechecks/builds and mobile typecheck.
- [ ] Green Android emulator journey and physical Android/iOS scan tests for PAN1 Data Matrix and legacy QR.
- [ ] Successful manufacturer and public-verifier production builds with correct production API configuration.
- [ ] Production API, database, worker, object storage, SMTP, domains, secrets, CORS and monitoring live.
- [ ] HttpOnly browser sessions/CSRF, super-admin MFA, malware scanning and distributed rate limiting implemented and tested.
- [ ] Signed Paystack webhook settlement and idempotency tested in provider test mode and live mode.
- [ ] Retention/privacy operations scheduled and exercised.
- [ ] Independent penetration test and remediation sign-off.
- [ ] Counsel-approved privacy notice and terms.
- [ ] Packaging-line pilot and operational acceptance sign-off.

**Bottom line:** PAN is progressing towards a deployable release candidate, but the current state must remain a development/preview release. A green web build alone would not make it market-ready.
