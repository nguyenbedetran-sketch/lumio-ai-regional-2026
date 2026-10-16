// E2 evidence is separate from the frozen E1 history report.
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  assert = require("node:assert/strict"),
  { build: buildTeaching } = require("./v7-teaching-ui-fixture.cjs");
function build() {
  const built = buildTeaching(),
    root = path.resolve(__dirname, ".."),
    folder = path.join(root, "work/v7-practice-ui");
  fs.mkdirSync(folder, { recursive: true });
  for (const f of ["fixture.html", "fixture.js", "fixture.css"])
    fs.copyFileSync(path.join(built.folder, f), path.join(folder, f));
  const cache = new Map();
  function load(f) {
    if (cache.has(f)) return cache.get(f).exports;
    const m = { exports: {} };
    cache.set(f, m);
    const source = ts.transpileModule(fs.readFileSync(f, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    new Function("require", "module", "exports", source)(
      (n) => {
        if (!n.startsWith(".")) return require(n);
        const base = path.resolve(path.dirname(f), n);
        return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
      },
      m,
      m.exports,
    );
    return m.exports;
  }
  let checks = 0;
  const check = (a, b) => {
    assert.deepEqual(a, b);
    checks++;
  };
  const { observedErrors } = load(
      path.join(root, "components/teaching/observed-errors.ts"),
    ),
    {
      assessmentDate,
      localAssessmentDate,
      availabilityLabel,
      AssessmentWindow,
      AssignmentAttempt,
    } = load(path.join(root, "components/teaching/assessment-window.tsx"));
  const q = {
    id: "q",
    revision: 1,
    kind: "mcq",
    prompt: "Tính",
    topic: "Toán",
    choices: ["1", "2"],
    correctIndex: 1,
  };
  const d = {
    assignments: [
      { id: "root", questions: [q] },
      { id: "child", questions: [q] },
    ],
    submissions: [
      {
        assignmentId: "root",
        status: "published",
        countsTowardAnalytics: false,
        answers: [{ questionId: "q", response: 0 }],
      },
      {
        assignmentId: "child",
        status: "published",
        countsTowardAnalytics: true,
        answers: [{ questionId: "q", response: 1 }],
      },
    ],
  };
  check(observedErrors(d)[0].observed, 1);
  check(observedErrors(d)[0].wrong, 0);
  check(observedErrors(d)[0].counts, [0, 1]);
  d.submissions[1].status = "graded";
  check(observedErrors(d), []);
  d.submissions[0].countsTowardAnalytics = true;
  check(observedErrors(d)[0].wrong, 1);
  delete d.submissions[0].countsTowardAnalytics;
  check(observedErrors(d)[0].observed, 1);
  check(assessmentDate(""), null);
  check(localAssessmentDate("bad"), "");
  const local = "2099-01-02T10:20";
  check(assessmentDate(local), new Date(local).toISOString());
  check(localAssessmentDate(assessmentDate(local)), local);
  assert.throws(() => assessmentDate("bad"));
  checks++;
  check(Object.keys(availabilityLabel).length, 6);
  const React = require("react"),
    { renderToStaticMarkup } = require("react-dom/server"),
    a = {
      practiceRetake: true,
      attemptNo: 2,
      availableFrom: "2099-01-01T00:00:00Z",
      availableUntil: "2099-01-02T00:00:00Z",
    };
  assert.match(
    renderToStaticMarkup(
      React.createElement(AssignmentAttempt, { assignment: a }),
    ),
    /Luyện lại cùng đề/,
  );
  checks++;
  assert.match(
    renderToStaticMarkup(
      React.createElement(AssessmentWindow, { assignment: a }),
    ),
    /Đóng cứng/,
  );
  checks++;
  check(
    renderToStaticMarkup(
      React.createElement(AssessmentWindow, { assignment: {} }),
    ),
    "",
  );
  return {
    ...built,
    folder,
    baselineUnitChecks: built.unitChecks,
    unitChecks: checks,
  };
}
module.exports = { build };
if (require.main === module)
  console.log(JSON.stringify({ status: "PASS", ...build() }));
