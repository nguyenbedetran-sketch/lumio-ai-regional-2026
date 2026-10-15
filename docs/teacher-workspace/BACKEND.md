# Teacher Workspace backend

This document describes implemented server behavior, rather than a proposed LMS. The public deployment and browser results are recorded separately by the release process.

## Persistence and access

SQLite migration 12 adds 14 workspace tables. Migration 13 adds per-teacher preferences. Existing users, global roles, teacher declarations, billing records, private libraries and sync snapshots are preserved. The migration/reopen checks use an isolated database, including an actual schema-11 fixture.

A teacher must have a current active manual-review credential. The credential records an administrator's decision about a declaration; it does not prove government identity or employment. `SUPER_ADMIN` may explicitly create an organization for their own workspace. There is no implicit cross-organization administrator bypass.

Organization `OWNER` and `SCHOOL_ADMIN` map to the workspace label `ORGANIZATION_ADMIN`. `TEACHER` remains limited to assigned classes and their own unscoped drafts. `STUDENT` requires organization membership and active class enrollment. Issued assignments additionally require an immutable recipient entry. Removing a membership/enrollment or revoking a teacher credential immediately affects subsequent reads, writes, exports, replayed requests and AI context assertions. A removed student cannot restore access using an invite to another class in the same organization; staff must explicitly restore enrollment.

The browser endpoints require a canonical signed-in account and `X-Lumio-Account`. Mutations enforce same origin. Cross-site/same-site browser fetch metadata and bearer/native requests are rejected by the existing teacher-access boundary. Every transaction rechecks current session version, disabled status and applicable role/credential. Workspace privileges do not change global `USER`/`ADMIN` roles or grant access to private personal-library data.

## Implemented phases

1. Organizations, classes, archival, student enrollment/removal/restoration, groups, co-teacher assignment/removal, organization staff roles and invitations. Invitations have a bounded expiry/use count; only their SHA-256 hash is stored. The authorized creator can recover an identical lost-ACK invitation response using the server secret. Rotating that secret safely makes old recovery unavailable. Co-teacher assignment accepts only an existing active approved teacher.
2. Extracted-text materials, lessons and question-bank drafts. Authoritative source evidence is checked when saved. Exact citations and physical page/slide/timestamp locations are rebuilt from authorized stored sources. An authorized co-teacher can edit metadata while preserving identical server-owned evidence for unchanged text. Newly supplied or changed evidence still requires actor-bound verification. Editing a draft resets review. Save permits an incomplete draft; review and assignment issue rerun independent content QA and reject provable errors. Teacher AI generation remains a draft and has its own consent, billing, cancellation and race checks.
3. Reviewed assignments with immutable question/rubric/answer snapshots, class/group/individual recipient snapshots, due dates, a late-submission policy and closure. Students submit only for themselves. MCQ marks are provisional. A teacher must explicitly confirm per-question marks and then separately publish the result. Regrading withdraws publication until another explicit publish. Before a student's own result is published, student JSON omits answer keys, model answers, explanations, rubric, source references, internal marks and other recipients. Teacher/organization staff cannot submit as a student.
4. Draft/published announcements, class calendar events, settings, teacher preferences, dashboard counts, published-result analytics and scoped CSV/JSON grade export. Topic labels require at least three distinct published assessments; they describe those recorded assessments, not a clinical diagnosis or proof of whole-subject mastery. Student exports contain only their own published results. CSV cells guard formula prefixes including leading Unicode whitespace.

## API contract

The canonical shared types are in `lib/teaching/contracts.ts`.

- `GET /api/teaching`: actor and accessible organizations, with no selected organization's records.
- `GET /api/teaching?orgId=...&classId=...&q=...`: role-sanitized state. `classId` is optional. `q` is a bounded literal substring filter for workspace content, not a global user search. Unknown or duplicate query parameters are rejected.
- `POST /api/teaching`: a strict action payload with `requestId`, `orgId` where applicable and the current `expectedRevision` for updates. Returns `{state,result,replayed}`. Identical retries return fresh authorized state without repeating the mutation/audit. Reusing a request ID for another actor or payload returns a conflict.
- `GET /api/teaching/export?orgId=...&classId=...&format=csv|json`: authorized grade export with no-store response headers and audit metadata.
- `POST /api/teaching/generate`: separately implemented teacher generation service. No student roster or stored student submissions are automatically sent to a provider. Generated material requires explicit save/review. Disabling `preferences.aiEnabled` also blocks an in-flight result at settlement and refunds its reservation.

Revision conflicts return `TEACHING_CONFLICT`; callers must refresh/reconcile rather than silently overwrite another teacher. `preferences.update` edits only the current teacher's organization-scoped preferences. Its initial revision is zero; first save creates revision one. Display name is workspace-only and does not rewrite the account or teacher declaration. Notification preference controls the in-app surface; it does not imply email or push infrastructure.

## Capacity and operations

This is a bounded competition workspace with full-state reads, not a claim of school-wide load testing. Limits include 10 organizations per creator, 30 classes per organization, 200 students per class, 100 material records, 200 total content records, 30 questions and 200 recipients per assignment. Per-organization payload caps are 2 MiB active content JSON, 256 KiB announcements/calendar text and 8 MiB active content plus assignment snapshots, submissions and communication. Limits are checked in the write transaction before commit; rejected changes roll back content, revision, audit and idempotency together. Replacing content accounts for its replacement size. Archived content is excluded from the active-text cap but still counts toward the record limit. `TEACHING_STORAGE_LIMIT` signals that staff must remove/shorten content or use a larger future storage design.

Each successful mutation and grade export records a bounded audit entry. Audit/idempotency metadata does not contain source text, student answers, scores, feedback, raw invite codes or teacher preference values. No organization deletion, automatic retention purge, self-service workspace erasure, durable binary-file storage, email/push delivery, external calendar synchronization or institution SSO is claimed here. Application data and workspaces remain subject to the deployment's SQLite persistence limits; free ephemeral hosting may reset them. Operators must use the documented offline backup/restore process before replacing a durable database.

## Evidence

`node tests/teaching-api.cjs` runs 49 actual Request/Response and SQLite checks: tenant/role/session boundaries, invite hashing/recovery, source signatures, co-teacher evidence, immutable issued snapshots, student field redaction, grading/publication, audit fault rollback, lost-ACK replay, cross-connection CAS, CSV safety, revocation, migration/reopen, preferences and storage quotas. The report is `backend-api-report.json`.

The independent content suites also passed: 38 deterministic QA checks and 24 actual handler/SQLite/ledger checks with intercepted provider transport. The existing 27 teacher-application checks remain passing. These fixtures use synthetic accounts/declarations and no real teacher/student data or external provider calls. Real provider, compiled HTTP, browser, device and public-host results must be read from their own release reports; these local checks do not establish those outcomes or a real-school learning benefit.
