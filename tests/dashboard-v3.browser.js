// Playwright CLI QA in an isolated guest session. All sample activity is created through visible UI.
async function lumioDashboardQA(page) {
  const passed = [], errors = [];
  const check = (ok, name) => { if (!ok) throw new Error(name); passed.push(name); };
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator(".dv-hero").waitFor();
  check((await page.locator(".dv-constellation-node").count()) === 4, "Four real-data journey shortcuts");
  check(await page.locator(".dv-goal-ring > strong > svg").evaluate((icon) => getComputedStyle(icon).width === "25px"), "Empty-state goal icon remains25px");
  await page.getByRole("button", { name: "Khám phá bài học mẫu", exact: true }).click();
  await page.getByRole("tab", { name: "Ghi chú", exact: true }).waitFor();
  await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await page.locator(".dv-hero").waitFor();
  check((await page.getByRole("button", { name: "Tài liệu: 1", exact: true }).count()) === 1, "Journey shows the one UI-created material");
  check((await page.locator(".dv-next-step").getAttribute("class")).includes("kind-review"), "Actual due card drives the next study action");
  check((await page.locator(".dv-recent-card").count()) === 1, "Recent shelf contains only the actual material");
  await page.locator(".dv-goals-card .dv-add-goal").click();
  await page.locator(".lx-page-title").getByRole("button", { name: "Thêm mục tiêu", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Bạn muốn học điều gì?", { exact: true }).fill("Mục tiêu kiểm thử trực quan Lumio");
  await dialog.getByRole("button", { name: "Lưu mục tiêu", exact: true }).click();
  await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await page.locator(".dv-hero").waitFor();
  const progress = page.locator(".dv-goals-card progress");
  check((await progress.getAttribute("value")) === "0" && (await progress.getAttribute("max")) === "1", "Daily goal progress starts from saved zero of one");
  await page.locator(".dv-mini-goals .lx-check").click();
  await page.waitForFunction(() => document.querySelector(".dv-goals-card progress")?.value === 1);
  check((await progress.getAttribute("value")) === "1", "Completing a goal updates real progress");
  check((await page.getByRole("button", { name: "Mục tiêu hôm nay: 1 / 1", exact: true }).count()) === 1, "Journey goal count agrees with actual completion");
  check((await page.locator(".dv-goal-ring .dv-sr-only").textContent()) === "100%", "Counter exposes actual final progress to assistive technology");
  await page.waitForFunction(() => document.querySelector(".dv-goal-ring .dv-counter > [aria-hidden]")?.textContent === "100%");
  await page.screenshot({ path: "docs/qa-dashboard-desktop.png", fullPage: true });

  await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
  await page.locator("label.lm-field").filter({ hasText: /^\s*Giao diện/ }).locator("select").selectOption("dark");
  await page.locator("label.lm-field").filter({ hasText: /^\s*Chuyển động/ }).locator("select").selectOption("off");
  await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".dv-dashboard")?.dataset.dashboardMotion === "off");
  check(await page.locator(".dv-dashboard").evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length === 0), "Motion off has no running dashboard animation");
  check(await page.locator(".dv-hero").evaluate((element) => getComputedStyle(element).opacity === "1"), "Motion off leaves the hero fully visible");
  await page.screenshot({ path: "docs/qa-dashboard-dark.png", fullPage: true });

  await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
  await page.locator("label.lm-field").filter({ hasText: /^\s*Giao diện/ }).locator("select").selectOption("light");
  await page.locator("label.lm-field").filter({ hasText: /^\s*Chuyển động/ }).locator("select").selectOption("full");
  await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.querySelector(".dv-dashboard")?.dataset.dashboardMotion === "off");
  check(await page.locator(".dv-dashboard").evaluate((element) => element.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length === 0), "System reduced motion overrides full effects");
  for (const width of [325, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No dashboard horizontal overflow at${width}px`);
    const bounds = await page.locator(".dv-hero").boundingBox();
    check(bounds.x >= 0 && bounds.x + bounds.width <= width, `Hero fits${width}px`);
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({ path: "docs/qa-dashboard-mobile.png", fullPage: true });
  const language = page.locator(".lm-language select");
  for (const locale of ["en", "zh-CN", "ja", "ko", "vi"]) {
    await language.selectOption(locale);
    check((await page.locator(".dv-hero h1").textContent()).length > 0, `Localized hero in${locale}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Localized dashboard fits mobile in${locale}`);
  }
  check(errors.length === 0, "No browser runtime errors during dashboard interactions");
  return { status: "PASS", checks: passed.length, passed, errors };
}
