import katex from "katex";

const MATH_PARTS = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;
const DISPLAY_PARTS = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g;

function formula(part: string, key: number, inline = false) {
  const display = !inline && !part.startsWith("\\(");
  return (
    <span
      key={key}
      className={`lm-math ${display ? "lm-math--display" : "lm-math--inline"}`}
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(part.slice(2, -2).slice(0, 4000), {
          displayMode: display,
          throwOnError: false,
          trust: false,
          strict: "warn",
          maxExpand: 100,
          maxSize: 20,
        }),
      }}
    />
  );
}

function inlineParts(text: string) {
  return text
    .split(MATH_PARTS)
    .map((part, i) =>
      part.startsWith("$$") || part.startsWith("\\[") || part.startsWith("\\(")
        ? formula(part, i, true)
        : part,
    );
}

/** Text stays in its original line; only explicit display delimiters create a math block. */
export function MathText({
  text,
  inline = false,
}: {
  text: string;
  inline?: boolean;
}) {
  if (inline) return <span className="lm-math-text">{inlineParts(text)}</span>;
  return (
    <div className="lm-ai-output">
      {text.split(DISPLAY_PARTS).map((part, i) =>
        part.startsWith("$$") || part.startsWith("\\[") ? (
          formula(part, i)
        ) : (
          <span key={i}>
            {part.split("\n").map((line, j, lines) => {
              const heading = /^(?:#{1,4}\s+(.+)|\*\*(.+)\*\*)$/.exec(
                line.trim(),
              );
              const step =
                /^(?:(?:Bước|Step|步骤|ステップ|단계)\s*\d+|\d+[.)])\s*[:：]?\s*/i.test(
                  line.trim(),
                );
              return (
                <span
                  key={j}
                  className={
                    heading
                      ? "lm-answer-heading"
                      : step
                        ? "lm-answer-step"
                        : "lm-answer-line"
                  }
                >
                  {inlineParts(heading ? heading[1] || heading[2] : line)}
                  {j < lines.length - 1 ? "\n" : null}
                </span>
              );
            })}
          </span>
        ),
      )}
    </div>
  );
}
