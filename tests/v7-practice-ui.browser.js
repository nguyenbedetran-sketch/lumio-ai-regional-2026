// Actual components. All classes, answers, windows, receipts and HTTP are synthetic.
async (page) => {
  const cases = [],
    errors = [],
    writes = [],
    receipts = new Map(),
    clone = (x) => JSON.parse(JSON.stringify(x));
  const check = (ok, label) => {
    if (!ok) throw Error(label);
    cases.push(label);
  };
  const stamp = "2026-10-16T02:00:00.000Z",
    account = "qa-teaching-a",
    teacher = "qa-teacher-a";
  const q = {
    id: "qa-practice-q",
    revision: 1,
    orgId: "qa-org",
    classId: "qa-class",
    kind: "mcq",
    prompt: "KIỂM THỬ · Giá trị của \\(2+2\\)?",
    choices: ["1", "2", "3", "4"],
    correctIndex: 3,
    maxPoints: 10,
    topic: "Số học",
    difficulty: "basic",
    references: [],
    status: "reviewed",
    createdAt: stamp,
    createdBy: teacher,
  };
  const root = {
    id: "qa-root",
    rootAssignmentId: "qa-root",
    attemptNo: 1,
    practiceRetake: false,
    questionCount: 1,
    orgId: "qa-org",
    classId: "qa-class",
    title: "KIỂM THỬ · Bài gốc",
    instructions: "KIỂM THỬ · hướng dẫn gốc",
    questions: [q],
    questionIds: [q.id],
    target: { kind: "class", ids: [] },
    recipientIds: ["qa-student"],
    dueAt: "2099-01-02T10:00:00Z",
    availableFrom: null,
    availableUntil: null,
    status: "issued",
    revision: 2,
    createdBy: teacher,
    createdAt: stamp,
    issuedAt: stamp,
    maxPoints: 10,
  };
  const original = {
    id: "qa-root-sub",
    assignmentId: root.id,
    orgId: "qa-org",
    classId: "qa-class",
    studentId: "qa-student",
    studentName: "KIỂM THỬ · HỌC SINH",
    answers: [{ questionId: q.id, response: 2 }],
    submittedAt: stamp,
    late: false,
    status: "published",
    revision: 3,
    score: 6,
    feedback: "KIỂM THỬ · Kết quả cũ được giữ",
    grades: [{ questionId: q.id, points: 6, feedback: "Cần xem lại" }],
    publishedAt: stamp,
    confirmedAt: stamp,
    countsTowardAnalytics: true,
  };
  const base = {
    version: 1,
    serverTime: stamp,
    actor: {
      userId: teacher,
      name: "KIỂM THỬ · GIÁO VIÊN",
      accountKey: account,
      systemRole: "USER",
      approvedTeacher: true,
      canCreateOrganization: true,
    },
    organizations: [
      {
        id: "qa-org",
        name: "KIỂM THỬ · Toán",
        role: "ORGANIZATION_ADMIN",
        revision: 1,
        createdAt: stamp,
      },
    ],
    organization: {
      id: "qa-org",
      name: "KIỂM THỬ · Toán",
      role: "ORGANIZATION_ADMIN",
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
        teacherIds: [teacher],
      },
    ],
    members: [],
    enrollments: [
      {
        id: "qa-enroll",
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
    questions: [q],
    assignments: [root],
    submissions: [original],
    announcements: [],
    events: [],
    settings: {
      name: "KIỂM THỬ · Toán",
      timezone: "Asia/Ho_Chi_Minh",
      allowLateSubmissions: true,
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
      dueSoon: 0,
      publishedAssessments: 1,
      averagePercent: 60,
    },
    analytics: [],
  };
  let child = null,
    windowState = "not_open",
    loseAck = false,
    denyRetake = null,
    delayed = null,
    releaseRead = null;
  function stateFor(headers, url) {
    const s = clone(base),
      isStudent = headers["x-lumio-account"] === "qa-teaching-student";
    if (isStudent) {
      s.actor = {
        ...s.actor,
        userId: "qa-student",
        accountKey: "qa-teaching-student",
        name: "KIỂM THỬ · HỌC SINH",
        approvedTeacher: false,
        canCreateOrganization: false,
      };
      s.role = "STUDENT";
      s.permissions = { manageOrg: false, teach: false, learn: true };
      s.questions = [];
      s.assignments = s.assignments
        .filter((a) => a.status !== "draft")
        .map((a) => {
          const own = s.submissions.find((row) => row.assignmentId === a.id),
            av = a.id === child?.id ? windowState : "graded";
          return {
            ...a,
            availability: av,
            canSubmit: av === "available",
            questions:
              av === "not_open"
                ? []
                : a.questions.map(
                    ({
                      correctIndex,
                      explanation,
                      rubric,
                      modelAnswer,
                      ...safe
                    }) => safe,
                  ),
            questionIds: av === "not_open" ? [] : a.questionIds,
            instructions: av === "not_open" ? "" : a.instructions,
          };
        });
      s.submissions = s.submissions.map((row) => {
        if (row.status === "published") return row;
        const { grades, score, feedback, publishedAt, confirmedAt, ...safe } =
          row;
        return safe;
      });
    }
    if (!/[?&]orgId=/.test(url)) {
      s.organization = null;
      s.role = null;
      s.assignments = [];
      s.submissions = [];
      s.classes = [];
      s.questions = [];
      s.enrollments = [];
    }
    return s;
  }
  const nav = async (name) => {
    await page
      .locator(".tw-sidebar nav")
      .getByRole("button", { name, exact: true })
      .click();
  };
  const retake = () =>
      page.getByRole("dialog", { name: "Cho luyện lại cùng đề", exact: true }),
    review = () =>
      page.getByRole("dialog", { name: "Xác nhận lần luyện lại", exact: true });
  async function fillRetake() {
    await retake()
      .getByLabel("Mở lần luyện lại (giờ trên thiết bị)")
      .fill("2099-01-02T09:00");
    await retake()
      .getByLabel("Đóng lần luyện lại (giờ trên thiết bị)")
      .fill("2099-01-02T10:00");
    await retake()
      .getByLabel("Lý do cho luyện lại")
      .fill("KIỂM THỬ · Ôn lại sau nhận xét.");
    await retake().getByRole("checkbox").nth(0).check();
    await retake().getByRole("checkbox").nth(1).check();
  }
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.route("**/*", (r) =>
      r.fulfill({
        status: 409,
        json: { error: "SYNTHETIC_E2_NO_EXTERNAL_API" },
      }),
    );
    for (const [url, file, contentType] of [
      ["**/__v7-teaching-ui", "fixture.html", "text/html"],
      ["**/__v7-teaching-ui.js", "fixture.js", "text/javascript"],
      ["**/__v7-teaching-ui.css", "fixture.css", "text/css"],
    ])
      await page.route(url, (r) =>
        r.fulfill({ path: "work/v7-practice-ui/" + file, contentType }),
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
      const req = r.request(),
        headers = req.headers(),
        url = req.url();
      if (req.method() === "GET") {
        if (delayed) {
          const promise = delayed;
          delayed = null;
          await promise;
        }
        return r.fulfill({ json: stateFor(headers, url) });
      }
      const b = req.postDataJSON();
      writes.push({ ...b, account: headers["x-lumio-account"] });
      if (receipts.has(b.requestId))
        return r.fulfill({
          json: { ...receipts.get(b.requestId), replayed: true },
        });
      if (b.action === "assignment.create")
        base.assignments.push({
          ...b.draft,
          id: "qa-draft",
          orgId: "qa-org",
          rootAssignmentId: "qa-draft",
          attemptNo: 1,
          practiceRetake: false,
          questionCount: b.draft.questionIds.length,
          questions: [clone(q)],
          status: "draft",
          revision: 1,
          createdAt: stamp,
          createdBy: teacher,
          issuedAt: null,
          maxPoints: 10,
        });
      else if (b.action === "assignment.update") {
        const a = base.assignments.find((a) => a.id === b.id);
        Object.assign(a, b.draft);
        a.revision++;
      } else if (b.action === "assignment.retake") {
        if (denyRetake)
          return r.fulfill({ status: 409, json: { error: denyRetake } });
        check(
          b.originalAssignmentId === root.id &&
            b.expectedRevision === root.revision,
          "Retake request uses original root ID and current root CAS revision",
        );
        child = {
          ...clone(root),
          id: "qa-child",
          title: "KIỂM THỬ · Luyện lại lần 2",
          rootAssignmentId: root.id,
          attemptNo: 2,
          practiceRetake: true,
          target: { kind: "students", ids: [b.studentId] },
          recipientIds: [b.studentId],
          availableFrom: b.availableFrom,
          availableUntil: b.availableUntil,
          dueAt: b.availableUntil,
          revision: 1,
        };
        base.assignments.push(child);
        root.revision++;
      } else if (b.action === "submission.submit") {
        check(
          b.assignmentId === child.id && b.expectedRevision === 0,
          "New practice attempt submits its own assignment with initial submission revision0",
        );
        base.submissions.push({
          ...clone(original),
          id: "qa-child-sub",
          assignmentId: child.id,
          answers: b.answers,
          status: "submitted",
          score: undefined,
          feedback: undefined,
          grades: undefined,
          publishedAt: null,
          confirmedAt: null,
          revision: 1,
          countsTowardAnalytics: false,
        });
        windowState = "graded";
      } else if (b.action === "assignment.close") {
        base.assignments.find((a) => a.id === b.id).status = "closed";
        windowState = "closed";
      } else
        return r.fulfill({
          status: 400,
          json: { error: "INVALID_TEACHING_ACTION" },
        });
      const result = {
        state: stateFor(headers, "?orgId=qa-org"),
        result: { id: child?.id, rootAssignmentId: root.id, attemptNo: 2 },
        replayed: false,
      };
      receipts.set(b.requestId, clone(result));
      if (loseAck) {
        loseAck = false;
        return r.abort("failed");
      }
      return r.fulfill({ json: result });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://localhost:3000/__v7-teaching-ui");
    await page.locator(".tw-stat").first().waitFor();
    await nav("Bài tập");
    check(
      (await page
        .getByRole("button", { name: "Chỉnh sửa", exact: true })
        .count()) === 0,
      "Issued root has no window editing action",
    );
    await page
      .getByRole("button", { name: "Tạo bài tập", exact: true })
      .click();
    const draft = () =>
      page.getByRole("dialog", { name: "Tạo bài tập", exact: true });
    await draft()
      .getByLabel("Tên bài tập", { exact: true })
      .fill("KIỂM THỬ · Nháp có cửa sổ");
    await draft()
      .getByRole("combobox", { name: "Lớp nhận bài", exact: true })
      .selectOption("qa-class");
    await draft()
      .getByLabel("Hạn nộp (giờ trên thiết bị)", { exact: true })
      .fill("2099-01-02T10:00");
    await draft()
      .getByLabel("Mở nhận bài (giờ trên thiết bị)", { exact: true })
      .fill("2099-01-02T09:00");
    await draft()
      .getByLabel("Đóng cứng (giờ trên thiết bị)", { exact: true })
      .fill("2099-01-02T11:00");
    await draft()
      .getByLabel("Hướng dẫn", { exact: true })
      .fill("KIỂM THỬ · Đọc kỹ trước khi nộp.");
    await draft().getByRole("checkbox").check();
    check(
      writes.length === 0,
      "Filling draft windows never writes until explicit save",
    );
    await draft()
      .getByRole("button", { name: "Lưu đề nháp", exact: true })
      .click();
    await draft().waitFor({ state: "hidden" });
    check(
      writes[0].draft.availableFrom.endsWith("Z") &&
        writes[0].draft.availableUntil.endsWith("Z"),
      "Device-local draft window inputs are sent as explicit UTC instants",
    );
    const card = () =>
      page.locator("article.tw-card").filter({
        has: page.getByRole("heading", {
          name: "KIỂM THỬ · Nháp có cửa sổ",
          exact: true,
        }),
      });
    check(
      (await card().locator("[data-assessment-window]").count()) === 1,
      "Saved draft displays both opening and hard-close window",
    );
    await card()
      .getByRole("button", { name: "Chỉnh sửa", exact: true })
      .click();
    const edit = () =>
      page.getByRole("dialog", { name: "Chỉnh sửa bài tập", exact: true });
    await edit()
      .getByLabel("Mở nhận bài (giờ trên thiết bị)", { exact: true })
      .fill("");
    await edit()
      .getByLabel("Đóng cứng (giờ trên thiết bị)", { exact: true })
      .fill("");
    await edit()
      .getByRole("button", { name: "Lưu đề nháp", exact: true })
      .click();
    await edit().waitFor({ state: "hidden" });
    check(
      writes[1].draft.availableFrom === null &&
        writes[1].draft.availableUntil === null,
      "Clearing optional draft windows sends explicit nulls instead of silently retaining old bounds",
    );
    await nav("Chấm & nhận xét");
    await page
      .getByRole("button", { name: "Cho luyện lại", exact: true })
      .click();
    await retake().waitFor();
    check(
      (await retake().textContent()).includes(
        "Đáp án học sinh đã xem không thể trở thành bí mật trở lại",
      ),
      "Teacher sees same-question practice and already-seen answer warning",
    );
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      check(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth + 2 &&
            [...document.querySelectorAll("dialog[open]")].every(
              (d) => d.scrollWidth <= d.clientWidth + 2,
            ),
        ),
        "Practice form fits " + width + "px",
      );
    }
    await fillRetake();
    await retake().getByRole("checkbox").nth(0).uncheck();
    await retake()
      .getByRole("button", { name: "Xem lại lần luyện lại", exact: true })
      .click();
    check(
      (await review().count()) === 0 && writes.length === 2,
      "Missing same-question acknowledgement blocks final review and sends no request",
    );
    await retake().getByRole("checkbox").nth(0).check();
    await retake()
      .getByRole("button", { name: "Xem lại lần luyện lại", exact: true })
      .click();
    await review().waitFor();
    check(
      (await review().textContent()).includes("Mở:") &&
        (await review().textContent()).includes("đóng:") &&
        (await review().textContent()).includes("Ôn lại sau nhận xét"),
      "Final retake review shows the actual window and reason before authorization",
    );
    await page.screenshot({
      path: "docs/v7/qa-practice-review-desktop.png",
      fullPage: true,
    });
    check(
      writes.length === 2,
      "Acknowledgements and first review stage do not send a retake mutation",
    );
    await review()
      .getByRole("button", { name: "Giữ nguyên", exact: true })
      .click();
    check(
      (await retake().getByLabel("Lý do cho luyện lại").inputValue()).includes(
        "Ôn lại",
      ),
      "Cancelling final retake review retains teacher draft",
    );
    await retake()
      .getByRole("button", { name: "Xem lại lần luyện lại", exact: true })
      .click();
    loseAck = true;
    await review()
      .getByRole("button", { name: "Tạo lần luyện lại", exact: true })
      .click();
    await review().getByRole("alert").waitFor();
    check(
      base.assignments.filter((a) => a.practiceRetake).length === 1 &&
        writes.length === 3,
      "Uncertain retake acknowledgement does not auto-retry or locally grant another attempt",
    );
    const key = writes.at(-1).requestId;
    await review()
      .getByRole("button", { name: "Tạo lần luyện lại", exact: true })
      .click();
    await retake().waitFor({ state: "hidden" });
    check(
      writes.at(-1).requestId === key &&
        base.assignments.filter((a) => a.practiceRetake).length === 1,
      "Manual retry retains same request UUID and one synthetic child",
    );
    check(
      original.score === 6 &&
        original.status === "published" &&
        base.submissions.length === 1,
      "Granting practice leaves old submission and published result unchanged",
    );
    await nav("Bài tập");
    check(
      (await page
        .getByText("Luyện lại cùng đề · Lần 2", { exact: true })
        .count()) === 1,
      "Teacher assignment list identifies the separate same-question practice attempt",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator(".tw-content").evaluate((el) =>
      Promise.all(
        el
          .getAnimations({ subtree: true })
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      ),
    );
    await page.screenshot({
      path: "docs/v7/qa-practice-teacher-desktop.png",
      fullPage: true,
    });
    await page.evaluate(() => window.__mountTeaching("student"));
    await page.getByRole("tab", { name: "Bài tập", exact: true }).waitFor();
    const childCard = () =>
      page.locator("article.tw-card").filter({
        has: page.getByRole("heading", { name: child.title, exact: true }),
      });
    check(
      (await childCard()
        .getByRole("button", { name: "Chưa mở", exact: true })
        .isDisabled()) &&
        !(await childCard().textContent()).includes(root.instructions),
      "Server not-open state cannot open the attempt and redacted instructions stay absent",
    );
    check(
      (await childCard().textContent()).includes("1 câu"),
      "Redacted pre-open assignment still shows truthful server questionCount",
    );
    await page.getByRole("tab", { name: "Kết quả", exact: true }).click();
    check(
      (await page.getByText(original.feedback, { exact: true }).count()) === 1,
      "Student prior published result remains separately visible before new practice opens",
    );
    windowState = "available";
    await page
      .getByRole("button", { name: "Tải lại lớp học", exact: true })
      .click();
    await page.getByRole("tab", { name: "Bài tập", exact: true }).click();
    await childCard()
      .getByRole("button", { name: "Mở bài tập", exact: true })
      .click();
    const attempt = () =>
      page.getByRole("dialog", { name: child.title, exact: true });
    await attempt().waitFor();
    check(
      (await attempt().textContent()).includes(
        "không phải một bài đánh giá độc lập mới",
      ),
      "Opened student practice explains its assessment limitation",
    );
    await attempt().getByRole("radio").last().check();
    await attempt().getByRole("checkbox").check();
    await attempt()
      .getByRole("button", { name: "Nộp bài cho giáo viên", exact: true })
      .click();
    await attempt().waitFor({ state: "hidden" });
    check(
      base.submissions.length === 2 && base.submissions[0].score === 6,
      "Submitting child practice creates a distinct submission and preserves original score",
    );
    await page.getByRole("tab", { name: "Kết quả", exact: true }).click();
    check(
      (await page.getByText(original.feedback, { exact: true }).count()) ===
        1 &&
        (await page
          .getByText("Giáo viên chưa công bố kết quả", { exact: true })
          .count()) === 1,
      "Student sees old published result and new pending result without an invented score",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    check(
      (await page
        .getByRole("tab", { name: "Kết quả", exact: true })
        .getAttribute("aria-selected")) === "true",
      "Student result view stays linked to the active result tab",
    );
    await page.screenshot({
      path: "docs/v7/qa-practice-student-mobile.png",
      fullPage: true,
    });
    windowState = "closed";
    await page
      .getByRole("button", { name: "Tải lại lớp học", exact: true })
      .click();
    await page.getByRole("tab", { name: "Bài tập", exact: true }).click();
    check(
      await childCard().getByRole("button").isDisabled(),
      "Closed server attempt cannot be reopened from a cached student card",
    );
    await page.evaluate(() => window.__mountTeaching("teacher"));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await nav("Bài tập");
    await page
      .locator("article.tw-card")
      .filter({
        has: page.getByRole("heading", { name: child.title, exact: true }),
      })
      .getByRole("button", { name: "Đóng nhận bài", exact: true })
      .click();
    check(
      child.status === "closed" && root.status === "issued",
      "Closing the explicit child leaves its original assignment unchanged",
    );
    await nav("Chấm & nhận xét");
    await page
      .getByRole("button", { name: "Cho luyện lại", exact: true })
      .first()
      .click();
    await fillRetake();
    await retake()
      .getByRole("button", { name: "Xem lại lần luyện lại", exact: true })
      .click();
    denyRetake = "TEACHING_RETAKE_LIMIT";
    await review()
      .getByRole("button", { name: "Tạo lần luyện lại", exact: true })
      .click();
    await review().getByRole("alert").waitFor();
    check(
      (await review().getByRole("alert").textContent()).includes(
        "tối đa 3 lần",
      ) && base.assignments.filter((a) => a.practiceRetake).length === 1,
      "Server denial is localized and creates no frontend-only allowance",
    );
    await page.evaluate(() => window.__mountTeaching("teacher", "b"));
    check(
      (await page.getByRole("dialog").count()) === 0,
      "Account switch removes pending practice review and its student data",
    );
    check(
      writes.every(
        (w) => w.account === account || w.account === "qa-teaching-student",
      ),
      "Every practice and submission write retains canonical account binding",
    );
    check(
      errors.length === 0,
      "No runtime errors across windows, review, lost acknowledgement, student attempt and denial",
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
        "docs/v7/qa-practice-teacher-desktop.png",
        "docs/v7/qa-practice-review-desktop.png",
        "docs/v7/qa-practice-student-mobile.png",
      ],
      scope:
        "Actual teacher/student components with synthetic HTTP windows/retakes. Server UTC boundaries, immutable snapshots, caps and tenant ACL require separate backend evidence.",
    };
  } catch (e) {
    await page.screenshot({
      path: "docs/v7/qa-practice-current-failure.png",
      fullPage: true,
    });
    return {
      status: "FAIL",
      passed: cases.length,
      cases,
      errors,
      error: e.message,
      snapshot: (await page.locator("body").innerText()).slice(-5000),
    };
  }
};
