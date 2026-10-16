async (page) => {
  const cases = [],
    errors = [],
    requests = [],
    external = [];
  const check = (ok, name) => {
    if (!ok) throw Error(name);
    cases.push(name);
  };
  const stamp = "2026-10-16T06:00:00.000Z";
  const org = {
    id: "qa-org",
    name: "Tổ chức kiểm thử",
    role: "TEACHER",
    revision: 1,
    createdAt: stamp,
  };
  const questions = [1, 2].map((n) => ({
    id: "qa-question-" + n,
    orgId: org.id,
    classId: "qa-class",
    prompt: "Câu hỏi kiểm thử " + n,
    kind: "mcq",
    choices: ["Đáp án một", "Đáp án hai"],
    correctIndex: 0,
    explanation: "Giáo viên cần xem lại giải thích.",
    maxPoints: 1,
    topic: "Số học",
    difficulty: "basic",
    references: [],
    status: "reviewed",
    revision: 2,
    createdBy: "qa-teacher-a",
    createdAt: stamp,
    updatedAt: stamp,
  }));
  const state = {
    version: 1,
    serverTime: stamp,
    actor: {
      userId: "qa-teacher-a",
      name: "KIỂM THỬ · GIÁO VIÊN",
      accountKey: "qa-teaching-a",
      systemRole: "USER",
      approvedTeacher: true,
      canCreateOrganization: true,
    },
    organizations: [org],
    organization: org,
    role: "TEACHER",
    permissions: { manageOrg: false, teach: true, learn: false },
    classes: [
      {
        id: "qa-class",
        orgId: org.id,
        name: "Lớp kiểm thử A",
        subject: "Toán",
        grade: "9",
        description: "Dữ liệu tổng hợp",
        archived: false,
        revision: 3,
        createdAt: stamp,
        teacherIds: ["qa-teacher-a"],
      },
    ],
    members: [],
    enrollments: [],
    groups: [],
    invites: [],
    materials: [],
    lessons: [],
    questions,
    assignments: [],
    submissions: [],
    announcements: [],
    events: [],
    settings: {
      name: org.name,
      timezone: "Asia/Ho_Chi_Minh",
      allowLateSubmissions: false,
      revision: 1,
    },
    preferences: null,
    dashboard: {
      classes: 1,
      students: 0,
      materials: 0,
      lessons: 0,
      questions: 2,
      assignments: 0,
      awaitingGrading: 0,
      dueSoon: 0,
      publishedAssessments: 0,
      averagePercent: null,
    },
    analytics: [],
  };
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    if (!/^http:\/\/localhost:3000\//.test(route.request().url()))
      external.push(route.request().url());
    return route.fulfill({ status: 404, body: "SYNTHETIC_FIXTURE_NO_NETWORK" });
  });
  for (const [url, file, contentType] of [
    ["**/__v7-teaching-ui", "fixture.html", "text/html"],
    ["**/__v7-teaching-ui.js", "fixture.js", "text/javascript"],
    ["**/__v7-teaching-ui.css", "fixture.css", "text/css"],
  ])
    await page.route(url, (route) =>
      route.fulfill({ path: "work/v7-teaching-ui/" + file, contentType }),
    );
  await page.route("**/brand/lumio-logo.png", (route) =>
    route.fulfill({
      path: "public/brand/lumio-logo.png",
      contentType: "image/png",
    }),
  );
  let failFirst = true;
  await page.route("**/api/teaching**", (route) => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ json: state });
    const body = req.postDataJSON();
    requests.push(body);
    check(
      body.orgId === org.id &&
        req.headers()["x-lumio-account"] === "qa-teaching-a",
      "Mutation remains bound to current teacher account and organization " +
        requests.length,
    );
    if (body.action === "assignment.compose") {
      if (failFirst) {
        failFirst = false;
        return route.fulfill({
          status: 422,
          json: {
            error: "TEACHING_BLUEPRINT_SHORTAGE",
            shortages: [{ row: 1, requested: 2, available: 1, missing: 1 }],
          },
        });
      }
      check(
        !("questionIds" in body.draft) &&
          body.expectedClassRevision === 3 &&
          body.blueprint[0].count === 2,
        "Composition request sends requirements and class revision, not caller-selected IDs",
      );
      state.assignments = [
        {
          ...body.draft,
          id: "qa-assignment",
          orgId: org.id,
          questions: JSON.parse(JSON.stringify(questions)),
          questionIds: questions.map((q) => q.id),
          status: "draft",
          revision: 1,
          createdAt: stamp,
          createdBy: "qa-teacher-a",
          issuedAt: null,
          recipientIds: [],
          maxPoints: 2,
          availableFrom: null,
          availableUntil: null,
          questionCount: 2,
          rootAssignmentId: "qa-assignment",
          attemptNo: 1,
          practiceRetake: false,
        },
      ];
      state.dashboard.assignments = 1;
    } else if (body.action === "assignment.update") {
      const a = state.assignments[0];
      Object.assign(a, body.draft, {
        questions: questions.filter((q) =>
          body.draft.questionIds.includes(q.id),
        ),
        maxPoints: body.draft.questionIds.length,
        questionCount: body.draft.questionIds.length,
        revision: 2,
      });
    } else throw Error("UNEXPECTED_FIXTURE_ACTION:" + body.action);
    return route.fulfill({
      json: { state, result: { id: "qa-assignment" }, replayed: false },
    });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://localhost:3000/__v7-teaching-ui");
  const nav = page
    .locator(".tw-sidebar nav")
    .getByRole("button", { name: "Bài tập", exact: true });
  if (!(await nav.isVisible()))
    await page.locator(".tw-more-nav > summary").click();
  await nav.click();
  await page.getByRole("button", { name: "Tạo bài tập", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Tên bài tập", { exact: true })
    .fill("Đề kiểm thử ma trận");
  await dialog
    .getByRole("combobox", { name: "Lớp nhận bài", exact: true })
    .selectOption("qa-class");
  await dialog
    .getByLabel("Hạn nộp (giờ trên thiết bị)", { exact: true })
    .fill("2027-01-01T12:00");
  await dialog
    .getByLabel("Hướng dẫn", { exact: true })
    .fill("Giáo viên kiểm tra bản nháp trước khi giao.");
  await dialog
    .getByRole("combobox", { name: "Cách chọn câu", exact: true })
    .selectOption("blueprint");
  await dialog
    .getByRole("combobox", { name: "Chủ đề", exact: true })
    .selectOption("Số học");
  await dialog
    .getByRole("combobox", { name: "Độ khó", exact: true })
    .selectOption("basic");
  await dialog.getByLabel("Số câu", { exact: true }).fill("3");
  check(
    (await dialog.textContent()).includes("thiếu 1 câu không trùng"),
    "Live matrix preview reports exact authorized-bank shortage",
  );
  await dialog.getByLabel("Số câu", { exact: true }).fill("2");
  check(
    (await dialog.textContent()).includes("Dự kiến ghép đủ 2 câu"),
    "Complete matrix preview shows actual count",
  );
  check(
    (await dialog.textContent()).includes("không gọi AI và không dùng credit"),
    "Composition transparently identifies local deterministic bank selection",
  );
  await dialog
    .getByRole("button", { name: "Lưu đề nháp", exact: false })
    .click();
  await dialog.getByRole("alert").waitFor();
  check(
    (await dialog.getByRole("alert").textContent()).includes(
      "Dòng 1: cần 2, chọn được 1, thiếu 1",
    ),
    "Server shortage details render without losing teacher form",
  );
  check(
    (await dialog.getByLabel("Tên bài tập", { exact: true }).inputValue()) ===
      "Đề kiểm thử ma trận",
    "Form is retained after rejected composition",
  );
  await dialog
    .getByRole("button", { name: "Lưu đề nháp", exact: false })
    .click();
  await dialog.waitFor({ state: "hidden" });
  check(
    requests[0].requestId === requests[1].requestId,
    "Retry uses the existing idempotency request ID",
  );
  const card = page
    .locator("article.tw-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Đề kiểm thử ma trận",
        exact: true,
      }),
    });
  check(
    (await card.textContent()).includes("Nháp") &&
      (await card.textContent()).includes("0 người nhận đã chốt"),
    "Created assessment remains a draft without recipients",
  );
  await card.getByText("Xem phân bố & kiểm tra đề", { exact: true }).click();
  check(
    (await card.getByRole("table").textContent()).includes("Số học"),
    "Assignment card shows actual topic/type/difficulty distribution",
  );
  check(
    requests.every(
      (r) => !["assignment.review", "assignment.issue"].includes(r.action),
    ),
    "No implicit review or publish request is sent",
  );
  await card.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  await dialog.getByRole("checkbox").last().uncheck();
  check(
    (await dialog.textContent()).includes("1 câu · 1 điểm"),
    "Ordinary draft edit recalculates the current distribution",
  );
  await dialog
    .getByRole("button", { name: "Lưu đề nháp", exact: false })
    .click();
  await dialog.waitFor({ state: "hidden" });
  check(
    requests.at(-1).action === "assignment.update" &&
      requests.at(-1).draft.questionIds.length === 1,
    "Composed draft reuses the normal CAS update path",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await card.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
    "Mobile teacher editor does not overflow the page horizontally",
  );
  check(
    await dialog
      .getByRole("button", { name: "Lưu đề nháp", exact: false })
      .isVisible(),
    "Mobile save action remains available",
  );
  await page.screenshot({
    path: "docs/v8/qa-assessment-mobile.png",
    fullPage: true,
  });
  check(
    errors.length === 0,
    "No browser runtime errors in blueprint and draft editing",
  );
  check(
    external.length === 0,
    "Fixture contacts no external service or live API",
  );
  return {
    status: "PASS",
    passed: cases.length,
    cases,
    errors,
    providerRequests: 0,
    scope:
      "Actual teacher React/CSS and browser interaction with synthetic HTTP. Backend behavior is covered separately by isolated SQLite handler tests.",
  };
};
