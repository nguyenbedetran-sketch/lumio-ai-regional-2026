// Every participant/content row and HTTP response is an explicit synthetic fixture.
async (page) => {
  const passed = [],
    errors = [],
    requests = [],
    generations = [],
    receipts = new Map(),
    reads = [],
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
    ["**/__v7-teaching-ui", "fixture.html", "text/html"],
    ["**/__v7-teaching-ui.js", "fixture.js", "text/javascript"],
    ["**/__v7-teaching-ui.css", "fixture.css", "text/css"],
  ])
    await page.route(url, (route) =>
      route.fulfill({ path: "work/v7-teaching-ui/" + file, contentType: type }),
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
      const orgMatch = /(?:\?|&)orgId=([^&]+)/.exec(req.url());
      const requestedOrg = orgMatch ? decodeURIComponent(orgMatch[1]) : null;
      reads.push({ key, orgId: requestedOrg });
      if (failRead) {
        failRead = false;
        return route.fulfill({
          status: 403,
          json: { error: "TEACHING_FORBIDDEN", private: "SYNTHETIC_SECRET" },
        });
      }
      const scoped = response(key);
      if (!requestedOrg) {
        const directory = {
          ...scoped,
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
          analytics: [],
          dashboard: {
            ...scoped.dashboard,
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
        };
        return route.fulfill({ json: directory });
      }
      if (!scoped.organizations.some((org) => org.id === requestedOrg))
        return route.fulfill({
          status: 403,
          json: { error: "TEACHING_FORBIDDEN" },
        });
      return route.fulfill({ json: scoped });
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
    } else if (b.action === "teacher.remove") {
      state.classes[0].teacherIds = state.classes[0].teacherIds.filter(
        (id) => id !== b.userId,
      );
      state.classes[0].revision++;
    } else if (b.action === "group.delete") {
      state.groups = state.groups.filter((g) => g.id !== b.id);
    } else if (b.action === "invite.revoke") {
      const row = state.invites.find((i) => i.id === b.id);
      row.active = false;
      row.revision++;
    } else if (
      b.action === "enrollment.remove" ||
      b.action === "enrollment.restore"
    ) {
      const row = state.enrollments.find((e) => e.id === b.id);
      row.active = b.action.endsWith("restore");
      row.revision++;
    } else if (b.action === "member.role") {
      state.members.find((m) => m.userId === b.userId).role = b.role;
      state.organization.revision++;
    } else if (b.action === "member.remove") {
      state.members = state.members.filter((m) => m.userId !== b.userId);
      state.organization.revision++;
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
        rootAssignmentId: "qa-assignment",
        attemptNo: 1,
        practiceRetake: false,
        questionCount: questions.length,
        canSubmit: true,
        availability: "available",
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
    } else if (b.action === "event.delete") {
      state.events = state.events.filter((e) => e.id !== b.id);
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
  await page.goto("http://localhost:3000/__v7-teaching-ui");
  await page
    .getByRole("button", { name: "Tạo không gian giảng dạy", exact: false })
    .waitFor();
  check(
    (await page.locator(".tw-sidebar nav button").count()) === 12,
    "All twelve teacher destinations remain in the navigation model",
  );
  check(
    (await page.locator(".tw-stat").count()) === 0,
    "New account contains no seeded classes, students or fabricated metrics",
  );
  check(
    (await page.locator(".tw-primary-nav button").count()) === 5,
    "Five primary teacher destinations replace twelve equal-priority entries",
  );
  const nav = async (name, discard = true) => {
    const target = page
      .locator(".tw-sidebar nav")
      .getByRole("button", { name, exact: true });
    if (!(await target.isVisible()))
      await page.locator(".tw-more-nav > summary").click();
    await target.click();
    const warning = page.getByRole("dialog", {
      name: "Giữ bản nháp đang làm?",
      exact: true,
    });
    if (discard && (await warning.count()))
      await warning
        .getByRole("button", { name: "Bỏ bản nháp và tiếp tục", exact: true })
        .click();
  };
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
  const initialDraftWrites = requests.length;
  await page
    .getByRole("dialog", { name: "Tạo lớp học", exact: true })
    .getByRole("textbox", { name: "Tên lớp", exact: true })
    .fill("BẢN NHÁP · Giữ lại");
  await page.keyboard.press("Escape");
  const discard = () =>
    page.getByRole("dialog", { name: "Giữ bản nháp đang làm?", exact: true });
  await discard().waitFor();
  check(
    requests.length === initialDraftWrites,
    "Escape on a dirty teacher form stages a decision without sending a mutation",
  );
  check(
    await discard()
      .getByRole("button", { name: "Ở lại chỉnh sửa", exact: true })
      .evaluate((el) => document.activeElement === el),
    "Discard dialog focuses the safe keep-editing action",
  );
  await page.keyboard.press("Shift+Tab");
  check(
    await discard()
      .getByRole("button", { name: "Bỏ bản nháp và tiếp tục", exact: true })
      .evaluate((el) => document.activeElement === el),
    "Native discard modal contains keyboard focus",
  );
  await discard()
    .getByRole("button", { name: "Ở lại chỉnh sửa", exact: true })
    .click();
  check(
    (await page
      .getByRole("dialog", { name: "Tạo lớp học", exact: true })
      .getByRole("textbox", { name: "Tên lớp", exact: true })
      .inputValue()) === "BẢN NHÁP · Giữ lại",
    "Keeping a draft preserves the controlled form value",
  );
  await page.keyboard.press("Escape");
  await discard().waitFor();
  await page.keyboard.press("Escape");
  check(
    (await discard().count()) === 0 &&
      (await page
        .getByRole("dialog", { name: "Tạo lớp học", exact: true })
        .count()) === 1,
    "Escape cancels the discard decision before closing the editor",
  );
  await page
    .getByRole("dialog", { name: "Tạo lớp học", exact: true })
    .getByRole("button", { name: "Đóng biểu mẫu", exact: true })
    .click();
  await discard()
    .getByRole("button", { name: "Bỏ bản nháp và tiếp tục", exact: true })
    .click();
  check(
    requests.length === initialDraftWrites &&
      (await page.locator("dialog[open]").count()) === 0,
    "Explicit discard closes a draft without pretending it was saved",
  );
  check(
    await page
      .getByRole("button", { name: "Tạo lớp đầu tiên", exact: true })
      .evaluate((el) => document.activeElement === el),
    "Discarding an editor restores focus to its connected trigger",
  );
  await page
    .getByRole("button", { name: "Tạo lớp đầu tiên", exact: true })
    .click();
  check(
    (await dialog()
      .getByRole("textbox", { name: "Tên lớp", exact: true })
      .inputValue()) === "",
    "A discarded class draft does not become a phantom persisted class",
  );
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
    .setInputFiles("work/v7-teaching-ui/authored.txt");
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
    .getByRole("textbox", { name: "Hạn nộp (giờ trên thiết bị)", exact: true })
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
  await discard()
    .getByRole("button", { name: "Ở lại chỉnh sửa", exact: true })
    .click();
  check(
    (await page.locator("[data-teaching-ai-result]").count()) === 1,
    "Keeping an unsaved AI draft preserves its generated result",
  );
  await page
    .getByRole("button", { name: "Bắt đầu lượt tạo mới", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Giữ bản nháp đang làm?", exact: true })
    .getByRole("button", { name: "Bỏ bản nháp và tiếp tục", exact: true })
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
  async function confirmAction(trigger, title, label, action) {
    const before = requests.filter((r) => r.action === action).length;
    await trigger();
    const modal = page.getByRole("dialog", { name: title, exact: true });
    await modal.waitFor();
    check(
      requests.filter((r) => r.action === action).length === before,
      action + " is not sent before an explicit confirmation",
    );
    await modal
      .getByRole("button", { name: "Giữ nguyên", exact: true })
      .click();
    check(
      requests.filter((r) => r.action === action).length === before,
      action + " cancel keeps current access/data",
    );
    await trigger();
    await page
      .getByRole("dialog", { name: title, exact: true })
      .getByRole("button", { name: label, exact: true })
      .click();
    await page
      .getByRole("dialog", { name: title, exact: true })
      .waitFor({ state: "hidden" });
    check(
      requests.filter((r) => r.action === action).length === before + 1,
      action + " sends one existing idempotent mutation after confirmation",
    );
  }
  const teacherTabs = page.getByRole("tablist", {
    name: "Quản lý lớp",
    exact: true,
  });
  await teacherTabs.getByRole("tab", { name: "Học sinh", exact: true }).focus();
  await page.keyboard.press("End");
  check(
    (await teacherTabs
      .getByRole("tab", { name: "Mã tham gia", exact: true })
      .getAttribute("aria-selected")) === "true" &&
      (await teacherTabs.locator('[tabindex="0"]').count()) === 1,
    "Class tabs support End with one roving tab stop",
  );
  check(
    await page
      .getByRole("tabpanel")
      .evaluate(
        (el) =>
          document
            .getElementById(el.getAttribute("aria-labelledby"))
            ?.getAttribute("aria-controls") === el.id,
      ),
    "Class tab and current panel are bidirectionally linked",
  );
  await confirmAction(
    () => page.getByRole("button", { name: "Thu hồi", exact: true }).click(),
    "Thu hồi mã tham gia?",
    "Xác nhận thu hồi mã",
    "invite.revoke",
  );
  await page.keyboard.press("Home");
  await teacherTabs.getByRole("tab", { name: "Học sinh", exact: true }).click();
  await confirmAction(
    () =>
      page.getByRole("button", { name: "Ngừng tham gia", exact: true }).click(),
    "Ngừng quyền tham gia lớp?",
    "Xác nhận ngừng tham gia",
    "enrollment.remove",
  );
  await confirmAction(
    () =>
      page
        .getByRole("button", { name: "Khôi phục tham gia", exact: true })
        .click(),
    "Khôi phục quyền tham gia lớp?",
    "Xác nhận khôi phục",
    "enrollment.restore",
  );
  await teacherTabs
    .getByRole("tab", { name: "Nhóm học tập", exact: true })
    .click();
  await confirmAction(
    () => page.getByRole("button", { name: "Xóa nhóm", exact: true }).click(),
    "Xóa nhóm học tập?",
    "Xác nhận xóa nhóm",
    "group.delete",
  );
  await teacherTabs
    .getByRole("tab", { name: "Đồng giảng dạy", exact: true })
    .click();
  await confirmAction(
    () =>
      page
        .getByRole("button", { name: "Gỡ phân công", exact: true })
        .last()
        .click(),
    "Gỡ phân công giảng dạy?",
    "Xác nhận gỡ phân công",
    "teacher.remove",
  );
  await nav("Cài đặt");
  const preferenceWrites = requests.filter(
    (r) => r.action === "preferences.update",
  ).length;
  await page
    .getByRole("textbox", { name: /^Tên hiển thị trong không gian/ })
    .fill("BẢN NHÁP · Chưa lưu");
  check(
    await page.evaluate(() => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return (
        e.defaultPrevented &&
        !Object.values(localStorage).some((v) =>
          v.includes("BẢN NHÁP · Chưa lưu"),
        )
      );
    }),
    "Unsaved settings register a native page-leave warning without storing their text",
  );
  await page.locator('.tw-sidebar-bottom a[href="/"]').click();
  await discard().waitFor();
  check(
    page.url().includes("__v7-teaching-ui"),
    "A route link is held before navigation when settings are unsaved",
  );
  await discard()
    .getByRole("button", { name: "Ở lại chỉnh sửa", exact: true })
    .click();
  await nav("Thư viện giảng dạy", false);
  await discard()
    .getByRole("button", { name: "Ở lại chỉnh sửa", exact: true })
    .click();
  check(
    (await page
      .getByRole("textbox", { name: /^Tên hiển thị trong không gian/ })
      .inputValue()) === "BẢN NHÁP · Chưa lưu" &&
      requests.filter((r) => r.action === "preferences.update").length ===
        preferenceWrites,
    "Canceling module navigation preserves a settings draft and sends no save",
  );
  await nav("Thư viện giảng dạy");
  await nav("Cài đặt");
  check(
    (await page
      .getByRole("textbox", { name: /^Tên hiển thị trong không gian/ })
      .inputValue()) === "KIỂM THỬ · Cô An",
    "Confirmed module discard restores only the last saved settings",
  );
  await confirmAction(
    () =>
      page
        .getByRole("combobox", {
          name: "Vai trò của KIỂM THỬ ĐỒNG GIẢNG",
          exact: true,
        })
        .selectOption("SCHOOL_ADMIN"),
    "Thay đổi vai trò thành viên?",
    "Xác nhận đổi vai trò",
    "member.role",
  );
  const beforeMemberRemoval = requests.filter(
    (r) => r.action === "member.remove",
  ).length;
  await page
    .getByRole("button", { name: "Gỡ khỏi tổ chức", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Gỡ thành viên khỏi tổ chức", exact: true })
    .waitFor();
  check(
    requests.filter((r) => r.action === "member.remove").length ===
      beforeMemberRemoval,
    "Member removal also waits for its explicit review dialog",
  );
  await page
    .getByRole("dialog", { name: "Gỡ thành viên khỏi tổ chức", exact: true })
    .getByRole("button", { name: "Hủy", exact: true })
    .click();
  await nav("Bảng tin & lịch");
  await page.getByRole("tab", { name: "Thông báo lớp", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  check(
    (await page
      .getByRole("tab", { name: "Lịch & sự kiện", exact: true })
      .getAttribute("aria-selected")) === "true",
    "Communication tabs activate with ArrowRight",
  );
  await confirmAction(
    () =>
      page.getByRole("button", { name: "Xóa lịch hẹn", exact: true }).click(),
    "Xóa lịch hẹn?",
    "Xác nhận xóa lịch",
    "event.delete",
  );
  await nav("Lớp học");
  await page.getByRole("button", { name: "Mở lớp", exact: false }).click();
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
  for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
      `Teacher layout stays within ${width}px`,
    );
    check(
      await page.locator(".tw-primary-nav button").evaluateAll((buttons) =>
        buttons.every((button) => {
          const r = button.getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth + 1 && r.height >= 44;
        }),
      ),
      `Primary teacher controls remain visible and touchable at ${width}px`,
    );
    check(
      await page.locator(".tw-main > .tw-topbar").evaluate((el) =>
        [...el.querySelectorAll("button,select")].every((control) => {
          const r = control.getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth + 1;
        }),
      ),
      `Teacher workspace selector and refresh stay on screen at ${width}px`,
    );
  }
  for (const label of [
    "Tổng quan",
    "Lớp học",
    "Studio bài giảng",
    "Bài tập",
    "Ngân hàng câu hỏi",
    "Chấm & nhận xét",
    "Tiến bộ học tập",
    "Thư viện giảng dạy",
    "Bảng tin & lịch",
    "Trợ lý giảng dạy",
    "Báo cáo",
    "Cài đặt",
  ]) {
    await nav(label);
    check(
      (await page
        .locator('.tw-sidebar nav [aria-current="page"]')
        .getAttribute("aria-label")) === label,
      `Existing destination reachable: ${label}`,
    );
  }
  await nav("Tổng quan");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/v7/qa-teaching-desktop.png",
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
    path: "docs/v7/qa-teaching-tablet.png",
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
    path: "docs/v7/qa-teaching-mobile.png",
    fullPage: true,
  });
  await page.evaluate(() => window.__mountTeaching("student"));
  await page.getByRole("tab", { name: "Kết quả", exact: true }).click();
  await page.getByRole("tab", { name: "Kết quả", exact: true }).focus();
  await page.keyboard.press("Home");
  check(
    (await page
      .getByRole("tab", { name: "Bài tập", exact: true })
      .getAttribute("aria-selected")) === "true",
    "Classroom tabs support Home keyboard activation",
  );
  await page.keyboard.press("End");
  check(
    (await page
      .getByRole("tab", { name: "Kết quả", exact: true })
      .getAttribute("aria-selected")) === "true" &&
      (await page
        .getByRole("tablist", { name: "Nội dung lớp học", exact: true })
        .locator('[tabindex="0"]')
        .count()) === 1,
    "Classroom tabs support End with one focusable active tab",
  );
  check(
    (await page.locator("[data-student-classroom]").textContent()).includes(
      "1 / 1 điểm",
    ),
    "Student sees the score only after the separate publication action",
  );
  await page.screenshot({
    path: "docs/v7/qa-classroom-mobile.png",
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
  const writesBeforeReload = requests.length,
    readStart = reads.length;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.locator(".tw-stat").first().waitFor();
  check(
    reads
      .slice(readStart)
      .some((r) => r.key === "qa-teaching-a" && r.orgId === null) &&
      reads
        .slice(readStart)
        .some((r) => r.key === "qa-teaching-a" && r.orgId === "qa-org"),
    "Reload resolves the membership-only directory with an explicit authorized organization GET",
  );
  check(
    (await page
      .getByRole("combobox", { name: "Không gian giảng dạy", exact: true })
      .inputValue()) === "qa-org" &&
      (await page.locator(".tw-stat").first().textContent()).includes("1") &&
      (await page.locator(".tw-identity").textContent()).includes(
        "Quản trị không gian",
      ) &&
      (await page
        .getByRole("button", { name: "Tạo không gian giảng dạy", exact: false })
        .count()) === 0,
    "Existing single organization reloads real class counts and admin role instead of misleading empty onboarding",
  );
  await nav("Lớp học");
  check(
    (await page.locator("[data-teaching-classes]").textContent()).includes(
      "KIỂM THỬ · Lớp 9",
    ) && requests.length === writesBeforeReload,
    "Reload restores an existing class without creating any duplicate organization or mutation",
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
      "docs/v7/qa-teaching-desktop.png",
      "docs/v7/qa-teaching-tablet.png",
      "docs/v7/qa-teaching-mobile.png",
      "docs/v7/qa-classroom-mobile.png",
    ],
    scope:
      "Actual components and browser storage/DOM with synthetic HTTP; real backend/compiled tests are separate evidence",
  };
};
