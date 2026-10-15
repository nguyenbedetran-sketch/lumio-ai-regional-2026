# V3 A — actor-owned retrieval prototype

Status: **PARTIAL**. This is a bounded SQLite prototype with tested account isolation, exact excerpts and optional real embeddings. It is not a production vector service or a claim of full document understanding.

## Architecture and boundaries

The existing V2 extraction pipeline remains responsible for PDF text pages, DOCX paragraphs/headings and ordered PPTX slides. It refuses unsupported Office structured math. Scans, unprocessed images and videos without processed text are not indexed. Plain text and URL imports are user-supplied text; no verified website-fetch provenance is invented.

With explicit consent, `/api/rag/documents` stores a copy of processed text in an account/workspace namespace. It uses existing deterministic source segments, original offsets and server-verified HMAC extraction metadata. There are at most 5 documents, 250,000 UTF-16 code units and 300 chunks per account; a document is at most 100,000 code units. At most 100 retrieval snapshots are retained per account. Documents and retrieval snapshots expire after 7 days. Free hosting can reset the database. Deleting an index removes its retrieval copy and snapshots, while earlier quoted chat excerpts remain in the separate 7-day tutor history until erased there.

SQLite indexes enforce efficient owner/workspace/document lookup; within the bounded 300 chunks, an accent-normalized BM25 keyword baseline ranks owner-filtered chunks. No vector database was added. Optional semantic retrieval combines cosine rank and keyword rank through reciprocal rank fusion. The initial cosine cutoff 0.35 is a heuristic, not a calibrated confidence score. A narrow comparison can warn about explicit conflicting numeric assignments; it does not detect every semantic contradiction or verify truth.

Every list/search/index/delete/vector/snapshot boundary checks the canonical account. Native bearer requests use the existing device-session verifier; browser writes require the configured same origin. Browser GET reads authenticate and deny cross-site fetches without requiring an Origin header that browsers normally omit. Retrieval never queries other accounts' chunks.

## Tutor integration

The learner explicitly chooses indexed sources in Hỏi Lumio. The first question selects at most six excerpts and creates a server-owned immutable snapshot. Every subsequent hint reuses its ID and text. The tutor source digest includes the snapshot ID, even when two scopes contain identical words. Changed/deleted/expired source revisions reject the next turn and require a new exercise. The same check runs after provider generation and again inside the credit/tutor settlement transaction to prevent a stale response from being committed by a concurrent process. Captured session versions are rechecked before writes and paid-result settlement; revoking a session during a provider wait rejects the result and refunds the hold.

The model sees only selected excerpts, the question and canonical exercise history. It must cite an exact excerpt and identify missing evidence or disagreement. A no-hit keyword retrieval makes no provider call; a RAG reply without a validated citation is rejected. Exact citations are mapped back to the original document title, digest, revision, offsets and verified physical position. A matching quotation still does not prove that the answer is semantically correct.

## Optional embeddings and credit boundary

`LUMIO_EMBEDDINGS_ENABLED=false` is the default. Enabling it requires an existing server-only OpenAI API key. `OPENAI_EMBEDDING_MODEL` defaults to `text-embedding-3-small`; dimensions are 256. No key is sent to the browser or mobile app. Separate explicit consent is required before document text or a query is sent to the external embedding service.

The new `index` task reserves **2 trial credits** per vector-indexing or semantic-query action, with existing canonical entitlement/ledger guards. These are application usage units, not a money price. Successful indexing settles in the same SQLite transaction as vector assignment; errors refund. Repeating indexing for the unchanged source/current model returns the existing vectors without another debit or provider call. A changed model/revision requires reindexing before hybrid search. Chat generation uses its normal credits in addition to an optional first-turn semantic query; these two reservations settle in one SQLite transaction with the tutor turn. Duplicate group IDs, cross-account reservations and reuse of a settled primary with a new hold are rejected. Follow-up hints reuse the snapshot without another query embedding.

The adapter checks count, unique indices, model, 256 finite values in a nonzero vector, response size and input bounds. No source text or vectors are logged by telemetry. Provider/model/token metadata can be observed by the admin.

Official API schema and configurable dimensions were checked against the [Create embeddings reference](https://developers.openai.com/api/reference/resources/embeddings/methods/create) and [embedding guide](https://developers.openai.com/api/docs/guides/embeddings) on 15 October 2026.

## Evidence and limits

- `tests/rag.cjs`: actual SQLite, account/workspace/snapshot ACL, exact citations, source revisions, retention, Unicode quotas and deterministic retrieval/adapter validation. Synthetic vectors only in algorithm unit checks.
- `tests/rag-api.cjs`: actual route, canonical authorization/credit/store/tutor code with explicitly mocked auth/provider transport. Includes no-evidence, full-solution gate, deletion and commit races, session revocation during provider waits, refunds, vector-indexing idempotency and persisted embedding-token telemetry.
- `tests/billing-group.cjs`: actual SQLite grouped settlement, duplicate/repeat/cross-account rejection, idempotent callbacks and rollback/refund checks.
- `tests/v3-rag.browser.js`: isolated browser UI mocks, including named-workspace isolation; not a provider or device validation.
- `docs/regional/rag-live-evaluation.json`: **2 actual embedding requests**, authored six-chunk corpus and seven queries. Keyword recall@3/MRR@3 0.833/0.833; hybrid 1.0/1.0. The one out-of-corpus query produced no hits. Actual saved vectors replay offline with `tests/rag-live-replay.cjs`. The tiny benchmark is independent of the account quota test and does not establish school-scale accuracy, costs, or learning outcomes.

Generated RAG answer accuracy, broad conflict detection, teacher review, student outcomes, native RAG UI and deployed Linux/Render RAG execution remain separate validation work. No new claim is inferred from synthetic browser fixtures. V2 production extraction was verified through the clean compiled `next start` route; Windows standalone symlink failure is retained separately and is not reported as a Linux test.

## Run and rollback

Run `node tests/rag.cjs`, `node tests/rag-api.cjs`, `node tests/rag-live-replay.cjs`, then `node scripts/test-ui.cjs --v3-rag`. `node scripts/evaluate-rag.cjs` makes no call unless `--live` is supplied and refuses to overwrite an existing paid evaluation report; do not remove the report to repeat a run without a new explicit evaluation budget.

Disable optional semantic calls with `LUMIO_EMBEDDINGS_ENABLED=false`. The single-source V2 flow remains available by clearing the RAG scope checkbox. Before any schema rollback, stop writes and back up SQLite; migration 9 adds only namespaced retrieval tables. Do not point an old build at a database after manually deleting migration history.
