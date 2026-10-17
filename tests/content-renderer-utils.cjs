const fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
const root = path.resolve(__dirname, ".."), cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative); if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} }; cache.set(file, m);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)((name) => {
    if (!name.startsWith(".")) return require(name);
    const base = path.resolve(path.dirname(file), name), resolved = [base + ".tsx", base + ".ts", base + ".js"].find(fs.existsSync);
    if (!resolved) throw Error("MODULE_MISSING:" + name); return load(path.relative(root, resolved));
  }, m, m.exports); return m.exports;
}
const React = require("react"), { renderToStaticMarkup } = require("react-dom/server"), { MathText } = load("components/lumio/math-text.tsx");
const render = (text, inline = false) => renderToStaticMarkup(React.createElement(MathText, { text, inline }));
function nodes(html) { const { parseDocument } = require("htmlparser2"); const result = []; const walk = (n) => { result.push(n); n.children?.forEach(walk); }; walk(parseDocument(html)); return result; }
function visibleText(html) { const { parseDocument } = require("htmlparser2"); const text = (n) => n.type === "text" ? n.data : n.name === "annotation" || (n.attribs?.class || "").split(" ").includes("katex-mathml") ? "" : (n.children || []).map(text).join(""); return text(parseDocument(html)); }
const fixtures = {
  lesson: String.raw`## Phương trình và điều kiện

**Mục tiêu:** Giải $2x+3=7$ và *kiểm tra* kết quả.

1. Trừ 3 ở cả hai vế: \(2x=4\).
2. Chia hai vế cho 2 khác 0: \(x=2\).

\[
\begin{aligned}2x+3&=7\\2x&=4\\x&=2\end{aligned}
\]

| Đại lượng | Giá trị |
| --- | --- |
| Phân số | $\frac{3}{2}$ |
| Điều kiện | \(x\neq0\) |
| Kết quả | $3$ |

> Kiểm tra: \(2\cdot2+3=7\), nên nghiệm là \(x=2\).
`,
  currency: String.raw`Giá $5, $10 và $12.50; số tiền USD $20. Không coi \$x\$ là công thức.`,
  code: 'Ví dụ mã: `const price = "$x$"; \\frac{1}{2}`\n\n```js\nconst text = "$$x$$";\nconst path = "C:\\\\temp";\n```',
  longMath: "\\[" + Array.from({ length: 95 }, (_, i) => "x_{" + i + "}^2").join("+") + "=1\\]",
  unsupported: String.raw`Cần đối chiếu \(\unsupported{a}\). Liên kết cấm: \(\href{javascript:alert(1)}{Click}\).`,
};
module.exports = { root, load, render, nodes, visibleText, fixtures, MathText };
