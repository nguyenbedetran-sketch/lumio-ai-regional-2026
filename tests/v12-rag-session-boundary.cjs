// Actual RAG route/core/ledger on an isolated in-memory SQLite database.
// OAuth is an explicit synthetic session boundary; provider transport is forbidden.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  cp = require("node:child_process"),
  { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  baseline = process.argv.includes("--baseline"),
  checks = [];
function loader(mocks) {
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(root, relative),
      key = path.relative(root, file).replaceAll("\\", "/");
    if (Object.hasOwn(mocks, key)) return mocks[key];
    if (cache.has(file)) return cache.get(file).exports;
    const m = { exports: {} };
    cache.set(file, m);
    const old =
      baseline &&
      ["lib/server/rag-core.ts", "app/api/rag/documents/route.ts"].includes(
        key,
      );
    const source = old
      ? cp.execFileSync("git", ["show", "f1ac9c2:" + key], {
          cwd: root,
          encoding: "utf8",
        })
      : fs.readFileSync(file, "utf8");
    new Function(
      "require",
      "module",
      "exports",
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    )(
      (name) => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        return name.startsWith(".")
          ? load(path.resolve(path.dirname(file), name + ".ts"))
          : require(name);
      },
      m,
      m.exports,
    );
    return m.exports;
  }
  return load;
}
async function fixture(run) {
  let session = null,
    hook = "",
    depth = 0,
    maxDepth = 0,
    privateReads = 0,
    purges = 0,
    providerCalls = 0;
  const raw = new DatabaseSync(":memory:"),
    sqlDepths = [],
    clock = Date.now();
  const db = {
    mode: "local-sqlite",
    prepare(sql) {
      const privateQuery =
        /^SELECT /i.test(sql) && /\b(?:rag_documents|rag_chunks)\b/.test(sql);
      if (privateQuery) {
        privateReads++;
        sqlDepths.push(depth);
      }
      return raw.prepare(sql);
    },
    exec(sql) {
      if (/^BEGIN/i.test(sql)) {
        assert.equal(depth, 0, "nested transaction");
        depth++;
        maxDepth = Math.max(maxDepth, depth);
      }
      try {
        return raw.exec(sql);
      } finally {
        if (/^(?:COMMIT|ROLLBACK)/i.test(sql)) depth--;
      }
    },
    close() {
      raw.close();
    },
  };
  const mocks = {},
    load = loader(mocks),
    platform = load("lib/server/store.ts"),
    store = platform.createStore(":injected:", {
      database: db,
      now: () => clock,
      adminEmails: ["operator@example.test"],
    });
  const identity = (name) => ({
    provider: "google",
    providerAccountId: "rag-session-" + name,
    name: "Synthetic " + name,
    email: name + "@example.test",
    emailVerified: true,
  });
  const admin = store.ensureIdentity(identity("operator")),
    a = store.ensureIdentity(identity("A")),
    b = store.ensureIdentity(identity("B"));
  const index = (user, space, clientItemId) =>
    store.ragIndex(
      user.id,
      {
        workspaceId: space,
        clientItemId,
        title: "PRIVATE_SYNTHETIC_" + clientItemId,
        text: "A triangle has three sides. Private synthetic excerpt.",
      },
      user.sessionVersion,
    );
  const doc = index(a, "main", "owner-source"),
    expired = index(a, "main", "expired-source"),
    foreign = index(b, "main", "other-owner"),
    otherSpace = index(a, "other", "other-workspace");
  raw
    .prepare("UPDATE rag_documents SET expires_at=? WHERE id=?")
    .run(clock - 1, expired.id);
  const expiredCount = () =>
    Number(
      raw
        .prepare("SELECT count(*) n FROM rag_documents WHERE id=?")
        .get(expired.id).n,
    );
  const revoke = () =>
    store.updateUserAccess(
      admin.id,
      a.id,
      "revoke",
      "Synthetic captured session revoked",
      admin.sessionVersion,
    );
  const apiStore = {
    ...store,
    ragList(...args) {
      if (hook === "list") {
        hook = "";
        revoke();
      }
      return store.ragList(...args);
    },
    ragEmbeddingInput(...args) {
      if (hook === "preflight") {
        hook = "";
        revoke();
      }
      return store.ragEmbeddingInput(...args);
    },
    checkAIHttpReplay(...args) {
      const result = store.checkAIHttpReplay(...args);
      if (hook === "unchanged") {
        hook = "";
        revoke();
      }
      return result;
    },
  };
  mocks["lib/server/store.ts"] = {
    ...platform,
    getStore: () => apiStore,
    getUser: (id) => store.getUser(id),
  };
  mocks["lib/lumio/auth.ts"] = {
    authOptions: () => ({}),
    providerStatus: () => ({ google: true }),
  };
  mocks["next-auth"] = { getServerSession: async () => session };
  mocks["lib/rag/embeddings.ts"] = {
    embeddingStatus: () => ({
      enabled: true,
      model: "text-embedding-3-small",
      dimensions: 256,
    }),
    embedTexts: async () => {
      providerCalls++;
      throw Error("PROVIDER_FORBIDDEN");
    },
  };
  const api = load("app/api/rag/documents/route.ts");
  const request = (user = a, body) => {
    session = { userId: user.id, sessionVersion: user.sessionVersion };
    return new Request(
      "https://rag-fixture.invalid/api/rag/documents?workspaceId=main",
      {
        method: body ? "POST" : "GET",
        headers: {
          origin: "https://rag-fixture.invalid",
          "sec-fetch-site": "same-origin",
          "x-lumio-account": user.storageKey,
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
  };
  const resetCounters = () => {
    privateReads = 0;
    purges = 0;
    sqlDepths.length = 0;
    maxDepth = 0;
  };
  // Track cleanup through statement execution, without altering production SQL.
  const prepared = db.prepare;
  db.prepare = (sql) => {
    const statement = prepared(sql);
    return /^DELETE FROM rag_(?:documents|snapshots)/i.test(sql)
      ? {
          run(...args) {
            purges++;
            return statement.run(...args);
          },
        }
      : statement;
  };
  const vector = Array.from({ length: 256 }, (_, i) => (i === 0 ? 1 : 0));
  try {
    resetCounters();
    await run({
      store,
      a,
      b,
      admin,
      doc,
      expired,
      foreign,
      otherSpace,
      raw,
      api,
      request,
      revoke,
      expiredCount,
      resetCounters,
      vector,
      setHook: (v) => {
        hook = v;
      },
      metrics: () => ({
        privateReads,
        purges,
        sqlDepths,
        maxDepth,
        providerCalls,
      }),
    });
  } finally {
    store.close();
  }
}
async function test(name, fn) {
  await fixture(fn);
  checks.push(name);
  console.log("PASS " + name);
}
async function main() {
  if (baseline) {
    await test("Baseline f1ac9c2 actual GET lists private metadata after captured-session revocation", async (f) => {
      f.setHook("list");
      const response = await f.api.GET(f.request());
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.ok(
        body.documents.some(
          (d) => d.title === "PRIVATE_SYNTHETIC_owner-source",
        ),
      );
      assert.equal(f.expiredCount(), 0);
      assert.equal(f.metrics().providerCalls, 0);
    });
    await test("Baseline core embedding preflight ignores supplied stale version and reads source chunks", async (f) => {
      f.revoke();
      f.resetCounters();
      const input = f.store.ragEmbeddingInput(
        f.a.id,
        "main",
        f.doc.id,
        f.a.sessionVersion,
      );
      assert.match(input.chunks[0].text, /Private synthetic excerpt/);
      assert.ok(f.metrics().privateReads > 0);
    });
    console.log(
      JSON.stringify({
        baseline: "f1ac9c2",
        reproduced: true,
        passed: checks.length,
        providerCalls: 0,
      }),
    );
    return;
  }
  await test("Actual GET rejects session revoked after HTTP authorization before listing or expiry cleanup", async (f) => {
    f.setHook("list");
    const response = await f.api.GET(f.request());
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error, "SESSION_REVOKED");
    assert.ok(!JSON.stringify(body).includes("PRIVATE_SYNTHETIC"));
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(f.metrics().privateReads, 0);
    assert.equal(f.metrics().purges, 0);
    assert.equal(f.expiredCount(), 1);
  });
  await test("Core list rejects stale captured version without private reads or cleanup", async (f) => {
    f.revoke();
    f.resetCounters();
    assert.throws(
      () => f.store.ragList(f.a.id, "main", f.a.sessionVersion),
      (e) => e.code === "SESSION_REVOKED",
    );
    assert.equal(f.metrics().privateReads, 0);
    assert.equal(f.metrics().purges, 0);
    assert.equal(f.expiredCount(), 1);
  });
  await test("Core embedding preflight rejects stale captured version before source/chunk reads", async (f) => {
    f.revoke();
    f.resetCounters();
    assert.throws(
      () =>
        f.store.ragEmbeddingInput(f.a.id, "main", f.doc.id, f.a.sessionVersion),
      (e) => e.code === "SESSION_REVOKED",
    );
    assert.equal(f.metrics().privateReads, 0);
  });
  await test("Actual embedding POST rechecks captured version before private preflight and any provider/credit receipt", async (f) => {
    f.setHook("preflight");
    const response = await f.api.POST(
      f.request(f.a, {
        action: "embed",
        externalConsent: true,
        documentId: f.doc.id,
        workspaceId: "main",
      }),
    );
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "SESSION_REVOKED");
    assert.equal(f.metrics().privateReads, 0);
    assert.equal(f.metrics().providerCalls, 0);
    assert.equal(
      Number(
        f.raw.prepare("SELECT count(*) n FROM billing_reservations").get().n,
      ),
      0,
    );
  });
  await test("Already-embedded fast path rejects a session revoked after replay precheck without returning metadata", async (f) => {
    const input = f.store.ragEmbeddingInput(
      f.a.id,
      "main",
      f.doc.id,
      f.a.sessionVersion,
    );
    f.store.ragSetEmbeddings(
      f.a.id,
      "main",
      f.doc.id,
      f.doc.digest,
      f.doc.revision,
      "text-embedding-3-small",
      input.chunks.map(() => f.vector),
      false,
      f.a.sessionVersion,
    );
    f.setHook("unchanged");
    const response = await f.api.POST(
      f.request(f.a, {
        action: "embed",
        externalConsent: true,
        documentId: f.doc.id,
        workspaceId: "main",
      }),
    );
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error, "SESSION_REVOKED");
    assert.ok(!JSON.stringify(body).includes("PRIVATE_SYNTHETIC"));
    assert.equal(f.metrics().providerCalls, 0);
  });
  await test("Fresh GET remains owner/workspace scoped and excludes source text while cleaning expired records", async (f) => {
    const response = await f.api.GET(f.request());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(
      body.documents.map((d) => d.id),
      [f.doc.id],
    );
    assert.ok(!JSON.stringify(body).includes("Private synthetic excerpt"));
    assert.equal(f.expiredCount(), 0);
    assert.ok(f.metrics().sqlDepths.every((depth) => depth === 1));
    assert.equal(f.metrics().maxDepth, 1);
  });
  await test("Fresh embedding preflight uses the same transaction for authorization and source/chunk reads", async (f) => {
    const data = f.store.ragEmbeddingInput(
      f.a.id,
      "main",
      f.doc.id,
      f.a.sessionVersion,
    );
    assert.match(data.chunks[0].text, /Private synthetic excerpt/);
    assert.ok(f.metrics().sqlDepths.length >= 2);
    assert.ok(f.metrics().sqlDepths.every((depth) => depth === 1));
    assert.equal(f.metrics().maxDepth, 1);
  });
  await test("Embedding preflight still rejects foreign-owner and wrong-workspace document IDs", async (f) => {
    for (const id of [f.foreign.id, f.otherSpace.id])
      assert.throws(
        () => f.store.ragEmbeddingInput(f.a.id, "main", id, f.a.sessionVersion),
        (e) => e.code === "RAG_DOCUMENT_NOT_FOUND",
      );
  });
  await test("Canonical new session can read after revocation without reinstating the old version", async (f) => {
    f.revoke();
    const fresh = f.store.getUser(f.a.id);
    assert.equal(
      f.store.ragList(fresh.id, "main", fresh.sessionVersion).length,
      1,
    );
    assert.throws(
      () => f.store.ragList(f.a.id, "main", f.a.sessionVersion),
      (e) => e.code === "SESSION_REVOKED",
    );
  });
  await test("Embedding write inside actual ledger settlement does not open a nested read transaction", async (f) => {
    const input = f.store.ragEmbeddingInput(
        f.a.id,
        "main",
        f.doc.id,
        f.a.sessionVersion,
      ),
      reservation = f.store.reserveUsage({
        userId: f.a.id,
        sessionVersion: f.a.sessionVersion,
        requestId: crypto.randomUUID(),
        task: "index",
        mode: "quick",
        kind: "text",
      });
    f.resetCounters();
    const result = f.store.settleUsage({
      userId: f.a.id,
      reservationId: reservation.reservationId,
      onSettled() {
        f.store.ragSetEmbeddings(
          f.a.id,
          "main",
          f.doc.id,
          f.doc.digest,
          f.doc.revision,
          "text-embedding-3-small",
          input.chunks.map(() => f.vector),
          true,
          f.a.sessionVersion,
        );
      },
    });
    assert.equal(result.status, "settled");
    assert.equal(f.metrics().maxDepth, 1);
    assert.ok(f.store.ragList(f.a.id, "main", f.a.sessionVersion)[0].semantic);
  });
  console.log(
    JSON.stringify({
      status: "PASS",
      passed: checks.length,
      providerCalls: 0,
      scope:
        "Actual RAG handlers/core/transactions/ledger with real isolated in-memory SQLite and synthetic OAuth; no live database, network, provider or browser",
    }),
  );
}
const names = ["NODE_ENV", "NEXTAUTH_URL", "OPENAI_EMBEDDING_MODEL"],
  previous = Object.fromEntries(names.map((k) => [k, process.env[k]]));
process.env.NODE_ENV = "production";
process.env.NEXTAUTH_URL = "https://rag-fixture.invalid";
process.env.OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const name of names)
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
  });
