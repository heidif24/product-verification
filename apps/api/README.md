# PAN API

NestJS modular-monolith API with PostgreSQL and Prisma. The API is shared by the manufacturer workspace, public verification website and consumer mobile app.

## Core flows

- Manufacturer registration, email verification, login, password recovery and workspace profile.
- Company facilities, private document upload/review metadata and staff invitations/roles.
- Product catalogue and production batches.
- Asynchronous carton and individual-unit identity issuance with encrypted 48-hour export payloads.
- Public QR-token and manual-code verification.
- Separate super-admin authentication, company review, identity actions and audit history.
- Health endpoint and global API throttling.

## Local setup

See docs/GETTING-STARTED.md. The API requires PostgreSQL, JWT and HMAC secrets, a 32-byte hex export encryption key, and (for production) SMTP, super-admin credentials and private S3-compatible storage.

## Important endpoints

- POST /api/v1/auth/register, /verify-email, /login, /forgot-password, /reset-password
- GET/PUT /api/v1/manufacturer/profile
- GET/POST /api/v1/manufacturer/facilities
- GET /api/v1/manufacturer/documents; POST /documents/upload-url, /documents/confirm
- GET /api/v1/manufacturer/team; POST /team/invitations; role and membership management routes
- GET /api/v1/manufacturer/batches; POST /batches/:id/issuance-jobs; GET /issuance-jobs/:id
- POST /api/v1/super-admin/auth/login; GET /api/v1/super-admin/overview, /companies, /identities, /audit
- GET /api/v1/verify/:token and /verify/code/:code

## Security boundary

Never expose ADMIN_API_KEY, JWT_SECRET, TOKEN_PEPPER, EXPORT_ENCRYPTION_KEY, SMTP credentials or S3 credentials to a browser or mobile app. Public verification returns a scoped product record only; it never returns private manufacturer documents or raw token material.

A PAN identity match is not a guarantee of physical provenance, product quality or regulator approval.
