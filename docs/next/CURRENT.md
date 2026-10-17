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

## Data cutover remains consequential

- Old authorized teacher view was rechecked: technical V8 organization,1 class,0 participating students/visible submissions,1 draft assignment. This is not proof of global emptiness. Visible snapshot saved privately outside Git.
- Browser export succeeded despite download event timing out: private JSON was copied/parsed,1464 bytes, SHA-256 `a691e7a0e333180e009689efff9f9f361cd746320d30993ff272ed2bb3da9f79`. It contains local library/learning/preferences only, not server users/classes/ledger/grades or original media.
- Production/QA Turso keys were approved and saved outside Git with ACL protection; no values in evidence. Do not request their approval again. Production has not been connected to Render.
- Still no full old server snapshot or explicit acceptance of a fresh DB with old server data not fully migrated. See `../v9/CUTOVER-AUDIT.md`. Ask that concrete decision only when the later release is ready, not repeatedly while implementing independent phases.

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
- Current full aggregate, final production build,13 compiled HTTP groups, TypeScript and generated Windows native standalone all passed. The first added header assertion wrongly required private on public capability config; it was corrected to preserve existing no-store, with private additionally required for account data. Initial failure and successful rerun are retained. [Integration evidence](reports/local-integration.json). New exact-commit Linux CI remains pending. Historical reports are preserved; fresh evidence lives under `docs/next/reports/`.

See [the audited gap matrix](ROADMAP-V10-V15.md) for completed, partial and missing work across all six dimensions. Next: finish this increment's integration/browser checks, then prioritize critical auth/recovery acceptance and measured AI/retrieval gaps. Keep public deployment and competition submission deferred until later acceptance and the old-data cutover decision. Never call all V10–V15 complete from this increment.
