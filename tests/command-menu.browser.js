// Playwright CLI run-code input. Run in a NEW isolated guest session, never a user profile.
async function lumioCommandMenuQA(page) {
  const passed = [];
  const check = (ok, label) => {
    if (!ok) throw new Error(label);
    passed.push(label);
  };
  const errors = [];
  try {
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 960 });
    await page
      .getByRole("button", { name: "Tìm nhanh", exact: true })
      .waitFor();
    if (
      await page
        .getByRole("button", { name: "Khám phá bài học mẫu", exact: true })
        .count()
    ) {
      await page
        .getByRole("button", { name: "Khám phá bài học mẫu", exact: true })
        .click();
    }
    await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
    const notes = page.getByRole("textbox", { name: "Ghi chú", exact: true });
    const draft = "Bản nháp kiểm thử Lumio: định lý Pythagoras.";
    await notes.fill(draft);
    await page.keyboard.press("Control+k");
    const dialog = page.locator("dialog[open]");
    await dialog.waitFor();
    check(
      await dialog
        .getByRole("combobox")
        .evaluate((e) => e === document.activeElement),
      "Input receives focus",
    );
    await page.keyboard.press("Escape");
    check(
      (await notes.inputValue()) === draft,
      "Opening and cancelling preserves notes",
    );
    check(
      await notes.evaluate((e) => e === document.activeElement),
      "Escape restores editor focus",
    );
    await page.keyboard.press("Control+k");
    await dialog.getByRole("combobox").fill("hoc cach hoc");
    check(
      (await dialog.getByRole("option").count()) === 1,
      "Accent-insensitive source title search",
    );
    await dialog.getByRole("combobox").fill("pythagoras");
    check(
      (await dialog.getByRole("option").count()) === 1,
      "Search finds note content",
    );
    await dialog.getByRole("combobox").fill("khong-co-ket-qua-qa-8392");
    check(
      (await dialog.getByRole("option").count()) === 0,
      "Empty query results",
    );
    await dialog.getByRole("combobox").fill("phong giong noi");
    await page.keyboard.press("Enter");
    await page.locator(".lv-studio textarea").waitFor();
    check(
      (await page.locator("dialog[open]").count()) === 0,
      "Enter selects destination and closes dialog",
    );
    const voice = page.locator(".lv-studio textarea");
    await voice.fill("Câu hỏi chưa gửi: diện tích hình tròn là gì?");
    await page.keyboard.press("Control+k");
    await dialog.waitFor();
    await page.keyboard.press("Escape");
    check(
      (await voice.inputValue()).startsWith("Câu hỏi chưa gửi"),
      "Cancelling palette preserves voice draft",
    );
    await page
      .getByRole("button", { name: "Thêm nội dung ＋", exact: true })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Control+k");
    check(
      (await page.locator(".lc-command-dialog[open]").count()) === 0,
      "Existing modal owns shortcut",
    );
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
    await dialog.waitFor();
    const bounds = await page.locator(".lc-command-panel").boundingBox();
    check(
      !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= 375,
      "Palette fits 375px viewport",
    );
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "No mobile horizontal overflow",
    );
    await page.waitForFunction(
      () => {
        const panel = document.querySelector(".lc-command-panel");
        return panel && getComputedStyle(panel).opacity === "1";
      },
      null,
      { timeout: 5000 },
    );
    check(true, "Normal entrance reaches visible final state");
    await page.screenshot({ path: "docs/qa-command-mobile.png" });
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
    await dialog.waitFor();
    check(
      await page
        .locator(".lc-command-panel")
        .evaluate(
          (e) =>
            e.getAnimations().filter((a) => a.playState === "running")
              .length === 0,
        ),
      "Reduced motion has no running panel animation",
    );
    const transform = await page
      .locator(".lc-command-panel")
      .evaluate((e) => getComputedStyle(e).transform);
    check(
      transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)",
      "Reduced motion keeps panel stationary",
    );
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
    await dialog.getByRole("combobox").fill("phong");
    await page.emulateMedia({ reducedMotion: "reduce" });
    check(
      (await dialog.getByRole("combobox").inputValue()) === "phong",
      "Live reduced-motion change preserves query",
    );
    check(
      await dialog
        .getByRole("combobox")
        .evaluate((e) => e === document.activeElement),
      "Live reduced-motion change preserves focus",
    );
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 960 });
    await page
      .getByRole("combobox", { name: "Ngôn ngữ giao diện", exact: true })
      .selectOption("en");
    await page
      .getByRole("button", { name: "Quick search", exact: true })
      .click();
    await dialog.waitFor();
    check(
      (await dialog.getByRole("combobox").count()) === 1,
      "English search UI available",
    );
    await page.screenshot({ path: "docs/qa-command-desktop.png" });
    await page.keyboard.press("Escape");
    await page
      .getByRole("combobox", { name: "Interface language", exact: true })
      .selectOption("vi");
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
    await dialog.waitFor();
    const lightBackground = await page
      .locator(".lc-command-panel")
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    await dialog.getByRole("combobox").fill("cai dat");
    await page.keyboard.press("Enter");
    await page
      .getByRole("heading", { name: "Cài đặt", level: 1, exact: true })
      .waitFor({ timeout: 5000 });
    await page.getByLabel(/^Giao diện/).selectOption("dark");
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
    await dialog.waitFor();
    const darkBackground = await page
      .locator(".lc-command-panel")
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    check(
      darkBackground !== lightBackground &&
        darkBackground !== "rgba(0, 0, 0, 0)",
      "Palette follows dark-theme background",
    );
    const focusSequence = [];
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press(key);
        focusSequence.push(
          await dialog.evaluate((e) => ({
            tag: document.activeElement?.tagName,
            role: document.activeElement?.getAttribute("role"),
            inside: e.contains(document.activeElement),
            modal: e.matches(":modal"),
            documentFocused: document.hasFocus(),
          })),
        );
      }
    }
    // Chromium can move to browser chrome (BODY is then activeElement), which
    // is distinct from focusing an inert background button, input or link.
    check(
      focusSequence.every(
        (entry) => entry.modal && (entry.inside || entry.tag === "BODY"),
      ),
      `No background control receives Tab focus while dialog stays modal: ${JSON.stringify(focusSequence)}`,
    );
    await page.screenshot({ path: "docs/qa-command-dark.png" });
    await page.keyboard.press("Escape");
    check(
      errors.length === 0,
      `No runtime or hydration errors (${errors.length})`,
    );
    return { status: "PASS", checks: passed.length, passed, focusSequence };
  } catch (error) {
    throw new Error(
      `After ${passed.length} checks (${passed.at(-1) || "initial setup"}): ${error.message}`,
    );
  }
}
