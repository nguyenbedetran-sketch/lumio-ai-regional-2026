// Isolated synthetic UI evidence. No user browser, real students, paid AI or payment calls.
async function lumioRegionalLearningQA(page) {
  const passed = [],
    errors = [],
    paid = [],
    mutations = [],
    external = [];
  const check = (condition, label) => {
    if (!condition) throw new Error(label);
    passed.push(label);
  };
  let account = "qa-regional-learning-synthetic";
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = request.url();
    if (!/^https?:\/\//.test(url)) return route.continue();
    if (!/^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?\//.test(url)) {
      external.push(url.match(/^https?:\/\/[^/]+/)[0]);
      return route.abort();
    }
    const pathname = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (pathname.startsWith("/api/") && request.method() !== "GET") {
      mutations.push(pathname);
      return route.fulfill({ status: 409, json: { error: "QA_NO_MUTATIONS" } });
    }
    await route.continue();
  });
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        google: true,
        facebook: false,
        ai: false,
        capabilities: {
          tutor: false,
          summary: false,
          media: false,
          transcription: false,
          speech: false,
        },
      },
    }),
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: { name: "Synthetic regional QA" },
        accountKey: account,
        expires: "2099-01-01T00:00:00.000Z",
      },
    }),
  );
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        id: account,
        name: "Synthetic regional QA",
        isAdmin: false,
        identities: [],
        providers: { google: true, facebook: false },
      },
    }),
  );
  await page.route("**/api/ai", (route) => {
    paid.push("ai");
    return route.fulfill({ status: 409, json: { error: "QA_NO_AI" } });
  });
  await page.route("**/api/voice", (route) => {
    paid.push("voice");
    return route.fulfill({ status: 409, json: { error: "QA_NO_VOICE" } });
  });
  const catalog = {
    plans: ["free", "plus", "premium", "pro"].map((id) => ({
      id,
      name: id[0].toUpperCase() + id.slice(1),
      monthlyPriceMinor: null,
      yearlyPriceMinor: null,
      credits: id === "free" ? 200 : null,
      creditsPeriod: id === "free" ? "once" : "month",
      entitlements: {
        modes: ["quick", "tutor", "think", "deep"],
        kinds: ["text", "image", "pdf", "audio", "video"],
        voice: id !== "free",
        maxVideoSeconds: 600,
      },
      checkoutAvailable: false,
    })),
    packs: ["pack_small", "pack_medium", "pack_large"].map((id) => ({
      id,
      name: id,
      priceMinor: null,
      credits: null,
      checkoutAvailable: false,
    })),
    trialCredits: 200,
    rates: {
      tasks: {
        chat: 2,
        summary: 8,
        cards: 6,
        quiz: 8,
        speech: 8,
        transcription: 12,
      },
      modes: { quick: 0, tutor: 2, think: 6, deep: 18 },
      kinds: { text: 0, image: 4, pdf: 8, audio: 12, video: 0 },
      videoPerMinute: 10,
    },
  };
  await page.route("**/api/billing**", (route) =>
    route.fulfill({
      json: {
        catalog,
        account: {
          userId: account,
          planId: "free",
          planName: "Free",
          planSource: "trial",
          balance: 200,
          reserved: 0,
          periodEnd: null,
          cancelAtPeriodEnd: false,
          nextPlanId: null,
        },
        history: [],
        sandbox: false,
      },
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem("lumio-language", "vi");
    localStorage.setItem("lumio-theme", "light");
    localStorage.setItem("lumio-motion-v3", "off");
  });
  await page.goto("http://localhost:3000/");
  await page.evaluate(async (account) => {
    const now = new Date().toISOString();
    const base = {
      kind: "text",
      spaceId: "",
      createdAt: now,
      updatedAt: now,
      text: "Học liệu mẫu chỉ dùng để kiểm tra giao diện, không phải dữ liệu học sinh.",
      notes: "",
      cards: [],
      questions: [],
      attempts: [],
      favorite: false,
    };
    const math = {
      ...base,
      id: "qa-math",
      title: "Phương trình bậc nhất · Minh chứng UI",
      questions: [
        {
          id: "q1",
          prompt: "2x + 3 = 11",
          options: ["x=4", "x=3", "x=5", "x=2"],
          correct: 0,
          explanation: "2x=8 nên x=4.",
          topic: "Phương trình",
          difficulty: "beginner",
        },
        {
          id: "q2",
          prompt: "3x - 4 = 8",
          options: ["x=4", "x=3", "x=5", "x=2"],
          correct: 0,
          explanation: "3x=12 nên x=4.",
          topic: "Phương trình",
          difficulty: "beginner",
        },
      ],
      attempts: [
        {
          date: now,
          score: 1,
          total: 2,
          answers: [
            {
              questionId: "q1",
              selected: 1,
              correct: false,
              topic: "Phương trình",
            },
            {
              questionId: "q2",
              selected: 0,
              correct: true,
              topic: "Phương trình",
            },
          ],
        },
      ],
    };
    const data = {
      version: 1,
      spaces: [],
      items: [
        math,
        {
          ...base,
          id: "qa-bio",
          title: "Sinh học thực vật · Minh chứng UI",
          kind: "pdf",
        },
        {
          ...base,
          id: "qa-motion",
          title: "Chuyển động đều · Minh chứng UI",
          kind: "audio",
        },
        {
          ...base,
          id: "qa-geometry",
          title: "Diện tích tam giác · Minh chứng UI",
        },
      ],
    };
    localStorage.setItem(
      `lumio-learning-v1:${encodeURIComponent(account)}`,
      JSON.stringify({
        version: 1,
        tasks: [],
        reviews: [],
        events: [
          { id: "qa-quiz-event", at: now, kind: "quiz", itemId: "qa-math" },
        ],
        focus: null,
      }),
    );
    localStorage.setItem(
      `lumio-personalization-v1:${encodeURIComponent(account)}`,
      JSON.stringify({ version: 1, enabled: true, feedback: [] }),
    );
    await new Promise((resolve, reject) => {
      const req = indexedDB.open("lumio-local-library-v2", 2);
      req.onupgradeneeded = () => {
        for (const s of ["libraries", "revisions"])
          if (!req.result.objectStoreNames.contains(s))
            req.result.createObjectStore(s);
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result,
          tx = db.transaction(["libraries", "revisions"], "readwrite");
        tx.objectStore("libraries").put(data, account);
        tx.objectStore("revisions").put(1, account);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }, account);
  const prefs = () =>
    page.evaluate(
      (account) =>
        JSON.parse(
          localStorage.getItem(
            `lumio-personalization-v1:${encodeURIComponent(account)}`,
          ),
        ),
      account,
    );
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page
    .locator(".lm-profile")
    .filter({ hasText: "Synthetic regional QA" })
    .waitFor();
  await page
    .getByRole("button", { name: "Đề xuất cho bạn", exact: true })
    .click();
  await page.locator(".lm-personal-settings").waitFor();
  check(
    (await page.locator(".lm-personal-card").count()) === 4,
    "Recommendations use exactly four synthetic local materials",
  );
  const math = page
    .locator(".lm-personal-card")
    .filter({ hasText: "Phương trình bậc nhất · Minh chứng UI" });
  await math.locator(".lm-personal-evidence summary").click();
  check(
    (await math.locator(".lm-personal-evidence").textContent()).includes("1/2"),
    "Visible quiz evidence shows one of two correct, not invented mastery",
  );
  check(
    (await math.locator(".lm-personal-evidence").textContent()).includes(
      "Phương trình: 1 câu sai trên 2",
    ),
    "Observed wrong-topic count is visible with denominator",
  );
  check(
    (await page
      .locator(".lm-personal-card")
      .filter({ hasText: "Sinh học thực vật" })
      .locator(".lm-personal-outcome button:disabled")
      .count()) === 2,
    "Unstudied material cannot get an after-study helpfulness rating",
  );
  await page.locator("input[name=topics]").fill("Phương trình");
  await page.locator("select[name=difficulty]").selectOption("beginner");
  await page.locator("select[name=goal]").selectOption("practice");
  await page
    .getByRole("button", { name: "Áp dụng tùy chọn", exact: true })
    .click();
  let saved = await prefs();
  check(
    saved.controls.topics[0] === "Phương trình" &&
      saved.controls.difficulty === "beginner" &&
      saved.controls.goal === "practice",
    "Topic, difficulty and goal are really persisted in the account namespace",
  );
  await math.getByRole("button", { name: "Hợp với tôi", exact: true }).click();
  await math.getByRole("button", { name: "Đã giúp tôi", exact: true }).click();
  saved = await prefs();
  check(
    saved.feedback.length === 1 &&
      saved.outcomes.length === 1 &&
      saved.outcomes[0].useful === true,
    "Preference labels and after-study self-reports remain separate records",
  );
  check(
    (
      await page.locator("[data-recommendation-evaluations]").textContent()
    ).includes("1 học liệu đã đánh giá sau học"),
    "Post-study evaluation summary uses actual submitted count",
  );
  await page.screenshot({
    path: "docs/regional/qa-personalization-evidence.png",
    fullPage: true,
  });
  const toggle = page.locator(".lm-personal-controls input[type=checkbox]");
  await toggle.uncheck();
  check(
    await page.locator(".lm-personal-settings input").isDisabled(),
    "Turning personalization off disables preference controls",
  );
  check(
    await math
      .getByRole("button", { name: "Hợp với tôi", exact: true })
      .isDisabled(),
    "Turning personalization off disables rating collection",
  );
  check(
    (await prefs()).enabled === false,
    "Personalization off is saved, not a decorative toggle",
  );
  await toggle.check();
  await page.locator("input[name=topics]").fill("a,A");
  await page
    .getByRole("button", { name: "Áp dụng tùy chọn", exact: true })
    .click();
  check(
    (await prefs()).controls.topics[0] === "Phương trình",
    "Duplicate topic input cannot overwrite valid saved controls",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Đề xuất cho bạn", exact: true })
    .click();
  check(
    (await page.locator("input[name=topics]").inputValue()) === "Phương trình",
    "Topic preference survives a real reload",
  );
  // Native dialogs make the CLI's modal-state race return before a long suite
  // finishes. Accept this one synthetic-data confirmation inside the QA page.
  await page.evaluate(() => {
    window.__qaOriginalConfirm = window.confirm;
    window.confirm = () => true;
  });
  await page
    .getByRole("button", { name: "Xóa phản hồi đã lưu", exact: true })
    .click();
  await page.evaluate(() => {
    window.confirm = window.__qaOriginalConfirm;
    delete window.__qaOriginalConfirm;
  });
  saved = await prefs();
  check(
    saved.feedback.length === 0 && saved.outcomes.length === 0,
    "Explicit reset actually deletes preference and usefulness ratings",
  );
  check(
    saved.controls.topics[0] === "Phương trình",
    "Feedback reset preserves user controls and library data",
  );
  for (const width of [325, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Personalization has no horizontal overflow at ${width}px`,
    );
  }
  await page.setViewportSize({ width: 375, height: 950 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "docs/regional/qa-personalization-mobile.png",
    fullPage: true,
  });
  const language = page.locator(".lm-language select");
  for (const locale of ["en", "zh-CN", "ja", "ko", "vi"]) {
    await language.selectOption(locale);
    check(
      (await page.locator(".lm-personal-settings h2").textContent()).trim()
        .length > 0,
      `Recommendation controls render in ${locale}`,
    );
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Recommendation controls fit mobile in ${locale}`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole("button", { name: "Gói & credit", exact: true }).click();
  await page.locator(".lm-plan-price").first().waitFor();
  check(
    (await page.locator(".lm-plan").count()) === 4,
    "Four proposed plans render from the existing catalog",
  );
  check(
    (await page.locator("[data-pricing-preview]").textContent()).includes(
      "không thu tiền",
    ),
    "Pricing clearly states no payment, auto grant or renewal",
  );
  check(
    (
      await page
        .locator(".lm-plan")
        .filter({ hasText: "Plus" })
        .locator(".lm-plan-price")
        .textContent()
    ).includes("59.000"),
    "Plus proposed monthly price displays 59,000 VND",
  );
  await page.getByRole("button", { name: "Theo năm", exact: true }).click();
  check(
    (
      await page
        .locator(".lm-plan")
        .filter({ hasText: "Plus" })
        .locator(".lm-plan-price")
        .textContent()
    ).includes("590.000"),
    "Annual proposal correctly displays ten monthly payments",
  );
  check(
    (
      await page.locator(".lm-plan").filter({ hasText: "Free" }).textContent()
    ).includes("200 credit dùng thử một lần"),
    "Free allocation is one-time, not a monthly giveaway",
  );
  await page.getByRole("button", { name: "Theo tháng", exact: true }).click();
  await page.screenshot({
    path: "docs/regional/qa-pricing-preview.png",
    fullPage: true,
  });
  await page
    .locator(".lm-plan")
    .filter({ hasText: "Plus" })
    .getByRole("button", { name: "Xem gói" })
    .click();
  const dialog = page.getByRole("dialog");
  check(
    await dialog
      .getByRole("button", { name: "Chưa mở thanh toán", exact: true })
      .isDisabled(),
    "Checkout is actually disabled, not a simulated payment success",
  );
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  check(
    mutations.length === 0,
    "Viewing prices, switching billing interval and comparing plans creates no server mutation",
  );
  await page.setViewportSize({ width: 375, height: 950 });
  await page.evaluate(() => window.scrollTo(0, 0));
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Pricing preview fits mobile without horizontal overflow",
  );
  await page.screenshot({
    path: "docs/regional/qa-pricing-mobile.png",
    fullPage: true,
  });
  await page.goto("http://localhost:3000/privacy");
  await page
    .getByRole("heading", { name: "Phạm vi bản dự thi", exact: true })
    .waitFor();
  check(
    (await page.locator("article").textContent()).includes(
      "OpenAI, Google Gemini hoặc xAI",
    ),
    "Privacy identifies actual external processors separately from the product UI",
  );
  check(
    (await page.locator("article").textContent()).includes("Render miễn phí"),
    "Privacy explains ephemeral competition hosting data limits",
  );
  check(
    (await page.locator("article").textContent()).includes(
      "chưa có lịch dọn nền",
    ),
    "Privacy distinguishes tutor expiry from cleanup-on-access",
  );
  await page.screenshot({
    path: "docs/regional/qa-privacy-mobile.png",
    fullPage: true,
  });
  check(
    paid.length === 0,
    "No AI or voice provider requests were made during this suite",
  );
  check(
    errors.length === 0,
    "No browser runtime errors in recommendation, pricing and privacy flows",
  );
  return {
    status: "PASS",
    checks: passed.length,
    passed,
    errors,
    paidProviderRequests: 0,
    serverMutations: mutations,
    externalOriginsBlocked: [...new Set(external)],
    data: "Explicit synthetic QA fixtures; no real students, learning outcomes or payment transactions",
    screenshots: [
      "docs/regional/qa-personalization-evidence.png",
      "docs/regional/qa-personalization-mobile.png",
      "docs/regional/qa-pricing-preview.png",
      "docs/regional/qa-pricing-mobile.png",
      "docs/regional/qa-privacy-mobile.png",
    ],
  };
}
