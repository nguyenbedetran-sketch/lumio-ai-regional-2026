const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { DatabaseSync } = require("node:sqlite");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const cache = new Map();
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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-admin-test-"));
const filename = path.join(dir, "isolated.sqlite");
const { createStore } = load("lib/server/store.ts");
const policy = load("lib/server/policy.ts");
const access = load("lib/server/access.ts");
let time = Date.UTC(2026, 8, 20, 8);
let store = createStore(filename, {
  adminEmails: ["owner@example.test"],
  now: () => time,
});
let passed = 0;
async function test(name, fn) {
  await fn();
  console.log("PASS " + name);
  passed++;
}
const identity = (id, overrides = {}) => ({
  provider: "google",
  providerAccountId: id,
  email: `${id}@example.test`,
  name: `Test ${id}`,
  emailVerified: true,
  ...overrides,
});
const actor = (user) => ({ user, memberships: [] });
const denied = (code) => (error) => error.code === code;
async function main() {
  let learner, owner, unverified;
  await test("First account and unverified allowlisted email never bootstrap admin", () => {
    learner = store.ensureIdentity(identity("learner"));
    unverified = store.ensureIdentity(
      identity("unverified", {
        email: "owner@example.test",
        emailVerified: false,
      }),
    );
    const facebook = store.ensureIdentity(
      identity("fbadmin", {
        provider: "facebook",
        email: "owner@example.test",
      }),
    );
    assert.equal(learner.role, "USER");
    assert.equal(unverified.role, "USER");
    assert.equal(facebook.role, "USER");
  });
  await test("Only fresh verified Google with exact allowlisted email bootstraps admin", () => {
    owner = store.ensureIdentity(
      identity("owner", { email: "owner@example.test" }),
    );
    assert.equal(owner.role, "SUPER_ADMIN");
    assert.equal(
      store.ensureIdentity(identity("near", { email: "notowner@example.test" }))
        .role,
      "USER",
    );
    assert.equal(
      store.ensureIdentity(
        identity("google-lookalike", { email: "owner@example.test.evil" }),
      ).role,
      "USER",
    );
  });
  await test("Provider identity remains stable; matching emails do not merge users", () => {
    assert.equal(store.ensureIdentity(identity("learner")).id, learner.id);
    assert.equal(store.getUserByStorageKey("google:learner").id, learner.id);
    assert.notEqual(
      store.ensureIdentity(
        identity("learner-fb", { provider: "facebook", email: learner.email }),
      ).id,
      learner.id,
    );
  });
  await test("Scoped permissions deny cross-user, cross-organization, role bypass", () => {
    assert.equal(
      policy.can(actor(learner), "admin.read", { scope: "SYSTEM" }),
      false,
    );
    assert.equal(
      policy.can(actor(owner), "learning.read", {
        scope: "SELF",
        ownerId: learner.id,
      }),
      false,
    );
    assert.equal(
      policy.can(actor(learner), "learning.read", {
        scope: "SELF",
        ownerId: learner.id,
      }),
      true,
    );
    assert.equal(
      policy.can(actor(learner), "learning.read", {
        scope: "SELF",
        ownerId: owner.id,
      }),
      false,
    );
    const member = {
      user: learner,
      memberships: [{ organizationId: "school-a", role: "OWNER" }],
    };
    assert.equal(
      policy.can(member, "members.read", {
        scope: "ORGANIZATION",
        organizationId: "school-a",
      }),
      true,
    );
    assert.equal(
      policy.can(member, "members.read", {
        scope: "ORGANIZATION",
        organizationId: "school-b",
      }),
      false,
    );
    assert.equal(
      policy.can(member, "learning.read", {
        scope: "ORGANIZATION",
        organizationId: "school-a",
      }),
      false,
    );
  });
  await test("Link intent is bound to actor and provider; token is single-use", () => {
    const intent = store.createLinkIntent(learner.id, "facebook");
    assert.throws(
      () =>
        store.claimIdentity({
          userId: owner.id,
          token: intent.token,
          identity: identity("fbnew", { provider: "facebook" }),
        }),
      denied("INVALID_LINK_INTENT"),
    );
    assert.throws(
      () =>
        store.claimIdentity({
          userId: learner.id,
          token: intent.token,
          identity: identity("different"),
        }),
      denied("INVALID_LINK_INTENT"),
    );
    const linked = store.claimIdentity({
      userId: learner.id,
      token: intent.token,
      identity: identity("fbnew", {
        provider: "facebook",
        emailVerified: false,
      }),
    });
    assert.equal(linked.id, learner.id);
    assert.equal(linked.storageKey, "google:learner");
    assert.equal(store.findIdentity("facebook", "fbnew").id, learner.id);
    assert.equal(store.listIdentities(learner.id).length, 2);
    assert.throws(
      () =>
        store.claimIdentity({
          userId: learner.id,
          token: intent.token,
          identity: identity("fbnew", { provider: "facebook" }),
        }),
      denied("INVALID_LINK_INTENT"),
    );
  });
  await test("Link rejects preexisting ownership and expired intents atomically", () => {
    const intent = store.createLinkIntent(owner.id, "facebook");
    assert.throws(
      () =>
        store.claimIdentity({
          userId: owner.id,
          token: intent.token,
          identity: identity("fbnew", { provider: "facebook" }),
        }),
      denied("IDENTITY_BELONGS_TO_ANOTHER_ACCOUNT"),
    );
    assert.equal(store.listIdentities(owner.id).length, 1);
    time += 11 * 60000;
    assert.throws(
      () =>
        store.claimIdentity({
          userId: owner.id,
          token: intent.token,
          identity: identity("expired", { provider: "facebook" }),
        }),
      denied("INVALID_LINK_INTENT"),
    );
    assert.equal(store.findIdentity("facebook", "expired"), null);
  });
  await test("Unprivileged users cannot suspend users or mutate feature flags", () => {
    assert.throws(
      () =>
        store.updateUserAccess(
          learner.id,
          owner.id,
          "disable",
          "Unauthorized action",
        ),
      denied("FORBIDDEN"),
    );
    assert.throws(
      () => store.updateFlag(learner.id, "ai.enabled", false),
      denied("FORBIDDEN"),
    );
    assert.equal(store.isFeatureEnabled("ai.enabled"), true);
  });
  await test("Suspension revokes sessions, denies login, and blocks linked identity", () => {
    const session = {
      userId: learner.id,
      sessionVersion: learner.sessionVersion,
    };
    assert.equal(access.actorFromSession(session, store).user.id, learner.id);
    const updated = store.updateUserAccess(
      owner.id,
      learner.id,
      "disable",
      "Test suspension safeguards",
    );
    assert.equal(updated.disabled, true);
    assert.equal(updated.sessionVersion, learner.sessionVersion + 1);
    assert.throws(
      () => access.actorFromSession(session, store),
      denied("SESSION_REVOKED"),
    );
    assert.throws(
      () => store.ensureIdentity(identity("fbnew", { provider: "facebook" })),
      denied("ACCOUNT_DISABLED"),
    );
    assert.throws(
      () => store.createLinkIntent(learner.id, "google"),
      denied("FORBIDDEN"),
    );
    const enabled = store.updateUserAccess(
      owner.id,
      learner.id,
      "enable",
      "Test restore access",
    );
    assert.equal(enabled.disabled, false);
    assert.throws(
      () => access.actorFromSession(session, store),
      denied("SESSION_REVOKED"),
    );
  });
  await test("Own admin access is protected; explicit session revocation works", () => {
    assert.throws(
      () =>
        store.updateUserAccess(
          owner.id,
          owner.id,
          "disable",
          "Should be blocked",
        ),
      denied("CANNOT_CHANGE_OWN_ACCESS"),
    );
    const previous = store.getUser(learner.id);
    store.updateUserAccess(
      owner.id,
      learner.id,
      "revoke",
      "Revoke test sessions",
    );
    assert.equal(
      store.getUser(learner.id).sessionVersion,
      previous.sessionVersion + 1,
    );
    assert.throws(
      () =>
        access.actorFromSession(
          { userId: learner.id, sessionVersion: previous.sessionVersion },
          store,
        ),
      denied("SESSION_REVOKED"),
    );
  });
  await test("Feature flags persist changes and block new account linking", () => {
    store.updateFlag(owner.id, "accounts.linking", false);
    assert.equal(store.isFeatureEnabled("accounts.linking"), false);
    assert.throws(
      () => store.createLinkIntent(owner.id, "facebook"),
      denied("LINKING_DISABLED"),
    );
    assert.equal(store.isFeatureEnabled("unknown.feature"), false);
    assert.throws(
      () => store.updateFlag(owner.id, "unknown.feature", true),
      denied("FLAG_NOT_FOUND"),
    );
    store.updateFlag(owner.id, "accounts.linking", true);
  });
  await test("Usage is idempotent; absent token/cost metadata stays unknown", () => {
    store.recordAIUsage({
      requestId: "req-1",
      userId: learner.id,
      task: "chat",
      status: "success",
      latencyMs: 432,
    });
    store.recordAIUsage({
      requestId: "req-1",
      userId: learner.id,
      task: "chat",
      status: "success",
      latencyMs: 432,
    });
    const first = store.getDashboard();
    assert.equal(first.usage.requests, 1);
    assert.equal(first.usage.inputTokens, null);
    assert.equal(first.usage.costUsd, null);
    store.recordAIUsage({
      requestId: "req-2",
      userId: learner.id,
      task: "quiz",
      status: "success",
      latencyMs: 678,
      inputTokens: 120,
      outputTokens: 240,
      estimatedCostUsd: 0.004,
    });
    store.recordAIUsage({
      requestId: "req-3",
      userId: learner.id,
      task: "chat",
      status: "error",
      latencyMs: 90,
      errorCode: "PROVIDER_TIMEOUT",
    });
    const stats = store.getDashboard();
    assert.equal(stats.usage.requests, 3);
    assert.equal(stats.usage.errors, 1);
    assert.equal(stats.usage.inputTokens, 120);
    assert.equal(stats.usage.costRecords, 1);
    assert.equal(
      stats.days.reduce((n, day) => n + day.requests, 0),
      3,
    );
  });
  await test("Audit logs exclude sensitive fields and deny SQL update/delete", () => {
    store.recordAudit({
      actorId: owner.id,
      action: "TEST_SECURITY",
      after: {
        enabled: true,
        apiKey: "must-not-persist",
        prompt: "private text",
        secret: "must-not-persist",
      },
    });
    const event = store
      .listAudit(100)
      .find((e) => e.action === "TEST_SECURITY");
    assert.deepEqual(event.after, { enabled: true });
    const db = new DatabaseSync(filename);
    assert.throws(
      () => db.prepare("DELETE FROM audit_events WHERE id=?").run(event.id),
      /AUDIT_APPEND_ONLY/,
    );
    assert.throws(
      () =>
        db
          .prepare("UPDATE audit_events SET action='ALTERED' WHERE id=?")
          .run(event.id),
      /AUDIT_APPEND_ONLY/,
    );
    db.close();
  });
  await test("Search treats SQL metacharacters as literal text and pagination is bounded", () => {
    assert.equal(store.listUsers({ query: "' OR 1=1 --" }).total, 0);
    assert.equal(store.listUsers({ query: "%" }).total, 0);
    assert.equal(
      store.listUsers({ query: "owner@example.test", limit: 9000 }).limit,
      100,
    );
  });
  await test("Admin session expires after 1h and mutation origin must match exactly", () => {
    access.requireRecentAdminSession({ authenticatedAt: time - 1000 }, time);
    assert.throws(
      () =>
        access.requireRecentAdminSession(
          { authenticatedAt: time - 3600001 },
          time,
        ),
      denied("ADMIN_REAUTH_REQUIRED"),
    );
    assert.throws(
      () =>
        access.requireRecentAdminSession(
          { authenticatedAt: time + 60000 },
          time,
        ),
      denied("ADMIN_REAUTH_REQUIRED"),
    );
    assert.throws(
      () => access.requireRecentAdminSession({}, time),
      denied("ADMIN_REAUTH_REQUIRED"),
    );
    process.env.NEXTAUTH_URL = "http://127.0.0.1:3000";
    access.assertSameOrigin(
      new Request("http://127.0.0.1:3000/api/admin", {
        headers: {
          origin: "http://127.0.0.1:3000",
          "sec-fetch-site": "same-origin",
        },
      }),
    );
    assert.throws(
      () =>
        access.assertSameOrigin(
          new Request("http://127.0.0.1:3000/api/admin", {
            headers: { origin: "https://evil.example" },
          }),
        ),
      denied("INVALID_ORIGIN"),
    );
    assert.throws(
      () =>
        access.assertSameOrigin(new Request("http://127.0.0.1:3000/api/admin")),
      denied("INVALID_ORIGIN"),
    );
  });
  await test("JSON mutation bodies are bounded and validated before writes", async () => {
    await assert.rejects(
      () =>
        access.readJSON(
          new Request("http://local", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "x".repeat(5000),
          }),
        ),
      denied("PAYLOAD_TOO_LARGE"),
    );
    await assert.rejects(
      () =>
        access.readJSON(
          new Request("http://local", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "[]",
          }),
        ),
      denied("INVALID_JSON"),
    );
    await assert.rejects(
      () =>
        access.readJSON(
          new Request("http://local", { method: "POST", body: "{}" }),
        ),
      denied("INVALID_CONTENT_TYPE"),
    );
  });
  await test("Reopening database preserves identities, audit and usage with migrations once", () => {
    const oldCount = store.getDashboard().auditCount;
    store.close();
    store = createStore(filename, {
      adminEmails: ["owner@example.test"],
      now: () => time,
    });
    assert.equal(store.findIdentity("facebook", "fbnew").id, learner.id);
    assert.equal(store.getDashboard().auditCount, oldCount);
    assert.equal(store.getDashboard().usage.requests, 3);
    assert.equal(store.listFlags().length, 3);
  });
  await test("Telemetry storage failure never throws or reveals underlying exception", () => {
    const telemetry = load("lib/ai/telemetry.ts"),
      warnings = [];
    const previousWarn = console.warn;
    console.warn = (value) => warnings.push(value);
    try {
      const event = {
        requestId: "test-event",
        task: "chat",
        status: "success",
        latencyMs: 1,
      };
      assert.equal(
        telemetry.recordAIUsageSafe(event, () => {
          throw new Error("private database path or credential");
        }),
        false,
      );
      assert.deepEqual(warnings, ["[lumio] AI_USAGE_NOT_RECORDED"]);
      assert.equal(
        telemetry.recordAIUsageSafe(event, () => {}),
        true,
      );
    } finally {
      console.warn = previousWarn;
    }
  });
  await test("Dual localhost origins are dev-only; production cannot trust Host", () => {
    const { requestOrigin } = load("lib/server/origin.ts");
    const previous = {
      node: process.env.NODE_ENV,
      trust: process.env.AUTH_TRUST_HOST,
      url: process.env.NEXTAUTH_URL,
    };
    const request = (host, extra = {}) =>
      new Request(`http://${host}/api/test`, { headers: { host, ...extra } });
    try {
      process.env.NODE_ENV = "development";
      process.env.AUTH_TRUST_HOST = "true";
      process.env.NEXTAUTH_URL = "http://127.0.0.1:3000";
      assert.equal(
        requestOrigin(request("localhost:3000")),
        "http://localhost:3000",
      );
      assert.equal(
        requestOrigin(request("127.0.0.1:3000")),
        "http://127.0.0.1:3000",
      );
      assert.throws(
        () => requestOrigin(request("localhost:3001")),
        denied("INVALID_ORIGIN"),
      );
      assert.throws(
        () => requestOrigin(request("localhost.evil.example:3000")),
        denied("INVALID_ORIGIN"),
      );
      assert.equal(
        requestOrigin(
          request("localhost:3000", { "x-forwarded-host": "evil.example" }),
        ),
        "http://localhost:3000",
      );
      access.assertSameOrigin(
        request("localhost:3000", { origin: "http://localhost:3000" }),
      );
      assert.throws(
        () =>
          access.assertSameOrigin(
            request("localhost:3000", { origin: "http://127.0.0.1:3000" }),
          ),
        denied("INVALID_ORIGIN"),
      );
      process.env.NODE_ENV = "production";
      process.env.NEXTAUTH_URL = "https://lumio.example";
      assert.equal(
        requestOrigin(request("localhost:3000")),
        "https://lumio.example",
      );
      assert.throws(
        () =>
          access.assertSameOrigin(
            request("localhost:3000", { origin: "http://localhost:3000" }),
          ),
        denied("INVALID_ORIGIN"),
      );
    } finally {
      for (const [key, value] of [
        ["NODE_ENV", previous.node],
        ["AUTH_TRUST_HOST", previous.trust],
        ["NEXTAUTH_URL", previous.url],
      ]) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
  console.log(
    `\n${passed} admin/platform checks passed (isolated temporary database).`,
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    store.close();
    // This directory was created by mkdtemp above and cannot reference user data.
    for (const entry of fs.readdirSync(dir))
      fs.unlinkSync(path.join(dir, entry));
    fs.rmdirSync(dir);
  });
