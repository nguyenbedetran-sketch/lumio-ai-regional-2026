# Active operations: schema20 and private remote storage

17 October2026. Applies to the current candidate, not automatically to the public service. Preserve the frozen V9 evidence and use the exact candidate commit for every new release gate. See [current execution](CURRENT.md) and [cutover audit](../v9/CUTOVER-AUDIT.md).

## Storage and failure behavior

The current contract is schema20,54 application tables and11 immutable guards. Local SQLite and direct remote libSQL use the same canonical contract. Partial or mixed remote configuration fails closed; remote errors must never silently switch to an empty local database. The bounded synchronous remote bridge is a small preview deployment constraint, not evidence of capacity under load. See [file and paid-policy limits](TEACHING-FILES-AND-PAID-POLICY.md).

Render Free's old local filesystem is ephemeral. A browser library export contains library/learning/preferences only: it is not a server backup of identities, organizations, classes, submissions, grades, receipts or the credit ledger. The approved production Turso key is held privately for the Render server; it has not been connected by this increment. Never put a database, token or dotenv file in Git, a web directory or competition evidence.

## Private backup and separate restore

Use Node24 and a private directory controlled by the operator, with Windows ACLs or equivalent host permissions verified independently. The snapshot CLI's lexical public-path checks and chmod0600 do not resolve symlinks/junctions or establish Windows ACLs. Do not use an untrusted redirected destination. Always choose a new filename; do not overwrite a running database or remove an older backup to reuse its name.

For a local file, use the existing CLI (paths below are placeholders):

```powershell
node scripts/database-snapshot.cjs inspect --source <private-source.sqlite>
node scripts/database-snapshot.cjs backup --source <private-source.sqlite> --out <new-private-backup.sqlite>
node scripts/database-snapshot.cjs restore --source <private-backup.sqlite> --out <new-private-rehearsal.sqlite>
```

Inspect accepts genuine schema13–20 without migrating or seeding the source. Backup/restore uses SQLite VACUUM INTO, then checks quick_check, foreign keys, consecutive migration history and canonical tables/guards. The output size and SHA-256 identify the file, not the semantic quality of its data. A different file hash after VACUUM is expected; compare canonical schema and all row values as well.

For remote libSQL, the CLI accepts **local filenames only**. Export an authorized database through Turso's SQLite download, keep the file private, inspect it, then restore it to a separate new file with the same commands. Do not pass a database URL or token as a filename or claim this is a supported cloud import mechanism. Record the environment, export time, exact hashes, schema and private comparison results. Verify canonical UUIDs, memberships, issued snapshots, targets, answers, grades, sync revisions, operation receipts and ledger entries that are actually present. Empty tables do not exercise recovery of their nonempty histories.

Historical schema18 QA rehearsal: [remote-export-local-restore.json](reports/remote-export-local-restore.json). A737280-byte Turso QA export was restored to a new local file; all51 tables and all row content matched, with6 guards, quick_check=ok and0 foreign-key violations.23 tables were nonempty, including synthetic identities, classes, assignments, submissions, sync, receipts and ledger. Grade-event history was empty in this export; nonempty grade recovery remains covered separately by isolated operations/compiled HTTP fixtures. The source file stayed unchanged. This establishes cloud-export-to-local recovery only. It does not establish production migration, cloud re-import, scheduled off-device backups, provider outage recovery or an RPO/RTO. The data files remain outside this repository.

Current schema20 actual isolated Turso acceptance: canonical8 groups and file15 groups passed separately. File chunks survived reopen with exact bytes; private scopes, final submission binding and bounded quotas were checked. Local/compiled schema20 snapshots also recovered exact submitted files. A separate cloud point-in-time branch reproduced the older schema18 table counts; complete cloud row equality was not established. None of these results replaces the final public restart gate.

## Upgrade and rollback

1. Record the real baseline artifact, exact source SHA, schema and private configuration. Obtain a valid full server snapshot or an explicit, informed decision to start fresh before any cutover. Visible empty classes are not proof that the whole database is empty.
2. Stop new writes, drain requests and workers, then stop the process according to the hosting plan. Setting LUMIO_BACKGROUND_JOBS_DISABLED=true alone does not cancel an already running worker. A snapshot does not include later writes.
3. Inspect and restore to a new private location. Run the exact candidate against that separate copy; verify identity, authorization, classes, submissions, grade history, receipts, sync and ledger. Never migrate the only backup.
4. For remote deployment, validate URL/token on the server without exposing them. Verify startup schema, readiness, authorized teacher/student flows, denied cross-account/org access and persistence after a controlled restart. Health alone is not a complete acceptance test.
5. Retain the baseline artifact and snapshot. Roll back using the matching old artifact plus a new restore of its compatible snapshot; do not point old code at an incompatible newer schema, edit migration history or drop guards to force startup. Preserve the newer DB for reconciliation. State which writes after the snapshot would be missing before approving rollback.

The old Render Free service offers no full export endpoint or free shell in the inspected setup. Redeploying an export endpoint can itself replace the ephemeral filesystem. The user explicitly accepted fresh Turso initialization on17October after disclosure that the old server data was not fully migrated. The decision blocker is resolved; deployment, login and restart-persistence verification remain required. No complete migration is claimed.

## Operational acceptance limits

The compiled teaching HTTP suite uses a separate temporary SQLite database, authored synthetic sessions and AI disabled; it must run after production build. It verifies actual Next/API behavior, not genuine Google/Facebook login. The remote QA suite uses the specifically approved synthetic Turso database; it never substitutes production credentials. Keep provider, real browser login, device, load and learning-outcome acceptance separate from deterministic checks.

Credits are an internal ledger, not a provider invoice. Unknown token/cost values remain unknown; zero is valid only when observed. Text/multimodal attempt metadata does not cover voice/embedding invoices. Do not replay an uncertain provider call or settled operation merely to recreate missing telemetry. Existing bounded retry, retention and idempotency rules remain authoritative.

Pending operations work: independently retained backup schedule, documented retention and access owners, measured recovery objectives, cloud re-import rehearsal and production outage/restart acceptance. Only the explicitly approved Turso Free storage/key scope is authorized for the database cutover; no paid plan or additional service is activated.
