/* Actual React SSR + real KaTeX and parser; no provider or browser claims. */
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { root, load, render, nodes, visibleText, fixtures, MathText } = require("./content-renderer-utils.cjs");
const { parseInlineContent, parseRichContent, RICH_CONTENT_LIMITS } = load("lib/lumio/rich-content.ts");
const { renderEducationalMath } = load("lib/lumio/math-display.ts");
const { validateReferences } = load("lib/ai/grounding.ts");
const React = require("react"), { renderToStaticMarkup } = require("react-dom/server"), checks = [];
const check = (name, run) => { run(); checks.push(name); console.log("PASS " + name); };
const count = (html, name, cls) => nodes(html).filter((n) => n.name === name && (!cls || (n.attribs?.class || "").split(" ").includes(cls))).length;
check("Vietnamese prose supports canonical inline math with accessible MathML", () => {
  const html = render(String.raw`Giải phương trình \(2x+3=7\), kết quả là \(x=2\).`);
  assert.equal(count(html, "math"), 2); assert.match(visibleText(html), /Giải phương trình/); assert.ok(!visibleText(html).includes("\\("));
  assert.equal(count(html, "span", "katex-mathml"), 2); assert.ok(nodes(html).filter((n) => n.attribs?.class === "katex-html").every((n) => n.attribs["aria-hidden"] === "true"));
});
check("Legacy single-dollar formulas and double-dollar display math render once", () => {
  const html = render(String.raw`Giải $ax+b=c$ và $\frac{3}{2}x+4=10$.

$$x=4$$`);
  assert.equal(count(html, "math"), 3); assert.equal(count(html, "div", "lm-math--display"), 1); assert.ok(!visibleText(html).includes("$"));
});
check("Nested fractions, powers, subscripts and indexed roots use real mathematical markup", () => {
  const html = render(String.raw`\(\frac{1}{\frac{2}{3}}+x_1^2+\sqrt[3]{8}\)`);
  assert.equal(count(html, "mfrac"), 2); assert.ok(count(html, "msqrt") + count(html, "mroot") > 0); assert.ok(!html.includes("data-math-fallback"));
});
check("Aligned multi-step equations and systems render as separate display blocks", () => {
  for (const source of [String.raw`\[\begin{aligned}2x+3&=7\\2x&=4\\x&=2\end{aligned}\]`, String.raw`\begin{cases}x+y=3\\x-y=1\end{cases}`]) {
    const html = render(source); assert.equal(count(html, "math"), 1); assert.equal(count(html, "div", "lm-math--display"), 1); assert.ok(!html.includes("data-math-fallback"));
  }
});
check("Sums, products, Greek, geometry and Vietnamese text remain supported", () => {
  const html = render(String.raw`\[\sum_{i=1}^{n}i+\prod_{k=1}^{3}k+\alpha+\angle ABC+\text{Điều kiện }x\neq0\]`);
  assert.equal(count(html, "math"), 1); assert.ok(!html.includes("data-math-fallback"));
});
check("Display formulas embedded in a paragraph never create div-inside-p nesting", () => {
  const html = render(String.raw`Trước \[x^2=4\] rồi sau.`);
  assert.equal(count(html, "div", "lm-math--display"), 1);
  assert.ok(!nodes(html).some((n) => n.name === "p" && n.children?.some((c) => c.name === "div")));
  assert.match(visibleText(html), /Trước/); assert.match(visibleText(html), /rồi sau/);
});
check("Markdown produces real headings, emphasis, ordered and unordered lists", () => {
  const html = render("## Mục tiêu\n\n**Hiểu** và *nhớ*.\n\n- Một\n- Hai\n\n3. Ba\n4. Bốn");
  for (const tag of ["h2", "strong", "em", "ul", "ol"]) assert.equal(count(html, tag), 1);
  assert.equal(count(html, "li"), 4); assert.ok(nodes(html).some((n) => n.name === "ol" && n.attribs.start === "3")); assert.ok(!visibleText(html).includes("**"));
});
check("Markdown tables keep pipe characters inside math/code and proper header semantics", () => {
  const html = render(String.raw`| Công thức | Mã |
| --- | --- |
| $|x|=2$ | ` + "`a|b`" + " |");
  assert.equal(count(html, "table"), 1); assert.equal(count(html, "th"), 2); assert.equal(count(html, "td"), 2); assert.equal(count(html, "math"), 1);
  assert.ok(nodes(html).filter((n) => n.name === "th").every((n) => n.attribs.scope === "col"));
});
check("Currency and escaped dollar pairs remain literal without accidental math", () => {
  const html = render(fixtures.currency); assert.equal(count(html, "math"), 0); assert.match(visibleText(html), /\$12\.50/); assert.match(visibleText(html), /\$x\$/);
  assert.equal(count(render("$5 + $10 and $20,000"), "math"), 0);
});
check("Explicitly paired numeric/decimal math renders while unpaired prices stay literal", () => {
  const html = render("| Résultat | Valeur |\n| --- | --- |\n| $3$ | $-2.5$ |"); assert.equal(count(html, "math"), 2); assert.ok(!visibleText(html).includes("$"));
  assert.equal(count(render(String.raw`Prix $3, $5 et $12.50; prix échappé \$3\$.`), "math"), 0);
});
check("Inline and fenced code protect dollars/backslashes/Markdown from rendering", () => {
  const html = render(fixtures.code); assert.equal(count(html, "math"), 0); assert.equal(count(html, "code"), 2); assert.equal(count(html, "pre"), 1);
  assert.ok(visibleText(html).includes("\\frac{1}{2}")); assert.ok(visibleText(html).includes("$$x$$"));
});
check("Explicit math/latex code fences are formulas while ordinary code stays code", () => {
  const html = render("```latex\n\\frac{1}{2}\n```\n\n```js\nconst x='$y$';\n```"); assert.equal(count(html, "math"), 1); assert.equal(count(html, "pre"), 1);
});
check("Bare common legacy commands and unmatched dollar-symbol command do not leak raw syntax", () => {
  const html = render(String.raw`Tích \cdot, nhân \times, khác \neq, phân số \frac{3}{2}; ký hiệu $\cdot`);
  assert.equal(count(html, "math"), 5); assert.ok(!/\\(?:cdot|times|neq|frac)/.test(visibleText(html)));
});
check("Legacy double-escaped paired math renders without globally decoding paths or code", () => {
  const source = String.raw`Cũ \\(x\\neq0\\), \\frac{1}{2} và \\[\\begin{aligned}x&=1\\\\y&=2\\end{aligned}\\]`;
  const html = render(source); assert.equal(count(html, "math"), 3); assert.ok(!html.includes("data-math-fallback")); assert.ok(!/\\(?:frac|neq|begin)/.test(visibleText(html))); assert.equal(source, JSON.parse(JSON.stringify(source)));
  const code = render("`" + String.raw`\\frac{1}{2}` + "`"); assert.equal(count(code, "math"), 0); assert.ok(visibleText(code).includes(String.raw`\\frac`));
  const path = render(String.raw`C:\\Users\\pc\\file.txt`); assert.equal(count(path, "math"), 0); assert.ok(visibleText(path).includes("Users"));
});
check("Malformed bare math preserves the following explanation instead of swallowing it", () => {
  for (const source of [String.raw`\frac{1} thiếu mẫu. Học sinh kiểm tra lại.`, String.raw`\sqrt thiếu biểu thức. Học sinh kiểm tra lại.`, String.raw`\frac{1}{thiếu dấu đóng. Học sinh kiểm tra lại.`]) {
    const html = render(source); assert.ok(html.includes("data-math-fallback")); assert.match(visibleText(html), /Học sinh kiểm tra lại\./); assert.ok(!visibleText(html).includes("\\frac"));
  }
});
check("Malformed/unsupported expressions show readable fallback instead of red/raw commands", () => {
  for (const source of [String.raw`\(\unsupported{a}\)`, String.raw`\[\frac{1}{\]`, String.raw`\(x+1`]) {
    const html = render(source); assert.ok(html.includes("data-math-fallback")); assert.match(visibleText(html), /Công thức cần kiểm tra/); assert.ok(!visibleText(html).includes("\\")); assert.equal(count(html, "span", "katex-error"), 0);
  }
});
check("Untrusted HTML is escaped text, never interpreted as HTML or script", () => {
  const html = render('<img src=x onerror=alert(1)> <script>alert(1)</script> <iframe src="https://example.test"></iframe>');
  for (const tag of ["img", "script", "iframe"]) assert.equal(count(html, tag), 0); assert.ok(visibleText(html).includes("<img"));
});
check("Imported literal entities are not blindly decoded or interpreted as HTML", () => {
  const html = render("&lt;img src=x&gt; &amp; 5 &lt; 7"); assert.equal(count(html, "img"), 0); assert.ok(visibleText(html).includes("&lt;img"));
});
check("Markdown links are bounded to HTTP(S), blocked URLs never become clickable", () => {
  const html = render('[Nguồn](https://example.test/lesson) [x](javascript:alert(1)) ![ảnh](https://example.test/image.png)');
  assert.equal(count(html, "a"), 1); assert.equal(count(html, "img"), 0); assert.ok(nodes(html).find((n) => n.name === "a").attribs.rel.includes("noopener"));
});
check("Malicious KaTeX URLs/HTML/styles and macro state are rejected before rendering", () => {
  for (const tex of [String.raw`\href{javascript:alert(1)}{Click}`, String.raw`\includegraphics{https://example.test/x}`, String.raw`\htmlStyle{position:fixed}{x}`, String.raw`\gdef\evil{x}\evil`, String.raw`\color{transparent}{x}`]) {
    const html = render("\\(" + tex + "\\)"); assert.ok(html.includes("data-math-fallback")); assert.equal(count(html, "a"), 0); assert.equal(count(html, "img"), 0); assert.ok(!visibleText(html).includes("\\"));
  }
  assert.ok("fallback" in renderEducationalMath(String.raw`\evil`, false));
});
check("Inline rendering remains phrasing-only inside an actual heading/button", () => {
  for (const tag of ["h3", "button"]) {
    const html = renderToStaticMarkup(React.createElement(tag, {}, React.createElement(MathText, { text: String.raw`**Tính** \[\frac{1}{2}\]`, inline: true })));
    for (const invalid of ["div", "p", "table", "h1", "h2"]) assert.equal(count(html, invalid), 0); assert.equal(count(html, "math"), 1); assert.equal(count(html, "strong"), 1);
  }
});
check("Inline button content cannot introduce links or a nested formula tab stop", () => {
  const html = renderToStaticMarkup(React.createElement("button", {}, React.createElement(MathText, { text: "[Nguồn](https://example.test) " + String.raw`\(` + "x+".repeat(60) + "1" + String.raw`\)`, inline: true })));
  assert.equal(count(html, "a"), 0); assert.ok(visibleText(html).includes("Nguồn")); assert.equal(count(html, "math"), 1); assert.ok(!nodes(html).some((n) => n.attribs?.tabindex));
  assert.equal(count(render("[Nguồn](https://example.test)"), "a"), 1);
});
check("Very long math is bounded and oversized source gets an explicit display note", () => {
  assert.ok("fallback" in renderEducationalMath("x+".repeat(3000), true));
  const original = "học ".repeat(40000), html = render(original); assert.match(visibleText(html), /rút gọn khi hiển thị/); assert.equal(original.length, 160000);
});
check("Many tiny formulas share one per-render budget across paragraphs and tables", () => {
  const original = Array.from({ length: RICH_CONTENT_LIMITS.mathExpressions + 3 }, (_, n) => n % 2 ? "\\(x\\)\n\n" : "| Valeur |\n| --- |\n| \\(y\\) |\n\n").join("");
  const html = render(original); assert.equal(count(html, "math"), RICH_CONTENT_LIMITS.mathExpressions); assert.equal((visibleText(html).match(/Một số công thức chưa hiển thị/g) || []).length, 1); assert.ok(original.includes("\\(y\\)"));
  const next = render("\\(z\\)", true); assert.equal(count(next, "math"), 1); assert.ok(!visibleText(next).includes("chưa hiển thị"));
});
check("Render and JSON reload are deterministic and preserve original source/citation offsets", () => {
  const source = String.raw`Đề bài \(x+1=3\). Điều kiện gốc giữ nguyên.`;
  const saved = JSON.stringify({ body: source, references: [{ segmentId: "s1", quote: "Điều kiện gốc giữ nguyên." }] });
  const restored = JSON.parse(saved), before = validateReferences(restored.references, source); assert.equal(render(restored.body), render(source)); assert.equal(restored.body, source);
  render(source); assert.deepEqual(validateReferences(restored.references, source), before); assert.equal(saved, JSON.stringify(restored));
});
check("Full lesson mixing Markdown/math/table/code is stable without a second rendering pass", () => {
  const first = render(fixtures.lesson), second = render(fixtures.lesson); assert.equal(first, second); assert.equal(count(first, "table"), 1); assert.equal(count(first, "h2"), 1);
  assert.ok(!visibleText(first).includes("##")); assert.ok(!visibleText(first).includes("**"));
});
check("Renderer imports and SSR never dispatch a network/provider call", () => {
  const old = global.fetch; let calls = 0; global.fetch = () => { calls++; throw Error("NETWORK_FORBIDDEN"); }; try { render(fixtures.lesson); render(fixtures.unsupported); assert.equal(calls, 0); } finally { global.fetch = old; }
});
const folder = path.join(root, "docs/next/reports/content-renderer"); fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(path.join(folder, "ssr-security.json"), JSON.stringify({ checkedAt: new Date().toISOString(), status: "PASS", passed: checks.length, checks, newProviderCalls: 0, sourceProof: ["components/lumio/math-text.tsx", "lib/lumio/rich-content.ts", "lib/lumio/math-display.ts", "app/ai.css", "tests/v10-content-renderer.cjs"].map((file) => ({ path: file, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex") })), scope: "Actual React SSR, real KaTeX, bounded Markdown parser and authored hostile/legacy fixtures. Not complete CommonMark/HTML, live AI quality, browser/reader/device acceptance or all application surfaces. Stored content and citation offsets unchanged." }, null, 2) + "\n");
console.log(checks.length + " content renderer SSR/security checks PASS.");
