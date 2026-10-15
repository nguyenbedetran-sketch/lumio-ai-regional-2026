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
const values = {
    NODE_ENV: "development",
    AUTH_TRUST_HOST: "true",
    NEXTAUTH_URL: "http://127.0.0.1:3000",
  },
  saved = Object.fromEntries(
    Object.keys(values).map((k) => [k, process.env[k]]),
  );
Object.assign(process.env, values);
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-sync-http-")),
  file = path.join(folder, "test.sqlite");
let time = Date.UTC(2026, 9, 15, 12),
  passed = 0;
const platform = load("lib/server/store.ts"),
  store = platform.createStore(file, { now: () => time }),
  db = new DatabaseSync(file);
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
});
const route = load("app/api/sync/route.ts"),
  { normalizeSyncEnvelope, MAX_SYNC_BYTES } = load("lib/sync/contracts.ts"),
  origin = "http://127.0.0.1:3000";
const user = (name) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: "sync-http-" + name,
    name: "Synthetic learner",
    emailVerified: false,
  });
const envelope = () => ({
  version: 1,
  library: { version: 1, items: [], spaces: [] },
  learning: { version: 1, tasks: [], reviews: [], events: [], focus: null },
  preferences: { version: 1, enabled: true, feedback: [] },
});
const item = (id, title) => ({
  id,
  title,
  kind: "text",
  spaceId: "",
  createdAt: new Date(time).toISOString(),
  updatedAt: new Date(time).toISOString(),
  text: "A synthetic source sentence.",
  notes: "",
  cards: [],
  questions: [],
  attempts: [],
  favorite: false,
});
function request(u, method = "GET", body, headers = {}) {
  session = u ? { userId: u.id, sessionVersion: u.sessionVersion } : null;
  return new Request(origin + "/api/sync", {
    method,
    headers: {
      ...(u ? { "x-lumio-account": u.storageKey } : {}),
      ...(method !== "GET"
        ? { "content-type": "application/json", origin }
        : {}),
      ...headers,
    },
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}
async function read(u) {
  const r = await route.GET(request(u));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /no-store/);
  return r.json();
}
async function write(u, snapshot, data, requestId = crypto.randomUUID()) {
  return route.PUT(
    request(u, "PUT", {
      epoch: snapshot.epoch,
      expectedRevision: snapshot.revision,
      requestId,
      data,
    }),
  );
}
async function rejected(r, status, code) {
  assert.equal(r.status, status);
  const result = await r.json();
  assert.equal(result.error, code);
  for (const key of [
    "stack",
    "sql",
    "source",
    "userId",
    "cookie",
    "accessToken",
  ])
    assert.equal(result[key], undefined);
  return result;
}
async function check(name, fn) {
  session = null;
  await fn();
  passed++;
  console.log("PASS " + name);
}
(async () => {
  try {
    await check(
      "Anonymous and revoked browser sessions cannot read or mutate snapshots",
      async () => {
        await rejected(await route.GET(request(null)), 401, "SIGN_IN_REQUIRED");
        const u = user("revoked"),
          old = { ...u };
        db.prepare(
          "UPDATE users SET session_version=session_version+1 WHERE id=?",
        ).run(u.id);
        await rejected(await route.GET(request(old)), 401, "SESSION_REVOKED");
      },
    );
    await check(
      "GET binds the exact page account and rejects cross-site reads",
      async () => {
        const u = user("read-binding");
        await rejected(
          await route.GET(
            request(u, "GET", undefined, { "x-lumio-account": "another-page" }),
          ),
          401,
          "SESSION_REVOKED",
        );
        for (const site of ["cross-site", "same-site"])
          await rejected(
            await route.GET(
              request(u, "GET", undefined, { "sec-fetch-site": site }),
            ),
            403,
            "INVALID_ORIGIN",
          );
        const a = await read(u),
          b = await read(user("different-epoch"));
        assert.notEqual(a.epoch, b.epoch);
        assert.equal(a.data, null);
      },
    );
    await check(
      "PUT and DELETE enforce origin, account headers and bounded JSON",
      async () => {
        const u = user("mutations"),
          s = await read(u),
          body = {
            epoch: s.epoch,
            expectedRevision: 0,
            requestId: crypto.randomUUID(),
            data: envelope(),
          };
        await rejected(
          await route.PUT(
            request(u, "PUT", body, { origin: "https://evil.invalid" }),
          ),
          403,
          "INVALID_ORIGIN",
        );
        await rejected(
          await route.PUT(
            request(u, "PUT", body, { "x-lumio-account": "old-account" }),
          ),
          401,
          "SESSION_REVOKED",
        );
        await rejected(
          await route.DELETE(
            request(
              u,
              "DELETE",
              { epoch: s.epoch, revision: 0 },
              { origin: "https://evil.invalid" },
            ),
          ),
          403,
          "INVALID_ORIGIN",
        );
        await rejected(
          await route.PUT(request(u, "PUT", "{broken")),
          400,
          "INVALID_JSON",
        );
        await rejected(
          await route.PUT(
            request(u, "PUT", body, { "content-type": "text/plain" }),
          ),
          415,
          "INVALID_CONTENT_TYPE",
        );
        await rejected(
          await route.PUT(
            request(u, "PUT", body, {
              "content-length": String(MAX_SYNC_BYTES + 9000),
            }),
          ),
          413,
          "PAYLOAD_TOO_LARGE",
        );
      },
    );
    await check(
      "Canonical ownership ignores body principals and foreign epochs cannot target other accounts",
      async () => {
        const a = user("body-a"),
          b = user("body-b"),
          sa = await read(a),
          sb = await read(b),
          data = envelope();
        data.library.items = [item("a", "A")];
        const r = await route.PUT(
          request(a, "PUT", {
            epoch: sa.epoch,
            expectedRevision: 0,
            requestId: crypto.randomUUID(),
            data,
            userId: b.id,
            sessionVersion: b.sessionVersion,
          }),
        );
        assert.equal(r.status, 200);
        assert.equal((await read(b)).data, null);
        await rejected(
          await write(b, { ...sb, epoch: sa.epoch }, data),
          409,
          "SYNC_CONFLICT",
        );
      },
    );
    await check(
      "CAS admits one concurrent revision and rejects stale HTTP writes without overwriting it",
      async () => {
        const u = user("cas"),
          s = await read(u),
          a = envelope(),
          b = envelope();
        a.library.items = [item("a", "First edit")];
        b.library.items = [item("b", "Second edit")];
        const responses = await Promise.all([write(u, s, a), write(u, s, b)]);
        assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
        const after = await read(u);
        assert.equal(after.revision, 1);
        assert.equal(after.data.library.items.length, 1);
      },
    );
    await check(
      "Lost-ACK replay returns the original result but cannot rewrite a newer committed revision",
      async () => {
        const u = user("lost-ack"),
          s = await read(u),
          a = envelope(),
          b = envelope(),
          key = crypto.randomUUID();
        a.library.items = [item("a", "Original acknowledged operation")];
        b.library.items = [item("b", "Newer edit from another device")];
        const first = await write(u, s, a, key),
          ack = await first.json();
        assert.equal(ack.revision, 1);
        assert.equal((await write(u, { ...s, revision: 1 }, b)).status, 200);
        const replay = await write(u, s, a, key);
        assert.equal(replay.status, 200);
        assert.deepEqual(await replay.json(), ack);
        const current = await read(u);
        assert.equal(current.revision, 2);
        assert.equal(current.data.library.items[0].id, "b");
        await rejected(await write(u, s, b, key), 409, "IDEMPOTENCY_CONFLICT");
      },
    );
    await check(
      "Delete uses CAS, invalidates outbox operations and never erases another account",
      async () => {
        const u = user("delete"),
          other = user("delete-other"),
          s = await read(u),
          data = envelope(),
          key = crypto.randomUUID();
        data.library.items = [item("kept-local", "Synthetic")];
        assert.equal((await write(u, s, data, key)).status, 200);
        await rejected(
          await route.DELETE(
            request(u, "DELETE", { epoch: s.epoch, revision: 0 }),
          ),
          409,
          "SYNC_CONFLICT",
        );
        const current = await read(u);
        await rejected(
          await route.DELETE(
            request(other, "DELETE", {
              epoch: current.epoch,
              revision: current.revision,
            }),
          ),
          409,
          "SYNC_CONFLICT",
        );
        assert.equal(
          (
            await route.DELETE(
              request(u, "DELETE", {
                epoch: current.epoch,
                revision: current.revision,
              }),
            )
          ).status,
          200,
        );
        await rejected(await write(u, s, data, key), 409, "SYNC_CONFLICT");
        const fresh = await read(u);
        assert.notEqual(fresh.epoch, s.epoch);
        assert.equal(fresh.data, null);
      },
    );
    await check(
      "Contract removes device media/timers/unknown fields and rejects corrupt or oversized envelopes",
      async () => {
        const u = user("normalization"),
          s = await read(u),
          data = envelope();
        data.library.items = [
          {
            ...item("file", "Synthetic attachment"),
            blob: new Blob(["not-synced"]),
            privateKey: "not-a-real-secret",
          },
        ];
        data.learning.alarm = {
          preset: "custom",
          volume: 0.4,
          customName: "device.wav",
        };
        data.learning.lastAlarmId = "local-only";
        data.privateKey = "not-a-real-secret";
        const result = normalizeSyncEnvelope(data);
        assert.equal(result.library.items[0].blob, undefined);
        assert.equal(result.library.items[0].privateKey, undefined);
        assert.equal(result.learning.focus, null);
        assert.equal(result.learning.alarm, undefined);
        assert.equal(result.privateKey, undefined);
        await rejected(
          await write(u, s, { ...data, learning: { version: 1 } }),
          400,
          "INVALID_SYNC_DATA",
        );
        await rejected(
          await write(u, s, { ...data, padding: "x".repeat(MAX_SYNC_BYTES) }),
          400,
          "SYNC_TOO_LARGE",
        );
        assert.equal((await read(u)).revision, 0);
      },
    );
    await check(
      "Nested device-only fields are stripped and duplicate learning events cannot corrupt a merge",
      async () => {
        const u = user("nested-contract"),
          s = await read(u),
          data = envelope(),
          at = new Date(time).toISOString();
        data.learning.privateKey = "test-only-not-a-real-secret";
        data.learning.customBinaryData = "not-a-media-payload";
        data.learning.tasks = [
          {
            id: "task",
            title: "Synthetic task",
            date: "2026-10-15",
            minutes: 25,
            itemId: "item",
            done: false,
            createdAt: at,
            privateKey: "device-only",
          },
        ];
        data.learning.reviews = [
          {
            key: "review",
            itemId: "item",
            cardId: "card",
            fingerprint: "fingerprint",
            interval: 1,
            ease: 2.5,
            repetitions: 1,
            reviewedAt: at,
            dueAt: at,
            deviceBlob: "local-only",
          },
        ];
        data.learning.events = [
          {
            id: "event",
            at,
            kind: "read",
            itemId: "item",
            privateKey: "device-only",
          },
        ];
        data.preferences.controls = {
          topics: ["Toán"],
          difficulty: "any",
          goal: "balanced",
          deviceSecret: "local-only",
        };
        assert.equal((await write(u, s, data)).status, 200);
        const current = await read(u),
          learning = current.data.learning;
        assert.equal(learning.privateKey, undefined);
        assert.equal(learning.customBinaryData, undefined);
        assert.equal(learning.tasks[0].privateKey, undefined);
        assert.equal(learning.reviews[0].deviceBlob, undefined);
        assert.equal(learning.events[0].privateKey, undefined);
        assert.equal(current.data.preferences.controls.deviceSecret, undefined);
        data.learning.events.push({ ...data.learning.events[0] });
        await rejected(await write(u, current, data), 400, "INVALID_SYNC_DATA");
        assert.equal((await read(u)).revision, 1);
      },
    );
    await check(
      "Idempotency keys require actual bounded strings rather than coerced JSON numbers",
      async () => {
        const u = user("strict-key"),
          s = await read(u);
        for (const requestId of [1234567890123456, "short", "x".repeat(101)])
          await rejected(
            await route.PUT(
              request(u, "PUT", {
                epoch: s.epoch,
                expectedRevision: 0,
                requestId,
                data: envelope(),
              }),
            ),
            400,
            "INVALID_SYNC_REQUEST",
          );
        assert.equal((await read(u)).revision, 0);
      },
    );
    await check(
      "A forced operation-log failure rolls back snapshot data and CAS revision atomically",
      async () => {
        const u = user("rollback"),
          s = await read(u),
          data = envelope();
        data.library.items = [item("not-committed", "Synthetic rollback")];
        db.exec(
          "CREATE TRIGGER sync_test_fault BEFORE INSERT ON sync_operations BEGIN SELECT RAISE(ABORT,'synthetic operation-log failure'); END;",
        );
        try {
          await rejected(await write(u, s, data), 503, "PLATFORM_UNAVAILABLE");
        } finally {
          db.exec("DROP TRIGGER sync_test_fault");
        }
        const current = await read(u);
        assert.equal(current.revision, 0);
        assert.equal(current.data, null);
        assert.equal(
          Number(
            db
              .prepare("SELECT count(*) n FROM sync_operations WHERE user_id=?")
              .get(u.id).n,
          ),
          0,
        );
      },
    );
    await check(
      "Inactive account payloads and idempotency records are globally purged on another account access",
      async () => {
        const inactive = user("inactive-retention"),
          s = await read(inactive),
          data = envelope();
        data.library.items = [
          item("expired-private", "Synthetic expired source"),
        ];
        assert.equal((await write(inactive, s, data)).status, 200);
        time += 7 * 86400000 + 1;
        await read(user("active-after-expiry"));
        assert.equal(
          Number(
            db
              .prepare("SELECT count(*) n FROM sync_snapshots WHERE user_id=?")
              .get(inactive.id).n,
          ),
          0,
        );
        assert.equal(
          Number(
            db
              .prepare("SELECT count(*) n FROM sync_operations WHERE user_id=?")
              .get(inactive.id).n,
          ),
          0,
        );
      },
    );
    await check(
      "Expired lost-ACK cannot receive an old successful acknowledgement after retention",
      async () => {
        const u = user("expired-replay"),
          s = await read(u),
          data = envelope(),
          key = crypto.randomUUID();
        assert.equal((await write(u, s, data, key)).status, 200);
        time += 7 * 86400000 + 1;
        await rejected(await write(u, s, data, key), 409, "SYNC_CONFLICT");
        assert.equal(
          Number(
            db
              .prepare("SELECT count(*) n FROM sync_operations WHERE user_id=?")
              .get(u.id).n,
          ),
          0,
        );
        const fresh = await read(u);
        assert.notEqual(fresh.epoch, s.epoch);
        assert.equal(fresh.revision, 0);
      },
    );
    await check(
      "Native HTTP shares the same snapshot and rejects mixed headers and revoked devices",
      async () => {
        const u = user("native"),
          { code } = store.createMobileCode(u.id, u.sessionVersion),
          pair = store.exchangeMobileCode(code, "Synthetic sync device");
        session = null;
        const native = (method = "GET", body, headers = {}) =>
          new Request(origin + "/api/sync", {
            method,
            headers: {
              authorization: "Bearer " + pair.accessToken,
              "x-lumio-user": u.id,
              ...(body ? { "content-type": "application/json" } : {}),
              ...headers,
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
        const s = await (await route.GET(native())).json();
        const data = envelope();
        data.library.items = [item("native-file", "Native edit")];
        assert.equal(
          (
            await route.PUT(
              native("PUT", {
                epoch: s.epoch,
                expectedRevision: 0,
                requestId: crypto.randomUUID(),
                data,
              }),
            )
          ).status,
          200,
        );
        assert.equal((await read(u)).data.library.items[0].id, "native-file");
        session = null;
        await rejected(
          await route.GET(native("GET", undefined, { cookie: "browser=1" })),
          403,
          "INVALID_ORIGIN",
        );
        const device = store.listMobileSessions(u.id, u.sessionVersion)[0];
        store.revokeMobileSession(u.id, u.sessionVersion, device.id);
        await rejected(await route.GET(native()), 401, "SESSION_REVOKED");
      },
    );
    console.log(
      `Sync HTTP: ${passed} checks passed with actual route/auth/store/CAS/retention and isolated SQLite. No provider or private DB calls.`,
    );
  } finally {
    db.close();
    store.close();
    for (const [k, v] of Object.entries(saved))
      v === undefined ? delete process.env[k] : (process.env[k] = v);
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
