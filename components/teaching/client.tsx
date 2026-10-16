"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  TeachingMutation,
  TeachingMutationResult,
  TeachingGradeHistoryResponse,
  TeachingState,
} from "../../lib/teaching/contracts";
type WithoutRequest<T> = T extends unknown ? Omit<T, "requestId"> : never;
export type TeachingCommand = WithoutRequest<TeachingMutation>;
const messages: Record<string, string> = {
  DATABASE_WRITE_OUTCOME_UNKNOWN:
    "Chưa xác nhận kết quả lưu. Giữ bản nháp, tải lại để kiểm tra trước khi thử lại; lần thử cùng nội dung giữ nguyên mã yêu cầu.",
  DATABASE_TIMEOUT:
    "Database phản hồi quá hạn. Chưa xác nhận thay đổi; giữ bản nháp và tải lại để kiểm tra.",
  DATABASE_UNAVAILABLE:
    "Chưa kết nối được database. Giữ nội dung đang nhập và kiểm tra lại trạng thái trước khi gửi tiếp.",
  DATABASE_CONNECTION_POISONED:
    "Kết nối database cần được quản trị khởi động lại. Giữ bản nháp; chưa xác nhận thay đổi.",
  INVALID_ASSESSMENT_BLUEPRINT:
    "Ma trận cần 1–12 dòng, tổng từ 1–30 câu. Kiểm tra chủ đề, dạng và độ khó.",
  DUPLICATE_BLUEPRINT_CELL:
    "Hai dòng ma trận đang có cùng chủ đề, độ khó và dạng câu. Gộp số lượng vào một dòng.",
  TEACHING_BLUEPRINT_SHORTAGE:
    "Ngân hàng câu hỏi được phép sử dụng chưa đủ ma trận. Chưa tạo hoặc giao đề; bổ sung câu đã duyệt hoặc giảm số lượng.",
  TEACHING_INVALID_WINDOW:
    "Giờ mở, hạn nộp và giờ đóng chưa hợp lệ. Kiểm tra thứ tự thời gian; các mốc được gửi theo giờ UTC.",
  TEACHING_NOT_OPEN:
    "Chưa đến giờ mở nhận bài. Tải lại khi bài được mở; thời gian do máy chủ kiểm tra.",
  TEACHING_RETAKE_ROOT_REQUIRED: "Chọn bài gốc đã giao để cấp lần luyện lại.",
  TEACHING_RETAKE_ACK_REQUIRED:
    "Cần xác nhận luyện lại cùng câu hỏi, có thể có đáp án học sinh đã xem.",
  TEACHING_RETAKE_GRADE_REQUIRED:
    "Bài gốc của học sinh cần được giáo viên chấm trước khi cấp lần luyện lại.",
  TEACHING_RETAKE_PENDING:
    "Học sinh còn một lần luyện lại chưa được giải quyết. Hoàn tất hoặc đóng lần đó trước.",
  TEACHING_RETAKE_LIMIT:
    "Học sinh đã dùng tối đa 3 lần trong cùng bài gốc. Muốn đánh giá độc lập, hãy tạo đề mới được xem lại.",
  TEACHING_HISTORY_INCONSISTENT:
    "Lịch sử điểm cần được đối chiếu với bản chấm hiện tại. Tải lại hoặc liên hệ quản trị; không ghi đè lịch sử.",
  TEACHING_REGRADE_REASON_REQUIRED:
    "Nêu lý do điều chỉnh trước khi lưu một bản chấm mới.",
  TEACHING_HISTORY_LIMIT:
    "Bài nộp đã chạm giới hạn số phiên bản chấm. Lịch sử hiện có vẫn được giữ; liên hệ quản trị để được hỗ trợ.",
  TEACHING_STORAGE_LIMIT:
    "Không gian đã chạm giới hạn dung lượng của bản hiện tại. Giữ bản nháp và liên hệ quản trị trước khi thêm dữ liệu.",
  BILLING_REQUEST_FINALIZED:
    "Lượt tạo này đã kết thúc. Không gọi AI hoặc trừ credit thêm. Nếu phản hồi bị thất lạc, bản nháp không thể khôi phục; chỉ bắt đầu lượt mới khi bạn đồng ý dùng thêm credit.",
  BILLING_REQUEST_IN_PROGRESS:
    "Lượt tạo trước đang xử lý. Không có lần gọi hoặc khoản trừ credit mới; hãy chờ trước khi kiểm tra lại.",
  TEACHING_AI_DISABLED: "Bạn đã tắt trợ lý AI trong Cài đặt cá nhân.",
  TEACHER_APPROVAL_REQUIRED:
    "Cần quyền giáo viên đã được quản trị duyệt để thao tác này.",
  TEACHING_FORBIDDEN: "Bạn chưa có quyền thao tác với lớp hoặc nội dung này.",
  TEACHING_INVALID_DUE_DATE:
    "Hạn nộp chưa hợp lệ. Hãy chọn ngày giờ theo yêu cầu của bài tập.",
  TEACHING_CONFIRMATION_REQUIRED:
    "Hãy xác nhận đã kiểm tra điểm và nhận xét trước khi lưu.",
  TEACHING_CONTENT_BLOCKED:
    "Nội dung cần sửa lỗi hoặc xem lại độ phù hợp trước khi sử dụng.",
  TEACHING_REFERENCE_MISMATCH:
    "Trích đoạn không còn khớp học liệu. Hãy đối chiếu nguồn và sửa trước khi lưu.",
  TEACHING_SOURCE_CHANGED:
    "Nguồn đã thay đổi. Hãy tạo lại hoặc đối chiếu bản nháp với nguồn mới.",
  INVALID_TEACHING_DATA:
    "Kiểm tra dữ liệu bắt buộc, độ dài, tiêu chí và tổng điểm trước khi lưu.",
  INVALID_TEACHING_ACTION:
    "Thao tác chưa hợp lệ với trạng thái hiện tại. Hãy tải lại.",
  TEACHING_DUE_PASSED: "Đã quá hạn nộp và lớp chưa cho phép nộp muộn.",
  TEACHING_ASSIGNMENT_CLOSED: "Bài tập đã đóng nhận bài.",
  TEACHING_ASSIGNMENT_IMMUTABLE:
    "Đề đã giao được giữ cố định. Tạo bài mới nếu cần thay đổi.",
  TEACHING_SUBMISSION_LOCKED:
    "Bài đã nộp hoặc kết quả đã khóa. Tải lại để xem trạng thái.",
  TEACHING_CLASS_ARCHIVED: "Lớp đã lưu trữ; cần mở lại trước khi thay đổi.",
  TEACHING_CLASS_MOVE_FORBIDDEN:
    "Nội dung đang gắn với lớp không thể chuyển theo cách này.",
  TEACHING_INVALID_RECIPIENT: "Chọn nhóm hoặc học sinh đang tham gia đúng lớp.",
  TEACHING_ENROLLMENT_REVOKED:
    "Quyền tham gia lớp đã ngừng. Hãy liên hệ giáo viên.",
  TEACHING_STUDENT_REQUIRED: "Thao tác nộp bài cần vai trò học sinh trong lớp.",
  TEACHING_ROLE_CONFLICT:
    "Tài khoản đang có vai trò không phù hợp với thay đổi này.",
  TEACHING_PROTECTED_MEMBER:
    "Không thể thay đổi chủ sở hữu hoặc quyền của chính mình bằng thao tác này.",
  TEACHING_RATE_LIMIT:
    "Đã có nhiều thay đổi trong thời gian ngắn. Hãy chờ rồi thử lại.",
  TEACHING_INVITES_UNAVAILABLE:
    "Chức năng mã tham gia chưa sẵn sàng trên máy chủ.",
  TEACHING_INVITE_RECOVERY_UNAVAILABLE:
    "Yêu cầu trước đã tạo mã nhưng không còn khôi phục được nội dung mã. Tải lại, thu hồi mã cũ rồi tạo mã mới.",
  TEACHING_AI_SOURCE_LIMIT:
    "Chọn tối đa 3 nguồn, tổng văn bản tối đa 30.000 ký tự.",
  TEACHING_SOURCE_TEXT_REQUIRED:
    "Nguồn chưa có văn bản đã xử lý. Trích xuất hoặc dán nội dung trước khi tạo với AI.",
  TEACHING_ANONYMIZATION_REQUIRED:
    "Nội dung có dấu hiệu chứa thông tin nhận diện. Bỏ tên, liên hệ, mã học sinh và bí mật trước khi gửi.",
  TEACHING_AI_CONSENT_REQUIRED: "Cần đồng ý xử lý AI riêng cho lần tạo này.",
  INVALID_ANONYMOUS_EXCERPT: "Đoạn đã ẩn danh cần từ 5 đến 1.500 ký tự.",
  INVALID_TEACHING_GENERATION:
    "Kiểm tra chủ đề, trình độ, nguồn và mục tiêu trước khi tạo.",
  INVALID_TEACHING_AI_OUTPUT:
    "AI trả về nội dung chưa đạt cấu trúc cần dùng. Không có bản nào được tự lưu.",
  SIGN_IN_REQUIRED: "Hãy đăng nhập để tiếp tục.",
  SESSION_REVOKED:
    "Phiên hoặc tài khoản đã đổi. Đăng nhập lại để tải đúng dữ liệu.",
  FORBIDDEN: "Bạn chưa có quyền thao tác trong không gian này.",
  TEACHER_REQUIRED: "Cần hồ sơ giáo viên đã được duyệt để tạo không gian.",
  TEACHING_TEACHER_REQUIRED: "Cần hồ sơ giáo viên đã được duyệt để tiếp tục.",
  TEACHING_CONFLICT:
    "Nội dung đã thay đổi ở nơi khác. Tải lại và đối chiếu trước khi lưu.",
  TEACHING_NOT_FOUND: "Nội dung không còn tồn tại hoặc bạn chưa được chia sẻ.",
  TEACHING_INVALID_REQUEST: "Kiểm tra các trường bắt buộc và thử lại.",
  INVALID_TEACHING_REQUEST: "Kiểm tra các trường bắt buộc và thử lại.",
  TEACHING_INVALID_TRANSITION:
    "Hãy hoàn tất bước duyệt trước khi công bố nội dung.",
  TEACHING_INVITE_INVALID: "Mã mời không hợp lệ hoặc đã hết hạn.",
  TEACHING_INVITE_EXPIRED: "Mã mời đã hết hạn. Hãy xin giáo viên cấp mã mới.",
  TEACHING_ALREADY_SUBMITTED:
    "Bạn đã nộp bài này. Hãy tải lại để xem trạng thái.",
  TEACHING_LIMIT: "Không gian đã chạm giới hạn của bản hiện tại.",
  TEACHING_REQUEST_REUSED:
    "Mã yêu cầu đã dùng cho nội dung khác. Hãy tải lại trước khi thử lại.",
  INVALID_ORIGIN: "Yêu cầu cần được gửi từ địa chỉ Lumio đang cấu hình.",
  AI_NOT_CONFIGURED:
    "AI chưa sẵn sàng. Bạn vẫn có thể soạn và lưu nội dung thủ công.",
  INSUFFICIENT_CREDITS: "Chưa đủ credit cho yêu cầu này.",
  PLAN_REQUIRED: "Gói hiện tại chưa cho phép thao tác này.",
  LOCAL_RATE_LIMIT:
    "Đang có yêu cầu khác hoặc đã đến hạn mức. Hãy thử lại sau.",
  TEACHING_REVIEW_REQUIRED:
    "Nội dung cần được giáo viên xem lại trước khi sử dụng.",
  TEACHING_GRADE_CONFIRM_REQUIRED:
    "Hãy xác nhận đã kiểm tra từng điểm và nhận xét trước khi lưu.",
};
export function teachingError(code: unknown) {
  return typeof code === "string" && messages[code]
    ? messages[code]
    : "Chưa hoàn tất yêu cầu. Giữ nội dung đang nhập; kiểm tra quyền, dữ liệu hoặc thử kết nối lại.";
}
async function readResponse(response: Response) {
  try {
    return await response.json();
  } catch {
    throw Error(teachingError(null));
  }
}
export function useTeachingClient(accountKey: string) {
  const [data, setData] = useState<TeachingState | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [online, setOnline] = useState(true);
  const active = useRef(true),
    sequence = useRef(0),
    operating = useRef(false),
    controllers = useRef(new Set<AbortController>()),
    pending = useRef(new Map<string, string>()),
    org = useRef("");
  const fetchState = useCallback(
    async (orgId?: string) => {
      const controller = new AbortController(),
        current = ++sequence.current;
      controllers.current.add(controller);
      setLoading(true);
      setError("");
      try {
        let requestedOrg = orgId;
        // An unscoped GET is only a membership directory. Resolve one authorized
        // scope before publishing state; an HTML select's visual default is not a load.
        for (let round = 0; round < 2; round++) {
          const response = await fetch(
            "/api/teaching" +
              (requestedOrg
                ? "?orgId=" + encodeURIComponent(requestedOrg)
                : ""),
            {
              headers: { "X-Lumio-Account": accountKey },
              cache: "no-store",
              signal: controller.signal,
            },
          );
          const body = await readResponse(response);
          if (!response.ok) {
            if (
              [401, 403].includes(response.status) &&
              active.current &&
              current === sequence.current
            ) {
              setData(null);
              pending.current.clear();
            }
            throw Error(teachingError(body.error));
          }
          if (body.actor?.accountKey !== accountKey) {
            if (active.current && current === sequence.current) {
              setData(null);
              pending.current.clear();
            }
            throw Error(teachingError("SESSION_REVOKED"));
          }
          if (
            !active.current ||
            current !== sequence.current ||
            controller.signal.aborted
          )
            return null;
          if (
            !requestedOrg &&
            !body.organization &&
            body.organizations?.length
          ) {
            requestedOrg = body.organizations[0].id;
            continue;
          }
          if (requestedOrg && body.organization?.id !== requestedOrg)
            throw Error(teachingError("TEACHING_CONFLICT"));
          setData(body);
          org.current = body.organization?.id || "";
          return body as TeachingState;
        }
        return null;
      } catch (e) {
        if (
          active.current &&
          current === sequence.current &&
          !controller.signal.aborted
        )
          setError(e instanceof Error ? e.message : teachingError(null));
        return null;
      } finally {
        controllers.current.delete(controller);
        if (active.current && current === sequence.current) setLoading(false);
      }
    },
    [accountKey],
  );
  useEffect(() => {
    active.current = true;
    setData(null);
    org.current = "";
    pending.current.clear();
    void fetchState();
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      active.current = false;
      sequence.current++;
      for (const controller of controllers.current) controller.abort();
      controllers.current.clear();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [fetchState]);
  const mutate = async (
    command: TeachingCommand,
  ): Promise<TeachingMutationResult> => {
    if (operating.current) throw Error("Đang lưu một thay đổi khác.");
    if (!navigator.onLine) {
      setError(
        "Bạn đang ngoại tuyến. Nội dung trong biểu mẫu được giữ trên trang; kết nối lại rồi thử gửi.",
      );
      throw Error("OFFLINE");
    }
    const payload = {
        ...command,
        ...(!command.orgId &&
        org.current &&
        !["org.create", "class.join"].includes(command.action)
          ? { orgId: org.current }
          : {}),
      },
      fingerprint = JSON.stringify(payload);
    let requestId = pending.current.get(fingerprint);
    if (!requestId) {
      requestId = crypto.randomUUID();
      pending.current.set(fingerprint, requestId);
      if (pending.current.size > 30)
        pending.current.delete(pending.current.keys().next().value!);
    }
    const controller = new AbortController();
    controllers.current.add(controller);
    operating.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const current = sequence.current;
    try {
      const response = await fetch("/api/teaching", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Lumio-Account": accountKey,
        },
        body: JSON.stringify({ ...payload, requestId }),
        signal: controller.signal,
      });
      const body = await readResponse(response);
      if (!response.ok) {
        if (
          [401, 403].includes(response.status) &&
          active.current &&
          current === sequence.current
        ) {
          setData(null);
          pending.current.clear();
        }
        const shortages =
          body.error === "TEACHING_BLUEPRINT_SHORTAGE" &&
          Array.isArray(body.shortages)
            ? body.shortages
                .slice(0, 12)
                .filter(
                  (s: any) =>
                    s &&
                    [s.row, s.requested, s.available, s.missing].every(
                      (v: unknown) =>
                        typeof v === "number" &&
                        Number.isSafeInteger(v) &&
                        v >= 0 &&
                        v <= 30,
                    ),
                )
                .map(
                  (s: any) =>
                    `Dòng ${s.row}: cần ${s.requested}, chọn được ${s.available}, thiếu ${s.missing}.`,
                )
                .join(" ")
            : "";
        throw Error(
          [teachingError(body.error), shortages].filter(Boolean).join(" "),
        );
      }
      if (body.state?.actor?.accountKey !== accountKey) {
        if (active.current && current === sequence.current) {
          setData(null);
          pending.current.clear();
        }
        throw Error(teachingError("SESSION_REVOKED"));
      }
      if (!active.current || current !== sequence.current)
        throw Error("CONTEXT_CHANGED");
      pending.current.delete(fingerprint);
      setData(body.state);
      org.current = body.state.organization?.id || "";
      setNotice(
        body.replayed
          ? "Yêu cầu trước đã được lưu. Không tạo thêm bản trùng."
          : "Đã lưu thay đổi trên máy chủ.",
      );
      return body as TeachingMutationResult;
    } catch (e) {
      if (active.current && !controller.signal.aborted)
        setError(
          e instanceof Error && e.message !== "CONTEXT_CHANGED"
            ? e.message
            : teachingError(null),
        );
      throw e;
    } finally {
      controllers.current.delete(controller);
      operating.current = false;
      if (active.current) setBusy(false);
    }
  };
  const readGradeHistory = async (
    submissionId: string,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<TeachingGradeHistoryResponse> => {
    const orgId = org.current,
      current = sequence.current;
    if (!orgId || !active.current)
      throw new DOMException("CONTEXT_CHANGED", "AbortError");
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    controllers.current.add(controller);
    try {
      const query = new URLSearchParams({ orgId, submissionId, limit: "20" });
      if (cursor) query.set("cursor", cursor);
      const response = await fetch(
        "/api/teaching/grade-history?" + query.toString(),
        {
          headers: { "X-Lumio-Account": accountKey },
          cache: "no-store",
          signal: controller.signal,
        },
      );
      const body = await readResponse(response);
      if (
        !active.current ||
        current !== sequence.current ||
        controller.signal.aborted ||
        org.current !== orgId
      )
        throw new DOMException("CONTEXT_CHANGED", "AbortError");
      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          setData(null);
          pending.current.clear();
        }
        throw Error(teachingError(body.error));
      }
      if (
        body.submissionId !== submissionId ||
        !Array.isArray(body.events) ||
        body.events.length > 20 ||
        !(
          body.nextCursor === null ||
          (typeof body.nextCursor === "string" &&
            body.nextCursor.length <= 4000)
        ) ||
        body.events.some(
          (event: Record<string, unknown>) =>
            !event ||
            typeof event.id !== "string" ||
            !["grade", "publish", "legacy_snapshot"].includes(
              String(event.kind),
            ) ||
            !Number.isInteger(event.gradeVersion) ||
            !Number.isFinite(event.score) ||
            !Array.isArray(event.grades) ||
            typeof event.feedback !== "string",
        )
      )
        throw Error(
          "Lịch sử nhận được chưa hợp lệ. Hãy tải lại trước khi đối chiếu.",
        );
      return body as TeachingGradeHistoryResponse;
    } finally {
      signal?.removeEventListener("abort", cancel);
      controllers.current.delete(controller);
    }
  };
  return {
    data,
    loading,
    busy,
    error,
    notice,
    online,
    mutate,
    readGradeHistory,
    reload: () => fetchState(org.current),
    selectOrganization: (id: string) => {
      setData(null);
      setNotice("");
      return fetchState(id);
    },
    clearNotice: () => setNotice(""),
    clearError: () => setError(""),
  };
}
export type TeachingClient = ReturnType<typeof useTeachingClient>;
export function FormError({ client }: { client: TeachingClient }) {
  return client.error ? (
    <div className="tw-alert" role="alert">
      {client.error}
    </div>
  ) : null;
}
export function submit(action: () => Promise<unknown>) {
  return async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await action();
    } catch {}
  };
}
