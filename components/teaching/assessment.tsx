"use client";
import { MathText } from "../lumio/math-text";
import { observedErrors } from "./observed-errors";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileBarChart2,
  ListChecks,
  Printer,
  Search,
  Send,
} from "lucide-react";
import type {
  AssignmentDraft,
  QuestionGrade,
  TeachingAssignment,
  TeachingSubmission,
} from "../../lib/teaching/contracts";
import { FormError, submit, type TeachingClient } from "./client";
import {
  AddButton,
  Button,
  Empty,
  Field,
  FormFooter,
  Modal,
  Panel,
  Tag,
  csv,
  dateTime,
  downloadText,
} from "./ui";
import { GenerationPanel } from "./content";
const assignmentStatus: Record<string, string> = {
  draft: "Nháp",
  reviewed: "Đã duyệt",
  issued: "Đã giao",
  closed: "Đã đóng",
};
export function AssignmentsView({ client }: { client: TeachingClient }) {
  const data = client.data!,
    [editing, setEditing] = useState<TeachingAssignment | "new" | null>(null),
    [query, setQuery] = useState("");
  return (
    <div className="tw-grid tw-enter">
      <div className="tw-toolbar">
        <label className="tw-search">
          <Search size={16} />
          <input
            aria-label="Tìm bài tập"
            placeholder="Tìm bài tập…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <AddButton onClick={() => setEditing("new")}>Tạo bài tập</AddButton>
      </div>
      {data.assignments
        .filter((a) =>
          a.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        )
        .map((assignment) => (
          <article className="tw-card" key={assignment.id}>
            <div className="tw-card-top">
              <Tag tone={assignment.status === "issued" ? "green" : "neutral"}>
                {assignmentStatus[assignment.status]}
              </Tag>
              <span className="tw-subtle">
                Hạn {dateTime(assignment.dueAt)}
              </span>
            </div>
            <h3>{assignment.title}</h3>
            <p>
              {data.classes.find((c) => c.id === assignment.classId)?.name} ·{" "}
              {assignment.questions.length || assignment.questionIds.length} câu
              · {assignment.maxPoints} điểm
            </p>
            <p>{assignment.instructions}</p>
            <div className="tw-card-footer">
              <span>
                Giao cho{" "}
                {assignment.target.kind === "class"
                  ? "cả lớp"
                  : assignment.target.kind === "groups"
                    ? `${assignment.target.ids.length} nhóm`
                    : `${assignment.target.ids.length} học sinh`}
                {assignment.recipientIds
                  ? ` · ${assignment.recipientIds.length} người nhận đã chốt`
                  : ""}
              </span>
              <div className="tw-card-actions">
                {["draft", "reviewed"].includes(assignment.status) && (
                  <button
                    className="tw-text-button"
                    onClick={() => setEditing(assignment)}
                  >
                    Chỉnh sửa
                  </button>
                )}
                {assignment.status === "draft" && (
                  <button
                    className="tw-text-button"
                    disabled={client.busy}
                    onClick={() =>
                      void client
                        .mutate({
                          action: "assignment.review",
                          id: assignment.id,
                          expectedRevision: assignment.revision,
                        })
                        .catch(() => {})
                    }
                  >
                    <CheckCircle2 size={14} />
                    Duyệt đề & đối tượng
                  </button>
                )}
                {assignment.status === "reviewed" && (
                  <button
                    className="tw-text-button"
                    disabled={client.busy}
                    onClick={() =>
                      void client
                        .mutate({
                          action: "assignment.issue",
                          id: assignment.id,
                          expectedRevision: assignment.revision,
                        })
                        .catch(() => {})
                    }
                  >
                    <Send size={14} />
                    Giao bài
                  </button>
                )}
                {assignment.status === "issued" && (
                  <button
                    className="tw-text-button"
                    disabled={client.busy}
                    onClick={() =>
                      void client
                        .mutate({
                          action: "assignment.close",
                          id: assignment.id,
                          expectedRevision: assignment.revision,
                        })
                        .catch(() => {})
                    }
                  >
                    Đóng nhận bài
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      {!data.assignments.length && (
        <Panel>
          <Empty
            icon={ClipboardCheck}
            title="Giao bài để biết lớp đang hiểu đến đâu"
            action={
              <Button onClick={() => setEditing("new")}>
                Tạo bài tập đầu tiên <ArrowRight size={15} />
              </Button>
            }
          >
            Chọn câu hỏi đã duyệt, đối tượng và hạn nộp. Khi giao, đề cùng danh
            sách người nhận được chốt tại máy chủ.
          </Empty>
        </Panel>
      )}
      {editing && (
        <AssignmentEditor
          key={editing === "new" ? "new" : editing.id}
          client={client}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
function localDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function AssignmentEditor({
  client,
  initial,
  onClose,
}: {
  client: TeachingClient;
  initial: TeachingAssignment | null;
  onClose: () => void;
}) {
  const data = client.data!,
    [classId, setClassId] = useState(initial?.classId || ""),
    [title, setTitle] = useState(initial?.title || ""),
    [instructions, setInstructions] = useState(initial?.instructions || ""),
    [due, setDue] = useState(localDate(initial?.dueAt)),
    [questions, setQuestions] = useState<string[]>(initial?.questionIds || []),
    [target, setTarget] = useState<AssignmentDraft["target"]>(
      initial?.target || { kind: "class", ids: [] },
    );
  const candidates = data.questions.filter(
    (q) => q.status === "reviewed" && (!q.classId || q.classId === classId),
  );
  return (
    <Modal
      title={initial ? "Chỉnh sửa bài tập" : "Tạo bài tập"}
      onClose={onClose}
      disabled={client.busy}
    >
      <form
        className="tw-form"
        onSubmit={submit(async () => {
          const draft: AssignmentDraft = {
            classId,
            title,
            instructions,
            questionIds: questions,
            target,
            dueAt: new Date(due).toISOString(),
          };
          await client.mutate(
            initial
              ? {
                  action: "assignment.update",
                  id: initial.id,
                  expectedRevision: initial.revision,
                  draft,
                }
              : { action: "assignment.create", draft },
          );
          onClose();
        })}
      >
        <FormError client={client} />
        <Field label="Tên bài tập">
          <input
            required
            maxLength={180}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className="tw-form-row">
          <Field label="Lớp nhận bài">
            <select
              required
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setTarget({ kind: "class", ids: [] });
                setQuestions([]);
              }}
            >
              <option value="">Chọn lớp</option>
              {data.classes
                .filter((c) => !c.archived)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Hạn nộp (giờ trên thiết bị)">
            <input
              required
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Hướng dẫn">
          <textarea
            required
            maxLength={5000}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </Field>
        <Field label="Đối tượng">
          <select
            value={target.kind}
            onChange={(e) =>
              setTarget({
                kind: e.target.value as AssignmentDraft["target"]["kind"],
                ids: [],
              })
            }
          >
            <option value="class">Cả lớp</option>
            <option value="groups">Nhóm học tập</option>
            <option value="students">Học sinh được chọn</option>
          </select>
        </Field>
        {target.kind !== "class" && (
          <div>
            {(target.kind === "groups"
              ? data.groups
                  .filter((g) => g.classId === classId)
                  .map((g) => ({ id: g.id, name: g.name }))
              : data.enrollments
                  .filter((e) => e.classId === classId && e.active)
                  .map((e) => ({ id: e.userId, name: e.name }))
            ).map((item) => (
              <label className="tw-check" key={item.id}>
                <input
                  type="checkbox"
                  checked={target.ids.includes(item.id)}
                  onChange={(e) =>
                    setTarget({
                      ...target,
                      ids: e.target.checked
                        ? [...target.ids, item.id]
                        : target.ids.filter((id) => id !== item.id),
                    })
                  }
                />
                {item.name}
              </label>
            ))}
          </div>
        )}
        <div>
          <span className="tw-muted">Câu hỏi đã được xem lại</span>
          {candidates.map((q) => (
            <label className="tw-check" style={{ marginTop: 9 }} key={q.id}>
              <input
                type="checkbox"
                checked={questions.includes(q.id)}
                disabled={!questions.includes(q.id) && questions.length >= 30}
                onChange={(e) =>
                  setQuestions(
                    e.target.checked
                      ? [...questions, q.id]
                      : questions.filter((id) => id !== q.id),
                  )
                }
              />
              <span>
                <MathText text={q.prompt} inline />
                <small style={{ display: "block" }}>
                  {q.maxPoints} điểm · {q.topic}
                </small>
              </span>
            </label>
          ))}
          {!candidates.length && (
            <p className="tw-note">
              Tạo và duyệt câu hỏi cho lớp đã chọn, hoặc dùng câu hỏi chung của
              tổ chức.
            </p>
          )}
        </div>
        <p className="tw-note">
          Lưu nháp chưa giao cho học sinh. Xem lại đề và đối tượng trước khi bấm
          giao; nội dung chốt sau khi giao không bị sửa theo ngân hàng câu hỏi.
        </p>
        <FormFooter busy={client.busy} onClose={onClose} label="Lưu đề nháp" />
      </form>
    </Modal>
  );
}

export function GradingView({ client }: { client: TeachingClient }) {
  const [selected, setSelected] = useState<TeachingSubmission | null>(null),
    [filter, setFilter] = useState("all"),
    data = client.data!,
    submissions = data.submissions.filter(
      (s) => filter === "all" || s.status === filter,
    );
  return (
    <div className="tw-grid tw-enter">
      <div className="tw-toolbar">
        <p className="tw-muted">
          Điểm tự động là gợi ý. Học sinh chỉ thấy điểm và nhận xét sau khi giáo
          viên công bố.
        </p>
        <select
          aria-label="Lọc bài nộp"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Tất cả bài nộp</option>
          <option value="submitted">Cần chấm</option>
          <option value="graded">Chờ công bố</option>
          <option value="published">Đã công bố</option>
        </select>
      </div>
      <Panel title="Bài làm của học sinh">
        {submissions.length ? (
          <div className="tw-table-wrap">
            <table className="tw-table">
              <thead>
                <tr>
                  <th>Học sinh / Bài tập</th>
                  <th>Nộp lúc</th>
                  <th>Trạng thái</th>
                  <th>Điểm</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.studentName}</strong>
                      <small>
                        {
                          data.assignments.find((a) => a.id === s.assignmentId)
                            ?.title
                        }
                      </small>
                    </td>
                    <td>
                      {dateTime(s.submittedAt)}
                      {s.late && <small>Nộp muộn</small>}
                    </td>
                    <td>
                      <Tag
                        tone={
                          s.status === "published"
                            ? "green"
                            : s.status === "graded"
                              ? "indigo"
                              : "amber"
                        }
                      >
                        {s.status === "published"
                          ? "Đã công bố"
                          : s.status === "graded"
                            ? "Đã chấm"
                            : "Cần chấm"}
                      </Tag>
                    </td>
                    <td>{s.score === undefined ? "—" : s.score}</td>
                    <td>
                      <div className="tw-card-actions">
                        <button
                          className="tw-text-button"
                          onClick={() => setSelected(s)}
                        >
                          {s.status === "published"
                            ? "Xem kết quả"
                            : "Chấm & nhận xét"}
                        </button>
                        {s.status === "graded" && (
                          <button
                            className="tw-text-button"
                            disabled={client.busy}
                            onClick={() =>
                              void client
                                .mutate({
                                  action: "submission.publish",
                                  id: s.id,
                                  expectedRevision: s.revision,
                                })
                                .catch(() => {})
                            }
                          >
                            Công bố kết quả
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={ListChecks} title="Chưa có bài làm ở trạng thái này">
            Bài nộp thật sẽ xuất hiện khi học sinh làm và gửi bài từ Góc học
            sinh.
          </Empty>
        )}
      </Panel>
      {selected && (
        <GradeEditor
          key={selected.id + ":" + selected.revision}
          client={client}
          submission={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
function GradeEditor({
  client,
  submission,
  onClose,
}: {
  client: TeachingClient;
  submission: TeachingSubmission;
  onClose: () => void;
}) {
  const assignment = client.data!.assignments.find(
      (a) => a.id === submission.assignmentId,
    ),
    [grades, setGrades] = useState<QuestionGrade[]>(
      assignment?.questions.map(
        (q) =>
          submission.grades?.find((g) => g.questionId === q.id) || {
            questionId: q.id,
            points: 0,
            feedback: "",
          },
      ) || [],
    ),
    [feedback, setFeedback] = useState(submission.feedback || ""),
    [confirmed, setConfirmed] = useState(false),
    [anonymous, setAnonymous] = useState(""),
    [ai, setAI] = useState(false);
  if (!assignment) return null;
  return (
    <Modal
      title={`Bài làm · ${submission.studentName}`}
      onClose={onClose}
      disabled={client.busy}
    >
      <form
        className="tw-form"
        onSubmit={submit(async () => {
          await client.mutate({
            action: "submission.grade",
            id: submission.id,
            expectedRevision: submission.revision,
            grades,
            feedback,
            confirmed: true,
          });
          onClose();
        })}
      >
        <FormError client={client} />
        <Tag>{assignment.title}</Tag>
        {submission.autoScore !== undefined && (
          <p className="tw-note">
            Điểm trắc nghiệm gợi ý: {submission.autoScore}. Đây chưa phải điểm
            được giáo viên công bố.
          </p>
        )}
        {assignment.questions.map((question, index) => (
          <article className="tw-card tw-form" key={question.id}>
            <h3>
              {index + 1}. <MathText text={question.prompt} inline />
            </h3>
            <div className="tw-note">
              <strong>Bài làm đã nộp</strong>
              <p>
                <MathText
                  inline
                  text={(() => {
                    const answer = submission.answers.find(
                      (a) => a.questionId === question.id,
                    )?.response;
                    return typeof answer === "number"
                      ? question.choices[answer] || "Chưa trả lời"
                      : answer || "Chưa trả lời";
                  })()}
                />
              </p>
            </div>
            {question.rubric?.length && (
              <div className="tw-note">
                Tiêu chí:{" "}
                {question.rubric
                  .map((r) => `${r.label} (${r.points} điểm)`)
                  .join("; ")}
              </div>
            )}
            <div className="tw-form-row">
              <Field
                label={`Điểm câu ${index + 1} (tối đa ${question.maxPoints})`}
              >
                <input
                  type="number"
                  min={0}
                  max={question.maxPoints}
                  step={0.1}
                  required
                  disabled={submission.status === "published"}
                  value={grades[index]?.points ?? 0}
                  onChange={(e) =>
                    setGrades(
                      grades.map((g, i) =>
                        i === index
                          ? { ...g, points: Number(e.target.value) }
                          : g,
                      ),
                    )
                  }
                />
              </Field>
              <Field label={`Nhận xét câu ${index + 1}`}>
                <textarea
                  disabled={submission.status === "published"}
                  maxLength={2000}
                  value={grades[index]?.feedback || ""}
                  onChange={(e) =>
                    setGrades(
                      grades.map((g, i) =>
                        i === index ? { ...g, feedback: e.target.value } : g,
                      ),
                    )
                  }
                />
              </Field>
            </div>
          </article>
        ))}
        <Field label="Nhận xét chung">
          <textarea
            disabled={submission.status === "published"}
            maxLength={5000}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </Field>
        {submission.status !== "published" && (
          <>
            <label className="tw-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Tôi đã kiểm tra bài làm, tiêu chí, từng điểm và nhận xét. Lưu chấm
              chưa công bố cho học sinh.
            </label>
            <div className="tw-form-footer">
              <Button secondary type="button" onClick={onClose}>
                Đóng
              </Button>
              <Button type="submit" busy={client.busy} disabled={!confirmed}>
                Lưu phần chấm của giáo viên
              </Button>
            </div>
          </>
        )}
        {submission.status === "published" && (
          <Tag tone="green">Kết quả đã công bố cho học sinh này</Tag>
        )}
      </form>
      <details className="tw-pad">
        <summary className="tw-text-button" onClick={() => setAI(true)}>
          Gợi ý nhận xét AI từ đoạn đã ẩn danh
        </summary>
        <p className="tw-note">
          Không tự gửi bài làm hoặc tên học sinh. Bạn cần tự sao chép phần ngắn,
          bỏ tên, lớp và thông tin nhận diện. Công cụ dò thông tin chỉ là hỗ
          trợ, không bảo đảm ẩn danh hoàn toàn.
        </p>
        <Field label="Đoạn đã ẩn danh (tối đa 1.500 ký tự)">
          <textarea
            maxLength={1500}
            value={anonymous}
            onChange={(e) => setAnonymous(e.target.value)}
          />
        </Field>
        {ai && anonymous.trim().length >= 5 && (
          <GenerationPanel
            client={client}
            kind="feedback"
            anonymousExcerpt={anonymous}
          />
        )}
      </details>
    </Modal>
  );
}

export function AnalyticsView({ client }: { client: TeachingClient }) {
  const data = client.data!,
    observations = observedErrors(data);
  return (
    <div className="tw-grid tw-enter">
      <div className="tw-note">
        Chỉ dựa trên kết quả đã công bố. Dưới 3 bài đánh giá ở một chủ đề: chưa
        đủ bằng chứng. Tỷ lệ đúng hoặc điểm trung bình không chứng minh học sinh
        đã thành thạo toàn bộ môn học.
      </div>
      <Panel title="Bằng chứng theo học sinh và chủ đề">
        {data.analytics.length ? (
          <div className="tw-pad tw-card-list">
            {data.analytics.map((row) => (
              <article className="tw-card" key={row.studentId}>
                <div className="tw-card-top">
                  <h3>{row.studentName}</h3>
                  <Tag tone={row.assessments < 3 ? "amber" : "indigo"}>
                    {row.assessments} bài đã công bố
                  </Tag>
                </div>
                <p>
                  Trung bình quan sát:{" "}
                  {row.averagePercent === null
                    ? "chưa có"
                    : `${row.averagePercent.toFixed(1)}%`}
                </p>
                {row.topics.map((topic) => (
                  <div className="tw-metric-row" key={topic.topic}>
                    <span>
                      {topic.topic}
                      <small style={{ display: "block" }}>
                        {topic.assessments} bài ·{" "}
                        {topic.averagePercent.toFixed(1)}%
                      </small>
                    </span>
                    <Tag tone={topic.assessments < 3 ? "amber" : "green"}>
                      {topic.assessments < 3 || topic.level === "insufficient"
                        ? "Chưa đủ bằng chứng"
                        : topic.level === "secure"
                          ? "Kết quả quan sát ổn định"
                          : "Đang phát triển"}
                    </Tag>
                  </div>
                ))}
              </article>
            ))}
          </div>
        ) : (
          <Empty
            icon={BarChart3}
            title="Dữ liệu cần thời gian để kể đúng câu chuyện"
          >
            Khi có bài làm được giáo viên chấm và công bố, kết quả quan sát sẽ
            xuất hiện ở đây.
          </Empty>
        )}
      </Panel>
      <Panel
        title="Những lựa chọn cần cùng xem lại"
        eyebrow="QUAN SÁT CÂU TRẢ LỜI · KHÔNG CHẨN ĐOÁN"
      >
        {observations.length ? (
          <div className="tw-pad tw-card-list">
            {observations.map((row) => (
              <article className="tw-card" key={row.id + row.revision}>
                <div className="tw-card-top">
                  <Tag>
                    {row.topic || "Chưa ghi chủ đề"} · bản {row.revision}
                  </Tag>
                  <Tag tone={row.observed < 3 ? "amber" : "indigo"}>
                    {row.observed < 3
                      ? "Chưa đủ bằng chứng"
                      : `${row.observed} câu trả lời quan sát`}
                  </Tag>
                </div>
                <h3>
                  <MathText text={row.prompt} inline />
                </h3>
                <p>
                  {row.wrong} / {row.observed} lựa chọn khác đáp án đã đóng băng
                  trong đề. Không tính câu bỏ trống hoặc bài chưa công bố.
                </p>
                {row.counts.map((count, i) =>
                  i !== row.correctIndex && count > 0 ? (
                    <div className="tw-metric-row" key={i}>
                      <span>
                        {String.fromCharCode(65 + i)}.{" "}
                        <MathText text={row.choices[i]} inline />
                      </span>
                      <strong>{count} lượt chọn</strong>
                    </div>
                  ) : null,
                )}
                <p className="tw-note">
                  {row.observed < 3
                    ? "Cần thêm câu trả lời đã công bố trước khi nhận định về xu hướng. Có thể hỏi học sinh trình bày cách làm, không kết luận nguyên nhân từ một lựa chọn."
                    : row.wrong
                      ? "Gợi ý dạy lại theo quy tắc: đối chiếu phương án được chọn với đáp án trong đề; yêu cầu học sinh giải thích từng bước, sau đó dùng một bài tương tự để kiểm tra lại. Đây là gợi ý hoạt động, không phải kết luận AI về nguyên nhân sai."
                      : "Các lựa chọn quan sát khớp đáp án đề. Dùng một bài tương tự để kiểm tra việc vận dụng; chưa thể suy ra mức thành thạo toàn chủ đề."}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            icon={BarChart3}
            title="Chưa có câu trả lời trắc nghiệm đã công bố"
          >
            Chỉ phân tích câu có lựa chọn thực tế và đáp án của đúng phiên bản
            đề đã giao.
          </Empty>
        )}
      </Panel>
    </div>
  );
}
export function ReportsView({ client }: { client: TeachingClient }) {
  const data = client.data!,
    [classId, setClassId] = useState("");
  const rows = data.submissions.filter(
    (s) => s.status === "published" && (!classId || s.classId === classId),
  );
  function exportCSV() {
    downloadText(
      "lumio-ket-qua-da-cong-bo.csv",
      csv([
        [
          "Học sinh",
          "Lớp",
          "Bài tập",
          "Điểm",
          "Điểm tối đa",
          "Thời điểm nộp",
          "Nộp muộn",
          "Nhận xét",
        ],
        ...rows.map((s) => [
          s.studentName,
          data.classes.find((c) => c.id === s.classId)?.name || "",
          data.assignments.find((a) => a.id === s.assignmentId)?.title || "",
          s.score,
          data.assignments.find((a) => a.id === s.assignmentId)?.maxPoints,
          s.submittedAt,
          s.late ? "Có" : "Không",
          s.feedback || "",
        ]),
      ]),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <div className="tw-grid tw-enter">
      <Panel title="Kết quả đã công bố" eyebrow="BÁO CÁO TỪ DỮ LIỆU THỰC">
        <div className="tw-pad tw-form">
          <Field label="Phạm vi báo cáo">
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Tất cả lớp có quyền truy cập</option>
              {data.classes.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <p className="tw-note">
            Báo cáo chứa tên và kết quả học tập thật. Chỉ tải khi có mục đích
            phù hợp; giữ tệp riêng và không chia sẻ công khai. Các trường có thể
            gây thực thi công thức được vô hiệu hóa trong CSV.
          </p>
          <div className="tw-card-actions tw-no-print">
            <Button onClick={exportCSV} disabled={!rows.length}>
              <Download size={16} />
              Xuất CSV
            </Button>
            <Button
              secondary
              disabled={!rows.length}
              onClick={() => window.print()}
            >
              <Printer size={16} />
              In / Lưu PDF
            </Button>
          </div>
        </div>
        {rows.length ? (
          <div className="tw-table-wrap">
            <table className="tw-table">
              <caption>
                {data.organization?.name} · {rows.length} kết quả đã công bố ·{" "}
                {dateTime(data.serverTime, data.settings?.timezone)} ·{" "}
                {data.settings?.timezone || "Giờ thiết bị"}
              </caption>
              <thead>
                <tr>
                  <th>Học sinh</th>
                  <th>Bài tập</th>
                  <th>Điểm</th>
                  <th>Nộp lúc</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>{s.studentName}</td>
                    <td>
                      {
                        data.assignments.find((a) => a.id === s.assignmentId)
                          ?.title
                      }
                    </td>
                    <td>
                      {s.score} /{" "}
                      {
                        data.assignments.find((a) => a.id === s.assignmentId)
                          ?.maxPoints
                      }
                    </td>
                    <td>{dateTime(s.submittedAt, data.settings?.timezone)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={FileBarChart2} title="Chưa có kết quả để xuất">
            Dữ liệu nháp hoặc chưa công bố không bị đưa vào báo cáo.
          </Empty>
        )}
      </Panel>
    </div>
  );
}
