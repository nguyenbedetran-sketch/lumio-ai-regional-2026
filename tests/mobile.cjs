const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
let browserSession = null;
function load(relative) {
  const filename = path.resolve(root, relative);
  if (filename === path.resolve(root, "lib/lumio/auth.ts"))
    return {
      authOptions: () => ({}),
      providerStatus: () => ({ google: true }),
    };
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", js)(
    (name) =>
      name === "next-auth"
        ? { getServerSession: async () => browserSession }
        : name.startsWith(".")
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
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-mobile-"));
let time = Date.UTC(2026, 8, 27, 12);
const filename = path.join(folder, "test.sqlite"),
  { createStore } = load("lib/server/store.ts");
const options = { now: () => time, adminEmails: ["owner@example.test"] };
const store = createStore(filename, options),
  second = createStore(filename, options);
global.__lumioPlatformStore = store;
const identity = (id) => ({
  provider: "google",
  providerAccountId: id,
  email: id + "@example.test",
  emailVerified: true,
  name: id,
});
const owner = store.ensureIdentity(identity("owner")),
  user = store.ensureIdentity(identity("learner")),
  other = store.ensureIdentity(identity("other"));
const code = () =>
  store.createMobileCode(user.id, store.getUser(user.id).sessionVersion);
const deny = (fn, code) => assert.throws(fn, (e) => e.code === code);
let passed = 0;
async function test(name, fn) {
  await fn();
  console.log("PASS " + name);
  passed++;
}
const oldEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  LUMIO_AI_ENABLED: process.env.LUMIO_AI_ENABLED,
  LUMIO_PUBLIC_DEMO: process.env.LUMIO_PUBLIC_DEMO,
};
Object.assign(process.env, {
  NODE_ENV: "development",
  NEXTAUTH_URL: "http://localhost:3000",
  LUMIO_AI_ENABLED: "true",
  LUMIO_PUBLIC_DEMO: "false",
});
const boundUser = (token) => {
  try {
    return store.mobileIdentity(token).user.id;
  } catch {
    return "";
  }
};
const req = (url, token, extra = {}) =>
  new Request("http://localhost:3000" + url, {
    headers: {
      ...(token
        ? { "x-lumio-user": boundUser(token) }
        : {
            "x-lumio-account": browserSession
              ? store.getUser(browserSession.userId)?.storageKey || ""
              : "",
          }),
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...extra,
    },
  });
(async () => {
  try {
    await test("Pair code exchanges once even across independent database connections", () => {
      const grant = code();
      const paired = second.exchangeMobileCode(grant.code, "My Android");
      assert.equal(paired.accessToken.length, 43);
      assert.equal(paired.user.id, user.id);
      assert.equal(store.mobileIdentity(paired.accessToken).user.id, user.id);
      deny(
        () => store.exchangeMobileCode(grant.code, "Another device"),
        "PAIR_CODE_INVALID",
      );
      const { DatabaseSync } = require("node:sqlite");
      const db = new DatabaseSync(filename);
      assert.notEqual(
        db.prepare("SELECT token_hash FROM mobile_sessions").get().token_hash,
        paired.accessToken,
      );
      assert.equal(
        db.prepare("SELECT count(*) n FROM mobile_pair_codes").get().n,
        0,
      );
      db.close();
    });
    await test("New pairing code invalidates old code and expires after five minutes", () => {
      const old = code(),
        fresh = code();
      deny(
        () => store.exchangeMobileCode(old.code, "Android"),
        "PAIR_CODE_INVALID",
      );
      time = fresh.expiresAt;
      deny(
        () => store.exchangeMobileCode(fresh.code, "Android"),
        "PAIR_CODE_INVALID",
      );
    });
    await test("Bad secrets and invalid device names cannot create sessions", () => {
      deny(
        () => store.exchangeMobileCode("123456", "Phone"),
        "PAIR_CODE_INVALID",
      );
      const grant = code();
      deny(
        () => store.exchangeMobileCode(grant.code, "\n"),
        "INVALID_DEVICE_NAME",
      );
      deny(() => store.mobileIdentity("bad"), "SIGN_IN_REQUIRED");
    });
    await test("Another account cannot revoke a device; the owner can", () => {
      const pair = store.exchangeMobileCode(code().code, "Personal");
      const device = store.mobileIdentity(pair.accessToken).deviceId;
      store.revokeMobileSession(other.id, other.sessionVersion, device);
      assert.equal(store.mobileIdentity(pair.accessToken).user.id, user.id);
      store.revokeMobileSession(user.id, user.sessionVersion, device);
      deny(() => store.mobileIdentity(pair.accessToken), "SESSION_REVOKED");
    });
    await test("Device session expires exactly after seven days", () => {
      const pair = store.exchangeMobileCode(code().code, "Seven days");
      time = pair.expiresAt;
      deny(() => store.mobileIdentity(pair.accessToken), "SESSION_REVOKED");
    });
    await test("Administrative revoke invalidates both pending codes and paired devices", () => {
      const pair = store.exchangeMobileCode(code().code, "Before revoke"),
        pending = code();
      store.updateUserAccess(owner.id, user.id, "revoke", "Mobile regression");
      deny(() => store.mobileIdentity(pair.accessToken), "SESSION_REVOKED");
      deny(
        () => store.exchangeMobileCode(pending.code, "After revoke"),
        "SESSION_REVOKED",
      );
    });
    await test("Five-device limit leaves the code usable after a device is removed", () => {
      for (let i = 0; i < 5; i++)
        store.exchangeMobileCode(code().code, "Device " + i);
      const grant = code();
      deny(() => store.exchangeMobileCode(grant.code, "Sixth"), "DEVICE_LIMIT");
      const version = store.getUser(user.id).sessionVersion,
        devices = store.listMobileSessions(user.id, version);
      assert.equal(devices.length, 5);
      store.revokeMobileSession(user.id, version, devices[0].id);
      assert.ok(
        store.exchangeMobileCode(grant.code, "Replacement").accessToken,
      );
    });
    const otherPair = store.exchangeMobileCode(
      store.createMobileCode(other.id, other.sessionVersion).code,
      "Route checks",
    );
    const { requireMobile } = load("lib/server/mobile-access.ts");
    await test("Native bearer rejects browser Origin, Cookie and fetch-site headers", () => {
      for (const header of [
        { Origin: "https://evil.test" },
        { Cookie: "session=x" },
        { "sec-fetch-site": "same-origin" },
      ])
        deny(
          () =>
            requireMobile(
              req("/api/mobile/account", otherPair.accessToken, header),
            ),
          "INVALID_ORIGIN",
        );
    });
    await test("Production native authentication requires a canonical HTTPS backend", () => {
      process.env.NODE_ENV = "production";
      deny(
        () => requireMobile(req("/api/mobile/account", otherPair.accessToken)),
        "HTTPS_REQUIRED",
      );
      process.env.NODE_ENV = "development";
    });
    const mobile = load("app/api/mobile/account/route.ts"),
      exchange = load("app/api/mobile/pair/exchange/route.ts");
    await test("Exchange route validates content type and never accepts cookie authorization", async () => {
      let r = await exchange.POST(
        new Request("http://localhost:3000/api/mobile/pair/exchange", {
          method: "POST",
          body: "bad",
        }),
      );
      assert.equal(r.status, 415);
      r = await exchange.POST(
        new Request("http://localhost:3000/api/mobile/pair/exchange", {
          method: "POST",
          headers: { Cookie: "session=x", "Content-Type": "application/json" },
          body: "{}",
        }),
      );
      assert.equal(r.status, 403);
    });
    await test("Native profile returns account and capabilities without secrets or role escalation", async () => {
      const r = await mobile.GET(
        req("/api/mobile/account", otherPair.accessToken),
      );
      assert.equal(r.status, 200);
      assert.match(r.headers.get("cache-control"), /no-store/);
      const body = await r.json();
      assert.equal(body.user.id, other.id);
      assert.equal(body.user.role, undefined);
      assert.equal(body.accessToken, undefined);
    });
    await test("Bearer AI and browser AI share the same concurrent-use guard", async () => {
      const { authorizeAI } = load("lib/ai/guard.ts");
      const lease = await authorizeAI(req("/api/ai", otherPair.accessToken));
      assert.equal(lease.userId, other.id);
      browserSession = {
        userId: other.id,
        sessionVersion: other.sessionVersion,
      };
      await assert.rejects(
        authorizeAI(req("/api/ai", null, { Origin: "http://localhost:3000" })),
        (e) => e.code === "LOCAL_RATE_LIMIT",
      );
      lease();
      const secondLease = await authorizeAI(
        req("/api/ai", otherPair.accessToken),
        true,
      );
      secondLease();
    });
    await test("Mobile logout revokes the current credential immediately", async () => {
      assert.equal(
        (await mobile.DELETE(req("/api/mobile/account", otherPair.accessToken)))
          .status,
        200,
      );
      assert.equal(
        (await mobile.GET(req("/api/mobile/account", otherPair.accessToken)))
          .status,
        401,
      );
    });
    const deviceRoute = load("app/api/mobile/devices/route.ts");
    const browserPost = (origin) =>
      new Request("http://localhost:3000/api/mobile/devices", {
        method: "POST",
        headers: origin ? { Origin: origin } : {},
      });
    await test("Browser code issuer rejects missing and hostile origins before authentication", async () => {
      for (const origin of [null, "https://evil.test"])
        assert.equal((await deviceRoute.POST(browserPost(origin))).status, 403);
    });
    await test("Browser code issuer requires a recent valid OAuth session", async () => {
      browserSession = null;
      assert.equal(
        (await deviceRoute.POST(browserPost("http://localhost:3000"))).status,
        401,
      );
      browserSession = {
        userId: other.id,
        sessionVersion: other.sessionVersion,
        authenticatedAt: Date.now() - 3600001,
      };
      assert.equal(
        (
          await (
            await deviceRoute.POST(browserPost("http://localhost:3000"))
          ).json()
        ).error,
        "REAUTH_REQUIRED",
      );
    });
    await test("Ordinary recently signed-in learner can pair without obtaining admin access", async () => {
      browserSession = {
        userId: other.id,
        sessionVersion: other.sessionVersion,
        authenticatedAt: Date.now(),
      };
      const issued = await deviceRoute.POST(
        browserPost("http://localhost:3000"),
      );
      assert.equal(issued.status, 200);
      const grant = await issued.json(),
        paired = store.exchangeMobileCode(grant.code, "Fresh browser");
      assert.equal(store.mobileIdentity(paired.accessToken).user.role, "USER");
      const listed = await deviceRoute.GET();
      const devices = (await listed.json()).devices;
      assert.equal(devices.length, 1);
      assert.equal(devices[0].name, "Fresh browser");
    });
    await test("Public demo cannot reach mobile database even with a valid-shaped credential", async () => {
      process.env.LUMIO_PUBLIC_DEMO = "true";
      assert.equal(
        (await mobile.GET(req("/api/mobile/account", "a".repeat(43)))).status,
        403,
      );
      process.env.LUMIO_PUBLIC_DEMO = "false";
    });
    console.log(`${passed}/${passed} mobile security checks passed`);
  } finally {
    store.close();
    second.close();
    delete global.__lumioPlatformStore;
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
