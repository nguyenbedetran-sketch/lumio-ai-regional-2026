# V7 offline AI evaluation

Status: **PASS_DETERMINISTIC_SCOPE**. Corpus `lumio-v7-authored-offline-1` v1.0.0.

46/46 authored cases; 189 assertions. **0 actual provider requests**. This is validator/retrieval evidence, not a model accuracy score.

| Language | Cases | Passing | Generated language quality |
|---|---:|---:|---|
| vi | 10 | 10 | NOT TESTED |
| en | 9 | 9 | NOT TESTED |
| zh-CN | 9 | 9 | NOT TESTED |
| ja | 9 | 9 | NOT TESTED |
| ko | 9 | 9 | NOT TESTED |

| Case | Dimension | Status |
|---|---|---|
| vi-retrieval-answerable | source | PASS |
| vi-retrieval-missing | source | PASS |
| vi-retrieval-conflict | source | PASS |
| vi-citation-integrity | source | PASS |
| vi-injection-boundary | injection | PASS |
| vi-supported-answer-and-question | answer-question | PASS |
| vi-adverse-question | question-quality | PASS |
| en-retrieval-answerable | source | PASS |
| en-retrieval-missing | source | PASS |
| en-retrieval-conflict | source | PASS |
| en-citation-integrity | source | PASS |
| en-injection-boundary | injection | PASS |
| en-supported-answer-and-question | answer-question | PASS |
| en-adverse-question | question-quality | PASS |
| zh-CN-retrieval-answerable | source | PASS |
| zh-CN-retrieval-missing | source | PASS |
| zh-CN-retrieval-conflict | source | PASS |
| zh-CN-citation-integrity | source | PASS |
| zh-CN-injection-boundary | injection | PASS |
| zh-CN-supported-answer-and-question | answer-question | PASS |
| zh-CN-adverse-question | question-quality | PASS |
| ja-retrieval-answerable | source | PASS |
| ja-retrieval-missing | source | PASS |
| ja-retrieval-conflict | source | PASS |
| ja-citation-integrity | source | PASS |
| ja-injection-boundary | injection | PASS |
| ja-supported-answer-and-question | answer-question | PASS |
| ja-adverse-question | question-quality | PASS |
| ko-retrieval-answerable | source | PASS |
| ko-retrieval-missing | source | PASS |
| ko-retrieval-conflict | source | PASS |
| ko-citation-integrity | source | PASS |
| ko-injection-boundary | injection | PASS |
| ko-supported-answer-and-question | answer-question | PASS |
| ko-adverse-question | question-quality | PASS |
| math-linear-valid | math | PASS |
| math-rational-pole | math | PASS |
| math-quadratic-two-roots | math | PASS |
| math-extraneous-radical-root | math | PASS |
| math-missing-root | math | PASS |
| math-fraction-arithmetic | math | PASS |
| math-invalid-operation-unknown | math | PASS |
| math-irrational-approximation | math | PASS |
| math-lost-root-transformation | math | PASS |
| math-missing-data-prose | math | PASS |
| math-wrong-multiplication | math | PASS |

## Limits

- Passing means the asserted deterministic contract passed, not that an AI answered these questions correctly.
- Fixtures and translations are authored examples, not independently teacher-reviewed representative data.
- No external provider, embedding, OAuth, browser, public deployment, load, physical device or student pilot is exercised.
- Lexical bigrams are not semantic translation or a calibrated confidence score. Quote presence is not claim entailment.
- Unknown/unsupported mathematics is an expected honest result, not a verified solution. Natural-language reasoning is not checked.
- Source prompt boundaries are structural checks, not a penetration test or proof that a model never follows injection.
- Compare only the same corpus/version and source hashes; latency is local validator time, not provider speed or SLO.

Expected/actual values, source hashes, corpus hash and exact scopes are in ai-evaluation.json. The JSON is the authoritative machine-readable result.
