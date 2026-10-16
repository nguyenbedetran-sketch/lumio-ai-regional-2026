import type { TeachingAssignment } from "../../lib/teaching/contracts";
import { dateTime, Tag } from "./ui";

/** datetime-local is device-local; requests always carry an explicit UTC instant. */
export function localAssessmentDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function assessmentDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw Error("Ngày giờ chưa hợp lệ.");
  return date.toISOString();
}
export const availabilityLabel: Record<
  NonNullable<TeachingAssignment["availability"]>,
  string
> = {
  not_open: "Chưa mở",
  closed: "Đã đóng",
  due_passed: "Đã quá hạn",
  graded: "Kết quả đã khóa",
  class_archived: "Lớp đã lưu trữ",
  available: "Có thể làm",
};
export function AssignmentAttempt({
  assignment,
}: {
  assignment: TeachingAssignment;
}) {
  return (
    <Tag tone={assignment.practiceRetake ? "indigo" : "neutral"}>
      {assignment.practiceRetake
        ? `Luyện lại cùng đề · Lần ${assignment.attemptNo}`
        : `Lần ${assignment.attemptNo || 1}`}
    </Tag>
  );
}
export function AssessmentWindow({
  assignment,
}: {
  assignment: TeachingAssignment;
}) {
  if (!assignment.availableFrom && !assignment.availableUntil) return null;
  return (
    <p className="tw-subtle" data-assessment-window>
      {assignment.availableFrom
        ? `Mở ${dateTime(assignment.availableFrom)}`
        : "Mở khi giao bài"}
      {assignment.availableUntil
        ? ` · Đóng cứng ${dateTime(assignment.availableUntil)}`
        : " · Chưa đặt giờ đóng cứng"}
      . Giờ đóng cứng không cho nộp muộn.
    </p>
  );
}
