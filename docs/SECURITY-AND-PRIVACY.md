# Security and privacy baseline

- Use cryptographically secure random tokens with 192–256 bits of entropy.
- Store a keyed hash/HMAC for identity lookup; do not log or expose raw QR tokens.
- Enforce unique token hashes, idempotency keys and transactional issuance.
- Keep privileged credentials server-side only.
- Apply tenant isolation to every manufacturer-owned resource.
- Rate-limit public verification and abuse-prone endpoints.
- Use short-lived signed URLs for private exports.
- Treat verification events as append-only; audit every identity state change.
- Location is optional, purpose-limited and consent-based. Do not continuously track consumers.
- Repeated scans are a risk signal, not proof of counterfeiting.
- A valid QR identifies a record; it does not prove product contents, safety or regulator approval.
- Conduct Nigerian NDPA/NDPC legal and privacy review before production collection of precise location or device signals.
