import { PlatformError } from "../server/types";
export function teachingError(code: string, status = 400): never {
  throw new PlatformError(code, status);
}
export function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    teachingError("INVALID_TEACHING_DATA");
  return value as Record<string, unknown>;
}
export function only(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((k) => !allowed.includes(k)))
    teachingError("INVALID_TEACHING_DATA");
}
export function str(value: unknown, max = 200, min = 1) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    teachingError("INVALID_TEACHING_DATA");
  const s = value.normalize("NFC").trim();
  if (s.length < min) teachingError("INVALID_TEACHING_DATA");
  return s;
}
export function identifier(value: unknown) {
  const s = str(value, 100);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(s)) teachingError("INVALID_TEACHING_DATA");
  return s;
}
export function integer(value: unknown, min = 0, max = 1000000000) {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < min ||
    Number(value) > max
  )
    teachingError("INVALID_TEACHING_DATA");
  return Number(value);
}
export function number(value: unknown, min = 0, max = 10000) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    Math.abs(Math.round(value * 100) - value * 100) > 1e-7
  )
    teachingError("INVALID_TEACHING_DATA");
  return Math.round(value * 100) / 100;
}
export function bool(value: unknown) {
  if (typeof value !== "boolean") teachingError("INVALID_TEACHING_DATA");
  return value;
}
export function ids(value: unknown, max = 200) {
  if (!Array.isArray(value) || value.length > max)
    teachingError("INVALID_TEACHING_DATA");
  const result = value.map(identifier);
  if (new Set(result).size !== result.length)
    teachingError("INVALID_TEACHING_DATA");
  return result;
}
export function textList(value: unknown, max = 20, itemMax = 200) {
  if (!Array.isArray(value) || value.length > max)
    teachingError("INVALID_TEACHING_DATA");
  return value.map((v) => str(v, itemMax));
}
export function iso(value: unknown) {
  const s = str(value, 40);
  if (!Number.isFinite(Date.parse(s))) teachingError("INVALID_TEACHING_DATA");
  return new Date(s).toISOString();
}
const fields: Record<string, string> = {
  "preferences.update":
    "expectedRevision subjects grades displayName aiLanguage defaultDifficulty aiEnabled inAppNotifications",
  "org.create": "name",
  "class.create": "name subject grade description",
  "class.update": "id expectedRevision name subject grade description archived",
  "invite.create": "classId expectedRevision expiresInDays maxUses",
  "invite.revoke": "id expectedRevision",
  "class.join": "code",
  "enrollment.remove": "id expectedRevision",
  "enrollment.restore": "id expectedRevision",
  "member.remove": "userId expectedRevision",
  "member.role": "userId role expectedRevision",
  "teacher.assign": "classId userId expectedRevision",
  "teacher.remove": "classId userId expectedRevision",
  "group.save": "id classId expectedRevision name memberIds",
  "group.delete": "id expectedRevision",
  "material.create": "draft",
  "material.update": "id expectedRevision draft",
  "lesson.create": "draft",
  "lesson.update": "id expectedRevision draft",
  "question.create": "draft",
  "question.update": "id expectedRevision draft",
  "material.review": "id expectedRevision",
  "material.publish": "id expectedRevision",
  "material.delete": "id expectedRevision",
  "lesson.review": "id expectedRevision",
  "lesson.publish": "id expectedRevision",
  "lesson.delete": "id expectedRevision",
  "question.review": "id expectedRevision",
  "question.delete": "id expectedRevision",
  "assignment.create": "draft",
  "assignment.compose": "draft blueprint expectedClassRevision",
  "assignment.retake":
    "originalAssignmentId expectedRevision studentId availableFrom availableUntil reason sameQuestionsAcknowledged",
  "assignment.update": "id expectedRevision draft",
  "assignment.review": "id expectedRevision",
  "assignment.issue": "id expectedRevision",
  "assignment.close": "id expectedRevision",
  "assignment.delete": "id expectedRevision",
  "submission.submit": "assignmentId expectedRevision answers attachmentIds",
  "submission.grade": "id expectedRevision grades feedback confirmed reason",
  "submission.publish": "id expectedRevision",
  "announcement.save": "id expectedRevision classId title body",
  "announcement.publish": "id expectedRevision",
  "announcement.delete": "id expectedRevision",
  "event.save":
    "id expectedRevision classId title description startAt endAt kind",
  "event.delete": "id expectedRevision",
  "settings.update": "expectedRevision name timezone allowLateSubmissions",
};
export function mutation(
  value: unknown,
): Record<string, unknown> & { action: string; requestId: string } {
  const b = obj(value);
  const action = str(b.action, 50);
  if (!fields[action]) teachingError("INVALID_TEACHING_ACTION");
  only(b, ["action", "requestId", "orgId", ...fields[action].split(" ")]);
  const requestId = identifier(b.requestId);
  if (requestId.length < 8) teachingError("INVALID_TEACHING_DATA");
  return { ...b, action, requestId };
}
