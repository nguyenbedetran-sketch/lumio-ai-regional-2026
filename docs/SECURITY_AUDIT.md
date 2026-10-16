# Security audit and remediation register

Baseline: `31aff071`, 2026-10-16. Reproductions used isolated SQLite and real handlers with intercepted authentication/provider transport; no production account/data was altered.

| ID | Reproduced finding | Planned control | State |
| --- | --- | --- | --- |
| SEC-01 | Array action can be coerced by admin API but interpreted differently by store, enabling a suspended account | Strict runtime enum at both boundaries | Fixed; actual isolated handler/store tests PASS |
| SEC-02 | Array summary-job action can cancel instead of resume | Strict action validation before mutation | Fixed; strict mutation regression PASS |
| SEC-03 | Stale intended browser account is ignored by AI/tutor session endpoints | Bind canonical session to intended account; reject mismatch before work | Fixed; AI/tutor/RAG stale-account tests PASS |
| SEC-04 | Duplicate HTTP intent creates two provider requests and debits | Persistent account/session/endpoint/payload-bound idempotency metadata; no output cache | Fixed for AI/voice/paid-RAG;30API +27paid-RAG checks PASS |
| SEC-05 | Voice response can settle after canonical session revocation | Revalidate inside atomic settlement; fence/refund invalid work | Fixed; cancel/revoke/source race and rollback checks PASS |
| SEC-06 | Client cannot read previous intent or receives gatewayJSON5xx | Fail closed on unreadable metadata; retain uncertain request identity | Independent review found;18web checks and92native suite PASS |

Preserve and retest tenant/class isolation, role hierarchy, revoked credential denial, issued assessment snapshots, unpublished answer/grade redaction, audited grade publication, URL/SSRF controls, prompt injection boundaries, CSV formula protection and safe backup paths.

This register is not a comprehensive security certification. Parent/guardian relationships, multi-instance shared storage and payment providers must not be exposed as completed while their authorization and integration prerequisites remain absent.
