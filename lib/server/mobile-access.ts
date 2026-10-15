import { getStore } from "./store";
import { PlatformError } from "./types";

export function assertNativeRequest(req: Request) {
  // Browser cookies never authorize a native exchange. Browser flows use their own CSRF-protected route.
  if (
    req.headers.has("origin") ||
    req.headers.has("cookie") ||
    req.headers.has("sec-fetch-site")
  )
    throw new PlatformError("INVALID_ORIGIN", 403);
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.NEXTAUTH_URL?.startsWith("https://")
  )
    throw new PlatformError("HTTPS_REQUIRED", 503);
}
export function requireMobile(req: Request) {
  assertNativeRequest(req);
  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))
    throw new PlatformError("SIGN_IN_REQUIRED", 401);
  return getStore().mobileIdentity(authorization.slice(7));
}
