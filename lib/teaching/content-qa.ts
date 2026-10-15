import { sourceSegments } from "../ai/grounding";
import { normalizeEquation } from "../tutor/math";
import { checkExactArithmetic, checkExactEquation } from "../tutor/math-exact";
import { PlatformError } from "../server/types";
import type { LessonDraft, QuestionDraft, TeachingDifficulty, TeachingMaterial, TeachingReference } from "./contracts";

export const TEACHING_AI_KINDS = ["lesson", "questions", "feedback", "assistant"] as const;
export type TeachingAIKind = (typeof TEACHING_AI_KINDS)[number];
export interface TeachingGenerationRequest {
  requestId: string;
  kind: TeachingAIKind;
  orgId: string;
  sourceIds: string[];
  topic: string;
  grade: string;
  objective: string;
  difficulty: TeachingDifficulty;
  count: number;
  language: "vi" | "en" | "zh-CN" | "ja" | "ko";
  anonymousExcerpt?: string;
  externalProcessingConsent: true;
}
export interface TeachingIssue { code: string; path: string; severity: "blocking" | "review"; message: string; }
export interface TeachingQuality {
  status: "blocked" | "review-required";
  blocked: boolean;
  structuralChecks: boolean;
  sourceSupport: "exact-excerpts" | "inference-no-source" | "mixed";
  math: "checked-supported-cases" | "not-checked" | "inconsistent";
  issues: TeachingIssue[];
  teacherReviewRequired: true;
  publication: "draft-only";
}
export interface TeachingTextDraft { text: string; references: TeachingReference[]; }
export interface TeachingGenerationResult {
  kind: TeachingAIKind;
  draft: LessonDraft | QuestionDraft[] | TeachingTextDraft;
  quality: TeachingQuality;
  sourceBasis: { mode: "saved-sources" | "topic-inference"; materials: { id: string; title: string; revision: number }[]; verifiedClaims: false; };
  requestId: string;
}
const strings = (v: unknown, max: number, min = 1): v is string => typeof v === "string" && v.trim().length >= min && v.length <= max && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v);
const norm = (v: string) => v.normalize("NFKC").toLocaleLowerCase("vi").replace(/\s+/g, " ").trim().replace(/[.!?。]+$/, "");
function fail(code = "INVALID_TEACHING_GENERATION", status = 400): never { throw new PlatformError(code, status); }

/** Minimize before transport. This detector is deliberately not described as complete anonymization. */
export function assertAnonymousTeachingText(text: string): void {
  if (/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text) || /(?:\+?\d[\s().-]*){10,15}/.test(text) || /(?:họ\s*(?:và\s*)?tên|tên\s*học\s*sinh|student\s*(?:name|id)|full\s*name|số\s*điện\s*thoại|sđt|mã\s*học\s*sinh)\s*[:=]/iu.test(text) || /\b(?:sk-proj-|xai-|AIza)[A-Za-z0-9_-]{16,}/.test(text)) fail("TEACHING_ANONYMIZATION_REQUIRED", 422);
}
export function parseTeachingGenerationRequest(raw: unknown): TeachingGenerationRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail();
  const v = raw as Record<string, unknown>;
  const allowed = new Set(["requestId", "kind", "orgId", "sourceIds", "topic", "grade", "objective", "difficulty", "count", "language", "anonymousExcerpt", "externalProcessingConsent"]);
  if (Object.keys(v).some(k => !allowed.has(k))) fail();
  if (typeof v.requestId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.requestId)) fail("INVALID_TEACHING_REQUEST_ID");
  if (!(TEACHING_AI_KINDS as readonly unknown[]).includes(v.kind) || !strings(v.orgId, 80) || !strings(v.topic, 100, 2) || !strings(v.grade, 40) || (v.objective !== undefined && !strings(v.objective, 500, 0))) fail();
  if (v.externalProcessingConsent !== true) fail("TEACHING_AI_CONSENT_REQUIRED", 422);
  const sourceIds = v.sourceIds === undefined ? [] : v.sourceIds;
  if (!Array.isArray(sourceIds) || sourceIds.length > 3 || sourceIds.some(x => !strings(x, 80)) || new Set(sourceIds).size !== sourceIds.length) fail();
  const difficulty = v.difficulty ?? "medium", count = v.count ?? 3, language = v.language ?? "vi";
  if (!["basic", "medium", "advanced"].includes(String(difficulty)) || !Number.isInteger(count) || Number(count) < 1 || Number(count) > 5 || !["vi", "en", "zh-CN", "ja", "ko"].includes(String(language))) fail();
  if (v.kind === "feedback" ? !strings(v.anonymousExcerpt, 1500, 5) : v.anonymousExcerpt !== undefined) fail("INVALID_ANONYMOUS_EXCERPT");
  const outbound = [v.topic, v.grade, v.objective || "", v.anonymousExcerpt || ""].join("\n");
  assertAnonymousTeachingText(outbound);
  return { requestId: v.requestId.toLowerCase(), kind: v.kind as TeachingAIKind, orgId: v.orgId as string, sourceIds: sourceIds as string[], topic: (v.topic as string).trim(), grade: (v.grade as string).trim(), objective: String(v.objective || "").trim(), difficulty: difficulty as TeachingDifficulty, count: Number(count), language: language as TeachingGenerationRequest["language"], ...(v.kind === "feedback" ? { anonymousExcerpt: (v.anonymousExcerpt as string).trim() } : {}), externalProcessingConsent: true };
}

/** Inputs must be actor-owned, server-loaded materials with verified extraction evidence. Never accepts model locations. */
export function rebuildTeachingReferences(raw: unknown, materials: readonly TeachingMaterial[]): { references: TeachingReference[]; rejected: number } {
  if (raw === undefined || (Array.isArray(raw) && !raw.length)) return { references: [], rejected: 0 };
  if (!Array.isArray(raw) || raw.length > 12) return { references: [], rejected: 1 };
  const references: TeachingReference[] = [], seen = new Set<string>();
  let rejected = 0;
  for (const value of raw) {
    if (!value || typeof value !== "object") { rejected++; continue; }
    const v = value as Record<string, unknown>, material = materials.find(m => m.id === v.materialId);
    if (!material || !strings(v.quote, 500, 8)) { rejected++; continue; }
    const quote = v.quote.trim(), parts = sourceSegments(material.content, material.sourceEvidence).filter(s => s.text.includes(quote));
    const matches = parts.filter(s => s.paragraph === v.paragraph);
    const segment = matches.length === 1 ? matches[0] : parts.length === 1 ? parts[0] : undefined;
    if (!segment) { rejected++; continue; }
    const key = `${material.id}:${segment.paragraph}:${quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    references.push({ materialId: material.id, quote, paragraph: segment.paragraph, ...(segment.page ? { page: segment.page } : {}), ...(segment.slide ? { slide: segment.slide } : {}), ...(segment.heading ? { heading: segment.heading } : {}), ...(segment.seconds === undefined ? {} : { seconds: segment.seconds }) });
  }
  return { references, rejected };
}
function quality(materials: readonly TeachingMaterial[], issues: TeachingIssue[], cited = false, math: TeachingQuality["math"] = "not-checked"): TeachingQuality {
  const blocked = issues.some(x => x.severity === "blocking");
  return { status: blocked ? "blocked" : "review-required", blocked, structuralChecks: !issues.some(x => x.code === "INVALID_STRUCTURE"), sourceSupport: !materials.length ? "inference-no-source" : cited && !issues.some(x => x.code === "MISSING_REFERENCE") ? "exact-excerpts" : "mixed", math, issues: [...issues, { code: "SEMANTIC_REVIEW_REQUIRED", path: "", severity: "review", message: "Giáo viên cần đối chiếu nội dung, độ tuổi, nguồn, đáp án và cách diễn đạt trước khi sử dụng. Trích dẫn khớp không chứng minh mọi khẳng định đúng." }], teacherReviewRequired: true, publication: "draft-only" };
}
const issue = (issues: TeachingIssue[], code: string, path: string, message: string, severity: TeachingIssue["severity"] = "blocking") => issues.push({ code, path, severity, message });
function inspectText(text: string, path: string, issues: TeachingIssue[]) {
  if (/(?:\b(?:pornography|pornographic|kill yourself|worthless idiot)\b|hướng\s*dẫn\s*(?:chế\s*tạo\s*bom|tự\s*tử)|đồ\s*ngu\s*dốt)/iu.test(text)) issue(issues, "AGE_OR_SAFETY_CONTENT", path, "Nội dung có dấu hiệu không phù hợp hoặc gây hại; cần sửa trước khi duyệt.");
}
function inspectReferences(refs: unknown, materials: readonly TeachingMaterial[], path: string, issues: TeachingIssue[]) {
  const normalized = rebuildTeachingReferences(refs, materials);
  if (normalized.rejected) issue(issues, "INVALID_REFERENCE", path, "Nguồn/trích đoạn không khớp học liệu có quyền truy cập; không công nhận vị trí do AI tự nêu.");
  if (materials.length && !normalized.references.length) issue(issues, "MISSING_REFERENCE", path, "Chưa có trích đoạn khớp cho phần nội dung này.", "review");
  return normalized.references;
}
function arithmeticLabel(value: string): string | null {
  let v = normalizeEquation(value).trim().replace(/^x\s*=\s*/i, "").replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)");
  if (v.length > 160 || !/^[\d\s.+\-*/^()]+$/.test(v)) return null;
  return v;
}
function equivalentOption(a: string, b: string) {
  if (norm(a) === norm(b)) return true;
  const left = arithmeticLabel(a), right = arithmeticLabel(b);
  return !!left && !!right && checkExactArithmetic(`${left}=${right}`) === "exact";
}
/** Only narrow literal arithmetic/equation questions receive independent answer checks. */
function questionMath(q: QuestionDraft, issues: TeachingIssue[]): TeachingQuality["math"] {
  const p = normalizeEquation(q.prompt).replace(/^(?:giải\s*(?:phương\s*trình)?|solve\s*(?:the\s*equation)?|tính\s*(?:giá\s*trị)?|calculate)\s*:?\s*/iu, "").replace(/[.?]\s*$/, "").trim();
  const explanation = q.explanation || "";
  let checked = false, wrong = false;
  // Explicit constant equalities only; a quoted equation is not a proof of the surrounding explanation.
  for (const line of explanation.split(/[\n;]/).slice(0, 50)) {
    const statement = normalizeEquation(line).replace(/\.\s*$/, "").trim();
    if (statement.length > 160 || !/^[\d\s.+\-*/^()=]+$/.test(statement) || (statement.match(/=/g) || []).length !== 1) continue;
    const state = checkExactArithmetic(statement);
    if (state === "invalid") { wrong = true; issue(issues, "INCORRECT_ARITHMETIC", "explanation", "Có đẳng thức số sai trong phần giải thích được bộ kiểm tra hỗ trợ."); }
    if (state === "exact") checked = true;
  }
  if (q.kind !== "mcq" || q.choices.length < 2 || q.choices.length > 6 || !Number.isInteger(q.correctIndex)) return wrong ? "inconsistent" : checked ? "checked-supported-cases" : "not-checked";
  let states: ("exact" | "invalid" | "unknown")[] | undefined;
  if (/^[\dx\s.+\-*/^()=]+$/.test(p) && p.includes("x") && (p.match(/=/g) || []).length === 1) {
    const values = q.choices.map(v => { const n = normalizeEquation(v).replace(/^x\s*=\s*/i, "").trim(); return /^[-+]?\d+(?:\.\d+)?$/.test(n) ? Number(n) : NaN; });
    if (values.every(Number.isFinite)) states = checkExactEquation(p, values)?.candidates.map(v => v.state);
  } else if (/^[\d\s.+\-*/^()]+$/.test(p)) {
    const labels = q.choices.map(arithmeticLabel);
    if (labels.every(Boolean)) states = labels.map(v => checkExactArithmetic(`${p}=${v}`));
  }
  if (states && states.every(s => s !== "unknown")) {
    checked = true;
    const correct = states.flatMap((s, i) => s === "exact" ? [i] : []);
    if (correct.length !== 1) { wrong = true; issue(issues, correct.length ? "MULTIPLE_CORRECT_OPTIONS" : "NO_CORRECT_OPTION", "choices", "Bộ kiểm tra Toán phát hiện không có đúng một lựa chọn đúng trong phạm vi hỗ trợ."); }
    else if (correct[0] !== q.correctIndex) { wrong = true; issue(issues, "INCORRECT_ANSWER_KEY", "correctIndex", "Đáp án được chọn mâu thuẫn với kết quả kiểm tra độc lập trong phạm vi hỗ trợ."); }
  }
  return wrong ? "inconsistent" : checked ? "checked-supported-cases" : "not-checked";
}
export function checkTeachingQuestion(draft: QuestionDraft, materials: readonly TeachingMaterial[] = []): TeachingQuality {
  const q = draft || ({} as QuestionDraft), issues: TeachingIssue[] = [];
  if (!strings(q.prompt, 6000, 3) || !["mcq", "short", "essay"].includes(q.kind) || !Array.isArray(q.choices) || q.choices.length > 6 || q.choices.some(v => !strings(v, 1500)) || !strings(q.topic, 100) || !["basic", "medium", "advanced"].includes(q.difficulty) || !Number.isFinite(q.maxPoints) || q.maxPoints <= 0 || q.maxPoints > 100) issue(issues, "INVALID_STRUCTURE", "question", "Câu hỏi thiếu trường hợp lệ hoặc vượt giới hạn.");
  const choices = Array.isArray(q.choices) ? q.choices.filter(v => typeof v === "string") : [];
  if (q.kind === "mcq") {
    if (choices.length < 2 || choices.length > 6 || !Number.isInteger(q.correctIndex) || q.correctIndex! < 0 || q.correctIndex! >= choices.length || !strings(q.explanation, 6000, 5)) issue(issues, "INVALID_STRUCTURE", "choices", "Trắc nghiệm cần 2–6 lựa chọn, một đáp án hợp lệ và giải thích rõ; bộ AI mới tạo 4 lựa chọn.");
    for (let i = 0; i < choices.length; i++) for (let j = i + 1; j < choices.length; j++) if (equivalentOption(choices[i], choices[j])) issue(issues, "DUPLICATE_OPTIONS", `choices.${j}`, "Hai lựa chọn trùng hoặc tương đương số trong phạm vi kiểm tra.");
    if (choices.some(v => /(?:all\s*of\s*the\s*above|none\s*of\s*the\s*above|tất\s*cả\s*(?:các\s*)?(?:đáp\s*án|phương\s*án)|cả\s*[ABCD]\s*(?:và|,)\s*[ABCD])/iu.test(v))) issue(issues, "AMBIGUOUS_OPTIONS", "choices", "Không dùng lựa chọn tổ hợp hoặc “tất cả” trong trắc nghiệm một đáp án.");
  } else if (q.kind === "short" || q.kind === "essay") {
    if (choices.length || q.correctIndex !== undefined || !strings(q.modelAnswer, 6000, 3)) issue(issues, "INVALID_STRUCTURE", "modelAnswer", "Tự luận cần đáp án tham khảo, không có lựa chọn/đáp án chỉ số.");
    if (!Array.isArray(q.rubric) || !q.rubric.length || q.rubric.length > 10 || q.rubric.some(r => !r || !strings(r.label, 500) || !Number.isFinite(r.points) || r.points <= 0) || Math.abs(q.rubric.reduce((n, r) => n + r.points, 0) - q.maxPoints) > 1e-8) issue(issues, "INVALID_RUBRIC", "rubric", "Rubric cần tiêu chí rõ, điểm dương và tổng bằng điểm câu hỏi.");
  }
  const text = [q.prompt || "", ...choices, q.explanation || "", q.modelAnswer || ""].join("\n");
  inspectText(text, "question", issues);
  const refs = inspectReferences(q.references, materials, "references", issues);
  const math = issues.some(i => i.code === "INVALID_STRUCTURE") ? "not-checked" : questionMath(q, issues);
  return quality(materials, issues, refs.length > 0, math);
}
export function checkTeachingLesson(draft: LessonDraft, materials: readonly TeachingMaterial[] = []): TeachingQuality {
  const d = draft || ({} as LessonDraft), issues: TeachingIssue[] = [];
  if (!strings(d.title, 200, 3) || !strings(d.topic, 100) || !strings(d.grade, 80) || !Array.isArray(d.objectives) || d.objectives.length < 1 || d.objectives.length > 12 || d.objectives.some(x => !strings(x, 500)) || !Array.isArray(d.sections) || d.sections.length < 1 || d.sections.length > 12 || !Array.isArray(d.sourceIds) || d.sourceIds.length > 10 || d.sourceIds.some(id => !materials.some(m => m.id === id))) issue(issues, "INVALID_STRUCTURE", "lesson", "Giáo án thiếu mục tiêu/phần học hợp lệ hoặc nguồn có quyền truy cập.");
  let cited = false;
  if (Array.isArray(d.sections)) for (const [i, section] of d.sections.entries()) {
    if (!section || !strings(section.title, 200) || !strings(section.body, 10000, 5)) { issue(issues, "INVALID_STRUCTURE", `sections.${i}`, "Phần giáo án cần tên và nội dung trong giới hạn."); continue; }
    inspectText(section.title + "\n" + section.body, `sections.${i}`, issues);
    const refs = inspectReferences(section.references, materials, `sections.${i}.references`, issues); cited ||= refs.length > 0;
    if (refs.some(r => !d.sourceIds?.includes(r.materialId))) issue(issues, "INVALID_REFERENCE", `sections.${i}.references`, "Nguồn tham chiếu phải nằm trong danh sách nguồn của giáo án.");
  }
  if (strings(d.title, 200)) inspectText(d.title + "\n" + (Array.isArray(d.objectives) ? d.objectives.join("\n") : ""), "lesson", issues);
  return quality(materials, issues, cited);
}
/** Review/issue must call on the current draft and owned current source rows, not cached AI flags. */
export function assertTeachingReviewable(draft: LessonDraft | QuestionDraft, materials: readonly TeachingMaterial[], kind: "lesson" | "question"): TeachingQuality {
  const result = kind === "lesson" ? checkTeachingLesson(draft as LessonDraft, materials) : checkTeachingQuestion(draft as QuestionDraft, materials);
  if (result.blocked) throw new PlatformError("TEACHING_CONTENT_BLOCKED", 422);
  return result;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("INVALID_TEACHING_AI_OUTPUT", 502);
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(value).some(k => !allowed.includes(k))) fail("INVALID_TEACHING_AI_OUTPUT", 502);
}
function outputString(value: unknown, max: number, min = 1): string {
  if (!strings(value, max, min)) fail("INVALID_TEACHING_AI_OUTPUT", 502);
  return value.trim();
}
function outputReferences(value: unknown, materials: readonly TeachingMaterial[]): TeachingReference[] {
  const refs = rebuildTeachingReferences(value, materials);
  if (refs.rejected) fail("INVALID_TEACHING_AI_REFERENCE", 502);
  return refs.references;
}
/** Validate, bound and rebuild the model draft before any credit settlement or UI display. */
export function parseTeachingDraft(raw: unknown, request: TeachingGenerationRequest, materials: readonly TeachingMaterial[]): { draft: TeachingGenerationResult["draft"]; quality: TeachingQuality } {
  const v = object(raw);
  if (request.kind === "lesson") {
    fields(v, ["title", "topic", "grade", "objectives", "sections", "sourceIds", "classId"]);
    if ((v.classId !== undefined && v.classId !== null) || !Array.isArray(v.objectives) || v.objectives.length < 1 || v.objectives.length > 8 || !Array.isArray(v.sections) || v.sections.length < 2 || v.sections.length > 8) fail("INVALID_TEACHING_AI_OUTPUT", 502);
    if (v.sourceIds !== undefined && (!Array.isArray(v.sourceIds) || v.sourceIds.length !== request.sourceIds.length || v.sourceIds.some(id => !request.sourceIds.includes(String(id))))) fail("INVALID_TEACHING_AI_REFERENCE", 502);
    const draft: LessonDraft = { classId: null, title: outputString(v.title, 200, 3), topic: request.topic, grade: request.grade, objectives: v.objectives.map(x => outputString(x, 500)), sections: v.sections.map(value => { const section = object(value); fields(section, ["title", "body", "references"]); return { title: outputString(section.title, 200), body: outputString(section.body, 10000, 5), references: outputReferences(section.references, materials) }; }), sourceIds: [...request.sourceIds] };
    const checked = checkTeachingLesson(draft, materials);
    if (checked.blocked) fail("TEACHING_CONTENT_BLOCKED", 422);
    return { draft, quality: checked };
  }
  if (request.kind === "questions") {
    fields(v, ["questions"]);
    if (!Array.isArray(v.questions) || v.questions.length !== request.count) fail("INVALID_TEACHING_AI_OUTPUT", 502);
    const draft: QuestionDraft[] = v.questions.map(value => {
      const q = object(value);
      fields(q, ["classId", "prompt", "kind", "choices", "correctIndex", "explanation", "maxPoints", "topic", "difficulty", "references"]);
      if ((q.classId !== undefined && q.classId !== null) || q.kind !== "mcq" || !Array.isArray(q.choices) || q.choices.length !== 4 || !Number.isInteger(q.correctIndex) || Number(q.correctIndex) < 0 || Number(q.correctIndex) > 3) fail("INVALID_TEACHING_AI_OUTPUT", 502);
      return { classId: null, prompt: outputString(q.prompt, 5000, 3), kind: "mcq", choices: q.choices.map(x => outputString(x, 1500)), correctIndex: Number(q.correctIndex), explanation: outputString(q.explanation, 5000, 5), maxPoints: 1, topic: request.topic, difficulty: request.difficulty, references: outputReferences(q.references, materials) };
    });
    const checks = draft.map(q => checkTeachingQuestion(q, materials)), issues: TeachingIssue[] = [];
    for (const [i, check] of checks.entries()) issues.push(...check.issues.filter(x => x.code !== "SEMANTIC_REVIEW_REQUIRED").map(x => ({ ...x, path: `questions.${i}.${x.path}` })));
    const seen = new Set<string>();
    for (const [i, q] of draft.entries()) { const key = norm(q.prompt); if (seen.has(key)) issue(issues, "DUPLICATE_QUESTIONS", `questions.${i}.prompt`, "Hai câu hỏi trong bộ bị trùng nội dung."); seen.add(key); }
    const checked = quality(materials, issues, draft.every(q => q.references.length > 0), checks.some(q => q.math === "inconsistent") ? "inconsistent" : checks.some(q => q.math === "checked-supported-cases") ? "checked-supported-cases" : "not-checked");
    if (checked.blocked) fail("TEACHING_CONTENT_BLOCKED", 422);
    return { draft, quality: checked };
  }
  fields(v, ["text", "references"]);
  const draft: TeachingTextDraft = { text: outputString(v.text, 8000, 5), references: outputReferences(v.references, materials) }, issues: TeachingIssue[] = [];
  inspectText(draft.text, "text", issues);
  assertAnonymousTeachingText(draft.text);
  inspectReferences(draft.references, materials, "references", issues);
  const checked = quality(materials, issues, draft.references.length > 0);
  if (checked.blocked) fail("TEACHING_CONTENT_BLOCKED", 422);
  return { draft, quality: checked };
}
