// V7 acceptance bundle of actual learner components; all auth/HTTP are test-only fixtures.
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  folder = path.join(root, "work/v7-learner-ui");
function build() {
  fs.mkdirSync(folder, { recursive: true });
  const modules = [],
    ids = new Map(),
    moduleCSS = [];
  function bundle(filename) {
    filename = path.resolve(filename);
    if (ids.has(filename)) return ids.get(filename);
    const id = modules.length;
    ids.set(filename, id);
    modules.push("");
    let source = fs.readFileSync(filename, "utf8");
    if (filename.endsWith(".json")) {
      modules[id] =
        `function(module){module.exports=${JSON.stringify(JSON.parse(source))}}`;
      return id;
    }
    if (filename.endsWith(".css")) {
      const mapping = {},
        prefix = "v7-" + path.basename(filename, ".module.css") + "-";
      source = source.replace(/\.([a-zA-Z_][\w-]*)/g, (_m, c) => {
        mapping[c] = prefix + c;
        return "." + prefix + c;
      });
      moduleCSS.push(source);
      modules[id] =
        `function(module){module.exports=${JSON.stringify(mapping)}}`;
      return id;
    }
    if (/\.(?:tsx?|mjs)$/.test(filename))
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
      (_all, _q, name) => {
        if (name === "next-auth/react")
          return "({getSession:async()=>window.__learnerSession,signIn:async()=>{window.__learnerSignIns++},signOut:async()=>{window.__learnerSignOuts++}})";
        let target;
        if (name.startsWith(".")) {
          const base = path.resolve(path.dirname(filename), name);
          target = [
            base,
            base + ".ts",
            base + ".tsx",
            base + ".js",
            path.join(base, "index.js"),
          ].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
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
    app = bundle(path.join(root, "components/lumio/app.tsx"));
  fs.writeFileSync(
    path.join(folder, "fixture.js"),
    `(()=>{const process={env:{NODE_ENV:'production'}},modules=[${modules.join(",")}],cache={};function __require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,__require);return m.exports;}const React=__require(${react}),{createRoot}=__require(${client}),LumioApp=__require(${app}).default,root=createRoot(document.getElementById('root'));let mount=0;window.__learnerSignIns=0;window.__learnerSignOuts=0;window.__mountLearner=function(session){window.__learnerSession=session;root.render(React.createElement(LumioApp,{key:++mount}));};window.__mountLearner(null);})();`,
  );
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8"),
    css =
      [...layout.matchAll(/import "([^"\n]+\.css)"/g)]
        .map((m) =>
          fs.readFileSync(
            m[1].startsWith("./")
              ? path.join(root, "app", m[1])
              : require.resolve(m[1]),
            "utf8",
          ),
        )
        .join("\n") +
      "\n" +
      moduleCSS.join("\n");
  fs.writeFileSync(path.join(folder, "fixture.css"), css);
  fs.writeFileSync(
    path.join(folder, "fixture.html"),
    '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumio learner UI acceptance fixture</title><link rel="stylesheet" href="/__v7-learner-ui.css"><body style="margin:0"><div id="qa-banner" style="position:fixed;right:0;bottom:0;z-index:20000;padding:3px 7px;background:#244d3d;color:white;font:10px system-ui;pointer-events:none">KIỂM THỬ · Nội dung tổng hợp · HTTP giả lập</div><div id="root"></div><script src="/__v7-learner-ui.js"></script></body></html>',
  );
  // Syntax checks apply to the actual changed acceptance targets, without a concurrent project build.
  for (const file of [
    "components/lumio/app.tsx",
    "components/lumio/add-content.tsx",
    "components/lumio/dialog.tsx",
    "components/lumio/learning-view.tsx",
    "components/lumio/source-references.tsx",
    "components/shared/draft-guard.tsx",
  ]) {
    const result = ts.transpileModule(
      fs.readFileSync(path.join(root, file), "utf8"),
      {
        reportDiagnostics: true,
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
        },
      },
    );
    assert.equal(
      (result.diagnostics || []).filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      ).length,
      0,
      file,
    );
  }
  fs.writeFileSync(
    path.join(folder, "delayed-discard.txt"),
    "KIỂM THỬ · Nội dung đọc muộn phải bị hủy sau khi bỏ tải lên.",
  );
  fs.writeFileSync(
    path.join(folder, "normal-import.txt"),
    "KIỂM THỬ · Đây là tệp văn bản được nhập và lưu bình thường.",
  );
  return { folder, syntaxChecks: 6, modules: modules.length };
}
module.exports = { build };
if (require.main === module)
  console.log(JSON.stringify({ status: "PASS", ...build() }));
