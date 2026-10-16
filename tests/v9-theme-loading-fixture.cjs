const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  React = require("react"),
  { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, ".."),
  folder = path.join(root, "work/v9-theme-loading-ui");
function build() {
  const client = require("./v7-learner-ui-fixture.cjs").build({
    folder,
    holdLibraryRead: true,
  });
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    if (file.endsWith(".css")) {
      if (!file.endsWith(".module.css")) return {};
      const s = fs.readFileSync(file, "utf8"),
        prefix = "v7-" + path.basename(file, ".module.css") + "-";
      return Object.fromEntries(
        [...s.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => [
          m[1],
          prefix + m[1],
        ]),
      );
    }
    const m = { exports: {} };
    cache.set(file, m);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    new Function("require", "module", "exports", code)(
      (n) =>
        n.startsWith(".")
          ? load(
              path.relative(
                root,
                path.resolve(path.dirname(file), n) +
                  (n.endsWith(".css")
                    ? ""
                    : fs.existsSync(
                          path.resolve(path.dirname(file), n) + ".tsx",
                        )
                      ? ".tsx"
                      : ".ts"),
              ),
            )
          : n.endsWith(".css")
            ? {}
            : require(n),
      m,
      m.exports,
    );
    return m.exports;
  }
  const Layout = load("app/layout.tsx").default,
    { LoadingSkeleton } = load("components/lumio/LoadingSkeleton.tsx");
  let html =
    "<!doctype html>" +
    renderToStaticMarkup(
      React.createElement(
        Layout,
        null,
        React.createElement(
          "div",
          { className: "lumio", id: "root" },
          React.createElement(LoadingSkeleton, {
            label: "Đang mở không gian học…",
          }),
        ),
      ),
    );
  html = html
    .replace("<head>", '<head><meta charset="utf-8">')
    .replace(
      "</head>",
      '<meta name="viewport" content="width=device-width,initial-scale=1"><script>document.documentElement.dataset.motion=new URLSearchParams(location.search).get("motion")||"off";</script><link rel="stylesheet" href="/__v7-learner-ui.css"></head>',
    )
    .replace(
      "</body>",
      '<p style="position:fixed;bottom:6px;right:8px;max-width:calc(100% - 16px);padding:4px 8px;border-radius:6px;background:#20392d;color:#d7e8d9;font:11px system-ui;z-index:10000">KIỂM THỬ SSR · React bị chặn · Không có dữ liệu học sinh</p><script>window.__themeBeforeHydration=document.documentElement.dataset.theme;window.__hydrationRan=false;</script><script defer src="/blocked-hydration.js"></script></body>',
    );
  fs.writeFileSync(path.join(folder, "prepaint.html"), html);
  return { ...client, folder };
}
module.exports = { build };
