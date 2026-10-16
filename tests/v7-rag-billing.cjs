// Actual RAG/receipt HTTP handlers + real isolated SQLite. Only OAuth session and provider transport are fixtures.
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
  transport;
function load(relative) {
  const file = path.resolve(root, relative);
  if (file === path.join(root, "lib/lumio/auth.ts"))
    return {
      authOptions: () => ({}),
      providerStatus: () => ({ google: true }),
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
    NEXTAUTH_SECRET: "synthetic-rag-receipt-test-only-secret",
    LUMIO_AI_ENABLED: "true",
    LUMIO_EMBEDDINGS_ENABLED: "true",
    LUMIO_PUBLIC_DEMO: "false",
    LUMIO_DESKTOP: "false",
    LUMIO_COMPETITION_PREVIEW: "false",
    LUMIO_BACKGROUND_JOBS_DISABLED: "true",
    OPENAI_API_KEY: "synthetic-not-real",
    OPENAI_EMBEDDING_MODEL: "text-embedding-3-small",
  },
  saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]])),
  originalFetch = global.fetch;
Object.assign(process.env, env);
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v7-rag-receipt-")),
  file = path.join(folder, "test.sqlite"),
  platform = load("lib/server/store.ts"),
  store = platform.createStore(file, { now: () => clock }),
  db = new DatabaseSync(file);
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
  isFeatureEnabled: (key) => store.isFeatureEnabled(key),
  recordAIUsage: (e) => store.recordAIUsage(e),
});
const documents = load("app/api/rag/documents/route.ts"),
  search = load("app/api/rag/search/route.ts"),
  receipts = load("app/api/ai/request/route.ts"),
  http = load("lib/server/ai-http-core.ts"),
  origin = "http://127.0.0.1:3000";
const vector = () => Array.from({ length: 256 }, (_, i) => (i === 0 ? 1 : 0));
function success(_url, init) {
  const b = JSON.parse(init.body);
  return Response.json({
    model: b.model,
    data: b.input.map((_, index) => ({ index, embedding: vector() })),
    usage: { total_tokens: 7 },
  });
}
global.fetch = async (url, init) => {
  assert.equal(String(url), "https://api.openai.com/v1/embeddings");
  calls++;
  return transport(url, init);
};
let serial = 0;
function fixture(semantic = false) {
  const u = store.ensureIdentity({
      provider: "google",
      providerAccountId: "rag-receipt-" + ++serial,
      name: "Synthetic learner " + serial,
      emailVerified: false,
    }),
    d = store.ragIndex(
      u.id,
      {
        workspaceId: "main",
        clientItemId: "source-" + serial,
        title: "Authored triangle lesson",
        text: "A triangle has three sides. Every triangle has three vertices; count these carefully.",
      },
      u.sessionVersion,
    );
  if (semantic) {
    const input = store.ragEmbeddingInput(u.id, "main", d.id);
    store.ragSetEmbeddings(
      u.id,
      "main",
      d.id,
      d.digest,
      d.revision,
      process.env.OPENAI_EMBEDDING_MODEL,
      input.chunks.map(vector),
    );
  }
  return { u, d };
}
const wallet = (f) =>
  store.getBillingSnapshot(f.u.id, store.getUser(f.u.id).sessionVersion)
    .account;
const payload = (f, kind) =>
  kind === "embed"
    ? {
        action: "embed",
        workspaceId: "main",
        documentId: f.d.id,
        externalConsent: true,
      }
    : {
        scope: {
          workspaceId: "main",
          documentIds: [f.d.id],
          mode: "hybrid",
          consent: true,
        },
        query: "triangle",
      };
function request(f, kind, key = crypto.randomUUID(), options = {}) {
  session = f ? { userId: f.u.id, sessionVersion: f.u.sessionVersion } : null;
  const endpoint =
    kind === "embed"
      ? "/api/rag/documents"
      : kind === "receipt"
        ? "/api/ai/request?key=" + key
        : "/api/rag/search";
  return new Request(origin + endpoint, {
    method: kind === "receipt" ? "GET" : "POST",
    headers: {
      ...(options.native
        ? { authorization: "Bearer " + options.native, "x-lumio-user": f.u.id }
        : { origin, "x-lumio-account": f?.u.storageKey || "" }),
      "content-type": "application/json",
      "idempotency-key": key,
      ...options.headers,
    },
    ...(kind === "receipt"
      ? {}
      : { body: JSON.stringify(options.body || payload(f, kind)) }),
    ...(options.signal ? { signal: options.signal } : {}),
  });
}
async function send(f, kind, key, status = 200, error, options = {}) {
  const route =
      kind === "embed" ? documents : kind === "receipt" ? receipts : search,
    r = await route[kind === "receipt" ? "GET" : "POST"](
      request(f, kind, key, options),
    ),
    b = await r.json();
  assert.equal(r.status, status, JSON.stringify(b));
  assert.match(r.headers.get("cache-control"), /no-store/);
  if (error) assert.equal(b.error, error);
  return b;
}
async function check(name, fn) {
  calls = 0;
  transport = success;
  await fn();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
}
const semantic = (f) =>
  store.ragList(f.u.id, "main").find((d) => d.id === f.d.id)?.semantic;
const daily = (f) =>
  Number(
    db
      .prepare("SELECT daily_count FROM runtime_rate_windows WHERE key=?")
      .get("account:" + f.u.id)?.daily_count || 0,
  );
const count = (f) =>
  Number(
    db
      .prepare("SELECT count(*) n FROM billing_reservations WHERE user_id=?")
      .get(f.u.id).n,
  );
(async () => {
  try {
    await check(
      "Lexical search stays free without UUID or AI feature and creates no receipt",
      async () => {
        const f = fixture(),
          before = wallet(f);
        process.env.LUMIO_AI_ENABLED = "false";
        try {
          const body = payload(f, "search");
          body.scope.mode = "lexical";
          const r = await send(f, "search", "", 200, undefined, { body });
          assert.equal(r.credits, 0);
          assert.equal(r.mode, "lexical");
          assert.ok(r.hits.length);
        } finally {
          process.env.LUMIO_AI_ENABLED = "true";
        }
        assert.deepEqual(wallet(f), before);
        assert.equal(calls, 0);
        assert.equal(count(f), 0);
        assert.equal(daily(f), 0);
      },
    );
    for (const sample of [
      { name: "omitted", value: undefined, expected: null },
      { name: "observed zero", value: 0, expected: 0 },
      { name: "observed positive", value: 7, expected: 7 },
      { name: "malformed string", value: "7", expected: null },
      { name: "negative", value: -3, expected: null },
    ]) {
      await check(
        "Hybrid query token usage " +
          sample.name +
          " keeps unknown distinct from observed0 without changing charge/replay",
        async () => {
          const f = fixture(true),
            key = crypto.randomUUID();
          transport = async (url, init) => {
            const body = await success(url, init).json();
            if (sample.value === undefined) delete body.usage;
            else body.usage = { total_tokens: sample.value };
            return Response.json(body);
          };
          const result = await send(f, "search", key);
          assert.equal(result.credits, 2);
          const event = store
            .listUsage(100)
            .find((event) => event.requestId === result.requestId);
          assert.ok(event);
          assert.equal(event.inputTokens, sample.expected);
          assert.equal(
            db
              .prepare("SELECT input_tokens FROM ai_usage WHERE request_id=?")
              .get(result.requestId).input_tokens,
            sample.expected,
          );
          assert.equal(wallet(f).balance, 198);
          assert.equal(wallet(f).reserved, 0);
          assert.equal(count(f), 1);
          assert.equal(daily(f), 1);
          await send(f, "search", key, 409, "AI_REQUEST_COMPLETED");
          assert.equal(calls, 1);
          assert.equal(wallet(f).balance, 198);
          assert.equal(
            db
              .prepare("SELECT count(*) n FROM ai_usage WHERE request_id=?")
              .get(result.requestId).n,
            1,
          );
        },
      );
    }
    for (const kind of ["embed", "search"]) {
      await check(
        kind +
          ": missing/stale account or invalid UUID stops before provider, hold and paid quota",
        async () => {
          const f = fixture(kind === "search");
          for (const header of ["", "stale-account"])
            await send(f, kind, crypto.randomUUID(), 401, "SESSION_REVOKED", {
              headers: { "x-lumio-account": header },
            });
          for (const key of ["", "bad-key"])
            await send(f, kind, key, 400, "INVALID_IDEMPOTENCY_KEY");
          assert.equal(calls, 0);
          assert.equal(wallet(f).balance, 200);
          assert.equal(count(f), 0);
          assert.equal(daily(f), 0);
        },
      );
      await check(
        kind +
          ": lost ACK returns completed metadata receipt with one provider, charge and quota slot",
        async () => {
          const f = fixture(kind === "search"),
            key = crypto.randomUUID(),
            first = await send(f, kind, key),
            again = await send(f, kind, key, 409, "AI_REQUEST_COMPLETED");
          assert.equal(first.credits, 2);
          assert.equal(
            again.receipt.endpoint,
            kind === "embed" ? "rag-embed" : "rag-search",
          );
          assert.equal(again.requestId, first.requestId);
          assert.equal(calls, 1);
          assert.equal(wallet(f).balance, 198);
          assert.equal(wallet(f).reserved, 0);
          assert.equal(daily(f), 1);
          const recovered = await send(f, "receipt", key);
          assert.equal(recovered.receipt.status, "completed");
          assert.equal(recovered.receipt.requestId, first.requestId);
          assert.equal(again.hits, undefined);
          assert.equal(again.document, undefined);
          assert.doesNotMatch(
            JSON.stringify(recovered),
            /triangle|vertices|fingerprint|vector|digest/,
          );
        },
      );
      await check(
        kind +
          ": concurrent identical requests have one dispatch and persisted in-progress receipt",
        async () => {
          const f = fixture(kind === "search"),
            key = crypto.randomUUID();
          let finish, started;
          const wait = new Promise((r) => (started = r));
          transport = (url, init) =>
            new Promise((r) => {
              finish = () => r(success(url, init));
              started();
            });
          const first = (kind === "embed" ? documents : search).POST(
            request(f, kind, key),
          );
          await wait;
          const duplicate = await send(
            f,
            kind,
            key,
            409,
            "AI_REQUEST_IN_PROGRESS",
          );
          assert.equal(duplicate.receipt.status, "in_progress");
          assert.equal(wallet(f).reserved, 2);
          assert.equal(calls, 1);
          assert.equal(daily(f), 1);
          finish();
          assert.equal((await first).status, 200);
          assert.equal(wallet(f).balance, 198);
          assert.equal(wallet(f).reserved, 0);
        },
      );
      await check(
        kind +
          ": provider failure refunds once and same uncertain intent never dispatches again",
        async () => {
          const f = fixture(kind === "search"),
            key = crypto.randomUUID();
          transport = () =>
            Response.json(
              { error: "Synthetic provider failure" },
              { status: 500 },
            );
          await send(f, kind, key, 502, "EMBEDDING_PROVIDER_ERROR");
          await send(f, kind, key, 409, "AI_REQUEST_FAILED");
          assert.equal(calls, 1);
          assert.equal(wallet(f).balance, 200);
          assert.equal(wallet(f).reserved, 0);
          transport = success;
          await send(f, kind, crypto.randomUUID());
          assert.equal(calls, 2);
          assert.equal(wallet(f).balance, 198);
        },
      );
      await check(
        kind +
          ": cancellation after provider response rolls back hold and produces no excerpts/vectors",
        async () => {
          const f = fixture(kind === "search"),
            key = crypto.randomUUID(),
            ctrl = new AbortController();
          transport = (url, init) => {
            ctrl.abort();
            return success(url, init);
          };
          const r = await send(f, kind, key, 499, "REQUEST_CANCELLED", {
            signal: ctrl.signal,
          });
          assert.equal(r.hits, undefined);
          assert.equal(r.document, undefined);
          assert.equal(wallet(f).balance, 200);
          assert.equal(wallet(f).reserved, 0);
          assert.equal(
            (await send(f, "receipt", key)).receipt.status,
            "failed",
          );
          if (kind === "embed") assert.equal(semantic(f), false);
          await send(f, kind, key, 409, "AI_REQUEST_FAILED");
          assert.equal(calls, 1);
        },
      );
      await check(
        kind +
          ": canonical session revocation at provider settlement prevents result and charge",
        async () => {
          const f = fixture(kind === "search"),
            key = crypto.randomUUID();
          transport = (url, init) => {
            db.prepare(
              "UPDATE users SET session_version=session_version+1 WHERE id=?",
            ).run(f.u.id);
            return success(url, init);
          };
          const r = await send(f, kind, key, 401, "SESSION_REVOKED");
          assert.equal(r.hits, undefined);
          assert.equal(r.document, undefined);
          assert.equal(wallet(f).balance, 200);
          assert.equal(wallet(f).reserved, 0);
          if (kind === "embed") assert.equal(semantic(f), false);
          assert.equal(
            db
              .prepare("SELECT status FROM ai_http_requests WHERE user_id=?")
              .get(f.u.id).status,
            "failed",
          );
        },
      );
      await check(
        kind +
          ": receipt commit fault atomically restores credit and embedding state",
        async () => {
          const f = fixture(kind === "search"),
            key = crypto.randomUUID();
          db.exec(
            "CREATE TRIGGER fail_rag_receipt BEFORE UPDATE ON ai_http_requests WHEN NEW.status='completed' BEGIN SELECT RAISE(ABORT,'SYNTHETIC_RECEIPT_FAILURE'); END",
          );
          try {
            await send(f, kind, key, 503, "PLATFORM_UNAVAILABLE");
          } finally {
            db.exec("DROP TRIGGER fail_rag_receipt");
          }
          assert.equal(wallet(f).balance, 200);
          assert.equal(wallet(f).reserved, 0);
          if (kind === "embed") assert.equal(semantic(f), false);
          assert.equal(
            (await send(f, "receipt", key)).receipt.status,
            "failed",
          );
          assert.equal(
            store
              .listUsage(100)
              .filter((e) => e.userId === f.u.id && e.status === "success")
              .length,
            0,
          );
        },
      );
      await check(
        kind +
          ": changed source during provider call refunds and does not commit stale evidence",
        async () => {
          const f = fixture(kind === "search"),
            key = crypto.randomUUID();
          transport = (url, init) => {
            f.d = store.ragIndex(
              f.u.id,
              {
                workspaceId: "main",
                clientItemId: f.d.clientItemId,
                title: "Revised triangle lesson",
                text: "A revised triangle source requires counting all three vertices again.",
              },
              f.u.sessionVersion,
            );
            return success(url, init);
          };
          const r = await send(f, kind, key, 409, "RAG_SOURCE_CHANGED");
          assert.equal(r.hits, undefined);
          assert.equal(wallet(f).balance, 200);
          assert.equal(wallet(f).reserved, 0);
          assert.equal(semantic(f), false);
        },
      );
      await check(
        kind +
          ": deletion during provider call refunds without restoring erased content",
        async () => {
          const f = fixture(kind === "search"),
            key = crypto.randomUUID();
          transport = (url, init) => {
            store.ragDeleteSource(f.u.id, f.d.clientItemId, f.u.sessionVersion);
            return success(url, init);
          };
          await send(f, kind, key, 404, "RAG_DOCUMENT_NOT_FOUND");
          assert.equal(wallet(f).balance, 200);
          assert.equal(wallet(f).reserved, 0);
          assert.equal(store.ragList(f.u.id, "main").length, 0);
        },
      );
    }
    await check(
      "A fresh unchanged embedding key stays free without a receipt or paid quota",
      async () => {
        const f = fixture(true),
          key = crypto.randomUUID(),
          r = await send(f, "embed", key);
        assert.equal(r.unchanged, true);
        assert.equal(r.credits, 0);
        assert.equal(calls, 0);
        assert.equal(wallet(f).balance, 200);
        assert.equal(count(f), 0);
        assert.equal(daily(f), 0);
        await send(f, "receipt", key, 404, "AI_REQUEST_NOT_FOUND");
      },
    );
    await check(
      "Fingerprint binds canonical document revision/model and query; changed paid intent cannot reuse key",
      async () => {
        const f = fixture(true),
          key = crypto.randomUUID();
        await send(f, "search", key);
        await send(f, "search", key, 409, "AI_REQUEST_CONFLICT", {
          body: { ...payload(f, "search"), query: "different question" },
        });
        await send(f, "embed", key, 409, "AI_REQUEST_CONFLICT");
        assert.equal(calls, 1);
        f.d = store.ragIndex(
          f.u.id,
          {
            workspaceId: "main",
            clientItemId: f.d.clientItemId,
            title: "Revised",
            text: "The revised triangle has three different labels.",
          },
          f.u.sessionVersion,
        );
        const data = store.ragEmbeddingInput(f.u.id, "main", f.d.id);
        store.ragSetEmbeddings(
          f.u.id,
          "main",
          f.d.id,
          data.digest,
          data.revision,
          process.env.OPENAI_EMBEDDING_MODEL,
          data.chunks.map(vector),
        );
        await send(f, "search", key, 409, "AI_REQUEST_CONFLICT");
        assert.equal(calls, 1);
        assert.equal(wallet(f).balance, 198);
      },
    );
    await check(
      "Embedding model configuration is part of the immutable paid intent",
      async () => {
        const f = fixture(),
          key = crypto.randomUUID();
        await send(f, "embed", key);
        const model = process.env.OPENAI_EMBEDDING_MODEL;
        process.env.OPENAI_EMBEDDING_MODEL = "text-embedding-3-large";
        try {
          await send(f, "embed", key, 409, "AI_REQUEST_CONFLICT");
        } finally {
          process.env.OPENAI_EMBEDDING_MODEL = model;
        }
        assert.equal(calls, 1);
        assert.equal(wallet(f).balance, 198);
        assert.equal(daily(f), 1);
      },
    );
    await check(
      "Identical UUIDs remain account scoped and cannot retrieve another account's result",
      async () => {
        const a = fixture(),
          b = fixture(),
          key = crypto.randomUUID();
        const first = await send(a, "embed", key);
        await send(b, "receipt", key, 404, "AI_REQUEST_NOT_FOUND");
        const second = await send(b, "embed", key);
        assert.notEqual(first.requestId, second.requestId);
        assert.equal(calls, 2);
        assert.equal(wallet(a).balance, 198);
        assert.equal(wallet(b).balance, 198);
      },
    );
    await check(
      "Query whitespace/key casing/JSON field order preserve the same paid search intent",
      async () => {
        const f = fixture(true),
          key = crypto.randomUUID();
        await send(f, "search", key);
        await send(
          f,
          "search",
          key.toUpperCase(),
          409,
          "AI_REQUEST_COMPLETED",
          {
            body: {
              query: "  triangle  ",
              scope: {
                consent: true,
                mode: "hybrid",
                documentIds: [f.d.id],
                workspaceId: "main",
              },
            },
          },
        );
        assert.equal(calls, 1);
        assert.equal(wallet(f).balance, 198);
      },
    );
    await check(
      "Native pairing user binding and receipt account ownership hold for paid RAG endpoints",
      async () => {
        const f = fixture(),
          other = fixture(),
          token = store.exchangeMobileCode(
            store.createMobileCode(f.u.id, f.u.sessionVersion).code,
            "Synthetic native fixture",
          ).accessToken,
          key = crypto.randomUUID();
        await send(f, "embed", key, 401, "SESSION_REVOKED", {
          native: token,
          headers: { "x-lumio-user": other.u.id },
        });
        await send(f, "embed", key, 200, undefined, { native: token });
        await send(f, "embed", key, 409, "AI_REQUEST_COMPLETED", {
          native: token,
        });
        await send(other, "receipt", key, 404, "AI_REQUEST_NOT_FOUND");
        assert.equal(calls, 1);
        assert.equal(wallet(other).balance, 200);
      },
    );
    await check(
      "Abandoned paid embedding lease fences late commit and refunds without automatic rerun",
      async () => {
        const f = fixture(),
          key = crypto.randomUUID();
        transport = async (url, init) => {
          clock += http.AI_HTTP_LIMITS.leaseMs + 1;
          await send(f, "embed", key, 409, "AI_REQUEST_FAILED");
          return success(url, init);
        };
        await send(f, "embed", key, 409, "BILLING_REQUEST_FINALIZED");
        assert.equal(calls, 1);
        assert.equal(wallet(f).balance, 200);
        assert.equal(wallet(f).reserved, 0);
        assert.equal(semantic(f), false);
      },
    );
    await check(
      "Paid RAG receipts survive SQLite reopen and contain only digest/metadata, never source or vectors",
      async () => {
        const f = fixture(),
          key = crypto.randomUUID();
        await send(f, "embed", key);
        const rows = db
          .prepare("SELECT * FROM ai_http_requests WHERE user_id=?")
          .all(f.u.id);
        assert.doesNotMatch(
          JSON.stringify(rows),
          /triangle|vertices|vector|Authored/,
        );
        assert.equal(rows[0].endpoint, "rag-embed");
        assert.match(rows[0].fingerprint, /^[a-f0-9]{64}$/);
        const reopened = platform.createStore(file, { now: () => clock });
        try {
          assert.equal(
            reopened.readAIHttpRequest(f.u.id, f.u.sessionVersion, key).status,
            "completed",
          );
          assert.equal(
            reopened.getBillingSnapshot(f.u.id, f.u.sessionVersion).account
              .balance,
            198,
          );
        } finally {
          reopened.close();
        }
      },
    );
    const report = {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
      scope:
        "Actual authenticated RAG/embed/receipt handlers and temporary SQLite/ledger/metadata receipt transactions. Synthetic OAuth session and fake embedding provider transport only; no real provider calls, public deployment or native device claim.",
      providerRequests: 0,
      productionDeployment: "NOT_TESTED",
    };
    fs.mkdirSync(path.join(root, "docs/v7/reports"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/v7/reports/rag-billing.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log("V7 RAG billing: " + checks.length + " checks passed.");
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
