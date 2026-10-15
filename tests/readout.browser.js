// Isolated browser QA. Silent synthetic WAV responses; never call a paid provider
// or attach to the user's account/browser. play() is observed without speakers.
async function lumioReadoutQA(page) {
  const passed = [],
    errors = [],
    requests = [],
    external = [];
  const tutorRequests = [];
  const check = (ok, label) => {
    if (!ok) throw new Error(label);
    passed.push(label);
  };
  const account = "qa-readout-synthetic";
  let responseMode = "audio",
    pending = null;
  page.on("pageerror", (error) => errors.push(error.message));
  // The CLI sandbox has no Node Buffer. Keep WAV bytes ASCII-compatible so
  // route.fulfill's UTF-8 string preserves the exact binary header and silence.
  const bytes = new Uint8Array(44 + 1024), header = new DataView(bytes.buffer);
  const ascii = (text, offset) => { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i); };
  ascii("RIFF", 0); header.setUint32(4, bytes.length - 8, true); ascii("WAVE", 8);
  ascii("fmt ", 12); header.setUint32(16, 16, true); header.setUint16(20, 1, true); header.setUint16(22, 1, true);
  header.setUint32(24, 4096, true); header.setUint32(28, 8192, true); header.setUint16(32, 2, true); header.setUint16(34, 16, true);
  ascii("data", 36); header.setUint32(40, 1024, true);
  const wav = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (
      /^https?:\/\//.test(url) &&
      !/^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?\//.test(url)
    ) {
      external.push(url);
      await route.abort();
    } else await route.continue();
  });
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: {
        google: true,
        facebook: false,
        ai: true,
        capabilities: {
          tutor: true,
          summary: false,
          media: false,
          transcription: false,
          speech: true,
        },
      },
    }),
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        user: { name: "Synthetic readout QA" },
        accountKey: account,
        expires: "2099-01-01T00:00:00.000Z",
      },
    }),
  );
  await page.route("**/api/ai", (route) => {
    tutorRequests.push(route.request().postDataJSON());
    return route.fulfill({ json: { text: "Câu trả lời giả để kiểm tra nút đọc thủ công.", provider: "openai", model: "synthetic-test-only" } });
  });
  await page.route("**/api/voice", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const mode = responseMode;
    try {
      if (mode === "pending")
        await new Promise((resolve) => {
          pending = resolve;
        });
      if (mode === "empty")
        await route.fulfill({
          status: 200,
          contentType: "audio/wav",
          body: "",
        });
      else if (mode === "html")
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!DOCTYPE html><title>Synthetic bad response</title>",
        });
      else if (mode === "error")
        await route.fulfill({
          status: 402,
          json: { error: "INSUFFICIENT_CREDITS" },
        });
      else
        await route.fulfill({
          status: 200,
          contentType: "audio/wav",
          body: wav,
        });
    } catch (error) {
      if (
        mode !== "pending" &&
        !/cancel|abort|closed|handled/i.test(String(error))
      )
        throw error;
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem("lumio-language", "vi");
    localStorage.setItem("lumio-theme", "light");
    localStorage.setItem("lumio-motion-v3", "off");
    const qa = (window.__readoutQA = {
      mode: "normal",
      plays: [],
      pauses: [],
      created: [],
      revoked: [],
    });
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = function (blob) {
      const url = create(blob);
      qa.created.push({ url, type: blob.type, size: blob.size });
      return url;
    };
    URL.revokeObjectURL = function (url) {
      qa.revoked.push(url);
      revoke(url);
    };
    HTMLMediaElement.prototype.play = function () {
      this.muted = true;
      qa.plays.push({
        src: this.src,
        controls: this.controls,
        tag: this.tagName,
      });
      if (qa.mode === "blocked")
        return Promise.reject(
          new DOMException("Synthetic playback policy", "NotAllowedError"),
        );
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      qa.pauses.push(this.src);
      this.dispatchEvent(new Event("pause"));
    };
  });
  await page.evaluate(async (account) => {
    const now = "2026-10-03T00:00:00.000Z",
      base = {
        kind: "text",
        spaceId: "",
        createdAt: now,
        updatedAt: now,
        notes: "",
        cards: [],
        questions: [],
        attempts: [],
        favorite: false,
      };
    const data = {
      version: 1,
      spaces: [],
      items: [
        {
          ...base,
          id: "qa-readout-short",
          title: "QA Readout Short Text",
          text: "Bài học tổng hợp. Tam giác có ba cạnh. Diện tích tam giác bằng đáy nhân chiều cao chia hai. Kiểm tra đơn vị trước khi kết luận.",
        },
        {
          ...base,
          id: "qa-readout-long",
          title: "QA Readout Long Text",
          text:
            "Khởi đầu của tài liệu. " +
            "Nội dung tiếp theo nói về cách học và kiểm tra kiến thức theo từng phần rõ ràng. ".repeat(
              90,
            ) +
            "KẾT THÚC TOÀN BỘ TÀI LIỆU.",
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
    .filter({ hasText: "Synthetic readout QA" })
    .waitFor();
  const navigate = async (title) => {
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByRole("combobox").fill(title);
    await page.keyboard.press("Enter");
    await dialog.waitFor({ state: "hidden" });
    await page.getByRole("tab", { name: "Tóm tắt", exact: true }).click();
    await panel().waitFor();
  };
  const panel = () => page.locator("[data-audio-readout]");
  const action = (value) => panel().locator(`[data-readout-action="${value}"]`);
  const player = () => panel().locator("[data-readout-player]");
  const phase = (value) =>
    page.locator(`[data-audio-readout][data-phase="${value}"]`).waitFor();
  const audioURLs = () =>
    page.evaluate(() =>
      window.__readoutQA.created.filter((entry) =>
        entry.type.startsWith("audio/"),
      ),
    );
  const ended = () =>
    player().evaluate((audio) => audio.dispatchEvent(new Event("ended")));
  try {
    await navigate("QA Readout Short Text");
    check(
      await action("start").isEnabled(),
      "Readout button enabled for a nonempty source and configured speech capability",
    );
    check(
      requests.length === 0,
      "Loading the source never generates speech automatically",
    );
    await action("start").click();
    await page.waitForFunction(() => window.__readoutQA.plays.length > 0);
    check(
      requests.length === 1,
      "First explicit click makes one bounded authenticated voice request",
    );
    check(
      requests[0].text.includes("Tam giác") && requests[0].text.length <= 3000,
      "The selected source text reaches speech generation without clipping or empty text",
    );
    check(
      (await player().isVisible()) &&
        (await player().getAttribute("controls")) !== null,
      "Generated audio has visible native playback controls",
    );
    check(
      await page.evaluate(() =>
        window.__readoutQA.plays[0].src.startsWith("blob:"),
      ),
      "Successful click attempts to play generated audio immediately",
    );
    await player().evaluate((audio) => audio.dispatchEvent(new Event("pause")));
    check(await panel().getAttribute("data-phase") === "paused", "Native pause controls update the readout state");
    await player().evaluate((audio) => audio.dispatchEvent(new Event("play")));
    check(requests.length === 1 && await panel().getAttribute("data-phase") === "playing", "Native resume reuses the current audio without another request");
    const firstURL = (await audioURLs()).at(-1).url;
    await action("stop").click();
    check(
      await page.evaluate(
        (url) => window.__readoutQA.revoked.includes(url),
        firstURL,
      ),
      "Stopping releases the active object URL",
    );

    await page.evaluate(() => {
      window.__readoutQA.mode = "blocked";
    });
    const blockedStart = requests.length;
    await action("start").click();
    await page.waitForFunction(() => window.__readoutQA.plays.length > 1);
    await player().waitFor();
    check(
      requests.length === blockedStart + 1,
      "Playback policy refusal does not repeatedly regenerate paid audio",
    );
    check(
      await player().isVisible(),
      "Autoplay refusal keeps manual playback controls visible",
    );
    check(
      (await panel().locator("[data-readout-status]").textContent()).trim()
        .length > 0,
      "Playback policy refusal provides a nearby recovery message",
    );
    await page.evaluate(() => {
      window.__readoutQA.mode = "normal";
    });
    await player().evaluate((audio) => audio.dispatchEvent(new Event("play")));
    check(
      requests.length === blockedStart + 1,
      "Manual playback recovery reuses generated audio without another voice request",
    );
    await action("stop").click();

    for (const mode of ["empty", "html"]) {
      responseMode = mode;
      await action("start").click();
      await panel().locator("[data-readout-error]").waitFor();
      check(
        (await panel().locator("[data-readout-error]").textContent()).trim()
          .length > 0,
        `${mode} speech responses show a visible inline error`,
      );
      check(
        await action("start").isEnabled(),
        `${mode} response failure unlocks retry`,
      );
    }
    responseMode = "pending";
    const beforeCancelURLs = (await audioURLs()).length,
      beforeCancel = requests.length;
    await action("start").click();
    await page.waitForFunction(
      () =>
        document.querySelector("[data-audio-readout]").dataset.phase ===
        "loading",
    );
    await action("stop").click();
    const releaseCancel = pending;
    pending = null;
    releaseCancel?.();
    await page.waitForTimeout(160);
    check(
      requests.length === beforeCancel + 1,
      "Cancel aborts exactly the user-started pending speech request",
    );
    check(
      (await audioURLs()).length === beforeCancelURLs,
      "Late speech completion after cancel cannot create or play an audio URL",
    );
    check(
      await action("start").isEnabled(),
      "Canceled request leaves a working start button",
    );

    responseMode = "audio";
    const beforeSourceChange = requests.length;
    await navigate("QA Readout Long Text");
    check(requests.length === beforeSourceChange, "Switching to another source does not generate speech automatically");
    const longStart = requests.length;
    await action("start").click();
    await player().waitFor();
    await page.waitForFunction(() =>
      document.querySelector("[data-readout-player]")?.src?.startsWith("blob:"),
    );
    check(
      requests.length === longStart + 1,
      "Long text initially generates only its first speech part",
    );
    check(
      requests.at(-1).text.length <= 3000 &&
        !requests.at(-1).text.includes("KẾT THÚC"),
      "Long source begins at the start and retains later text for remaining parts",
    );
    await page.waitForTimeout(160);
    check(
      requests.length === longStart + 1,
      "No later speech parts are charged before the current audio ends",
    );
    const firstLongURL = (await audioURLs()).at(-1).url;
    const beforeNextPartURLs = (await audioURLs()).length;
    await ended();
    await page.waitForFunction(
      (before) =>
        window.__readoutQA.created.filter((entry) =>
          entry.type.startsWith("audio/"),
        ).length > before,
      beforeNextPartURLs,
    );
    check(
      requests.length === longStart + 2,
      "Audio ended requests exactly the next part lazily",
    );
    check(
      await page.evaluate(
        (url) => window.__readoutQA.revoked.includes(url),
        firstLongURL,
      ),
      "Moving to the next part revokes the previous audio URL",
    );
    responseMode = "error";
    await ended();
    await panel().locator("[data-readout-error]").waitFor();
    check(
      requests.length === longStart + 3,
      "Later-part provider or credit error stops the queue",
    );
    check(
      (await panel().locator("[data-readout-error]").textContent()).trim()
        .length > 0,
      "Later-part error is shown next to readout controls",
    );
    responseMode = "audio";
    check(await action("start").isEnabled(), "Later-part failure unlocks retry without keeping a hidden active queue");

    const completeStart = requests.length;
    await action("start").click();
    await player().waitFor();
    for (let step = 0; step < 10; step++) {
      const lastPart = requests.at(-1).text.includes("KẾT THÚC TOÀN BỘ TÀI LIỆU.");
      const beforeEndURLs = (await audioURLs()).length;
      await ended();
      if (lastPart) { await phase("finished"); break; }
      await page.waitForFunction((before) => window.__readoutQA.created.filter((entry) => entry.type.startsWith("audio/")).length > before, beforeEndURLs);
    }
    check(await panel().getAttribute("data-phase") === "finished", "Reading the long source reaches an explicit completed state");
    check(requests.slice(completeStart).map((body) => body.text).join("").includes("KẾT THÚC TOÀN BỘ TÀI LIỆU."), "The final long-source text is actually submitted, beyond the first 3000 characters");
    await action("stop").click();

    await navigate("QA Readout Short Text");
    await action("start").click();
    await player().waitFor();
    const beforeUnmountURL = (await audioURLs()).at(-1).url;
    await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
    await panel().waitFor({ state: "hidden" });
    check(
      await page.evaluate(
        (url) => window.__readoutQA.revoked.includes(url),
        beforeUnmountURL,
      ),
      "Leaving the readout component frees its audio URL",
    );
    check(
      await page.evaluate(() => window.__readoutQA.pauses.length > 0),
      "Stopping and unmounting pause the media player",
    );
    check(
      requests.every(
        (body) =>
          typeof body.text === "string" &&
          body.text.length > 0 &&
          body.text.length <= 3000,
      ),
      "Every speech request respects the existing 3000-character API bound",
    );
    check(errors.length === 0, "No React, hydration or runtime browser errors");
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
    const voiceDialog = page.locator("dialog[open]");
    await voiceDialog.getByRole("combobox").fill("Phòng giọng nói");
    await page.keyboard.press("Enter"); await voiceDialog.waitFor({ state: "hidden" });
    const studio = page.locator(".lv-studio"); await studio.waitFor();
    const automaticReply = studio.getByLabel("Đọc câu trả lời", { exact: true });
    await automaticReply.uncheck();
    const beforeReplyVoice = requests.length;
    await studio.getByLabel("Câu hỏi của bạn", { exact: true }).fill("Giải thích một tam giác có mấy cạnh?");
    await studio.getByRole("button", { name: "Hỏi Lumio", exact: true }).click();
    await studio.locator(".lv-message--assistant").waitFor();
    check(requests.length === beforeReplyVoice && tutorRequests.length === 1, "Turning off automatic replies prevents a speech request after the tutor response");
    const beforeManualPlay = await page.evaluate(() => window.__readoutQA.plays.length);
    await studio.getByRole("button", { name: "Đọc thành tiếng", exact: true }).click();
    await page.waitForFunction((before) => window.__readoutQA.plays.length > before, beforeManualPlay);
    check(requests.length === beforeReplyVoice + 1, "Explicitly reading a voice-studio reply makes its own requested speech call");
    check(await studio.locator(".lv-message--assistant audio").isVisible(), "Explicit voice-studio read leaves visible playback controls");
    check(!await automaticReply.isChecked(), "Manual voice-studio reading works while automatic reply reading remains off");
    check(errors.length === 0, "Voice-studio manual read produces no runtime browser errors");
    await navigate("QA Readout Short Text");
    await panel().scrollIntoViewIfNeeded();
    await page.screenshot({ path: "docs/qa-readout-desktop.png" });
    return {
      status: "PASS",
      checks: passed.length,
      passed,
      voiceRequests: requests.length,
      paidRequests: 0,
      audioMode: "silent synthetic WAV; play observed without speaker output",
      externalBlocked: external.length,
      screenshots: ["docs/qa-readout-desktop.png"],
    };
  } finally {
    pending?.();
    await page
      .evaluate(() => {
        for (const audio of document.querySelectorAll("audio")) {
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
        }
      })
      .catch(() => {});
  }
}
