// Actual frontend components only. No product test route/auth bypass/seed data.
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  folder = path.join(root, "work/v7-teaching-ui");
function build() {
  fs.mkdirSync(folder, { recursive: true });
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(root, filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const m = { exports: {} };
    cache.set(filename, m);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    new Function("require", "module", "exports", source)(
      (name) => {
        if (name === "next-auth/react")
          return { signIn: async () => undefined };
        if (!name.startsWith(".")) return require(name);
        const base = path.resolve(path.dirname(filename), name);
        return load(
          [base + ".tsx", base + ".ts", base + ".js"].find(fs.existsSync),
        );
      },
      m,
      m.exports,
    );
    return m.exports;
  }
  const React = require("react"),
    { renderToStaticMarkup } = require("react-dom/server"),
    { TeacherWorkspace } = load("components/teaching/workspace.tsx"),
    { StudentClassroom } = load("components/teaching/student.tsx"),
    { csv } = load("components/teaching/ui.tsx");
  const html = renderToStaticMarkup(
    React.createElement(TeacherWorkspace, {
      account: {
        key: "qa-teaching-a",
        id: "qa-teacher-a",
        name: "KIỂM THỬ · GIÁO VIÊN",
      },
    }),
  );
  for (const label of [
    "Tổng quan",
    "Lớp học",
    "Studio bài giảng",
    "Bài tập",
    "Ngân hàng câu hỏi",
    "Chấm &amp; nhận xét",
    "Tiến bộ học tập",
    "Thư viện giảng dạy",
    "Bảng tin &amp; lịch",
    "Trợ lý giảng dạy",
    "Báo cáo",
    "Cài đặt",
  ])
    assert.ok(html.includes(label), label);
  assert.ok(!html.includes("PRIVATE_STUDENT_FIXTURE"));
  const guest = renderToStaticMarkup(
    React.createElement(StudentClassroom, {
      account: null,
      providers: { google: true, facebook: true },
    }),
  );
  assert.ok(guest.includes("Đăng nhập Google"));
  assert.ok(!guest.includes("<form"));
  const safe = csv([["=SUM(1,2)", "+cmd", "@test", "-12", 'normal"quoted']]);
  for (const marker of ["'=SUM", "'+cmd", "'@test", "'-12", 'normal""quoted'])
    assert.ok(safe.includes(marker));
  const { observedErrors } = load("components/teaching/observed-errors.ts");
  const { MathText } = load("components/lumio/math-text.tsx");
  const math = renderToStaticMarkup(
    React.createElement(
      "h3",
      {},
      React.createElement(MathText, {
        inline: true,
        text: "Tính \\(\\frac{1}{2}\\) <img src=x onerror=alert(1)>",
      }),
    ),
  );
  assert.ok(math.includes("katex"));
  assert.ok(math.includes("&lt;img"));
  assert.ok(!/<img\b/.test(math));
  assert.ok(!/<div\b/.test(math));
  const displayMath = renderToStaticMarkup(
    React.createElement(MathText, { text: "\\[x^2\\]" }),
  );
  assert.ok(displayMath.includes("katex-display"));
  const frozen = {
    id: "q1",
    revision: 1,
    kind: "mcq",
    prompt: "x + 1 = 3",
    topic: "Phương trình",
    choices: ["1", "2", "3", "4"],
    correctIndex: 1,
  };
  const observation = {
    assignments: [{ id: "a1", questions: [frozen] }],
    submissions: [
      {
        assignmentId: "a1",
        status: "published",
        answers: [{ questionId: "q1", response: 0 }],
      },
      {
        assignmentId: "a1",
        status: "graded",
        answers: [{ questionId: "q1", response: 0 }],
      },
      {
        assignmentId: "a1",
        status: "published",
        answers: [{ questionId: "q1", response: null }],
      },
    ],
  };
  let observed = observedErrors(observation);
  assert.equal(observed.length, 1);
  assert.equal(observed[0].observed, 1);
  assert.equal(observed[0].wrong, 1);
  assert.equal(observed[0].counts[0], 1);
  observation.assignments.push({
    id: "a2",
    questions: [{ ...frozen, revision: 2, correctIndex: 0 }],
  });
  observation.submissions.push({
    assignmentId: "a2",
    status: "published",
    answers: [{ questionId: "q1", response: 0 }],
  });
  observed = observedErrors(observation);
  assert.equal(observed.length, 2);
  assert.equal(observed.find((o) => o.revision === 2).wrong, 0);
  observation.assignments.push({
    id: "a3",
    questions: [{ ...frozen, correctIndex: 0 }],
  });
  observation.submissions.push({
    assignmentId: "a3",
    status: "published",
    answers: [{ questionId: "q1", response: 0 }],
  });
  assert.equal(
    observedErrors(observation).find((o) => o.revision === 1).observed,
    1,
  );
  const modules = [],
    ids = new Map();
  function bundle(filename) {
    if (ids.has(filename)) return ids.get(filename);
    const id = modules.length;
    ids.set(filename, id);
    modules.push("");
    let source = fs.readFileSync(filename, "utf8");
    if (/\.tsx?$/.test(filename))
      source = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          esModuleInterop: true,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText;
    source = source.replace(
      /require\((["'])([^"']+)\1\)/g,
      (_all, _quote, name) => {
        if (name === "next-auth/react")
          return "({signIn:async()=>{window.__teachingSignIns++;}})";
        let target;
        if (name.startsWith(".")) {
          const base = path.resolve(path.dirname(filename), name);
          target = [base, base + ".ts", base + ".tsx", base + ".js"].find(
            (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
          );
        } else
          target = require.resolve(name, { paths: [path.dirname(filename)] });
        if (!target) throw Error("FIXTURE_MODULE_MISSING");
        return `__require(${bundle(target)})`;
      },
    );
    modules[id] = `function(module,exports,__require){${source}\n}`;
    return id;
  }
  const react = bundle(require.resolve("react")),
    client = bundle(require.resolve("react-dom/client")),
    workspace = bundle(path.join(root, "components/teaching/workspace.tsx")),
    student = bundle(path.join(root, "components/teaching/student.tsx"));
  fs.writeFileSync(
    path.join(folder, "fixture.js"),
    `(()=>{const process={env:{NODE_ENV:'production'}},modules=[${modules.join(",")}],cache={};function __require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,__require);return m.exports;}const React=__require(${react}),{createRoot}=__require(${client}),{TeacherWorkspace}=__require(${workspace}),{StudentClassroom}=__require(${student}),root=createRoot(document.getElementById('root'));window.__teachingSignIns=0;window.__mountTeaching=function(mode='teacher',suffix='a'){const account=mode==='guest'?null:{key:'qa-teaching-'+(mode==='student'?'student':suffix),id:mode==='student'?'qa-student':'qa-teacher-'+suffix,name:mode==='student'?'KIỂM THỬ · HỌC SINH':'KIỂM THỬ · GIÁO VIÊN'};root.render(mode==='teacher'?React.createElement(TeacherWorkspace,{key:mode+suffix,account}):React.createElement(StudentClassroom,{key:mode+suffix,account,providers:{google:true,facebook:true}}));};window.__mountTeaching();})();`,
  );
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8"),
    css =
      [...layout.matchAll(/import "([^"\n]+\.css)"/g)]
        .map((m) =>
          fs.readFileSync(
            m[1].startsWith("./")
              ? path.join(root, "app", m[1])
              : require.resolve(m[1]),
            "utf8",
          ),
        )
        .join("\n") +
      "\n" +
      fs.readFileSync(path.join(root, "app/teacher/workspace.css"), "utf8");
  fs.writeFileSync(path.join(folder, "fixture.css"), css);
  fs.writeFileSync(
    path.join(folder, "fixture.html"),
    '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/__v7-teaching-ui.css"><title>Teaching UI fixture</title><body style="margin:0"><div style="padding:9px 18px;background:#244d3d;color:#e8f0cd;font:12px system-ui">KIỂM THỬ · Tài khoản, lớp và bài làm tổng hợp · Không phải học sinh thật</div><div id="root"></div><script src="/__v7-teaching-ui.js"></script></body></html>',
  );
  fs.writeFileSync(
    path.join(folder, "authored.txt"),
    "Điều kiện phương trình: chỉ chia hai vế cho cùng một số khác không.\n\nPhương trình 2x + 3 = 11 có nghiệm x = 4.",
  );
  return { unitChecks: 32, folder };
}
module.exports = { build };
if (require.main === module)
  console.log(JSON.stringify({ status: "PASS", ...build() }));
