# V6 capability coverage and V7 acceptance matrix

Baseline classification before new implementation. COMPLETE is used only for a narrowly verified capability. PARTIAL means useful implementation exists but the full specification is not accepted. BROKEN means a reproduced defect; MISSING means absent; BLOCKED requires an external prerequisite. A fixture test is never called real-user/provider/device validation. Every numbered V6 section is traced below; the checklist records active execution.

| V6 | Capability | Baseline | Evidence, gap and execution phase |
| --- | --- | --- | --- |
|1–2|Source audit and status system|COMPLETE, scoped audit|Both specs/source/evidence read; baseline711/build/TypeScript; PhaseA docs|
|3|Unified application shell|PARTIAL|15learner views,12teacher modules; crowded navigation and differing theme tokens; C|
|4|Onboarding/account setup|PARTIAL|OAuth and teacher approval/location exist; role-specific onboarding/guardian consent incomplete; C/G|
|5|Student workspace|PARTIAL|Library, tutor, review, planner, progress, focus and voice real; simplify navigation and source workflow; C/D|
|6.1|Teacher dashboard|PARTIAL|Real database counts/work rows; dense hierarchy and next-action presentation; C/E|
|6.2|Classes|PARTIAL|Organizations, classes, groups, members, invites and co-teachers; import/attendance/course lifecycle missing; E/G|
|6.3|AI Lesson Studio|PARTIAL|Existing source-aware generator/editor/export; draft guard and contextual workflow needed; C/E|
|6.4|Assignments/assessments|PARTIAL|Issued immutable questions/recipients and due dates; richer attempt/availability policies absent; E|
|6.5|Question bank/exam blueprint|PARTIAL|Question bank, topics/difficulty/source QA; complete blueprint workflow absent; E/G|
|6.6|Grading/feedback|PARTIAL|Auto score appropriate types, teacher review/publish; immutable grade history absent; E|
|6.7|Teaching library|PARTIAL|Reusable scoped text materials; source-version workflow and durable media storage incomplete; D/E/F|
|6.8|Teacher insights|PARTIAL|Observed class/topic scores and alerts; calibration/longitudinal outcomes unverified; E/F|
|6.9|Class communication|PARTIAL|Announcements/events/read scope; no real email/push transport; E/G|
|6.10|Advanced teacher features|PARTIAL|Existing assistant/group features; live sessions, course planning/versioned collaboration incomplete; G|
|7|Parent workspace|MISSING|PARENT enum is not a verified guardian relationship or portal; consent/data-access design first; G|
|8|School/organization workspace|PARTIAL|Membership and class scope real; seats, centralized policy and broader admin tools absent; E/G|
|9|Platform administration|PARTIAL|Six real permission-filtered modules; malformed user-action defect; B/C|
|10|Real AI integration|PARTIAL|OpenAI/Gemini generation, xAI speech; actual examples exist, new quality acceptance pending; B/D/H|
|11|Tutor|PARTIAL|Canonical history, three meaningful hints and explicit full-answer gate; broader pedagogy evaluation pending; B/D|
|12|Documents/RAG|BROKEN, scoped tokenizer|PDF page/DOCX paragraph/PPTX slide, source proof and bounded hybrid retrieval exist; CJK/Korean queries dropped; OCR partial; D|
|13|Learning pack|PARTIAL|Summary/chapter/map/cards/MCQ/review/audio; complete linked glossary/short-answer/worked-example lifecycle absent; D/G|
|14|Math/STEM verification|PARTIAL|Exact rational algebra/domain/substitution/limited completeness; arbitrary geometry/prose/units not verified; D|
|15|Quiz quality|PARTIAL|Structure, duplicates, references and bounded math checks; semantic/age suitability needs evaluation; D/E|
|16|Adaptive learning|PARTIAL|First-choice evidence, difficulty and spacing; heuristics are not calibrated mastery; F/G|
|17|Knowledge graph|PARTIAL|Seven-topic declared prerequisite graph; not automatic arbitrary-curriculum knowledge tracing; F/G|
|18|AI evaluation lab|PARTIAL|CLI evaluations and historical reports; versioned multilingual aggregate/human review missing; D|
|19|Image/homework|PARTIAL|Image/AI input exists; handwriting/OCR/correctness across curricula not accepted; D/G|
|20|Voice/audio|PARTIAL|Turn-based STT/tutor/TTS and playback; session settlement defect; realtime/interruption/device proof incomplete; B/G/H|
|21|Video learning|PARTIAL|Whole-media checkpointed jobs, parts/chapter/timestamps; running worker and provider limits remain; D/F|
|22|Student analytics|PARTIAL|Activities, quiz scores, review/focus and streak; not proof of knowledge gain; F|
|23|Teacher analytics|PARTIAL|Class/topic summaries using observed submissions; no fabricated forecasts; E/F|
|24|Organization analytics|MISSING|No complete aggregate authorized organization analytics workspace; G|
|25|Unified search|PARTIAL|Command/library/teacher search and bounded RAG; cross-space semantic permissions and navigation need work; C/D|
|26|Memory/notes|PARTIAL|Account-local notes/preferences/optional sync; pedagogical memory correction/history incomplete; D/G|
|27|Collaboration|PARTIAL|Scoped class/assignment/communication; realtime document collaboration absent; G|
|28|Plans/entitlements|PARTIAL|Server plans/features/illustrative pricing; no real merchant activation; B/G|
|29|Credits/costs|BROKEN, scoped replay|Atomic reservations/refunds exist; repeated HTTP intents can duplicate work; B/F|
|30|Payment lifecycle|BLOCKED|User requested no real charges; merchant/store/webhook reconciliation not integrated; G|
|31|Authentication|PARTIAL|OAuth, device sessions and revocation; consistent intended-account binding needed; B|
|32|Authorization|PARTIAL|Real organization/class ownership checks; maintain cross-role/tenant regression; B/E/H|
|33|Application security|PARTIAL|URL, payload, rate/budget, audit and CSV protections; strict malformed action fixes needed; B/H|
|34|Prompt injection|PARTIAL|Untrusted source separation and proof checks; semantic resistance requires versioned provider evaluation; D/H|
|35|Privacy/minors|PARTIAL|Disclosure, opt-in index/sync, deletion controls; guardian/legal operational acceptance absent; D/G|
|36|Accessibility|PARTIAL|Existing semantic labels/dialogs/reduced motion; modal/tabs/drawer/draft issues; C/H|
|37|Database architecture|PARTIAL|SQLite migrations1–13 and transactions; free deployed volume ephemeral, multi-instance Postgres absent; B/F/G|
|38|Background jobs|PARTIAL|Persisted checkpoints/leases/fencing/retry/cancel; no independent durable worker deployment; F|
|39|File/object storage|PARTIAL|Browser files and bounded server text index; no durable cloud object service; D/G|
|40|Reliability/performance|PARTIAL|Build, limits, bounded fallbacks/jobs; recovery and load acceptance incomplete; F/H|
|41|Observability|PARTIAL|AI usage/audit/model data; coherent per-feature cost/error acceptance needed; F|
|42|Deployment/environments|PARTIAL|Free Render public and isolated local checks; new release and rollback acceptance pending; F/H/I|
|43|CI/CD/code quality|PARTIAL|Tests/typecheck/build scripts; no lint command; preserve historical evidence and add phase automation; F|
|44|Responsive web|PARTIAL|Existing responsive UI and fixture tests; seven-width new interaction acceptance pending; C/H|
|45|Mobile strategy|PARTIAL|Flutter Android-first and Electron source, device pairing/sync; signed releases/device tests absent; B/G|
|46|Integrations|PARTIAL|Existing Google/Facebook and providers; external LMS/live conferencing not implemented; G|
|47|Learning loop|PARTIAL|Source→understand→practice→review already supported; simplify next action and prove retention separately; C/F|
|48|One source/multiple experiences|PARTIAL|Existing linked Studio activities; coherent pack/version lifecycle incomplete; C/D|
|49|Learning outcomes|BLOCKED, human evidence|Usage and quiz observations exist; real pre/post/delayed study unavailable; F/G|
|50|Functional tests|PARTIAL|711baseline assertions; added phase regressions and real workflows pending; allphases/H|
|51|AI tests|PARTIAL|Historical scoped math/source/provider examples; broad truthful quality report pending; D/H|
|52|Security tests|PARTIAL|Existing role/tenant checks and five new reproductions; targeted fixes/retests pending; B/E/H|
|53|UX tests|PARTIAL|Historical55fixture+32SSR teacher checks; new responsive/keyboard/dirty-state acceptance pending; C/H|
|54|Definition of done|PENDING|Per-feature proof and final acceptance, not UI-only completion; H/I|
|55–56|Priorities/execution|IN PROGRESS|Unified phase plan; continue highest-priority work and retain blocked items; checklist|
|57|Final deliverables|PENDING|Audits/plan/checklist started; accepted source, guides, evidence, deploy and final receipt4 held; I|

V7 trace: sections1–2 map to PhaseA and this status system;3–5 toC;6 toC/D/E;7–8 toC/H;9 toallphase regressions;10 toF/H;11 toH;12 tothis plan and acceptance report;13 remains an invariant throughout. No feature is removed solely to reduce navigation density.
