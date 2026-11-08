# Getting started

## Requirements

- Node.js 20.11 or newer
- pnpm 9.15.4
- Docker with Compose
- SMTP account for transactional email (optional locally; required in production)
- S3-compatible private object storage for company documents (required for document upload)

## Start PostgreSQL

From the repository root, run: docker compose up -d postgres

## Configure the API

Copy apps/api/.env.example to apps/api/.env. Generate independent random secrets for JWT signing, token HMAC and export encryption. The export encryption key must be exactly 32 random bytes represented as 64 hexadecimal characters.

Generate a super-admin password hash locally using bcryptjs:

PAN_ADMIN_PASSWORD='use-a-unique-long-password' node -e "require('bcryptjs').hash(process.env.PAN_ADMIN_PASSWORD, 12).then(console.log)"

Put the resulting hash in SUPER_ADMIN_PASSWORD_HASH and configure SUPER_ADMIN_EMAIL. Do not use the same password for a manufacturer account.

Configure SMTP for verification, password recovery, invitations and privacy-request confirmations. Set PRIVACY_CONTACT_EMAIL to a monitored mailbox before production. Configure SMTP for verification, password recovery and invitations. Configure a private S3 bucket or compatible storage service for documents; enable bucket encryption, block public access, and configure CORS to permit PUT from the manufacturer portal origin only. Do not make the document bucket public.

Run:
- pnpm install
- pnpm --filter @pan/api db:generate
- pnpm --filter @pan/api db:deploy
- pnpm --filter @pan/api dev

API: http://localhost:4000/api.

## Manufacturer workspace

Run pnpm --filter @pan/manufacturer-web dev and open http://localhost:3000/portal.

The workspace provides company profile and CAC reference, facilities, private supporting-document upload, team roles, products, production batches, wallet/credit history, consumer reports, scan-risk review, and Code Studio for separate carton and individual-unit identities. Code Studio exports QR PNG ZIP, CSV manifest and print-ready PDF labels; exported identities require quality confirmation on /portal/activation before public verification.

Email verification is required before manufacturer login. Local development without SMTP logs verification links in the API terminal; test mode exposes verification tokens only to automated CI tests.

## Public verification

Run pnpm --filter @pan/verification-web dev and open http://localhost:3001. Consumers can scan a QR with their phone camera, enter a PAN code manually, report a concern or open /download for mobile app store links.

## Consumer app

Set EXPO_PUBLIC_PAN_API_URL to an API URL reachable from the device. Android emulator default: http://10.0.2.2:4000/api; iOS simulator default can be http://localhost:4000/api; a physical phone needs the development machine's LAN IP.

Run pnpm --filter @pan/consumer-mobile start.

The public download page reads NEXT_PUBLIC_ANDROID_DOWNLOAD_URL and NEXT_PUBLIC_IOS_DOWNLOAD_URL. Store links remain unavailable until the production app listings are published and those URLs are configured.

## Super administrator console

Open http://localhost:3000/admin and sign in with SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD_HASH. Use /admin/finance for credit packages and company allocations, and /admin/scan-risk for global risk events. The short-lived super-admin JWT is held in session storage, not local storage. Administrative decisions are chained in the audit log; verify data-subject requesters before disclosing or changing personal information.

PAN approval means PAN has completed its own producer onboarding review. It is not NAFDAC registration, SON certification, product testing or government endorsement.

## Quality checks

Run the API, manufacturer web, verification web and consumer mobile typechecks, plus pnpm --filter @pan/api smoke.

Before public launch, run production builds and browser/device tests, configure SMTP and private storage, review deployment security, complete a privacy impact assessment where required, and obtain Nigerian data-protection and legal review.
