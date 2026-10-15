/** Bounded exact arithmetic. No eval, sampling, CAS/network calls or model assertions. */
export type ExactState = "exact" | "invalid" | "unknown";
export type ExactCandidate = {
  value: number;
  state: ExactState;
  domain: "checked" | "violated" | "unknown";
  reason?: string;
};
export type ExactEquationCheck = {
  candidates: ExactCandidate[];
  complete?: boolean;
  completeness: "proved" | "incomplete" | "unknown";
  domain: "checked" | "partial" | "unknown";
};
export type ExactStepCheck = {
  from: string;
  to: string;
  status: "equivalent" | "not_equivalent" | "not_supported";
  method: "exact_rational_polynomial";
  note: string;
};
type Q = { n: bigint; d: bigint };
type P = Q[];
type Node =
  | { k: "q"; q: Q }
  | { k: "x" }
  | { k: "neg" | "sqrt" | "ln" | "log10"; arg: Node }
  | { k: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node };
type F = { n: P; d: P };
type Equation = { left: Node; right: Node };
const ZERO: Q = { n: 0n, d: 1n },
  ONE: Q = { n: 1n, d: 1n };
const MAX_DIGITS = 160,
  MAX_DEGREE = 8;
const abs = (n: bigint) => (n < 0n ? -n : n);
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
function q(n: bigint, d = 1n): Q {
  if (!d) throw Error("denominator_zero");
  if (
    abs(n).toString().length > MAX_DIGITS ||
    abs(d).toString().length > MAX_DIGITS
  )
    throw Error("arithmetic_limit");
  if (!n) return ZERO;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const plus = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const minus = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const times = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const divide = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const same = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
const key = (v: Q) => `${v.n}/${v.d}`;
function decimal(text: string): Q {
  if (text.length > 180) throw Error("number_limit");
  const m = text.match(/^(-?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!m || !(m[2] || m[3])) throw Error("number");
  const exponent = Number(m[4] || 0) - (m[3]?.length || 0);
  if (Math.abs(exponent) > 160) throw Error("number_limit");
  const n = BigInt((m[1] || "") + (m[2] || "0") + (m[3] || ""));
  return exponent >= 0
    ? q(n * 10n ** BigInt(exponent))
    : q(n, 10n ** BigInt(-exponent));
}
function trim(p: P): P {
  while (p.length > 1 && p.at(-1)!.n === 0n) p.pop();
  return p;
}
function add(a: P, b: P, negative = false): P {
  return trim(
    Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
      negative
        ? minus(a[i] || ZERO, b[i] || ZERO)
        : plus(a[i] || ZERO, b[i] || ZERO),
    ),
  );
}
function mul(a: P, b: P): P {
  if (a.length + b.length - 2 > MAX_DEGREE) throw Error("degree_limit");
  const out: P = Array.from({ length: a.length + b.length - 1 }, () => ZERO);
  a.forEach((x, i) =>
    b.forEach((y, j) => {
      out[i + j] = plus(out[i + j], times(x, y));
    }),
  );
  return trim(out);
}
const zero = (p: P) => p.every((v) => v.n === 0n);
function proportional(a: P, b: P) {
  if (zero(a) || zero(b)) return zero(a) && zero(b);
  if (a.length !== b.length) return false;
  const ratio = divide(a.at(-1)!, b.at(-1)!);
  return a.every((v, i) => same(v, times(b[i], ratio)));
}
function parse(raw: string): Node {
  const tokens =
    raw.match(/sqrt|log10|ln|x|(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/^]/g) || [];
  if (tokens.join("") !== raw.replace(/\s/g, "") || tokens.length > 160)
    throw Error("syntax");
  let i = 0,
    depth = 0;
  function primary(): Node {
    if (++depth > 30) throw Error("depth");
    const token = tokens[i++];
    let value: Node;
    if (token === "x") value = { k: "x" };
    else if (token === "(") {
      value = sum();
      if (tokens[i++] !== ")") throw Error("parenthesis");
    } else if (token === "sqrt" || token === "ln" || token === "log10") {
      if (tokens[i++] !== "(") throw Error("function");
      value = { k: token, arg: sum() };
      if (tokens[i++] !== ")") throw Error("function");
    } else if (token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token))
      value = { k: "q", q: decimal(token) };
    else throw Error("value");
    depth--;
    return value;
  }
  function power(): Node {
    let value = primary();
    if (tokens[i] === "^") {
      i++;
      value = { k: "^", a: value, b: unary() };
    }
    return value;
  }
  function unary(): Node {
    if (tokens[i] === "-") {
      i++;
      return { k: "neg", arg: unary() };
    }
    if (tokens[i] === "+") {
      i++;
      return unary();
    }
    return power();
  }
  function product(): Node {
    let value = unary();
    while (
      tokens[i] === "*" ||
      tokens[i] === "/" ||
      /^(x|\(|sqrt|ln|log10)$/.test(tokens[i] || "")
    ) {
      const k = tokens[i] === "/" ? "/" : "*";
      if (tokens[i] === "*" || tokens[i] === "/") i++;
      value = { k, a: value, b: unary() };
    }
    return value;
  }
  function sum(): Node {
    let value = product();
    while (tokens[i] === "+" || tokens[i] === "-")
      value = { k: tokens[i++] as "+" | "-", a: value, b: product() };
    return value;
  }
  const result = sum();
  if (i !== tokens.length) throw Error("trailing");
  return result;
}
function exponent(n: Node): number {
  if (n.k !== "q" || n.q.d !== 1n || n.q.n < 0n || n.q.n > 4n)
    throw Error("exponent");
  return Number(n.q.n);
}
function fraction(n: Node): F {
  if (n.k === "q") return { n: [n.q], d: [ONE] };
  if (n.k === "x") return { n: [ZERO, ONE], d: [ONE] };
  if (n.k === "neg") {
    const f = fraction(n.arg);
    return { n: f.n.map((v) => minus(ZERO, v)), d: f.d };
  }
  if ("arg" in n) throw Error("non_rational_expression");
  const a = fraction(n.a);
  if (n.k === "^") {
    let result: F = { n: [ONE], d: [ONE] };
    for (let i = 0; i < exponent(n.b); i++)
      result = { n: mul(result.n, a.n), d: mul(result.d, a.d) };
    return result;
  }
  const b = fraction(n.b);
  if (n.k === "+" || n.k === "-")
    return {
      n: add(mul(a.n, b.d), mul(b.n, a.d), n.k === "-"),
      d: mul(a.d, b.d),
    };
  if (n.k === "*") return { n: mul(a.n, b.n), d: mul(a.d, b.d) };
  if (zero(b.n)) throw Error("denominator_zero");
  return { n: mul(a.n, b.d), d: mul(a.d, b.n) };
}
function sqrtInteger(n: bigint): bigint | null {
  if (n < 0n) return null;
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  while (true) {
    const y = (x + n / x) / 2n;
    if (y >= x) return x * x === n ? x : null;
    x = y;
  }
}
function squareRoot(v: Q): Q | null {
  const n = sqrtInteger(v.n),
    d = sqrtInteger(v.d);
  return n === null || d === null ? null : q(n, d);
}
function at(n: Node, x: Q): Q {
  if (n.k === "q") return n.q;
  if (n.k === "x") return x;
  if ("arg" in n) {
    const v = at(n.arg, x);
    if (n.k === "neg") return minus(ZERO, v);
    if (n.k === "sqrt") {
      if (v.n < 0n) throw Error("radicand_negative");
      const root = squareRoot(v);
      if (root) return root;
      throw Error("irrational_value");
    }
    if (v.n <= 0n) throw Error("log_argument_nonpositive");
    throw Error("transcendental_value");
  }
  const a = at(n.a, x);
  if (n.k === "^") {
    const p = exponent(n.b);
    return q(a.n ** BigInt(p), a.d ** BigInt(p));
  }
  const b = at(n.b, x);
  return n.k === "+"
    ? plus(a, b)
    : n.k === "-"
      ? minus(a, b)
      : n.k === "*"
        ? times(a, b)
        : divide(a, b);
}
function domain(n: Node, x: Q) {
  if ("arg" in n) {
    domain(n.arg, x);
    if (n.k !== "neg") {
      const value = at(n.arg, x);
      if (n.k === "sqrt" && value.n < 0n) throw Error("radicand_negative");
      if ((n.k === "ln" || n.k === "log10") && value.n <= 0n)
        throw Error("log_argument_nonpositive");
    }
  } else if ("a" in n) {
    domain(n.a, x);
    domain(n.b, x);
    if (n.k === "/" && !at(n.b, x).n) throw Error("denominator_zero");
    if (n.k === "^" && exponent(n.b) === 0 && !at(n.a, x).n)
      throw Error("zero_power_zero");
  }
}
function equality(e: Equation, x: Q): boolean | null {
  domain(e.left, x);
  domain(e.right, x);
  // Squaring is sound here only together with the original nonnegative side.
  if (e.left.k === "sqrt" || e.right.k === "sqrt") {
    const radical =
      e.left.k === "sqrt" ? e.left : (e.right as Extract<Node, { arg: Node }>);
    const other = at(e.left.k === "sqrt" ? e.right : e.left, x);
    return other.n >= 0n && same(at(radical.arg, x), times(other, other));
  }
  try {
    return same(at(e.left, x), at(e.right, x));
  } catch (error) {
    if (
      error instanceof Error &&
      /^(irrational_value|transcendental_value)$/.test(error.message)
    )
      return null;
    throw error;
  }
}
function equation(raw: string): Equation {
  if (raw.length > 500 || raw.split("=").length !== 2) throw Error("equation");
  const [left, right] = raw.split("=");
  return { left: parse(left), right: parse(right) };
}
function equationFraction(e: Equation): F {
  let left = e.left,
    right = e.right;
  if (left.k === "sqrt") {
    left = left.arg;
    right = { k: "^", a: right, b: { k: "q", q: q(2n) } };
  } else if (right.k === "sqrt") {
    right = right.arg;
    left = { k: "^", a: left, b: { k: "q", q: q(2n) } };
  }
  return fraction({ k: "-", a: left, b: right });
}
function rationalRoots(p: P): Q[] | null {
  trim(p);
  if (p.length === 1) return p[0].n ? [] : null; // All reals is not a finite complete set.
  if (p.length === 2) return [divide(minus(ZERO, p[0]), p[1])];
  if (p.length !== 3) return null;
  const [c, b, a] = p,
    discriminant = minus(times(b, b), times(q(4n), times(a, c)));
  if (discriminant.n < 0n) return [];
  const root = squareRoot(discriminant);
  if (!root) return null;
  const denominator = times(q(2n), a);
  const values = [
    divide(minus(minus(ZERO, b), root), denominator),
    divide(plus(minus(ZERO, b), root), denominator),
  ];
  return [...new Map(values.map((v) => [key(v), v])).values()];
}
function solutions(e: Equation): Q[] | null {
  const roots = rationalRoots(equationFraction(e).n);
  if (!roots) return null;
  const result: Q[] = [];
  for (const root of roots) {
    try {
      const valid = equality(e, root);
      if (valid === null) return null;
      if (valid) result.push(root);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !/^(denominator_zero|radicand_negative|log_argument_nonpositive|zero_power_zero)$/.test(
          error.message,
        )
      )
        return null;
    }
  }
  return result;
}
const domainError = (reason: string) =>
  /^(denominator_zero|radicand_negative|log_argument_nonpositive|zero_power_zero)$/.test(
    reason,
  );
/** Numbers arriving in JSON are exact decimal labels, never silently snapped to roots. */
export function checkExactEquation(
  raw: string,
  values: number[],
): ExactEquationCheck | null {
  try {
    const parsed = equation(raw);
    let reference: Q[] | null = null;
    try {
      reference = solutions(parsed);
    } catch {
      /* Explicit unknown, not a numerical proof. */
    }
    const candidates = values.map((value): ExactCandidate => {
      if (!Number.isFinite(value))
        return {
          value,
          state: "invalid",
          domain: "unknown",
          reason: "non_finite",
        };
      try {
        const x = decimal(String(value));
        domain(parsed.left, x);
        domain(parsed.right, x);
        const valid = equality(parsed, x);
        if (valid === null)
          return {
            value,
            state: "unknown",
            domain: "checked",
            reason: "symbolic_scope_unsupported",
          };
        if (valid) return { value, state: "exact", domain: "checked" };
        // A recurring rational root has no exact JSON-number representation.
        // A rounded display may be useful, but cannot earn an exact badge.
        if (
          reference?.some((root) => Number(root.n) / Number(root.d) === value)
        )
          return {
            value,
            state: "unknown",
            domain: "checked",
            reason: "rounded_root_representation",
          };
        return {
          value,
          state: "invalid",
          domain: "checked",
          reason: "exact_substitution_mismatch",
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : "unsupported";
        return {
          value,
          state: domainError(reason) ? "invalid" : "unknown",
          domain: domainError(reason) ? "violated" : "unknown",
          reason,
        };
      }
    });
    let complete: boolean | undefined;
    if (reference) {
      const exactValues = values.map((value) => decimal(String(value)));
      const exactMatch =
        reference.every((root) => exactValues.some((v) => same(root, v))) &&
        exactValues.every((v) => reference!.some((root) => same(root, v)));
      const roundedMatch =
        reference.every((root) =>
          values.includes(Number(root.n) / Number(root.d)),
        ) &&
        values.every((v) =>
          reference!.some((root) => Number(root.n) / Number(root.d) === v),
        );
      complete = exactMatch ? true : roundedMatch ? undefined : false;
    }
    return {
      candidates,
      complete,
      completeness:
        complete === true
          ? "proved"
          : complete === false
            ? "incomplete"
            : "unknown",
      domain: !candidates.length
        ? reference
          ? "checked"
          : "unknown"
        : candidates.every((v) => v.domain !== "unknown")
          ? "checked"
          : candidates.some(
                (v) => v.domain === "checked" || v.domain === "violated",
              )
            ? "partial"
            : "unknown",
    };
  } catch {
    return null;
  }
}
function restrictions(n: Node, out: P[]) {
  if ("arg" in n) {
    if (n.k !== "neg") throw Error("non_rational_domain");
    restrictions(n.arg, out);
  } else if ("a" in n) {
    restrictions(n.a, out);
    restrictions(n.b, out);
    if (n.k === "/") out.push(fraction(n.b).n);
    if (n.k === "^" && exponent(n.b) === 0) out.push(fraction(n.a).n);
  }
}
function sameDomain(a: Equation, b: Equation) {
  const aa: P[] = [],
    bb: P[] = [];
  restrictions(a.left, aa);
  restrictions(a.right, aa);
  restrictions(b.left, bb);
  restrictions(b.right, bb);
  const relevant = (p: P) => p.length > 1 || zero(p);
  return (
    aa.filter(relevant).every((p) => bb.some((v) => proportional(p, v))) &&
    bb.filter(relevant).every((p) => aa.some((v) => proportional(p, v)))
  );
}
/** Checks equivalence over the original exercise's domain, not over an invented domain. */
export function checkExactEquivalence(
  original: string,
  from: string,
  to: string,
): ExactStepCheck {
  const base: ExactStepCheck = {
    from,
    to,
    status: "not_supported",
    method: "exact_rational_polynomial",
    note: "Chỉ kiểm tra các phương trình hữu tỉ một ẩn trong miền xác định của đề gốc; không chứng minh lời văn.",
  };
  try {
    const context = equation(original),
      a = equation(from),
      b = equation(to);
    // Do not treat squaring a radical as a reversible rational operation.
    restrictions(context.left, []);
    restrictions(context.right, []);
    const aa = solutions(a),
      bb = solutions(b);
    const inDomain = (root: Q) => {
      try {
        domain(context.left, root);
        domain(context.right, root);
        return true;
      } catch (error) {
        if (error instanceof Error && domainError(error.message)) return false;
        throw error;
      }
    };
    if (aa && bb) {
      const av = aa.filter(inDomain),
        bv = bb.filter(inDomain);
      const equal =
        av.every((v) => bv.some((w) => same(v, w))) &&
        bv.every((v) => av.some((w) => same(v, w)));
      return {
        ...base,
        status: equal ? "equivalent" : "not_equivalent",
        note: equal
          ? "Hai tập nghiệm hữu tỉ hữu hạn trùng nhau chính xác trong miền xác định của đề gốc."
          : "Biến đổi làm thay đổi tập nghiệm trong miền xác định của đề gốc.",
      };
    }
    // Sufficient symbolic criterion, including irrational roots: proportional
    // rational polynomial numerators with identical expression domains.
    if (
      sameDomain(a, b) &&
      proportional(equationFraction(a).n, equationFraction(b).n)
    )
      return {
        ...base,
        status: "equivalent",
        note: "Hai đa thức tử số tỉ lệ chính xác và miền xác định của hai biểu thức trùng nhau; phạm vi chỉ là bước được nêu.",
      };
    return base;
  } catch {
    return base;
  }
}
/** Constant equalities are checked separately from a chain of solving for x. */
export function checkExactArithmetic(
  raw: string,
): "exact" | "invalid" | "unknown" {
  if (/x/.test(raw)) return "unknown";
  try {
    const result = equality(equation(raw), ZERO);
    return result === null ? "unknown" : result ? "exact" : "invalid";
  } catch {
    return "unknown";
  }
}
