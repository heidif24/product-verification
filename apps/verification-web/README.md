# PAN Public Verification

Next.js mobile-first public verification website. No account or app installation is required.

## Routes

- `/` — scan instructions and manual PAN product-ID entry.
- `/v/[token]` — QR token verification result.
- `/code/[code]` — manual product-code verification result.

Run the API and PostgreSQL service as described in [Getting started](../../docs/GETTING-STARTED.md), then run:

```bash
pnpm --filter @pan/verification-web dev
```

The site calls the shared PAN API. Set `NEXT_PUBLIC_PAN_API_URL` in the deployment environment when the API is not at the local development address.

PAN verifies a digital identity record. It does not independently test physical contents, product quality or regulator approval.
