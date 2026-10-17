// Actual learner Workspace/React and browser IndexedDB; synthetic guest data only.
async (page) => {
  const passed = [],
    errors = [],
    outbound = [],
    unexpected = [],
    api = [],
    folder = "docs/next/reports/backup-import-browser/",
    account = "guest",
    learningKey = "lumio-learning-v1:guest",
    preferenceKey = "lumio-personalization-v1:guest";
  const check = (ok, label) => {
    if (!ok) throw Error(label);
    passed.push(label);
  };
  const item = (id) => ({
    id,
    title: id,
    kind: "text",
    spaceId: "",
    text: "Synthetic backup acceptance source only.",
    notes: "",
    createdAt: "2026-10-17T00:00:00Z",
    updatedAt: "2026-10-17T00:00:00Z",
    cards: [],
    questions: [],
    attempts: [],
    favorite: false,
  });
  const learning = (id) => ({
    version: 1,
    tasks: [
      {
        id,
        title: id,
        date: "2026-10-17",
        minutes: 20,
        itemId: "",
        done: false,
        createdAt: "2026-10-17T00:00:00Z",
      },
    ],
    reviews: [],
    events: [],
    focus: null,
  });
  const backup = (id) => ({
    version: 1,
    items: [item(id)],
    spaces: [],
    learning: learning(id + "-task"),
    personalization: { version: 1, enabled: false, feedback: [] },
  });
  try {
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (!url.startsWith("http://localhost:3000/")) {
        outbound.push(url);
        return route.abort();
      }
      if (url.includes("/api/")) {
        api.push({
          path: url.replace("http://localhost:3000", "").split("?")[0],
          method: route.request().method(),
        });
        if (route.request().method() !== "GET")
          unexpected.push(
            url.replace("http://localhost:3000", "").split("?")[0],
          );
        return route.fulfill({
          status: 403,
          json: { error: "SYNTHETIC_API_UNAVAILABLE" },
        });
      }
      return route.abort();
    });
    for (const [url, file, contentType] of [
      ["**/__v10-backup-import-ui", "fixture.html", "text/html"],
      ["**/__v7-learner-ui.js", "fixture.js", "text/javascript"],
      ["**/__v7-learner-ui.css", "fixture.css", "text/css"],
    ])
      await page.route(url, (r) =>
        r.fulfill({ path: "work/v10-backup-import-ui/" + file, contentType }),
      );
    await page.route("**/brand/lumio-logo.png", (r) =>
      r.fulfill({
        path: "public/brand/lumio-logo.png",
        contentType: "image/png",
      }),
    );
    await page.route("**/fonts/KaTeX*", (r) => {
      const match = /(KaTeX_[A-Za-z0-9-]+\.(?:woff2?|ttf))$/.exec(
        r.request().url(),
      );
      return match
        ? r.fulfill({
            path: "node_modules/katex/dist/fonts/" + match[1],
            contentType: "font/woff2",
          })
        : r.abort();
    });
    await page.route("**/api/config", (r) =>
      r.fulfill({
        json: {
          google: false,
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
    await page.goto("http://localhost:3000/__v10-backup-import-ui");
    await page.locator("#lumio-navigation").waitFor();
    await page.setViewportSize({ width: 1440, height: 1050 });
    async function seed(label) {
      const original = {
          version: 1,
          items: [item("SYNTHETIC ORIGINAL " + label)],
          spaces: [],
        },
        originalLearning = learning("SYNTHETIC ORIGINAL " + label + " task"),
        originalPreferences = { version: 1, enabled: true, feedback: [] };
      await page.evaluate(
        async ({
          account,
          original,
          originalLearning,
          originalPreferences,
          learningKey,
          preferenceKey,
        }) => {
          await new Promise((resolve, reject) => {
            const req = indexedDB.open("lumio-local-library-v2", 2);
            req.onupgradeneeded = () => {
              for (const n of ["libraries", "revisions"])
                if (!req.result.objectStoreNames.contains(n))
                  req.result.createObjectStore(n);
            };
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
              const db = req.result,
                tx = db.transaction(["libraries", "revisions"], "readwrite");
              tx.objectStore("libraries").put(original, account);
              tx.objectStore("revisions").put(1, account);
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
          localStorage.setItem(learningKey, JSON.stringify(originalLearning));
          localStorage.setItem(
            preferenceKey,
            JSON.stringify(originalPreferences),
          );
          window.__mountLearner(null);
        },
        {
          account,
          original,
          originalLearning,
          originalPreferences,
          learningKey,
          preferenceKey,
        },
      );
      await page
        .getByText(original.items[0].title, { exact: true })
        .first()
        .waitFor();
      await page
        .locator("#lumio-navigation details")
        .evaluateAll((nodes) => nodes.forEach((n) => (n.open = true)));
      await page
        .locator("#lumio-navigation")
        .getByRole("button", { name: "Settings", exact: true })
        .click();
      await page.locator(".lm-settings-grid").waitFor();
      return { original, originalLearning, originalPreferences };
    }
    async function choose(value) {
      await page.evaluate((data) => {
        const input = document.querySelector(
            '.lm-settings-grid input[type="file"][accept=".json"]',
          ),
          transfer = new DataTransfer();
        transfer.items.add(
          new File([JSON.stringify(data)], "SYNTHETIC-backup.json", {
            type: "application/json",
          }),
        );
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
      await page
        .getByRole("dialog")
        .filter({ hasText: "Replace this local workspace" })
        .waitFor();
    }
    async function confirm() {
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Import backup", exact: true })
        .click();
    }
    async function read() {
      return page.evaluate(
        async ({ account, learningKey, preferenceKey }) => {
          const saved = await new Promise((resolve, reject) => {
            const req = indexedDB.open("lumio-local-library-v2", 2);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
              const db = req.result,
                tx = db.transaction(["libraries", "revisions"], "readonly"),
                library = tx.objectStore("libraries").get(account),
                revision = tx.objectStore("revisions").get(account);
              tx.oncomplete = () => {
                db.close();
                resolve({ library: library.result, revision: revision.result });
              };
              tx.onabort = tx.onerror = () => {
                db.close();
                reject(tx.error);
              };
            };
          });
          return {
            ...saved,
            learning: JSON.parse(localStorage.getItem(learningKey)),
            preferences: JSON.parse(localStorage.getItem(preferenceKey)),
          };
        },
        { account, learningKey, preferenceKey },
      );
    }
    // Hold only the real transaction's completion callback; no fake data/store is substituted.
    await page.evaluate(() => {
      const transaction = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (...args) {
        const tx = transaction.apply(this, args);
        if (
          args[1] === "readwrite" &&
          Array.from(tx.objectStoreNames).includes("libraries")
        ) {
          if (window.__qaAbortNextLibrary) {
            window.__qaAbortNextLibrary = false;
            queueMicrotask(() => tx.abort());
          } else if (window.__qaHoldNextLibraryAck) {
            window.__qaHoldNextLibraryAck = false;
            Object.defineProperty(tx, "oncomplete", {
              configurable: true,
              set(fn) {
                tx.addEventListener("complete", (event) => {
                  window.__qaReleaseLibraryAck = () => fn.call(tx, event);
                  window.__qaLibraryAckHeld = true;
                });
              },
            });
          }
        }
        return tx;
      };
    });
    const first = await seed("success"),
      value = backup("SYNTHETIC IMPORTED success");
    await choose(value);
    await page.evaluate(() => {
      window.__qaHoldNextLibraryAck = true;
      window.__qaLibraryAckHeld = false;
    });
    await confirm();
    await page.waitForFunction(() => window.__qaLibraryAckHeld === true);
    const busy = page
      .getByRole("status")
      .filter({ hasText: "Saving this backup" });
    check(
      await busy.isVisible(),
      "Real pending library ACK exposes an accessible saving status",
    );
    check(
      (await busy.getAttribute("aria-busy")) === "true",
      "Saving status is marked aria-busy",
    );
    check(
      await page
        .getByRole("button", { name: "Import backup", exact: true })
        .isDisabled(),
      "Import control is disabled until the library ACK resolves",
    );
    let saved = await read();
    check(
      JSON.stringify(saved.learning) ===
        JSON.stringify(first.originalLearning) &&
        JSON.stringify(saved.preferences) ===
          JSON.stringify(first.originalPreferences),
      "Study stores are unchanged while the real library ACK is held",
    );
    await page.evaluate(() => window.__qaReleaseLibraryAck());
    const success = page
      .getByRole("status")
      .filter({ hasText: "included in the backup were saved" });
    await success.waitFor();
    saved = await read();
    check(
      saved.library.items[0].id === value.items[0].id && saved.revision === 2,
      "Successful import persists the actual library revision in browser IndexedDB",
    );
    check(
      JSON.stringify(saved.learning) === JSON.stringify(value.learning) &&
        JSON.stringify(saved.preferences) ===
          JSON.stringify(value.personalization),
      "Success also persists exactly the imported progress and preferences",
    );
    check(
      await success
        .getByRole("button", { name: "Close", exact: true })
        .isEnabled(),
      "Completed persistent status exposes a usable dismiss control",
    );
    await page.waitForTimeout(3700);
    check(
      await success.isVisible(),
      "Success remains readable after the transient toast lifetime",
    );
    await page.screenshot({ path: folder + "success-desktop.png" });
    const second = await seed("failure");
    await choose(backup("SYNTHETIC IMPORTED failure"));
    await page.evaluate(() => {
      window.__qaAbortNextLibrary = true;
    });
    await confirm();
    const failure = page
      .getByRole("alert")
      .filter({ hasText: "library save was not acknowledged" });
    await failure.waitFor();
    saved = await read();
    check(
      saved.library.items[0].id === second.original.items[0].id &&
        saved.revision === 1,
      "A real aborted IndexedDB transaction preserves the original library and revision",
    );
    check(
      JSON.stringify(saved.learning) ===
        JSON.stringify(second.originalLearning) &&
        JSON.stringify(saved.preferences) ===
          JSON.stringify(second.originalPreferences),
      "Denied library ACK leaves both actual localStorage study stores unchanged",
    );
    check(
      await page
        .getByRole("button", { name: "Import backup", exact: true })
        .isEnabled(),
      "Import control leaves the busy state after an acknowledged failure",
    );
    await page.waitForTimeout(3700);
    check(
      await failure.isVisible(),
      "Failure remains a persistent accessible alert, not a disappearing toast",
    );
    await page.screenshot({ path: folder + "failure-desktop.png" });
    // Remount is test isolation, not a product promise of automatic recovery/rollback.
    const third = await seed("partial"),
      partialValue = backup("SYNTHETIC IMPORTED partial");
    await choose(partialValue);
    await page.evaluate((key) => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key && window.__qaFailPreferences)
          throw new DOMException(
            "Synthetic test storage quota",
            "QuotaExceededError",
          );
        return setItem.call(this, name, value);
      };
      window.__qaFailPreferences = true;
    }, preferenceKey);
    await confirm();
    const partial = page
      .getByRole("alert")
      .filter({ hasText: "not fully restored" });
    await partial.waitFor();
    saved = await read();
    check(
      saved.library.items[0].id === partialValue.items[0].id &&
        saved.revision === 2,
      "Partial status truthfully retains the already committed library",
    );
    check(
      JSON.stringify(saved.learning) ===
        JSON.stringify(partialValue.learning) &&
        JSON.stringify(saved.preferences) ===
          JSON.stringify(third.originalPreferences),
      "Partial restoration preserves the failed preference store and acknowledges the saved progress",
    );
    check(
      (await partial.innerText()).includes("separate storage"),
      "Partial alert explains that stores are separate and asks for review/export before retry",
    );
    await page.waitForTimeout(3700);
    check(
      await partial.isVisible(),
      "Partial result stays visible for deliberate recovery",
    );
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    check(
      layout.document <= layout.width + 1,
      "Partial recovery copy and controls fit a 390px phone viewport",
    );
    await page.screenshot({ path: folder + "partial-phone.png" });
    await partial.getByRole("button", { name: "Close", exact: true }).click();
    check(
      (await partial.count()) === 0,
      "Partial alert can be dismissed by its visible accessible control",
    );
    check(errors.length === 0, "No browser page errors occurred");
    check(
      unexpected.length === 0 && outbound.length === 0,
      "No paid mutation or external network request occurred",
    );
    return JSON.stringify({
      status: "PASS",
      checks: passed.length,
      passed,
      pageErrors: errors,
      externalRequests: outbound,
      unexpectedMutations: unexpected,
      observedApiMetadata: api,
      screenshots: [
        "success-desktop.png",
        "failure-desktop.png",
        "partial-phone.png",
      ],
      viewports: [
        { width: 1440, height: 1050 },
        { width: 390, height: 1000 },
      ],
      scope:
        "Actual Workspace React/DOM and real browser IndexedDB/localStorage with isolated synthetic guest/config; no real OAuth, student, provider, device, or production validation",
      limitations: [
        "Completion callback was held and transaction aborted only in this synthetic browser fixture.",
        "Separate IndexedDB/localStorage stores are not globally atomic. Cross-tab localStorage check/write races cannot guarantee that every concurrent edit is preserved.",
        "This covers three import outcomes and accessibility/status controls, not all learner features.",
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
      externalRequests: outbound,
      unexpectedMutations: unexpected,
    });
  }
};
