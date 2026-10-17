import { createElement, Fragment, type ReactNode } from "react";
import { parseInlineContent, parseRichContent, RICH_CONTENT_LIMITS, type InlineContent } from "../../lib/lumio/rich-content";
import { renderEducationalMath } from "../../lib/lumio/math-display";

type MathBudget = { remaining: number; limited: boolean; links: boolean };
function formula(node: Extract<InlineContent, { kind: "math" }>, key: number, inline: boolean, budget: MathBudget) {
  if (budget.remaining <= 0) { budget.limited = true; return null; }
  budget.remaining--;
  const display = node.display && !inline, result = renderEducationalMath(node.text, display, node.malformed);
  if ("fallback" in result)
    return <span key={key} className={`lm-math-fallback${display ? " lm-math-fallback--display" : ""}`} role="note" data-math-fallback>{result.fallback}</span>;
  const props = {
    className: `lm-math ${display ? "lm-math--display" : "lm-math--inline"}`,
    ...(!inline && (display || node.text.length > 80) ? { tabIndex: 0, "aria-label": "Công thức, có thể cuộn ngang" } : {}),
    "data-math-rendered": true,
    dangerouslySetInnerHTML: { __html: result.html },
  };
  return display ? <div key={key} {...props} /> : <span key={key} {...props} />;
}
function inlineNodes(nodes: InlineContent[], budget: MathBudget, inline = false): ReactNode[] {
  return nodes.map((node, i) => {
    if (node.kind === "math") return formula(node, i, inline, budget);
    if (node.kind === "code") return <code key={i}>{node.text}</code>;
    if (node.kind === "strong") return <strong key={i}>{inlineNodes(node.children, budget, true)}</strong>;
    if (node.kind === "em") return <em key={i}>{inlineNodes(node.children, budget, true)}</em>;
    if (node.kind === "link") return node.href && budget.links
      ? <a key={i} href={node.href} target="_blank" rel="noopener noreferrer">{inlineNodes(node.children, budget, true)}</a>
      : <span key={i}>{inlineNodes(node.children, budget, true)}</span>;
    return <Fragment key={i}>{node.text.split("\n").map((line, n) => <Fragment key={n}>{n > 0 && <br />}{line}</Fragment>)}</Fragment>;
  });
}
function paragraph(text: string, key: number, budget: MathBudget) {
  const output: ReactNode[] = [], pending: InlineContent[] = [];
  const flush = () => { if (pending.length) { output.push(<p key={output.length} className={/^(?:Bước|Step|步骤|ステップ|단계)\s*\d/i.test(text) ? "lm-answer-step" : undefined}>{inlineNodes(pending.splice(0), budget)}</p>); } };
  for (const node of parseInlineContent(text)) {
    if (node.kind === "math" && node.display) { flush(); output.push(formula(node, output.length, false, budget)); }
    else pending.push(node);
  }
  flush(); return <Fragment key={key}>{output}</Fragment>;
}

/** Presentation-only. inline is phrasing content for headings/buttons/cells;
 * block mode adds semantic Markdown. The original stored string is untouched. */
export function MathText({ text, inline = false }: { text: string; inline?: boolean }) {
  const source = typeof text === "string" ? text : "";
  const budget: MathBudget = { remaining: RICH_CONTENT_LIMITS.mathExpressions, limited: false, links: !inline };
  const mathLimitNotice = () => budget.limited && <span role="note">Một số công thức chưa hiển thị vì nội dung quá dài. Bản gốc vẫn được giữ nguyên.</span>;
  if (inline) return <span className="lm-math-text lm-rich-inline">{inlineNodes(parseInlineContent(source), budget, true)}{mathLimitNotice()}{source.length > RICH_CONTENT_LIMITS.characters && <span role="note">… Nội dung dài đã được rút gọn khi hiển thị.</span>}</span>;
  const content = parseRichContent(source);
  return <div className="lm-ai-output lm-rich-content">
    {content.blocks.map((block, i) => {
      if (block.kind === "paragraph") return paragraph(block.text, i, budget);
      if (block.kind === "heading") return createElement("h" + block.level, { key: i, className: "lm-rich-heading" }, inlineNodes(parseInlineContent(block.text), budget, true));
      if (block.kind === "math") return formula(block.content, i, false, budget);
      if (block.kind === "rule") return <hr key={i} />;
      if (block.kind === "quote") return <blockquote key={i}>{inlineNodes(parseInlineContent(block.text), budget)}</blockquote>;
      if (block.kind === "code") return <pre key={i} tabIndex={0} aria-label={block.language ? `Ví dụ mã ${block.language}` : "Ví dụ mã"}><code className={block.language ? "language-" + block.language : undefined}>{block.text}</code></pre>;
      if (block.kind === "list") {
        const children = block.items.map((item, n) => <li key={n}>{inlineNodes(parseInlineContent(item), budget, true)}</li>);
        return block.ordered ? <ol key={i} start={block.start}>{children}</ol> : <ul key={i}>{children}</ul>;
      }
      return <div className="lm-rich-table-scroll" key={i} tabIndex={0} aria-label="Bảng nội dung, có thể cuộn ngang"><table><caption>Bảng trong nội dung học tập</caption><thead><tr>{block.headers.map((cell, n) => <th scope="col" key={n}>{inlineNodes(parseInlineContent(cell), budget, true)}</th>)}</tr></thead><tbody>{block.rows.map((row, n) => <tr key={n}>{block.headers.map((_, c) => <td key={c}>{inlineNodes(parseInlineContent(row[c] || ""), budget, true)}</td>)}</tr>)}</tbody></table></div>;
    })}
    {mathLimitNotice()}
    {content.truncated && <p role="note">Nội dung dài đã được rút gọn khi hiển thị. Bản gốc vẫn được giữ nguyên.</p>}
  </div>;
}
