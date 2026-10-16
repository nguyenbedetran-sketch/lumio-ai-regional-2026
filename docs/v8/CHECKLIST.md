# V8 persistent execution checklist

Baseline source7244e84 / public2e64bbb / receipt4. Released runtime89ddd07 / public3.4.0-rc.1 / receipt5 at22:21:45 on16/10/2026 UTC+7. Status and evidence are scoped to the named task; no UI-only or synthetic test is called real-user or production acceptance. See [verified release](FINAL_RELEASE_2026-10-16.md).

| ID | Task | State | Evidence / next gate |
| --- | --- | --- | --- |
| A01 | Read, deduplicate and reconcile V8/suggestions with V6/V7 | DONE | 401+99 complete accessible lines, seven files/two hashes; PLAN.md |
| A02 | Inspect existing learner, tutor, voice, teaching and operations code | DONE, scoped audit | Existing functionality reused; reproduced fingerprint/queue/privacy gaps; no new blanket security claim |
| L01 | Shuffled-question identity and legacy evidence integrity | IMPLEMENTED + LOCAL PASS | Reproduce and fix; repeated/shuffled/import/account regression |
| L02 | Due-review priority and manual scheduling | IMPLEMENTED + LOCAL PASS | Overdue before new; explicit override never fabricates activity/mastery |
| L03 | Explainable bounded daily plan and evidence controls | IMPLEMENTED + LOCAL PASS | Real observations, at most three actions; inspect/exclude/restore and backup/sync |
| T01 | Tutor intent and non-advancing clarification | IMPLEMENTED + LOCAL PASS | Preserve three-hint server gate, paid replay and source/maths checks |
| T02 | Private per-turn feedback and continuity | IMPLEMENTED + LOCAL PASS | Migration18; own-account/CAS/replay/revoke/TTL/delete tests |
| V01 | Voice selected source, provenance, continuity and truthful disclosure | IMPLEMENTED + LOCAL PASS | Explicit context choice, canonical restore, audio fallback; no realtime/device claim |
| E01 | Teacher blueprint draft composition and whole-set preflight | IMPLEMENTED + LOCAL PASS | Class/org scope, shortages/no mutation, current reviewed bank, CAS/review/issue gates |
| O01 | Read-only queue-health diagnostics | IMPLEMENTED + LOCAL PASS | 9 actual handler/SQLite +10 browser assertions; recent system.read, transactional revoke guard, aggregate-only |
| U01 | Compact home dashboard, clear source-aware Tutor entry and shared design | IMPLEMENTED + LOCAL PASS | Preserve routes/actions; no fake completion percentages or student data |
| U02 | Responsive, keyboard, readable contrast and reduced-motion acceptance | SCOPED LOCAL PASS | Home197 +Learning44 +Tutor36 +Teacher19 +Admin10; 325/390/768/1440 and five locales scoped by fixture, not WCAG certification |
| Q01 | Integrated regression, real handler/SQLite isolation, build and TypeScript | LOCAL PASS | test:all, Next production build, tsc exit0; reports/integration-gates.json; historical reports retained and current executions under regression-current |
| Q02 | Versioned AI quality/real-provider acceptance | SCOPED PUBLIC PASS; broader benchmark PENDING | 2 actual OpenAI Tutor calls on authored source: progress1/3 then simpler help stays1/3; source/feedback/restore/credit. No general accuracy or independent pilot claim |
| R01 | Exact-source package, evidence PDF/screenshots and secret scans | PASS, package scope | 998 source files match Git89 blobs; source/evidence CRC+hash; all6 PDF pages rendered/viewed; 1050 nested bundle files compared to6 configured secret values, zero matches. Not exhaustive discovery |
| R02 | CI, public deploy, auth/AI/role/version acceptance | SCOPED PUBLIC PASS | CI38918173559 success, Render dep-db93j23bc2fs73cnss9g Live89; 59 HTTP checks, owner Google OAuth, 2 AI calls, private teacher draft and admin aggregate job panel,390×900 Home/Voice. Cross-account roles covered by isolated tests, not fabricated public users |
| R03 | Verified Drive uploads and new competition submission | PASS | Six LAN5 files read back: exact parent/size/anyone-reader; all present among25 folder entries. Anonymous viewer checks for3 main artifacts. Portal confirms5 at22:21:45 UTC+7; reload preserves5; receipts1–4 retained |
| G01 | Verified parent relationship/consent portal | NOT IMPLEMENTED | PARENT enum is insufficient; no sensitive student-data exposure |
| G02 | Real-time voice/pronunciation/native physical-device validation | NOT VERIFIED | No provider/device/human evidence inferred from fixtures |
| G03 | Durable multi-instance database, merchant billing and real learning pilot | NOT VERIFIED | Free-host limit/user no real charges; actual participants/services required |

Continue with the highest-priority open verified increment. Deployment/submission happens after the accepted new release; no deadline-driven false completion claim.

Local acceptance details: [HOME-ACCEPTANCE](HOME-ACCEPTANCE.md), [coverage and gaps](COVERAGE.md). Native source compatibility:25 Flutter Web-sync tests + targeted analyze; no new signed/native/device release. Public/provider/release states below are not inferred from local passes.
