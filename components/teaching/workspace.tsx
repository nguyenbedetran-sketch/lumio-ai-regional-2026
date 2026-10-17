"use client";
import { MathText } from "../lumio/math-text";
import { useEffect, useState } from "react";
import { TeachingDraftBoundary, useTeachingDraftGuard } from "./draft-guard";
import type { TeachingState } from "../../lib/teaching/contracts";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  BookMarked,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileBarChart2,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { BrandSymbol } from "../lumio/brand";
import {
  useTeachingClient,
  FormError,
  submit,
  type TeachingClient,
} from "./client";
import { ClassesView } from "./classes";
import {
  LessonsView,
  QuestionsView,
  LibraryView,
  AssistantView,
} from "./content";
import {
  AssignmentsView,
  GradingView,
  AnalyticsView,
  ReportsView,
} from "./assessment";
import { CommunicationsView, TeachingSettingsView } from "./communication";
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
} from "./ui";

export type TeacherModule =
  | "dashboard"
  | "classes"
  | "lessons"
  | "assignments"
  | "questions"
  | "grading"
  | "analytics"
  | "library"
  | "announcements"
  | "assistant"
  | "reports"
  | "settings";
const navigation: {
  id: TeacherModule;
  title: string;
  icon: typeof Users;
  description: string;
}[] = [
  {
    id: "dashboard",
    title: "Tổng quan",
    icon: LayoutDashboard,
    description: "Một góc nhìn rõ ràng cho ngày giảng dạy của bạn.",
  },
  {
    id: "classes",
    title: "Lớp học",
    icon: Users,
    description: "Tạo lớp, mời học sinh và cùng giảng dạy có phân quyền.",
  },
  {
    id: "lessons",
    title: "Studio bài giảng",
    icon: BookOpen,
    description: "Từ học liệu của bạn đến một tiết học có chủ đích.",
  },
  {
    id: "assignments",
    title: "Bài tập",
    icon: ClipboardCheck,
    description: "Giao đúng bài, đúng nhóm và đúng thời điểm.",
  },
  {
    id: "questions",
    title: "Ngân hàng câu hỏi",
    icon: FileQuestion,
    description: "Câu hỏi có nguồn, có đáp án và được bạn xem lại.",
  },
  {
    id: "grading",
    title: "Chấm & nhận xét",
    icon: BookMarked,
    description: "Đọc bài làm, đối chiếu tiêu chí rồi công bố kết quả.",
  },
  {
    id: "analytics",
    title: "Tiến bộ học tập",
    icon: BarChart3,
    description:
      "Nhìn vào bằng chứng đã công bố; giữ thận trọng khi dữ liệu còn ít.",
  },
  {
    id: "library",
    title: "Thư viện giảng dạy",
    icon: Library,
    description: "Học liệu được lưu, tìm lại và chia sẻ có lựa chọn.",
  },
  {
    id: "announcements",
    title: "Bảng tin & lịch",
    icon: CalendarDays,
    description: "Giữ lớp học cùng một nhịp, từ thông báo đến lịch hẹn.",
  },
  {
    id: "assistant",
    title: "Trợ lý giảng dạy",
    icon: Sparkles,
    description: "Chuẩn bị cùng Lumio; quyết định chuyên môn vẫn thuộc về bạn.",
  },
  {
    id: "reports",
    title: "Báo cáo",
    icon: FileBarChart2,
    description: "Xuất dữ liệu thật để đối chiếu, lưu trữ hoặc trao đổi.",
  },
  {
    id: "settings",
    title: "Cài đặt",
    icon: Settings2,
    description: "Không gian, thời gian và quyền sử dụng minh bạch.",
  },
];
export function TeacherWorkspace({
  account,
}: {
  account: { key: string; id: string; name: string };
}) {
  return (
    <TeachingDraftBoundary>
      <TeacherWorkspaceContent account={account} />
    </TeachingDraftBoundary>
  );
}
function TeacherWorkspaceContent({
  account,
}: {
  account: { key: string; id: string; name: string };
}) {
  const guard = useTeachingDraftGuard();
  const client = useTeachingClient(account.key),
    [module, setModule] = useState<TeacherModule>("dashboard"),
    [createOrg, setCreateOrg] = useState(false),
    [orgName, setOrgName] = useState("");
  const data = client.data,
    current = navigation.find((item) => item.id === module)!;
  function navigate(next: TeacherModule) {
    if (next === module) return;
    guard.leave(() => {
      setModule(next);
      client.clearNotice();
      client.clearError();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  return (
    <div className="tw-shell" data-teacher-workspace>
      <aside className="tw-sidebar">
        <a href="/teacher" className="tw-brand">
          <BrandSymbol />
          <div>
            Lumio<small>TEACHER SPACE</small>
          </div>
        </a>
        <span className="tw-space-label">KHÔNG GIAN GIẢNG DẠY</span>
        <TeacherNavigation module={module} navigate={navigate} data={data} />
        <div className="tw-sidebar-bottom">
          <a href="/">
            <ArrowLeft
              size={14}
              style={{ display: "inline", marginRight: 7 }}
            />
            Về không gian học
          </a>
          <a href="/classroom">
            Góc học sinh <ArrowRight size={13} style={{ display: "inline" }} />
          </a>
          <div className="tw-identity">
            <span className="tw-avatar">
              {(data?.preferences?.displayName || account.name)
                .slice(0, 1)
                .toLocaleUpperCase()}
            </span>
            <div>
              <strong>{data?.preferences?.displayName || account.name}</strong>
              <small>
                {data?.role === "ORGANIZATION_ADMIN"
                  ? "Quản trị không gian"
                  : "Giáo viên đã được cấp quyền"}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <main className="tw-main">
        <header className="tw-topbar">
          <span className="tw-breadcrumb">
            Lumio <ChevronRight size={12} />
            <strong>{current.title}</strong>
          </span>
          <div className="tw-topbar-actions">
            {data?.organizations.length ? (
              <select
                aria-label="Không gian giảng dạy"
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
            <span className={`tw-connection ${client.online ? "" : "offline"}`}>
              <i />
              {client.online ? "Có mạng" : "Ngoại tuyến"}
            </span>
            <button
              className="tw-icon-button"
              aria-label="Tải lại không gian giảng dạy"
              disabled={client.busy || client.loading}
              onClick={() => void client.reload()}
            >
              <RefreshCw
                size={16}
                className={client.loading ? "tw-spin" : ""}
              />
            </button>
          </div>
        </header>
        <div className="tw-content">
          <div className="tw-heading">
            <div>
              <span className="tw-eyebrow">
                LUMIO /{" "}
                {module === "dashboard"
                  ? "HÔM NAY, CÙNG LỚP HỌC"
                  : current.title.toLocaleUpperCase()}
              </span>
              <h1>
                {module === "dashboard"
                  ? "Dạy có chiều sâu. Học có dấu ấn."
                  : current.title}
              </h1>
              <p>{current.description}</p>
            </div>
            {data?.organization && module === "dashboard" && (
              <Button onClick={() => navigate(dashboardNext(data).module)}>
                <ArrowRight size={16} />
                {dashboardNext(data).label}
              </Button>
            )}
          </div>
          {client.error && (
            <div className="tw-alert" role="alert">
              {client.error}
              <button
                aria-label="Đóng thông báo lỗi"
                onClick={client.clearError}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {client.notice && <Notice>{client.notice}</Notice>}
          {!client.online && (
            <p className="tw-note" style={{ marginBottom: 20 }}>
              Đang xem dữ liệu đã tải trong phiên này. Thay đổi chưa gửi không
              được tự lưu khi đóng trang; kết nối lại trước khi lưu.
            </p>
          )}
          {!data ? (
            client.loading ? (
              <Panel>
                <Empty icon={RefreshCw} title="Đang mở không gian của bạn">
                  Kiểm tra quyền truy cập và tải dữ liệu từ máy chủ.
                </Empty>
              </Panel>
            ) : (
              <Panel>
                <Empty
                  icon={GraduationCap}
                  title="Chưa mở được không gian"
                  action={
                    <Button onClick={() => void client.reload()}>
                      Thử kết nối lại
                    </Button>
                  }
                >
                  Phiên đăng nhập có thể đã thay đổi. Dữ liệu lớp học không được
                  hiển thị khi chưa xác nhận tài khoản.
                </Empty>
              </Panel>
            )
          ) : !data.organization ? (
            <Panel>
              <Empty
                icon={GraduationCap}
                title="Một nơi riêng cho cách bạn giảng dạy"
                action={
                  data.actor.canCreateOrganization ? (
                    <Button onClick={() => setCreateOrg(true)}>
                      Tạo không gian giảng dạy <ArrowRight size={16} />
                    </Button>
                  ) : (
                    <a className="tw-button" href="/teacher">
                      Xem hồ sơ giáo viên
                    </a>
                  )
                }
              >
                Không có lớp hoặc học sinh mẫu. Tạo không gian đầu tiên, rồi
                thêm lớp và học liệu của chính bạn.
              </Empty>
            </Panel>
          ) : module === "dashboard" ? (
            <Dashboard client={client} navigate={navigate} />
          ) : module === "classes" ? (
            <ClassesView key={data.organization.id} client={client} />
          ) : (
            <ModuleView module={module} client={client} />
          )}
          <footer className="tw-footer">
            <span>Lumio · Học sâu hơn, cùng nhau.</span>
            <span>Quyền theo tổ chức · Dữ liệu từ hoạt động thực</span>
          </footer>
        </div>
      </main>
      {createOrg && (
        <Modal
          title="Tạo không gian giảng dạy"
          onClose={() => setCreateOrg(false)}
          disabled={client.busy}
        >
          <form
            className="tw-form"
            onSubmit={submit(async () => {
              await client.mutate({ action: "org.create", name: orgName });
              setCreateOrg(false);
            })}
          >
            <FormError client={client} />
            <Field
              label="Tên không gian"
              hint="Bạn là quản trị của không gian vừa tạo; không tự nhận quyền với một trường có cùng tên."
            >
              <input
                required
                maxLength={120}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Ví dụ: Không gian Toán của cô An"
              />
            </Field>
            <p className="tw-note">
              Thông tin và nội dung được lưu phía máy chủ để lớp có thể truy
              cập. Việc lưu dữ liệu phụ thuộc cấu hình cơ sở dữ liệu; hosting
              miễn phí có thể ngủ hoặc gián đoạn. Không cam kết lưu trữ lâu dài.
            </p>
            <FormFooter
              busy={client.busy}
              onClose={() => setCreateOrg(false)}
              label="Tạo không gian"
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
function dashboardNext(data: TeachingState) {
  if (!data.dashboard.classes)
    return { module: "classes" as const, label: "Tạo lớp đầu tiên" };
  if (data.dashboard.awaitingGrading)
    return {
      module: "grading" as const,
      label: `Chấm ${data.dashboard.awaitingGrading} bài nộp`,
    };
  if (!data.dashboard.materials)
    return { module: "library" as const, label: "Thêm học liệu" };
  if (!data.dashboard.lessons)
    return { module: "lessons" as const, label: "Soạn bài giảng" };
  return {
    module: "assignments" as const,
    label: data.dashboard.assignments ? "Xem bài tập" : "Tạo bài tập",
  };
}
const primaryModules: TeacherModule[] = [
  "dashboard",
  "classes",
  "lessons",
  "assignments",
  "grading",
];
const secondaryGroups: { label: string; ids: TeacherModule[] }[] = [
  { label: "Chuẩn bị học liệu", ids: ["library", "questions", "assistant"] },
  { label: "Theo dõi lớp", ids: ["analytics", "reports"] },
  { label: "Trao đổi", ids: ["announcements"] },
];
function TeacherNavigation({
  module,
  navigate,
  data,
}: {
  module: TeacherModule;
  navigate: (id: TeacherModule) => void;
  data: TeachingState | null;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setExpanded(!primaryModules.includes(module));
  }, [module]);
  const shortLabels: Partial<Record<TeacherModule, string>> = {
    dashboard: "Tổng quan",
    classes: "Lớp học",
    lessons: "Bài giảng",
    assignments: "Bài tập",
    grading: "Chấm bài",
  };
  function button(id: TeacherModule) {
    const item = navigation.find((n) => n.id === id)!;
    return (
      <button
        key={id}
        type="button"
        aria-label={item.title}
        aria-current={module === id ? "page" : undefined}
        onClick={() => navigate(id)}
      >
        <item.icon size={18} />
        <span className="tw-nav-full">{item.title}</span>
        <span className="tw-nav-short" aria-hidden="true">
          {shortLabels[id] || item.title}
        </span>
        {id === "grading" && !!data?.dashboard.awaitingGrading && (
          <span className="tw-nav-count">{data.dashboard.awaitingGrading}</span>
        )}
        {id === "announcements" &&
          data?.preferences?.inAppNotifications !== false &&
          !!data?.announcements.filter((a) => a.status === "published")
            .length && (
            <span
              className="tw-nav-count"
              title="Tổng thông báo đã đăng, không phải số chưa đọc"
            >
              {
                data.announcements.filter((a) => a.status === "published")
                  .length
              }
            </span>
          )}
      </button>
    );
  }
  return (
    <nav aria-label="Không gian giáo viên">
      <div className="tw-primary-nav">{primaryModules.map(button)}</div>
      <details
        className="tw-more-nav"
        open={expanded}
        onToggle={(e) => setExpanded(e.currentTarget.open)}
      >
        <summary>
          Công cụ khác <ChevronRight size={15} />
        </summary>
        <div className="tw-secondary-nav">
          {secondaryGroups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2>{group.label}</h2>
              {group.ids.map(button)}
            </section>
          ))}
        </div>
      </details>
      <div className="tw-account-nav">{button("settings")}</div>
    </nav>
  );
}
function Dashboard({
  client,
  navigate,
}: {
  client: TeachingClient;
  navigate: (module: TeacherModule) => void;
}) {
  const data = client.data!,
    stats = data.dashboard;
  return (
    <div className="tw-grid tw-enter">
      <section className="tw-hero tw-hero-compact">
        <div>
          <span className="tw-eyebrow">
            CHÀO MỪNG TRỞ LẠI · {data.organization?.name.toLocaleUpperCase()}
          </span>
          <h2>
            {stats.awaitingGrading
              ? `${stats.awaitingGrading} bài nộp đang chờ bạn xem lại.`
              : stats.classes
                ? "Tiếp tục chuẩn bị cho lớp của bạn."
                : "Bắt đầu từ một lớp, rồi thêm học liệu."}
          </h2>
          <p>
            Bắt đầu từ học liệu, thêm mục tiêu rồi thiết kế những câu hỏi giúp
            lớp hiểu thật. Lumio cùng bạn chuẩn bị; bạn là người duyệt sau cùng.
          </p>
        </div>
      </section>
      <div className="tw-grid four">
        {[
          {
            label: "Lớp đang giảng dạy",
            value: stats.classes,
            icon: Users,
            detail: "Từ danh sách lớp đã tạo",
            tone: "",
          },
          {
            label: "Học sinh tham gia",
            value: stats.students,
            icon: GraduationCap,
            detail: "Tài khoản đã vào lớp",
            tone: "mint",
          },
          {
            label: "Bài cần chấm",
            value: stats.awaitingGrading,
            icon: ClipboardCheck,
            detail: "Bài nộp chưa chấm",
            tone: "sand",
          },
          {
            label: "Kết quả đã công bố",
            value: stats.publishedAssessments,
            icon: Activity,
            detail:
              stats.averagePercent === null
                ? "Chưa có điểm trung bình"
                : `Trung bình ${stats.averagePercent.toFixed(1)}%`,
            tone: "indigo",
          },
        ].map((stat) => (
          <article className={`tw-panel tw-stat ${stat.tone}`} key={stat.label}>
            <div>
              {stat.label}
              <stat.icon size={20} />
            </div>
            <strong>{stat.value}</strong>
            <p>{stat.detail}</p>
          </article>
        ))}
      </div>
      <div className="tw-grid two">
        <Panel
          title="Bài tập gần đây"
          action={
            <button
              className="tw-text-button"
              onClick={() => navigate("assignments")}
            >
              Xem tất cả <ArrowRight size={13} />
            </button>
          }
        >
          {data.assignments.length ? (
            <div className="tw-pad">
              {data.assignments.slice(0, 4).map((a) => (
                <div className="tw-metric-row" key={a.id}>
                  <span>
                    <MathText text={a.title} inline />
                    <small style={{ display: "block" }}>
                      {data.classes.find((c) => c.id === a.classId)?.name} · Hạn{" "}
                      {dateTime(a.dueAt)}
                    </small>
                  </span>
                  <Tag tone={a.status === "issued" ? "green" : "neutral"}>
                    {a.status === "issued"
                      ? "Đã giao"
                      : a.status === "closed"
                        ? "Đã đóng"
                        : "Bản nháp"}
                  </Tag>
                </div>
              ))}
            </div>
          ) : (
            <Empty icon={ClipboardCheck} title="Chưa có bài tập được tạo">
              Tạo câu hỏi, duyệt rồi giao cho lớp, nhóm hoặc học sinh được chọn.
            </Empty>
          )}
        </Panel>
        <Panel
          title="Những mốc sắp tới"
          action={
            <button
              className="tw-text-button"
              onClick={() => navigate("announcements")}
            >
              Mở lịch <ArrowRight size={13} />
            </button>
          }
        >
          {data.events.length ? (
            <div className="tw-pad">
              {data.events
                .slice()
                .sort((a, b) => a.startAt.localeCompare(b.startAt))
                .slice(0, 4)
                .map((event) => (
                  <div className="tw-metric-row" key={event.id}>
                    <span>
                      <MathText text={event.title} inline />
                      <small style={{ display: "block" }}>
                        {dateTime(event.startAt)}
                      </small>
                    </span>
                    <CalendarDays size={16} color="#99ad83" />
                  </div>
                ))}
            </div>
          ) : (
            <Empty icon={CalendarDays} title="Lịch học đang rộng mở">
              Thêm tiết học, buổi gặp hoặc cột mốc để mọi người cùng theo dõi.
            </Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}
function ModuleView({
  module,
  client,
}: {
  module: TeacherModule;
  client: TeachingClient;
}) {
  const views = {
    lessons: LessonsView,
    questions: QuestionsView,
    library: LibraryView,
    assistant: AssistantView,
    assignments: AssignmentsView,
    grading: GradingView,
    analytics: AnalyticsView,
    reports: ReportsView,
    announcements: CommunicationsView,
    settings: TeachingSettingsView,
  };
  const View = views[module as keyof typeof views];
  return View ? (
    <View key={client.data!.organization!.id + ":" + module} client={client} />
  ) : null;
}
