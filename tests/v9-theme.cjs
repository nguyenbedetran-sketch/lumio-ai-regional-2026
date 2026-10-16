const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  vm = require("node:vm");
const root = path.resolve(__dirname, ".."),
  code = ts.transpileModule(
    fs.readFileSync(path.join(root, "lib/lumio/theme.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
function helpers(storage) {
  const m = { exports: {} };
  vm.runInNewContext(code, {
    module: m,
    exports: m.exports,
    localStorage: storage,
  });
  return m.exports;
}
const helper = helpers({ getItem: () => null }),
  checks = [];
const test = (name, f) => {
  f();
  checks.push(name);
  console.log("PASS " + name);
};
test("Only explicit light/dark/system preferences are accepted; absent/invalid values select system", () => {
  for (const v of ["light", "dark", "system"])
    assert.equal(helper.normalizeThemePreference(v), v);
  for (const v of [null, undefined, "", "invalid", "LIGHT", {}, "<script>"])
    assert.equal(helper.normalizeThemePreference(v), "system");
});
test("System resolution follows current media preference without replacing explicit choices", () => {
  assert.equal(helper.resolveTheme("system", true), "dark");
  assert.equal(helper.resolveTheme("system", false), "light");
  assert.equal(helper.resolveTheme("light", true), "light");
  assert.equal(helper.resolveTheme("dark", false), "dark");
});
test("Unreadable storage defaults to system and never throws", () =>
  assert.equal(
    helpers({
      getItem() {
        throw Error("denied");
      },
    }).readThemePreference(),
    "system",
  ));
test("Theme reader retains a supported explicit preference", () =>
  assert.equal(
    helpers({ getItem: () => "dark" }).readThemePreference(),
    "dark",
  ));
test("Constant bootstrap and helper resolution agree across stored values and both system schemes", () => {
  for (const stored of [null, "light", "dark", "system", "corrupt", "<script>"])
    for (const dark of [true, false]) {
      let writes = 0;
      const root = { dataset: { account: "unchanged" } };
      vm.runInNewContext(helper.themeBootstrapScript, {
        document: { documentElement: root },
        localStorage: {
          getItem: () => stored,
          setItem() {
            writes++;
          },
        },
        matchMedia: () => ({ matches: dark }),
      });
      assert.equal(
        root.dataset.theme,
        helper.resolveTheme(helper.normalizeThemePreference(stored), dark),
      );
      assert.equal(root.dataset.account, "unchanged");
      assert.equal(writes, 0);
    }
});
test("Blocked bootstrap storage still resolves system; unavailable media safely falls back to dark", () => {
  const root = { dataset: {} };
  vm.runInNewContext(helper.themeBootstrapScript, {
    document: { documentElement: root },
    localStorage: {
      getItem() {
        throw Error("denied");
      },
    },
    matchMedia: () => ({ matches: false }),
  });
  assert.equal(root.dataset.theme, "light");
  vm.runInNewContext(helper.themeBootstrapScript, {
    document: { documentElement: root },
    localStorage: {
      getItem() {
        throw Error("denied");
      },
    },
    matchMedia() {
      throw Error("unavailable");
    },
  });
  assert.equal(root.dataset.theme, "dark");
});
test("Actual Layout bootstrap is synchronous in head before body and suppression is root-only", () => {
  const { build } = require("./v9-theme-loading-fixture.cjs"),
    p = build();
  const html = fs.readFileSync(path.join(p.folder, "prepaint.html"), "utf8");
  assert.ok(html.indexOf('id="lumio-theme-bootstrap"') < html.indexOf("<body"));
  assert.match(html, /<script id="lumio-theme-bootstrap">/);
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
  assert.equal((layout.match(/suppressHydrationWarning/g) || []).length, 1);
  assert.match(layout, /<html lang="vi" suppressHydrationWarning>/);
});
const report = {
  status: "PASS",
  passed: checks.length,
  checks,
  checkedAt: new Date().toISOString(),
  scope:
    "Pure theme helper/constant bootstrap VM plus actual Layout+Skeleton static SSR, no browser/provider/accounts",
};
fs.mkdirSync(path.join(root, "docs/v9"), { recursive: true });
fs.writeFileSync(
  path.join(root, "docs/v9/qa-theme-unit.json"),
  JSON.stringify(report, null, 2) + "\n",
);
