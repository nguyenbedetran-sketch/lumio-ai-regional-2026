import { PlatformError } from "./types";

const localHosts = new Set(["127.0.0.1:3000", "localhost:3000"]);

/** The preview HTTP server must strip all incoming forwarded headers first.
 * Localhost and 127.0.0.1 support separate provider callbacks during development;
 * production always uses the explicitly configured canonical origin.
 */
export function requestOrigin(req: Pick<Request, "url" | "headers">): string {
  if (
    process.env.NODE_ENV === "development" &&
    process.env.AUTH_TRUST_HOST === "true"
  ) {
    const host =
      req.headers.get("host")?.toLowerCase() ||
      new URL(req.url).host.toLowerCase();
    if (!localHosts.has(host) || new URL(req.url).protocol !== "http:")
      throw new PlatformError("INVALID_ORIGIN", 403);
    return `http://${host}`;
  }
  try {
    if (!process.env.NEXTAUTH_URL) throw new Error();
    const url = new URL(process.env.NEXTAUTH_URL);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new PlatformError("INVALID_SERVER_ORIGIN", 503);
  }
}
