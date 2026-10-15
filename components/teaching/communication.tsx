"use client";
import { useState } from "react";
import { useTeachingTabs } from "./tabs";
import { useTeachingDraft } from "./draft-guard";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Plus,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import type {
  TeachingAnnouncement,
  TeachingEvent,
} from "../../lib/teaching/contracts";
import { FormError, submit, type TeachingClient } from "./client";
import {
  AddButton,
  Button,
  Empty,
  Field,
  FormFooter,
  Modal,
  Panel,
  Tag,
  dateTime,
  useTeachingConfirmation,
} from "./ui";
function localTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function CommunicationsView({ client }: { client: TeachingClient }) {
  const confirmation = useTeachingConfirmation();
  const [tab, setTab] = useState<"announcements" | "events">("announcements"),
    [editing, setEditing] = useState<
      TeachingAnnouncement | TeachingEvent | "new" | null
    >(null);
  const data = client.data!;
  const tabs = useTeachingTabs(
    tab,
    [
      ["announcements", "Thông báo lớp"],
      ["events", "Lịch & sự kiện"],
    ],
    (value) => setTab(value as typeof tab),
  );
  return (
    <div className="tw-grid tw-enter">
      <div className="tw-toolbar">
        <div
          className="tw-tabs"
          {...tabs.listProps}
          aria-label="Bảng tin và lịch"
          style={{ margin: 0, border: 0, padding: 0 }}
        >
          <button {...tabs.buttonProps("announcements")}>Thông báo lớp</button>
          <button {...tabs.buttonProps("events")}>Lịch & sự kiện</button>
        </div>
        <AddButton onClick={() => setEditing("new")}>
          {tab === "announcements" ? "Soạn thông báo" : "Thêm lịch hẹn"}
        </AddButton>
      </div>
      <div {...tabs.panelProps}>
        {tab === "announcements" ? (
          <>
            {data.announcements.map((item) => (
              <article className="tw-card" key={item.id}>
                <div className="tw-card-top">
                  <Tag tone={item.status === "published" ? "green" : "amber"}>
                    {item.status === "published" ? "Đã đăng" : "Bản nháp"}
                  </Tag>
                  <span className="tw-subtle">
                    {item.classId
                      ? data.classes.find((c) => c.id === item.classId)?.name
                      : "Trong tổ chức"}{" "}
                    · {dateTime(item.createdAt)}
                  </span>
                </div>
                <h3>{item.title}</h3>
                <div className="tw-result">{item.body}</div>
                <div className="tw-card-footer">
                  <button
                    className="tw-text-button"
                    onClick={() => setEditing(item)}
                  >
                    Chỉnh sửa
                  </button>
                  {item.status === "draft" && (
                    <button
                      className="tw-text-button"
                      disabled={client.busy}
                      onClick={() =>
                        void client
                          .mutate({
                            action: "announcement.publish",
                            id: item.id,
                            expectedRevision: item.revision,
                          })
                          .catch(() => {})
                      }
                    >
                      Đăng thông báo <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!data.announcements.length && (
              <Panel>
                <Empty icon={Bell} title="Những điều cần nói với lớp">
                  Soạn nháp, chọn phạm vi rồi đăng. Học sinh chỉ thấy thông báo
                  đã đăng trong lớp của mình.
                </Empty>
              </Panel>
            )}
          </>
        ) : (
          <>
            {data.events
              .slice()
              .sort((a, b) => a.startAt.localeCompare(b.startAt))
              .map((item) => (
                <article className="tw-card" key={item.id}>
                  <div className="tw-card-top">
                    <Tag tone="indigo">
                      {item.kind === "lesson"
                        ? "Tiết học"
                        : item.kind === "deadline"
                          ? "Hạn cần nhớ"
                          : "Buổi gặp"}
                    </Tag>
                    <span className="tw-subtle">
                      {data.classes.find((c) => c.id === item.classId)?.name}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>
                    {dateTime(item.startAt)} → {dateTime(item.endAt)}
                  </p>
                  <p style={{ marginTop: 10 }}>{item.description}</p>
                  <div className="tw-card-footer">
                    <button
                      className="tw-text-button"
                      onClick={() => setEditing(item)}
                    >
                      Chỉnh sửa lịch
                    </button>
                    <button
                      className="tw-text-button"
                      disabled={client.busy}
                      onClick={() =>
                        confirmation.ask({
                          title: "Xóa lịch hẹn?",
                          description: `Lịch “${item.title}” sẽ được gỡ khỏi lớp. Thao tác này không xóa bài tập hoặc thay đổi hạn nộp bài.`,
                          label: "Xác nhận xóa lịch",
                          action: () =>
                            client.mutate({
                              action: "event.delete",
                              id: item.id,
                              expectedRevision: item.revision,
                            }),
                        })
                      }
                    >
                      Xóa lịch hẹn
                    </button>
                  </div>
                </article>
              ))}
            {!data.events.length && (
              <Panel>
                <Empty
                  icon={CalendarDays}
                  title="Chủ động với những cột mốc tiếp theo"
                >
                  Thêm tiết học, buổi gặp hoặc hạn cần nhớ. Bản này hiển thị
                  lịch trong lớp, chưa tự gửi email hoặc thông báo đẩy.
                </Empty>
              </Panel>
            )}
          </>
        )}
      </div>
      {confirmation.dialog}
      {editing && (
        <CommunicationEditor
          key={typeof editing === "string" ? tab : editing.id}
          client={client}
          tab={tab}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
function CommunicationEditor({
  client,
  tab,
  initial,
  onClose,
}: {
  client: TeachingClient;
  tab: "announcements" | "events";
  initial: TeachingAnnouncement | TeachingEvent | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || ""),
    [body, setBody] = useState(
      initial && "body" in initial
        ? initial.body
        : initial && "description" in initial
          ? initial.description
          : "",
    ),
    [classId, setClassId] = useState(initial?.classId || ""),
    [start, setStart] = useState(
      localTime(initial && "startAt" in initial ? initial.startAt : undefined),
    ),
    [end, setEnd] = useState(
      localTime(initial && "endAt" in initial ? initial.endAt : undefined),
    ),
    [kind, setKind] = useState<TeachingEvent["kind"]>(
      initial && "kind" in initial ? initial.kind : "lesson",
    );
  return (
    <Modal
      title={tab === "announcements" ? "Soạn thông báo lớp" : "Thêm lịch hẹn"}
      onClose={onClose}
      disabled={client.busy}
    >
      <form
        className="tw-form"
        onSubmit={submit(async () => {
          if (tab === "announcements")
            await client.mutate({
              action: "announcement.save",
              id: initial?.id,
              expectedRevision: initial?.revision || 0,
              classId: classId || null,
              title,
              body,
            });
          else
            await client.mutate({
              action: "event.save",
              id: initial?.id,
              expectedRevision: initial?.revision || 0,
              classId,
              title,
              description: body,
              startAt: new Date(start).toISOString(),
              endAt: new Date(end).toISOString(),
              kind,
            });
          onClose();
        })}
      >
        <FormError client={client} />
        <Field label="Tiêu đề">
          <input
            required
            maxLength={180}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Phạm vi lớp">
          <select
            required={tab === "events"}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">
              {tab === "announcements" ? "Cấp tổ chức" : "Chọn lớp"}
            </option>
            {client
              .data!.classes.filter((c) => !c.archived)
              .map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={tab === "announcements" ? "Nội dung thông báo" : "Mô tả"}>
          <textarea
            required
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
        {tab === "events" && (
          <>
            <Field label="Loại lịch hẹn">
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as TeachingEvent["kind"])
                }
              >
                <option value="lesson">Tiết học</option>
                <option value="deadline">Hạn cần nhớ</option>
                <option value="meeting">Buổi gặp</option>
              </select>
            </Field>
            <div className="tw-form-row">
              <Field label="Bắt đầu (giờ thiết bị)">
                <input
                  type="datetime-local"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label="Kết thúc (giờ thiết bị)">
                <input
                  type="datetime-local"
                  required
                  min={start}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}
        <FormFooter
          busy={client.busy}
          onClose={onClose}
          label={
            tab === "announcements" ? "Lưu nháp thông báo" : "Lưu lịch hẹn"
          }
        />
      </form>
    </Modal>
  );
}
export function TeachingSettingsView({ client }: { client: TeachingClient }) {
  const settingsDraft = useTeachingDraft("Cài đặt tổ chức");
  const settings = client.data!.settings,
    [name, setName] = useState(
      settings?.name || client.data!.organization?.name || "",
    ),
    [timezone, setTimezone] = useState(
      settings?.timezone || "Asia/Ho_Chi_Minh",
    ),
    [allowLate, setAllowLate] = useState(
      settings?.allowLateSubmissions ?? false,
    ),
    [orgName, setOrgName] = useState(""),
    [create, setCreate] = useState(false);
  return (
    <div className="tw-grid two tw-enter">
      <PersonalPreferences client={client} />
      <Panel title="Không gian và thời gian" eyebrow="CẤU HÌNH TỔ CHỨC">
        <form
          className="tw-form tw-pad"
          onInputCapture={settingsDraft.markDirty}
          onChangeCapture={settingsDraft.markDirty}
          onSubmit={submit(async () => {
            await client.mutate({
              action: "settings.update",
              expectedRevision: settings?.revision || 0,
              name,
              timezone,
              allowLateSubmissions: allowLate,
            });
            settingsDraft.markClean();
          })}
        >
          <FormError client={client} />
          <fieldset
            disabled={!client.data!.permissions.manageOrg || client.busy}
            style={{ display: "contents" }}
          >
            <Field label="Tên không gian">
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Múi giờ báo cáo">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="Asia/Ho_Chi_Minh">
                  Việt Nam · Asia/Ho_Chi_Minh
                </option>
                <option value="UTC">UTC</option>
                <option value="Asia/Bangkok">Asia/Bangkok</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
              </select>
            </Field>
            <label className="tw-check">
              <input
                type="checkbox"
                checked={allowLate}
                onChange={(e) => setAllowLate(e.target.checked)}
              />
              Cho phép nộp sau hạn; bài nộp muộn vẫn được ghi rõ.
            </label>
            <Button busy={client.busy} type="submit">
              Lưu cài đặt
            </Button>
          </fieldset>
          {!client.data!.permissions.manageOrg && (
            <p className="tw-note">
              Chỉ quản trị không gian thay đổi cài đặt tổ chức.
            </p>
          )}
        </form>
      </Panel>
      <div className="tw-grid">
        <Panel title="Quyền truy cập minh bạch">
          <div className="tw-pad tw-form">
            <Tag tone="green">
              <ShieldCheck size={13} />
              {client.data!.role === "ORGANIZATION_ADMIN"
                ? "Quản trị không gian"
                : "Giáo viên trong tổ chức"}
            </Tag>
            <p className="tw-note">
              Quyền giáo viên là quyền ứng dụng đã được quản trị duyệt từ khai
              báo. Không tự cấp quyền admin hoặc đọc dữ liệu học riêng của học
              sinh bên ngoài lớp đã tham gia.
            </p>
            <Field
              label="Mã tài khoản để phân công đồng giảng dạy"
              hint="Chỉ chia sẻ với quản trị không gian bạn muốn tham gia. Mã này không phải mật khẩu hoặc quyền tự truy cập."
            >
              <input
                readOnly
                value={client.data!.actor.userId}
                onFocus={(e) => e.target.select()}
              />
            </Field>
            <a href="/privacy" className="tw-text-button">
              Quyền riêng tư <ArrowRight size={13} />
            </a>
            <a href="/data-deletion" className="tw-text-button">
              Lưu trữ và xóa dữ liệu <ArrowRight size={13} />
            </a>
          </div>
        </Panel>
        {client.data!.actor.canCreateOrganization && (
          <Panel title="Thêm một không gian riêng">
            <div className="tw-pad">
              <p className="tw-muted" style={{ marginBottom: 15 }}>
                Dữ liệu và thành viên giữa các tổ chức được tách biệt.
              </p>
              <Button secondary onClick={() => setCreate(true)}>
                <Plus size={15} />
                Tạo không gian khác
              </Button>
            </div>
          </Panel>
        )}
        {client.data!.permissions.manageOrg && (
          <OrganizationMembers client={client} />
        )}
      </div>
      {create && (
        <Modal
          title="Tạo không gian khác"
          onClose={() => setCreate(false)}
          disabled={client.busy}
        >
          <form
            className="tw-form"
            onSubmit={submit(async () => {
              await client.mutate({ action: "org.create", name: orgName });
              setCreate(false);
            })}
          >
            <FormError client={client} />
            <Field label="Tên không gian">
              <input
                required
                maxLength={120}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </Field>
            <FormFooter
              busy={client.busy}
              onClose={() => setCreate(false)}
              label="Tạo không gian"
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
function PersonalPreferences({ client }: { client: TeachingClient }) {
  const preferenceDraft = useTeachingDraft("Cài đặt cá nhân");
  const saved = client.data!.preferences,
    [displayName, setDisplayName] = useState(
      saved?.displayName || client.data!.actor.name,
    ),
    [subjects, setSubjects] = useState(saved?.subjects.join("\n") || ""),
    [grades, setGrades] = useState(saved?.grades.join("\n") || ""),
    [aiLanguage, setLanguage] = useState(saved?.aiLanguage || "vi"),
    [difficulty, setDifficulty] = useState<"basic" | "medium" | "advanced">(
      saved?.defaultDifficulty || "medium",
    ),
    [aiEnabled, setAI] = useState(saved?.aiEnabled ?? true),
    [notifications, setNotifications] = useState(
      saved?.inAppNotifications ?? true,
    );
  const lines = (text: string) => [
    ...new Set(
      text
        .split(/\n/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
  return (
    <Panel title="Cách bạn muốn giảng dạy" eyebrow="CÀI ĐẶT RIÊNG CỦA TÔI">
      <form
        className="tw-form tw-pad"
        onInputCapture={preferenceDraft.markDirty}
        onChangeCapture={preferenceDraft.markDirty}
        onSubmit={submit(async () => {
          await client.mutate({
            action: "preferences.update",
            expectedRevision: saved?.revision || 0,
            displayName,
            subjects: lines(subjects),
            grades: lines(grades),
            aiLanguage,
            defaultDifficulty: difficulty,
            aiEnabled,
            inAppNotifications: notifications,
          });
          preferenceDraft.markClean();
        })}
      >
        <FormError client={client} />
        <fieldset disabled={client.busy} style={{ display: "contents" }}>
          <Field
            label="Tên hiển thị trong không gian"
            hint="Chỉ là tên hiển thị riêng, không thay đổi danh tính hoặc hồ sơ giáo viên đã duyệt."
          >
            <input
              required
              maxLength={120}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <div className="tw-form-row">
            <Field
              label="Môn giảng dạy (mỗi dòng một môn)"
              hint="Tối đa 20 môn, 80 ký tự mỗi môn."
            >
              <textarea
                value={subjects}
                onChange={(e) => setSubjects(e.target.value)}
                maxLength={1600}
              />
            </Field>
            <Field
              label="Khối dạy (mỗi dòng một khối)"
              hint="Dùng làm gợi ý mặc định cho bản nháp, không thay quyền truy cập lớp."
            >
              <textarea
                value={grades}
                onChange={(e) => setGrades(e.target.value)}
                maxLength={800}
              />
            </Field>
          </div>
          <div className="tw-form-row">
            <Field label="Ngôn ngữ AI mặc định">
              <select
                value={aiLanguage}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
                <option value="zh-CN">中文</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
              </select>
            </Field>
            <Field label="Độ khó mặc định">
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as typeof difficulty)
                }
              >
                <option value="basic">Cơ bản</option>
                <option value="medium">Vừa sức</option>
                <option value="advanced">Nâng cao</option>
              </select>
            </Field>
          </div>
          <label className="tw-check">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAI(e.target.checked)}
            />
            Cho phép dùng trợ lý AI; mỗi lần gửi vẫn cần đồng ý riêng.
          </label>
          <label className="tw-check">
            <input
              type="checkbox"
              checked={notifications}
              onChange={(e) => setNotifications(e.target.checked)}
            />
            Hiện nhãn số thông báo đã đăng trong thanh điều hướng. Không phải
            thông báo đẩy hoặc số chưa đọc.
          </label>
          <p className="tw-note">
            Cài đặt gắn với tài khoản giáo viên này và được lưu trên máy chủ.
            Chỉ học liệu đã chọn được gửi khi bạn chủ động tạo với AI. Không
            dùng cài đặt này để chia sẻ bài làm riêng của học sinh.
          </p>
          <Button
            type="submit"
            busy={client.busy}
            disabled={
              lines(subjects).length > 20 ||
              lines(subjects).some((s) => s.length > 80) ||
              lines(grades).length > 20 ||
              lines(grades).some((s) => s.length > 40)
            }
          >
            Lưu cài đặt cá nhân
          </Button>
        </fieldset>
      </form>
    </Panel>
  );
}
function OrganizationMembers({ client }: { client: TeachingClient }) {
  const confirmation = useTeachingConfirmation();
  const data = client.data!,
    [remove, setRemove] = useState<string | null>(null);
  return (
    <Panel title="Thành viên và vai trò">
      <div className="tw-pad tw-card-list">
        {data.members.map((member) => (
          <div className="tw-metric-row" key={member.userId}>
            <span>
              {member.name}
              <small style={{ display: "block" }}>
                {member.role === "OWNER"
                  ? "Chủ không gian"
                  : member.role === "STUDENT"
                    ? "Học sinh"
                    : member.approvedTeacher
                      ? "Giáo viên đã được duyệt"
                      : "Chưa có quyền giảng dạy hiện hành"}
              </small>
            </span>
            {member.role !== "OWNER" && member.userId !== data.actor.userId ? (
              <div className="tw-card-actions">
                {member.role !== "STUDENT" && (
                  <select
                    aria-label={`Vai trò của ${member.name}`}
                    disabled={client.busy}
                    value={member.role}
                    onChange={(e) => {
                      const role = e.target.value as "TEACHER" | "SCHOOL_ADMIN";
                      confirmation.ask({
                        title: "Thay đổi vai trò thành viên?",
                        description: `${member.name} sẽ có vai trò ${role === "SCHOOL_ADMIN" ? "quản trị tổ chức, được quản lý thành viên và lớp" : "giáo viên"}. Chỉ áp dụng trong tổ chức này; không cấp quyền quản trị hệ thống.`,
                        label: "Xác nhận đổi vai trò",
                        action: () =>
                          client.mutate({
                            action: "member.role",
                            userId: member.userId,
                            role,
                            expectedRevision: data.organization!.revision,
                          }),
                      });
                    }}
                  >
                    <option value="TEACHER">Giáo viên</option>
                    <option value="SCHOOL_ADMIN">Quản trị tổ chức</option>
                  </select>
                )}
                <button
                  className="tw-text-button"
                  disabled={client.busy}
                  onClick={() => setRemove(member.userId)}
                >
                  Gỡ khỏi tổ chức
                </button>
              </div>
            ) : (
              <Tag>Quyền được bảo vệ</Tag>
            )}
          </div>
        ))}
        <p className="tw-note">
          Quyền này chỉ áp dụng trong tổ chức. Tài khoản học sinh không được đổi
          trực tiếp thành giáo viên; giáo viên phải có hồ sơ đã duyệt.
        </p>
      </div>
      {confirmation.dialog}
      {remove && (
        <Modal
          title="Gỡ thành viên khỏi tổ chức"
          onClose={() => setRemove(null)}
          disabled={client.busy}
        >
          <form
            className="tw-form"
            onSubmit={submit(async () => {
              await client.mutate({
                action: "member.remove",
                userId: remove,
                expectedRevision: data.organization!.revision,
              });
              setRemove(null);
            })}
          >
            <FormError client={client} />
            <p className="tw-note">
              {data.members.find((m) => m.userId === remove)?.name} sẽ mất quyền
              truy cập tổ chức và các lớp liên quan. Bài làm và lịch sử đã lưu
              không bị giả thành chưa từng có.
            </p>
            <FormFooter
              busy={client.busy}
              onClose={() => setRemove(null)}
              label="Xác nhận gỡ thành viên"
            />
          </form>
        </Modal>
      )}
    </Panel>
  );
}
