"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  GraduationCap,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import type {
  TeacherApplication,
  TeacherAdminList,
} from "../../lib/teachers/contracts";

type Action = "approve" | "reject" | "revoke";
type Filters = {
  status: "pending" | "approved" | "rejected" | "revoked" | "all";
  q: string;
  sort: "newest" | "oldest";
  offset: number;
};
const statusLabels = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  revoked: "Đã thu hồi",
};
const levelLabels: Record<string, string> = {
  preschool: "Mầm non",
  primary: "Tiểu học",
  lower_secondary: "Trung học cơ sở",
  upper_secondary: "Trung học phổ thông",
  vocational: "Giáo dục nghề nghiệp",
  higher_education: "Đại học / cao đẳng",
  other: "Cấp học khác",
};
const actionLabels = {
  approve: "Duyệt hồ sơ",
  reject: "Từ chối hồ sơ",
  revoke: "Thu hồi quyền giáo viên",
};
const errors: Record<string, string> = {
  SIGN_IN_REQUIRED: "Hãy đăng nhập lại để xem hồ sơ.",
  SESSION_REVOKED:
    "Phiên hoặc tài khoản đã đổi. Hãy tải lại trang và đăng nhập lại.",
  ADMIN_REAUTH_REQUIRED: "Phiên quản trị đã hết hạn. Hãy đăng nhập lại.",
  FORBIDDEN: "Tài khoản này không được phép xét duyệt giáo viên.",
  INVALID_ORIGIN: "Yêu cầu cần được gửi từ địa chỉ Lumio đang cấu hình.",
  TEACHER_APPLICATION_NOT_FOUND:
    "Hồ sơ không còn tồn tại. Hãy làm mới danh sách.",
  TEACHER_APPLICATION_CONFLICT:
    "Hồ sơ đã được cập nhật. Hãy làm mới và xem lại trước khi quyết định.",
  TEACHER_REVIEW_CONFLICT:
    "Hồ sơ đã được cập nhật. Hãy làm mới và xem lại trước khi quyết định.",
  TEACHER_CONFLICT:
    "Hồ sơ đã được cập nhật. Hãy làm mới và xem lại trước khi quyết định.",
  TEACHER_INVALID_TRANSITION:
    "Trạng thái hồ sơ đã thay đổi. Hãy làm mới trước khi quyết định.",
  TEACHER_ALREADY_APPROVED: "Hồ sơ đã được duyệt. Hãy làm mới danh sách.",
  TEACHER_APPLICANT_UNAVAILABLE:
    "Tài khoản gửi hồ sơ hiện không khả dụng. Hãy làm mới danh sách.",
  TEACHER_REQUEST_REUSED:
    "Yêu cầu đã được dùng cho nội dung khác. Hãy làm mới hồ sơ.",
  INVALID_TEACHER_PROFILE: "Kiểm tra lại ghi chú từ 8 đến 300 ký tự.",
  INVALID_TEACHER_REQUEST: "Yêu cầu chưa hợp lệ. Hãy làm mới hồ sơ.",
  TEACHER_SELF_REVIEW_FORBIDDEN: "Bạn không thể tự xét duyệt hồ sơ của mình.",
  CANNOT_REVIEW_OWN_APPLICATION: "Bạn không thể tự xét duyệt hồ sơ của mình.",
  REASON_REQUIRED: "Ghi chú cần từ 8 đến 300 ký tự.",
  TEACHER_NOTE_REQUIRED: "Ghi chú cần từ 8 đến 300 ký tự.",
  IDEMPOTENCY_CONFLICT:
    "Yêu cầu đã thay đổi. Hãy làm mới hồ sơ trước khi thử lại.",
};
const fallback = "Chưa thể tải hoặc cập nhật hồ sơ. Vui lòng thử lại.";
function timestamp(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
function evidenceLink(value?: string) {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
async function teacherRequest<T>(
  accountKey: string,
  init?: RequestInit,
  query = "",
): Promise<T> {
  const response = await fetch("/api/admin/teachers" + query, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Lumio-Account": accountKey,
      ...init?.headers,
    },
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error(fallback);
  }
  if (!response.ok) throw Error(errors[result.error] || fallback);
  return result as T;
}

export function TeacherReviewPanel({
  accountKey,
  actorId,
  canReview,
  refreshKey = 0,
  onReviewed,
}: {
  accountKey: string;
  actorId: string;
  canReview: boolean;
  refreshKey?: number;
  onReviewed?: () => void;
}) {
  const [filters, setFilters] = useState<Filters>({
      status: "pending",
      q: "",
      sort: "oldest",
      offset: 0,
    }),
    [query, setQuery] = useState(""),
    [data, setData] = useState<TeacherAdminList | null>(null),
    [selected, setSelected] = useState<TeacherApplication | null>(null),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [action, setAction] = useState<Action | null>(null),
    [note, setNote] = useState(""),
    [reload, setReload] = useState(0);
  const generation = useRef(0),
    mutation = useRef(0),
    reviewController = useRef<AbortController | null>(null),
    pendingRequest = useRef<{
      fingerprint: string;
      requestId: string;
    } | null>(null),
    detailHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const current = ++generation.current,
      controller = new AbortController(),
      params = new URLSearchParams({
        status: filters.status,
        q: filters.q,
        sort: filters.sort,
        offset: String(filters.offset),
      });
    setLoading(true);
    setSaving(false);
    setError("");
    setData(null);
    setSelected(null);
    setAction(null);
    setNote("");
    pendingRequest.current = null;
    void teacherRequest<TeacherAdminList>(
      accountKey,
      { signal: controller.signal },
      "?" + params,
    )
      .then((result) => {
        if (generation.current === current) setData(result);
      })
      .catch((e: unknown) => {
        if (generation.current === current && !controller.signal.aborted)
          setError(e instanceof Error ? e.message : fallback);
      })
      .finally(() => {
        if (generation.current === current) setLoading(false);
      });
    return () => {
      controller.abort();
      reviewController.current?.abort();
      generation.current++;
      mutation.current++;
    };
  }, [accountKey, filters, refreshKey, reload]);
  function choose(application: TeacherApplication) {
    setSelected(application);
    setAction(null);
    setNote("");
    setError("");
    setNotice("");
    pendingRequest.current = null;
    requestAnimationFrame(() => detailHeading.current?.focus());
  }
  async function review() {
    if (
      !selected ||
      !action ||
      saving ||
      !canReview ||
      selected.userId === actorId ||
      note.trim().length < 8 ||
      note.trim().length > 300
    )
      return;
    const current = ++mutation.current,
      payload = {
        applicationId: selected.id,
        expectedRevision: selected.revision,
        action,
        note: note.trim(),
      },
      fingerprint = JSON.stringify(payload);
    if (pendingRequest.current?.fingerprint !== fingerprint)
      pendingRequest.current = { fingerprint, requestId: crypto.randomUUID() };
    setSaving(true);
    const controller = new AbortController();
    reviewController.current = controller;
    setError("");
    setNotice("");
    try {
      const result = await teacherRequest<{ application: TeacherApplication }>(
        accountKey,
        {
          method: "PATCH",
          signal: controller.signal,
          body: JSON.stringify({
            ...payload,
            requestId: pendingRequest.current.requestId,
          }),
        },
      );
      if (mutation.current !== current) return;
      pendingRequest.current = null;
      setSelected(result.application);
      setData((old) =>
        old
          ? {
              ...old,
              items:
                filters.status !== "all" &&
                result.application.status !== filters.status
                  ? old.items.filter(
                      (item) => item.id !== result.application.id,
                    )
                  : old.items.map((item) =>
                      item.id === result.application.id
                        ? result.application
                        : item,
                    ),
              total:
                filters.status !== "all" &&
                result.application.status !== filters.status &&
                old.items.some((item) => item.id === result.application.id)
                  ? Math.max(0, old.total - 1)
                  : old.total,
            }
          : old,
      );
      setAction(null);
      setNote("");
      setNotice(
        action === "approve"
          ? "Đã duyệt khai báo và cấp quyền giáo viên. Quyết định đã được ghi nhật ký."
          : action === "reject"
            ? "Đã từ chối hồ sơ và lưu ghi chú xét duyệt."
            : "Đã thu hồi quyền giáo viên và lưu nhật ký.",
      );
      onReviewed?.();
    } catch (e) {
      if (mutation.current === current)
        setError(e instanceof Error ? e.message : fallback);
    } finally {
      if (reviewController.current === controller)
        reviewController.current = null;
      if (mutation.current === current) setSaving(false);
    }
  }
  const selfReview = selected?.userId === actorId;
  return (
    <section
      className="ad-teachers"
      data-teacher-review
      aria-label="Xét duyệt giáo viên"
    >
      <div className="ad-teacher-intro">
        <span className="ad-teacher-emblem">
          <GraduationCap size={26} />
        </span>
        <div>
          <span className="ad-eyebrow">HỒ SƠ / ĐỐI CHIẾU THỦ CÔNG</span>
          <h2>Quyền giáo viên bắt đầu từ một hồ sơ được xem xét.</h2>
          <p>
            Thông tin do người dùng khai báo. Duyệt nội bộ Lumio không phải xác
            minh danh tính độc lập hoặc xác nhận từ nhà trường.
          </p>
        </div>
        <span className="ad-pill">
          <ShieldCheck size={14} /> Có nhật ký
        </span>
      </div>
      <section className="ad-panel">
        <form
          className="ad-teacher-filters"
          onSubmit={(event) => {
            event.preventDefault();
            if (!saving) setFilters({ ...filters, q: query.trim(), offset: 0 });
          }}
        >
          <label className="ad-teacher-search">
            <span>Tìm hồ sơ</span>
            <div>
              <Search size={16} />
              <input
                value={query}
                aria-label="Tìm hồ sơ"
                maxLength={100}
                placeholder="Tên, trường, tỉnh thành, xã phường…"
                disabled={saving}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button disabled={saving} type="submit">
                Tìm
              </button>
            </div>
          </label>
          <label>
            <span>Trạng thái</span>
            <select
              value={filters.status}
              disabled={saving}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  status: e.target.value as Filters["status"],
                  offset: 0,
                })
              }
            >
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
              <option value="revoked">Đã thu hồi</option>
              <option value="all">Tất cả trạng thái</option>
            </select>
          </label>
          <label>
            <span>
              <ArrowDownWideNarrow size={12} /> Thứ tự
            </span>
            <select
              value={filters.sort}
              disabled={saving}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  sort: e.target.value as Filters["sort"],
                  offset: 0,
                })
              }
            >
              <option value="oldest">Cũ nhất trước</option>
              <option value="newest">Mới nhất trước</option>
            </select>
          </label>
          <button
            className="ad-icon-button"
            type="button"
            aria-label="Làm mới hồ sơ giáo viên"
            disabled={saving || loading}
            onClick={() => setReload((v) => v + 1)}
          >
            <RefreshCw size={17} />
          </button>
        </form>
        {error && (
          <div className="ad-alert" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="ad-notice" role="status">
            <CheckCircle2 size={16} />
            {notice}
          </div>
        )}
        {loading ? (
          <div className="ad-teacher-empty" role="status">
            <RefreshCw size={28} />
            <h3>Đang tải hồ sơ</h3>
            <p>Đang lấy danh sách được phân quyền từ máy chủ.</p>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="ad-teacher-empty">
            <ClipboardCheck size={34} />
            <h3>
              {filters.q
                ? "Chưa tìm thấy hồ sơ phù hợp"
                : filters.status === "pending"
                  ? "Không có hồ sơ đang chờ"
                  : "Chưa có hồ sơ ở trạng thái này"}
            </h3>
            <p>
              {filters.q
                ? "Thử tên trường hoặc địa phương khác, hoặc đổi trạng thái lọc."
                : "Hồ sơ người dùng gửi sẽ xuất hiện tại đây. Không có dữ liệu minh họa trong danh sách thật."}
            </p>
          </div>
        ) : data ? (
          <>
            <div className="ad-table-scroll">
              <table className="ad-table ad-teacher-table">
                <caption>
                  {data.total} hồ sơ phù hợp · Trang hiện tại{" "}
                  {data.items.length} hồ sơ
                </caption>
                <thead>
                  <tr>
                    <th>Người gửi / Trường</th>
                    <th>Địa phương</th>
                    <th>Trạng thái</th>
                    <th>Ngày gửi</th>
                    <th>
                      <span className="ad-sr-only">Chi tiết hồ sơ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((application) => (
                    <tr
                      key={application.id}
                      className={
                        selected?.id === application.id
                          ? "ad-teacher-selected"
                          : undefined
                      }
                    >
                      <td>
                        <strong>{application.applicantName}</strong>
                        <span className="ad-cell-sub">
                          {application.profile.school}
                        </span>
                        <span className="ad-cell-sub">
                          {levelLabels[application.profile.teachingLevel] ||
                            "Cấp học khác"}
                        </span>
                      </td>
                      <td>
                        <span>{application.profile.provinceCity}</span>
                        <span className="ad-cell-sub">
                          {application.profile.ward} ·{" "}
                          {application.profile.country}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`ad-teacher-status ${application.status}`}
                        >
                          {statusLabels[application.status]}
                        </span>
                      </td>
                      <td>
                        <time dateTime={application.submittedAt}>
                          {timestamp(application.submittedAt)}
                        </time>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ad-teacher-open"
                          disabled={saving}
                          onClick={() => choose(application)}
                          aria-label={`Xem hồ sơ ${application.applicantName}`}
                        >
                          Xem hồ sơ <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ad-teacher-pagination">
              <span>
                {data.total
                  ? `${data.offset + 1}–${data.offset + data.items.length}`
                  : "0"}{" "}
                / {data.total} hồ sơ
              </span>
              <div>
                <button
                  type="button"
                  aria-label="Trang hồ sơ trước"
                  disabled={saving || data.offset === 0}
                  onClick={() =>
                    setFilters({
                      ...filters,
                      offset: Math.max(0, data.offset - data.limit),
                    })
                  }
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Trang hồ sơ tiếp"
                  disabled={saving || data.offset + data.limit >= data.total}
                  onClick={() =>
                    setFilters({ ...filters, offset: data.offset + data.limit })
                  }
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>
      {selected && (
        <section
          className="ad-panel ad-teacher-detail"
          aria-labelledby="teacher-review-title"
          data-teacher-detail
        >
          <header>
            <div>
              <span className="ad-eyebrow">
                CHI TIẾT KHAI BÁO · BẢN {selected.revision}
              </span>
              <h2 ref={detailHeading} tabIndex={-1} id="teacher-review-title">
                {selected.applicantName}
              </h2>
            </div>
            <button
              type="button"
              className="ad-icon-button"
              aria-label="Đóng chi tiết hồ sơ"
              disabled={saving}
              onClick={() => {
                setSelected(null);
                setAction(null);
              }}
            >
              <X size={17} />
            </button>
          </header>
          <div className="ad-teacher-detail-grid">
            <div>
              <dl>
                <div>
                  <dt>Quốc gia</dt>
                  <dd>{selected.profile.country}</dd>
                </div>
                <div>
                  <dt>Tỉnh / Thành phố</dt>
                  <dd>{selected.profile.provinceCity}</dd>
                </div>
                <div>
                  <dt>Xã / Phường</dt>
                  <dd>{selected.profile.ward}</dd>
                </div>
                <div>
                  <dt>Trường</dt>
                  <dd>{selected.profile.school}</dd>
                </div>
                <div>
                  <dt>Cấp giảng dạy</dt>
                  <dd>
                    {levelLabels[selected.profile.teachingLevel] ||
                      "Cấp học khác"}
                  </dd>
                </div>
                <div>
                  <dt>Trạng thái</dt>
                  <dd>
                    <span className={`ad-teacher-status ${selected.status}`}>
                      {statusLabels[selected.status]}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Ngày gửi</dt>
                  <dd>{timestamp(selected.submittedAt)}</dd>
                </div>
                <div>
                  <dt>Lần xét duyệt gần nhất</dt>
                  <dd>{timestamp(selected.reviewedAt)}</dd>
                </div>
              </dl>
              <dl className="ad-teacher-extra-fields">
                <div>
                  <dt>Môn giảng dạy</dt>
                  <dd>{selected.profile.subjects.join(", ")}</dd>
                </div>
                {selected.profile.workEmail && (
                  <div>
                    <dt>Email công việc khai báo</dt>
                    <dd>
                      {selected.profile.workEmail}
                      <small>Chưa được Lumio xác minh quyền sở hữu.</small>
                    </dd>
                  </div>
                )}
                {selected.profile.publicEvidenceUrl && (
                  <div>
                    <dt>Liên kết minh chứng tự cung cấp</dt>
                    <dd>
                      {evidenceLink(selected.profile.publicEvidenceUrl) ? (
                        <a
                          href={evidenceLink(
                            selected.profile.publicEvidenceUrl,
                          )!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Mở minh chứng <ExternalLink size={13} />
                        </a>
                      ) : (
                        "Liên kết không hợp lệ"
                      )}
                      <small>
                        Chỉ mở khi bạn lựa chọn; Lumio không tự tải hoặc xác
                        minh nội dung.
                      </small>
                    </dd>
                  </div>
                )}
              </dl>
              <div className="ad-teacher-declarations">
                <CheckCircle2 size={15} />
                <span>
                  Người gửi đã tự xác nhận đang giảng dạy và đồng ý lưu hồ sơ để
                  xét duyệt.
                </span>
              </div>
              {selected.reviewNote && (
                <div className="ad-teacher-previous-note">
                  <strong>Ghi chú xét duyệt gần nhất</strong>
                  <p>{selected.reviewNote}</p>
                </div>
              )}
            </div>
            <div className="ad-teacher-decision">
              <div className="ad-teacher-warning">
                <ShieldAlert size={19} />
                <p>
                  Đối chiếu thông tin trước khi cấp quyền. Quyền giáo viên không
                  cấp quyền admin hoặc tự cho phép đọc dữ liệu riêng của học
                  sinh.
                </p>
              </div>
              {!canReview ? (
                <p>Bạn có quyền xem; chưa có quyền quyết định hồ sơ.</p>
              ) : selfReview ? (
                <p role="status">Bạn không thể tự xét duyệt hồ sơ của mình.</p>
              ) : (
                <>
                  <div className="ad-teacher-actions">
                    {selected.status === "pending" && (
                      <>
                        <button
                          className="ad-primary"
                          type="button"
                          disabled={saving}
                          aria-pressed={action === "approve"}
                          onClick={() => setAction("approve")}
                        >
                          <ShieldCheck size={16} /> Duyệt hồ sơ
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          aria-pressed={action === "reject"}
                          onClick={() => setAction("reject")}
                        >
                          Từ chối
                        </button>
                      </>
                    )}
                    {selected.status === "approved" && (
                      <button
                        className="ad-teacher-destructive"
                        type="button"
                        disabled={saving}
                        aria-pressed={action === "revoke"}
                        onClick={() => setAction("revoke")}
                      >
                        Thu hồi quyền giáo viên
                      </button>
                    )}
                    {["rejected", "revoked"].includes(selected.status) && (
                      <p>
                        Hồ sơ đã kết thúc. Cần người dùng gửi hồ sơ mới trước
                        một lần xét duyệt khác.
                      </p>
                    )}
                  </div>
                  {action && (
                    <form
                      className="ad-teacher-confirm"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void review();
                      }}
                    >
                      <h3>{actionLabels[action]}</h3>
                      <p>
                        {action === "approve"
                          ? "Bạn đang cấp quyền dựa trên khai báo đã được xem xét thủ công. Lumio không ghi nhận đây là xác minh danh tính độc lập."
                          : action === "reject"
                            ? "Người dùng sẽ nhìn thấy ghi chú này để biết lý do hồ sơ chưa được chấp nhận."
                            : "Quyền giáo viên sẽ ngừng hiệu lực. Quyết định và lý do được lưu vào nhật ký."}
                      </p>
                      <label>
                        Ghi chú xét duyệt
                        <textarea
                          rows={4}
                          maxLength={300}
                          value={note}
                          disabled={saving}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Thông tin đã đối chiếu hoặc lý do quyết định…"
                        />
                      </label>
                      <small>
                        {note.trim().length}/300 · Tối thiểu 8 ký tự. Không ghi
                        thông tin học sinh hoặc bí mật.
                      </small>
                      <div>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setAction(null);
                            setNote("");
                          }}
                        >
                          Hủy
                        </button>
                        <button
                          type="submit"
                          className={
                            action === "approve"
                              ? "ad-primary"
                              : "ad-teacher-destructive"
                          }
                          disabled={
                            saving ||
                            note.trim().length < 8 ||
                            note.trim().length > 300
                          }
                        >
                          {saving
                            ? "Đang lưu quyết định…"
                            : "Xác nhận " +
                              (action === "approve"
                                ? "duyệt"
                                : action === "reject"
                                  ? "từ chối"
                                  : "thu hồi")}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}
      <p className="ad-teacher-footnote">
        <MapPin size={14} /> Hồ sơ thuộc tài khoản gửi; tên trường và địa phương
        chưa tự tạo quan hệ với một trường hoặc lớp học.
      </p>
    </section>
  );
}
