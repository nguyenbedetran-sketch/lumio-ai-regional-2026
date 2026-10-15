// Isolated synthetic citation UI evidence. Provider responses are not generated or claimed real.
async (page) => {
  const passed = [],
    errors = [],
    paid = [];
  const check = (condition, label) => {
    if (!condition) throw new Error(label);
    passed.push(label);
  };
  const account = "qa-regional-sources-synthetic";
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", async (route) => {
    const r = route.request(),
      url = r.url();
    if (!/^https?:\/\//.test(url)) return route.continue();
    if (!/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//.test(url))
      return route.abort();
    if (/^http:\/\/[^/]+\/api\//.test(url) && r.method() !== "GET") {
      paid.push(url.split("/").slice(3).join("/"));
      return route.fulfill({
        status: 409,
        json: { error: "SYNTHETIC_QA_NO_WRITES" },
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
        user: { name: "Synthetic source QA" },
        accountKey: account,
        expires: "2099-01-01T00:00:00Z",
      },
    }),
  );
  await page.route("**/api/account", (r) =>
    r.fulfill({
      json: {
        authenticated: true,
        id: account,
        name: "Synthetic source QA",
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
  await page.reload();
  await page.evaluate(async (account) => {
    const now = new Date().toISOString(),
      text =
        "Một phương trình cân bằng khi hai vế có cùng giá trị.\n\nChỉ được chia hai vế cho cùng một số khác không.";
    const refs = [
      {
        segmentId: "s2",
        quote: "Chỉ được chia hai vế cho cùng một số khác không.",
        start: 57,
        end: 107,
        paragraph: 2,
        verification: "exact-excerpt",
        page: 999,
        url: "https://not-a-source.invalid",
      },
    ];
    const base = {
      kind: "text",
      spaceId: "",
      createdAt: now,
      updatedAt: now,
      text,
      notes: "",
      cards: [],
      questions: [],
      attempts: [],
      favorite: false,
    };
    const summary = {
      title: "Đối chiếu nguồn · Fixture kiểm thử UI",
      overview: "Cần giữ cân bằng hai vế và điều kiện trước khi chia.",
      keyPoints: ["Hai vế có cùng giá trị."],
      chapters: [
        {
          title: "Điều kiện phép chia",
          summary: "Phép chia phải dùng số khác không.",
          bullets: ["Kiểm tra số chia trước khi biến đổi."],
          timestampKind: "none",
          references: refs,
        },
        {
          title: "Nguồn chưa xác định",
          summary: "Fixture chỉ để kiểm tra trạng thái chưa có trích dẫn.",
          bullets: [],
          timestampKind: "none",
          references: [
            {
              segmentId: "s2",
              quote: "Đây là đoạn trích không tồn tại trong tài liệu.",
            },
          ],
        },
      ],
      mindMap: {
        nodes: [
          { id: "root", label: "Phương trình", detail: "" },
          { id: "divide", label: "Điều kiện", detail: "", chapterIndex: 0 },
        ],
        edges: [{ source: "root", target: "divide" }],
      },
    };
    const data = {
      version: 1,
      spaces: [],
      items: [
        {
          ...base,
          id: "qa-source",
          title: "Đối chiếu nguồn · kiểm thử UI",
          cards: [
            {
              id: "c1",
              front: "Có thể chia hai vế cho số 0 không?",
              back: "Không. Số chia phải khác không.",
              references: refs,
            },
          ],
          questions: [
            {
              id: "q1",
              prompt: "Phép biến đổi nào giữ cân bằng?",
              options: [
                "Chia hai vế cho cùng số khác không",
                "Chia hai vế cho số 0",
                "Chỉ chia một vế",
                "Bỏ điều kiện",
              ],
              correct: 0,
              explanation: "Hai vế phải chia cùng một số khác không.",
              topic: "Biến đổi phương trình",
              difficulty: "beginner",
              references: refs,
            },
          ],
          artifacts: [
            {
              id: "a1",
              kind: "summary",
              createdAt: now,
              summary,
              source: {
                kind: "text",
                title: "Văn bản kiểm thử UI",
                contentLength: text.length,
                coverage: { scope: "whole", method: "full-text" },
              },
            },
          ],
        },
      ],
    };
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("lumio-local-library-v2", 2);
      request.onupgradeneeded = () => {
        for (const name of ["libraries", "revisions"])
          if (!request.result.objectStoreNames.contains(name))
            request.result.createObjectStore(name);
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result,
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
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page
    .locator(".lm-profile")
    .filter({ hasText: "Synthetic source QA" })
    .waitFor();
  await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.getByRole("combobox").fill("Đối chiếu nguồn · kiểm thử UI");
  await page.keyboard.press("Enter");
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("tab", { name: "Flashcards", exact: true }).click();
  check(
    (await page.locator("[data-source-references]").count()) === 0,
    "Flashcard does not reveal answer citations before flipping",
  );
  await page.locator(".lsv-flip-card").click();
  await page.locator("[data-source-references]").waitFor();
  check(
    (await page
      .locator("[data-source-references]")
      .getAttribute("data-reference-count")) === "1",
    "Flashcard validates the exact supplied excerpt",
  );
  check(
    (await page.locator("[data-source-references]").textContent()).includes(
      "Đoạn 2",
    ),
    "Paragraph location comes from the actual text",
  );
  check(
    !(await page.locator("[data-source-references]").textContent()).includes(
      "999",
    ),
    "Forged page number is not rendered as verified",
  );
  check(
    (await page
      .locator('[data-source-references] a[href*="not-a-source"]')
      .count()) === 0,
    "Model-supplied external citation URL is never rendered",
  );
  check(
    (await page.locator("[data-source-references]").textContent()).includes(
      "chưa chứng minh câu trả lời AI đúng",
    ),
    "Matching excerpt is not mislabeled as semantic proof",
  );
  await page.screenshot({
    path: "docs/regional/qa-source-card-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Luyện tập", exact: true }).click();
  await page
    .getByRole("button", { name: "Bắt đầu luyện tập", exact: true })
    .click();
  check(
    (await page.locator("[data-source-references]").count()) === 0,
    "Quiz citations wait until the learner answers",
  );
  await page.locator(".lm-answers button").first().click();
  await page.locator("[data-source-references]").waitFor();
  check(
    (await page
      .locator("[data-source-references]")
      .getAttribute("data-reference-count")) === "1",
    "Quiz explanation includes the checked source excerpt",
  );
  check(
    (
      await page.locator("[data-source-references] blockquote").textContent()
    ).includes("khác không"),
    "Mathematical condition remains visible in the source excerpt",
  );
  await page.screenshot({
    path: "docs/regional/qa-source-quiz-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Tóm tắt", exact: true }).click();
  await page
    .getByRole("tab", { name: "Nội dung theo chương", exact: true })
    .click();
  await page.locator("[data-source-references]").waitFor();
  check(
    (await page
      .locator("[data-source-references]")
      .getAttribute("data-reference-count")) === "1",
    "Summary chapter exposes its matching excerpt",
  );
  await page.getByRole("button", { name: /Nguồn chưa xác định/ }).click();
  check(
    (await page
      .locator("[data-source-references]")
      .getAttribute("data-reference-count")) === "0",
    "Invented excerpt is rejected at the UI boundary",
  );
  check(
    (await page.locator("[data-source-references]").textContent()).includes(
      "Chưa xác định được vị trí nguồn",
    ),
    "Unknown source is clearly shown instead of invented metadata",
  );
  await page.screenshot({
    path: "docs/regional/qa-source-unknown-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    ),
    "Source panel fits a phone viewport without horizontal overflow",
  );
  await page.screenshot({
    path: "docs/regional/qa-source-mobile.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
  check(
    (
      await page
        .getByRole("textbox", { name: "Văn bản gốc", exact: true })
        .inputValue()
    ).includes("khác không"),
    "Original text remains available for comparison",
  );
  check(
    paid.length === 0,
    "Viewing source evidence never starts an AI or server mutation",
  );
  check(
    errors.length === 0,
    "No browser runtime errors in source/card/quiz/summary flows",
  );
  return {
    status: "PASS",
    checks: passed.length,
    passed,
    errors,
    paidProviderRequests: 0,
    data: "Synthetic UI fixtures only. Actual extraction/signatures are tested separately; no real students or model accuracy claims.",
    screenshots: [
      "docs/regional/qa-source-card-desktop.png",
      "docs/regional/qa-source-quiz-desktop.png",
      "docs/regional/qa-source-unknown-desktop.png",
      "docs/regional/qa-source-mobile.png",
    ],
  };
};
