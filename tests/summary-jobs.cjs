const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript"),
  { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
let session = null;
function load(relative) {
  const file = path.resolve(root, relative);
  if (file === path.resolve(root, "lib/lumio/auth.ts"))
    return {
      authOptions: () => ({}),
      providerStatus: () => ({ google: true, facebook: true }),
    };
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name === "next-auth"
        ? { getServerSession: async () => session }
        : name.startsWith(".")
          ? load(
              path.relative(
                root,
                path.resolve(path.dirname(file), name + ".ts"),
              ),
            )
          : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const env = {
  NODE_ENV: "development",
  AUTH_TRUST_HOST: "true",
  NEXTAUTH_URL: "http://127.0.0.1:3000",
  LUMIO_AI_ENABLED: "true",
  LUMIO_BACKGROUND_JOBS_DISABLED: "true",
  LUMIO_COMPETITION_PREVIEW: "false",
  GEMINI_API_KEY: "test-only-not-real",
  GEMINI_MODEL: "test-model",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
};
const saved = Object.fromEntries(
  Object.keys(env).map((k) => [k, process.env[k]]),
);
Object.assign(process.env, env);
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-summary-jobs-")),
  filename = path.join(folder, "test.sqlite");
let time = Date.UTC(2026, 9, 15, 12),
  passed = 0,
  calls = 0;
const platform = load("lib/server/store.ts"),
  core = load("lib/server/job-core.ts"),
  limits = load("lib/jobs/contracts.ts").SUMMARY_JOB_LIMITS;
const store = platform.createStore(filename, { now: () => time }),
  second = platform.createStore(filename, { now: () => time }),
  inspect = new DatabaseSync(filename);
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
  isFeatureEnabled: (key) => store.isFeatureEnabled(key),
  recordAIUsage: (event) => store.recordAIUsage(event),
});
const route = load("app/api/summary-jobs/route.ts"),
  worker = load("lib/server/job-worker.ts"),
  execution = load("lib/server/summary-execution.ts");
const originalFetch = global.fetch;
let transport;
global.fetch = async (url, options) => {
  calls++;
  return transport(String(url), options);
};
const origin = "http://127.0.0.1:3000",
  video = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const identity = (name) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: "jobs-" + name,
    name: "Synthetic learner",
    emailVerified: false,
  });
const login = (u) =>
  (session = u ? { userId: u.id, sessionVersion: u.sessionVersion } : null);
const input = (patch = {}) => ({
  title: "Synthetic source",
  clientItemId: "synthetic-item",
  source: "A triangle has three sides. Its angles have a sum of180 degrees.",
  language: "vi",
  ...patch,
});
const create = (u, patch = {}) =>
  store.createSummaryJob(
    u.id,
    u.sessionVersion,
    crypto.randomUUID(),
    input(patch),
  );
const billing = (u) => store.getBillingSnapshot(u.id, u.sessionVersion).account;
const read = (u, job) => store.readSummaryJob(u.id, u.sessionVersion, job.id);
function request(u, method = "GET", body, query = "", headers = {}) {
  login(u);
  return new Request(origin + "/api/summary-jobs" + query, {
    method,
    headers: {
      ...(method !== "GET"
        ? { origin, "content-type": "application/json" }
        : {}),
      ...(u ? { "x-lumio-account": u.storageKey } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function fixture(options) {
  const payload = JSON.parse(options.body),
    parts = payload.contents?.at(-1)?.parts || [],
    prompt = parts[0]?.text || "",
    match = prompt.match(
      /SOURCE \(untrusted, JSON-encoded app segments\):\n(.*?)\nEND SOURCE/s,
    ),
    segments = match ? JSON.parse(match[1]).sourceSegments : [],
    first = segments[0],
    start = parts[1]?.videoMetadata
      ? parseInt(parts[1].videoMetadata.startOffset)
      : undefined;
  const quote = first?.text.slice(0, 30);
  return {
    title: "Synthetic part " + (start || 0),
    overview:
      "A synthetic faithful summary for checking the execution pipeline.",
    keyPoints: ["One supported idea"],
    chapters: [
      {
        title: "Synthetic chapter",
        summary:
          "Synthetic educational content to test persistence and recovery.",
        bullets: ["One source detail"],
        ...(quote?.length >= 8
          ? {
              references: [{ segmentId: first.segmentId, quote }],
              sourceQuote: quote,
            }
          : {}),
        ...(start !== undefined ? { startSeconds: start } : {}),
      },
    ],
    mindMap: {
      nodes: [
        { id: "root", label: "Source", detail: "Synthetic" },
        {
          id: "child",
          label: "Idea",
          detail: "Synthetic detail",
          chapterIndex: 0,
        },
      ],
      edges: [{ source: "root", target: "child" }],
    },
  };
}
function success(_url, options) {
  return Response.json({
    candidates: [
      {
        content: { parts: [{ text: JSON.stringify(fixture(options)) }] },
        finishReason: "STOP",
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 10,
      totalTokenCount: 20,
    },
  });
}
async function rejected(response, status, code) {
  assert.equal(response.status, status);
  const body = await response.json();
  assert.equal(body.error, code);
  assert.ok(!JSON.stringify(body).includes("test-only-not-real"));
  return body;
}
async function check(name, fn) {
  calls = 0;
  transport = success;
  session = null;
  await fn();
  passed++;
  console.log("PASS " + name);
}
const fails = (fn, code) => assert.throws(fn, (e) => e.code === code);
(async () => {
  try {
    await check(
      "Bounded plans cover exact Unicode text and canonical YouTube ranges without blobs",
      async () => {
        const source = "a".repeat(9999) + "😀" + "b".repeat(110000 - 1),
          plan = core.normalizeSummaryJob(input({ source }));
        assert.equal(plan.parts.map((p) => p.input.source).join(""), source);
        assert.ok(plan.parts.length <= 12);
        assert.ok(
          plan.parts.every((p) => !/[\uD800-\uDBFF]$/.test(p.input.source)),
        );
        assert.equal(plan.parts.at(-1).end, source.length);
        const y = core.normalizeSummaryJob(
          input({
            source: undefined,
            youtubeUrl: video,
            durationSeconds: 7200,
          }),
        );
        assert.equal(y.parts.length, 12);
        assert.deepEqual(y.parts.at(-1).input.videoRange, {
          startSeconds: 6600,
          endSeconds: 7200,
        });
        for (const bad of [
          input({ source: "x".repeat(120001) }),
          input({ media: { data: "secret" } }),
          input({
            source: undefined,
            youtubeUrl: "http://127.0.0.1/private",
            durationSeconds: 600,
          }),
          input({
            source: undefined,
            youtubeUrl: video,
            durationSeconds: 7201,
          }),
        ])
          assert.throws(() => core.normalizeSummaryJob(bad));
      },
    );
    await check(
      "HTTP requires canonical identity, matching account and same-origin mutation",
      async () => {
        await rejected(await route.GET(request(null)), 401, "SIGN_IN_REQUIRED");
        const u = identity("origin");
        await rejected(
          await route.POST(
            request(
              u,
              "POST",
              {
                consent: true,
                requestKey: crypto.randomUUID(),
                input: input(),
              },
              "",
              { origin: "https://evil.invalid" },
            ),
          ),
          403,
          "INVALID_ORIGIN",
        );
        await rejected(
          await route.GET(
            request(u, "GET", undefined, "", {
              "x-lumio-account": "old-account",
            }),
          ),
          401,
          "SESSION_REVOKED",
        );
        await rejected(
          await route.GET(
            request(u, "GET", undefined, "", {
              "sec-fetch-site": "cross-site",
            }),
          ),
          403,
          "INVALID_ORIGIN",
        );
        assert.equal(calls, 0);
      },
    );
    let one, first;
    await check(
      "Idempotent create persists once, requires consent, and does not charge before dispatch",
      async () => {
        one = identity("idempotent");
        const key = crypto.randomUUID(),
          body = { consent: true, requestKey: key, input: input() };
        await rejected(
          await route.POST(request(one, "POST", { ...body, consent: false })),
          400,
          "JOB_CONSENT_REQUIRED",
        );
        first = (await (await route.POST(request(one, "POST", body))).json())
          .job;
        const replay = (
          await (await route.POST(request(one, "POST", body))).json()
        ).job;
        assert.equal(first.id, replay.id);
        assert.equal(billing(one).balance, 200);
        assert.equal(calls, 0);
        await rejected(
          await route.POST(
            request(one, "POST", {
              ...body,
              input: input({ source: "A different source entirely." }),
            }),
          ),
          409,
          "IDEMPOTENCY_CONFLICT",
        );
      },
    );
    await check(
      "Cross-account read, cancel, and source metadata access are denied",
      async () => {
        const foreign = identity("foreign");
        await rejected(
          await route.GET(
            request(foreign, "GET", undefined, "?jobId=" + first.id),
          ),
          404,
          "JOB_NOT_FOUND",
        );
        await rejected(
          await route.PATCH(
            request(foreign, "PATCH", { jobId: first.id, action: "cancel" }),
          ),
          404,
          "JOB_NOT_FOUND",
        );
        const own = await (await route.GET(request(one))).json();
        assert.equal(own.jobs.length, 1);
        for (const field of [
          "input_json",
          "source",
          "userId",
          "sessionVersion",
          "request_key",
        ])
          assert.equal(own.jobs[0][field], undefined);
      },
    );
    await check(
      "The real worker routes a validated summary and settles exactly one eight-credit chunk",
      async () => {
        assert.equal(
          await worker.runSummaryJobStep(one.id, one.sessionVersion),
          true,
        );
        const result = read(one, first);
        assert.equal(result.status, "completed");
        assert.equal(result.completed, 1);
        assert.equal(result.attempts, 1);
        assert.equal(billing(one).balance, 192);
        assert.equal(billing(one).reserved, 0);
        assert.equal(calls, 1);
        assert.ok(result.result.summary.chapters[0].references.length);
        assert.equal(
          await worker.runSummaryJobStep(one.id, one.sessionVersion),
          false,
        );
        assert.equal(calls, 1);
        const event = store.listUsage().find((e) => e.userId === one.id);
        assert.equal(event.status, "success");
        assert.equal(event.inputTokens, 10);
        assert.equal(event.outputTokens, 10);
      },
    );
    await check(
      "Completed chunks survive another connection and source references rebase to original offsets",
      async () => {
        const u = identity("two-parts"),
          source =
            "First section. ".repeat(666) +
            "\n\nSecond section has a unique source fact for the later part.";
        const job = create(u, { source });
        assert.equal(job.total, 2);
        await worker.runSummaryJobStep(u.id, u.sessionVersion);
        const midway = second.readSummaryJob(u.id, u.sessionVersion, job.id);
        assert.equal(midway.completed, 1);
        assert.equal(midway.status, "queued");
        await worker.runSummaryJobStep(u.id, u.sessionVersion);
        const done = read(u, job);
        assert.equal(done.status, "completed");
        assert.equal(billing(u).balance, 184);
        assert.equal(calls, 2);
        assert.equal(
          done.result.coverage.parts[0].end,
          done.result.coverage.parts[1].start,
        );
        assert.equal(done.result.coverage.parts.at(-1).end, source.length);
        for (const chapter of done.result.summary.chapters)
          for (const ref of chapter.references || [])
            assert.equal(source.slice(ref.start, ref.end), ref.quote);
      },
    );
    await check(
      "Two independent SQLite workers cannot claim the same account concurrently",
      async () => {
        const u = identity("two-workers"),
          job = create(u),
          lease = store.claimSummaryJob(u.id, u.sessionVersion);
        assert.ok(lease);
        assert.equal(second.claimSummaryJob(u.id, u.sessionVersion), null);
        assert.equal(read(u, job).status, "running");
        time += limits.leaseMs + 1;
        worker.reconcileSummaryJobs(u.id);
        const replacement = second.claimSummaryJob(u.id, u.sessionVersion);
        assert.ok(replacement);
        assert.notEqual(replacement.token, lease.token);
        fails(
          () => store.startSummaryJobAttempt(lease, "forged"),
          "JOB_LEASE_STALE",
        );
        store.controlSummaryJob(u.id, u.sessionVersion, job.id, "cancel");
      },
    );
    await check(
      "A job checkpoint cannot commit outside an actual credit settlement",
      async () => {
        const u = identity("settlement-boundary"),
          job = create(u),
          lease = store.claimSummaryJob(u.id, u.sessionVersion),
          reservation = store.reserveUsage({
            userId: u.id,
            sessionVersion: u.sessionVersion,
            requestId: lease.requestId,
            task: "summary",
            mode: "quick",
            kind: "text",
          });
        store.startSummaryJobAttempt(lease, reservation.reservationId);
        fails(
          () =>
            store.completeSummaryJobPart(lease, {
              summary: fixture({ body: "{}" }),
            }),
          "JOB_SETTLEMENT_REQUIRED",
        );
        assert.equal(read(u, job).completed, 0);
        store.controlSummaryJob(u.id, u.sessionVersion, job.id, "cancel");
        worker.reconcileSummaryJobs(u.id);
        assert.equal(billing(u).balance, 200);
      },
    );
    await check(
      "A crash after reserve but before attachment is refunded and recovered by persisted request id",
      async () => {
        const u = identity("crash-gap"),
          job = create(u),
          old = store.claimSummaryJob(u.id, u.sessionVersion);
        store.acquireRuntimeAILease(u.id, u.sessionVersion, false);
        store.reserveUsage({
          userId: u.id,
          sessionVersion: u.sessionVersion,
          requestId: old.requestId,
          task: "summary",
          mode: "quick",
          kind: "text",
        });
        assert.equal(billing(u).reserved, 8);
        assert.ok(store.nextSummaryJobWake(u.id, u.sessionVersion) > time);
        time += limits.leaseMs + 1;
        worker.reconcileSummaryJobs(u.id);
        assert.equal(billing(u).balance, 200);
        assert.equal(billing(u).reserved, 0);
        assert.equal(read(u, job).status, "retry_wait");
        await worker.runSummaryJobStep(u.id, u.sessionVersion);
        assert.equal(read(u, job).status, "completed");
        assert.equal(billing(u).balance, 192);
        assert.equal(calls, 1);
      },
    );
    await check(
      "A stale late success cannot settle credits or overwrite replacement work",
      async () => {
        const u = identity("fenced"),
          job = create(u),
          lease = store.claimSummaryJob(u.id, u.sessionVersion),
          reservation = store.reserveUsage({
            userId: u.id,
            sessionVersion: u.sessionVersion,
            requestId: lease.requestId,
            task: "summary",
            mode: "quick",
            kind: "text",
          });
        store.startSummaryJobAttempt(lease, reservation.reservationId);
        time += limits.leaseMs + 1;
        assert.throws(
          () =>
            store.settleUsage({
              userId: u.id,
              reservationId: reservation.reservationId,
              onSettled: () =>
                store.completeSummaryJobPart(lease, {
                  summary: fixture({ body: JSON.stringify({}) }),
                }),
            }),
          (e) => e.code === "JOB_LEASE_STALE",
        );
        assert.equal(billing(u).reserved, 8);
        worker.reconcileSummaryJobs(u.id);
        assert.equal(billing(u).balance, 200);
        assert.equal(read(u, job).completed, 0);
      },
    );
    await check(
      "Transient provider failure refunds, persists backoff and retries one unfinished part",
      async () => {
        const u = identity("retry"),
          job = create(u);
        transport = () =>
          Response.json({ error: "private diagnostic" }, { status: 429 });
        await worker.runSummaryJobStep(u.id, u.sessionVersion);
        assert.equal(read(u, job).status, "retry_wait");
        assert.equal(read(u, job).attempts, 1);
        assert.equal(billing(u).balance, 200);
        assert.equal(billing(u).reserved, 0);
        assert.equal(
          await worker.runSummaryJobStep(u.id, u.sessionVersion),
          false,
        );
        assert.equal(calls, 1);
        time += 5001;
        transport = success;
        await worker.runSummaryJobStep(u.id, u.sessionVersion);
        assert.equal(read(u, job).status, "completed");
        assert.equal(read(u, job).attempts, 2);
        assert.equal(billing(u).balance, 192);
        assert.equal(calls, 2);
      },
    );
    await check(
      "The third failed dispatch exhausts automatic retries with no credit loss",
      async () => {
        const u = identity("exhausted"),
          job = create(u);
        transport = () => Response.json({ error: "hidden" }, { status: 429 });
        for (let n = 0; n < 3; n++) {
          await worker.runSummaryJobStep(u.id, u.sessionVersion);
          time += 16000;
        }
        assert.equal(read(u, job).status, "failed");
        assert.equal(read(u, job).attempts, 3);
        assert.equal(billing(u).balance, 200);
        assert.equal(calls, 3);
        fails(
          () =>
            store.controlSummaryJob(u.id, u.sessionVersion, job.id, "resume"),
          "JOB_NOT_RESUMABLE",
        );
        assert.equal(
          await worker.runSummaryJobStep(u.id, u.sessionVersion),
          false,
        );
      },
    );
    await check(
      "Insufficient Free credits pause a YouTube job before a second provider request",
      async () => {
        const u = identity("video-credit"),
          job = create(u, {
            source: undefined,
            youtubeUrl: video,
            durationSeconds: 1200,
          });
        await worker.runSummaryJobStep(u.id, u.sessionVersion);
        assert.equal(billing(u).balance, 92);
        await worker.runSummaryJobStep(u.id, u.sessionVersion);
        const result = read(u, job);
        assert.equal(result.status, "paused");
        assert.equal(result.error, "CREDITS_INSUFFICIENT");
        assert.equal(result.completed, 1);
        assert.equal(result.attempts, 1);
        assert.equal(calls, 1);
        assert.equal(billing(u).reserved, 0);
        assert.equal(result.result, undefined);
      },
    );
    await check(
      "Shared runtime limiter pauses a queued job without dispatch or credit hold",
      async () => {
        const u = identity("quota"),
          job = create(u),
          lease = store.acquireRuntimeAILease(u.id, u.sessionVersion, false);
        await worker.runSummaryJobStep(u.id, u.sessionVersion);
        assert.equal(read(u, job).status, "paused");
        assert.equal(read(u, job).error, "LOCAL_RATE_LIMIT");
        assert.equal(read(u, job).attempts, 0);
        assert.equal(calls, 0);
        assert.equal(billing(u).balance, 200);
        store.releaseRuntimeAILease(lease);
        store.controlSummaryJob(u.id, u.sessionVersion, job.id, "resume");
        await worker.runSummaryJobStep(u.id, u.sessionVersion);
        assert.equal(read(u, job).status, "completed");
      },
    );
    await check(
      "HTTP cancellation aborts in-flight work and refunds held credits without progress",
      async () => {
        const u = identity("cancel"),
          job = create(u);
        let started;
        const ready = new Promise((r) => (started = r));
        transport = (_url, options) =>
          new Promise((resolve, reject) => {
            options.signal.addEventListener(
              "abort",
              () => reject(new Error("synthetic cancel")),
              { once: true },
            );
            started();
          });
        const run = worker.runSummaryJobStep(u.id, u.sessionVersion);
        await ready;
        assert.equal(billing(u).reserved, 8);
        const response = await route.PATCH(
          request(u, "PATCH", { jobId: job.id, action: "cancel" }),
        );
        assert.equal(response.status, 200);
        await run;
        assert.equal(read(u, job).status, "cancelled");
        assert.equal(read(u, job).completed, 0);
        assert.equal(billing(u).balance, 200);
        assert.equal(billing(u).reserved, 0);
        assert.equal(calls, 1);
      },
    );
    await check(
      "A different-process cancellation fences a late response even without abort propagation",
      async () => {
        const u = identity("cancel-cross-process"),
          job = create(u);
        let begin, finish;
        const ready = new Promise((r) => (begin = r));
        transport = (url, options) =>
          new Promise((resolve) => {
            finish = () => resolve(success(url, options));
            begin();
          });
        const run = worker.runSummaryJobStep(u.id, u.sessionVersion);
        await ready;
        second.controlSummaryJob(u.id, u.sessionVersion, job.id, "cancel");
        worker.reconcileSummaryJobs(u.id);
        finish();
        await run;
        assert.equal(read(u, job).status, "cancelled");
        assert.equal(read(u, job).result, undefined);
        assert.equal(billing(u).balance, 200);
        assert.equal(billing(u).reserved, 0);
      },
    );
    await check(
      "Account revocation during provider work prevents commit and refunds its reservation",
      async () => {
        const u = identity("revoke"),
          job = create(u);
        let begin, finish;
        const ready = new Promise((r) => (begin = r));
        transport = (url, options) =>
          new Promise((resolve) => {
            finish = () => resolve(success(url, options));
            begin();
          });
        const run = worker.runSummaryJobStep(u.id, u.sessionVersion);
        await ready;
        inspect
          .prepare(
            "UPDATE users SET session_version=session_version+1 WHERE id=?",
          )
          .run(u.id);
        finish();
        await run;
        const row = inspect
          .prepare("SELECT * FROM summary_jobs WHERE id=?")
          .get(job.id);
        assert.equal(row.status, "failed");
        assert.equal(row.error_code, "SESSION_REVOKED");
        assert.equal(row.completed, 0);
        const current = store.getUser(u.id);
        assert.equal(billing(current).balance, 200);
        assert.equal(billing(current).reserved, 0);
        fails(() => read(u, job), "SESSION_REVOKED");
      },
    );
    await check(
      "Atomic settlement rolls back both summary checkpoint and charge when commit fails",
      async () => {
        const u = identity("atomic"),
          job = create(u),
          original = store.completeSummaryJobPart;
        store.completeSummaryJobPart = (...args) => {
          original(...args);
          throw new (load("lib/server/types.ts").PlatformError)(
            "JOB_RESULT_WRITE_FAILED",
            502,
          );
        };
        try {
          await worker.runSummaryJobStep(u.id, u.sessionVersion);
        } finally {
          store.completeSummaryJobPart = original;
        }
        const result = read(u, job);
        assert.equal(result.status, "failed");
        assert.equal(result.completed, 0);
        assert.equal(result.result, undefined);
        assert.equal(billing(u).balance, 200);
        assert.equal(billing(u).reserved, 0);
        assert.equal(
          inspect
            .prepare("SELECT result_json FROM summary_job_parts WHERE job_id=?")
            .get(job.id).result_json,
          null,
        );
      },
    );
    await check(
      "Malformed model output cannot become a completed or charged job",
      async () => {
        const u = identity("malformed"),
          job = create(u);
        transport = () =>
          Response.json({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"title":"fake","chapters":[]}' }],
                },
              },
            ],
          });
        await worker.runSummaryJobStep(u.id, u.sessionVersion);
        assert.equal(read(u, job).status, "failed");
        assert.equal(read(u, job).error, "INVALID_AI_OUTPUT");
        assert.equal(billing(u).balance, 200);
        assert.equal(read(u, job).result, undefined);
      },
    );
    await check(
      "Native jobs use the canonical pairing boundary and reject revoked or mixed requests",
      async () => {
        const u = identity("native"),
          { code } = store.createMobileCode(u.id, u.sessionVersion),
          pair = store.exchangeMobileCode(code, "Synthetic test device");
        const native = (headers) =>
          new Request(origin + "/api/summary-jobs", {
            headers: {
              authorization: "Bearer " + pair.accessToken,
              "x-lumio-user": u.id,
              ...headers,
            },
          });
        session = null;
        assert.equal((await route.GET(native())).status, 200);
        await rejected(
          await route.GET(native({ cookie: "stale=1" })),
          403,
          "INVALID_ORIGIN",
        );
        const device = store.listMobileSessions(u.id, u.sessionVersion)[0];
        store.revokeMobileSession(u.id, u.sessionVersion, device.id);
        await rejected(await route.GET(native()), 401, "SESSION_REVOKED");
        assert.equal(calls, 0);
      },
    );
    await check(
      "Retention deletes actual persisted content and completed jobs can be explicitly removed",
      async () => {
        const u = identity("expiry"),
          job = create(u);
        time += limits.retentionMs + 1;
        worker.reconcileSummaryJobs(u.id);
        fails(() => read(u, job), "JOB_NOT_FOUND");
        assert.equal(
          Number(
            inspect
              .prepare(
                "SELECT count(*) n FROM summary_job_parts WHERE job_id=?",
              )
              .get(job.id).n,
          ),
          0,
        );
        const fresh = create(u);
        await worker.runSummaryJobStep(u.id, u.sessionVersion);
        assert.equal(read(u, fresh).status, "completed");
        store.controlSummaryJob(u.id, u.sessionVersion, fresh.id, "delete");
        fails(() => read(u, fresh), "JOB_NOT_FOUND");
      },
    );
    await check(
      "Account queue caps reject excess active jobs and reuse cannot alter existing source",
      async () => {
        const u = identity("cap");
        for (let n = 0; n < 3; n++) create(u, { title: "Job " + n });
        fails(() => create(u, { title: "Fourth" }), "JOB_LIMIT_REACHED");
        const list = store.listSummaryJobs(u.id, u.sessionVersion);
        assert.equal(list.length, 3);
        assert.equal(list[0].total, 1);
        assert.equal(calls, 0);
      },
    );
    await check(
      "Authenticated create really kicks a warm-process worker after returning its queued response",
      async () => {
        const u = identity("automatic-kick");
        process.env.LUMIO_BACKGROUND_JOBS_DISABLED = "false";
        try {
          const response = await route.POST(
            request(u, "POST", {
              consent: true,
              requestKey: crypto.randomUUID(),
              input: input(),
            }),
          );
          assert.equal(response.status, 202);
          const { job } = await response.json();
          for (let n = 0; n < 50 && read(u, job).status !== "completed"; n++)
            await new Promise((r) => setTimeout(r, 10));
          assert.equal(read(u, job).status, "completed");
          assert.equal(billing(u).balance, 192);
          assert.equal(calls, 1);
        } finally {
          process.env.LUMIO_BACKGROUND_JOBS_DISABLED = "true";
        }
      },
    );
    console.log(
      `Summary jobs: ${passed} checks passed. Real isolated SQLite, shared auth/quota/router/ledger; intercepted provider transport only. No paid calls.`,
    );
  } finally {
    global.fetch = originalFetch;
    inspect.close();
    second.close();
    store.close();
    for (const [k, v] of Object.entries(saved))
      v === undefined ? delete process.env[k] : (process.env[k] = v);
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
