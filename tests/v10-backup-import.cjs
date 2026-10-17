// Actual Workspace import/commit callbacks + actual storage codecs in the existing
// asynchronous IndexedDB transaction model. No live account, database, or provider.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name.startsWith(".")
        ? load(
            path.relative(root, path.resolve(path.dirname(file), name + ".ts")),
          )
        : require(name),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const storage = load("lib/lumio/storage.ts"),
  { parseLearning, emptyLearning, learningKey } = load(
    "lib/lumio/learning-engine.ts",
  ),
  { parsePreferences, emptyPreferences, preferenceKey } = load(
    "lib/lumio/recommendations.ts",
  );
function parse(source, filename = "app.tsx") {
  return ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}
function find(source, predicate) {
  const file = parse(source);
  let result;
  function visit(node) {
    if (predicate(node, file)) result = node;
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(result, "actual implementation node exists");
  return { node: result, file };
}
// Reuse the regression suite's transaction model rather than creating another DB model.
const concurrencySource = fs.readFileSync(
    path.join(root, "tests/library-concurrency.cjs"),
    "utf8",
  ),
  modelNode = find(
    concurrencySource,
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === "model",
  ),
  model = new Function(
    "assert",
    modelNode.node.getText(modelNode.file) + ";return model;",
  )(assert),
  envNode = find(
    concurrencySource,
    (n) =>
      ts.isFunctionDeclaration(n) && n.name?.text === "workspaceEnvironment",
  ),
  workspaceEnvironment = new Function(
    "storage",
    envNode.node.getText(envNode.file) + ";return workspaceEnvironment;",
  )(storage);
function callback(name, source, env) {
  const { node, file } = find(source, (n) =>
    name === "commit"
      ? ts.isVariableDeclaration(n) && n.name.getText() === name
      : ts.isFunctionDeclaration(n) && n.name?.text === name,
  );
  const expression =
    name === "commit"
      ? node.initializer.arguments[0].getText(file)
      : node.getText(file);
  const code = ts.transpileModule(
    name === "commit" ? `const commit=${expression};` : expression,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  return new Function(...Object.keys(env), code + `;return ${name};`)(
    ...Object.values(env),
  );
}
const item = (id) => ({
    id,
    title: id,
    kind: "text",
    spaceId: "",
    text: "Synthetic source.",
    notes: "",
    createdAt: "2026-10-17T00:00:00Z",
    updatedAt: "2026-10-17T00:00:00Z",
    cards: [],
    questions: [],
    attempts: [],
    favorite: false,
  }),
  library = (id = "original") => ({
    version: 1,
    items: [item(id)],
    spaces: [],
  });
function study(label) {
  return parseLearning({
    ...emptyLearning(),
    tasks: [
      {
        id: label,
        title: label,
        date: "2026-10-17",
        minutes: 20,
        itemId: "",
        done: false,
        createdAt: "2026-10-17T00:00:00Z",
      },
    ],
  });
}
const incoming = () => ({
  ...library("imported"),
  learning: study("imported-task"),
  personalization: { ...emptyPreferences(), enabled: false },
});
let backing, writeFault, readFault, writes;
global.localStorage = {
  getItem(key) {
    if (readFault?.(key)) throw Error("SecurityError");
    return backing.get(key) ?? null;
  },
  setItem(key, value) {
    writes.push(key);
    if (writeFault?.(key, String(value))) throw Error("QuotaExceededError");
    backing.set(key, String(value));
  },
  removeItem(key) {
    backing.delete(key);
  },
};
async function fixture(source) {
  backing = new Map();
  writeFault = null;
  readFault = null;
  writes = [];
  const original = library(),
    db = model(new Map([["account", original]]));
  global.indexedDB = db;
  const saved = await storage.loadLibrarySnapshot("account"),
    env = workspaceEnvironment(saved.data, saved.revision);
  Object.assign(env, {
    learningKey,
    preferenceKey,
    parseLearning,
    parsePreferences,
    emptyLearning,
    emptyPreferences,
    importLibrary: storage.importLibrary,
    localStorage,
    t: { importConfirm: "Replace?", invalidBackup: "Invalid file" },
    importInput: { current: { value: "selected" } },
    importingBackup: { current: false },
    backupSelection: { current: 0 },
    backupImportCopy: {
      en: {
        saving: "SAVING",
        saved: "SAVED",
        changed: "CHANGED",
        failed: "FAILED",
        partial: "PARTIAL",
      },
    },
    locale: "en",
    notice: null,
    importing: false,
    confirmations: [],
    navigations: [],
  });
  env.learning = {
    state: study("original-task"),
    ready: true,
    error: "",
    writes: 0,
    update(value) {
      this.writes++;
      try {
        localStorage.setItem(
          learningKey(env.profile.account),
          JSON.stringify(value),
        );
        this.state = value;
      } catch {
        this.error = "write";
      }
    },
  };
  env.personalization = {
    state: emptyPreferences(),
    error: false,
    writes: 0,
    update(value) {
      this.writes++;
      try {
        localStorage.setItem(
          preferenceKey(env.profile.account),
          JSON.stringify(value),
        );
        this.state = value;
      } catch {
        this.error = true;
      }
    },
  };
  env.syncLocalSnapshot = {
    current: {
      account: env.profile.account,
      learning: env.learning.state,
      preferences: env.personalization.state,
    },
  };
  env.setConfirm = (value) => {
    env.confirmations.push(value);
    env.confirm = value;
  };
  env.setBackupImportNotice = (value) => {
    env.notice = value;
  };
  env.setImportingBackup = (value) => {
    env.importing = value;
  };
  env.go = (value) => env.navigations.push(value);
  env.saveLibrary = async (...args) => {
    const savedRevision = await storage.saveLibrary(...args);
    env.afterLibraryAck?.(env);
    return savedRevision;
  };
  backing.set(learningKey("account"), JSON.stringify(env.learning.state));
  backing.set(
    preferenceKey("account"),
    JSON.stringify(env.personalization.state),
  );
  env.commit = callback("commit", source, env);
  const importFile = callback("importFile", source, env);
  return {
    env,
    db,
    importFile,
    async choose(value = incoming(), read) {
      await importFile({
        size: 1000,
        text: read || (async () => JSON.stringify(value)),
      });
      return env.confirm;
    },
    snapshot: () => storage.loadLibrarySnapshot("account"),
  };
}
const currentSource = fs.readFileSync(
  path.join(root, "components/lumio/app.tsx"),
  "utf8",
);
let passed = 0;
async function test(name, action) {
  await action();
  passed++;
  console.log("PASS " + name);
}
async function main() {
  if (process.argv.includes("--prove-before")) {
    const source = cp.execFileSync(
        "git",
        ["show", "f1ac9c2:components/lumio/app.tsx"],
        { cwd: root, encoding: "utf8" },
      ),
      f = await fixture(source),
      beforeLearning = backing.get(learningKey("account")),
      beforePreferences = backing.get(preferenceKey("account"));
    f.db.failStore = "revisions";
    const confirm = await f.choose();
    confirm.action();
    assert.notEqual(backing.get(learningKey("account")), beforeLearning);
    assert.notEqual(backing.get(preferenceKey("account")), beforePreferences);
    await f.env.saveQueue.current;
    assert.equal((await f.snapshot()).data.items[0].id, "original");
    assert.equal(f.env.status, "error");
    assert.equal(f.env.navigations.at(-1), "library");
    console.log(
      JSON.stringify({
        status: "REPRODUCED",
        source: "f1ac9c2",
        defect:
          "IndexedDB rollback leaves original library with imported study stores and premature navigation",
        scope:
          "actual extracted import/commit callbacks, asynchronous transaction model; not browser/device evidence",
      }),
    );
    return;
  }
  await test("Progress/preferences wait for the actual asynchronous library transaction ACK", async () => {
    const f = await fixture(currentSource),
      confirm = await f.choose();
    const work = confirm.action();
    assert.equal(f.env.learning.writes, 0);
    assert.equal(f.env.personalization.writes, 0);
    assert.equal(f.env.importing, true);
    assert.equal(f.env.notice.phase, "saving");
    await work;
    assert.equal((await f.snapshot()).data.items[0].id, "imported");
    assert.equal((await f.snapshot()).revision, 1);
    assert.equal(f.env.learning.writes, 1);
    assert.equal(f.env.personalization.writes, 1);
    assert.equal(f.env.notice.phase, "saved");
    assert.deepEqual(f.env.navigations, ["library"]);
    assert.equal(f.env.importing, false);
  });
  await test("Failed IndexedDB revision write rolls back library and never replaces study stores", async () => {
    const f = await fixture(currentSource),
      confirm = await f.choose(),
      before = new Map(backing);
    f.db.failStore = "revisions";
    await confirm.action();
    assert.equal((await f.snapshot()).data.items[0].id, "original");
    assert.equal((await f.snapshot()).revision, 0);
    assert.deepEqual(backing, before);
    assert.equal(f.env.learning.writes + f.env.personalization.writes, 0);
    assert.equal(f.env.notice.phase, "failed");
    assert.deepEqual(f.env.navigations, []);
  });
  await test("A peer's newer IndexedDB revision causes a conflict without touching either study store", async () => {
    const f = await fixture(currentSource),
      confirm = await f.choose(),
      before = new Map(backing);
    await storage.saveLibrary("account", library("peer"), 0);
    await confirm.action();
    assert.equal((await f.snapshot()).data.items[0].id, "peer");
    assert.deepEqual(backing, before);
    assert.equal(f.env.conflict, true);
    assert.equal(f.env.notice.phase, "failed");
    assert.deepEqual(f.env.navigations, []);
  });
  await test("The confirmation stays bound to the selected library snapshot instead of a newer render", async () => {
    const f = await fixture(currentSource),
      confirm = await f.choose();
    f.env.currentData.current = library("new-render");
    await confirm.action();
    assert.equal((await f.snapshot()).revision, 0);
    assert.equal(f.env.notice.message, "CHANGED");
    assert.equal(f.env.learning.writes + f.env.personalization.writes, 0);
  });
  for (const section of ["learning", "preferences"]) {
    await test(`A ${section} edit before confirmation cancels import before the library write`, async () => {
      const f = await fixture(currentSource),
        confirm = await f.choose();
      const next =
        section === "learning"
          ? study("newer-task")
          : { ...emptyPreferences(), enabled: false };
      backing.set(
        section === "learning"
          ? learningKey("account")
          : preferenceKey("account"),
        JSON.stringify(next),
      );
      f.env.syncLocalSnapshot.current[section] = next;
      await confirm.action();
      assert.equal((await f.snapshot()).revision, 0);
      assert.equal(f.env.notice.message, "CHANGED");
      assert.equal(f.env.learning.writes + f.env.personalization.writes, 0);
    });
    await test(`A ${section} edit during IndexedDB ACK is preserved with an explicit partial result`, async () => {
      const f = await fixture(currentSource),
        confirm = await f.choose();
      const next =
        section === "learning"
          ? study("newer-task")
          : { ...emptyPreferences(), enabled: false, studyMinutes: 25 };
      f.env.afterLibraryAck = () => {
        backing.set(
          section === "learning"
            ? learningKey("account")
            : preferenceKey("account"),
          JSON.stringify(next),
        );
        f.env.syncLocalSnapshot.current[section] = next;
      };
      await confirm.action();
      assert.equal((await f.snapshot()).data.items[0].id, "imported");
      assert.equal(f.env.learning.writes + f.env.personalization.writes, 0);
      assert.equal(
        backing.get(
          section === "learning"
            ? learningKey("account")
            : preferenceKey("account"),
        ),
        JSON.stringify(next),
      );
      assert.equal(f.env.notice.phase, "partial");
      assert.deepEqual(f.env.navigations, []);
    });
  }
  await test("An unmounted file read cannot open a confirmation or write any store", async () => {
    const f = await fixture(currentSource);
    await f.choose(incoming(), async () => {
      f.env.mounted.current = false;
      return JSON.stringify(incoming());
    });
    assert.equal(f.env.confirm, undefined);
    assert.equal((await f.snapshot()).revision, 0);
    assert.equal(f.env.learning.writes + f.env.personalization.writes, 0);
  });
  await test("An unmount while the library commit is pending prevents study writes and navigation", async () => {
    const f = await fixture(currentSource),
      confirm = await f.choose();
    f.env.afterLibraryAck = () => {
      f.env.mounted.current = false;
    };
    await confirm.action();
    assert.equal((await f.snapshot()).data.items[0].id, "imported");
    assert.equal(f.env.learning.writes + f.env.personalization.writes, 0);
    assert.deepEqual(f.env.navigations, []);
    assert.equal(f.env.importingBackup.current, false);
  });
  await test("Account switch during a slow file read discards the old account's selection", async () => {
    const f = await fixture(currentSource);
    await f.choose(incoming(), async () => {
      f.env.syncLocalSnapshot.current.account = "other";
      return JSON.stringify(incoming());
    });
    assert.equal(f.env.confirm, undefined);
    assert.equal((await f.snapshot()).revision, 0);
    assert.equal(f.env.learning.writes + f.env.personalization.writes, 0);
    assert.equal(backing.has(learningKey("other")), false);
  });
  await test("Account switch during the library ACK cannot write either account's study namespace", async () => {
    const f = await fixture(currentSource),
      confirm = await f.choose(),
      before = new Map(backing);
    f.env.afterLibraryAck = () => {
      f.env.syncLocalSnapshot.current.account = "other";
    };
    await confirm.action();
    assert.equal((await f.snapshot()).data.items[0].id, "imported");
    assert.deepEqual(backing, before);
    assert.equal(f.env.learning.writes + f.env.personalization.writes, 0);
    assert.deepEqual(f.env.navigations, []);
  });
  await test("Learning quota failure stops preferences and exposes the acknowledged library as partial", async () => {
    const f = await fixture(currentSource),
      confirm = await f.choose(),
      before = new Map(backing);
    writeFault = (key) => key === learningKey("account");
    await confirm.action();
    assert.equal((await f.snapshot()).data.items[0].id, "imported");
    assert.deepEqual(backing, before);
    assert.equal(f.env.personalization.writes, 0);
    assert.equal(f.env.notice.phase, "partial");
    assert.deepEqual(f.env.navigations, []);
  });
  await test("Preferences quota failure reports partial restoration without pretending to roll back other stores", async () => {
    const f = await fixture(currentSource),
      value = incoming(),
      confirm = await f.choose(value),
      beforePreferences = backing.get(preferenceKey("account"));
    writeFault = (key) => key === preferenceKey("account");
    await confirm.action();
    assert.equal((await f.snapshot()).data.items[0].id, "imported");
    assert.deepEqual(
      JSON.parse(backing.get(learningKey("account"))),
      value.learning,
    );
    assert.equal(backing.get(preferenceKey("account")), beforePreferences);
    assert.equal(f.env.notice.phase, "partial");
    assert.deepEqual(f.env.navigations, []);
  });
  await test("A preference edit triggered during the learning write is preserved before the second store", async () => {
    const f = await fixture(currentSource),
      value = incoming(),
      confirm = await f.choose(value),
      next = { ...emptyPreferences(), enabled: true, studyMinutes: 35 },
      update = f.env.learning.update;
    f.env.learning.update = function (v) {
      update.call(this, v);
      backing.set(preferenceKey("account"), JSON.stringify(next));
      f.env.syncLocalSnapshot.current.preferences = next;
    };
    await confirm.action();
    assert.equal((await f.snapshot()).data.items[0].id, "imported");
    assert.equal(f.env.personalization.writes, 0);
    assert.equal(backing.get(preferenceKey("account")), JSON.stringify(next));
    assert.equal(f.env.notice.phase, "partial");
  });
  await test("Library-only version-1 backups remain importable when localStorage is blocked", async () => {
    const f = await fixture(currentSource),
      before = new Map(backing);
    readFault = () => true;
    const confirm = await f.choose(library("legacy"));
    await confirm.action();
    assert.equal((await f.snapshot()).data.items[0].id, "legacy");
    assert.deepEqual(backing, before);
    assert.equal(f.env.learning.writes + f.env.personalization.writes, 0);
    assert.equal(f.env.notice.phase, "saved");
  });
  await test("Blocked study storage prevents a combined import instead of labeling valid JSON as corrupt", async () => {
    const f = await fixture(currentSource);
    readFault = () => true;
    await f.choose();
    assert.equal(f.env.confirm, undefined);
    assert.equal((await f.snapshot()).revision, 0);
    assert.equal(f.env.notice.phase, "failed");
    assert.equal(f.env.toast, "");
  });
  await test("A superseded slow file read cannot replace a newer selection's confirmation", async () => {
    const f = await fixture(currentSource);
    let finish;
    const first = f.choose(
      library("old-selection"),
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const confirm = await f.choose(library("new-selection"));
    finish(JSON.stringify(library("old-selection")));
    await first;
    assert.equal(f.env.confirm, confirm);
    await confirm.action();
    assert.equal((await f.snapshot()).data.items[0].id, "new-selection");
  });
  await test("Invalid or oversized files never open confirmation and keep every store unchanged", async () => {
    const f = await fixture(currentSource),
      before = new Map(backing);
    await f.importFile({ size: 10, text: async () => "{invalid" });
    assert.equal(f.env.toast, "Invalid file");
    await f.importFile({
      size: 20 * 1024 * 1024 + 1,
      text: async () => {
        throw Error("must not read");
      },
    });
    assert.equal(f.env.confirm, undefined);
    assert.equal((await f.snapshot()).revision, 0);
    assert.deepEqual(backing, before);
  });
  await test("Double confirmation while the first transaction is pending creates one revision and one study restore", async () => {
    const f = await fixture(currentSource),
      confirm = await f.choose();
    await Promise.all([confirm.action(), confirm.action()]);
    assert.equal((await f.snapshot()).revision, 1);
    assert.equal(f.env.learning.writes, 1);
    assert.equal(f.env.personalization.writes, 1);
    assert.deepEqual(f.env.navigations, ["library"]);
  });
  await test("An unloaded or revisionless library cannot be replaced by the import callback", async () => {
    for (const missing of ["loaded", "revision"]) {
      const f = await fixture(currentSource);
      if (missing === "loaded") f.env.loaded.current = false;
      else f.env.snapshotRevisions.current.delete(f.env.currentData.current);
      await f.choose();
      assert.equal(f.env.confirm, undefined);
      assert.equal((await f.snapshot()).revision, 0);
      assert.equal(f.env.notice.message, "CHANGED");
    }
  });
  await test("Storage removal during the library ACK is preserved without resurrecting deleted progress", async () => {
    const f = await fixture(currentSource),
      confirm = await f.choose();
    f.env.afterLibraryAck = () => backing.delete(learningKey("account"));
    await confirm.action();
    assert.equal(backing.has(learningKey("account")), false);
    assert.equal(f.env.learning.writes + f.env.personalization.writes, 0);
    assert.equal(f.env.notice.phase, "partial");
  });
  await test("Actual UI keeps failures/partial results visible as alerts and disables repeat import while saving", async () => {
    const file = parse(currentSource);
    let notice, importButton;
    function visit(n) {
      if (
        ts.isJsxElement(n) &&
        n.openingElement.tagName.getText(file) === "section" &&
        n.openingElement.attributes.properties.some(
          (a) =>
            ts.isJsxAttribute(a) &&
            a.name.getText(file) === "aria-busy" &&
            a.initializer?.getText(file).includes("isImportingBackup"),
        )
      )
        notice = n;
      if (
        ts.isJsxElement(n) &&
        n.openingElement.tagName.getText(file) === "button" &&
        n.openingElement.attributes.properties.some(
          (a) =>
            ts.isJsxAttribute(a) &&
            a.name.getText(file) === "onClick" &&
            a.initializer?.getText(file).includes("importInput.current?.click"),
        )
      )
        importButton = n;
      ts.forEachChild(n, visit);
    }
    visit(file);
    assert.ok(notice?.getText(file).includes('"alert"'));
    assert.ok(notice?.getText(file).includes('"status"'));
    assert.ok(
      importButton?.getText(file).includes("disabled={isImportingBackup}"),
    );
    const { backupImportCopy: copy } = load("lib/lumio/backup-import-copy.ts");
    assert.deepEqual(Object.keys(copy).sort(), [
      "en",
      "ja",
      "ko",
      "vi",
      "zh-CN",
    ]);
    for (const messages of Object.values(copy))
      for (const key of ["saving", "saved", "changed", "failed", "partial"])
        assert.ok(
            typeof messages[key] === "string" && messages[key].length > 5,
        );
  });
  console.log(
    JSON.stringify({
      status: "PASS",
      passed,
      scope:
        "actual callbacks and asynchronous IndexedDB transaction model; not browser/device evidence",
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
