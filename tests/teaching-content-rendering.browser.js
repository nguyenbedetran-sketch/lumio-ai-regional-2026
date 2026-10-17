// Authored content and intercepted HTTP only. Actual teacher/classroom components.
async (page) => {
  const cases = [],
    errors = [],
    external = [],
    mutations = [],
    screenshots = [];
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
  const original = JSON.stringify(state.lessons[0]),
    originalBody = body;
  function snapshot(key) {
    const value = clone(state);
    if (key === "qa-teaching-student") {
      value.actor = {
        ...value.actor,
        userId: "qa-student",
        accountKey: key,
        approvedTeacher: false,
        canCreateOrganization: false,
      };
      value.role = "STUDENT";
      value.permissions = { manageOrg: false, teach: false, learn: true };
      value.lessons = value.lessons.filter((l) => l.status === "published");
    }
    return value;
  }
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (
      url.protocol.startsWith("http") &&
      url.origin !== "http://localhost:3000"
    ) {
      external.push(url.origin);
      return route.abort();
    }
    if (url.pathname.startsWith("/api/"))
      return route.fulfill({ status: 409, json: { error: "SYNTHETIC_ONLY" } });
    return route.continue();
  });
  for (const [url, file, type] of [
    ["**/__v7-teaching-ui", "fixture.html", "text/html"],
    ["**/__v7-teaching-ui.js", "fixture.js", "text/javascript"],
    ["**/__v7-teaching-ui.css", "fixture.css", "text/css"],
  ])
    await page.route(url, (route) =>
      route.fulfill({
        path: "work/content-rendering-teacher/" + file,
        contentType: type,
      }),
    );
  await page.route("**/brand/lumio-logo.png", (route) =>
    route.fulfill({
      path: "public/brand/lumio-logo.png",
      contentType: "image/png",
    }),
  );
  await page.route("**/fonts/KaTeX*", (route) => {
    const name = /(KaTeX_[A-Za-z0-9-]+\.(?:woff2?|ttf))$/.exec(
      route.request().url(),
    )?.[1];
    return name
      ? route.fulfill({ path: "node_modules/katex/dist/fonts/" + name })
      : route.abort();
  });
  await page.route("**/api/teaching**", async (route) => {
    const request = route.request(),
      key = request.headers()["x-lumio-account"];
    if (request.method() === "GET")
      return route.fulfill({ json: snapshot(key) });
    const command = request.postDataJSON();
    mutations.push(command);
    if (
      command.id !== "l" ||
      command.expectedRevision !== state.lessons[0].revision
    )
      return route.fulfill({
        status: 409,
        json: { error: "TEACHING_CONFLICT" },
      });
    if (command.action === "lesson.update")
      Object.assign(state.lessons[0], command.draft, {
        status: "draft",
        revision: state.lessons[0].revision + 1,
      });
    else if (
      command.action === "lesson.review" ||
      command.action === "lesson.publish"
    ) {
      state.lessons[0].status = command.action.endsWith("publish")
        ? "published"
        : "reviewed";
      state.lessons[0].revision++;
    } else
      return route.fulfill({
        status: 409,
        json: { error: "SYNTHETIC_UNEXPECTED_MUTATION" },
      });
    return route.fulfill({
      json: { state: snapshot(key), result: {}, replayed: false },
    });
  });
  const nav = async (name) => {
    const target = page
      .locator(".tw-sidebar nav")
      .getByRole("button", { name, exact: true });
    if (!(await target.isVisible()))
      await page.locator(".tw-more-nav > summary").click();
    await target.click();
  };
  const dialog = () => page.getByRole("dialog").last();
  async function contentCheck(locator, label) {
    const value = await locator.evaluate((node) => ({
      math: node.querySelectorAll(".katex").length,
      tables: node.querySelectorAll("table").length,
      headings: node.querySelectorAll(".lm-rich-heading").length,
      code: node.querySelector("pre code")?.textContent,
      unsafe: !!node.querySelector("img,script,iframe"),
      raw: node.textContent.includes("<img src=x onerror=alert(1)>"),
    }));
    check(
      value.math >= 4 &&
        value.tables === 1 &&
        value.headings === 1 &&
        value.code?.includes("'$5'") &&
        !value.unsafe &&
        value.raw,
      label + ": " + JSON.stringify(value),
    );
  }
  await page.goto("http://localhost:3000/__v7-teaching-ui");
  await page.locator(".tw-stat").first().waitFor();
  await nav("Studio bài giảng");
  await page
    .getByRole("button", { name: "Mở & chỉnh sửa", exact: false })
    .click();
  const editor = dialog();
  await editor.locator("[data-lesson-editor-preview] > summary").click();
  await contentCheck(
    editor.locator("[data-lesson-content]"),
    "Editor preview typesets actual source math, Markdown heading/table/code and escaped HTML",
  );
  check(
    JSON.stringify(state.lessons[0]) === original && mutations.length === 0,
    "Opening preview neither saves nor rewrites content/citation metadata",
  );
  for (const theme of ["light", "dark"])
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.dataset.motion = "off";
      }, theme);
      const geometry = await editor.evaluate((el) => ({
        right: el.getBoundingClientRect().right,
        left: el.getBoundingClientRect().left,
        width: innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        clipped: (() => {
          const preview = el.querySelector("[data-lesson-editor-preview]"),
            bounds = preview.getBoundingClientRect();
          return [
            ...preview.querySelectorAll(
              ".lm-math--display,.lm-rich-table-scroll,pre",
            ),
          ].some((node) => {
            const box = node.getBoundingClientRect();
            return box.left < bounds.left - 1 || box.right > bounds.right + 1;
          });
        })(),
        formula: [...el.querySelectorAll("[data-math-rendered]")]
          .filter((n) => n.getBoundingClientRect().height > 0)
          .every((n) => getComputedStyle(n).fontSize !== "0px"),
      }));
      check(
        geometry.left >= 0 &&
          geometry.right <= width + 1 &&
          geometry.pageWidth <= width + 2 &&
          geometry.formula &&
          !geometry.clipped,
        `Teacher preview ${theme} at ${width}px fits viewport and renders visible formulas`,
      );
      await editor
        .locator("[data-lesson-editor-preview]")
        .scrollIntoViewIfNeeded();
      const file = `docs/next/reports/content-rendering/teacher-preview-${theme}-${width}.png`;
      await page.screenshot({ path: file, fullPage: true });
      screenshots.push(file);
    }
  await page.setViewportSize({ width: 1440, height: 950 });
  const next = originalBody.replace(
    "Kiểm tra căn bậc hai",
    "Bản sửa đang nhập",
  );
  await editor
    .getByRole("textbox", { name: "Nội dung phần", exact: true })
    .fill(next);
  check(
    (await editor
      .locator("[data-lesson-editor-preview] .lm-rich-heading")
      .textContent()) === "Bản sửa đang nhập" && mutations.length === 0,
    "Live preview reflects unsaved editor changes without automatic publication",
  );
  await editor
    .getByRole("button", { name: "Lưu bản nháp", exact: true })
    .click();
  await editor.waitFor({ state: "hidden" });
  check(
    state.lessons[0].sections[0].body === next &&
      JSON.stringify(state.lessons[0].sections[0].references[0]) ===
        JSON.stringify(reference),
    "Save preserves exact authored LaTeX/Markdown and unchanged reference fields",
  );
  await page.reload();
  await page.locator(".tw-stat").first().waitFor();
  await nav("Studio bài giảng");
  await page.getByRole("button", { name: "Đã xem lại", exact: true }).click();
  await contentCheck(
    dialog().locator("[data-lesson-content]"),
    "Saved reload uses the same typeset presentation before review",
  );
  check(
    mutations.length === 1 && state.lessons[0].status === "draft",
    "Review button first opens preview without a review mutation",
  );
  await dialog().getByRole("button", { name: "Quay lại", exact: true }).click();
  check(
    mutations.length === 1,
    "Canceling review preview preserves draft state",
  );
  await page.getByRole("button", { name: "Đã xem lại", exact: true }).click();
  await dialog()
    .getByRole("button", { name: "Xác nhận đã xem bản trình bày", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "Chia sẻ cho lớp", exact: true })
    .click();
  check(
    state.lessons[0].status === "reviewed" && mutations.length === 2,
    "Publish action is also held for a current-revision formatted preview",
  );
  await dialog()
    .getByRole("button", { name: "Xác nhận chia sẻ cho lớp", exact: true })
    .click();
  await dialog().waitFor({ state: "hidden" });
  check(
    state.lessons[0].status === "published" && mutations.length === 3,
    "Explicit confirmation sends one existing revision-bound publication command",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Markdown (mã nguồn)", exact: true })
    .click();
  const file = await download;
  await file.saveAs("work/content-rendering-teacher/export.md");
  check(
    file.suggestedFilename().endsWith(".md"),
    "Lesson export is clearly labeled source Markdown and downloads .md",
  );
  await nav("Thư viện giảng dạy");
  await page.getByText("Xem nội dung đã xử lý", { exact: true }).click();
  await contentCheck(
    page.locator(".tw-content article details"),
    "Teacher material preview renders full source without truncating a formula",
  );
  check(
    await page
      .getByRole("button", { name: "TXT (văn bản nguồn)", exact: true })
      .isVisible(),
    "Raw material download explicitly identifies source TXT",
  );
  await nav("Bài tập");
  check(
    (await page.locator(".tw-content article .katex").count()) >= 3,
    "Assignment title and block instructions use shared math renderer",
  );
  await nav("Bảng tin & lịch");
  check(
    (await page.locator(".tw-content article .katex").count()) >= 2,
    "Class announcement title/body render educational notation",
  );
  await nav("Báo cáo");
  await page.emulateMedia({ media: "print" });
  const printed = await page.locator(".tw-table").evaluate((el) => ({
    math: !!el.querySelector(".katex"),
    text: getComputedStyle(el).color,
    bg: getComputedStyle(document.querySelector(".tw-shell")).backgroundColor,
  }));
  check(
    printed.math && printed.bg === "rgb(255, 255, 255)",
    "Existing report print preserves typeset assignment title on a white page",
  );
  await page.pdf({
    path: "docs/next/reports/content-rendering/teacher-report-print.pdf",
    format: "A4",
    printBackground: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.__mountTeaching("student"));
  await page.getByRole("tab", { name: "Bài giảng", exact: true }).click();
  await contentCheck(
    page.locator("[data-lesson-content]"),
    "Published classroom lesson reuses identical lesson presentation including objectives",
  );
  for (const theme of ["light", "dark"]) {
    await page.setViewportSize({ width: 390, height: 950 });
    await page.evaluate(
      (theme) => (document.documentElement.dataset.theme = theme),
      theme,
    );
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
      `Published classroom ${theme} fits a 390px phone`,
    );
    const file = `docs/next/reports/content-rendering/classroom-${theme}-390.png`;
    await page.screenshot({ path: file, fullPage: true });
    screenshots.push(file);
  }
  await page.locator("[data-lesson-content] details summary").click();
  check(
    (
      await page.locator("[data-lesson-content] details").textContent()
    ).includes("Đoạn 2 · Trang 3") &&
      state.lessons[0].sections[0].references[0].quote === reference.quote,
    "Published source excerpt retains authored quote, paragraph, page and revision",
  );
  check(
    errors.length === 0 && external.length === 0,
    "No browser exceptions, real provider calls or external evidence requests",
  );
  return {
    status: "PASS",
    passed: cases.length,
    cases,
    screenshots,
    errors,
    externalRequests: external.length,
    mutations: mutations.length,
    expectedExportBody: next,
    scope:
      "Actual React components/CSS/KaTeX with authored fixture HTTP only; synthetic persistence/reload, no real authentication, provider, production database or mathematical correctness claim",
  };
};
