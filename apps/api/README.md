# PAN API

Planned NestJS modular monolith. PostgreSQL is the source of truth; Redis/BullMQ handles long-running issuance and export jobs.

Modules: authentication, manufacturers, facilities, products, batches, identities, issuance, public verification, scan events, risk review, consumer reports, admin and audit.

The API owns authorization and verification decisions. Keep service credentials server-side and enforce manufacturer tenant isolation.
