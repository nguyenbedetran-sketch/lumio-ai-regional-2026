// Explicit isolated CLI QA. Only synthetic local library/auth/provider responses.
// Every /api/ai request is fulfilled below; external media/network are blocked.
async function lumioFullSummaryQA(page) {
  const passed = [],
    errors = [],
    requests = [],
    external = [];
  const check = (ok, label) => {
    if (!ok) throw new Error(label);
    passed.push(label);
  };
  const account = "qa-full-summary-synthetic";
  let mode = "normal",
    sequence = 0,
    active = 0,
    maximumActive = 0,
    pending = null;
  page.on("pageerror", (error) => errors.push(error.message));
  const config = {
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
  };
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (
      /^https?:\/\//.test(url) &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?\//.test(url)
    ) {
      external.push(url.match(/^https?:\/\/[^/]+/)[0]);
      await route.abort();
    } else await route.continue();
  });
  await page.route("**/api/config", (route) => route.fulfill({ json: config }));
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: { name: "Synthetic summary QA" },
        accountKey: account,
        expires: "2099-01-01T00:00:00.000Z",
      },
    }),
  );
  await page.route("**/api/ai", async (route) => {
    const body = route.request().postDataJSON();
    const range = body.videoRange;
    const current = {
      scope: range || null,
      youtubeUrl: body.youtubeUrl || null,
      source: body.source,
      task: body.task,
      media: body.media?.mimeType || null,
    };
    requests.push(current);
    active++;
    maximumActive = Math.max(maximumActive, active);
    try {
      if (mode === "cancel" && sequence++ === 1)
        await new Promise((resolve) => {
          pending = resolve;
        });
      if (mode === "fail") {
        await route.fulfill({
          status: 402,
          json: { error: "INSUFFICIENT_CREDITS" },
        });
        return;
      }
      const start = range?.startSeconds || 0,
        end = range?.endSeconds || 60;
      const chapters = [0, 1].map((index) => ({
        title: `Synthetic chapter ${start}-${index}`,
        summary: `Synthetic explanation from ${start} seconds, chapter ${index}.`,
        bullets: [`Synthetic point ${start}-${index}`],
        startSeconds: Math.min(
          end - 1,
          start + index * Math.max(1, Math.floor((end - start) / 2)),
        ),
        timestampKind: range ? "approximate" : "none",
      }));
      await route.fulfill({
        json: {
          provider: "gemini",
          model: "synthetic-test-only",
          text: `Synthetic part ${start}`,
          summary: {
            title: `Synthetic part ${start}`,
            overview: `Synthetic overview for source range ${start} to ${end}.`,
            keyPoints: [`Synthetic key ${start}`, `Synthetic extra ${start}`],
            chapters,
            mindMap: {
              nodes: [
                {
                  id: "root",
                  label: `Part ${start}`,
                  detail: "Synthetic root",
                  chapterIndex: 0,
                },
                {
                  id: "child",
                  label: "Synthetic detail",
                  detail: "Synthetic concept",
                  chapterIndex: 1,
                },
              ],
              edges: [{ source: "root", target: "child" }],
            },
          },
        },
      });
    } catch (error) {
      // The deliberately cancelled browser fetch may already be gone.
      if (
        mode !== "cancel" &&
        !/cancel|abort|closed|handled/i.test(String(error))
      )
        throw error;
    } finally {
      active--;
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem("lumio-language", "vi");
    localStorage.setItem("lumio-theme", "light");
    localStorage.setItem("lumio-motion-v3", "off");
  });
  await page.evaluate(async (account) => {
    const now = "2026-10-03T00:00:00.000Z";
    const base = {
      kind: "link",
      spaceId: "",
      createdAt: now,
      updatedAt: now,
      text: "",
      notes: "",
      cards: [],
      questions: [],
      attempts: [],
      favorite: false,
      url: "https://www.youtube.com/watch?v=QAfull00001",
    };
    const data = {
      version: 1,
      spaces: [],
      items: [
        { ...base, id: "qa-whole", title: "QA Whole Synthetic Video" },
        { ...base, id: "qa-cancel", title: "QA Cancel Synthetic Video" },
        { ...base, id: "qa-range", title: "QA Range Synthetic Video" },
        {
          ...base,
          id: "qa-truncated",
          title: "QA Truncated Synthetic Captions",
          text: "[00:00] Only the initial source text was imported.",
          sourceInfo: { kind: "captions", fetchedAt: now, truncated: true },
        },
        {
          ...base,
          id: "qa-text",
          title: "QA Full Synthetic Text",
          kind: "text",
          url: undefined,
          text: "Synthetic complete lesson. First concept is a triangle. Second concept is its area. Last concept is checking units.",
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
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }, account);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .locator(".lm-profile")
    .filter({ hasText: "Synthetic summary QA" })
    .waitFor();
  const navigate = async (title) => {
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByRole("combobox").fill(title);
    await page.keyboard.press("Enter");
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("tab", { name: "Tóm tắt", exact: true }).click();
    await page.locator(".lm-full-summary-scope").waitFor();
  };
  const generate = () => page.locator("[data-full-summary-generate]");
  const whole = () => page.locator("[data-full-summary-action='whole']");
  const range = () => page.locator("[data-full-summary-action='range']");
  const saved = async (id) =>
    page.evaluate(
      async ({ account, id }) =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("lumio-local-library-v2", 2);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result,
              tx = db.transaction("libraries", "readonly"),
              library = tx.objectStore("libraries").get(account);
            tx.oncomplete = () => {
              db.close();
              resolve(library.result.items.find((item) => item.id === id));
            };
            tx.onerror = () => {
              db.close();
              reject(tx.error);
            };
          };
        }),
      { account, id },
    );
  await navigate("QA Whole Synthetic Video");
  check(
    (await whole().getAttribute("aria-pressed")) === "true",
    "Summary defaults to the entire source",
  );
  check(
    await generate().isDisabled(),
    "Unknown full duration blocks generation instead of silently summarizing ten minutes",
  );
  check(
    (await page.locator(".lm-video-range").count()) === 0,
    "Default whole summary does not expose a preselected ten-minute range",
  );
  await page
    .getByRole("textbox", { name: "Tổng thời lượng video", exact: true })
    .fill("70:00");
  check(
    await generate().isDisabled(),
    "A declared duration does not mark an unconfirmed live video as a completed source",
  );
  await page.locator("[data-full-summary-finished]").check();
  await generate().waitFor({ state: "visible" });
  await page.waitForFunction(
    () => !document.querySelector("[data-full-summary-generate]").disabled,
  );
  check(
    requests.length === 0,
    "Filling duration does not auto-call an AI service",
  );
  await generate().click();
  await page.locator("[data-summary-coverage='whole']").waitFor();
  check(
    requests.length === 7,
    "Seventy-minute video sends all seven ten-minute source sections",
  );
  check(
    requests.every(
      (r, i) =>
        r.scope.startSeconds === i * 600 &&
        r.scope.endSeconds === (i + 1) * 600,
    ),
    "Sections cover the whole source contiguously from zero to the final minute",
  );
  check(
    maximumActive === 1,
    "Whole-source requests run sequentially without overlapping provider calls",
  );
  check(
    requests.every(
      (r) => r.task === "summary" && r.youtubeUrl.includes("QAfull00001"),
    ),
    "All mocked requests retain the selected source and summary task",
  );
  const summary = page.locator(".lm-rich-summary");
  await summary
    .getByRole("tab", { name: "Nội dung theo chương", exact: true })
    .click();
  check(
    (await summary.locator(".lm-summary-chapters aside button").count()) === 14,
    "Merged summary preserves chapters from every section",
  );
  await summary.locator(".lm-summary-chapters aside button").last().click();
  check(
    (
      await summary.locator(".lm-summary-chapters article").innerText()
    ).includes("Synthetic chapter 3600-1"),
    "Final source chapter is accessible in the chapter navigation",
  );
  check(
    (await summary.locator(".lm-timestamp").innerText()).includes("1:05:00"),
    "Late chapter timestamp remains absolute original-video time",
  );
  await summary.getByRole("tab", { name: "Sơ đồ tư duy", exact: true }).click();
  check(
    (await summary.locator(".lm-map-node-list button").count()) === 8,
    "The whole-source map links all seven processed sections",
  );
  check(
    (
      await page.locator("[data-summary-coverage='whole']").innerText()
    ).includes("Thời lượng do bạn nhập"),
    "Declared duration is distinguished from detected metadata",
  );
  await page.waitForFunction(
    () => !document.querySelector("[data-full-summary-generate]").disabled,
  );
  const wholeItem = await saved("qa-whole");
  check(
    wholeItem.artifacts?.at(-1)?.summary.chapters.length === 14,
    "Every completed chapter is persisted in the isolated library",
  );
  check(
    wholeItem.artifacts.at(-1).source.coverage.parts.length === 7 &&
      !wholeItem.artifacts.at(-1).source.range,
    "Persistence records complete coverage separately from a selected range",
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "docs/qa-full-summary-whole.png",
    fullPage: true,
  });

  await navigate("QA Cancel Synthetic Video");
  await page
    .getByRole("textbox", { name: "Tổng thời lượng video", exact: true })
    .fill("30:00");
  await page.locator("[data-full-summary-finished]").check();
  mode = "cancel";
  sequence = 0;
  const beforeCancel = requests.length;
  await generate().click();
  await page
    .locator("[data-full-summary-progress][data-completed='1'][data-total='3']")
    .waitFor();
  await page.getByRole("button", { name: "Hủy yêu cầu", exact: true }).click();
  await page.locator(".lm-full-summary-incomplete").waitFor();
  check(
    requests.length === beforeCancel + 2,
    "Cancellation stops before requesting the remaining sections",
  );
  check(
    (await page.locator("[data-summary-coverage='whole']").count()) === 0,
    "Cancelled partial work is not presented as complete coverage",
  );
  check(
    !(await saved("qa-cancel")).artifacts?.length,
    "Cancelled partial work does not save a false whole-source artifact",
  );
  check(
    (await generate().innerText()).includes("Tiếp tục tóm tắt toàn bộ"),
    "Cancelled job offers explicit continuation using retained sections",
  );
  if (pending) {
    const release = pending;
    pending = null;
    release();
  }
  await page.waitForTimeout(50);
  mode = "normal";
  const beforeResume = requests.length;
  await generate().click();
  await page.locator("[data-summary-coverage='whole']").waitFor();
  check(
    requests.length === beforeResume + 2,
    "Resuming processes only the two remaining sections",
  );
  check(
    requests[beforeResume].scope.startSeconds === 600 &&
      requests.at(-1).scope.endSeconds === 1800,
    "Resume starts after the cached first section and reaches the source end",
  );
  await page.waitForFunction(
    () => !document.querySelector("[data-full-summary-generate]").disabled,
  );
  check(
    (await saved("qa-cancel")).artifacts.at(-1).summary.chapters.length === 6,
    "Resumed whole summary merges cached and new chapters",
  );

  await navigate("QA Range Synthetic Video");
  await range().click();
  check(
    (await range().getAttribute("aria-pressed")) === "true",
    "A selected section remains an explicit alternative to whole-source summary",
  );
  await page
    .getByRole("textbox", { name: "Bắt đầu", exact: true })
    .fill("20:00");
  await page
    .getByRole("textbox", { name: "Kết thúc", exact: true })
    .fill("25:00");
  const beforeRange = requests.length;
  await generate().click();
  await page.locator(".lm-rich-summary").waitFor();
  check(
    requests.length === beforeRange + 1 &&
      requests.at(-1).scope.startSeconds === 1200 &&
      requests.at(-1).scope.endSeconds === 1500,
    "Explicit five-minute section makes exactly one correctly scoped request",
  );
  check(
    (await page.locator("[data-summary-coverage='whole']").count()) === 0,
    "Section output is not mislabeled as an entire-source result",
  );
  await page.waitForFunction(
    () => !document.querySelector("[data-full-summary-generate]").disabled,
  );
  const rangeArtifact = (await saved("qa-range")).artifacts.at(-1);
  check(
    rangeArtifact.source.range.startSeconds === 1200 &&
      !rangeArtifact.source.coverage,
    "Saved section artifact has a range without whole-source coverage",
  );

  await navigate("QA Truncated Synthetic Captions");
  const beforeTruncated = requests.length;
  await page
    .getByRole("alert")
    .filter({ hasText: "Nội dung nhập vào đã bị cắt bớt" })
    .waitFor();
  check(
    await generate().isDisabled(),
    "Truncated source visibly blocks whole-source generation",
  );
  check(
    requests.length === beforeTruncated,
    "Truncated imported captions cannot be declared a complete source",
  );

  await navigate("QA Full Synthetic Text");
  const beforeText = requests.length;
  await generate().click();
  await page.locator("[data-summary-coverage='whole']").waitFor();
  check(
    requests.length === beforeText + 1 && requests.at(-1).scope === null,
    "Whole text sends all supplied text once without inventing video time ranges",
  );
  check(
    requests.at(-1).source.endsWith("checking units."),
    "The final part of the complete text reaches the request intact",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
    "Whole-summary controls fit a phone viewport without page overflow",
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "docs/qa-full-summary-mobile.png",
    fullPage: true,
  });
  check(
    errors.length === 0,
    `No runtime or hydration errors: ${errors.join(" | ")}`,
  );
  check(
    requests.length > 0 &&
      requests.every((request) => request.task === "summary"),
    "Every simulated AI request is a summary and all are intercepted locally",
  );
  return {
    status: "PASS",
    count: passed.length,
    checks: passed,
    provider: "synthetic local route fixtures only",
    paidProviderRequests: 0,
    mockedRequests: requests.length,
    maxConcurrentRequests: maximumActive,
    externalOriginsBlocked: [...new Set(external)],
    errors,
  };
}
