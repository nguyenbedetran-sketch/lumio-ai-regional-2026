import type { MathVerification } from "./types";
import {
  checkExactArithmetic,
  checkExactEquation,
  checkExactEquivalence,
} from "./math-exact";

type Expr =
  | { kind: "number"; value: number }
  | { kind: "x" }
  | { kind: "neg" | "sqrt" | "ln" | "log10"; arg: Expr }
  | { kind: "+" | "-" | "*" | "/" | "^"; left: Expr; right: Expr };
type Polynomial = number[];
type Fraction = { numerator: Polynomial; denominator: Polynomial };
const EPS = 1e-8;
const close = (a: number, b: number) =>
  Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));
const trim = (p: Polynomial) => {
  while (p.length > 1 && p[p.length - 1] === 0) p.pop();
  return p;
};
function add(a: Polynomial, b: Polynomial, sign = 1) {
  return trim(
    Array.from(
      { length: Math.max(a.length, b.length) },
      (_, i) => (a[i] || 0) + sign * (b[i] || 0),
    ),
  );
}
function multiply(a: Polynomial, b: Polynomial) {
  if (a.length + b.length > 10) throw new Error("degree");
  const out = Array(a.length + b.length - 1).fill(0) as number[];
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
  if (out.some((x) => !Number.isFinite(x) || Math.abs(x) > 1e12))
    throw new Error("coefficient");
  return trim(out);
}
function fraction(node: Expr): Fraction {
  if (node.kind === "number")
    // Exact integer coefficients only in the independent solver. Decimal or
    // transcendental equations may still get substitution feedback, never a
    // false claim that completeness was proved by approximate cancellation.
    if (!Number.isSafeInteger(node.value))
      throw new Error("non-integer coefficient");
  if (node.kind === "number")
    return { numerator: [node.value], denominator: [1] };
  if (node.kind === "x") return { numerator: [0, 1], denominator: [1] };
  if (node.kind === "neg") {
    const p = fraction(node.arg);
    return { ...p, numerator: p.numerator.map((x) => -x) };
  }
  if ("arg" in node) throw new Error("non-polynomial");
  const a = fraction(node.left),
    b = fraction(node.right);
  if (node.kind === "+" || node.kind === "-")
    return {
      numerator: add(
        multiply(a.numerator, b.denominator),
        multiply(b.numerator, a.denominator),
        node.kind === "+" ? 1 : -1,
      ),
      denominator: multiply(a.denominator, b.denominator),
    };
  if (node.kind === "*")
    return {
      numerator: multiply(a.numerator, b.numerator),
      denominator: multiply(a.denominator, b.denominator),
    };
  if (node.kind === "/") {
    if (b.numerator.every((x) => x === 0)) throw new Error("zero denominator");
    return {
      numerator: multiply(a.numerator, b.denominator),
      denominator: multiply(a.denominator, b.numerator),
    };
  }
  if (
    node.right.kind !== "number" ||
    !Number.isInteger(node.right.value) ||
    node.right.value < 0 ||
    node.right.value > 4
  )
    throw new Error("exponent");
  let out: Fraction = { numerator: [1], denominator: [1] };
  for (let i = 0; i < node.right.value; i++)
    out = {
      numerator: multiply(out.numerator, a.numerator),
      denominator: multiply(out.denominator, a.denominator),
    };
  return out;
}
export function normalizeEquation(raw: string) {
  return raw
    .replace(/[−–]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\^\{(\d+)\}/g, "^$1")
    .replace(/\\(?:left|right)/g, "")
    .replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)")
    .replace(/\\sqrt/g, "sqrt")
    .replace(/√\(/g, "sqrt(")
    .replace(/\\(?:cdot|times)/g, "*")
    .replace(/\\(?:d?frac)\{([^{}]+)\}\{([^{}]+)\}/g, "(($1)/($2))")
    .replace(/\\[([]|\\[)\]]|\$/g, "")
    .trim();
}
function parseExpression(raw: string): Expr {
  const tokens =
    raw.match(/sqrt|log10|ln|x|(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/^]/g) || [];
  if (tokens.join("") !== raw.replace(/\s/g, "") || tokens.length > 160)
    throw new Error("syntax");
  let i = 0,
    depth = 0;
  function primary(): Expr {
    if (++depth > 30) throw new Error("depth");
    const token = tokens[i++];
    let value: Expr;
    if (token === "x") value = { kind: "x" };
    else if (token === "(") {
      value = sum();
      if (tokens[i++] !== ")") throw new Error("parenthesis");
    } else if (token === "sqrt" || token === "ln" || token === "log10") {
      if (tokens[i++] !== "(") throw new Error("function");
      value = { kind: token, arg: sum() };
      if (tokens[i++] !== ")") throw new Error("function");
    } else if (token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      const n = Number(token);
      if (!Number.isFinite(n) || n > 1e9) throw new Error("number");
      value = { kind: "number", value: n };
    } else throw new Error("value");
    depth--;
    return value;
  }
  function power(): Expr {
    let value = primary();
    if (tokens[i] === "^") {
      i++;
      value = { kind: "^", left: value, right: unary() };
    }
    return value;
  }
  function unary(): Expr {
    if (tokens[i] === "-") {
      i++;
      return { kind: "neg", arg: unary() };
    }
    if (tokens[i] === "+") {
      i++;
      return unary();
    }
    return power();
  }
  function product(): Expr {
    let value = unary();
    while (
      tokens[i] === "*" ||
      tokens[i] === "/" ||
      /^(x|\(|sqrt|ln|log10)$/.test(tokens[i] || "")
    ) {
      const op = tokens[i] === "/" ? "/" : "*";
      if (tokens[i] === "*" || tokens[i] === "/") i++;
      value = { kind: op, left: value, right: unary() };
    }
    return value;
  }
  function sum(): Expr {
    let value = product();
    while (tokens[i] === "+" || tokens[i] === "-") {
      const op = tokens[i++] as "+" | "-";
      value = { kind: op, left: value, right: product() };
    }
    return value;
  }
  const result = sum();
  if (i !== tokens.length) throw new Error("trailing");
  return result;
}
function show(n: Expr): string {
  if (n.kind === "number") return String(n.value);
  if (n.kind === "x") return "x";
  if ("arg" in n)
    return n.kind === "neg" ? `-(${show(n.arg)})` : `${n.kind}(${show(n.arg)})`;
  return `(${show(n.left)}${n.kind}${show(n.right)})`;
}
function conditions(n: Expr, out: string[]) {
  if ("arg" in n) {
    if (n.kind === "sqrt") out.push(`${show(n.arg)} >= 0`);
    if (n.kind === "ln" || n.kind === "log10") out.push(`${show(n.arg)} > 0`);
    conditions(n.arg, out);
  } else if ("left" in n) {
    if (n.kind === "/") out.push(`${show(n.right)} != 0`);
    conditions(n.left, out);
    conditions(n.right, out);
  }
}
function equationConditions(left: Expr, right: Expr) {
  const domain: string[] = [];
  conditions(left, domain);
  conditions(right, domain);
  if (left.kind === "sqrt" && right.kind !== "sqrt")
    domain.push(`${show(right)} >= 0`);
  if (right.kind === "sqrt" && left.kind !== "sqrt")
    domain.push(`${show(left)} >= 0`);
  return [...new Set(domain)];
}
function evaluate(n: Expr, x: number): number {
  if (n.kind === "number") return n.value;
  if (n.kind === "x") return x;
  if ("arg" in n) {
    const v = evaluate(n.arg, x);
    if (n.kind === "neg") return -v;
    if (n.kind === "sqrt") {
      if (v < -EPS) throw new Error("radicand_negative");
      return Math.sqrt(Math.max(0, v));
    }
    if (v <= 0) throw new Error("log_argument_nonpositive");
    return n.kind === "ln" ? Math.log(v) : Math.log10(v);
  }
  const a = evaluate(n.left, x),
    b = evaluate(n.right, x);
  if (n.kind === "/" && Math.abs(b) < EPS) throw new Error("denominator_zero");
  const value =
    n.kind === "+"
      ? a + b
      : n.kind === "-"
        ? a - b
        : n.kind === "*"
          ? a * b
          : n.kind === "/"
            ? a / b
            : a ** b;
  if (!Number.isFinite(value)) throw new Error("non_finite");
  return value;
}
function roots(p: Polynomial): number[] {
  trim(p);
  if (p.length === 1) {
    if (p[0] === 0) throw new Error("identity");
    return [];
  }
  if (p.length === 2) return [-p[0] / p[1]];
  if (p.length !== 3) throw new Error("degree");
  const [c, b, a] = p,
    d = b * b - 4 * a * c;
  if (
    !Number.isSafeInteger(b * b) ||
    !Number.isSafeInteger(4 * a * c) ||
    !Number.isSafeInteger(d)
  )
    throw new Error("precision range");
  if (d < 0) return [];
  if (d === 0) return [-b / (2 * a)];
  // Stable quadratic formula, then Vieta for the other root.
  const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(d));
  return [q / a, c / q].sort((x, y) => x - y);
}
export function extractEquation(problem: string): string | null {
  let text = normalizeEquation(problem);
  // A verifier must not guess an equation from several exercises or a word problem.
  if ((text.match(/=/g) || []).length !== 1 || text.length > 500) return null;
  text = text
    .replace(
      /^(?:Giải(?:\s+phương trình)?|Tìm x(?:\s+biết)?|Solve(?:\s+the\s+equation)?|Equation|Phương trình)\s*:?\s*/i,
      "",
    )
    .replace(/[.;?]+$/, "")
    .trim();
  if (!/^[\dx\s.+\-*/^()=sqrtlnog]+$/.test(text)) return null;
  try {
    const [left, right] = text.split("=");
    parseExpression(left);
    parseExpression(right);
    return text;
  } catch {
    return null;
  }
}
export function mathReference(
  problem: string,
): { equation: string; solutions: number[]; conditions: string[] } | null {
  const equation = extractEquation(problem);
  if (!equation) return null;
  try {
    const [l, r] = equation.split("="),
      left = parseExpression(l),
      right = parseExpression(r);
    let equationNode: Expr = { kind: "-", left, right };
    // A single square root equated to a rational expression: square, then check every root in the ORIGINAL expression.
    if (left.kind === "sqrt" || right.kind === "sqrt") {
      const radical =
        left.kind === "sqrt" ? left : (right as Extract<Expr, { arg: Expr }>);
      const other = left.kind === "sqrt" ? right : left;
      equationNode = {
        kind: "-",
        left: radical.arg,
        right: { kind: "^", left: other, right: { kind: "number", value: 2 } },
      };
    }
    const p = fraction(equationNode),
      proposed = roots(p.numerator),
      domain = equationConditions(left, right);
    const solutions = proposed.filter((x) => {
      try {
        return close(evaluate(left, x), evaluate(right, x));
      } catch {
        return false;
      }
    });
    if (solutions.some((x) => Math.abs(x) > 1e6)) return null;
    return {
      equation,
      solutions,
      conditions: [...new Set(domain)],
    };
  } catch {
    return null;
  }
}
export function verifyMathCandidates(
  problem: string,
  proposed: number[],
): MathVerification {
  const equation = extractEquation(problem);
  if (!equation)
    return {
      status: "not_supported",
      scope: {
        candidates: "not_supported",
        domain: "not_supported",
        completeness: "not_supported",
        steps: "not_checked",
        arithmetic: "not_checked",
        reasoning: "not_checked",
      },
      note: "Chưa kiểm chứng độc lập: bộ kiểm tra chỉ hỗ trợ phương trình một ẩn x với cú pháp rõ ràng. Không suy đoán dữ kiện còn thiếu.",
    };
  const [l, r] = equation.split("="),
    left = parseExpression(l),
    right = parseExpression(r),
    domain = equationConditions(left, right);
  const numerical = proposed.map((value) => {
    try {
      return {
        value,
        valid: close(evaluate(left, value), evaluate(right, value)),
        reason: close(evaluate(left, value), evaluate(right, value))
          ? undefined
          : "substitution_mismatch",
      };
    } catch (e) {
      return {
        value,
        valid: false,
        reason: e instanceof Error ? e.message : "domain_error",
      };
    }
  });
  const reference = mathReference(problem);
  const numericalComplete = reference
    ? reference.solutions.every((x) => proposed.some((y) => close(x, y))) &&
      proposed.every((x) => reference.solutions.some((y) => close(x, y)))
    : undefined;
  const exact = checkExactEquation(equation, proposed);
  const candidates = proposed.map((value, i) => {
    const result = exact?.candidates[i],
      numeric = numerical[i];
    if (result?.state === "exact") return { value, valid: true };
    if (result?.domain === "violated")
      return { value, valid: false, reason: result.reason };
    // An approximately matching numeric label can never receive an exact badge.
    // This also permits a model's JSON number for 1/3 or sqrt(2) without claiming
    // its finite decimal expansion is an algebraic proof.
    if (numeric.valid)
      return { value, valid: true, reason: "approximate_only" };
    if (result?.state === "invalid")
      return { value, valid: false, reason: result.reason };
    return {
      value,
      valid: false,
      reason: result?.reason || "symbolic_scope_unsupported",
    };
  });
  const exactCandidates =
    !!exact &&
    exact.candidates.every((candidate) => candidate.state === "exact");
  const approximate = candidates.some(
    (candidate) => candidate.reason === "approximate_only",
  );
  const complete =
    approximate && numericalComplete !== false ? undefined : exact?.complete;
  const definiteInvalid = candidates.some(
    (candidate, i) =>
      !candidate.valid &&
      (exact?.candidates[i]?.state === "invalid" ||
        (numerical[i].reason !== undefined &&
          numerical[i].reason !== "substitution_mismatch")),
  );
  return {
    status:
      definiteInvalid || complete === false
        ? "inconsistent"
        : exactCandidates && complete === true
          ? "verified"
          : "not_supported",
    equation,
    candidates,
    conditions: [...new Set(domain)]
      .slice(0, 8)
      .map((condition) =>
        condition.length > 160 ? condition.slice(0, 157) + "…" : condition,
      ),
    complete,
    scope: {
      candidates: exactCandidates
        ? "exact"
        : approximate
          ? "approximate_only"
          : "not_supported",
      domain:
        exact?.domain === "checked"
          ? "checked"
          : exact?.domain === "partial"
            ? "partial"
            : "not_supported",
      completeness:
        complete === true
          ? "proved"
          : complete === false
            ? "incomplete"
            : "not_supported",
      steps: "not_checked",
      arithmetic: "not_checked",
      reasoning: "not_checked",
    },
    method:
      "Số hữu tỉ BigInt và đa thức có giới hạn; đối chiếu miền xác định, nghiệm và tính đủ nghiệm riêng biệt. Kiểm tra số gần đúng chỉ là thông tin tham khảo.",
    note:
      exactCandidates && complete === true
        ? "Đã đối chiếu chính xác tập nghiệm trong phạm vi hỗ trợ. Chưa chứng minh lời văn hay mọi bước lập luận."
        : "Chưa có chứng minh chính xác đầy đủ. Kết quả số gần đúng, nếu có, không xác nhận tuyệt đối biểu thức đại số.",
  };
}
/** Inspect explicitly asserted equivalences only; never infer proof from prose. */
export function verifyMathSolution(
  problem: string,
  proposed: number[],
  solution: string,
): MathVerification {
  const result = verifyMathCandidates(problem, proposed),
    original = extractEquation(problem);
  if (!original || !result.scope) return result;
  const blocks: string[] = [];
  for (const m of solution
    .slice(0, 20000)
    .matchAll(
      /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g,
    ))
    blocks.push(m[1] ?? m[2] ?? m[3] ?? m[4]);
  for (const line of solution.split(/\r?\n/).slice(0, 100)) {
    const clean = line.trim().replace(/^```(?:math)?$/, "");
    if (
      clean.includes("=") &&
      /^[\dx\s.+\-*/^()=<>⇔⇒→√²³×·÷−–\\{}a-z]+$/.test(clean)
    )
      blocks.push(clean);
  }
  const allBlocks = [...new Set(blocks)],
    unique = allBlocks.slice(0, 24),
    steps: NonNullable<MathVerification["explicitSteps"]> = [],
    calculations: NonNullable<MathVerification["calculations"]> = [];
  let unsupported = allBlocks.length > 24,
    arithmeticPartial = allBlocks.length > 24;
  for (const raw of unique) {
    if (raw.length > 1500) {
      unsupported = true;
      arithmeticPartial = true;
      continue;
    }
    const chain = raw
      .split(/⇔|<=>|\\(?:Leftrightarrow|Longleftrightarrow|iff)\b/)
      .map(normalizeEquation);
    if (chain.length > 1) {
      for (let i = 1; i < chain.length; i++) {
        if (
          steps.length >= 4 ||
          chain[i - 1].length > 180 ||
          chain[i].length > 180
        ) {
          unsupported = true;
          continue;
        }
        steps.push(checkExactEquivalence(original, chain[i - 1], chain[i]));
      }
    } else {
      const normalized = normalizeEquation(raw);
      if (normalized.includes("=") && !normalized.includes("x")) {
        if (calculations.length < 4 && normalized.length <= 180)
          calculations.push({
            equation: normalized,
            status: checkExactArithmetic(normalized),
          });
        else arithmeticPartial = true;
      } else if (normalized.includes("=")) unsupported = true;
    }
  }
  result.explicitSteps = steps;
  result.calculations = calculations;
  result.scope.steps = steps.some((step) => step.status === "not_equivalent")
    ? "inconsistent"
    : steps.length &&
        !unsupported &&
        steps.every((step) => step.status === "equivalent")
      ? "exact"
      : steps.length || unsupported
        ? "partial"
        : "not_checked";
  result.scope.arithmetic = calculations.some((c) => c.status === "invalid")
    ? "inconsistent"
    : calculations.length &&
        !arithmeticPartial &&
        calculations.every((c) => c.status === "exact")
      ? "exact"
      : calculations.length || arithmeticPartial
        ? "partial"
        : "not_checked";
  if (
    result.scope.steps === "inconsistent" ||
    result.scope.arithmetic === "inconsistent"
  ) {
    result.status = "inconsistent";
    result.note =
      "Một bước tương đương hoặc phép tính được viết rõ không khớp kiểm tra chính xác. Không coi lời giải này là đã được xác minh.";
  }
  return result;
}
export function checkStudentAnswer(
  problem: string,
  answer: string,
): MathVerification | undefined {
  if (!extractEquation(problem)) return;
  const numbers = [
    ...answer.matchAll(
      /(?:\bx\s*=\s*|\bnghiệm\s*(?:là|=|:)?\s*|\bđáp án\s*(?:là|=|:)?\s*)(-?(?:\d+\s*\/\s*\d+|\d+(?:\.\d+)?))/gi,
    ),
  ].map((m) => m[1]);
  if (!numbers.length) {
    const alone = answer
      .trim()
      .match(/^(-?(?:\d+\s*\/\s*\d+|\d+(?:\.\d+)?))\s*[.!]?$/);
    if (alone) numbers.push(alone[1]);
  }
  if (!numbers.length || numbers.length > 8) return;
  const values = numbers.map((n) => {
    const parts = n.split("/").map(Number);
    return parts.length === 2 ? parts[0] / parts[1] : parts[0];
  });
  if (values.some((value) => !Number.isFinite(value))) return;
  const result = verifyMathCandidates(problem, values);
  // A single correct root is useful progress even when another root remains.
  return {
    ...result,
    status:
      result.scope?.candidates === "exact"
        ? "verified"
        : result.status === "inconsistent" &&
            result.candidates?.some((candidate) => !candidate.valid)
          ? "inconsistent"
          : "not_supported",
    complete: undefined,
    scope: result.scope
      ? { ...result.scope, completeness: "not_requested" }
      : undefined,
    note: "Chỉ đối chiếu giá trị học sinh vừa thử; không coi đây là lời giải đầy đủ.",
  };
}
