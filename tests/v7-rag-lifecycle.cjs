// Real RAG handlers and isolated SQLite; zero external provider/OAuth calls.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript"),
  { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  cache = new Map(),
  checks = [];
let session = null;
function load(relative) {
  const file = path.resolve(root, relative);
  if (file === path.resolve(root, "lib/lumio/auth.ts"))
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
    LUMIO_AI_ENABLED: "true",
    LUMIO_BACKGROUND_JOBS_DISABLED: "true",
  },
  saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]])),
  originalFetch = global.fetch;
Object.assign(process.env, env);
global.fetch = async () => {
  throw Error("EXTERNAL_NETWORK_FORBIDDEN");
};
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v7-rag-delete-")),
  file = path.join(folder, "test.sqlite"),
  platform = load("lib/server/store.ts"),
  store = platform.createStore(file),
  db = new DatabaseSync(file);
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
});
const api = load("app/api/rag/documents/route.ts"),
  origin = "http://127.0.0.1:3000";
const user = (id) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: "rag-lifecycle-" + id,
    name: "Synthetic " + id,
    emailVerified: false,
  });
let a = user("a");
const b = user("b"),
  sourceId = "same-local-source";
function req(u, body, options = {}) {
  session = u ? { userId: u.id, sessionVersion: u.sessionVersion } : null;
  return new Request(origin + "/api/rag/documents" + (options.query || ""), {
    method: options.method || "POST",
    headers: {
      ...(options.native
        ? {
            authorization: "Bearer " + options.native,
            "x-lumio-user": u?.id || "",
          }
        : { origin, "x-lumio-account": u?.storageKey || "" }),
      "content-type": "application/json",
      ...options.headers,
    },
    ...((options.method || "POST") === "GET"
      ? {}
      : { body: JSON.stringify(body) }),
  });
}
async function result(r, status = 200, error) {
  const response = await api[r.method](r),
    body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body));
  assert.match(response.headers.get("cache-control"), /no-store/);
  if (error) assert.equal(body.error, error);
  return body;
}
const index = (u, space, id = sourceId) =>
  store.ragIndex(
    u.id,
    {
      workspaceId: space,
      clientItemId: id,
      title: "Synthetic geometry",
      text: "A triangle has three sides. This synthetic geometry source explains triangles.",
    },
    u.sessionVersion,
  );
const snap = (u, d) =>
  store.ragPrepareSnapshot(
    u.id,
    u.sessionVersion,
    { workspaceId: d.workspaceId, documentIds: [d.id] },
    "triangle",
  );
const count = (table, owner) =>
  Number(
    db
      .prepare("SELECT count(*) n FROM " + table + " WHERE user_id=?")
      .get(owner).n,
  );
const check = async (name, fn) => {
  await fn();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
};
let main,
  old,
  keep,
  foreign,
  mainSnapshot,
  oldSnapshot,
  keepSnapshot,
  foreignSnapshot;
(async () => {
  try {
    main = index(a, "main");
    old = index(a, "old-workspace");
    keep = index(a, "keep", "other-source");
    foreign = index(b, "main");
    mainSnapshot = snap(a, main);
    oldSnapshot = snap(a, old);
    keepSnapshot = snap(a, keep);
    foreignSnapshot = snap(b, foreign);
    await check(
      "Stale/missing account header blocks list, snapshot URL and source deletion before side effects",
      async () => {
        const n = count("rag_documents", a.id);
        for (const header of ["", b.storageKey]) {
          await result(
            req(a, null, {
              method: "GET",
              query: "?workspaceId=main",
              headers: { "x-lumio-account": header },
            }),
            401,
            "SESSION_REVOKED",
          );
          await result(
            req(a, null, {
              method: "GET",
              query: "?snapshotId=" + mainSnapshot.id,
              headers: { "x-lumio-account": header },
            }),
            401,
            "SESSION_REVOKED",
          );
          await result(
            req(
              a,
              { action: "delete-source", clientItemId: sourceId },
              { headers: { "x-lumio-account": header } },
            ),
            401,
            "SESSION_REVOKED",
          );
        }
        assert.equal(count("rag_documents", a.id), n);
      },
    );
    await check(
      "Guest and hostile-origin deletion cannot resolve or erase source IDs",
      async () => {
        await result(
          req(null, { action: "delete-source", clientItemId: sourceId }),
          401,
          "SIGN_IN_REQUIRED",
        );
        await result(
          req(
            a,
            { action: "delete-source", clientItemId: sourceId },
            { headers: { origin: "https://evil.invalid" } },
          ),
          403,
          "INVALID_ORIGIN",
        );
        assert.equal(count("rag_documents", a.id), 3);
      },
    );
    await check(
      "Delete-source requires strict bounded ID and refuses forged owner/workspace/action shapes",
      async () => {
        for (const body of [
          { action: ["delete-source"], clientItemId: sourceId },
          { action: "delete-source", clientItemId: [] },
          { action: "delete-source", clientItemId: "" },
          { action: "delete-source", clientItemId: "a".repeat(101) },
          { action: "delete-source", clientItemId: "bad\nkey" },
          { action: "delete-source", clientItemId: sourceId, userId: b.id },
          {
            action: "delete-source",
            clientItemId: sourceId,
            workspaceId: "old-workspace",
          },
        ]) {
          const r = await api.POST(req(a, body));
          assert.equal(r.status, 400);
        }
        assert.equal(count("rag_documents", a.id), 3);
      },
    );
    await check(
      "A foreign actor cannot erase an owner-only source or infer its existence",
      async () => {
        const onlyA = index(a, "main", "only-a");
        assert.deepEqual(
          await result(
            req(b, { action: "delete-source", clientItemId: "only-a" }),
          ),
          { deleted: 0 },
        );
        assert.equal(
          store.ragList(a.id, "main").some((d) => d.id === onlyA.id),
          true,
        );
        store.ragDelete(a.id, "main", onlyA.id, a.sessionVersion);
        mainSnapshot = snap(a, main);
      },
    );
    await check(
      "Session revocation between authorization and streamed body parsing rolls deletion back",
      async () => {
        session = { userId: a.id, sessionVersion: a.sessionVersion };
        const payload = JSON.stringify({
          action: "delete-source",
          clientItemId: sourceId,
        });
        const stream = new ReadableStream(
          {
            pull(c) {
              db.prepare(
                "UPDATE users SET session_version=session_version+1 WHERE id=?",
              ).run(a.id);
              c.enqueue(new TextEncoder().encode(payload));
              c.close();
            },
          },
          { highWaterMark: 0 },
        );
        const r = new Request(origin + "/api/rag/documents", {
          method: "POST",
          headers: {
            origin,
            "content-type": "application/json",
            "x-lumio-account": a.storageKey,
          },
          body: stream,
          duplex: "half",
        });
        await result(r, 401, "SESSION_REVOKED");
        assert.equal(count("rag_documents", a.id), 3);
        a = store.getUser(a.id);
        keepSnapshot = snap(a, keep);
      },
    );
    await check(
      "Failure deleting a document restores all affected snapshots and chunks atomically",
      async () => {
        const docs = count("rag_documents", a.id),
          chunks = count("rag_chunks", a.id),
          snaps = count("rag_snapshots", a.id);
        db.exec(
          "CREATE TRIGGER fail_rag_source_delete BEFORE DELETE ON rag_documents WHEN OLD.client_item_id='same-local-source' BEGIN SELECT RAISE(ABORT,'SYNTHETIC_DELETE_FAILURE'); END",
        );
        try {
          await result(
            req(a, { action: "delete-source", clientItemId: sourceId }),
            503,
            "PLATFORM_UNAVAILABLE",
          );
        } finally {
          db.exec("DROP TRIGGER fail_rag_source_delete");
        }
        assert.equal(count("rag_documents", a.id), docs);
        assert.equal(count("rag_chunks", a.id), chunks);
        assert.equal(count("rag_snapshots", a.id), snaps);
        assert.equal(count("rag_documents", b.id), 1);
      },
    );
    await check(
      "All owned workspace copies and cached evidence delete, leaving unrelated and other-owner data",
      async () => {
        assert.deepEqual(
          await result(
            req(a, { action: "delete-source", clientItemId: sourceId }),
          ),
          { deleted: 2 },
        );
        assert.equal(count("rag_documents", a.id), 1);
        assert.equal(count("rag_chunks", a.id), keep.chunks);
        assert.equal(count("rag_documents", b.id), 1);
        assert.equal(count("rag_chunks", b.id), foreign.chunks);
        assert.equal(
          db
            .prepare(
              "SELECT count(*) n FROM rag_snapshots WHERE user_id=? AND workspace_id IN('main','old-workspace')",
            )
            .get(a.id).n,
          0,
        );
        assert.equal(
          store.ragReadSnapshot(a.id, a.sessionVersion, keepSnapshot.id).id,
          keepSnapshot.id,
        );
        assert.equal(
          store.ragReadSnapshot(b.id, b.sessionVersion, foreignSnapshot.id).id,
          foreignSnapshot.id,
        );
        assert.equal(store.ragList(a.id, "old-workspace").length, 0);
      },
    );
    await check(
      "Repeated deletion is an idempotent metadata-only zero without a credit mutation",
      async () => {
        const before = store.getBillingSnapshot(a.id, a.sessionVersion).account;
        assert.deepEqual(
          await result(
            req(a, { action: "delete-source", clientItemId: sourceId }),
          ),
          { deleted: 0 },
        );
        assert.deepEqual(
          store.getBillingSnapshot(a.id, a.sessionVersion).account,
          before,
        );
      },
    );
    await check(
      "Native source access requires matching canonical user and rejects browser credential mixing",
      async () => {
        const token = store.exchangeMobileCode(
          store.createMobileCode(b.id, b.sessionVersion).code,
          "Synthetic native",
        ).accessToken;
        await result(
          req(b, null, {
            method: "GET",
            native: token,
            query: "?workspaceId=main",
            headers: { "x-lumio-user": a.id },
          }),
          401,
          "SESSION_REVOKED",
        );
        const list = await result(
          req(b, null, {
            method: "GET",
            native: token,
            query: "?workspaceId=main",
          }),
        );
        assert.equal(list.documents[0].id, foreign.id);
        await result(
          req(
            b,
            { action: "delete-source", clientItemId: "not-present" },
            { native: token, headers: { cookie: "synthetic" } },
          ),
          403,
          "INVALID_ORIGIN",
        );
      },
    );
    await check(
      "Existing per-document delete stays scoped and invalidates only its owned workspace",
      async () => {
        await result(
          req(a, {
            action: "delete",
            workspaceId: "main",
            documentId: foreign.id,
          }),
          404,
          "RAG_DOCUMENT_NOT_FOUND",
        );
        assert.deepEqual(
          await result(
            req(a, {
              action: "delete",
              workspaceId: "keep",
              documentId: keep.id,
            }),
          ),
          { deleted: true },
        );
        assert.equal(count("rag_documents", a.id), 0);
        assert.equal(count("rag_chunks", a.id), 0);
        assert.equal(count("rag_documents", b.id), 1);
      },
    );
    const report = {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
      scope:
        "Actual authenticated handlers and isolated SQLite, synthetic accounts and exact stored snapshots/chunks. OAuth session is fixture only; no external provider/network/student data.",
      providerRequests: 0,
    };
    fs.mkdirSync(path.join(root, "docs/v7/reports"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/v7/reports/rag-lifecycle.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log("V7 RAG lifecycle: " + checks.length + " checks passed.");
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
