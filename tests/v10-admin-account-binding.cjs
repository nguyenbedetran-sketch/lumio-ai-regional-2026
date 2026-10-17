// Actual route/component logic, canonical in-memory SQLite; synthetic sessions/hooks only.
// No browser, OAuth, provider, user configuration, persistent DB or report files.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  cp = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  baseline = process.argv.includes("--baseline"),
  previousFetch = global.fetch,
  env = {
    NODE_ENV: "development",
    AUTH_TRUST_HOST: "true",
    NEXTAUTH_URL: "http://127.0.0.1:3000",
    LUMIO_COMPETITION_PREVIEW: "false",
    LUMIO_BACKGROUND_JOBS_DISABLED: "true",
  },
  previousEnv = Object.fromEntries(
    Object.keys(env).map((k) => [k, process.env[k]]),
  );
Object.assign(process.env, env);
global.fetch = async () => {
  throw Error("NETWORK_FORBIDDEN");
};
let checks = 0;
const legacyPaths = new Set([
  "app/api/admin/route.ts",
  "app/api/admin/users/route.ts",
  "app/api/admin/audit/route.ts",
  "app/api/admin/flags/route.ts",
  "components/admin/console.tsx",
]);
function loader(mocks = {}, bindings = {}) {
  const cache = new Map();
  return function load(relative) {
    const file = path.resolve(root, relative),
      key = path.relative(root, file).replaceAll("\\", "/");
    if (Object.hasOwn(mocks, key)) return mocks[key];
    if (cache.has(file)) return cache.get(file).exports;
    const m = { exports: {} };
    cache.set(file, m);
    const source =
      baseline && legacyPaths.has(key)
        ? cp.execFileSync("git", ["show", "f1ac9c2:" + key], {
            cwd: root,
            encoding: "utf8",
          })
        : fs.readFileSync(file, "utf8");
    new Function(
      "require",
      "module",
      "exports",
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
      bindings.fetch || global.fetch,
    );
    return m.exports;
  };
}
async function fixture(run) {
  let session;
  const mocks = {},
    load = loader(mocks),
    platform = load("lib/server/store.ts"),
    store = platform.createStore(":memory:", {
      adminEmails: ["a@example.test", "b@example.test"],
    }),
    identity = (name) =>
      store.ensureIdentity({
        provider: "google",
        providerAccountId: "v10-admin-" + name,
        email: name + "@example.test",
        name: "Synthetic " + name,
        emailVerified: true,
      }),
    a = identity("a"),
    b = identity("b"),
    learner = identity("learner"),
    target = identity("target"),
    origin = "http://127.0.0.1:3000";
  mocks["lib/server/store.ts"] = {
    ...platform,
    getStore: () => store,
    getUser: (id) => store.getUser(id),
  };
  mocks["lib/lumio/auth.ts"] = { authOptions: () => ({}) };
  mocks["next-auth"] = { getServerSession: async () => session };
  const apis = {
    "/api/admin": load("app/api/admin/route.ts"),
    "/api/admin/users": load("app/api/admin/users/route.ts"),
    "/api/admin/audit": load("app/api/admin/audit/route.ts"),
    "/api/admin/flags": load("app/api/admin/flags/route.ts"),
  };
  function current(u, age = 0) {
    session = u
      ? {
          userId: u.id,
          sessionVersion: u.sessionVersion,
          authenticatedAt: Date.now() - age,
        }
      : null;
  }
  current(a);
  const request = (
    route,
    method = "GET",
    key = a.storageKey,
    body,
    headers = {},
  ) =>
    new Request(origin + route, {
      method,
      headers: {
        ...(key === undefined || key === null
          ? {}
          : { "x-lumio-account": key }),
        ...(method === "GET"
          ? {}
          : { origin, "content-type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  async function response(route, req, status, code) {
    const r = await apis[route][req.method](req),
      body = await r.json();
    assert.equal(r.status, status, JSON.stringify(body));
    assert.match(r.headers.get("cache-control"), /no-store/);
    if (code) {
      assert.equal(body.error, code);
      assert.deepEqual(Object.keys(body).sort(), ["error", "requestId"]);
      assert.match(body.requestId, /^[0-9a-f-]{36}$/);
    }
    return body;
  }
  const access = {
    userId: target.id,
    action: "disable",
    reason: "Synthetic intended admin test",
  };
  try {
    await run({
      a,
      b,
      learner,
      target,
      store,
      current,
      request,
      response,
      access,
      apis,
      load,
      mocks,
      snapshot: (u) =>
        load("lib/server/admin-snapshot.ts").adminSnapshot({
          user: u,
          memberships: [],
        }),
    });
  } finally {
    store.close();
  }
}
async function check(name, run) {
  await fixture(run);
  console.log("PASS " + name);
  checks++;
}
const reads = ["/api/admin", "/api/admin/users", "/api/admin/audit"];
async function backendChecks() {
  if (baseline) {
    await check(
      "Baseline f1ac9c2 accepts old page A mutation under cookie B",
      async (f) => {
        f.current(f.b);
        await f.response(
          "/api/admin/users",
          f.request("/api/admin/users", "PATCH", f.a.storageKey, f.access),
          200,
        );
        assert.equal(f.store.getUser(f.target.id).disabled, true);
        assert.equal(
          f.store
            .listAudit()
            .find(
              (e) => e.action === "USER_SUSPENDED" && e.target === f.target.id,
            ).actorId,
          f.b.id,
        );
      },
    );
    console.log(
      JSON.stringify({
        baseline: "f1ac9c2",
        reproduced: true,
        networkCalls: 0,
        checks,
      }),
    );
    return;
  }
  await check(
    "All legacy admin reads reject missing, empty and wrong intended-account headers before data access",
    async (f) => {
      let dataReads = 0;
      for (const key of ["getDashboard", "listUsers", "listAudit"]) {
        const original = f.store[key];
        f.store[key] = (...args) => {
          dataReads++;
          return original(...args);
        };
      }
      for (const key of [null, "", f.b.storageKey])
        for (const route of reads)
          await f.response(
            route,
            f.request(route, "GET", key),
            401,
            "SESSION_REVOKED",
          );
      assert.equal(dataReads, 0);
    },
  );
  await check(
    "Cookie switch A to B rejects old A reads and both mutations without target/flag/audit changes",
    async (f) => {
      const before = f.store.listAudit().length;
      f.current(f.b);
      for (const route of reads)
        await f.response(route, f.request(route), 401, "SESSION_REVOKED");
      await f.response(
        "/api/admin/users",
        f.request("/api/admin/users", "PATCH", f.a.storageKey, f.access),
        401,
        "SESSION_REVOKED",
      );
      await f.response(
        "/api/admin/flags",
        f.request("/api/admin/flags", "PATCH", f.a.storageKey, {
          key: "ai.enabled",
          enabled: false,
        }),
        401,
        "SESSION_REVOKED",
      );
      assert.equal(f.store.getUser(f.target.id).disabled, false);
      assert.equal(f.store.isFeatureEnabled("ai.enabled"), true);
      assert.equal(f.store.listAudit().length, before);
    },
  );
  await check(
    "Neither mutation accepts a missing or empty page-account header",
    async (f) => {
      const before = f.store.listAudit().length;
      for (const key of [null, ""]) {
        await f.response(
          "/api/admin/users",
          f.request("/api/admin/users", "PATCH", key, f.access),
          401,
          "SESSION_REVOKED",
        );
        await f.response(
          "/api/admin/flags",
          f.request("/api/admin/flags", "PATCH", key, {
            key: "ai.enabled",
            enabled: false,
          }),
          401,
          "SESSION_REVOKED",
        );
      }
      assert.equal(f.store.getUser(f.target.id).disabled, false);
      assert.equal(f.store.isFeatureEnabled("ai.enabled"), true);
      assert.equal(f.store.listAudit().length, before);
    },
  );
  await check(
    "Matching fresh account can read, disable/restore a user and update/restore a flag with canonical audit actor",
    async (f) => {
      for (const route of reads) await f.response(route, f.request(route), 200);
      for (const action of ["disable", "enable"])
        await f.response(
          "/api/admin/users",
          f.request("/api/admin/users", "PATCH", f.a.storageKey, {
            ...f.access,
            action,
          }),
          200,
        );
      assert.equal(f.store.getUser(f.target.id).disabled, false);
      for (const enabled of [false, true])
        await f.response(
          "/api/admin/flags",
          f.request("/api/admin/flags", "PATCH", f.a.storageKey, {
            key: "ai.enabled",
            enabled,
          }),
          200,
        );
      assert.equal(f.store.isFeatureEnabled("ai.enabled"), true);
      const actions = f.store
        .listAudit()
        .filter((e) =>
          ["USER_SUSPENDED", "USER_RESTORED", "FEATURE_FLAG_CHANGED"].includes(
            e.action,
          ),
        );
      assert.equal(actions.length, 4);
      assert(actions.every((e) => e.actorId === f.a.id));
    },
  );
  await check(
    "Guest, learner, expired admin and revoked sessions remain denied on read and mutation",
    async (f) => {
      for (const [actor, age, code, status] of [
        [null, 0, "SIGN_IN_REQUIRED", 401],
        [f.learner, 0, "FORBIDDEN", 403],
        [f.a, 3600001, "ADMIN_REAUTH_REQUIRED", 401],
      ]) {
        f.current(actor, age);
        const key = actor?.storageKey || f.a.storageKey;
        for (const route of reads)
          await f.response(route, f.request(route, "GET", key), status, code);
        await f.response(
          "/api/admin/users",
          f.request("/api/admin/users", "PATCH", key, f.access),
          status,
          code,
        );
        await f.response(
          "/api/admin/flags",
          f.request("/api/admin/flags", "PATCH", key, {
            key: "ai.enabled",
            enabled: false,
          }),
          status,
          code,
        );
      }
      f.current(f.a);
      f.store.updateUserAccess(
        f.b.id,
        f.a.id,
        "revoke",
        "Synthetic session revocation",
      );
      for (const route of reads)
        await f.response(route, f.request(route), 401, "SESSION_REVOKED");
      await f.response(
        "/api/admin/users",
        f.request("/api/admin/users", "PATCH", f.a.storageKey, f.access),
        401,
        "SESSION_REVOKED",
      );
      assert.equal(f.store.getUser(f.target.id).disabled, false);
    },
  );
  await check(
    "Origin/fetch-site and browser-only checks still deny cross-site reads, bearer and cross-origin mutations",
    async (f) => {
      for (const route of reads) {
        for (const site of ["cross-site", "same-site"])
          await f.response(
            route,
            f.request(route, "GET", f.a.storageKey, undefined, {
              "sec-fetch-site": site,
            }),
            403,
            "INVALID_ORIGIN",
          );
        await f.response(
          route,
          f.request(route, "GET", f.a.storageKey, undefined, {
            authorization: "Bearer synthetic",
          }),
          401,
          "SIGN_IN_REQUIRED",
        );
      }
      for (const [route, body] of [
        ["/api/admin/users", f.access],
        ["/api/admin/flags", { key: "ai.enabled", enabled: false }],
      ])
        await f.response(
          route,
          f.request(route, "PATCH", f.a.storageKey, body, {
            origin: "https://invalid.example.test",
          }),
          403,
          "INVALID_ORIGIN",
        );
      assert.equal(f.store.getUser(f.target.id).disabled, false);
      assert.equal(f.store.isFeatureEnabled("ai.enabled"), true);
    },
  );
  await check(
    "Canonical mutation session is rechecked if revoked after the route's account authorization",
    async (f) => {
      const original = f.store.updateUserAccess;
      f.store.updateUserAccess = (...args) => {
        original(f.b.id, f.a.id, "revoke", "Synthetic concurrent revoke");
        return original(...args);
      };
      await f.response(
        "/api/admin/users",
        f.request("/api/admin/users", "PATCH", f.a.storageKey, f.access),
        401,
        "SESSION_REVOKED",
      );
      assert.equal(f.store.getUser(f.target.id).disabled, false);
    },
  );
  await check(
    "Feature mutation also retains the canonical in-transaction session check",
    async (f) => {
      const original = f.store.updateFlag;
      f.store.updateFlag = (...args) => {
        f.store.updateUserAccess(
          f.b.id,
          f.a.id,
          "revoke",
          "Synthetic concurrent flag revoke",
        );
        return original(...args);
      };
      await f.response(
        "/api/admin/flags",
        f.request("/api/admin/flags", "PATCH", f.a.storageKey, {
          key: "ai.enabled",
          enabled: false,
        }),
        401,
        "SESSION_REVOKED",
      );
      assert.equal(f.store.isFeatureEnabled("ai.enabled"), true);
    },
  );
  await check(
    "Unexpected private store errors stay a generic no-store envelope",
    async (f) => {
      f.store.listUsers = () => {
        throw Error("private-student-data synthetic-token");
      };
      const body = await f.response(
        "/api/admin/users",
        f.request("/api/admin/users"),
        503,
        "PLATFORM_UNAVAILABLE",
      );
      assert.doesNotMatch(JSON.stringify(body), /private|student|token/);
    },
  );
}
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object") return [];
  return [value, ...nodes(value.props?.children)];
}
async function uiChecks() {
  await check(
    "Actual console sends captured actor key; account remount rejects an old response without any late state update",
    async (f) => {
      let active, release, pendingResponse;
      const requests = [],
        bindings = {
          fetch: async (url, init) => {
            requests.push({
              url,
              key: new Headers(init.headers).get("x-lumio-account"),
            });
            return new Promise((resolve) => {
              release = resolve;
            });
          },
        };
      const hooks = {
        useState(initial) {
          const h = active,
            i = h.cursor++;
          if (!(i in h.slots))
            h.slots[i] = typeof initial === "function" ? initial() : initial;
          return [
            h.slots[i],
            (value) => {
              if (!h.mounted) h.lateWrites++;
              h.slots[i] =
                typeof value === "function" ? value(h.slots[i]) : value;
            },
          ];
        },
        useRef(value) {
          const h = active,
            i = h.cursor++;
          if (!(i in h.slots)) h.slots[i] = { current: value };
          return h.slots[i];
        },
        useEffect(effect) {
          active.effects.push(effect);
        },
      };
      const load = loader(
          { react: hooks, "next-auth/react": { signIn: async () => {} } },
          bindings,
        ),
        Console = load("components/admin/console.tsx").AdminConsole;
      function mount(snapshot) {
        const h = {
          cursor: 0,
          slots: [],
          effects: [],
          mounted: true,
          lateWrites: 0,
        };
        active = h;
        const element = Console({ initial: snapshot });
        h.key = element.key;
        h.tree = element.type(element.props);
        h.cleanups = h.effects.map((effect) => effect());
        h.unmount = () => {
          h.cleanups.forEach((cleanup) => cleanup?.());
          h.mounted = false;
        };
        return h;
      }
      const before = mount(f.snapshot(f.a)),
        refresh = nodes(before.tree).find(
          (n) => n.props?.["aria-label"] === "Làm mới dữ liệu",
        );
      assert(refresh);
      const pending = refresh.props.onClick();
      assert.deepEqual(requests, [{ url: "/api/admin", key: f.a.storageKey }]);
      pendingResponse = Response.json(f.snapshot(f.a));
      before.unmount();
      const after = mount(f.snapshot(f.b));
      assert.notEqual(before.key, after.key);
      const afterState = JSON.stringify(after.slots);
      release(pendingResponse);
      await pending;
      assert.equal(before.lateWrites, 0);
      assert.equal(JSON.stringify(after.slots), afterState);
      assert.equal(after.slots.find((v) => v?.actor)?.actor.id, f.b.id);
      const next = nodes(after.tree)
        .find((n) => n.props?.["aria-label"] === "Làm mới dữ liệu")
        .props.onClick();
      assert.equal(requests.at(-1).key, f.b.storageKey);
      release(Response.json(f.snapshot(f.b)));
      await next;
      assert.equal(after.slots.find((v) => v?.actor)?.actor.id, f.b.id);
      after.unmount();
    },
  );
}
(async () => {
  try {
    await backendChecks();
    if (!baseline) {
      await uiChecks();
      console.log(
        JSON.stringify({
          status: "PASS",
          checks,
          providerCalls: 0,
          scope:
            "Actual handlers/component logic; real in-memory SQLite, synthetic session/hooks; no browser or OAuth",
        }),
      );
    }
  } finally {
    global.fetch = previousFetch;
    for (const [key, value] of Object.entries(previousEnv))
      value === undefined
        ? delete process.env[key]
        : (process.env[key] = value);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
