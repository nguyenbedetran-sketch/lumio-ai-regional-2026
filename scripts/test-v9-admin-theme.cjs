// Actual AdminConsole/AdminGate and current application CSS; synthetic local
// HTTP only. Accepted V9/V7/V3 evidence and fixture builders remain untouched.
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module"),
  ts = require("typescript"), { spawnSync, execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."), folder = path.join(root, "work/v9-admin-theme"),
  reportFolder = path.join(root, "docs/v9/role-theme"),
  cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js");
fs.mkdirSync(folder, { recursive: true }); fs.mkdirSync(reportFolder, { recursive: true });
const filename = path.join(root, "tests/teacher-admin-fixture.cjs"), m = new Module(filename, module);
m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
m._compile(fs.readFileSync(filename, "utf8").replaceAll('"teacher-admin-ui"', '"v9-admin-theme"'), filename);
const fixture = m.exports.build();
const jsPath = path.join(folder, "fixture.js");
let js = fs.readFileSync(jsPath, "utf8").replace("{AdminConsole}=", "{AdminConsole,AdminGate}=")
  .replace('function(mode="admin"){const next=structuredClone(initial);', 'function(mode="admin",override=null){const next=structuredClone(override||initial);')
  .replace('key:mode,initial:next', 'key:mode+(override?"-override":""),initial:next')
  .replace('window.__mountTeacherAdmin();', 'window.__mountGate=(code="SIGN_IN_REQUIRED")=>root.render(React.createElement(AdminGate,{code}));window.__mountTeacherAdmin();');
fs.writeFileSync(jsPath, js);
const themeModule = { exports: {} };
new Function("exports", ts.transpileModule(fs.readFileSync(path.join(root, "lib/lumio/theme.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText)(themeModule.exports);
const htmlPath = path.join(folder, "fixture.html");
fs.writeFileSync(htmlPath, fs.readFileSync(htmlPath, "utf8").replace("<title>",
  '<script id="lumio-theme-bootstrap">' + themeModule.exports.themeBootstrapScript + "</script><title>"));
const baselineCss = execFileSync("git", ["show", "cebd029:app/admin/admin.css"], {cwd:root,encoding:"utf8",maxBuffer:1024*1024});
const fixtureCss=fs.readFileSync(path.join(folder,"fixture.css"),"utf8"), currentAdminCss=fs.readFileSync(path.join(root,"app/admin/admin.css"),"utf8");
if(!fixtureCss.endsWith(currentAdminCss))throw Error("BASELINE_CSS_BOUNDARY");
fs.writeFileSync(path.join(folder,"baseline-admin.css"),fixtureCss.slice(0,-currentAdminCss.length)+baselineCss);
function call(session, ...args) {
  const result = spawnSync(process.execPath, [cli, `-s=${session}`, ...args, "--json"], {
    cwd: root, encoding: "utf8", timeout: 240000, maxBuffer: 12 * 1024 * 1024
  });
  if (result.error || result.status !== 0) throw result.error || Error(result.stdout || result.stderr);
  const value = JSON.parse(result.stdout);
  if (value.error || value.isError) throw Error(JSON.stringify(value).slice(0, 3000));
  return value;
}
let failed = 0;
for (const suite of (process.argv.length > 2 ? process.argv.slice(2) : ["workflow", "theme"])) {
  const session = `lumio-v9-admin-theme-${suite}-${process.pid}-${Date.now()}`,
    report = path.join(reportFolder, `admin-${suite}-report.json`);
  try {
    let source = fs.readFileSync(path.join(root, suite === "workflow" ? "tests/teacher-admin.browser.js" : "tests/v9-admin-theme.browser.js"), "utf8");
    source = source.replaceAll("work/teacher-admin-ui", "work/v9-admin-theme")
      .replaceAll("docs/v3/qa-teacher-admin-", "docs/v9/role-theme/admin-workflow-").trim().replace(/;$/, "");
    const script = path.join(folder, suite + ".js"); fs.writeFileSync(script, source);
    call(session, "open", "about:blank", "--browser=msedge");
    const result = call(session, "run-code", "--filename=" + path.relative(root, script).replaceAll("\\", "/"));
    const data = typeof result.result === "string" ? JSON.parse(result.result) : result.result;
    if (!data || !["PASS", "FINDINGS"].includes(data.status)) throw Error(JSON.stringify(data).slice(0, 3000));
    if (data.status !== "PASS") failed++;
    fs.writeFileSync(report, JSON.stringify({ ...data, checkedAt: new Date().toISOString(), fixtureSSRChecks: fixture.unitChecks,
      scope: "Actual current React/CSS; authored local identities, HTTP results and timestamps. No OAuth, provider, public server, real people or private DB." }, null, 2) + "\n");
    console.log(JSON.stringify({ suite, status: data.status, passed: data.passed, observations: data.observations?.length, findings: data.findings, report: path.relative(root, report) }));
  } catch (error) {
    failed++; fs.writeFileSync(report, JSON.stringify({ status: "FAIL", checkedAt: new Date().toISOString(), error: error.message.slice(0, 4000) }, null, 2) + "\n");
    console.error(suite + ": " + error.message.slice(0, 3000));
  } finally { try { call(session, "close"); } catch {} }
}
if (failed) process.exitCode = 1;
