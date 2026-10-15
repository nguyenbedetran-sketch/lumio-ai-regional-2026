# Math verification V3 — bounded engineering upgrade

Date: 2026-10-15. Baseline: the regional V2 server tutor. This change adds independent exact checks after model generation; it does not replace the tutor, router, ledger or database.

## Results

| Area | Status | Evidence / limit |
| --- | --- | --- |
| Rational arithmetic and polynomial normalization | PASS | BigInt fractions; exact decimal literals; bounded degree, tokens, depth and coefficient size. No `eval`, sampling or network service. |
| Candidate substitution and original domain | PASS within supported scope | Denominator zero, negative radicand, logarithm domain and undefined 0^0 are distinguished. A single isolated radical is checked by exact squaring plus the original nonnegative side. |
| Completeness | PARTIAL | Finite rational root sets for degree <=2, with original-domain filtering. Identities, irrational root sets and unsupported forms remain unverified. |
| Explicit transformations | PARTIAL | Rational equations connected by an explicit `⇔`, `<=>`, `\\Leftrightarrow`, `\\Longleftrightarrow` or `\\iff` are compared over the original exercise domain. Exact finite root sets or proportional polynomial numerators with equal domains provide sufficient evidence. Unsupported transformations return unknown. |
| Written arithmetic | PARTIAL | Explicit constant equalities in supported math blocks or standalone lines are checked separately. |
| Natural-language reasoning and whole proof | NOT TESTED / unsupported by this engine | A correct final root does not certify all reasoning. One-way arrows, branches, general LaTeX environments, geometry, multivariable, inequalities and transcendental identities are not interpreted as equivalence proofs. |
| Three-hint server lock / account isolation / charging | PASS regression | Existing 24 tutor +12 route checks remain passing. New SQLite round-trip test verifies optional V3 metadata survives canonical history reload. |
| Model output quality | NOT TESTED in V3 | No paid calls were made for this pure verification change. The retained V2 actual-provider evaluation remains separate evidence. |
| Physical phone and browser visual review | NOT TESTED by this module task | React static rendering is checked; this is not physical-device evidence or a new APK. |

## Implementation and interpretation

`lib/tutor/math-exact.ts` is a pure bounded parser/arithmetic engine. It accepts a single variable `x`, rational literals, arithmetic and small nonnegative integer powers. Fractions remain reduced BigInt numerator/denominator pairs. It never decides algebraic equality by plugging sample values into an expression. It supports exact substitution into rational expressions and a single isolated square root. Quadratic rational roots use an exact rational discriminant and exact integer square root.

The older numeric helper remains available to the existing hint-leak guard and to describe approximate candidate matches. It **cannot grant an exact verification status or prove completeness**. For example `sqrt(2)` expressed as a JSON floating-point number and `1/3` expressed as `0.3333333333333333` remain unverified exactly. This is a deliberate limitation of the current numeric `candidateSolutions` API; future structured exact root expressions need a separate bounded contract, rather than silently snapping decimals to symbolic values.

`MathVerification.scope` separates candidates, domain at candidates, completeness, explicit steps, arithmetic and unchecked prose reasoning. These fields are optional so saved V2 turns and existing Flutter clients continue to work. A student confirming one correct root is not marked as having supplied a complete root set. The web notice displays the scope and gives saved V2 results a legacy caveat instead of inventing exact V3 evidence.

`verifyMathSolution` only inspects explicit mathematical assertions in math delimiters / standalone supported lines. It does not guess that two prose fragments form a proof. A one-way implication, branch declaration or an unrecognized expression is shown as partially checked. A false explicit equivalence or false checked calculation causes the existing `MATH_VERIFICATION_FAILED` route failure and refund path. Final-candidate checking is still independent from the model's explanation.

To bound stored metadata below the existing 8192-character limit, at most four short explicit transformations and four short calculations are retained; longer material is labelled partial. The equation parser limits input to 500 characters, 160 tokens and 30 nesting levels; polynomial expansion has degree <=8, powers <=4 and 160-digit rational operands. These are resource bounds, not claims of full coverage at those degrees. Finite-root completeness is limited to degree <=2.

No dependency, provider secret, prompt-controlled verification result, migration, billing behavior, endpoint or new public service was introduced. `policy.ts` calls the verifier only after the existing server context authorizes a full solution. Unsupported mathematics is allowed with an honest unverified notice, rather than a false green proof badge.

## Regression commands and evidence

Run inside `outputs/eduvi`:

```powershell
node tests/math-exact.cjs
node tests/tutor.cjs
node tests/tutor-api.cjs
node tests/ai-billing.cjs
node tests/mobile-ai.cjs
npx tsc --noEmit
```

New suite: **25 checks PASS**, including 189 distinct linear-operation assertions; exact decimal arithmetic, recurring/irrational approximations, near-pole domains, canceled denominator holes, 0^0, extraneous radical roots, missing roots, factorization, divide-by-x root loss, squaring, clearing denominators under the original domain, rejected bad intermediate steps despite a correct final root, bounded metadata, persisted history and legacy notices.

Retained V2 suites in this task: **24 tutor, 12 tutor API, 12 AI/billing, 13 mobile AI checks PASS**. Provider transports are intercepted in integration tests; real SQLite, canonical auth boundary, ledger and tutor policy execute. These are not live OAuth/provider/device tests.

Logs: `math-exact-tests.log`, `math-v2-tutor-regression.log`, `math-v2-api-regression.log`. Root coordinates complete project typecheck/build and deployment after all V3 modules finish.

## Rollback

Revert the optional fields in `lib/tutor/types.ts`, the exact-engine integration in `math.ts`, the `verifyMathSolution` call in `policy.ts`, the scoped web notice, and remove `math-exact.ts` plus its tests. No schema rollback is required: verification is already stored as bounded optional JSON. Preserve server tutor state, the three-hint policy and credit transactions. Saved V3 optional metadata is harmless to older clients.
