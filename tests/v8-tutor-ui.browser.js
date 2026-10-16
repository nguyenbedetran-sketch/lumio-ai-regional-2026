// Actual React tutor/voice components; ALL HTTP and identities below are synthetic.
async (page) => {
  const checks = [],
    errors = [],
    unexpected = [],
    calls = [],
    feedbackCalls = [];
  let current = null,
    lostAck = false,
    feedbackRevision = 0,
    storedFeedback = null;
  const account = "qa-v8-account-a",
    sid = "10000000-0000-4000-8000-000000000001",
    tid = "20000000-0000-4000-8000-000000000001";
  const source =
      "Khi biến đổi phương trình, thực hiện cùng một phép toán trên cả hai vế.",
    quote = "thực hiện cùng một phép toán trên cả hai vế";
  const ref = {
    segmentId: "s1",
    quote,
    start: source.indexOf(quote),
    end: source.indexOf(quote) + quote.length,
    paragraph: 1,
    verification: "exact-excerpt",
  };
  const check = (v, n) => {
    if (!v) throw Error(n);
    checks.push(n);
  };
  function view(body) {
    const intent = body.tutorIntent || "progress",
      counted = intent === "progress";
    return {
      sessionId: sid,
      hintCount: counted ? 1 : 0,
      requiredHints: 3,
      canUnlock: false,
      guidance: "hints",
      revision: 1,
      expiresAt: "2099-01-01T00:00:00Z",
      latestTurn: {
        id: tid,
        ordinal: 1,
        intent,
        counted,
        feedbackRevision,
        feedback: storedFeedback,
      },
      problem: body.question,
      retentionDays: 7,
      continuity: {
        lastQuestion: "Em sẽ dùng phép toán nào ở hai vế?",
        lastStudentAttempt: body.question,
        lastStep: null,
        note: "recorded-not-verified",
      },
      turns: [
        {
          id: tid,
          ordinal: 1,
          intent,
          counted,
          feedbackRevision,
          feedback: storedFeedback,
          student: body.question,
          assistant:
            "Hãy dùng phép toán ngược để tách số hạng tự do.\n\nEm sẽ dùng phép toán nào ở hai vế?",
          hint: "Hãy dùng phép toán ngược để tách số hạng tự do.",
          question: "Em sẽ dùng phép toán nào ở hai vế?",
          guidance: "hints",
          createdAt: "2026-10-16T00:00:00Z",
          needsClarification: false,
          references: [ref],
        },
      ],
    };
  }
  try {
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (r) => {
      unexpected.push(r.request().url());
      return r.abort();
    });
    for (const [url, file, contentType] of [
      ["**/__v8-tutor-ui", "fixture.html", "text/html"],
      ["**/__v8-tutor-ui.js", "fixture.js", "text/javascript"],
      ["**/__v8-tutor-ui.css", "fixture.css", "text/css"],
    ])
      await page.route(url, (r) =>
        r.fulfill({ path: "work/v8-tutor-ui/" + file, contentType }),
      );
    await page.route("**/brand/lumio-logo.png", (r) =>
      r.fulfill({
        path: "public/brand/lumio-logo.png",
        contentType: "image/png",
      }),
    );
    await page.route("**/api/auth/session", (r) =>
      r.fulfill({
        json: { userId: "qa-v8-user", accountKey: account, sessionVersion: 1 },
      }),
    );
    await page.route("**/api/config", (r) =>
      r.fulfill({
        json: {
          ai: true,
          capabilities: {
            tutor: true,
            summary: true,
            media: true,
            speech: false,
            transcription: false,
          },
        },
      }),
    );
    await page.route("**/api/rag/documents**", (r) =>
      r.fulfill({ json: { documents: [], embeddingsAvailable: false } }),
    );
    await page.route("**/api/tutor/session**", (r) => {
      check(
        r.request().headers()["x-lumio-account"] === account,
        "Session restore/delete carries canonical account binding",
      );
      if (r.request().method() === "DELETE") {
        current = null;
        return r.fulfill({ json: { deleted: 1 } });
      }
      return current
        ? r.fulfill({ json: current })
        : r.fulfill({
            status: 404,
            json: { error: "TUTOR_SESSION_NOT_FOUND" },
          });
    });
    await page.route("**/api/tutor/feedback", (r) => {
      const b = r.request().postDataJSON();
      feedbackCalls.push(b);
      check(
        r.request().headers()["x-lumio-account"] === account,
        "Free feedback is account bound",
      );
      const prior = feedbackCalls
        .slice(0, -1)
        .find((p) => p.requestId === b.requestId);
      if (!prior) {
        feedbackRevision++;
        storedFeedback =
          b.action === "delete"
            ? null
            : {
                revision: feedbackRevision,
                usefulness: b.usefulness,
                correctness: b.correctness,
                updatedAt: "2026-10-16T00:00:00Z",
              };
        current.latestTurn.feedbackRevision = feedbackRevision;
        current.latestTurn.feedback = storedFeedback;
        current.turns[0].feedbackRevision = feedbackRevision;
        current.turns[0].feedback = storedFeedback;
      }
      if (lostAck) {
        lostAck = false;
        return r.abort();
      }
      return r.fulfill({
        json: {
          revision: feedbackRevision,
          feedback: storedFeedback,
          replayed: !!prior,
          deleted: !storedFeedback,
          appliedRevision: feedbackRevision,
        },
      });
    });
    await page.route("**/api/ai", (r) => {
      const b = r.request().postDataJSON();
      calls.push(b);
      check(
        r.request().headers()["x-lumio-account"] === account,
        "Paid tutor intent is bound to mounted account",
      );
      check(
        /^[a-f0-9-]{36}$/.test(r.request().headers()["idempotency-key"] || ""),
        "Paid tutor request has stable UUID header",
      );
      current = view(b);
      return r.fulfill({
        json: {
          text: current.turns[0].assistant,
          tutor: current,
          references: [ref],
        },
      });
    });
    await page.goto("http://localhost:3000/__v8-tutor-ui");
    await page.locator("textarea[aria-label]").first().waitFor();
    await page.waitForFunction(() =>
      window.__drafts?.some((v) => v.question === "2x+3=11"),
    );
    check(
      (await page.locator("textarea[aria-label]").first().inputValue()) ===
        "2x+3=11",
      "Home-transferred initial prompt is visible and published to draft guard",
    );
    check(
      calls.length === 0,
      "Initial prompt and restoration never auto-submit paid AI",
    );
    await page
      .getByRole("button", { name: "Dễ hiểu hơn", exact: true })
      .click();
    check(
      calls.length === 0,
      "Selecting help format does not auto-send or erase draft",
    );
    await page.locator("[data-full-summary-generate]").click();
    await page.locator("[data-tutor-history]").waitFor();
    check(
      calls[0].tutorIntent === "simpler",
      "Explicit help intent reaches canonical server payload",
    );
    check(
      (await page
        .getByText("Lượt hỗ trợ đã ghi nhận; không tăng khóa.", { exact: true })
        .count()) === 1,
      "Noncounted help is labelled without correctness/mastery claim",
    );
    check(
      await page
        .getByRole("button", { name: "Xem lời giải đầy đủ", exact: true })
        .isDisabled(),
      "Help response does not unlock full solution",
    );
    await page.getByText("Phản hồi riêng về lượt này", { exact: true }).click();
    const feedback = page
      .locator("details")
      .filter({
        has: page.getByText("Phản hồi riêng về lượt này", { exact: true }),
      });
    await feedback.getByLabel("Mức hữu ích").selectOption("helpful");
    await feedback
      .getByLabel("Bạn có nghi ngờ nội dung?")
      .selectOption("possible_error");
    await feedback
      .getByRole("button", { name: "Lưu phản hồi", exact: true })
      .click();
    await feedback.getByText(/Đã lưu riêng/).waitFor();
    check(
      calls.length === 1 && feedbackCalls.length === 1,
      "Closed feedback is a separate free endpoint, never another AI request",
    );
    check(
      Object.keys(feedbackCalls[0]).sort().join(",") ===
        "action,correctness,expectedRevision,requestId,sessionId,turnId,usefulness",
      "Feedback wire contains only closed categories and IDs, no source/answer/free text",
    );
    await feedback.getByLabel("Mức hữu ích").selectOption("not_helpful");
    lostAck = true;
    await feedback
      .getByRole("button", { name: "Lưu phản hồi", exact: true })
      .click();
    await feedback.getByText(/Chưa lưu được/).waitFor();
    await feedback
      .getByRole("button", { name: "Lưu phản hồi", exact: true })
      .click();
    await feedback.getByText(/Đã lưu riêng/).waitFor();
    check(
      feedbackCalls[1].requestId === feedbackCalls[2].requestId,
      "Lost acknowledgement retries exactly the same feedback UUID",
    );
    await feedback
      .getByRole("button", { name: "Xóa phản hồi", exact: true })
      .click();
    await feedback.getByText(/Đã xóa các lựa chọn/).waitFor();
    check(
      feedbackCalls.at(-1).action === "delete" &&
        !Object.hasOwn(feedbackCalls.at(-1), "usefulness"),
      "Delete sends no erased category content",
    );
    await page.evaluate(() => window.__mountTutor());
    await page.locator("[data-tutor-history]").waitFor();
    check(
      calls.length === 1,
      "Tutor remount restores canonical conversation without paid regeneration",
    );
    check(
      (await page
        .getByText("Tiếp tục từ cuộc trao đổi đã lưu", { exact: true })
        .count()) === 1,
      "Restored continuity shows recorded context only",
    );
    await page.evaluate(() =>
      window.__mountTutor("tutor", "qa-v8-account-a", ""),
    );
    await page.locator("textarea[aria-label]").first().waitFor();
    await page.waitForTimeout(100);
    check(
      (await page.locator("textarea[aria-label]").first().inputValue()) === "",
      "An intentional empty draft survives remount instead of resurrecting initialPrompt",
    );
    await page.evaluate(() => window.__mountTutor("voice"));
    await page.getByLabel("Chọn nguồn cho cuộc trò chuyện").waitFor();
    const picker = page.getByLabel("Chọn nguồn cho cuộc trò chuyện");
    check(
      (await picker.inputValue()) === "",
      "Voice initially starts with no private source auto-selected",
    );
    check(
      (await picker
        .locator('option[value="qa-unextracted"]')
        .getAttribute("disabled")) !== null,
      "Unextracted PDF cannot be silently sent as a text source",
    );
    await picker.selectOption("qa-v8-material");
    await page.getByLabel("Câu hỏi của bạn").fill("2x+3=11");
    await page.getByRole("button", { name: "Hỏi Lumio", exact: true }).click();
    await page.locator(".lv-message--assistant").waitFor();
    check(
      calls.length === 2 &&
        calls[1].source === source &&
        calls[1].history.length === 0,
      "Voice sends exactly selected text, not browser transcript or other material",
    );
    check(
      (await page
        .locator(".lv-message--assistant")
        .getByText("Đối chiếu học liệu", { exact: true })
        .count()) === 1,
      "Voice preserves source provenance from canonical AI result",
    );
    await page.evaluate(() => window.__mountTutor("voice"));
    await page.locator(".lv-message--assistant").waitFor();
    check(
      (await picker.inputValue()) === "qa-v8-material",
      "Voice remount restores the user's prior explicit source selection",
    );
    check(
      calls.length === 2,
      "Voice restores canonical transcript/pointer without another provider call",
    );
    const storage = await page.evaluate(() => Object.entries(localStorage));
    check(
      storage.every(
        ([k, v]) =>
          !k.includes("thực hiện") &&
          !v.includes("phép toán") &&
          !v.includes("assistant"),
      ),
      "Browser voice storage contains only selected IDs/digests/session pointer, no source or transcript",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    check(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "Phone voice/source/feedback layout has no horizontal page overflow",
    );
    await page.screenshot({
      path: "docs/v8/reports/tutor-voice-phone-fixture.png",
      fullPage: true,
    });
    await page.evaluate(() => {
      window.__stoppedTracks = 0;
      window.__stoppedRecorders = 0;
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => ({
            getTracks: () => [{ stop: () => window.__stoppedTracks++ }],
          }),
        },
      });
      window.MediaRecorder = class {
        state = "inactive";
        mimeType = "audio/webm";
        static isTypeSupported() {
          return true;
        }
        start() {
          this.state = "recording";
        }
        stop() {
          this.state = "inactive";
          window.__stoppedRecorders++;
          this.onstop?.();
        }
      };
      window.AudioContext = class {
        createAnalyser() {
          throw Error("synthetic meter unavailable");
        }
        close() {
          return Promise.resolve();
        }
      };
    });
    await page
      .getByRole("button", { name: "Bắt đầu ghi âm", exact: true })
      .click();
    await page.getByText("Đang nghe từ micro", { exact: true }).waitFor();
    await page.evaluate(() => window.__refreshVoiceMaterials());
    await page
      .getByRole("button", { name: "Bắt đầu ghi âm", exact: true })
      .waitFor();
    check(
      await page.evaluate(
        () => window.__stoppedTracks >= 1 && window.__stoppedRecorders === 1,
      ),
      "Background material refresh stops the active recorder and all owned microphone tracks before resetting phase",
    );
    check(
      calls.length === 2,
      "Context-reset microphone cleanup does not transcribe or send a paid request",
    );
    await page.evaluate(() => window.__mountTutor("voice", "qa-v8-account-b"));
    await page.getByLabel("Chọn nguồn cho cuộc trò chuyện").waitFor();
    await page.waitForTimeout(200);
    check(
      (await page.locator(".lv-message").count()) === 0,
      "Account remount cannot restore another account's pointer/transcript",
    );
    check(
      errors.length === 0,
      "Actual React fixture has no uncaught page errors",
    );
    return {
      status: "PASS",
      passed: checks.length,
      checks,
      realProviderRequests: 0,
      paidFixtureRequests: calls.length,
      feedbackFixtureRequests: feedbackCalls.length,
      unexpectedRequests: unexpected,
      errors,
      scope:
        "Actual React/CSS in Edge, synthetic HTTP/auth and authored source only. No provider/OAuth/device microphone, speaker or learner study evidence.",
    };
  } catch (e) {
    return {
      status: "FAIL",
      passed: checks.length,
      checks,
      error: e.message,
      overflow: await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 15)
          .map((e) => ({
            tag: e.tagName,
            cls: e.className,
            w: e.getBoundingClientRect().width,
            right: e.getBoundingClientRect().right,
          })),
      ),
      errors,
      unexpectedRequests: unexpected,
      realProviderRequests: 0,
    };
  }
};
