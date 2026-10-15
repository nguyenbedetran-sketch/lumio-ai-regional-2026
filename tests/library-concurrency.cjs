const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(file) {
  const name = path.resolve(root, file);
  if (cache.has(name)) return cache.get(name).exports;
  const module = { exports: {} };
  cache.set(name, module);
  const code = ts.transpileModule(fs.readFileSync(name, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (p) =>
      p.startsWith(".")
        ? load(path.relative(root, path.resolve(path.dirname(name), p + ".ts")))
        : require(p),
    module,
    module.exports,
  );
  return module.exports;
}
/** Deterministic IndexedDB transaction model, not a browser substitute.
 * Requests execute asynchronously; overlapping transactions are serialised;
 * writes commit together or are rolled back on abort. No live user database is opened.
 */
function model(initial = new Map()) {
  let version = 1,
    active = null;
  const stores = new Map([["libraries", structuredClone(initial)]]),
    queue = [],
    scopes = [];
  const harness = { failStore: null, scopes, stores, open };
  function open(name, requested) {
    assert.equal(name, "lumio-local-library-v2");
    const request = {};
    setImmediate(() => {
      if (requested < version) {
        request.error = new Error("VersionError");
        request.onerror?.();
        return;
      }
      request.result = database();
      if (requested > version) {
        version = requested;
        request.onupgradeneeded?.();
      }
      request.onsuccess?.();
    });
    return request;
  }
  function database() {
    return {
      objectStoreNames: { contains: (name) => stores.has(name) },
      createObjectStore(name) {
        stores.set(name, new Map());
      },
      close() {},
      transaction(names, mode) {
        names = typeof names === "string" ? [names] : names;
        scopes.push({ names: [...names], mode });
        const tx = {
          pending: [],
          working: null,
          error: null,
          ended: false,
          abort,
          objectStore,
        };
        function abort() {
          if (tx.ended) return;
          tx.ended = true;
          setImmediate(() => {
            tx.onabort?.();
            active = null;
            runNext();
          });
        }
        function objectStore(storeName) {
          assert.ok(
            names.includes(storeName),
            "Request outside transaction scope",
          );
          return {
            get(key) {
              return request("get", key);
            },
            put(value, key) {
              assert.equal(mode, "readwrite");
              return request("put", key, value);
            },
          };
          function request(kind, key, value) {
            if (tx.ended) throw Error("TransactionInactiveError");
            const result = {};
            tx.pending.push(() => {
              if (kind === "get")
                result.result = structuredClone(
                  tx.working.get(storeName).get(key),
                );
              else {
                if (harness.failStore === storeName) {
                  harness.failStore = null;
                  tx.error = Error("QuotaExceededError");
                  abort();
                  return;
                }
                tx.working.get(storeName).set(key, structuredClone(value));
                result.result = key;
              }
              result.onsuccess?.();
            });
            return result;
          }
        }
        tx.run = () => {
          tx.working = new Map(
            names.map((name) => [name, structuredClone(stores.get(name))]),
          );
          function step() {
            if (tx.ended) return;
            const request = tx.pending.shift();
            if (request) {
              request();
              if (!tx.ended) setImmediate(step);
              return;
            }
            if (mode === "readwrite")
              for (const [name, data] of tx.working) stores.set(name, data);
            tx.ended = true;
            tx.oncomplete?.();
            active = null;
            runNext();
          }
          setImmediate(step);
        };
        queue.push(tx);
        setImmediate(runNext);
        return tx;
      },
    };
  }
  function runNext() {
    if (active || !queue.length) return;
    active = queue.shift();
    active.run();
  }
  return harness;
}
const storage = load("lib/lumio/storage.ts");
// Execute the actual private commit/recovery functions with controlled refs.
// This covers snapshot binding and draft retention without a DOM or a real database.
function workspaceFunction(name, env) {
  const filename = path.join(root, "components/lumio/app.tsx");
  const source = ts.createSourceFile(
    filename,
    fs.readFileSync(filename, "utf8"),
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  );
  let found;
  function visit(node) {
    if (
      name === "commit" &&
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === name
    )
      found = node.initializer.arguments[0];
    else if (ts.isFunctionDeclaration(node) && node.name?.text === name)
      found = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, `${name} implementation missing`);
  const body =
    name === "commit"
      ? `const callback = ${found.getText(source)};`
      : found.getText(source);
  const code = ts.transpileModule(body, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  return new Function(
    ...Object.keys(env),
    code + `\nreturn ${name === "commit" ? "callback" : name};`,
  )(...Object.values(env));
}
function workspaceEnvironment(data, revision = 0) {
  const ref = (current) => ({ current });
  const env = {
    data,
    profile: { account: "account" },
    mounted: ref(true),
    loaded: ref(true),
    snapshotRevisions: ref(new WeakMap([[data, revision]])),
    revision: ref(revision),
    currentData: ref(data),
    pending: ref(false),
    blocked: ref(false),
    retainedDraft: ref(null),
    libraryChannel: ref(null),
    saveQueue: ref(Promise.resolve()),
    saveLibrary: storage.saveLibrary,
    loadLibrarySnapshot: storage.loadLibrarySnapshot,
    LibraryConflictError: storage.LibraryConflictError,
    conflictCopy: { resolve: "Retain the previous draft" },
    status: "saved",
    conflict: false,
    recovering: false,
    retained: null,
    toast: "",
  };
  Object.assign(env, {
    setData: (value) => {
      env.data = value;
    },
    setStatus: (value) => {
      env.status = value;
    },
    setLibraryConflict: (value) => {
      env.conflict = value;
    },
    setRecoveringLibrary: (value) => {
      env.recovering = value;
    },
    setRecoveryDraft: (value) => {
      env.retained = value;
    },
    setToast: (value) => {
      env.toast = value;
    },
  });
  return env;
}
const empty = () => ({ version: 1, items: [], spaces: [] });
const item = (id, notes = "") => ({
  id,
  title: id,
  kind: "text",
  spaceId: "",
  text: "Source",
  notes,
  createdAt: "2026-09-20T00:00:00Z",
  updatedAt: "2026-09-20T00:00:00Z",
  cards: [],
  questions: [],
  attempts: [],
  favorite: false,
});
const base = () => ({ ...empty(), items: [item("existing")] });
let count = 0;
async function test(name, fn) {
  await fn();
  count++;
  console.log(`PASS ${name}`);
}
async function main() {
  await test("Version-1 library and Blob survive migration; old blind-writing clients are refused", async () => {
    const data = base();
    data.items[0].blob = new Blob(["original bytes"], { type: "text/plain" });
    const db = model(new Map([["account", data]]));
    global.indexedDB = db;
    const loaded = await storage.loadLibrarySnapshot("account");
    assert.equal(loaded.revision, 0);
    assert.equal(await loaded.data.items[0].blob.text(), "original bytes");
    const error = await new Promise((resolve) => {
      const request = db.open("lumio-local-library-v2", 1);
      request.onerror = () => resolve(request.error);
    });
    assert.equal(error.message, "VersionError");
    assert.equal(
      await db.stores.get("libraries").get("account").items[0].blob.text(),
      "original bytes",
    );
  });
  await test("Two tabs saving the same revision yield one winner and one explicit conflict", async () => {
    global.indexedDB = model(new Map([["account", base()]]));
    const a = await storage.loadLibrarySnapshot("account"),
      b = await storage.loadLibrarySnapshot("account");
    const results = await Promise.allSettled([
      storage.saveLibrary(
        "account",
        { ...a.data, items: [item("A"), ...a.data.items] },
        a.revision,
      ),
      storage.saveLibrary(
        "account",
        { ...b.data, items: [item("B"), ...b.data.items] },
        b.revision,
      ),
    ]);
    assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
    const rejected = results.find((x) => x.status === "rejected");
    assert.ok(rejected.reason instanceof storage.LibraryConflictError);
    const saved = await storage.loadLibrarySnapshot("account");
    assert.equal(saved.revision, 1);
    assert.equal(saved.data.items.length, 2);
  });
  await test("Opening an old item in a stale tab cannot remove another tab's new math item", async () => {
    global.indexedDB = model(new Map([["account", base()]]));
    const a = await storage.loadLibrarySnapshot("account"),
      b = await storage.loadLibrarySnapshot("account");
    await storage.saveLibrary(
      "account",
      { ...a.data, items: [item("new-math", "Result: 2-x"), ...a.data.items] },
      a.revision,
    );
    const stale = {
      ...b.data,
      items: b.data.items.map((i) => ({
        ...i,
        lastOpenedAt: "2026-09-20T12:00:00Z",
      })),
    };
    await assert.rejects(
      storage.saveLibrary("account", stale, b.revision),
      storage.LibraryConflictError,
    );
    const latest = await storage.loadLibrarySnapshot("account");
    assert.equal(
      latest.data.items.find((i) => i.id === "new-math").notes,
      "Result: 2-x",
    );
    assert.equal(stale.items.length, 1);
  });
  await test("Stale edits cannot resurrect a deletion or silently replace newer notes", async () => {
    global.indexedDB = model(new Map([["account", base()]]));
    const stale = await storage.loadLibrarySnapshot("account");
    let revision = await storage.saveLibrary(
      "account",
      { ...base(), items: [item("existing", "newer notes")] },
      0,
    );
    await assert.rejects(
      storage.saveLibrary(
        "account",
        { ...base(), items: [item("existing", "old draft")] },
        stale.revision,
      ),
      storage.LibraryConflictError,
    );
    assert.equal(
      (await storage.loadLibrary("account")).items[0].notes,
      "newer notes",
    );
    await storage.saveLibrary("account", empty(), revision);
    await assert.rejects(
      storage.saveLibrary("account", stale.data, revision),
      storage.LibraryConflictError,
    );
    assert.equal((await storage.loadLibrary("account")).items.length, 0);
  });
  await test("Sequential saves use returned revisions and accounts remain independent", async () => {
    global.indexedDB = model();
    assert.equal(await storage.saveLibrary("A", base(), 0), 1);
    assert.equal(
      await storage.saveLibrary(
        "A",
        { ...base(), spaces: [{ id: "s", name: "Math", color: "blue" }] },
        1,
      ),
      2,
    );
    assert.equal(await storage.saveLibrary("B", empty(), 0), 1);
    assert.equal((await storage.loadLibrarySnapshot("A")).revision, 2);
    assert.equal((await storage.loadLibrary("B")).items.length, 0);
    assert.deepEqual(
      storage.importLibrary(
        storage.exportLibrary((await storage.loadLibrarySnapshot("A")).data),
      ).spaces,
      [{ id: "s", name: "Math", color: "blue" }],
    );
  });
  await test("Failed revision write rolls back the entire library write", async () => {
    const db = model(new Map([["account", base()]]));
    global.indexedDB = db;
    db.failStore = "revisions";
    await assert.rejects(
      storage.saveLibrary("account", empty(), 0),
      /QuotaExceededError/,
    );
    const latest = await storage.loadLibrarySnapshot("account");
    assert.equal(latest.revision, 0);
    assert.equal(latest.data.items.length, 1);
    assert.ok(
      db.scopes
        .filter((x) => x.mode === "readwrite")
        .every(
          (x) => x.names.includes("libraries") && x.names.includes("revisions"),
        ),
    );
  });
  await test("Missing/invalid revision cannot blind-write, and conflicts do not mutate drafts", async () => {
    global.indexedDB = model(new Map([["account", base()]]));
    for (const invalid of [undefined, -1, 0.5, NaN, Number.MAX_SAFE_INTEGER])
      await assert.rejects(
        storage.saveLibrary("account", empty(), invalid),
        /INVALID_LIBRARY_REVISION/,
      );
    const draft = { ...base(), items: [item("private-draft")] },
      before = structuredClone(draft);
    await storage.saveLibrary("account", empty(), 0);
    await assert.rejects(
      storage.saveLibrary("account", draft, 0),
      storage.LibraryConflictError,
    );
    assert.deepEqual(draft, before);
    assert.equal((await storage.loadLibrary("account")).items.length, 0);
  });
  await test("A stale UI callback keeps its old revision after peer refresh and cannot overwrite new data", async () => {
    global.indexedDB = model(new Map([["account", base()]]));
    const original = await storage.loadLibrarySnapshot("account"),
      env = workspaceEnvironment(original.data, original.revision);
    const staleCommit = workspaceFunction("commit", env);
    await storage.saveLibrary(
      "account",
      { ...base(), items: [item("new-math"), ...base().items] },
      0,
    );
    const peer = await storage.loadLibrarySnapshot("account");
    env.revision.current = peer.revision;
    env.currentData.current = peer.data;
    env.snapshotRevisions.current.set(peer.data, peer.revision);
    env.data = peer.data;
    staleCommit({
      ...original.data,
      items: [item("existing", "late AI output")],
    });
    await env.saveQueue.current;
    assert.equal(env.conflict, true);
    assert.equal(env.status, "error");
    assert.equal(env.pending.current, true);
    assert.equal(
      (await storage.loadLibrary("account")).items[0].id,
      "new-math",
    );
    assert.equal(env.currentData.current.items[0].notes, "late AI output");
  });
  await test("Fast sequential UI edits bind optimistic revisions and save in order", async () => {
    global.indexedDB = model(new Map([["account", base()]]));
    const loaded = await storage.loadLibrarySnapshot("account"),
      env = workspaceEnvironment(loaded.data, loaded.revision);
    const first = { ...env.data, items: [item("existing", "first edit")] };
    workspaceFunction("commit", env)(first);
    const second = {
      ...first,
      items: [{ ...first.items[0], notes: "second edit" }],
    };
    workspaceFunction("commit", env)(second);
    await env.saveQueue.current;
    assert.equal(env.conflict, false);
    assert.equal(env.status, "saved");
    assert.equal(env.pending.current, false);
    const saved = await storage.loadLibrarySnapshot("account");
    assert.equal(saved.revision, 2);
    assert.equal(saved.data.items[0].notes, "second edit");
  });
  await test("Loading the saved version retains the conflicted draft and refuses to discard an earlier retained draft", async () => {
    global.indexedDB = model(new Map([["account", base()]]));
    await storage.saveLibrary(
      "account",
      { ...base(), items: [item("remote", "saved notes")] },
      0,
    );
    const draft = { ...base(), items: [item("draft", "unsaved notes")] },
      env = workspaceEnvironment(draft);
    env.blocked.current = true;
    env.pending.current = true;
    env.conflict = true;
    const recover = workspaceFunction("recoverLibrary", env);
    await recover();
    assert.equal(env.retainedDraft.current, draft);
    assert.equal(env.retained, draft);
    assert.equal(env.currentData.current.items[0].id, "remote");
    assert.equal(env.revision.current, 1);
    assert.equal(env.snapshotRevisions.current.get(env.currentData.current), 1);
    assert.equal(env.blocked.current, false);
    await recover();
    assert.equal(env.retainedDraft.current, draft);
    assert.equal(env.toast, env.conflictCopy.resolve);
  });
  console.log(
    `${count} library concurrency checks passed (transaction model; browser QA also required).`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
