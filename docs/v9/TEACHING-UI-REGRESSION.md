# V9 — Teacher, classroom and admin UI regression

Checked on 17 October 2026 using current React components and CSS in isolated local Edge sessions. No real account, teacher, student, OAuth, AI provider, public server or production database was used. Every screenshot identifies its synthetic fixture.

## Result and scope

`node scripts/test-v9-role-ui.cjs` exited 0 after the approved text-contrast changes.

| Existing workflow reused | Browser checks | Current report |
| --- | ---: | --- |
| Teaching workspace and student classroom | 129 PASS | [Report](qa-role-teaching-report.json) |
| Teacher/student grade history | 47 PASS | [Report](qa-role-grade-history-report.json) |
| Assessment editor and review | 19 PASS | [Report](qa-role-assessment-report.json) |
| Admin teacher review | 31 PASS | [Report](qa-role-admin-report.json) |

The 226 workflow checks use actual components with authored identity and HTTP responses. The builders also passed 32 teaching SSR assertions and 3 admin SSR assertions; the teaching builder's same 32 assertions are reused by three workflows and are not three independent sets. These UI fixtures do not establish server authorization, durability or real classroom effectiveness.

An additional 32 layout observations cover teacher dashboard, classroom published results, assessment editor with a native dialog, and admin teacher review: 320, 390, 768 and 1440 CSS pixels, each with inherited `data-theme="light"` and `"dark"`. This directly tests resolved role CSS; it does not exercise the separate SSR theme bootstrap. The grade-history workflow was rerun functionally but has no separate layout matrix.

No sampled page overflow or clipped header control was found. Tab/Shift+Tab retained a visible focus outline or shadow in each observed state, including the native assessment dialog. Existing workflows also exercised save/retry, published result/history display, role/account changes and hidden-answer presentation with synthetic responses. This is bounded keyboard/layout evidence, not a screen-reader review or a full accessibility certification.

## Narrow contrast corrections

Only eight text-color selectors in `app/teacher/workspace.css` changed. They reuse existing `--tw-muted` (`#5c6a61`); dimensions, backgrounds, workflows and role palettes are unchanged. No admin CSS changed because the sampled admin text did not demonstrate a failure requiring a correction.

| Measured normal text | Before | After |
| --- | ---: | ---: |
| `.tw-stat > div` | 2.18–2.43:1 | 5.07–5.64:1 |
| `.tw-stat p` | 2.52–2.81:1 | 5.07–5.64:1 |
| `.tw-text-button` | 3.66:1 | 5.64:1 |
| `.tw-tabs button` | 2.79:1 | 5.20:1 |
| Selected classroom tab | 3.63:1 | 4.98:1 |
| `.tw-field > span` | 4.31:1 | 5.64:1 |
| `.tw-check` | 3.55:1 | 5.25:1 |
| `.tw-card p.tw-note` | 2.94:1 | 5.28:1 |

The last selector is a scoped override: the more specific existing `.tw-card p` color had overridden the instruction note. The original base `.tw-note` color remains unchanged outside that scope.

Ratios use browser-computed text color and the nearest opaque background, WCAG relative luminance, and a 4.5:1 threshold for these small normal-text samples. The probe takes up to twelve selected visible samples per state. It does not exhaust all text, composite gradients, evaluate every control border/icon against 3:1, or prove every state conforms. The measured teacher/table/modal samples above have plain opaque backgrounds. Admin gradient-containing samples are observations only, not a gradient-composited conformance claim.

The initial local V9 reports and selected captures are preserved in [role-before-a11y](role-before-a11y/). Historical V3/V7/V8 reports and runners were not rewritten.

## Historical theme limitation at the earlier contrast-only phase

**Superseded by the subsequent role-theme phase:** see [Teacher/Classroom acceptance](role-theme/TEACHER-THEME.md) and [Admin acceptance](role-theme/ADMIN-THEME.md). The observations below are retained as the original failing baseline, not current candidate findings.

The matrix deliberately records `THEME_NOT_INHERITED` findings rather than declaring the role theme work complete:

- Teacher dashboard, classroom and assessment shell retain `rgb(245, 245, 240)` in both inherited themes.
- Admin retains `rgb(12, 17, 22)` in both inherited themes.

These separate role palettes remain usable in the sampled layouts, but changing the global light/dark attribute does not change their root surfaces. A broad role-palette migration is outside this approved contrast-only correction. Each functional report's `status: PASS` therefore coexists with `layoutStatus: FINDINGS`; it is not an assertion that all visual requirements passed.

## Visual inspection and reproducibility

The final 390-pixel teacher/classroom/assessment captures and the 1440-pixel admin capture were opened and inspected after rendering. The assessment dialog scrolls internally; its complete save workflow is exercised by the existing browser script, not inferred from a single viewport capture.

- [Teacher mobile](qa-role-teacher-light-390.png) · [Teacher desktop](qa-role-teacher-light-1440.png)
- [Classroom mobile, inherited dark](qa-role-classroom-dark-390.png) · [Classroom desktop](qa-role-classroom-light-1440.png)
- [Assessment dialog mobile](qa-role-assessment-editor-light-390.png) · [Assessment desktop](qa-role-assessment-editor-light-1440.png)
- [Admin mobile](qa-role-admin-light-390.png) · [Admin desktop](qa-role-admin-dark-1440.png)

The new wrapper reuses the existing fixture builders and browser scripts with output-path replacements, writing only `work/v9-role-*` and `docs/v9/qa-role-*`. It opens an isolated local Edge fixture session, does not start Next.js or touch `.next`, and closes its own session afterward. `tests/v9-role-matrix.fragment.js` adds the observations above; original workflow assertions remain in place. `git diff --check -- app/teacher/workspace.css` passed.
