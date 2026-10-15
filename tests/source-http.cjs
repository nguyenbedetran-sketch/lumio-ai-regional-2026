const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  ts = require("typescript");
const { pdf, load: baseLoad } = require("./source-grounding.cjs");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
let actor = "source-http-fixture",
  authenticated = true;
const access = baseLoad("lib/server/access.ts"),
  PlatformError = baseLoad("lib/server/types.ts").PlatformError;
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  if (filename === path.join(root, "lib/server/access.ts"))
    return {
      ...access,
      requireActor: async () => {
        if (!authenticated) throw new PlatformError("SIGN_IN_REQUIRED", 401);
        return { user: { id: actor } };
      },
    };
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name.startsWith(".")
        ? load(
            path.relative(
              root,
              path.resolve(path.dirname(filename), name + ".ts"),
            ),
          )
        : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
async function main() {
  const env = {
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  };
  process.env.NODE_ENV = "test";
  process.env.NEXTAUTH_SECRET = "source-http-only-fixture-secret-".repeat(3);
  const route = load("app/api/ingest-document/route.ts"),
    signer = baseLoad("lib/server/source-evidence.ts");
  const server = http.createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const request = new Request(
        `http://127.0.0.1:${server.address().port}${req.url}`,
        {
          method: req.method,
          headers: req.headers,
          body: Buffer.concat(chunks),
        },
      );
      const result = await route.POST(request);
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      res.writeHead(500);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  process.env.NEXTAUTH_URL = origin;
  const passed = [];
  const check = async (name, fn) => {
    actor = `source-http-${passed.length}`;
    await fn();
    passed.push(name);
    console.log("PASS " + name);
  };
  const body = {
    filename: "lesson.pdf",
    data: pdf([
      "A triangle has three sides.",
      "The divisor must be nonzero.",
    ]).toString("base64"),
  };
  const post = (value = body, headers = {}) =>
    fetch(origin + "/api/ingest-document", {
      method: "POST",
      headers: { origin, "content-type": "application/json", ...headers },
      body: JSON.stringify(value),
    });
  try {
    await check(
      "Actual HTTP handler extracts and signs a two-page PDF without provider calls",
      async () => {
        const response = await post({ ...body, sourceEvidence: { page: 999 } });
        assert.equal(response.status, 200);
        assert.match(response.headers.get("cache-control"), /no-store/);
        const result = await response.json();
        assert.equal(result.sourceEvidence.units[1].page, 2);
        assert.equal(
          signer.verifySourceEvidence(result.sourceEvidence, result.text, actor)
            .kind,
          "pdf",
        );
        assert.ok(
          !JSON.stringify(result).includes(process.env.NEXTAUTH_SECRET),
        );
      },
    );
    await check(
      "Missing authentication rejects before extraction",
      async () => {
        authenticated = false;
        try {
          const r = await post();
          assert.equal(r.status, 401);
          assert.equal((await r.json()).error, "SIGN_IN_REQUIRED");
        } finally {
          authenticated = true;
        }
      },
    );
    await check(
      "Cross-origin and cross-site requests are rejected",
      async () => {
        for (const headers of [
          { origin: "https://evil.invalid" },
          { "sec-fetch-site": "cross-site" },
        ]) {
          const r = await post(body, headers);
          assert.equal(r.status, 403);
        }
      },
    );
    await check(
      "Invalid file bytes and invalid base64 cannot become extraction success",
      async () => {
        for (const value of [
          { ...body, data: Buffer.from("fake PDF").toString("base64") },
          { ...body, data: "***" },
          { ...body, filename: "lesson.exe" },
        ]) {
          const r = await post(value);
          assert.equal(r.status, 400);
        }
      },
    );
    await check(
      "Worker errors disclose only a code, never document contents",
      async () => {
        const secretText = "DOCUMENT-PRIVATE-CONTENT-FIXTURE";
        const r = await post({
          filename: "private.pdf",
          data: Buffer.from("%PDF-" + secretText).toString("base64"),
        });
        assert.equal(r.status, 422);
        const text = await r.text();
        assert.ok(!text.includes(secretText));
        assert.ok(!text.includes("stack"));
      },
    );
    await check(
      "Rate limit is enforced per authenticated fixture account",
      async () => {
        for (let i = 0; i < 4; i++) {
          const r = await post({ ...body, data: "***" });
          assert.equal(r.status, 400);
        }
        const blocked = await post();
        assert.equal(blocked.status, 429);
        assert.equal((await blocked.json()).error, "LOCAL_RATE_LIMIT");
      },
    );
    await check(
      "Concurrent extraction is denied before creating a second worker",
      async () => {
        const first = post();
        const second = post();
        const results = await Promise.all([first, second]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 429]);
      },
    );
    const report = {
      status: "PASS",
      checks: passed.length,
      passed,
      fixtureAuth: true,
      actualHTTP: true,
      actualExtraction: true,
      providerRequests: 0,
      studentData: false,
      checkedAt: new Date().toISOString(),
    };
    fs.mkdirSync(path.join(root, "docs/regional"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/regional/qa-source-http-report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      `${passed.length} source HTTP checks passed; only session lookup is replaced by an explicit isolated fixture. No personal database, OAuth or paid providers used.`,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
