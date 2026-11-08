# Privacy Notice (DRAFT — for counsel review)

**Status:** Engineering draft only. Must be reviewed and approved by Nigerian privacy counsel under the Nigeria Data Protection Act 2023 (NDPA) and NDPC General Application and Implementation Directive before publication. Replace all placeholders.

---

**Effective date:** [DATE]  
**Controller:** [LEGAL ENTITY NAME], [REGISTERED ADDRESS], Nigeria  
**Privacy contact:** [PRIVACY_CONTACT_EMAIL] (monitored)

## 1. Who we are

Product Authentication Network ("PAN", "we") operates a producer-linked product identity platform. This notice explains how we process personal data when manufacturers use the workspace, when consumers verify a product or submit a concern report, and when individuals exercise data-subject rights.

## 2. Data we process

### Manufacturer / staff accounts
- Name, email, password hash, role, company membership
- Company profile, facilities, uploaded supporting documents
- Wallet and payment metadata (processed via Paystack; we do not store full card data)

### Verification activity
- Product identity codes scanned or looked up
- Session identifiers stored only as keyed HMAC digests (no raw device fingerprint or precise GPS required for a basic check)
- Timestamp and outcome of the check

### Consumer concern reports (voluntary)
- Reason and free-text details
- Optional contact email, store name, city/state, purchase date
- Any evidence files the user chooses to upload (once that feature is enabled)

### Privacy / data-subject requests
- Email, request type, details, and our handling notes

We do **not** require a consumer account or precise location to perform a product verification.

## 3. Purposes and lawful bases (draft — counsel to confirm)

| Purpose | Examples | Draft lawful basis |
|---------|----------|--------------------|
| Provide the service | Account, issuance, verification | Contract / legitimate interest |
| Security & fraud prevention | Rate limits, risk signals, audit | Legitimate interest |
| Legal & regulatory | Respond to lawful requests, NDPA compliance | Legal obligation |
| Improve the service | Aggregated, non-identifying analytics | Legitimate interest |
| Handle reports & privacy requests | Consumer reports, DSAR | Legitimate interest / legal obligation |

## 4. Retention (draft — counsel to confirm)

See the retention job defaults in `apps/api/src/jobs/retention.job.ts` and the master TODO. Final periods will be set after legal review and documented here.

## 5. Sharing

- Hosting, email, object-storage and payment processors acting as processors under contract
- Super-administrators of the PAN platform for review and support
- Competent authorities when legally required

We do not sell personal data.

## 6. Cross-border transfers

If any processing occurs outside Nigeria, we will implement appropriate safeguards as advised by counsel (standard contractual clauses, adequacy, or other NDPA-compliant mechanisms).

## 7. Your rights

Under the NDPA you may have rights of access, rectification, erasure, restriction, objection, and data portability, subject to legal limitations. Contact [PRIVACY_CONTACT_EMAIL]. We will respond within the statutory timelines after verifying the request.

## 8. Security

We apply technical and organisational measures including encryption in transit and at rest for key assets, access controls, audit logging, and least-privilege credentials. No system is perfectly secure; report concerns to the privacy contact.

## 9. Changes

Material changes will be notified via the website or email where appropriate. Continued use after the effective date of a revised notice constitutes acceptance where permitted by law.

## 10. Contact

Privacy questions and data-subject requests: [PRIVACY_CONTACT_EMAIL]  
General support: [SUPPORT_CONTACT]

---

*This document is not legal advice and is not the final public notice.*
