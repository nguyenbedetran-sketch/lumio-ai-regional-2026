import { errorResponse, json } from "./access";
import {
  reportServerError,
  type ServerErrorContext,
} from "./error-diagnostics";

export function authFailureResponse(
  method: string,
  action: string,
  error: unknown,
): Response {
  const url = "/?error=Configuration",
    context: ServerErrorContext = {
      boundary: "auth",
      method,
      route: "/api/auth/[...nextauth]",
    };
  // NextAuth's client POSTs these actions and parses JSON even on a failed HTTP
  // response. Redirecting its fetch to a full HTML page causes CLIENT_FETCH_ERROR.
  if (method === "POST" && ["signin", "signout"].includes(action)) {
    const requestId = crypto.randomUUID();
    reportServerError({
      requestId,
      code: "AUTHENTICATION_UNAVAILABLE",
      status: 503,
      context,
    });
    return json(
      {
        url,
        error: "AUTHENTICATION_UNAVAILABLE",
        requestId,
      },
      503,
    );
  }
  if (["callback", "signin", "signout", "error"].includes(action)) {
    const requestId = crypto.randomUUID();
    reportServerError({
      requestId,
      code: "AUTHENTICATION_UNAVAILABLE",
      status: 303,
      context,
    });
    return new Response(null, {
      status: 303,
      headers: {
        Location: url,
        "Cache-Control": "no-store",
        "X-Lumio-Request-Id": requestId,
      },
    });
  }
  return errorResponse(error, context);
}
