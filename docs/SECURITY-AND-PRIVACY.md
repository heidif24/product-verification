# Security, privacy and regulatory boundaries

## Product identity claims

- PAN checks whether a code maps to an active digital identity issued under a named producer's PAN workspace.
- A PAN match is not independent proof that the physical item was manufactured by that producer. A copied QR can be copied onto another object.
- PAN does not test product contents, safety, efficacy, quality, packaging integrity or supply-chain custody.
- PAN does not issue, validate or imply NAFDAC registration, SON certification or any other regulatory approval.
- Regulatory identifiers entered by a producer are labelled as producer-provided and not verified by PAN unless a documented, authorised regulator integration is implemented.
- PAN approval is an independent platform onboarding decision only.

## Identity security

- Generate opaque QR bearer tokens with a cryptographically secure random generator and at least 256 bits of entropy.
- Store keyed HMAC digests for token lookup, never raw QR bearer tokens in the ordinary identity table.
- Carton and individual-unit identities are distinct. Unit identities can be associated with a carton identity through a parent relationship.
- Newly issued identities begin as `GENERATED`. Retrieving an issuance export records an audit event and changes that job's identities to `EXPORTED`; a workspace operator must attest that print quality was checked before activating exported identities. Code Studio links to this activation page; printed and quality-checked are not yet separate persisted states.
- Bulk issuance is asynchronous, transactional and bounded by batch quantities and packaging configuration.
- Export payloads containing bearer URLs are encrypted at rest with AES-256-GCM and expire after 48 hours. Access is restricted to the job creator and workspace administrators.
- Wallet entries and audit rows are append-only at the database layer. New audit rows are serialized and HMAC-linked; complete protection against privileged database deletion requires an external immutable anchor that is not configured.
- Credit deductions are atomic with issuance-job creation. Failed worker jobs receive an idempotent refund. Paystack credits are applied only after the API verifies the provider reference, amount and currency.
- Web/mobile scan sessions are random and stored only as keyed HMAC digests. Refreshes in the same session do not create independent scans. Ten distinct sessions per identity/day trigger an investigation signal, not a counterfeit verdict. No location or device fingerprint is collected.
- Company, identity, wallet, activation, export and report decisions are audited with reasons; audit metadata coverage is still incomplete for less sensitive operations.

## Authentication and authorisation

- Manufacturer email verification is required before login; password reset uses single-use, expiring tokens.
- Super-admin authentication is separate from manufacturer authentication and uses a bcrypt password hash plus a short-lived JWT.
- Manufacturer membership and role are rechecked against the database on every authenticated API request; removing a member or changing a role takes effect on subsequent API calls.
- Manufacturer and super-admin browser access tokens are currently held in tab-scoped session storage. Before a production launch, prefer an HttpOnly, Secure, SameSite cookie/BFF session design to reduce token exposure to browser scripts.
- Roles: Owner, Admin, Operator, Analyst, Finance and Support. API permissions remain authoritative; Finance handles wallet operations and Support handles manufacturer report review.
- API throttling, Helmet security headers and strict CORS origins are enabled. A database-backed readiness endpoint is available for monitoring. Production must also use TLS, managed secrets, WAF/edge rate controls, database backups, monitoring and incident response.

## Documents and storage

- Company documents are stored in private S3-compatible object storage, not public URLs.
- Uploads use short-lived presigned PUT URLs; downloads use short-lived signed URLs.
- Accept only PDF/JPEG/PNG and limit uploads to 10 MB. The API checks file signatures; production should add malware scanning/quarantine before documents are made available to reviewers.
- Production bucket must block public access, enforce encryption at rest, restrict CORS to the manufacturer portal and use least-privilege credentials.

## Nigerian data protection

PAN processes company contact details, staff account data, facility addresses, documents, verification events and voluntary consumer report details (which may include a store, city/state, purchase date and contact email). It does not require consumer accounts, precise GPS location or device fingerprints to perform a product check. Define lawful basis, notices and retention for report fields before production.

Before launch, obtain advice from a Nigerian privacy professional on the Nigeria Data Protection Act 2023 and NDPC's General Application and Implementation Directive, including controller/processor role allocation and contracts; a privacy notice, lawful-basis assessment and data-subject rights process, including a monitored privacy contact and documented request verification; retention and deletion schedules, access controls and encryption; whether PAN qualifies as a Data Controller or Processor of Major Importance and any registration/audit-return obligations; DPIA requirements; breach response and notification timelines; and cross-border storage and transfer safeguards where hosting is outside Nigeria.

This document is an engineering baseline, not legal advice or a statement that PAN is already NDPC-compliant.
