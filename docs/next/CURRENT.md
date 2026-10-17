# Current execution handoff

17 October2026. Latest user direction: **open local for UI review; finish and verify the V10–V15 phased work before the next public release/submission**. This supersedes the earlier plan to cut over V9 immediately. Do not deploy or submit merely because the V9 candidate gates passed.

## Verified V9 baseline

- Frozen candidate `76970b4a1069e3f5232abb9108560f4acce4627b`, tree `87b054eb9d5195473274b9b00df22f79d52997d4`; pushed on `codex/v9-aurora`, draft PR2.
- Linux push run39005981900 completed successfully: aggregate tests, production build, generated native standalone and TypeScript. Previous candidate CI is historical only.
- Actual isolated Turso QA8 PASS, including student submission replay, FK/audit rollback, sync CAS, two-process wallet contention and exact fresh-process canonical recovery. Synthetic data only; not public or restore proof.
- Role theme acceptance and local build are in `../v9/role-theme` and `../v9/reports`. No Render environment/deployment change made. Public still3.4.0-rc.1/89ddd07, competition last confirmed receipt5.
- Source ZIP frozen outside repo under `work/submission6-20261017/candidate-76970b4a1069`; Git blob byte equality, CRC, recognizable credentials and both actual approved DB keys checked with0 hits. V9 six-page PDF is **DRAFT**, visually checked, not uploaded/submitted; future final evidence must include later code and fresh deployment proof.

## Local review requested by user

- Current source development server: **http://127.0.0.1:3035/**, loopback only. HTTP200/title and actual in-app browser state verified; v3.5.0-rc.1 visible. Kept open for user review.
- Dedicated local DB outside repo: `work/v9-local-review.sqlite`. AI disabled, no provider/OAuth secrets loaded. Guest interface is reviewable; real login/AI remain separate connected-environment checks. Do not describe local review as deployed or live-provider acceptance.
- Dev server was started with Node Next CLI `dev --hostname127.0.0.1 --port3035`; environment `LUMIO_AI_ENABLED=false`, `LUMIO_DATABASE_MODE=local-sqlite`, dedicated `LUMIO_DB_PATH`, telemetry disabled. Existing port3000 was left alone.

## Authorized fresh database cutover

- Old authorized teacher view was rechecked: technical V8 organization,1 class,0 participating students/visible submissions,1 draft assignment. This is not proof of global emptiness. Visible snapshot saved privately outside Git.
- Browser export succeeded despite download event timing out: private JSON was copied/parsed,1464 bytes, SHA-256 `a691e7a0e333180e009689efff9f9f361cd746320d30993ff272ed2bb3da9f79`. It contains local library/learning/preferences only, not server users/classes/ledger/grades or original media.
- Production/QA Turso keys were approved and saved outside Git with ACL protection; no values in evidence. Do not request their approval again. Production has not been connected to Render.
- Explicit fresh-start approval received17October: user accepts that old server data has not been fully migrated. Do not ask again. Preserve partial private browser export; never call this a full migration. See `../v9/CUTOVER-AUDIT.md`. Production deployment/persistence acceptance remains pending.

## First V10/V13 increment

The stale-tab account-link mismatch was reproduced using actual component logic and POST handler from76970b4 with synthetic session/hook/transport boundaries and a real in-memory SQLite intent. Showing accountA while the cookie switched toB created a B intent and invoked mocked OAuth. No network/browser/real account involved.

The component now sends the displayed canonical account as `X-Lumio-User`; server requires equality to the current canonical session user before creating any intent or setting a cookie. Missing/mismatch fails401 `SESSION_REVOKED`. The UI removes stale connection rows and gives a localized reload/reconfirm message without starting OAuth. Existing origin, recent-auth, provider, cookie protection, single-use and session-version rules remain.

Root verification: `node tests/v10-account-link-binding.cjs`14 PASS; `node tests/auth-security.cjs`9 PASS; `pnpm typecheck` exit0. Exact f1ac9c28832a7a3b4d4b83b0240f6e62bd80ff04 Linux push CI39006990691 completed successfully. New suite is included in `test:all`. These scoped checks do not prove a complete OAuth/browser journey, pentest or all V10/V13 requirements.

## Current assurance increment

- Legacy admin reads/mutations now require the immutable page account; stale cookie-switch intent was reproduced at f1ac9c2.10 focused groups passed. The console remounts per actor and ignores old responses. No privilege escalation was claimed from the original two-admin mismatch.
- RAG list and embedding preflight pass the captured session version into the existing transaction;10 focused and86 existing checks passed. This closes a revoked-session metadata/cleanup race, not a demonstrated cross-owner full-text leak.
- Manual backup import waits for library ACK before applying study stores, verifies later writes and reports persistent failure/partial completion.23 focused,10 concurrency and17 sync checks passed.20 isolated browser checks passed with real IndexedDB/localStorage, success/aborted transaction/partial failure, accessible statuses and390px layout. All3 screenshots were reviewed; no outbound/paid requests or page errors. Wording was corrected in5 languages to avoid promising preservation of every concurrent edit;23 focused and20 browser checks reran successfully, then the final production build passed. Separate stores and localStorage check/write interleaving across tabs remain non-atomic. [Browser evidence](reports/backup-import-browser/report.json).
- API/auth error IDs now have matching bounded sanitized stderr events:10 focused groups passed. Only safe codes/IDs/status/static context are logged; no private body/header/exception or external service.30/min process cap means suppressed failures have no matching event; no request/latency denominator or universal-route monitoring claim.
- Shared framing-only CSP/DENY/nosniff/referrer configuration:24 assertions passed. Full script/connect CSP is deferred; compiled HTTP response coverage is in the existing production suite, now wired into CI.
- Actual Turso QA export restored into a separate new local file:51 tables/all rows/6 guards equal,23 tables nonempty,0 FK violations, source bytes unchanged. Grade history was empty; nonempty recovery is a separate existing fixture. Private data files are outside Git; [sanitized report](reports/remote-export-local-restore.json). No cloud re-import, production migration, automatic off-device backup or RPO/RTO claim. [Active operations guide](OPERATIONS.md).
- Added versioned offline evaluation using actual production diversified top6 selection:51 unique cases and7 separate historical top3 comparisons;19 regression groups passed. Explicit observed token-overlap false positive and missed nonnumeric conflict. No provider/model/student quality acceptance inferred.
- Registry production dependency audit returned0 known advisories at the recorded time. An audit step now gates high/critical advisories in CI; this is not zero-day/source/dev/OS/browser assurance.
- Current full aggregate, final production build,13 compiled HTTP groups, TypeScript and generated Windows native standalone all passed. The first added header assertion wrongly required private on public capability config; it was corrected to preserve existing no-store, with private additionally required for account data. Initial failure and successful rerun are retained. [Integration evidence](reports/local-integration.json). Exact pushed code6976f33ed0583d4cb145a0eb6c02e3c7c768c4d1 Linux CI39009035660 completed successfully, including dependency audit, aggregate, build, compiled HTTP, native standalone and TypeScript: [CI evidence](reports/ci-6976f33.json). Historical reports are preserved; fresh evidence lives under `docs/next/reports/`. This later local documentation records acceptance of that frozen code; it introduces no runtime change.

See [the audited gap matrix](ROADMAP-V10-V15.md) for completed, partial and missing work across all six dimensions. Next: finish this increment's integration/browser checks, then prioritize critical auth/recovery acceptance and measured AI/retrieval gaps. Keep public deployment and competition submission deferred until later acceptance and the old-data cutover decision. Never call all V10–V15 complete from this increment.

## Second bounded increment and release authorization

User reviewed the local UI and instructed completion, publication and final competition submission with evidence. Fresh Turso initialization explicitly approved, with incomplete old server migration accepted. Phase2 adds compiled NextAuth/OIDC fault acceptance and private framework logging, narrow source conflict/missing-data checks with Grade9 holdouts, measured p50/p95/error denominators, and existing-goal onboarding/personal search. Scoped agent checks passed; combined final integration and exact Linux CI are still pending. Parent access, full semantic answer-key verification, general semantic conflict resolution, cloud restore/PITR, offline/OS install and real student outcomes remain incomplete, not silently marked complete.

### Phase2 scoped acceptance before content-rendering follow-up

- Combined aggregate exit0 and production build exit0 on17October, before the later renderer follow-up. [Aggregate](reports/phase2-regression/run.json).
- Actual compiled NextAuth HTTP10/10, with child-only authored OIDC transport, real CSRF/state/PKCE/JWT checks, canonical SQLite and privacy logger acceptance. No real Google provider request: [receipt](reports/phase2-auth-http-accepted.json).
- V11 held-out authored Grade9 grounding17 groups and production-core retrieval evaluation19 groups/63 cases passed. Narrow direction identity preserves Vietnamese names/Unicode normalization. Actual provider6 content calls and7 tutor calls were reviewed separately; a quiz option ambiguity and unsupported tutor attribution remain explicit failures of semantic/pedagogical acceptance, not relabelled as PASS: [content review](reports/phase2-ai/live-content-developer-review.json), [tutor review](reports/phase2-ai/live-tutor-developer-review.json).
- V14 distribution checks12, existing usage14/attempt12 and browser86 passed. Same bounded aggregate SQL count; null cost/unknown latency and exact denominators remain explicit. [Evidence](reports/v14-telemetry/).
- V15 optional goal setup/personal-device search unit12/browser23 passed; all3 screenshots reviewed. Manifest metadata exists; install eligibility/OS installation/offline remain unverified. [Evidence](reports/learner-phase2-browser/report.json).
- New user steering17October: read complete content-rendering specification and prioritize raw LaTeX/Markdown repair, safe legacy rendering, teacher preview and regression coverage before release. Shared renderer and consumer work is in progress; do not deploy earlier accepted build as if this follow-up were complete.

## Final integrated candidate in progress,17October afternoon

The latest instructions add teaching attachments and Premium/Pro before public delivery. The canonical database is now schema20 (54 tables,11 immutable guards); historical schema18 restore receipts remain unchanged. Shared rendering has27 SSR/security and56 browser checks, plus teacher preview24 and the AI formatting contract3. Teacher/student file UI has explicit selected/pending/submitted states. Paid policy backend21, old billing14/AI-billing12 and paid/admin browser33/27 passed in isolated fixtures. These checks do not replace the pending connected compiled browser and remote acceptance.

Independent reviews caught and corrected a student-upload JSON contract mismatch and a legacy paid catalog configuration bypass. A later actual QA submit transaction timed out; its prior remote PASS is not final acceptance. A narrow transaction-local authorization-query reduction is being measured. The latest full aggregate also exposed old test-loader/current-schema assumptions; those are being repaired without changing historical snapshot expectations. Production build before the final policy/performance delta passed; it will be rerun.

Latest old public teacher read, after the earlier snapshot above:1 participating student,2 visible submissions (one graded but unpublished, one pending),1 draft lesson and2 assignments. Visible lesson fields and submission views were preserved privately outside Git. This still is not a full server backup. User's explicit fresh-start approval remains the cutover decision; any recreated lesson must receive a new identity rather than be described as migrated history.

An actual QA cloud point-in-time branch was created and all51 table counts matched the earlier exported baseline. The cloud branch's complete row content was not compared; no production RPO/RTO claim. See [final release gates](FINAL-RELEASE-CHECKLIST.md). Public remains on the earlier release and the last confirmed competition receipt remains5 until actual deployment/submission proof is captured.

### Final local and QA acceptance

The subsequent query reduction retained the15-second transaction budget. Actual QA file15 and canonical8 groups passed on current schema20; the measured three-file fixture used38 SQL RPCs/8.348s, not a load SLA. Full `pnpm test:all`, production build, TypeScript and Windows standalone passed. Compiled teaching/file HTTP19 and connected browser23 passed; browser-saved PNG/DOCX/PPTX bytes and SHA matched originals. The connected browser used synthetic signed identities and actual business APIs, not intercepted business responses. Real public Google sign-in/restart remain release gates.

The global Next header rule initially replaced download sandbox CSP. A specific final file-route rule repaired the actual compiled response; the stronger header was reverified. Prior diagnostic failures remain archived. `reports/final-local-acceptance.json` records current runtime source hashes and scoped commands; exact pushed SHA Linux CI and public release/receipt are still pending at this source freeze.

### Canceled rollout and compiled remote startup correction

Candidate0d2e85bf2ffb passed exact Linux push CI39017372569 but its first Render rollout never became ready. It was canceled at15:41:20 Asia/Bangkok; the previous public release stayed live. A compiled numeric driver identifier could not be loaded by the separate native Node child. Source-transpiled native tests and local-adapter compiled HTTP tests had missed that combination. The correction and new actual compiled remote-mode regression are documented in [the incident record](COMPILED-DATABASE-INCIDENT.md). Production keeps the approved remote-only configuration; health is not weakened and no temporary local fallback is introduced. New compiled native/QA, exact-source CI and public persistence acceptance remain separate release gates.

The latest UI request adds a billing confirmation centered in the entire viewport, with independently scrolling content and a persistent visible payment footer. It uses a native dialog portaled to the document body. The payment button checks the existing checkout endpoint and states its actual unavailable reason. No merchant is connected, transaction created, credits granted or plan changed. Free/Plus prices, entitlements and wallet rules remain unchanged.39 browser checks passed across1440/390/320px, light/dark, keyboard/focus and guest-login layering. Four scoped screenshots were reviewed.

The subsequent final build, generated/source TypeScript and compiled auth10 passed. The compiled remote-mode native path passed4 checks, actual packaged standalone broker/native Unicode write/read/close passed, and compiled HTTP health reached actual isolated Turso QA twice without a transport preload. Final focused native11 also passed. The combined Windows aggregate passed before the last narrow driver/guest-dialog change; these focused checks reran after it, and exact Linux CI must still repeat the aggregate on the final pushed commit. Production credentials have been saved only to the approved Render service; the canceled deployment did not establish application schema. A new successful deployment and genuine public persistence verification are still required.
