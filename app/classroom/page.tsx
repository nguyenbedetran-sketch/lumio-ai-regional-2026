import { requireActor } from "../../lib/server/access";
import { providerStatus } from "../../lib/lumio/auth";
import { pageMetadata } from "../../lib/metadata";
import { StudentClassroom } from "../../components/teaching/student";
import "../teacher/workspace.css";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Góc học sinh",
  description:
    "Tham gia lớp, nhận bài và xem kết quả giáo viên đã công bố trong Lumio.",
  path: "/classroom",
  privatePage: true,
});
export default async function ClassroomPage() {
  let account: { id: string; key: string; name: string } | null = null;
  try {
    const { user } = await requireActor();
    account = { id: user.id, key: user.storageKey, name: user.name };
  } catch {}
  const { google, facebook } = providerStatus();
  return (
    <StudentClassroom account={account} providers={{ google, facebook }} />
  );
}
