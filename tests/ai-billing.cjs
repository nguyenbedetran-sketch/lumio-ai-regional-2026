const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const cache = new Map();
let session = null;
function load(relative) {
  const filename = path.resolve(root, relative);
  if (filename === path.resolve(root, "lib/lumio/auth.ts"))
    return {
      authOptions: () => ({}),
      providerStatus: () => ({ google: true, facebook: true }),
    };
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) => {
      if (name === "next-auth")
        return { getServerSession: async () => session };
      return name.startsWith(".")
        ? load(
            path.relative(
              root,
              path.resolve(path.dirname(filename), name + ".ts"),
            ),
          )
        : require(name);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "lumio-route-billing-"),
);
const env = {
  NODE_ENV: "development",
  AUTH_TRUST_HOST: "true",
  NEXTAUTH_URL: "http://127.0.0.1:3000",
  LUMIO_AI_ENABLED: "true",
  OPENAI_API_KEY: "test-only-not-a-real-key",
  GEMINI_API_KEY: "test-only-not-a-real-key",
  XAI_API_KEY: "test-only-not-a-real-key",
  OPENAI_MODEL: "test-model",
  OPENAI_MODEL_QUICK: "test-model",
  GEMINI_MODEL: "test-model",
  XAI_STT_MODEL: "test-model",
};
const previousEnv = Object.fromEntries(
  Object.keys(env).map((key) => [key, process.env[key]]),
);
Object.assign(process.env, env);
const platform = load("lib/server/store.ts");
const store = platform.createStore(path.join(directory, "isolated.sqlite"), {
  adminEmails: ["owner@example.test"],
});
// Keep the real identity/feature/ledger/telemetry code, but route its exported singleton to this isolated DB.
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
  isFeatureEnabled: (key) => store.isFeatureEnabled(key),
  recordAIUsage: (event) => store.recordAIUsage(event),
});
const ai = load("app/api/ai/route.ts"),
  voice = load("app/api/voice/route.ts");
const originalFetch = global.fetch;
let transport,
  calls = 0,
  passed = 0;
global.fetch = async (url, options) => {
  calls++;
  return transport(String(url), options);
};
const origin = "http://127.0.0.1:3000";
const user = (id) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: id,
    email: `${id}@example.test`,
    emailVerified: true,
    name: id,
  });
const owner = user("owner");
const login = (account) => {
  session = { userId: account.id, sessionVersion: account.sessionVersion };
};
const snapshot = (account) =>
  store.getBillingSnapshot(account.id, account.sessionVersion);
const post = (route, body, requestOrigin = origin) =>
  new Request(origin + route, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: requestOrigin },
    body: JSON.stringify(body),
  });
const aiRequest = (patch = {}, requestOrigin = origin) =>
  post(
    "/api/ai",
    {
      task: "chat",
      question: "Explain one plus one.",
      source: "A simple exercise.",
      mode: "quick",
      language: "vi",
      ...patch,
    },
    requestOrigin,
  );
const voiceRequest = () =>
  post("/api/voice", { text: "Xin chào", language: "vi" });
function transcriptionRequest() {
  const form = new FormData();
  form.set(
    "file",
    new File([Buffer.from("test audio bytes")], "test.webm", {
      type: "audio/webm",
    }),
  );
  return new Request(origin + "/api/voice", {
    method: "POST",
    headers: { Origin: origin },
    body: form,
  });
}
function plus(account) {
  store.adminGrant({
    actorId: owner.id,
    sessionVersion: owner.sessionVersion,
    userId: account.id,
    requestId: crypto.randomUUID(),
    planId: "plus",
    credits: 0,
    days: 1,
    reason: "Isolated route integration fixture",
  });
}
async function rejected(response, status, code) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type"), /application\/json/);
  const body = await response.json();
  assert.equal(body.error, code);
  assert.ok(body.requestId);
  return body;
}
async function test(name, fn) {
  calls = 0;
  transport = () => {
    throw new Error("Unexpected test transport call");
  };
  await fn();
  passed++;
  console.log("PASS " + name);
}
async function main() {
  await test("Unauthenticated HTTP AI requests cannot contact providers or spend credits", async () => {
    session = null;
    await rejected(await ai.POST(aiRequest()), 401, "SIGN_IN_REQUIRED");
    assert.equal(calls, 0);
  });
  await test("Hostile origins are denied by the real guard before billing/provider work", async () => {
    login(user("origin"));
    await rejected(
      await ai.POST(aiRequest({}, "https://untrusted.example")),
      403,
      "INVALID_ORIGIN",
    );
    assert.equal(calls, 0);
  });
  await test("A revoked HTTP session cannot regain access through submitted credits or plan", async () => {
    const account = user("revoked");
    login(account);
    store.updateUserAccess(
      owner.id,
      account.id,
      "revoke",
      "Revoke for isolated regression",
      owner.sessionVersion,
    );
    await rejected(
      await ai.POST(
        aiRequest({ userId: owner.id, planId: "pro", credits: 999999 }),
      ),
      401,
      "SIGN_IN_REQUIRED",
    );
    assert.equal(calls, 0);
  });
  await test("Free cannot request a paid model mode even by forging client entitlements", async () => {
    const account = user("plan-blocked");
    login(account);
    snapshot(account);
    await rejected(
      await ai.POST(
        aiRequest({ mode: "deep", planId: "pro", credits: 999999 }),
      ),
      403,
      "PLAN_ACCESS_REQUIRED",
    );
    assert.equal(calls, 0);
    assert.equal(snapshot(account).account.balance, 200);
    assert.equal(snapshot(account).account.reserved, 0);
  });
  await test("Insufficient credits stop the actual HTTP AI route before its provider transport", async () => {
    const account = user("insufficient");
    login(account);
    const spend = (task, kind, duration) => {
      const hold = store.reserveUsage({
        userId: account.id,
        sessionVersion: 1,
        requestId: crypto.randomUUID(),
        task,
        mode: "quick",
        kind,
        duration,
      });
      store.settleUsage({
        userId: account.id,
        reservationId: hold.reservationId,
      });
    };
    spend("chat", "video", 600);
    for (let i = 0; i < 6; i++) spend("summary", "pdf");
    assert.equal(snapshot(account).account.balance, 2);
    await rejected(
      await ai.POST(aiRequest({ mode: "tutor" })),
      402,
      "CREDITS_INSUFFICIENT",
    );
    assert.equal(calls, 0);
    assert.equal(snapshot(account).account.balance, 2);
    assert.equal(snapshot(account).account.reserved, 0);
  });
  await test("Successful AI response reserves before transport and settles exactly once", async () => {
    const account = user("ai-success");
    login(account);
    transport = (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.match(options.headers.Authorization, /test-only-not-a-real-key/);
      assert.equal(snapshot(account).account.balance, 198);
      assert.equal(snapshot(account).account.reserved, 2);
      return Response.json({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  hint: "Picture one object beside another object before counting their total.",
                  question: "How many objects can you count altogether?",
                }),
              },
            ],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    };
    const response = await ai.POST(aiRequest());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.match(body.text, /Picture one object/);
    assert.equal(body.tutor.hintCount, 1);
    assert.equal(body.tutorReply, undefined);
    assert.equal(body.provider, undefined);
    assert.equal(body.model, undefined);
    assert.equal(calls, 1);
    const result = snapshot(account);
    assert.equal(result.account.balance, 198);
    assert.equal(result.account.reserved, 0);
    assert.equal(
      result.history.filter((event) => event.kind === "usage").length,
      1,
    );
    assert.equal(
      store.listUsage().find((event) => event.requestId === body.requestId)
        .status,
      "success",
    );
  });
  await test("Provider exceptions, including fallback failure, refund the held credits", async () => {
    const account = user("ai-throw");
    login(account);
    transport = () => {
      assert.equal(snapshot(account).account.reserved, 2);
      throw new Error("private provider diagnostic must not leak");
    };
    const body = await rejected(
      await ai.POST(aiRequest()),
      502,
      "PROVIDER_UNAVAILABLE",
    );
    assert.ok(calls >= 1);
    assert.ok(!JSON.stringify(body).includes("private provider"));
    const result = snapshot(account);
    assert.equal(result.account.balance, 200);
    assert.equal(result.account.reserved, 0);
    assert.equal(
      result.history.filter((event) => event.kind === "refund").length,
      1,
    );
  });
  await test("Malformed successful provider output also refunds instead of consuming credits", async () => {
    const account = user("ai-invalid");
    login(account);
    transport = () => Response.json({ output: [] });
    await rejected(await ai.POST(aiRequest()), 502, "EMPTY_AI_OUTPUT");
    assert.equal(calls, 1);
    assert.equal(snapshot(account).account.balance, 200);
    assert.equal(snapshot(account).account.reserved, 0);
  });
  await test("Free voice requests are denied before either TTS or STT fetch", async () => {
    const account = user("voice-blocked");
    login(account);
    await rejected(
      await voice.POST(voiceRequest()),
      403,
      "PLAN_ACCESS_REQUIRED",
    );
    await rejected(
      await voice.POST(transcriptionRequest()),
      403,
      "PLAN_ACCESS_REQUIRED",
    );
    assert.equal(calls, 0);
    assert.equal(snapshot(account).account.balance, 200);
  });
  await test("TTS settles only after audio bytes are received and validated", async () => {
    const account = user("tts-success");
    plus(account);
    login(account);
    transport = (url) => {
      assert.equal(url, "https://api.x.ai/v1/tts");
      assert.equal(snapshot(account).account.reserved, 8);
      return new Response(Buffer.from([1, 2, 3]), {
        headers: { "Content-Type": "audio/mpeg" },
      });
    };
    const response = await voice.POST(voiceRequest());
    assert.equal(response.status, 200);
    assert.equal((await response.arrayBuffer()).byteLength, 3);
    assert.equal(calls, 1);
    assert.equal(snapshot(account).account.balance, 192);
    assert.equal(snapshot(account).account.reserved, 0);
  });
  await test("TTS transport errors and wrong content type refund real reserved credits", async () => {
    const account = user("tts-failure");
    plus(account);
    login(account);
    transport = () => {
      throw new Error("simulated network failure");
    };
    await rejected(
      await voice.POST(voiceRequest()),
      502,
      "PROVIDER_UNAVAILABLE",
    );
    transport = () =>
      new Response("<html>bad provider response</html>", {
        headers: { "Content-Type": "text/html" },
      });
    await rejected(await voice.POST(voiceRequest()), 502, "EMPTY_AI_OUTPUT");
    const result = snapshot(account);
    assert.equal(result.account.balance, 200);
    assert.equal(result.account.reserved, 0);
    assert.equal(
      result.history.filter((event) => event.kind === "refund").length,
      2,
    );
  });
  await test("STT uses the same entitlement and ledger boundary as chat and speech", async () => {
    const account = user("stt-success");
    plus(account);
    login(account);
    transport = (url) => {
      assert.equal(url, "https://api.x.ai/v1/stt");
      assert.equal(snapshot(account).account.reserved, 24);
      return Response.json({ text: "Nội dung thử nghiệm" });
    };
    const response = await voice.POST(transcriptionRequest());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, "Nội dung thử nghiệm");
    assert.equal(calls, 1);
    assert.equal(snapshot(account).account.balance, 176);
    assert.equal(snapshot(account).account.reserved, 0);
  });
  console.log(
    `\n${passed} AI/billing route integration checks passed; real isolated ledger, mocked OAuth and provider transport only.`,
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
    store.close();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });
