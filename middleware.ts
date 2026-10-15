import { NextRequest, NextResponse } from "next/server";
import { demoAPIResponse, isPublicDemo } from "./lib/server/public-demo";

export function middleware(request: NextRequest) {
  if (!isPublicDemo()) return NextResponse.next();
  if (
    request.nextUrl.pathname === "/admin" ||
    request.nextUrl.pathname.startsWith("/admin/")
  )
    return NextResponse.redirect(new URL("/?publicDemo=1", request.url));
  return (
    demoAPIResponse(request.nextUrl.pathname, request.method) ||
    NextResponse.next()
  );
}
export const config = { matcher: ["/api/:path*", "/admin/:path*"] };
