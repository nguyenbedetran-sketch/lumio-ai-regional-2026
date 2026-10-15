/* Opt-in real-provider evaluation. Auth principal is injected at the harness boundary;
 * all tutor, route, credit, source and provider code is real, using a disposable DB. */
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript");
const root = path.resolve(__dirname, "..");
const live = process.argv.includes("--live");
if (!live) {
  console.error(
    "Explicit --live is required. This makes up to40 paid provider requests using server .env.local, without copying keys into reports.",
  );
  process.exit(2);
}
const arg = (name) =>
  process.argv.find((x) => x.startsWith(name + "="))?.slice(name.length + 1);
const cap = Number(arg("--max-calls") || 40);
if (!Number.isInteger(cap) || cap < 1 || cap > 50)
  throw Error("max-calls must be1..50");
const out = path.resolve(
  arg("--out") ||
    path.join(root, "docs", "regional", "tutor-live-evaluation.json"),
);
const localEnv = path.join(root, ".env.local");
if (fs.existsSync(localEnv))
  for (const line of fs.readFileSync(localEnv, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-tutor-live-"));
Object.assign(process.env, {
  LUMIO_DB_PATH: path.join(directory, "evaluation.sqlite"),
  LUMIO_AI_ENABLED: "true",
  LUMIO_PUBLIC_DEMO: "false",
  LUMIO_DESKTOP: "false",
  NEXTAUTH_URL: "http://127.0.0.1:3000",
  AUTH_TRUST_HOST: "true",
});
let principal = null;
const cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (file === path.resolve(root, "lib/lumio/auth.ts"))
    return {
      authOptions: () => ({}),
      providerStatus: () => ({ google: true, facebook: false }),
    };
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name === "next-auth"
        ? { getServerSession: async () => principal }
        : name.startsWith(".")
          ? load(
              path.relative(
                root,
                path.resolve(path.dirname(file), name + ".ts"),
              ),
            )
          : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const platform = load("lib/server/store.ts"),
  store = platform.getStore(),
  route = load("app/api/ai/route.ts");
const problems = load("lib/tutor/reference-problems.ts").tutorReferenceProblems;
const cases = arg("--cases")?.split(",");
const report = {
  schema: 1,
  runAt: new Date().toISOString(),
  environment: "isolated local route + real configured AI provider",
  authBoundary:
    "Canonical account/session is injected by harness. This is NOT an OAuth or public deployment test.",
  providerCallsLimit: cap,
  calls: 0,
  realProviderCalls: true,
  providerRequests: 0,
  studentTrial: false,
  cases: [],
  summary: { pass: 0, partial: 0, fail: 0 },
};
const realFetch = global.fetch;
let lastProviderText;
global.fetch = async (...args) => {
  if (report.providerRequests >= cap)
    throw Error("EVALUATION_PROVIDER_CALL_LIMIT");
  report.providerRequests++;
  const response = await realFetch(...args);
  try {
    const body = await response.clone().json();
    lastProviderText = (body.output || [])
      .flatMap((o) => o.content || [])
      .filter((p) => p.type === "output_text")
      .map((p) => p.text)
      .join("")
      .slice(0, 24000);
  } catch {
    lastProviderText = undefined;
  }
  return response;
};
const write = () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
};
async function post(input) {
  if (report.calls >= cap) throw Error("EVALUATION_CALL_LIMIT");
  report.calls++;
  const request = new Request("http://127.0.0.1:3000/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:3000",
    },
    body: JSON.stringify({
      task: "chat",
      mode: "tutor",
      language: "vi",
      source: "",
      ...input,
    }),
  });
  const start = Date.now(),
    response = await route.POST(request),
    body = await response.json();
  const result = {
    http: response.status,
    durationMs: Date.now() - start,
    ...body,
  };
  if (!response.ok && lastProviderText)
    result.rejectedProviderText = lastProviderText;
  return result;
}
(async () => {
  try {
    for (const fixture of problems) {
      if (cases && !cases.includes(fixture.id)) continue;
      const user = store.ensureIdentity({
        provider: "google",
        providerAccountId: "evaluation-" + fixture.id,
        name: "Evaluation learner",
        emailVerified: false,
      });
      principal = { userId: user.id, sessionVersion: user.sessionVersion };
      const item = {
        id: fixture.id,
        problem: fixture.problem,
        reference: fixture.solutions,
        referenceCheck: fixture.check,
        scenario: fixture.scenario,
        transcript: [],
        status: "NOT TESTED",
        criteria: {
          lockedBeforeThree: false,
          threeMeaningfulHints: false,
          fullAfterUnlock: false,
          mathVerified: false,
          missingDataNotInvented: false,
          clarificationsDoNotUnlock: false,
        },
      };
      report.cases.push(item);
      let sessionId;
      try {
        // This request is blocked before the provider and is therefore outside thepaid-callcap.
        const deniedReq = new Request("http://127.0.0.1:3000/api/ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://127.0.0.1:3000",
          },
          body: JSON.stringify({
            task: "chat",
            mode: "deep",
            language: "vi",
            source: fixture.source || "",
            question: fixture.problem,
            guidance: "full",
            hintCount: 100,
          }),
        });
        const deniedResponse = await route.POST(deniedReq),
          denied = await deniedResponse.json();
        item.criteria.lockedBeforeThree =
          deniedResponse.status === 409 && denied.error === "TUTOR_LOCKED";
        sessionId = denied.tutor?.sessionId;
        item.transcript.push({
          student: "[Direct full request before first hint]",
          http: deniedResponse.status,
          error: denied.error,
          tutor: denied.tutor,
        });
        if (!item.criteria.lockedBeforeThree)
          throw Error("EARLY_FULL_WAS_NOT_LOCKED");
        for (let turn = 0; turn < 3; turn++) {
          const question =
            turn === 0 ? fixture.problem : fixture.attempts[turn - 1];
          const result = await post({
            source: fixture.source || "",
            question,
            tutorSessionId: sessionId,
          });
          item.transcript.push({ student: question, ...result });
          if (result.http !== 200) throw Error(result.error || "HINT_FAILED");
          sessionId = result.tutor?.sessionId;
          if (
            result.tutor?.hintCount !==
            (fixture.solutions === null ? 0 : turn + 1)
          )
            throw Error("HINT_COUNT_MISMATCH");
          if (fixture.solutions === null && !result.tutor?.needsClarification)
            throw Error("MISSING_DATA_NOT_FLAGGED");
          write();
        }
        item.criteria.threeMeaningfulHints = fixture.solutions !== null;
        const answer = await post({
          source: fixture.source || "",
          question:
            "Em đã thử qua các gợi ý. Cho em đối chiếu lời giải đầy đủ và bước kiểm tra.",
          tutorSessionId: sessionId,
          guidance: "full",
        });
        item.transcript.push({
          student: "[Unlocked full solution]",
          ...answer,
        });
        item.criteria.fullAfterUnlock =
          answer.http === 200 &&
          answer.tutor?.canUnlock === true &&
          answer.tutor?.guidance === "full";
        item.criteria.mathVerified =
          fixture.solutions === null
            ? false
            : answer.verification?.status === "verified";
        item.criteria.missingDataNotInvented =
          fixture.solutions === null
            ? item.transcript
                .filter((t) => t.http === 200)
                .every(
                  (t) =>
                    /chiều rộng|dữ kiện|chưa đủ|không đủ/.test(t.text || "") &&
                    !/(?:diện tích|S)\s*=\s*\d+\s*(?:cm|m)/i.test(t.text || ""),
                )
            : true;
        item.criteria.clarificationsDoNotUnlock =
          fixture.solutions === null &&
          answer.http === 409 &&
          answer.error === "TUTOR_LOCKED" &&
          answer.tutor?.hintCount === 0;
        item.status =
          fixture.solutions === null
            ? item.criteria.lockedBeforeThree &&
              item.criteria.clarificationsDoNotUnlock &&
              item.criteria.missingDataNotInvented
              ? "PASS"
              : "PARTIAL"
            : item.criteria.lockedBeforeThree &&
                item.criteria.threeMeaningfulHints &&
                item.criteria.fullAfterUnlock &&
                (fixture.solutions === null
                  ? item.criteria.missingDataNotInvented
                  : item.criteria.mathVerified)
              ? "PASS"
              : "PARTIAL";
      } catch (e) {
        item.status = "FAIL";
        item.error = e?.code || e?.message || "EVALUATION_FAILED";
      }
      report.summary[
        item.status === "PASS"
          ? "pass"
          : item.status === "PARTIAL"
            ? "partial"
            : "fail"
      ]++;
      write();
      console.log(`${item.id}: ${item.status}`);
      if (report.calls >= cap) break;
    }
  } finally {
    report.finishedAt = new Date().toISOString();
    write();
    store.close();
    global.fetch = realFetch;
    fs.rmSync(directory, { recursive: true, force: true });
  }
  console.log(
    `Saved ${report.cases.length} case transcripts; real provider request limit ${cap}, route requests ${report.calls}.`,
  );
  process.exitCode = report.summary.fail ? 1 : 0;
})().catch(() => {
  write();
  console.error("Evaluation could not complete. See sanitized report.");
  process.exitCode = 1;
});
