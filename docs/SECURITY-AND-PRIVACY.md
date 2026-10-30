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
- Bulk issuance is asynchronous, transactional and bounded by batch quantities and packaging configuration.
- Export payloads containing bearer URLs are encrypted at rest with AES-256-GCM and expire after 48 hours. Access is restricted to the job creator and workspace administrators.
- Every administrator state change requires a reason and creates an audit entry.
- Repeated scans are a risk signal, not proof of counterfeiting.

## Authentication and authorisation

- Manufacturer email verification is required before login; password reset uses single-use, expiring tokens.
- Super-admin authentication is separate from manufacturer authentication and uses a bcrypt password hash plus a short-lived JWT.
- Manufacturer membership and role are rechecked against the database for workspace operations; removing a member or changing a role takes effect on subsequent API calls.
- Roles: Owner, Admin, Operator and Analyst. Only Owner/Admin manage company details, facilities, documents and team; Operator can create products/batches and issue identities; Analyst has read access.
- API throttling, Helmet security headers and strict CORS origins are enabled. Production must also use TLS, managed secrets, WAF/edge rate controls, database backups, monitoring and incident response.

## Documents and storage

- Company documents are stored in private S3-compatible object storage, not public URLs.
- Uploads use short-lived presigned PUT URLs; downloads use short-lived signed URLs.
- Accept only PDF/JPEG/PNG and limit uploads to 10 MB.
- Production bucket must block public access, enforce encryption at rest, restrict CORS to the manufacturer portal and use least-privilege credentials.

## Nigerian data protection

PAN processes company contact details, staff account data, facility addresses, documents and verification events. It currently does not require consumer accounts or precise GPS location to perform a product check. Avoid collecting location/device signals unless a documented purpose, lawful basis, transparency notice, retention rule and risk assessment justify them.

Before launch, obtain advice from a Nigerian privacy professional on the Nigeria Data Protection Act 2023 and NDPC's General Application and Implementation Directive, including controller/processor role allocation and contracts; a privacy notice, lawful-basis assessment and data-subject rights process; retention and deletion schedules, access controls and encryption; whether PAN qualifies as a Data Controller or Processor of Major Importance and any registration/audit-return obligations; DPIA requirements; breach response and notification timelines; and cross-border storage and transfer safeguards where hosting is outside Nigeria.

This document is an engineering baseline, not legal advice or a statement that PAN is already NDPC-compliant.
