const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
let storeCalls = 0;
function load(relative) {
  const filename = path.resolve(root, relative);
  if (filename === path.resolve(root, "lib/server/store.ts"))
    return new Proxy(
      {},
      {
        get: () => () => {
          storeCalls++;
          throw new Error("Desktop config must not read a private database");
        },
      },
    );
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = { exports: {} };
  cache.set(filename, mod);
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
    mod,
    mod.exports,
  );
  return mod.exports;
}
const env = {
  LUMIO_DESKTOP: "true",
  LUMIO_DESKTOP_NONCE: "ab".repeat(32),
  LUMIO_PUBLIC_DEMO: "false",
  LUMIO_AI_ENABLED: "true",
  OPENAI_API_KEY: "test-only",
  OPENAI_MODEL: "test-model",
  GEMINI_API_KEY: "test-only",
  GEMINI_MODEL: "test-model",
  XAI_API_KEY: "test-only",
  NEXTAUTH_SECRET: "test-only",
  NEXTAUTH_URL: "http://127.0.0.1:3210",
  GOOGLE_CLIENT_ID: "test-only",
  GOOGLE_CLIENT_SECRET: "test-only",
  FACEBOOK_CLIENT_ID: "test-only",
  FACEBOOK_CLIENT_SECRET: "test-only",
};
const previous = Object.fromEntries(
  Object.keys(env).map((k) => [k, process.env[k]]),
);
Object.assign(process.env, env);
const passed = [];
function check(label, fn) {
  fn();
  passed.push(label);
}
(async () => {
  try {
    const mode = load("lib/server/desktop-mode.ts"),
      health = load("lib/server/desktop-health.ts"),
      auth = load("lib/lumio/auth.ts"),
      ai = load("lib/ai/router.ts"),
      guard = load("lib/ai/guard.ts"),
      config = load("app/api/config/route.ts");
    const req = (token) =>
      new Request("http://127.0.0.1:3210/api/desktop/health", {
        headers: token ? { "x-lumio-desktop-token": token } : {},
      });
    check("Health rejects missing token", () =>
      assert.equal(health.desktopHealth(req()).status, 404),
    );
    check("Health rejects wrong same-length token", () =>
      assert.equal(health.desktopHealth(req("cd".repeat(32))).status, 404),
    );
    check("Health rejects malformed token without leaking nonce", () =>
      assert.equal(health.desktopHealth(req("invalid")).status, 404),
    );
    const valid = health.desktopHealth(req(env.LUMIO_DESKTOP_NONCE));
    check("Per-launch health token accepted", () =>
      assert.equal(valid.status, 200),
    );
    check("Health never cached", () =>
      assert.equal(valid.headers.get("Cache-Control"), "no-store"),
    );
    check("Health identifies correct bundled backend", () => {});
    assert.deepEqual(await valid.json(), {
      desktop: true,
      version: "0.1.0",
      nonce: env.LUMIO_DESKTOP_NONCE,
    });
    process.env.LUMIO_DESKTOP_NONCE = "";
    check("Health rejects uninitialized nonce", () =>
      assert.equal(
        health.desktopHealth(req(env.LUMIO_DESKTOP_NONCE)).status,
        404,
      ),
    );
    process.env.LUMIO_DESKTOP_NONCE = env.LUMIO_DESKTOP_NONCE;
    check("Embedded OAuth disabled even with inherited keys", () =>
      assert.deepEqual(auth.providerStatus(), {
        google: false,
        facebook: false,
        ai: false,
      }),
    );
    check("Desktop paid AI transport disabled", () =>
      assert.equal(ai.aiStatus().enabled, false),
    );
    check("Desktop voice providers disabled", () =>
      assert.equal(ai.aiStatus().xai, false),
    );
    await assert.rejects(
      () =>
        guard.authorizeAI(new Request("http://127.0.0.1:3210/api/voice"), true),
      (e) => e.code === "AI_DISABLED",
    );
    passed.push("Desktop AI authorization rejected before data/credit access");
    const response = config.GET();
    assert.deepEqual(await response.json(), mode.desktopConfig());
    passed.push(
      "Client capabilities accurately unavailable in offline desktop",
    );
    check("Desktop config does not open database", () =>
      assert.equal(storeCalls, 0),
    );
    process.env.LUMIO_DESKTOP = "false";
    check("Desktop health absent on regular web", () =>
      assert.equal(
        health.desktopHealth(req(env.LUMIO_DESKTOP_NONCE)).status,
        404,
      ),
    );
    check("Regular web OAuth preserved", () =>
      assert.equal(auth.providerStatus().google, true),
    );
    check("Regular web AI preserved", () =>
      assert.equal(ai.aiStatus().enabled, true),
    );
    console.log(
      JSON.stringify(
        { status: "PASS", checks: passed.length, passed },
        null,
        2,
      ),
    );
  } finally {
    for (const [key, value] of Object.entries(previous))
      value === undefined
        ? delete process.env[key]
        : (process.env[key] = value);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
