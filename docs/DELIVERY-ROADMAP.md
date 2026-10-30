# Delivery roadmap

1. **Foundation** — monorepo, CI, shared contracts, local services, design system and app shells.
2. **Manufacturer onboarding** — auth, approvals, roles, tenant isolation, products and batches.
3. **Identity engine** — secure tokens, idempotent bulk issuance, QR asset exports and revocation.
4. **Verification experiences** — public web, Expo scanner, result states, scan events and optional location.
5. **Trust operations** — risk signals, alerts, reports, review and audited quarantine/release.
6. **Pilot hardening** — threat modelling, privacy/legal review under Nigeria's NDPA, load/security testing and packaging trials.

## Acceptance tests
- Generate at least 10,000 unique identities with no duplicates.
- Retry issuance jobs safely without duplicate identities.
- Verify that copied QR codes do not create false certainty.
- Test legitimate repeat scans and poor / denied location.
- Test cross-manufacturer access isolation, revocation and quarantine.
- Test malformed tokens, rate limits, network failure and expired export links.
