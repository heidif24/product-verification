# Delivery roadmap

## Delivered in the current development branch

- TypeScript monorepo, PostgreSQL/Prisma data model and CI.
- Manufacturer registration, email verification, login and password recovery.
- Company profile, facilities, private supporting-document upload and review status.
- Team invitations, Owner/Admin/Operator/Analyst roles and database-backed membership checks.
- Separate super-admin authentication and console for producer review, documents, identity actions, privacy requests and audit.
- Carton and individual-unit identity model with parent-child packaging relationship.
- PostgreSQL-backed asynchronous issuance worker, transactional writes, batch quantity guards and encrypted 48-hour export payload.
- Code Studio with QR PNG ZIP, CSV manifest and print-ready PDF labels.
- Public verification website, manual code lookup and consumer camera-scanning app.
- Consumer concern reporting, super-admin triage and producer-recorded expiry status.
- Privacy notice and terms drafts, plus data-subject request intake.

## Remaining before pilot

1. Complete production SMTP and private object-storage configuration.
2. Add malware scanning for uploaded company documents and formal retention/deletion jobs.
3. Finish browser-based acceptance tests and physical Android/iOS device tests.
4. Add load tests for 10,000+ identity jobs and worker restart/concurrency scenarios.
5. Complete independent threat modelling and penetration testing.
6. Obtain Nigerian legal/privacy review for NDPA 2023 and NDPC GAID, controller/processor roles, DCPMI classification, DPIA, data-subject handling and cross-border transfers.
7. Configure production hosting, secrets, backups, monitoring, alerting and incident response.
8. Run a packaging-line pilot to test QR print size, scan reliability, label placement, tamper-evident materials and carton-to-unit reconciliation.

## Acceptance tests

- Generate 10,000 unique unit identities and verify no duplicates.
- Generate carton identities with linked units; also test carton-only jobs that attach previously issued unassigned units.
- Simulate simultaneous issuance requests and verify batch quantity reservations cannot be exceeded.
- Restart a worker during issuance and confirm the job safely recovers without partial identity sets.
- Test copied QR scenarios and ensure the interface never claims that a scan alone proves physical authenticity.
- Test legitimate repeat scans, quarantine, release, revocation and manufacturer suspension.
- Test cross-manufacturer access isolation, role changes, removed memberships and expired JWTs.
- Test malformed tokens, rate limits, SMTP failures, storage upload signatures, expired export links and database outages.
