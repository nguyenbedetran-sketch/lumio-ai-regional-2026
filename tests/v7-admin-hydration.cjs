// Actual AdminConsole SSR + React hydration, synthetic snapshot only. No HTTP AI/auth calls.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  { spawnSync } = require("node:child_process"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  folder = path.join(root, "work/v7-admin-hydration");
const snapshot = {
  actor: {
    id: "qa-admin",
    accountKey: "qa-account",
    name: "QUẢN TRỊ KIỂM THỬ",
    role: "SUPER_ADMIN",
  },
  permissions: ["admin.read"],
  users: [],
  usage: [],
  audit: [],
  flags: [],
  dashboard: {
    users: { total: 1, active: 1, disabled: 0, new: 1 },
    usage: {
      requests: 0,
      errors: 0,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      averageLatencyMs: null,
      tokenRecords: 0,
      costRecords: 0,
    },
    days: Array.from({ length: 14 }, (_, i) => ({
      day: `2026-10-${String(i + 3).padStart(2, "0")}`,
      requests: 0,
      errors: 0,
    })),
    generatedAt: "2026-10-16T05:38:55.000Z",
    storage: "SQLite · một máy chủ",
    auditCount: 0,
  },
};
function load(filename, cache = new Map()) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const m = { exports: {} };
  cache.set(filename, m);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", output)(
    (name) => {
      if (name === "next-auth/react") return { signIn: async () => undefined };
      if (!name.startsWith(".")) return require(name);
      const base = path.resolve(path.dirname(filename), name);
      return load(
        [base, base + ".ts", base + ".tsx", base + ".js"].find(
          (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
        ),
        cache,
      );
    },
    m,
    m.exports,
  );
  return m.exports;
}
if (process.argv.includes("--render")) {
  const React = require("react"),
    { renderToString } = require("react-dom/server"),
    { AdminConsole } = load(path.join(root, "components/admin/console.tsx"));
  process.stdout.write(
    renderToString(React.createElement(AdminConsole, { initial: snapshot })),
  );
  return;
}
fs.mkdirSync(folder, { recursive: true });
const render = (zone) => {
  const r = spawnSync(process.execPath, [__filename, "--render"], {
    cwd: root,
    env: { ...process.env, TZ: zone },
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (r.status !== 0) throw Error(r.stderr || "SSR_CHILD_FAILED");
  return r.stdout;
};
const zones = ["UTC", "Asia/Ho_Chi_Minh", "America/New_York", "Asia/Tokyo"],
  html = zones.map(render),
  clock = (markup) =>
    markup
      .match(/class="ad-updated"[^>]*>([\s\S]*?)<\/span>/)?.[1]
      .replace(/<[^>]*>/g, "")
      .trim();
const clocks = zones.map((zone, i) => ({
  zone,
  text: clock(html[i]),
  htmlSha256: crypto.createHash("sha256").update(html[i]).digest("hex"),
}));
if (process.argv.includes("--reproduce")) {
  assert.notEqual(
    html[0],
    html[1],
    "Baseline must reproduce actual AdminConsole text mismatch across server/client time zones",
  );
  const proof = {
    status: "REPRODUCED",
    scope:
      "Actual AdminConsole renderToString; same synthetic snapshot; process timezone differs only; no browser/provider",
    checkedAt: new Date().toISOString(),
    clocks,
  };
  fs.writeFileSync(
    path.join(folder, "before-fix.json"),
    JSON.stringify(proof, null, 2) + "\n",
  );
  console.log(JSON.stringify(proof));
  return;
}
const checks = [];
const check = (name, ok) => {
  assert.ok(ok, name);
  checks.push({ name, status: "PASS" });
};
for (let i = 1; i < zones.length; i++)
  check(
    `Actual AdminConsole SSR is identical in UTC and ${zones[i]}`,
    html[0] === html[i],
  );
check(
  "Timestamp preserves Vietnamese UTC+7 display rather than hiding the mismatch",
  clocks[0].text.includes("12:38"),
);
check(
  "Actual SVG title remains one deterministic text node",
  html[0].includes("<title>2026-10-03: 0 yêu cầu, 0 lỗi</title>"),
);
if (process.argv.includes("--ssr-only")) {
  // CI does not need a browser; preserve the separate 14-check hydration artifact.
  console.log(
    JSON.stringify({
      status: "PASS",
      mode: "ssr-only",
      passed: checks.length,
      checks,
    }),
  );
  return;
}
const modules = [],
  ids = new Map();
function bundle(filename) {
  if (ids.has(filename)) return ids.get(filename);
  const id = modules.length;
  ids.set(filename, id);
  modules.push("");
  let source = fs.readFileSync(filename, "utf8");
  if (/\.tsx?$/.test(filename))
    source = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
  source = source.replace(/require\((["'])([^"']+)\1\)/g, (_all, _q, name) => {
    if (name === "next-auth/react") return "({signIn:async()=>undefined})";
    let target;
    if (name.startsWith(".")) {
      const base = path.resolve(path.dirname(filename), name);
      target = [base, base + ".ts", base + ".tsx", base + ".js"].find(
        (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
      );
    } else target = require.resolve(name, { paths: [path.dirname(filename)] });
    if (!target) throw Error("FIXTURE_MODULE_MISSING:" + name);
    return `__require(${bundle(target)})`;
  });
  modules[id] = `function(module,exports,__require){${source}\n}`;
  return id;
}
const react = bundle(require.resolve("react")),
  client = bundle(require.resolve("react-dom/client")),
  admin = bundle(path.join(root, "components/admin/console.tsx"));
fs.writeFileSync(
  path.join(folder, "fixture.js"),
  `(()=>{const process={env:{NODE_ENV:'production'}},modules=[${modules.join(",")}],cache={};function __require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,__require);return m.exports;}const React=__require(${react}),{hydrateRoot}=__require(${client}),{AdminConsole}=__require(${admin}),initial=${JSON.stringify(snapshot)};window.__hydrationErrors=[];function App(){React.useEffect(()=>{window.__hydrationDone=true},[]);return React.createElement(AdminConsole,{initial});}hydrateRoot(document.getElementById('root'),React.createElement(App),{onRecoverableError:error=>window.__hydrationErrors.push(error.message)});})();`,
);
fs.writeFileSync(
  path.join(folder, "fixture.html"),
  `<!doctype html><html lang="vi"><meta charset="utf-8"><title>Admin hydration · synthetic verification</title><body><p>KIỂM THỬ · Snapshot tổng hợp · Không phải dữ liệu quản trị thật</p><div id="root">${html[0]}</div><script src="/fixture.js"></script></body></html>`,
);
const browserSource = `async(page)=>{const results=[];for(const timezoneId of ${JSON.stringify(zones.slice(1))}){const context=await page.context().browser().newContext({timezoneId,locale:'vi-VN'});try{const tab=await context.newPage(),errors=[];tab.on('pageerror',e=>errors.push(e.message));await tab.route('**/*',route=>{const url=route.request().url();if(url.endsWith('/fixture.js'))return route.fulfill({path:'work/v7-admin-hydration/fixture.js',contentType:'text/javascript'});if(url.endsWith('/fixture'))return route.fulfill({path:'work/v7-admin-hydration/fixture.html',contentType:'text/html'});return route.abort();});await tab.goto('http://localhost:3000/fixture');await tab.waitForFunction(()=>window.__hydrationDone===true);await tab.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));results.push({timezoneId,errors,recoverable:await tab.evaluate(()=>window.__hydrationErrors),clock:await tab.locator('.ad-updated').textContent()});}finally{await context.close();}}return results;}`;
fs.writeFileSync(path.join(folder, "browser.js"), browserSource);
const cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js"),
  session = `lumio-admin-hydration-${process.pid}`;
function call(...args) {
  const r = spawnSync(
    process.execPath,
    [cli, `-s=${session}`, ...args, "--json"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (r.error || r.status !== 0) throw r.error || Error(r.stdout || r.stderr);
  const value = JSON.parse(r.stdout);
  if (value.isError || value.error) throw Error(JSON.stringify(value));
  return value;
}
try {
  call("open", "about:blank", "--browser=msedge");
  const r = call("run-code", "--filename=work/v7-admin-hydration/browser.js"),
    browser = typeof r.result === "string" ? JSON.parse(r.result) : r.result;
  assert.equal(browser.length, 3);
  for (const result of browser) {
    check(
      `React hydrateRoot has no recoverable mismatch in ${result.timezoneId}`,
      result.recoverable.length === 0,
    );
    check(
      `Actual AdminConsole hydrates without browser errors in ${result.timezoneId}`,
      result.errors.length === 0,
    );
    check(
      `Hydrated clock equals server output in ${result.timezoneId}`,
      result.clock.trim() === clocks[0].text,
    );
  }
  const report = {
    status: "PASS",
    passed: checks.length,
    checkedAt: new Date().toISOString(),
    scope:
      "Actual AdminConsole renderToString under four process time zones and real Edge hydrateRoot under three client time zones; synthetic snapshot, all HTTP intercepted, zero provider calls. Public fix still requires redeployment/reverification.",
    sourceSha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(root, "components/admin/console.tsx")))
      .digest("hex"),
    clocks,
    browser,
    checks,
  };
  fs.mkdirSync(path.join(root, "docs/v7/reports"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "docs/v7/reports/admin-hydration.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  try {
    call("close");
  } catch {}
}
