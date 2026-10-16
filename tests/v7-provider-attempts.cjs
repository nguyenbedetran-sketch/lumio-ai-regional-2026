// Actual store/router/handlers; synthetic OAuth and intercepted transport only.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript"),
  { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  cache = new Map(),
  checks = [];
let principal = null;
function load(relative) {
  const file = path.resolve(root, relative);
  if (file === path.join(root, "lib/lumio/auth.ts"))
    return { authOptions: () => ({}) };
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
    (name) =>
      name === "next-auth"
        ? { getServerSession: async () => principal }
        : name.startsWith(".")
          ? load(path.resolve(path.dirname(file), name + ".ts"))
          : require(name),
    m,
    m.exports,
  );
  return m.exports;
}
const env = {
  NODE_ENV: "development",
  NEXTAUTH_URL: "http://127.0.0.1:3000",
  NEXTAUTH_SECRET: "synthetic-attempt-auth-only",
  AUTH_TRUST_HOST: "true",
  LUMIO_AI_ENABLED: "true",
  LUMIO_PUBLIC_DEMO: "false",
  LUMIO_COMPETITION_PREVIEW: "false",
  LUMIO_DESKTOP: "false",
  LUMIO_BACKGROUND_JOBS_DISABLED: "true",
  OPENAI_API_KEY: "synthetic-openai-not-real",
  OPENAI_MODEL: "fixture-openai",
  OPENAI_MODEL_QUICK: "fixture-openai",
  GEMINI_API_KEY: "synthetic-gemini-not-real",
  GEMINI_MODEL: "fixture-gemini",
  GEMINI_MODEL_QUICK: "fixture-gemini",
};
const before = Object.fromEntries(
    Object.keys(env).map((k) => [k, process.env[k]]),
  ),
  originalFetch = global.fetch;
Object.assign(process.env, env);
global.fetch = async () => {
  throw Error("UNEXPECTED_NETWORK_FORBIDDEN");
};
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-attempts-")),
  file = path.join(folder, "test.sqlite"),
  platform = load("lib/server/store.ts");
let clock = Date.now();
const store = platform.createStore(file, { now: () => clock }),
  db = new DatabaseSync(file);
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
  isFeatureEnabled: (key) => store.isFeatureEnabled(key),
  recordAIUsage: (event) => store.recordAIUsage(event),
});
const ai = load("lib/ai/contracts.ts"),
  router = load("lib/ai/router.ts"),
  summary = load("lib/server/summary-execution.ts"),
  api = load("app/api/ai/route.ts"),
  integrity = load("lib/server/database-integrity.ts"),
  limits = load("lib/server/provider-attempt-core.ts").PROVIDER_ATTEMPT_LIMITS;
const source = "A triangle has three sides.",
  ref = [{ segmentId: "s1", quote: source }];
const shortSummary = {
  title: "Triangle",
  overview: source,
  keyPoints: [source],
  chapters: [
    { title: "Sides", summary: source, bullets: [source], references: ref },
  ],
  mindMap: {
    nodes: [
      { id: "root", label: "Triangle", detail: source },
      { id: "sides", label: "Sides", detail: source, chapterIndex: 0 },
    ],
    edges: [{ source: "root", target: "sides" }],
  },
};
let serial = 0;
function fixture(task = "chat", feature = "learner." + task) {
  const u = store.ensureIdentity({
      provider: "google",
      providerAccountId: "attempt-fixture-" + ++serial,
      name: "Synthetic learner",
      emailVerified: false,
    }),
    requestId = crypto.randomUUID(),
    r = store.reserveUsage({
      userId: u.id,
      sessionVersion: u.sessionVersion,
      requestId,
      task,
      kind: "text",
      mode: "quick",
    }),
    context = {
      userId: u.id,
      sessionVersion: u.sessionVersion,
      requestId,
      reservationId: r.reservationId,
      feature,
    };
  return { u, r, context, observer: store.providerAttemptObserver(context) };
}
const input = (task = "chat", extra = {}) =>
  ai.validateInput({
    task,
    mode: "quick",
    language: "en",
    source,
    question: "Explain the source.",
    ...extra,
  });
const rows = (f) =>
  db
    .prepare(
      "SELECT * FROM ai_provider_attempts WHERE user_id=? ORDER BY dispatch_ordinal",
    )
    .all(f.u.id);
const reply = (
  text = "A triangle has three sides.",
  usage = {
    input_tokens: 11,
    output_tokens: 7,
    total_tokens: 18,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 2 },
  },
  model = "fixture-response",
) =>
  Response.json(
    {
      model,
      usage,
      output: [
        {
          content: [
            {
              type: "output_text",
              text: typeof text === "string" ? text : JSON.stringify(text),
            },
          ],
        },
      ],
    },
    { headers: { "x-request-id": "req_fixture_123" } },
  );
const gemini = (
  usage = {
    promptTokenCount: 4,
    candidatesTokenCount: 0,
    totalTokenCount: 4,
    cachedContentTokenCount: 0,
    thoughtsTokenCount: 0,
  },
) =>
  Response.json({
    modelVersion: "gemini-response",
    usageMetadata: usage,
    candidates: [
      { finishReason: "STOP", content: { parts: [{ text: source }] } },
    ],
  });
async function check(name, run) {
  await run();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
}
const details = {
  provider: "openai",
  requestedModel: "fixture-openai",
  endpointKind: "responses",
};
async function main() {
  try {
    await check(
      "Migration17 creates one canonical journal, preserves six existing guards and starts with no fabricated history",
      () => {
        assert.deepEqual(store.runtimeHealth(), {
          ready: true,
          schemaVersion: 18,
        });
        assert.equal(integrity.DATABASE_TABLES.length, 51);
        assert.equal(integrity.DATABASE_GUARDS.length, 6);
        assert.equal(
          db.prepare("SELECT count(*) n FROM ai_provider_attempts").get().n,
          0,
        );
      },
    );
    await check(
      "Prepare binds canonical reserved request and writes before a provider fetch without changing credit",
      async () => {
        const f = fixture(),
          before = store.getBillingSnapshot(f.u.id, f.u.sessionVersion).account;
        let calls = 0;
        await router.routeAI(
          input(),
          async () => {
            calls++;
            const row = rows(f)[0];
            assert.equal(row.status, "prepared");
            assert.equal(row.feature, "learner.chat");
            assert.equal(row.ended_at, null);
            return reply();
          },
          undefined,
          f.observer,
        );
        assert.equal(calls, 1);
        assert.deepEqual(
          store.getBillingSnapshot(f.u.id, f.u.sessionVersion).account,
          before,
        );
        const row = rows(f)[0];
        assert.equal(row.status, "response_received");
        assert.equal(row.requested_model, "fixture-openai");
        assert.equal(row.response_model, "fixture-response");
        assert.equal(row.provider_request_id, "req_fixture_123");
        assert.equal(row.input_tokens, 11);
        assert.equal(row.output_tokens, 7);
        assert.equal(row.cached_tokens, 0);
        assert.equal(row.reasoning_tokens, 2);
        assert.equal(row.estimated_cost_usd, null);
      },
    );
    await check(
      "Fallback preserves both actual dispatch outcomes, model provenance and usage even on first HTTP500",
      async () => {
        const f = fixture();
        let calls = 0;
        await router.routeAI(
          input(),
          async () =>
            ++calls === 1
              ? Response.json(
                  {
                    model: "failed-response-model",
                    usage: { input_tokens: 9, output_tokens: 0 },
                  },
                  { status: 500 },
                )
              : gemini(),
          undefined,
          f.observer,
        );
        const r = rows(f);
        assert.equal(calls, 2);
        assert.deepEqual(
          r.map((x) => x.dispatch_ordinal),
          [1, 2],
        );
        assert.deepEqual(
          r.map((x) => x.provider),
          ["openai", "gemini"],
        );
        assert.deepEqual(
          r.map((x) => x.http_status),
          [500, 200],
        );
        assert.equal(r[0].input_tokens, 9);
        assert.equal(r[0].response_model, "failed-response-model");
        assert.equal(r[0].safe_error_code, "PROVIDER_ERROR");
        assert.equal(r[1].output_tokens, 0);
        assert.equal(r[1].usage_source, "gemini-usage-metadata");
      },
    );
    await check(
      "Invalid structured output retains received token metadata before validator rejection",
      async () => {
        const f = fixture("quiz");
        await assert.rejects(
          router.routeAI(
            input("quiz"),
            async () => reply("not JSON"),
            undefined,
            f.observer,
          ),
          (e) => e.code === "INVALID_AI_OUTPUT",
        );
        assert.equal(rows(f)[0].status, "response_received");
        assert.equal(rows(f)[0].total_tokens, 18);
        assert.equal(rows(f)[0].http_status, 200);
      },
    );
    await check(
      "Incomplete response keeps usage and response model before throwing existing error",
      async () => {
        const f = fixture();
        await assert.rejects(
          router.routeAI(
            input(),
            async () =>
              Response.json({
                status: "incomplete",
                model: "incomplete-model",
                usage: { input_tokens: 3, output_tokens: 0, total_tokens: 3 },
              }),
            undefined,
            f.observer,
          ),
          (e) => e.code === "INCOMPLETE_RESPONSE",
        );
        assert.equal(rows(f)[0].input_tokens, 3);
        assert.equal(rows(f)[0].output_tokens, 0);
        assert.equal(rows(f)[0].response_model, "incomplete-model");
      },
    );
    await check(
      "Non-JSON HTTP429 retains status and unknown usage without attempting fallback",
      async () => {
        const f = fixture();
        let calls = 0;
        await assert.rejects(
          router.routeAI(
            input(),
            async () => {
              calls++;
              return new Response("not JSON", { status: 429 });
            },
            undefined,
            f.observer,
          ),
          (e) => e.code === "PROVIDER_RATE_LIMIT",
        );
        assert.equal(calls, 1);
        assert.equal(rows(f)[0].http_status, 429);
        assert.equal(rows(f)[0].input_tokens, null);
      },
    );
    await check(
      "Missing/string/negative/fractional token metadata stays null while observed0 remains0",
      async () => {
        const f = fixture();
        await router.routeAI(
          input(),
          async () =>
            reply(
              source,
              {
                input_tokens: 0,
                output_tokens: "7",
                total_tokens: -1,
                input_tokens_details: { cached_tokens: 1.5 },
              },
              "sk-proj-synthetic-secret",
            ),
          undefined,
          f.observer,
        );
        const r = rows(f)[0];
        assert.equal(r.input_tokens, 0);
        assert.equal(r.output_tokens, null);
        assert.equal(r.total_tokens, null);
        assert.equal(r.cached_tokens, null);
        assert.equal(r.reasoning_tokens, null);
        assert.equal(r.response_model, null);
      },
    );
    await check(
      "Configured credential echoes are removed even when they have no recognizable secret prefix",
      async () => {
        const prior = process.env.OPENAI_API_KEY,
          credential = "privateFixtureCredentialNoPrefix123";
        process.env.OPENAI_API_KEY = credential;
        try {
          const f = fixture();
          await router.routeAI(
            input(),
            async () =>
              Response.json(
                {
                  model: credential,
                  output: [
                    { content: [{ type: "output_text", text: source }] },
                  ],
                },
                { headers: { "x-request-id": credential } },
              ),
            undefined,
            f.observer,
          );
          assert.equal(rows(f)[0].response_model, null);
          assert.equal(rows(f)[0].provider_request_id, null);
          assert.ok(!JSON.stringify(rows(f)).includes(credential));
        } finally {
          process.env.OPENAI_API_KEY = prior;
        }
      },
    );
    await check(
      "Multimodal Gemini dispatch uses the same server journal and actual observed usage fields",
      async () => {
        const f = fixture();
        let calls = 0;
        const result = await router.routeAI(
          input("chat", { media: { mimeType: "image/png", data: "YWJj" } }),
          async (url) => {
            calls++;
            assert.match(String(url), /googleapis/);
            return gemini();
          },
          undefined,
          f.observer,
        );
        assert.equal(calls, 1);
        assert.equal(result.provider, "gemini");
        assert.equal(rows(f)[0].provider, "gemini");
        assert.equal(rows(f)[0].endpoint_kind, "generate-content");
        assert.equal(rows(f)[0].input_tokens, 4);
        assert.equal(rows(f)[0].reasoning_tokens, 0);
      },
    );
    await check(
      "Missing response model is not filled from requested configuration",
      async () => {
        const f = fixture();
        await router.routeAI(
          input(),
          async () => reply(source, undefined, undefined),
          undefined,
          f.observer,
        );
        /* default params have a model; explicitly remove it next. */ const g =
          fixture();
        await router.routeAI(
          input(),
          async () =>
            Response.json({
              output: [{ content: [{ type: "output_text", text: source }] }],
            }),
          undefined,
          g.observer,
        );
        assert.equal(rows(g)[0].response_model, null);
        assert.equal(rows(g)[0].input_tokens, null);
        assert.equal(rows(g)[0].requested_model, "fixture-openai");
      },
    );
    await check(
      "Generic or SQLite prepare failure is non-fallback and dispatches no provider",
      async () => {
        let calls = 0;
        await assert.rejects(
          router.routeAI(
            input(),
            async () => {
              calls++;
              return reply();
            },
            undefined,
            {
              prepare() {
                throw Error("Synthetic disk error");
              },
            },
          ),
          (e) => e.code === "AI_ATTEMPT_UNAVAILABLE",
        );
        assert.equal(calls, 0);
        const f = fixture();
        db.exec(
          "CREATE TRIGGER attempt_fail_prepare BEFORE INSERT ON ai_provider_attempts BEGIN SELECT RAISE(ABORT,'SYNTHETIC_DISK'); END",
        );
        try {
          await assert.rejects(
            router.routeAI(
              input(),
              async () => {
                calls++;
                return reply();
              },
              undefined,
              f.observer,
            ),
            (e) => e.code === "AI_ATTEMPT_UNAVAILABLE",
          );
          assert.equal(rows(f).length, 0);
          assert.equal(calls, 0);
        } finally {
          db.exec("DROP TRIGGER attempt_fail_prepare");
        }
      },
    );
    await check(
      "Terminal logger and warning failures leave unresolved evidence and never cause a paid fallback",
      async () => {
        const f = fixture();
        db.exec(
          "CREATE TRIGGER attempt_fail_finish BEFORE UPDATE ON ai_provider_attempts BEGIN SELECT RAISE(ABORT,'SYNTHETIC_LOG_FAILURE'); END",
        );
        const warn = console.warn;
        let calls = 0;
        console.warn = () => {
          throw Error("Synthetic warning failure");
        };
        try {
          const result = await router.routeAI(
            input(),
            async () => {
              calls++;
              return reply();
            },
            undefined,
            f.observer,
          );
          assert.equal(result.text, source);
          assert.equal(calls, 1);
          assert.equal(rows(f)[0].status, "prepared");
          assert.equal(rows(f)[0].estimated_cost_usd, null);
        } finally {
          console.warn = warn;
          db.exec("DROP TRIGGER attempt_fail_finish");
        }
      },
    );
    await check(
      "Network uncertainty and cancellation retain conservative observations without creating new retry policy",
      async () => {
        const f = fixture();
        let calls = 0;
        await router.routeAI(
          input(),
          async () => {
            if (++calls === 1) throw Error("Synthetic connection loss");
            return gemini();
          },
          undefined,
          f.observer,
        );
        assert.deepEqual(
          rows(f).map((x) => x.status),
          ["network_unknown", "response_received"],
        );
        const g = fixture(),
          ctrl = new AbortController();
        calls = 0;
        await assert.rejects(
          router.routeAI(
            input(),
            async () => {
              calls++;
              ctrl.abort();
              throw ctrl.signal.reason;
            },
            ctrl.signal,
            g.observer,
          ),
        );
        assert.equal(calls, 1);
        assert.equal(rows(g)[0].status, "cancelled_unknown");
      },
    );
    await check(
      "Factory rejects forged request/owner/feature/task and each prepare rechecks current session/reservation",
      () => {
        const f = fixture(),
          g = fixture();
        for (const patch of [
          { requestId: crypto.randomUUID() },
          { userId: g.u.id },
          { feature: "learner.quiz" },
          { feature: "not-a-feature" },
          { prompt: "must-not-store" },
        ])
          assert.throws(() =>
            store.providerAttemptObserver({ ...f.context, ...patch }),
          );
        const observer = f.observer;
        store.failUsage({ userId: f.u.id, reservationId: f.r.reservationId });
        assert.throws(
          () => observer.prepare(details),
          (e) => e.code === "BILLING_REQUEST_FINALIZED",
        );
        const h = fixture();
        db.prepare(
          "UPDATE users SET session_version=session_version+1 WHERE id=?",
        ).run(h.u.id);
        assert.throws(
          () => h.observer.prepare(details),
          (e) => e.code === "SESSION_REVOKED",
        );
      },
    );
    await check(
      "Prepared closure finishes once after revoke/refund and ignores forged observation identity fields",
      () => {
        const f = fixture(),
          rec = f.observer.prepare(details);
        db.prepare(
          "UPDATE users SET session_version=session_version+1 WHERE id=?",
        ).run(f.u.id);
        store.failUsage({ userId: f.u.id, reservationId: f.r.reservationId });
        rec.finish({
          status: "response_received",
          inputTokens: 0,
          httpStatus: 200,
          userId: "forged",
          prompt: "must-not-store",
        });
        rec.finish({ status: "response_received", inputTokens: 999 });
        const r = rows(f)[0];
        assert.equal(r.input_tokens, 0);
        assert.equal(r.user_id, f.u.id);
        assert.equal(r.session_version, f.u.sessionVersion);
        assert.equal(
          store.getBillingSnapshot(f.u.id, store.getUser(f.u.id).sessionVersion)
            .account.balance,
          200,
        );
        assert.doesNotMatch(JSON.stringify(r), /must-not-store|forged/);
      },
    );
    await check(
      "Durable ordinal increments after observer recreation and SQLite reopen",
      () => {
        const f = fixture();
        f.observer
          .prepare(details)
          .finish({ status: "response_received", httpStatus: 500 });
        const second = platform.createStore(file, { now: () => clock });
        try {
          second
            .providerAttemptObserver(f.context)
            .prepare(details)
            .finish({ status: "response_received", httpStatus: 200 });
        } finally {
          second.close();
        }
        assert.deepEqual(
          rows(f).map((x) => x.dispatch_ordinal),
          [1, 2],
        );
      },
    );
    await check(
      "Client JSON cannot create an observer or override journal attribution",
      () => {
        const parsed = ai.validateInput({
          ...input(),
          providerAttemptObserver: { prepare: "hostile" },
          feature: "teacher.lesson",
          userId: "hostile",
          reservationId: "hostile",
        });
        assert.equal(parsed.providerAttemptObserver, undefined);
        assert.equal(parsed.feature, undefined);
        assert.equal(parsed.userId, undefined);
      },
    );
    await check(
      "Actual learner paid HTTP uses canonical journal attribution and replay makes no new dispatch or charge",
      async () => {
        const u = store.ensureIdentity({
            provider: "google",
            providerAccountId: "actual-http",
            name: "Synthetic learner",
            emailVerified: false,
          }),
          key = crypto.randomUUID();
        principal = { userId: u.id, sessionVersion: u.sessionVersion };
        let calls = 0;
        global.fetch = async () => {
          calls++;
          return reply({
            cards: [
              { front: "How many sides?", back: source, references: ref },
            ],
          });
        };
        const req = () =>
          new Request("http://127.0.0.1:3000/api/ai", {
            method: "POST",
            headers: {
              origin: "http://127.0.0.1:3000",
              "content-type": "application/json",
              "x-lumio-account": u.storageKey,
              "idempotency-key": key,
            },
            body: JSON.stringify({
              ...input("cards"),
              feature: "teacher.lesson",
            }),
          });
        const first = await api.POST(req());
        assert.equal(first.status, 200, await first.clone().text());
        const second = await api.POST(req());
        assert.equal(second.status, 409);
        assert.equal(calls, 1);
        const r = rows({ u });
        assert.equal(r.length, 1);
        assert.equal(r[0].feature, "learner.cards");
        assert.equal(r[0].user_id, u.id);
        assert.equal(
          db
            .prepare("SELECT status FROM billing_reservations WHERE id=?")
            .get(r[0].reservation_id).status,
          "settled",
        );
        global.fetch = async () => {
          throw Error("UNEXPECTED_NETWORK_FORBIDDEN");
        };
      },
    );
    await check(
      "Summary shared executor defaults to learner source and only trusted job option selects job feature",
      async () => {
        for (const feature of [undefined, "job.summary-part"]) {
          const u = store.ensureIdentity({
            provider: "google",
            providerAccountId: "summary-" + serial++,
            name: "Synthetic learner",
            emailVerified: false,
          });
          global.fetch = async () =>
            Response.json({
              modelVersion: "gemini-summary",
              candidates: [
                {
                  finishReason: "STOP",
                  content: { parts: [{ text: JSON.stringify(shortSummary) }] },
                },
              ],
            });
          await summary.executeSummaryInput(
            { ...input("summary"), feature: "job.summary-part" },
            {
              userId: u.id,
              sessionVersion: u.sessionVersion,
              jobId: "synthetic-owned-job",
              input: { text: "private lease source must not enter journal" },
            },
            { requestId: crypto.randomUUID(), ...(feature ? { feature } : {}) },
          );
          assert.equal(rows({ u })[0].feature, feature || "learner.summary");
        }
        global.fetch = async () => {
          throw Error("UNEXPECTED_NETWORK_FORBIDDEN");
        };
      },
    );
    await check(
      "Actual teacher generation uses namespaced billing identity and approved teacher feature without publishing",
      async () => {
        const admin = store.ensureIdentity({
          provider: "google",
          providerAccountId: "attempt-admin",
          name: "Synthetic fixture administrator",
          emailVerified: false,
        });
        db.prepare("UPDATE users SET role='SUPER_ADMIN' WHERE id=?").run(
          admin.id,
        );
        const u = store.ensureIdentity({
          provider: "google",
          providerAccountId: "attempt-teacher",
          name: "Synthetic teacher",
          emailVerified: false,
        });
        const submitted = store.submitTeacherApplication(
          u.id,
          u.sessionVersion,
          {
            requestId: crypto.randomUUID(),
            expectedRevision: 0,
            profile: {
              applicantName: "Synthetic declaration",
              countryCode: "VN",
              country: "Việt Nam",
              provinceCity: "Tỉnh tổng hợp",
              ward: "Phường tổng hợp",
              school: "Trường tổng hợp",
              teachingLevel: "lower_secondary",
              subjects: ["Toán"],
              teacherDeclaration: true,
              storageConsent: true,
            },
          },
        );
        store.reviewTeacherApplication(admin.id, admin.sessionVersion, {
          requestId: crypto.randomUUID(),
          applicationId: submitted.application.id,
          expectedRevision: submitted.application.revision,
          action: "approve",
          note: "Synthetic fixture review",
        });
        const org = store.mutateTeaching(u.id, u.sessionVersion, {
          requestId: crypto.randomUUID(),
          action: "org.create",
          name: "Synthetic teacher organization",
        }).result.orgId;
        principal = { userId: u.id, sessionVersion: u.sessionVersion };
        let calls = 0;
        global.fetch = async () => {
          calls++;
          return reply({
            text: "Proposed activity: ask learners to count triangle sides, then check the answer.",
            references: [],
          });
        };
        const route = load("app/api/teaching/generate/route.ts"),
          response = await route.POST(
            new Request("http://127.0.0.1:3000/api/teaching/generate", {
              method: "POST",
              headers: {
                origin: "http://127.0.0.1:3000",
                "content-type": "application/json",
                "x-lumio-account": u.storageKey,
              },
              body: JSON.stringify({
                requestId: crypto.randomUUID(),
                kind: "assistant",
                orgId: org,
                sourceIds: [],
                topic: "Triangle sides",
                grade: "Grade9",
                externalProcessingConsent: true,
              }),
            }),
          );
        assert.equal(response.status, 200, await response.clone().text());
        assert.equal(calls, 1);
        const row = rows({ u })[0];
        assert.equal(row.feature, "teacher.assistant");
        assert.match(row.logical_request_id, /^teaching-/);
        assert.equal(
          db
            .prepare(
              "SELECT request_id,status FROM billing_reservations WHERE id=?",
            )
            .get(row.reservation_id).request_id,
          row.logical_request_id,
        );
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM teaching_content WHERE status IN('reviewed','published')",
            )
            .get().n,
          0,
        );
        global.fetch = async () => {
          throw Error("UNEXPECTED_NETWORK_FORBIDDEN");
        };
      },
    );
    await check(
      "Prepared records retain no source/question/output/header/credential and no prices are inferred",
      () => {
        const serialized = JSON.stringify(
          db.prepare("SELECT * FROM ai_provider_attempts").all(),
        );
        for (const secret of [
          source,
          env.OPENAI_API_KEY,
          env.GEMINI_API_KEY,
          "Explain the source.",
          "authorization",
          "content-type",
        ])
          assert.ok(!serialized.toLowerCase().includes(secret.toLowerCase()));
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM ai_provider_attempts WHERE estimated_cost_usd IS NOT NULL",
            )
            .get().n,
          0,
        );
      },
    );
    await check(
      "31-day indexed terminal purge is bounded200 and never removes an old unresolved record",
      () => {
        db.exec("DELETE FROM ai_provider_attempts");
        const f = fixture(),
          id = f.observer.prepare(details);
        const old = new Date(clock - 32 * 86400000).toISOString();
        db.prepare("UPDATE ai_provider_attempts SET prepared_at=?").run(old);
        db.prepare(
          "WITH RECURSIVE n(x) AS(SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<201) INSERT INTO ai_provider_attempts(id,logical_request_id,dispatch_ordinal,user_id,session_version,reservation_id,feature,provider,endpoint_kind,requested_model,status,prepared_at,ended_at) SELECT 'retention-'||x,?,x+1,?,1,?,'learner.chat','openai','responses','fixture','response_received',?,? FROM n",
        ).run(f.context.requestId, f.u.id, f.r.reservationId, old, old);
        f.observer.prepare(details);
        assert.equal(rows(f).filter((x) => x.status === "prepared").length, 2);
        assert.equal(rows(f).filter((x) => x.status !== "prepared").length, 1);
        assert.equal(limits.purgeBatch, 200);
      },
    );
    await check(
      "Unresolved per-account64 refuses the next prepare before transport",
      async () => {
        db.exec("DELETE FROM ai_provider_attempts");
        const f = fixture();
        for (let n = 0; n < 64; n++) f.observer.prepare(details);
        let calls = 0;
        await assert.rejects(
          router.routeAI(
            input(),
            async () => {
              calls++;
              return reply();
            },
            undefined,
            f.observer,
          ),
          (e) => e.code === "AI_ATTEMPT_CAPACITY",
        );
        assert.equal(calls, 0);
        assert.equal(rows(f).length, 64);
      },
    );
    await check(
      "Expired terminal metadata purges on a capacity-refused prepare while every unresolved row is retained",
      () => {
        db.exec("DELETE FROM ai_provider_attempts");
        const f = fixture();
        f.observer
          .prepare(details)
          .finish({ status: "response_received", httpStatus: 200 });
        db.prepare(
          "UPDATE ai_provider_attempts SET ended_at=?,prepared_at=?",
        ).run(
          new Date(clock - 32 * 86400000).toISOString(),
          new Date(clock - 32 * 86400000).toISOString(),
        );
        for (let n = 0; n < 64; n++) f.observer.prepare(details);
        // Move a terminal beyond retention only after filling unresolved slots,
        // so the next refused access must commit maintenance independently.
        const rec = rows(f).find((row) => row.status === "prepared");
        db.prepare(
          "UPDATE ai_provider_attempts SET status='response_received',ended_at=? WHERE id=?",
        ).run(new Date(clock).toISOString(), rec.id);
        f.observer.prepare(details);
        const terminal = rows(f).find(
          (row) => row.status === "response_received",
        );
        db.prepare("UPDATE ai_provider_attempts SET ended_at=? WHERE id=?").run(
          new Date(clock - 32 * 86400000).toISOString(),
          terminal.id,
        );
        assert.throws(
          () => f.observer.prepare(details),
          (error) => error.code === "AI_ATTEMPT_CAPACITY",
        );
        assert.equal(rows(f).length, 64);
        assert.ok(rows(f).every((row) => row.status === "prepared"));
      },
    );
    await check(
      "Unresolved global2048 and total100000 caps fail closed without purging unresolved or priced assumptions",
      async () => {
        for (const [size, status] of [
          [2048, "prepared"],
          [100000, "response_received"],
        ]) {
          db.exec("DELETE FROM ai_provider_attempts");
          const f = fixture(),
            g = fixture(),
            stamp = new Date(clock).toISOString();
          db.prepare(
            "WITH RECURSIVE n(x) AS(SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<?) INSERT INTO ai_provider_attempts(id,logical_request_id,dispatch_ordinal,user_id,session_version,reservation_id,feature,provider,endpoint_kind,requested_model,status,prepared_at,ended_at) SELECT 'capacity-'||x,?,x,?,1,?,'learner.chat','openai','responses','fixture',?,?,? FROM n",
          ).run(
            size,
            f.context.requestId,
            f.u.id,
            f.r.reservationId,
            status,
            stamp,
            status === "prepared" ? null : stamp,
          );
          let calls = 0;
          await assert.rejects(
            router.routeAI(
              input(),
              async () => {
                calls++;
                return reply();
              },
              undefined,
              g.observer,
            ),
            (e) => e.code === "AI_ATTEMPT_CAPACITY",
          );
          assert.equal(calls, 0);
          assert.equal(
            db.prepare("SELECT count(*) n FROM ai_provider_attempts").get().n,
            size,
          );
        }
      },
    );
    const report = {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
      schemaVersion: 18,
      actualProviderRequests: 0,
      scope:
        "Actual temporary SQLite, Router, learner HTTP and shared summary service; injected synthetic OAuth and intercepted provider transport. Metadata-only journal, actual retention/capacity fixtures, no invoices, prices, real users or deployment.",
    };
    fs.writeFileSync(
      path.join(root, "docs/v7/reports/provider-attempts.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      "Provider attempts: " +
        checks.length +
        " checks PASS;0 actual provider requests.",
    );
  } finally {
    global.fetch = originalFetch;
    for (const [k, v] of Object.entries(before))
      v === undefined ? delete process.env[k] : (process.env[k] = v);
    db.close();
    store.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
