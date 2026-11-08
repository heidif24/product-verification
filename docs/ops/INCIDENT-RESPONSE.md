# PAN Incident Response Runbook

## Severity levels

| Level | Examples | Response target |
|-------|----------|-----------------|
| SEV-1 | Data breach, mass identity leakage, full API outage, payment system compromise | Immediate (15 min) |
| SEV-2 | Partial outage, elevated false scan risk, single-tenant data exposure | 1 hour |
| SEV-3 | Degraded performance, non-critical feature failure | Next business day |

## Immediate actions (any severity)

1. Acknowledge the alert in the monitoring channel.
2. Open an incident channel / thread and assign an Incident Commander.
3. Preserve evidence (do not rotate logs or delete data yet).
4. Assess blast radius: which manufacturers, identities, or consumers are affected?

## SEV-1 / suspected breach

1. Isolate: if compromise is confirmed, rotate `JWT_SECRET`, `TOKEN_PEPPER`, `AUDIT_HMAC_KEY`, `EXPORT_ENCRYPTION_KEY`, database credentials and S3 keys as required.
2. Revoke active sessions by incrementing `tokenVersion` for affected users or forcing super-admin re-auth.
3. Quarantine affected product identities if QR material was exposed.
4. Notify privacy contact and legal counsel within NDPA notification timelines.
5. Prepare customer / regulator communication only after facts are confirmed.

## Communication

- Internal: Incident Commander posts status every 30 minutes until contained.
- External manufacturers: only after confirmed impact and approved messaging.
- Regulators / NDPC: follow counsel advice and statutory timelines.

## Post-incident

1. Write a short timeline and root-cause analysis within 5 business days.
2. File any required breach notifications.
3. Create remediation tickets and update this runbook if process gaps were found.
4. Schedule a blameless review.

## Contacts (fill before production)

- On-call primary: _TBD_
- On-call secondary: _TBD_
- Privacy / DPO contact: use `PRIVACY_CONTACT_EMAIL`
- Legal counsel: _TBD_
- Hosting provider support: _TBD_
