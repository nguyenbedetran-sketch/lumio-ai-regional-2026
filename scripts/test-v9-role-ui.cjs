// Re-run existing real-component workflows with current CSS, isolated V9 files
// and additional layout/theme/focus observations. No dev server is used.
const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  cli = path.join(root, "node_modules/@playwright/cli/playwright-cli.js"),
  folder = path.join(root, "work/v9-role-regression"),
  requested = process.argv.slice(2),
  suites = requested.length
    ? requested
    : ["teaching", "grade-history", "assessment", "admin"];
const replacements = [
  ["work/v7-teaching-ui", "work/v9-role-teaching"],
  ["work/v7-grade-history-ui", "work/v9-role-grade-history"],
  ["work/teacher-admin-ui", "work/v9-role-admin"],
  ["docs/v7/qa-", "docs/v9/qa-role-"],
  ["docs/v3/qa-", "docs/v9/qa-role-"],
  ["docs/v8/qa-", "docs/v9/qa-role-"],
];
function rewrite(source) {
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  return source;
}
function fixture(file, transform = (s) => s) {
  const filename = path.join(root, file),
    m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  m._compile(transform(fs.readFileSync(filename, "utf8")), filename);
  return m.exports.build();
}
const teaching = fixture("tests/v7-teaching-ui-fixture.cjs", rewrite),
  admin = suites.includes("admin")
    ? fixture("tests/teacher-admin-fixture.cjs", (s) =>
        s.replaceAll('"teacher-admin-ui"', '"v9-role-admin"'),
      )
    : null,
  gradeFolder = path.join(root, "work/v9-role-grade-history");
fs.mkdirSync(folder, { recursive: true });
fs.mkdirSync(gradeFolder, { recursive: true });
fs.mkdirSync(path.join(root, "docs/v9"), { recursive: true });
for (const file of ["fixture.js", "fixture.css", "fixture.html"])
  fs.copyFileSync(
    path.join(teaching.folder, file),
    path.join(gradeFolder, file),
  );
const matrix = fs.readFileSync(
    path.join(root, "tests/v9-role-matrix.fragment.js"),
    "utf8",
  ),
  definitions = {
    teaching: {
      source: "tests/v7-teaching-ui.browser.js",
      anchor:
        '  await page.screenshot({\n    path: "docs/v7/qa-teaching-desktop.png",',
      insert: '  await v9Matrix("teacher", "[data-teacher-workspace]");\n',
      studentAnchor:
        '  await page.screenshot({\n    path: "docs/v7/qa-classroom-mobile.png",',
      studentInsert:
        '  await v9Matrix("classroom", "[data-student-classroom]");\n',
    },
    "grade-history": { source: "tests/v7-grade-history-ui.browser.js" },
    assessment: {
      source: "tests/v8-assessment-ui.browser.js",
      anchor:
        '  await page.screenshot({\n    path: "docs/v8/qa-assessment-mobile.png",',
      insert:
        '  await v9Matrix("assessment-editor", ".tw-shell", "dialog,[role=dialog]");\n',
    },
    admin: {
      source: "tests/teacher-admin.browser.js",
      anchor: "  failNext = true;\n  await panel",
      insert: '  await v9Matrix("admin", ".ad-shell");\n',
    },
  };
function call(session, ...args) {
  const r = spawnSync(
    process.execPath,
    [cli, `-s=${session}`, ...args, "--json"],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 240000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (r.error || r.status !== 0)
    throw r.error || Error(r.stdout || r.stderr || "CLI_FAILED");
  const value = JSON.parse(r.stdout);
  if (value.isError || value.error)
    throw Error(JSON.stringify(value).slice(0, 2400));
  return value;
}
let failures = 0;
for (const suite of suites) {
  const spec = definitions[suite];
  if (!spec) throw Error("UNKNOWN_SUITE:" + suite);
  const session = `lumio-v9-role-${suite}-${process.pid}-${Date.now()}`,
    report = path.join(root, `docs/v9/qa-role-${suite}-report.json`),
    output = path.join(folder, suite + ".js");
  try {
    let source = fs
      .readFileSync(path.join(root, spec.source), "utf8")
      .replace(/\r\n/g, "\n")
      .trim()
      .replace(/;$/, "");
    source = source.replace(
      "async (page) => {",
      "async (page) => {\n" + matrix,
    );
    for (const [anchor, insert] of [
      [spec.anchor, spec.insert],
      [spec.studentAnchor, spec.studentInsert],
    ]) {
      if (!anchor) continue;
      if (!source.includes(anchor))
        throw Error("MATRIX_ANCHOR_MISSING:" + suite);
      source = source.replace(anchor, insert + anchor);
    }
    source = rewrite(source).replace(
      'status: "PASS",',
      'status: "PASS", v9Layout: v9Observations, v9Findings,',
    );
    fs.writeFileSync(output, source);
    fs.writeFileSync(
      report,
      JSON.stringify(
        { status: "RUNNING", checkedAt: new Date().toISOString() },
        null,
        2,
      ),
    );
    call(session, "open", "about:blank", "--browser=msedge");
    const result = call(
        session,
        "run-code",
        "--filename=" + path.relative(root, output).replaceAll("\\", "/"),
      ),
      data =
        typeof result.result === "string"
          ? JSON.parse(result.result)
          : result.result;
    if (!data || !["PASS", "FAIL"].includes(data.status))
      throw Error("NO_RESULT:" + JSON.stringify(result).slice(0, 1500));
    const final = {
      ...data,
      checkedAt: new Date().toISOString(),
      fixtureChecks: suite === "admin" ? admin.unitChecks : teaching.unitChecks,
      isolation:
        "Current actual React/CSS + authored identity/HTTP fixtures, isolated Edge session/output files. No auth browser, live server, real students, provider or public writes.",
      layoutStatus: data.v9Findings?.length
        ? "FINDINGS"
        : data.v9Layout?.length
          ? "PASS"
          : "NOT_ADDED_TO_THIS_WORKFLOW",
    };
    fs.writeFileSync(report, JSON.stringify(final, null, 2) + "\n");
    console.log(
      JSON.stringify({
        suite,
        status: final.status,
        checks: final.passed,
        layoutCases: final.v9Layout?.length,
        findings: final.v9Findings,
        report: path.relative(root, report),
      }),
    );
    if (final.status !== "PASS") failures++;
  } catch (error) {
    failures++;
    fs.writeFileSync(
      report,
      JSON.stringify(
        {
          status: "FAIL",
          checkedAt: new Date().toISOString(),
          error: error.message.slice(0, 3000),
        },
        null,
        2,
      ) + "\n",
    );
    console.error(suite + ": " + error.message.slice(0, 800));
  } finally {
    try {
      call(session, "close");
    } catch {}
  }
}
if (failures) process.exitCode = 1;
