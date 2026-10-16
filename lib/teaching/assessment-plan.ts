import type {
  AssignmentQuestion,
  QuestionKind,
  TeachingDifficulty,
} from "./contracts";
import { teachingLimits } from "./contracts";
import { PlatformError } from "../server/types";
import { integer, obj, only, str } from "./validation";

export interface AssessmentBlueprintCell {
  topic: string;
  difficulty: TeachingDifficulty;
  kind: QuestionKind;
  count: number;
}
export interface AssessmentShortage {
  row: number;
  requested: number;
  available: number;
  missing: number;
}
export class AssessmentShortageError extends PlatformError {
  constructor(readonly shortages: AssessmentShortage[]) {
    super("TEACHING_BLUEPRINT_SHORTAGE", 422);
  }
}
const normalize = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
/** Preserve superscripts/math glyphs; NFC/spacing/case only, not semantic equivalence. */
export const assessmentPromptKey = (value: string) =>
  value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");

export function parseAssessmentBlueprint(
  raw: unknown,
): AssessmentBlueprintCell[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 12)
    throw new PlatformError("INVALID_ASSESSMENT_BLUEPRINT", 400);
  const seen = new Set<string>();
  const cells = raw.map((value) => {
    const v = obj(value);
    only(v, ["topic", "difficulty", "kind", "count"]);
    const topic = str(v.topic, 100),
      difficulty = str(v.difficulty, 20),
      kind = str(v.kind, 20);
    if (
      !["basic", "medium", "advanced"].includes(difficulty) ||
      !["mcq", "short", "essay"].includes(kind)
    )
      throw new PlatformError("INVALID_ASSESSMENT_BLUEPRINT", 400);
    const key = JSON.stringify([normalize(topic), difficulty, kind]);
    if (seen.has(key)) throw new PlatformError("DUPLICATE_BLUEPRINT_CELL", 400);
    seen.add(key);
    return {
      topic,
      difficulty: difficulty as TeachingDifficulty,
      kind: kind as QuestionKind,
      count: integer(v.count, 1, teachingLimits.questionsPerAssignment),
    };
  });
  if (
    cells.reduce((n, c) => n + c.count, 0) >
    teachingLimits.questionsPerAssignment
  )
    throw new PlatformError("INVALID_ASSESSMENT_BLUEPRINT", 400);
  return cells;
}

/** The caller must supply only the reviewed bank visible to this actor AND target class. */
export function composeAssessment(
  cells: readonly AssessmentBlueprintCell[],
  bank: readonly AssignmentQuestion[],
) {
  const shortages: AssessmentShortage[] = [];
  // Stable ordering makes previews and retry results reproducible without claiming random exams.
  const seenIds = new Set<string>();
  const ordered = [...bank]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .filter((q) => {
      if (seenIds.has(q.id)) return false;
      seenIds.add(q.id);
      return true;
    });
  const candidates = cells.map((cell) =>
    ordered.filter(
      (q) =>
        normalize(q.topic) === normalize(cell.topic) &&
        q.difficulty === cell.difficulty &&
        q.kind === cell.kind,
    ),
  );
  const slots = cells.flatMap((cell, row) =>
    Array.from({ length: cell.count }, () => row),
  );
  const matchedPrompt = new Map<string, number>(),
    chosen = new Map<number, AssignmentQuestion>();
  // Bounded bipartite matching avoids false shortages when two cells share a duplicate prompt
  // but one cell can use another question. At most 30 slots and 200 bank rows.
  const assign = (slot: number, visited: Set<string>): boolean => {
    for (const question of candidates[slots[slot]]) {
      const prompt = assessmentPromptKey(question.prompt);
      if (visited.has(prompt)) continue;
      visited.add(prompt);
      const previous = matchedPrompt.get(prompt);
      if (previous === undefined || assign(previous, visited)) {
        matchedPrompt.set(prompt, slot);
        chosen.set(slot, question);
        return true;
      }
    }
    return false;
  };
  slots.forEach((_, slot) => assign(slot, new Set()));
  cells.forEach((cell, row) => {
    const available = slots.filter(
      (r, slot) => r === row && chosen.has(slot),
    ).length;
    if (available < cell.count)
      shortages.push({
        row: row + 1,
        requested: cell.count,
        available,
        missing: cell.count - available,
      });
  });
  const selected = slots.flatMap((_, slot) =>
    chosen.has(slot) ? [chosen.get(slot)!] : [],
  );
  return {
    questionIds: selected.map((q) => q.id),
    questions: selected,
    shortages,
  };
}

export interface AssessmentPreflight {
  blocked: boolean;
  questionCount: number;
  maxPoints: number;
  manualReviewCount: number;
  referencedQuestions: number;
  topics: { label: string; count: number; points: number }[];
  difficulties: { label: string; count: number; points: number }[];
  kinds: { label: string; count: number; points: number }[];
  issues: { code: string; severity: "blocking" | "review"; message: string }[];
}
/** Whole-set diagnostics complement existing per-question QA; never a quality/accuracy score. */
export function inspectAssessment(
  questions: readonly AssignmentQuestion[],
  expectedPoints?: number,
): AssessmentPreflight {
  const issues: AssessmentPreflight["issues"] = [];
  const add = (
    code: string,
    severity: "blocking" | "review",
    message: string,
  ) => issues.push({ code, severity, message });
  if (
    !questions.length ||
    questions.length > teachingLimits.questionsPerAssignment
  )
    add("QUESTION_COUNT", "blocking", "Đề cần từ 1 đến 30 câu hỏi.");
  const ids = new Set<string>(),
    prompts = new Map<string, number>();
  let maxPoints = 0,
    manualReviewCount = 0,
    referencedQuestions = 0;
  const topics = new Map<
      string,
      { label: string; count: number; points: number }
    >(),
    difficulties = new Map<
      string,
      { label: string; count: number; points: number }
    >(),
    kinds = new Map<string, { label: string; count: number; points: number }>();
  const keyCounts = new Map<number, number>();
  questions.forEach((q, index) => {
    const position = index + 1,
      key = assessmentPromptKey(q.prompt);
    if (ids.has(q.id))
      add(
        "DUPLICATE_QUESTION_ID",
        "blocking",
        `Câu ${position} bị chọn nhiều lần.`,
      );
    ids.add(q.id);
    if (prompts.has(key))
      add(
        "DUPLICATE_PROMPT",
        "blocking",
        `Câu ${position} trùng nội dung đã chuẩn hóa với câu ${prompts.get(key)}.`,
      );
    else prompts.set(key, position);
    const points =
      Number.isFinite(q.maxPoints) &&
      q.maxPoints > 0 &&
      q.maxPoints <= 100 &&
      Math.abs(q.maxPoints * 100 - Math.round(q.maxPoints * 100)) < 1e-7
        ? q.maxPoints
        : 0;
    if (!points)
      add("INVALID_POINTS", "blocking", `Điểm câu ${position} chưa hợp lệ.`);
    maxPoints += Math.round(points * 100);
    if (q.kind !== "mcq") manualReviewCount++;
    else if (Number.isInteger(q.correctIndex))
      keyCounts.set(q.correctIndex!, (keyCounts.get(q.correctIndex!) || 0) + 1);
    if (q.references?.length) referencedQuestions++;
    for (const [map, label] of [
      [topics, q.topic],
      [difficulties, q.difficulty],
      [kinds, q.kind],
    ] as const) {
      const key = normalize(label),
        current = map.get(key) || { label, count: 0, points: 0 };
      current.count++;
      current.points = Math.round((current.points + points) * 100) / 100;
      map.set(key, current);
    }
  });
  maxPoints /= 100;
  if (
    expectedPoints !== undefined &&
    (!Number.isFinite(expectedPoints) ||
      Math.abs(expectedPoints - maxPoints) > 1e-7)
  )
    add(
      "TOTAL_POINTS_MISMATCH",
      "blocking",
      "Tổng điểm đề không khớp tổng điểm các câu hỏi.",
    );
  const mcq = questions.length - manualReviewCount;
  if (mcq >= 4 && Math.max(0, ...keyCounts.values()) / mcq >= 0.75)
    add(
      "ANSWER_POSITION_CONCENTRATION",
      "review",
      "Ít nhất 75% câu trắc nghiệm có cùng vị trí đáp án. Giáo viên nên xem lại phân bố; đây không phải kết luận đề sai.",
    );
  if (referencedQuestions < questions.length)
    add(
      "SOURCE_COVERAGE",
      "review",
      `${questions.length - referencedQuestions} câu chưa gắn trích đoạn nguồn. Đối chiếu nội dung và đáp án trước khi giao.`,
    );
  if (manualReviewCount)
    add(
      "MANUAL_GRADING",
      "review",
      `${manualReviewCount} câu trả lời ngắn/tự luận cần giáo viên chấm theo rubric; không tự động kết luận điểm.`,
    );
  return {
    blocked: issues.some((i) => i.severity === "blocking"),
    questionCount: questions.length,
    maxPoints,
    manualReviewCount,
    referencedQuestions,
    topics: [...topics.values()],
    difficulties: [...difficulties.values()],
    kinds: [...kinds.values()],
    issues,
  };
}

export function assertAssessmentReady(
  questions: readonly AssignmentQuestion[],
  expectedPoints?: number,
) {
  const result = inspectAssessment(questions, expectedPoints);
  if (result.blocked) throw new PlatformError("TEACHING_CONTENT_BLOCKED", 422);
  return result;
}
