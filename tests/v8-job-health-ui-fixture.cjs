// Actual JobHealthPanel + application CSS. No product route, login bypass,
// provider request, persisted account or production telemetry is introduced.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  ts = require("typescript"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  folder = path.join(root, "work/v8-job-health-ui");
function build() {
  fs.mkdirSync(folder, { recursive: true });
  const component = path.join(root, "components/admin/job-health.tsx"),
    modules = [],
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
          esModuleInterop: true,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText;
    source = source.replace(
      /require\((["'])([^"']+)\1\)/g,
      (_all, _quote, name) => {
        let target;
        if (name.startsWith(".")) {
          const base = path.resolve(path.dirname(filename), name);
          target = [base, base + ".ts", base + ".tsx", base + ".js"].find(
            (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
          );
        } else
          target = require.resolve(name, { paths: [path.dirname(filename)] });
        if (!target) throw Error("FIXTURE_MODULE_MISSING:" + name);
        return `__require(${bundle(target)})`;
      },
    );
    modules[id] = `function(module,exports,__require){${source}\n}`;
    return id;
  }
  const react = bundle(require.resolve("react")),
    client = bundle(require.resolve("react-dom/client")),
    usage = bundle(component);
  fs.writeFileSync(
    path.join(folder, "fixture.js"),
    `(()=>{const process={env:{NODE_ENV:'production'}},modules=[${modules.join(",")}],cache={};function __require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,__require);return m.exports;}const React=__require(${react}),{createRoot}=__require(${client}),{JobHealthPanel}=__require(${usage}),root=createRoot(document.getElementById('root'));window.__mountJobHealth=function(accountKey='qa-health-a',keyed=true){root.render(React.createElement(JobHealthPanel,{key:keyed?accountKey:'same-instance',accountKey}));};window.__mountJobHealth();})();`,
  );
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8"),
    cssSources = [...layout.matchAll(/import "([^"\n]+\.css)"/g)].map((m) =>
      m[1].startsWith("./")
        ? path.join(root, "app", m[1])
        : require.resolve(m[1]),
    );
  cssSources.push(path.join(root, "app/admin/admin.css"));
  fs.writeFileSync(
    path.join(folder, "fixture.css"),
    cssSources.map((file) => fs.readFileSync(file, "utf8")).join("\n"),
  );
  fs.writeFileSync(
    path.join(folder, "fixture.html"),
    '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/__v8-job-health-ui.css"><title>Job health acceptance fixture</title><body style="margin:0"><div class="ad-shell"><aside class="ad-sidebar" aria-label="Nhãn fixture"><strong>KIỂM THỬ</strong><p>Sức khỏe hàng đợi</p></aside><main class="ad-main" aria-label="Kiểm thử hàng đợi"><div class="ad-content"><p>KIỂM THỬ · Tài khoản và số liệu tổng hợp · Không phải chi phí hoặc tài khoản thật</p><section class="ad-panel"><div id="root"></div></section></div></main></div><script src="/__v8-job-health-ui.js"></script></body></html>',
  );
  const componentText = fs.readFileSync(component, "utf8");
  assert.ok(componentText.includes("JobHealthPanel"));
  return {
    folder,
    sourceSha256: crypto
      .createHash("sha256")
      .update(componentText)
      .digest("hex"),
    fixtureSha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(__filename))
      .digest("hex"),
    cssSha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(folder, "fixture.css")))
      .digest("hex"),
  };
}
module.exports = { build };
if (require.main === module)
  console.log(JSON.stringify({ status: "PASS", ...build() }));
