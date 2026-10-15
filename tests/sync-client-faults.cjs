// Exercises actual component control flow with a minimal hook scheduler, not a real browser renderer.
// The parent app's real onApply arrow is extracted from its TSX AST and executed with isolated storage faults.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
let harness = null;
const react = {
  useState(initial) {
    const h = harness,
      i = h.index++;
    if (!h.hooks[i])
      h.hooks[i] = {
        value: typeof initial === "function" ? initial() : initial,
      };
    return [
      h.hooks[i].value,
      (next) => {
        h.hooks[i].value =
          typeof next === "function" ? next(h.hooks[i].value) : next;
      },
    ];
  },
  useRef(initial) {
    const h = harness,
      i = h.index++;
    return (h.hooks[i] ||= { current: initial });
  },
  useEffect(fn, deps) {
    const h = harness,
      i = h.index++,
      old = h.hooks[i];
    if (!old || deps.some((v, n) => v !== old.deps[n])) {
      h.effects.push(() => {
        old?.cleanup?.();
        h.hooks[i] = { deps, cleanup: fn() };
      });
    }
  },
};
const jsx = (type, props) => ({ type, props: props || {} });
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name === "react"
        ? react
        : name === "react/jsx-runtime"
          ? { jsx, jsxs: jsx, Fragment: "fragment" }
          : name === "lucide-react"
            ? new Proxy({}, { get: (_t, name) => String(name) })
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
const { SyncPanel } = load("components/lumio/sync-panel.tsx"),
  { normalizeSyncEnvelope } = load("lib/sync/contracts.ts"),
  { parseLearning, learningKey } = load("lib/lumio/learning-engine.ts"),
  { parsePreferences, preferenceKey } = load("lib/lumio/recommendations.ts");
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-sync-client-")),
  platform = load("lib/server/store.ts");
let time = Date.UTC(2026, 9, 15, 12),
  passed = 0;
const store = platform.createStore(path.join(folder, "test.sqlite"), {
  now: () => time,
});
const original = {
  fetch: global.fetch,
  window: global.window,
  localStorage: global.localStorage,
  navigator: Object.getOwnPropertyDescriptor(global, "navigator"),
};
let backing = new Map(),
  throwCursor = false,
  requests = [],
  adapter;
global.localStorage = {
  getItem: (key) => backing.get(key) ?? null,
  setItem(key, value) {
    if (
      throwCursor &&
      key.startsWith("lumio-sync-v3:") &&
      !key.endsWith(":enabled")
    )
      throw Error("QuotaExceededError");
    backing.set(key, String(value));
  },
  removeItem: (key) => backing.delete(key),
};
Object.defineProperty(global, "navigator", {
  configurable: true,
  value: { onLine: true },
});
const listeners = new Map();
global.window = {
  addEventListener(type, fn) {
    let set = listeners.get(type);
    if (!set) listeners.set(type, (set = new Set()));
    set.add(fn);
  },
  removeEventListener(type, fn) {
    listeners.get(type)?.delete(fn);
  },
  confirm: () => true,
};
global.fetch = (url, options = {}) => {
  requests.push({
    url,
    method: options.method || "GET",
    headers: options.headers,
    body: options.body,
  });
  return adapter(url, options);
};
const envelope = () => ({
  version: 1,
  library: { version: 1, items: [], spaces: [] },
  learning: { version: 1, tasks: [], reviews: [], events: [], focus: null },
  preferences: { version: 1, enabled: true, feedback: [] },
});
const item = (id, title = id) => ({
  id,
  title,
  kind: "text",
  spaceId: "",
  createdAt: new Date(time).toISOString(),
  updatedAt: new Date(time).toISOString(),
  text: "A synthetic source.",
  notes: "",
  cards: [],
  questions: [],
  attempts: [],
  favorite: false,
});
function text(node) {
  if (node === null || node === undefined || typeof node === "boolean")
    return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return text(node.props?.children);
}
function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const c of node) {
      const n = find(c, predicate);
      if (n) return n;
    }
    return null;
  }
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}
function panel(account, value, onApply) {
  const h = {
    hooks: [],
    index: 0,
    effects: [],
    value,
    onApply,
    tree: null,
    render() {
      this.index = 0;
      harness = this;
      this.tree = SyncPanel({
        account,
        locale: "en",
        value: this.value,
        onApply: this.onApply,
      });
      harness = null;
      while (this.effects.length) this.effects.shift()();
      return this.tree;
    },
    async click(label) {
      this.render();
      const button = find(
        this.tree,
        (n) => n.type === "button" && text(n).includes(label),
      );
      assert.ok(button, `button ${label}`);
      assert.equal(!!button.props.disabled, false);
      button.props.onClick();
      for (let n = 0; n < 100 && this.hooks[1].value === "busy"; n++) {
        await new Promise((r) => setImmediate(r));
        this.render();
      }
      this.render();
      assert.notEqual(
        this.hooks[1].value,
        "busy",
        "bounded fake-hook scheduler completed",
      );
      return this.hooks[1].value;
    },
    dispose() {
      for (const hook of this.hooks) hook?.cleanup?.();
    },
  };
  h.render();
  h.render();
  return h;
}
function remoteAdapter(user) {
  return async (_url, options) => {
    try {
      assert.equal(options.headers["X-Lumio-Account"], user.storageKey);
      if ((options.method || "GET") === "PUT")
        return Response.json(
          store.syncWrite(
            user.id,
            user.sessionVersion,
            JSON.parse(options.body),
          ),
        );
      if (options.method === "DELETE") {
        const data = JSON.parse(options.body);
        return Response.json(
          store.syncDelete(
            user.id,
            user.sessionVersion,
            data.epoch,
            data.revision,
          ),
        );
      }
      return Response.json(store.syncRead(user.id, user.sessionVersion));
    } catch (e) {
      return Response.json(
        { error: e.code || "PLATFORM_UNAVAILABLE" },
        { status: e.status || 503 },
      );
    }
  };
}
function setup(name) {
  const u = store.ensureIdentity({
      provider: "google",
      providerAccountId: "sync-fault-" + name,
      name: "Synthetic",
      emailVerified: false,
    }),
    initial = store.syncRead(u.id, u.sessionVersion),
    base = normalizeSyncEnvelope(envelope());
  store.syncWrite(u.id, u.sessionVersion, {
    epoch: initial.epoch,
    expectedRevision: 0,
    requestId: crypto.randomUUID(),
    data: base,
  });
  const cursor = { epoch: initial.epoch, revision: 1, base },
    key = `lumio-sync-v3:${encodeURIComponent(u.storageKey)}`;
  backing.set(key, JSON.stringify(cursor));
  backing.set(key + ":enabled", "true");
  adapter = remoteAdapter(u);
  return { u, base, key, cursor };
}
async function check(name, fn) {
  backing = new Map();
  throwCursor = false;
  requests = [];
  listeners.clear();
  navigator.onLine = true;
  await fn();
  passed++;
  console.log("PASS " + name);
}
function appApplyFixture({
  afterSave,
  failLibrary = false,
  failLearning = false,
  blob = false,
  frames = false,
  account = "apply-fixture",
} = {}) {
  const source = fs.readFileSync(
      path.join(root, "components/lumio/app.tsx"),
      "utf8",
    ),
    file = ts.createSourceFile(
      "app.tsx",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  let arrow;
  function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(file) === "SyncPanel"
    )
      for (const attr of node.attributes.properties)
        if (ts.isJsxAttribute(attr) && attr.name.getText(file) === "onApply")
          arrow = attr.initializer.expression;
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(arrow, "actual SyncPanel onApply AST");
  const local = envelope();
  local.library.items = [
    {
      ...item("local-file"),
      ...(blob ? { blob: new Blob(["device-only file"]) } : {}),
    },
  ];
  if (frames) {
    const at = new Date(time).toISOString();
    local.library.items[0].artifacts = [
      {
        id: "local-summary",
        kind: "summary",
        createdAt: at,
        summary: {
          title: "Synthetic summary",
          overview: "A synthetic source overview.",
          keyPoints: ["One source idea"],
          chapters: [
            {
              title: "Chapter",
              summary: "Synthetic source details.",
              bullets: ["Source idea"],
              timestampKind: "none",
            },
          ],
          mindMap: {
            nodes: [
              { id: "root", label: "Source", detail: "Root" },
              {
                id: "child",
                label: "Detail",
                detail: "Detail",
                chapterIndex: 0,
              },
            ],
            edges: [{ source: "root", target: "child" }],
          },
        },
        source: {
          kind: "text",
          title: "Synthetic source",
          contentLength: local.library.items[0].text.length,
        },
        frames: [
          {
            url: "data:image/jpeg;base64,c3ludGhldGljLW9ubHk=",
            seconds: 5,
            createdAt: at,
          },
        ],
      },
    ];
  }
  local.learning.focus = {
    id: "active-focus",
    seconds: 300,
    remaining: 200,
    deadline: time + 200000,
  };
  local.learning.alarm = {
    preset: "custom",
    volume: 0.5,
    customName: "local.wav",
  };
  local.learning.lastAlarmId = "device-alarm";
  const profile = { account },
    learning = {
      state: structuredClone(local.learning),
      writes: 0,
      update(value) {
        this.writes++;
        this.state = value;
        if (!failLearning)
          localStorage.setItem(
            learningKey(profile.account),
            JSON.stringify(value),
          );
      },
    },
    personalization = {
      state: structuredClone(local.preferences),
      writes: 0,
      update(value) {
        this.writes++;
        this.state = value;
        localStorage.setItem(
          preferenceKey(profile.account),
          JSON.stringify(value),
        );
      },
    };
  localStorage.setItem(
    learningKey(profile.account),
    JSON.stringify(learning.state),
  );
  localStorage.setItem(
    preferenceKey(profile.account),
    JSON.stringify(personalization.state),
  );
  const env = {
    data: local.library,
    currentData: { current: local.library },
    blocked: { current: false },
    pending: { current: false },
    saveQueue: { current: Promise.resolve() },
    syncLocalSnapshot: {
      current: {
        account: profile.account,
        learning: learning.state,
        preferences: personalization.state,
      },
    },
    learning,
    personalization,
    profile,
    normalizeSyncEnvelope,
    parseLearning,
    parsePreferences,
    learningKey,
    preferenceKey,
    localStorage,
  };
  env.commit = (next) => {
    env.currentData.current = next;
    env.pending.current = true;
    env.saveQueue.current = Promise.resolve().then(() => {
      afterSave?.(env);
      env.pending.current = failLibrary;
    });
  };
  const mod = { exports: {} },
    js = ts.transpileModule("module.exports=" + arrow.getText(file), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText;
  new Function("module", ...Object.keys(env), js)(mod, ...Object.values(env));
  return { apply: mod.exports, env, local };
}
(async () => {
  try {
    await check(
      "Failed local apply followed by replay preserves unapplied remote material and preferences",
      async () => {
        const { u, base, key, cursor } = setup("failed-apply"),
          remote = structuredClone(base);
        remote.library.items = [item("remote")];
        remote.preferences.enabled = false;
        store.syncWrite(u.id, u.sessionVersion, {
          epoch: cursor.epoch,
          expectedRevision: 1,
          requestId: crypto.randomUUID(),
          data: remote,
        });
        const local = structuredClone(base);
        local.library.items = [item("local")];
        let fail = true,
          h;
        h = panel(u.storageKey, local, async (data) => {
          if (fail) throw Error("SYNC_LOCAL_SAVE_FAILED");
          h.value = structuredClone(data);
          h.render();
        });
        assert.equal(await h.click("Sync now"), "error");
        assert.deepEqual(JSON.parse(backing.get(key)).base, base);
        fail = false;
        assert.equal(await h.click("Sync now"), "done");
        const saved = store.syncRead(u.id, u.sessionVersion);
        assert.deepEqual(saved.data.library.items.map((i) => i.id).sort(), [
          "local",
          "remote",
        ]);
        assert.equal(saved.data.preferences.enabled, false);
        assert.equal(h.value.preferences.enabled, false);
        assert.equal(JSON.parse(backing.get(key)).pending, undefined);
        h.dispose();
      },
    );
    await check(
      "Partial library application cannot turn an unapplied preference change into a deletion on retry",
      async () => {
        const { u, base, cursor } = setup("partial"),
          remote = structuredClone(base);
        remote.library.items = [item("remote")];
        remote.preferences.enabled = false;
        store.syncWrite(u.id, u.sessionVersion, {
          epoch: cursor.epoch,
          expectedRevision: 1,
          requestId: crypto.randomUUID(),
          data: remote,
        });
        const local = structuredClone(base);
        local.library.items = [item("local")];
        let fail = true,
          h;
        h = panel(u.storageKey, local, async (data) => {
          if (fail) {
            h.value = { ...h.value, library: structuredClone(data.library) };
            h.render();
            throw Error("SYNC_LOCAL_SAVE_FAILED");
          }
          h.value = structuredClone(data);
          h.render();
        });
        assert.equal(await h.click("Sync now"), "error");
        fail = false;
        assert.equal(await h.click("Sync now"), "done");
        assert.equal(
          store.syncRead(u.id, u.sessionVersion).data.preferences.enabled,
          false,
        );
        assert.equal(h.value.preferences.enabled, false);
        h.dispose();
      },
    );
    await check(
      "Lost ACK plus a newer local edit requires conflict review and retains remote-only records",
      async () => {
        const { u, base, cursor } = setup("lost-ack-edit"),
          remote = structuredClone(base);
        remote.library.items = [item("remote")];
        store.syncWrite(u.id, u.sessionVersion, {
          epoch: cursor.epoch,
          expectedRevision: 1,
          requestId: crypto.randomUUID(),
          data: remote,
        });
        const local = structuredClone(base);
        local.library.items = [item("local")];
        let lose = true,
          h;
        const delegate = adapter;
        adapter = async (url, options) => {
          const response = await delegate(url, options);
          if (options.method === "PUT" && lose) {
            lose = false;
            h.value = structuredClone(local);
            h.value.library.items[0].notes = "Newest local note";
            h.render();
            throw Error("synthetic lost ACK");
          }
          return response;
        };
        h = panel(u.storageKey, local, async (data) => {
          h.value = structuredClone(data);
          h.render();
        });
        assert.equal(await h.click("Sync now"), "error");
        assert.equal(await h.click("Sync now"), "conflict");
        assert.equal(await h.click("Prefer this device's changes"), "done");
        const result = store.syncRead(u.id, u.sessionVersion).data;
        assert.deepEqual(result.library.items.map((i) => i.id).sort(), [
          "local",
          "remote",
        ]);
        assert.equal(
          result.library.items.find((i) => i.id === "local").notes,
          "Newest local note",
        );
        h.dispose();
      },
    );
    await check(
      "Outbox storage failure prevents any upload and preserves local changes",
      async () => {
        const { u, base } = setup("cursor-storage"),
          local = structuredClone(base);
        local.library.items = [item("local")];
        const h = panel(u.storageKey, local, async () => {
          throw Error("must not apply");
        });
        throwCursor = true;
        assert.equal(await h.click("Sync now"), "error");
        assert.equal(requests.filter((r) => r.method === "PUT").length, 0);
        assert.equal(store.syncRead(u.id, u.sessionVersion).revision, 1);
        assert.equal(h.value.library.items[0].id, "local");
        h.dispose();
      },
    );
    await check(
      "Offline first upload stays local and online retry flushes a canonical new epoch safely",
      async () => {
        const u = store.ensureIdentity({
            provider: "google",
            providerAccountId: "sync-fault-offline",
            name: "Synthetic",
            emailVerified: false,
          }),
          key = `lumio-sync-v3:${encodeURIComponent(u.storageKey)}`,
          local = envelope();
        local.library.items = [item("offline")];
        backing.set(key + ":enabled", "true");
        adapter = remoteAdapter(u);
        let h;
        h = panel(u.storageKey, local, async (data) => {
          h.value = structuredClone(data);
          h.render();
        });
        navigator.onLine = false;
        assert.equal(await h.click("Sync now"), "offline");
        assert.equal(requests.length, 0);
        assert.equal(JSON.parse(backing.get(key)).epoch, "pending-first");
        navigator.onLine = true;
        assert.equal(await h.click("Sync now"), "done");
        assert.equal(
          store.syncRead(u.id, u.sessionVersion).data.library.items[0].id,
          "offline",
        );
        h.dispose();
      },
    );
    await check(
      "Actual onApply preserves an unchanged device attachment, focus and custom alarm",
      async () => {
        const f = appApplyFixture({ blob: true }),
          incoming = normalizeSyncEnvelope(f.local);
        incoming.library.items[0].notes = "Remote note";
        await f.apply(incoming);
        assert.equal(
          f.env.currentData.current.items[0].blob,
          f.local.library.items[0].blob,
        );
        assert.deepEqual(f.env.learning.state.focus, f.local.learning.focus);
        assert.deepEqual(f.env.learning.state.alarm, f.local.learning.alarm);
      },
    );
    await check(
      "Actual onApply rejects removal or source replacement of device-only attachments before any write",
      async () => {
        for (const remove of [true, false]) {
          const f = appApplyFixture({ blob: true }),
            incoming = normalizeSyncEnvelope(f.local);
          if (remove) incoming.library.items = [];
          else incoming.library.items[0].text = "Changed source";
          await assert.rejects(
            f.apply(incoming),
            (e) => e.message === "SYNC_LOCAL_ATTACHMENTS_CONFLICT",
          );
          assert.equal(f.env.learning.writes, 0);
          assert.equal(f.env.personalization.writes, 0);
          assert.equal(f.env.currentData.current, f.local.library);
        }
      },
    );
    await check(
      "Frame previews never enter a sync body and the actual apply roundtrip preserves local originals",
      async () => {
        const u = store.ensureIdentity({
          provider: "google",
          providerAccountId: "sync-fault-frame-roundtrip",
          name: "Synthetic",
          emailVerified: false,
        });
        const f = appApplyFixture({ frames: true, account: u.storageKey }),
          original = f.local.library.items[0].artifacts[0].frames;
        const normalized = normalizeSyncEnvelope(f.local);
        assert.equal(
          normalized.library.items[0].artifacts[0].frames,
          undefined,
        );
        assert.ok(!JSON.stringify(normalized).includes("data:image/"));
        const key = `lumio-sync-v3:${encodeURIComponent(u.storageKey)}`;
        backing.set(key + ":enabled", "true");
        adapter = remoteAdapter(u);
        let h;
        h = panel(u.storageKey, f.local, async (incoming) => {
          await f.apply(incoming);
          h.value = { ...incoming, library: f.env.currentData.current };
          h.render();
        });
        assert.equal(await h.click("Sync now"), "done");
        assert.equal(
          f.env.currentData.current.items[0].artifacts[0].frames,
          original,
        );
        assert.ok(requests.some((r) => r.method === "PUT"));
        for (const request of requests.filter((r) => r.method === "PUT")) {
          assert.ok(!request.body.includes("data:image/"));
          assert.equal(
            JSON.parse(request.body).data.library.items[0].artifacts[0].frames,
            undefined,
          );
        }
        const server = store.syncRead(u.id, u.sessionVersion);
        assert.equal(
          server.data.library.items[0].artifacts[0].frames,
          undefined,
        );
        assert.ok(
          !JSON.stringify(JSON.parse(backing.get(key))).includes("data:image/"),
        );
        h.dispose();
      },
    );
    await check(
      "Frame-bearing artifacts reject item/source/artifact removal or changed content before any local write",
      async () => {
        for (const change of [
          "item",
          "source",
          "artifact",
          "id",
          "summary",
          "artifact-source",
          "duplicate",
        ]) {
          const f = appApplyFixture({ frames: true }),
            incoming = normalizeSyncEnvelope(f.local),
            original = f.local.library.items[0].artifacts[0].frames;
          if (change === "item") incoming.library.items = [];
          else if (change === "source")
            incoming.library.items[0].text = "A different source.";
          else if (change === "artifact")
            incoming.library.items[0].artifacts = [];
          else if (change === "id")
            incoming.library.items[0].artifacts[0].id = "other-summary";
          else if (change === "summary")
            incoming.library.items[0].artifacts[0].summary.overview =
              "A replaced summary.";
          else if (change === "artifact-source")
            incoming.library.items[0].artifacts[0].source.title =
              "Different provenance";
          else
            incoming.library.items[0].artifacts.push(
              structuredClone(incoming.library.items[0].artifacts[0]),
            );
          await assert.rejects(
            f.apply(incoming),
            (e) => e.message === "SYNC_LOCAL_ATTACHMENTS_CONFLICT",
            change,
          );
          assert.equal(f.env.currentData.current, f.local.library);
          assert.equal(f.local.library.items[0].artifacts[0].frames, original);
          assert.equal(f.env.learning.writes, 0);
          assert.equal(f.env.personalization.writes, 0);
        }
      },
    );
    await check(
      "Matching artifact IDs do not replace trusted device frames with incoming frame bytes",
      async () => {
        const f = appApplyFixture({ frames: true }),
          incoming = normalizeSyncEnvelope(f.local),
          original = f.local.library.items[0].artifacts[0].frames;
        incoming.library.items[0].artifacts[0].frames = [
          {
            url: "data:image/jpeg;base64,aW5jb21pbmctbm90LXRydXN0ZWQ=",
            seconds: 5,
            createdAt: new Date(time).toISOString(),
          },
        ];
        await f.apply(incoming);
        assert.equal(
          f.env.currentData.current.items[0].artifacts[0].frames,
          original,
        );
      },
    );
    await check(
      "Actual onApply stops after a failed IndexedDB library save",
      async () => {
        const f = appApplyFixture({ failLibrary: true });
        await assert.rejects(
          f.apply(normalizeSyncEnvelope(f.local)),
          (e) => e.message === "SYNC_LOCAL_SAVE_FAILED",
        );
        assert.equal(f.env.learning.writes, 0);
        assert.equal(f.env.personalization.writes, 0);
      },
    );
    await check(
      "A focus completion during IndexedDB await is retained instead of overwritten or resurrected",
      async () => {
        const f = appApplyFixture({
          afterSave: (env) => {
            const changed = {
              ...env.learning.state,
              focus: null,
              events: [
                {
                  id: "focus-new",
                  at: new Date(time).toISOString(),
                  kind: "focus",
                  minutes: 5,
                },
              ],
            };
            localStorage.setItem(
              learningKey(env.profile.account),
              JSON.stringify(changed),
            );
            env.syncLocalSnapshot.current = {
              ...env.syncLocalSnapshot.current,
              learning: changed,
            };
          },
        });
        await assert.rejects(
          f.apply(normalizeSyncEnvelope(f.local)),
          (e) => e.message === "SYNC_LOCAL_CHANGED",
        );
        assert.equal(f.env.learning.writes, 0);
        assert.equal(
          JSON.parse(localStorage.getItem(learningKey(f.env.profile.account)))
            .focus,
          null,
        );
        assert.equal(f.env.personalization.writes, 0);
      },
    );
    await check(
      "A cross-tab preference write or latest-render edit during IndexedDB await prevents stale restore",
      async () => {
        for (const rawOnly of [true, false]) {
          const f = appApplyFixture({
            afterSave: (env) => {
              const changed = { ...env.personalization.state, enabled: false };
              if (rawOnly)
                localStorage.setItem(
                  preferenceKey(env.profile.account),
                  JSON.stringify(changed),
                );
              else
                env.syncLocalSnapshot.current = {
                  ...env.syncLocalSnapshot.current,
                  preferences: changed,
                };
            },
          });
          await assert.rejects(
            f.apply(normalizeSyncEnvelope(f.local)),
            (e) => e.message === "SYNC_LOCAL_CHANGED",
          );
          assert.equal(f.env.learning.writes, 0);
          assert.equal(f.env.personalization.writes, 0);
        }
      },
    );
    await check(
      "A learning persistence failure prevents a subsequent preference restore",
      async () => {
        const f = appApplyFixture({ failLearning: true }),
          incoming = normalizeSyncEnvelope(f.local);
        incoming.learning.events = [
          {
            id: "remote-event",
            at: new Date(time).toISOString(),
            kind: "read",
            itemId: "local-file",
          },
        ];
        await assert.rejects(
          f.apply(incoming),
          (e) => e.message === "SYNC_LOCAL_SAVE_FAILED",
        );
        assert.equal(f.env.learning.writes, 1);
        assert.equal(f.env.personalization.writes, 0);
      },
    );
    await check(
      "Account change during apply cannot restore learning into the old namespace",
      async () => {
        const f = appApplyFixture({
          afterSave: (env) => {
            env.syncLocalSnapshot.current = {
              ...env.syncLocalSnapshot.current,
              account: "different-account",
            };
          },
        });
        await assert.rejects(
          f.apply(normalizeSyncEnvelope(f.local)),
          (e) => e.message === "SYNC_LOCAL_CHANGED",
        );
        assert.equal(f.env.learning.writes, 0);
        assert.equal(f.env.personalization.writes, 0);
      },
    );
    await check(
      "First-time learning save failure keeps a readable recovery error and does not change preferences",
      async () => {
        const f = appApplyFixture({ failLearning: true });
        localStorage.removeItem(learningKey(f.env.profile.account));
        await assert.rejects(
          f.apply(normalizeSyncEnvelope(f.local)),
          (e) => e.message === "SYNC_LOCAL_SAVE_FAILED",
        );
        assert.equal(f.env.personalization.writes, 0);
      },
    );
    await check(
      "Attachment/save fault copy is readable in all five locales without echoing raw diagnostics",
      async () => {
        const { friendlySyncError, syncCopy } = load("lib/sync/copy.ts");
        for (const locale of ["vi", "en", "ja", "ko", "zh-CN"])
          for (const code of [
            "SYNC_LOCAL_ATTACHMENTS_CONFLICT",
            "SYNC_LOCAL_SAVE_FAILED",
          ]) {
            const value = friendlySyncError(code, locale);
            assert.ok(value.length > 30);
            assert.notEqual(value, syncCopy[locale].connectionError);
            assert.ok(!value.includes(code));
          }
        assert.equal(
          friendlySyncError("private database diagnostic", "en"),
          syncCopy.en.connectionError,
        );
      },
    );
    console.log(
      `Sync client faults: ${passed} checks passed against real component/onApply code with synthetic hooks/storage and isolated SQLite. Not browser/device evidence.`,
    );
  } finally {
    store.close();
    global.fetch = original.fetch;
    global.window = original.window;
    global.localStorage = original.localStorage;
    if (original.navigator)
      Object.defineProperty(global, "navigator", original.navigator);
    else delete global.navigator;
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
