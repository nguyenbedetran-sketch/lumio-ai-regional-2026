const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = { exports: {} };
  cache.set(filename, mod);
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(
    (name) =>
      name.startsWith(".")
        ? load(
            path.relative(
              root,
              path.resolve(path.dirname(filename), name + ".ts"),
            ),
          )
        : require(name),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const f = load("lib/ai/full-summary.ts"),
  s = load("lib/ai/summary.ts"),
  storage = load("lib/lumio/storage.ts");
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
const input = {
  task: "summary",
  question: "",
  source: "",
  language: "vi",
  history: [],
  youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
};
function summary(part, count = 2) {
  return {
    title: `Topic ${part.startSeconds}`,
    overview: `Overview ${part.startSeconds}`,
    keyPoints: ["Main idea"],
    chapters: Array.from({ length: count }, (_, i) => ({
      title: `Chapter ${part.startSeconds}:${i}`,
      summary: `Learn ${i}`,
      bullets: ["Example"],
      startSeconds: Math.min(part.endSeconds - 0.1, part.startSeconds + i),
      timestampKind: "approximate",
    })),
    mindMap: {
      nodes: [
        { id: "root", label: "Topic", detail: "Root" },
        { id: "child", label: "Detail", detail: "Details", chapterIndex: 0 },
      ],
      edges: [{ source: "root", target: "child" }],
    },
  };
}
function backup(artifact, info) {
  const at = "2026-10-03T01:00:00.000Z";
  return JSON.stringify({
    version: 1,
    spaces: [],
    items: [
      {
        id: "video",
        title: "Video",
        kind: "link",
        spaceId: "",
        createdAt: at,
        updatedAt: at,
        text: "",
        notes: "",
        cards: [],
        questions: [],
        attempts: [],
        favorite: false,
        url: input.youtubeUrl,
        sourceInfo: info,
        artifacts: artifact ? [artifact] : [],
      },
    ],
  });
}
function artifact(merged, duration = 4200) {
  return {
    id: "full",
    kind: "summary",
    createdAt: "2026-10-03T01:00:00.000Z",
    summary: merged,
    source: {
      kind: "youtube",
      title: "Video",
      url: input.youtubeUrl,
      contentLength: 0,
      coverage: {
        scope: "whole",
        method: "segmented-video",
        durationSeconds: duration,
        durationBasis: "declared",
        parts: f.wholeVideoParts(duration),
      },
    },
  };
}
(async () => {
  await test("Whole scope partitions 70-minute source with exact no-gap coverage", () => {
    const parts = f.wholeVideoParts(4200);
    assert.equal(parts.length, 7);
    assert.deepEqual(parts[0], { startSeconds: 0, endSeconds: 600 });
    assert.deepEqual(parts.at(-1), { startSeconds: 3600, endSeconds: 4200 });
    parts.forEach((p, i) => {
      assert.equal(p.startSeconds, i ? parts[i - 1].endSeconds : 0);
      assert.ok(p.endSeconds - p.startSeconds <= 600);
    });
  });
  await test("Fractional metadata rounds up without clipping final source second", () => {
    assert.deepEqual(f.wholeVideoParts(601.2).at(-1), {
      startSeconds: 600,
      endSeconds: 602,
    });
    assert.deepEqual(f.wholeVideoParts(0.2), [
      { startSeconds: 0, endSeconds: 1 },
    ]);
  });
  await test("Unknown, zero, live Infinity and oversized durations cannot claim whole", () => {
    for (const n of [0, -1, NaN, Infinity, 43200.1])
      assert.throws(() => f.wholeVideoParts(n), /FULL_DURATION_REQUIRED/);
    assert.equal(f.wholeVideoParts(43200).length, 72);
  });
  await test("Whole video requests are sequential and retain authentication API boundary", async () => {
    const controller = new AbortController(),
      calls = [];
    let pending = 0,
      peak = 0;
    const result = await f.runWholeVideoSummary({
      input,
      title: "All chapters",
      duration: 4200,
      signal: controller.signal,
      request: async (value, signal) => {
        pending++;
        peak = Math.max(peak, pending);
        calls.push(value.videoRange);
        assert.equal(signal, controller.signal);
        assert.equal(value.youtubeUrl, input.youtubeUrl);
        assert.equal(value.task, "summary");
        await Promise.resolve();
        pending--;
        return { summary: summary(value.videoRange) };
      },
    });
    assert.equal(peak, 1);
    assert.deepEqual(calls, f.wholeVideoParts(4200));
    assert.equal(result.summary.chapters.length, 14);
    assert.equal(result.summary.chapters.at(-1).startSeconds, 3601);
    assert.equal(input.videoRange, undefined);
  });
  await test("Later provider failure returns no complete artifact and retains only validated completed parts", async () => {
    let calls = 0,
      retained = [];
    await assert.rejects(
      f.runWholeVideoSummary({
        input,
        title: "Video",
        duration: 1800,
        signal: new AbortController().signal,
        onPart: (done) => (retained = done),
        request: async (value) => {
          if (++calls === 3) throw new Error("INSUFFICIENT_CREDITS");
          return { summary: summary(value.videoRange) };
        },
      }),
      /INSUFFICIENT_CREDITS/,
    );
    assert.equal(calls, 3);
    assert.equal(retained.length, 2);
  });
  await test("Resume skips completed paid requests and joins every chapter exactly once", async () => {
    const parts = f.wholeVideoParts(1800),
      calls = [];
    const result = await f.runWholeVideoSummary({
      input,
      title: "Resume",
      duration: 1800,
      completed: parts.slice(0, 2).map((p) => summary(p)),
      signal: new AbortController().signal,
      request: async (value) => {
        calls.push(value.videoRange);
        return { summary: summary(value.videoRange) };
      },
    });
    assert.deepEqual(calls, [parts[2]]);
    assert.equal(result.summary.chapters.length, 6);
  });
  await test("Abort after a completed part prevents all later requests and whole completion", async () => {
    const controller = new AbortController();
    let calls = 0,
      retained = [];
    await assert.rejects(
      f.runWholeVideoSummary({
        input,
        title: "Cancel",
        duration: 1800,
        signal: controller.signal,
        onPart: (done) => {
          retained = done;
          controller.abort();
        },
        request: async (value) => {
          calls++;
          return { summary: summary(value.videoRange) };
        },
      }),
      { name: "AbortError" },
    );
    assert.equal(calls, 1);
    assert.equal(retained.length, 1);
  });
  await test("Abort during final response still cannot save complete whole summary", async () => {
    const controller = new AbortController();
    let retained = [];
    await assert.rejects(
      f.runWholeVideoSummary({
        input,
        title: "Cancel final",
        duration: 60,
        signal: controller.signal,
        onPart: (done) => (retained = done),
        request: async (value) => {
          controller.abort();
          return { summary: summary(value.videoRange) };
        },
      }),
      { name: "AbortError" },
    );
    assert.equal(retained.length, 0);
  });
  await test("Malformed parts fail before subsequent requests", async () => {
    let calls = 0;
    await assert.rejects(
      f.runWholeVideoSummary({
        input,
        title: "Bad response",
        duration: 1800,
        signal: new AbortController().signal,
        request: async () => {
          calls++;
          return { summary: { title: "Missing chapters" } };
        },
      }),
      /INVALID_SUMMARY/,
    );
    assert.equal(calls, 1);
  });
  await test("Audio and ordinary text never enter unsupported video offset pipeline", async () => {
    for (const next of [
      {
        ...input,
        youtubeUrl: undefined,
        media: { mimeType: "audio/webm", data: "YQ==" },
      },
      { ...input, youtubeUrl: undefined, source: "Full text" },
    ])
      await assert.rejects(
        f.runWholeVideoSummary({
          input: next,
          title: "Audio",
          duration: 60,
          signal: new AbortController().signal,
          request: () => {
            throw new Error("must not run");
          },
        }),
        /INVALID_FULL_SUMMARY_SOURCE/,
      );
  });
  await test("Merged chapters exceed ordinary 24 chapter limit without silently dropping later content", () => {
    const parts = f.wholeVideoParts(7800),
      merged = f.mergeWholeVideo(
        "Full",
        parts,
        parts.map((p) => summary(p, 3)),
      );
    assert.equal(merged.chapters.length, 39);
    assert.equal(merged.chapters.at(-1).startSeconds, 7202);
    assert.throws(
      () => s.validateSummary(merged, { restore: true }),
      /INVALID_SUMMARY/,
    );
    assert.equal(
      storage.importLibrary(backup(artifact(merged, 7800))).items[0]
        .artifacts[0].summary.chapters.length,
      39,
    );
  });
  await test("Twelve-hour worst-case valid part sizes preserve all 1728 chapters within aggregate bounds", () => {
    const parts = f.wholeVideoParts(43200);
    const many = parts.map((p) => {
      const out = summary(p, 24);
      out.overview = "o".repeat(5000);
      out.keyPoints = ["k".repeat(1000)];
      out.chapters.forEach((c) => {
        c.summary = "s".repeat(1000);
        c.bullets = ["b".repeat(1000)];
      });
      return s.validateSummary(out, { restore: true, range: p });
    });
    const merged = f.mergeWholeVideo("Long lesson", parts, many);
    assert.equal(merged.chapters.length, 1728);
    assert.ok(merged.mindMap.nodes.length <= 25);
    assert.equal(merged.chapters.at(-1).startSeconds, 42623);
  });
  await test("Coverage rejects gaps, early stop, bogus duration and non-video method abuse", () => {
    const base = artifact({}, 1800).source.coverage;
    for (const bad of [
      { ...base, parts: base.parts.slice(0, 2) },
      { ...base, durationSeconds: 2000 },
      {
        ...base,
        parts: [
          base.parts[0],
          { startSeconds: 601, endSeconds: 1200 },
          base.parts[2],
        ],
      },
      { ...base, durationBasis: "AI guessed" },
      { scope: "whole", method: "full-text", durationSeconds: 1800 },
    ])
      assert.throws(() => f.validateCoverage(bad));
    assert.deepEqual(f.validateCoverage(base), base);
  });
  await test("Backup cannot pair whole coverage with selected range or out-of-source timestamps", () => {
    const parts = f.wholeVideoParts(1800),
      merged = f.mergeWholeVideo(
        "Full",
        parts,
        parts.map((p) => summary(p)),
      );
    const mixed = artifact(merged, 1800);
    mixed.source.range = { startSeconds: 0, endSeconds: 600 };
    assert.throws(() => storage.importLibrary(backup(mixed)), /INVALID_BACKUP/);
    const invalid = artifact(structuredClone(merged), 1800);
    invalid.summary.chapters[0].startSeconds = 1800;
    assert.throws(
      () => storage.importLibrary(backup(invalid)),
      /INVALID_SUMMARY/,
    );
  });
  await test("Backup keeps truncated-source evidence and distinguishes supplied text from entire video", () => {
    const info = {
      kind: "website",
      fetchedAt: "2026-10-03T01:00:00Z",
      truncated: true,
    };
    assert.equal(
      storage.importLibrary(backup(null, info)).items[0].sourceInfo.truncated,
      true,
    );
    assert.deepEqual(
      f.validateCoverage({ scope: "whole", method: "full-text" }),
      { scope: "whole", method: "full-text" },
    );
  });
  console.log(`${passed} whole-summary checks passed`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
