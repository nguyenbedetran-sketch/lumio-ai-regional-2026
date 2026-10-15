// Explicit local QA. New isolated CLI guest profile, no provider calls or user data.
async function lumioPremiumQA(page) {
  const passed = [],
    errors = [],
    paidRequests = [];
  const check = (ok, label) => {
    if (!ok) throw new Error(label);
    passed.push(label);
  };
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/(ai|voice)/.test(request.url()))
      paidRequests.push(request.url());
  });
  const navigate = async (query) => {
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByRole("combobox").fill(query);
    await page.keyboard.press("Enter");
    await dialog.waitFor({ state: "hidden" });
  };
  const screenshot = async (name) => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `docs/${name}`, fullPage: true });
  };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator(".dv-dashboard").waitFor();
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "full",
  );
  check(
    (await page.locator(".dv-next-step.kind-start").count()) === 1,
    "Empty workspace offers a real start action",
  );
  check(
    (
      await page
        .locator(".dv-stats strong")
        .evaluateAll((nodes) =>
          nodes.map(
            (node) =>
              node.querySelector(".dv-sr-only")?.textContent ||
              node.textContent.trim(),
          ),
        )
    ).join("|") === "0|—|0|0",
    "New learner has zero activity and unknown accuracy",
  );
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("[data-dash-reveal]")).every(
      (e) => Number(getComputedStyle(e).opacity) === 1,
    ),
  );
  await screenshot("qa-premium-desktop.png");
  await page.screenshot({ path: "docs/qa-premium-overview.png" });
  await page
    .getByRole("button", { name: "Khám phá bài học mẫu", exact: true })
    .click();
  await page.locator(".lsv-reader-tools").waitFor();
  await page.locator(".lsv-reader-tools summary").click();
  await page.getByRole("button", { name: "Cỡ chữ: 20px", exact: true }).click();
  await page.getByRole("button", { name: "Rộng", exact: true }).click();
  check(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("lumio:reader-preferences:v1"))
          .fontSize === 20,
    ),
    "Reading size is saved without document data",
  );
  await page.getByRole("tab", { name: "Flashcards", exact: true }).click();
  const card = page.locator(".lsv-flip-card");
  await card.click();
  check(
    (await card.getAttribute("aria-pressed")) === "true",
    "Flashcard flips and exposes answer state",
  );
  await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
  await page.getByRole("tab", { name: "Flashcards", exact: true }).click();
  check(
    (await card.getAttribute("aria-pressed")) === "true",
    "Flashcard state survives study tab changes",
  );
  await page.getByRole("button", { name: "Thêm thẻ", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Câu hỏi / mặt trước", exact: true })
    .fill("QA: x² + y²");
  await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
  await page.getByRole("tab", { name: "Flashcards", exact: true }).click();
  check(
    (await page
      .getByRole("textbox", { name: "Câu hỏi / mặt trước", exact: true })
      .inputValue()) === "QA: x² + y²",
    "Card editor draft survives a tab change",
  );
  await page.getByRole("tab", { name: "Luyện tập", exact: true }).click();
  await page
    .getByRole("button", { name: "Bắt đầu luyện tập", exact: true })
    .click();
  await page.locator(".lm-question").focus();
  await page.keyboard.press("2");
  await page.locator(".lsv-quiz-feedback").waitFor();
  check(
    (await page.locator(".lsv-quiz-feedback.is-learning").count()) === 1,
    "Wrong answer has explicit feedback and correct option",
  );
  check(
    (await page.locator(".lm-study progress").getAttribute("value")) === "1",
    "Quiz progress counts a submitted answer",
  );
  await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
  await page.getByRole("tab", { name: "Luyện tập", exact: true }).click();
  check(
    (await page.locator(".lsv-quiz-feedback.is-learning").count()) === 1,
    "Active quiz survives a study tab change",
  );
  await page.getByRole("button", { name: "Kết quả", exact: true }).click();
  check(
    (await page.locator(".lsv-quiz-result").innerText()).includes("0%"),
    "Result ring reports the actual incorrect score",
  );
  check(
    (await page.locator(".lsv-answer-review[open]").count()) === 1,
    "Incorrect result opens answer review",
  );
  await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
  await page.getByRole("tab", { name: "Luyện tập", exact: true }).click();
  check(
    (await page.locator(".lsv-quiz-result").count()) === 1,
    "Completed result survives a tab change",
  );
  await screenshot("qa-premium-quiz.png");
  await navigate("cai dat");
  const motion = page.locator(".lm-motion-setting select");
  await motion.selectOption("off");
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "off",
  );
  await page.reload();
  await page.getByRole("button", { name: "Tìm nhanh", exact: true }).waitFor();
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "off",
  );
  check(true, "Motion off persists across reload");
  await navigate("cai dat");
  check(
    (await motion.inputValue()) === "off",
    "Motion control shows saved preference",
  );
  await motion.selectOption("subtle");
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "subtle",
  );
  await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".lc-command-panel")).opacity ===
      "1",
  );
  check(
    await page
      .locator(".lc-command-panel")
      .evaluate((e) => getComputedStyle(e).transform === "none"),
    "Subtle palette fades without travel",
  );
  await page.keyboard.press("Escape");
  await motion.selectOption("full");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "off",
  );
  check(
    (await motion.inputValue()) === "full",
    "OS reduced motion overrides without deleting chosen preference",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "full",
  );
  check(true, "Restoring OS preference restores full mode");
  await navigate("hoc cach hoc");
  await page.locator(".lsv-reader-tools summary").click();
  check(
    (await page
      .getByRole("button", { name: "Cỡ chữ: 20px", exact: true })
      .getAttribute("aria-pressed")) === "true",
    "Reading comfort restores after reload",
  );
  await page.getByRole("tab", { name: "Flashcards", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await card.click();
  check(
    await page
      .locator(".lsv-flip-inner")
      .evaluate((e) => getComputedStyle(e).transform === "none"),
    "Reduced motion disables 3D rotation while answer remains usable",
  );
  await page.setViewportSize({ width: 375, height: 812 });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Study fits a 375px phone without horizontal overflow",
  );
  await screenshot("qa-premium-study-mobile.png");
  await navigate("tong quan");
  await page.locator(".dv-dashboard").waitFor();
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Dashboard fits a 375px phone without overflow",
  );
  await screenshot("qa-premium-mobile.png");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await navigate("cai dat");
  await page.getByLabel(/^Giao diện/).selectOption("dark");
  await navigate("tong quan");
  await screenshot("qa-premium-dark.png");
  check(
    await page.evaluate(
      () => document.documentElement.dataset.theme === "dark",
    ),
    "Dark dashboard follows the saved theme",
  );
  check(paidRequests.length === 0, "UI QA made no paid AI or voice requests");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "lumio-motion-v3")
        throw new DOMException("QA storage unavailable", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.reload();
  await page.getByRole("button", { name: "Tìm nhanh", exact: true }).waitFor();
  await navigate("cai dat");
  await motion.selectOption("subtle");
  await page.waitForFunction(
    () => document.documentElement.dataset.motion === "subtle",
  );
  check(
    (await page.locator("#lm-motion-hint").innerText()).includes("lần mở này"),
    "Unavailable storage keeps motion usable and reports session-only setting",
  );
  check(
    errors.length === 0,
    `No runtime or hydration errors (${errors.length})`,
  );
  return {
    status: "PASS",
    checks: passed.length,
    passed,
    errors,
    screenshots: [
      "qa-premium-desktop.png",
      "qa-premium-quiz.png",
      "qa-premium-study-mobile.png",
      "qa-premium-mobile.png",
      "qa-premium-dark.png",
    ],
  };
}
