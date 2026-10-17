// Actual handler + component logic, isolated in-memory store and hook/session/transport boundaries.
// No browser, OAuth endpoint, credential, live database or provider request is used.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  cp = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  baseline = process.argv.includes("--baseline"),
  checks = [];
function loader(mocks, bindings = {}) {
  const cache = new Map();
  return function load(relative) {
    const file = path.resolve(root, relative),
      key = path.relative(root, file).replaceAll("\\", "/");
    if (Object.hasOwn(mocks, key)) return mocks[key];
    if (cache.has(file)) return cache.get(file).exports;
    const m = { exports: {} };
    cache.set(file, m);
    const historical =
      baseline &&
      [
        "components/lumio/account-connections.tsx",
        "app/api/account/link/route.ts",
      ].includes(key);
    const source = historical
      ? cp.execFileSync("git", ["show", "76970b4:" + key], {
          cwd: root,
          encoding: "utf8",
        })
      : fs.readFileSync(file, "utf8");
    new Function(
      "require",
      "module",
      "exports",
      "window",
      "fetch",
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      }).outputText,
    )(
      (name) => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (!name.startsWith(".")) return require(name);
        const next = path.resolve(path.dirname(file), name);
        return load(next + (fs.existsSync(next + ".tsx") ? ".tsx" : ".ts"));
      },
      m,
      m.exports,
      bindings.window,
      bindings.fetch,
    );
    return m.exports;
  };
}
async function fixture(run) {
  let session,
    cursor = 0,
    dirty = false,
    tree,
    effects = [],
    slots = [],
    deps = [],
    cleanups = [];
  const intents = [],
    posts = [],
    signins = [],
    checksums = [];
  const mocks = {},
    bindings = {
      window: {
        location: {
          origin: "https://lumio-fixture.invalid",
          assign() {
            throw Error("Unexpected navigation");
          },
        },
      },
    };
  const load = loader(mocks, bindings),
    platform = load("lib/server/store.ts"),
    store = platform.createStore(":memory:", {
      adminEmails: ["operator@example.test"],
    });
  const identity = (name) => ({
    provider: "google",
    providerAccountId: "synthetic-" + name,
    email: name + "@example.test",
    name: "Synthetic " + name,
    emailVerified: true,
  });
  const owner = store.ensureIdentity(identity("operator")),
    a = store.ensureIdentity(identity("A")),
    b = store.ensureIdentity(identity("B"));
  const current = (user, age = 0) => {
    session = user
      ? {
          userId: user.id,
          sessionVersion: user.sessionVersion,
          authenticatedAt: Date.now() - age,
        }
      : null;
  };
  current(a);
  let configured = true,
    account = {
      id: a.id,
      authenticated: true,
      isAdmin: false,
      recentLogin: true,
      linkingEnabled: true,
      identities: [{ provider: "google", email: "A@example.test" }],
      providers: { google: true, facebook: true },
    };
  mocks["lib/server/store.ts"] = {
    ...platform,
    getStore: () => store,
    getUser: (id) => store.getUser(id),
    createLinkIntent(id, provider, version) {
      const result = store.createLinkIntent(id, provider, version);
      intents.push({ id, provider, version, token: result.token });
      return result;
    },
  };
  mocks["lib/lumio/auth.ts"] = {
    authOptions: () => ({}),
    providerStatus: () => ({ google: configured, facebook: configured }),
  };
  mocks["next-auth"] = { getServerSession: async () => session };
  mocks["next-auth/react"] = {
    signIn: async (provider, options) => signins.push({ provider, options }),
  };
  mocks.react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (value) => {
          slots[index] =
            typeof value === "function" ? value(slots[index]) : value;
          dirty = true;
        },
      ];
    },
    useEffect(effect, values) {
      const index = cursor++;
      if (!deps[index] || values.some((value, i) => value !== deps[index][i])) {
        deps[index] = values;
        effects.push(() => {
          cleanups[index]?.();
          cleanups[index] = effect();
        });
      }
    },
  };
  const api = load("app/api/account/link/route.ts");
  const request = (id, options = {}) =>
    new Request("https://lumio-fixture.invalid/api/account/link", {
      method: "POST",
      headers: {
        Origin: "https://lumio-fixture.invalid",
        "Sec-Fetch-Site": "same-origin",
        "Content-Type": "application/json",
        ...(id === undefined ? {} : { "X-Lumio-User": id }),
        ...options.headers,
      },
      body:
        options.body ??
        JSON.stringify({ provider: options.provider || "facebook" }),
    });
  bindings.fetch = async (url, init) => {
    if (url === "/api/account") return Response.json(account);
    if (url !== "/api/account/link") throw Error("Unexpected transport");
    posts.push(init);
    const response = await api.POST(
      new Request("https://lumio-fixture.invalid/api/account/link", {
        ...init,
        headers: {
          Origin: "https://lumio-fixture.invalid",
          "Sec-Fetch-Site": "same-origin",
          ...init.headers,
        },
      }),
    );
    checksums.push({
      status: response.status,
      cookie: response.headers.get("set-cookie"),
    });
    return response;
  };
  const Component = load(
    "components/lumio/account-connections.tsx",
  ).AccountConnections;
  function render() {
    cursor = 0;
    dirty = false;
    tree = Component({ locale: "en" });
    const pending = effects;
    effects = [];
    pending.forEach((effect) => effect());
  }
  async function flush() {
    for (let i = 0; i < 8; i++) {
      await new Promise((resolve) => setImmediate(resolve));
      if (dirty) render();
    }
  }
  function nodes(value) {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object") return [];
    return [value, ...nodes(value.props?.children)];
  }
  function text(value) {
    if (Array.isArray(value)) return value.map(text).join("");
    if (value && typeof value === "object") return text(value.props?.children);
    return value == null ? "" : String(value);
  }
  async function mount(value = account) {
    account = value;
    render();
    await flush();
  }
  async function click(label = "Link account") {
    const button = nodes(tree).find(
      (node) => node.type === "button" && text(node).trim() === label,
    );
    assert.ok(button, "expected rendered account action");
    button.props.onClick();
    await flush();
  }
  try {
    await run({
      a,
      b,
      owner,
      store,
      current,
      api,
      request,
      intents,
      posts,
      signins,
      checksums,
      mount,
      click,
      nodes,
      text: () => text(tree),
      setConfigured: (value) => {
        configured = value;
      },
    });
  } finally {
    cleanups.forEach((cleanup) => cleanup?.());
    store.close();
  }
}
async function test(name, run) {
  await fixture(run);
  checks.push(name);
  console.log("PASS " + name);
}
async function main() {
  if (baseline) {
    await test("Baseline76970b4 reproduces visible-A/current-cookie-B creating B intent and starting OAuth", async (f) => {
      await f.mount();
      f.current(f.b);
      await f.click();
      assert.equal(f.posts.length, 1);
      assert.equal(f.posts[0].headers["X-Lumio-User"], undefined);
      assert.equal(f.intents.length, 1);
      assert.equal(f.intents[0].id, f.b.id);
      assert.equal(f.checksums[0].status, 200);
      assert.equal(f.signins.length, 1);
    });
    console.log(
      JSON.stringify({
        baseline: "76970b4",
        reproduced: true,
        checks: checks.length,
        networkCalls: 0,
        scope:
          "Historical actual handler/component logic; synthetic hooks/session; real in-memory SQLite intent",
      }),
    );
    return;
  }
  await test("Stale visible A/current cookie B fails before intent/cookie/OAuth and removes stale connection rows", async (f) => {
    await f.mount();
    f.current(f.b);
    await f.click();
    assert.equal(f.posts[0].headers["X-Lumio-User"], f.a.id);
    assert.equal(f.checksums[0].status, 401);
    assert.equal(f.checksums[0].cookie, null);
    assert.equal(f.intents.length, 0);
    assert.equal(f.signins.length, 0);
    assert.match(f.text(), /account has changed/i);
    assert.ok(!f.text().includes("A@example.test"));
  });
  await test("Matching canonical account creates one actual intent, preserves protected cookie and then starts OAuth", async (f) => {
    await f.mount();
    await f.click();
    assert.equal(f.intents.length, 1);
    assert.equal(f.intents[0].id, f.a.id);
    assert.equal(f.checksums[0].status, 200);
    for (const flag of [
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=600",
      "Secure",
      "Path=/",
    ])
      assert.ok(f.checksums[0].cookie.includes(flag));
    assert.deepEqual(f.signins, [
      {
        provider: "facebook",
        options: {
          callbackUrl: "https://lumio-fixture.invalid/?connections=1",
        },
      },
    ]);
  });
  await test("Authenticated UI with absent canonical id cannot send a link request or start OAuth", async (f) => {
    await f.mount({
      authenticated: true,
      recentLogin: true,
      linkingEnabled: true,
      identities: [{ provider: "google", email: "A@example.test" }],
      providers: { google: true, facebook: true },
    });
    await f.click();
    assert.equal(f.posts.length, 0);
    assert.equal(f.signins.length, 0);
    assert.equal(f.intents.length, 0);
  });
  await test("Guest sign-in remains available without creating an account-link intent", async (f) => {
    f.current(null);
    await f.mount({
      authenticated: false,
      isAdmin: false,
      providers: { google: true, facebook: true },
    });
    await f.click("Sign in to manage");
    assert.equal(f.posts.length, 0);
    assert.equal(f.intents.length, 0);
    assert.equal(f.signins.length, 1);
  });
  for (const [name, header] of [
    ["missing", undefined],
    ["wrong", "synthetic-other-user"],
    ["empty", ""],
  ])
    await test(`${name} page-account header fails closed without intent or cookie`, async (f) => {
      const response = await f.api.POST(f.request(header));
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "SESSION_REVOKED" });
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(f.intents.length, 0);
    });
  await test("Origin protection still precedes identity binding", async (f) => {
    const response = await f.api.POST(
      f.request(f.a.id, { headers: { Origin: "https://other.invalid" } }),
    );
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "INVALID_ORIGIN" });
    assert.equal(f.intents.length, 0);
  });
  await test("Missing session remains SIGN_IN_REQUIRED", async (f) => {
    f.current(null);
    const response = await f.api.POST(f.request(f.a.id));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "SIGN_IN_REQUIRED" });
    assert.equal(f.intents.length, 0);
  });
  await test("Revoked canonical session cannot create a link intent", async (f) => {
    f.store.updateUserAccess(
      f.owner.id,
      f.a.id,
      "revoke",
      "Synthetic revoke before link",
      f.owner.sessionVersion,
    );
    const response = await f.api.POST(f.request(f.a.id));
    assert.equal(response.status, 401);
    assert.equal(f.intents.length, 0);
  });
  await test("Disabled account cannot create a link intent", async (f) => {
    f.store.updateUserAccess(
      f.owner.id,
      f.a.id,
      "disable",
      "Synthetic disable before link",
      f.owner.sessionVersion,
    );
    const response = await f.api.POST(f.request(f.a.id));
    assert.equal(response.status, 401);
    assert.equal(f.intents.length, 0);
  });
  await test("Recent-auth requirement remains active for a correctly bound page", async (f) => {
    f.current(f.a, 3600001);
    const response = await f.api.POST(f.request(f.a.id));
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "REAUTHENTICATION_REQUIRED",
    });
    assert.equal(f.intents.length, 0);
  });
  await test("Disabled provider and already-linked identity controls remain active", async (f) => {
    f.setConfigured(false);
    let response = await f.api.POST(f.request(f.a.id));
    assert.equal(response.status, 503);
    assert.equal(f.intents.length, 0);
    f.setConfigured(true);
    response = await f.api.POST(f.request(f.a.id, { provider: "google" }));
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "PROVIDER_ALREADY_LINKED",
    });
    assert.equal(f.intents.length, 0);
  });
  await test("Successful bound intent retains single-use claim and existing canonical UUID", async (f) => {
    assert.equal((await f.api.POST(f.request(f.a.id))).status, 200);
    const identity = {
      provider: "facebook",
      providerAccountId: "synthetic-linked-facebook",
      email: "other@example.test",
      emailVerified: false,
      name: "Synthetic",
    };
    const input = { userId: f.a.id, token: f.intents[0].token, identity };
    assert.throws(
      () => f.store.claimIdentity({ ...input, userId: f.b.id }),
      (e) => e.code === "INVALID_LINK_INTENT",
    );
    assert.equal(f.store.claimIdentity(input).id, f.a.id);
    assert.throws(
      () => f.store.claimIdentity(input),
      (e) => e.code === "INVALID_LINK_INTENT",
    );
  });
  console.log(
    JSON.stringify({
      status: "PASS",
      passed: checks.length,
      networkCalls: 0,
      scope:
        "Actual POST handler and actual component logic with synthetic hooks/session/transport boundaries, real in-memory SQLite intents; no browser or full OAuth journey",
    }),
  );
}
const changed = ["NODE_ENV", "NEXTAUTH_URL"],
  saved = Object.fromEntries(changed.map((key) => [key, process.env[key]]));
process.env.NODE_ENV = "production";
process.env.NEXTAUTH_URL = "https://lumio-fixture.invalid";
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const key of changed)
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
  });
