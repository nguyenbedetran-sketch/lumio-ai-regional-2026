# Teacher applications and manual review

This module adds a private application and an administrator-reviewed teacher credential. Submitted names, school, location, professional email and links are declarations. **An approved application is not an official identity, employment or school verification.** Responses always include `identityVerified:false` and `basis:"manual-review-of-declaration"`.

## Data and privilege boundaries

- Required profile: declared name, two-letter country code and display name, province/city, ward, school, teaching level, 1–10 subjects, teacher declaration and storage consent. Preschool is supported. No age threshold, date of birth, ID image, guardian details or student information is collected by this schema.
- Optional: professional email and HTTPS public evidence link. Validation checks syntax; neither is fetched or verified automatically. Account identity remains the existing canonical signed-in user, independent of profile names and email claims.
- A separate `teacher_credentials` record becomes active only after an administrator approves a pending application. `SystemRole` remains `USER`/`DEV`/`ADMIN`/`SUPER_ADMIN`; no organization or membership is created from a school name. The applicant cannot self-approve, including an administrator reviewing their own form.
- Only `ADMIN` and `SUPER_ADMIN` receive `teachers.read` and `teachers.review`. `DEV` and organization `TEACHER`/`SCHOOL_ADMIN` membership do not receive these system permissions. Existing restrictions on private student learning data remain in force. This module does not implement classes, assignments or student analytics.
- Teacher forms are not part of the seven-day study snapshot or the browser library backup/sync. They are private account records retained in the platform database; there is no automatic seven-day deletion or self-service profile-erasure endpoint in this bounded module. Local browser data deletion does not erase this server form. Free-host resets may lose both applications and grants.

## API contract

Shared types and parsers: `lib/teachers/contracts.ts`.

| Route                           | Access                                                 | Behavior                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/teacher-application`  | Current browser account                                | Own application or `null`, plus current credential. No other user ID/query is accepted.                                                                                                                       |
| `POST /api/teacher-application` | Current browser account + same origin                  | `{requestId,expectedRevision,profile}`. Creates revision1 or revises/resubmits with the current revision. Returns current `TeacherSelfState`, HTTP200 including replay.                                       |
| `GET /api/admin/teachers`       | Recent admin session + `teachers.read`                 | Bounded `status`, `q`, `sort`, `offset`; 30 results/page. Literal search over declared name/location/school/subjects; professional email is excluded from search.                                             |
| `PATCH /api/admin/teachers`     | Recent admin session + `teachers.review` + same origin | `{requestId,applicationId,expectedRevision,action,note}` where action is approve/reject/revoke. Returns current application and credential. Review note is 8–300 characters; line breaks/tabs fold to spaces. |

Every route requires `X-Lumio-Account` matching the canonical user's storage key. Read routes reject cross-site/same-site fetches without requiring an Origin header. Mutations require the existing exact-origin policy, bounded JSON and a current canonical session. Native bearer teacher tools are not exposed by this version.

Unknown profile/request fields, client-supplied status/role/verification, non-boolean declarations and coerced revisions/actions are rejected. A profile may be submitted at most ten times in a rolling 24-hour period; identical replay is checked before the rate limit.

Lifecycle: `pending → approved | rejected`, `approved → revoked`, and `rejected | revoked → pending` through a new applicant submission. Pending edits also require the current revision. An approved application cannot be edited until revoked. Approval of a disabled applicant is denied.

Application, credential, operation fingerprint and minimal audit event commit in one SQLite write transaction. The store rechecks the actor's current session version and permission inside that transaction. Idempotent replays return current state without applying the old decision again; replaying a prior approval after revocation cannot restore the credential. Competing reviews with a stale revision return409.

Audit metadata contains application IDs, lifecycle status/revision and credential-active decisions; it excludes full profile content, location, school, email, subjects and reviewer prose. Existing append-only audit protection remains intact. A denied review can add a minimal denial code without a private declaration.

## Verification and limits

`node tests/teacher-api.cjs` executes actual Request/Response handlers and canonical store/policy code against temporary SQLite databases. It blocks network requests and uses synthetic accounts and declarations only. The machine-readable result is [qa-teacher-api-report.json](qa-teacher-api-report.json); text output is [teacher-api-tests.log](teacher-api-tests.log).

Coverage includes migration10→11 preservation; preschool and normalization; anonymous/disabled/revoked sessions; account binding/origin/JSON bounds; forged approvals/admin emails/roles; own-only access; current/recent administrator permissions; no self-review; declaration→pending→approval→revocation→resubmission; CAS/idempotency/lost-response replay; actor revocation and role loss after initial HTTP authorization; audit and operation-log fault rollback; literal bounded queue search; submission rate; absent student data; and schema11 readiness with a missing teacher table.

Existing admin, authentication and runtime/sync suites are retained. These tests do not establish a real teacher's identity, validate government geographic data, exercise real OAuth, prove a classroom workflow or demonstrate improved student learning. UI/browser verification, provider deployment and final submission are coordinated separately.

## Operations

Migration11 adds `teacher_applications`, `teacher_credentials`, and `teacher_application_operations`; existing users/roles and study snapshots are preserved. Readiness now requires all three tables and schema11. Backup inspection must be updated to schema11 before deployment. Restart the Node process after deploying the new store composition; a development hot-reload singleton created before this module will not acquire new methods automatically.

If disabling the feature, remove its entry points and routes before any table cleanup. Preserve applications/credentials, idempotency and audit records until retention/privacy handling is decided. Never reinterpret a form field as a system role or infer access to another learner's private data from this credential.
