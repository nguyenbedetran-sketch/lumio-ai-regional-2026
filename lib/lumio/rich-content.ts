/** Bounded rendering AST only. No evaluation, HTML interpretation or persistence. */
export const RICH_CONTENT_LIMITS = { characters: 120000, math: 4000, mathExpressions: 512, blocks: 2000, inlineDepth: 5, tableColumns: 20, tableRows: 200 } as const;
export type InlineContent =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "math"; text: string; display: boolean; malformed?: boolean }
  | { kind: "strong"; children: InlineContent[] }
  | { kind: "em"; children: InlineContent[] }
  | { kind: "link"; children: InlineContent[]; href?: string };
export type ContentBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "heading"; text: string; level: number }
  | { kind: "math"; content: Extract<InlineContent, { kind: "math" }> }
  | { kind: "code"; text: string; language: string }
  | { kind: "list"; ordered: boolean; start: number; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "rule" };
const bareCommands = new Set("frac dfrac tfrac sqrt cdot times div neq ne leq geq le ge approx pm mp alpha beta gamma delta epsilon theta lambda mu pi rho sigma phi omega Delta Gamma Theta Lambda Pi Sigma Phi Omega sum prod int infty angle triangle parallel perp degree circ rightarrow leftrightarrow Rightarrow Leftrightarrow left right text mathrm mathbf overline underline vec hat bar".split(" "));
const escaped = (text: string, index: number) => { let n = 0; while (index > 0 && text[--index] === "\\") n++; return n % 2 === 1; };
function closing(text: string, marker: string, from: number, limit = RICH_CONTENT_LIMITS.math + 20) {
  let at = text.indexOf(marker, from), end = Math.min(text.length, from + limit);
  while (at >= 0 && at <= end) { if (!escaped(text, at)) return at; at = text.indexOf(marker, at + marker.length); }
  return -1;
}
function groupEnd(text: string, start: number) {
  if (text[start] !== "{") return -1;
  let depth = 0;
  for (let i = start; i < text.length && i - start <= RICH_CONTENT_LIMITS.math; i++) {
    if (escaped(text, i)) continue;
    if (text[i] === "{") depth++;
    if (text[i] === "}" && --depth === 0) return i + 1;
  }
  return -1;
}
function bareMath(text: string, at: number): { node: Extract<InlineContent, { kind: "math" }>; end: number } | undefined {
  if (at > 0 && /[\p{L}\p{N}_:/\\]/u.test(text[at - 1])) return;
  const command = /^\\([A-Za-z]+)/.exec(text.slice(at, at + 35));
  if (!command || (!bareCommands.has(command[1]) && text[at + command[0].length] !== "{")) return;
  let end = at + command[0].length;
  if (command[1] === "sqrt" && text[end] === "[") { const close = text.indexOf("]", end); if (close >= 0 && close - end < 30) end = close + 1; }
  const groups = ["frac", "dfrac", "tfrac"].includes(command[1]) ? 2 : ["sqrt", "text", "mathrm", "mathbf", "overline", "underline", "vec", "hat", "bar"].includes(command[1]) || text[end] === "{" ? 1 : 0;
  for (let i = 0; i < groups; i++) {
    const consumed = end;
    while (text[end] === " ") end++;
    const close = groupEnd(text, end);
    // A missing argument is not a license to swallow the teacher's explanation.
    if (close < 0) return { node: { kind: "math", text: text.slice(at, consumed), display: false, malformed: true }, end: consumed };
    end = close;
  }
  return { node: { kind: "math", text: text.slice(at, end), display: false }, end };
}
function legacyMathAt(text: string, at: number) {
  if (!text.startsWith("\\\\", at) || (at > 0 && text[at - 1] === "\\")) return;
  const normalizeMathSlashes = (value: string) => value.replace(/\\{2,}/g, (run) => run.length === 2 ? "\\" : run.length === 4 ? "\\\\" : run);
  const open = text.startsWith("\\\\(", at) ? "\\\\(" : text.startsWith("\\\\[", at) ? "\\\\[" : "";
  if (open) {
    const marker = open === "\\\\(" ? "\\\\)" : "\\\\]", end = closing(text, marker, at + open.length);
    if (end >= 0) return { node: { kind: "math" as const, text: normalizeMathSlashes(text.slice(at + open.length, end)), display: open === "\\\\[" }, end: end + marker.length };
    return;
  }
  // Only recognized math commands, not an arbitrary escaped path or imported text.
  const command = /^\\\\([A-Za-z]+)/.exec(text.slice(at, at + 36));
  if (!command || !bareCommands.has(command[1])) return;
  const bare = bareMath(text.slice(at + 1, at + RICH_CONTENT_LIMITS.math + 20), 0);
  return bare ? { node: { ...bare.node, text: normalizeMathSlashes(bare.node.text) }, end: at + 1 + bare.end } : undefined;
}
function mathAt(text: string, at: number) {
  const open = text.startsWith("\\(", at) ? "\\(" : text.startsWith("\\[", at) ? "\\[" : text.startsWith("$$", at) ? "$$" : text[at] === "$" ? "$" : "";
  if (!open) {
    const env = /^\\begin\{(aligned|align\*?|cases|gathered|matrix|[bBpPvV]matrix)\}/.exec(text.slice(at, at + 40));
    if (env) {
      const close = closing(text, "\\end{" + env[1] + "}", at + env[0].length);
      if (close >= 0) { const end = close + env[1].length + 6; return { node: { kind: "math" as const, text: text.slice(at, end), display: true }, end }; }
    }
    return bareMath(text, at);
  }
  const endMarker = open === "\\(" ? "\\)" : open === "\\[" ? "\\]" : open;
  const finish = closing(text, endMarker, at + open.length, open === "$" ? 2000 : RICH_CONTENT_LIMITS.math + 20);
  if (open === "$") {
    if (/\s/.test(text[at + 1] || "") || (at > 0 && /[\p{L}\p{N}_]/u.test(text[at - 1]))) return;
    if (finish < 0) {
      const bare = bareMath(text, at + 1);
      return bare ? { ...bare, node: { ...bare.node } } : undefined;
    }
    const body = text.slice(at + 1, finish);
    // Currency/prose/code-like words are not a general-purpose dollar delimiter.
    if (!body || /\n/.test(body) || /\s/.test(body.at(-1) || "") || /\d/.test(text[finish + 1] || "") || !(/\\[A-Za-z]+|[=+*/^_{}<>−×÷]|^[\p{L}]{1,3}$|^[+-]?\d{1,20}(?:\.\d{1,10})?$/u.test(body)) || /[\p{L}]{4,}/u.test(body.replace(/\\[A-Za-z]+(?:\{[^}]*\})?/g, ""))) return;
  }
  if (finish < 0) {
    const line = text.indexOf("\n", at + open.length), end = line < 0 ? text.length : line;
    return { node: { kind: "math" as const, text: text.slice(at + open.length, end), display: open !== "\\(" && open !== "$", malformed: true }, end };
  }
  return { node: { kind: "math" as const, text: text.slice(at + open.length, finish), display: open !== "\\(" && open !== "$" }, end: finish + endMarker.length };
}
function codeAt(text: string, at: number) {
  if (text[at] !== "`") return;
  const marker = /^`+/.exec(text.slice(at))![0], end = text.indexOf(marker, at + marker.length);
  return { node: { kind: "code" as const, text: text.slice(at + marker.length, end < 0 ? text.length : end).replace(/\n/g, " ") }, end: end < 0 ? text.length : end + marker.length };
}
export function parseInlineContent(input: string, depth = 0): InlineContent[] {
  if (depth > RICH_CONTENT_LIMITS.inlineDepth) return [{ kind: "text", text: input }];
  const text = input.slice(0, RICH_CONTENT_LIMITS.characters), result: InlineContent[] = [];
  let buffer = "";
  const flush = () => { if (buffer) { result.push({ kind: "text", text: buffer }); buffer = ""; } };
  for (let i = 0; i < text.length;) {
    const code = codeAt(text, i);
    if (code) { flush(); result.push(code.node); i = code.end; continue; }
    const legacy = text[i] === "\\" ? legacyMathAt(text, i) : undefined;
    if (legacy) { flush(); result.push(legacy.node); i = legacy.end; continue; }
    if (text[i] === "\\" && /[\\$`*_\[\]{}!|]/.test(text[i + 1] || "") && !text.startsWith("\\[", i)) { buffer += text[i + 1]; i += 2; continue; }
    if (text[i] === "\\" || text[i] === "$") {
      const math = mathAt(text, i);
      if (math) { flush(); result.push(math.node); i = math.end; continue; }
    }
    if ((text[i] === "[" || text.startsWith("![", i)) && depth < RICH_CONTENT_LIMITS.inlineDepth) {
      const image = text[i] === "!", start = i + (image ? 2 : 1), labelEnd = text.indexOf("](", start), close = labelEnd < 0 ? -1 : text.indexOf(")", labelEnd + 2);
      if (close >= 0 && close - i < 2200) {
        const href = text.slice(labelEnd + 2, close).trim();
        const safe = /^https?:\/\/[^\s<>]+$/i.test(href) && !/[\u0000-\u001f\u007f]/.test(href);
        flush(); result.push(image ? { kind: "text", text: text.slice(start, labelEnd) } : { kind: "link", children: parseInlineContent(text.slice(start, labelEnd), depth + 1), ...(safe ? { href } : {}) });
        i = close + 1; continue;
      }
    }
    const marker = text.startsWith("**", i) ? "**" : text.startsWith("__", i) ? "__" : text[i] === "*" || text[i] === "_" ? text[i] : "";
    if (marker && !(marker.length === 1 && /[\p{L}\p{N}]/u.test(text[i - 1] || ""))) {
      const end = text.indexOf(marker, i + marker.length);
      if (end > i + marker.length && !/\s/.test(text[i + marker.length]) && !/\s/.test(text[end - 1])) {
        flush(); result.push({ kind: marker.length === 2 ? "strong" : "em", children: parseInlineContent(text.slice(i + marker.length, end), depth + 1) }); i = end + marker.length; continue;
      }
    }
    buffer += text[i++];
  }
  flush(); return result;
}
function cells(line: string) {
  const result: string[] = []; let cell = "", i = line.trim().startsWith("|") ? line.indexOf("|") + 1 : 0;
  for (; i < line.length;) {
    if (line[i] === "\\" && line[i + 1] === "|") { cell += "|"; i += 2; continue; }
    const protectedPart = codeAt(line, i) || ((line[i] === "$" || line[i] === "\\") ? mathAt(line, i) : undefined);
    if (protectedPart) { cell += line.slice(i, protectedPart.end); i = protectedPart.end; continue; }
    if (line[i] === "|") { result.push(cell.trim()); cell = ""; i++; } else cell += line[i++];
  }
  if (cell.trim() || !line.trim().endsWith("|")) result.push(cell.trim());
  return result.slice(0, RICH_CONTENT_LIMITS.tableColumns);
}
const listLine = (line: string) => /^\s{0,3}([-+*]|\d{1,4}[.)])\s+(.+)$/.exec(line);
const divider = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);
export function parseRichContent(input: string): { blocks: ContentBlock[]; truncated: boolean } {
  const source = input.slice(0, RICH_CONTENT_LIMITS.characters).replace(/\r\n?/g, "\n"), lines = source.split("\n"), blocks: ContentBlock[] = [];
  let i = 0;
  while (i < lines.length && blocks.length < RICH_CONTENT_LIMITS.blocks) {
    const line = lines[i]; if (!line.trim()) { i++; continue; }
    const fence = /^\s{0,3}(`{3,}|~{3,})([\w+-]{0,30})\s*$/.exec(line);
    if (fence) {
      const body: string[] = []; i++;
      while (i < lines.length && !new RegExp("^\\s{0,3}" + fence[1][0] + "{" + fence[1].length + ",}\\s*$").test(lines[i])) body.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push(["math", "tex", "latex"].includes(fence[2].toLowerCase())
        ? { kind: "math", content: { kind: "math", text: body.join("\n"), display: true } }
        : { kind: "code", text: body.join("\n"), language: fence[2] }); continue;
    }
    if (/^\s*(?:\$\$|\\\[|\\begin\{)/.test(line)) {
      const rest = lines.slice(i).join("\n"), start = rest.search(/\S/), math = mathAt(rest, start);
      if (math?.node.display) {
        blocks.push({ kind: "math", content: math.node });
        const consumed = rest.slice(0, math.end).split("\n").length - 1, tail = rest.slice(math.end).split("\n")[0];
        i += consumed; if (tail.trim()) lines[i] = tail; else i++;
        continue;
      }
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) { blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] }); i++; continue; }
    if (i + 1 < lines.length && line.includes("|") && divider(lines[i + 1])) {
      const headers = cells(line), rows: string[][] = []; i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() && rows.length < RICH_CONTENT_LIMITS.tableRows) rows.push(cells(lines[i++]));
      blocks.push({ kind: "table", headers, rows }); continue;
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push({ kind: "rule" }); i++; continue; }
    if (/^\s*>\s?/.test(line)) { const body: string[] = []; while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, "")); blocks.push({ kind: "quote", text: body.join("\n") }); continue; }
    const item = listLine(line);
    if (item) {
      const ordered = /^\d/.test(item[1]), start = ordered ? parseInt(item[1]) : 1, items: string[] = [];
      while (i < lines.length) { const next = listLine(lines[i]); if (!next || /^\d/.test(next[1]) !== ordered) break; items.push(next[2]); i++; }
      blocks.push({ kind: "list", ordered, start, items }); continue;
    }
    const body = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^\s{0,3}(?:#{1,6}\s|`{3,}|~{3,}|>\s|\$\$|\\\[|\\begin\{)/.test(lines[i]) && !listLine(lines[i]) && !(i + 1 < lines.length && lines[i].includes("|") && divider(lines[i + 1]))) body.push(lines[i++]);
    blocks.push({ kind: "paragraph", text: body.join("\n") });
  }
  return { blocks, truncated: input.length > RICH_CONTENT_LIMITS.characters || i < lines.length };
}
