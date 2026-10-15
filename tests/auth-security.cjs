const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name.startsWith(".")
        ? load(
            path.relative(
              root,
              path.resolve(path.dirname(filename), name + ".ts"),
            ),
          )
        : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-auth-review-"));
const filename = path.join(dir, "isolated.sqlite"),
  { createStore } = load("lib/server/store.ts");
const options = { adminEmails: ["owner@example.test"] };
const store = createStore(filename, options),
  concurrent = createStore(filename, options);
const previousStore = global.__lumioPlatformStore;
global.__lumioPlatformStore = store;
const identity = (id, provider = "google") => ({
  provider,
  providerAccountId: id,
  email: `${id}@example.test`,
  name: `Test ${id}`,
  emailVerified: provider === "google",
});
const owner = store.ensureIdentity(identity("owner")),
  learner = store.ensureIdentity(identity("learner"));
const { authOptions } = load("lib/lumio/auth.ts"),
  { authFailureResponse } = load("lib/server/auth-errors.ts");
const denied = (code) => (error) => error.code === code;
let passed = 0;
async function test(name, fn) {
  await fn();
  console.log("PASS " + name);
  passed++;
}
(async () => {
  await test("Unconfigured preview returns empty JSON sessions without inventing a login", async () => {
    const oldSecret = process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    try {
      const { GET, POST } = load("app/api/auth/[...nextauth]/route.ts");
      const { NextRequest } = require("next/server");
      for (const action of ["session", "providers"]) {
        const response = await GET(
          new NextRequest(`http://localhost:3000/api/auth/${action}`),
          { params: Promise.resolve({ nextauth: [action] }) },
        );
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {});
        assert.equal(response.headers.get("Cache-Control"), "no-store");
      }
      const signIn = await POST(
        new NextRequest("http://localhost:3000/api/auth/signin/google", {
          method: "POST",
        }),
        { params: Promise.resolve({ nextauth: ["signin", "google"] }) },
      );
      assert.equal(signIn.status, 503);
      assert.equal((await signIn.json()).error, "AUTH_NOT_CONFIGURED");
    } finally {
      if (oldSecret === undefined) delete process.env.NEXTAUTH_SECRET;
      else process.env.NEXTAUTH_SECRET = oldSecret;
    }
  });
  await test("Untouched legacy sessions upgrade without granting admin", async () => {
    const upgraded = await authOptions().callbacks.jwt({
      token: { accountKey: learner.storageKey, email: learner.email },
    });
    assert.equal(upgraded.userId, learner.id);
    assert.equal(upgraded.sessionVersion, 1);
    assert.equal(upgraded.authenticatedAt, 0);
    assert.equal(store.getUser(learner.id).role, "USER");
  });
  await test("Legacy JWT cannot regain a session version after revocation", async () => {
    concurrent.updateUserAccess(
      owner.id,
      learner.id,
      "revoke",
      "Security regression test",
    );
    const replayed = await authOptions().callbacks.jwt({
      token: { accountKey: learner.storageKey, email: learner.email },
    });
    assert.equal(replayed.userId, undefined);
    assert.equal(replayed.sessionVersion, undefined);
    const oldCanonical = await authOptions().callbacks.jwt({
      token: {
        userId: learner.id,
        accountKey: learner.storageKey,
        sessionVersion: 1,
      },
    });
    assert.deepEqual(oldCanonical, {});
  });
  await test("Revocation after OAuth precheck invalidates the pending link transaction", () => {
    const before = store.getUser(learner.id);
    const intent = store.createLinkIntent(
      learner.id,
      "facebook",
      before.sessionVersion,
    );
    // Simulates a second worker revoking the session while the callback awaits OAuth.
    concurrent.updateUserAccess(
      owner.id,
      learner.id,
      "revoke",
      "Concurrent session revocation",
    );
    assert.throws(
      () =>
        store.claimIdentity({
          userId: learner.id,
          token: intent.token,
          identity: identity("fb-stale", "facebook"),
        }),
      denied("INVALID_LINK_INTENT"),
    );
    assert.equal(store.findIdentity("facebook", "fb-stale"), null);
    assert.throws(
      () =>
        store.createLinkIntent(learner.id, "facebook", before.sessionVersion),
      denied("SESSION_REVOKED"),
    );
  });
  await test("Restoring suspended user cannot revive an old OAuth link", () => {
    const current = store.getUser(learner.id),
      intent = store.createLinkIntent(
        learner.id,
        "facebook",
        current.sessionVersion,
      );
    concurrent.updateUserAccess(
      owner.id,
      learner.id,
      "disable",
      "Suspend during callback test",
    );
    concurrent.updateUserAccess(
      owner.id,
      learner.id,
      "enable",
      "Restore test account safely",
    );
    assert.throws(
      () =>
        store.claimIdentity({
          userId: learner.id,
          token: intent.token,
          identity: identity("fb-old", "facebook"),
        }),
      denied("INVALID_LINK_INTENT"),
    );
    assert.equal(store.findIdentity("facebook", "fb-old"), null);
  });
  await test("Fresh provider authentication can recover normally after revocation", async () => {
    const callbacks = authOptions().callbacks,
      google = identity("learner");
    const account = {
      provider: google.provider,
      providerAccountId: google.providerAccountId,
    };
    assert.equal(
      await callbacks.signIn({
        account,
        profile: { email_verified: true },
        user: { name: google.name, email: google.email },
      }),
      true,
    );
    const fresh = await callbacks.jwt({ token: {}, account });
    assert.equal(fresh.userId, learner.id);
    assert.equal(
      fresh.sessionVersion,
      store.getUser(learner.id).sessionVersion,
    );
    assert.ok(Date.now() - fresh.authenticatedAt < 3000);
    const intent = store.createLinkIntent(
      learner.id,
      "facebook",
      fresh.sessionVersion,
    );
    const linked = store.claimIdentity({
      userId: learner.id,
      token: intent.token,
      identity: identity("fb-fresh", "facebook"),
    });
    assert.equal(linked.id, learner.id);
    assert.equal(linked.storageKey, learner.storageKey);
  });
  await test("Exceptional NextAuth client POST responses remain parseable JSON", async () => {
    for (const action of ["signin", "signout"]) {
      const response = authFailureResponse(
        "POST",
        action,
        new Error("private credential details"),
      );
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("location"), null);
      const body = await response.json();
      assert.equal(body.url, "/?error=Configuration");
      assert.ok(!JSON.stringify(body).includes("private"));
    }
    const session = authFailureResponse(
      "GET",
      "session",
      new Error("private credential details"),
    );
    assert.equal(session.status, 503);
    assert.equal((await session.json()).error, "PLATFORM_UNAVAILABLE");
    const callback = authFailureResponse(
      "GET",
      "callback",
      new Error("private credential details"),
    );
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get("location"), "/?error=Configuration");
    assert.equal(await callback.text(), "");
  });
  await test("Admin mutations reject a session revoked after its HTTP authorization check", () => {
    const peer = store.ensureIdentity({
      ...identity("admin-peer"),
      email: "owner@example.test",
    });
    assert.equal(peer.role, "SUPER_ADMIN");
    const cachedVersion = peer.sessionVersion,
      beforeLearner = store.getUser(learner.id);
    concurrent.updateUserAccess(
      owner.id,
      peer.id,
      "revoke",
      "Revoke concurrent admin session",
    );
    assert.throws(
      () => store.updateFlag(peer.id, "ai.enabled", false, cachedVersion),
      denied("SESSION_REVOKED"),
    );
    assert.throws(
      () =>
        store.updateUserAccess(
          peer.id,
          learner.id,
          "disable",
          "Stale admin must not mutate",
          cachedVersion,
        ),
      denied("SESSION_REVOKED"),
    );
    assert.equal(store.isFeatureEnabled("ai.enabled"), true);
    assert.equal(
      store.getUser(learner.id).sessionVersion,
      beforeLearner.sessionVersion,
    );
    assert.equal(store.getUser(learner.id).disabled, false);
  });
  await test("Migration from schema1 invalidates only unbound intents and preserves accounts", () => {
    const { DatabaseSync } = require("node:sqlite"),
      { migrations } = load("lib/server/schema.ts");
    const previousFile = path.join(dir, "schema-one.sqlite"),
      db = new DatabaseSync(previousFile);
    db.exec(
      "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
    );
    db.exec(migrations.find((m) => m.version === 1).sql);
    db.prepare("INSERT INTO schema_migrations VALUES(1,?)").run(
      new Date().toISOString(),
    );
    db.prepare(
      "INSERT INTO users(id,storage_key,name,email,role,created_at,last_seen_at) VALUES(?,?,?,?,?,?,?)",
    ).run(
      "migrated-user",
      "google:migrated-user",
      "Migration test",
      "migration@example.test",
      "USER",
      new Date().toISOString(),
      new Date().toISOString(),
    );
    db.prepare(
      "INSERT INTO identity_link_intents(token_hash,user_id,provider,expires_at,created_at) VALUES(?,?,?,?,?)",
    ).run(
      "a".repeat(64),
      "migrated-user",
      "facebook",
      Date.now() + 600000,
      new Date().toISOString(),
    );
    db.close();
    const migrated = createStore(previousFile, options);
    try {
      assert.equal(
        migrated.getUser("migrated-user").storageKey,
        "google:migrated-user",
      );
      const verify = new DatabaseSync(previousFile);
      try {
        assert.equal(
          verify
            .prepare("SELECT count(*) count FROM identity_link_intents")
            .get().count,
          0,
        );
        assert.deepEqual(
          verify
            .prepare("SELECT version FROM schema_migrations ORDER BY version")
            .all()
            .map((r) => r.version),
          migrations.map((migration) => migration.version),
        );
      } finally {
        verify.close();
      }
    } finally {
      migrated.close();
    }
  });
  console.log(
    `\n${passed} auth regression checks passed; isolated DB, no provider network.`,
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    concurrent.close();
    store.close();
    if (previousStore) global.__lumioPlatformStore = previousStore;
    else delete global.__lumioPlatformStore;
    for (const file of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, file));
    fs.rmdirSync(dir);
  });
