"use client";
import { MathText } from "../lumio/math-text";
import { useEffect, useState } from "react";
import {
  TeachingDraftBoundary,
  useTeachingDraft,
  useTeachingDraftGuard,
} from "./draft-guard";
import { useTeachingTabs } from "./tabs";
import { signIn } from "next-auth/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  KeyRound,
  RefreshCw,
  Users,
} from "lucide-react";
import type {
  TeachingAnswer,
  TeachingAssignment,
} from "../../lib/teaching/contracts";
import { BrandSymbol } from "../lumio/brand";
import {
  FormError,
  submit,
  useTeachingClient,
  type TeachingClient,
} from "./client";
import {
  Button,
  Empty,
  Field,
  FormFooter,
  Modal,
  Notice,
  Panel,
  Tag,
  dateTime,
  ModalCancelButton,
} from "./ui";

export function StudentClassroom({
  account,
  providers,
}: {
  account: { key: string; id: string; name: string } | null;
  providers: { google: boolean; facebook: boolean };
}) {
  if (!account)
    return (
      <div className="tw-shell" style={{ display: "block" }}>
        <header className="tw-topbar">
          <a className="tw-brand" href="/">
            <BrandSymbol />
            <div>
              Lumio<small>CLASSROOM</small>
            </div>
          </a>
          <a href="/" className="tw-text-button">
            <ArrowLeft size={14} />
            Về không gian học
          </a>
        </header>
        <main className="tw-content" style={{ maxWidth: 900, paddingTop: 70 }}>
          <Panel>
            <Empty
              icon={GraduationCap}
              title="Cùng lớp, theo nhịp của bạn"
              action={
                <div className="tw-card-actions">
                  {providers.google && (
                    <Button
                      onClick={() =>
                        void signIn("google", { callbackUrl: "/classroom" })
                      }
                    >
                      Đăng nhập Google
                    </Button>
                  )}
                  {providers.facebook && (
                    <Button
                      secondary
                      onClick={() =>
                        void signIn("facebook", { callbackUrl: "/classroom" })
                      }
                    >
                      Đăng nhập Facebook
                    </Button>
                  )}
                </div>
              }
            >
              Đăng nhập rồi nhập mã giáo viên cung cấp. Bài tập và kết quả của
              lớp chỉ hiện sau khi tài khoản của bạn được xác nhận.
            </Empty>
          </Panel>
        </main>
      </div>
    );
  return (
    <TeachingDraftBoundary key={account.key}>
      <ClassroomAccount account={account} />
    </TeachingDraftBoundary>
  );
}
function ClassroomAccount({
  account,
}: {
  account: { key: string; id: string; name: string };
}) {
  const client = useTeachingClient(account.key),
    [code, setCode] = useState(""),
    [join, setJoin] = useState(false),
    [tab, setTab] = useState("assignments"),
    [selected, setSelected] = useState<TeachingAssignment | null>(null);
  const data = client.data;
  const guard = useTeachingDraftGuard(),
    joinDraft = useTeachingDraft("Mã tham gia lớp"),
    tabChoices = [
      ["assignments", "Bài tập"],
      ["materials", "Học liệu"],
      ["lessons", "Bài giảng"],
      ["announcements", "Bảng tin"],
      ["calendar", "Lịch lớp"],
      ["results", "Kết quả"],
    ] as const,
    tabs = useTeachingTabs(tab, tabChoices, setTab);
  useEffect(() => {
    setSelected(null);
    setJoin(false);
  }, [data?.organization?.id]);
  const joinForm = (
    <form
      className="tw-form"
      onInputCapture={joinDraft.markDirty}
      onSubmit={submit(async () => {
        await client.mutate({ action: "class.join", code: code.trim() });
        joinDraft.markClean();
        setJoin(false);
        setCode("");
      })}
    >
      <FormError client={client} />
      <Field
        label="Mã tham gia lớp"
        hint="Mã do giáo viên gửi, có thể hết hạn hoặc bị thu hồi."
      >
        <input
          required
          minLength={4}
          maxLength={100}
          value={code}
          autoComplete="off"
          onChange={(e) => setCode(e.target.value)}
          placeholder="Nhập mã lớp"
        />
      </Field>
      <p className="tw-note">
        Khi tham gia, tên tài khoản và bài làm trong lớp được giáo viên có quyền
        xem. Dữ liệu học riêng ngoài lớp không được chia sẻ.
      </p>
      <div className="tw-form-footer">
        {join && (
          <ModalCancelButton
            disabled={client.busy}
            onClose={() => {
              setJoin(false);
              setCode("");
              joinDraft.markClean();
            }}
          >
            Hủy
          </ModalCancelButton>
        )}
        <Button type="submit" busy={client.busy}>
          Tham gia lớp <ArrowRight size={15} />
        </Button>
      </div>
    </form>
  );
  return (
    <div
      className="tw-shell"
      style={{ display: "block" }}
      data-student-classroom
    >
      <header className="tw-topbar">
        <a className="tw-brand" href="/">
          <BrandSymbol />
          <div>
            Lumio<small>CLASSROOM</small>
          </div>
        </a>
        <div className="tw-topbar-actions">
          {data?.organizations.length ? (
            <select
              aria-label="Tổ chức lớp học"
              value={data.organization?.id || ""}
              disabled={client.busy || client.loading}
              onChange={(e) => {
                const id = e.target.value;
                guard.leave(() => void client.selectOrganization(id));
              }}
            >
              {data.organizations.map((org) => (
                <option value={org.id} key={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          ) : null}
          {data?.organization && (
            <Button
              secondary
              disabled={client.busy}
              onClick={() => setJoin(true)}
            >
              <KeyRound size={15} />
              Nhập mã lớp
            </Button>
          )}
          <button
            className="tw-icon-button"
            disabled={client.busy || client.loading}
            aria-label="Tải lại lớp học"
            onClick={() => void client.reload()}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>
      <main className="tw-content" style={{ maxWidth: 1200 }}>
        <div className="tw-heading">
          <div>
            <span className="tw-eyebrow">LUMIO / GÓC HỌC SINH</span>
            <h1>Chào {account.name}. Cùng học một điều mới.</h1>
            <p>
              Bài được giao, học liệu và kết quả giáo viên đã công bố, trong một
              nơi.
            </p>
          </div>
        </div>
        {client.error && (
          <div className="tw-alert" role="alert">
            {client.error}
          </div>
        )}
        {client.notice && <Notice>{client.notice}</Notice>}
        {!client.online && (
          <p className="tw-note">
            Bạn đang ngoại tuyến. Câu trả lời đang nhập chỉ giữ trên trang; kết
            nối lại trước khi nộp và kiểm tra xác nhận từ máy chủ.
          </p>
        )}
        {!data ? (
          <Panel>
            <Empty
              icon={RefreshCw}
              title={
                client.loading ? "Đang tải lớp học" : "Chưa tải được lớp học"
              }
            >
              Đang xác nhận tài khoản và quyền xem dữ liệu.
            </Empty>
          </Panel>
        ) : !data.organization ? (
          <Panel title="Tham gia lớp đầu tiên">
            <div className="tw-pad">{joinForm}</div>
          </Panel>
        ) : data.role !== "STUDENT" ? (
          <Panel>
            <Empty
              icon={GraduationCap}
              title="Bạn đang có vai trò giảng dạy trong tổ chức này"
              action={
                <a href="/teacher" className="tw-button">
                  Mở không gian giáo viên <ArrowRight size={15} />
                </a>
              }
            >
              Góc này chỉ nhận bài làm với vai trò học sinh. Chọn một tổ chức
              khác nếu bạn đã tham gia với vai trò học sinh.
            </Empty>
          </Panel>
        ) : (
          <>
            <div
              className="tw-tabs"
              {...tabs.listProps}
              aria-label="Nội dung lớp học"
            >
              {tabChoices.map(([key, label]) => (
                <button key={key} {...tabs.buttonProps(key)}>
                  {label}
                </button>
              ))}
            </div>
            <div {...tabs.panelProps}>
              {tab === "assignments" ? (
                <div className="tw-grid two">
                  {data.assignments.map((assignment) => {
                    const own = data.submissions.find(
                      (s) =>
                        s.assignmentId === assignment.id &&
                        s.studentId === data.actor.userId,
                    );
                    return (
                      <article className="tw-card" key={assignment.id}>
                        <div className="tw-card-top">
                          <Tag tone={own ? "green" : "amber"}>
                            {own
                              ? "Đã nộp"
                              : assignment.status === "closed"
                                ? "Đã đóng"
                                : "Cần làm"}
                          </Tag>
                          <span className="tw-subtle">
                            Hạn {dateTime(assignment.dueAt)}
                          </span>
                        </div>
                        <h3>{assignment.title}</h3>
                        <p>
                          {
                            data.classes.find(
                              (c) => c.id === assignment.classId,
                            )?.name
                          }{" "}
                          · {assignment.questions.length} câu ·{" "}
                          {assignment.maxPoints} điểm
                        </p>
                        <p style={{ marginTop: 10 }}>
                          {assignment.instructions}
                        </p>
                        <div className="tw-card-footer">
                          <Button
                            secondary
                            disabled={!!own || assignment.status !== "issued"}
                            onClick={() => setSelected(assignment)}
                          >
                            {own
                              ? "Chờ kết quả giáo viên công bố"
                              : "Mở bài tập"}
                            <ArrowRight size={14} />
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                  {!data.assignments.length && (
                    <Panel>
                      <Empty
                        icon={ClipboardCheck}
                        title="Chưa có bài được giao"
                      >
                        Bài tập sẽ xuất hiện khi giáo viên giao cho tài khoản,
                        nhóm hoặc lớp của bạn.
                      </Empty>
                    </Panel>
                  )}
                </div>
              ) : tab === "materials" ? (
                <div className="tw-grid two">
                  {data.materials
                    .filter((m) => m.status === "published")
                    .map((m) => (
                      <Panel title={m.title} key={m.id}>
                        <div className="tw-pad tw-result">
                          <MathText text={m.content} />
                        </div>
                      </Panel>
                    ))}
                  {!data.materials.some((m) => m.status === "published") && (
                    <Panel>
                      <Empty
                        icon={BookOpen}
                        title="Chưa có học liệu được chia sẻ"
                      >
                        Chỉ học liệu giáo viên đã công bố cho lớp của bạn xuất
                        hiện ở đây.
                      </Empty>
                    </Panel>
                  )}
                </div>
              ) : tab === "lessons" ? (
                <div className="tw-grid">
                  {data.lessons
                    .filter((l) => l.status === "published")
                    .map((l) => (
                      <Panel title={l.title} key={l.id}>
                        <div className="tw-pad tw-form">
                          <Tag tone="indigo">
                            {l.topic} · Khối {l.grade}
                          </Tag>
                          <ul>
                            {l.objectives.map((o, i) => (
                              <li key={i}>{o}</li>
                            ))}
                          </ul>
                          {l.sections.map((s, i) => (
                            <section key={i}>
                              <h3>{s.title}</h3>
                              <div className="tw-result">
                                <MathText text={s.body} />
                              </div>
                            </section>
                          ))}
                        </div>
                      </Panel>
                    ))}
                  {!data.lessons.some((l) => l.status === "published") && (
                    <Panel>
                      <Empty
                        icon={BookOpen}
                        title="Chưa có bài giảng được chia sẻ"
                      >
                        Bạn sẽ thấy bài giảng sau khi giáo viên xem lại và công
                        bố.
                      </Empty>
                    </Panel>
                  )}
                </div>
              ) : tab === "announcements" ? (
                <div className="tw-grid">
                  {data.announcements
                    .filter((a) => a.status === "published")
                    .map((a) => (
                      <Panel title={a.title} key={a.id}>
                        <div className="tw-pad">
                          <div className="tw-result">{a.body}</div>
                          <p className="tw-subtle">{dateTime(a.createdAt)}</p>
                        </div>
                      </Panel>
                    ))}
                  {!data.announcements.length && (
                    <Panel>
                      <Empty icon={Users} title="Bảng tin đang yên">
                        Thông báo được giáo viên đăng sẽ xuất hiện tại đây.
                      </Empty>
                    </Panel>
                  )}
                </div>
              ) : tab === "calendar" ? (
                <div className="tw-grid two">
                  {data.events.map((e) => (
                    <article className="tw-card" key={e.id}>
                      <Tag tone="indigo">
                        {data.classes.find((c) => c.id === e.classId)?.name}
                      </Tag>
                      <h3>{e.title}</h3>
                      <p>
                        {dateTime(e.startAt)} → {dateTime(e.endAt)}
                      </p>
                      <p>{e.description}</p>
                    </article>
                  ))}
                  {!data.events.length && (
                    <Panel>
                      <Empty icon={CalendarDays} title="Chưa có lịch hẹn">
                        Lịch lớp sẽ xuất hiện khi giáo viên thêm mốc học hoặc
                        buổi gặp.
                      </Empty>
                    </Panel>
                  )}
                </div>
              ) : (
                <div className="tw-grid">
                  {data.submissions
                    .filter((s) => s.studentId === data.actor.userId)
                    .map((s) => (
                      <Panel
                        title={
                          data.assignments.find((a) => a.id === s.assignmentId)
                            ?.title || "Bài đã nộp"
                        }
                        key={s.id}
                      >
                        <div className="tw-pad tw-form">
                          <Tag
                            tone={s.status === "published" ? "green" : "amber"}
                          >
                            {s.status === "published"
                              ? "Kết quả đã công bố"
                              : "Giáo viên chưa công bố kết quả"}
                          </Tag>
                          <p className="tw-subtle">
                            Nộp lúc {dateTime(s.submittedAt)}
                            {s.late ? " · Nộp muộn" : ""}
                          </p>
                          {s.status === "published" ? (
                            <>
                              <h3>
                                {s.score} /{" "}
                                {
                                  data.assignments.find(
                                    (a) => a.id === s.assignmentId,
                                  )?.maxPoints
                                }{" "}
                                điểm
                              </h3>
                              <div className="tw-result">
                                <MathText
                                  text={s.feedback || "Chưa có nhận xét chung."}
                                />
                              </div>
                              {s.grades?.map((g) => (
                                <div className="tw-note" key={g.questionId}>
                                  <strong>
                                    <MathText
                                      inline
                                      text={
                                        data.assignments
                                          .find((a) => a.id === s.assignmentId)
                                          ?.questions.find(
                                            (q) => q.id === g.questionId,
                                          )?.prompt || ""
                                      }
                                    />
                                  </strong>
                                  <p>
                                    {g.points} điểm ·{" "}
                                    <MathText text={g.feedback} inline />
                                  </p>
                                </div>
                              ))}
                            </>
                          ) : (
                            <p className="tw-muted">
                              Bài đã được máy chủ nhận. Điểm và nhận xét không
                              hiển thị trước khi giáo viên quyết định công bố.
                            </p>
                          )}
                        </div>
                      </Panel>
                    ))}
                  {!data.submissions.length && (
                    <Panel>
                      <Empty
                        icon={CheckCircle2}
                        title="Kết quả sẽ đến từ những lần bạn thử"
                      >
                        Hoàn thành bài được giao để cùng giáo viên theo dõi cách
                        hiểu của mình.
                      </Empty>
                    </Panel>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        <footer className="tw-footer">
          <a href="/">Về không gian học</a>
          <span>Dữ liệu lớp theo quyền · Không tự gửi bài làm đến AI</span>
        </footer>
      </main>
      {join && (
        <Modal
          title="Tham gia một lớp học"
          onClose={() => {
            setJoin(false);
            setCode("");
            joinDraft.markClean();
          }}
          disabled={client.busy}
        >
          {joinForm}
        </Modal>
      )}
      {selected &&
        data?.role === "STUDENT" &&
        selected.orgId === data.organization?.id &&
        data.assignments.some(
          (a) => a.id === selected.id && a.revision === selected.revision,
        ) && (
          <StudentAssignment
            client={client}
            assignment={selected}
            onClose={() => setSelected(null)}
          />
        )}
    </div>
  );
}
function StudentAssignment({
  client,
  assignment,
  onClose,
}: {
  client: TeachingClient;
  assignment: TeachingAssignment;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<TeachingAnswer[]>(
      assignment.questions.map((q) => ({
        questionId: q.id,
        response: q.kind === "mcq" ? null : "",
      })),
    ),
    [confirmed, setConfirmed] = useState(false);
  return (
    <Modal title={assignment.title} onClose={onClose} disabled={client.busy}>
      <form
        className="tw-form"
        onSubmit={submit(async () => {
          await client.mutate({
            action: "submission.submit",
            assignmentId: assignment.id,
            expectedRevision: 0,
            answers,
          });
          onClose();
        })}
      >
        <FormError client={client} />
        <p className="tw-note">
          {assignment.instructions} · Hạn {dateTime(assignment.dueAt)}. Câu trả
          lời chỉ gửi khi bạn bấm nộp; không tự gửi đến AI.
        </p>
        {assignment.questions.map((question, index) => (
          <section className="tw-card tw-form" key={question.id}>
            <h3>
              {index + 1}. <MathText text={question.prompt} inline />
            </h3>
            <span className="tw-subtle">{question.maxPoints} điểm</span>
            {question.kind === "mcq" ? (
              <fieldset
                style={{ border: 0, padding: 0, display: "grid", gap: 8 }}
              >
                <legend className="tw-subtle">Chọn một đáp án</legend>
                {question.choices.map((choice, choiceIndex) => (
                  <label className="tw-check" key={choiceIndex}>
                    <input
                      type="radio"
                      name={question.id}
                      checked={answers[index].response === choiceIndex}
                      onChange={() =>
                        setAnswers(
                          answers.map((a, i) =>
                            i === index ? { ...a, response: choiceIndex } : a,
                          ),
                        )
                      }
                    />
                    <span>
                      {String.fromCharCode(65 + choiceIndex)}.{" "}
                      <MathText text={choice} inline />
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <Field label={`Trả lời câu ${index + 1}`}>
                <textarea
                  maxLength={5000}
                  value={String(answers[index].response || "")}
                  onChange={(e) =>
                    setAnswers(
                      answers.map((a, i) =>
                        i === index ? { ...a, response: e.target.value } : a,
                      ),
                    )
                  }
                />
              </Field>
            )}
          </section>
        ))}
        <label className="tw-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Tôi đã xem lại câu trả lời và muốn nộp bài này. Bản hiện tại chưa hỗ
          trợ thay thế bài đã nộp.
        </label>
        <div className="tw-form-footer">
          <ModalCancelButton disabled={client.busy} onClose={onClose}>
            Để sau
          </ModalCancelButton>
          <Button type="submit" busy={client.busy} disabled={!confirmed}>
            Nộp bài cho giáo viên <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
