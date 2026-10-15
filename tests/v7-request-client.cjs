const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const values = new Map();
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  },
});
const source = fs.readFileSync(
  path.join(__dirname, "../lib/ai/request-client.ts"),
  "utf8",
);
function load() {
  const mod = { exports: {} };
  new Function(
    "module",
    "exports",
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(mod, mod.exports);
  return mod.exports;
}
let client = load(),
  passed = 0,
  calls = [];
let respond = () =>
  new Response(JSON.stringify({ text: "fixture" }), {
    headers: { "content-type": "application/json" },
  });
globalThis.fetch = async (url, init) => {
  calls.push({ url, headers: init.headers, body: init.body });
  return respond();
};
const init = (value) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});
const key = () => calls.at(-1).headers.get("Idempotency-Key");
async function check(name, fn) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
(async () => {
  await check(
    "Canonical account and UUID are attached without an auth fetch",
    async () => {
      const response = await client.paidFetch(
        "/api/ai",
        init({ source: "private source A" }),
        "account-a",
      );
      assert.equal(calls.length, 1);
      assert.equal(calls[0].headers.get("X-Lumio-Account"), "account-a");
      assert.match(key(), /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/);
      await response.json();
    },
  );
  await check(
    "Concurrent same-intent requests share a key until body acknowledgement",
    async () => {
      const before = calls.length;
      const [a, b] = await Promise.all([
        client.paidFetch("/api/ai", init({ n: 1 }), "a"),
        client.paidFetch("/api/ai", init({ n: 1 }), "a"),
      ]);
      assert.equal(
        calls[before].headers.get("Idempotency-Key"),
        calls[before + 1].headers.get("Idempotency-Key"),
      );
      await a.json();
      await b.json();
    },
  );
  await check(
    "Consumed success allows a subsequent deliberate new operation",
    async () => {
      const a = await client.paidFetch("/api/ai", init({ n: 2 }), "a"),
        old = key();
      await a.json();
      const b = await client.paidFetch("/api/ai", init({ n: 2 }), "a");
      assert.notEqual(key(), old);
      await b.json();
    },
  );
  await check(
    "Network failure is never automatically retried and its key survives explicit retry",
    async () => {
      respond = () => {
        throw Error("network");
      };
      const count = calls.length;
      await assert.rejects(
        client.paidFetch("/api/ai", init({ n: 3 }), "a"),
        /network/,
      );
      const old = key();
      assert.equal(calls.length, count + 1);
      respond = () => new Response('{"text":"ok"}');
      const r = await client.paidFetch("/api/ai", init({ n: 3 }), "a");
      assert.equal(key(), old);
      await r.json();
    },
  );
  await check(
    "Truncated successful JSON retains its intent across module reload",
    async () => {
      respond = () => new Response("{broken");
      const r = await client.paidFetch("/api/ai", init({ n: 4 }), "a"),
        old = key();
      await assert.rejects(r.json());
      client = load();
      respond = () => new Response('{"text":"ok"}');
      const retry = await client.paidFetch("/api/ai", init({ n: 4 }), "a");
      assert.equal(key(), old);
      await retry.json();
    },
  );
  for (const code of [
    "AI_REQUEST_IN_PROGRESS",
    "AI_REQUEST_COMPLETED",
    "AI_REQUEST_CONFLICT",
  ])
    await check(
      code + " does not silently create a second paid intent",
      async () => {
        respond = () =>
          new Response(JSON.stringify({ error: code }), { status: 409 });
        let r = await client.paidFetch("/api/ai", init({ code }), "a"),
          old = key();
        await r.json();
        r = await client.paidFetch("/api/ai", init({ code }), "a");
        assert.equal(key(), old);
        await r.json();
      },
    );
  await check(
    "Known received failure permits a fresh explicit retry",
    async () => {
      respond = () =>
        new Response('{"error":"AI_REQUEST_FAILED"}', { status: 409 });
      let r = await client.paidFetch("/api/ai", init({ n: 5 }), "a"),
        old = key();
      await r.json();
      r = await client.paidFetch("/api/ai", init({ n: 5 }), "a");
      assert.notEqual(key(), old);
      await r.json();
    },
  );
  await check(
    "Account, endpoint and changed payload cannot share an intent",
    async () => {
      respond = () =>
        new Response('{"error":"AI_REQUEST_IN_PROGRESS"}', { status: 409 });
      const ids = [];
      for (const [url, data, actor] of [
        ["/api/ai", { n: 6 }, "a"],
        ["/api/ai", { n: 6 }, "b"],
        ["/api/voice", { n: 6 }, "a"],
        ["/api/ai", { n: 7 }, "a"],
      ]) {
        const r = await client.paidFetch(url, init(data), actor);
        ids.push(key());
        await r.json();
      }
      assert.equal(new Set(ids).size, 4);
    },
  );
  await check(
    "Multipart retries hash actual audio bytes rather than random MIME boundary",
    async () => {
      const make = () => {
        const f = new FormData();
        f.set("language", "vi");
        f.set(
          "file",
          new Blob(["audio-fixture"], { type: "audio/webm" }),
          "a.webm",
        );
        return { method: "POST", body: f };
      };
      const r = await client.paidFetch("/api/voice", make(), "a"),
        old = key();
      await r.json();
      const s = await client.paidFetch("/api/voice", make(), "a");
      assert.equal(key(), old);
      await s.json();
    },
  );
  await check("Audio body consumption acknowledges success", async () => {
    respond = () =>
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "audio/wav" },
      });
    const r = await client.paidFetch(
        "/api/voice",
        init({ text: "audio" }),
        "a",
      ),
      old = key();
    assert.equal((await r.blob()).size, 3);
    const s = await client.paidFetch(
      "/api/voice",
      init({ text: "audio" }),
      "a",
    );
    assert.notEqual(key(), old);
    await s.blob();
  });
  await check("Aborted before dispatch sends nothing", async () => {
    const controller = new AbortController();
    controller.abort();
    const before = calls.length;
    await assert.rejects(
      client.paidFetch(
        "/api/ai",
        { ...init({ n: 8 }), signal: controller.signal },
        "a",
      ),
    );
    assert.equal(calls.length, before);
  });
  await check("Persisted metadata contains hashes and IDs only", () => {
    const raw = values.get("lumio-paid-intents-v1");
    assert.ok(raw);
    assert.ok(!raw.includes("private source A"));
    for (const record of JSON.parse(raw))
      assert.deepEqual(Object.keys(record).sort(), ["at", "hash", "key"]);
  });
  await check(
    "Read failure with working writes fails closed before paid transport",
    async () => {
      const before = calls.length,
        stored = values.get("lumio-paid-intents-v1");
      const reader = sessionStorage.getItem;
      sessionStorage.getItem = () => {
        throw Error("read blocked");
      };
      const fresh = load();
      await assert.rejects(
        fresh.paidFetch("/api/ai", init({ n: 9 }), "a"),
        /AI_REQUEST_STORAGE_UNAVAILABLE/,
      );
      assert.equal(calls.length, before);
      assert.equal(values.get("lumio-paid-intents-v1"), stored);
      sessionStorage.getItem = reader;
    },
  );
  await check(
    "Corrupt or nonconforming persisted metadata never drops an uncertain identity",
    async () => {
      const stored = values.get("lumio-paid-intents-v1"),
        before = calls.length;
      for (const raw of [
        "{bad",
        "{}",
        '[{"hash":"invalid","key":"id","at":1}]',
      ]) {
        values.set("lumio-paid-intents-v1", raw);
        await assert.rejects(
          load().paidFetch("/api/ai", init({ n: 10 }), "a"),
          /AI_REQUEST_STORAGE_UNAVAILABLE/,
        );
        assert.equal(calls.length, before);
        assert.equal(values.get("lumio-paid-intents-v1"), raw);
      }
      values.set("lumio-paid-intents-v1", stored);
    },
  );
  await check(
    "Blocked storage writes fail closed before paid transport",
    async () => {
      const writer = sessionStorage.setItem,
        before = calls.length;
      sessionStorage.setItem = () => {
        throw Error("write blocked");
      };
      await assert.rejects(
        load().paidFetch("/api/ai", init({ n: 11 }), "a"),
        /AI_REQUEST_STORAGE_UNAVAILABLE/,
      );
      assert.equal(calls.length, before);
      sessionStorage.setItem = writer;
    },
  );
  await check(
    "Parsed gateway 5xx retains identity until the server resolves its receipt",
    async () => {
      respond = () => new Response('{"error":"BAD_GATEWAY"}', { status: 502 });
      let r = await client.paidFetch("/api/ai", init({ n: 12 }), "a"),
        old = key();
      await r.json();
      respond = () =>
        new Response('{"error":"AI_REQUEST_COMPLETED"}', { status: 409 });
      r = await client.paidFetch("/api/ai", init({ n: 12 }), "a");
      assert.equal(key(), old);
      await r.json();
      respond = () =>
        new Response('{"error":"AI_REQUEST_FAILED"}', { status: 409 });
      r = await client.paidFetch("/api/ai", init({ n: 12 }), "a");
      assert.equal(key(), old);
      await r.json();
      r = await client.paidFetch("/api/ai", init({ n: 12 }), "a");
      assert.notEqual(key(), old);
      await r.json();
    },
  );
  console.log(
    `V7 request client: ${passed} checks passed; intercepted transport only, 0 provider requests.`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
