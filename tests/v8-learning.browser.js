async (page) => {
  const checks = [],
    errors = [],
    external = [];
  const check = (ok, name) => {
    if (!ok) throw Error(name);
    checks.push(name);
  };
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", (route) => {
    const url = route.request().url();
    for (const [suffix, file, type] of [
      ["/fixture", "fixture.html", "text/html"],
      ["/fixture.js", "fixture.js", "text/javascript"],
      ["/fixture.css", "fixture.css", "text/css"],
    ])
      if (url === "http://localhost:3000" + suffix)
        return route.fulfill({
          path: "work/v8-learning-ui/" + file,
          contentType: type,
        });
    external.push(url);
    return route.abort();
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("http://localhost:3000/fixture");
  await page.locator("[data-learning-plan]").waitFor();
  check(
    await page
      .locator("[data-learning-plan] article")
      .first()
      .evaluate(
        (node) => getComputedStyle(node.parentElement).display === "grid",
      ),
    "Plan uses its own responsive grid without CSS-module collisions",
  );
  check(
    await page
      .locator("[data-learning-plan] article")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName === "none"),
    "Plan respects reduced-motion preference",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => (document.documentElement.dataset.motion = "off"));
  check(
    await page
      .locator("[data-learning-plan] article")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName === "none"),
    "User motion-off disables plan entrance independently of OS setting",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  const alternatives = page.locator("[data-plan-alternatives]");
  check(
    !(await alternatives.evaluate((node) => node.open)),
    "Secondary actions start collapsed to keep one primary step visible",
  );
  await alternatives.locator("summary").focus();
  await alternatives.locator("summary").press("Enter");
  check(
    await alternatives.evaluate((node) => node.open),
    "Keyboard Enter opens the native alternatives disclosure",
  );
  await alternatives.locator("summary").press("Enter");
  check(
    !(await alternatives.evaluate((node) => node.open)),
    "Keyboard Enter can collapse alternatives again",
  );
  check(
    (await page.locator("[data-plan-primary]").innerText()).includes("Phân số"),
    "Due review is the primary action",
  );
  check(
    (await page.locator("[data-learning-plan] article").count()) <= 3,
    "Plan shows at most three material actions",
  );
  await page.getByLabel("Chọn trọng tâm").selectOption("linear");
  check(
    (await page.locator("[data-plan-primary]").innerText()).includes(
      "trọng tâm",
    ) ||
      (await page.locator("[data-plan-primary]").innerText()).includes(
        "Trọng tâm",
      ),
    "Learner focus has an explicit preference explanation",
  );
  await page.getByLabel("Chọn trọng tâm").selectOption("");
  check(
    await page.evaluate(
      () => window.__v8Data.preferences.studyFocusSkillId === null,
    ),
    "Automatic focus uses an explicit null clear compatible with older sync writers",
  );
  await page.getByLabel("Chọn trọng tâm").selectOption("linear");
  await page.locator("[data-plan-primary] button").click();
  check(
    (await page.evaluate(() => window.__v8Opened)) === "qa-math",
    "Plan opens only an existing selected material",
  );
  await page.screenshot({
    path: "docs/v8/qa-learning-plan-desktop.png",
    fullPage: true,
  });
  await page.locator('[data-qa-tab="evidence"]').click();
  await page.locator("[data-skill-detail]").waitFor();
  await page.locator("[data-evidence-inspector] summary").click();
  await page
    .getByRole("button", { name: "Loại khỏi diễn giải", exact: true })
    .click();
  check(
    (await page.evaluate(
      () => window.__v8Data.preferences.excludedSkillAttemptIds[0],
    )) === "qa-attempt-weak",
    "Exclude control records only the selected attempt ID",
  );
  check(
    (await page.evaluate(() => window.__v8Data.items[0].attempts[0].score)) ===
      0,
    "Excluding evidence preserves the recorded quiz score",
  );
  check(
    (await page.locator("[data-skill-detail]").innerText()).includes("0/0"),
    "Excluded attempt no longer increases independent results",
  );
  await page.getByRole("button", { name: "Đưa vào lại", exact: true }).click();
  check(
    (await page.locator("[data-skill-detail]").innerText()).includes("0/2"),
    "Restoring evidence recovers observed results",
  );
  await page
    .getByRole("button", { name: "Loại khỏi diễn giải", exact: true })
    .click();
  await page.evaluate(() => {
    window.__v8ClearFail = true;
    window.confirm = () => true;
  });
  await page
    .getByRole("button", { name: "Xóa snapshot kỹ năng", exact: true })
    .click();
  check(
    await page.evaluate(
      () =>
        window.__v8ClearFailed &&
        window.__v8Data.preferences.excludedSkillAttemptIds.includes(
          "qa-attempt-weak",
        ),
    ),
    "Failed asynchronous snapshot clear preserves explicit exclusions",
  );
  check(
    (await page.locator("[data-skill-detail]").innerText()).includes("0/0") &&
      (await page.evaluate(
        () =>
          window.__v8Data.items[0].attempts[0].skillEvidence.attemptId ===
          "qa-attempt-weak",
      )),
    "Restored or unchanged evidence remains excluded after a failed library clear",
  );
  await page
    .getByRole("button", {
      name: "Khôi phục mọi lượt đã loại (1)",
      exact: true,
    })
    .click();
  check(
    await page.evaluate(
      () => window.__v8Data.preferences.excludedSkillAttemptIds.length === 0,
    ),
    "Only the explicit Restore All control resets exclusions",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/v8/qa-evidence-mobile.png",
    fullPage: true,
  });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Evidence inspector has no horizontal overflow at390px",
  );
  await page.locator('[data-qa-tab="review"]').click();
  await page.locator(".lx-review-session").waitFor();
  check(
    (await page.locator(".lsv-review-card").innerText()).includes(
      "một phần hai",
    ),
    "Overdue card appears ahead of an unseen card",
  );
  await page
    .locator(".lx-review-session [data-review-schedule-control] summary")
    .click();
  await page
    .locator(".lx-review-session")
    .getByRole("button", { name: "Dời sau một ngày", exact: true })
    .click();
  check(
    (await page.evaluate(
      () => window.__v8Data.learning.reviewOverrides.length,
    )) === 1,
    "Manual postponement saves a separate schedule override",
  );
  check(
    (await page.evaluate(() => window.__v8Data.learning.events.length)) === 0,
    "Postponement creates no fake learning activity",
  );
  check(
    (await page.evaluate(
      () => window.__v8Data.learning.reviews[0].repetitions,
    )) === 0,
    "Postponement does not increase review repetitions",
  );
  const scheduled = page.locator(".lx-schedule");
  await scheduled.getByText("Thời gian bạn tự chọn", { exact: true }).waitFor();
  await scheduled.locator("[data-review-schedule-control] summary").click();
  await scheduled
    .getByRole("button", { name: "Dùng lại lịch thích ứng", exact: true })
    .click();
  check(
    (await page.evaluate(
      () => window.__v8Data.learning.reviewOverrides.length,
    )) === 0,
    "Learner can restore adaptive scheduling",
  );
  check(
    (await page.locator(".lsv-review-card").innerText()).includes(
      "một phần hai",
    ),
    "Restoring schedule returns the overdue card",
  );
  await page
    .locator(".lx-review-session [data-review-schedule-control] summary")
    .click();
  const date = page.locator('.lx-review-session input[type="datetime-local"]');
  await date.fill("2020-01-01T12:00");
  await page
    .locator(".lx-review-session")
    .getByRole("button", { name: "Đặt lịch ôn", exact: true })
    .click();
  check(
    (await page.locator(".lx-review-session").innerText()).includes(
      "không quá365",
    ) ||
      (await page.locator(".lx-review-session").innerText()).includes(
        "không quá 365",
      ),
    "Invalid manual dates show a useful message",
  );
  check(
    (await page.evaluate(
      () => window.__v8Data.learning.reviewOverrides.length,
    )) === 0,
    "Invalid date does not alter the schedule",
  );
  await page.screenshot({
    path: "docs/v8/qa-review-mobile.png",
    fullPage: true,
  });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Review scheduling has no horizontal overflow at390px",
  );
  await page.locator(".lx-reveal-button").click();
  await page.locator(".lx-rating-grid button.good").click();
  check(
    (await page.evaluate(() => window.__v8Data.learning.events.length)) === 1,
    "A real revealed-card rating records one learning event",
  );
  check(
    (await page.evaluate(
      () =>
        window.__v8Data.learning.reviews.find((r) => r.cardId === "due")
          .repetitions,
    )) === 1,
    "Only actual recall rating advances adaptive repetitions",
  );
  await page.locator('[data-qa-tab="fault-review"]').click();
  await page.locator(".lx-review-session").waitFor();
  await page
    .locator(".lx-review-session [data-review-schedule-control] summary")
    .click();
  await page.evaluate(() => {
    window.__v8OriginalStorageWrite = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.includes("qa-review-fault"))
        throw new DOMException("Synthetic storage quota", "QuotaExceededError");
      return window.__v8OriginalStorageWrite.call(this, key, value);
    };
  });
  await page
    .locator(".lx-review-session")
    .getByRole("button", { name: "Dời sau một ngày", exact: true })
    .click();
  await page.waitForFunction(() => window.__v8FaultData.error === "write");
  check(
    await page.evaluate(
      () =>
        window.__v8FaultData.state.reviewOverrides.length === 1 &&
        window.__v8FaultData.state.events.length === 0,
    ),
    "Actual useLearning hook keeps failed schedule write in memory without fake activity",
  );
  check(
    await page.evaluate(
      () =>
        !JSON.parse(localStorage.getItem("lumio-learning-v1:qa-review-fault"))
          .reviewOverrides,
    ),
    "A rejected localStorage write does not become persisted schedule data",
  );
  check(
    (await page.locator("[data-review-storage-warning]").innerText()).includes(
      "chưa lưu được",
    ),
    "Failed schedule persistence is labelled unsaved rather than saved",
  );
  check(
    await page
      .locator("[data-review-schedule-control] button")
      .first()
      .isDisabled(),
    "Storage failure disables additional manual schedule mutations",
  );
  await page.evaluate(() => {
    Storage.prototype.setItem = window.__v8OriginalStorageWrite;
  });
  await page.locator('[data-qa-tab="plan"]').click();
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  check(
    await page
      .locator("[data-learning-plan]")
      .evaluate(
        (node) =>
          getComputedStyle(node).backgroundColor !== "rgb(255, 255, 255)",
      ),
    "Plan honors the actual shared dark-theme card token",
  );
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Daily plan has no horizontal overflow at390px",
  );
  await page.screenshot({
    path: "docs/v8/qa-learning-plan-dark-mobile.png",
    fullPage: true,
  });
  for (const locale of ["en", "zh-CN", "ja", "ko"]) {
    await page.getByLabel("Ngôn ngữ kiểm thử").selectOption(locale);
    check(
      (await page.locator("[data-learning-plan] h2").innerText()) !== "",
      "Plan controls render in " + locale,
    );
  }
  await page.getByLabel("Ngôn ngữ kiểm thử").selectOption("vi");
  await page.evaluate(() => window.__switchV8Account("b"));
  await page.waitForFunction(() => window.__v8Data.account === "b");
  check(
    (await page.locator("[data-learning-plan] article").count()) === 0,
    "Switching account removes the previous library plan",
  );
  check(
    await page.evaluate(
      () => window.__v8Data.preferences.excludedSkillAttemptIds === undefined,
    ),
    "Another account does not inherit exclusions",
  );
  check(errors.length === 0, "No browser runtime errors");
  check(
    external.length === 0,
    "Every fixture request stayed intercepted with no provider or product API",
  );
  return {
    status: "PASS",
    passed: checks.length,
    checks,
    errors,
    external,
    scope:
      "Actual React/CSS components with authored synthetic library/state and account remount; no real students, providers, public deployment or device claim",
  };
};
