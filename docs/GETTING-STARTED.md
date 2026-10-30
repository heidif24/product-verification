# Getting started

## Requirements

- Node.js 20.11 or newer
- pnpm 9.15.4
- Docker with Compose

## Start the database

From the repository root:

```bash
docker compose up -d postgres
```

## Configure and start the API

Copy `apps/api/.env.example` to `apps/api/.env`. Replace `JWT_SECRET`, `TOKEN_PEPPER` and `ADMIN_API_KEY` with three independent random values of at least 32 characters.

```bash
pnpm install
pnpm --filter @pan/api db:generate
pnpm --filter @pan/api db:deploy
pnpm --filter @pan/api dev
```

The API is available at `http://localhost:4000/api`.

## Start the manufacturer portal

In another terminal:

```bash
pnpm --filter @pan/manufacturer-web dev
```

Open `http://localhost:3000/portal` to register a manufacturer account and create products, batches and QR identities.

## Start public verification

```bash
pnpm --filter @pan/verification-web dev
```

Open `http://localhost:3001`. Scan a generated QR code with a phone camera or enter its PAN code manually.

## Start the consumer app

Set `EXPO_PUBLIC_PAN_API_URL` to an API URL reachable from the device. Android emulator default: `http://10.0.2.2:4000/api`; iOS simulator default can be `http://localhost:4000/api`; a physical phone needs the development machine's LAN IP.

```bash
pnpm --filter @pan/consumer-mobile start
```

## Approve a manufacturer workspace for trusted verification

New workspaces are pending. After an operator has reviewed the company outside this MVP, use the internal API key and workspace ID to approve it:

```bash
curl -X POST http://localhost:4000/api/v1/admin/manufacturers/WORKSPACE_ID/approve \
  -H "x-pan-admin-key: YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Company identity and submitted records reviewed"}'
```

The API approval endpoint is protected by the separate `ADMIN_API_KEY`; never expose this key to a browser or mobile app. The same key protects the pending-manufacturer list, identity quarantine/release/revocation actions, and the administrator audit feed. Every approval or identity-state change requires a reason and creates an audit record.

## Check quality

```bash
pnpm --filter @pan/api typecheck
pnpm --filter @pan/manufacturer-web typecheck
pnpm --filter @pan/verification-web typecheck
pnpm --filter @pan/consumer-mobile typecheck
```

The first build still needs dependency installation and execution in a real development environment; the repository currently does not include a generated pnpm lockfile.
