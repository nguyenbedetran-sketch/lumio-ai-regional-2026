# Independent sync/runtime review and fault regressions

Date:2026-10-15. Scope: SQLite runtime/CAS implementation, shared sync contract/merge, `/api/sync`, `SyncPanel`, and the real settings `onApply` callback in `app.tsx`. Fixtures use a new temporary SQLite file; no private database or paid API is accessed.

## Findings and repairs

| Finding | Impact | Resolution |
| --- | --- | --- |
| Pending replay advanced the merge base before local application succeeded | After a failed or partial local apply, unapplied remote records/preferences could look like local deletions/changes on retry | **Fixed:** a server ACK no longer advances the locally applied base. Old base and outbox stay until successful local apply. Retrying compares from that base and preserves remote-only records; a newer local edit still receives conflict review. |
| Settings application yielded for IndexedDB, then restored stale learning/preferences | A focus completion, cross-tab preference write or account change during the await could be overwritten; an old active focus could be restored | **Fixed:** capture storage and rendered learning/preferences before save, then compare raw storage and a latest-state ref after the await. Reject stale application before restoring either state. |
| Learning persistence failure could be followed by preference restoration | A partial local write could grow before failure was surfaced | **Fixed:** read back learning immediately; stop before preference update on failure. Missing first-write storage produces a readable save error. Final normalized read-back still verifies the full desired envelope. |
| Expired replay cleanup was rolled back with a rejected PUT | A409 conflict denied data, but expired stored content/idempotency rows could remain despite attempted cleanup | **Fixed by root:** expiry purge commits independently before the throwing CAS transaction. Regression verifies expired PUT409 cannot acknowledge an old operation or restore expired rows. |
| Unknown nested learning/device fields survived the shared envelope | Unsupported client-only fields could be sent despite the contract's whitelist intent | **Fixed by root:** explicit fields for learning/tasks/reviews/events and preference controls; duplicate event IDs rejected. |
| Numeric request IDs were coerced into strings by regex | A JSON number could pass a nominally string idempotency contract | **Fixed by root:** explicit string check, with invalid-key HTTP regressions. |
| Saved JPEG frame previews were present in imported study artifacts | Media bytes could cross the text-only sync boundary, or stripping them could delete the original local preview on apply | **Fixed:** root strips frames from the sync contract; local apply preserves old frames only for a unique matching item/source/artifact with equal normalized non-frame content, otherwise rejects before writing. Incoming frame bytes never replace device originals. |

Attachment source identity is still checked before library application. A device-only Blob is retained only if its item/source is unchanged; deleting/replacing that source produces a specific readable error. Two new failure messages are localized in all five existing UI locales, without exposing arbitrary diagnostics.

## Evidence and limits

**`node tests/sync-http.cjs`:14 checks PASS.** Executes actual HTTP handlers, canonical browser/native authorization, account headers, JSON bounds, shared normalization and real SQLite. Tests anonymous/revoked/origin/cross-account requests, CAS concurrency, lost-ACK replay after a newer write, delete epoch invalidation, strict keys, nested whitelist and duplicate events, forced operation-log trigger failure with full rollback, inactive-account global expiry, expired replay and native device revocation.

**`node tests/sync-client-faults.cjs`:17 checks PASS.** Executes the real `SyncPanel` control flow with a small synthetic hook scheduler, localStorage/fetch fixtures and isolated SQLite. It extracts the actual settings `onApply` arrow from the TSX AST and executes it with injected asynchronous persistence faults; it does not copy that implementation into a second test function. Covers failed/partial apply then retry, lost ACK plus a newer local edit, outbox quota failure, offline first upload, unchanged device Blob/focus/alarm preservation, changed attachment rejection, failed IndexedDB save, focus completion/cross-tab edits/account change during await, failed learning read-back and all five localized error copies. Frame regressions prove that normalization, actual sync PUT bodies, server snapshots and cursors contain no frame bytes, while a valid apply roundtrip retains the original local frame array. Removing/changing the source, artifact ID, summary or provenance (or duplicating an ID) rejects before writes.

These client tests are **control-flow/fault evidence**, not a real DOM/physical-device/browser rendering claim. Browser screenshots and independent OAuth/native-device tests are separate. No real learner data or learning-outcome evidence is manufactured.

Retained suites:**runtime/sync14 and library concurrency10 PASS** in this task. Logs:`sync-http-tests.log`, `sync-client-fault-tests.log`. Root coordinates the full project build, browser QA and release.

## Remaining limitations

- Applying a snapshot spans IndexedDB and localStorage; they do not share one atomic transaction. A fault can leave a partially applied local library, but the UI does not claim success and retains the old merge base/outbox so retry does not reinterpret unapplied remote material as deletion. Backups remain useful before conflict choices.
- The new comparisons close the tested asynchronous save gap. They do not create a distributed lock over every possible localStorage writer in other tabs. Existing local revision/conflict handling remains necessary.
- Synchronization is explicit/opt-in; original binary files, custom alarm media and live focus timers remain on the current device. A successful server write is not enough to show local success; application/read-back must also finish.
- SQLite coordination covers processes sharing the same database, not separate machines with independent ephemeral files. Free-host resets and7-day retention continue to require a fresh epoch comparison.

No new provider, SDK, payment flow or database is introduced by this review. Rollback of the client fixes should not change server account/CAS/ledger boundaries; preserve the regression tests because the pre-fix replay behavior risks data loss.
