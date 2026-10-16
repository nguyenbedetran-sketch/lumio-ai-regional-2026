# Existing architecture and upgrade boundaries

Browser learner state uses IndexedDB/local storage with account namespaces, CAS conflict detection and optional text-only sync. The Next.js App Router serves learner, classroom, teacher, admin and policy routes. Native Flutter and Electron source wraps existing server contracts; it is not a separately invented backend.

Authenticated requests resolve canonical sessions, account state and organization membership on the server. Teaching stores enforce organization/class scope, immutable issued questions and recipients, answer/rubric redaction, and explicit grade publication. Global system roles and organization roles remain separate.

AI requests pass authorization, entitlement, rate/budget checks and transactional credit reservation before bounded provider work. OpenAI/Gemini generation and xAI speech are server configured; no keys ship to clients. Tutor state uses canonical history and a three-meaningful-hint gate. Source extraction records PDF pages, document paragraphs, slides or media times; exact source proofs and bounded retrieval accompany generated material. Deterministic mathematics supports a limited declared algebra scope, not arbitrary mathematical proof.

SQLite migrations are ordered and transactional. Summary jobs use persisted checkpoints, ownership and lease fencing. They still need a running worker process; free web hosting is not an always-on queue service. Backup tooling uses a separate consistent snapshot, integrity/FK/schema/hash checks and refuses unsafe overwrites.

## Incremental changes

- Keep the framework, auth, database contracts, working features and dependencies.
- Introduce persistent HTTP intent metadata for AI/voice in migration 14; retain output-free receipts, canonical settlement checks and idempotent ledger operations.
- Reorganize existing destinations with a small set of primary actions and named secondary groups. Reuse current forms and feature modules.
- Improve Unicode retrieval, source navigation/deletion and versioned evaluation without asserting unsupported OCR or semantic accuracy.
- Maintain one implementation checkout: `work/regional-20261015/release-repo`. Do not run the historical original-to-release copying script over these upgrades.

Durable production database/object storage, platform billing, signed native releases, guardian consent and human learning studies require separately verified deployment/account/device/user prerequisites. They remain explicit backlog items until fulfilled.
