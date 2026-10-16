# V9 · Home, tutor entry and compact notices

This is a refinement of the existing learner workspace. It does not add an AI endpoint, change tutor unlocking, or alter account, credit or source permissions.

## Delivered changes

- The existing Home question form has a clearer heading, localized example, source label and a restrained static violet gradient. Ctrl/Command + Enter opens the same **unsent tutor draft** as the existing action; it does not generate an answer. IME composition does not trigger this shortcut.
- The existing draft guard, source selection and transfer into the real tutor remain in place. Clearing or discarding a draft does not resurrect it on tab remount.
- The saved-material shelf retains three actual recent items. Whole cards expose a localized “Open material” action and the full material title to assistive technology.
- The daily plan keeps its existing rule-based choices and one primary action. Home-specific styling reduces heading/card density without changing recommendation or completion logic.
- No goals displays an empty state rather than a zero-denominator progress ratio. Once real goals exist, a native progress element uses their actual completion count and explicitly describes goals marked by the learner, not knowledge mastery.
- The streak uses neutral activity wording and an optional native explanation. It retains the real calendar and count; the dark icon uses the semantic success color. A reproduced pre-existing lag is fixed: the Home/Progress clock refreshes when learning state changes, so a new completed goal is included immediately instead of waiting for the periodic 30-second tick.
- Competition/demo notices use native disclosures. The free-hosting reset warning or disabled-online-services warning remains visible when collapsed; existing detailed storage, quota and payment copy remains available. Nothing is dismissed or stored as a cross-account preference.
- Home entrance motion uses at most 280ms, a 6px translation, no scale and at most 64ms stagger. Counters always display the actual saved metric. Reduced-motion and motion-off paths retain visible content and stop effects.

## Validation

Run `node scripts/test-v9-home-ui.cjs`. The runner reuses the actual-workspace bundler in an isolated output directory and intercepts authentication/HTTP with authored fixtures. The current result and complete check list are in [qa-home-workspace-report.json](qa-home-workspace-report.json).

The checks cover 320/375/390/430/768/1024/1440px overflow, five locales in light/dark at 390px, keyboard focus and disclosure, draft navigation, actual planner goal creation/completion, immediate activity/streak, transfer to an unsent tutor draft, IME-safe shortcut, measured WAAPI options, reduced motion, existing source/citation flows and account remount isolation. Computed Home/heading/input fonts use the established Segoe UI/Noto Sans/Arial sans-serif stack.

Final focused result: **234 checks passed**, 10 syntax checks, no page errors or unexpected requests. There were **0 real provider calls**, 3 intercepted synthetic AI responses and 1 synthetic keyword-search response. `pnpm exec tsc --noEmit` and the scoped `git diff --check` also completed successfully. This is not a full production-build result.

The following authored-fixture captures were opened for visual review; their visible test labels distinguish them from real learner evidence:

- [Light desktop](qa-home-desktop.png)
- [Dark desktop](qa-home-dark.png)
- [390px phone layout](qa-home-mobile.png)

The earlier same-harness baseline is kept in [baseline-home/report.json](baseline-home/report.json) with its desktop/mobile captures. It was recorded before this Home patch while the shared V9 foundation work was in progress, so it is not presented as an untouched V8 production screenshot.

## Scope limits

These are local actual-component browser checks with synthetic identities, material and intercepted responses. They do not validate live OAuth, real-provider output quality, hardware phones, screen-reader usability, or a public deployment. The full public-demo mode was not rerun in this Home-specific browser suite; its compact notice preserves the existing localized details. Broader theme, contrast, loading, backend, production build and deployment gates are separate work.
