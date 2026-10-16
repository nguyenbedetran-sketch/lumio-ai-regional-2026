# V6 + V7 acceptance report

Status: implementation in progress. Final acceptance, deployment and competition receipt4 are not complete.

## Phase A — audit and baseline

Source: remote/local `31aff071dbb95aee37a77fa8f8d6822240b10344`, version `3.2.0-teacher.1`, schema13. Both specifications completely read; architecture, routes, UI, security and evidence audited before runtime code changes.

| Check | Actual result | Scope |
| --- | --- | --- |
| `pnpm test` | PASS, exit0, 711 assertions | Existing deterministic/SQLite/intercepted-provider suites; not new real-provider quality validation |
| `pnpm build` | PASS, exit0 | Production compilation and route generation; not a deployed smoke test |
| `pnpm typecheck` | PASS, exit0 | TypeScript |
| Lint | UNCONFIGURED | No lint script; no invented PASS |
| Public learner DOM | Inspected live | Existing3.2 shell and disclosure only |
| Drive evidence |12items inspected; PDF read | Historical proof types and scope catalogued; no new upload |

Baseline dependencies emitted an out-of-sync node_modules/lockfile warning; the existing install still completed tests/build/typecheck. No dependency upgrade was performed. Five backend defects and a multilingual retrieval defect were reproduced separately, showing that passing old tests does not establish completeness.

Subsequent phases append their actual tests and limitations here. The [persistent checklist](CHECKLIST.md) retains pending and blocked work.

## Phases B/C/D — local security, navigation and source workflows

Implemented in the existing stack with no new dependencies. Migration14 introduces output-free HTTP receipts for AI, voice, paid hybrid retrieval and embedding requests. Canonical actor/session/source checks run before dispatch and inside settlement. Strict action enums, transactional owned-source deletion and Unicode retrieval were added. Existing teaching/learner destinations are grouped; draft protection, named modals, keyboard tabs, mobile focus and explicit destructive-action review are shared. Studio generation is nested, and current-source/PDF/snapshot citations have distinct truthful actions.

| Check | Actual result | Scope |
| --- | --- | --- |
| `pnpm test:all` | PASS, exit0 |711 existing checks +116 new checks (30API,10lifecycle,27RAG billing,18web intents,20tokenizer,11evaluation runner); provider transport intercepted |
| Offline AI corpus |46/46 cases,189 internal assertions | Authored five-language fixtures; not model answer/injection resistance or real learning evidence |
| Teacher UI |129 browser +32 SSR/pure PASS | Actual React/CSS with synthetic HTTP; seven widths; source/image review |
| Learner UI |127 browser +6 syntax PASS | Actual React/CSS with synthetic HTTP; seven widths, source navigation, draft and delayed file cancellation |
| Native Flutter |92/92 tests,0 skipped; analyze0 issues | Existing SDK/locked dependencies, source/widget/mock HTTP; no APK/device/store release |
| TypeScript |PASS after runtime fixes | Production build also completed its type checks |
| `pnpm build` replacement run |PASS, exit0; compiled without package-import warning | Production compilation/route traces, not a deployed/public smoke test |
| Independent review |Two costly retry failure classes found and repaired | Storage-read/corrupt metadata and parsed gateway5xx; regression added, no paid transport |

The first full rerun stopped because legacy voice/readout tests had no browser storage fixture; a subsequent rerun stopped on a stale schema13 assertion. Their fixtures/expected current schema were updated without weakening authorization checks. The third full run passed. The first build attempt exposed a package-JSON named-import warning and was interrupted to correct the import; the replacement build must exit successfully before acceptance. Initial UI/capture failures and repairs are retained in the V7 evidence/work logs rather than represented as an unbroken first-run success.

Limits: paid output is not cached; a completed lost audio/non-tutor result cannot be silently regenerated. Receipt metadata lasts7days; financial ledger tombstones last longer while the database survives. Browser unresolved intents do not silently expire; native old uncertain intents stop with an explicit state. Ephemeral hosting resets cannot preserve exactly-once history. RAG's authenticated HTTP abuse limiter still counts retries; paid AI quota/credits/provider transport do not. No new live AI generation, public deployment, human study, guardian verification, actual payment or final submission4 has been performed.

## Subsequent scoped E1/F checks (not a new full-release acceptance)

- **Grade history, schema15:**24 handler/SQLite checks PASS. Grading, publication, immutable events, CAS, replay, quotas and transaction fault rollback were exercised on isolated databases. Teachers can review prior grades; regrading needs a reason, withdraws the current result and requires separate publication. Student history contains only their published versions and omits internal reasons, staff identity and drafts. Legacy unknown actor/time stays unknown.
- **Grade-history UI:**47 browser checks PASS, plus32 reused SSR/pure checks; existing teacher129 browser checks PASS. Seven widths, explicit regrade review, old published result, pagination, same-UUID retry and stale-account/organization response isolation are included. These are actual React/CSS with synthetic HTTP, not real student grades.
- **Settings simplification:** learner acceptance now172 browser +6 syntax checks PASS. Existing settings controls remain mounted behind three disclosures; Enter/Space, five locale catalog labels, narrow-screen indexed-source metadata and inset focus were checked and screenshots reviewed.
- **Recovery/integrity, schema15:**17 new operations checks plus9 existing operations,23 queue and14 runtime/sync checks PASS. Snapshot/restore uses disposable SQLite, preserving authored grade/receipt/sync/ledger rows. Independent review reproduced two additional gaps (mislabelled14 metadata over15 objects, malformed table with canonical guard names); canonical versioned table SQL and known-future-object rejection now close those gaps. A same-column table missing a CHECK is also rejected. Genuine14 inspection remains compatible. A rollback requires the matching older database snapshot and older application artifact.
- **Still pending:** E2 schema16 integration, final full regression/build/compiled HTTP, remote CI, real-provider quality review, deployment, final packages and receipt4. The operations suite's simulated reduced-migration runtime is not proof that a historical released binary was executed. Free ephemeral hosting durability remains an explicit external limitation.

## Integrated schema16 RC checkpoint

Source version3.3.0-rc.1. Full `pnpm test:all` exited0 after E2, canonical schema13–16 backup compatibility, usage account-binding correction and tutor-prompt changes. TypeScript and production build exited0. A CSS compatibility warning in the new admin filter was corrected; the replacement compiled successfully and its11-group compiled HTTP smoke passed. There is still no configured lint command. The workspace's pre-existing pnpm layout warning is retained, not called a test failure or a fresh-lockfile CI success.

| Check | Verified scoped result |
| --- | --- |
| Retake/window handlers and SQLite |24 PASS, including explicitly closed future work; no provider/credit calls |
| Current integrity/recovery |21 new +9 existing ops PASS; genuine13/14/15 snapshot remains unchanged; only a separate restored copy upgrades to16 |
| Outcome usage aggregation |14 PASS; recent administrator + intended account for both summary and legacy pagination; no source/profile text or invented prices |
| Integrated browser fixtures |384 browser checks: teacher129, learner172, grade-history47, practice36. Shared32 SSR/pure counted once, plus15 practice checks and6 learner syntax checks;18 images reviewed |
| Compiled Next HTTP |11 grouped workflows PASS against actual handlers and temporary SQLite, including E1/E2, authorization, private answer/history projection and restored rows. Synthetic sessions are not OAuth |
| Offline live-runner safeguards |24 PASS; exact dispatch caps/fallback accounting, terminal-stop behavior, golden root sets, full-error classification and output provenance |
| Tutor prompt contract |10 PASS plus existing24 tutor checks; instruction/parser checks are not proof of provider compliance |

### Actual AI observations, retained separately

The three isolated real-provider runs used **64 actual HTTP attempts** total:39 for the10 original tutor problems,19 for five targeted rechecks,6 for Vietnamese content. These counts include actual transport calls rather than generated fixture answers; they are not a USD cost or a user study. Auth was injected at the harness boundary; no real student, public OAuth, device or production deployment was tested.

- Original tutor run: nine numerical full solutions matched the authored reference sets; the rectangle appropriately lacked a unique numerical area. Independent developer review found a wrong fraction-multiplication instruction in one hint, inaccurate learner-effort attribution, multi-operation roadmaps, repeated clarification and progress issues. Raw output and HTTP failures are preserved.
- Prompt refinement and focused recheck: the specific wrong fraction instruction, false learner credit and square hypotheses did not recur. Four numerical full answers remained correct and the missing-data case remained truthful. Repeated hints/clarification, ambiguous fraction wording and an imprecise domain label still occurred. This is **not** a clean10/10 new-prompt benchmark or complete explanation verification.
- Content run:24 exact references, correct5/5 quiz keys and no canary in the narrow injection sample. Semantic review still found two quiz questions testing the same fact, every correct key at index0, repetitive short-source cards, and an invented time/condition explanation for two conflicting numbers. The unrelated-goal answer safely stated the topic was absent; an uncited scope-disclaimer chapter explains its technical citation PARTIAL. Exact quotes alone did not establish faithful reasoning.
- Two evaluator defects were independently reproduced offline: duplicate numeric candidates were compared as arrays instead of sets, and full-phase HTTP errors bypassed normal error classification. The runner was repaired and24 regressions passed. A separate derived report rechecked the immutable original transcripts; these particular defects did not change the original run's technical classifications. It does not replace the semantic findings.

Reports: `v7-live-tutor-acceptance-20261016.json`, `v7-live-tutor-review.json`, `v7-live-tutor-technical-correction.json`, `v7-live-tutor-targeted-20261016.json`, `v7-live-tutor-targeted-review.json`, `v7-live-content-20261016.json`, `v7-live-content-review.json` in reports/. Raw original/targeted/content SHA-256 values are recorded by their separate reviews. Source-content fixes, remaining V6 work, remote CI, public acceptance, release packages and final competition receipt4 remain pending.
