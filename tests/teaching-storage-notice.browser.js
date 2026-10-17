async (page) => {
  const cases = [],
    errors = [],
    unexpected = [],
    requests = [];
  const check = (ok, label) => {
    if (!ok) throw Error(label);
    cases.push(label);
  };
  const state = {
    version: 1,
    serverTime: "2026-10-17T10:00:00.000Z",
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
  try {
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) => {
      const request = route.request(),
        path = request
          .url()
          .replace(/^https?:\/\/[^/]+/, "")
          .split("?")[0];
      requests.push({ method: request.method(), path });
      const routes = {
        "/__teacher": ["work/storage-notice-teacher/fixture.html", "text/html"],
        "/__teacher-self-fixture.js": [
          "work/storage-notice-teacher/fixture.js",
          "text/javascript",
        ],
        "/__teacher-self-fixture.css": [
          "work/storage-notice-teacher/fixture.css",
          "text/css",
        ],
        "/__teaching": [
          "work/storage-notice-classroom/fixture.html",
          "text/html",
        ],
        "/__v7-teaching-ui.js": [
          "work/storage-notice-classroom/fixture.js",
          "text/javascript",
        ],
        "/__v7-teaching-ui.css": [
          "work/storage-notice-classroom/fixture.css",
          "text/css",
        ],
      };
      if (routes[path])
        return route.fulfill({
          path: routes[path][0],
          contentType: routes[path][1],
        });
      if (path === "/brand/lumio-logo.png")
        return route.fulfill({
          path: "public/brand/lumio-logo.png",
          contentType: "image/png",
        });
      if (path === "/data/vietnam-locations-v5.2.0.json")
        return route.fulfill({
          path: "public/data/vietnam-locations-v5.2.0.json",
          contentType: "application/json",
        });
      if (path === "/api/teaching" && request.method() === "GET")
        return route.fulfill({ json: state });
      unexpected.push(path);
      return route.fulfill({
        status: 409,
        json: { error: "UNEXPECTED_TEST_REQUEST" },
      });
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("http://storage.fixture/__teacher");
    const footnote = page.locator(".tp-footnote");
    await footnote.waitFor();
    const text = await footnote.innerText();
    check(
      text.includes("cấu hình cơ sở dữ liệu máy chủ") &&
        text.includes("không cam kết lưu trữ lâu dài"),
      "Teacher application discloses conditional database storage without a lifetime guarantee",
    );
    check(
      !/Hồ sơ máy chủ có thể mất khi|đặt lại dữ liệu khi/.test(text),
      "Teacher application does not falsely tie data loss to every restart or deployment",
    );
    check(
      text.includes("Quyền giáo viên không tự cấp quyền quản trị") &&
        (await page
          .getByRole("button", { name: "Đăng nhập với Google", exact: false })
          .count()) === 1,
      "Teacher role boundary and existing guest sign-in remain visible",
    );
    await footnote.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: "docs/next/reports/teaching-storage-notice/teacher-guest-390.png",
    });
    await page.goto("http://storage.fixture/__teaching");
    await page
      .getByRole("button", { name: "Tạo không gian giảng dạy", exact: false })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Tạo không gian giảng dạy",
      exact: true,
    });
    await dialog.waitFor();
    const note = dialog.locator(".tw-note"),
      content = await note.innerText();
    check(
      content.includes("lưu dữ liệu phụ thuộc cấu hình cơ sở dữ liệu") &&
        content.includes("Không cam kết lưu trữ lâu dài"),
      "Create-space review accurately conditions storage on database configuration",
    );
    check(
      !/đặt lại dữ liệu khi|khởi động hoặc triển khai/.test(content),
      "Create-space review no longer claims automatic reset on restart/deploy",
    );
    check(
      (await dialog
        .getByRole("textbox", { name: /^Tên không gian/ })
        .count()) === 1,
      "Existing organization creation field remains available without changing permissions",
    );
    await page.screenshot({
      path: "docs/next/reports/teaching-storage-notice/create-space-390.png",
    });
    check(
      requests.every((row) => row.method === "GET") &&
        unexpected.length === 0 &&
        errors.length === 0,
      "Copy verification performs no organization writes, authentication, provider calls or unexpected requests",
    );
    return {
      status: "PASS",
      passed: cases.length,
      cases,
      errors,
      unexpected,
      requests,
      scope:
        "Actual TeacherPortal/TeacherWorkspace components and CSS with synthetic intercepted read-only HTTP. Storage copy is deliberately neutral for local/remote/unknown configurations; no production persistence or authentication proof.",
    };
  } catch (error) {
    return {
      status: "FAIL",
      passed: cases.length,
      cases,
      error: error.message,
      errors,
      unexpected,
      requests,
    };
  }
};
