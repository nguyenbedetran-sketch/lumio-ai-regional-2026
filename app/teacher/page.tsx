import { requireActor } from "../../lib/server/access";
import { providerStatus } from "../../lib/lumio/auth";
import { pageMetadata } from "../../lib/metadata";
import { TeacherPortal } from "../../components/teachers/portal";
import "./teacher.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Dành cho giáo viên",
  description:
    "Đăng ký hồ sơ giảng dạy và theo dõi kết quả duyệt của quản trị viên Lumio AI.",
  path: "/teacher",
  privatePage: true,
});
export default async function TeacherPage() {
  let account: { key: string; name: string } | null = null;
  try {
    const actor = await requireActor();
    account = { key: actor.user.storageKey, name: actor.user.name };
  } catch {
    // No application or private contact information is embedded for guests.
  }
  const { google, facebook } = providerStatus();
  return <TeacherPortal account={account} providers={{ google, facebook }} />;
}
