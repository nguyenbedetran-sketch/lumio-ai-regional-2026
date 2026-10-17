async (page) => {
  const passed = [],
    errors = [],
    external = [],
    mutations = [],
    folder = "docs/next/reports/quiz-provenance-browser/";
  const check = (ok, label) => {
    if (!ok) throw Error(label);
    passed.push(label);
  };
  const source =
    '## Kiểm tra công thức\n\n**Giải thích** $\\frac{3}{2}x+4=10$.\n\n- Đối chiếu nguồn\n- Giá $20 và $30\n\n| Đại lượng | Giá trị |\n| --- | --- |\n| x | $x=4$ |\n\n```js\nconst price = "$20";\n```\n\n<img src=x onerror=alert(1)>';
  const make = (id, provenance) => ({
    id,
    title: "SYNTHETIC " + id,
    kind: "text",
    text: source,
    notes: "## Ghi chú\n\n**Bước 1**: \\(2x=4\\)\n\n\\[x=2\\]",
    spaceId: "",
    cards: [],
    questions: [
      {
        id: "q-" + id,
        prompt: "2x+3=7",
        options: ["2", "3", "4", "5"],
        correct: 0,
        explanation: "Synthetic explanation",
        topic: "linear",
        difficulty: "beginner",
        ...(provenance ? { answerKeyProvenance: provenance } : {}),
      },
    ],
    attempts: [],
    favorite: false,
    createdAt: "2026-10-17T00:00:00Z",
    updatedAt: "2026-10-17T00:00:00Z",
  });
  try {
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (r) => {
      const u = r.request().url();
      if (!u.startsWith("http://localhost:3000/")) {
        external.push(u);
        return r.abort();
      }
      if (r.request().method() !== "GET") mutations.push(u);
      return r.fulfill({
        status: 403,
        json: { error: "SYNTHETIC_UNAVAILABLE" },
      });
    });
    for (const [url, file, type] of [
      ["**/__v11-quiz-provenance-ui", "fixture.html", "text/html"],
      ["**/__v7-learner-ui.js", "fixture.js", "text/javascript"],
      ["**/__v7-learner-ui.css", "fixture.css", "text/css"],
    ])
      await page.route(url, (r) =>
        r.fulfill({
          path: "work/v11-quiz-provenance-ui/" + file,
          contentType: type,
        }),
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
    await page.goto("http://localhost:3000/__v11-quiz-provenance-ui");
    await page.locator("#lumio-navigation").waitFor();
    await page.setViewportSize({ width: 1360, height: 1000 });
    await page.evaluate(
      async (items) => {
        await new Promise((resolve, reject) => {
          const req = indexedDB.open("lumio-local-library-v2", 2);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result,
              tx = db.transaction(["libraries", "revisions"], "readwrite");
            tx.objectStore("libraries").put(
              { version: 1, spaces: [], items },
              "guest",
            );
            tx.objectStore("revisions").put(1, "guest");
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
        window.__mountLearner(null);
      },
      [
        make("AI key", "ai-unreviewed"),
        make("Legacy key"),
        { ...make("Manual key"), questions: [] },
      ],
    );
    await page.waitForFunction(() =>
      document.querySelector('select option[value="AI key"]'),
    );
    const open = async (name) => {
      await page.locator(".lc-command-trigger").click();
      const palette = page.locator("dialog.lc-command-dialog[open]");
      await palette.waitFor();
      await palette.getByRole("combobox").fill(name);
      await palette.getByRole("option").filter({ hasText: name }).waitFor();
      await page.keyboard.press("Enter");
      await page.locator(".lm-document-title input").waitFor();
      await page.getByRole("tab", { name: "Quiz", exact: true }).click();
      await page.locator(".lsv-quiz").waitFor();
    };
    const read = () =>
      page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open("lumio-local-library-v2", 2);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
              const db = req.result,
                r = db
                  .transaction("libraries")
                  .objectStore("libraries")
                  .get("guest");
              r.onsuccess = () => {
                db.close();
                resolve(r.result);
              };
              r.onerror = () => reject(r.error);
            };
          }),
      );
    const finish = async () => {
      await page
        .getByRole("button", { name: "Start quiz", exact: true })
        .click();
      await page.locator(".lm-answers button").first().click();
      await page
        .getByRole("status")
        .filter({ hasText: "Matches the saved key" })
        .waitFor();
      await page.getByRole("button", { name: "Result", exact: true }).click();
      await page.locator(".lm-quiz-result").waitFor();
      await page.waitForFunction(() => document.querySelector(".lm-attempts"));
    };
    await open("SYNTHETIC AI key");
    check(
      (await page.locator("[data-quiz-key-review]").innerText()).includes(
        "not teacher-confirmed",
      ),
      "Before practice, AI key comparison is explicitly unconfirmed",
    );
    await finish();
    let stored = await read(),
      a = stored.items.find((x) => x.id === "AI key").attempts[0];
    check(
      a.score === 1 && a.answers[0].correct === true && !a.skillEvidence,
      "Actual AI quiz completion records activity and saved-key score without skill evidence",
    );
    check(
      (await page.locator(".lm-quiz-result").innerText()).includes(
        "Saved-key match rate",
      ),
      "Finished result labels saved-key match rather than assessed accuracy",
    );
    await page.screenshot({ path: folder + "ai-result-desktop.png" });
    await open("SYNTHETIC Legacy key");
    await finish();
    stored = await read();
    a = stored.items.find((x) => x.id === "Legacy key").attempts[0];
    check(
      a.score === 1 && !a.skillEvidence,
      "Actual legacy quiz without provenance cannot create new skill evidence",
    );
    await open("SYNTHETIC Manual key");
    await page
      .getByRole("button", { name: "Add a question", exact: true })
      .click();
    const form = page.locator(".lsv-quiz form");
    await form
      .getByRole("textbox", { name: "Question", exact: true })
      .fill("2x+3=7");
    for (let i = 0; i < 4; i++)
      await form
        .getByRole("textbox", { name: "Option " + (i + 1), exact: true })
        .fill(String(i + 2));
    await form
      .getByRole("textbox", { name: "Explanation", exact: true })
      .fill("Synthetic local explanation");
    await form
      .getByRole("button", { name: "Save question", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Start quiz", exact: true })
      .waitFor();
    stored = await read();
    check(
      stored.items.find((x) => x.id === "Manual key").questions[0]
        .answerKeyProvenance === "learner-authored",
      "Actual manual question editor persists learner provenance without teacher approval",
    );
    await finish();
    stored = await read();
    a = stored.items.find((x) => x.id === "Manual key").attempts[0];
    check(
      !!a.skillEvidence && a.score === 1,
      "Manual learner-authored local practice remains usable with historical-style evidence",
    );
    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector('select option[value="AI key"]'),
    );
    await open("SYNTHETIC AI key");
    check(
      (await page.locator(".lm-attempts").innerText()).match(/1\s*\/\s*1/) !==
        null,
      "Saved AI practice attempt survives a real reload",
    );
    stored = await read();
    check(
      stored.items.find((x) => x.id === "AI key").questions[0]
        .answerKeyProvenance === "ai-unreviewed",
      "AI provenance survives actual IndexedDB reload",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      localStorage.setItem("lumio-theme", "dark");
      window.__mountLearner(null);
    });
    await page.waitForFunction(() =>
      document.querySelector('select option[value="AI key"]'),
    );
    await open("SYNTHETIC Legacy key");
    check(
      await page.locator("[data-quiz-key-review]").isVisible(),
      "Unconfirmed-key warning remains visible in narrow dark view",
    );
    await page.screenshot({ path: folder + "legacy-phone.png" });
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({
        width: theme === "light" ? 1440 : 390,
        height: theme === "light" ? 1000 : 844,
      });
      await page.evaluate((theme) => {
        localStorage.setItem("lumio-theme", theme);
        window.__mountLearner(null);
      }, theme);
      await page.waitForFunction(() =>
        document.querySelector('select option[value="AI key"]'),
      );
      await open("SYNTHETIC AI key");
      await page.getByRole("tab", { name: "Source", exact: true }).click();
      const reading = page.locator("[data-material-reading]");
      await reading.waitFor();
      check(
        (await reading.locator("h2").innerText()) === "Kiểm tra công thức" &&
          (await reading.locator("strong").count()) > 0 &&
          (await reading.locator("table").count()) === 1,
        "Stored material renders semantic Markdown in " + theme + " view",
      );
      check(
        (await reading.locator("[data-math-rendered] math").count()) >= 2,
        "Stored material renders accessible formula MathML in " +
          theme +
          " view",
      );
      check(
        (await reading.locator("pre code").innerText()).includes("$20") &&
          (await reading.locator("img").count()) === 0,
        "Code and HTML-like source remain inert literal text in " +
          theme +
          " view",
      );
      check(
        (await page.locator("[data-source-editor]").getAttribute("open")) ===
          null,
        "Literal source editor is explicit and collapsed in " +
          theme +
          " reading view",
      );
      await page.locator("[data-source-editor] > summary").click();
      check(
        (await page.locator("[data-source-editor] textarea").inputValue()) ===
          source,
        "Raw source remains byte-for-byte unchanged in " + theme + " editor",
      );
      await page.locator("[data-source-editor] > summary").click();
      await page.screenshot({ path: folder + "material-" + theme + ".png" });
      await page.getByRole("tab", { name: "Notes", exact: true }).click();
      const notes = page.locator("[data-notes-reading]");
      await notes.waitFor();
      check(
        (await notes.locator("h2").count()) === 1 &&
          (await notes.locator("[data-math-rendered]").count()) === 2,
        "Saved notes use the same Markdown/math renderer in " + theme + " view",
      );
    }
    check(errors.length === 0, "No browser runtime errors");
    check(
      external.length === 0 && mutations.length === 0,
      "No external providers or live API mutations",
    );
    return JSON.stringify({
      status: "PASS",
      checks: passed.length,
      passed,
      errors,
      external,
      mutations,
      scope:
        "Actual learner Quiz editor/completion, IndexedDB and reload under synthetic isolated auth; no live AI semantic correctness or teacher assessment",
    });
  } catch (e) {
    await page.screenshot({
      path: "work/v11-quiz-provenance-ui/harness-debug.png",
    });
    return JSON.stringify({
      status: "FAIL",
      checks: passed.length,
      passed,
      error: e.message,
      errors,
      external,
      mutations,
    });
  }
};
