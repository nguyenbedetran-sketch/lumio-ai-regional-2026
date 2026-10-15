"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Copy,
  GraduationCap,
  KeyRound,
  Layers3,
  Plus,
  Users,
} from "lucide-react";
import type {
  TeachingClass,
  TeachingGroup,
} from "../../lib/teaching/contracts";
import { FormError, submit, type TeachingClient } from "./client";
import { useTeachingTabs } from "./tabs";
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
  ModalCancelButton,
} from "./ui";

export function ClassesView({ client }: { client: TeachingClient }) {
  const confirmation = useTeachingConfirmation();
  const data = client.data!,
    [selected, setSelected] = useState<string | null>(null),
    [dialog, setDialog] = useState<
      "create" | "edit" | "invite" | "group" | "team" | null
    >(null),
    [editingGroup, setEditingGroup] = useState<TeachingGroup | null>(null),
    [tab, setTab] = useState("students"),
    [query, setQuery] = useState(""),
    [code, setCode] = useState("");
  const tabChoices = [
      ["students", "Học sinh"],
      ["groups", "Nhóm học tập"],
      ["team", "Đồng giảng dạy"],
      ["invites", "Mã tham gia"],
    ] as const,
    tabs = useTeachingTabs(tab, tabChoices, setTab);
  const klass = data.classes.find((item) => item.id === selected),
    classes = data.classes.filter((item) =>
      [item.name, item.subject, item.grade]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    );
  const close = () => {
    if (!client.busy) {
      setDialog(null);
      setEditingGroup(null);
    }
  };
  const members = klass
    ? data.enrollments.filter((e) => e.classId === klass.id && e.active)
    : [];
  function editGroup(group: TeachingGroup | null) {
    setEditingGroup(group);
    setDialog("group");
  }
  return (
    <div className="tw-enter" data-teaching-classes>
      {klass ? (
        <>
          <div className="tw-detail-heading">
            <button
              aria-label="Về danh sách lớp"
              onClick={() => {
                setSelected(null);
                setCode("");
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2>{klass.name}</h2>
              <p>
                {klass.subject} · Khối {klass.grade} · {members.length} học sinh
              </p>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Button
                secondary
                disabled={client.busy}
                onClick={() => setDialog("edit")}
              >
                Chỉnh sửa lớp
              </Button>
            </div>
          </div>
          <div className="tw-tabs" {...tabs.listProps} aria-label="Quản lý lớp">
            {tabChoices.map(([key, label]) => (
              <button key={key} {...tabs.buttonProps(key)}>
                {label}
              </button>
            ))}
          </div>
          <div {...tabs.panelProps}>
            {tab === "students" && (
              <Panel
                title="Thành viên lớp"
                action={
                  <AddButton onClick={() => setDialog("invite")}>
                    Mời học sinh
                  </AddButton>
                }
              >
                {data.enrollments.some((item) => item.classId === klass.id) ? (
                  <div className="tw-table-wrap">
                    <table className="tw-table">
                      <thead>
                        <tr>
                          <th>Học sinh</th>
                          <th>Ngày tham gia</th>
                          <th>Trạng thái</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.enrollments
                          .filter((item) => item.classId === klass.id)
                          .map((member) => (
                            <tr key={member.id}>
                              <td>
                                <strong>{member.name}</strong>
                                <small>Chỉ từ tài khoản tự tham gia</small>
                              </td>
                              <td>{dateTime(member.joinedAt)}</td>
                              <td>
                                <Tag tone={member.active ? "green" : "neutral"}>
                                  {member.active ? "Đang học" : "Đã ngừng"}
                                </Tag>
                              </td>
                              <td>
                                <Button
                                  secondary
                                  disabled={client.busy}
                                  onClick={() =>
                                    confirmation.ask({
                                      title: member.active
                                        ? "Ngừng quyền tham gia lớp?"
                                        : "Khôi phục quyền tham gia lớp?",
                                      description: `${member.name}: thay đổi quyền xem và nộp bài trong lớp này. Dữ liệu đã lưu không bị xóa.`,
                                      label: member.active
                                        ? "Xác nhận ngừng tham gia"
                                        : "Xác nhận khôi phục",
                                      action: () =>
                                        client.mutate({
                                          action: member.active
                                            ? "enrollment.remove"
                                            : "enrollment.restore",
                                          id: member.id,
                                          expectedRevision: member.revision,
                                        }),
                                    })
                                  }
                                >
                                  {member.active
                                    ? "Ngừng tham gia"
                                    : "Khôi phục tham gia"}
                                </Button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    icon={Users}
                    title="Lớp đã sẵn sàng cho những người học đầu tiên"
                    action={
                      <Button onClick={() => setDialog("invite")}>
                        Tạo mã tham gia <ArrowRight size={15} />
                      </Button>
                    }
                  >
                    Tạo mã và gửi cho học sinh. Tên và số lượng chỉ xuất hiện
                    khi tài khoản thật tham gia.
                  </Empty>
                )}
              </Panel>
            )}
            {tab === "groups" && (
              <Panel
                title="Nhóm học tập"
                action={
                  <AddButton onClick={() => editGroup(null)}>
                    Tạo nhóm
                  </AddButton>
                }
              >
                {data.groups.filter((g) => g.classId === klass.id).length ? (
                  <div className="tw-grid two tw-pad">
                    {data.groups
                      .filter((g) => g.classId === klass.id)
                      .map((group) => (
                        <article className="tw-card" key={group.id}>
                          <Tag tone="indigo">
                            {group.memberIds.length} thành viên
                          </Tag>
                          <h3>{group.name}</h3>
                          <p>
                            {members
                              .filter((m) => group.memberIds.includes(m.userId))
                              .map((m) => m.name)
                              .join(", ") || "Chưa thêm học sinh."}
                          </p>
                          <div className="tw-card-footer">
                            <button
                              className="tw-text-button"
                              onClick={() => editGroup(group)}
                            >
                              Sửa nhóm
                            </button>
                            <button
                              className="tw-text-button"
                              disabled={client.busy}
                              onClick={() =>
                                confirmation.ask({
                                  title: "Xóa nhóm học tập?",
                                  description: `Nhóm “${group.name}” sẽ bị xóa. Học sinh vẫn thuộc lớp; đề đã giao giữ nguyên đối tượng đã chốt.`,
                                  label: "Xác nhận xóa nhóm",
                                  action: () =>
                                    client.mutate({
                                      action: "group.delete",
                                      id: group.id,
                                      expectedRevision: group.revision,
                                    }),
                                })
                              }
                            >
                              Xóa nhóm
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                ) : (
                  <Empty icon={Layers3} title="Mỗi nhóm, một nhịp học">
                    Tạo nhóm từ học sinh đã tham gia để giao bài đúng đối tượng.
                  </Empty>
                )}
              </Panel>
            )}
            {tab === "team" && (
              <Panel
                title="Cùng chuẩn bị, cùng giảng dạy"
                action={
                  data.permissions.manageOrg ? (
                    <AddButton onClick={() => setDialog("team")}>
                      Phân công giáo viên
                    </AddButton>
                  ) : undefined
                }
              >
                <div className="tw-pad tw-card-list">
                  {klass.teacherIds.map((id) => (
                    <div className="tw-metric-row" key={id}>
                      <span>
                        {data.members.find((m) => m.userId === id)?.name ||
                          "Giáo viên đã được phân công"}
                        <small style={{ display: "block" }}>
                          Quyền trong lớp này
                        </small>
                      </span>
                      {data.permissions.manageOrg && (
                        <button
                          className="tw-text-button"
                          disabled={client.busy}
                          onClick={() =>
                            confirmation.ask({
                              title: "Gỡ phân công giảng dạy?",
                              description: `Giáo viên sẽ mất phân công trong lớp “${klass.name}”. Quyền tổ chức và dữ liệu đã lưu không tự bị xóa.`,
                              label: "Xác nhận gỡ phân công",
                              action: () =>
                                client.mutate({
                                  action: "teacher.remove",
                                  classId: klass.id,
                                  userId: id,
                                  expectedRevision: klass.revision,
                                }),
                            })
                          }
                        >
                          Gỡ phân công
                        </button>
                      )}
                    </div>
                  ))}
                  {!klass.teacherIds.length && (
                    <p className="tw-muted">
                      Chưa có giáo viên được phân công riêng. Quản trị không
                      gian quản lý lớp này.
                    </p>
                  )}
                  <p className="tw-note">
                    Chỉ phân công tài khoản giáo viên đã được duyệt. Người được
                    phân công mới sẽ tham gia tổ chức với vai trò giáo viên;
                    không nhập email để tự cấp quyền cho một người khác.
                  </p>
                </div>
              </Panel>
            )}
            {tab === "invites" && (
              <Panel
                title="Một lời mời có giới hạn"
                action={
                  <AddButton onClick={() => setDialog("invite")}>
                    Tạo mã mới
                  </AddButton>
                }
              >
                <div className="tw-pad">
                  {code && (
                    <div className="tw-code">
                      <span>
                        {code}
                        <small>
                          Chỉ hiển thị ngay sau khi tạo. Hãy sao chép để gửi.
                        </small>
                      </span>
                      <Button
                        secondary
                        onClick={() =>
                          void navigator.clipboard?.writeText(code)
                        }
                      >
                        {" "}
                        <Copy size={15} /> Sao chép
                      </Button>
                    </div>
                  )}
                  {data.invites.filter((i) => i.classId === klass.id).length ? (
                    <div className="tw-card-list" style={{ marginTop: 18 }}>
                      {data.invites
                        .filter((i) => i.classId === klass.id)
                        .map((invite) => (
                          <div className="tw-metric-row" key={invite.id}>
                            <span>
                              Mã mời đã tạo
                              <small style={{ display: "block" }}>
                                Hết hạn {dateTime(invite.expiresAt)} ·{" "}
                                {invite.uses}/{invite.maxUses} lượt
                              </small>
                            </span>
                            <div className="tw-card-actions">
                              <Tag tone={invite.active ? "green" : "neutral"}>
                                {invite.active ? "Còn hiệu lực" : "Đã thu hồi"}
                              </Tag>
                              {invite.active && (
                                <button
                                  className="tw-text-button"
                                  disabled={client.busy}
                                  onClick={() =>
                                    confirmation.ask({
                                      title: "Thu hồi mã tham gia?",
                                      description:
                                        "Mã này sẽ không nhận thêm học sinh. Thành viên đã tham gia vẫn ở trong lớp; có thể tạo một mã mới khi cần.",
                                      label: "Xác nhận thu hồi mã",
                                      action: () =>
                                        client.mutate({
                                          action: "invite.revoke",
                                          id: invite.id,
                                          expectedRevision: invite.revision,
                                        }),
                                    })
                                  }
                                >
                                  Thu hồi
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    !code && (
                      <Empty icon={KeyRound} title="Chưa có mã tham gia">
                        Mã mời có hạn dùng và số lượt. Học sinh đăng nhập rồi
                        nhập mã tại /classroom.
                      </Empty>
                    )
                  )}
                </div>
              </Panel>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="tw-toolbar">
            <label className="tw-search">
              <Users size={16} />
              <input
                aria-label="Tìm lớp học"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tên lớp, môn hoặc khối…"
              />
            </label>
            <AddButton onClick={() => setDialog("create")}>
              Tạo lớp học
            </AddButton>
          </div>
          {classes.length ? (
            <div className="tw-grid three">
              {classes.map((item) => (
                <article className="tw-card" key={item.id}>
                  <div className="tw-card-top">
                    <BookOpen size={22} />
                    <Tag tone={item.archived ? "neutral" : "green"}>
                      {item.archived ? "Lưu trữ" : "Đang giảng dạy"}
                    </Tag>
                  </div>
                  <h3>{item.name}</h3>
                  <p>
                    {item.subject} · Khối {item.grade}
                  </p>
                  <p style={{ marginTop: 8 }}>
                    {item.description ||
                      "Không gian để cùng học và theo dõi những tiến bộ thật."}
                  </p>
                  <div className="tw-card-footer">
                    <span>
                      <Users
                        size={12}
                        style={{ display: "inline", marginRight: 5 }}
                      />
                      {
                        data.enrollments.filter(
                          (e) => e.classId === item.id && e.active,
                        ).length
                      }{" "}
                      học sinh
                    </span>
                    <button
                      className="tw-text-button"
                      onClick={() => {
                        setSelected(item.id);
                        setTab("students");
                      }}
                    >
                      Mở lớp <ArrowRight size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Panel>
              <Empty
                icon={GraduationCap}
                title={
                  query
                    ? "Chưa tìm thấy lớp phù hợp"
                    : "Bắt đầu bằng một lớp học"
                }
                action={
                  <Button onClick={() => setDialog("create")}>
                    Tạo lớp đầu tiên <Plus size={15} />
                  </Button>
                }
              >
                Đặt tên lớp, môn và khối. Sau đó mời học sinh, chia nhóm và
                chuẩn bị bài học.
              </Empty>
            </Panel>
          )}
        </>
      )}
      {confirmation.dialog}
      {dialog && (
        <Modal
          title={
            dialog === "create"
              ? "Tạo lớp học"
              : dialog === "edit"
                ? "Chỉnh sửa lớp học"
                : dialog === "invite"
                  ? "Mời học sinh tham gia"
                  : dialog === "group"
                    ? editingGroup
                      ? "Chỉnh sửa nhóm"
                      : "Tạo nhóm học tập"
                    : "Phân công đồng giảng dạy"
          }
          onClose={close}
          disabled={client.busy}
        >
          <ClassForm
            key={dialog + ":" + (editingGroup?.id || "")}
            client={client}
            mode={dialog}
            klass={klass}
            group={editingGroup}
            onClose={close}
            onInvite={(value) => {
              setCode(value);
              setTab("invites");
            }}
          />
        </Modal>
      )}
    </div>
  );
}
function ClassForm({
  client,
  mode,
  klass,
  group,
  onClose,
  onInvite,
}: {
  client: TeachingClient;
  mode: string;
  klass?: TeachingClass;
  group: TeachingGroup | null;
  onClose: () => void;
  onInvite: (value: string) => void;
}) {
  const data = client.data!,
    [name, setName] = useState(group?.name || klass?.name || ""),
    [subject, setSubject] = useState(klass?.subject || ""),
    [grade, setGrade] = useState(klass?.grade || ""),
    [description, setDescription] = useState(klass?.description || ""),
    [archived, setArchived] = useState(klass?.archived || false),
    [days, setDays] = useState(7),
    [max, setMax] = useState(40),
    [memberIds, setMemberIds] = useState<string[]>(group?.memberIds || []),
    [teacherId, setTeacherId] = useState("");
  const save = async () => {
    if (mode === "create")
      await client.mutate({
        action: "class.create",
        name,
        subject,
        grade,
        description,
      });
    else if (mode === "edit" && klass)
      await client.mutate({
        action: "class.update",
        id: klass.id,
        expectedRevision: klass.revision,
        name,
        subject,
        grade,
        description,
        archived,
      });
    else if (mode === "invite" && klass) {
      const result = await client.mutate({
        action: "invite.create",
        classId: klass.id,
        expectedRevision: klass.revision,
        expiresInDays: days,
        maxUses: max,
      });
      if (result.result.inviteCode) onInvite(String(result.result.inviteCode));
    } else if (mode === "group" && klass)
      await client.mutate({
        action: "group.save",
        id: group?.id,
        classId: klass.id,
        expectedRevision: group?.revision || 0,
        name,
        memberIds,
      });
    else if (mode === "team" && klass)
      await client.mutate({
        action: "teacher.assign",
        classId: klass.id,
        userId: teacherId,
        expectedRevision: klass.revision,
      });
    onClose();
  };
  return (
    <form className="tw-form" onSubmit={submit(save)}>
      <fieldset disabled={client.busy} style={{ display: "contents" }}>
        <FormError client={client} />
        {["create", "edit"].includes(mode) ? (
          <>
            <Field label="Tên lớp">
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Toán 9A"
              />
            </Field>
            <div className="tw-form-row">
              <Field label="Môn học">
                <input
                  required
                  maxLength={80}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Toán"
                />
              </Field>
              <Field label="Khối / Trình độ">
                <input
                  required
                  maxLength={40}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="9"
                />
              </Field>
            </div>
            <Field label="Mô tả lớp">
              <textarea
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            {mode === "edit" && (
              <label className="tw-check">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => setArchived(e.target.checked)}
                />
                Lưu trữ lớp (giữ dữ liệu đã tạo)
              </label>
            )}
          </>
        ) : mode === "invite" ? (
          <>
            <p className="tw-note">
              Mã chỉ dành cho học sinh muốn tự tham gia lớp {klass?.name}. Không
              chia sẻ công khai nếu lớp có nội dung riêng.
            </p>
            <div className="tw-form-row">
              <Field label="Hiệu lực (ngày)">
                <input
                  type="number"
                  required
                  min={1}
                  max={30}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </Field>
              <Field label="Số lượt tối đa">
                <input
                  type="number"
                  required
                  min={1}
                  max={200}
                  value={max}
                  onChange={(e) => setMax(Number(e.target.value))}
                />
              </Field>
            </div>
          </>
        ) : mode === "group" ? (
          <>
            <Field label="Tên nhóm">
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div>
              <span className="tw-muted">Học sinh trong nhóm</span>
              {data.enrollments
                .filter((e) => e.classId === klass?.id && e.active)
                .map((member) => (
                  <label
                    className="tw-check"
                    style={{ marginTop: 8 }}
                    key={member.userId}
                  >
                    <input
                      type="checkbox"
                      checked={memberIds.includes(member.userId)}
                      onChange={(e) =>
                        setMemberIds(
                          e.target.checked
                            ? [...memberIds, member.userId]
                            : memberIds.filter((id) => id !== member.userId),
                        )
                      }
                    />
                    {member.name}
                  </label>
                ))}
              {!data.enrollments.some(
                (e) => e.classId === klass?.id && e.active,
              ) && (
                <p className="tw-note">
                  Mời học sinh vào lớp trước khi chọn thành viên.
                </p>
              )}
            </div>
          </>
        ) : (
          <Field
            label="Mã tài khoản giáo viên đã được duyệt"
            hint="Xin giáo viên sao chép mã tài khoản trong Cài đặt của họ. Có thể chọn một giáo viên đã có trong tổ chức."
          >
            <input
              required
              list="tw-approved-teachers"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            />
            <datalist id="tw-approved-teachers">
              {data.members
                .filter(
                  (m) =>
                    m.approvedTeacher &&
                    m.role !== "STUDENT" &&
                    !klass?.teacherIds.includes(m.userId),
                )
                .map((m) => (
                  <option value={m.userId} key={m.userId}>
                    {m.name}
                  </option>
                ))}
            </datalist>
          </Field>
        )}
        <div className="tw-form-footer">
          <ModalCancelButton onClose={onClose}>Hủy</ModalCancelButton>
          <Button busy={client.busy} type="submit">
            {mode === "invite" ? "Tạo mã tham gia" : "Lưu thay đổi"}
            <ArrowRight size={15} />
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
