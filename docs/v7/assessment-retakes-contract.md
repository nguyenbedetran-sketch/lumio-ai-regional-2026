# E2 backend contract: scheduled availability and practice retakes

Implemented on schema16. This is teacher-issued practice using the same immutable questions. It is not a proctored or fresh secure exam: published answers may already have been seen. No provider or credit call occurs in these actions.

## Availability

Assignment create/update draft accepts optional `availableFrom` / `availableUntil`: explicit ISO8601 UTC or numeric offset, or null. Naive local timestamps and invalid calendar dates are rejected. Values are normalized to UTC; start is inclusive, hard end exclusive. The sequence is start ≤ dueAt ≤ hard end when configured; hard end must be in the future and within366 days. Once issued, the snapshot, recipients and window cannot be edited. A draft without an explicit start opens at issue; a legacy assignment retains its actual issued time and has no additional hard close. Existing due/late policy is preserved unless a hard end closes access.

Before opening, student state contains assignment metadata but empty questions, questionIds and instructions. Submission always rechecks server time, class membership, immutable target snapshot, status and hard end; cached UI cannot bypass this. An archived class retains history but cannot accept new submissions.

Assignment state adds `rootAssignmentId`, `attemptNo`, `practiceRetake`, normalized `availableFrom` / `availableUntil` and `questionCount`. Student state adds `canSubmit` and `availability`: available, not_open, closed, due_passed, graded or class_archived. The client must use `canSubmit === true`, not its own clock/counter, before opening a submission form. Server checks remain authoritative after the form opens.

## Teacher grant

Existing account-bound `POST /api/teaching` accepts:

```json
{
  "action": "assignment.retake",
  "requestId": "stable UUID for this explicit action",
  "orgId": "organization ID",
  "originalAssignmentId": "root assignment ID",
  "expectedRevision": 3,
  "studentId": "current original recipient",
  "availableFrom": "2026-10-17T01:00:00.000Z",
  "availableUntil": "2026-10-17T02:00:00.000Z",
  "reason": "Teacher's private rationale, up to1000 characters",
  "sameQuestionsAcknowledged": true
}
```

Both endpoints are required for a retake. The original must be issued or closed and remain a root. The actor needs current approved teacher/organization/class permission; a global system role does not silently grant membership. The selected student must remain enrolled, enabled and an original frozen recipient, with a teacher-graded or published original submission. The student's client cannot grant itself attempts.

The action creates one issued child assignment with one student target, exactly the root's frozen questions, a labelled practice title, and dueAt equal to the new hard end. It does not rebuild questions from the current bank. Result: `{id, rootAssignmentId, attemptNo}` inside the existing `{state,result,replayed}` envelope. The root revision increments, so concurrent grants/closure use existing CAS. Reuse the same requestId and identical payload on lost ACK; replay creates no child or consumed attempt. Replay also rechecks actor/class permission and recipient's current enrollment.

Maximum is three attempts per root/student, counting the original. At most one unresolved child is permitted. An unused child still inside its window is outstanding; expiry or explicit close allows the last grant but still consumes that unused attempt. A submitted, ungraded child remains pending even after close/expiry: the teacher must grade it before granting another. Closing the root does not implicitly close an explicitly issued practice child; close that child using the existing assignment.close action.

Internal rationale/acknowledgement are stored server-side and are not emitted in student workspace state. The original and all child submission IDs, answer snapshots, grades and append-only grade events remain separate and intact. No synthetic missing submission or grade is created for an unused attempt.

## Analytics and exports

Only the latest **currently published** attempt for each root/student counts toward analytics. A pending unpublished correction withdraws that attempt from current analytics and may leave the previous published attempt selected. Each topic's independent-assessment denominator uses distinct root IDs; three tries of one question set cannot satisfy the three-assessment mastery threshold.

Each submission exposes `countsTowardAnalytics` for UI aggregation. The observed-errors display must exclude rows where this is false. Grade exports retain original/all published attempt rows as permitted by role and add rootAssignmentId, attemptNo, practiceRetake and countsTowardAnalytics so consumers can distinguish history from selected evidence. Students still receive/export only their own permitted results.

## Persistence and failures

Migration16 adds only teaching_assessment_windows and backfills existing assignments without changing issued data_json, targets, submission IDs or grade events. Child creation, target/window records, parent CAS revision, audit and idempotency operation share one transaction. Failed writes consume no attempt. Existing workspace capacity and200-assignment limit apply; private rationale bytes count toward workspace capacity.

Canonical integrity metadata now knows48 tables/52 per-version definitions through16, preserving versioned14/15 structures and all six immutable guards. Backup inspect accepts genuine14/15/16 without migration; only opening a separate copy with current runtime upgrades it. Older artifacts must use matching pre-upgrade database snapshots. The historical15/17-check operations report is retained separately; current schema16 operations checks are not evidence of deployment or host disaster recovery.

New errors: TEACHING_INVALID_WINDOW400, TEACHING_NOT_OPEN409, TEACHING_RETAKE_ROOT_REQUIRED409, TEACHING_RETAKE_ACK_REQUIRED400, TEACHING_RETAKE_GRADE_REQUIRED409, TEACHING_RETAKE_PENDING409 and TEACHING_RETAKE_LIMIT409. Existing authorization, CAS, recipient, archive, storage and closed-assignment errors remain in effect.

## Explicit limits

No per-question timer, proctoring, accessibility accommodation plan, automatic alternate-question generation, automatic reopening, bulk retake grants, or background deadline scheduler is included. The server computes availability when accessed; the UI should refresh state around window boundaries. Same-question practice must never be presented as a new secret exam. Histories/rationales have no7-day TTL or self-erasure endpoint; backups contain private assessment records. Database persistence and recovery remain subject to the competition host's explicitly documented ephemeral-storage limit.
