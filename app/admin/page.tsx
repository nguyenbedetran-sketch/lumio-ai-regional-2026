import { requireAdmin } from "../../lib/server/access";
import { adminSnapshot } from "../../lib/server/admin-snapshot";
import { PlatformError } from "../../lib/server/types";
import { AdminConsole, AdminGate } from "../../components/admin/console";
import "./admin.css";
import { pageMetadata } from "../../lib/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Admin Console",
  description:
    "Khu vực quản trị Lumio AI yêu cầu tài khoản được cấp quyền và phiên xác thực gần đây.",
  path: "/admin",
  privatePage: true,
});
export default async function AdminPage() {
  try {
    return <AdminConsole initial={adminSnapshot(await requireAdmin())} />;
  } catch (error) {
    return (
      <AdminGate
        code={
          error instanceof PlatformError ? error.code : "PLATFORM_UNAVAILABLE"
        }
      />
    );
  }
}
