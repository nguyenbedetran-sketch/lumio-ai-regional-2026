// Loaded ONLY by the isolated auth QA child, never imported by application code.
// Retains actual NextAuth/openid-client validation; replaces network transport only.
const http = require("node:http"),
  https = require("node:https"),
  net = require("node:net"),
  tls = require("node:tls");
if (process.env.LUMIO_AUTH_HTTP_QA !== "isolated-synthetic")
  throw Error("AUTH_QA_PRELOAD_REQUIRES_ISOLATION");
const fixture = new URL(process.env.LUMIO_AUTH_HTTP_FIXTURE_ORIGIN || ""),
  app = new URL(process.env.NEXTAUTH_URL || "");
for (const url of [fixture, app])
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/"
  )
    throw Error("AUTH_QA_LOOPBACK_REQUIRED");
const originalHttp = http.request.bind(http),
  originalFetch = global.fetch;
const relay = new Map([
  [
    "https://accounts.google.com/.well-known/openid-configuration",
    "/oidc/discovery",
  ],
  ["https://oauth2.googleapis.com/token", "/oidc/token"],
  ["https://www.googleapis.com/oauth2/v3/certs", "/oidc/jwks"],
]);
const send = (kind) => {
  try {
    process.send?.({ type: "auth-qa-transport", kind });
  } catch {}
};
const forbidden = () => {
  send("external-blocked");
  throw Error("AUTH_QA_EXTERNAL_NETWORK_FORBIDDEN");
};
function address(value, options) {
  if (value instanceof URL || typeof value === "string") return new URL(value);
  const input = value || options || {},
    host = input.hostname || input.host || "localhost";
  return new URL(
    (input.protocol || "http:") +
      "//" +
      host +
      (input.port ? ":" + input.port : "") +
      (input.path || "/"),
  );
}
function local(url) {
  return url.origin === fixture.origin || url.origin === app.origin;
}
http.request = function (value, options, callback) {
  const url = address(value, options);
  if (!local(url)) return forbidden();
  return originalHttp(value, options, callback);
};
https.request = function (value, options, callback) {
  const url = address(value, options),
    route = relay.get(url.href);
  if (!route) return forbidden();
  send(route.slice(6));
  const opts = typeof options === "function" ? {} : options || {},
    cb = typeof options === "function" ? options : callback;
  return originalHttp(
    new URL(route, fixture),
    { ...opts, protocol: "http:", agent: undefined },
    cb,
  );
};
for (const object of [http, https])
  object.get = function (...args) {
    const req = object.request(...args);
    req.end();
    return req;
  };
global.fetch = function (input, init) {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (!local(url)) return forbidden();
  return originalFetch(input, init);
};
for (const name of ["connect", "createConnection"]) {
  const original = net[name];
  net[name] = function (...args) {
    const first = args[0],
      host =
        typeof first === "object"
          ? first.host || "localhost"
          : typeof args[1] === "string"
            ? args[1]
            : "localhost",
      port = typeof first === "object" ? first.port : first;
    if (
      host !== "127.0.0.1" ||
      ![fixture.port, app.port].includes(String(port))
    )
      return forbidden();
    return original.apply(this, args);
  };
}
tls.connect = forbidden;
