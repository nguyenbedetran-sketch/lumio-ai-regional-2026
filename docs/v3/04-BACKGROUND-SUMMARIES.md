# Bounded background summaries — V3

Date:2026-10-15. Status:**PASS within the bounded single-host implementation; PARTIAL for production durability and autonomous restart.**

## What works

An authenticated learner can opt into a server-stored summary job, close its panel, view progress later, cancel unfinished work, resume a paused task, delete a terminal job and download a completed Markdown summary. Each validated successful part is checkpointed on the server. Completed parts are skipped on retry. The original foreground whole-video implementation is preserved.

| Area | Result | Evidence / limits |
| --- | --- | --- |
| Persisted queue/checkpoints | PASS | Real SQLite migration10, owned immutable input, per-part state, tested through an independent DB connection. |
| Authentication/isolation | PASS | Canonical OAuth or paired mobile bearer, current account header, user/sessionVersion bound in every job and worker check. No public worker token or body-supplied principal. |
| Quota/credits/router | PASS | Shared `authorizeStoredAI`, existing SQLite runtime limiter, `reserveUsage`, existing `routeAI`, structured validation and `settleUsage`/`failUsage`. Ordinary `/api/ai` summary calls reuse the same execution service. |
| Atomic success | PASS | Job checkpoint/result and credit settlement share a transaction. Forced post-checkpoint failure rolls both back, followed by refund. |
| Retry/recovery | PASS within scope | Three dispatch attempts/part, persisted backoff5s then15s,210s fenced leases; simulated crash with held runtime lease and reservation recovers safely. |
| Cancellation/revocation | PASS | Abort in current process; DB fencing in another process; late responses cannot publish or charge cancelled work. Session revocation prevents commit and refunds. |
| Source provenance | PASS within supplied text | Exact chunk offsets cover the supplied string, Unicode-safe boundaries, validated chapter references rebased only when exact original offsets fit a source segment. Unmappable references are omitted. No invented PDF page or video transcript. |
| Free deployment persistence | PARTIAL | Queue survives a Node restart only while its SQLite file survives. First authenticated owner jobs visit starts recovery; this is not a boot daemon. Free Render may sleep/reset its ephemeral file. |
| Large media/12h queue | NOT IMPLEMENTED in this queue | No blobs, audio/video uploads, DOCX/PDF bytes, arbitrary URL fetching or live recording. Queue YouTube range is at most2h. Existing foreground12h path remains separate. |
| Real provider/device/host crash | NOT TESTED in this task | Provider transport is intercepted; no paid requests or new APK. Crash checkpoints are simulated against real persisted SQLite, not a forced Render reboot. |

## Bounds and truthful coverage

Text jobs accept up to120,000 characters of **supplied** text, split into at most12 parts of roughly10,000 characters (a boundary may include one extra UTF-16 unit to preserve a surrogate pair). They do not claim to have read the rest of an original document or website. Website/document content must first be extracted with the existing ingestion flow; no full-text HMAC page proof is reused for sliced input.

YouTube jobs accept one canonical public-video URL plus a user-declared duration from1 second to7200 seconds. Parts cover `[0,declared duration)` in ten-minute windows. Result coverage explicitly records `durationBasis:'declared'`: the worker does not independently prove that the declared range is the entire original video, or that a live video has ended. Access failure remains an error; inaccessible media is never replaced with an invented transcript.

There are at most3 active jobs and12 retained jobs per account. Input and results expire7 days after creation; retries do not extend retention. Authenticated jobs access and worker maintenance perform the SQL deletion. Delete requires cancellation first for an active task. Ledger/audit history is retained independently; deleting a job does not rewrite charges. SQL deletion is not a claim of forensic erasure from old SQLite pages/backups.

The current Free trial has200 credits. With existing fixed usage rates, one text part costs8 credits and a ten-minute video part costs108. A two-hour task therefore needs more than the initial Free trial; it pauses before an unaffordable next provider request. The module does not invent credits, enable real checkout or bypass entitlements. Failed parts refund the learner's held credits. Upstream provider charges can still occur for failed/retried requests; generic HTTP calls are **not exactly-once** and complete upstream cost accounting is outside this module.

## State and transaction boundary

```text
Authenticated create + explicit consent
  -> immutable SQLite job + unique owner/requestKey fingerprint
  -> worker claims one account's next part (persisted lease token + sequence)
  -> shared canonical AI guard + SQLite quota lease
  -> validated summary input -> reserve credits -> bind dispatch attempt
  -> existing AI router -> structured/source validation
  -> one transaction: settle credits + fenced checkpoint + optional final merge
  -> queued next part / completed result

Failure -> refund -> retry_wait / paused / failed
Cancel -> fenced cancelled state -> abort locally + refund
Crash ->210s lease expiry -> reconcile persisted attempt reservation -> retry unfinished part
```

Retries only target known transient provider failures/timeouts/rate errors. Missing credits, unsupported plan, disabled/unconfigured AI or runtime quota stop in `paused` state; the owner resumes explicitly when resolved. Invalid structured content fails without publishing a result. There is no automatic retry beyond three started dispatches. A crash after a reservation but before dispatch can refund and retry without a completed provider result. The persisted attempt ID closes the reservation-attachment crash gap.

Every success callback checks the current user/sessionVersion, job state, token, lease sequence and expiry, and requires that its exact owned reservation has been settled. It must execute inside the existing settlement transaction. If a cancellation wins first, a late callback cannot commit. If success commits first, cancellation sees a completed task. Refunds are idempotent and never reverse a settled charge.

## Operation and free-host limitations

`kickSummaryJobs` starts on authenticated create/list/read/resume. It processes at most36 parts per warm run, then yields; persisted retry/stale-lease wakeups use timers while Node stays alive. After process restart, no code can run until a request wakes the host. The first owner jobs visit starts recovery; an unexpired abandoned lease gets a scheduled wake, and may take up to3.5 minutes from the old claim to expire. The shared runtime AI lease is180 seconds, shorter than the job lease.

No distributed cloud service is added. Processes sharing one SQLite file coordinate claims and quota correctly. Separate machines with separate files do not coordinate. A free Render service can sleep and its ephemeral file can reset; then pending/completed server jobs may disappear. The UI states this before consent. Do not market this as durable storage, continuous background execution or a fully production-ready job cluster.

`LUMIO_BACKGROUND_JOBS_DISABLED=true` suppresses automatic warm kicks for controlled tests/maintenance. It is not a provider credential or an authorization bypass; the worker's explicit step still revalidates canonical identity, flags, quota and credits. Normal deployments leave it unset. AI/provider configuration is unchanged.

## Integration

- Migration:`lib/server/job-schema.ts` version10, wired by the root into `schema.ts`.
- Store:`createSummaryJobStore` spread into existing `createStore` with the same DB/clock/transaction/user lookup.
- Shared execution:`lib/server/summary-execution.ts`; existing `/api/ai` summary branch delegates after canonical authorization.
- API:`GET /api/summary-jobs[?jobId=…]`, `POST` `{consent:true,requestKey,input}`, `PATCH` `{jobId,action:'cancel'|'resume'|'delete'}`.
- Browser requests bind `x-lumio-account` to the current session's `accountKey`; native requests bind `x-lumio-user` to the paired bearer identity. Mutations require existing same-origin/native boundaries.
- UI:`SummaryJobManager({locale,title,source,clientItemId?,youtubeUrl?,onResult?})`. Mounting is root-owned. It previews/downloads results by itself; an optional artifact-saving callback must also match the current item/source before applying a result.

No route accepts arbitrary job results, worker principals, lease tokens, session counters, provider credentials or credit balances from a client.

## Test evidence

`node tests/summary-jobs.cjs`:**23 checks PASS** with real isolated SQLite, two store connections, real canonical auth/guard/rate/router/ledger code and intercepted provider transport. Includes actual warm kick, consent/origin/account binding, idempotency conflicts, cross-account access, exact one-charge settlement, progress and source rebasing, fenced claims, settlement-only checkpoint, abandoned reservation crash gap with runtime lease, stale callback, backoff/exhaustion, insufficient-credit pause, runtime-limit pause/resume, in-process and cross-process cancellation, revocation, forced atomic rollback, malformed output, native pairing/revocation, retention/delete and caps. Log:`summary-jobs-tests.log`.

After integration, regressions in this task:**AI/billing12, mobile AI13, full summary15, tutor API12 PASS**. TypeScript passed after the new modules. Provider responses/auth sessions are synthetic test fixtures; these are not actual OAuth browser/device/provider demonstrations. Root coordinates complete project tests, browser presentation, build and release.

## Rollback

Disable or remove the optional UI and `/api/summary-jobs` route first, stop automatic kicks, then cancel/refund reserved attempts. Leave migration10 tables in place until their retention window and backups are handled; do not drop a live queue with credit holds. Ordinary summaries can return to the prior route implementation or keep the shared service. No provider/model/plan change is required. Preserve existing server tutor, foreground whole-summary path, canonical authentication and append-only credit ledger.
