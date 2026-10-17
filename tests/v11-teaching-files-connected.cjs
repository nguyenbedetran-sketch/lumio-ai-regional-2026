const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  { spawnSync } = require("node:child_process"),
  { createHash } = require("node:crypto"),
  { zipSync, strToU8 } = require("fflate");
const root = path.resolve(__dirname, ".."),
  fixturePath = path.resolve(process.argv[2] || ""),
  parent = path.dirname(fixturePath),
  reportRelative =
    "docs/next/reports/teaching-files-browser/connected-report.json",
  reportPath = path.join(root, reportRelative),
  session = `lumio-connected-files-${process.pid}-${Date.now()}`,
  cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js");
if (
  !fixturePath.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
  path.basename(fixturePath) !== "browser-session.json"
)
  throw Error("PRIVATE_OS_TEMP_FIXTURE_REQUIRED");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")),
  origin = new URL(fixture.origin);
if (
  !["127.0.0.1", "localhost"].includes(origin.hostname) ||
  origin.protocol !== "http:" ||
  path.dirname(path.resolve(fixture.donePath)) !== parent
)
  throw Error("ISOLATED_FIXTURE_REQUIRED");
const privateCode = path.join(parent, "connected-browser.js"),
  redact = (value) => {
    let out = String(value);
    for (const user of [fixture.teacher, fixture.student, fixture.otherStudent])
      for (const secret of [user?.cookie, user?.key, user?.id])
        if (secret) out = out.split(secret).join("[synthetic private session]");
    return out.replace(/eyJ[A-Za-z0-9_.-]{30,}/g, "[redacted session]");
  };
const file = (name, mime, data) => {
  const bytes = Buffer.from(data);
  return {
    name,
    mime,
    base64: bytes.toString("base64"),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    data: Array.from(bytes),
    downloadPath: path.join(parent, "download-" + name),
  };
};
const files = {
  reference: file(
    "SYNTHETIC-reference.md",
    "text/markdown",
    "Authored practice reference. Add the two groups to compare the result.\n",
  ),
  private: file(
    "SYNTHETIC-teacher-key.md",
    "text/markdown",
    "Private authored teacher answer key; never a student reference.\n",
  ),
  answers: [
    file(
      "SYNTHETIC-answer.png",
      "image/png",
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=",
        "base64",
      ),
    ),
    file(
      "SYNTHETIC-worksheet.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      zipSync({
        "[Content_Types].xml": strToU8(
          '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        ),
        "word/document.xml": strToU8(
          "<w:document><w:p>Authored worksheet</w:p></w:document>",
        ),
      }),
    ),
    file(
      "SYNTHETIC-slides.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      zipSync({
        "[Content_Types].xml": strToU8(
          '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>',
        ),
        "ppt/presentation.xml": strToU8("<p:presentation/>"),
      }),
    ),
  ],
};
function call(...args) {
  const run = spawnSync(
    process.execPath,
    [cli, `-s=${session}`, ...args, "--json"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 5 * 1024 * 1024,
    },
  );
  if (run.error || run.status !== 0)
    throw Error(
      redact(
        run.error?.message || run.stdout || run.stderr || "CLI_FAILED",
      ).slice(0, 2200),
    );
  const value = JSON.parse(run.stdout);
  if (value.error || value.isError)
    throw Error(redact(JSON.stringify(value)).slice(0, 2200));
  return value;
}
let final;
try {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const source = fs
    .readFileSync(
      path.join(root, "tests/teaching-files-connected.browser.js"),
      "utf8",
    )
    .trim()
    .replace(/;$/, "")
    .replace("__SESSION__", JSON.stringify(fixture))
    .replace("__FILES__", JSON.stringify(files));
  fs.writeFileSync(privateCode, source, { mode: 0o600 });
  call("open", "about:blank", "--browser=msedge");
  const result = call("run-code", "--filename=" + privateCode);
  let detail = result.result;
  for (let i = 0; i < 3 && typeof detail === "string"; i++)
    detail = JSON.parse(detail);
  if (!["PASS", "FAIL"].includes(detail?.status))
    throw Error(
      "CONNECTED_BROWSER_NOT_EXECUTED:" +
        redact(JSON.stringify(result)).slice(0, 1600),
    );
  final = {
    ...detail,
    checkedAt: new Date().toISOString(),
    tool: "@playwright/cli@0.1.21",
    officeFixtureScope:
      "Authored minimal OOXML packages verify storage and type checks; Office application opening/rendering not tested",
    sourceSha256: Object.fromEntries(
      [
        "tests/teaching-files-connected.browser.js",
        "tests/v11-teaching-files-connected.cjs",
        "components/teaching/file-attachments.tsx",
        "components/teaching/student.tsx",
        "components/teaching/assessment.tsx",
        "lib/teaching/file-client.ts",
        "lib/server/teaching-files.ts",
        "lib/server/teaching-file-validation.ts",
      ].map((file) => [
        file,
        createHash("sha256")
          .update(fs.readFileSync(path.join(root, file)))
          .digest("hex"),
      ]),
    ),
    compiledBuildIdSha256: createHash("sha256")
      .update(fs.readFileSync(path.join(root, ".next/BUILD_ID")))
      .digest("hex"),
  };
  if (final.status === "PASS") {
    final.downloadVerification =
      "Native browser download event and saveAs; Node compares actual saved bytes and SHA-256, avoiding CDP attachment-body limitations";
    for (const file of files.answers) {
      const actual = fs.readFileSync(file.downloadPath),
        digest = createHash("sha256").update(actual).digest("hex");
      if (
        actual.length !== file.bytes ||
        digest !== file.sha256 ||
        !actual.equals(Buffer.from(file.base64, "base64"))
      ) {
        final.status = "FAIL";
        final.error = "NATIVE_DOWNLOAD_BYTES_MISMATCH:" + file.name;
        break;
      }
      final.cases.push(
        "Native browser-saved " +
          file.name +
          " exactly matches authored bytes and SHA-256",
      );
      final.passed++;
      const receipt = final.downloads.find(
        (row) => row.format === file.name.split(".").at(-1),
      );
      receipt.bytes = actual.length;
      receipt.sha256 = digest;
      receipt.exactBytesVerified = true;
    }
  }
} catch (error) {
  final = {
    status: "FAIL",
    checkedAt: new Date().toISOString(),
    passed: 0,
    error: redact(error.message).slice(0, 2500),
  };
} finally {
  try {
    call("close");
  } catch {}
  if (fs.existsSync(privateCode)) fs.unlinkSync(privateCode);
}
fs.writeFileSync(reportPath, redact(JSON.stringify(final, null, 2)) + "\n");
fs.writeFileSync(
  fixture.donePath,
  JSON.stringify({
    status: final.status,
    passed: final.passed || 0,
    report: reportRelative,
  }) + "\n",
);
console.log(redact(JSON.stringify(final, null, 2)));
if (final.status !== "PASS") process.exitCode = 1;
