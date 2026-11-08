# PAN Database Backup & Restore Runbook

## Objectives

- RPO (Recovery Point Objective): ≤ 15 minutes (or better with continuous WAL archiving).
- RTO (Recovery Time Objective): ≤ 4 hours for full service restoration.

## Daily verification (production)

1. Confirm the managed PostgreSQL provider shows successful automated backups for the last 7 days.
2. Confirm point-in-time recovery is enabled.
3. Confirm encryption at rest is active.

## Quarterly restore test (mandatory before declaring production ready)

1. Provision a temporary database instance from the latest backup (or PITR to a chosen timestamp).
2. Update a staging `DATABASE_URL` to point at the restored instance.
3. Run `pnpm --filter @pan/api db:deploy` (should be a no-op if schema matches).
4. Start the API against the restored DB and run the smoke test suite.
5. Spot-check: one manufacturer, one issuance job, one verification event, audit chain head.
6. Record the test date, duration, and any anomalies in the operations log.
7. Destroy the temporary instance.

## Emergency restore procedure

1. Declare incident (see `INCIDENT-RESPONSE.md`).
2. If the primary is corrupted, promote the latest known-good backup / PITR target.
3. Update production `DATABASE_URL` (or DNS / connection string secret) to the restored instance.
4. Restart API and worker processes; confirm `/api/health/ready` returns healthy.
5. Verify super-admin login and one public verification still succeed.
6. Communicate status to stakeholders.

## Object storage

- S3-compatible bucket must have versioning or lifecycle rules that protect against accidental deletion of recent objects.
- Document how to restore a deleted manufacturer document from versioning if enabled.

## Ownership

Assign a named owner for backup monitoring and the quarterly restore test before go-live.
