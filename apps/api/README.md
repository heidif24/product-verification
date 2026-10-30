# PAN API — functional core

NestJS + Prisma + PostgreSQL API for manufacturer onboarding, product catalogues, production batches, secure QR identity issuance and public verification.

## Local setup

1. Copy `.env.example` in this directory to `.env` and replace all three secrets with independent random values of at least 32 characters.
2. From the repository root run `docker compose up -d postgres`.
3. Run `pnpm install` from the repository root.
4. Run `pnpm --filter @pan/api db:generate`.
5. Run `pnpm --filter @pan/api db:deploy` (or `db:migrate -- --name init` for local migration development).
6. Run `pnpm --filter @pan/api dev`.\n7. In another terminal run `pnpm --filter @pan/api smoke` to exercise the registration-to-verification journey.

The API listens on port 4000; routes are prefixed with `/api`. Health: `GET /api/health`.

## Functional routes

- `POST /api/v1/auth/register` — creates a user and pending manufacturer workspace.
- `POST /api/v1/auth/login` — issues a 12-hour bearer token.
- `GET /api/v1/admin/manufacturers?status=PENDING` — list workspaces for internal review; requires `x-pan-admin-key`.
- `POST /api/v1/admin/manufacturers/:id/approve` — approve with a recorded reason; requires `x-pan-admin-key`.
- `POST /api/v1/admin/identities/:id/quarantine|release|revoke` — change identity state with an audit reason; requires `x-pan-admin-key`.
- `GET /api/v1/admin/audit` — latest 100 administrator actions; requires `x-pan-admin-key`.
- `GET /api/v1/manufacturer/me` — authenticated workspace profile.
- `GET|POST /api/v1/products` — list/create products in the caller's workspace.
- `GET|POST /api/v1/products/:id/batches` — list/create product batches.
- `POST /api/v1/batches/:id/identities` — issue 1–250 unique QR identities and QR data URLs.
- `GET /api/v1/verify/:token` — public QR-token verification.
- `GET /api/v1/verify/code/:code` — public manual product-code verification.

## Trust and security

QR tokens contain 256 bits of cryptographically secure randomness. Only an HMAC-SHA256 digest is stored. The raw token is returned only at issuance because the printed QR needs it. Manual identity codes contain 80 bits of randomness. Public verification returns product-facing fields only. Manufacturer ownership is checked on every product/batch query.

A new manufacturer starts in `PENDING`. An identity issued by a pending manufacturer returns `MANUFACTURER_PENDING`, not a verified/endorsed result. An internal operator must approve the workspace before PAN returns a normal verified result. Repeated scans are not described as proof of counterfeiting.

## Current MVP boundaries

The automated smoke test exercises registration, login, product and batch creation, identity issuance, pending/approved verification, repeat scans, manual lookup, issuance quantity limits, analytics and audit records. This is a functional first vertical slice, not a production compliance certification. It includes registration, login, tenant-scoped products and batches, QR issuance, CSV/QR asset output in the manufacturer portal, and public web verification. Identity quarantine, release and revocation now have an internal API workflow with recorded reasons and audit entries. A full administrator interface and separate admin identity provider remain outstanding.

Before public launch add email verification and recovery, proper administrator accounts and approval UI, rate limiting/WAF, durable async bulk issuance, idempotency keys, append-only audit controls, observability, backup/restore drills, threat modelling, Nigerian NDPA review, and production hosting/secrets. Redis is provisioned for the async job stage; this first vertical slice issues up to 250 identities synchronously.
