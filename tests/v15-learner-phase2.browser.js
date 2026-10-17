async (page) => {
  const passed = [],
    errors = [],
    external = [],
    mutations = [],
    folder = "docs/next/reports/learner-phase2-browser/";
  const check = (ok, label) => {
    if (!ok) throw Error(label);
    passed.push(label);
  };
  const learningKey = "lumio-learning-v1:guest",
    preferenceKey = "lumio-personalization-v1:guest";
  const basic = (id) => ({
    id,
    title: id,
    kind: "text",
    text: "A synthetic local source.",
    notes: "",
    spaceId: "",
    cards: [],
    questions: [],
    attempts: [],
    favorite: false,
    createdAt: "2026-10-17T00:00:00Z",
    updatedAt: "2026-10-17T00:00:00Z",
  });
  const material = {
    ...basic("SYNTHETIC Algebra practice"),
    cards: [
      { id: "card", front: "Bản đồ ánh sáng", back: "A synthetic card answer" },
    ],
    questions: [
      {
        id: "q",
        prompt: "Tam giác vuông: synthetic practice question",
        options: ["A", "B", "C", "D"],
        correct: 0,
        explanation: "Synthetic explanation",
        topic: "Đại số",
        difficulty: "beginner",
      },
    ],
  };
  const task = {
    id: "dated-task",
    title: "Ôn tập vận tốc",
    date: "2026-10-21",
    minutes: 20,
    itemId: "",
    done: false,
    createdAt: "2026-10-17T00:00:00Z",
  };
  try {
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (r) => {
      const url = r.request().url();
      if (!url.startsWith("http://localhost:3000/")) {
        external.push(url);
        return r.abort();
      }
      if (r.request().method() !== "GET") mutations.push(url);
      return r.fulfill({
        status: 403,
        json: { error: "SYNTHETIC_UI_UNAVAILABLE" },
      });
    });
    for (const [url, file, contentType] of [
      ["**/__v15-learner-phase2-ui", "fixture.html", "text/html"],
      ["**/__v7-learner-ui.js", "fixture.js", "text/javascript"],
      ["**/__v7-learner-ui.css", "fixture.css", "text/css"],
    ])
      await page.route(url, (r) =>
        r.fulfill({ path: "work/v15-learner-phase2-ui/" + file, contentType }),
      );
    await page.route("**/brand/lumio-logo.png", (r) =>
      r.fulfill({
        path: "public/brand/lumio-logo.png",
        contentType: "image/png",
      }),
    );
    await page.route("**/fonts/KaTeX*", (r) => {
      const m = /(KaTeX_[A-Za-z0-9-]+\.(?:woff2?|ttf))$/.exec(
        r.request().url(),
      );
      return m
        ? r.fulfill({
            path: "node_modules/katex/dist/fonts/" + m[1],
            contentType: "font/woff2",
          })
        : r.abort();
    });
    await page.route("**/api/config", (r) =>
      r.fulfill({ json: { google: false, facebook: false, ai: false } }),
    );
    await page.route("**/api/account", (r) =>
      r.fulfill({
        json: {
          authenticated: false,
          identities: [],
          providers: { google: false, facebook: false },
        },
      }),
    );
    await page.route("**/api/rag/documents**", (r) =>
      r.fulfill({ json: { documents: [] } }),
    );
    await page.addInitScript(() => {
      localStorage.setItem("lumio-language", "en");
      localStorage.setItem("lumio-theme", "light");
      localStorage.setItem("lumio-motion-v3", "off");
    });
    await page.goto("http://localhost:3000/__v15-learner-phase2-ui");
    await page.locator("#lumio-navigation").waitFor();
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.evaluate(
      async ({ material, basic, task, learningKey, preferenceKey }) => {
        await new Promise((resolve, reject) => {
          const req = indexedDB.open("lumio-local-library-v2", 2);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result,
              tx = db.transaction(["libraries", "revisions"], "readwrite");
            tx.objectStore("libraries").put(
              { version: 1, spaces: [], items: [basic, material] },
              "guest",
            );
            tx.objectStore("revisions").put(1, "guest");
            tx.objectStore("libraries").put(
              {
                version: 1,
                spaces: [],
                items: [
                  {
                    ...basic,
                    id: "other-account",
                    title: "OTHER ACCOUNT PRIVATE 83999",
                  },
                ],
              },
              "different-account",
            );
            tx.objectStore("revisions").put(1, "different-account");
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onabort = tx.onerror = () => {
              db.close();
              reject(tx.error);
            };
          };
        });
        localStorage.setItem(
          learningKey,
          JSON.stringify({
            version: 1,
            tasks: [task],
            reviews: [],
            events: [],
            focus: null,
          }),
        );
        localStorage.setItem(
          preferenceKey,
          JSON.stringify({ version: 1, enabled: true, feedback: [] }),
        );
        window.__mountLearner(null);
      },
      {
        material,
        basic: basic("SYNTHETIC Biology reading"),
        task,
        learningKey,
        preferenceKey,
      },
    );
    const setup = page.locator("[data-study-setup]"),
      form = setup.locator("[data-study-preferences]");
    await form.waitFor();
    check(
      (await setup.getAttribute("open")) !== null,
      "Unconfigured local workspace offers optional inline goal setup",
    );
    const beforeLearning = await page.evaluate(
      (key) => localStorage.getItem(key),
      learningKey,
    );
    await setup.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    check(
      (await setup.getAttribute("open")) === null,
      "Keyboard can dismiss setup without a forced wizard",
    );
    await page.keyboard.press("Enter");
    await form.waitFor();
    await form
      .getByRole("combobox", { name: "Your current goal", exact: true })
      .selectOption("practice");
    await form
      .getByRole("combobox", { name: "Preferred quiz level", exact: true })
      .selectOption("beginner");
    await form
      .getByRole("textbox", { name: /^Topics \(separate with commas\)/ })
      .fill("dai so");
    await form
      .getByRole("button", { name: "Apply preferences", exact: true })
      .click();
    await form
      .getByRole("status")
      .filter({ hasText: "Preferences applied" })
      .waitFor();
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      preferenceKey,
    );
    check(
      stored.controls.goal === "practice" &&
        stored.controls.difficulty === "beginner" &&
        stored.controls.topics[0] === "dai so",
      "Goal/topic/declared level actually persist via the existing preference store",
    );
    check(
      (await page.evaluate((key) => localStorage.getItem(key), learningKey)) ===
        beforeLearning,
      "Goal setup creates no fake activity, quiz score or completed study goal",
    );
    check(
      (await page.locator("[data-plan-primary] h3").innerText()) ===
        material.title,
      "Stated goal chooses an actual matching practice material as next step",
    );
    check(
      (await page.locator("[data-plan-primary]").innerText()).includes(
        "Matches the study goal",
      ),
      "Next-step reason identifies learner choice rather than inferred mastery",
    );
    await page.screenshot({ path: folder + "setup-desktop.png" });
    await page.evaluate(() => window.__mountLearner(null));
    await setup.waitFor();
    check(
      (await setup.getAttribute("open")) === null,
      "Saved setup stays collapsed on a fresh workspace mount",
    );
    await setup.locator(":scope > summary").click();
    check(
      (await form
        .getByRole("combobox", { name: "Your current goal", exact: true })
        .inputValue()) === "practice",
      "Saved preferences reappear on reopening setup",
    );
    await setup.locator(":scope > summary").click();
    await page.keyboard.press("Control+k");
    const palette = page.locator("dialog.lc-command-dialog[open]");
    await palette.waitFor();
    check(
      await palette
        .getByRole("combobox")
        .evaluate((el) => el === document.activeElement),
      "Existing Ctrl K palette receives keyboard focus",
    );
    await palette.getByRole("combobox").fill("tam giac vuong");
    await palette
      .getByRole("option")
      .filter({ hasText: material.title })
      .waitFor();
    check(
      (await palette.getByRole("option").count()) === 1,
      "Global local search finds saved quiz text outside title/source/notes",
    );
    check(
      (await palette.getByRole("option").innerText()).includes(
        "Saved cards, questions or summaries",
      ),
      "Search result labels the matching saved study content",
    );
    await page.keyboard.press("Enter");
    await page.locator(".lm-document-title input").waitFor();
    check(
      (await page.locator(".lm-document-title input").inputValue()) ===
        material.title,
      "Selecting a study-text result opens the real owned material",
    );
    await page.keyboard.press("Control+k");
    await palette.waitFor();
    await palette.getByRole("combobox").fill("on tap van toc");
    await palette.getByRole("option").filter({ hasText: task.title }).waitFor();
    check(
      (await palette.getByRole("option").innerText()).includes("2026-10-21"),
      "Accent-insensitive study-goal search shows the real planned date",
    );
    await page.setViewportSize({ width: 390, height: 1000 });
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Extended command palette fits a 390px phone viewport",
    );
    await page.screenshot({ path: folder + "search-phone.png" });
    await page.keyboard.press("Enter");
    await page.locator('[data-task-id="dated-task"]').waitFor();
    check(
      await page
        .locator('[data-task-id="dated-task"]')
        .evaluate((el) => el === document.activeElement),
      "Selecting a goal opens and focuses its actual Planner entry",
    );
    await page.keyboard.press("Control+k");
    await palette.waitFor();
    await palette.getByRole("combobox").fill("OTHER ACCOUNT PRIVATE 83999");
    check(
      (await palette.getByRole("option").count()) === 0,
      "Search excludes a different account's stored IndexedDB library",
    );
    await palette.locator(".lc-command-scope summary").click();
    check(
      (await palette.locator(".lc-command-scope").innerText()).includes(
        "server classrooms are not searched",
      ),
      "Search scope explicitly excludes server classroom data and binary files",
    );
    await page.keyboard.press("Escape");
    check(
      (await page.locator("dialog.lc-command-dialog[open]").count()) === 0,
      "Escape dismisses the extended palette normally",
    );
    // A separate failure scenario: real hook receives a controlled localStorage quota error.
    await page.evaluate(
      ({ key }) => {
        localStorage.setItem(
          key,
          JSON.stringify({ version: 1, enabled: true, feedback: [] }),
        );
        window.__mountLearner(null);
      },
      { key: preferenceKey },
    );
    await setup.waitFor();
    await form.waitFor();
    await form
      .getByRole("combobox", { name: "Your current goal", exact: true })
      .selectOption("explore");
    await page.evaluate((key) => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key)
          throw new DOMException("Synthetic quota", "QuotaExceededError");
        return set.call(this, name, value);
      };
    }, preferenceKey);
    await form
      .getByRole("button", { name: "Apply preferences", exact: true })
      .click();
    await form
      .getByRole("alert")
      .filter({ hasText: "Preferences were not saved" })
      .waitFor();
    check(
      (await form.getByRole("status").count()) === 0,
      "Storage failure never shows a false saved acknowledgement",
    );
    check(
      !(
        await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)),
          preferenceKey,
        )
      ).controls,
      "Failed goal setup leaves persisted preferences unchanged",
    );
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Inline setup and storage failure remain responsive at 390px",
    );
    await setup.scrollIntoViewIfNeeded();
    await page.screenshot({ path: folder + "setup-failure-phone.png" });
    check(errors.length === 0, "No browser page errors occurred");
    check(
      external.length === 0 && mutations.length === 0,
      "All work stayed local with no provider/paid mutation/outbound network",
    );
    return JSON.stringify({
      status: "PASS",
      checks: passed.length,
      passed,
      pageErrors: errors,
      externalRequests: external,
      unexpectedMutations: mutations,
      screenshots: [
        "setup-desktop.png",
        "search-phone.png",
        "setup-failure-phone.png",
      ],
      scope:
        "Actual learner React/DOM, browser IndexedDB/localStorage, and synthetic guest/config only. No real OAuth, classroom server search, provider, production, learning-effectiveness or installed-device verification.",
      limitations: [
        "Search covers only currently loaded personal workspace text, bounded saved study text, spaces, destinations and study tasks; server classes and other accounts are not indexed.",
        "Goal choices are declared preferences, not measured ability. Closing setup without saving is not persisted as completion.",
        "Manifest metadata is tested separately; this fixture does not prove browser/OS installation or offline capability.",
      ],
    });
  } catch (error) {
    await page
      .screenshot({ path: folder + "failure-current.png" })
      .catch(() => {});
    return JSON.stringify({
      status: "FAIL",
      passed,
      error: error.message,
      pageErrors: errors,
      externalRequests: external,
      unexpectedMutations: mutations,
    });
  }
};
