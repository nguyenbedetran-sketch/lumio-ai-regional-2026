# UI/UX baseline and simplification decisions

Source baseline `31aff071`, live public learner shell inspected 2026-10-16. Preserve working features and reduce simultaneous choices.

| Finding | Incremental response |
| --- | --- |
| Learner 13 flat navigation buttons, duplicated space creation and account/settings controls | Five primary destinations; named secondary tools/library/account groups; one space creation action |
| Teacher 12 flat modules and oversized hero | Five frequent destinations; disclose preparation, tracking, communication and account tools in groups; prioritize actual work |
| Three layers of document/Studio/task selectors | Make the selected material and active learning activity clear; retain existing generators without duplicate task navigation |
| Teacher editor drafts lost on module switches | Guard navigation/close/unload with retain/discard choice; do not auto-submit |
| Destructive and role actions execute immediately | Explicit accessible review before network mutation |
| Unnamed modal, incomplete tab keyboard support, learner drawer missing focus/Escape behavior | Shared accessible interaction primitives; restore focus, named controls and correct tab/tabpanel links |
| Source links have ambiguous duplicate labels; some citations only switch tabs | Distinguish internal location from external original; focus/scroll exact available source location without inventing unavailable links |
| Teacher/admin themes differ; tiny secondary controls | Reuse tokens, readable controls and responsive spacing; restrained motion respecting reduced motion |

Acceptance widths: 320, 375, 390, 768, 1024, 1280 and 1440 px. Verify keyboard paths, dialog names, draft retention, pending/error/empty states, long text, preserved destinations and source/grade/privacy controls. Fixture screenshots are explicitly labeled; public screenshots require actual deployment. A screenshot alone does not verify authorization or real-user accessibility.
