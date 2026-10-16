"use client";
import type {
  AssignmentQuestion,
  TeachingQuestion,
} from "../../lib/teaching/contracts";
import {
  composeAssessment,
  inspectAssessment,
  parseAssessmentBlueprint,
  type AssessmentBlueprintCell,
} from "../../lib/teaching/assessment-plan";
import { Plus, Trash2 } from "lucide-react";
import { Field, Tag } from "./ui";
import { teachingError } from "./client";

export const assessmentDifficulty: Record<string, string> = {
  basic: "Cơ bản",
  medium: "Vận dụng",
  advanced: "Nâng cao",
};
export const assessmentKind: Record<string, string> = {
  mcq: "Trắc nghiệm",
  short: "Trả lời ngắn",
  essay: "Tự luận",
};

export function AssessmentPreflightView({
  questions,
  expectedPoints,
}: {
  questions: readonly AssignmentQuestion[];
  expectedPoints?: number;
}) {
  const report = inspectAssessment(questions, expectedPoints);
  return (
    <section className="tw-card tw-form" aria-label="Kiểm tra toàn đề">
      <div className="tw-card-top">
        <h3>Kiểm tra toàn đề</h3>
        <Tag tone={report.blocked ? "amber" : "indigo"}>
          {report.blocked
            ? "Cần sửa trước khi duyệt"
            : "Chờ giáo viên đối chiếu"}
        </Tag>
      </div>
      <p>
        <strong>
          {report.questionCount} câu · {report.maxPoints} điểm
        </strong>{" "}
        · {report.manualReviewCount} câu cần chấm theo rubric
      </p>
      <div className="tw-table-wrap">
        <table className="tw-table">
          <caption>Phân bố từ các câu đang chọn</caption>
          <thead>
            <tr>
              <th>Nhóm</th>
              <th>Nội dung</th>
              <th>Số câu</th>
              <th>Điểm</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Chủ đề", report.topics, {}],
                ["Độ khó", report.difficulties, assessmentDifficulty],
                ["Dạng", report.kinds, assessmentKind],
              ] as const
            ).flatMap(([group, rows, labels]) =>
              rows.map((row) => (
                <tr key={group + row.label}>
                  <td>{group}</td>
                  <td>
                    {(labels as Record<string, string>)[row.label] || row.label}
                  </td>
                  <td>{row.count}</td>
                  <td>{row.points}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      {!!report.issues.length && (
        <ul className="tw-note">
          {report.issues.map((issue, i) => (
            <li key={issue.code + i}>
              {issue.severity === "blocking" ? "Cần sửa: " : "Cần xem lại: "}
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      <p className="tw-note">
        {report.referencedQuestions}/{report.questionCount} câu có trích đoạn.
        Phân bố và kiểm tra cấu trúc không chứng minh mọi đáp án đúng hoặc đề
        phù hợp độ tuổi. Giáo viên cần đối chiếu trước khi giao.
      </p>
    </section>
  );
}

export function AssessmentBlueprintEditor({
  bank,
  cells,
  onChange,
  disabled,
}: {
  bank: readonly TeachingQuestion[];
  cells: AssessmentBlueprintCell[];
  onChange: (cells: AssessmentBlueprintCell[]) => void;
  disabled: boolean;
}) {
  const topics = [...new Set(bank.map((q) => q.topic))].sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
  let error = "",
    plan: ReturnType<typeof composeAssessment> | null = null;
  try {
    plan = composeAssessment(parseAssessmentBlueprint(cells), bank);
  } catch (e) {
    error = teachingError(
      e && typeof e === "object" && "code" in e
        ? e.code
        : "INVALID_ASSESSMENT_BLUEPRINT",
    );
  }
  const patch = (index: number, value: Partial<AssessmentBlueprintCell>) =>
    onChange(cells.map((c, i) => (i === index ? { ...c, ...value } : c)));
  return (
    <section className="tw-form" aria-label="Ma trận đề từ ngân hàng">
      <div>
        <h3>Ghép đề từ câu đã duyệt</h3>
        <p className="tw-note">
          Chọn chủ đề, độ khó, dạng và số lượng. Tối đa 12 dòng / 30 câu; các
          dòng không trùng nhau. Câu trùng nội dung chỉ được chọn một lần cho
          toàn đề.
        </p>
      </div>
      {cells.map((cell, index) => (
        <fieldset className="tw-card tw-form" key={index}>
          <legend>Dòng {index + 1}</legend>
          <Field label="Chủ đề">
            <select
              required
              disabled={disabled}
              value={cell.topic}
              onChange={(e) => patch(index, { topic: e.target.value })}
            >
              <option value="">Chọn chủ đề đã có</option>
              {cell.topic && !topics.includes(cell.topic) && (
                <option value={cell.topic}>
                  {cell.topic} (không còn câu phù hợp)
                </option>
              )}
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </Field>
          <div className="tw-form-row">
            <Field label="Độ khó">
              <select
                disabled={disabled}
                value={cell.difficulty}
                onChange={(e) =>
                  patch(index, {
                    difficulty: e.target
                      .value as AssessmentBlueprintCell["difficulty"],
                  })
                }
              >
                {Object.entries(assessmentDifficulty).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dạng câu">
              <select
                disabled={disabled}
                value={cell.kind}
                onChange={(e) =>
                  patch(index, {
                    kind: e.target.value as AssessmentBlueprintCell["kind"],
                  })
                }
              >
                {Object.entries(assessmentKind).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="tw-form-row">
            <Field label="Số câu">
              <input
                required
                disabled={disabled}
                type="number"
                min={1}
                max={30}
                value={cell.count}
                onChange={(e) =>
                  patch(index, { count: Number(e.target.value) })
                }
              />
            </Field>
            <button
              type="button"
              className="tw-text-button"
              disabled={disabled || cells.length <= 1}
              onClick={() => onChange(cells.filter((_, i) => i !== index))}
            >
              <Trash2 size={14} /> Xóa dòng {index + 1}
            </button>
          </div>
        </fieldset>
      ))}
      <button
        className="tw-text-button"
        type="button"
        disabled={disabled || cells.length >= 12}
        onClick={() =>
          onChange([
            ...cells,
            {
              topic: topics[0] || "",
              difficulty: "medium",
              kind: "mcq",
              count: 1,
            },
          ])
        }
      >
        <Plus size={15} /> Thêm dòng ma trận
      </button>
      <div role="status" aria-live="polite">
        {error ? (
          <p className="tw-note">{error}</p>
        ) : plan?.shortages.length ? (
          <div className="tw-note">
            <strong>Chưa đủ câu để ghép đề.</strong>
            <ul>
              {plan.shortages.map((s) => (
                <li key={s.row}>
                  Dòng {s.row}: cần {s.requested}, chọn được {s.available},
                  thiếu {s.missing} câu không trùng.
                </li>
              ))}
            </ul>
            <p>
              Bổ sung câu hỏi đã duyệt hoặc điều chỉnh ma trận. Chưa có đề nào
              được tạo.
            </p>
          </div>
        ) : plan ? (
          <p className="tw-note">
            Dự kiến ghép đủ {plan.questionIds.length} câu. Máy chủ kiểm tra lại
            quyền và ngân hàng khi lưu; đề tạo ra vẫn cần bạn xem và duyệt.
          </p>
        ) : null}
      </div>
      {plan && !!plan.questions.length && (
        <AssessmentPreflightView questions={plan.questions} />
      )}
      <p className="tw-note">
        Đây là ghép câu xác định từ ngân hàng, không gọi AI và không dùng
        credit. Không phải đề thi ngẫu nhiên hay hệ thống chống gian lận. Sau
        khi tạo, bạn có thể chỉnh câu trong đề nháp.
      </p>
    </section>
  );
}
