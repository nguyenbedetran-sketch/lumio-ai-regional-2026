// All identities, scores, history and HTTP here are synthetic acceptance fixtures.
async (page) => {
  const cases = [],
    errors = [],
    writes = [],
    reads = [],
    receipts = new Map();
  const check = (ok, label) => {
      if (!ok) throw Error(label);
      cases.push(label);
    },
    clone = (x) => JSON.parse(JSON.stringify(x));
  const stamp = "2026-10-16T02:00:00.000Z",
    user = "qa-teacher-a",
    account = "qa-teaching-a";
  let mode = "teacher",
    loseAck = false,
    historyDenied = false,
    historyEmpty = false,
    historyDelay = null,
    releaseHistory = null;
  const question = {
    id: "qa-history-q",
    orgId: "qa-org",
    classId: "qa-class",
    kind: "short",
    prompt: "KIỂM THỬ · Giải \\(2x+3=11\\).",
    choices: [],
    answerKey: "x=4",
    explanation: "Trừ 3 rồi chia 2.",
    rubric: [{ label: "Nêu các bước", points: 10 }],
    maxPoints: 10,
    sourceIds: [],
    references: [],
    status: "reviewed",
    revision: 1,
    topic: "Phương trình",
    difficulty: "basic",
    createdAt: stamp,
    createdBy: user,
  };
  const assignment = {
    id: "qa-history-assignment",
    rootAssignmentId: "qa-history-assignment",
    attemptNo: 1,
    practiceRetake: false,
    questionCount: 1,
    canSubmit: false,
    availability: "graded",
    orgId: "qa-org",
    classId: "qa-class",
    title: "KIỂM THỬ · Bài phương trình",
    instructions: "Trình bày các bước.",
    questionIds: [question.id],
    questions: [question],
    target: { kind: "class", ids: [] },
    recipientIds: ["qa-student"],
    dueAt: "2099-01-01T10:00:00.000Z",
    status: "issued",
    revision: 2,
    createdBy: user,
    createdAt: stamp,
    issuedAt: stamp,
    maxPoints: 10,
  };
  const submission = {
    id: "qa-history-submission",
    orgId: "qa-org",
    assignmentId: assignment.id,
    classId: "qa-class",
    studentId: "qa-student",
    studentName: "KIỂM THỬ · HỌC SINH",
    answers: [{ questionId: question.id, response: "2x=8 nên x=4" }],
    submittedAt: stamp,
    late: false,
    status: "published",
    revision: 3,
    grades: [
      {
        questionId: question.id,
        points: 8,
        feedback: "KIỂM THỬ · Cần nêu đủ bước.",
      },
    ],
    score: 8,
    feedback: "KIỂM THỬ · Bản công bố đầu.",
    confirmedAt: stamp,
    publishedAt: stamp,
  };
  const base = {
    version: 1,
    serverTime: stamp,
    actor: {
      userId: user,
      name: "KIỂM THỬ · GIÁO VIÊN",
      accountKey: account,
      systemRole: "USER",
      approvedTeacher: true,
      canCreateOrganization: true,
    },
    organizations: [
      { id: "qa-org", name: "KIỂM THỬ · Toán", role: "ORGANIZATION_ADMIN" },
      {
        id: "qa-org-b",
        name: "KIỂM THỬ · Không gian B",
        role: "ORGANIZATION_ADMIN",
      },
    ],
    organization: {
      id: "qa-org",
      name: "KIỂM THỬ · Toán",
      ownerId: user,
      revision: 1,
      createdAt: stamp,
    },
    role: "ORGANIZATION_ADMIN",
    permissions: { manageOrg: true, teach: true, learn: false },
    classes: [
      {
        id: "qa-class",
        orgId: "qa-org",
        name: "KIỂM THỬ · Lớp 9",
        subject: "Toán",
        grade: "9",
        description: "",
        archived: false,
        revision: 1,
        createdAt: stamp,
        teacherIds: [user],
      },
    ],
    members: [
      {
        userId: user,
        name: "KIỂM THỬ · GIÁO VIÊN",
        role: "OWNER",
        approvedTeacher: true,
      },
    ],
    enrollments: [
      {
        id: "qa-enrollment",
        classId: "qa-class",
        userId: "qa-student",
        name: "KIỂM THỬ · HỌC SINH",
        active: true,
        revision: 1,
        joinedAt: stamp,
      },
    ],
    groups: [],
    invites: [],
    materials: [],
    lessons: [],
    questions: [question],
    assignments: [assignment],
    submissions: [submission],
    announcements: [],
    events: [],
    settings: {
      name: "KIỂM THỬ · Toán",
      timezone: "Asia/Ho_Chi_Minh",
      allowLateSubmissions: false,
      revision: 1,
    },
    preferences: null,
    dashboard: {
      classes: 1,
      students: 1,
      materials: 0,
      lessons: 0,
      questions: 1,
      assignments: 1,
      awaitingGrading: 0,
      dueSoon: 1,
      publishedAssessments: 1,
      averagePercent: 80,
    },
    analytics: [],
  };
  const event = (id, kind, version, score, extra = {}) => ({
    id,
    kind,
    submissionRevision: kind === "publish" ? 3 : 2,
    gradeVersion: version,
    score,
    grades: [
      {
        questionId: question.id,
        points: score,
        feedback: "KIỂM THỬ · Nhận xét phiên bản " + version,
      },
    ],
    feedback: "KIỂM THỬ · Công bố phiên bản " + version,
    publishedAt: kind === "publish" ? stamp : null,
    legacy: false,
    recordedAt: stamp,
    recordedBy: { userId: user, name: "KIỂM THỬ · Cô An" },
    confirmedAt: stamp,
    ...extra,
  });
  const history = [
    event("qa-event-p1", "publish", 2, 8),
    event("qa-event-g1", "grade", 2, 8, {
      reason: "KIỂM THỬ · Lý do nội bộ không cho học sinh",
    }),
  ];
  const legacy = event("qa-event-legacy", "legacy_snapshot", 1, 7, {
    legacy: true,
    recordedAt: null,
    recordedBy: null,
    confirmedAt: null,
    publishedAt: stamp,
    reason: "KIỂM THỬ · Dữ liệu cũ",
  });
  let gradeVersion = 2;
  function stateFor(headers, url) {
    const s = clone(base),
      key = headers["x-lumio-account"] || account;
    const isStudent = key === "qa-teaching-student";
    if (key === "qa-teaching-b") {
      s.actor = {
        ...s.actor,
        userId: "qa-teacher-b",
        accountKey: key,
        name: "KIỂM THỬ · GIÁO VIÊN B",
      };
      s.organization = {
        ...s.organization,
        id: "qa-org-b",
        name: "KIỂM THỬ · Không gian B",
      };
      s.organizations = s.organizations.filter((row) => row.id === "qa-org-b");
      s.classes = [];
      s.assignments = [];
      s.submissions = [];
      s.questions = [];
      s.enrollments = [];
    } else if (isStudent) {
      s.actor = {
        ...s.actor,
        userId: "qa-student",
        accountKey: key,
        name: "KIỂM THỬ · HỌC SINH",
        approvedTeacher: false,
        canCreateOrganization: false,
      };
      s.role = "STUDENT";
      s.permissions = { manageOrg: false, teach: false, learn: true };
      s.members = [];
      s.questions = [];
      s.assignments = s.assignments.map((a) => ({
        ...a,
        questions: a.questions.map((q) => {
          const { answerKey, rubric, explanation, ...safe } = q;
          return safe;
        }),
      }));
      s.submissions = s.submissions.map((row) => {
        if (row.status === "published") return row;
        const { grades, score, feedback, confirmedAt, publishedAt, ...safe } =
          row;
        return safe;
      });
    } else if (/[?&]orgId=qa-org-b(?:&|$)/.test(url)) {
      s.organization = {
        ...s.organization,
        id: "qa-org-b",
        name: "KIỂM THỬ · Không gian B",
      };
      s.classes = [];
      s.assignments = [];
      s.submissions = [];
      s.questions = [];
      s.enrollments = [];
    }
    if (!/[?&]orgId=/.test(url)) {
      s.organization = null;
      s.classes = [];
      s.assignments = [];
      s.submissions = [];
      s.questions = [];
      s.enrollments = [];
      s.role = null;
    }
    return s;
  }
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.route("**/*", (r) =>
      r.fulfill({ status: 409, json: { error: "SYNTHETIC_E1_NO_OTHER_API" } }),
    );
    for (const [url, file, contentType] of [
      ["**/__v7-teaching-ui", "fixture.html", "text/html"],
      ["**/__v7-teaching-ui.js", "fixture.js", "text/javascript"],
      ["**/__v7-teaching-ui.css", "fixture.css", "text/css"],
    ])
      await page.route(url, (r) =>
        r.fulfill({ path: "work/v7-grade-history-ui/" + file, contentType }),
      );
    await page.route("**/brand/lumio-logo.png", (r) =>
      r.fulfill({
        path: "public/brand/lumio-logo.png",
        contentType: "image/png",
      }),
    );
    await page.route("**/fonts/KaTeX*", (r) => {
      const m = /(KaTeX_[A-Za-z0-9-]+\.(?:woff2?|ttf))$/.exec(
        r.request().url(),
      );
      return m
        ? r.fulfill({
            path: "node_modules/katex/dist/fonts/" + m[1],
            contentType: "font/woff2",
          })
        : r.abort();
    });
    await page.route("**/api/teaching**", async (r) => {
      const q = r.request(),
        u = q.url(),
        headers = q.headers();
      if (q.method() === "GET") {
        reads.push({ url: u, account: headers["x-lumio-account"] });
        return r.fulfill({ json: stateFor(headers, u) });
      }
      const b = q.postDataJSON();
      writes.push({ ...b, account: headers["x-lumio-account"] });
      check(
        headers["x-lumio-account"] === account,
        "Grade mutations retain canonical account binding",
      );
      if (receipts.has(b.requestId))
        return r.fulfill({
          json: { ...receipts.get(b.requestId), replayed: true },
        });
      if (b.action === "submission.grade") {
        check(
          b.expectedRevision === submission.revision,
          "A grade mutation uses the current submission revision",
        );
        submission.status = "graded";
        submission.grades = clone(b.grades);
        submission.score = b.grades.reduce((n, g) => n + g.points, 0);
        submission.feedback = b.feedback;
        submission.confirmedAt = stamp;
        submission.publishedAt = null;
        submission.revision++;
        gradeVersion++;
        history.unshift(
          event(
            "qa-g-" + gradeVersion,
            "grade",
            gradeVersion,
            submission.score,
            {
              reason: b.reason,
              submissionRevision: submission.revision,
              feedback: b.feedback,
              grades: clone(b.grades),
            },
          ),
        );
      } else if (b.action === "submission.publish") {
        submission.status = "published";
        submission.revision++;
        submission.publishedAt = stamp;
        history.unshift(
          event(
            "qa-p-" + gradeVersion,
            "publish",
            gradeVersion,
            submission.score,
            {
              submissionRevision: submission.revision,
              feedback: submission.feedback,
              grades: clone(submission.grades),
            },
          ),
        );
      } else
        return r.fulfill({
          status: 400,
          json: { error: "INVALID_TEACHING_ACTION" },
        });
      const result = {
        state: stateFor(headers, "?orgId=qa-org"),
        result: {},
        replayed: false,
      };
      receipts.set(b.requestId, clone(result));
      if (loseAck) {
        loseAck = false;
        return r.abort("failed");
      }
      return r.fulfill({ json: result });
    });
    await page.route("**/api/teaching/grade-history?**", async (r) => {
      const headers = r.request().headers(),
        u = r.request().url();
      reads.push({ url: u, account: headers["x-lumio-account"] });
      check(
        /[?&]orgId=qa-org(?:&|$)/.test(u) &&
          /[?&]submissionId=qa-history-submission(?:&|$)/.test(u),
        "History read is bound to the selected organization and submission",
      );
      if (historyDelay) {
        await new Promise((resolve) => (releaseHistory = resolve));
        historyDelay = null;
      }
      if (historyDenied)
        return r.fulfill({
          status: 403,
          json: {
            error: "TEACHING_FORBIDDEN",
            privateDetail: "NEVER_RENDER_PRIVATE_ERROR",
          },
        });
      let events = historyEmpty ? [] : clone(history),
        nextCursor = null;
      if (headers["x-lumio-account"] === "qa-teaching-student")
        events = events
          .filter(
            (e) =>
              e.kind === "publish" ||
              (e.kind === "legacy_snapshot" && e.publishedAt),
          )
          .map(
            ({ recordedBy, recordedAt, confirmedAt, reason, ...safe }) => safe,
          );
      else if (/[?&]cursor=/.test(u)) events = [legacy];
      else if (events.length) {
        events = events.slice(0, 2);
        nextCursor = "qa-opaque-next-page";
      }
      return r.fulfill({
        json: { submissionId: submission.id, events, nextCursor },
      });
    });
    await page.goto("http://localhost:3000/__v7-teaching-ui");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator(".tw-stat").first().waitFor();
    const nav = async () => {
      await page
        .locator(".tw-sidebar nav")
        .getByRole("button", { name: "Chấm & nhận xét", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Lịch sử điểm", exact: true })
        .waitFor();
    };
    await nav();
    check(
      writes.length === 0,
      "Opening grading and history sends no write automatically",
    );
    await page
      .getByRole("button", { name: "Lịch sử điểm", exact: true })
      .click();
    const historyDialog = () =>
      page.getByRole("dialog", {
        name: "Lịch sử điểm · KIỂM THỬ · HỌC SINH",
        exact: true,
      });
    await page.locator("[data-grade-history-event]").first().waitFor();
    check(
      (await page.locator("[data-grade-history-event]").count()) === 2,
      "Teacher history shows separate saved-grade and publication events",
    );
    check(
      (await historyDialog().textContent()).includes("KIỂM THỬ · Cô An"),
      "Teacher history shows the recorded actor returned by the API",
    );
    await historyDialog()
      .getByRole("button", { name: "Xem các bản cũ hơn", exact: true })
      .click();
    await page.getByText("Bản ghi kế thừa", { exact: true }).waitFor();
    check(
      (await page.locator("[data-grade-history-event]").count()) === 3 &&
        reads.some((r) => r.url.includes("cursor=qa-opaque-next-page")),
      "History pagination uses the server cursor without replacing earlier events",
    );
    check(
      (await historyDialog().textContent()).includes(
        "Không suy đoán người chấm",
      ),
      "Legacy history explicitly discloses unknown prior actor and timing",
    );
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      check(
        await historyDialog().evaluate(
          (n) => n.scrollWidth <= n.clientWidth + 2,
        ),
        "History dialog content does not scroll horizontally at " +
          width +
          "px",
      );
    }
    await page.screenshot({
      path: "docs/v7/qa-grade-history-teacher-desktop.png",
      fullPage: true,
    });
    await historyDialog()
      .getByRole("button", { name: "Đóng biểu mẫu", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Xem kết quả", exact: true })
      .click();
    const editor = () =>
      page.getByRole("dialog", {
        name: "Bài làm · KIỂM THỬ · HỌC SINH",
        exact: true,
      });
    check(
      await editor()
        .getByRole("spinbutton", { name: /^Điểm câu 1/ })
        .isDisabled(),
      "Published grading remains read-only before an explicit adjustment action",
    );
    await editor()
      .getByRole("button", { name: "Bắt đầu điều chỉnh điểm", exact: true })
      .click();
    check(
      writes.length === 0 &&
        !(await editor()
          .getByRole("spinbutton", { name: /^Điểm câu 1/ })
          .isDisabled()),
      "Starting an adjustment only unlocks the editor and performs no mutation",
    );
    await editor()
      .getByRole("spinbutton", { name: /^Điểm câu 1/ })
      .fill("7.5");
    await editor()
      .getByRole("textbox", { name: "Nhận xét chung", exact: true })
      .fill("KIỂM THỬ · Bản chấm điều chỉnh chưa công bố.");
    await editor().getByRole("checkbox").check();
    check(
      await editor()
        .getByRole("button", { name: "Xem lại & lưu điều chỉnh", exact: true })
        .isDisabled(),
      "A prior grade cannot be saved without a nonempty adjustment reason",
    );
    await editor()
      .getByRole("textbox", {
        name: /^Lý do điều chỉnh \(bắt buộc\)/,
      })
      .fill("KIỂM THỬ · Đã đối chiếu lại tiêu chí chấm.");
    await editor()
      .getByRole("button", { name: "Xem lại & lưu điều chỉnh", exact: true })
      .click();
    const review = () =>
      page.getByRole("dialog", {
        name: "Xác nhận điều chỉnh điểm",
        exact: true,
      });
    await review().waitFor();
    check(
      writes.length === 0 &&
        (await review().textContent()).includes("7.5 / 10") &&
        (await review().textContent()).includes("tạm ẩn"),
      "Adjustment review explains changed score and withdrawal before any save request",
    );
    await review()
      .getByRole("button", { name: "Giữ nguyên", exact: true })
      .click();
    check(
      writes.length === 0 &&
        (await editor()
          .getByRole("spinbutton", { name: /^Điểm câu 1/ })
          .inputValue()) === "7.5",
      "Canceling adjustment review keeps edits and sends no grade mutation",
    );
    await editor()
      .getByRole("button", { name: "Xem lại & lưu điều chỉnh", exact: true })
      .click();
    await review()
      .getByRole("button", { name: "Lưu phiên bản điều chỉnh", exact: true })
      .click();
    await editor().waitFor({ state: "hidden" });
    check(
      submission.status === "graded" &&
        submission.publishedAt === null &&
        submission.score === 7.5 &&
        writes.length === 1 &&
        writes[0].reason.includes("Đã đối chiếu"),
      "Confirmed adjustment persists a reason and withdraws the current result without auto-publication",
    );
    await page.evaluate(() => window.__mountTeaching("student"));
    await page.getByRole("tab", { name: "Kết quả", exact: true }).click();
    check(
      (await page
        .getByText("Giáo viên chưa công bố kết quả", { exact: true })
        .count()) === 1 &&
        (await page
          .getByText("KIỂM THỬ · Bản chấm điều chỉnh chưa công bố.", {
            exact: true,
          })
          .count()) === 0,
      "Student current result hides the newly adjusted score and feedback before publication",
    );
    await page
      .getByRole("button", { name: "Lịch sử kết quả đã công bố", exact: true })
      .click();
    const studentHistory = () =>
      page.getByRole("dialog", {
        name: "Lịch sử kết quả đã công bố",
        exact: true,
      });
    await page.locator("[data-grade-history-event]").waitFor();
    check(
      (await page.locator("[data-grade-history-event]").count()) === 1 &&
        (await studentHistory().textContent()).includes("Phiên bản 2 · 8 điểm"),
      "Student can still review the previously published snapshot while a new grade is private",
    );
    check(
      !(await studentHistory().textContent()).includes("Cô An") &&
        !(await studentHistory().textContent()).includes("Lý do nội bộ") &&
        !(await studentHistory().textContent()).includes("Đã đối chiếu"),
      "Student history never renders teacher actor, private reason or unpublished grading",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
      "Student history fits a 390px phone",
    );
    await page.screenshot({
      path: "docs/v7/qa-grade-history-student-mobile.png",
      fullPage: true,
    });
    await studentHistory()
      .getByRole("button", { name: "Đóng biểu mẫu", exact: true })
      .click();
    await page.evaluate(() => window.__mountTeaching("teacher"));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await nav();
    await page
      .getByRole("button", { name: "Công bố kết quả", exact: true })
      .click();
    check(
      submission.status === "published" &&
        writes.length === 2 &&
        writes[1].action === "submission.publish",
      "Republishing the adjusted result is a separate explicit teacher action",
    );
    await page.evaluate(() => window.__mountTeaching("student"));
    await page.getByRole("tab", { name: "Kết quả", exact: true }).click();
    check(
      (await page
        .getByText("KIỂM THỬ · Bản chấm điều chỉnh chưa công bố.", {
          exact: true,
        })
        .count()) === 1,
      "Student sees the adjusted feedback only after separate republication",
    );
    await page
      .getByRole("button", { name: "Lịch sử kết quả đã công bố", exact: true })
      .click();
    await page.locator("[data-grade-history-event]").first().waitFor();
    check(
      (await page.locator("[data-grade-history-event]").count()) === 2,
      "Student history retains both published versions without intermediate teacher-only saves",
    );
    await studentHistory()
      .getByRole("button", { name: "Đóng biểu mẫu", exact: true })
      .click();
    await page.evaluate(() => window.__mountTeaching("teacher"));
    await nav();
    await page
      .getByRole("button", { name: "Xem kết quả", exact: true })
      .click();
    await editor()
      .getByRole("button", { name: "Bắt đầu điều chỉnh điểm", exact: true })
      .click();
    await editor()
      .getByRole("spinbutton", { name: /^Điểm câu 1/ })
      .fill("7");
    await editor()
      .getByRole("textbox", {
        name: /^Lý do điều chỉnh \(bắt buộc\)/,
      })
      .fill("KIỂM THỬ · Đối chiếu lại lần hai.");
    await editor().getByRole("checkbox").check();
    await editor()
      .getByRole("button", { name: "Xem lại & lưu điều chỉnh", exact: true })
      .click();
    loseAck = true;
    await review()
      .getByRole("button", { name: "Lưu phiên bản điều chỉnh", exact: true })
      .click();
    await review().getByRole("alert").waitFor();
    const firstKey = writes.at(-1).requestId;
    const countBeforeRetry = history.length;
    check(
      submission.status === "graded" && (await review().isVisible()),
      "An uncertain grade acknowledgement keeps the review open instead of retrying automatically",
    );
    await review()
      .getByRole("button", { name: "Lưu phiên bản điều chỉnh", exact: true })
      .click();
    await editor().waitFor({ state: "hidden" });
    check(
      writes.at(-1).requestId === firstKey &&
        history.length === countBeforeRetry,
      "Manual grade retry reuses its request ID without appending a duplicate history event",
    );
    historyEmpty = true;
    await page
      .getByRole("button", { name: "Lịch sử điểm", exact: true })
      .click();
    await page
      .getByText("Chưa có bản ghi chấm hoặc công bố cho bài nộp này.", {
        exact: true,
      })
      .waitFor();
    check(
      (await page.locator("[data-grade-history-event]").count()) === 0,
      "Empty history stays empty without invented legacy scores or actors",
    );
    await historyDialog()
      .getByRole("button", { name: "Đóng biểu mẫu", exact: true })
      .click();
    historyEmpty = false;
    historyDenied = true;
    await page
      .getByRole("button", { name: "Lịch sử điểm", exact: true })
      .click();
    await page.getByText("Chưa mở được không gian", { exact: true }).waitFor();
    check(
      (await page.locator("[data-grade-history]").count()) === 0 &&
        (await page
          .getByText("NEVER_RENDER_PRIVATE_ERROR", { exact: true })
          .count()) === 0,
      "A current forbidden history read clears private workspace and modal cache without reflecting private error fields",
    );
    historyDenied = false;
    await page
      .getByRole("button", { name: "Thử kết nối lại", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Lịch sử điểm", exact: true })
      .waitFor();
    await nav();
    historyDelay = true;
    await page
      .getByRole("button", { name: "Lịch sử điểm", exact: true })
      .click();
    await page.getByText("Đang tải lịch sử điểm…", { exact: true }).waitFor();
    await page.evaluate(() => window.__mountTeaching("teacher", "b"));
    await page.waitForFunction(
      () =>
        document.querySelector('select[aria-label="Không gian giảng dạy"]')
          ?.value === "qa-org-b",
    );
    if (releaseHistory) releaseHistory();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    check(
      (await page.locator("[data-grade-history]").count()) === 0 &&
        (await page.getByText("KIỂM THỬ · Cô An", { exact: true }).count()) ===
          0,
      "A delayed previous-account history response cannot populate the new account view",
    );
    await page.evaluate(() => window.__mountTeaching("teacher"));
    await nav();
    historyDelay = true;
    releaseHistory = null;
    await page
      .getByRole("button", { name: "Lịch sử điểm", exact: true })
      .click();
    await page.getByText("Đang tải lịch sử điểm…", { exact: true }).waitFor();
    await historyDialog()
      .getByRole("button", { name: "Đóng biểu mẫu", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Không gian giảng dạy", exact: true })
      .selectOption("qa-org-b");
    await page.waitForFunction(
      () =>
        document.querySelector('select[aria-label="Không gian giảng dạy"]')
          ?.value === "qa-org-b",
    );
    historyDenied = true;
    if (releaseHistory) releaseHistory();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    historyDenied = false;
    check(
      (await page
        .getByText("Chưa có bài làm ở trạng thái này", { exact: true })
        .count()) === 1 &&
        (await page
          .getByText("Chưa mở được không gian", { exact: true })
          .count()) === 0,
      "A delayed old-organization forbidden read cannot clear a newly selected authorized organization",
    );
    check(
      reads
        .filter((r) => r.url.includes("/grade-history?"))
        .every(
          (r) => r.account === account || r.account === "qa-teaching-student",
        ),
      "Every history page carries the appropriate canonical account header",
    );
    check(
      errors.length === 0,
      "No runtime error across history, adjustment, publication, retry or account loss",
    );

    return {
      status: "PASS",
      passed: cases.length,
      cases,
      errors,
      syntheticMutations: writes.length,
      paidProviderRequests: 0,
      actualStudents: 0,
      screenshots: [
        "docs/v7/qa-grade-history-teacher-desktop.png",
        "docs/v7/qa-grade-history-student-mobile.png",
      ],
      scope:
        "Actual teacher/student components with synthetic history/HTTP only; backend tenant/append-only correctness is separate evidence",
    };
  } catch (error) {
    await page.screenshot({
      path: "docs/v7/qa-grade-history-current-failure.png",
      fullPage: true,
    });
    return {
      status: "FAIL",
      passed: cases.length,
      cases,
      errors,
      error: error.message,
      snapshot: (await page.locator("body").innerText()).slice(-4000),
    };
  }
};
