// Reuse the established real-component workflow; keep accepted V7/V8/V9 proofs intact.
const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module");
const root = path.resolve(__dirname, ".."),
  file = path.join(root, "scripts/test-v9-role-ui.cjs"),
  m = new Module(file, module);
m.filename = file;
m.paths = Module._nodeModulePaths(path.dirname(file));
fs.mkdirSync(path.join(root, "docs/v9/role-theme"), { recursive: true });
let source = fs
  .readFileSync(file, "utf8")
  .replaceAll("work/v9-role-", "work/v9-teacher-theme-")
  .replaceAll("docs/v9/qa-role-", "docs/v9/role-theme/teacher-")
  .replace(
    '"tests/v9-role-matrix.fragment.js"',
    '"tests/v9-teacher-theme.fragment.js"',
  )
  .replace(
    '["teaching", "grade-history", "assessment", "admin"]',
    '["teaching", "grade-history", "assessment"]',
  );
// Replacements generated inside the inherited runner also need the isolated target.
source = source.replaceAll(
  '"docs/v9/qa-role-"',
  '"docs/v9/role-theme/teacher-"',
);
const history = {
  source: "tests/v7-grade-history-ui.browser.js",
  anchor:
    '    await page.screenshot({\n      path: "docs/v7/qa-grade-history-teacher-desktop.png",',
  insert:
    '    await v9Matrix("grade-history-teacher", ".tw-shell", "dialog[open]");\n',
  studentAnchor:
    '    await page.screenshot({\n      path: "docs/v7/qa-grade-history-student-mobile.png",',
  studentInsert:
    '    await v9Matrix("grade-history-student", ".tw-shell", "dialog[open]");\n',
};
source = source
  .replace(
    /"grade-history": \{\s*source: "tests\/v7-grade-history-ui\.browser\.js"\s*\},/,
    '"grade-history": ' + JSON.stringify(history) + ",",
  )
  .replace(
    "...data,",
    `...data,
      workspaceCssSha256: require("node:crypto").createHash("sha256").update(fs.readFileSync(path.join(root, "app/teacher/workspace.css"))).digest("hex"),
      fixtureCssSha256: require("node:crypto").createHash("sha256").update(fs.readFileSync(path.join(teaching.folder, "fixture.css"))).digest("hex"),
      thresholds: { normalText: 4.5, largeText: 3, controls: 3, focus: 3 },`,
  );
m._compile(source, file);
