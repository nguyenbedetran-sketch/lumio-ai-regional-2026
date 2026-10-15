// Explicit paid live smoke test: one synthetic 24-second video, one 8-second clip.
// Run manually only. Credentials stay in process memory and are never printed.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
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
async function main() {
  process.loadEnvFile(path.join(root, ".env.local"));
  if (
    !process.env.GEMINI_API_KEY ||
    !process.env.GEMINI_MODEL ||
    process.env.LUMIO_AI_ENABLED !== "true"
  )
    throw Error("GEMINI_NOT_CONFIGURED");
  const directory = path.join(root, ".data");
  fs.mkdirSync(directory, { recursive: true });
  const video = path.join(directory, "video-range-synthetic.mp4");
  const font = "fontfile='C\\:/Windows/Fonts/arial.ttf'";
  const filters = [
    "drawbox=x=0:y=0:w=iw:h=ih:color=0x761c24:t=fill:enable='lt(t,12)'",
    "drawbox=x=0:y=0:w=iw:h=ih:color=0x14385c:t=fill:enable='gte(t,12)'",
    `drawtext=${font}:text='RED CARD':fontcolor=white:fontsize=45:x=(w-tw)/2:y=105:enable='lt(t,12)'`,
    `drawtext=${font}:text='EXCLUDED-APPLE-418':fontcolor=white:fontsize=25:x=(w-tw)/2:y=190:enable='lt(t,12)'`,
    `drawtext=${font}:text='BLUE CARD':fontcolor=white:fontsize=45:x=(w-tw)/2:y=105:enable='gte(t,12)'`,
    `drawtext=${font}:text='LUMIO-OCEAN-729':fontcolor=white:fontsize=25:x=(w-tw)/2:y=190:enable='gte(t,12)'`,
  ].join(",");
  const encoded = process.argv.includes("--prepared")
    ? { status: 0 }
    : spawnSync(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-f",
          "lavfi",
          "-i",
          "color=c=black:s=640x360:r=2:d=24",
          "-vf",
          filters,
          "-an",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-crf",
          "28",
          "-movflags",
          "+faststart",
          video,
        ],
        { encoding: "utf8", windowsHide: true, timeout: 30000 },
      );
  if (encoded.status !== 0) throw Error("SYNTHETIC_VIDEO_GENERATION_FAILED");
  const bytes = fs.readFileSync(video);
  if (bytes.length > 6 * 1024 * 1024) throw Error("SYNTHETIC_VIDEO_TOO_LARGE");
  const { validateInput } = load("lib/ai/contracts.ts"),
    { routeAI } = load("lib/ai/router.ts");
  const range = { startSeconds: 14, endSeconds: 22 };
  const input = validateInput({
    task: "summary",
    question:
      "Summarize only the visible card inside the selected section. Include the exact large heading and identifier printed on the card, and its background color. Include approximate startSeconds at the first observed absolute original-video time when you can determine it. Do not infer any information from the filename.",
    source: "",
    language: "en",
    mode: "quick",
    media: { mimeType: "video/mp4", data: bytes.toString("base64") },
    videoRange: range,
  });
  let requests = 0;
  const started = Date.now();
  const result = await routeAI(input, async (...args) => {
    if (++requests > 1) throw Error("SINGLE_REQUEST_LIMIT");
    return fetch(...args);
  });
  const text = JSON.stringify(result.summary || {}).toUpperCase();
  const timestamps =
    result.summary?.chapters.map((c) => ({
      title: c.title,
      startSeconds: c.startSeconds,
      timestampKind: c.timestampKind,
    })) || [];
  const checks = {
    singleRequest: requests === 1,
    realSummary: !!result.summary,
    recognizesSelectedCard:
      text.includes("BLUE CARD") && text.includes("LUMIO-OCEAN-729"),
    excludesEarlierCard:
      !text.includes("RED CARD") && !text.includes("EXCLUDED-APPLE-418"),
    hasAbsoluteTimestamp: timestamps.some(
      (t) =>
        t.startSeconds >= range.startSeconds &&
        t.startSeconds < range.endSeconds,
    ),
    allTimestampsWithinRange: timestamps.every(
      (t) =>
        t.startSeconds === undefined ||
        (t.startSeconds >= range.startSeconds &&
          t.startSeconds < range.endSeconds),
    ),
  };
  const report = {
    checkedAt: new Date().toISOString(),
    pass: Object.values(checks).every(Boolean),
    syntheticInput: true,
    durationSeconds: 24,
    bytes: bytes.length,
    requestedRange: range,
    elapsedMs: Date.now() - started,
    provider: result.provider,
    model: result.model,
    checks,
    timestamps,
    summary: result.summary,
  };
  fs.writeFileSync(
    path.join(directory, "video-range-smoke.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      pass: report.pass,
      checks,
      timestamps,
      elapsedMs: report.elapsedMs,
      report: ".data/video-range-smoke.json",
    }),
  );
  if (!report.pass) process.exitCode = 1;
}
main().catch((error) => {
  const code = /^[A-Z0-9_]+$/.test(error.message || "")
    ? error.message
    : "VIDEO_RANGE_LIVE_CHECK_FAILED";
  const directory = path.join(root, ".data");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, "video-range-smoke.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        pass: false,
        syntheticInput: true,
        error: code,
      },
      null,
      2,
    ),
  );
  console.error(code);
  process.exitCode = 1;
});
