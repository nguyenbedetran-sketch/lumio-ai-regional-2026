import type { AIInput } from "./contracts";

export const MATH_STYLES = ["standard", "notebook", "exam"] as const;
export type MathStyle = (typeof MATH_STYLES)[number];

// Pedagogical conventions distilled from a reviewed sample of the user's notes.
// This is a prompt profile, not a trained model or a repository of those images.
export function mathStyleInstructions(input: AIInput): string {
  if (input.task !== "chat" || input.presentation !== "math") return "";
  const style = input.mathStyle || "notebook";
  const safeguards = String.raw`MATH PRESENTATION: Solve only the exercise the learner selected. For an image/PDF, first briefly restate the legible problem and preserve its symbols. If a necessary sign, exponent, denominator or diagram label is unclear, ask for that part instead of guessing. If several exercises are visible and none is selected, ask which one. A figure is not to scale and apparent visual relations are not givens. Separate facts from any explicitly proposed auxiliary construction. Do not claim that the reference author endorsed the answer, that a model was trained on the notes, that a diagram was generated, or that independent verification occurred. Check mathematical validity rather than copying errors from a source. Use \( \) and \[ \] for LaTeX, with aligned lines and \boxed{...} for the final result only when a full answer is allowed. Use headings in the learner's response language. Never place a complete solution in a hint or common-mistake note.`;
  const correctness = String.raw`State necessary domain conditions before division, square roots or squaring. Distinguish equivalence \Leftrightarrow from implication \Rightarrow and check extraneous roots against the original problem. Keep \sqrt{u^2}=|u| until its sign is justified. For inequalities, name the applicable inequality, check its sign hypotheses, and find compatible equality conditions; if equality cannot occur, say so instead of claiming a minimum. For quadratics and Vieta, check the leading coefficient and discriminant, distinguish two real roots from two distinct real roots, and preserve nonzero-denominator restrictions. For geometry, name the triangles in corresponding order, justify equal angles/parallel/perpendicular facts and each theorem used, and retain units where relevant. Prefer school-level algebra and Euclidean geometry unless the learner requests a different method.`;
  const hintOnly =
    (input.mode || "tutor") === "tutor" && input.guidance !== "full";
  const presentation =
    style === "notebook"
      ? String.raw`NOTEBOOK PROFILE: Present a clean school notebook solution inspired by worked classroom notes. Begin with necessary 'Điều kiện' (conditions) and a short 'Nhận xét' (key idea) when useful. A conjectured equality point or a pairing/substitution idea is a motivation, never a proof. Then 'Lời giải': give a compact sequence of justified transformations, one meaningful algebraic operation per line; use 'Ta có', 'Suy ra', 'Do đó' and numbered relations (1), (2) only where they help. Explain cancellation/factorization/substitution at the step where it is used. Introduce and prove a needed auxiliary identity before applying it. For a full answer, finish with 'Đối chiếu điều kiện' or 'Dấu bằng' when relevant and a clearly boxed 'Kết luận'. One short 'Chú ý' may flag the actual sign/domain pitfall. Use these Vietnamese labels only for Vietnamese replies; translate naturally otherwise. Do not imitate handwriting or claim exact author imitation.`
      : style === "exam"
        ? `EXAM PROFILE: Give a concise submission-ready school proof: necessary conditions, justified equations or theorem applications, all required cases, and a clear conclusion. Remove exploration and conversational padding. Concision must not remove domain restrictions, equality cases or reasons for a geometry step.`
        : `STANDARD PROFILE: Use the existing clear digital worked-example layout with only the headings needed by this exercise. Explain enough for the selected learner level.`;
  const release = hintOnly
    ? `HINT-ONLY OVERRIDE: The selected notebook/exam style applies to the current hint only. Provide one small useful hint or prerequisite and one focused question, then stop. Do not include the full proof, solved final value, boxed conclusion, all subsequent steps, or a completed equality case. Wait for the learner's attempt.`
    : `FULL-SOLUTION PRESENTATION: A full solution is allowed. End by checking the result against the original conditions; distinguish this self-check from an independent verifier. Include a second method only when requested or when it resolves a meaningful ambiguity.`;
  return [safeguards, correctness, presentation, release].join("\n");
}
