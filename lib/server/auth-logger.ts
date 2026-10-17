import { reportServerError } from "./error-diagnostics";

// NextAuth metadata can contain callback query text, profiles or provider errors.
// These are framework events: the eventual HTTP response status is not known here.
function record(
  code: "AUTHENTICATION_UNAVAILABLE" | "AUTH_CONFIGURATION_WARNING",
) {
  try {
    reportServerError({
      requestId: crypto.randomUUID(),
      code,
      context: { boundary: "auth", route: "/api/auth/[...nextauth]" },
    });
  } catch {
    /* Diagnostics must not change authentication behavior. */
  }
}
export const authLogger = {
  error() {
    record("AUTHENTICATION_UNAVAILABLE");
  },
  warn() {
    record("AUTH_CONFIGURATION_WARNING");
  },
  debug() {
    /* Profiles, tokens and callback details are never diagnostic output. */
  },
};
