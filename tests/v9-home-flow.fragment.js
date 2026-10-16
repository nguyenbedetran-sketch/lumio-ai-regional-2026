// Inserted into the existing actual-workspace fixture; all content/HTTP is synthetic.
{
  const home = page.locator("[data-home-v8]"),
    composer = page.locator("[data-home-composer]"),
    primary = sidebar.getByRole("navigation", { name: "Học tập", exact: true }),
    text = "GIẢ LẬP · Vì sao số chia phải khác không?";
  await home.waitFor();
  const homeVisualMetrics = await home.evaluate((n) => ({
    homeFontFamily: getComputedStyle(n).fontFamily,
    headingFontFamily: getComputedStyle(n.querySelector("h1")).fontFamily,
    inputFontFamily: getComputedStyle(n.querySelector("textarea")).fontFamily,
    viewport: { width: innerWidth, height: innerHeight },
  }));
  await page.evaluate((value) => {
    window.__v9HomeAudit = value;
  }, homeVisualMetrics);
  check(
    !/Cambria|Georgia|Times|(?:^|,)\s*serif(?:,|$)/i.test(
      homeVisualMetrics.homeFontFamily,
    ) &&
      !/Cambria|Georgia|Times|(?:^|,)\s*serif(?:,|$)/i.test(
        homeVisualMetrics.headingFontFamily,
      ),
    "Home and heading inherit the established sans-serif typography",
  );
  check(
    (await composer
      .getByRole("button", { name: "Mở cùng gia sư AI", exact: true })
      .isDisabled()) && aiRequests.length === 0,
    "Empty home question cannot open or generate a tutor response",
  );
  check(
    (await composer.locator("textarea").getAttribute("aria-keyshortcuts")) ===
      "Control+Enter Meta+Enter" &&
      (
        await composer.locator("textarea").getAttribute("aria-describedby")
      ).split(" ").length === 2,
    "Home input exposes keyboard shortcut and linked example/data-disclosure descriptions",
  );
  check(
    (await home.getByText("Chưa đặt mục tiêu", { exact: true }).isVisible()) &&
      (await home.locator("progress").count()) === 0,
    "No saved goals shows an honest empty state rather than 0/0 progress",
  );
  const notice = page.locator('[data-preview-notice="competition"]');
  await notice.waitFor();
  check(
    (await notice.getAttribute("open")) === null &&
      (await notice.locator("summary").innerText()).includes(
        "dữ liệu máy chủ có thể đặt lại",
      ) &&
      !(await notice.locator(":scope > p").isVisible()),
    "Compact preview notice always shows the hosting-reset warning while optional detail is collapsed",
  );
  await notice.locator("summary").focus();
  await page.keyboard.press("Enter");
  check(
    (await notice.locator(":scope > p").isVisible()) &&
      (await notice.locator(":scope > p").innerText()).includes(
        "200 lượt AI/ngày UTC",
      ),
    "Keyboard expands the unchanged actual-AI quota, local storage and payment disclosures",
  );
  await page.keyboard.press("Space");
  check(
    (await notice.getAttribute("open")) === null &&
      (await notice.locator("summary").isVisible()),
    "Collapsing informational detail never dismisses the persistent warning",
  );
  check(
    (await home.locator("[data-home-material]").count()) === 3,
    "V9 home shows exactly three real fixture materials",
  );
  check(
    (await home
      .locator('[data-home-material][aria-label^="Mở học liệu:"]')
      .count()) === 3,
    "Every recent material card exposes its own open action and full title",
  );
  check(
    (await home.locator(".lx-streak-card details").getAttribute("open")) ===
      null &&
      (await home.locator(".lx-streak-card strong").innerText()).includes(
        "Mỗi lần học đều đáng ghi nhận.",
      ),
    "Inactive streak uses neutral real-activity copy and a collapsed explanation",
  );
  check(
    (await page.locator(".lm-library-section").count()) === 0,
    "Home has one recent shelf instead of a duplicate library list",
  );
  const tools = page
    .locator("details")
    .filter({ has: page.locator(".lx-materials") });
  check(
    (await tools.getAttribute("open")) === null,
    "Advanced import and spaces start collapsed",
  );
  await tools.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  check(
    (await tools.getAttribute("open")) !== null,
    "Keyboard opens preserved import/space tools",
  );
  await page.keyboard.press("Enter");
  await composer.locator("select").selectOption("qa-v7-text");
  await composer.locator("textarea").fill(text);
  await primary.getByRole("button").nth(1).click();
  const guard = page.getByRole("dialog", {
    name: "Bỏ thay đổi chưa lưu?",
    exact: true,
  });
  await guard.waitFor();
  await guard
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  check(
    (await composer.locator("textarea").inputValue()) === text,
    "Home draft survives cancelled navigation",
  );
  check(
    aiRequests.length === 0,
    "Composing and choosing source never sends AI",
  );
  await home
    .getByRole("button", { name: "Thêm học liệu", exact: true })
    .first()
    .click();
  await guard.waitFor();
  await guard
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  check(
    (await composer.locator("textarea").inputValue()) === text,
    "Add-material entry guards the home question before opening an importer",
  );
  await home
    .getByRole("button", { name: "Thêm học liệu", exact: true })
    .first()
    .click();
  await guard.getByRole("button", { name: "Bỏ bản nháp", exact: true }).click();
  // Locate the actual upload dialog by its file control, independent of title translation.
  const uploadDialog = page
    .getByRole("dialog")
    .filter({ has: page.locator('input[type="file"]') });
  await uploadDialog.waitFor();
  await uploadDialog.getByRole("button", { name: "Đóng", exact: true }).click();
  check(
    (await composer.locator("textarea").inputValue()) === "",
    "Explicitly discarding the home draft clears it even when import is cancelled",
  );
  await composer.locator("textarea").fill(text);
  await composer.locator("textarea").dispatchEvent("keydown", {
    key: "Enter",
    ctrlKey: true,
    isComposing: true,
    bubbles: true,
  });
  check(
    (await composer.locator("textarea").isVisible()) && aiRequests.length === 0,
    "Home keyboard shortcut does not submit while an IME composition is active",
  );
  await composer.locator("textarea").press("Control+Enter");
  await page.locator(".lm-composer textarea").waitFor();
  check(
    (await page.locator(".lm-composer textarea").inputValue()) === text,
    "Selected source question transfers to the tutor draft",
  );
  check(
    (await page
      .getByRole("tab", { name: "Hỏi Lumio", exact: true })
      .getAttribute("aria-selected")) === "true",
    "Home entry opens the actual source chat tab",
  );
  check(
    aiRequests.length === 0,
    "Opening a prefilled tutor makes no generation request",
  );
  await primary.getByRole("button").first().click();
  await guard.waitFor();
  await guard
    .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
    .click();
  check(
    (await page.locator(".lm-composer textarea").inputValue()) === text,
    "Transferred draft is guarded before the first edit",
  );
  await page.locator(".lm-composer textarea").fill("");
  await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
  await page.getByRole("tab", { name: "Hỏi Lumio", exact: true }).click();
  check(
    (await page.locator(".lm-composer textarea").inputValue()) === "",
    "Cleared home prompt stays empty across document tab remounts",
  );
  await primary.getByRole("button").first().click();
  await home.waitFor();
  check(
    (await composer.locator("textarea").inputValue()) === "",
    "Returning home does not resurrect a transferred draft",
  );
  // Create and complete a goal through the actual planner; do not fabricate progress state.
  await primary.getByRole("button").nth(3).click();
  await page
    .locator(".lv-planner")
    .getByRole("button", { name: "Thêm mục tiêu", exact: true })
    .first()
    .click();
  const goalDialog = page.getByRole("dialog", {
    name: "Thêm mục tiêu",
    exact: true,
  });
  await goalDialog
    .getByRole("textbox", { name: "Bạn muốn học điều gì?", exact: true })
    .fill("KIỂM THỬ V9 · Kiểm tra điều kiện phép chia");
  await goalDialog
    .getByRole("button", { name: "Lưu mục tiêu", exact: true })
    .click();
  await primary.getByRole("button").first().click();
  await home.waitFor();
  check(
    await home
      .locator("progress")
      .evaluate((n) => n.value === 0 && n.max === 1),
    "A newly saved real planner goal produces 0 of 1 native progress",
  );
  await home
    .getByRole("button", {
      name: "KIỂM THỬ V9 · Kiểm tra điều kiện phép chia",
      exact: true,
    })
    .click();
  check(
    (await home
      .locator("progress")
      .evaluate((n) => n.value === 1 && n.max === 1)) &&
      (await home
        .getByText("Mục tiêu bạn tự đánh dấu, không phải điểm kiến thức.", {
          exact: true,
        })
        .isVisible()),
    "Actual goal completion updates progress with an explicit manual-goal scope label",
  );
  check(
    (await home.locator(".lx-streak-card strong").innerText()).includes(
      "Đã ghi nhận hoạt động hôm nay.",
    ) &&
      (await home.locator(".lx-streak-card .is-today.has-study").count()) === 1,
    "Completing a real goal records today without a fabricated multi-day streak",
  );
  await primary.getByRole("button").nth(4).click();
  await page.locator(".lx-metric-cards").waitFor();
  check(
    (await page
      .locator(".lx-metric-cards section")
      .first()
      .locator("strong")
      .innerText()) === "1" &&
      (await page.locator(".lx-streak-card .is-today.has-study").count()) === 1,
    "Goal-to-progress navigation preserves the same real one-day activity observation",
  );
  await primary.getByRole("button").first().click();
  await home.waitFor();
  check(
    await composer.evaluate(
      (n) =>
        getComputedStyle(n).backgroundImage.includes("radial-gradient") &&
        getComputedStyle(n).animationName === "none",
    ),
    "Tutor emphasis is a local static gradient without a continuously animated glow",
  );
  await page.screenshot({
    path: "docs/v9/qa-home-desktop.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.dataset.motion = "full";
    window.__v9HomeAnimations = [];
    const original = Element.prototype.animate;
    window.__v9RestoreAnimate = () => {
      Element.prototype.animate = original;
    };
    Element.prototype.animate = function (frames, options) {
      if (this.matches("[data-dash-reveal]")) {
        window.__v9HomeAnimations.push({ frames, options });
      }
      return original.call(this, frames, options);
    };
  });
  await primary.getByRole("button").nth(3).click();
  await primary.getByRole("button").first().click();
  await page.waitForFunction(() => window.__v9HomeAnimations.length > 0);
  check(
    await page.evaluate(() =>
      window.__v9HomeAnimations.every(
        ({ frames, options }) =>
          options.duration <= 280 &&
          options.delay <= 64 &&
          frames.every(
            (frame) =>
              !String(frame.transform || "").includes("scale") &&
              Number(frame.opacity ?? 1) >= 0.85,
          ),
      ),
    ),
    "Actual Home entry motion stays within 280ms with tiny translation, no scale and bounded stagger",
  );
  await page.evaluate(() => {
    window.__v9RestoreAnimate();
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () =>
      document.querySelector("[data-home-v8]")?.dataset.dashboardMotion ===
      "off",
  );
  check(
    await home.evaluate((n) =>
      n
        .getAnimations({ subtree: true })
        .every((a) => a.playState !== "running"),
    ),
    "Reduced motion cancels home entrance/counter effects",
  );
  for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `V9 actual workspace has no horizontal overflow at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  for (const language of ["en", "zh-CN", "ja", "ko", "vi"]) {
    await page.locator(".lm-language select").selectOption(language);
    check(
      (await home.locator("h1").textContent()).trim().length > 0 &&
        (await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        )),
      `V9 home localized and fits mobile: ${language}`,
    );
    check(
      (await notice.locator("summary").innerText()).trim().length > 25 &&
        (await composer.locator("textarea").getAttribute("aria-describedby"))
          .split(" ")
          .every(Boolean),
      `Preview warning and question context remain available in ${language}`,
    );
    for (const theme of ["dark", "light"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      check(
        (await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        )) &&
          (await composer.locator("textarea").isVisible()) &&
          (await notice.locator("summary").isVisible()),
        `Localized Home and persistent warning fit 390px in ${theme}: ${language}`,
      );
    }
  }
  check(
    (await composer
      .locator("select")
      .evaluate((n) => n.getBoundingClientRect().height >= 44)) &&
      (await composer
        .locator('button[type="submit"], button.primary')
        .last()
        .evaluate((n) => n.getBoundingClientRect().height >= 44)),
    "Mobile source and primary action retain comfortable 44px targets",
  );
  await composer.locator("textarea").focus();
  check(
    await composer
      .locator("textarea")
      .evaluate(
        (n) =>
          document.activeElement === n &&
          getComputedStyle(n).outlineStyle !== "none",
      ),
    "Home question input has visible keyboard focus",
  );
  await page.screenshot({ path: "docs/v9/qa-home-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  check(
    await home.locator(".lx-streak-symbol").evaluate((n) => {
      const style = getComputedStyle(n),
        probe = document.createElement("span");
      probe.style.color = "var(--lm-success, var(--lm-accent))";
      n.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return style.color === expected;
    }),
    "Active dark streak uses semantic success rather than a warning color",
  );
  await page.screenshot({ path: "docs/v9/qa-home-dark.png", fullPage: true });
  check(
    (await composer.evaluate((n) =>
      getComputedStyle(n).backgroundImage.includes("radial-gradient"),
    )) &&
      (await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      )),
    "Dark theme preserves localized AI emphasis without overflow",
  );
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
}
