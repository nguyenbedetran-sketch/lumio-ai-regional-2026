const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
let browserSession = null,
  browserAuthCalls = 0;
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
        return {
          getServerSession: async () => {
            browserAuthCalls++;
            return browserSession;
          },
        };
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
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-mobile-ai-"));
const env = {
  NODE_ENV: "development",
  AUTH_TRUST_HOST: "true",
  NEXTAUTH_URL: "http://127.0.0.1:3000",
  LUMIO_AI_ENABLED: "true",
  LUMIO_PUBLIC_DEMO: "false",
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
const platform = load("lib/server/store.ts"),
  store = platform.createStore(path.join(directory, "isolated.sqlite"), {
    adminEmails: ["owner@example.test"],
  });
// Preserve the actual mobile/session/ledger implementations; replace only their DB singleton.
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
  isFeatureEnabled: (key) => store.isFeatureEnabled(key),
  recordAIUsage: (event) => store.recordAIUsage(event),
});
const ai = load("app/api/ai/route.ts"),
  voice = load("app/api/voice/route.ts"),
  exchange = load("app/api/mobile/pair/exchange/route.ts");
const originalFetch = global.fetch;
let transport,
  calls = 0,
  passed = 0;
global.fetch = async (url, options) => {
  calls++;
  return transport(String(url), options);
};
const origin = "http://127.0.0.1:3000";
const identity = (id) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: id,
    email: `${id}@example.test`,
    emailVerified: true,
    name: id,
  });
const owner = identity("owner");
const snapshot = (user) =>
  store.getBillingSnapshot(user.id, store.getUser(user.id).sessionVersion);
function native(route, token, body, extra = {}) {
  return new Request(origin + route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: JSON.stringify(body),
  });
}
const chat = (token, patch = {}, extra = {}) =>
  native(
    "/api/ai",
    token,
    {
      task: "chat",
      question: "Explain one plus one.",
      source: "A simple exercise.",
      mode: "quick",
      language: "vi",
      ...patch,
    },
    extra,
  );
const speech = (token, extra = {}) =>
  native(
    "/api/voice",
    token,
    { text: "Xin chào", language: "vi", voice: "calm" },
    extra,
  );
function transcription(token, extra = {}) {
  const form = new FormData();
  form.set("language", "vi");
  form.set(
    "file",
    new File(["test audio bytes"], "test.webm", { type: "audio/webm" }),
  );
  return new Request(origin + "/api/voice", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...extra },
    body: form,
  });
}
async function paired(id, plus = false) {
  const user = identity(id);
  if (plus)
    store.adminGrant({
      actorId: owner.id,
      sessionVersion: owner.sessionVersion,
      userId: user.id,
      requestId: crypto.randomUUID(),
      planId: "plus",
      credits: 0,
      days: 1,
      reason: "Isolated native integration fixture",
    });
  const { code } = store.createMobileCode(user.id, user.sessionVersion);
  const response = await exchange.POST(
    native("/api/mobile/pair/exchange", null, {
      code,
      deviceName: "Integration phone",
    }),
  );
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.match(value.accessToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(value.user.id, user.id);
  return { user, token: value.accessToken, code };
}
function assertPublicOutput(body) {
  for (const key of ["provider", "model", "usage", "accessToken", "apiKey"])
    assert.equal(body[key], undefined);
  assert(!JSON.stringify(body).includes("test-only-not-a-real-key"));
  assert(!JSON.stringify(body).includes("private provider diagnostic"));
}
async function rejected(response, status, code) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type"), /application\/json/);
  const body = await response.json();
  assert.equal(body.error, code);
  assertPublicOutput(body);
  return body;
}
function chatResponse() {
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
}
function audioResponse() {
  return new Response(new Uint8Array([1, 2, 3]), {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
async function test(name, run) {
  calls = 0;
  browserAuthCalls = 0;
  browserSession = null;
  transport = () => {
    throw new Error("Unexpected provider transport");
  };
  await run();
  passed++;
  console.log("PASS " + name);
}
async function main() {
  await test("Actual native exchange creates a canonical bearer session and consumes the pairing code", async () => {
    const { user, token, code } = await paired("exchange");
    assert.equal(store.mobileIdentity(token).user.id, user.id);
    await rejected(
      await exchange.POST(
        native("/api/mobile/pair/exchange", null, {
          code,
          deviceName: "Second phone",
        }),
      ),
      401,
      "PAIR_CODE_INVALID",
    );
    assert.equal(calls, 0);
    assert.equal(browserAuthCalls, 0);
  });
  await test("FREE mobile bearer cannot request paid reasoning or either voice operation", async () => {
    const { user, token } = await paired("free");
    await rejected(
      await ai.POST(
        chat(token, {
          mode: "deep",
          userId: owner.id,
          planId: "pro",
          credits: 999999,
        }),
      ),
      403,
      "PLAN_ACCESS_REQUIRED",
    );
    await rejected(
      await voice.POST(speech(token)),
      403,
      "PLAN_ACCESS_REQUIRED",
    );
    await rejected(
      await voice.POST(transcription(token)),
      403,
      "PLAN_ACCESS_REQUIRED",
    );
    assert.equal(calls, 0);
    assert.equal(browserAuthCalls, 0);
    assert.equal(snapshot(user).account.balance, 200);
    assert.equal(snapshot(user).account.reserved, 0);
  });
  await test("Native chat reserves before transport, strips provider metadata and shares the browser wallet", async () => {
    const { user, token } = await paired("shared-wallet");
    transport = (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(snapshot(user).account.reserved, 2);
      assert.equal(
        options.headers.Authorization,
        "Bearer test-only-not-a-real-key",
      );
      assert.notEqual(options.headers.Authorization, `Bearer ${token}`);
      return chatResponse();
    };
    const response = await ai.POST(chat(token));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.match(body.text, /Picture one object/);
    assert.equal(body.tutor.hintCount, 1);
    assertPublicOutput(body);
    assert.equal(browserAuthCalls, 0);
    assert.equal(snapshot(user).account.balance, 198);
    assert.equal(snapshot(user).account.reserved, 0);
    browserSession = { userId: user.id, sessionVersion: user.sessionVersion };
    const browser = await ai.POST(chat(null, {}, { Origin: origin }));
    assert.equal(browser.status, 200);
    const value = snapshot(user);
    assert.equal(value.account.balance, 196);
    assert.equal(value.account.reserved, 0);
    assert.equal(
      value.history.filter((event) => event.kind === "usage").length,
      2,
    );
    assert.equal(calls, 2);
  });
  await test("Entitled native STT and TTS settle in that same account without provider fields", async () => {
    const { user, token } = await paired("voice-success", true);
    transport = (url, options) => {
      if (url.endsWith("/stt")) {
        assert.equal(snapshot(user).account.reserved, 24);
        assert.equal([...options.body.keys()].at(-1), "file");
        return Response.json({
          text: "Một câu hỏi",
          model: "upstream-private-model",
        });
      }
      assert.equal(snapshot(user).account.reserved, 8);
      return audioResponse();
    };
    const transcript = await voice.POST(transcription(token));
    assert.equal(transcript.status, 200);
    const result = await transcript.json();
    assert.equal(result.text, "Một câu hỏi");
    assertPublicOutput(result);
    const spoken = await voice.POST(speech(token));
    assert.equal(spoken.status, 200);
    assert.match(spoken.headers.get("content-type"), /^audio\//);
    assert.equal((await spoken.arrayBuffer()).byteLength, 3);
    assert.equal(spoken.headers.get("x-model"), null);
    assert.equal(spoken.headers.get("x-provider"), null);
    assert.equal(snapshot(user).account.balance, 168);
    assert.equal(snapshot(user).account.reserved, 0);
    assert.equal(browserAuthCalls, 0);
    assert.equal(calls, 2);
  });
  await test("Native chat provider failure refunds the real reservation and hides diagnostic details", async () => {
    const { user, token } = await paired("chat-refund");
    transport = () => {
      assert.equal(snapshot(user).account.reserved, 2);
      throw new Error("private provider diagnostic");
    };
    await rejected(await ai.POST(chat(token)), 502, "PROVIDER_UNAVAILABLE");
    const value = snapshot(user);
    assert(calls >= 1);
    assert.equal(value.account.balance, 200);
    assert.equal(value.account.reserved, 0);
    assert.equal(
      value.history.filter((event) => event.kind === "refund").length,
      1,
    );
    assert.equal(browserAuthCalls, 0);
  });
  await test("Native voice provider failure refunds its reservation without falling back to browser login", async () => {
    const { user, token } = await paired("voice-refund", true);
    transport = () => {
      assert.equal(snapshot(user).account.reserved, 8);
      throw new Error("private provider diagnostic");
    };
    await rejected(
      await voice.POST(speech(token)),
      502,
      "PROVIDER_UNAVAILABLE",
    );
    const value = snapshot(user);
    assert.equal(value.account.balance, 200);
    assert.equal(value.account.reserved, 0);
    assert.equal(
      value.history.filter((event) => event.kind === "refund").length,
      1,
    );
    assert.equal(browserAuthCalls, 0);
  });
  await test("A revoked device bearer is denied by both actual AI routes before transport", async () => {
    const { user, token } = await paired("device-revoked", true);
    const device = store.mobileIdentity(token).deviceId;
    store.revokeMobileSession(user.id, user.sessionVersion, device);
    browserSession = { userId: owner.id, sessionVersion: owner.sessionVersion };
    await rejected(await ai.POST(chat(token)), 401, "SESSION_REVOKED");
    await rejected(await voice.POST(speech(token)), 401, "SESSION_REVOKED");
    assert.equal(calls, 0);
    assert.equal(browserAuthCalls, 0);
    assert.equal(snapshot(user).account.balance, 200);
  });
  await test("Account-wide session revocation invalidates an already-exchanged mobile bearer", async () => {
    const { user, token } = await paired("account-revoked", true);
    store.updateUserAccess(
      owner.id,
      user.id,
      "revoke",
      "Native AI regression",
      owner.sessionVersion,
    );
    await rejected(await ai.POST(chat(token)), 401, "SESSION_REVOKED");
    await rejected(await voice.POST(speech(token)), 401, "SESSION_REVOKED");
    assert.equal(calls, 0);
    assert.equal(browserAuthCalls, 0);
    assert.equal(snapshot(user).account.balance, 200);
  });
  await test("Mixed native/browser Origin, Cookie or fetch-site headers are denied even with valid bearer", async () => {
    const { user, token } = await paired("mixed-headers", true);
    for (const header of [
      { Origin: origin },
      { Origin: "https://hostile.example" },
      { Cookie: "next-auth.session-token=test-cookie" },
      { "Sec-Fetch-Site": "same-origin" },
    ]) {
      await rejected(
        await ai.POST(chat(token, {}, header)),
        403,
        "INVALID_ORIGIN",
      );
      await rejected(
        await voice.POST(speech(token, header)),
        403,
        "INVALID_ORIGIN",
      );
    }
    assert.equal(calls, 0);
    assert.equal(browserAuthCalls, 0);
    assert.equal(snapshot(user).account.balance, 200);
  });
  await test("Forged native bearer cannot fall back to an otherwise valid browser session", async () => {
    browserSession = { userId: owner.id, sessionVersion: owner.sessionVersion };
    await rejected(await ai.POST(chat("a".repeat(43))), 401, "SESSION_REVOKED");
    await rejected(
      await voice.POST(speech("bad-token")),
      401,
      "SIGN_IN_REQUIRED",
    );
    assert.equal(calls, 0);
    assert.equal(browserAuthCalls, 0);
  });
  await test("Native AI cancellation reaches transport, avoids fallback and refunds before a retry", async () => {
    const { user, token } = await paired("cancel-ai");
    const controller = new AbortController();
    transport = (_url, options) => {
      assert.equal(snapshot(user).account.reserved, 2);
      controller.abort();
      assert.equal(options.signal.aborted, true);
      options.signal.throwIfAborted();
    };
    const request = new Request(chat(token), { signal: controller.signal });
    await rejected(await ai.POST(request), 499, "REQUEST_CANCELLED");
    assert.equal(calls, 1, "Aborted calls must not start a fallback provider");
    const value = snapshot(user);
    assert.equal(value.account.balance, 200);
    assert.equal(value.account.reserved, 0);
    assert.equal(
      value.history.filter((event) => event.kind === "refund").length,
      1,
    );
    assert.equal(
      value.history.filter((event) => event.kind === "usage").length,
      0,
    );
    transport = () => chatResponse();
    assert.equal(
      (await ai.POST(chat(token))).status,
      200,
      "Cancellation releases the account's active request lease",
    );
    assert.equal(snapshot(user).account.balance, 198);
    assert.equal(browserAuthCalls, 0);
  });
  await test("Late provider success cannot settle a native request cancelled before delivery", async () => {
    const { user, token } = await paired("cancel-late");
    const controller = new AbortController();
    transport = () => {
      controller.abort();
      return chatResponse();
    };
    await rejected(
      await ai.POST(new Request(chat(token), { signal: controller.signal })),
      499,
      "REQUEST_CANCELLED",
    );
    assert.equal(calls, 1);
    const value = snapshot(user);
    assert.equal(value.account.balance, 200);
    assert.equal(value.account.reserved, 0);
    assert.equal(
      value.history.filter((event) => event.kind === "refund").length,
      1,
    );
    assert.equal(
      value.history.filter((event) => event.kind === "usage").length,
      0,
    );
  });
  await test("Native voice cancellation propagates and refunds the same canonical wallet", async () => {
    const { user, token } = await paired("cancel-voice", true);
    const controller = new AbortController();
    transport = (_url, options) => {
      assert.equal(snapshot(user).account.reserved, 8);
      controller.abort();
      options.signal.throwIfAborted();
    };
    await rejected(
      await voice.POST(
        new Request(speech(token), { signal: controller.signal }),
      ),
      499,
      "REQUEST_CANCELLED",
    );
    const value = snapshot(user);
    assert.equal(calls, 1);
    assert.equal(value.account.balance, 200);
    assert.equal(value.account.reserved, 0);
    assert.equal(
      value.history.filter((event) => event.kind === "refund").length,
      1,
    );
    assert.equal(browserAuthCalls, 0);
  });
  console.log(
    `\n${passed} mobile AI integration checks passed; actual bearer exchange/routes, isolated real SQLite ledger, mocked provider transport, no paid calls.`,
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
