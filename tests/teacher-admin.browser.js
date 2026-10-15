// Actual admin components and CSS; intercepted page and synthetic HTTP only.
async (page) => {
  const passed = [],
    errors = [],
    gets = [],
    writes = [],
    external = [];
  const check = (ok, name) => {
    if (!ok) throw Error(name);
    passed.push(name);
  };
  let applications = [],
    emptyFirst = true,
    failNext = false,
    loseNextAck = false,
    conflictNext = false,
    delayNext = false,
    delayed = null,
    applied = 0,
    actor = null,
    audit = [];
  const receipts = new Map();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (
      /^https?:\/\//.test(url) &&
      !/^http:\/\/(?:localhost|127\.0\.0\.1):3000\//.test(url)
    ) {
      external.push(url);
      return route.abort();
    }
    if (/\/api\//.test(url))
      return route.fulfill({
        status: 409,
        json: { error: "SYNTHETIC_UI_NO_UNEXPECTED_REQUEST" },
      });
    return route.continue();
  });
  await page.route("**/__teacher-admin-fixture", (route) =>
    route.fulfill({
      path: "work/teacher-admin-ui/fixture.html",
      contentType: "text/html",
    }),
  );
  await page.route("**/__teacher-admin-fixture.js", (route) =>
    route.fulfill({
      path: "work/teacher-admin-ui/fixture.js",
      contentType: "text/javascript",
    }),
  );
  await page.route("**/__teacher-admin-fixture.css", (route) =>
    route.fulfill({
      path: "work/teacher-admin-ui/fixture.css",
      contentType: "text/css",
    }),
  );
  await page.route("**/api/admin", (route) =>
    route.fulfill({ json: { ...actor, audit } }),
  );
  await page.route("**/api/admin/teachers**", async (route) => {
    const req = route.request(),
      headers = req.headers();
    if (headers["x-lumio-account"] !== actor.actor.accountKey)
      throw Error("MISSING_CANONICAL_ACCOUNT_BINDING");
    if (req.method() === "GET") {
      const params = await page.evaluate(
        (value) => Object.fromEntries(new URL(value).searchParams),
        req.url(),
      );
      gets.push(params);
      if (failNext) {
        failNext = false;
        return route.fulfill({
          status: 500,
          json: {
            error: "SYNTHETIC_SECRET_DO_NOT_RENDER",
            message: "Unsafe arbitrary backend details",
          },
        });
      }
      if (emptyFirst) {
        emptyFirst = false;
        return route.fulfill({
          json: { items: [], total: 0, offset: 0, limit: 30 },
        });
      }
      const status = params.status || "pending",
        query = (params.q || "").toLocaleLowerCase();
      let items = applications.filter(
        (a) =>
          (status === "all" || a.status === status) &&
          (!query ||
            [
              a.applicantName,
              a.profile.school,
              a.profile.country,
              a.profile.provinceCity,
              a.profile.ward,
              ...a.profile.subjects,
            ]
              .join(" ")
              .toLocaleLowerCase()
              .includes(query)),
      );
      items.sort(
        (a, b) =>
          (params.sort === "newest" ? -1 : 1) *
          (a.submittedAt.localeCompare(b.submittedAt) ||
            a.id.localeCompare(b.id)),
      );
      const offset = Number(params.offset || 0);
      return route.fulfill({
        json: {
          items: items.slice(offset, offset + 30),
          total: items.length,
          offset,
          limit: 30,
        },
      });
    }
    if (req.method() !== "PATCH") throw Error("UNEXPECTED_TEACHER_METHOD");
    const body = req.postDataJSON();
    writes.push(body);
    if (receipts.has(body.requestId))
      return route.fulfill({ json: receipts.get(body.requestId) });
    const a = applications.find((a) => a.id === body.applicationId);
    if (conflictNext) {
      conflictNext = false;
      a.revision++;
      return route.fulfill({
        status: 409,
        json: { error: "TEACHER_CONFLICT" },
      });
    }
    if (a.revision !== body.expectedRevision)
      return route.fulfill({
        status: 409,
        json: { error: "TEACHER_CONFLICT" },
      });
    a.status =
      body.action === "approve"
        ? "approved"
        : body.action === "reject"
          ? "rejected"
          : "revoked";
    a.revision++;
    a.reviewNote = body.note;
    a.reviewedAt = "2026-10-15T12:40:00.000Z";
    const result = {
      application: JSON.parse(JSON.stringify(a)),
      credential: {
        active: a.status === "approved",
        identityVerified: false,
        basis: "manual-review-of-declaration",
        approvedAt: a.status === "approved" ? a.reviewedAt : null,
        revokedAt: a.status === "revoked" ? a.reviewedAt : null,
      },
    };
    receipts.set(body.requestId, result);
    applied++;
    audit.unshift({
      id: "qa-audit-" + applied,
      actorId: actor.actor.id,
      action:
        a.status === "revoked"
          ? "TEACHER_CREDENTIAL_REVOKED"
          : "TEACHER_APPLICATION_" + a.status.toUpperCase(),
      target: a.id,
      result: "success",
      requestId: body.requestId,
      before: { status: "pending" },
      after: { status: a.status },
      createdAt: a.reviewedAt,
    });
    if (loseNextAck) {
      loseNextAck = false;
      return route.abort("failed");
    }
    if (delayNext) {
      delayNext = false;
      return new Promise((resolve) => {
        delayed = async () => {
          try {
            await route.fulfill({ json: result });
          } catch {}
          resolve();
        };
      });
    }
    return route.fulfill({ json: result });
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://localhost:3000/__teacher-admin-fixture");
  actor = await page.evaluate(() => window.__teacherFixture);
  const nameA = "KIỂM THỬ GIÁO VIÊN A",
    nameB = "KIỂM THỬ GIÁO VIÊN B";
  function application(
    index,
    name,
    status = "pending",
    userId = "qa-teacher-" + index,
  ) {
    return {
      id: "qa-application-" + String(index).padStart(3, "0"),
      userId,
      applicantName: name,
      status,
      revision: 1,
      submittedAt: new Date(Date.UTC(2026, 9, 15, 8, index)).toISOString(),
      updatedAt: "2026-10-15T08:00:00.000Z",
      reviewedAt: null,
      reviewNote: null,
      profile: {
        applicantName: name,
        countryCode: "VN",
        country: "Việt Nam",
        provinceCity: index === 1 ? "Đà Nẵng" : "Huế",
        ward: "Phường kiểm thử",
        school:
          index === 1
            ? "Trường KIỂM THỬ A <img src=x onerror=alert(1)>"
            : "Trường KIỂM THỬ " + index,
        teachingLevel: "lower_secondary",
        subjects: ["Toán", "Khoa học tự nhiên"],
        teacherDeclaration: true,
        storageConsent: true,
        workEmail: "synthetic@example.test",
        publicEvidenceUrl: "https://example.test/teacher-evidence",
      },
    };
  }
  applications = [
    application(1, nameA),
    application(2, nameB),
    application(3, "KIỂM THỬ TỰ DUYỆT", "pending", actor.actor.id),
    ...Array.from({ length: 28 }, (_, i) =>
      application(i + 4, "KIỂM THỬ HỒ SƠ " + (i + 4)),
    ),
  ];
  await page
    .getByRole("button", { name: "Xét duyệt giáo viên", exact: true })
    .click();
  const panel = page.locator("[data-teacher-review]");
  await panel.getByText("Không có hồ sơ đang chờ", { exact: true }).waitFor();
  check(
    (await panel.getByRole("row").count()) === 0,
    "Empty real queue shows no seeded teachers or invented counts",
  );
  check(
    (await panel.textContent()).includes(
      "không phải xác minh danh tính độc lập",
    ),
    "Manual declaration review is distinct from identity and school verification",
  );
  await panel
    .getByRole("button", { name: "Làm mới hồ sơ giáo viên", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Trang hồ sơ tiếp", exact: true })
    .waitFor();
  check(
    (await panel.locator("tbody tr").count()) === 30,
    "Queue honors server pagination and displays returned total",
  );
  await panel
    .getByRole("button", { name: "Trang hồ sơ tiếp", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll("[data-teacher-review] tbody tr").length === 1,
  );
  check(
    gets.at(-1).offset === "30",
    "Next-page request uses the server offset rather than filtering one loaded page",
  );
  const search = panel.getByRole("textbox", { name: "Tìm hồ sơ", exact: true });
  async function query(value) {
    await search.fill(value);
    await panel.getByRole("button", { name: "Tìm", exact: true }).click();
    await panel
      .locator(".ad-teacher-empty[role=status]")
      .waitFor({ state: "hidden" });
  }
  await query("Đà Nẵng");
  await panel
    .getByRole("button", { name: "Xem hồ sơ " + nameA, exact: true })
    .waitFor();
  check(
    gets.at(-1).q === "Đà Nẵng" &&
      gets.at(-1).offset === "0" &&
      (await panel.locator("tbody tr").count()) === 1,
    "Location search runs on the server and resets pagination",
  );
  await panel
    .getByRole("combobox", { name: "Thứ tự", exact: true })
    .selectOption("newest");
  await panel
    .getByRole("button", { name: "Xem hồ sơ " + nameA, exact: true })
    .waitFor();
  check(
    gets.at(-1).sort === "newest",
    "Sort selection is included in the server request",
  );
  await panel
    .getByRole("button", { name: "Xem hồ sơ " + nameA, exact: true })
    .click();
  const detail = page.locator("[data-teacher-detail]");
  await detail.waitFor();
  for (const value of [
    "Việt Nam",
    "Đà Nẵng",
    "Phường kiểm thử",
    "Trung học cơ sở",
    "Toán, Khoa học tự nhiên",
  ])
    check(
      (await detail.textContent()).includes(value),
      "Details render declared field: " + value,
    );
  check(
    (await detail.locator("img").count()) === 0 &&
      (await detail.textContent()).includes("<img src=x"),
    "Declared text is escaped rather than rendered as HTML",
  );
  const evidence = detail.getByRole("link", {
    name: "Mở minh chứng",
    exact: false,
  });
  check(
    (await evidence.getAttribute("href")) ===
      "https://example.test/teacher-evidence" &&
      (await evidence.getAttribute("rel")).includes("noreferrer") &&
      external.length === 0,
    "Optional evidence is an explicit safe link and is never auto-fetched",
  );
  applications[0].profile.school = "Trường THCS KIỂM THỬ A";
  await panel.getByRole("button", { name: "Làm mới hồ sơ giáo viên", exact: true }).click();
  await panel.getByRole("button", { name: "Xem hồ sơ " + nameA, exact: true }).waitFor();
  await panel.getByRole("button", { name: "Xem hồ sơ " + nameA, exact: true }).click();
  await detail
    .getByRole("button", { name: "Duyệt hồ sơ", exact: true })
    .click();
  check(
    writes.length === 0,
    "Choosing approve only opens a review confirmation and does not mutate access",
  );
  const note = detail.getByRole("textbox", {
    name: "Ghi chú xét duyệt",
    exact: true,
  });
  await note.fill("ngắn");
  check(
    await detail
      .getByRole("button", { name: "Xác nhận duyệt", exact: true })
      .isDisabled(),
    "Decision requires an adequate review note",
  );
  await note.fill("Đã đối chiếu thông tin khai báo tổng hợp.");
  await detail
    .getByRole("button", { name: "Xác nhận duyệt", exact: true })
    .click();
  await panel
    .getByText("Đã duyệt khai báo và cấp quyền giáo viên.", { exact: false })
    .waitFor();
  check(
    writes[0].applicationId === applications[0].id &&
      writes[0].expectedRevision === 1 &&
      writes[0].action === "approve" &&
      typeof writes[0].requestId === "string",
    "Approval sends note, canonical revision and idempotency ID to the guarded API",
  );
  check(
    (await panel.locator("tbody tr").count()) === 0 &&
      applications[0].status === "approved",
    "Reviewed application leaves the pending filter while the decision remains visible",
  );
  check(
    (await detail.textContent()).includes("quyền admin") &&
      (await detail.textContent()).includes("dữ liệu riêng"),
    "Teacher approval does not promise admin or private student access",
  );
  await page.evaluate(() => window.scrollTo(0,0));
  await page.waitForFunction(() => {const element=document.querySelector('[data-teacher-detail]');return element&&Number(getComputedStyle(element).opacity)>=.99;});
  await page.screenshot({
    path: "docs/v3/qa-teacher-admin-desktop.png",
    fullPage: true,
  });
  conflictNext = true;
  await detail
    .getByRole("button", { name: "Thu hồi quyền giáo viên", exact: true })
    .click();
  await note.fill("Thu hồi theo đối chiếu hồ sơ tổng hợp.");
  await detail
    .getByRole("button", { name: "Xác nhận thu hồi", exact: true })
    .click();
  await panel.getByRole("alert").waitFor();
  check(
    (await panel.getByRole("alert").textContent()).includes(
      "Hồ sơ đã được cập nhật",
    ) && applications[0].status === "approved",
    "Concurrent revisions show an actionable conflict and do not claim a completed revoke",
  );
  await panel
    .getByRole("button", { name: "Làm mới hồ sơ giáo viên", exact: true })
    .click();
  await panel
    .getByText("Chưa tìm thấy hồ sơ phù hợp", { exact: true })
    .waitFor();
  await panel
    .getByRole("combobox", { name: "Trạng thái", exact: true })
    .selectOption("approved");
  await panel
    .getByRole("button", { name: "Xem hồ sơ " + nameA, exact: true })
    .waitFor();
  await panel
    .getByRole("button", { name: "Xem hồ sơ " + nameA, exact: true })
    .click();
  await detail
    .getByRole("button", { name: "Thu hồi quyền giáo viên", exact: true })
    .click();
  await note.fill("Thu hồi sau lần đối chiếu lại hồ sơ tổng hợp.");
  await detail
    .getByRole("button", { name: "Xác nhận thu hồi", exact: true })
    .click();
  await panel
    .getByText("Đã thu hồi quyền giáo viên và lưu nhật ký.", { exact: true })
    .waitFor();
  check(
    writes.at(-1).expectedRevision === 3 &&
      applications[0].status === "revoked",
    "Explicit refresh uses the current revision before a successful revoke",
  );
  await panel
    .getByRole("combobox", { name: "Trạng thái", exact: true })
    .selectOption("pending");
  await query(nameB);
  await panel
    .getByRole("button", { name: "Xem hồ sơ " + nameB, exact: true })
    .waitFor();
  await panel
    .getByRole("button", { name: "Xem hồ sơ " + nameB, exact: true })
    .click();
  await detail.getByRole("button", { name: "Từ chối", exact: true }).click();
  await note.fill("Cần bổ sung đối chiếu thông tin trường đã khai báo.");
  loseNextAck = true;
  await detail
    .getByRole("button", { name: "Xác nhận từ chối", exact: true })
    .click();
  await panel.getByRole("alert").waitFor();
  const beforeRetry = applied,
    firstId = writes.at(-1).requestId;
  await detail
    .getByRole("button", { name: "Xác nhận từ chối", exact: true })
    .click();
  await panel
    .getByText("Đã từ chối hồ sơ và lưu ghi chú xét duyệt.", { exact: true })
    .waitFor();
  check(
    writes.at(-1).requestId === firstId &&
      applied === beforeRetry &&
      applications[1].status === "rejected",
    "Lost-ACK retry reuses the same ID and does not apply the decision twice",
  );
  await query("KIỂM THỬ TỰ DUYỆT");
  await panel
    .getByRole("button", { name: "Xem hồ sơ KIỂM THỬ TỰ DUYỆT", exact: true })
    .waitFor();
  await panel
    .getByRole("button", { name: "Xem hồ sơ KIỂM THỬ TỰ DUYỆT", exact: true })
    .click();
  check(
    (await detail
      .getByRole("button", { name: "Duyệt hồ sơ", exact: true })
      .count()) === 0 &&
      (await detail.textContent()).includes("không thể tự xét duyệt"),
    "Administrator cannot self-review their own teacher declaration",
  );
  await page
    .getByRole("button", { name: "Nhật ký kiểm toán", exact: true })
    .click();
  check(
    (await page.locator(".ad-audit-list").textContent()).includes(
      "Từ chối hồ sơ giáo viên",
    ),
    "Successful review refreshes the admin audit view",
  );
  await page.evaluate(() => window.__mountTeacherAdmin("read-only"));
  await page
    .getByRole("button", { name: "Xét duyệt giáo viên", exact: true })
    .click();
  await panel.locator("tbody tr").first().waitFor();
  await query("KIỂM THỬ TỰ DUYỆT");
  await panel
    .getByRole("button", { name: "Xem hồ sơ KIỂM THỬ TỰ DUYỆT", exact: true })
    .waitFor();
  await panel
    .getByRole("button", { name: "Xem hồ sơ KIỂM THỬ TỰ DUYỆT", exact: true })
    .click();
  check(
    (await detail.textContent()).includes("chưa có quyền quyết định") &&
      (await detail
        .getByRole("button", { name: "Duyệt hồ sơ", exact: true })
        .count()) === 0,
    "Read-only permission exposes details without review controls",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0,0));
  await page.waitForFunction(() => {const element=document.querySelector('[data-teacher-detail]');return element&&Number(getComputedStyle(element).opacity)>=.99;});
  await page.screenshot({
    path: "docs/v3/qa-teacher-admin-mobile.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    width: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll("body *")]
      .filter(
        (e) =>
          e.getBoundingClientRect().right > window.innerWidth + 2 ||
          e.scrollWidth > e.clientWidth + 10,
      )
      .slice(0, 15)
      .map((e) => ({
        name: e.tagName,
        cls: e.className,
        right: e.getBoundingClientRect().right,
        width: e.clientWidth,
        scroll: e.scrollWidth,
        overflow: getComputedStyle(e).overflowX,
      })),
  }));
  check(
    overflow.scroll <= overflow.width + 2,
    "Teacher queue and detail fit a 390px viewport with contained table scrolling " +
      (overflow.scroll > overflow.width + 2 ? JSON.stringify(overflow) : ""),
  );
  failNext = true;
  await panel
    .getByRole("button", { name: "Làm mới hồ sơ giáo viên", exact: true })
    .click();
  await panel.getByRole("alert").waitFor();
  check(
    !(await panel.textContent()).includes("SYNTHETIC_SECRET") &&
      (await panel.getByRole("alert").textContent()).includes(
        "Vui lòng thử lại",
      ),
    "Unrecognized backend errors never echo arbitrary details or secrets",
  );
  await page.evaluate(() => window.__mountTeacherAdmin("dev"));
  await page.getByRole("button", { name: "Tổng quan", exact: true }).waitFor();
  check(
    (await page
      .getByRole("button", { name: "Xét duyệt giáo viên", exact: true })
      .count()) === 0,
    "DEV has no private teacher queue entry point",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.__mountTeacherAdmin("admin"));
  await page
    .getByRole("button", { name: "Xét duyệt giáo viên", exact: true })
    .click();
  await panel.locator("tbody tr").first().waitFor();
  await query("KIỂM THỬ HỒ SƠ 4");
  await panel
    .getByRole("button", { name: "Xem hồ sơ KIỂM THỬ HỒ SƠ 4", exact: true })
    .waitFor();
  await panel
    .getByRole("button", { name: "Xem hồ sơ KIỂM THỬ HỒ SƠ 4", exact: true })
    .click();
  await detail
    .getByRole("button", { name: "Duyệt hồ sơ", exact: true })
    .click();
  await note.fill("Đối chiếu tổng hợp dùng để thử phản hồi chậm.");
  delayNext = true;
  await detail
    .getByRole("button", { name: "Xác nhận duyệt", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector("[data-teacher-detail] button[type=submit]")
        ?.disabled === true,
  );
  await page
    .getByRole("button", { name: "Làm mới dữ liệu", exact: true })
    .click();
  await panel
    .getByText("Chưa tìm thấy hồ sơ phù hợp", { exact: true })
    .waitFor();
  if (!delayed) throw Error("DELAYED_REVIEW_NOT_DISPATCHED");
  await delayed();
  check(
    (await page.locator("[data-teacher-detail]").count()) === 0 &&
      (await panel
        .getByRole("button", { name: "Tìm", exact: true })
        .isEnabled()),
    "Refresh during a pending review clears stale detail and releases the UI lock",
  );
  check(
    (await panel
      .getByText("Đã duyệt khai báo và cấp quyền giáo viên.", { exact: false })
      .count()) === 0,
    "Late review responses cannot attach old decisions after the context has refreshed",
  );
  check(
    errors.length === 0,
    "No runtime errors during filtering, review, retries, permissions or mobile rendering",
  );
  check(
    external.length === 0,
    "No evidence link, provider or external service was contacted",
  );
  return {
    status: "PASS",
    passed: passed.length,
    cases: passed,
    errors,
    paidProviderRequests: 0,
    actualTeacherAccounts: 0,
    reviewMutations: applied,
    syntheticHTTPRequests: writes.length,
    screenshots: [
      "docs/v3/qa-teacher-admin-desktop.png",
      "docs/v3/qa-teacher-admin-mobile.png",
    ],
    scope:
      "Actual React/CSS admin components with explicitly synthetic applicants and intercepted API responses; backend security is tested separately",
  };
};
