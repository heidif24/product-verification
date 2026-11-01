# PAN Manufacturer Web

Next.js manufacturer workspace and super-administrator console.

## Manufacturer workspace

Run the API and PostgreSQL service as described in docs/GETTING-STARTED.md, then run:

```bash
pnpm --filter @pan/manufacturer-web dev
```

Open http://localhost:3000/portal to register or sign in. The workspace includes company profile, facilities, private documents, team roles, product catalogue, production batches, analytics and Code Studio.

Code Studio generates distinct carton and individual-unit identities, links units to cartons, and provides a QR PNG ZIP, CSV manifest and print-ready PDF labels. Export manifests contain bearer verification URLs and must be kept confidential.

## Super administrator

Open http://localhost:3000/admin. Super-admin credentials are configured on the API and are separate from manufacturer accounts. Company approval, document decisions and identity-state changes are reasoned and audited.

The original dashboard at / is a visual design prototype with illustrative demo metrics. It must not be mistaken for live company data. The functional console is /portal.

Never place API admin keys, JWT signing secrets, token HMAC peppers, export encryption keys, SMTP credentials or S3 credentials in browser code.
