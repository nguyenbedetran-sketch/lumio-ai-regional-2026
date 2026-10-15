import { getServerSession } from "next-auth";
import { authOptions, providerStatus } from "../../../lib/lumio/auth";
import {
  getUser,
  listIdentities,
  isFeatureEnabled,
} from "../../../lib/server/store";
import { json, errorResponse } from "../../../lib/server/access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const session = (await getServerSession(authOptions())) as {
      userId?: string;
      sessionVersion?: number;
      authenticatedAt?: number;
    } | null;
    const user = session?.userId ? getUser(session.userId) : null;
    if (
      !user ||
      user.disabled ||
      user.sessionVersion !== session?.sessionVersion
    )
      return json({
        authenticated: false,
        isAdmin: false,
        providers: providerStatus(),
      });
    return json({
      authenticated: true,
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: ["ADMIN", "SUPER_ADMIN", "DEV"].includes(user.role),
      recentLogin: Date.now() - (session.authenticatedAt || 0) < 3600000,
      identities: listIdentities(user.id),
      linkingEnabled: isFeatureEnabled("accounts.linking"),
      providers: providerStatus(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
