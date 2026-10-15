# Lumio isolated security review scope

This is a proposed instruction file for a later local Strix run. No Strix scan
has been executed. The instructions describe scope; they are not a network
sandbox. Enforce the same boundaries in the container/network configuration.

Only inspect the explicitly supplied disposable Lumio fixture directory and its
dedicated test process. Use synthetic users, credits, identities and documents.
Never use the live project database or credentials. Do not read `.env*`, browser
profiles, application caches, real uploads, API keys or account tokens.

Focus on canonical account ownership, OAuth-link revocation races, admin role
checks, credit reservation/settlement/refund idempotency, mobile bearer
revocation, origin validation and request bounds. Reproduce each finding with a
small regression test. Report file/line, preconditions, expected/actual behavior
and a minimal fix. Keep false-positive hypotheses separate from proven findings.

Do not scan public deployments, provider APIs, Google/Meta/Supabase accounts or
other LAN hosts. Do not upload source or reports to Strix Cloud or external LLMs.
Do not perform denial-of-service, credential guessing, persistence, destructive
deletion, actual payment operations or paid AI requests. Do not weaken existing
authorization to enable a test. No automatic commits, pushes or remediation.

Stop if the isolated fixture, local inference endpoint or enforceable network
boundary is unavailable. Report that prerequisite instead of broadening scope.
