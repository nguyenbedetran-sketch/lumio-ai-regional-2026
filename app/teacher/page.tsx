import { requireActor } from "../../lib/server/access";
import { providerStatus } from "../../lib/lumio/auth";
import { pageMetadata } from "../../lib/metadata";
import { TeacherPortal } from "../../components/teachers/portal";
import { TeacherWorkspace } from "../../components/teaching/workspace";
import { getStore } from "../../lib/server/store";
import "./teacher.css";
import "./workspace.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Dành cho giáo viên",
  description:
    "Đăng ký giáo viên, quản lý lớp, soạn học liệu và công bố kết quả trong không gian giảng dạy riêng của Lumio AI.",
  path: "/teacher",
  privatePage: true,
});
export default async function TeacherPage() {
  let account: { key: string; name: string } | null = null;
  try {
    const actor = await requireActor();
    account = { key: actor.user.storageKey, name: actor.user.name };
    if (
      actor.user.role === "SUPER_ADMIN" ||
      getStore().isApprovedTeacher(actor.user.id, actor.user.sessionVersion)
    )
      return (
        <TeacherWorkspace
          key={actor.user.storageKey}
          account={{ ...account, id: actor.user.id }}
        />
      );
  } catch {
    // No application or private contact information is embedded for guests.
  }
  const { google, facebook } = providerStatus();
  return <TeacherPortal account={account} providers={{ google, facebook }} />;
}
