import { timingSafeEqual } from "node:crypto";
import { isDesktopPreview } from "./desktop-mode";

/** A per-launch nonce distinguishes the bundled server from another occupied port. */
export function desktopHealth(request: Request): Response {
  const expected = process.env.LUMIO_DESKTOP_NONCE || "";
  const supplied = request.headers.get("x-lumio-desktop-token") || "";
  if (
    !isDesktopPreview() ||
    !/^[a-f0-9]{64}$/.test(expected) ||
    !/^[a-f0-9]{64}$/.test(supplied) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  return Response.json(
    { desktop: true, version: "0.1.0", nonce: expected },
    { headers: { "Cache-Control": "no-store" } },
  );
}
