# PAN proprietary barcode specification

## Purpose

PAN issues a branded, app-oriented optical label for each individual-unit identity and each carton identity. This is a versioned presentation and payload protocol layered on a standards-based optical symbol, so ordinary phone cameras and established barcode engines can read it reliably.

## Version 1 format

- Optical symbology: ECC200 Data Matrix.
- Payload prefix: `PAN1:`.
- Payload shape: `PAN1:<base64url-token>`.
- Token source: 32 cryptographically random bytes encoded as base64url (43 characters).
- The token is a bearer credential. The API stores only its HMAC-SHA-256 digest, using the server-side `TOKEN_PEPPER`.
- The raw token is present only in the short-lived encrypted issuance export, to let the manufacturer generate the label artwork. The export retrieval window remains 48 hours.
- The consumer app accepts the `PAN1:` prefix, extracts the token and calls the existing authenticated-by-token verification endpoint. Legacy QR URLs and manual PANU/PANC codes remain supported for backwards compatibility.

## App-only interpretation, not proprietary optics

Data Matrix is an established public symbology; a generic Data Matrix reader can decode its text. The PAN1 payload is deliberately not a web URL, so generic scanning does not automatically open a public verification page. The PAN consumer app understands the PAN1 protocol and performs the server-side verification.

This distinction is intentional. PAN must not claim that the optical symbol is impossible for other scanners to read, or that a printed label cannot be photographed or copied. Security comes from unpredictable tokens, server-side digest verification, lifecycle controls, rate limits, scan-risk analysis and the ability to quarantine or revoke an identity—not from hiding the barcode pattern.

## Packaging and print rules

- Generate separate identities and separate Data Matrix labels for every unit and every carton.
- Preserve the symbol's quiet zone; do not crop, stretch, recolour to low contrast, place graphics over modules, or print over folds/seams.
- Use dark modules on a plain light background and test actual label stock, printer resolution, label size, lighting, camera distance and damaged/curved packaging before a packaging-line pilot.
- Keep the human-readable PANU/PANC public code adjacent to the symbol as a manual fallback. Do not print the raw PAN1 payload or verification URL as ordinary text.
- Manufacturer exports and print artwork contain bearer credentials. Limit access to authorised packaging staff and securely delete local copies after use.

## Release acceptance

Before production rollout, test:
1. New unit and carton issuance, including parent-child links.
2. Data Matrix PNG, ZIP and print-ready PDF output.
3. Android and iOS camera scanning of real printed labels at multiple sizes and lighting conditions.
4. Correct verification, repeat-scan detection, quarantine, revocation and expired/revoked identity outcomes.
5. Legacy QR and manual PANU/PANC compatibility.
6. A failed network request never being presented as proof that a product is counterfeit.

PAN reports whether a digital identity exists in a producer workspace. It does not independently prove physical origin, contents, quality, safety, or regulatory approval.
