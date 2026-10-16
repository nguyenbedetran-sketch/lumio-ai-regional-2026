"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import {
  Activity,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Fingerprint,
  Gauge,
  GraduationCap,
  Layers3,
  LockKeyhole,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Users,
  X,
} from "lucide-react";
import type { AdminSnapshot } from "../../lib/server/admin-snapshot";
import type { AuditEvent, AIUsageEvent, User } from "../../lib/server/types";
import { TeacherReviewPanel } from "./teacher-review";
import { UsageBreakdownPanel } from "./usage-breakdown";

type Tab = "overview" | "users" | "teachers" | "usage" | "flags" | "audit";
const formatNumber = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat("vi-VN").format(n);
const date = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const errorMessages: Record<string, string> = {
  SIGN_IN_REQUIRED: "Hãy đăng nhập để tiếp tục.",
  SESSION_REVOKED: "Phiên đã hết hiệu lực. Hãy đăng nhập lại.",
  ADMIN_REAUTH_REQUIRED:
    "Phiên quản trị đã hết hạn sau một giờ. Hãy đăng nhập lại.",
  FORBIDDEN: "Tài khoản này chưa được cấp quyền quản trị.",
  LAST_ADMIN_PROTECTED: "Không thể khóa quản trị viên cuối cùng.",
  CANNOT_CHANGE_OWN_ACCESS:
    "Bạn không thể thay đổi quyền truy cập của chính mình.",
  PRIVILEGED_ACCOUNT_PROTECTED: "Tài khoản quản trị này được bảo vệ.",
  REASON_REQUIRED: "Hãy nhập lý do từ 8 đến 300 ký tự.",
  INVALID_ORIGIN: "Yêu cầu không đến từ địa chỉ ứng dụng đã cấu hình.",
  PERSISTENT_DATABASE_REQUIRED: "Máy chủ cần cấu hình cơ sở dữ liệu bền vững.",
};
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const result = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const payload = await result.json();
  if (!result.ok)
    throw new Error(
      errorMessages[payload.error] ||
        "Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.",
    );
  return payload as T;
}
export function AdminGate({ code }: { code: string }) {
  return (
    <section className="ad-gate">
      <div className="ad-gate-glow" />
      <div className="ad-gate-card">
        <div className="ad-icon big">
          <ShieldCheck size={32} />
        </div>
        <span className="ad-eyebrow">LUMIO / ADMIN CONSOLE</span>
        <h1>Không gian quản trị.</h1>
        <p>
          {errorMessages[code] ||
            "Nền tảng quản trị chưa sẵn sàng. Vui lòng kiểm tra cấu hình máy chủ."}
        </p>
        {[
          "SIGN_IN_REQUIRED",
          "SESSION_REVOKED",
          "ADMIN_REAUTH_REQUIRED",
          "FORBIDDEN",
        ].includes(code) && (
          <button
            className="ad-primary"
            onClick={() =>
              signIn(
                "google",
                { callbackUrl: "/admin" },
                { prompt: "select_account" },
              )
            }
          >
            <Fingerprint size={17} /> Đăng nhập bằng Google
          </button>
        )}
        <a className="ad-back" href="/">
          <ArrowLeft size={16} /> Về không gian học
        </a>
        <small>
          Quyền quản trị do máy chủ xác nhận. Không có chế độ truy cập thử.
        </small>
      </div>
    </section>
  );
}

export function AdminConsole({ initial }: { initial: AdminSnapshot }) {
  const [data, setData] = useState(initial),
    [tab, setTab] = useState<Tab>("overview"),
    [busy, setBusy] = useState(false),
    [teacherRefresh, setTeacherRefresh] = useState(0);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState("");
  const [users, setUsers] = useState(initial.users),
    [audit, setAudit] = useState(initial.audit),
    [usage, setUsage] = useState(initial.usage);
  const [auditOffset, setAuditOffset] = useState(0),
    [usageOffset, setUsageOffset] = useState(0);
  const [confirm, setConfirm] = useState<{
      user: User;
      action: "enable" | "disable" | "revoke";
    } | null>(null),
    [reason, setReason] = useState("");
  useEffect(() => {
    if (!confirm) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".ad-dialog button:not(:disabled),.ad-dialog textarea:not(:disabled)",
        ),
      );
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keepFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keepFocus);
      document
        .querySelector<HTMLElement>(".ad-sidebar nav [aria-current=page]")
        ?.focus();
    };
  }, [confirm]);
  const permitted = (permission: AdminSnapshot["permissions"][number]) =>
    data.permissions.includes(permission);
  const nav: { key: Tab; label: string; icon: typeof Gauge; show: boolean }[] =
    [
      { key: "overview", label: "Tổng quan", icon: Gauge, show: true },
      {
        key: "users",
        label: "Người dùng",
        icon: Users,
        show: permitted("users.read"),
      },
      {
        key: "teachers",
        label: "Xét duyệt giáo viên",
        icon: GraduationCap,
        show: permitted("teachers.read"),
      },
      {
        key: "usage",
        label: "Hoạt động AI",
        icon: Sparkles,
        show: permitted("ai.usage.read"),
      },
      {
        key: "flags",
        label: "Điều khiển",
        icon: Settings2,
        show: permitted("features.read"),
      },
      {
        key: "audit",
        label: "Nhật ký kiểm toán",
        icon: Fingerprint,
        show: permitted("audit_logs.read"),
      },
    ];
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const next = await request<AdminSnapshot>("/api/admin");
    setData(next);
    setUsers(next.users);
    setAudit(next.audit);
    setUsage(next.usage);
    setAuditOffset(0);
    setUsageOffset(0);
    setQuery("");
    setTeacherRefresh((value) => value + 1);
  }
  async function changeAccess() {
    if (!confirm) return;
    await request("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({
        userId: confirm.user.id,
        action: confirm.action,
        reason,
      }),
    });
    setConfirm(null);
    setReason("");
    await refresh();
    setNotice("Đã cập nhật quyền truy cập và lưu nhật ký.");
  }
  async function refreshTeacherAudit() {
    try {
      const next = await request<AdminSnapshot>("/api/admin");
      setData(next);
      setUsers(next.users);
      setAudit(next.audit);
      setUsage(next.usage);
      setAuditOffset(0);
      setUsageOffset(0);
    } catch {
      setError(
        "Quyết định đã lưu; chưa tải lại được nhật ký. Hãy làm mới dữ liệu.",
      );
    }
  }
  const { dashboard } = data,
    { users: counts, usage: metrics } = dashboard;
  const errorRate = metrics.requests
    ? `${Math.round((metrics.errors / metrics.requests) * 100)}%`
    : "—";
  const titles: Record<Tab, [string, string]> = {
    overview: [
      "Mọi thứ, trong tầm nhìn.",
      "Quan sát nền tảng từ những hoạt động thực tế.",
    ],
    users: [
      "Con người phía sau mỗi lần học.",
      "Quản lý danh tính và quyền truy cập tài khoản.",
    ],
    teachers: [
      "Đồng hành cùng người dạy.",
      "Đối chiếu hồ sơ, ghi nhận quyết định và quản lý quyền giáo viên.",
    ],
    usage: [
      "Hiểu từng lượt sử dụng.",
      "Lượt gọi, độ trễ và dữ liệu sử dụng được ghi từ máy chủ.",
    ],
    flags: [
      "Điều khiển có chủ đích.",
      "Bật tắt chức năng tại máy chủ. Mọi thay đổi đều được ghi lại.",
    ],
    audit: [
      "Mỗi thay đổi đều có dấu vết.",
      "Nhật ký chỉ bổ sung, không thể sửa hoặc xóa qua ứng dụng.",
    ],
  };
  return (
    <div className="ad-shell">
      <aside className="ad-sidebar">
        <a href="/" className="ad-brand">
          <div className="ad-brand-mark">
            <Layers3 size={24} />
          </div>
          <div>
            Lumio <span>CONSOLE</span>
          </div>
        </a>
        <div className="ad-workspace">
          <span className="ad-environment-dot" />
          <div>
            Quản trị Lumio<small>Phiên được bảo vệ</small>
          </div>
          <LockKeyhole size={15} />
        </div>
        <span className="ad-nav-label">QUẢN TRỊ NỀN TẢNG</span>
        <nav aria-label="Quản trị">
          {nav
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.key}
                aria-current={tab === item.key ? "page" : undefined}
                onClick={() => {
                  setTab(item.key);
                  setError("");
                  setNotice("");
                }}
              >
                <item.icon size={18} />
                {item.label}
                {item.key === "users" && <span>{counts.total}</span>}
              </button>
            ))}
        </nav>
        <div className="ad-sidebar-bottom">
          <div className="ad-boundary">
            <ShieldCheck size={19} />
            <strong>
              Quyền được kiểm tra
              <br />ở mỗi yêu cầu.
            </strong>
            <p>Phiên quản trị giới hạn 1 giờ.</p>
          </div>
          <a href="/">
            <ArrowDownLeft size={17} /> Về không gian học
          </a>
          <div className="ad-identity">
            <span>{data.actor.name.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{data.actor.name}</strong>
              <small>{data.actor.role.replaceAll("_", " ")}</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="ad-main">
        <header className="ad-topbar">
          <span>
            Workspace <ChevronRight size={13} />{" "}
            <b>{nav.find((item) => item.key === tab)?.label}</b>
          </span>
          <div>
            <span className="ad-live">
              <i /> Dữ liệu đã lưu
            </span>
            <button
              className="ad-icon-button"
              disabled={busy}
              aria-label="Làm mới dữ liệu"
              onClick={() => perform(refresh)}
            >
              <RefreshCw size={17} className={busy ? "ad-spin" : ""} />
            </button>
          </div>
        </header>
        <div className="ad-content">
          <div className="ad-page-heading">
            <div>
              <span className="ad-eyebrow">LUMIO OPERATIONS</span>
              <h1>{titles[tab][0]}</h1>
              <p>{titles[tab][1]}</p>
            </div>
            <span className="ad-updated">
              <Clock3 size={14} /> {date(dashboard.generatedAt)}
            </span>
          </div>
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
          {tab === "overview" && (
            <>
              <div className="ad-stats">
                <Metric
                  label="Tổng người dùng"
                  value={formatNumber(counts.total)}
                  detail={`${counts.new} tài khoản mới / 7 ngày`}
                  icon={Users}
                />
                <Metric
                  label="Yêu cầu AI"
                  value={formatNumber(metrics.requests)}
                  detail={`${metrics.errors} yêu cầu có lỗi`}
                  icon={Sparkles}
                />
                <Metric
                  label="Độ trễ trung bình"
                  value={
                    metrics.averageLatencyMs === null
                      ? "—"
                      : `${formatNumber(metrics.averageLatencyMs)} ms`
                  }
                  detail="Dựa trên yêu cầu đã ghi"
                  icon={Activity}
                />
                <Metric
                  label="Token đã ghi nhận"
                  value={
                    metrics.inputTokens === null &&
                    metrics.outputTokens === null
                      ? "—"
                      : formatNumber(
                          (metrics.inputTokens || 0) +
                            (metrics.outputTokens || 0),
                        )
                  }
                  detail={`${metrics.tokenRecords} lượt có metadata token`}
                  icon={Layers3}
                />
              </div>
              <div className="ad-overview-grid">
                <section className="ad-panel ad-chart-panel">
                  <div className="ad-panel-heading">
                    <div>
                      <h2>Nhịp hoạt động AI</h2>
                      <p>Số yêu cầu trong 14 ngày gần nhất</p>
                    </div>
                    <span className="ad-pill">14 ngày · UTC</span>
                  </div>
                  <ActivityChart days={dashboard.days} />
                  <div className="ad-chart-foot">
                    <span>
                      <i /> Yêu cầu đã lưu
                    </span>
                    <span>
                      Tỷ lệ lỗi <b>{errorRate}</b>
                    </span>
                  </div>
                </section>
                <section className="ad-panel ad-health">
                  <div className="ad-panel-heading">
                    <div>
                      <h2>Tình trạng hệ thống</h2>
                      <p>Các thành phần đang sử dụng</p>
                    </div>
                    <Database size={19} />
                  </div>
                  <StatusLine
                    name="Cơ sở dữ liệu"
                    value="SQLite đang hoạt động"
                  />
                  <StatusLine
                    name="Nhật ký kiểm toán"
                    value={`${formatNumber(dashboard.auditCount)} sự kiện`}
                  />
                  <StatusLine
                    name="Phạm vi lưu trữ"
                    value="Một máy chủ"
                    neutral
                  />
                  <StatusLine
                    name="Đồng bộ học liệu"
                    value="Lưu trên trình duyệt"
                    neutral
                  />
                  <div className="ad-storage-note">
                    <LockKeyhole size={16} />
                    <p>
                      Bản local. Cần chuyển sang cơ sở dữ liệu dùng chung trước
                      khi chạy nhiều máy chủ.
                    </p>
                  </div>
                </section>
              </div>
              <div className="ad-bottom-grid">
                <section className="ad-panel">
                  <div className="ad-panel-heading">
                    <div>
                      <h2>Quyền truy cập</h2>
                      <p>Trạng thái tài khoản trên nền tảng</p>
                    </div>
                    <ShieldCheck size={18} />
                  </div>
                  <div className="ad-account-summary">
                    <div>
                      <strong>{counts.active}</strong>
                      <span>
                        <i /> Đang hoạt động
                      </span>
                    </div>
                    <div>
                      <strong>{counts.disabled}</strong>
                      <span>
                        <i className="amber" /> Đã tạm khóa
                      </span>
                    </div>
                  </div>
                  {permitted("users.read") && (
                    <button
                      className="ad-text-button"
                      onClick={() => setTab("users")}
                    >
                      Quản lý người dùng <ArrowRight size={15} />
                    </button>
                  )}
                </section>
                <section className="ad-panel ad-cost">
                  <div className="ad-panel-heading">
                    <div>
                      <h2>Chi phí đã ghi nhận</h2>
                      <p>Chỉ tính khi có dữ liệu chi phí xác thực</p>
                    </div>
                    <TerminalSquare size={18} />
                  </div>
                  <strong>
                    {metrics.costUsd === null
                      ? "Chưa có dữ liệu"
                      : new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 5,
                        }).format(metrics.costUsd)}
                  </strong>
                  <p>
                    {metrics.costRecords} / {metrics.requests} lượt có dữ liệu
                    chi phí. Dấu “—” nghĩa là chưa đo được.
                  </p>
                </section>
              </div>
            </>
          )}
          {tab === "users" && users && (
            <section className="ad-panel">
              <div className="ad-panel-heading">
                <div>
                  <h2>
                    Tài khoản <span className="ad-count">{users.total}</span>
                  </h2>
                  <p>Không truy cập nội dung hội thoại riêng tư.</p>
                </div>
                <form
                  className="ad-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    perform(async () =>
                      setUsers(
                        await request(
                          `/api/admin/users?q=${encodeURIComponent(query)}`,
                        ),
                      ),
                    );
                  }}
                >
                  <Search size={16} />
                  <input
                    aria-label="Tìm tài khoản"
                    placeholder="Tên hoặc email…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button disabled={busy} type="submit">
                    Tìm
                  </button>
                </form>
              </div>
              <div className="ad-table-scroll">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Người dùng</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>Truy cập gần nhất</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="ad-person">
                            <span>{user.name.charAt(0).toUpperCase()}</span>
                            <div>
                              <strong>{user.name}</strong>
                              <small>{user.email || "Không có email"}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="ad-role">{user.role}</span>
                        </td>
                        <td>
                          <span
                            className={`ad-status ${user.disabled ? "disabled" : ""}`}
                          >
                            <i />
                            {user.disabled ? "Tạm khóa" : "Hoạt động"}
                          </span>
                        </td>
                        <td>{date(user.lastSeenAt)}</td>
                        <td>
                          <div className="ad-actions">
                            {permitted("users.suspend") && (
                              <button
                                disabled={
                                  busy ||
                                  user.id === data.actor.id ||
                                  (user.role !== "USER" &&
                                    data.actor.role !== "SUPER_ADMIN")
                                }
                                onClick={() => {
                                  setReason("");
                                  setConfirm({
                                    user,
                                    action: user.disabled
                                      ? "enable"
                                      : "disable",
                                  });
                                }}
                              >
                                {user.disabled ? "Mở khóa" : "Tạm khóa"}
                              </button>
                            )}
                            {permitted("users.sessions.revoke") && (
                              <button
                                disabled={
                                  busy ||
                                  user.id === data.actor.id ||
                                  (user.role !== "USER" &&
                                    data.actor.role !== "SUPER_ADMIN")
                                }
                                onClick={() => {
                                  setReason("");
                                  setConfirm({ user, action: "revoke" });
                                }}
                              >
                                Thu hồi phiên
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.users.length === 0 && (
                <Empty icon={Users} text="Không tìm thấy tài khoản phù hợp." />
              )}
              <Pagination
                offset={users.offset}
                length={users.users.length}
                pageSize={30}
                busy={busy}
                hasNext={users.offset + users.limit < users.total}
                onPage={(offset) =>
                  perform(async () =>
                    setUsers(
                      await request(
                        `/api/admin/users?q=${encodeURIComponent(query)}&offset=${offset}`,
                      ),
                    ),
                  )
                }
              />
            </section>
          )}
          {tab === "teachers" && permitted("teachers.read") && (
            <TeacherReviewPanel
              key={data.actor.id + ":" + data.actor.accountKey}
              actorId={data.actor.id}
              accountKey={data.actor.accountKey}
              canReview={permitted("teachers.review")}
              refreshKey={teacherRefresh}
              onReviewed={() => void refreshTeacherAudit()}
            />
          )}
          {tab === "usage" && (
            <section className="ad-panel">
              <div className="ad-panel-heading">
                <div>
                  <h2>Yêu cầu AI</h2>
                  <p>
                    Không lưu câu hỏi, tài liệu hoặc câu trả lời trong nhật ký
                    sử dụng.
                  </p>
                </div>
                <span className="ad-pill">Metadata only</span>
              </div>
              <UsageBreakdownPanel
                key={data.actor.accountKey}
                accountKey={data.actor.accountKey}
              />
              <UsageTable events={usage} />
              <Pagination
                offset={usageOffset}
                length={usage.length}
                pageSize={30}
                busy={busy}
                hasNext={usage.length === 30}
                onPage={(offset) =>
                  perform(async () => {
                    const result = await request<{ events: AIUsageEvent[] }>(
                      `/api/admin/usage?offset=${offset}`,
                      { headers: { "X-Lumio-Account": data.actor.accountKey } },
                    );
                    setUsage(result.events);
                    setUsageOffset(offset);
                  })
                }
              />
            </section>
          )}
          {tab === "flags" && (
            <>
              <section className="ad-panel">
                <div className="ad-panel-heading">
                  <div>
                    <h2>Công tắc chức năng</h2>
                    <p>Tắt một chức năng sẽ chặn yêu cầu mới ở máy chủ.</p>
                  </div>
                  <Settings2 size={19} />
                </div>
                <div className="ad-flags">
                  {data.flags.map((flag) => (
                    <div key={flag.key} className="ad-flag">
                      <div className="ad-icon">
                        <Settings2 size={20} />
                      </div>
                      <div>
                        <strong>
                          {(
                            {
                              "ai.enabled": "Gia sư Lumio",
                              "ai.voice": "Học bằng giọng nói",
                              "accounts.linking": "Liên kết tài khoản",
                            } as Record<string, string>
                          )[flag.key] || flag.key}
                        </strong>
                        <p>{flag.description}</p>
                        <small>Cập nhật {date(flag.updatedAt)}</small>
                      </div>
                      <button
                        className={`ad-switch ${flag.enabled ? "on" : ""}`}
                        role="switch"
                        aria-checked={flag.enabled}
                        aria-label={flag.key}
                        disabled={busy || !permitted("features.update")}
                        onClick={() =>
                          perform(async () => {
                            await request("/api/admin/flags", {
                              method: "PATCH",
                              body: JSON.stringify({
                                key: flag.key,
                                enabled: !flag.enabled,
                              }),
                            });
                            await refresh();
                            setNotice("Đã lưu cài đặt tại máy chủ.");
                          })
                        }
                      >
                        <span>{flag.enabled && <Check size={12} />}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <div className="ad-info">
                <ShieldCheck size={18} />
                <p>
                  Bật công tắc không tự tạo kết nối dịch vụ. Khóa truy cập và
                  thông tin đăng nhập luôn do máy chủ quản lý.
                </p>
              </div>
            </>
          )}
          {tab === "audit" && (
            <section className="ad-panel">
              <div className="ad-panel-heading">
                <div>
                  <h2>Dòng thời gian kiểm toán</h2>
                  <p>Thay đổi danh tính, quyền truy cập và cấu hình.</p>
                </div>
                <span className="ad-pill">
                  <LockKeyhole size={12} /> Chỉ bổ sung
                </span>
              </div>
              <AuditTable events={audit} />
              <Pagination
                offset={auditOffset}
                length={audit.length}
                pageSize={40}
                busy={busy}
                hasNext={audit.length === 40}
                onPage={(offset) =>
                  perform(async () => {
                    const result = await request<{ events: AuditEvent[] }>(
                      `/api/admin/audit?offset=${offset}`,
                    );
                    setAudit(result.events);
                    setAuditOffset(offset);
                  })
                }
              />
            </section>
          )}
          <footer className="ad-footer">
            <span>
              Lumio AI <i /> Admin Console
            </span>
            <span>Quyền theo phạm vi · Dữ liệu thực</span>
          </footer>
        </div>
      </main>
      {confirm && (
        <div
          className="ad-dialog-overlay"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) setConfirm(null);
          }}
        >
          <section
            className="ad-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
          >
            <button
              className="ad-dialog-close"
              aria-label="Đóng"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              <X size={19} />
            </button>
            <div className="ad-icon big">
              <ShieldCheck size={26} />
            </div>
            <h2 id="admin-confirm-title">
              {confirm.action === "revoke"
                ? "Thu hồi mọi phiên đăng nhập?"
                : confirm.action === "disable"
                  ? "Tạm khóa tài khoản?"
                  : "Khôi phục quyền truy cập?"}
            </h2>
            <p>
              <strong>{confirm.user.name}</strong> · {confirm.user.email}
            </p>
            <p>
              {confirm.action === "enable"
                ? "Người dùng có thể đăng nhập lại. Dữ liệu hiện có được giữ nguyên."
                : "Các phiên hiện tại sẽ mất hiệu lực khi gọi máy chủ. Dữ liệu hiện có được giữ nguyên."}
            </p>
            <label htmlFor="admin-reason">Lý do thay đổi</label>
            <textarea
              id="admin-reason"
              autoFocus
              minLength={8}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do để lưu trong nhật ký…"
            />
            <div className="ad-dialog-actions">
              <button disabled={busy} onClick={() => setConfirm(null)}>
                Hủy
              </button>
              <button
                className="ad-primary"
                disabled={busy || reason.trim().length < 8}
                onClick={() => perform(changeAccess)}
              >
                {busy ? "Đang lưu…" : "Xác nhận thay đổi"}
              </button>
            </div>
            {error && (
              <div className="ad-alert" role="alert">
                {error}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
}) {
  return (
    <section className="ad-metric">
      <div>
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}
function StatusLine({
  name,
  value,
  neutral = false,
}: {
  name: string;
  value: string;
  neutral?: boolean;
}) {
  return (
    <div className="ad-status-line">
      <span>{name}</span>
      <b className={neutral ? "neutral" : ""}>
        {!neutral && <i />}
        {value}
      </b>
    </div>
  );
}
function Empty({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <div className="ad-empty">
      <Icon size={28} />
      <p>{text}</p>
    </div>
  );
}
function Pagination({
  offset,
  length,
  pageSize,
  busy,
  hasNext,
  onPage,
}: {
  offset: number;
  length: number;
  pageSize: number;
  busy: boolean;
  hasNext: boolean;
  onPage: (offset: number) => void;
}) {
  return (
    <div className="ad-pagination">
      <small>
        {length ? `${offset + 1}–${offset + length}` : "Chưa có bản ghi"}
      </small>
      <div>
        <button
          aria-label="Trang trước"
          disabled={busy || offset === 0}
          onClick={() => onPage(Math.max(0, offset - pageSize))}
        >
          <ChevronLeft size={17} />
        </button>
        <button
          aria-label="Trang tiếp theo"
          disabled={busy || !hasNext}
          onClick={() => onPage(offset + pageSize)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
function ActivityChart({ days }: { days: AdminSnapshot["dashboard"]["days"] }) {
  const maximum = Math.max(1, ...days.map((day) => day.requests));
  const points = days
    .map(
      (day, index) =>
        `${30 + index * 54},${160 - (day.requests / maximum) * 128}`,
    )
    .join(" ");
  return (
    <div className="ad-chart">
      <svg
        viewBox="0 0 762 200"
        role="img"
        aria-label={`Hoạt động AI 14 ngày: ${days.reduce((sum, day) => sum + day.requests, 0)} yêu cầu`}
      >
        <defs>
          <linearGradient id="ad-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7becd5" stopOpacity=".21" />
            <stop offset="100%" stopColor="#7becd5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[32, 74, 117, 160].map((y) => (
          <line
            key={y}
            x1="30"
            x2="732"
            y1={y}
            y2={y}
            stroke="#243137"
            strokeDasharray="3 6"
          />
        ))}
        <polygon
          points={`30,160 ${points} 732,160`}
          fill="url(#ad-chart-fill)"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#79dfcb"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {days.map((day, index) => (
          <g key={day.day}>
            <circle
              cx={30 + index * 54}
              cy={160 - (day.requests / maximum) * 128}
              r="3"
              fill="#79dfcb"
            >
              <title>{`${day.day}: ${day.requests} yêu cầu, ${day.errors} lỗi`}</title>
            </circle>
            {index % 3 === 0 && (
              <text
                x={30 + index * 54}
                y="190"
                fill="#86999c"
                fontSize="11"
                textAnchor="middle"
              >
                {day.day.slice(8)}/{day.day.slice(5, 7)}
              </text>
            )}
          </g>
        ))}
      </svg>
      {days.every((day) => day.requests === 0) && (
        <span className="ad-chart-empty">
          Yêu cầu đầu tiên sẽ xuất hiện tại đây.
        </span>
      )}
    </div>
  );
}
function UsageTable({ events }: { events: AIUsageEvent[] }) {
  if (!events.length)
    return <Empty icon={Sparkles} text="Chưa có yêu cầu AI được ghi nhận." />;
  return (
    <div className="ad-table-scroll">
      <table className="ad-table">
        <thead>
          <tr>
            <th>Tác vụ</th>
            <th>Mô hình</th>
            <th>Trạng thái</th>
            <th>Độ trễ</th>
            <th>Token vào / ra</th>
            <th>Thời gian</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>
                <strong>{event.task}</strong>
                <small className="ad-cell-sub" title={event.requestId}>
                  {event.requestId.slice(0, 8)}
                </small>
              </td>
              <td>
                {event.model || "—"}
                <small className="ad-cell-sub">
                  {event.provider || "Chưa gọi dịch vụ"}
                </small>
              </td>
              <td>
                <span
                  className={`ad-status ${event.status === "error" ? "disabled" : ""}`}
                >
                  <i />
                  {event.status === "success" ? "Thành công" : "Có lỗi"}
                </span>
                {event.errorCode && (
                  <small className="ad-cell-sub">{event.errorCode}</small>
                )}
              </td>
              <td>{formatNumber(event.latencyMs)} ms</td>
              <td>
                {formatNumber(event.inputTokens ?? null)} /{" "}
                {formatNumber(event.outputTokens ?? null)}
              </td>
              <td>{date(event.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function AuditTable({ events }: { events: AuditEvent[] }) {
  if (!events.length)
    return <Empty icon={Fingerprint} text="Chưa có sự kiện kiểm toán." />;
  const labels: Record<string, string> = {
    USER_CREATED: "Tạo tài khoản",
    ADMIN_BOOTSTRAPPED: "Cấp quyền quản trị",
    USER_SIGNED_IN: "Đăng nhập",
    IDENTITY_LINK_STARTED: "Bắt đầu liên kết",
    IDENTITY_LINKED: "Liên kết danh tính",
    USER_SUSPENDED: "Tạm khóa tài khoản",
    USER_RESTORED: "Mở khóa tài khoản",
    USER_SESSIONS_REVOKED: "Thu hồi phiên",
    FEATURE_FLAG_CHANGED: "Đổi công tắc chức năng",
    TEACHER_APPLICATION_SUBMITTED: "Gửi hồ sơ giáo viên",
    TEACHER_APPLICATION_APPROVED: "Duyệt hồ sơ giáo viên",
    TEACHER_APPLICATION_REJECTED: "Từ chối hồ sơ giáo viên",
    TEACHER_CREDENTIAL_REVOKED: "Thu hồi quyền giáo viên",
    TEACHER_REVIEW_DENIED: "Từ chối yêu cầu xét duyệt",
  };
  return (
    <div className="ad-audit-list">
      {events.map((event) => (
        <details key={event.id}>
          <summary>
            <span className="ad-audit-dot">
              <Fingerprint size={16} />
            </span>
            <div>
              <strong>{labels[event.action] || event.action}</strong>
              <small>{event.target?.slice(0, 38) || "Hệ thống"}</small>
            </div>
            <span
              className={`ad-status ${event.result === "success" ? "" : "disabled"}`}
            >
              <i />
              {event.result === "success"
                ? "Đã lưu"
                : event.result === "denied"
                  ? "Từ chối"
                  : "Lỗi"}
            </span>
            <time>{date(event.createdAt)}</time>
            <ChevronRight size={14} />
          </summary>
          <div className="ad-audit-detail">
            <div>
              <span>Mã sự kiện</span>
              <code>{event.id}</code>
            </div>
            <div>
              <span>Người thực hiện</span>
              <code>{event.actorId || "system"}</code>
            </div>
            <div>
              <span>Request ID</span>
              <code>{event.requestId}</code>
            </div>
            <div>
              <span>Trước</span>
              <code>{JSON.stringify(event.before)}</code>
            </div>
            <div>
              <span>Sau</span>
              <code>{JSON.stringify(event.after)}</code>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
