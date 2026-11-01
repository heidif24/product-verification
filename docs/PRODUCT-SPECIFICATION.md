# Product specification

## Manufacturer workspace

- Email-verified producer registration and password recovery.
- Company profile, CAC/company reference, registered address and contact information.
- Production, packaging, warehouse and distribution facility records.
- Private supporting-document uploads with PAN review states.
- Team invitations and roles: Owner, Admin, Operator, Analyst.
- Product catalogue and producer-supplied NAFDAC/SON reference fields with explicit non-validation notice.
- Production batches with unit quantity, carton count and units per carton.
- Code Studio for queued bulk identity issuance and progress tracking.
- QR PNG artwork ZIP, CSV manifest and print-ready PDF labels.
- Manufacturer analytics and recent verification activity.

## Two-level product identity

- Individual-unit identity: a unique PANU code and QR token for one saleable unit.
- Outer-carton identity: a unique PANC code and QR token for one carton.
- Carton identity is linked to the unit identities packed inside it.
- A producer can issue carton and unit identities in one job, or issue carton codes later for previously issued unassigned unit identities.
- Batch quantity and carton configuration constrain issuance. The manufacturer is responsible for physically applying the correct label at each packaging level.

## Consumer mobile app (Android and iOS)

- QR scanner and manual code entry.
- Plain-language PAN identity result, producer name, product and batch information.
- Carton/unit relationship where available.
- Regulatory identifiers are displayed only as producer-supplied, not verified by PAN.
- A product check works without consumer account creation or precise GPS location.
- Consumers can report product/packaging concerns from the public result page or mobile app; super-admins triage reports with an audit trail.
- Batch expiry dates are surfaced as a distinct expired status, not a counterfeit determination.

## Public verification website

- Opens from any ordinary camera app; no app installation or account required.
- QR-token and manual-code lookup share the same API and verification semantics.
- Clear status for active, previously scanned, producer pending, under review, revoked, unrecognised and unavailable identities.
- Privacy notice, terms and data-subject request form.
- Never exposes private manufacturer documents, internal risk rules or raw token material.

## Super administrator console

- Network overview and producer search.
- Company review with profile, facilities, documents, products and workspace members.
- Approve, suspend or return a producer to pending with a reason.
- Accept or reject submitted company documents with a review note.
- Search identity codes and quarantine, release or revoke with a reason.
- Review privacy requests and append-only audit records.

## Explicit product boundaries

PAN confirms that a digital identity was issued under a producer's PAN workspace. It is not proof of physical provenance, product quality, contents, safety, NAFDAC registration, SON certification or government endorsement. No automatic regulator validation integration is currently implemented.
