// Authored content and intercepted HTTP only. Actual teacher/classroom components.
async (page) => {
  const cases = [],
    errors = [],
    external = [],
    mutations = [],
    screenshots = [];
  const folder = "docs/next/reports/teaching-files-browser/";
  const check = (ok, name) => {
    if (!ok) throw Error(name);
    cases.push(name);
  };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const stamp = "2026-10-17T08:00:00.000Z";
  const body =
    "## Kiểm tra căn bậc hai\n\nVới $x \\ge 0$, ta có **công thức**:\n\n$$\\sqrt{x^2}=|x|$$\n\n| Biểu thức | Kết quả |\n| --- | --- |\n| $\\sqrt{9}$ | $3$ |\n\n- Giữ tiếng Việt: điều kiện xác định.\n- Đối chiếu nguồn.\n\n```js\nconst price = '$5'; // $x$ là mã nguồn\n```\n\n<img src=x onerror=alert(1)>";
  const reference = {
    materialId: "m",
    quote: "Với $x \\ge 0$, ta có $\\sqrt{x^2}=x$.",
    paragraph: 2,
    page: 3,
    materialRevision: 4,
  };
  const lesson = {
    id: "l",
    orgId: "o",
    classId: "c",
    title: "KIỂM THỬ · Căn $\\sqrt{9}=3$",
    topic: "Căn bậc hai",
    grade: "9",
    objectives: ["Hiểu điều kiện $x \\ge 0$."],
    sections: [{ title: "Phần $\\sqrt{x}$", body, references: [reference] }],
    sourceIds: ["m"],
    status: "draft",
    revision: 1,
    createdBy: "qa-teacher-a",
    createdAt: stamp,
    updatedAt: stamp,
  };
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
    organizations: [
      { id: "o", name: "KIỂM THỬ · Render", role: "ORGANIZATION_ADMIN" },
    ],
    organization: { id: "o", name: "KIỂM THỬ · Render" },
    role: "ORGANIZATION_ADMIN",
    permissions: { manageOrg: true, teach: true, learn: false },
    classes: [
      {
        id: "c",
        orgId: "o",
        name: "KIỂM THỬ · Lớp 9",
        subject: "Toán",
        grade: "9",
        teacherIds: ["qa-teacher-a"],
        studentCount: 1,
        archived: false,
        revision: 1,
      },
    ],
    members: [],
    enrollments: [
      {
        classId: "c",
        userId: "qa-student",
        name: "KIỂM THỬ · Học sinh",
        active: true,
        revision: 1,
      },
    ],
    groups: [],
    invites: [],
    materials: [
      {
        id: "m",
        orgId: "o",
        classId: "c",
        title: "Nguồn $\\sqrt{x}$",
        content: body,
        kind: "text",
        status: "published",
        revision: 4,
        createdBy: "qa-teacher-a",
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    lessons: [lesson],
    questions: [],
    assignments: [
      {
        id: "a",
        orgId: "o",
        classId: "c",
        title: "Bài $x^2=9$",
        instructions: "## Hướng dẫn\n\nTìm $x$ với $x^2=9$.\n\n$$x=\\pm 3$$",
        target: { kind: "class", ids: [] },
        questionIds: [],
        questions: [],
        status: "issued",
        maxPoints: 1,
        dueAt: "2099-01-01T00:00:00.000Z",
        revision: 1,
        createdAt: stamp,
        createdBy: "qa-teacher-a",
        availability: "available",
        canSubmit: true,
      },
    ],
    submissions: [
      {
        id: "s",
        assignmentId: "a",
        classId: "c",
        orgId: "o",
        studentId: "qa-student",
        studentName: "KIỂM THỬ · Học sinh",
        answers: [],
        status: "published",
        revision: 1,
        score: 1,
        feedback: "Đúng: $x=\\pm3$.",
        grades: [],
        submittedAt: stamp,
        publishedAt: stamp,
      },
    ],
    announcements: [
      {
        id: "n",
        classId: "c",
        orgId: "o",
        title: "Ôn $\\sqrt{x}$",
        body: "**Nhắc lớp**: ôn $\\sqrt{9}=3$.",
        status: "published",
        revision: 1,
        createdAt: stamp,
      },
    ],
    events: [],
    settings: {
      name: "KIỂM THỬ · Render",
      timezone: "Asia/Ho_Chi_Minh",
      allowLateSubmissions: false,
      revision: 1,
    },
    preferences: null,
    analytics: [],
    dashboard: {
      classes: 1,
      students: 1,
      materials: 1,
      lessons: 1,
      questions: 0,
      assignments: 1,
      awaitingGrading: 0,
      dueSoon: 0,
      publishedAssessments: 1,
      averagePercent: 100,
    },
  };
  state.files = [];
  state.submissions = [];
  state.announcements = [];
  state.materials[0].url =
    "https://docs.google.com/presentation/d/SYNTHETIC/view";
  state.assignments[0].questions = [
    {
      id: "q",
      kind: "mcq",
      prompt: "Giải 2x+3=7",
      choices: ["2", "3", "4", "5"],
      maxPoints: 1,
      revision: 1,
      topic: "Phương trình",
      difficulty: "basic",
    },
  ];
  const uploads = [],
    downloads = [];
  let release = null,
    hold = false,
    loseNext = false;
  const snapshot = (key) => {
    const s = clone(state);
    s.actor.accountKey = key;
    if (key === "qa-teaching-student") {
      s.actor.userId = "qa-student";
      s.actor.approvedTeacher = false;
      s.role = "STUDENT";
      s.permissions = { manageOrg: false, teach: false, learn: true };
      s.files = s.files.filter(
        (f) =>
          f.purpose !== "teacher-only" &&
          (f.targetKind !== "submission" || f.uploaderId === "qa-student"),
      );
      s.lessons = s.lessons.filter((l) => l.status === "published");
    }
    if (key === "qa-teaching-b") {
      s.actor.userId = "qa-teacher-b";
      s.actor.name = "KIỂM THỬ TÀI KHOẢN B";
      s.files = [];
    }
    return s;
  };
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/*", (r) => {
    const url = r.request().url();
    if (!url.startsWith("http://localhost:3000/")) {
      external.push(url);
      return r.abort();
    }
    return r.fulfill({ status: 409, json: { error: "SYNTHETIC_ONLY" } });
  });
  for (const [url, file, type] of [
    ["**/__v11-teaching-files-ui", "fixture.html", "text/html"],
    ["**/__v7-teaching-ui.js", "fixture.js", "text/javascript"],
    ["**/__v7-teaching-ui.css", "fixture.css", "text/css"],
  ])
    await page.route(url, (r) =>
      r.fulfill({
        path: "work/v11-teaching-files-ui/" + file,
        contentType: type,
      }),
    );
  await page.route("**/brand/lumio-logo.png", (r) =>
    r.fulfill({
      path: "public/brand/lumio-logo.png",
      contentType: "image/png",
    }),
  );
  await page.route("**/fonts/KaTeX*", (r) => {
    const m = /(KaTeX_[A-Za-z0-9-]+\.(?:woff2?|ttf))$/.exec(r.request().url());
    return m
      ? r.fulfill({
          path: "node_modules/katex/dist/fonts/" + m[1],
          contentType: "font/woff2",
        })
      : r.abort();
  });
  await page.route("**/api/teaching**", async (r) => {
    const request = r.request(),
      key = request.headers()["x-lumio-account"],
      url = request.url();
    if (url.includes("/api/teaching/files")) {
      if (request.method() === "POST") {
        const p = request.postDataJSON();
        if (p.target.kind === "submission" && p.visibility !== undefined)
          return r.fulfill({
            status: 403,
            json: { error: "TEACHING_FILE_FORBIDDEN" },
          });
        uploads.push({ key, ...p });
        let f = state.files.find((x) => x.requestId === p.requestId);
        if (!f) {
          f = {
            id: "file-" + (state.files.length + 1),
            requestId: p.requestId,
            name: p.filename.normalize("NFC").trim(),
            mime: "text/markdown",
            bytes:
              Math.floor((p.dataBase64.length * 3) / 4) -
              (p.dataBase64.endsWith("==")
                ? 2
                : p.dataBase64.endsWith("=")
                  ? 1
                  : 0),
            sha256: "a".repeat(64),
            createdAt: stamp,
            orgId: p.orgId,
            classId: "c",
            uploaderId:
              key === "qa-teaching-student" ? "qa-student" : "qa-teacher-a",
            targetKind: p.target.kind,
            targetId: p.target.id,
            purpose:
              p.target.kind === "submission" ? "submission" : p.visibility,
            status: p.target.kind === "submission" ? "pending" : "attached",
            testBytes: p.dataBase64,
          };
          state.files.push(f);
          if (p.target.kind === "lesson") {
            state.lessons.find((l) => l.id === p.target.id).revision++;
          }
        }
        if (hold) await new Promise((resolve) => (release = resolve));
        if (loseNext) {
          loseNext = false;
          try {
            await r.fulfill({
              status: 503,
              json: { error: "DATABASE_WRITE_OUTCOME_UNKNOWN" },
            });
          } catch {}
          return;
        }
        try {
          await r.fulfill({
            json: { file: f, targetRevision: state.lessons[0].revision },
          });
        } catch {}
        return;
      }
      const id = url.split("/").at(-1),
        f = state.files.find((x) => x.id === id);
      if (request.method() === "DELETE") {
        state.files = state.files.filter((x) => x.id !== id);
        return r.fulfill({ json: { deleted: true } });
      }
      downloads.push({ id, key });
      return r.fulfill({
        body:
          f.name === "student-answer.md"
            ? "Synthetic student answer bytes"
            : "Synthetic reference bytes",
        contentType: f.mime,
        headers: {
          "Content-Disposition": "attachment; filename=synthetic.md",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (request.method() === "GET") return r.fulfill({ json: snapshot(key) });
    const command = request.postDataJSON();
    mutations.push(command);
    if (command.action !== "submission.submit")
      return r.fulfill({
        status: 409,
        json: { error: "SYNTHETIC_UNEXPECTED_MUTATION" },
      });
    const id = "submission-1";
    for (const fileId of command.attachmentIds || []) {
      const f = state.files.find((x) => x.id === fileId);
      f.status = "attached";
      f.submissionId = id;
      f.submissionRevision = 1;
    }
    state.submissions.push({
      id,
      assignmentId: "a",
      classId: "c",
      orgId: "o",
      studentId: "qa-student",
      studentName: "KIỂM THỬ HỌC SINH",
      answers: command.answers,
      status: "submitted",
      revision: 1,
      submittedAt: stamp,
    });
    return r.fulfill({
      json: { state: snapshot(key), result: { id }, replayed: false },
    });
  });
  const nav = async (name) => {
      const target = page
        .locator(".tw-sidebar nav")
        .getByRole("button", { name, exact: true });
      if (!(await target.isVisible()))
        await page.locator(".tw-more-nav > summary").click();
      await target.click();
    },
    dialog = () => page.locator("dialog.tw-dialog[open]");
  const select = async (box, name, text) =>
    box.locator('input[type="file"]').evaluate(
      (el, v) => {
        const data = new DataTransfer();
        data.items.add(new File([v.text], v.name, { type: "text/markdown" }));
        el.files = data.files;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { name, text },
    );
  try {
    await page.goto("http://localhost:3000/__v11-teaching-files-ui");
    await page.locator(".tw-stat").first().waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await nav("Thư viện giảng dạy");
    check(
      (await page
        .locator('[data-teaching-resource="google-slides"]')
        .count()) === 1,
      "Teacher library exposes the actual source link as a reference, not a slide editing claim",
    );
    await nav("Studio bài giảng");
    let box = page.locator("[data-file-attachments]").first();
    await box.waitFor();
    await select(box, "teacher-reference.md", "Synthetic reference bytes");
    check(
      uploads.length === 0 &&
        (await box.innerText()).includes("chưa xác nhận lưu"),
      "Selecting a file does not claim an upload or send bytes",
    );
    hold = true;
    await box
      .getByRole("button", { name: "Tải tệp lên máy chủ", exact: true })
      .click();
    await box.getByRole("progressbar").waitFor();
    check(
      (await box.getByRole("progressbar").getAttribute("value")) === null,
      "Actual pending request exposes indeterminate progress without fake percentages",
    );
    check(
      !(await box.innerText()).includes("Máy chủ đã lưu tệp đính kèm."),
      "Upload is not marked saved before metadata acknowledgment",
    );
    hold = false;
    release();
    await box
      .getByRole("button", { name: "Tải teacher-reference.md", exact: true })
      .waitFor();
    check(
      state.files[0].targetKind === "lesson" &&
        state.files[0].purpose === "reference",
      "Teacher reference bytes target the saved lesson and chosen sharing purpose",
    );
    await page.screenshot({ path: folder + "teacher-upload-desktop.png" });
    await page.evaluate(() => window.__mountTeaching("student"));
    await page.getByRole("button", { name: "Mở bài tập", exact: true }).click();
    let modal = dialog();
    await modal.waitFor();
    box = modal
      .locator("[data-file-attachments]")
      .filter({ has: page.locator('input[type="file"]') });
    await modal.getByRole("checkbox").last().check();
    await select(box, "student-answer.md", "Synthetic student answer bytes");
    check(
      await modal
        .getByRole("button", { name: "Nộp bài cho giáo viên", exact: false })
        .isDisabled(),
      "Selected but unacknowledged bytes cannot be silently omitted from final submission",
    );
    loseNext = true;
    await box
      .getByRole("button", { name: "Tải tệp lên máy chủ", exact: true })
      .click();
    await box.getByRole("alert").waitFor();
    check(
      state.submissions.length === 0 && !mutations.length,
      "An unavailable file acknowledgment cannot silently submit the assignment",
    );
    const before = uploads.at(-1);
    await box
      .getByRole("button", { name: "Thử tải lại cùng tệp", exact: true })
      .click();
    await box
      .getByRole("status")
      .filter({ hasText: "Bài làm CHƯA được nộp" })
      .waitFor();
    check(
      uploads.at(-1).requestId === before.requestId &&
        uploads.at(-1).dataBase64 === before.dataBase64,
      "Actual UI retry reuses the exact selected bytes and idempotency UUID",
    );
    check(
      state.files.filter((x) => x.purpose === "submission").length === 1 &&
        state.submissions.length === 0,
      "Retry acknowledges one pending file, not a duplicate or a submitted assignment",
    );
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({ path: folder + "student-pending-phone.png" });
    await modal.getByRole("button", { name: "Để sau", exact: true }).click();
    await page
      .getByRole("button", { name: "Bỏ bản nháp và tiếp tục", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Mở bài tập", exact: true })
      .waitFor();
    await page.reload();
    await page.locator(".tw-stat").first().waitFor();
    await page.evaluate(() => window.__mountTeaching("student"));
    await page.getByRole("button", { name: "Mở bài tập", exact: true }).click();
    modal = dialog();
    box = modal
      .locator("[data-file-attachments]")
      .filter({ has: page.locator('input[type="file"]') });
    check(
      (await box.innerText()).includes("student-answer.md") &&
        (await box.innerText()).includes("Đã lưu, chờ nộp cùng bài"),
      "Pending server metadata survives workspace reload and is still distinguished from submission",
    );
    await modal.getByRole("radio").first().check();
    await modal.getByRole("checkbox").last().check();
    await modal
      .getByRole("button", { name: "Nộp bài cho giáo viên", exact: false })
      .click();
    await page
      .getByRole("button", {
        name: "Chờ kết quả giáo viên công bố",
        exact: false,
      })
      .waitFor();
    const pending = state.files.find((x) => x.name === "student-answer.md");
    check(
      mutations.length === 1 &&
        mutations[0].attachmentIds.length === 1 &&
        mutations[0].attachmentIds[0] === pending.id &&
        pending.status === "attached",
      "Only the explicit final submit sends acknowledged IDs and binds them to the submission snapshot",
    );
    await page.evaluate(() => window.__mountTeaching("teacher"));
    await page.locator(".tw-stat").first().waitFor();
    await nav("Chấm & nhận xét");
    await page
      .getByRole("button", { name: "Chấm & nhận xét", exact: true })
      .last()
      .click();
    modal = dialog();
    await modal
      .getByRole("button", { name: "Tải student-answer.md", exact: true })
      .click();
    await modal
      .getByRole("status")
      .filter({ hasText: "Đã nhận tệp từ máy chủ" })
      .waitFor();
    check(
      downloads.at(-1).key === "qa-teaching-a" &&
        downloads.at(-1).id === pending.id,
      "Teacher grading inbox downloads the exact submitted file with the current account header",
    );
    check(
      (await modal.locator("[data-file-attachments]").innerText()).includes(
        "Bản nộp 1",
      ),
      "Grader attachment list identifies the immutable submitted file revision",
    );
    await page.screenshot({ path: folder + "teacher-grading-phone.png" });
    await modal
      .getByRole("button", { name: "Đóng biểu mẫu", exact: true })
      .click();
    await nav("Studio bài giảng");
    box = page.locator("[data-file-attachments]").first();
    await select(box, "OLD-ACCOUNT-RECEIPT.md", "Held synthetic account bytes");
    hold = true;
    await box
      .getByRole("button", { name: "Tải tệp lên máy chủ", exact: true })
      .click();
    await box.getByRole("progressbar").waitFor();
    await page.evaluate(() => window.__mountTeaching("teacher", "b"));
    await page.locator(".tw-stat").first().waitFor();
    hold = false;
    release();
    await nav("Studio bài giảng");
    check(
      !(await page.locator(".tw-content").innerText()).includes(
        "OLD-ACCOUNT-RECEIPT.md",
      ),
      "Late upload acknowledgment after account switch cannot appear in the new account workspace",
    );
    check(
      errors.length === 0 && external.length === 0,
      "No runtime errors or external provider traffic",
    );
    return JSON.stringify({
      status: "PASS",
      checks: cases.length,
      cases,
      errors,
      external,
      uploads: uploads.length,
      explicitSubmissionCommands: mutations.length,
      scope:
        "Actual teacher/student UI, file-selection/retry/loading/account switches and intercepted HTTP receipts; backend authorization, real database durability and provider playback verified separately",
    });
  } catch (e) {
    await page.screenshot({
      path: "work/v11-teaching-files-ui/harness-debug.png",
      fullPage: true,
    });
    return JSON.stringify({
      status: "FAIL",
      checks: cases.length,
      cases,
      error: e.message,
      errors,
      external,
      uploads: uploads.length,
      explicitSubmissionCommands: mutations.length,
    });
  }
};
