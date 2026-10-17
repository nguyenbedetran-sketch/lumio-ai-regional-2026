/** Server diagnostics deliberately accept no exception, Request, body or header. */
const serverCodes = new Set([
  "PLATFORM_UNAVAILABLE",
  "AUTHENTICATION_UNAVAILABLE",
  "DATABASE_CONFIGURATION_INVALID",
  "DATABASE_UNAVAILABLE",
  "DATABASE_TIMEOUT",
  "DATABASE_WRITE_OUTCOME_UNKNOWN",
  "DATABASE_CONNECTION_POISONED",
  "DATABASE_PROTOCOL_ERROR",
  "DATABASE_RESPONSE_TOO_LARGE",
  "PERSISTENT_DATABASE_REQUIRED",
  "INVALID_SERVER_ORIGIN",
  "HTTPS_REQUIRED",
  "PRICE_NOT_CONFIGURED",
  "PAYMENT_PROVIDER_NOT_CONFIGURED",
  "PROVIDER_NOT_CONFIGURED",
  "INVALID_JOB_RESULT",
  "INVALID_EMBEDDING",
  "AI_ATTEMPT_CAPACITY",
  "LINKING_DISABLED",
]);

export function safeServerErrorCode(code: unknown): string {
  return typeof code === "string" && serverCodes.has(code)
    ? code
    : "PLATFORM_UNAVAILABLE";
}

export type ServerErrorContext = {
  boundary?: "api" | "auth";
  method?: string;
  route?: "/api/auth/[...nextauth]";
};
type DiagnosticInput = {
  requestId: string;
  code: unknown;
  status: number;
  context?: ServerErrorContext;
};
const methods = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
const windowMs = 60_000,
  limit = 30;

/** A fixed-size process-local budget; no database, file, queue or exception storage. */
export function createServerErrorReporter(
  write: (line: string) => void = (line) => console.error(line),
  now: () => number = () => performance.now(),
) {
  let started: number | undefined,
    emitted = 0,
    limitReported = false;
  return (input: DiagnosticInput): boolean => {
    try {
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          input.requestId,
        )
      )
        return false;
      const context = input.context,
        boundary = context?.boundary === "auth" ? "auth" : "api",
        code = safeServerErrorCode(input.code),
        authRedirect =
          input.status === 303 &&
          boundary === "auth" &&
          code === "AUTHENTICATION_UNAVAILABLE";
      if (
        !Number.isInteger(input.status) ||
        (!(input.status >= 500 && input.status <= 599) && !authRedirect)
      )
        return false;
      const time = now();
      if (!Number.isFinite(time)) return false;
      if (
        started === undefined ||
        time < started ||
        time - started >= windowMs
      ) {
        started = time;
        emitted = 0;
        limitReported = false;
      }
      if (emitted >= limit) {
        if (!limitReported) {
          limitReported = true;
          write(
            '[lumio] {"event":"server_error_limit_reached","limit":30,"windowMs":60000}',
          );
        }
        return false;
      }
      // Consume a failed writer's budget too; logging must never retry a request.
      emitted++;
      write(
        "[lumio] " +
          JSON.stringify({
            event: "server_error",
            requestId: input.requestId,
            code,
            httpStatus: input.status,
            boundary,
            ...(typeof context?.method === "string" &&
            methods.has(context.method)
              ? { method: context.method }
              : {}),
            ...(context?.route === "/api/auth/[...nextauth]"
              ? { route: "/api/auth/[...nextauth]" }
              : {}),
          }),
      );
      return true;
    } catch {
      // Host log failures must not replace the original JSON/redirect response.
      return false;
    }
  };
}

export const reportServerError = createServerErrorReporter();
