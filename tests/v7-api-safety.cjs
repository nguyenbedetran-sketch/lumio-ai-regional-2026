const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript"),
  { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  cache = new Map(),
  checks = [];
let session = null,
  clock = Date.now(),
  calls = 0,
  transport = () => {
    throw Error("Unexpected provider fixture call");
  };
function load(relative) {
  const file = path.resolve(root, relative);
  if (file === path.resolve(root, "lib/lumio/auth.ts"))
    return {
      authOptions: () => ({}),
      providerStatus: () => ({ google: true, facebook: false }),
    };
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} };
  cache.set(file, m);
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(
    (n) =>
      n === "next-auth"
        ? { getServerSession: async () => session }
        : n.startsWith(".")
          ? load(
              path.relative(root, path.resolve(path.dirname(file), n + ".ts")),
            )
          : require(n),
    m,
    m.exports,
  );
  return m.exports;
}
const env = {
    NODE_ENV: "development",
    AUTH_TRUST_HOST: "true",
    NEXTAUTH_URL: "http://127.0.0.1:3000",
    NEXTAUTH_SECRET: "synthetic-v7-idempotency-fixture-secret-not-live",
    LUMIO_AI_ENABLED: "true",
    LUMIO_PUBLIC_DEMO: "false",
    LUMIO_DESKTOP: "false",
    LUMIO_COMPETITION_PREVIEW: "false",
    LUMIO_BACKGROUND_JOBS_DISABLED: "true",
    OPENAI_API_KEY: "test-only-not-real",
    OPENAI_MODEL: "test-model",
    GEMINI_API_KEY: "",
    GEMINI_MODEL: "",
    XAI_API_KEY: "test-only-not-real",
    XAI_STT_MODEL: "test-stt-model",
  },
  saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]])),
  originalFetch = global.fetch;
Object.assign(process.env, env);
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v7-safety-")),
  file = path.join(folder, "test.sqlite"),
  platform = load("lib/server/store.ts"),
  store = platform.createStore(file, {
    adminEmails: ["v7-owner@example.test"],
    now: () => clock,
  }),
  db = new DatabaseSync(file);
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
  isFeatureEnabled: (key) => store.isFeatureEnabled(key),
  recordAIUsage: (e) => store.recordAIUsage(e),
});
const api = load("app/api/ai/route.ts"),
  voice = load("app/api/voice/route.ts"),
  receipts = load("app/api/ai/request/route.ts"),
  tutors = load("app/api/tutor/session/route.ts"),
  adminAPI = load("app/api/admin/users/route.ts"),
  jobs = load("app/api/summary-jobs/route.ts"),
  http = load("lib/server/ai-http-core.ts"),
  origin = "http://127.0.0.1:3000";
global.fetch = async (url, init) => {
  calls++;
  return transport(String(url), init);
};
let serial = 0;
const user = (extra = {}) =>
    store.ensureIdentity({
      provider: "google",
      providerAccountId: "v7-synthetic-" + ++serial,
      name: "Synthetic learner " + serial,
      emailVerified: false,
      ...extra,
    }),
  owner = user({ email: "v7-owner@example.test", emailVerified: true });
function plus(u) {
  store.adminGrant({
    actorId: owner.id,
    sessionVersion: owner.sessionVersion,
    userId: u.id,
    requestId: crypto.randomUUID(),
    planId: "plus",
    credits: 0,
    days: 1,
    reason: "Synthetic v7 fixture",
  });
  return u;
}
const balance = (u) =>
  store.getBillingSnapshot(u.id, store.getUser(u.id).sessionVersion).account;
const body = (patch) => ({
  task: "chat",
  mode: "quick",
  language: "vi",
  source: "Synthetic source: one plus one can be counted using objects.",
  question: "Explain one plus one.",
  ...patch,
});
function req(
  u,
  path = "/api/ai",
  data = body(),
  key = crypto.randomUUID(),
  options = {},
) {
  session = u
    ? {
        userId: u.id,
        sessionVersion: u.sessionVersion,
        authenticatedAt: Date.now(),
      }
    : null;
  return new Request(origin + path, {
    method: options.method || "POST",
    headers: {
      ...(options.native
        ? {
            authorization: "Bearer " + options.native,
            "x-lumio-user": u?.id || "",
          }
        : { origin, "x-lumio-account": u?.storageKey || "" }),
      "content-type": "application/json",
      "idempotency-key": key,
      ...options.headers,
    },
    ...((options.method || "POST") === "GET"
      ? {}
      : { body: JSON.stringify(data) }),
    ...(options.signal ? { signal: options.signal } : {}),
  });
}
async function result(route, r, status = 200, error) {
  const response = await route[r.method](r),
    data = response.headers.get("content-type")?.includes("json")
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
  assert.equal(
    response.status,
    status,
    Buffer.isBuffer(data) ? "audio" : JSON.stringify(data),
  );
  if (error) assert.equal(data.error, error);
  return data;
}
const hint = () =>
  Response.json({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              hint: "Picture one object beside another before counting the total number.",
              question: "How many objects can you count altogether?",
            }),
          },
        ],
      },
    ],
    usage: { input_tokens: 10, output_tokens: 5 },
  });
const audio = () =>
  new Response(Buffer.from([1, 2, 3]), {
    headers: { "Content-Type": "audio/mpeg" },
  });
const check = async (name, fn) => {
  calls = 0;
  transport = hint;
  await fn();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
};
const fails = (code) => (e) => {
  assert.equal(e.code, code);
  return true;
};
function recording(u, key, options = {}) {
  session = { userId: u.id, sessionVersion: u.sessionVersion };
  const form = new FormData();
  form.set("language", "vi");
  form.set(
    "file",
    new File(["synthetic sample bytes"], "sample.webm", { type: "audio/webm" }),
  );
  return new Request(origin + "/api/voice", {
    method: "POST",
    headers: {
      origin,
      "x-lumio-account": u.storageKey,
      "idempotency-key": key,
      ...options.headers,
    },
    body: form,
    ...(options.signal ? { signal: options.signal } : {}),
  });
}
const receipt = (u, key) =>
  result(
    receipts,
    req(u, "/api/ai/request?key=" + key, undefined, undefined, {
      method: "GET",
    }),
  );
(async () => {
  try {
    await check(
      "Strict admin action rejects arrays without enabling suspended account or writing audit",
      async () => {
        const u = user();
        store.updateUserAccess(
          owner.id,
          u.id,
          "disable",
          "Synthetic setup suspension",
          owner.sessionVersion,
        );
        const n = db.prepare("SELECT count(*) n FROM audit_events").get().n;
        await result(
          adminAPI,
          req(
            owner,
            "/api/admin/users",
            {
              userId: u.id,
              action: ["revoke"],
              reason: "Synthetic malformed action",
            },
            undefined,
            { method: "PATCH" },
          ),
          400,
          "INVALID_REQUEST",
        );
        assert.equal(store.getUser(u.id).disabled, true);
        assert.equal(
          db.prepare("SELECT count(*) n FROM audit_events").get().n,
          n,
        );
        assert.throws(
          () =>
            store.updateUserAccess(
              owner.id,
              u.id,
              ["enable"],
              "Synthetic invalid action",
              owner.sessionVersion,
            ),
          fails("INVALID_REQUEST"),
        );
      },
    );
    await check(
      "Strict job action rejects array resume at handler and store without cancelling",
      async () => {
        const u = user(),
          j = store.createSummaryJob(
            u.id,
            u.sessionVersion,
            crypto.randomUUID(),
            {
              title: "Synthetic source",
              source: "A triangle has three sides.",
              language: "vi",
            },
          );
        await result(
          jobs,
          req(
            u,
            "/api/summary-jobs",
            { jobId: j.id, action: ["resume"] },
            undefined,
            { method: "PATCH" },
          ),
          400,
          "INVALID_JOB_ACTION",
        );
        assert.equal(
          store.readSummaryJob(u.id, u.sessionVersion, j.id).status,
          "queued",
        );
        assert.throws(
          () =>
            store.controlSummaryJob(u.id, u.sessionVersion, j.id, ["cancel"]),
          fails("INVALID_JOB_ACTION"),
        );
      },
    );
    await check(
      "AI enum coercion is rejected before any provider or credit reservation",
      async () => {
        for (const patch of [
          { task: ["chat"] },
          { mode: ["quick"] },
          { language: ["vi"] },
          { guidance: ["hints"] },
        ]) {
          const u = user(),
            r = await api.POST(req(u, "/api/ai", body(patch)));
          assert.equal(r.status, 400);
          assert.equal(balance(u).balance, 200);
        }
        assert.equal(calls, 0);
      },
    );
    await check(
      "Browser account binding rejects missing and stale headers for AI and voice",
      async () => {
        const a = user(),
          b = user();
        for (const route of [api, voice])
          for (const header of ["", a.storageKey])
            await result(
              route,
              req(
                b,
                route === api ? "/api/ai" : "/api/voice",
                route === api
                  ? body()
                  : { text: "Synthetic speech", language: "vi" },
                undefined,
                { headers: { "x-lumio-account": header } },
              ),
              401,
              "SESSION_REVOKED",
            );
        assert.equal(calls, 0);
        assert.equal(balance(b).balance, 200);
      },
    );
    await check(
      "A UUID idempotency key is required before quota reservation and provider dispatch",
      async () => {
        const u = user();
        for (const key of ["", "bad-key"])
          await result(
            api,
            req(u, "/api/ai", body(), key),
            400,
            "INVALID_IDEMPOTENCY_KEY",
          );
        assert.equal(calls, 0);
        assert.equal(
          db
            .prepare("SELECT count(*) n FROM ai_http_requests WHERE user_id=?")
            .get(u.id).n,
          0,
        );
        assert.equal(
          db
            .prepare("SELECT count(*) n FROM runtime_rate_windows WHERE key=?")
            .get("account:" + u.id).n,
          0,
        );
      },
    );
    await check(
      "Lost ACK repeats return owned receipt with one charge, one provider call and one hint",
      async () => {
        const u = user(),
          key = crypto.randomUUID(),
          first = await result(api, req(u, "/api/ai", body(), key)),
          again = await result(
            api,
            req(u, "/api/ai", body(), key),
            409,
            "AI_REQUEST_COMPLETED",
          );
        assert.equal(calls, 1);
        assert.equal(balance(u).balance, 198);
        assert.equal(again.receipt.tutorSessionId, first.tutor.sessionId);
        assert.equal(again.requestId, first.requestId);
        assert.equal(
          store.getTutorSession(u.id, u.sessionVersion, first.tutor.sessionId)
            .hintCount,
          1,
        );
        const recovered = await receipt(u, key);
        assert.equal(recovered.receipt.status, "completed");
        assert.equal(recovered.receipt.requestId, first.requestId);
        assert.doesNotMatch(
          JSON.stringify(recovered),
          /Synthetic source|one object|assistant_text|fingerprint|lease_token/,
        );
      },
    );
    await check(
      "Concurrent identical requests share one persisted intent before the runtime limiter",
      async () => {
        const u = user(),
          key = crypto.randomUUID();
        let finish, started;
        const waiting = new Promise((r) => (started = r));
        transport = () =>
          new Promise((r) => {
            finish = () => r(hint());
            started();
          });
        const first = api.POST(req(u, "/api/ai", body(), key));
        await waiting;
        const duplicate = await result(
          api,
          req(u, "/api/ai", body(), key),
          409,
          "AI_REQUEST_IN_PROGRESS",
        );
        assert.equal(duplicate.receipt.status, "in_progress");
        assert.equal(calls, 1);
        assert.equal(balance(u).reserved, 2);
        finish();
        assert.equal((await first).status, 200);
        assert.equal(balance(u).balance, 198);
        assert.equal(balance(u).reserved, 0);
        assert.equal(
          db
            .prepare("SELECT daily_count FROM runtime_rate_windows WHERE key=?")
            .get("account:" + u.id).daily_count,
          1,
        );
      },
    );
    await check(
      "Key cannot change content or endpoint, while another account has independent namespace",
      async () => {
        const u = plus(user()),
          v = user(),
          key = crypto.randomUUID();
        await result(api, req(u, "/api/ai", body(), key));
        await result(
          api,
          req(u, "/api/ai", body({ question: "A different exercise" }), key),
          409,
          "AI_REQUEST_CONFLICT",
        );
        await result(
          voice,
          req(
            u,
            "/api/voice",
            { text: "Synthetic speech", language: "vi" },
            key,
          ),
          409,
          "AI_REQUEST_CONFLICT",
        );
        await result(
          receipts,
          req(v, "/api/ai/request?key=" + key, undefined, undefined, {
            method: "GET",
          }),
          404,
          "AI_REQUEST_NOT_FOUND",
        );
        await result(api, req(v, "/api/ai", body(), key));
        assert.equal(calls, 2);
        assert.equal(balance(u).balance, 198);
        assert.equal(balance(v).balance, 198);
      },
    );
    await check(
      "Failed provider intent refunds and cannot silently re-execute without a new explicit operation",
      async () => {
        const u = user(),
          key = crypto.randomUUID();
        transport = () => {
          throw Error("Synthetic private diagnostic");
        };
        await result(
          api,
          req(u, "/api/ai", body(), key),
          502,
          "PROVIDER_UNAVAILABLE",
        );
        const n = calls;
        await result(
          api,
          req(u, "/api/ai", body(), key),
          409,
          "AI_REQUEST_FAILED",
        );
        assert.equal(calls, n);
        assert.equal(balance(u).balance, 200);
        assert.equal((await receipt(u, key)).receipt.status, "failed");
        transport = hint;
        await result(api, req(u, "/api/ai", body(), crypto.randomUUID()));
        assert.equal(balance(u).balance, 198);
      },
    );
    await check(
      "Malformed model output fails receipt and refunds rather than storing a completed answer",
      async () => {
        const u = user(),
          key = crypto.randomUUID();
        transport = () => Response.json({ output: [] });
        await result(
          api,
          req(u, "/api/ai", body(), key),
          502,
          "EMPTY_AI_OUTPUT",
        );
        assert.equal(balance(u).balance, 200);
        assert.equal((await receipt(u, key)).receipt.status, "failed");
      },
    );
    await check(
      "Chat session revocation inside provider prevents receipt, hint and credit commit",
      async () => {
        const u = user(),
          key = crypto.randomUUID();
        transport = () => {
          store.updateUserAccess(
            owner.id,
            u.id,
            "revoke",
            "Synthetic in-flight revocation",
            owner.sessionVersion,
          );
          return hint();
        };
        await result(
          api,
          req(u, "/api/ai", body(), key),
          401,
          "SESSION_REVOKED",
        );
        assert.equal(balance(u).balance, 200);
        assert.equal(balance(u).reserved, 0);
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM tutor_turns t JOIN tutor_sessions s ON s.id=t.session_id WHERE s.user_id=?",
            )
            .get(u.id).n,
          0,
        );
        assert.equal(
          db
            .prepare("SELECT status FROM ai_http_requests WHERE user_id=?")
            .get(u.id).status,
          "failed",
        );
      },
    );
    await check(
      "TTS revocation at settlement returns no audio and refunds actual ledger hold",
      async () => {
        const u = plus(user());
        transport = () => {
          store.updateUserAccess(
            owner.id,
            u.id,
            "revoke",
            "Synthetic voice revocation",
            owner.sessionVersion,
          );
          return audio();
        };
        await result(
          voice,
          req(u, "/api/voice", { text: "Synthetic speech", language: "vi" }),
          401,
          "SESSION_REVOKED",
        );
        assert.equal(balance(u).balance, 200);
        assert.equal(balance(u).reserved, 0);
      },
    );
    await check(
      "STT revocation at settlement returns no transcript and refunds actual ledger hold",
      async () => {
        const u = plus(user());
        transport = () => {
          store.updateUserAccess(
            owner.id,
            u.id,
            "revoke",
            "Synthetic STT revocation",
            owner.sessionVersion,
          );
          return Response.json({ text: "Synthetic transcript" });
        };
        await result(
          voice,
          recording(u, crypto.randomUUID()),
          401,
          "SESSION_REVOKED",
        );
        assert.equal(balance(u).balance, 200);
        assert.equal(balance(u).reserved, 0);
      },
    );
    await check(
      "Voice request cancellation remains failed and refunded on uncertain retry",
      async () => {
        const u = plus(user()),
          key = crypto.randomUUID(),
          ctrl = new AbortController();
        transport = () => {
          ctrl.abort();
          return audio();
        };
        await result(
          voice,
          req(
            u,
            "/api/voice",
            { text: "Synthetic speech", language: "vi" },
            key,
            { signal: ctrl.signal },
          ),
          499,
          "REQUEST_CANCELLED",
        );
        const n = calls;
        await result(
          voice,
          req(
            u,
            "/api/voice",
            { text: "Synthetic speech", language: "vi" },
            key,
          ),
          409,
          "AI_REQUEST_FAILED",
        );
        assert.equal(calls, n);
        assert.equal(balance(u).balance, 200);
      },
    );
    await check(
      "Multipart boundary changes do not make one recording a second paid intent",
      async () => {
        const u = plus(user()),
          key = crypto.randomUUID();
        transport = () => Response.json({ text: "Synthetic transcript" });
        await result(voice, recording(u, key));
        await result(voice, recording(u, key), 409, "AI_REQUEST_COMPLETED");
        assert.equal(calls, 1);
        assert.equal(balance(u).balance, 176);
      },
    );
    await check(
      "Receipt update fault rolls back tutor turn and charge in the same transaction",
      async () => {
        const u = user(),
          key = crypto.randomUUID();
        db.exec(
          "CREATE TRIGGER test_receipt_commit_failure BEFORE UPDATE ON ai_http_requests WHEN NEW.status='completed' BEGIN SELECT RAISE(ABORT,'SYNTHETIC_RECEIPT_FAILURE'); END",
        );
        try {
          await result(
            api,
            req(u, "/api/ai", body(), key),
            502,
            "PROVIDER_UNAVAILABLE",
          );
        } finally {
          db.exec("DROP TRIGGER test_receipt_commit_failure");
        }
        assert.equal(balance(u).balance, 200);
        assert.equal(balance(u).reserved, 0);
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM tutor_turns t JOIN tutor_sessions s ON s.id=t.session_id WHERE s.user_id=?",
            )
            .get(u.id).n,
          0,
        );
        assert.equal((await receipt(u, key)).receipt.status, "failed");
      },
    );
    await check(
      "Lease expiry fences a late response and refunds before refusing automatic rerun",
      async () => {
        const u = user(),
          key = crypto.randomUUID();
        transport = async () => {
          clock += http.AI_HTTP_LIMITS.leaseMs + 1;
          await result(
            api,
            req(u, "/api/ai", body(), key),
            409,
            "AI_REQUEST_FAILED",
          );
          return hint();
        };
        await result(
          api,
          req(u, "/api/ai", body(), key),
          409,
          "BILLING_REQUEST_FINALIZED",
        );
        assert.equal(calls, 1);
        assert.equal(balance(u).balance, 200);
        assert.equal(balance(u).reserved, 0);
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM tutor_turns t JOIN tutor_sessions s ON s.id=t.session_id WHERE s.user_id=?",
            )
            .get(u.id).n,
          0,
        );
      },
    );
    await check(
      "Crash after reservation recovers via receipt access and late completion stays fenced",
      async () => {
        const u = user(),
          key = crypto.randomUUID(),
          lease = store.beginAIHttpRequest(
            u.id,
            u.sessionVersion,
            "ai",
            key,
            http.aiHttpFingerprint(body()),
          ),
          r = store.reserveUsage({
            userId: u.id,
            sessionVersion: u.sessionVersion,
            requestId: lease.requestId,
            task: "chat",
            mode: "quick",
            kind: "text",
          });
        assert.equal(balance(u).reserved, 2);
        clock += http.AI_HTTP_LIMITS.leaseMs + 1;
        assert.equal((await receipt(u, key)).receipt.status, "failed");
        assert.equal(balance(u).balance, 200);
        assert.equal(balance(u).reserved, 0);
        assert.throws(
          () => store.assertAIHttpRequest(lease),
          fails("AI_REQUEST_STALE"),
        );
        assert.equal(
          store.settleUsage({
            userId: u.id,
            reservationId: r.reservationId,
            onSettled: () => store.completeAIHttpRequest(lease),
          }).changed,
          false,
        );
        assert.equal(calls, 0);
      },
    );
    await check(
      "Receipt expiry never makes an already charged key reusable",
      async () => {
        const u = user(),
          key = crypto.randomUUID();
        await result(api, req(u, "/api/ai", body(), key));
        clock += http.AI_HTTP_LIMITS.retentionMs + 1;
        await result(
          receipts,
          req(u, "/api/ai/request?key=" + key, undefined, undefined, {
            method: "GET",
          }),
          404,
          "AI_REQUEST_NOT_FOUND",
        );
        await result(
          api,
          req(u, "/api/ai", body(), key),
          409,
          "AI_REQUEST_COMPLETED",
        );
        assert.equal(calls, 1);
        assert.equal(balance(u).balance, 198);
      },
    );
    await check(
      "Native binding and shared UUID intent work with real pairing credentials",
      async () => {
        const u = plus(user()),
          code = store.createMobileCode(u.id, u.sessionVersion).code,
          pair = store.exchangeMobileCode(code, "Synthetic native device"),
          key = crypto.randomUUID();
        await result(
          api,
          req(u, "/api/ai", body(), key, {
            native: pair.accessToken,
            headers: { "x-lumio-user": "wrong" },
          }),
          401,
          "SESSION_REVOKED",
        );
        await result(
          api,
          req(u, "/api/ai", body(), key, { native: pair.accessToken }),
        );
        await result(
          api,
          req(u, "/api/ai", body(), key, { native: pair.accessToken }),
          409,
          "AI_REQUEST_COMPLETED",
        );
        await result(
          receipts,
          req(u, "/api/ai/request?key=" + key, undefined, undefined, {
            method: "GET",
            native: pair.accessToken,
          }),
        );
        await result(
          api,
          req(u, "/api/ai", body(), crypto.randomUUID(), {
            native: pair.accessToken,
            headers: { cookie: "synthetic" },
          }),
          403,
          "INVALID_ORIGIN",
        );
        assert.equal(calls, 1);
        assert.equal(balance(u).balance, 198);
      },
    );
    await check(
      "Tutor GET/DELETE require the originating account and never delete another session",
      async () => {
        const u = user(),
          v = user(),
          first = await result(api, req(u)),
          id = first.tutor.sessionId;
        await result(
          tutors,
          req(u, "/api/tutor/session?sessionId=" + id, undefined, undefined, {
            method: "GET",
            headers: { "x-lumio-account": v.storageKey },
          }),
          401,
          "SESSION_REVOKED",
        );
        await result(
          tutors,
          req(u, "/api/tutor/session", { all: true }, undefined, {
            method: "DELETE",
            headers: { "x-lumio-account": v.storageKey },
          }),
          401,
          "SESSION_REVOKED",
        );
        assert.equal(
          store.getTutorSession(u.id, u.sessionVersion, id).hintCount,
          1,
        );
        await result(
          tutors,
          req(v, "/api/tutor/session?sessionId=" + id, undefined, undefined, {
            method: "GET",
          }),
          404,
          "TUTOR_SESSION_NOT_FOUND",
        );
        await result(
          tutors,
          req(u, "/api/tutor/session?sessionId=" + id, undefined, undefined, {
            method: "GET",
          }),
        );
      },
    );
    await check(
      "Receipt recovery remains available when AI processing is disabled",
      async () => {
        const u = user(),
          key = crypto.randomUUID();
        await result(api, req(u, "/api/ai", body(), key));
        process.env.LUMIO_AI_ENABLED = "false";
        try {
          assert.equal((await receipt(u, key)).receipt.status, "completed");
          await result(api, req(u), 503, "AI_DISABLED");
        } finally {
          process.env.LUMIO_AI_ENABLED = "true";
        }
        assert.equal(calls, 1);
      },
    );
    await check(
      "Same actor source/key metadata survives reopen without storing source or output",
      async () => {
        const u = user(),
          key = crypto.randomUUID(),
          response = await result(api, req(u, "/api/ai", body(), key)),
          r = db
            .prepare("SELECT * FROM ai_http_requests WHERE user_id=?")
            .get(u.id);
        assert.doesNotMatch(
          JSON.stringify(r),
          /Synthetic source|Explain one|Picture one|output_text|test-only|assistant_text/,
        );
        assert.match(r.fingerprint, /^[a-f0-9]{64}$/);
        const second = platform.createStore(file, { now: () => clock });
        try {
          assert.equal(
            second.readAIHttpRequest(u.id, u.sessionVersion, key)
              .tutorSessionId,
            response.tutor.sessionId,
          );
          assert.throws(
            () =>
              second.beginAIHttpRequest(
                u.id,
                u.sessionVersion,
                "ai",
                key,
                r.fingerprint,
              ),
            fails("AI_REQUEST_COMPLETED"),
          );
        } finally {
          second.close();
        }
      },
    );
    await check(
      "Only an actual ledger settlement may complete a receipt; fake token cannot fence another intent",
      () => {
        const u = user(),
          key = crypto.randomUUID(),
          lease = store.beginAIHttpRequest(
            u.id,
            u.sessionVersion,
            "ai",
            key,
            http.aiHttpFingerprint(body()),
          );
        assert.throws(
          () => store.completeAIHttpRequest(lease),
          fails("AI_REQUEST_UNSETTLED"),
        );
        store.failAIHttpRequest(
          { ...lease, token: crypto.randomUUID() },
          "SYNTHETIC",
        );
        assert.equal(
          store.readAIHttpRequest(u.id, u.sessionVersion, key).status,
          "in_progress",
        );
        assert.throws(
          () =>
            store.assertAIHttpRequest({ ...lease, token: crypto.randomUUID() }),
          fails("AI_REQUEST_STALE"),
        );
      },
    );
    await check(
      "Old-session pending intents are fenced and refunded after a new canonical login",
      async () => {
        const u = user(),
          key = crypto.randomUUID(),
          lease = store.beginAIHttpRequest(
            u.id,
            u.sessionVersion,
            "ai",
            key,
            http.aiHttpFingerprint(body()),
          );
        store.reserveUsage({
          userId: u.id,
          sessionVersion: u.sessionVersion,
          requestId: lease.requestId,
          task: "chat",
          mode: "quick",
          kind: "text",
        });
        store.updateUserAccess(
          owner.id,
          u.id,
          "revoke",
          "Synthetic abandoned session",
          owner.sessionVersion,
        );
        const current = store.getUser(u.id);
        assert.equal((await receipt(current, key)).receipt.status, "failed");
        assert.equal(balance(current).balance, 200);
        assert.throws(
          () => store.assertAIHttpRequest(lease),
          fails("SESSION_REVOKED"),
        );
      },
    );
    await check(
      "Tutor deletion removes only recovery pointer, preserving financial duplicate tombstone",
      async () => {
        const u = user(),
          key = crypto.randomUUID();
        await result(api, req(u, "/api/ai", body(), key));
        await result(
          tutors,
          req(u, "/api/tutor/session", { all: true }, undefined, {
            method: "DELETE",
          }),
        );
        const recovered = await receipt(u, key);
        assert.equal(recovered.receipt.status, "completed");
        assert.equal(recovered.receipt.tutorSessionId, undefined);
        await result(
          api,
          req(u, "/api/ai", body(), key),
          409,
          "AI_REQUEST_COMPLETED",
        );
        assert.equal(calls, 1);
      },
    );
    await check(
      "Migration14 preserves schema13 users and private snapshot bytes",
      () => {
        const legacyFile = path.join(folder, "legacy13.sqlite"),
          legacy = new DatabaseSync(legacyFile);
        legacy.exec(
          "PRAGMA foreign_keys=ON;CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
        );
        for (const m of load("lib/server/schema.ts").migrations.filter(
          (m) => m.version <= 13,
        )) {
          legacy.exec(m.sql);
          legacy
            .prepare("INSERT INTO schema_migrations VALUES (?,?)")
            .run(m.version, new Date(clock).toISOString());
        }
        legacy
          .prepare(
            "INSERT INTO users(id,storage_key,name,role,created_at,last_seen_at) VALUES('legacy','private-legacy-key','Synthetic legacy','USER',?,?)",
          )
          .run(new Date(clock).toISOString(), new Date(clock).toISOString());
        const privateData = '{"syntheticPrivate":"must not become HTTP cache"}';
        legacy
          .prepare(
            "INSERT INTO sync_snapshots(user_id,epoch,revision,payload_json,digest,updated_at,expires_at) VALUES('legacy','legacy-epoch',1,?,'legacy-digest',?,?)",
          )
          .run(privateData, new Date(clock).toISOString(), clock + 86400000);
        legacy.close();
        const upgraded = platform.createStore(legacyFile, { now: () => clock });
        try {
          assert.equal(
            upgraded.getUser("legacy").storageKey,
            "private-legacy-key",
          );
        } finally {
          upgraded.close();
        }
        const verify = new DatabaseSync(legacyFile);
        try {
          assert.equal(
            verify
              .prepare(
                "SELECT payload_json FROM sync_snapshots WHERE user_id='legacy'",
              )
              .get().payload_json,
            privateData,
          );
          assert.equal(
            verify
              .prepare(
                "SELECT count(*) n FROM schema_migrations WHERE version=14",
              )
              .get().n,
            1,
          );
        } finally {
          verify.close();
        }
      },
    );

    await check(
      "TTS lost ACK is deduplicated after normalized whitespace and JSON property order",
      async () => {
        const u = plus(user()),
          key = crypto.randomUUID();
        transport = audio;
        await result(
          voice,
          req(
            u,
            "/api/voice",
            { text: "  Synthetic speech  ", language: "vi" },
            key,
          ),
        );
        await result(
          voice,
          req(
            u,
            "/api/voice",
            { language: "vi", text: "Synthetic speech" },
            key,
          ),
          409,
          "AI_REQUEST_COMPLETED",
        );
        assert.equal(calls, 1);
        assert.equal(balance(u).balance, 192);
        assert.equal((await receipt(u, key)).receipt.tutorSessionId, undefined);
      },
    );
    await check(
      "Non-chat cards also recheck session inside settlement and refund on revoke",
      async () => {
        const u = user();
        transport = () => {
          store.updateUserAccess(
            owner.id,
            u.id,
            "revoke",
            "Synthetic card-generation revoke",
            owner.sessionVersion,
          );
          return Response.json({
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      cards: [
                        {
                          front: "How can we count?",
                          back: "Count the objects in the source.",
                          references: [],
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          });
        };
        await result(
          api,
          req(u, "/api/ai", body({ task: "cards" })),
          401,
          "SESSION_REVOKED",
        );
        assert.equal(balance(u).balance, 200);
        assert.equal(balance(u).reserved, 0);
      },
    );
    await check(
      "Summary branch commits receipt atomically and never repeats a charged lost ACK",
      async () => {
        const u = user(),
          key = crypto.randomUUID();
        transport = () =>
          Response.json({
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      title: "Synthetic summary",
                      overview:
                        "A synthetic summary faithful to a simple counting source.",
                      keyPoints: ["Count objects carefully."],
                      chapters: [
                        {
                          title: "Counting",
                          summary:
                            "The source explains counting objects together.",
                          bullets: ["Count each object once."],
                          references: [],
                        },
                      ],
                      mindMap: {
                        nodes: [
                          {
                            id: "root",
                            label: "Counting",
                            detail: "Synthetic source",
                          },
                          {
                            id: "idea",
                            label: "Objects",
                            detail: "Count once",
                            chapterIndex: 0,
                          },
                        ],
                        edges: [{ source: "root", target: "idea" }],
                      },
                    }),
                  },
                ],
              },
            ],
          });
        await result(api, req(u, "/api/ai", body({ task: "summary" }), key));
        await result(
          api,
          req(u, "/api/ai", body({ task: "summary" }), key),
          409,
          "AI_REQUEST_COMPLETED",
        );
        assert.equal(calls, 1);
        assert.equal(balance(u).balance, 192);
        assert.equal((await receipt(u, key)).receipt.status, "completed");
      },
    );

    const report = {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
      scope:
        "Actual handlers, canonical synthetic users and real temporary SQLite/credit/tutor/receipt transactions. Only OAuth session and provider transport intercepted. No real providers, teachers, learners or external actions.",
      providerRequests: 0,
      productionDeployment: "NOT_TESTED",
    };
    fs.mkdirSync(path.join(root, "docs/v7/reports"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/v7/reports/api-safety.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log("V7 API safety: " + checks.length + " checks passed.");
  } finally {
    db.close();
    store.close();
    fs.rmSync(folder, { recursive: true, force: true });
    global.fetch = originalFetch;
    for (const [k, v] of Object.entries(saved))
      v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
})().catch((e) => {
  console.error("Passed before failure: " + checks.length);
  console.error(e);
  process.exitCode = 1;
});
