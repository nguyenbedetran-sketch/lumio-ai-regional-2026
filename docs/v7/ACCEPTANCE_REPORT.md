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
