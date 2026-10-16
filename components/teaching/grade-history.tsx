"use client";
import { useEffect, useRef, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import type {
  TeachingGradeHistoryEvent,
  TeachingSubmission,
} from "../../lib/teaching/contracts";
import { MathText } from "../lumio/math-text";
import type { TeachingClient } from "./client";
import { Button, Modal, Tag, dateTime } from "./ui";

/** Read-only history. The server chooses the actor's permitted event projection. */
export function GradeHistoryButton({
  client,
  submission,
  student = false,
}: {
  client: TeachingClient;
  submission: TeachingSubmission;
  student?: boolean;
}) {
  const [open, setOpen] = useState(false),
    data = client.data;
  if (
    !data?.organization ||
    submission.orgId !== data.organization.id ||
    (student && submission.studentId !== data.actor.userId)
  )
    return null;
  return (
    <>
      <button
        type="button"
        className="tw-text-button"
        disabled={client.busy}
        onClick={() => setOpen(true)}
      >
        <History size={15} />
        {student ? "Lịch sử kết quả đã công bố" : "Lịch sử điểm"}
      </button>
      {open && (
        <Modal
          title={
            student
              ? "Lịch sử kết quả đã công bố"
              : `Lịch sử điểm · ${submission.studentName}`
          }
          onClose={() => setOpen(false)}
        >
          <GradeHistory
            client={client}
            submission={submission}
            student={student}
          />
        </Modal>
      )}
    </>
  );
}
function GradeHistory({
  client,
  submission,
  student,
}: {
  client: TeachingClient;
  submission: TeachingSubmission;
  student: boolean;
}) {
  const scope = `${client.data?.actor.accountKey}:${client.data?.organization?.id}:${submission.id}`,
    scopeRef = useRef(scope),
    latest = useRef(client),
    request = useRef(0),
    busy = useRef(false),
    controller = useRef<AbortController | null>(null),
    [events, setEvents] = useState<TeachingGradeHistoryEvent[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  scopeRef.current = scope;
  latest.current = client;
  async function load(next?: string) {
    if (busy.current || scopeRef.current !== scope) return;
    const id = ++request.current,
      current = new AbortController();
    controller.current = current;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await latest.current.readGradeHistory(
        submission.id,
        next,
        current.signal,
      );
      if (
        id !== request.current ||
        current.signal.aborted ||
        scopeRef.current !== scope
      )
        return;
      const allowed = student
        ? response.events.filter(
            (e) =>
              e.kind === "publish" ||
              (e.kind === "legacy_snapshot" && !!e.publishedAt),
          )
        : response.events;
      setEvents((old) =>
        next
          ? [
              ...new Map(
                [...old, ...allowed].map((event) => [event.id, event]),
              ).values(),
            ]
          : allowed,
      );
      setCursor(response.nextCursor);
    } catch (e) {
      if (
        id === request.current &&
        !current.signal.aborted &&
        scopeRef.current === scope
      )
        setError(
          e instanceof Error
            ? e.message
            : "Chưa tải được lịch sử. Hãy thử lại.",
        );
    } finally {
      if (id === request.current && scopeRef.current === scope) {
        busy.current = false;
        setLoading(false);
        controller.current = null;
      }
    }
  }
  useEffect(() => {
    setEvents([]);
    setCursor(null);
    setError("");
    busy.current = false;
    void load();
    return () => {
      request.current++;
      controller.current?.abort();
      controller.current = null;
      busy.current = false;
    };
  }, [scope, submission.revision]);
  const assignment = client.data?.assignments.find(
    (a) => a.id === submission.assignmentId,
  );
  return (
    <section className="tw-pad tw-form" data-grade-history aria-busy={loading}>
      <p className="tw-muted">
        <strong>{assignment?.title || "Bài đã nộp"}</strong> · Nộp lúc{" "}
        {dateTime(submission.submittedAt)}
      </p>
      <p className="tw-note">
        {student
          ? "Chỉ các phiên bản đã công bố cho bạn được hiển thị. Khi giáo viên đang điều chỉnh, bản điểm hiện tại vẫn chờ công bố; các lần đã công bố trước đó được giữ trong lịch sử."
          : "Mỗi lần lưu chấm và công bố là một bản ghi riêng. Điều chỉnh không sửa nội dung lịch sử; bản chấm mới chỉ đến học sinh sau khi bạn công bố lại."}
      </p>
      {error && (
        <div className="tw-alert" role="alert">
          {error}
          <Button
            secondary
            onClick={() => void load(cursor || undefined)}
            disabled={loading}
          >
            <RefreshCw size={14} />
            Thử tải lại lịch sử
          </Button>
        </div>
      )}
      {loading && (
        <p className="tw-muted" role="status">
          Đang tải lịch sử điểm…
        </p>
      )}
      {!loading && !error && !events.length && (
        <p className="tw-muted">
          {student
            ? "Chưa có phiên bản kết quả được công bố cho bạn."
            : "Chưa có bản ghi chấm hoặc công bố cho bài nộp này."}
        </p>
      )}
      <div className="tw-card-list">
        {events.map((event) => (
          <article
            className="tw-card tw-form"
            data-grade-history-event
            key={event.id}
          >
            <div className="tw-card-top">
              <Tag
                tone={
                  event.kind === "publish"
                    ? "green"
                    : event.legacy
                      ? "neutral"
                      : "indigo"
                }
              >
                {event.legacy
                  ? "Bản ghi kế thừa"
                  : event.kind === "publish"
                    ? "Đã công bố"
                    : "Lưu bản chấm"}
              </Tag>
              <strong>
                Phiên bản {event.gradeVersion} · {event.score} điểm
              </strong>
            </div>
            <p className="tw-subtle">
              {event.publishedAt
                ? `Công bố ${dateTime(event.publishedAt)}`
                : !student && event.recordedAt
                  ? `Ghi nhận ${dateTime(event.recordedAt)}`
                  : "Chưa xác định thời gian ghi nhận"}
              {!student && event.recordedBy
                ? ` · ${event.recordedBy.name}`
                : ""}
            </p>
            {event.legacy && (
              <p className="tw-note">
                Bản điểm có trước chức năng lịch sử. Không suy đoán người chấm,
                thời gian chấm hoặc các lần sửa trước đó.
              </p>
            )}
            {!student && event.reason && (
              <div className="tw-note">
                <strong>Lý do điều chỉnh</strong>
                <p>
                  <MathText text={event.reason} inline />
                </p>
              </div>
            )}
            <div className="tw-result">
              <MathText
                text={
                  event.feedback ||
                  "Không có nhận xét chung trong phiên bản này."
                }
              />
            </div>
            <details>
              <summary className="tw-text-button">
                Điểm từng câu & nhận xét
              </summary>
              <div className="tw-form">
                {event.grades.map((grade, index) => (
                  <div className="tw-note" key={grade.questionId}>
                    <strong>
                      Câu {index + 1} · {grade.points} điểm
                    </strong>
                    <p>
                      <MathText
                        inline
                        text={
                          assignment?.questions.find(
                            (q) => q.id === grade.questionId,
                          )?.prompt || "Câu hỏi trong đề đã giao"
                        }
                      />
                    </p>
                    <p>
                      <MathText
                        inline
                        text={grade.feedback || "Không có nhận xét riêng."}
                      />
                    </p>
                  </div>
                ))}
              </div>
            </details>
          </article>
        ))}
      </div>
      {cursor && (
        <Button secondary busy={loading} onClick={() => void load(cursor)}>
          Xem các bản cũ hơn
        </Button>
      )}
    </section>
  );
}
