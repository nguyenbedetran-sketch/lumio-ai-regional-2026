import { errorResponse, json } from "./access";

export function authFailureResponse(
  method: string,
  action: string,
  error: unknown,
): Response {
  const url = "/?error=Configuration";
  // NextAuth's client POSTs these actions and parses JSON even on a failed HTTP
  // response. Redirecting its fetch to a full HTML page causes CLIENT_FETCH_ERROR.
  if (method === "POST" && ["signin", "signout"].includes(action))
    return json(
      {
        url,
        error: "AUTHENTICATION_UNAVAILABLE",
        requestId: crypto.randomUUID(),
      },
      503,
    );
  if (["callback", "signin", "signout", "error"].includes(action))
    return new Response(null, {
      status: 303,
      headers: { Location: url, "Cache-Control": "no-store" },
    });
  return errorResponse(error);
}
