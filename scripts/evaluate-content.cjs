// Explicit bounded provider evaluation, using authored fixtures only, never student data.
const fs = require("node:fs"),
  path = require("node:path"),
  zlib = require("node:zlib"),
  ts = require("typescript");
const root = path.resolve(__dirname, "..");
if (!process.argv.includes("--live")) {
  console.error(
    "No provider calls made. Run node scripts/evaluate-content.cjs --live to evaluate authored fixtures (at most 6 HTTP provider requests).",
  );
  process.exit(2);
}
const envPath = path.join(root, ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("BLOCKED: .env.local is missing. No provider calls made.");
  process.exit(2);
}
for (const name of Object.keys(process.env))
  if (/^(OPENAI_|GEMINI_|LUMIO_AI_ENABLED$)/.test(name))
    delete process.env[name];
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (
    !match ||
    !/^((?:OPENAI|GEMINI)_(?:API_KEY|MODEL(?:_[A-Z]+)?)|LUMIO_AI_ENABLED)$/.test(
      match[1],
    )
  )
    continue;
  let value = match[2].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  )
    value = value.slice(1, -1);
  else value = value.replace(/\s+#.*$/, "");
  process.env[match[1]] = value;
}
process.env.LUMIO_AI_ENABLED = "true";
process.env.LUMIO_DESKTOP = "false";
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
const SOURCE = String.raw`# Ôn tập Toán 9: giữ điều kiện và kiểm tra kết quả

Với phương trình 2x + 3 = 11, trừ 3 ở cả hai vế được 2x = 8. Vì 2 khác 0, chia hai vế cho 2 được x = 4. Thay lại: 2·4 + 3 = 11. Nghiệm là x = 4.

Biểu thức (x² − 1)/(x − 1) có điều kiện xác định x ≠ 1. Do x² − 1 = (x − 1)(x + 1), biểu thức bằng x + 1 chỉ khi x ≠ 1. Không được bỏ điều kiện sau khi rút gọn.

Xét phương trình (x² − 1)/(x − 1) = 2. Điều kiện x ≠ 1. Sau khi rút gọn trong điều kiện đã có, x + 1 = 2 cho ứng viên x = 1. Giá trị này bị loại vì không thỏa điều kiện ban đầu. Phương trình vô nghiệm, không được kết luận x = 1 là nghiệm.

Phương trình √(x + 1) = 3 có điều kiện x ≥ −1. Bình phương hai vế được x + 1 = 9, nên x = 8. Thử lại √(8 + 1) = 3, nên x = 8 thỏa mãn. Sau phép bình phương phải kiểm tra nghiệm với phương trình ban đầu.

Một tam giác vuông có hai cạnh góc vuông dài 6 cm và 8 cm. Định lý Pythagore cho cạnh huyền c = √(6² + 8²) = 10 cm. Diện tích S = (1/2)·6·8 = 24 cm². Cần phân biệt độ dài 10 cm với diện tích 24 cm².

Khi học từ tài liệu này, hãy phân biệt điều kiện xác định, bước biến đổi và kết luận. Một phép thử số chỉ kiểm tra ứng viên đó; không tự chứng minh rằng đã tìm đủ tất cả nghiệm.`;
const expectedFacts = [
  {
    id: "linear",
    fact: "2x+3=11 has x=4; substituting gives 11",
    reference: "x = 4",
  },
  {
    id: "domain",
    fact: "(x²−1)/(x−1) requires x≠1 even after cancellation",
    reference: "Không được bỏ điều kiện",
  },
  {
    id: "extraneous",
    fact: "(x²−1)/(x−1)=2 has no solution, x=1 is excluded",
    reference: "Phương trình vô nghiệm",
  },
  {
    id: "radical",
    fact: "sqrt(x+1)=3 requires x≥−1 and yields checked x=8",
    reference: "x = 8",
  },
  {
    id: "geometry",
    fact: "Right triangle legs6cm8cm: hypotenuse10cm, area24cm²",
    reference: "24 cm²",
  },
];
function crc32(data) {
  let c = 0xffffffff;
  for (const b of data) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, body) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, body])));
  return Buffer.concat([length, name, body, crc]);
}
function equationPNG() {
  const glyphs = {
    2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    x: ["00000", "10001", "01010", "00100", "01010", "10001", "00000"],
    "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
    "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
    " ": Array(7).fill("00000"),
  };
  const width = 1200,
    height = 220,
    scale = 15,
    line = "2x + 3 = 11",
    pixels = Buffer.alloc((width * 3 + 1) * height, 255);
  for (let y = 0; y < height; y++) pixels[y * (width * 3 + 1)] = 0;
  const left = Math.floor((width - (line.length * 6 - 1) * scale) / 2),
    top = Math.floor((height - 7 * scale) / 2);
  if (left < 0 || top < 0) throw new Error("VISION_FIXTURE_BOUNDS");
  [...line].forEach((char, col) =>
    glyphs[char].forEach((row, y) =>
      [...row].forEach((value, x) => {
        if (value !== "1") return;
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const i =
              (top + y * scale + dy) * (width * 3 + 1) +
              1 +
              (left + (col * 6 + x) * scale + dx) * 3;
            pixels[i] = pixels[i + 1] = pixels[i + 2] = 20;
          }
      }),
    ),
  );
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
async function main() {
  const ai = load("lib/ai/contracts.ts"),
    router = load("lib/ai/router.ts"),
    g = load("lib/ai/grounding.ts");
  const directory = path.join(root, "docs/regional");
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, "content-live-evaluation.json");
  const resumeVision = process.argv.includes("--resume-vision");
  const resumeQuiz = process.argv.includes("--resume-quiz");
  let report = {
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    maximumProviderRequests: 6,
    actualProviderRequests: 0,
    fixture: {
      authored: true,
      studentData: false,
      source: SOURCE,
      expectedFacts,
      visionEquation: "2x + 3 = 11",
    },
    scope:
      "Actual routeAI, structured validators and citation matching. This CLI does not exercise OAuth, authenticated HTTP, billing, tutor unlock or student learning outcomes.",
    requestLog: [],
    results: [],
    manualReview: {
      status: "PENDING",
      reviewer: "Not yet reviewed against authored reference",
      semanticAccuracyClaim: false,
    },
  };
  if (resumeVision || resumeQuiz) {
    const previous = JSON.parse(fs.readFileSync(file, "utf8"));
    if (
      previous.fixture?.source !== SOURCE ||
      !Number.isInteger(previous.actualProviderRequests) ||
      previous.actualProviderRequests >= 6 ||
      !["summary", "cards", "quiz"].every((task) =>
        previous.results?.some((r) => r.task === task && r.status === "PASS"),
      )
    )
      throw new Error("INVALID_EVALUATION_RESUME");
    report = previous;
    if (resumeVision) {
      report.priorVisionResponses = (report.priorVisionResponses || []).concat(
        report.results
          .filter((r) => r.task === "vision")
          .map((r) => ({
            ...r,
            fixtureImage: "content-vision-equation-fixture-initial-clipped.png",
            assessment:
              "Initial fixture canvas was too narrow and clipped characters. This response is preserved as an input-quality/uncertainty observation, not a transcription accuracy score.",
          })),
      );
      report.results = report.results.filter((r) => r.task !== "vision");
      report.status = "RUNNING";
      report.visionCorrection = {
        reason:
          "Corrected authored fixture canvas bounds before a single explicit vision-only retry.",
        priorCallsStillCounted: true,
      };
    } else {
      report.priorQuizResponses = (report.priorQuizResponses || []).concat(
        report.results
          .filter((r) => r.task === "quiz")
          .map((r) => ({
            ...r,
            assessment:
              "Manual review found a false blanket statement that dividing by an unknown x is meaningless. Correct rule requires nonzero divisor. Answer indices and five source excerpts were correct; original response retained.",
          })),
      );
      report.results = report.results.filter((r) => r.task !== "quiz");
      report.status = "RUNNING";
      report.quizCorrection = {
        reason:
          "Added explicit nonzero-divisor mathematical instruction, followed by one explicit final live quiz call.",
        priorCallsStillCounted: true,
      };
    }
  }
  const save = () =>
    fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
  save();
  let current = "";
  const transport = async (url, options) => {
    if (report.actualProviderRequests >= 6)
      throw new ai.AIError("EVALUATION_REQUEST_BUDGET", 429);
    const target = new URL(url);
    if (
      !["api.openai.com", "generativelanguage.googleapis.com"].includes(
        target.hostname,
      ) ||
      target.protocol !== "https:"
    )
      throw new ai.AIError("EVALUATION_ENDPOINT_BLOCKED", 400);
    report.actualProviderRequests++;
    const entry = {
      number: report.actualProviderRequests,
      task: current,
      provider: target.hostname === "api.openai.com" ? "openai" : "gemini",
      startedAt: new Date().toISOString(),
    };
    report.requestLog.push(entry);
    save();
    const response = await fetch(url, options);
    entry.httpStatus = response.status;
    entry.finishedAt = new Date().toISOString();
    save();
    return response;
  };
  for (const task of resumeQuiz
    ? ["quiz"]
    : resumeVision
      ? []
      : ["summary", "cards", "quiz"]) {
    current = task;
    const startedAt = new Date().toISOString();
    try {
      const input = ai.validateInput({
        task,
        question:
          "Tạo học liệu ngắn gọn chỉ từ bài học đã cung cấp. Giữ điều kiện, công thức, đơn vị và các trường hợp loại nghiệm. Mỗi mục cần trích dẫn đoạn hỗ trợ; không thêm kiến thức ngoài nguồn.",
        source: SOURCE,
        language: "vi",
        mode: "quick",
        difficulty: "beginner",
        history: [],
      });
      const result = await router.routeAI(input, transport);
      const items =
        result.summary?.chapters || result.cards || result.questions || [];
      report.results.push({
        task,
        status: "PASS",
        meaning:
          "Actual provider response parsed and structural checks passed; semantic review remains separate.",
        startedAt,
        finishedAt: new Date().toISOString(),
        provider: result.provider,
        model: result.model,
        output: result,
        referenceAudit: items.map((item, index) => ({
          index,
          matchingReferences: g.validateReferences(item.references, SOURCE)
            .length,
          unmatchedModelLocationsAccepted: false,
        })),
      });
      console.log(`PASS actual ${task} response and structural validation`);
    } catch (error) {
      report.results.push({
        task,
        status: "FAIL",
        startedAt,
        finishedAt: new Date().toISOString(),
        errorCode:
          typeof error.code === "string" ? error.code : "EVALUATION_ERROR",
      });
      console.log(
        `FAIL ${task}: ${typeof error.code === "string" ? error.code : "EVALUATION_ERROR"}`,
      );
    }
    save();
  }
  if (!resumeQuiz) {
    current = "vision";
    const image = equationPNG(),
      imagePath = path.join(directory, "content-vision-equation-fixture.png");
    fs.writeFileSync(imagePath, image);
    try {
      const input = ai.validateInput({
        task: "chat",
        question:
          "Chỉ chép lại chính xác phương trình trong ảnh. Không giải, không suy đoán nếu không đọc được.",
        source: "",
        language: "vi",
        mode: "quick",
        guidance: "hints",
        media: { mimeType: "image/png", data: image.toString("base64") },
        history: [],
      });
      const result = await router.routeAI(input, transport);
      report.results.push({
        task: "vision",
        status: "PASS",
        meaning:
          "Actual image response received. Transcription accuracy requires the separate review below.",
        provider: result.provider,
        model: result.model,
        output: result,
        fixtureImage: "content-vision-equation-fixture.png",
      });
      console.log("PASS actual vision response received");
    } catch (error) {
      report.results.push({
        task: "vision",
        status: "FAIL",
        errorCode:
          typeof error.code === "string" ? error.code : "EVALUATION_ERROR",
      });
      console.log(
        `FAIL vision: ${typeof error.code === "string" ? error.code : "EVALUATION_ERROR"}`,
      );
    }
  }
  report.status = report.results.every((r) => r.status === "PASS")
    ? "PARTIAL"
    : "FAIL";
  report.finishedAt = new Date().toISOString();
  report.note =
    "PARTIAL means actual responses/structural checks passed but manual content review is still pending. Never interpret structural PASS as semantic accuracy.";
  save();
  console.log(
    `Saved authored-fixture report; ${report.actualProviderRequests}/6 provider HTTP requests. No keys, OAuth sessions or student data written.`,
  );
}
if (process.argv.includes("--prepare-vision")) {
  const dir = path.join(root, "docs/regional");
  fs.mkdirSync(dir, { recursive: true });
  const image = path.join(dir, "content-vision-equation-fixture.png");
  if (
    fs.existsSync(image) &&
    !fs.existsSync(
      path.join(dir, "content-vision-equation-fixture-initial-clipped.png"),
    )
  )
    fs.copyFileSync(
      image,
      path.join(dir, "content-vision-equation-fixture-initial-clipped.png"),
    );
  fs.writeFileSync(image, equationPNG());
  console.log("Prepared corrected equation PNG; no provider calls.");
} else
  main().catch((error) => {
    console.error(
      typeof error.code === "string" ? error.code : "EVALUATION_ERROR",
    );
    process.exitCode = 1;
  });
