# Lumio V6 + V7 product audit

Audit date: 2026-10-16. Source baseline: `31aff071dbb95aee37a77fa8f8d6822240b10344` (`3.2.0-teacher.1`). Remote main was checked before implementation. This is an incremental upgrade of the existing application.

The two specifications were read completely: V6 (1,551 lines) and V7 (908 lines). V6 supplies the capability and engineering backlog; V7 supplies the source-aware process and simpler interaction design. [The unified plan](IMPLEMENTATION_PLAN.md), [feature matrix](v7/FEATURE_MATRIX.md), and [persistent checklist](v7/CHECKLIST.md) govern execution.

## Verified baseline

- Next.js 15.5.27, React 19.1.8, TypeScript 5.9.3, NextAuth 4.24.15; existing Motion, Lucide and KaTeX are retained.
- Eight page routes and 33 API route handlers. Learner shell has 15 local views and 13 flat navigation entries; teacher has 12 modules.
- SQLite migrations 1–13; transactional credits, canonical sessions, organization/class checks, source proofs, bounded RAG, synchronized text snapshots and checkpointed media jobs already exist.
- `pnpm test`: exit 0, 711 assertions. `pnpm build`: exit 0. `pnpm typecheck`: exit 0. No lint script is configured. These checks do not prove real-device, provider or production persistence behavior.
- Existing release evidence includes local/compiled handler tests, explicitly synthetic UI fixtures, two local teacher provider generations and one public lesson generation. They are distinct evidence types.
- Public learner page was inspected live: navigation remains crowded; the page explicitly discloses free-hosting data resets and trial AI limits. The deployed runtime precedes the documentation-only baseline commit.

## Highest-priority findings

1. Repeated AI/voice HTTP intents lack persistent client idempotency, despite atomic reservation IDs. A lost acknowledgement can cause a second provider call and debit.
2. Browser AI and tutor-session requests do not consistently bind an intended account to the canonical cookie session. Voice settlement needs a canonical session recheck after provider work.
3. Array-valued action inputs are coerced at two API boundaries and interpreted differently in stores; reproduced outcomes include enabling a suspended user and cancelling a summary job.
4. Teacher editors can lose unsaved drafts during navigation. Some destructive and role-changing actions have no explicit review step. Modal names, tab keyboard behavior and learner mobile drawer focus need correction.
5. Lexical retrieval tokenization drops CJK/Korean queries. Source references do not always navigate to their exact location; deleting local material does not automatically remove an opted-in server index.
6. Free Render + SQLite is an ephemeral competition deployment, not durable multi-instance production. Native device testing, a real learning pilot and merchant payments are not verified.

Existing class/tenant authorization, hidden answers, unpublished grades, canonical source snapshots, three meaningful tutor hints, credit rollback and job fencing must be preserved. No cross-tenant exploit was demonstrated in this audit; this is not a claim of exhaustive penetration testing.

## Evidence and limits

See [source audit](v7/SOURCE_AUDIT.md), [UI audit](v7/UI_UX_AUDIT.md), [security audit](SECURITY_AUDIT.md), and [evidence inventory](v7/EVIDENCE_INVENTORY.md). Historical results remain historical. The V3.1 PDF is not evidence of the later V3.2 classroom implementation. No real-student learning improvement or actual native release is inferred from fixture tests.
