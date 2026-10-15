const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
let session = null;
function load(relative) {
  const filename = path.resolve(root, relative);
  if (filename === path.resolve(root, "lib/lumio/auth.ts"))
    return {
      authOptions: () => ({}),
      providerStatus: () => ({ google: true }),
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
    (name) =>
      name === "next-auth"
        ? { getServerSession: async () => session }
        : name.startsWith(".")
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
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-voice-"));
const env = {
  NODE_ENV: "development",
  AUTH_TRUST_HOST: "true",
  NEXTAUTH_URL: "http://127.0.0.1:3000",
  LUMIO_AI_ENABLED: "true",
  LUMIO_PUBLIC_DEMO: "false",
  XAI_API_KEY: "test-only-voice-key",
  XAI_STT_MODEL: "test-stt-model",
  XAI_VOICE: "eve",
};
const before = Object.fromEntries(
  Object.keys(env).map((key) => [key, process.env[key]]),
);
Object.assign(process.env, env);
const platform = load("lib/server/store.ts");
const store = platform.createStore(path.join(directory, "test.sqlite"), {
  adminEmails: ["owner@example.test"],
});
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
  isFeatureEnabled: (key) => store.isFeatureEnabled(key),
  recordAIUsage: (value) => store.recordAIUsage(value),
});
const voice = load("app/api/voice/route.ts"),
  client = load("lib/voice/client.ts");
const originalFetch = global.fetch;
let calls = 0,
  transport,
  passed = 0;
global.fetch = async (url, options) => {
  calls++;
  return transport(String(url), options);
};
const origin = "http://127.0.0.1:3000";
const identity = (name) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: name,
    email: `${name}@example.test`,
    name,
    emailVerified: true,
  });
const owner = identity("owner");
function account(name, plus = true) {
  const user = identity(name);
  if (plus)
    store.adminGrant({
      actorId: owner.id,
      sessionVersion: owner.sessionVersion,
      userId: user.id,
      requestId: crypto.randomUUID(),
      planId: "plus",
      credits: 0,
      days: 1,
      reason: "Isolated voice regression",
    });
  session = { userId: user.id, sessionVersion: user.sessionVersion };
  return user;
}
const snapshot = (user) =>
  store.getBillingSnapshot(user.id, user.sessionVersion);
const post = (body, signal) =>
  new Request(origin + "/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
    signal,
  });
function recording(
  language = "vi",
  body = "audio test bytes",
  mime = "audio/webm;codecs=opus",
) {
  const data = new FormData();
  if (language !== null) data.set("language", language);
  data.set("file", new File([body], "sample.webm", { type: mime }));
  return new Request(origin + "/api/voice", {
    method: "POST",
    headers: { Origin: origin },
    body: data,
  });
}
const audio = () =>
  new Response(new Uint8Array([1, 2, 3]), {
    headers: { "Content-Type": "audio/mpeg" },
  });
async function reject(response, status, code) {
  assert.equal(response.status, status);
  const json = await response.json();
  assert.equal(json.error, code);
  return json;
}
async function test(name, run) {
  calls = 0;
  transport = () => {
    throw new Error("Unexpected external transport");
  };
  await run();
  console.log("PASS " + name);
  passed++;
}
async function main() {
  await test("Voice catalogue exposes product aliases and supported limits without credentials or provider names", async () => {
    const value = await voice.GET().json();
    assert.deepEqual(value.voices, ["clear", "calm", "warm"]);
    assert.equal(value.conversation, "turn-based");
    assert.equal(value.limits.recordingSeconds, 120);
    assert(!/xai|api_key|model|grok/i.test(JSON.stringify(value)));
    assert.equal(calls, 0);
  });
  await test("Unapproved voice IDs fail before provider transport and credit reservation", async () => {
    const user = account("invalid-voice");
    await reject(
      await voice.POST(
        post({ text: "Hello", language: "en", voice: "arbitrary-upstream-id" }),
      ),
      400,
      "INVALID_VOICE",
    );
    assert.equal(calls, 0);
    assert.equal(snapshot(user).account.reserved, 0);
    assert.equal(snapshot(user).account.balance, 200);
  });
  await test("Selected voice aliases map server-side to documented presets and MP3 output", async () => {
    const user = account("presets");
    for (const [selected, expected] of [
      ["clear", "eve"],
      ["calm", "luna"],
      ["warm", "ara"],
    ]) {
      transport = (url, options) => {
        assert.equal(url, "https://api.x.ai/v1/tts");
        const body = JSON.parse(options.body);
        assert.equal(body.voice_id, expected);
        assert.equal(body.output_format.codec, "mp3");
        assert.equal(snapshot(user).account.reserved, 8);
        return audio();
      };
      const result = await voice.POST(
        post({ text: "Hello", language: "en", voice: selected }),
      );
      assert.equal(result.status, 200);
      assert.ok(result.headers.get("x-lumio-request-id"));
    }
    assert.equal(snapshot(user).account.balance, 176);
    assert.equal(snapshot(user).account.reserved, 0);
  });
  await test("STT puts file last, preserves browser codec MIME and forwards supported language formatting", async () => {
    const user = account("language-form");
    transport = (_url, options) => {
      const fields = [...options.body.keys()];
      assert.equal(fields.at(-1), "file");
      assert.equal(options.body.get("language"), "vi");
      assert.equal(options.body.get("format"), "true");
      assert.equal(options.body.get("file").type, "audio/webm;codecs=opus");
      assert.equal(snapshot(user).account.reserved, 24);
      return Response.json({ text: "Xin chào" });
    };
    const response = await voice.POST(recording());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, "Xin chào");
    assert.equal(snapshot(user).account.balance, 176);
  });
  await test("Legacy STT without language remains compatible and Chinese omits undocumented formatting hint", async () => {
    account("auto-language");
    transport = (_url, options) => {
      assert.equal(options.body.has("language"), false);
      assert.equal(options.body.has("format"), false);
      return Response.json({ text: "Automatic transcript" });
    };
    assert.equal((await voice.POST(recording(null))).status, 200);
    assert.equal((await voice.POST(recording("zh-CN"))).status, 200);
  });
  await test("Invalid language, empty recording and non-audio content are rejected without spending", async () => {
    const user = account("invalid-recording");
    await reject(
      await voice.POST(recording("unknown")),
      400,
      "INVALID_LANGUAGE",
    );
    await reject(await voice.POST(recording("en", "")), 400, "INVALID_MEDIA");
    await reject(
      await voice.POST(recording("en", "<html>", "text/html")),
      400,
      "INVALID_MEDIA",
    );
    assert.equal(calls, 0);
    assert.equal(snapshot(user).account.balance, 200);
  });
  await test("Chinese TTS uses documented zh code", async () => {
    account("chinese-tts");
    transport = (_url, options) => {
      assert.equal(JSON.parse(options.body).language, "zh");
      return audio();
    };
    assert.equal(
      (
        await voice.POST(
          post({ text: "你好", language: "zh-CN", voice: "calm" }),
        )
      ).status,
      200,
    );
  });
  await test("Already-cancelled request never contacts provider or reserves credits", async () => {
    const user = account("pre-cancel");
    const controller = new AbortController();
    controller.abort();
    await reject(
      await voice.POST(
        post({ text: "Hello", language: "en" }, controller.signal),
      ),
      499,
      "REQUEST_CANCELLED",
    );
    assert.equal(calls, 0);
    assert.equal(snapshot(user).account.balance, 200);
    assert.equal(snapshot(user).account.reserved, 0);
  });
  await test("Cancellation propagates into transport and refunds exactly one real reservation", async () => {
    const user = account("cancel-live");
    const controller = new AbortController();
    transport = (_url, options) => {
      assert.equal(snapshot(user).account.reserved, 8);
      controller.abort();
      assert(options.signal.aborted);
      options.signal.throwIfAborted();
    };
    await reject(
      await voice.POST(
        post({ text: "Hello", language: "en" }, controller.signal),
      ),
      499,
      "REQUEST_CANCELLED",
    );
    const value = snapshot(user);
    assert.equal(value.account.balance, 200);
    assert.equal(value.account.reserved, 0);
    assert.equal(
      value.history.filter((item) => item.kind === "refund").length,
      1,
    );
  });
  await test("Oversized STT response is bounded and held credits return", async () => {
    const user = account("bounded-transcript");
    transport = () => Response.json({ text: "x".repeat(600000) });
    await reject(await voice.POST(recording()), 413, "PAYLOAD_TOO_LARGE");
    assert.equal(snapshot(user).account.balance, 200);
    assert.equal(snapshot(user).account.reserved, 0);
  });
  await test("Free plan still cannot bypass voice entitlement with forged client fields", async () => {
    const user = account("free-voice", false);
    await reject(
      await voice.POST(
        post({
          text: "Hello",
          language: "en",
          voice: "warm",
          planId: "pro",
          credits: 10000,
        }),
      ),
      403,
      "PLAN_ACCESS_REQUIRED",
    );
    assert.equal(calls, 0);
    assert.equal(snapshot(user).account.balance, 200);
  });
  await test("Client sends only bounded conversation context to local AI route", async () => {
    const signal = new AbortController().signal;
    transport = (url, options) => {
      assert.equal(url, "/api/ai");
      assert.equal(options.signal, signal);
      const body = JSON.parse(options.body);
      assert.equal(body.history.length, 6);
      assert(body.history.every((item) => item.text.length === 4000));
      assert.equal(body.source.length, 200000);
      assert.equal(body.mode, "tutor");
      assert.equal(body.question, "Why?");
      return Response.json({ text: "A response" });
    };
    const turns = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      role: i % 2 ? "assistant" : "user",
      text: "x".repeat(5000),
    }));
    assert.equal(
      await client.askVoiceTutor(
        " Why? ",
        turns,
        "en",
        "s".repeat(210000),
        signal,
      ),
      "A response",
    );
  });
  await test("Client preserves editable transcript and handles HTML error responses safely", async () => {
    transport = () => Response.json({ text: "Editable transcript" });
    assert.equal(
      await client.transcribeRecording(
        new Blob(["audio"], { type: "audio/webm" }),
        "vi",
        new AbortController().signal,
      ),
      "Editable transcript",
    );
    transport = () =>
      new Response("<html>private upstream error</html>", { status: 502 });
    await assert.rejects(
      () =>
        client.synthesizeVoice(
          "Hello",
          "en",
          "calm",
          new AbortController().signal,
        ),
      { message: "PROVIDER_UNAVAILABLE" },
    );
  });
  await test("Client audio response validation rejects HTML masquerading as successful audio", async () => {
    transport = () =>
      new Response("<html>bad gateway</html>", {
        headers: { "Content-Type": "text/html" },
      });
    await assert.rejects(
      () =>
        client.synthesizeVoice(
          "Hello",
          "en",
          "calm",
          new AbortController().signal,
        ),
      { message: "EMPTY_AI_OUTPUT" },
    );
  });
  console.log(
    `\n${passed} voice checks passed; isolated ledger, mocked provider transport, no paid calls.`,
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
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });
