// Real compiled Next/NextAuth HTTP, cookies, CSRF/state/PKCE/JWT and isolated SQLite.
// Authored loopback OIDC transport is not Google service/browser acceptance.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http"),
  net = require("node:net"),
  crypto = require("node:crypto"),
  { spawn, execFileSync } = require("node:child_process"),
  { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  output = path.join(root, "docs/next/reports/compiled-auth-http-report.json"),
  checks = [],
  report = {
    status: "RUNNING",
    checkedAt: new Date().toISOString(),
    checks,
    scope:
      "Actual compiled NextAuth HTTP/cookie/CSRF/state/PKCE/JWT and canonical isolated SQLite. Only outbound Google discovery/token/JWKS transport is redirected in a child-only preload to authored loopback OIDC responses signed with an ephemeral test RSA key. Not genuine Google/OAuth-consent/browser/TLS/real-account/provider acceptance.",
    genuineGoogleAcceptance: "PENDING_SEPARATE_PUBLIC_GATE",
    realProviderCalls: 0,
  };
let child,
  fixture,
  db,
  scratch,
  origin,
  activeCheck = "startup",
  log = "",
  userSequence = 0;
const transport = { discovery: 0, token: 0, jwks: 0, blocked: 0 },
  oidc = { discovery: 0, token: 0, jwks: 0 },
  codes = new Map();
const clientId = "synthetic-auth-http-client.invalid",
  clientSecret = "synthetic-not-a-provider-credential",
  marker = "AUTH_HTTP_PRIVATE_DESCRIPTION_SENTINEL";
const proof = (relative) => ({
  path: relative,
  sha256: crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, relative)))
    .digest("hex"),
});
const save = () => {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
};
async function check(name, fn) {
  activeCheck = name;
  await fn();
  checks.push({ name, status: "PASS" });
  console.log("PASS " + name);
  save();
}
async function freePort() {
  const server = net.createServer();
  await new Promise((r, j) =>
    server.once("error", j).listen(0, "127.0.0.1", r),
  );
  const port = server.address().port;
  await new Promise((r) => server.close(r));
  return port;
}
class CookieJar {
  constructor(other) {
    this.values = new Map(other?.values);
  }
  header() {
    return [...this.values].map(([k, v]) => k + "=" + v).join("; ");
  }
  apply(response) {
    const observed = [];
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...parts] = line.split(";"),
        at = pair.indexOf("="),
        name = pair.slice(0, at),
        value = pair.slice(at + 1),
        attrs = parts.map((p) => p.trim());
      const expired = attrs.some((p) => /^max-age=0$/i.test(p)) || value === "";
      if (expired) this.values.delete(name);
      else this.values.set(name, value);
      observed.push({
        name,
        expired,
        httpOnly: attrs.some((p) => /^httponly$/i.test(p)),
        sameSiteLax: attrs.some((p) => /^samesite=lax$/i.test(p)),
        rootPath: attrs.includes("Path=/"),
        secure: attrs.some((p) => /^secure$/i.test(p)),
      });
    }
    return observed;
  }
  hasSession() {
    return [...this.values.keys()].some((k) =>
      k.startsWith("next-auth.session-token"),
    );
  }
}
async function request(jar, route, options = {}) {
  const url = new URL(route, origin);
  assert.equal(url.origin, origin, "AUTH_HTTP_ONLY_LOCAL_APP");
  const response = await fetch(url, {
    ...options,
    redirect: "manual",
    headers: { ...(jar ? { cookie: jar.header() } : {}), ...options.headers },
    signal: AbortSignal.timeout(15000),
  });
  const cookies = jar?.apply(response) || [],
    text = await response.text();
  let body;
  if (response.headers.get("content-type")?.includes("application/json")) {
    try {
      body = JSON.parse(text);
    } catch {
      throw Error("AUTH_HTTP_INVALID_JSON");
    }
  }
  return { response, body, cookies, text };
}
async function csrf(jar) {
  const r = await request(jar, "/api/auth/csrf");
  assert.equal(r.response.status, 200);
  assert.match(r.body.csrfToken, /^[0-9a-f]{64}$/);
  assert.match(r.response.headers.get("cache-control"), /no-store/);
  return r;
}
const form = (values) => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", origin },
  body: new URLSearchParams(values),
});
async function start(jar, provider = "google", callbackUrl = origin + "/") {
  const token = (await csrf(jar)).body.csrfToken,
    r = await request(
      jar,
      "/api/auth/signin/" + provider,
      form({ csrfToken: token, callbackUrl, json: "true" }),
    );
  assert.equal(r.response.status, 200);
  assert.equal(typeof r.body?.url, "string");
  const auth = new URL(r.body.url);
  assert.equal(
    auth.hostname,
    provider === "google" ? "accounts.google.com" : "www.facebook.com",
  );
  assert(auth.searchParams.get("state"));
  if (provider === "google") {
    assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
    assert(auth.searchParams.get("code_challenge"));
  }
  return { auth, r };
}
function register(auth, options = {}) {
  const code = crypto.randomBytes(24).toString("hex");
  codes.set(code, {
    sub: options.sub || "synthetic-http-user-" + ++userSequence,
    challenge: auth.searchParams.get("code_challenge"),
    mode: options.mode || "valid",
  });
  return code;
}
async function callback(jar, auth, options = {}) {
  const code = register(auth, options),
    params = new URLSearchParams({
      code,
      state:
        options.state === undefined
          ? auth.searchParams.get("state")
          : options.state,
    });
  return request(jar, "/api/auth/callback/google?" + params);
}
async function account(jar) {
  return request(jar, "/api/account");
}
const users = () => Number(db.prepare("SELECT count(*) n FROM users").get().n);
function authFailure(r) {
  assert.equal(r.response.status, 302);
  const url = new URL(r.response.headers.get("location"), origin);
  assert.equal(url.origin, origin);
  assert.match(url.pathname, /^\/api\/auth\/(error|signin)$/);
  assert(url.searchParams.get("error"));
  assert.equal(
    r.cookies.filter(
      (c) => c.name.startsWith("next-auth.session-token") && !c.expired,
    ).length,
    0,
  );
}
async function login(sub) {
  const jar = new CookieJar(),
    { auth } = await start(jar),
    r = await callback(jar, auth, { sub });
  assert.equal(r.response.status, 302);
  assert.equal(
    new URL(r.response.headers.get("location"), origin).origin,
    origin,
  );
  assert(jar.hasSession());
  const a = await account(jar);
  assert.equal(a.body.authenticated, true);
  return { jar, user: a.body, r };
}
async function launchFixture() {
  const pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }),
    wrong = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }),
    jwk = {
      ...pair.publicKey.export({ format: "jwk" }),
      kid: "synthetic-auth-http",
      use: "sig",
      alg: "RS256",
    };
  const jwt = (entry) => {
    const now = Math.floor(Date.now() / 1000),
      claims = {
        iss:
          entry.mode === "issuer"
            ? "https://invalid-issuer.example.test"
            : "https://accounts.google.com",
        aud: entry.mode === "audience" ? "wrong-client.invalid" : clientId,
        sub: entry.sub,
        name: "Synthetic auth HTTP learner",
        email: entry.sub + "@example.test",
        email_verified: true,
        iat: now,
        exp: now + 300,
      };
    const unsigned = [{ alg: "RS256", kid: jwk.kid, typ: "JWT" }, claims]
      .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
      .join(".");
    return (
      unsigned +
      "." +
      crypto
        .sign(
          "RSA-SHA256",
          Buffer.from(unsigned),
          entry.mode === "signature" ? wrong.privateKey : pair.privateKey,
        )
        .toString("base64url")
    );
  };
  fixture = http.createServer(async (req, res) => {
    try {
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/oidc/discovery") {
        oidc.discovery++;
        res.end(
          JSON.stringify({
            issuer: "https://accounts.google.com",
            authorization_endpoint:
              "https://accounts.google.com/o/oauth2/v2/auth",
            token_endpoint: "https://oauth2.googleapis.com/token",
            jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
            response_types_supported: ["code"],
            subject_types_supported: ["public"],
            id_token_signing_alg_values_supported: ["RS256"],
            token_endpoint_auth_methods_supported: [
              "client_secret_basic",
              "client_secret_post",
            ],
            code_challenge_methods_supported: ["S256"],
          }),
        );
        return;
      }
      if (req.url === "/oidc/jwks") {
        oidc.jwks++;
        res.end(JSON.stringify({ keys: [jwk] }));
        return;
      }
      if (req.url === "/oidc/token" && req.method === "POST") {
        oidc.token++;
        let raw = "";
        for await (const part of req) {
          raw += part;
          if (raw.length > 8192) throw Error("AUTH_QA_TOKEN_BODY_LIMIT");
        }
        const params = new URLSearchParams(raw),
          entry = codes.get(params.get("code"));
        if (
          !entry ||
          params.get("grant_type") !== "authorization_code" ||
          params.get("redirect_uri") !== origin + "/api/auth/callback/google" ||
          crypto
            .createHash("sha256")
            .update(params.get("code_verifier") || "")
            .digest("base64url") !== entry.challenge ||
          req.headers.authorization !==
            "Basic " +
              Buffer.from(clientId + ":" + clientSecret).toString("base64")
        ) {
          res.statusCode = 400;
          res.end('{"error":"invalid_grant"}');
          return;
        }
        codes.delete(params.get("code"));
        if (entry.mode === "token-failure") {
          res.statusCode = 503;
          res.end('{"error":"temporarily_unavailable"}');
          return;
        }
        res.end(
          JSON.stringify({
            access_token: "synthetic-access-token-not-real",
            token_type: "Bearer",
            expires_in: 300,
            id_token: jwt(entry),
          }),
        );
        return;
      }
      res.statusCode = 404;
      res.end('{"error":"fixture_not_found"}');
    } catch {
      res.statusCode = 500;
      res.end('{"error":"synthetic_fixture_error"}');
    }
  });
  await new Promise((r, j) =>
    fixture.once("error", j).listen(0, "127.0.0.1", r),
  );
  return "http://127.0.0.1:" + fixture.address().port;
}
async function main() {
  assert(
    fs.existsSync(path.join(root, ".next/BUILD_ID")),
    "AUTH_HTTP_BUILD_REQUIRED",
  );
  assert(
    ![".env", ".env.local", ".env.production", ".env.production.local"].some(
      (f) => fs.existsSync(path.join(root, f)),
    ),
    "AUTH_HTTP_CLEAN_SOURCE_REQUIRED",
  );
  report.sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  report.sourceScope =
    "Source hashes and compiled artifact hash recorded separately; base HEAD is not a clean/released-tree assertion. Rebuild after auth runtime changes.";
  report.proof = [
    "scripts/test-v10-auth-production.cjs",
    "scripts/fixtures/v10-auth-transport.cjs",
    "lib/lumio/auth.ts",
    "lib/server/auth-logger.ts",
    "lib/server/auth-errors.ts",
    "lib/server/error-diagnostics.ts",
    "app/api/auth/[...nextauth]/route.ts",
    ".next/BUILD_ID",
    ".next/server/app/api/auth/[...nextauth]/route.js",
  ].map(proof);
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-auth-compiled-"));
  origin = "http://127.0.0.1:" + (await freePort());
  const fixtureOrigin = await launchFixture(),
    env = {};
  for (const k of [
    "SystemRoot",
    "SYSTEMROOT",
    "WINDIR",
    "PATH",
    "Path",
    "TEMP",
    "TMP",
    "COMSPEC",
    "ComSpec",
    "PATHEXT",
  ])
    if (process.env[k]) env[k] = process.env[k];
  Object.assign(env, {
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXTAUTH_URL: origin,
    NEXTAUTH_SECRET: crypto.randomBytes(48).toString("hex"),
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_SECRET: clientSecret,
    FACEBOOK_CLIENT_ID: "synthetic-facebook.invalid",
    FACEBOOK_CLIENT_SECRET: "synthetic-not-real",
    LUMIO_DB_PATH: path.join(scratch, "isolated.sqlite"),
    LUMIO_ALLOW_LOCAL_DB_PRODUCTION: "true",
    LUMIO_AI_ENABLED: "false",
    LUMIO_BACKGROUND_JOBS_DISABLED: "true",
    LUMIO_AUTH_HTTP_QA: "isolated-synthetic",
    LUMIO_AUTH_HTTP_FIXTURE_ORIGIN: fixtureOrigin,
  });
  child = spawn(
    process.execPath,
    [
      "--require",
      path.join(root, "scripts/fixtures/v10-auth-transport.cjs"),
      require.resolve("next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      new URL(origin).port,
    ],
    {
      cwd: root,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  child.stdout.on("data", (b) => {
    log = (log + b).slice(-128000);
  });
  child.stderr.on("data", (b) => {
    log = (log + b).slice(-128000);
  });
  child.on("message", (value) => {
    if (value?.type === "auth-qa-transport") {
      if (value.kind === "external-blocked") transport.blocked++;
      else if (Object.hasOwn(transport, value.kind)) transport[value.kind]++;
    }
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    assert.equal(child.exitCode, null, "AUTH_HTTP_SERVER_EARLY_EXIT");
    try {
      const r = await fetch(origin + "/api/health", {
        signal: AbortSignal.timeout(1500),
      });
      if (r.status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert(ready, "AUTH_HTTP_READINESS_TIMEOUT");
  db = new DatabaseSync(env.LUMIO_DB_PATH);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
  await check(
    "Real CSRF cookie is HttpOnly/SameSite=Lax/root-scoped and double-submit token is stable",
    async () => {
      const jar = new CookieJar(),
        a = await csrf(jar),
        b = await csrf(jar),
        c = a.cookies.find((c) => c.name === "next-auth.csrf-token");
      assert(c && c.httpOnly && c.sameSiteLax && c.rootPath);
      assert.equal(a.body.csrfToken, b.body.csrfToken);
      assert.equal(users(), 0);
    },
  );
  await check(
    "Missing/wrong/cookie-unbound sign-in CSRF cannot start OAuth or create an account",
    async () => {
      const before = oidc.discovery;
      for (const mode of ["missing", "wrong", "unbound"]) {
        const jar = new CookieJar(),
          token = (await csrf(jar)).body.csrfToken;
        if (mode === "unbound") jar.values.delete("next-auth.csrf-token");
        const r = await request(
          jar,
          "/api/auth/signin/google",
          form({
            ...(mode === "missing"
              ? {}
              : { csrfToken: mode === "wrong" ? "wrong" : token }),
            json: "true",
            callbackUrl: origin,
          }),
        );
        assert.equal(r.response.status, 200);
        assert.equal(new URL(r.body.url).searchParams.get("csrf"), "true");
        assert(!jar.values.has("next-auth.state"));
        assert(!jar.hasSession());
      }
      assert.equal(oidc.discovery, before);
      assert.equal(users(), 0);
    },
  );
  await check(
    "Actual signed OIDC callback creates one canonical learner and protected session; repeated login preserves its id",
    async () => {
      const first = await login("synthetic-repeat"),
        second = await login("synthetic-repeat");
      assert.equal(first.user.id, second.user.id);
      assert.equal(users(), 1);
      assert.equal(first.user.isAdmin, false);
      const c = first.r.cookies.find((c) =>
        c.name.startsWith("next-auth.session-token"),
      );
      assert(c.httpOnly && c.sameSiteLax && c.rootPath);
      assert(!first.jar.values.has("next-auth.state"));
      assert(!first.jar.values.has("next-auth.pkce.code_verifier"));
      const session = await request(first.jar, "/api/auth/session");
      assert.equal(session.body.userId, first.user.id);
      assert.equal(session.body.sessionVersion, 1);
    },
  );
  await check(
    "Missing/tampered state and missing PKCE fail before token exchange and create no identity",
    async () => {
      for (const mode of ["missing-state", "mismatch-state", "missing-pkce"]) {
        const jar = new CookieJar(),
          { auth } = await start(jar),
          before = oidc.token,
          count = users();
        if (mode === "missing-state") jar.values.delete("next-auth.state");
        if (mode === "missing-pkce")
          jar.values.delete("next-auth.pkce.code_verifier");
        const r = await callback(
          jar,
          auth,
          mode === "mismatch-state" ? { state: "synthetic-wrong-state" } : {},
        );
        authFailure(r);
        assert.equal(oidc.token, before);
        assert.equal(users(), count);
        assert(!jar.hasSession());
      }
    },
  );
  await check(
    "Provider token outage, invalid signature, issuer and audience cannot create a session or canonical user",
    async () => {
      for (const mode of ["token-failure", "signature", "issuer", "audience"]) {
        const jar = new CookieJar(),
          { auth } = await start(jar),
          count = users(),
          r = await callback(jar, auth, { mode });
        authFailure(r);
        assert.equal(users(), count);
        assert(!jar.hasSession());
        assert.equal((await account(jar)).body.authenticated, false);
      }
    },
  );
  await check(
    "Missing/wrong signout CSRF preserves the session; matching CSRF expires it and prevents open redirect",
    async () => {
      const { jar, user } = await login("synthetic-signout");
      for (const token of [undefined, "wrong"]) {
        const r = await request(
          jar,
          "/api/auth/signout",
          form({ ...(token ? { csrfToken: token } : {}), json: "true" }),
        );
        assert.equal(r.response.status, 200);
        assert.equal(new URL(r.body.url).searchParams.get("csrf"), "true");
        assert.equal((await account(jar)).body.id, user.id);
      }
      const token = (await csrf(jar)).body.csrfToken,
        r = await request(
          jar,
          "/api/auth/signout",
          form({
            csrfToken: token,
            callbackUrl: "https://external.example.test/collect",
            json: "true",
          }),
        );
      assert.equal(r.response.status, 200);
      assert.equal(new URL(r.body.url).origin, origin);
      assert(
        r.cookies.some(
          (c) => c.name.startsWith("next-auth.session-token") && c.expired,
        ),
      );
      assert(!jar.hasSession());
      assert.equal((await account(jar)).body.authenticated, false);
    },
  );
  await check(
    "Provider cancellation clears the account-link cookie without linking a provider or exposing callback text",
    async () => {
      const { jar, user } = await login("synthetic-link-cancel"),
        before = Number(
          db.prepare("SELECT count(*) n FROM identities").get().n,
        );
      const link = await request(jar, "/api/account/link", {
        method: "POST",
        headers: {
          origin,
          "sec-fetch-site": "same-origin",
          "content-type": "application/json",
          "x-lumio-user": user.id,
        },
        body: JSON.stringify({ provider: "facebook" }),
      });
      assert.equal(link.response.status, 200);
      assert(jar.values.has("lumio-link-intent"));
      const r = await request(
        jar,
        "/api/auth/callback/facebook?error=access_denied&error_description=" +
          marker,
      );
      authFailure(r);
      assert(
        r.cookies.some((c) => c.name === "lumio-link-intent" && c.expired),
      );
      assert(!jar.values.has("lumio-link-intent"));
      assert(!r.text.includes(marker));
      assert(!r.response.headers.get("location").includes(marker));
      assert.equal(
        Number(db.prepare("SELECT count(*) n FROM identities").get().n),
        before,
      );
      // The canceled cookie is gone; the hashed unconsumed intent follows its normal expiry policy.
    },
  );
  await check(
    "Canonical revocation invalidates the actual JWT and pending link callback; fresh authentication recovers without changing identity",
    async () => {
      const { jar, user } = await login("synthetic-revoke"),
        link = await request(jar, "/api/account/link", {
          method: "POST",
          headers: {
            origin,
            "content-type": "application/json",
            "x-lumio-user": user.id,
          },
          body: JSON.stringify({ provider: "facebook" }),
        });
      assert.equal(link.response.status, 200);
      const { auth } = await start(jar),
        count = users();
      db.prepare(
        "UPDATE users SET session_version=session_version+1 WHERE id=?",
      ).run(user.id);
      const r = await callback(jar, auth, {
        sub: "synthetic-revoked-link-new-identity",
      });
      authFailure(r);
      assert.equal(users(), count);
      assert(!jar.values.has("lumio-link-intent"));
      const session = await request(jar, "/api/auth/session");
      assert.equal(session.body.userId, undefined);
      assert.equal((await account(jar)).body.authenticated, false);
      const fresh = await login("synthetic-revoke");
      assert.equal(fresh.user.id, user.id);
      assert.equal(
        (await request(fresh.jar, "/api/auth/session")).body.sessionVersion,
        2,
      );
    },
  );
  await check(
    "Actual SQLite users-table interruption stays a JSON session failure, clears link flow and recovers after schema restoration",
    async () => {
      const { jar, user } = await login("synthetic-db-interruption"),
        { auth } = await start(jar),
        count = users();
      const link = await request(jar, "/api/account/link", {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          "x-lumio-user": user.id,
        },
        body: JSON.stringify({ provider: "facebook" }),
      });
      assert.equal(link.response.status, 200);
      db.exec("ALTER TABLE users RENAME TO auth_qa_unavailable_users");
      try {
        const r = await request(new CookieJar(jar), "/api/auth/session");
        assert.equal(r.response.status, 200);
        assert(r.body && !r.body.userId);
        assert(!r.text.includes("auth_qa_unavailable_users"));
        const bad = await callback(jar, auth);
        assert.equal(bad.response.status, 303);
        assert.equal(
          bad.response.headers.get("location"),
          "/?error=Configuration",
        );
        assert(
          bad.cookies.some((c) => c.name === "lumio-link-intent" && c.expired),
        );
        assert(!bad.text.includes("SELECT"));
      } finally {
        db.exec("ALTER TABLE auth_qa_unavailable_users RENAME TO users");
      }
      assert.equal(users(), count);
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
      const recovered = await login("synthetic-db-interruption");
      assert.equal(recovered.user.id, user.id);
    },
  );
  await check(
    "Actual NextAuth failure logging does not retain callback error descriptions",
    async () => {
      assert(
        !log.includes(marker),
        "AUTH_HTTP_PRIVATE_CALLBACK_DESCRIPTION_LOGGED",
      );
    },
  );
  assert.equal(
    transport.blocked,
    0,
    "AUTH_HTTP_UNEXPECTED_EXTERNAL_NETWORK_ATTEMPT",
  );
  assert(oidc.token > 0 && oidc.jwks > 0 && oidc.discovery > 0);
  report.status = "PASS";
  report.passed = checks.length;
  report.completedAt = new Date().toISOString();
  report.transport = {
    ...transport,
    authoredLoopback: oidc,
    realProviderCalls: 0,
  };
  report.limits = [
    "No genuine Google/Facebook network, consent screen, deployed HTTPS/Secure-cookie browser behavior, physical device or real account was tested.",
    "Database interruption is an isolated synthetic users-table rename/restore, not Turso failover or production disaster recovery.",
    "Canceled link cookie cleanup is verified; its unconsumed hashed intent keeps the existing expiry policy.",
  ];
  save();
  console.log(
    JSON.stringify({
      status: report.status,
      checks: checks.length,
      realProviderCalls: 0,
      report: path.relative(root, output),
    }),
  );
}
main()
  .catch((error) => {
    report.status = "FAIL";
    report.failure = {
      check: activeCheck,
      code: /^[A-Z0-9_]{1,100}$/.test(error?.message || "")
        ? error.message
        : "AUTH_HTTP_ASSERTION_FAILED",
    };
    save();
    console.error(JSON.stringify(report.failure));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      db?.close();
    } catch {}
    if (child && child.exitCode === null) {
      child.kill();
      await new Promise((r) => {
        child.once("exit", r);
        setTimeout(r, 5000).unref();
      });
    }
    if (fixture) await new Promise((r) => fixture.close(r));
    if (
      scratch &&
      path.dirname(scratch) === os.tmpdir() &&
      path.basename(scratch).startsWith("lumio-auth-compiled-")
    )
      fs.rmSync(scratch, { recursive: true, force: true });
  });
