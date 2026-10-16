const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  React = require("react"),
  { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, ".."),
  checks = [];
function loader(mocks = {}, onLoad = () => {}) {
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(root, relative),
      key = path.relative(root, file).replaceAll("\\", "/");
    onLoad(key);
    if (Object.hasOwn(mocks, key)) return mocks[key];
    if (file.endsWith(".css")) return {};
    if (cache.has(file)) return cache.get(file).exports;
    const m = { exports: {} };
    cache.set(file, m);
    new Function(
      "require",
      "module",
      "exports",
      ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      }).outputText,
    )(
      (name) => {
        if (!name.startsWith(".")) return require(name);
        let next = path.resolve(path.dirname(file), name);
        if (!next.endsWith(".css"))
          next += fs.existsSync(next + ".tsx") ? ".tsx" : ".ts";
        return load(next);
      },
      m,
      m.exports,
    );
    return m.exports;
  }
  return load;
}
async function test(name, run) {
  await run();
  checks.push(name);
  console.log("PASS " + name);
}
function configFixture({
  mode = "local-sqlite",
  available = true,
  enabled = true,
  failOpen = false,
  desktop = false,
  demo = false,
} = {}) {
  let opens = 0,
    flags = 0;
  const platform = {
    getStore() {
      opens++;
      if (failOpen) throw Error("synthetic-private-database-error");
      return {
        databaseMode: mode,
        databaseAvailable: () => available,
        endpoint: "private-fixture-not-public",
      };
    },
    isFeatureEnabled() {
      flags++;
      return true;
    },
  };
  const load = loader({
    "lib/server/store.ts": platform,
    "lib/lumio/auth.ts": {
      providerStatus: () => ({ google: true, facebook: false }),
    },
    "lib/ai/router.ts": {
      aiStatus: () => ({ enabled, openai: true, gemini: true, xai: false }),
    },
    "lib/server/access.ts": {
      errorResponse: (e) =>
        Response.json(
          { error: e.code || "PLATFORM_UNAVAILABLE" },
          { status: e.status || 503 },
        ),
    },
    "lib/server/public-demo.ts": {
      demoAPIResponse: () =>
        demo ? Response.json({ publicDemo: true, ai: false }) : null,
    },
    "lib/server/competition-preview.ts": { isCompetitionPreview: () => true },
    "lib/server/desktop-mode.ts": {
      isDesktopPreview: () => desktop,
      desktopConfig: () => ({ desktop: true, ai: false }),
    },
  });
  return {
    route: load("app/api/config/route.ts"),
    opens: () => opens,
    flags: () => flags,
  };
}
async function main() {
  const load = loader(),
    helpers = load("lib/lumio/storage-status.ts");
  await test("Public metadata accepts only known modes with ready true and emits exactly two safe fields", () => {
    for (const mode of ["local-sqlite", "remote-libsql"]) {
      assert.deepEqual(helpers.safeStorageStatus(mode, true), {
        mode,
        ready: true,
      });
      assert.equal(helpers.safeStorageStatus(mode, false), undefined);
      assert.equal(helpers.safeStorageStatus(mode, "true"), undefined);
    }
    for (const mode of [
      undefined,
      null,
      "https://private.invalid",
      {},
      "REMOTE-LIBSQL",
    ])
      assert.equal(helpers.safeStorageStatus(mode, true), undefined);
  });
  await test("Configured mode parser does not treat invalid values as connected remote or inspect other environment fields", () => {
    for (const value of [undefined, "", "local-sqlite"])
      assert.equal(helpers.configuredStorageMode(value), "local-sqlite");
    assert.equal(
      helpers.configuredStorageMode("remote-libsql"),
      "remote-libsql",
    );
    for (const value of [null, {}, "invalid", " remote-libsql"])
      assert.equal(helpers.configuredStorageMode(value), "unknown");
    const source = fs.readFileSync(
      path.join(root, "lib/lumio/storage-status.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /process\.env|TURSO_DATABASE_URL|TURSO_AUTH_TOKEN|lib\/server/,
    );
  });
  for (const mode of ["local-sqlite", "remote-libsql"])
    await test(`Actual config handler emits ${mode} from opened store, never endpoint or connection credentials`, async () => {
      const f = configFixture({ mode }),
        response = f.route.GET(),
        body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(f.opens(), 1);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(body.storage, { mode, ready: true });
      assert.equal(body.capabilities.tutor, true);
      assert.doesNotMatch(
        JSON.stringify(body),
        /endpoint|token|private-fixture|TURSO|verifiedDurability/,
      );
    });
  await test("AI disabled still opens and checks database instead of short-circuiting readiness", async () => {
    const f = configFixture({ mode: "remote-libsql", enabled: false }),
      body = await f.route.GET().json();
    assert.equal(f.opens(), 1);
    assert.equal(f.flags(), 0);
    assert.equal(body.ai, false);
    assert.deepEqual(body.storage, { mode: "remote-libsql", ready: true });
  });
  for (const [name, input] of [
    ["open failure", { failOpen: true }],
    ["poisoned cached connection", { mode: "remote-libsql", available: false }],
    ["unknown actual mode", { mode: "unknown" }],
  ])
    await test(`Config ${name} returns safe 503 without ready metadata or raw error`, async () => {
      const f = configFixture(input),
        response = f.route.GET(),
        body = await response.json();
      assert.equal(response.status, 503);
      assert.equal(f.flags(), 0);
      assert.equal(body.storage, undefined);
      assert.doesNotMatch(JSON.stringify(body), /synthetic-private/);
    });
  await test("Desktop and public demo bypasses retain previous disabled mode without opening a server database", async () => {
    for (const input of [{ desktop: true }, { demo: true }]) {
      const f = configFixture({ ...input, failOpen: true }),
        body = await f.route.GET().json();
      assert.equal(f.opens(), 0);
      assert.equal(body.storage, undefined);
      assert.equal(body.ai, false);
    }
  });
  const Notice = load("components/lumio/preview-notice.tsx").PreviewNotice;
  for (const locale of ["vi", "en", "zh-CN", "ja", "ko"])
    await test(`Actual notice SSR retains local/default detail and shows separate remote storage disclosure in ${locale}`, () => {
      const { competitionCopy } = load("lib/lumio/competition-copy.ts");
      const render = (storage, kind = "competition") =>
        renderToStaticMarkup(
          React.createElement(Notice, { locale, kind, storage }),
        );
      const baseline = render(undefined),
        local = render({ mode: "local-sqlite", ready: true });
      assert.equal(baseline, local);
      assert.ok(local.includes(competitionCopy[locale].detail));
      const remote = render({ mode: "remote-libsql", ready: true }),
        copy = helpers.remoteStorageNotice(locale, {
          mode: "remote-libsql",
          ready: true,
        });
      assert.ok(remote.includes(copy.summary));
      assert.ok(remote.includes(copy.detail));
      assert.match(remote, /<details[^>]*data-competition-preview="true"/);
      assert.match(remote, /<summary>/);
      assert.doesNotMatch(remote, /<details[^>]* open/);
      assert.match(copy.detail, /200/);
      assert.match(copy.detail, /3/);
      assert.equal(render({ mode: "remote-libsql", ready: false }), baseline);
      assert.equal(
        render({ mode: "remote-libsql", ready: true }, "demo"),
        render(undefined, "demo"),
      );
    });
  await test("Remote English notice explicitly preserves opt-in browser separation and disclaims backup/SLA guarantees", () => {
    const copy = helpers.remoteStorageNotice("en", {
      mode: "remote-libsql",
      ready: true,
    });
    assert.match(copy.detail, /Browser materials remain separate/);
    assert.match(copy.detail, /do not automatically share data with AI/);
    assert.match(
      copy.detail,
      /No SLA, automatic backups or long-term storage are promised/,
    );
    assert.equal(
      helpers.remoteStorageNotice("en", { mode: "untrusted", ready: true }),
      undefined,
    );
  });
  const saved = process.env.LUMIO_DATABASE_MODE;
  try {
    let serverLoads = 0;
    const privacyLoad = loader({}, (key) => {
      if (key.startsWith("lib/server/")) {
        serverLoads++;
        throw Error("Privacy must not open server database");
      }
    });
    const Privacy = privacyLoad("app/privacy/page.tsx").default;
    const render = (mode) => {
      if (mode === undefined) delete process.env.LUMIO_DATABASE_MODE;
      else process.env.LUMIO_DATABASE_MODE = mode;
      return renderToStaticMarkup(React.createElement(Privacy));
    };
    await test("Privacy local default retains ephemeral-host warning without opening the database", () => {
      const html = render(undefined);
      assert.match(html, /Cấu hình hiện tại dùng SQLite/);
      assert.match(html, /cơ sở dữ liệu tạm có thể bị đặt lại/);
      assert.match(html, /7 ngày/);
      assert.match(html, /31 ngày/);
      assert.equal(serverLoads, 0);
    });
    await test("Privacy remote configuration is explicitly not connection, SLA or backup proof, with unchanged retention and external AI choice", () => {
      const html = render("remote-libsql");
      assert.match(html, /Cấu hình hiện tại chọn cơ sở dữ liệu từ xa/);
      assert.match(html, /không xác nhận kết nối đang hoạt động/);
      assert.match(html, /không đồng nghĩa tự xóa database riêng/);
      assert.match(html, /không tự gửi dữ liệu tới AI/);
      assert.match(html, /Bản đồng bộ có thời hạn 7 ngày/);
      assert.match(html, /tối đa 100 lượt hội thoại/);
      assert.match(html, /Nội dung đầu vào và kết quả\s+giữ tối đa 7 ngày/);
      assert.match(html, /không áp dụng thời hạn bảy ngày/);
      assert.match(html, /31 ngày/);
      assert.doesNotMatch(
        html,
        /cơ sở dữ liệu tạm|ngủ\/reset và mất hàng đợi|Preview có thể đặt lại/,
      );
      assert.equal(serverLoads, 0);
    });
    await test("Privacy invalid mode does not claim a remote connection or silently identify it as local SQLite", () => {
      const html = render("invalid");
      assert.match(html, /Chưa xác định được chế độ cơ sở dữ liệu/);
      assert.doesNotMatch(
        html,
        /Cấu hình hiện tại chọn cơ sở dữ liệu từ xa|Cấu hình hiện tại dùng SQLite/,
      );
      assert.equal(serverLoads, 0);
    });
  } finally {
    if (saved === undefined) delete process.env.LUMIO_DATABASE_MODE;
    else process.env.LUMIO_DATABASE_MODE = saved;
  }
  const report = {
    status: "PASS",
    passed: checks.length,
    checkedAt: new Date().toISOString(),
    scope:
      "Pure safe-metadata helpers, actual config handler with mocked store/auth/features boundaries, and actual React notice/privacy static SSR. No remote database/network/provider calls; no durability, live deployment or device proof.",
    checks,
  };
  fs.mkdirSync(path.join(root, "docs/v9"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "docs/v9/qa-storage-status.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
