# V9 persistent execution checklist

Scope and proof belong to the named stage. A local fixture pass is not public, provider, physical device or production persistence acceptance.

| ID | Item | Status | Proof / next action |
| --- | --- | --- | --- |
| A01 | Read full V9, reference images, existing architecture | DONE | PLAN.md; existing stack and flows retained |
| A02 | Preserve baseline and free-host/payment constraints | DONE | Baseline d758b38/docs, runtime89ddd07/receipt5; branch codex/v9-aurora |
| U01 | Consolidate semantic tokens, shared focus/control/motion | IMPLEMENTED, SCOPED LOCAL PASS | FOUNDATION.md;94 computed-style assertions on representative DOM, not full workflow |
| U02 | Home hierarchy, real progress, cards and compact notice | IMPLEMENTED, SCOPED LOCAL PASS | HOME-REFINEMENT.md;234 workspace checks +10 syntax checks; public integration pending |
| U03 | Theme prepaint/system fallback and real loading skeleton | IMPLEMENTED, SCOPED LOCAL PASS | THEME-LOADING.md;7 unit/SSR +49 Edge checks; public integration pending |
| D01 | Remote store architecture and SDK compatibility | IMPLEMENTED, LOCAL PASS | DATABASE.md; native child isolation, bounded waits, no fallback or automatic mutation retry |
| D02 | Free external DB provisioning and server-only credentials | PROVISIONED; TOKEN APPROVAL PENDING | Separate production/QA classic libSQL databases; Starter Free/no payment method verified; keys not generated |
| D03 | Transaction/FK/CAS/RBAC/ledger/replay/fault regression | LOCAL PASS; REMOTE PENDING | Adapter11, independent14, native parity181, runner selftest8; actual Turso gate awaits credentials |
| D04 | Cutover, restore/persistence proof after restart/redeploy | BLOCKED: OLD SNAPSHOT / OPERATOR DECISION | CUTOVER-AUDIT.md; old deployed service has no full HTTP export; never call a fresh DB a completed migration |
| Q01 | Integrated regression, typecheck, production build | LOCAL PASS; EXACT-COMMIT CI PENDING | qa-integrated-unit.json; standalone Windows native smoke passed, Linux gate added |
| Q02 | Responsive/theme/motion/keyboard/hydration visual acceptance | IN PROGRESS | Actual affected routes, distinguish fixture/public |
| R01 | GitHub CI and public release | PENDING | Free Render, exact runtime commit, no paid services |
| R02 | Fresh source/evidence/PDF/screenshots and Drive checks | PENDING | Immutable hash/CRC/secret scan, render review, metadata/listing/viewer |
| R03 | Submit updated product+evidence once | PENDING | Retain prior receipts, require new portal acknowledgement |

Known limits are tracked rather than called complete. No device/pilot/merchant or calibrated-learning claims are added by V9.

Teacher/Classroom and Admin retain their existing role-specific fixed palettes; they do not yet switch with the learner's global light/dark preference. Accessibility regression and narrow contrast fixes are tracked separately from that remaining theme work. Public deployment, durable-storage acceptance and the next competition receipt remain unverified until their gates pass.
