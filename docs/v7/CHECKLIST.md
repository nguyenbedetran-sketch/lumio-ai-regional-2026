# Persistent implementation checklist

Updated: 2026-10-16. Source baseline: `31aff071`. Work branch: `codex/v6-v7-upgrade`. This file is the execution state; [FEATURE_MATRIX.md](FEATURE_MATRIX.md) is the full V6 capability scope. `DONE` means the stated scoped task passed its named gate, not that a broad product area is complete.

| ID | Task | State | Verification / next step |
| --- | --- | --- | --- |
| A01 | Read both specifications, reconcile priorities | DONE | Full V6 1551 lines + V7 908 lines; unified plan written |
| A02 | Verify GitHub baseline and accessible evidence | DONE | Remote/local31aff; public shell inspected;12 Drive items and historical12-page PDF reviewed |
| A03 | Baseline regression/build/TypeScript | DONE | 711 assertions; build exit0; TypeScript exit0; lint unconfigured |
| B01 | Strict admin/job action validation | DONE | New actual-handler/SQLite safety30 and full regression PASS |
| B02 | Canonical account/session binding and settlement | DONE | Stale-account/revocation/cancellation tests; RAG actor binding included |
| B03 | Persistent paid HTTP idempotency | DONE | Migration14; AI/voice/paid-RAG; safety30 +RAGbilling27; no output replay or durable-hosting claim |
| B04 | Web/Dart client intent and account headers | DONE | Web18; Flutter92/analyze0; read/storage/JSON5xx failures preserve identity; no physical-device proof |
| C01 | Teacher navigation, modal/tabs, draft guards, confirmations | DONE |129 browser +32 SSR/pure; synthetic HTTP, seven widths; retained12 destinations |
| C02 | Learner navigation, drawer and action hierarchy | DONE |172 browser +6 syntax after Settings acceptance; retained13 destinations+settings; shared draft guard and delayed-file cancellation |
| C03 | Source/Studio/settings interaction simplification | PARTIAL | Studio nests generation; settings use three keyboard-accessible disclosures; 172 checks include five locales/mobile RAG title/focus. Cross-workspace theme consolidation remains |
| D01 | Unicode lexical retrieval | DONE |20 deterministic checks, five languages and preserved historical7-query vector replay; no new provider calls |
| D02 | Source navigation and local/index delete lifecycle | DONE, scoped | Exact current source selection/PDF page, labeled RAG snapshot excerpts; transactional all-workspace owned index deletion10; conversation retention unchanged/disclosed |
| D03 | Versioned AI quality evaluation and honest reporting | PARTIAL |46 offline cases/219 assertions;13 evaluator +24 live-runner +10 tutor prompt checks;70 real HTTP calls:39 original tutor,19 targeted tutor,6 original content,6 targeted content. Separate developer reviews preserve original errors and narrow follow-up results; no broad semantic PASS |
| D04 | Source-sized generation and conflict-faithful summaries | DONE, scoped |12 prompt checks;14 option-order groups/960 batches/5280 identities.6 follow-up HTTP outputs independently read;7/7 exact references, short source1 card/1 quiz, no invented20/30 chronology observed. Unicode cue patch offline-only; no general semantic dedup/entailment claim |
| E01a | Append-only assessment history and reviewed regrading | DONE, scoped | Migration15;24 actual handler/SQLite +47 browser +compiled HTTP PASS. Synthetic accounts only; no real grading pilot |
| E01b | Controlled practice retakes and availability windows | DONE, scoped | Migration16;24 handler/SQLite +42 browser +15 focused pure/SSR PASS; compiled HTTP checks acknowledgement/replay/preopen redaction/privacy. DOM contrast samples and mobile confirmation readable; not full WCAG certification |
| E02 | Teaching workflow and tenant isolation acceptance | PARTIAL | Actual handler/SQLite and11 compiled HTTP groups PASS including tenant/private projection/history. Real-participant acceptance remains NOT_TESTED |
| F01 | Backup/restore/migration/rollback acceptance | PARTIAL | Schema16:21 new +9 legacy ops PASS; genuine13/14/15 read-only backup and restored-copy upgrade accepted. Canonical48table/52definition/6guard contract; compiled restore accepted. Real off-host/RenderFree DR not performed |
| F02 | Cost/error reporting and bounded job reliability | PARTIAL | Outcome aggregation14 PASS. F02a0 RAG omitted/invalid tokens stay NULL, observed0 stays0;32 billing checks, unchanged charge/replay. Per-attempt metadata/rate/budget/invoice design documented, not implemented |
| F04 | Continuous verification | DONE, checkpoint | Secret-free pinned workflow passed exact9f4a376 on GitHub fresh frozen install/regression/build/typecheck. Later D04 commit still needs its own remote check |
| F03 | Learning outcome/pilot workflow | PARTIAL | Concrete pre/post/delayed protocol linked; old CSV remains header-only. No real participants/outcome data; NOT_TESTED |
| G01 | Remaining V6 backlog traceability | PENDING | Follow feature matrix; no fake menus or broad completion claims |
| G02 | Durable multi-instance production database/storage | BLOCKED | Current user requires free hosting; no durable external service configured |
| G03 | Real merchant billing/store releases/device acceptance | BLOCKED | Merchant/platform credentials, signing and physical-device validation absent; actual charges remain off |
| G04 | Guardian and human pilot evidence | BLOCKED | Verified guardian relationships/consent and real participants absent |
| H01 | Integrated regression and seven-width accessibility review | DONE, scoped checkpoint | D04 full test:all/TypeScript/build exit0;390 browser checks+shared32/pure15/syntax6;11 compiled HTTP groups PASS.19 current captures catalogued; scoped DOM contrast, not whole-app accessibility certification |
| H02 | Bounded real-provider and deployed version smoke | PARTIAL |70 actual provider HTTP calls reviewed separately; local synthetic auth only. New public deployment/OAuth smoke not performed |
| I01 | New source/evidence package and GitHub release | PENDING | CRC, freshness, secret scan, accurate status documentation |
| I02 | Final submission4 | HELD | Only after accepted deployed release + accessible evidence; preserve receipts1–3 |

Next: implement the bounded per-provider-attempt accounting design, then continue remaining V6 gaps and deployed acceptance. Tutor repetition/clarification/domain wording and broader semantic quality remain known limitations; do not tune or label them solved without separate evidence. Full test:all, TypeScript, build, UI and compiled HTTP gates passed the scoped D04 RC checkpoint. Preserve all70 actual-call transcripts and original errors. No V6/V7 public deployment or final competition submission4 has been made.
