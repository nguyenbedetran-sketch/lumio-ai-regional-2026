// V7 acceptance bundle of actual learner components; all auth/HTTP are test-only fixtures.
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  folder = path.join(root, "work/v8-tutor-ui");
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
      // Preserve explicit CSS Modules global selectors in this fixture.
      const globals = [];
      source = source.replace(/:global\(([^)]+)\)/g, (_m, selector) => {
        globals.push(selector);
        return "GLOBALSELECTOR" + (globals.length - 1) + "END";
      });
      source = source.replace(/\.([a-zA-Z_][\w-]*)/g, (_m, c) => {
        mapping[c] = prefix + c;
        return "." + prefix + c;
      });
      source = source.replace(
        /GLOBALSELECTOR(\d+)END/g,
        (_m, i) => globals[Number(i)],
      );
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
    app = bundle(path.join(root, "components/lumio/ai-panel.tsx")),
    voice = bundle(path.join(root, "components/lumio/voice-studio.tsx")),
    account = bundle(path.join(root, "components/lumio/account-scope.tsx")),
    i18n = bundle(path.join(root, "lib/lumio/i18n.ts"));
  fs.writeFileSync(
    path.join(folder, "fixture.js"),
    `(()=>{const process={env:{NODE_ENV:'production'}},modules=[${modules.join(",")}],cache={};function __require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,__require);return m.exports;}const React=__require(${react}),{createRoot}=__require(${client}),{AIPanel}=__require(${app}),{VoiceStudio}=__require(${voice}),{AccountScope}=__require(${account}),{catalogs}=__require(${i18n}),root=createRoot(document.getElementById('root'));let seq=0;const source="Khi biến đổi phương trình, thực hiện cùng một phép toán trên cả hai vế.",item={id:'qa-v8-material',title:'KIỂM THỬ · Phép toán tương đương',kind:'text',text:source,cards:[],questions:[],notes:[],artifacts:[],createdAt:'2026-10-16T00:00:00Z',updatedAt:'2026-10-16T00:00:00Z'},materials=[item,{...item,id:'qa-unextracted',title:'KIỂM THỬ · PDF chưa trích xuất',kind:'pdf',fileName:'synthetic.pdf',text:'',blob:new Blob(['synthetic-pdf'],{type:'application/pdf'})}];window.__source=source;window.__drafts=[];window.__openMaterial=[];window.__mountTutor=function(mode='tutor',accountKey='qa-v8-account-a',draft){root.render(React.createElement(AccountScope.Provider,{value:accountKey},React.createElement(mode==='tutor'?AIPanel:VoiceStudio,{key:++seq,...(mode==='tutor'?{item,t:catalogs.vi,locale:'vi',initialTask:'chat',initialPrompt:'2x+3=11',drafts:draft===undefined?undefined:{question:draft,goal:''},update:()=>{},onDraft:v=>window.__drafts.push(v)}:{locale:'vi',signedIn:true,materials,onOpenMaterial:id=>window.__openMaterial.push(id),providers:{capabilities:{tutor:true,transcription:false,speech:false}}})})));};window.__refreshVoiceMaterials=function(){root.render(React.createElement(AccountScope.Provider,{value:'qa-v8-account-a'},React.createElement(VoiceStudio,{key:seq,locale:'vi',signedIn:true,materials:[{...item,text:source+' Nội dung mới.'},materials[1]],providers:{capabilities:{tutor:true,transcription:false,speech:false}}})));};window.__mountTutor();})();`,
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
    '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumio learner UI acceptance fixture</title><link rel="stylesheet" href="/__v8-tutor-ui.css"><body style="margin:0"><div id="qa-banner" style="position:fixed;right:0;bottom:0;z-index:20000;padding:3px 7px;background:#244d3d;color:white;font:10px system-ui;pointer-events:none">KIỂM THỬ · Nội dung tổng hợp · HTTP giả lập</div><div id="root"></div><script src="/__v8-tutor-ui.js"></script></body></html>',
  );
  // Syntax checks apply to the actual changed acceptance targets, without a concurrent project build.
  for (const file of [
    "components/lumio/voice-studio.tsx",
    "components/lumio/ai-panel.tsx",
    "components/lumio/tutor-support.tsx",
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
