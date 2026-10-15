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
| C02 | Learner navigation, drawer and action hierarchy | DONE |127 browser +6 syntax; retained13 destinations+settings; shared draft guard and delayed-file cancellation |
| C03 | Source/Studio/settings interaction simplification | PARTIAL | Studio nests generation; redundant task selector removed; settings hierarchy/theme consolidation remains |
| D01 | Unicode lexical retrieval | DONE |20 deterministic checks, five languages and preserved historical7-query vector replay; no new provider calls |
| D02 | Source navigation and local/index delete lifecycle | DONE, scoped | Exact current source selection/PDF page, labeled RAG snapshot excerpts; transactional all-workspace owned index deletion10; conversation retention unchanged/disclosed |
| D03 | Versioned AI quality evaluation and honest reporting | PARTIAL |46 authored offline cases/189 assertions +11 runner checks PASS; semantic/model quality and human review still NOT TESTED |
| E01 | Teacher assessment version/history/attempt gaps | IN PROGRESS | Append-only grade history planned as migration15; implementation held during PhaseB/C/D build; retakes/windows remain subsequent work |
| E02 | Teaching workflow and tenant isolation acceptance | PENDING | Real SQLite/API plus UI; published vs draft results |
| F01 | Backup/restore/migration/rollback acceptance | PENDING | New isolated data and recovery proof; no destructive public test |
| F02 | Cost/error reporting and bounded job reliability | PENDING | Per-feature/model/user attribution, no secret logs, retry fencing |
| F03 | Learning outcome/pilot workflow | PENDING | Real participant evidence is not yet available; never synthesize results |
| G01 | Remaining V6 backlog traceability | PENDING | Follow feature matrix; no fake menus or broad completion claims |
| G02 | Durable multi-instance production database/storage | BLOCKED | Current user requires free hosting; no durable external service configured |
| G03 | Real merchant billing/store releases/device acceptance | BLOCKED | Merchant/platform credentials, signing and physical-device validation absent; actual charges remain off |
| G04 | Guardian and human pilot evidence | BLOCKED | Verified guardian relationships/consent and real participants absent |
| H01 | Integrated regression and seven-width accessibility review | PENDING | After implementation; capture actual failures and repairs |
| H02 | Bounded real-provider and deployed version smoke | PENDING | After local acceptance; never expose credentials |
| I01 | New source/evidence package and GitHub release | PENDING | CRC, freshness, secret scan, accurate status documentation |
| I02 | Final submission4 | HELD | Only after accepted deployed release + accessible evidence; preserve receipts1–3 |

Next: accept the PhaseB/C/D production build, then implement/test append-only grade history (E1), operational recovery/cost fixes, and the highest-priority remaining V6 backlog. PhaseB/C/D full `pnpm test:all` passed (711 existing +116 added checks; corpus count separate). No new competition submission or public deployment has been made for this upgrade.
