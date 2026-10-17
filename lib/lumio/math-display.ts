import katex from "katex";
import { RICH_CONTENT_LIMITS } from "./rich-content";

/** Render-only, fresh macro state and no trusted HTML/URLs or user CSS. */
export function renderEducationalMath(tex: string, display: boolean, malformed = false): { html: string } | { fallback: string } {
  if (malformed || !tex.trim() || tex.length > RICH_CONTENT_LIMITS.math || /\\(?:href|url|includegraphics|html\w*|style|class|color|def|gdef|edef|xdef|let|newcommand|renewcommand|providecommand|require|input|include|csname)\b/i.test(tex))
    return { fallback: "Công thức cần kiểm tra" };
  try {
    return { html: katex.renderToString(tex, { displayMode: display, output: "htmlAndMathml", throwOnError: true, trust: false, strict: "ignore", maxExpand: 100, maxSize: 20, macros: {} }) };
  } catch { return { fallback: "Công thức cần kiểm tra" }; }
}
