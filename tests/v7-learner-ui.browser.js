// Actual learner shell/document components with explicit synthetic identity/source/AI responses.
async (page) => {
  const passed = [],
    errors = [],
    unexpected = [],
    aiRequests = [],
    external = [],
    consoleErrors = [],
    sourceSearches = [];
  const check = (ok, label) => {
    if (!ok) throw Error(label);
    passed.push(label);
  };
  const account = "qa-v7-learner-a",
    stamp = "2026-10-15T10:00:00.000Z",
    source =
      "Điều kiện ban đầu: mẫu số phải khác không.\n\nChỉ chia hai vế của phương trình cho cùng một số khác không.\n\nPhương trình 2x + 3 = 11 có nghiệm x = 4.",
    quote = "Chỉ chia hai vế của phương trình cho cùng một số khác không.",
    ragQuote =
      "Nguồn B xác nhận tam giác vuông có hai cạnh góc vuông 6 và 8 thì cạnh huyền bằng 10.";
  const session = {
    accountKey: account,
    userId: "qa-v7-user-a",
    user: { name: "KIỂM THỬ · AN" },
    sessionVersion: 1,
    expires: "2099-01-01T00:00:00Z",
  };
  let admin = false,
    ragMode = false,
    latestSession = null;
  const localRef = {
    segmentId: "s2",
    quote,
    start: source.indexOf(quote),
    end: source.indexOf(quote) + quote.length,
    paragraph: 2,
    verification: "exact-excerpt",
  };
  const ragRef = {
    segmentId: "s1",
    quote: ragQuote,
    start: 0,
    end: ragQuote.length,
    paragraph: 1,
    verification: "exact-excerpt",
    rag: {
      documentId: "10000000-0000-4000-8000-000000000001",
      snapshotId: "20000000-0000-4000-8000-000000000001",
      chunkId: "30000000-0000-4000-8000-000000000001",
      title: "KIỂM THỬ · Nguồn B · Tam giác",
      digest: "a".repeat(64),
      revision: 1,
    },
  };
  try {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.route("**/*", (r) => {
      const u = r.request().url();
      if (/^https?:/.test(u) && !/^http:\/\/localhost:3000\//.test(u)) {
        external.push(u);
        return r.abort();
      }
      if (/\/api\//.test(u)) {
        if (r.request().method() !== "GET") unexpected.push(u);
        return r.fulfill({
          status: 403,
          json: { error: "SYNTHETIC_UI_UNAVAILABLE" },
        });
      }
      return r.abort();
    });
    for (const [url, file, contentType] of [
      ["**/__v7-learner-ui", "fixture.html", "text/html"],
      ["**/__v7-learner-ui.js", "fixture.js", "text/javascript"],
      ["**/__v7-learner-ui.css", "fixture.css", "text/css"],
    ])
      await page.route(url, (r) =>
        r.fulfill({ path: "work/v7-learner-ui/" + file, contentType }),
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
            contentType: m[1].endsWith("woff2")
              ? "font/woff2"
              : m[1].endsWith("woff")
                ? "font/woff"
                : "font/ttf",
          })
        : r.abort();
    });
    await page.route("**/api/config", (r) =>
      r.fulfill({
        json: {
          google: true,
          facebook: false,
          ai: true,
          capabilities: {
            tutor: true,
            summary: true,
            media: true,
            transcription: false,
            speech: false,
          },
        },
      }),
    );
    await page.route("**/api/account", (r) =>
      r.fulfill({
        json: {
          authenticated: true,
          id: session.userId,
          name: session.user.name,
          isAdmin: admin,
          identities: [],
          providers: { google: true, facebook: false },
        },
      }),
    );
    await page.route("**/api/auth/session", (r) =>
      r.fulfill({ json: session }),
    );
    await page.route("**/api/rag/documents**", (r) =>
      r.fulfill({
        json: {
          documents: [
            {
              id: ragRef.rag.documentId,
              title: ragRef.rag.title,
              workspaceId: "main",
              clientItemId: "qa-other-source",
              digest: "a".repeat(64),
              revision: 1,
              characters: ragQuote.length,
              chunks: 1,
              semantic: false,
              expiresAt: "2099-01-01T00:00:00Z",
            },
          ],
          embeddingsAvailable: false,
          retentionDays: 7,
        },
      }),
    );
    await page.route("**/api/rag/search", (r) => {
      const body = r.request().postDataJSON();
      sourceSearches.push(body);
      check(
        r.request().headers()["x-lumio-account"] === account &&
          body.scope.mode === "lexical",
        "Settings keyword search preserves canonical account and free lexical mode",
      );
      return r.fulfill({
        json: {
          hits: [
            {
              chunkId: ragRef.rag.chunkId,
              documentId: ragRef.rag.documentId,
              documentTitle: ragRef.rag.title,
              text: ragQuote,
              paragraph: 1,
            },
          ],
          mode: "lexical",
          credits: 0,
        },
      });
    });
    await page.route("**/api/tutor/session?**", (r) =>
      latestSession
        ? r.fulfill({
            json: { ...latestSession, turns: [], problem: "synthetic" },
          })
        : r.fulfill({
            status: 404,
            json: { error: "TUTOR_SESSION_NOT_FOUND" },
          }),
    );
    await page.route("**/api/ai", (r) => {
      const b = r.request().postDataJSON();
      aiRequests.push(b);
      check(
        r.request().headers()["x-lumio-account"] === account,
        "AI UI request keeps the canonical fixture account binding",
      );
      latestSession = {
        sessionId:
          "40000000-0000-4000-8000-" +
          String(aiRequests.length).padStart(12, "0"),
        hintCount: 1,
        requiredHints: 3,
        canUnlock: false,
        revision: 1,
        expiresAt: "2099-01-01T00:00:00Z",
      };
      return r.fulfill({
        json: {
          text: "KIỂM THỬ · Hãy kiểm tra điều kiện trước khi biến đổi.",
          references: [
            b.ragScope
              ? ragRef
              : { ...localRef, ...(b.sourceEvidence ? { page: 2 } : {}) },
          ],
          tutor: latestSession,
          quality: {
            status: "review-required",
            structuralChecks: true,
            citedItems: 1,
            totalItems: 1,
            issues: ["semantic-review"],
          },
          ...(b.ragScope
            ? {
                rag: {
                  snapshotId: ragRef.rag.snapshotId,
                  mode: "lexical",
                  documents: 1,
                  hits: 1,
                  potentialConflict: false,
                  expiresAt: "2099-01-01T00:00:00Z",
                },
              }
            : {}),
        },
      });
    });
    await page.addInitScript(() => {
      localStorage.setItem("lumio-language", "vi");
      localStorage.setItem("lumio-theme", "light");
      localStorage.setItem("lumio-motion-v3", "off");
    });
    await page.goto("http://localhost:3000/__v7-learner-ui");
    await page.evaluate(
      async ({ account, stamp, source, localRef }) => {
        const base = {
            spaceId: "",
            createdAt: stamp,
            updatedAt: stamp,
            notes: "",
            cards: [],
            questions: [],
            attempts: [],
            favorite: false,
          },
          data = {
            version: 1,
            spaces: [
              { id: "qa-v7-space", name: "KIỂM THỬ · Toán", color: "green" },
            ],
            items: [
              {
                ...base,
                id: "qa-v7-text",
                title: "KIỂM THỬ · Phương trình",
                kind: "text",
                text: source,
                url: "https://example.org/lesson-a",
                cards: [
                  {
                    id: "qa-card",
                    front: "Điều kiện chia hai vế?",
                    back: "Cùng một số khác không.",
                    references: [localRef],
                  },
                ],
                questions: [
                  {
                    id: "qa-question",
                    prompt: "Trước khi chia hai vế cần điều kiện gì?",
                    options: [
                      "Số chia khác không",
                      "Số chia bằng không",
                      "Bỏ qua điều kiện",
                      "Chỉ chia một vế",
                    ],
                    correct: 0,
                    explanation: "Chỉ chia hai vế cho cùng số khác không.",
                    references: [localRef],
                  },
                ],
                artifacts: [
                  {
                    id: "qa-summary",
                    kind: "summary",
                    createdAt: stamp,
                    source: {
                      kind: "text",
                      title: "KIỂM THỬ · Phương trình",
                      contentLength: source.length,
                    },
                    summary: {
                      title: "Điều kiện phép chia",
                      overview: "Luôn kiểm tra điều kiện trước khi biến đổi.",
                      keyPoints: ["Số chia khác không."],
                      chapters: [
                        {
                          title: "Điều kiện",
                          summary: "Cần cùng một số khác không.",
                          bullets: ["Kiểm tra điều kiện."],
                          timestampKind: "none",
                          references: [localRef],
                        },
                      ],
                      mindMap: {
                        nodes: [
                          {
                            id: "root",
                            label: "Phép chia",
                            detail: "Số chia khác không.",
                          },
                        ],
                        edges: [],
                      },
                    },
                  },
                ],
              },
              {
                ...base,
                id: "qa-v7-pdf",
                title: "KIỂM THỬ · PDF",
                kind: "pdf",
                text: source,
                fileName: "qa-source.pdf",
                blob: new Blob(
                  [
                    "%PDF-1.4\n% synthetic browser-location fixture only\n%%EOF",
                  ],
                  { type: "application/pdf" },
                ),
                sourceEvidence: {
                  version: 1,
                  kind: "pdf",
                  filename: "qa-source.pdf",
                  digest: "a".repeat(64),
                  proof: "b".repeat(64),
                  units: [
                    { start: 0, end: source.indexOf("Chỉ chia"), page: 1 },
                    {
                      start: source.indexOf("Chỉ chia"),
                      end: source.length,
                      page: 2,
                    },
                  ],
                },
              },
              {
                ...base,
                id: "qa-v7-link",
                title: "KIỂM THỬ · Website",
                kind: "link",
                text: "Nội dung đã lưu của trang A.",
                url: "https://example.org/saved-page",
              },
            ],
          };
        await new Promise((resolve, reject) => {
          const q = indexedDB.open("lumio-local-library-v2", 2);
          q.onupgradeneeded = () => {
            for (const n of ["libraries", "revisions"])
              if (!q.result.objectStoreNames.contains(n))
                q.result.createObjectStore(n);
          };
          q.onsuccess = () => {
            const db = q.result,
              t = db.transaction(["libraries", "revisions"], "readwrite");
            t.objectStore("libraries").put(data, account);
            t.objectStore("revisions").put(1, account);
            t.oncomplete = () => {
              db.close();
              resolve();
            };
            t.onerror = () => reject(t.error);
          };
        });
      },
      { account, stamp, source, localRef },
    );
    await page.evaluate((s) => window.__mountLearner(s), session);
    await page
      .locator(".lm-profile")
      .filter({ hasText: session.user.name })
      .waitFor();
    await page.locator("aside .lm-nav button").first().waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    const sidebar = page.locator("#lumio-navigation");
    check(
      (await sidebar
        .getByRole("navigation", { name: "Học tập", exact: true })
        .getByRole("button")
        .count()) === 5,
      "Learner navigation exposes five primary destinations",
    );
    check(
      (await sidebar.locator(".lv7-nav-group").count()) === 3,
      "Named secondary groups preserve the deeper study and account tools",
    );
    check(
      (await sidebar
        .getByRole("link", { name: "Không gian giáo viên" })
        .getAttribute("href")) === "/teacher" &&
        (await sidebar
          .getByRole("link", { name: "Lớp học của tôi" })
          .getAttribute("href")) === "/classroom",
      "Teacher and classroom are actual route links",
    );
    check(
      (await sidebar.locator('a[href="/admin"]').count()) === 0,
      "A non-admin account is not shown an admin entry",
    );
    const navLabels = await sidebar
      .locator("nav.lm-nav button")
      .evaluateAll((ns) => ns.map((n) => n.textContent.trim()));
    check(
      navLabels.length === 14 && new Set(navLabels).size === 14,
      "All thirteen original learner destinations and settings remain once each",
    );
    for (const label of navLabels) {
      await sidebar
        .locator("details.lv7-nav-group")
        .evaluateAll((ns) => ns.forEach((n) => (n.open = true)));
      const button = sidebar.getByRole("button", { name: label, exact: true });
      await button.click();
      check(
        (await button.getAttribute("aria-current")) === "page",
        "Navigation retains active aria-current: " + label,
      );
      check(
        (await sidebar.locator('[aria-current="page"]').count()) === 1,
        "Exactly one active destination after: " + label,
      );
    }
    // Settings keep common preferences prominent and advanced tools in native disclosures.
    const settings = page.locator(".lm-settings-grid"),
      disclosure = (id) => page.locator('[data-v7-settings="' + id + '"]');
    await settings.waitFor();
    check(
      (await page.locator("[data-v7-settings]").count()) === 3,
      "Settings contains one disclosure for sync, sources and capabilities",
    );
    for (const id of ["sync", "sources", "capabilities"]) {
      const item = disclosure(id),
        summary = item.locator(":scope > summary");
      check(
        (await item.getAttribute("open")) === null,
        "Advanced settings starts collapsed: " + id,
      );
      await summary.focus();
      await page.keyboard.press("Enter");
      check(
        (await item.getAttribute("open")) !== null,
        "Enter expands native settings disclosure: " + id,
      );
      check(
        await summary.evaluate(
          (n) =>
            document.activeElement === n &&
            getComputedStyle(n).outlineStyle !== "none" &&
            parseFloat(getComputedStyle(n).outlineOffset) < 0,
        ),
        "Keyboard focus stays visibly inset inside the clipped disclosure: " +
          id,
      );
      if (id === "sync")
        await summary.screenshot({
          path: "docs/v7/qa-settings-keyboard-focus.png",
        });

      check(
        await item
          .locator(
            id === "sync"
              ? "[data-sync-panel]"
              : id === "sources"
                ? "[data-rag-manager]"
                : ".lm-service",
          )
          .first()
          .isVisible(),
        "Expanded settings children remain visible and reachable: " + id,
      );
      await page.keyboard.press("Space");
      check(
        (await item.getAttribute("open")) === null,
        "Space collapses native settings disclosure: " + id,
      );
    }
    check(
      (await settings
        .getByRole("textbox", { name: "Tên hiển thị", exact: true })
        .count()) === 1 && (await settings.getByRole("combobox").count()) === 4,
      "Common name, language, AI language and appearance preferences are retained once",
    );
    check(
      (await settings
        .getByRole("button", { name: "Đăng xuất", exact: true })
        .count()) === 1 &&
        (await settings
          .getByRole("button", { name: "Xuất bản sao", exact: true })
          .count()) === 1 &&
        (await settings
          .getByRole("button", { name: "Nhập bản sao", exact: true })
          .count()) === 1,
      "Sign-out, export and import remain available without duplicate actions",
    );
    check(
      (await settings.locator("[data-sync-panel]").count()) === 1 &&
        (await settings.locator("[data-rag-manager]").count()) === 1 &&
        (await disclosure("capabilities").locator(".lm-service").count()) === 3,
      "Collapsing settings never duplicates or removes advanced tool instances",
    );
    await settings
      .getByRole("textbox", { name: "Tên hiển thị", exact: true })
      .fill("KIỂM THỬ · CÀI ĐẶT");
    check(
      (await page.evaluate(() => localStorage.getItem("lumio-name"))) ===
        "KIỂM THỬ · CÀI ĐẶT",
      "Name preference still persists from the simplified Settings page",
    );
    await settings
      .getByRole("textbox", { name: "Tên hiển thị", exact: true })
      .fill(session.user.name);
    await settings
      .getByRole("combobox", { name: "Ngôn ngữ AI trả lời", exact: true })
      .selectOption("en");
    check(
      (await page.evaluate(() => localStorage.getItem("lumio-ai-language"))) ===
        "en",
      "AI reply language remains independently configurable",
    );
    await settings
      .getByRole("combobox", { name: "Ngôn ngữ AI trả lời", exact: true })
      .selectOption("vi");
    await settings
      .getByRole("combobox", { name: "Giao diện", exact: true })
      .selectOption("dark");
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    check(
      (await page.evaluate(() => localStorage.getItem("lumio-theme"))) ===
        "dark",
      "Theme preference still changes the live document and persists",
    );
    await settings
      .getByRole("combobox", { name: "Giao diện", exact: true })
      .selectOption("light");
    const translated = {
      vi: [
        "Thiết bị & đồng bộ",
        "Tra cứu nhiều học liệu",
        "Khả năng AI hiện có",
      ],
      en: [
        "Devices & sync",
        "Search across sources",
        "Available AI capabilities",
      ],
      "zh-CN": ["设备与同步", "跨资料检索", "可用AI功能"],
      ja: ["デバイスと同期", "複数資料を検索", "利用可能なAI機能"],
      ko: ["기기 및 동기화", "여러 자료 검색", "사용 가능한 AI 기능"],
    };
    for (const [locale, labels] of Object.entries(translated)) {
      await page.locator(".lm-language select").selectOption(locale);
      await page.waitForFunction(
        ({ locale }) => document.documentElement.lang === locale,
        { locale },
      );
      const actual = await page
        .locator("[data-v7-settings] > summary strong")
        .allTextContents();
      check(
        JSON.stringify(actual) === JSON.stringify(labels),
        "Settings disclosure headings use the actual localized catalog: " +
          locale,
      );
    }
    await page.locator(".lm-language select").selectOption("vi");
    await page.waitForFunction(() => document.documentElement.lang === "vi");
    const privacy = settings.locator("section.lm-panel").filter({
      has: page.getByRole("heading", { name: "Quyền riêng tư", exact: true }),
    });
    check(
      !(await privacy.textContent()).includes(
        "Không có nội dung được tải lên dịch vụ AI",
      ) && (await privacy.textContent()).includes("AI"),
      "Effective privacy catalog explains conditional AI processing instead of the stale unconditional statement",
    );
    const download = page.waitForEvent("download");
    await settings
      .getByRole("button", { name: "Xuất bản sao", exact: true })
      .click();
    check(
      (await download).suggestedFilename().endsWith(".json"),
      "Export backup remains a real browser JSON download after Settings grouping",
    );
    await page.locator(".lm-toast").waitFor({ state: "hidden" });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: "docs/v7/qa-settings-desktop.png",
      fullPage: true,
    });
    const sync = disclosure("sync");
    await sync.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    const consent = sync.getByRole("checkbox");
    await consent.focus();
    await page.keyboard.press("Space");
    check(
      (await consent.isChecked()) &&
        !(await sync
          .getByRole("button", { name: "Đồng bộ ngay", exact: true })
          .isDisabled()),
      "Sync consent and sync action remain keyboard-usable inside the disclosure",
    );
    await sync.locator(":scope > summary").focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    check(
      await consent.isChecked(),
      "Collapsing and reopening sync preserves its current consent state",
    );
    await consent.uncheck();
    await sync.locator(":scope > summary").click();
    const sources = disclosure("sources");
    await sources.locator(":scope > summary").click();
    const workspace = sources.getByRole("combobox", {
      name: "Không gian học được lập chỉ mục",
      exact: true,
    });
    await workspace.selectOption("qa-v7-space");
    check(
      (await workspace.inputValue()) === "qa-v7-space",
      "Indexed workspace selector remains usable inside the sources disclosure",
    );
    await workspace.selectOption("main");
    await sources
      .getByRole("textbox", { name: "Tìm trong kho nguồn", exact: true })
      .fill("tam giác vuông");
    await sources.locator(":scope > summary").click();
    await sources.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    check(
      (await sources
        .getByRole("textbox", { name: "Tìm trong kho nguồn", exact: true })
        .inputValue()) === "tam giác vuông",
      "Closing the advanced sources section preserves an unfinished search query",
    );
    const search = sources.locator("form button");
    check(
      !!(await search.getAttribute("aria-label"))?.trim(),
      "Indexed-source search has a meaningful accessible button name",
    );
    await search.click();
    await sources.locator("blockquote").waitFor();
    check(
      (await sources.locator("blockquote").textContent()).includes(ragQuote) &&
        sourceSearches.length === 1,
      "Keyword search still displays the actual mocked retrieved excerpt after grouping",
    );
    await sources.locator(":scope > summary").click();
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
        "Collapsed Settings layout fits " + width + "px",
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: "docs/v7/qa-settings-mobile.png",
      fullPage: true,
    });
    for (const id of ["sync", "sources", "capabilities"]) {
      await disclosure(id).locator(":scope > summary").focus();
      await page.keyboard.press("Enter");
    }
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
      "Expanded settings tools remain within a 390px phone viewport",
    );
    const indexedMetadata = sources
      .getByRole("button", { name: /^Xóa bản chỉ mục/ })
      .locator("..")
      .locator(":scope > div");
    check(
      await indexedMetadata.evaluate(
        (n) => n.getBoundingClientRect().width >= 120,
      ),
      "Indexed document metadata retains a readable width beside its mobile actions",
    );

    await page.screenshot({
      path: "docs/v7/qa-settings-expanded-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await sidebar
      .locator("details.lv7-nav-group")
      .evaluateAll((ns) => ns.forEach((n) => (n.open = true)));
    await sidebar
      .getByRole("button", { name: navLabels[0], exact: true })
      .click();
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
        "Learner overview remains within " + width + "px",
      );
      if (width <= 700) {
        const menu = page.locator(".lm-menu");
        check(
          await menu.isVisible(),
          "Mobile menu trigger is visible at " + width + "px",
        );
        await menu.click();
        check(
          (await menu.getAttribute("aria-expanded")) === "true" &&
            (await page.locator(".lm-main").getAttribute("inert")) !== null,
          "Mobile drawer exposes expanded state and makes background inert at " +
            width +
            "px",
        );
        check(
          (await sidebar.getAttribute("role")) === "dialog" &&
            (await sidebar.getAttribute("aria-modal")) === "true",
          "Open mobile navigation has dialog semantics at " + width + "px",
        );
        check(
          await sidebar.evaluate((n) => n.contains(document.activeElement)),
          "Drawer moves focus into navigation at " + width + "px",
        );
        const controls = sidebar.locator(
          'button:visible,a[href]:visible,summary:visible,[tabindex="0"]:visible',
        );
        await controls.first().focus();
        await page.keyboard.press("Shift+Tab");
        check(
          await controls.last().evaluate((n) => document.activeElement === n),
          "Drawer wraps Shift+Tab at " + width + "px",
        );
        await page.keyboard.press("Tab");
        check(
          await controls.first().evaluate((n) => document.activeElement === n),
          "Drawer wraps Tab at " + width + "px",
        );
        await page.keyboard.press("Escape");
        check(
          (await menu.getAttribute("aria-expanded")) === "false" &&
            (await menu.evaluate((n) => document.activeElement === n)),
          "Escape closes navigation and returns trigger focus at " +
            width +
            "px",
        );
        check(
          (await page.locator(".lm-main").getAttribute("inert")) === null,
          "Drawer close restores interactive main content at " + width + "px",
        );
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: "docs/v7/qa-learner-desktop.png",
      fullPage: true,
    });
    if (
      (await page
        .locator("details")
        .filter({ has: page.locator(".lx-materials") })
        .getAttribute("open")) === null
    )
      await page
        .locator("details")
        .filter({ has: page.locator(".lx-materials") })
        .locator(":scope > summary")
        .click();
    await page.locator(".lm-action-grid button").nth(2).click();
    let editor = page.getByRole("dialog", { name: "Dán văn bản", exact: true });
    await editor.waitFor();
    await editor
      .getByRole("textbox", { name: "Tiêu đề", exact: true })
      .fill("BẢN NHÁP RIÊNG CHƯA LƯU");
    await editor
      .getByRole("textbox", { name: "Nội dung", exact: true })
      .fill("Nội dung riêng trong bộ nhớ biểu mẫu.");
    await page.keyboard.press("Escape");
    let decision = page.getByRole("dialog", {
      name: "Bỏ thay đổi chưa lưu?",
      exact: true,
    });
    await decision.waitFor();
    check(
      await editor.isVisible(),
      "Escape on AddContent retains the underlying unsaved editor",
    );
    await decision
      .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
      .click();
    check(
      (await editor
        .getByRole("textbox", { name: "Tiêu đề", exact: true })
        .inputValue()) === "BẢN NHÁP RIÊNG CHƯA LƯU",
      "Keep editing preserves the AddContent title",
    );
    await page.keyboard.press("Escape");
    await decision.waitFor();
    await page.keyboard.press("Escape");
    check(
      (await editor.isVisible()) && (await decision.count()) === 0,
      "Escape dismisses the top draft decision without closing its parent editor",
    );
    await editor.getByRole("button", { name: "Đóng", exact: true }).click();
    await decision
      .getByRole("button", { name: "Bỏ bản nháp", exact: true })
      .click();
    await editor.waitFor({ state: "hidden" });
    check(
      await page.evaluate(
        () =>
          ![
            ...Object.values(localStorage),
            ...Object.values(sessionStorage),
          ].some((v) => v.includes("BẢN NHÁP RIÊNG CHƯA LƯU")),
      ),
      "Unsaved AddContent text is not copied into browser storage",
    );

    const beforeReadErrors = consoleErrors.length;
    await page.evaluate(() => {
      const original = File.prototype.text;
      window.__originalFileText = original;
      File.prototype.text = function () {
        if (this.name !== "delayed-discard.txt") return original.call(this);
        window.__delayedReadStarted = true;
        return new Promise((resolve) => {
          window.__releaseDelayedRead = () =>
            resolve("KIỂM THỬ · Không được lưu bản đọc đã hủy.");
        }).then((text) => {
          window.__delayedReadSettled = true;
          return text;
        });
      };
    });
    if (
      (await page
        .locator("details")
        .filter({ has: page.locator(".lx-materials") })
        .getAttribute("open")) === null
    )
      await page
        .locator("details")
        .filter({ has: page.locator(".lx-materials") })
        .locator(":scope > summary")
        .click();
    await page.locator(".lm-action-grid button").first().click();
    const upload = page.getByRole("dialog", {
      name: "Tải tài liệu",
      exact: true,
    });
    await upload.waitFor();
    await upload
      .locator('input[type="file"]')
      .setInputFiles("work/v7-learner-ui/delayed-discard.txt");
    await page.waitForFunction(() => window.__delayedReadStarted === true);
    check(
      await upload.locator('input[type="file"]').isDisabled(),
      "A pending asynchronous file read locks the upload input against duplicate reads",
    );
    await page.keyboard.press("Escape");
    await decision.waitFor();
    check(
      await upload.isVisible(),
      "A pending upload waits for an explicit discard decision",
    );
    await decision
      .getByRole("button", { name: "Bỏ bản nháp", exact: true })
      .click();
    await upload.waitFor({ state: "hidden" });
    await page.evaluate(() => window.__releaseDelayedRead());
    await page.waitForFunction(() => window.__delayedReadSettled === true);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    check(
      (await page.locator(".lm-document-title").count()) === 0 &&
        (await sidebar
          .getByRole("button", { name: "delayed-discard.txt", exact: true })
          .count()) === 0,
      "A discarded upload cannot reopen a material when its delayed file read completes",
    );
    const delayedPersisted = await page.evaluate(
      (account) =>
        new Promise((resolve, reject) => {
          const q = indexedDB.open("lumio-local-library-v2", 2);
          q.onsuccess = () => {
            const db = q.result,
              r = db
                .transaction("libraries", "readonly")
                .objectStore("libraries")
                .get(account);
            r.onsuccess = () => {
              db.close();
              resolve(
                r.result?.items.some(
                  (i) =>
                    i.title === "delayed-discard.txt" ||
                    i.text.includes("Không được lưu bản đọc đã hủy"),
                ),
              );
            };
            r.onerror = () => reject(r.error);
          };
          q.onerror = () => reject(q.error);
        }),
      account,
    );
    check(
      delayedPersisted === false,
      "A late discarded file read creates no persisted library row or source text",
    );
    check(
      consoleErrors.length === beforeReadErrors && errors.length === 0,
      "Canceling and settling a delayed file read produces no console or runtime error",
    );
    await page.evaluate(() => {
      File.prototype.text = window.__originalFileText;
      delete window.__releaseDelayedRead;
    });
    if (
      (await page
        .locator("details")
        .filter({ has: page.locator(".lx-materials") })
        .getAttribute("open")) === null
    )
      await page
        .locator("details")
        .filter({ has: page.locator(".lx-materials") })
        .locator(":scope > summary")
        .click();
    await page.locator(".lm-action-grid button").first().click();
    await upload.waitFor();
    await upload
      .locator('input[type="file"]')
      .setInputFiles("work/v7-learner-ui/normal-import.txt");
    await page.locator(".lm-document-title input").waitFor();
    check(
      (await page.locator(".lm-document-title input").inputValue()) ===
        "normal-import.txt",
      "A new normal TXT import still opens its saved material after a canceled read",
    );
    await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
    check(
      (await page.locator(".lm-source-text").inputValue()).includes(
        "tệp văn bản được nhập và lưu bình thường",
      ),
      "Normal TXT import preserves the actual supplied source text",
    );
    // Actual citation actions are tested after an explicitly mocked AI response below.
    const open = async (name) => {
      if (await page.locator(".lm-document-title").count())
        await page
          .getByRole("button", { name: "Về thư viện", exact: true })
          .click();
      await sidebar.getByRole("button", { name, exact: true }).click();
      await page.getByRole("tab", { name: "Hỏi Lumio", exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector(".lm-composer textarea") &&
          !document.querySelector(".lm-composer textarea").disabled,
      );
    };
    await open("KIỂM THỬ · Phương trình");
    await page
      .locator(".lm-composer textarea")
      .fill("Hãy gợi ý điều kiện chia hai vế.");
    await page.locator("[data-full-summary-generate]").click();
    await page
      .locator("[data-tutor-history] [data-source-references]")
      .waitFor();
    let refs = page.locator("[data-tutor-history] [data-source-references]");
    check(
      (await refs
        .getByRole("button", { name: "Xem vị trí trích dẫn", exact: true })
        .count()) === 1 &&
        (await refs
          .getByRole("link", { name: "Mở bản gốc", exact: true })
          .count()) === 1,
      "Internal citation location and external original have distinct accessible actions",
    );
    check(
      (await refs
        .getByRole("link", { name: "Mở bản gốc", exact: true })
        .getAttribute("target")) === "_blank",
      "External source opening is explicit and keeps the learning context",
    );
    await refs
      .getByRole("button", { name: "Xem vị trí trích dẫn", exact: true })
      .click();
    const location = page.getByRole("region", {
      name: "Vị trí trích dẫn",
      exact: true,
    });
    await location.waitFor();
    check(
      (await location.textContent()).includes(quote),
      "Internal source navigation displays the exact cited excerpt",
    );
    check(
      await page
        .locator(".lm-source-text")
        .evaluate(
          (n, q) => n.value.slice(n.selectionStart, n.selectionEnd) === q,
          quote,
        ),
      "Source text selection uses the validated citation offsets",
    );
    await page.screenshot({
      path: "docs/v7/qa-learner-source-location.png",
      fullPage: true,
    });
    for (const width of [320, 375, 390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
        "Cited source view remains within " + width + "px",
      );
      check(
        await location.locator("blockquote").evaluate((n) => {
          const r = n.getBoundingClientRect();
          return r.left >= -1 && r.right <= innerWidth + 1;
        }),
        "Exact source excerpt remains visible without page overflow at " +
          width +
          "px",
      );
      if (width === 390)
        await page.screenshot({
          path: "docs/v7/qa-learner-source-mobile.png",
          fullPage: true,
        });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.getByRole("tab", { name: "Flashcards", exact: true }).click();
    await page
      .locator(".dv-flip-card,.lsv-flip-card,.lm-flashcard")
      .first()
      .click();
    refs = page.locator("[data-source-references]");
    await refs
      .getByRole("button", { name: "Xem vị trí trích dẫn", exact: true })
      .click();
    await location.waitFor();
    check(
      (await location.textContent()).includes(quote),
      "Saved flashcard citation opens the same validated source range",
    );
    await page.getByRole("tab", { name: "Luyện tập", exact: true }).click();
    await page
      .getByRole("button", { name: "Bắt đầu luyện tập", exact: true })
      .click();
    await page.locator(".lm-answers button").first().click();
    await page
      .locator("[data-source-references]")
      .getByRole("button", { name: "Xem vị trí trích dẫn", exact: true })
      .click();
    await location.waitFor();
    check(
      (await location.textContent()).includes(quote),
      "Quiz explanation citation opens the validated source range",
    );
    await page.getByRole("tab", { name: "Luyện tập", exact: true }).click();
    await page.locator(".lsv-quiz-feedback").waitFor();
    await page.locator(".lm-study .lm-button.primary").last().click();
    await page
      .getByRole("tab", { name: "Studio học tập", exact: true })
      .click();
    await page.locator(".ls-generator.summary").click();
    check(
      (await page.locator(".lm-tabs [role=tab]").count()) === 6 &&
        (await page.locator(".lm-task-switch").count()) === 0,
      "Summary is reached inside Studio without a duplicate task switch or document tab",
    );
    await page
      .getByRole("tab", { name: "Nội dung theo chương", exact: true })
      .click();
    await page
      .locator(".lm-rich-summary [data-source-references]")
      .getByRole("button", { name: "Xem vị trí trích dẫn", exact: true })
      .click();
    await location.waitFor();
    check(
      (await location.textContent()).includes(quote),
      "Saved summary chapter citation opens the validated source range",
    );
    await open("KIỂM THỬ · PDF");
    await page
      .locator(".lm-composer textarea")
      .fill("Điều kiện nào trong trang hai?");
    await page.locator("[data-full-summary-generate]").click();
    refs = page.locator("[data-tutor-history] [data-source-references]");
    await refs.waitFor();
    check(
      (
        await refs
          .getByRole("link", { name: "Mở bản gốc", exact: true })
          .getAttribute("href")
      ).endsWith("#page=2"),
      "PDF original action targets the extracted cited page instead of guessing a page",
    );
    await refs
      .getByRole("button", { name: "Xem vị trí trích dẫn", exact: true })
      .click();
    await location.waitFor();
    check(
      (await page.locator("iframe.lm-pdf").getAttribute("src")).endsWith(
        "#page=2",
      ),
      "Internal PDF viewer opens the cited page fragment",
    );
    check(
      (await location.textContent()).includes("KIỂM THỬ · PDF"),
      "Switching materials does not retain another document's citation title",
    );
    await page.getByRole("tab", { name: "Hỏi Lumio", exact: true }).click();
    const scope = page
      .locator("fieldset")
      .filter({ hasText: "Phạm vi đối chiếu nhiều tài liệu" });
    await scope.getByRole("checkbox").first().check();
    await page
      .locator(".lm-composer textarea")
      .fill("Cạnh huyền tam giác trong nguồn B?");
    await page.locator("[data-full-summary-generate]").click();
    refs = page.locator("[data-tutor-history] [data-source-references]");
    await refs.waitFor();
    check(
      (await refs.textContent()).includes(ragRef.rag.title) &&
        (await refs
          .getByRole("link", { name: "Mở bản gốc", exact: true })
          .count()) === 0,
      "RAG references name their own indexed document and never link the currently open PDF",
    );
    await refs
      .getByRole("button", { name: "Xem vị trí trích dẫn", exact: true })
      .click();
    const indexed = page.getByRole("dialog", {
      name: ragRef.rag.title,
      exact: true,
    });
    await indexed.waitFor();
    check(
      (await indexed.textContent()).includes(ragQuote) &&
        !(await indexed.textContent()).includes(quote),
      "RAG action opens its snapshot excerpt rather than another open source",
    );
    check(
      (await indexed.textContent()).includes("không phải toàn bộ tài liệu gốc"),
      "RAG excerpt dialog states that it is a retrieved snapshot, not the full original",
    );
    check(
      (await page
        .getByRole("tab", { name: "Hỏi Lumio", exact: true })
        .getAttribute("aria-selected")) === "true",
      "Opening a RAG excerpt preserves the underlying tutor context",
    );
    await page.keyboard.press("Escape");
    await indexed.waitFor({ state: "hidden" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
      "Tutor citations and indexed scope fit a 390px phone",
    );
    await page.screenshot({
      path: "docs/v7/qa-learner-tutor-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 768, height: 1000 });
    await page.screenshot({
      path: "docs/v7/qa-learner-tablet.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await open("KIỂM THỬ · Website");
    await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
    const linkDraft =
      "BẢN NHÁP LINK CHƯA LƯU · Không phải văn bản trên máy chủ.";
    await page.locator(".lm-source-text").fill(linkDraft);
    check(
      await page.evaluate(() => {
        const e = new Event("beforeunload", { cancelable: true });
        dispatchEvent(e);
        return e.defaultPrevented;
      }),
      "Unsubmitted website source draft activates the native page-leave warning",
    );

    await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
    await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
    check(
      (await page.locator(".lm-source-text").inputValue()) === linkDraft,
      "Website source draft survives a document-tab switch",
    );
    await sidebar
      .getByRole("button", { name: navLabels[0], exact: true })
      .click();
    await decision.waitFor();
    await decision
      .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
      .click();
    check(
      (await page.locator(".lm-source-text").inputValue()) === linkDraft,
      "Keeping a document draft cancels module navigation without losing its source text",
    );
    await sidebar
      .getByRole("button", { name: navLabels[0], exact: true })
      .click();
    await decision
      .getByRole("button", { name: "Bỏ bản nháp", exact: true })
      .click();
    await sidebar
      .getByRole("button", { name: "KIỂM THỬ · Website", exact: true })
      .click();
    await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
    check(
      (await page.locator(".lm-source-text").inputValue()) ===
        "Nội dung đã lưu của trang A.",
      "Explicitly discarded website draft returns to the persisted source on reopen",
    );
    await open("KIỂM THỬ · Phương trình");
    const docTabs = page.getByRole("tablist", {
      name: "KIỂM THỬ · Phương trình",
      exact: true,
    });
    await docTabs.getByRole("tab").first().focus();
    await page.keyboard.press("End");
    check(
      (await docTabs
        .getByRole("tab", { name: "Hỏi Lumio", exact: true })
        .getAttribute("aria-selected")) === "true" &&
        (await docTabs.locator('[tabindex="0"]').count()) === 1,
      "Document tabs support End with a single roving tab stop",
    );
    const active = docTabs.getByRole("tab", { name: "Hỏi Lumio", exact: true });
    const panelId = await active.getAttribute("aria-controls");
    check(
      (await page
        .locator('[id="' + panelId + '"]')
        .getAttribute("aria-labelledby")) === (await active.getAttribute("id")),
      "Document tab and active panel are bidirectionally linked",
    );
    const questionDraft = "CÂU HỎI ĐANG SOẠN CHƯA GỬI";
    await page.locator(".lm-composer textarea").fill(questionDraft);
    await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
    await active.click();
    check(
      (await page.locator(".lm-composer textarea").inputValue()) ===
        questionDraft,
      "Unsent tutor question survives switching document tabs",
    );
    await sidebar
      .getByRole("button", { name: navLabels[0], exact: true })
      .click();
    await decision.waitFor();
    await decision
      .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
      .click();
    check(
      (await page.locator(".lm-composer textarea").inputValue()) ===
        questionDraft,
      "Unsent tutor question guards module leave without making an AI request",
    );
    await page.locator(".lm-composer textarea").fill("");
    await page.getByRole("tab", { name: "Flashcards", exact: true }).click();
    await page.getByRole("button", { name: "Thêm thẻ", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Câu hỏi / mặt trước", exact: true })
      .fill("THẺ RIÊNG CHƯA LƯU");
    await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
    await page.getByRole("tab", { name: "Flashcards", exact: true }).click();
    check(
      (await page
        .getByRole("textbox", { name: "Câu hỏi / mặt trước", exact: true })
        .inputValue()) === "THẺ RIÊNG CHƯA LƯU",
      "Flashcard editor draft survives a tab switch",
    );
    await sidebar
      .getByRole("button", { name: navLabels[0], exact: true })
      .click();
    await decision.waitFor();
    await decision
      .getByRole("button", { name: "Bỏ bản nháp", exact: true })
      .click();
    await sidebar
      .getByRole("button", { name: "KIỂM THỬ · Phương trình", exact: true })
      .click();
    await page.getByRole("tab", { name: "Flashcards", exact: true }).click();
    check(
      (await page
        .getByRole("textbox", { name: "Câu hỏi / mặt trước", exact: true })
        .count()) === 0 &&
        (await page
          .getByText("THẺ RIÊNG CHƯA LƯU", { exact: true })
          .count()) === 0,
      "Discarded flashcard draft is not silently saved as a real card",
    );
    await page.getByRole("tab", { name: "Luyện tập", exact: true }).click();
    await page
      .getByRole("button", { name: "Bắt đầu luyện tập", exact: true })
      .click();
    await sidebar
      .getByRole("button", { name: navLabels[0], exact: true })
      .click();
    await decision.waitFor();
    await decision
      .getByRole("button", { name: "Tiếp tục chỉnh sửa", exact: true })
      .click();
    check(
      (await page.locator(".lm-answers button").count()) === 4,
      "Active unanswered quiz is preserved when module leave is canceled",
    );
    await sidebar
      .getByRole("button", { name: navLabels[0], exact: true })
      .click();
    await decision
      .getByRole("button", { name: "Bỏ bản nháp", exact: true })
      .click();
    await sidebar
      .getByRole("button", { name: "KIỂM THỬ · Phương trình", exact: true })
      .click();
    await page
      .getByRole("tab", { name: "Studio học tập", exact: true })
      .click();
    await page.locator(".ls-generator.lesson").click();
    await page.locator(".ls-plan-editor").fill("KẾ HOẠCH CHƯA LƯU VÀO GHI CHÚ");
    await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
    await page
      .getByRole("tab", { name: "Studio học tập", exact: true })
      .click();
    await page.locator(".ls-generator.lesson").click();
    check(
      (await page.locator(".ls-plan-editor").inputValue()) ===
        "KẾ HOẠCH CHƯA LƯU VÀO GHI CHÚ",
      "Studio plan draft survives a tab switch",
    );
    await sidebar
      .getByRole("button", { name: navLabels[0], exact: true })
      .click();
    await decision.waitFor();
    await decision
      .getByRole("button", { name: "Bỏ bản nháp", exact: true })
      .click();
    await sidebar
      .getByRole("button", { name: "KIỂM THỬ · Phương trình", exact: true })
      .click();
    await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
    check(
      !(await page.locator(".lm-notes").inputValue()).includes(
        "KẾ HOẠCH CHƯA LƯU",
      ),
      "Discarded Studio plan never becomes a saved note",
    );
    await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
    await page
      .locator(".lm-source-text")
      .fill(source + "\n\nĐoạn bổ sung đã tự lưu.");
    await page.waitForFunction(
      () => !!document.querySelector(".lm-save-state.saved"),
    );
    await sidebar
      .getByRole("button", { name: navLabels[0], exact: true })
      .click();
    check(
      (await decision.count()) === 0 &&
        (await page.locator(".lm-document-title").count()) === 0,
      "An auto-saved plain-text source does not trigger a false unsaved-draft decision",
    );
    // A fresh account uses a separately keyed local library; admin entry is permission-derived.
    admin = true;
    await page.evaluate((s) => window.__mountLearner(s), {
      ...session,
      accountKey: "qa-v7-learner-b",
      userId: "qa-v7-user-b",
      user: { name: "KIỂM THỬ · BÌNH" },
    });
    await page
      .locator(".lm-profile")
      .filter({ hasText: "KIỂM THỬ · BÌNH" })
      .waitFor();
    await sidebar.locator('a[href="/admin"]').waitFor();
    check(
      (await sidebar.locator('a[href="/admin"]').count()) === 1,
      "Admin route entry appears only after the account capability response",
    );
    check(
      (await sidebar
        .getByRole("button", { name: "KIỂM THỬ · Phương trình", exact: true })
        .count()) === 0 &&
        (await page.locator(".lm-document-title").count()) === 0,
      "Account remount clears the previous account's recent sources and private document view",
    );
    check(
      errors.length === 0,
      "No runtime errors through grouped navigation, drawer, draft and citation flows",
    );
    check(
      unexpected.length === 0,
      "No unexpected mutation escaped the synthetic HTTP boundary",
    );
    check(external.length === 0, "No external site or provider was contacted");
    return {
      status: "PASS",
      passed: passed.length,
      cases: passed,
      errors,
      unexpectedRequests: unexpected,
      paidProviderRequests: 0,
      syntheticAIRequests: aiRequests.length,
      syntheticKeywordSearches: sourceSearches.length,
      screenshots: [
        "docs/v7/qa-learner-desktop.png",
        "docs/v7/qa-learner-source-location.png",
        "docs/v7/qa-learner-source-mobile.png",
        "docs/v7/qa-learner-tutor-mobile.png",
        "docs/v7/qa-learner-tablet.png",
        "docs/v7/qa-settings-desktop.png",
        "docs/v7/qa-settings-mobile.png",
        "docs/v7/qa-settings-expanded-mobile.png",
        "docs/v7/qa-settings-keyboard-focus.png",
      ],
      scope:
        "Actual learner components/CSS/IndexedDB; synthetic account, authored sources and intercepted AI responses only. No server citation-proof or provider accuracy claim.",
    };
  } catch (error) {
    await page.screenshot({
      path: "docs/v7/qa-learner-current-failure.png",
      fullPage: true,
    });
    return {
      status: "FAIL",
      passed: passed.length,
      cases: passed,
      error: error.message,
      errors,
      unexpectedRequests: unexpected,
      syntheticAIRequests: aiRequests.length,
      snapshot: (await page.locator("body").innerText()).slice(-4500),
      scope:
        "Synthetic browser fixture failure; no external providers contacted",
    };
  }
};
