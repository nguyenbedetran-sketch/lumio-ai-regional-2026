// Error boundary/reporter logic only: no network, private config, database or persisted logs.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  cp = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  baseline = process.argv.includes("--baseline");
let checks = 0;
function loader() {
  const cache = new Map();
  return function load(relative) {
    const file = path.resolve(root, relative);
    if (file === path.resolve(root, "lib/server/store.ts"))
      return {
        getStore() {
          throw Error("DATABASE_FORBIDDEN");
        },
      };
    if (cache.has(file)) return cache.get(file).exports;
    const m = { exports: {} };
    cache.set(file, m);
    const source =
      baseline && relative === "lib/server/access.ts"
        ? cp.execFileSync("git", ["show", "f1ac9c2:lib/server/access.ts"], {
            cwd: root,
            encoding: "utf8",
          })
        : fs.readFileSync(file, "utf8");
    new Function(
      "require",
      "module",
      "exports",
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    )(
      (n) =>
        n.startsWith(".")
          ? load(
              path.relative(root, path.resolve(path.dirname(file), n + ".ts")),
            )
          : require(n),
      m,
      m.exports,
    );
    return m.exports;
  };
}
async function check(name, fn) {
  await fn(loader());
  checks++;
  console.log("PASS " + name);
}
async function withLogs(run) {
  const original = console.error,
    lines = [];
  console.error = (...args) => {
    assert.equal(args.length, 1);
    assert.equal(typeof args[0], "string");
    lines.push(args[0]);
  };
  try {
    return await run(lines);
  } finally {
    console.error = original;
  }
}
const parse = (line) => {
  assert(line.startsWith("[lumio] "));
  return JSON.parse(line.slice(8));
};
async function main() {
  if (baseline) {
    await check(
      "Baseline f1ac9c2 returns an uncorrelated error UUID without server diagnostics",
      async (load) => {
        await withLogs(async (lines) => {
          const r = load("lib/server/access.ts").errorResponse(
              Error("Synthetic private DB exception"),
            ),
            body = await r.json();
          assert.equal(r.status, 503);
          assert.match(body.requestId, /^[0-9a-f-]{36}$/);
          assert.equal(lines.length, 0);
        });
      },
    );
    console.log(
      JSON.stringify({
        baseline: "f1ac9c2",
        reproduced: true,
        checks,
        networkCalls: 0,
      }),
    );
    return;
  }
  await check(
    "Unexpected API error response and sanitized server record share exactly one UUID",
    async (load) => {
      await withLogs(async (lines) => {
        const r = load("lib/server/access.ts").errorResponse(
            Error("Synthetic private SQL/student/token details"),
          ),
          body = await r.json();
        assert.equal(r.status, 503);
        assert.equal(r.headers.get("cache-control"), "private, no-store");
        assert.deepEqual(Object.keys(body).sort(), ["error", "requestId"]);
        assert.equal(body.error, "PLATFORM_UNAVAILABLE");
        assert.equal(lines.length, 1);
        assert.deepEqual(parse(lines[0]), {
          event: "server_error",
          requestId: body.requestId,
          code: "PLATFORM_UNAVAILABLE",
          httpStatus: 503,
          boundary: "api",
        });
        assert(!JSON.stringify({ body, lines }).includes("Synthetic"));
      });
    },
  );
  await check(
    "Database connection codes retain their public identity with a matching diagnostic",
    async (load) => {
      await withLogs(async (lines) => {
        const { errorResponse } = load("lib/server/access.ts"),
          { DatabaseConnectionError } = load(
            "lib/server/database-connection.ts",
          );
        const codes = [
          "DATABASE_CONFIGURATION_INVALID",
          "DATABASE_UNAVAILABLE",
          "DATABASE_TIMEOUT",
          "DATABASE_WRITE_OUTCOME_UNKNOWN",
          "DATABASE_CONNECTION_POISONED",
          "DATABASE_PROTOCOL_ERROR",
          "DATABASE_RESPONSE_TOO_LARGE",
        ];
        for (const code of codes) {
          const r = errorResponse(new DatabaseConnectionError(code)),
            body = await r.json(),
            entry = parse(lines.at(-1));
          assert.equal(r.status, 503);
          assert.equal(body.error, code);
          assert.equal(entry.code, code);
          assert.equal(entry.requestId, body.requestId);
        }
        assert.equal(lines.length, codes.length);
      });
    },
  );
  await check(
    "Unrecognized 5xx PlatformError code cannot become a private message in client or log",
    async (load) => {
      await withLogs(async (lines) => {
        const { PlatformError } = load("lib/server/types.ts"),
          r = load("lib/server/access.ts").errorResponse(
            new PlatformError("Synthetic private name/email/token", 503),
          ),
          body = await r.json();
        assert.equal(body.error, "PLATFORM_UNAVAILABLE");
        assert.equal(parse(lines[0]).code, "PLATFORM_UNAVAILABLE");
        assert(!JSON.stringify({ body, lines }).includes("Synthetic"));
      });
    },
  );
  await check(
    "Expected authentication/authorization/validation denials stay unchanged and do not fill server-error logs",
    async (load) => {
      await withLogs(async (lines) => {
        const { PlatformError } = load("lib/server/types.ts"),
          { errorResponse } = load("lib/server/access.ts");
        for (const [code, status] of [
          ["SIGN_IN_REQUIRED", 401],
          ["FORBIDDEN", 403],
          ["INVALID_ORIGIN", 403],
          ["INVALID_JSON", 400],
          ["LOCAL_RATE_LIMIT", 429],
        ]) {
          const r = errorResponse(new PlatformError(code, status)),
            body = await r.json();
          assert.equal(r.status, status);
          assert.equal(body.error, code);
        }
        assert.equal(lines.length, 0);
      });
    },
  );
  await check(
    "Host logger failure cannot replace the intended API JSON or authentication redirect",
    async (load) => {
      const original = console.error;
      console.error = () => {
        throw Error("Synthetic host logger failure");
      };
      try {
        const r = load("lib/server/access.ts").errorResponse(
          Error("Synthetic private exception"),
        );
        assert.equal(r.status, 503);
        assert.equal((await r.json()).error, "PLATFORM_UNAVAILABLE");
        const redirect = load("lib/server/auth-errors.ts").authFailureResponse(
          "GET",
          "callback",
          Error("Synthetic private OAuth error"),
        );
        assert.equal(redirect.status, 303);
        assert.equal(redirect.headers.get("location"), "/?error=Configuration");
      } finally {
        console.error = original;
      }
    },
  );
  await check(
    "Exception message, stack, cause and headers are never inspected or serialized",
    async (load) => {
      await withLogs(async (lines) => {
        const error = {};
        for (const key of [
          "message",
          "stack",
          "cause",
          "headers",
          "request",
          "body",
        ])
          Object.defineProperty(error, key, {
            get() {
              throw Error("PRIVATE_PROPERTY_READ");
            },
          });
        const r = load("lib/server/access.ts").errorResponse(error);
        assert.equal(r.status, 503);
        assert.equal((await r.json()).error, "PLATFORM_UNAVAILABLE");
        assert.equal(lines.length, 1);
      });
    },
  );
  await check(
    "Reporter only emits whitelisted static context and bounded single-line fields",
    async (load) => {
      const lines = [],
        report = load(
          "lib/server/error-diagnostics.ts",
        ).createServerErrorReporter(
          (line) => lines.push(line),
          () => 0,
        ),
        marker = "Synthetic-private-email-token-query";
      assert.equal(
        report({
          requestId: crypto.randomUUID(),
          code: marker.repeat(10000),
          status: 503,
          context: {
            boundary: marker,
            route: "/api/users/" + marker + "?token=" + marker,
            method: "GET\r\n" + marker,
          },
          error: marker,
          body: marker,
          headers: marker,
          userId: marker,
        }),
        true,
      );
      const entry = parse(lines[0]);
      assert.deepEqual(Object.keys(entry).sort(), [
        "boundary",
        "code",
        "event",
        "httpStatus",
        "requestId",
      ]);
      assert.equal(entry.code, "PLATFORM_UNAVAILABLE");
      assert.equal(entry.boundary, "api");
      assert(!lines[0].includes(marker));
      assert(!lines[0].includes("\n"));
      assert(lines[0].length < 384);
    },
  );
  await check(
    "A burst is capped at thirty correlated records plus one static limit notice per minute",
    async (load) => {
      let time = 0;
      const lines = [],
        report = load(
          "lib/server/error-diagnostics.ts",
        ).createServerErrorReporter(
          (line) => lines.push(line),
          () => time,
        );
      for (let i = 0; i < 10000; i++)
        report({
          requestId: crypto.randomUUID(),
          code: "DATABASE_TIMEOUT",
          status: 503,
        });
      assert.equal(lines.length, 31);
      assert.equal(
        lines.filter((line) => parse(line).event === "server_error").length,
        30,
      );
      assert.deepEqual(parse(lines[30]), {
        event: "server_error_limit_reached",
        limit: 30,
        windowMs: 60000,
      });
      time = 59999;
      assert.equal(
        report({
          requestId: crypto.randomUUID(),
          code: "DATABASE_TIMEOUT",
          status: 503,
        }),
        false,
      );
      assert.equal(lines.length, 31);
      time = 60000;
      assert.equal(
        report({
          requestId: crypto.randomUUID(),
          code: "DATABASE_TIMEOUT",
          status: 503,
        }),
        true,
      );
      assert.equal(lines.length, 32);
    },
  );
  await check(
    "Invalid correlation IDs, invalid status and broken clock fail silently without logging input",
    async (load) => {
      const lines = [],
        { createServerErrorReporter } = load("lib/server/error-diagnostics.ts"),
        report = createServerErrorReporter(
          (line) => lines.push(line),
          () => 0,
        );
      for (const requestId of [
        "private-token",
        "",
        "00000000-0000-0000-0000-000000000000",
      ])
        assert.equal(
          report({ requestId, code: "DATABASE_TIMEOUT", status: 503 }),
          false,
        );
      for (const status of [200, 400, 499, 600, 503.5, NaN])
        assert.equal(
          report({
            requestId: crypto.randomUUID(),
            code: "DATABASE_TIMEOUT",
            status,
          }),
          false,
        );
      assert.equal(
        createServerErrorReporter(
          (line) => lines.push(line),
          () => NaN,
        )({
          requestId: crypto.randomUUID(),
          code: "DATABASE_TIMEOUT",
          status: 503,
        }),
        false,
      );
      assert.equal(lines.length, 0);
    },
  );
  await check(
    "Authentication JSON failures and exceptional redirects preserve behavior and carry matching safe correlation",
    async (load) => {
      await withLogs(async (lines) => {
        const { authFailureResponse } = load("lib/server/auth-errors.ts");
        for (const action of ["signin", "signout"]) {
          const r = authFailureResponse(
              "POST",
              action,
              Error("Synthetic OAuth credential detail"),
            ),
            body = await r.json(),
            entry = parse(lines.at(-1));
          assert.equal(r.status, 503);
          assert.equal(body.url, "/?error=Configuration");
          assert.equal(body.error, "AUTHENTICATION_UNAVAILABLE");
          assert.equal(entry.requestId, body.requestId);
          assert.equal(entry.httpStatus, 503);
          assert.equal(entry.method, "POST");
          assert.equal(entry.route, "/api/auth/[...nextauth]");
        }
        const r = authFailureResponse(
            "GET",
            "callback",
            Error("Synthetic OAuth credential detail"),
          ),
          entry = parse(lines.at(-1));
        assert.equal(r.status, 303);
        assert.equal(r.headers.get("location"), "/?error=Configuration");
        assert.equal(await r.text(), "");
        assert.equal(r.headers.get("x-lumio-request-id"), entry.requestId);
        assert.equal(entry.httpStatus, 303);
        assert.equal(entry.boundary, "auth");
        const session = authFailureResponse(
            "GET",
            "session",
            Error("Synthetic OAuth credential detail"),
          ),
          body = await session.json();
        assert.equal(session.status, 503);
        assert.equal(body.requestId, parse(lines.at(-1)).requestId);
        assert(!JSON.stringify(lines).includes("Synthetic"));
      });
    },
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      checks,
      networkCalls: 0,
      databaseCalls: 0,
      scope:
        "Actual error boundaries and bounded stderr reporter; synthetic failures; no production monitoring/deployment claim",
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
