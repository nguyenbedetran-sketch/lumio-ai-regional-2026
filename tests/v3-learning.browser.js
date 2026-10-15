// Isolated synthetic evidence. No real students, account writes, provider calls or payments.
async function lumioV3LearningQA(page) {
  const passed = [],
    errors = [],
    mutations = [],
    external = [];
  let account = "qa-v3-skill-synthetic";
  const check = (value, label) => {
    if (!value) throw Error(label);
    passed.push(label);
  };
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", async (route) => {
    const q = route.request(),
      url = q.url();
    if (!/^https?:/.test(url)) return route.continue();
    if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
      external.push(url.match(/^https?:\/\/[^/]+/)[0]);
      return route.abort();
    }
    const pathname = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (pathname.startsWith("/api/") && q.method() !== "GET") {
      mutations.push(pathname);
      return route.fulfill({
        status: 409,
        json: { error: "SYNTHETIC_QA_NO_MUTATIONS" },
      });
    }
    return route.continue();
  });
  await page.route("**/api/config", (r) =>
    r.fulfill({
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
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({
      json: {
        user: { name: "Synthetic V3 skills QA" },
        accountKey: account,
        expires: "2099-01-01T00:00:00.000Z",
      },
    }),
  );
  await page.route("**/api/account", (r) =>
    r.fulfill({
      json: {
        authenticated: true,
        id: account,
        name: "Synthetic V3 skills QA",
        isAdmin: false,
        identities: [],
        providers: { google: true, facebook: false },
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
    const now = Date.now(),
      DAY = 86400000,
      at = new Date(now).toISOString();
    const base = {
      kind: "text",
      spaceId: "",
      createdAt: at,
      updatedAt: at,
      text: "DỮ LIỆU KIỂM THỬ UI TỔNG HỢP — KHÔNG PHẢI KẾT QUẢ HỌC SINH. Minh chứng giao diện hồ sơ kỹ năng và bất định.",
      notes: "",
      cards: [],
      questions: [],
      attempts: [],
      favorite: false,
    };
    let id = 0;
    function attempt(skill, total, correct, age, level) {
      const seq = ++id;
      const answers = Array.from({ length: total }, (_, i) => ({
        questionId: `q-${seq}-${i}`,
        selected: i < correct ? 0 : 1,
        correct: i < correct,
        topic: skill,
      }));
      return {
        date: new Date(now - age * DAY).toISOString(),
        score: correct,
        total,
        answers,
        skillEvidence: {
          version: 1,
          attemptId: `fixture-attempt-${seq}`,
          taxonomyVersion: "lumio-math-foundations-1",
          answers: answers.map((a, i) => ({
            ...a,
            fingerprint: `q1:100:${seq.toString(16)}:${i.toString(16)}`,
            skillId: skill,
            skillOrigin: "learner-selected",
            difficulty: level,
            difficultyOrigin: "declared",
            exposure: "first-choice",
          })),
        },
      };
    }
    const data = {
      version: 1,
      spaces: [],
      items: [
        {
          ...base,
          id: "qa-linear",
          title: "KIỂM THỬ UI · Phương trình bậc nhất",
          questions: [
            {
              id: "match",
              prompt: "2x = 8",
              options: ["4", "2", "6", "8"],
              correct: 0,
              explanation: "Chia hai vế cho 2.",
              topic: "Phương trình bậc nhất",
              difficulty: "beginner",
            },
          ],
          attempts: [
            attempt("linear", 3, 3, 8, "beginner"),
            attempt("linear", 3, 3, 4, "intermediate"),
            attempt("linear", 2, 2, 0, "intermediate"),
          ],
        },
        {
          ...base,
          id: "qa-roots",
          title: "KIỂM THỬ UI · Một câu đúng",
          attempts: [attempt("roots", 1, 1, 0, "beginner")],
        },
        {
          ...base,
          id: "qa-product",
          title: "KIỂM THỬ UI · Hai câu cần ôn",
          attempts: [attempt("product", 2, 0, 0, "beginner")],
        },
        {
          ...base,
          id: "qa-legacy",
          title: "KIỂM THỬ UI · Lịch sử cũ",
          attempts: [{ date: at, score: 2, total: 2 }],
        },
        {
          ...base,
          id: "qa-manual",
          title: "KIỂM THỬ UI · Quiz manual mới",
          questions: [
            {
              id: "manual-new",
              prompt: "Phân tích 2x + 4 thành nhân tử",
              options: ["2(x + 2)", "2(x + 4)", "x(x + 4)", "4(x + 2)"],
              correct: 0,
              explanation: "Đặt nhân tử chung 2.",
            },
          ],
        },
      ],
    };
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
        tx.onerror = () => reject(tx.error);
      };
    });
  }, account);
  const library = () =>
    page.evaluate(
      (account) =>
        new Promise((resolve, reject) => {
          const r = indexedDB.open("lumio-local-library-v2", 2);
          r.onsuccess = () => {
            const db = r.result,
              q = db
                .transaction("libraries")
                .objectStore("libraries")
                .get(account);
            q.onsuccess = () => {
              db.close();
              resolve(q.result);
            };
            q.onerror = () => reject(q.error);
          };
          r.onerror = () => reject(r.error);
        }),
      account,
    );
  const personal = async () => {
    await page
      .getByRole("button", { name: "Đề xuất cho bạn", exact: true })
      .click();
    await page.locator("[data-skill-evidence]").waitFor();
  };
  const panel = page.locator("[data-skill-evidence]"),
    detail = page.locator("[data-skill-detail]");
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page
    .locator(".lm-profile")
    .filter({ hasText: "Synthetic V3 skills QA" })
    .waitFor();
  await personal();
  check(
    (await panel.locator(".lski-node").count()) === 7,
    "Seven explicit skills, no generated curriculum",
  );
  check(
    (
      await panel.locator(".lski-suggestions article").first().textContent()
    ).includes("2 câu sai khác nhau"),
    "Adaptive next step cites two actual distinct errors rather than likes",
  );
  check(
    (
      await panel.locator(".lski-suggestions article").first().textContent()
    ).includes("KIỂM THỬ UI · Hai câu cần ôn"),
    "Adaptive next step links a real matching local material",
  );
  check(
    (await detail.locator(".lski-status").textContent()).trim() ===
      "Kết quả ổn định hơn",
    "Eight unique spaced first choices show only provisional consistency",
  );
  check(
    (await detail.locator(".lski-stats").textContent()).includes("8/8"),
    "Observed count is eight of eight, not a model diagnosis",
  );
  check(
    (await detail.locator(".lski-stats div").nth(1).textContent()).includes(
      "3",
    ),
    "Three UTC practice days are visible",
  );
  check(
    (await detail.locator(".lski-stats div").nth(2).textContent()).includes(
      "8",
    ),
    "Spacing shows eight days rather than treating one session as mastery",
  );
  check(
    (await panel.textContent()).includes("2 đáp án cũ thiếu snapshot"),
    "Legacy answers are explicitly excluded from the new profile",
  );
  await detail.locator(".lski-method summary").click();
  check(
    (await detail.textContent()).includes("Không phải xác suất thành thạo"),
    "Uncertainty warns that a descriptive interval is not mastery probability",
  );
  await panel.locator(".lski-method").last().locator("summary").click();
  check(
    (await panel.textContent()).includes(
      "Ngưỡng thử nghiệm, chưa xác thực trên học sinh",
    ),
    "Unvalidated thresholds are visible, not marketed as educational proof",
  );
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "docs/v3/qa-skills-desktop.png",
    fullPage: true,
  });
  await panel
    .locator(".lski-map")
    .screenshot({ path: "docs/v3/qa-skills-map.png" });
  await detail.screenshot({ path: "docs/v3/qa-skills-evidence.png" });
  await panel.locator(".lski-node").filter({ hasText: "Căn bậc hai" }).click();
  check(
    (await detail.locator(".lski-status").textContent()).trim() ===
      "Chưa đủ bằng chứng",
    "One correct answer remains insufficient",
  );
  check(
    (await detail.locator(".lski-stats").textContent()).includes("1/1"),
    "Single-answer evidence preserves its exact denominator",
  );
  await panel
    .locator(".lski-node")
    .filter({ hasText: "Phương trình tích" })
    .click();
  check(
    (await detail.locator(".lski-status").textContent()).trim() ===
      "Nên ôn thêm",
    "Two observed recent errors lead to an explained review signal",
  );
  check(
    (await detail.locator(".lski-foundations button").count()) === 2,
    "Prerequisites come only from the declared graph",
  );
  await detail
    .locator(".lski-foundations button")
    .filter({ hasText: "Phân tích thành nhân tử" })
    .click();
  check(
    (await detail.locator("h3").textContent()).trim() ===
      "Phân tích thành nhân tử",
    "Prerequisite buttons actually select their evidence node",
  );
  check(
    (await detail.textContent()).includes("Chưa có học liệu khớp"),
    "Unknown matching resources are not invented",
  );
  await panel.locator(".lski-controls input").uncheck();
  check(
    (await panel.locator(".lski-map").count()) === 0,
    "Disabling skills removes all computed profile and graph data",
  );
  check(
    (await panel.locator(".lski-suggestions").count()) === 0,
    "Skill opt-out also removes adaptive next-step recommendations",
  );
  await page.reload();
  await personal();
  check(
    !(await panel.locator(".lski-controls input").isChecked()),
    "Skill opt-out persists in the account namespace",
  );
  await panel.locator(".lski-controls input").check();
  await page.locator(".lm-personal-controls input").uncheck();
  check(
    (await panel.locator(".lski-map").count()) === 0,
    "Global personalisation opt-out overrides the skill setting",
  );
  await page.locator(".lm-personal-controls input").check();
  await page
    .locator(".lm-personal-card")
    .filter({ hasText: "KIỂM THỬ UI · Quiz manual mới" })
    .getByRole("button", { name: "Học tiếp", exact: true })
    .click();
  await page.getByRole("tab", { name: "Luyện tập", exact: true }).click();
  await page.locator(".lski-quiz-scope select").nth(0).selectOption("factor");
  await page.locator(".lski-quiz-scope select").nth(1).selectOption("advanced");
  await page
    .getByRole("button", { name: "Bắt đầu luyện tập", exact: true })
    .click();
  await page.locator(".lm-answers button").first().click();
  await page
    .locator(".lsv-quiz")
    .getByRole("button", { name: "Kết quả", exact: true })
    .click();
  await page.locator(".lsv-quiz-result").waitFor();
  await page.waitForFunction(
    async (account) =>
      new Promise((resolve) => {
        const r = indexedDB.open("lumio-local-library-v2", 2);
        r.onsuccess = () => {
          const db = r.result,
            q = db
              .transaction("libraries")
              .objectStore("libraries")
              .get(account);
          q.onsuccess = () => {
            db.close();
            resolve(
              q.result?.items.find((i) => i.id === "qa-manual")?.attempts
                .length === 1,
            );
          };
          q.onerror = () => resolve(false);
        };
        r.onerror = () => resolve(false);
      }),
    account,
  );
  let saved = await library();
  const a = saved.items.find((i) => i.id === "qa-manual").attempts.at(-1);
  check(
    a?.skillEvidence?.answers[0]?.skillId === "factor" &&
      a.skillEvidence.answers[0].difficulty === "advanced",
    "Completing a real UI quiz writes the selected skill/difficulty snapshot",
  );
  check(
    a.skillEvidence.answers[0].skillOrigin === "learner-selected" &&
      a.skillEvidence.answers[0].exposure === "first-choice",
    "Snapshot distinguishes declared scope and first app choice from inferred ability",
  );
  await personal();
  await panel
    .locator(".lski-node")
    .filter({ hasText: "Phân tích thành nhân tử" })
    .click();
  check(
    (await detail.locator(".lski-stats").textContent()).includes("1/1"),
    "New UI practice contributes actual observed evidence",
  );
  check(
    (await detail.locator(".lski-status").textContent()).trim() ===
      "Chưa đủ bằng chứng",
    "New quiz completion still cannot establish mastery",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.scrollIntoViewIfNeeded();
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Skill map and detail do not overflow a 390px phone viewport",
  );
  await page.screenshot({
    path: "docs/v3/qa-skills-mobile.png",
    fullPage: true,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  check(
    (await panel
      .locator(".lski-detail")
      .evaluate((e) => getComputedStyle(e).animationName)) === "none",
    "Reduced motion disables the detail entrance animation",
  );
  await page.setViewportSize({ width: 1440, height: 1050 });
  await panel.locator(".lski-node").first().focus();
  await page.keyboard.press("Enter");
  check(
    (await detail.locator("h3").textContent()).trim() === "Phép tính phân số",
    "Keyboard activates a graph node with Enter",
  );
  await page.evaluate(() => {
    window.__originalSkillConfirm = window.confirm;
    window.confirm = () => true;
  });
  const clear = panel.getByRole("button", {
    name: "Xóa snapshot kỹ năng",
    exact: true,
  });
  check(
    await clear.isEnabled(),
    "Snapshot deletion is wired to the actual account library",
  );
  await clear.click();
  await page.waitForFunction(() =>
    document
      .querySelector(".lski-exclusions")
      ?.textContent.includes("đáp án cũ"),
  );
  await page.waitForFunction(
    async (account) =>
      new Promise((resolve) => {
        const r = indexedDB.open("lumio-local-library-v2", 2);
        r.onsuccess = () => {
          const db = r.result,
            q = db
              .transaction("libraries")
              .objectStore("libraries")
              .get(account);
          q.onsuccess = () => {
            db.close();
            resolve(
              q.result?.items.every((i) =>
                i.attempts.every((a) => !a.skillEvidence),
              ),
            );
          };
          q.onerror = () => resolve(false);
        };
        r.onerror = () => resolve(false);
      }),
    account,
  );
  saved = await library();
  check(
    saved.items.every((i) => i.attempts.every((a) => !a.skillEvidence)),
    "Deleting snapshots really removes persisted evidence",
  );
  check(
    saved.items.find((i) => i.id === "qa-manual").attempts.at(-1).score === 1,
    "Snapshot deletion preserves actual quiz grades",
  );
  await page.evaluate(() => {
    window.confirm = window.__originalSkillConfirm;
    delete window.__originalSkillConfirm;
  });
  account = "qa-v3-other-account";
  await page.reload();
  await personal();
  check(
    (await panel.locator(".lski-stats").textContent()).includes("0/0"),
    "Switching accounts cannot reveal the previous skill results",
  );
  check(
    await panel.locator(".lski-controls input").isChecked(),
    "A new account cannot inherit another account opt-out settings",
  );
  let syncReads = 0,
    syncAccount = "";
  await page.route("**/api/sync", (route) => {
    syncReads++;
    syncAccount = route.request().headers()["x-lumio-account"];
    return route.fulfill({ status: 401, json: { error: "SESSION_REVOKED" } });
  });
  await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
  const sync = page.locator("[data-sync-panel]");
  await sync.waitFor();
  check(
    !(await sync.locator("input[type=checkbox]").isChecked()) &&
      syncReads === 0,
    "Sync copy starts with explicit opt-in and no automatic snapshot request",
  );
  await sync.locator("input[type=checkbox]").check();
  await sync.getByRole("button", { name: "Đồng bộ ngay", exact: true }).click();
  await sync
    .getByRole("status")
    .filter({ hasText: "Tài khoản hoặc phiên đăng nhập đã thay đổi" })
    .waitFor();
  check(
    !(await sync.textContent()).includes("SESSION_REVOKED"),
    "Sync authentication error is readable and does not expose raw server codes",
  );
  check(
    syncAccount === account,
    "Sync request is bound to the current synthetic account header",
  );
  for (const [language, title] of [
    ["en", "Continue on another device"],
    ["zh-CN", "在另一台设备继续学习"],
    ["ja", "別の端末で学習を続ける"],
    ["ko", "다른 기기에서 계속 학습"],
    ["vi", "Tiếp tục học trên thiết bị khác"],
  ]) {
    await page.locator(".lm-language select").selectOption(language);
    check(
      (await sync.locator("h3").textContent()).trim() === title,
      `Sync consent and recovery UI follows ${language} language selection`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await sync.scrollIntoViewIfNeeded();
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Sync consent and error copy fit a 390px phone viewport",
  );
  await sync.screenshot({ path: "docs/v3/qa-sync-copy-mobile.png" });
  check(errors.length === 0, "No browser runtime errors");
  check(
    mutations.length === 0,
    "No server writes or paid AI requests in this synthetic UI proof",
  );
  return {
    status: "PASS",
    passed: passed.length,
    cases: passed,
    errors,
    serverMutations: mutations,
    externalOriginsBlocked: [...new Set(external)],
    fixture:
      "synthetic skill evidence; no students or educational efficacy claims",
    screenshots: [
      "docs/v3/qa-skills-desktop.png",
      "docs/v3/qa-skills-mobile.png",
      "docs/v3/qa-skills-map.png",
      "docs/v3/qa-skills-evidence.png",
      "docs/v3/qa-sync-copy-mobile.png",
    ],
  };
}
