import type { TeachingFile, TeachingFileTarget } from "./file-contracts";
import { teachingFileLimits } from "./file-contracts";
export type { TeachingFileTarget } from "./file-contracts";

export const TEACHING_FILE_LIMIT = teachingFileLimits.fileBytes;
export const TEACHING_FILE_ACCEPT =
  ".pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp,.txt,.md";
export type TeachingFileUpload = {
  requestId: string;
  orgId: string;
  target: TeachingFileTarget;
  visibility: "reference" | "teacher-only";
  filename: string;
  dataBase64: string;
};
export function validTeachingFile(file: Pick<File, "name" | "size">) {
  return (
    file.size > 0 &&
    file.size <= TEACHING_FILE_LIMIT &&
    /\.(pdf|docx|pptx|png|jpe?g|webp|txt|md)$/i.test(file.name)
  );
}
export function teachingFileError(code: unknown) {
  if (code === "TEACHING_FILE_REQUEST_FINALIZED")
    return "Yêu cầu tải tệp này đã kết thúc; tệp đã xóa hoặc hết hạn không được tự khôi phục. Bỏ tệp đang chọn, tải lại trạng thái rồi chọn tệp mới nếu cần.";
  if (code === "TEACHING_FILE_TOO_LARGE" || code === "PAYLOAD_TOO_LARGE")
    return "Tệp cần có dung lượng từ 1 byte đến 1 MiB.";
  if (code === "TEACHING_FILE_UNSUPPORTED" || code === "TEACHING_FILE_INVALID")
    return "Định dạng tệp chưa được hỗ trợ hoặc nội dung tệp chưa hợp lệ.";
  if (
    code === "TEACHING_FILE_COUNT" ||
    code === "TEACHING_FILE_QUOTA" ||
    code === "TEACHING_STORAGE_LIMIT"
  )
    return "Đã chạm giới hạn tệp hoặc dung lượng của tổ chức. Giữ bản gốc và liên hệ giáo viên.";
  if (code === "TEACHING_FILE_RATE_LIMIT")
    return "Đã đạt giới hạn lượt tải tệp trong ngày. Giữ bản gốc và thử lại sau.";
  if (
    [
      "TEACHING_FILE_UPLOAD_CLOSED",
      "TEACHING_FILE_TARGET_LOCKED",
      "TEACHING_FILE_IMMUTABLE",
    ].includes(String(code))
  )
    return "Trạng thái hiện tại không cho phép thay đổi tệp. Tải lại bài hoặc liên hệ giáo viên; tệp đã nộp không được thay thế.";
  if (code === "TEACHING_FILE_CLASS_REQUIRED")
    return "Gắn nội dung với lớp trước khi tải tệp lên.";
  if (
    code === "TEACHING_FILE_FORBIDDEN" ||
    code === "TEACHING_FORBIDDEN" ||
    code === "SESSION_REVOKED" ||
    code === "UNAUTHENTICATED"
  )
    return "Chưa có quyền với tệp trong tài khoản hoặc lớp hiện tại. Hãy tải lại trạng thái.";
  return "Chưa xác nhận thao tác tệp. Giữ bản gốc; thử lại cùng tệp để dùng lại mã yêu cầu và kiểm tra trạng thái trước khi nộp.";
}
export function encodeTeachingFile(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
export async function uploadTeachingFile(
  accountKey: string,
  payload: TeachingFileUpload,
  bytes: number,
  signal: AbortSignal,
): Promise<TeachingFile> {
  const { visibility: _visibility, ...studentPayload } = payload;
  const response = await fetch("/api/teaching/files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Lumio-Account": accountKey,
    },
    body: JSON.stringify(
      payload.target.kind === "submission" ? studentPayload : payload,
    ),
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(teachingFileError(body.error));
  const file = body.file as TeachingFile | undefined;
  if (
    !file ||
    typeof file.id !== "string" ||
    !file.id ||
    file.orgId !== payload.orgId ||
    file.targetKind !== payload.target.kind ||
    file.targetId !== payload.target.id ||
    file.name !== payload.filename.normalize("NFC").trim() ||
    file.bytes !== bytes ||
    !["pending", "attached"].includes(file.status) ||
    (payload.target.kind === "submission" &&
      (file.status !== "pending" || file.purpose !== "submission")) ||
    (payload.target.kind !== "submission" &&
      (file.status !== "attached" || file.purpose !== payload.visibility))
  )
    throw Error(teachingFileError(null));
  if (
    payload.target.kind !== "submission" &&
    (!Number.isSafeInteger(body.targetRevision) || body.targetRevision < 1)
  )
    throw Error(teachingFileError(null));
  return file;
}
export function teachingFilesForTarget(
  files: readonly TeachingFile[],
  target: TeachingFileTarget,
  submissionId?: string,
) {
  return files.filter(
    (file) =>
      file.targetKind === target.kind &&
      file.targetId === target.id &&
      (submissionId
        ? file.submissionId === submissionId && file.status === "attached"
        : target.kind !== "submission" || file.status === "pending"),
  );
}
