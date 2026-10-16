// Inserted into the existing actual-workspace fixture; all content/HTTP is synthetic.
{
  const home = page.locator("[data-home-v8]"),
    composer = page.locator("[data-home-composer]"),
    primary = sidebar.getByRole("navigation", { name: "Học tập", exact: true }),
    text = "GIẢ LẬP · Vì sao số chia phải khác không?";
  await home.waitFor();
  check(
    (await home.locator("[data-home-material]").count()) === 3,
    "V8 home shows exactly three real fixture materials",
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
  await composer
    .getByRole("button", { name: "Mở cùng gia sư AI", exact: true })
    .click();
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
  await page.screenshot({
    path: "docs/v8/qa-home-desktop.png",
    fullPage: true,
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
  for (const width of [325, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `V8 actual workspace has no horizontal overflow at ${width}px`,
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
      `V8 home localized and fits mobile: ${language}`,
    );
  }
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
  await page.screenshot({ path: "docs/v8/qa-home-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
}
