const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
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
const { splitReadoutText, readoutLanguage, ReadoutPlayback, READOUT_LIMITS } =
  load("lib/voice/readout.ts");
const client = load("lib/voice/client.ts");
const blob = () =>
  new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
class Audio extends EventTarget {
  src = "";
  currentTime = 0;
  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  playing = false;
  failure = null;
  async play() {
    this.playCalls++;
    if (this.failure) throw this.failure;
    this.playing = true;
    this.dispatchEvent(new Event("play"));
  }
  pause() {
    this.pauseCalls++;
    if (this.playing) {
      this.playing = false;
      this.dispatchEvent(new Event("pause"));
    }
  }
  load() {
    this.loadCalls++;
  }
  removeAttribute(name) {
    if (name === "src") this.src = "";
  }
  end() {
    this.playing = false;
    this.dispatchEvent(new Event("ended"));
  }
}
function setup(generate) {
  const audio = new Audio(),
    states = [],
    created = [],
    revoked = [],
    requests = [];
  const player = new ReadoutPlayback({
    audio,
    onState: (state) => states.push(state),
    generate: async (text, language, signal) => {
      requests.push({ text, language, signal });
      return generate ? generate(text, language, signal) : blob();
    },
    createURL: (value) => {
      assert.ok(value.size);
      const url = `blob:test-${created.length}`;
      created.push(url);
      return url;
    },
    revokeURL: (url) => revoked.push(url),
  });
  return { audio, states, created, revoked, requests, player };
}
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}
(async () => {
  await test("short text and paragraph/sentence splits retain the complete source", () => {
    assert.deepEqual(splitReadoutText("  Bài học ngắn.  "), ["Bài học ngắn."]);
    const text = "Đây là một câu đầy đủ.\n".repeat(600).trim();
    const parts = splitReadoutText(text);
    assert.ok(parts.length > 1);
    assert.equal(parts.join(""), text);
    assert.ok(parts.every((part) => part.length <= 3000));
    assert.ok(parts.slice(0, -1).every((part) => /[.\n\s]$/u.test(part)));
  });
  await test("maximum text is bounded without truncation or broken Unicode pairs", () => {
    const maximum = "文".repeat(READOUT_LIMITS.characters);
    const parts = splitReadoutText(maximum);
    assert.equal(parts.join(""), maximum);
    assert.ok(parts.length <= 100);
    const emoji = "x".repeat(2999) + "😀" + "y".repeat(9000);
    const unicode = splitReadoutText(emoji);
    assert.equal(unicode.join(""), emoji);
    assert.ok(
      unicode.every(
        (part) =>
          part.length <= 3000 &&
          !/[\uD800-\uDBFF]$/.test(part) &&
          !/^\p{Surrogate}/u.test(part),
      ),
    );
  });
  await test("oversized and empty inputs reject explicitly", () => {
    assert.throws(
      () => splitReadoutText("x".repeat(200001)),
      /READOUT_TOO_LONG/,
    );
    assert.throws(() => splitReadoutText(" \n\t "), /READOUT_EMPTY/);
  });
  await test("voice language stays in the five supported values", () => {
    for (const language of ["vi", "en", "zh-CN", "ja", "ko"])
      assert.equal(readoutLanguage(language), language);
    assert.equal(readoutLanguage("injected-provider-language", "en"), "en");
  });
  await test("constructing and stopping do not generate speech", () => {
    const s = setup();
    assert.equal(s.requests.length, 0);
    s.player.stop();
    assert.equal(s.requests.length, 0);
    s.player.dispose();
  });
  await test("explicit Start fetches and attempts immediate playback", async () => {
    const s = setup();
    await s.player.start("Một bài học.", "vi");
    assert.equal(s.requests.length, 1);
    assert.equal(s.requests[0].text, "Một bài học.");
    assert.equal(s.audio.playCalls, 1);
    assert.equal(s.player.snapshot().phase, "playing");
    s.player.dispose();
  });
  await test("long reading lazily requests only the next part after ended", async () => {
    const s = setup();
    const text = "Một câu trọn vẹn. ".repeat(400).trim();
    const parts = splitReadoutText(text);
    await s.player.start(text, "vi");
    await tick();
    assert.equal(s.requests.length, 1);
    s.audio.pause();
    assert.equal(s.player.snapshot().phase, "paused");
    assert.equal(s.requests.length, 1);
    await s.audio.play();
    assert.equal(s.player.snapshot().phase, "playing");
    assert.equal(s.requests.length, 1);
    for (let index = 1; index < parts.length; index++) {
      s.audio.end();
      await tick();
      assert.equal(s.requests.length, index + 1);
      assert.equal(s.player.snapshot().part, index);
    }
    s.audio.end();
    assert.equal(s.player.snapshot().phase, "finished");
    assert.equal(s.requests.map((request) => request.text).join(""), text);
    assert.equal(s.requests.length, parts.length);
    s.player.dispose();
    assert.deepEqual([...s.revoked].sort(), [...s.created].sort());
  });
  await test("blocked autoplay preserves manual audio controls without another request", async () => {
    const s = setup();
    s.audio.failure = new DOMException("blocked", "NotAllowedError");
    await s.player.start("Nội dung để nghe.", "vi");
    assert.equal(s.player.snapshot().phase, "ready");
    assert.equal(s.player.snapshot().blocked, true);
    assert.equal(s.player.snapshot().hasAudio, true);
    assert.ok(s.audio.src.startsWith("blob:"));
    s.audio.failure = null;
    await s.audio.play();
    assert.equal(s.player.snapshot().phase, "playing");
    assert.equal(s.player.snapshot().blocked, false);
    assert.equal(s.requests.length, 1);
    s.player.dispose();
  });
  await test("cancel while fetching aborts and ignores an eventual response", async () => {
    const pending = deferred();
    const s = setup(() => pending.promise);
    const run = s.player.start("Pending speech.", "en");
    assert.equal(s.player.snapshot().phase, "loading");
    s.player.stop();
    assert.equal(s.requests[0].signal.aborted, true);
    pending.resolve(blob());
    await run;
    assert.equal(s.created.length, 0);
    assert.equal(s.audio.playCalls, 0);
    assert.equal(s.player.snapshot().phase, "idle");
    s.player.dispose();
  });
  await test("Stop releases the active URL and prevents future ended advancement", async () => {
    const s = setup();
    await s.player.start("Reading sentence. ".repeat(400), "en");
    s.player.stop();
    assert.equal(s.audio.src, "");
    assert.equal(s.audio.playing, false);
    assert.deepEqual(s.revoked, s.created);
    s.audio.end();
    await tick();
    assert.equal(s.requests.length, 1);
    assert.equal(s.player.snapshot().phase, "idle");
    s.player.dispose();
  });
  await test("Stop during a pending playback promise never restores playing state", async () => {
    const playback = deferred();
    const s = setup();
    s.audio.play = () => {
      s.audio.playCalls++;
      return playback.promise;
    };
    const run = s.player.start("A delayed player.", "en");
    await tick();
    assert.equal(s.player.snapshot().phase, "ready");
    s.player.stop();
    playback.resolve();
    await run;
    assert.equal(s.player.snapshot().phase, "idle");
    assert.equal(s.audio.src, "");
    assert.deepEqual(s.revoked, s.created);
    s.player.dispose();
  });
  await test("duplicate ended events do not create overlapping paid requests", async () => {
    const next = deferred();
    let calls = 0;
    const s = setup(() => (++calls === 1 ? blob() : next.promise));
    await s.player.start("A full sentence. ".repeat(700), "en");
    s.audio.end();
    s.audio.end();
    await tick();
    assert.equal(s.requests.length, 2);
    assert.equal(s.player.snapshot().phase, "loading");
    next.resolve(blob());
    await tick();
    assert.equal(s.player.snapshot().part, 1);
    assert.equal(s.requests.length, 2);
    s.player.dispose();
  });
  await test("disposing during generation never plays a late result or emits state", async () => {
    const pending = deferred();
    const s = setup(() => pending.promise);
    const run = s.player.start("A pending part.", "en");
    s.player.dispose();
    const count = s.states.length;
    pending.resolve(blob());
    await run;
    assert.equal(s.requests[0].signal.aborted, true);
    assert.equal(s.created.length, 0);
    assert.equal(s.audio.playCalls, 0);
    assert.equal(s.states.length, count);
    s.audio.end();
    await tick();
    assert.equal(s.requests.length, 1);
  });
  await test("a superseded response cannot replace or play the new reading", async () => {
    const first = deferred();
    const s = setup((text) => (text === "First" ? first.promise : blob()));
    const old = s.player.start("First", "en");
    await s.player.start("Second", "en");
    first.resolve(blob());
    await old;
    assert.equal(s.created.length, 1);
    assert.equal(s.audio.playCalls, 1);
    assert.equal(s.requests[0].signal.aborted, true);
    assert.equal(s.player.snapshot().phase, "playing");
    s.player.dispose();
  });
  await test("empty, non-audio and oversized responses fail before object URL or playback", async () => {
    for (const invalid of [
      new Blob([], { type: "audio/mpeg" }),
      new Blob(["HTML"], { type: "text/html" }),
      new Blob([new Uint8Array(12 * 1024 * 1024 + 1)], { type: "audio/mpeg" }),
    ]) {
      const s = setup(() => invalid);
      await s.player.start("Invalid response.", "en");
      assert.equal(s.player.snapshot().error, "EMPTY_AI_OUTPUT");
      assert.equal(s.created.length, 0);
      assert.equal(s.audio.playCalls, 0);
      s.player.dispose();
    }
  });
  await test("network errors remain visible and audio decoder failures stop queue advancement", async () => {
    const failed = setup(() =>
      Promise.reject(new Error("CREDITS_INSUFFICIENT")),
    );
    await failed.player.start("Text.", "en");
    assert.equal(failed.player.snapshot().error, "CREDITS_INSUFFICIENT");
    failed.player.dispose();
    const s = setup();
    await s.player.start("Long audio response. ".repeat(300), "en");
    s.audio.dispatchEvent(new Event("error"));
    assert.equal(s.player.snapshot().error, "READOUT_PLAYBACK_FAILED");
    s.audio.end();
    await tick();
    assert.equal(s.requests.length, 1);
    s.player.dispose();
  });
  await test("client sends each part intact and validates audio MIME and bytes", async () => {
    const originalFetch = global.fetch;
    try {
      let body;
      global.fetch = async (_url, options) => {
        body = JSON.parse(options.body);
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "audio/mpeg" },
        });
      };
      const text = "x".repeat(3000);
      const result = await client.synthesizeVoice(
        text,
        "en",
        "clear",
        new AbortController().signal,
      );
      assert.equal(result.size, 3);
      assert.equal(body.text, text);
      global.fetch = async () =>
        new Response("HTML", { headers: { "Content-Type": "text/html" } });
      await assert.rejects(
        client.synthesizeVoice(
          "Text",
          "en",
          "clear",
          new AbortController().signal,
        ),
        /EMPTY_AI_OUTPUT/,
      );
      global.fetch = async () =>
        new Response(null, { headers: { "Content-Type": "audio/mpeg" } });
      await assert.rejects(
        client.synthesizeVoice(
          "Text",
          "en",
          "clear",
          new AbortController().signal,
        ),
        /EMPTY_AI_OUTPUT/,
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
  console.log(
    `Readout: ${passed} checks passed; no external transport or speaker audio.`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
