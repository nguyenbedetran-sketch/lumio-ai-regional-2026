"use client";
import { FileAttachments } from "./file-attachments";
import { TeachingResourceLink } from "./resource-link";
import { MathText } from "../lumio/math-text";
import { LessonContent, TeachingReferences } from "./content-preview";
export { TeachingReferences } from "./content-preview";
import { useEffect, useRef, useState } from "react";
import { useTeachingDraft } from "./draft-guard";
import {
  ArrowRight,
  BookOpen,
  Check,
  Download,
  FileQuestion,
  FileText,
  Library,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type {
  LessonDraft,
  QuestionDraft,
  TeachingLesson,
  TeachingMaterial,
  TeachingQuestion,
} from "../../lib/teaching/contracts";
import type {
  TeachingGenerationResult,
  TeachingAIKind,
  TeachingTextDraft,
} from "../../lib/teaching/content-qa";
import type { SourceEvidence } from "../../lib/ai/grounding";
import {
  FormError,
  submit,
  teachingError,
  type TeachingClient,
} from "./client";
import {
  AddButton,
  Button,
  Empty,
  Field,
  FormFooter,
  Modal,
  Panel,
  Tag,
  downloadText,
} from "./ui";
const statusLabel: Record<string, string> = {
  draft: "Bản nháp",
  reviewed: "Đã xem lại",
  published: "Đã chia sẻ",
  archived: "Lưu trữ",
};
function SourceChoices({
  client,
  value,
  onChange,
}: {
  client: TeachingClient;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div>
      <span className="tw-muted">Nguồn đã lưu (tối đa 3)</span>
      {client
        .data!.materials.filter((m) => m.status !== "archived")
        .map((material) => (
          <label
            className="tw-check"
            style={{ marginTop: 8 }}
            key={material.id}
          >
            <input
              type="checkbox"
              checked={value.includes(material.id)}
              disabled={!value.includes(material.id) && value.length >= 3}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, material.id]
                    : value.filter((id) => id !== material.id),
                )
              }
            />
            <span>
              <MathText text={material.title} inline />
              <small style={{ display: "block" }}>
                {material.content.length.toLocaleString("vi-VN")} ký tự đã xử lý
                · bản {material.revision}
              </small>
            </span>
          </label>
        ))}
      {!client.data!.materials.length && (
        <p className="tw-note">
          Chưa có nguồn đã lưu. Thêm học liệu trong Thư viện, hoặc tạo từ chủ đề
          và xem kết quả như nội dung suy luận chưa được nguồn xác nhận.
        </p>
      )}
    </div>
  );
}
function ClassChoice({
  client,
  value,
  onChange,
  optional = true,
}: {
  client: TeachingClient;
  value: string | null;
  onChange: (id: string | null) => void;
  optional?: boolean;
}) {
  return (
    <Field label="Phạm vi lớp">
      <select
        required={!optional}
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">
          {optional ? "Kho riêng của tổ chức" : "Chọn lớp"}
        </option>
        {client
          .data!.classes.filter((c) => !c.archived)
          .map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
      </select>
    </Field>
  );
}
export function GenerationPanel({
  client,
  kind,
  onUse,
  anonymousExcerpt,
}: {
  client: TeachingClient;
  kind: TeachingAIKind;
  onUse?: (result: TeachingGenerationResult) => void;
  anonymousExcerpt?: string;
}) {
  const preferences = client.data!.preferences;
  const generationDraft = useTeachingDraft("Bản nháp AI đang chuẩn bị");
  const [topic, setTopic] = useState(preferences?.subjects[0] || ""),
    [grade, setGrade] = useState(preferences?.grades[0] || ""),
    [objective, setObjective] = useState(""),
    [sources, setSources] = useState<string[]>([]),
    [difficulty, setDifficulty] = useState<"basic" | "medium" | "advanced">(
      preferences?.defaultDifficulty || "medium",
    ),
    [language, setLanguage] = useState(preferences?.aiLanguage || "vi"),
    [count, setCount] = useState(3),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<TeachingGenerationResult | null>(null),
    [attempted, setAttempted] = useState(false);
  const controller = useRef<AbortController | null>(null),
    active = useRef(true),
    pending = useRef<{ fingerprint: string; id: string } | null>(null),
    running = useRef(false);
  const sourceCharacters = client
    .data!.materials.filter((m) => sources.includes(m.id))
    .reduce((n, m) => n + m.content.length, 0);
  const aiEnabled = preferences?.aiEnabled !== false;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  const generate = async () => {
    if (running.current || !consent || !aiEnabled || sourceCharacters > 30000)
      return;
    const payload = {
      kind,
      orgId: client.data!.organization!.id,
      sourceIds: sources,
      topic,
      grade,
      objective,
      difficulty,
      count,
      language,
      externalProcessingConsent: true,
      ...(kind === "feedback" ? { anonymousExcerpt } : {}),
    };
    const fingerprint = JSON.stringify(payload);
    if (!pending.current || pending.current.fingerprint !== fingerprint)
      pending.current = { fingerprint, id: crypto.randomUUID() };
    running.current = true;
    controller.current = new AbortController();
    setBusy(true);
    setError("");
    setConsent(false);
    setResult(null);
    setAttempted(true);
    try {
      const response = await fetch("/api/teaching/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Lumio-Account": client.data!.actor.accountKey,
        },
        signal: controller.current.signal,
        body: JSON.stringify({ ...payload, requestId: pending.current.id }),
      });
      let body;
      try {
        body = await response.json();
      } catch {
        throw Error(teachingError(null));
      }
      if (!response.ok) throw Error(teachingError(body.error));
      if (active.current) {
        setResult(body);
        generationDraft.markDirty();
      }
    } catch (e) {
      if (active.current && !controller.current?.signal.aborted)
        setError(e instanceof Error ? e.message : teachingError(null));
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <Panel
      title={
        kind === "lesson"
          ? "Cùng Lumio phác thảo bài giảng"
          : kind === "questions"
            ? "Gợi ý câu hỏi có chủ đích"
            : kind === "feedback"
              ? "Gợi ý nhận xét cho đoạn đã ẩn danh"
              : "Một trợ lý, không thay người dạy"
      }
      eyebrow="LUMIO AI · KẾT QUẢ LUÔN LÀ BẢN NHÁP"
    >
      <form
        className="tw-form tw-pad"
        onInputCapture={generationDraft.markDirty}
        onChangeCapture={generationDraft.markDirty}
        onSubmit={submit(generate)}
      >
        <div className="tw-form-row">
          <Field label={kind === "assistant" ? "Câu hỏi / Chủ đề" : "Chủ đề"}>
            <input
              required
              minLength={2}
              maxLength={100}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Bạn muốn chuẩn bị điều gì?"
            />
          </Field>
          <Field label="Khối / Trình độ">
            <input
              required
              maxLength={40}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Ví dụ: Lớp 9"
            />
          </Field>
        </div>
        <Field label="Mục tiêu giảng dạy">
          <textarea
            maxLength={500}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Sau bài học, học sinh có thể…"
          />
        </Field>
        <SourceChoices client={client} value={sources} onChange={setSources} />
        <p className="tw-note">
          {sourceCharacters.toLocaleString("vi-VN")} / 30.000 ký tự nguồn được
          chọn. Chủ đề không có nguồn là nội dung suy luận cần đối chiếu.
        </p>
        {sourceCharacters > 30000 && (
          <div className="tw-alert" role="alert">
            Giảm số nguồn hoặc chọn học liệu ngắn hơn để dưới 30.000 ký tự.
          </div>
        )}
        <Field label="Ngôn ngữ bản nháp">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
            <option value="zh-CN">中文</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
          </select>
        </Field>
        {!aiEnabled && (
          <div className="tw-alert">
            Bạn đã tắt trợ lý AI trong Cài đặt. Vẫn có thể soạn nội dung thủ
            công.
          </div>
        )}
        {kind === "questions" && (
          <div className="tw-form-row">
            <Field label="Độ khó khai báo">
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as typeof difficulty)
                }
              >
                <option value="basic">Cơ bản</option>
                <option value="medium">Vừa sức</option>
                <option value="advanced">Nâng cao</option>
              </select>
            </Field>
            <Field label="Số câu (1–5)">
              <input
                type="number"
                min={1}
                max={5}
                required
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </Field>
          </div>
        )}
        <label className="tw-check">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            Tôi đồng ý gửi chủ đề, mục tiêu và nội dung các nguồn đã chọn đến
            dịch vụ AI bên ngoài. Không gửi tên, thông tin liên hệ hoặc dữ liệu
            riêng của học sinh.{" "}
            {kind === "feedback" && "Đoạn bài làm đã ẩn danh cũng được gửi."}{" "}
            Mỗi lần tạo có thể sử dụng credit; cần kiểm tra lại trước khi dùng.
          </span>
        </label>
        {error && (
          <div className="tw-alert" role="alert">
            {error}
          </div>
        )}
        <Button
          type="submit"
          busy={busy}
          disabled={
            !consent || client.busy || !aiEnabled || sourceCharacters > 30000
          }
        >
          <Sparkles size={16} />
          Tạo bản nháp
        </Button>
        {attempted && (
          <>
            <p className="tw-note">
              Không tự thử lại. Nếu mất kết nối, gửi lại nội dung y nguyên sẽ
              dùng cùng mã yêu cầu để tránh trừ credit trùng; bản nháp mất khi
              phản hồi bị thất lạc không khôi phục được bằng mã này. Muốn tạo
              một lần mới, chọn bên dưới; lần mới có thể dùng thêm credit.
            </p>
            <Button
              secondary
              disabled={busy}
              onClick={() =>
                generationDraft.close(() => {
                  pending.current = null;
                  setAttempted(false);
                  setError("");
                  setResult(null);
                  setConsent(false);
                })
              }
            >
              Bắt đầu lượt tạo mới
            </Button>
          </>
        )}
      </form>
      {result && (
        <div
          className="tw-pad"
          style={{ borderTop: "1px solid var(--tw-line)" }}
          data-teaching-ai-result
        >
          <div className="tw-card-top">
            <Tag tone={result.quality.blocked ? "amber" : "indigo"}>
              {result.quality.blocked
                ? "Cần sửa lỗi trước khi dùng"
                : "Cần giáo viên xem lại"}
            </Tag>
            <Tag>
              {result.sourceBasis.mode === "saved-sources"
                ? `${result.sourceBasis.materials.length} nguồn đã chọn`
                : "Suy luận từ chủ đề · chưa có nguồn"}
            </Tag>
          </div>
          <div className="tw-result" style={{ marginTop: 16 }}>
            <MathText
              text={
                result.kind === "lesson"
                  ? (result.draft as LessonDraft).title +
                    "\n\n" +
                    (result.draft as LessonDraft).sections
                      .map((s) => s.title + "\n" + s.body)
                      .join("\n\n")
                  : result.kind === "questions"
                    ? (result.draft as QuestionDraft[])
                        .map(
                          (q, i) =>
                            `${i + 1}. ${q.prompt}\n${q.choices.map((c, j) => String.fromCharCode(65 + j) + ". " + c).join("\n")}\n${q.explanation || ""}`,
                        )
                        .join("\n\n")
                    : (result.draft as TeachingTextDraft).text
              }
            />
          </div>
          <ul className="tw-muted" style={{ paddingLeft: 18, marginTop: 18 }}>
            {result.quality.issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
          {onUse && (
            <Button
              secondary
              disabled={result.quality.blocked || client.busy}
              onClick={() => {
                generationDraft.markClean();
                onUse(result);
              }}
            >
              Mở trong trình chỉnh sửa <ArrowRight size={15} />
            </Button>
          )}
          <Button secondary onClick={generationDraft.markClean}>
            Đã xem, không cần lưu
          </Button>
          {["assistant", "feedback"].includes(result.kind) && (
            <TeachingReferences
              references={(result.draft as TeachingTextDraft).references}
              client={client}
            />
          )}
        </div>
      )}
    </Panel>
  );
}

export function LessonsView({ client }: { client: TeachingClient }) {
  const [editing, setEditing] = useState<TeachingLesson | LessonDraft | null>(
      null,
    ),
    [showAI, setShowAI] = useState(false),
    [query, setQuery] = useState(""),
    [previewing, setPreviewing] = useState<{
      id: string;
      revision: number;
      action: "lesson.review" | "lesson.publish";
    } | null>(null);
  const data = client.data!,
    items = data.lessons.filter((l) =>
      [l.title, l.topic, l.grade]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    );
  const previewLesson = previewing
    ? data.lessons.find((lesson) => lesson.id === previewing.id)
    : undefined;
  const previewCurrent =
    !!previewLesson && previewLesson.revision === previewing?.revision;
  const blank: LessonDraft = {
    classId: null,
    title: "",
    topic: "",
    grade: "",
    objectives: [],
    sections: [{ title: "Khởi động", body: "", references: [] }],
    sourceIds: [],
  };
  return (
    <div className="tw-grid tw-enter">
      <div className="tw-toolbar">
        <label className="tw-search">
          <Search size={16} />
          <input
            aria-label="Tìm bài giảng"
            placeholder="Tìm bài giảng hoặc chủ đề…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="tw-card-actions">
          <Button secondary onClick={() => setShowAI((v) => !v)}>
            <Sparkles size={16} />
            Phác thảo với AI
          </Button>
          <AddButton onClick={() => setEditing(blank)}>
            Soạn bài giảng
          </AddButton>
        </div>
      </div>
      {showAI && (
        <GenerationPanel
          client={client}
          kind="lesson"
          onUse={(result) => setEditing(result.draft as LessonDraft)}
        />
      )}
      <div className="tw-grid two">
        {items.map((lesson) => (
          <article className="tw-card" key={lesson.id}>
            <div className="tw-card-top">
              <BookOpen size={21} />
              <Tag tone={lesson.status === "draft" ? "amber" : "green"}>
                {statusLabel[lesson.status]}
              </Tag>
            </div>
            <h3>
              <MathText text={lesson.title} inline />
            </h3>
            <p>
              <MathText text={lesson.topic} inline /> · Khối{" "}
              <MathText text={lesson.grade} inline /> · {lesson.sections.length}{" "}
              phần
            </p>
            <details className="tw-note" style={{ marginTop: 12 }}>
              <summary>Xem bài giảng</summary>
              <LessonContent
                lesson={lesson}
                client={client}
                showTitle={false}
              />
            </details>
            <FileAttachments
              client={client}
              target={{ kind: "lesson", id: lesson.id }}
              allowUpload={lesson.status === "draft" && !!lesson.classId}
            />
            <div className="tw-card-footer">
              <button
                className="tw-text-button"
                onClick={() => setEditing(lesson)}
              >
                Mở & chỉnh sửa <ArrowRight size={13} />
              </button>
              <div className="tw-card-actions">
                <button
                  className="tw-text-button"
                  onClick={() =>
                    downloadText(
                      lesson.title + ".md",
                      lessonMarkdown(lesson),
                      "text/markdown;charset=utf-8",
                    )
                  }
                >
                  <Download size={13} />
                  Markdown (mã nguồn)
                </button>
                {lesson.status === "draft" && (
                  <button
                    className="tw-text-button"
                    disabled={client.busy}
                    onClick={() =>
                      setPreviewing({
                        id: lesson.id,
                        revision: lesson.revision,
                        action: "lesson.review",
                      })
                    }
                  >
                    <Check size={13} />
                    Đã xem lại
                  </button>
                )}
                {lesson.status === "reviewed" && (
                  <button
                    className="tw-text-button"
                    disabled={client.busy || !lesson.classId}
                    onClick={() =>
                      setPreviewing({
                        id: lesson.id,
                        revision: lesson.revision,
                        action: "lesson.publish",
                      })
                    }
                  >
                    Chia sẻ cho lớp
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <Panel>
          <Empty
            icon={BookOpen}
            title="Một bài giảng bắt đầu từ ý tưởng của bạn"
            action={
              <Button onClick={() => setEditing(blank)}>
                Soạn bài đầu tiên
              </Button>
            }
          >
            Dán học liệu vào Thư viện, đặt mục tiêu và chia bài thành những phần
            rõ ràng. Bản AI luôn cần bạn biên tập.
          </Empty>
        </Panel>
      )}
      {previewing && (
        <Modal
          title="Xem trước bài giảng"
          onClose={() => setPreviewing(null)}
          disabled={client.busy}
        >
          <p className="tw-note">
            {previewing.action === "lesson.review"
              ? "Kiểm tra nội dung, công thức và trích đoạn nguồn trước khi xác nhận đã xem lại. Đây chưa phải thao tác công bố."
              : "Đây là cách bài giảng hiển thị trong lớp. Chỉ công bố sau khi bạn kiểm tra nội dung, đáp án và nguồn."}
          </p>
          <FormError client={client} />
          {!previewCurrent && (
            <p className="tw-alert" role="alert">
              Bài giảng đã thay đổi. Đóng bản xem trước và mở lại bản mới nhất
              trước khi xác nhận.
            </p>
          )}
          {previewCurrent && (
            <LessonContent lesson={previewLesson!} client={client} />
          )}
          <div className="tw-form-footer">
            <Button
              secondary
              onClick={() => setPreviewing(null)}
              disabled={client.busy}
            >
              Quay lại
            </Button>
            <Button
              busy={client.busy}
              disabled={!previewCurrent}
              onClick={() => {
                if (!previewCurrent) return;
                void client
                  .mutate({
                    action: previewing.action,
                    id: previewing.id,
                    expectedRevision: previewing.revision,
                  })
                  .then(() => setPreviewing(null))
                  .catch(() => {});
              }}
            >
              {previewing.action === "lesson.review"
                ? "Xác nhận đã xem bản trình bày"
                : "Xác nhận chia sẻ cho lớp"}
            </Button>
          </div>
        </Modal>
      )}
      {editing && (
        <LessonEditor
          key={"id" in editing ? editing.id : "new"}
          client={client}
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
function lessonMarkdown(lesson: LessonDraft) {
  return `# ${lesson.title}\n\n${lesson.topic} · Khối ${lesson.grade}\n\n## Mục tiêu\n${lesson.objectives.map((o) => "- " + o).join("\n")}\n\n${lesson.sections.map((s) => "## " + s.title + "\n\n" + s.body + "\n" + s.references.map((r) => `> ${r.quote} (đoạn ${r.paragraph})`).join("\n")).join("\n\n")}`;
}
function LessonEditor({
  client,
  initial,
  onClose,
}: {
  client: TeachingClient;
  initial: TeachingLesson | LessonDraft;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<LessonDraft>({
      classId: initial.classId,
      title: initial.title,
      topic: initial.topic,
      grade: initial.grade,
      objectives: [...initial.objectives],
      sections: initial.sections.map((section) => ({ ...section })),
      sourceIds: [...initial.sourceIds],
    }),
    [objectives, setObjectives] = useState(initial.objectives.join("\n"));
  const patch = (key: keyof LessonDraft, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  return (
    <Modal
      title={"id" in initial ? "Biên tập bài giảng" : "Soạn bài giảng"}
      onClose={onClose}
      disabled={client.busy}
      initiallyDirty={
        !("id" in initial) &&
        !!(initial.title.trim() || initial.sections.some((s) => s.body.trim()))
      }
    >
      <form
        className="tw-form"
        onSubmit={submit(async () => {
          const next = {
            ...draft,
            objectives: objectives
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          };
          await client.mutate(
            "id" in initial
              ? {
                  action: "lesson.update",
                  id: initial.id,
                  expectedRevision: initial.revision,
                  draft: next,
                }
              : { action: "lesson.create", draft: next },
          );
          onClose();
        })}
      >
        <FormError client={client} />
        <Field label="Tên bài giảng">
          <input
            required
            maxLength={180}
            value={draft.title}
            onChange={(e) => patch("title", e.target.value)}
          />
        </Field>
        <div className="tw-form-row">
          <Field label="Chủ đề">
            <input
              required
              maxLength={120}
              value={draft.topic}
              onChange={(e) => patch("topic", e.target.value)}
            />
          </Field>
          <Field label="Khối / Trình độ">
            <input
              required
              maxLength={40}
              value={draft.grade}
              onChange={(e) => patch("grade", e.target.value)}
            />
          </Field>
        </div>
        <ClassChoice
          client={client}
          value={draft.classId}
          onChange={(id) => patch("classId", id)}
        />
        <Field label="Mục tiêu (mỗi dòng một mục tiêu)">
          <textarea
            required
            value={objectives}
            maxLength={4000}
            onChange={(e) => setObjectives(e.target.value)}
          />
        </Field>
        <SourceChoices
          client={client}
          value={draft.sourceIds}
          onChange={(ids) => patch("sourceIds", ids)}
        />
        {draft.sections.map((section, i) => (
          <section className="tw-card tw-form" key={i}>
            <Field label={`Tên phần ${i + 1}`}>
              <input
                required
                maxLength={180}
                value={section.title}
                onChange={(e) =>
                  patch(
                    "sections",
                    draft.sections.map((s, j) =>
                      j === i ? { ...s, title: e.target.value } : s,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Nội dung phần">
              <textarea
                className="tw-editor"
                required
                maxLength={20000}
                value={section.body}
                onChange={(e) =>
                  patch(
                    "sections",
                    draft.sections.map((s, j) =>
                      j === i ? { ...s, body: e.target.value } : s,
                    ),
                  )
                }
              />
            </Field>
            <TeachingReferences
              references={section.references}
              client={client}
            />
            {draft.sections.length > 1 && (
              <button
                type="button"
                className="tw-text-button"
                onClick={() =>
                  patch(
                    "sections",
                    draft.sections.filter((_, j) => j !== i),
                  )
                }
              >
                Bỏ phần này
              </button>
            )}
          </section>
        ))}
        <Button
          secondary
          type="button"
          disabled={draft.sections.length >= 20}
          onClick={() =>
            patch("sections", [
              ...draft.sections,
              { title: "", body: "", references: [] },
            ])
          }
        >
          <Plus size={15} />
          Thêm phần
        </Button>
        <p className="tw-note">
          Lưu tạo bản nháp. Sau khi kiểm tra nội dung và nguồn, đánh dấu đã xem
          lại rồi mới chia sẻ cho lớp.
        </p>
        <details className="tw-card" data-lesson-editor-preview>
          <summary className="tw-text-button">
            Xem trước cách học sinh đọc
          </summary>
          <p className="tw-note">
            Bản xem trước cập nhật từ nội dung đang nhập, chưa lưu hoặc công bố.
            Ô soạn thảo giữ nguyên Markdown / LaTeX để bạn sửa.
          </p>
          <LessonContent
            lesson={{
              ...draft,
              objectives: objectives
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            }}
            client={client}
          />
        </details>
        <FormFooter busy={client.busy} onClose={onClose} label="Lưu bản nháp" />
      </form>
    </Modal>
  );
}

export function QuestionsView({ client }: { client: TeachingClient }) {
  const [editing, setEditing] = useState<
      TeachingQuestion | QuestionDraft | null
    >(null),
    [showAI, setShowAI] = useState(false),
    [generated, setGenerated] = useState<QuestionDraft[]>([]),
    [query, setQuery] = useState("");
  const blank: QuestionDraft = {
    classId: null,
    prompt: "",
    kind: "mcq",
    choices: ["", "", "", ""],
    correctIndex: 0,
    maxPoints: 1,
    topic: "",
    difficulty: "medium",
    references: [],
  };
  return (
    <div className="tw-grid tw-enter">
      <div className="tw-toolbar">
        <label className="tw-search">
          <Search size={16} />
          <input
            aria-label="Tìm câu hỏi"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm nội dung hoặc chủ đề…"
          />
        </label>
        <div className="tw-card-actions">
          <Button secondary onClick={() => setShowAI((v) => !v)}>
            <Sparkles size={15} />
            Gợi ý với AI
          </Button>
          <AddButton onClick={() => setEditing(blank)}>Thêm câu hỏi</AddButton>
        </div>
      </div>
      {showAI && (
        <GenerationPanel
          client={client}
          kind="questions"
          onUse={(r) => setGenerated(r.draft as QuestionDraft[])}
        />
      )}{" "}
      {!!generated.length && (
        <Panel title="Câu hỏi AI chưa lưu">
          <div className="tw-pad tw-card-list">
            {generated.map((q, i) => (
              <article key={i} className="tw-card">
                <Tag tone="amber">Cần biên tập</Tag>
                <h3>
                  <MathText text={q.prompt} inline />
                </h3>
                <Button secondary onClick={() => setEditing(q)}>
                  Chỉnh sửa câu {i + 1}
                </Button>
              </article>
            ))}
          </div>
        </Panel>
      )}
      {client
        .data!.questions.filter((q) =>
          [q.prompt, q.topic]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
        )
        .map((q) => (
          <article className="tw-card" key={q.id}>
            <div className="tw-card-top">
              <Tag tone={q.status === "reviewed" ? "green" : "amber"}>
                {statusLabel[q.status]}
              </Tag>
              <span className="tw-subtle">
                {q.kind === "mcq"
                  ? "Trắc nghiệm"
                  : q.kind === "short"
                    ? "Trả lời ngắn"
                    : "Tự luận"}{" "}
                · {q.maxPoints} điểm ·{" "}
                {q.difficulty === "basic"
                  ? "Cơ bản"
                  : q.difficulty === "medium"
                    ? "Vừa sức"
                    : "Nâng cao"}
              </span>
            </div>
            <h3>
              <MathText text={q.prompt} inline />
            </h3>
            {q.choices.length > 0 && (
              <ol type="A" className="tw-muted">
                {q.choices.map((c, i) => (
                  <li key={i}>
                    <MathText text={c} inline />
                    {q.correctIndex === i ? " ✓" : ""}
                  </li>
                ))}
              </ol>
            )}
            {(q.explanation || q.modelAnswer) && (
              <details className="tw-note">
                <summary>Đối chiếu lời giải</summary>
                <MathText
                  text={[q.modelAnswer, q.explanation]
                    .filter(Boolean)
                    .join("\n\n")}
                />
              </details>
            )}
            <TeachingReferences references={q.references} client={client} />
            <div className="tw-card-footer">
              <button className="tw-text-button" onClick={() => setEditing(q)}>
                Chỉnh sửa
              </button>
              {q.status === "draft" && (
                <button
                  className="tw-text-button"
                  disabled={client.busy}
                  onClick={() =>
                    void client
                      .mutate({
                        action: "question.review",
                        id: q.id,
                        expectedRevision: q.revision,
                      })
                      .catch(() => {})
                  }
                >
                  Xác nhận đã kiểm tra đáp án
                </button>
              )}
            </div>
          </article>
        ))}
      {!client.data!.questions.length && (
        <Panel>
          <Empty icon={FileQuestion} title="Câu hỏi tốt mở đầu cách hiểu tốt">
            Tạo trắc nghiệm, câu ngắn hoặc tự luận. Chỉ câu đã được xem lại mới
            dùng để giao bài.
          </Empty>
        </Panel>
      )}
      {editing && (
        <QuestionEditor
          key={"id" in editing ? editing.id : "new" + editing.prompt}
          client={client}
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
function QuestionEditor({
  client,
  initial,
  onClose,
}: {
  client: TeachingClient;
  initial: TeachingQuestion | QuestionDraft;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<QuestionDraft>({
      classId: initial.classId,
      prompt: initial.prompt,
      kind: initial.kind,
      choices: [...initial.choices],
      correctIndex: initial.correctIndex,
      modelAnswer: initial.modelAnswer,
      explanation: initial.explanation,
      rubric: initial.rubric?.map((criterion) => ({ ...criterion })),
      maxPoints: initial.maxPoints,
      topic: initial.topic,
      difficulty: initial.difficulty,
      references: initial.references.map((reference) => ({ ...reference })),
    }),
    [rubric, setRubric] = useState(
      (initial.rubric || []).map((r) => r.label + " | " + r.points).join("\n"),
    );
  const patch = (key: keyof QuestionDraft, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  return (
    <Modal
      title="Biên tập câu hỏi"
      onClose={onClose}
      disabled={client.busy}
      initiallyDirty={!("id" in initial) && !!initial.prompt.trim()}
    >
      <form
        className="tw-form"
        onSubmit={submit(async () => {
          const next = {
            ...draft,
            choices: draft.kind === "mcq" ? draft.choices : [],
            ...(draft.kind !== "mcq"
              ? {
                  correctIndex: undefined,
                  rubric: rubric
                    .split("\n")
                    .filter((s) => s.trim())
                    .map((s) => {
                      const [label, points] = s.split("|");
                      return { label: label.trim(), points: Number(points) };
                    }),
                }
              : { rubric: undefined }),
          };
          await client.mutate(
            "id" in initial
              ? {
                  action: "question.update",
                  id: initial.id,
                  expectedRevision: initial.revision,
                  draft: next,
                }
              : { action: "question.create", draft: next },
          );
          onClose();
        })}
      >
        <FormError client={client} />
        <Field label="Câu hỏi">
          <textarea
            required
            maxLength={4000}
            value={draft.prompt}
            onChange={(e) => patch("prompt", e.target.value)}
          />
        </Field>
        <div className="tw-form-row">
          <Field label="Loại câu hỏi">
            <select
              value={draft.kind}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  kind: e.target.value as QuestionDraft["kind"],
                  choices: e.target.value === "mcq" ? ["", "", "", ""] : [],
                  correctIndex: e.target.value === "mcq" ? 0 : undefined,
                }))
              }
            >
              <option value="mcq">Trắc nghiệm</option>
              <option value="short">Trả lời ngắn</option>
              <option value="essay">Tự luận</option>
            </select>
          </Field>
          <Field label="Điểm tối đa">
            <input
              required
              type="number"
              min={0.1}
              max={100}
              step={0.1}
              value={draft.maxPoints}
              onChange={(e) => patch("maxPoints", Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="tw-form-row">
          <Field label="Chủ đề">
            <input
              required
              maxLength={120}
              value={draft.topic}
              onChange={(e) => patch("topic", e.target.value)}
            />
          </Field>
          <Field label="Độ khó">
            <select
              value={draft.difficulty}
              onChange={(e) => patch("difficulty", e.target.value)}
            >
              <option value="basic">Cơ bản</option>
              <option value="medium">Vừa sức</option>
              <option value="advanced">Nâng cao</option>
            </select>
          </Field>
        </div>
        <ClassChoice
          client={client}
          value={draft.classId}
          onChange={(id) => patch("classId", id)}
        />
        {draft.kind === "mcq" ? (
          <>
            {draft.choices.map((choice, i) => (
              <Field key={i} label={`Lựa chọn ${String.fromCharCode(65 + i)}`}>
                <input
                  required
                  maxLength={2000}
                  value={choice}
                  onChange={(e) =>
                    patch(
                      "choices",
                      draft.choices.map((c, j) =>
                        j === i ? e.target.value : c,
                      ),
                    )
                  }
                />
              </Field>
            ))}
            <Field label="Đáp án đúng">
              <select
                value={draft.correctIndex ?? 0}
                onChange={(e) => patch("correctIndex", Number(e.target.value))}
              >
                {draft.choices.map((_, i) => (
                  <option value={i} key={i}>
                    {String.fromCharCode(65 + i)}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Đáp án / Hướng dẫn chấm">
              <textarea
                required
                maxLength={10000}
                value={draft.modelAnswer || ""}
                onChange={(e) => patch("modelAnswer", e.target.value)}
              />
            </Field>
            <Field
              label="Tiêu chí chấm"
              hint="Mỗi dòng: Nội dung tiêu chí | số điểm. Tổng điểm cần khớp điểm tối đa."
            >
              <textarea
                required
                value={rubric}
                onChange={(e) => setRubric(e.target.value)}
                placeholder="Lập luận đúng | 2\nKết luận và điều kiện | 1"
              />
            </Field>
          </>
        )}
        <Field label="Giải thích đáp án">
          <textarea
            maxLength={10000}
            value={draft.explanation || ""}
            onChange={(e) => patch("explanation", e.target.value)}
          />
        </Field>
        <TeachingReferences references={draft.references} client={client} />
        <FormFooter
          busy={client.busy}
          onClose={onClose}
          label="Lưu câu hỏi nháp"
        />
      </form>
    </Modal>
  );
}

export function LibraryView({ client }: { client: TeachingClient }) {
  const [editing, setEditing] = useState<TeachingMaterial | "new" | null>(null),
    [query, setQuery] = useState("");
  const items = client.data!.materials.filter((m) =>
    [m.title, m.content]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="tw-grid tw-enter">
      <div className="tw-toolbar">
        <label className="tw-search">
          <Search size={16} />
          <input
            aria-label="Tìm học liệu giảng dạy"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tên hoặc nội dung học liệu…"
          />
        </label>
        <AddButton onClick={() => setEditing("new")}>Thêm học liệu</AddButton>
      </div>
      <div className="tw-grid two">
        {items.map((material) => (
          <article className="tw-card" key={material.id}>
            <div className="tw-card-top">
              <FileText size={22} />
              <Tag tone={material.status === "published" ? "green" : "neutral"}>
                {statusLabel[material.status]}
              </Tag>
            </div>
            <h3>
              <MathText text={material.title} inline />
            </h3>
            <p>
              {material.kind.toLocaleUpperCase()} ·{" "}
              {material.content.length.toLocaleString("vi-VN")} ký tự đã xử lý
            </p>
            <details className="tw-note" style={{ marginTop: 10 }}>
              <summary>Xem nội dung đã xử lý</summary>
              <MathText text={material.content} />
            </details>
            <TeachingResourceLink
              url={material.url}
              title={material.title}
              kind={material.kind}
            />
            <div className="tw-card-footer">
              <button
                className="tw-text-button"
                onClick={() => setEditing(material)}
              >
                Mở & chỉnh sửa
              </button>
              <div className="tw-card-actions">
                <button
                  className="tw-text-button"
                  onClick={() =>
                    downloadText(material.title + ".txt", material.content)
                  }
                >
                  <Download size={13} />
                  TXT (văn bản nguồn)
                </button>
                {material.status === "draft" && (
                  <button
                    className="tw-text-button"
                    disabled={client.busy}
                    onClick={() =>
                      void client
                        .mutate({
                          action: "material.review",
                          id: material.id,
                          expectedRevision: material.revision,
                        })
                        .catch(() => {})
                    }
                  >
                    Đã xem lại
                  </button>
                )}
                {material.status === "reviewed" && (
                  <button
                    className="tw-text-button"
                    disabled={client.busy || !material.classId}
                    onClick={() =>
                      void client
                        .mutate({
                          action: "material.publish",
                          id: material.id,
                          expectedRevision: material.revision,
                        })
                        .catch(() => {})
                    }
                  >
                    Chia sẻ cho lớp
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <Panel>
          <Empty
            icon={Library}
            title="Học liệu của bạn là điểm bắt đầu"
            action={
              <Button onClick={() => setEditing("new")}>
                Thêm học liệu đầu tiên
              </Button>
            }
          >
            Dán văn bản hoặc trích xuất PDF, DOCX, PPTX. Chỉ phần đã xử lý được
            dùng để hỗ trợ bài giảng và AI.
          </Empty>
        </Panel>
      )}
      {editing && (
        <MaterialEditor
          client={client}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
function MaterialEditor({
  client,
  initial,
  onClose,
}: {
  client: TeachingClient;
  initial: TeachingMaterial | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || ""),
    [content, setContent] = useState(initial?.content || ""),
    [classId, setClassId] = useState<string | null>(initial?.classId || null),
    [kind, setKind] = useState<TeachingMaterial["kind"]>(
      initial?.kind || "text",
    ),
    [url, setUrl] = useState(initial?.url || ""),
    [evidence, setEvidence] = useState<SourceEvidence | undefined>(
      initial?.sourceEvidence,
    ),
    [extracting, setExtracting] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function extract(file: File) {
    if (file.size > 6 * 1024 * 1024) {
      setError("Tệp cần nhỏ hơn 6 MiB.");
      return;
    }
    setExtracting(true);
    setError("");
    controller.current = new AbortController();
    try {
      const bytes = await file.arrayBuffer();
      if (/\.txt$/i.test(file.name)) {
        const text = new TextDecoder().decode(bytes);
        if (text.length > 100000)
          throw Error(
            "Văn bản vượt 100.000 ký tự; hãy chia học liệu trước khi lưu.",
          );
        setContent(text);
        setKind("text");
        setEvidence(undefined);
      } else {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(Error("FILE_READ_ERROR"));
          reader.readAsDataURL(new Blob([bytes]));
        });
        const response = await fetch("/api/ingest-document", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Lumio-Account": client.data!.actor.accountKey,
          },
          signal: controller.current.signal,
          body: JSON.stringify({ filename: file.name, data: base64 }),
        });
        const result = await response.json();
        if (!response.ok)
          throw Error(
            "Không trích xuất được tệp. Chỉ hỗ trợ PDF có chữ, DOCX và PPTX; không tự đọc ảnh scan hoặc Office Math.",
          );
        if (result.text.length > 100000)
          throw Error(
            "Văn bản vượt 100.000 ký tự; hãy chia học liệu trước khi lưu.",
          );
        setContent(result.text);
        setEvidence(result.sourceEvidence);
        setKind(
          /\.docx$/i.test(file.name)
            ? "docx"
            : /\.pptx$/i.test(file.name)
              ? "pptx"
              : "pdf",
        );
      }
      if (!title) setTitle(file.name);
    } catch (e) {
      if (!controller.current?.signal.aborted)
        setError(e instanceof Error ? e.message : "Chưa đọc được tệp.");
    } finally {
      setExtracting(false);
    }
  }
  return (
    <Modal
      title={initial ? "Chỉnh sửa học liệu" : "Thêm học liệu giảng dạy"}
      onClose={onClose}
      disabled={client.busy || extracting}
    >
      <form
        className="tw-form"
        onSubmit={submit(async () => {
          const draft = {
            title,
            content,
            classId,
            kind,
            ...(url ? { url } : {}),
            ...(evidence ? { sourceEvidence: evidence } : {}),
          };
          await client.mutate(
            initial
              ? {
                  action: "material.update",
                  id: initial.id,
                  expectedRevision: initial.revision,
                  draft,
                }
              : { action: "material.create", draft },
          );
          onClose();
        })}
      >
        <FormError client={client} />
        {error && (
          <div className="tw-alert" role="alert">
            {error}
          </div>
        )}
        <Field label="Tên học liệu">
          <input
            required
            maxLength={180}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <ClassChoice client={client} value={classId} onChange={setClassId} />
        <Field
          label="Đọc từ tệp"
          hint="Tệp được gửi đến máy chủ Lumio để trích xuất, chưa gửi đến AI. Không tải dữ liệu riêng của học sinh."
        >
          <input
            type="file"
            accept=".pdf,.docx,.pptx,.txt"
            disabled={extracting || client.busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void extract(file);
            }}
          />
        </Field>
        <Field
          label="Liên kết nguồn (tùy chọn)"
          hint="Lưu địa chỉ tham khảo, không khẳng định đã tự đọc toàn bộ website."
        >
          <input
            type="url"
            maxLength={1500}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <Field
          label="Nội dung đã xử lý"
          hint={
            evidence
              ? "Có metadata trích xuất. Chỉnh văn bản sẽ bỏ chứng thực vị trí cũ."
              : "Văn bản do bạn cung cấp; không tự tạo số trang hoặc mốc video."
          }
        >
          <textarea
            className="tw-editor"
            required
            maxLength={100000}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setEvidence(undefined);
              setKind("text");
            }}
          />
        </Field>
        <p className="tw-note">
          Nội dung được lưu trong tổ chức. Chỉ chia sẻ cho lớp sau khi bạn xem
          lại và chọn công bố; bản gốc không được lưu trong thư viện này.
        </p>
        <details className="tw-card" data-material-editor-preview>
          <summary className="tw-text-button">Xem trước học liệu</summary>
          <h3>
            <MathText text={title} inline />
          </h3>
          <MathText text={content} />
          <TeachingResourceLink url={url} title={title} kind={kind} />
        </details>
        <FormFooter
          busy={client.busy || extracting}
          onClose={onClose}
          label={extracting ? "Đang trích xuất…" : "Lưu học liệu nháp"}
        />
      </form>
    </Modal>
  );
}
export function AssistantView({ client }: { client: TeachingClient }) {
  return <GenerationPanel client={client} kind="assistant" />;
}
