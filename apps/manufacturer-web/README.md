# PAN Manufacturer Web

Next.js manufacturer portal and dashboard.

## Live manufacturer console

Run the API and PostgreSQL service as described in [Getting started](../../docs/GETTING-STARTED.md), then start this app:

```bash
pnpm --filter @pan/manufacturer-web dev
```

Open `http://localhost:3000/portal` to register or sign in. The console supports manufacturer workspace status, product catalogue, production batches, identity issuance, PNG QR pack ZIP export, CSV identity export, live verification metrics and recent scan activity.

The original dashboard at `/` is a visual design prototype with illustrative demo metrics. It links to the functional portal and must not be mistaken for live company data.

The browser uses a public API base URL only. Never place the API admin key, JWT signing secret or token HMAC pepper in this app.
