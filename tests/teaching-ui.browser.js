// Every participant/content row and HTTP response is an explicit synthetic fixture.
async (page) => {
  const passed = [],
    errors = [],
    requests = [],
    generations = [],
    receipts = new Map(),
    external = [];
  let loseAck = false,
    failMutation = false,
    loseAI = false,
    failRead = false,
    currentMode = "teacher",
    privateB = false;
  const check = (ok, label) => {
      if (!ok) throw Error(label);
      passed.push(label);
    },
    clone = (v) => JSON.parse(JSON.stringify(v));
  const stamp = "2026-10-15T10:00:00.000Z",
    state = {
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
      organizations: [],
      organization: null,
      role: null,
      permissions: { manageOrg: false, teach: false, learn: false },
      classes: [],
      members: [],
      enrollments: [],
      groups: [],
      invites: [],
      materials: [],
      lessons: [],
      questions: [],
      assignments: [],
      submissions: [],
      announcements: [],
      events: [],
      settings: null,
      preferences: null,
      dashboard: {
        classes: 0,
        students: 0,
        materials: 0,
        lessons: 0,
        questions: 0,
        assignments: 0,
        awaitingGrading: 0,
        dueSoon: 0,
        publishedAssessments: 0,
        averagePercent: null,
      },
      analytics: [],
    };
  const student = {
    ...clone(state),
    actor: {
      userId: "qa-student",
      name: "KIỂM THỬ · HỌC SINH",
      accountKey: "qa-teaching-student",
      systemRole: "USER",
      approvedTeacher: false,
      canCreateOrganization: false,
    },
  };
  function recalc() {
    state.dashboard = {
      classes: state.classes.length,
      students: state.enrollments.filter((e) => e.active).length,
      materials: state.materials.length,
      lessons: state.lessons.length,
      questions: state.questions.length,
      assignments: state.assignments.length,
      awaitingGrading: state.submissions.filter((s) => s.status !== "published")
        .length,
      dueSoon: state.assignments.filter((a) => a.status === "issued").length,
      publishedAssessments: state.submissions.filter(
        (s) => s.status === "published",
      ).length,
      averagePercent: state.submissions.some((s) => s.status === "published")
        ? 100
        : null,
    };
    if (state.submissions.some((s) => s.status === "published"))
      state.analytics = [
        {
          studentId: "qa-student",
          studentName: "KIỂM THỬ · HỌC SINH",
          assessments: 1,
          averagePercent: 100,
          topics: [
            {
              topic: "Phương trình",
              assessments: 1,
              averagePercent: 100,
              level: "insufficient",
            },
          ],
        },
      ];
  }
  function response(key) {
    recalc();
    if (key === "qa-teaching-b")
      return {
        ...clone(state),
        actor: {
          ...state.actor,
          accountKey: key,
          userId: "qa-teacher-b",
          name: "KIỂM THỬ TÀI KHOẢN B",
        },
        organizations: [],
        organization: null,
        classes: [],
        materials: [],
        lessons: [],
        questions: [],
        submissions: [],
        assignments: [],
        members: [],
        groups: [],
        enrollments: [],
        announcements: [],
        events: [],
        analytics: [],
      };
    if (key !== "qa-teaching-student") return clone(state);
    if (!student.organization) return clone(student);
    const result = clone(state);
    result.actor = student.actor;
    result.role = "STUDENT";
    result.permissions = { manageOrg: false, teach: false, learn: true };
    result.questions = [];
    result.analytics = [];
    result.members = [];
    result.invites = [];
    result.assignments = result.assignments
      .filter((a) => ["issued", "closed"].includes(a.status))
      .map((a) => ({
        ...a,
        questions: a.questions.map((q) => {
          const { correctIndex, explanation, rubric, modelAnswer, ...safe } = q;
          return safe;
        }),
      }));
    result.materials = result.materials.filter((m) => m.status === "published");
    result.lessons = result.lessons.filter((l) => l.status === "published");
    result.announcements = result.announcements.filter(
      (a) => a.status === "published",
    );
    result.submissions = result.submissions.map((s) => {
      if (s.status === "published") return s;
      const { score, grades, feedback, autoScore, ...safe } = s;
      return safe;
    });
    return result;
  }
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (
      /^https?:\/\//.test(url) &&
      !/^http:\/\/(localhost|127\.0\.0\.1):3000\//.test(url)
    ) {
      external.push(url);
      return route.abort();
    }
    if (/\/api\//.test(url))
      return route.fulfill({
        status: 409,
        json: { error: "SYNTHETIC_UI_NO_OTHER_API" },
      });
    return route.continue();
  });
  for (const [url, file, type] of [
    ["**/__teaching-ui", "fixture.html", "text/html"],
    ["**/__teaching-ui.js", "fixture.js", "text/javascript"],
    ["**/__teaching-ui.css", "fixture.css", "text/css"],
  ])
    await page.route(url, (route) =>
      route.fulfill({ path: "work/teaching-ui/" + file, contentType: type }),
    );
  await page.route("**/brand/lumio-logo.png", (route) =>
    route.fulfill({
      path: "public/brand/lumio-logo.png",
      contentType: "image/png",
    }),
  );
  await page.route("**/fonts/KaTeX*", (route) => {
    const match = /(KaTeX_[A-Za-z0-9-]+\.(?:woff2?|ttf))$/.exec(
      route.request().url(),
    );
    return match
      ? route.fulfill({
          path: "node_modules/katex/dist/fonts/" + match[1],
          contentType: match[1].endsWith("woff2")
            ? "font/woff2"
            : match[1].endsWith("woff")
              ? "font/woff"
              : "font/ttf",
        })
      : route.abort();
  });
  await page.route("**/api/teaching/generate", (route) => {
    const body = route.request().postDataJSON();
    generations.push(body);
    check(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        body.requestId,
      ),
      "AI request carries a UUIDv4 billing key",
    );
    if (generations.slice(0, -1).some((g) => g.requestId === body.requestId))
      return route.fulfill({
        status: 409,
        json: { error: "BILLING_REQUEST_FINALIZED" },
      });
    if (loseAI) {
      loseAI = false;
      return route.abort("failed");
    }
    return route.fulfill({
      json: {
        kind: body.kind,
        draft:
          body.kind === "lesson"
            ? {
                classId: null,
                title: "KIỂM THỬ · Bài AI chưa lưu",
                topic: body.topic,
                grade: body.grade,
                objectives: [body.objective],
                sections: [
                  {
                    title: "Hoạt động",
                    body: "So sánh phép biến đổi ở hai vế.",
                    references: [],
                  },
                ],
                sourceIds: body.sourceIds,
              }
            : body.kind === "questions"
              ? []
              : {
                  text: "KIỂM THỬ · Gợi ý \\(x=4\\) chưa xác minh, cần giáo viên xem lại. <img src=x onerror=alert(1)>",
                  references: [],
                },
        quality: {
          status: "review-required",
          blocked: false,
          structuralChecks: true,
          sourceSupport: "inference-no-source",
          math: "not-checked",
          issues: [
            {
              code: "SEMANTIC_REVIEW_REQUIRED",
              path: "",
              severity: "review",
              message: "Nội dung cần được giáo viên đối chiếu.",
            },
          ],
          teacherReviewRequired: true,
          publication: "draft-only",
        },
        sourceBasis: {
          mode: body.sourceIds.length ? "saved-sources" : "topic-inference",
          materials: [],
          verifiedClaims: false,
        },
        requestId: "qa-generation",
      },
    });
  });
  await page.route("**/api/teaching**", async (route) => {
    if (/\/generate/.test(route.request().url())) return route.fallback();
    const req = route.request(),
      key = req.headers()["x-lumio-account"];
    if (!key) throw Error("MISSING_ACCOUNT_HEADER");
    if (req.method() === "GET") {
      if (failRead) {
        failRead = false;
        return route.fulfill({
          status: 403,
          json: { error: "TEACHING_FORBIDDEN", private: "SYNTHETIC_SECRET" },
        });
      }
      return route.fulfill({ json: response(key) });
    }
    const b = req.postDataJSON();
    requests.push(b);
    if (failMutation) {
      failMutation = false;
      return route.fulfill({
        status: 403,
        json: { error: "TEACHING_FORBIDDEN" },
      });
    }
    if (receipts.has(b.requestId))
      return route.fulfill({
        json: { ...receipts.get(b.requestId), replayed: true },
      });
    let result = {};
    const id = (prefix) => prefix + "-" + (requests.length + 1);
    const content = (kind, list) => {
      if (b.action.endsWith(".create")) {
        const row = {
          ...b.draft,
          id: id(kind),
          orgId: state.organization.id,
          status: "draft",
          revision: 1,
          createdBy: "qa-teacher-a",
          createdAt: stamp,
          updatedAt: stamp,
        };
        list.push(row);
        return row;
      }
      const row = list.find((x) => x.id === b.id);
      if (b.action.endsWith(".update")) {
        check(
          !("id" in b.draft) && !("status" in b.draft),
          "Editor sends only allowed draft fields",
        );
        Object.assign(row, b.draft, {
          status: "draft",
          revision: row.revision + 1,
        });
      } else {
        row.status = b.action.endsWith(".publish") ? "published" : "reviewed";
        row.revision++;
      }
      return row;
    };
    if (b.action === "org.create") {
      const org = {
        id: "qa-org",
        name: b.name,
        role: "ORGANIZATION_ADMIN",
        revision: 1,
        createdAt: stamp,
      };
      state.organizations = [org];
      state.organization = org;
      state.role = "ORGANIZATION_ADMIN";
      state.permissions = { manageOrg: true, teach: true, learn: false };
      state.settings = {
        name: b.name,
        timezone: "Asia/Ho_Chi_Minh",
        allowLateSubmissions: false,
        revision: 1,
      };
      state.members = [
        {
          userId: "qa-teacher-a",
          name: state.actor.name,
          role: "OWNER",
          approvedTeacher: true,
        },
        {
          userId: "qa-teacher-other",
          name: "KIỂM THỬ ĐỒNG GIẢNG",
          role: "TEACHER",
          approvedTeacher: true,
        },
      ];
    } else if (b.action === "class.create") {
      state.classes.push({
        id: "qa-class",
        orgId: "qa-org",
        name: b.name,
        subject: b.subject,
        grade: b.grade,
        description: b.description,
        archived: false,
        revision: 1,
        createdAt: stamp,
        teacherIds: ["qa-teacher-a"],
      });
    } else if (b.action === "invite.create") {
      state.invites.push({
        id: "qa-invite",
        classId: b.classId,
        expiresAt: "2099-01-01T00:00:00Z",
        maxUses: b.maxUses,
        uses: 0,
        active: true,
        revision: 1,
      });
      result.inviteCode = "QA-LUMIO-CODE";
    } else if (b.action === "class.join") {
      student.organization = clone(state.organization);
      student.organizations = [clone(state.organization)];
      state.enrollments.push({
        id: "qa-enrollment",
        classId: "qa-class",
        userId: "qa-student",
        name: student.actor.name,
        active: true,
        revision: 1,
        joinedAt: stamp,
      });
    } else if (b.action === "group.save") {
      state.groups.push({
        id: "qa-group",
        classId: b.classId,
        name: b.name,
        memberIds: b.memberIds,
        revision: 1,
      });
    } else if (b.action === "teacher.assign") {
      state.classes[0].teacherIds.push(b.userId);
      state.classes[0].revision++;
    } else if (b.action.startsWith("material."))
      content("material", state.materials);
    else if (b.action.startsWith("lesson.")) content("lesson", state.lessons);
    else if (b.action.startsWith("question."))
      content("question", state.questions);
    else if (b.action === "assignment.create") {
      const questions = b.draft.questionIds.map((id) => {
        const q = clone(state.questions.find((q) => q.id === id));
        return q;
      });
      state.assignments.push({
        ...b.draft,
        id: "qa-assignment",
        orgId: "qa-org",
        questions,
        status: "draft",
        revision: 1,
        createdBy: "qa-teacher-a",
        createdAt: stamp,
        issuedAt: null,
        maxPoints: questions.reduce((n, q) => n + q.maxPoints, 0),
      });
    } else if (
      b.action === "assignment.review" ||
      b.action === "assignment.issue"
    ) {
      state.assignments[0].status = b.action.endsWith("issue")
        ? "issued"
        : "reviewed";
      state.assignments[0].revision++;
      state.assignments[0].recipientIds = ["qa-student"];
    } else if (b.action === "submission.submit") {
      check(
        b.expectedRevision === 0,
        "First student submission uses revision0 rather than assignment revision",
      );
      state.submissions.push({
        id: "qa-submission",
        orgId: "qa-org",
        assignmentId: b.assignmentId,
        classId: "qa-class",
        studentId: "qa-student",
        studentName: student.actor.name,
        answers: b.answers,
        submittedAt: stamp,
        late: false,
        status: "submitted",
        revision: 1,
        autoScore: 1,
      });
    } else if (b.action === "submission.grade") {
      Object.assign(state.submissions[0], {
        grades: b.grades,
        feedback: b.feedback,
        score: b.grades.reduce((n, g) => n + g.points, 0),
        status: "graded",
        revision: 2,
        confirmedAt: stamp,
      });
    } else if (b.action === "submission.publish") {
      Object.assign(state.submissions[0], {
        status: "published",
        revision: 3,
        publishedAt: stamp,
      });
    } else if (b.action === "announcement.save") {
      state.announcements.push({
        id: "qa-announcement",
        orgId: "qa-org",
        classId: b.classId,
        title: b.title,
        body: b.body,
        status: "draft",
        revision: 1,
        createdBy: "qa-teacher-a",
        createdAt: stamp,
      });
    } else if (b.action === "announcement.publish") {
      state.announcements[0].status = "published";
      state.announcements[0].revision++;
    } else if (b.action === "event.save") {
      state.events.push({ ...b, id: "qa-event", orgId: "qa-org", revision: 1 });
    } else if (b.action === "settings.update") {
      state.settings = {
        name: b.name,
        timezone: b.timezone,
        allowLateSubmissions: b.allowLateSubmissions,
        revision: state.settings.revision + 1,
      };
    } else if (b.action === "preferences.update") {
      state.preferences = { ...b, revision: 1 };
    } else throw Error("UNIMPLEMENTED_FIXTURE_ACTION " + b.action);
    const payload = { state: response(key), result, replayed: false };
    receipts.set(b.requestId, clone(payload));
    if (loseAck) {
      loseAck = false;
      return route.abort("failed");
    }
    return route.fulfill({ json: payload });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://localhost:3000/__teaching-ui");
  await page
    .getByRole("button", { name: "Tạo không gian giảng dạy", exact: false })
    .waitFor();
  check(
    (await page.locator(".tw-sidebar nav button").count()) === 12,
    "Twelve teacher modules have a visible navigation entry",
  );
  check(
    (await page.locator(".tw-stat").count()) === 0,
    "New account contains no seeded classes, students or fabricated metrics",
  );
  const nav = async (name) =>
    page
      .locator(".tw-sidebar nav")
      .getByRole("button", { name, exact: true })
      .click();
  const dialog = () => page.locator("dialog[open]");
  const save = async (name) => {
    await dialog().getByRole("button", { name, exact: true }).click();
    await dialog().waitFor({ state: "hidden" });
  };
  await page
    .getByRole("button", { name: "Tạo không gian giảng dạy", exact: false })
    .click();
  await dialog()
    .getByRole("textbox", { name: /^Tên không gian/ })
    .fill("KIỂM THỬ · Không gian Toán");
  await save("Tạo không gian");
  await page.locator(".tw-stat").first().waitFor();
  check(
    (await page.locator(".tw-stat").first().textContent()).includes("0"),
    "Dashboard counts reflect an actually empty organization",
  );
  await nav("Lớp học");
  await page
    .getByRole("button", { name: "Tạo lớp đầu tiên", exact: true })
    .click();
  await dialog()
    .getByRole("textbox", { name: "Tên lớp", exact: true })
    .fill("KIỂM THỬ · Lớp 9");
  await dialog()
    .getByRole("textbox", { name: "Môn học", exact: true })
    .fill("Toán");
  await dialog()
    .getByRole("textbox", { name: "Khối / Trình độ", exact: true })
    .fill("9");
  await save("Lưu thay đổi");
  check(
    state.classes.length === 1,
    "Create-class form persists canonical class fields through the API",
  );
  await page.getByRole("button", { name: "Mở lớp", exact: false }).click();
  await page.getByRole("button", { name: "Mời học sinh", exact: true }).click();
  await save("Tạo mã tham gia");
  await page.locator(".tw-code").waitFor();
  check(
    state.invites.length === 1 &&
      (await page.locator(".tw-code").textContent()).includes("QA-LUMIO-CODE"),
    "Class invitation is returned only by the explicit create action",
  );
  await nav("Thư viện giảng dạy");
  await page
    .getByRole("button", { name: "Thêm học liệu đầu tiên", exact: true })
    .click();
  await dialog()
    .getByRole("textbox", { name: "Tên học liệu", exact: true })
    .fill("KIỂM THỬ · Điều kiện phương trình");
  await dialog()
    .getByRole("combobox", { name: "Phạm vi lớp", exact: true })
    .selectOption("qa-class");
  await dialog()
    .getByLabel(/^Đọc từ tệp/)
    .setInputFiles("work/teaching-ui/authored.txt");
  await dialog()
    .getByRole("textbox", { name: /^Nội dung đã xử lý/ })
    .waitFor();
  await page.waitForFunction(() =>
    document.querySelector("dialog textarea")?.value.includes("2x + 3"),
  );
  await save("Lưu học liệu nháp");
  check(
    state.materials[0].content.includes("khác không"),
    "File-text import populates the editor and saves supplied text without fake extraction claims",
  );
  await page.getByRole("button", { name: "Đã xem lại", exact: true }).click();
  await page
    .getByRole("button", { name: "Chia sẻ cho lớp", exact: true })
    .click();
  check(
    state.materials[0].status === "published",
    "Teaching material requires review before explicit sharing",
  );
  await nav("Studio bài giảng");
  await page
    .getByRole("button", { name: "Soạn bài đầu tiên", exact: true })
    .click();
  await dialog()
    .getByRole("textbox", { name: "Tên bài giảng", exact: true })
    .fill("KIỂM THỬ · Giữ cân bằng");
  await dialog()
    .getByRole("textbox", { name: "Chủ đề", exact: true })
    .fill("Phương trình");
  await dialog()
    .getByRole("textbox", { name: "Khối / Trình độ", exact: true })
    .fill("9");
  await dialog()
    .getByRole("combobox", { name: "Phạm vi lớp", exact: true })
    .selectOption("qa-class");
  await dialog()
    .getByRole("textbox", {
      name: "Mục tiêu (mỗi dòng một mục tiêu)",
      exact: true,
    })
    .fill("Chỉ chia cho một số khác không.");
  await dialog()
    .getByRole("textbox", { name: "Nội dung phần", exact: true })
    .fill("Biến đổi cùng cách ở hai vế; kiểm tra điều kiện phép chia.");
  await save("Lưu bản nháp");
  await page.getByRole("button", { name: "Đã xem lại", exact: true }).click();
  await page
    .getByRole("button", { name: "Chia sẻ cho lớp", exact: true })
    .click();
  check(
    state.lessons[0].status === "published",
    "Lesson studio supports editable objectives and sections, review then publish",
  );
  await page
    .getByRole("button", { name: "Mở & chỉnh sửa", exact: false })
    .click();
  await dialog()
    .getByRole("textbox", { name: "Tên bài giảng", exact: true })
    .fill("KIỂM THỬ · Giữ cân bằng đã sửa");
  await save("Lưu bản nháp");
  check(
    state.lessons[0].title.endsWith("đã sửa"),
    "Existing lesson can be edited without sending server metadata as draft fields",
  );
  await nav("Ngân hàng câu hỏi");
  await page.getByRole("button", { name: "Thêm câu hỏi", exact: true }).click();
  await dialog()
    .getByRole("textbox", { name: "Câu hỏi", exact: true })
    .fill("Nghiệm của \\(2x+3=11\\) là gì?");
  await dialog()
    .getByRole("textbox", { name: "Chủ đề", exact: true })
    .fill("Phương trình");
  for (const [i, value] of ["4", "3", "2", "1"].entries())
    await dialog()
      .getByRole("textbox", {
        name: "Lựa chọn " + String.fromCharCode(65 + i),
        exact: true,
      })
      .fill(value);
  await save("Lưu câu hỏi nháp");
  await page
    .getByRole("button", { name: "Xác nhận đã kiểm tra đáp án", exact: true })
    .click();
  check(
    state.questions[0].status === "reviewed",
    "Question bank keeps answer keys in a draft until teacher review",
  );
  await nav("Bài tập");
  await page
    .getByRole("button", { name: "Tạo bài tập đầu tiên", exact: false })
    .click();
  await dialog()
    .getByRole("textbox", { name: "Tên bài tập", exact: true })
    .fill("KIỂM THỬ · Luyện phương trình");
  await dialog()
    .getByRole("combobox", { name: "Lớp nhận bài", exact: true })
    .selectOption("qa-class");
  await dialog()
    .locator('input[type="datetime-local"]')
    .fill("2099-01-01T10:00");
  await dialog()
    .getByRole("textbox", { name: "Hướng dẫn", exact: true })
    .fill("Giải và kiểm tra lại điều kiện.");
  await dialog().getByRole("checkbox").check();
  await save("Lưu đề nháp");
  await page
    .getByRole("button", { name: "Duyệt đề & đối tượng", exact: true })
    .click();
  await page.getByRole("button", { name: "Giao bài", exact: true }).click();
  check(
    state.assignments[0].status === "issued",
    "Assignment creation freezes reviewed questions and requires review before issuing",
  );
  await page.evaluate(() => window.__mountTeaching("student"));
  await page.getByRole("textbox", { name: /^Mã tham gia lớp/ }).waitFor();
  await page
    .getByRole("textbox", { name: /^Mã tham gia lớp/ })
    .fill("QA-LUMIO-CODE");
  await page.getByRole("button", { name: "Tham gia lớp", exact: true }).click();
  await page
    .getByRole("button", { name: "Mở bài tập", exact: false })
    .waitFor();
  check(
    state.enrollments.length === 1,
    "Student joins through an invite and the member record appears only afterward",
  );
  await page.getByRole("button", { name: "Mở bài tập", exact: false }).click();
  check(
    !(await dialog().textContent()).includes("Đáp án đúng"),
    "Student assignment form renders choices without teacher keys or rubric",
  );
  check(
    (await dialog().locator(".katex").count()) > 0,
    "Student question formulas use the shared safe math renderer",
  );
  check(
    (await dialog()
      .locator(".katex-mathml")
      .first()
      .evaluate((el) => getComputedStyle(el).position)) === "absolute",
    "Production KaTeX stylesheet hides the accessible MathML duplicate in visual formulas",
  );
  await dialog().getByRole("radio").first().check();
  await dialog().getByRole("checkbox").check();
  failMutation = true;
  await save("Nộp bài cho giáo viên");
  await page
    .getByText("Bạn chưa có quyền thao tác với lớp hoặc nội dung này.", {
      exact: true,
    })
    .waitFor();
  check(
    (await dialog().count()) === 0 &&
      !(await page.locator("[data-student-classroom]").textContent()).includes(
        "Nghiệm của 2x",
      ),
    "Denied student submission clears both cached class data and the private open assignment modal",
  );
  await page
    .getByRole("button", { name: "Tải lại lớp học", exact: true })
    .click();
  await page.getByRole("button", { name: "Mở bài tập", exact: false }).click();
  await dialog().getByRole("radio").first().check();
  await dialog().getByRole("checkbox").check();
  await save("Nộp bài cho giáo viên");
  check(
    state.submissions.length === 1,
    "Student confirmation sends selected answers to the canonical submission action",
  );
  await page.getByRole("tab", { name: "Kết quả", exact: true }).click();
  check(
    (await page.locator("[data-student-classroom]").textContent()).includes(
      "Giáo viên chưa công bố kết quả",
    ) &&
      !(await page.locator("[data-student-classroom]").textContent()).includes(
        "1 / 1 điểm",
      ),
    "Unpublished scores and comments remain hidden in student results",
  );
  await page.evaluate(() => window.__mountTeaching("teacher"));
  await page.locator(".tw-sidebar nav").waitFor();
  await nav("Chấm & nhận xét");
  await page
    .getByRole("button", { name: "Chấm & nhận xét", exact: true })
    .last()
    .click();
  await dialog()
    .getByRole("spinbutton", { name: /^Điểm câu 1/ })
    .fill("1");
  await dialog()
    .getByRole("textbox", { name: "Nhận xét chung", exact: true })
    .fill("Đã xác định đúng nghiệm.");
  await dialog().getByRole("checkbox").check();
  await save("Lưu phần chấm của giáo viên");
  check(
    state.submissions[0].status === "graded",
    "Teacher confirms per-question scores before saving grading",
  );
  await page
    .getByRole("button", { name: "Công bố kết quả", exact: true })
    .click();
  check(
    state.submissions[0].status === "published",
    "Publishing grades is a separate teacher action",
  );
  await nav("Tiến bộ học tập");
  check(
    (await page.locator(".tw-content").textContent()).includes(
      "Chưa đủ bằng chứng",
    ),
    "One published assessment cannot be presented as topic mastery",
  );
  await nav("Bảng tin & lịch");
  await page
    .getByRole("button", { name: "Soạn thông báo", exact: true })
    .click();
  await dialog()
    .getByRole("textbox", { name: "Tiêu đề", exact: true })
    .fill("KIỂM THỬ · Chuẩn bị bài sau");
  await dialog()
    .getByRole("combobox", { name: "Phạm vi lớp", exact: true })
    .selectOption("qa-class");
  await dialog()
    .getByRole("textbox", { name: "Nội dung thông báo", exact: true })
    .fill("Đọc lại điều kiện trước phép chia.");
  await save("Lưu nháp thông báo");
  await page
    .getByRole("button", { name: "Đăng thông báo", exact: false })
    .click();
  await page.getByRole("tab", { name: "Lịch & sự kiện", exact: true }).click();
  await page
    .getByRole("button", { name: "Thêm lịch hẹn", exact: true })
    .click();
  await dialog()
    .getByRole("textbox", { name: "Tiêu đề", exact: true })
    .fill("KIỂM THỬ · Ôn tập");
  await dialog()
    .getByRole("combobox", { name: "Phạm vi lớp", exact: true })
    .selectOption("qa-class");
  await dialog()
    .getByRole("textbox", { name: "Mô tả", exact: true })
    .fill("Thực hành phép biến đổi tương đương.");
  await dialog()
    .locator('input[type="datetime-local"]')
    .first()
    .fill("2099-01-02T10:00");
  await dialog()
    .locator('input[type="datetime-local"]')
    .last()
    .fill("2099-01-02T11:00");
  await save("Lưu lịch hẹn");
  check(
    state.announcements[0].status === "published" && state.events.length === 1,
    "Announcements and calendar persist real form inputs through their own actions",
  );
  await nav("Trợ lý giảng dạy");
  await page
    .getByRole("textbox", { name: "Câu hỏi / Chủ đề", exact: true })
    .fill("Dạy điều kiện phép chia");
  await page
    .getByRole("textbox", { name: "Khối / Trình độ", exact: true })
    .fill("9");
  check(
    await page
      .getByRole("button", { name: "Tạo bản nháp", exact: true })
      .isDisabled(),
    "AI generation is gated by fresh explicit outbound-data consent",
  );
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Tạo bản nháp", exact: true }).click();
  await page.locator("[data-teaching-ai-result]").waitFor();
  check(
    (await page.locator("[data-teaching-ai-result] .katex").count()) > 0 &&
      (await page.locator("[data-teaching-ai-result] img").count()) === 0,
    "Teacher AI preview renders TeX while keeping HTML-shaped provider output inert",
  );
  check(
    generations.length === 1 &&
      generations[0].externalProcessingConsent === true &&
      !("studentId" in generations[0]) &&
      state.lessons.length === 1,
    "AI assistant sends minimized context and does not auto-save or publish a draft",
  );
  await page
    .getByRole("button", { name: "Bắt đầu lượt tạo mới", exact: true })
    .click();
  loseAI = true;
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Tạo bản nháp", exact: true }).click();
  await page.locator('.tw-alert[role="alert"]').waitFor();
  check(
    generations.length === 2,
    "Uncertain AI network result is never automatically retried",
  );
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Tạo bản nháp", exact: true }).click();
  await page.getByText(/Lượt tạo này đã kết thúc/).waitFor();
  check(
    generations.length === 3 &&
      generations[1].requestId === generations[2].requestId,
    "Manual uncertain retry retains its billing UUID and explains a finalized lost draft",
  );
  await nav("Báo cáo");
  check(
    await page
      .getByRole("button", { name: "Xuất CSV", exact: true })
      .isEnabled(),
    "Published results enable reports while empty reports stay disabled",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV", exact: true }).click();
  check(
    (await download).suggestedFilename().endsWith(".csv"),
    "CSV report is a real browser download",
  );
  await nav("Cài đặt");
  await page
    .getByRole("textbox", { name: "Tên không gian", exact: true })
    .fill("KIỂM THỬ · Không gian đã sửa");
  await page.getByRole("button", { name: "Lưu cài đặt", exact: true }).click();
  check(
    state.settings.name.endsWith("đã sửa"),
    "Organization settings persist with their canonical revision",
  );
  await page
    .getByRole("textbox", { name: /^Tên hiển thị trong không gian/ })
    .fill("KIỂM THỬ · Cô An");
  await page.getByRole("textbox", { name: /^Môn giảng dạy/ }).fill("Toán");
  await page.getByRole("textbox", { name: /^Khối dạy/ }).fill("9");
  await page
    .getByRole("combobox", { name: "Ngôn ngữ AI mặc định", exact: true })
    .selectOption("en");
  await page
    .getByRole("combobox", { name: "Độ khó mặc định", exact: true })
    .selectOption("basic");
  loseAck = true;
  await page
    .getByRole("button", { name: "Lưu cài đặt cá nhân", exact: true })
    .click();
  await page.locator('form .tw-alert[role="alert"]').first().waitFor();
  check(
    state.preferences.displayName.includes("Cô An"),
    "Preference mutation survives a lost acknowledgement without clearing the form",
  );
  await page
    .getByRole("button", { name: "Lưu cài đặt cá nhân", exact: true })
    .click();
  await page
    .getByText("Yêu cầu trước đã được lưu. Không tạo thêm bản trùng.", {
      exact: true,
    })
    .waitFor();
  const prefRequests = requests.filter(
    (r) => r.action === "preferences.update",
  );
  check(
    prefRequests.length === 2 &&
      prefRequests[0].requestId === prefRequests[1].requestId,
    "Manual mutation retry reuses request ID and accepts one persisted receipt",
  );
  await nav("Trợ lý giảng dạy");
  check(
    (await page
      .getByRole("textbox", { name: "Câu hỏi / Chủ đề", exact: true })
      .inputValue()) === "Toán" &&
      (await page
        .getByRole("combobox", { name: "Ngôn ngữ bản nháp", exact: true })
        .inputValue()) === "en",
    "Saved subject, grade and language initialize a new AI draft form",
  );
  await nav("Cài đặt");
  await page
    .getByRole("checkbox", { name: /Cho phép dùng trợ lý AI/ })
    .uncheck();
  await page
    .getByRole("button", { name: "Lưu cài đặt cá nhân", exact: true })
    .click();
  await nav("Trợ lý giảng dạy");
  check(
    (await page
      .getByRole("button", { name: "Tạo bản nháp", exact: true })
      .isDisabled()) &&
      (await page.locator(".tw-content").textContent()).includes(
        "Bạn đã tắt trợ lý AI",
      ),
    "Persisted AI-disabled preference also gates the generation UI",
  );
  await nav("Lớp học");
  await page.getByRole("button", { name: "Mở lớp", exact: false }).click();
  await page.getByRole("tab", { name: "Nhóm học tập", exact: true }).click();
  await page.getByRole("button", { name: "Tạo nhóm", exact: true }).click();
  await dialog()
    .getByRole("textbox", { name: "Tên nhóm", exact: true })
    .fill("KIỂM THỬ · Nhóm A");
  await dialog().getByRole("checkbox").check();
  await save("Lưu thay đổi");
  check(
    state.groups.length === 1 && state.groups[0].memberIds[0] === "qa-student",
    "Group membership uses only enrolled student IDs",
  );
  await page.getByRole("tab", { name: "Đồng giảng dạy", exact: true }).click();
  await page
    .getByRole("button", { name: "Phân công giáo viên", exact: true })
    .click();
  await dialog()
    .getByLabel(/^Mã tài khoản giáo viên/)
    .fill("qa-teacher-other");
  await save("Lưu thay đổi");
  check(
    state.classes[0].teacherIds.includes("qa-teacher-other"),
    "Co-teacher assignment sends a canonical teacher account ID",
  );
  failRead = true;
  await page
    .getByRole("button", { name: "Tải lại không gian giảng dạy", exact: true })
    .click();
  await page
    .getByText("Bạn chưa có quyền thao tác với lớp hoặc nội dung này.", {
      exact: true,
    })
    .first()
    .waitFor();
  check(
    !(await page.locator("[data-teacher-workspace]").textContent()).includes(
      "SYNTHETIC_SECRET",
    ),
    "Forbidden responses display safe actionable copy without reflecting private error fields",
  );
  check(
    (await page.locator("[data-teaching-classes]").count()) === 0 &&
      !(await page.locator(".tw-content").textContent()).includes(
        "KIỂM THỬ · Lớp 9",
      ),
    "A denied reload removes cached private classes until access is reconfirmed",
  );
  await page
    .getByRole("button", { name: "Tải lại không gian giảng dạy", exact: true })
    .click();
  await page.locator("[data-teaching-classes]").waitFor();
  await nav("Tổng quan");
  await page.emulateMedia({ reducedMotion: "reduce" });
  check(
    (await page
      .locator(".tw-enter")
      .evaluate((element) => getComputedStyle(element).animationName)) ===
      "none",
    "Reduced-motion preference disables entry animation for accessible reading",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/v3/qa-teaching-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
    "Teacher shell fits a 768px tablet viewport",
  );
  await page.screenshot({
    path: "docs/v3/qa-teaching-tablet.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
    "Teacher shell fits a 390px phone viewport",
  );
  await page.screenshot({
    path: "docs/v3/qa-teaching-mobile.png",
    fullPage: true,
  });
  await page.evaluate(() => window.__mountTeaching("student"));
  await page.getByRole("tab", { name: "Kết quả", exact: true }).click();
  check(
    (await page.locator("[data-student-classroom]").textContent()).includes(
      "1 / 1 điểm",
    ),
    "Student sees the score only after the separate publication action",
  );
  await page.screenshot({
    path: "docs/v3/qa-classroom-mobile.png",
    fullPage: true,
  });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
    "Student classroom fits a 390px phone viewport",
  );
  check(
    await page.locator("[data-student-classroom] > .tw-topbar").evaluate((el) =>
      [...el.querySelectorAll("button,select,a")].every((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth + 1;
      }),
    ),
    "Student mobile header keeps join, organization and refresh controls fully on screen",
  );
  await page.evaluate(() => window.__mountTeaching("teacher", "b"));
  await page
    .getByRole("button", { name: "Tạo không gian giảng dạy", exact: false })
    .waitFor();
  check(
    !(await page.locator(".tw-content").textContent()).includes(
      "Luyện phương trình",
    ),
    "Account change clears the previous teacher's private class content",
  );
  check(
    errors.length === 0,
    "No runtime errors across the twelve modules and student workflow",
  );
  check(
    external.length === 0,
    "No external evidence, AI provider or payment was contacted",
  );
  return {
    status: "PASS",
    passed: passed.length,
    cases: passed,
    errors,
    paidProviderRequests: 0,
    actualStudents: 0,
    mutations: requests.length,
    generationMocks: generations.length,
    screenshots: [
      "docs/v3/qa-teaching-desktop.png",
      "docs/v3/qa-teaching-tablet.png",
      "docs/v3/qa-teaching-mobile.png",
      "docs/v3/qa-classroom-mobile.png",
    ],
    scope:
      "Actual components and browser storage/DOM with synthetic HTTP; real backend/compiled tests are separate evidence",
  };
};
