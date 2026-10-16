"use client";
import { useState } from "react";
import type { TeachingSubmission } from "../../lib/teaching/contracts";
import { FormError, submit, type TeachingClient } from "./client";
import { assessmentDate, localAssessmentDate } from "./assessment-window";
import {
  Button,
  Field,
  FormFooter,
  Modal,
  dateTime,
  useTeachingConfirmation,
} from "./ui";

/** Practice permission is decided by the server; this form never creates a local allowance. */
export function PracticeRetakeButton({
  client,
  submission,
}: {
  client: TeachingClient;
  submission: TeachingSubmission;
}) {
  const [open, setOpen] = useState(false),
    assignment = client.data?.assignments.find(
      (a) => a.id === submission.assignmentId,
    ),
    root = client.data?.assignments.find(
      (a) => a.id === (assignment?.rootAssignmentId || assignment?.id),
    );
  if (
    !client.data?.permissions.teach ||
    !root ||
    !["issued", "closed"].includes(root.status) ||
    !client.data.classes.some((c) => c.id === root.classId && !c.archived) ||
    !client.data.enrollments.some(
      (e) =>
        e.classId === root.classId &&
        e.userId === submission.studentId &&
        e.active,
    ) ||
    !client.data.submissions.some(
      (s) =>
        s.assignmentId === root.id &&
        s.studentId === submission.studentId &&
        ["graded", "published"].includes(s.status),
    )
  )
    return null;
  return (
    <>
      <button
        className="tw-text-button"
        disabled={client.busy}
        onClick={() => setOpen(true)}
      >
        Cho luyện lại
      </button>
      {open && (
        <RetakeEditor
          key={root.id + ":" + submission.studentId}
          client={client}
          rootId={root.id}
          studentId={submission.studentId}
          studentName={submission.studentName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
function RetakeEditor({
  client,
  rootId,
  studentId,
  studentName,
  onClose,
}: {
  client: TeachingClient;
  rootId: string;
  studentId: string;
  studentName: string;
  onClose: () => void;
}) {
  const root = client.data?.assignments.find((a) => a.id === rootId),
    [from, setFrom] = useState(localAssessmentDate(client.data?.serverTime)),
    [until, setUntil] = useState(""),
    [reason, setReason] = useState(""),
    [acknowledged, setAcknowledged] = useState(false),
    [reviewed, setReviewed] = useState(false),
    confirmation = useTeachingConfirmation();
  if (!root || root.orgId !== client.data?.organization?.id) return null;
  return (
    <Modal
      title="Cho luyện lại cùng đề"
      onClose={onClose}
      disabled={client.busy}
    >
      <form
        className="tw-form"
        onSubmit={submit(async () => {
          const start = assessmentDate(from),
            end = assessmentDate(until);
          if (!start || !end || !acknowledged || !reviewed || !reason.trim())
            return;
          const command = {
            action: "assignment.retake" as const,
            originalAssignmentId: root.id,
            expectedRevision: root.revision,
            studentId,
            availableFrom: start,
            availableUntil: end,
            reason: reason.trim(),
            sameQuestionsAcknowledged: true as const,
          };
          confirmation.ask({
            title: "Xác nhận lần luyện lại",
            label: "Tạo lần luyện lại",
            description: `${studentName} sẽ nhận riêng một lần luyện lại của “${root.title}”, giữ nguyên đề đã giao. Mở: ${dateTime(start)}; đóng: ${dateTime(end)} (giờ trên thiết bị). Lý do: ${reason.trim()}. Đây là luyện tập cùng câu hỏi, không phải đề thi mới bảo mật. Bài và kết quả cũ được giữ. Máy chủ kiểm tra giới hạn tối đa 3 lần, tình trạng bài trước và thời gian trước khi cấp.`,
            action: async () => {
              await client.mutate(command);
              onClose();
            },
          });
        })}
      >
        <FormError client={client} />
        <p className="tw-note">
          {studentName} · {root.title}. Câu hỏi đã chốt được giữ nguyên, kể cả
          khi ngân hàng câu hỏi thay đổi. Đáp án học sinh đã xem không thể trở
          thành bí mật trở lại.
        </p>
        <div className="tw-form-row">
          <Field label="Mở lần luyện lại (giờ trên thiết bị)">
            <input
              required
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Đóng lần luyện lại (giờ trên thiết bị)">
            <input
              required
              type="datetime-local"
              value={until}
              min={from || undefined}
              onChange={(e) => setUntil(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Lý do cho luyện lại">
          <textarea
            required
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <p className="tw-subtle">
          Hạn nộp bằng giờ đóng; hết cửa sổ sẽ không được nộp muộn. Chỉ máy chủ
          có quyền cấp lần tiếp theo; không tự mở thêm lần sau lỗi kết nối.
        </p>
        <label className="tw-check">
          <input
            type="checkbox"
            required
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          Tôi hiểu đây là luyện tập cùng đề, có thể gồm đáp án học sinh đã xem.
        </label>
        <label className="tw-check">
          <input
            type="checkbox"
            required
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          Tôi đã xem lại học sinh, thời gian và lý do.
        </label>
        <FormFooter
          busy={client.busy}
          onClose={onClose}
          label="Xem lại lần luyện lại"
        />
      </form>
      {confirmation.dialog}
    </Modal>
  );
}
