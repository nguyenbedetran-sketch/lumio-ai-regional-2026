const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  { spawnSync } = require("node:child_process"),
  { createHash } = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  teacherFile = path.join(root, "tests/teacher-self-fixture.cjs"),
  teacher = new Module(teacherFile, module);
teacher.filename = teacherFile;
teacher.paths = Module._nodeModulePaths(path.dirname(teacherFile));
teacher._compile(
  fs
    .readFileSync(teacherFile, "utf8")
    .replaceAll("work/teacher-self-ui", "work/storage-notice-teacher"),
  teacherFile,
);
const teacherFixture = teacher.exports.build(),
  teaching = require("./v7-teaching-ui-fixture.cjs").build({
    folder: path.join(root, "work/storage-notice-classroom"),
  });
const folder = path.join(root, "docs/next/reports/teaching-storage-notice"),
  session = "storage-notice-" + process.pid + "-" + Date.now(),
  cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js");
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(
  path.join(teaching.folder, "browser.js"),
  fs
    .readFileSync(
      path.join(root, "tests/teaching-storage-notice.browser.js"),
      "utf8",
    )
    .trim()
    .replace(/;$/, ""),
);
function call(...args) {
  const run = spawnSync(
    process.execPath,
    [cli, "-s=" + session, ...args, "--json"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (run.error || run.status !== 0)
    throw run.error || Error(run.stdout || run.stderr || "CLI_FAILED");
  const value = JSON.parse(run.stdout);
  if (value.error || value.isError)
    throw Error(JSON.stringify(value).slice(0, 1800));
  return value;
}
let final;
try {
  call("open", "about:blank", "--browser=msedge");
  const result = call(
    "run-code",
    "--filename=work/storage-notice-classroom/browser.js",
  );
  let detail = result.result;
  for (let i = 0; i < 3 && typeof detail === "string"; i++)
    detail = JSON.parse(detail);
  if (!["PASS", "FAIL"].includes(detail?.status))
    throw Error("BROWSER_NOT_EXECUTED");
  final = {
    ...detail,
    checkedAt: new Date().toISOString(),
    inheritedSSRChecks: {
      teacher: teacherFixture.unitChecks,
      workspace: teaching.unitChecks,
    },
    sourceSha256: Object.fromEntries(
      [
        "components/teachers/portal.tsx",
        "components/teaching/workspace.tsx",
        "tests/teacher-self-fixture.cjs",
        "tests/teaching-storage-notice.browser.js",
        "tests/teaching-storage-notice.cjs",
      ].map((file) => [
        file,
        createHash("sha256")
          .update(fs.readFileSync(path.join(root, file)))
          .digest("hex"),
      ]),
    ),
  };
} catch (error) {
  final = { status: "FAIL", error: error.message.slice(0, 2200) };
} finally {
  try {
    call("close");
  } catch {}
}
fs.writeFileSync(
  path.join(folder, "report.json"),
  JSON.stringify(final, null, 2) + "\n",
);
console.log(JSON.stringify(final, null, 2));
if (final.status !== "PASS") process.exitCode = 1;
