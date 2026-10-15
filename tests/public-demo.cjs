const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
const keys = {
  LUMIO_PUBLIC_DEMO: "true",
  LUMIO_AI_ENABLED: "true",
  NEXTAUTH_SECRET: "fake-test-only",
  NEXTAUTH_URL: "https://demo.example.test",
  GOOGLE_CLIENT_ID: "fake",
  GOOGLE_CLIENT_SECRET: "fake",
  FACEBOOK_CLIENT_ID: "fake",
  FACEBOOK_CLIENT_SECRET: "fake",
  OPENAI_API_KEY: "fake",
  GEMINI_API_KEY: "fake",
  XAI_API_KEY: "fake",
};
const old = Object.fromEntries(
  Object.keys(keys).map((key) => [key, process.env[key]]),
);
Object.assign(process.env, keys);
let passed = 0,
  fetches = 0;
const originalFetch = global.fetch;
global.fetch = async () => {
  fetches++;
  throw new Error("No network allowed in public demo tests");
};
async function test(name, fn) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
async function main() {
  const demo = load("lib/server/public-demo.ts");
  await test("Demo configuration disables all provider access even if credentials are present", async () => {
    const config = await load("app/api/config/route.ts").GET().json();
    assert.equal(config.publicDemo, true);
    assert.equal(config.storage, "browser");
    for (const key of ["google", "facebook", "ai"])
      assert.equal(config[key], false);
    assert.ok(
      Object.values(config.capabilities).every((value) => value === false),
    );
    assert.deepEqual(load("lib/lumio/auth.ts").providerStatus(), {
      google: false,
      facebook: false,
      ai: false,
    });
  });
  await test("Demo cannot open a database or obtain an already-cached private store", () => {
    const previous = global.__lumioPlatformStore;
    global.__lumioPlatformStore = { private: true };
    try {
      assert.throws(
        () => load("lib/server/store.ts").getStore(),
        (error) => error.code === "PUBLIC_DEMO_ONLY" && error.status === 403,
      );
    } finally {
      if (previous === undefined) delete global.__lumioPlatformStore;
      else global.__lumioPlatformStore = previous;
    }
  });
  await test("Public catalog is static and advertises no purchasable plans or actual wallet", async () => {
    const response = await load("app/api/billing/catalog/route.ts").GET(),
      catalog = await response.json();
    assert.equal(response.status, 200);
    assert.equal(catalog.publicDemo, true);
    assert.equal(catalog.account, undefined);
    assert.ok(catalog.plans.every((plan) => plan.checkoutAvailable === false));
    assert.ok(
      catalog.plans
        .filter((plan) => plan.id !== "free")
        .every((plan) => plan.monthlyPriceMinor === null),
    );
  });
  await test("Only explicit read-only demo API paths are allowed; every mutation is denied", async () => {
    for (const pathname of [
      "/api/ai",
      "/api/voice",
      "/api/ingest",
      "/api/account",
      "/api/admin",
      "/api/billing",
      "/api/billing/admin",
      "/api/billing/checkout",
      "/api/config",
    ]) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const response = demo.demoAPIResponse(pathname, method);
        assert.equal(response.status, 403);
        assert.equal((await response.json()).error, "PUBLIC_DEMO_ONLY");
      }
      if (pathname !== "/api/config")
        assert.equal(demo.demoAPIResponse(pathname, "GET").status, 403);
    }
  });
  await test("Native auth routes ignore old cookies and never start OAuth in public demo", async () => {
    const auth = load("app/api/auth/[...nextauth]/route.ts");
    for (const action of ["session", "providers"]) {
      const response = await auth.GET(
        {
          method: "GET",
          cookies: {
            get() {
              throw new Error("Private cookies must not be read");
            },
          },
        },
        { params: Promise.resolve({ nextauth: [action] }) },
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {});
    }
    const blocked = await auth.POST(
      { method: "POST" },
      { params: Promise.resolve({ nextauth: ["signin", "google"] }) },
    );
    assert.equal(blocked.status, 403);
  });
  await test("Native AI and voice handlers cannot bypass the demo database/provider gate", async () => {
    for (const endpoint of ["ai", "voice"]) {
      const route = load(`app/api/${endpoint}/route.ts`);
      const response = await route.POST(
        new Request(`https://demo.example.test/api/${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://demo.example.test",
          },
          body: "{}",
        }),
      );
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error, "PUBLIC_DEMO_ONLY");
    }
    assert.equal(fetches, 0);
  });
  await test("Demo switch leaves normal routing untouched when explicitly disabled", () => {
    process.env.LUMIO_PUBLIC_DEMO = "false";
    try {
      assert.equal(demo.demoAPIResponse("/api/ai", "POST"), null);
    } finally {
      process.env.LUMIO_PUBLIC_DEMO = "true";
    }
  });
  console.log(
    `\n${passed} public-demo checks passed; no database, account or network created.`,
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
