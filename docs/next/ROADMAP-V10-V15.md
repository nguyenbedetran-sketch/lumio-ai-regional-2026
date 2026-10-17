# Lumio continuity: V10–V15

Requested17 October2026, after the in-progress V9 public/database/evidence release. This document records the next scope; it does not mark it implemented or expand the exact V9 runtime candidate76970b4. Preserve all useful V6–V9 functionality and extend existing systems in small verified phases.

Order: **V10 QA/reliability → V13 security/privacy → V11 AI evaluation → V12 retrieval → V14 performance/cost → V15 onboarding/usability**. Move V12 earlier only if measured retrieval defects dominate. No new paid services, secrets, fabricated production metrics, provider-policy bypass or broad rewrite.

## Evidence-based initial gap matrix

Read-only audit at76970b4; no live account, database, provider or browser actions performed by the auditor. V9's isolated Turso8 and local/Linux checks are separate from production acceptance. No complete V6–V9 implementation is assumed.

| System | Current evidence | Gap and user impact | Risk | Complexity / dependency | Priority / next action |
|---|---|---|---|---|---|
| Backup/recovery | `scripts/database-snapshot.cjs:11`, schema18 integrity; Turso QA process reopen | Snapshot CLI accepts local filenames; no independent remote restore rehearsal or measured RPO/RTO | Data integrity: high operational gap | M; approved operator export and separate restore destination | P1 V10: consistent private QA export, restore separately, compare canonical UUIDs/grades/receipts/sync/wallet/guards; no public broad backup endpoint |
| Account link intent | Origin, recent authentication, hashed single-use intent and session-version checks exist | `account-connections.tsx:114` loads once and sends provider only; `api/account/link/route.ts:8` uses current cookie without matching displayed page account. Stale-tab account switch may initiate linking for another current account | P2 source-level intent mismatch; not dynamically reproduced or proven exploit | S; isolated tests, no credentials needed | Reproduce locally, bind request to displayed canonical account, test switch/expiry/replay before redirect |
| Auth journey QA | `tests/auth-security.cjs:89` covers JWT, revocation and callback races through store/direct callbacks | No complete compiled NextAuth HTTP/cookie cancellation/state/link-cleanup/concurrent-tab/DB-interruption matrix | P2 broken critical journeys | M; isolated auth transport fixture | Add supported HTTP integration tests, no production bypass route; real Google/Facebook gate remains separate |
| Tenant isolation | Existing teacher access and teaching tests deny outsiders; server scope/classes/source/grades checks | No leak found in sampled code; case-based tests are not exhaustive | P2 privacy assurance | M; two-org/two-class existing handler fixtures | Cover every read/export/history/mutation, removed membership and session; assert private markers absent from success and errors |
| Browser defenses | API private/no-store/nosniff in `access.ts:101` | App-level framing/CSP/referrer policy not declared in next.config; infrastructure headers not yet inspected | P2 hardening gap | S–M; inventory voice/video/embed/theme requirements first | Add compatible framing/referrer protections and staged CSP tests |
| Continuous acceptance | SHA-pinned Linux aggregate/build/native/typecheck | Browser scripts and dependency review are outside CI | P2 regression risk | M; supported isolated browser runtime | Add minimal browser smoke and explicit dependency-audit gate |
| Operations runbook | Existing V7 runbook is reusable historical guidance | It still calls schema17 current, while code expects18 and candidate supports remote | P2 operator error | S; no external access | New active schema18/remote runbook; retain old evidence and label limitations |

## Later dimensions awaiting full audit

- V11: reuse existing math checks, citation/source evaluation, prompt-injection fixtures and provider-attempt accounting. Audit actual benchmark coverage per subject, correct answer/rationale/source labels, calibrated grade suitability and model/prompt comparison. No model calls or spending merely to create a table.
- V12: reuse RAG ownership, source proofs, tokenizer/index lifecycle and keyword/hybrid retrieval. Check duplicate/version handling, page/paragraph provenance and organization isolation before changing retrieval.
- V14: use measured latency and provider ledger, never speculative cache across accounts. V9 remote QA measured12 teaching mutations median8.15s/max11.35s from this machine; synchronous bridge is bounded but blocks event loop and is not a scale claim. Audit streaming, queue, retry/timeout/quota and private cache boundaries before optimizing.
- V15: audit existing onboarding, local import/export, mobile/PWA and feedback. Separate activity/time/completion from demonstrated knowledge mastery; parent experience must not imply unapproved access to student data.

## Execution checklist

- [x] Record user order and inspect current architecture/implemented tests at76970b4.
- [x] Establish scoped local/Linux/Turso QA baseline in V9 reports; no production claim.
- [ ] Public release/submission is deferred until the requested next phased work and acceptance; a later cutover still needs the explicit old-data decision.
- [x] Reproduce account-link mismatch at76970b4 and implement smallest guarded fix;14 focused +9 existing auth checks and TypeScript passed with synthetic session/transport/hooks and real in-memory SQLite. Full browser/OAuth acceptance remains separate.
- [ ] Design/perform isolated remote restore with approved destination; verify actual recovery.
- [ ] Extend critical auth/privacy regression and active operational runbook.
- [ ] Audit V11/V12/V14/V15 in depth before claiming their feature status.

Current blocker for the earlier release: no full export route or free-host shell on the old Render instance. A full migration requires a valid private snapshot; a fresh database requires explicit acceptance of old server data not being fully migrated. Browser backup is partial only. See `../v9/CUTOVER-AUDIT.md` and `../v9/CHECKLIST.md`.
