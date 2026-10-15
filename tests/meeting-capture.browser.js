// Isolated browser QA. All captured tracks are generated locally; never use real devices.
async function lumioMeetingCaptureQA(page) {
  const passed = [], errors = [], uploads = [];
  const check = (ok, label) => {
    if (!ok) throw new Error(label);
    passed.push(label);
  };
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/(voice|ai)(?:\?|$)/.test(request.url())) uploads.push(request.url());
  });
  await page.addInitScript(() => {
    const qa = window.__meetingQA = {
      mode: "normal", microphoneMode: "normal", displayCalls: [], microphoneCalls: [],
      streams: [], contexts: [], oscillators: [], recorders: [], pending: null, microphonePending: null,
    };
    const remember = (stream) => { qa.streams.push(stream); return stream; };
    const syntheticAudio = async () => {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      oscillator.frequency.value = 220;
      const output = context.createMediaStreamDestination();
      // Destination is a media stream only; synthetic sound is never sent to speakers.
      oscillator.connect(output);
      oscillator.start();
      qa.contexts.push(context); qa.oscillators.push(oscillator);
      await context.resume();
      return output.stream;
    };
    const syntheticDisplay = async (audio) => {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 32;
      canvas.getContext("2d").fillRect(0, 0, 32, 32);
      const video = canvas.captureStream(1);
      if (audio) for (const track of (await syntheticAudio()).getAudioTracks()) video.addTrack(track);
      return remember(video);
    };
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: async (options) => {
        qa.displayCalls.push(options);
        if (qa.mode === "denied") throw new DOMException("Synthetic cancellation", "NotAllowedError");
        if (qa.mode === "pending") return new Promise((resolve) => { qa.pending = resolve; });
        return syntheticDisplay(qa.mode !== "noAudio");
      },
    });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async (options) => {
        qa.microphoneCalls.push(options);
        if (qa.microphoneMode === "denied") throw new DOMException("Synthetic microphone refusal", "NotAllowedError");
        if (qa.microphoneMode === "pending") return new Promise((resolve) => { qa.microphonePending = resolve; });
        return remember(await syntheticAudio());
      },
    });
    const Recorder = window.MediaRecorder;
    window.MediaRecorder = class extends Recorder {
      constructor(stream, options) {
        super(stream, options);
        qa.recorders.push({ kinds: stream.getTracks().map((track) => track.kind), options });
      }
    };
    qa.resolvePending = async () => {
      const resolve = qa.pending; qa.pending = null;
      if (resolve) resolve(await syntheticDisplay(true));
    };
    qa.resolveMicrophonePending = async () => {
      const resolve = qa.microphonePending; qa.microphonePending = null;
      if (resolve) resolve(remember(await syntheticAudio()));
    };
    qa.live = () => qa.streams.flatMap((stream) => stream.getTracks()).filter((track) => track.readyState === "live").length;
    qa.endShared = () => {
      const track = qa.streams.at(-1)?.getVideoTracks()[0];
      if (track) { track.stop(); track.dispatchEvent(new Event("ended")); }
    };
    qa.dispose = async () => {
      for (const stream of qa.streams) for (const track of stream.getTracks()) track.stop();
      for (const oscillator of qa.oscillators) { try { oscillator.stop(); } catch {} }
      for (const context of qa.contexts) { try { await context.close(); } catch {} }
    };
  });
  const navigate = async (query) => {
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByRole("combobox").fill(query);
    await page.keyboard.press("Enter");
    await dialog.waitFor({ state: "hidden" });
  };
  const panel = page.locator(".lm-meeting");
  const names = { start: "Chọn nguồn âm thanh", pause: "Tạm dừng", resume: "Ghi tiếp", stop: "Hoàn tất bản ghi", cancel: "Hủy thu âm", use: "Dùng để chép lời", download: "Tải âm thanh", save: "Lưu bản thu vào thư viện" };
  const action = (name) => panel.getByRole(name === "download" ? "link" : "button", { name: names[name], exact: true });
  const phase = async (value) => page.locator(`.lm-meeting[data-phase="${value}"]`).waitFor();
  const error = (text) => panel.getByRole("alert").filter({ hasText: text });
  const stopped = async () => page.waitForFunction(() => window.__meetingQA.live() === 0);
  const mode = async (value) => page.evaluate((v) => { window.__meetingQA.mode = v; }, value);
  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.reload();
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).waitFor();
    await navigate("phong giong noi");
    await phase("idle");
    check((await page.evaluate(() => window.__meetingQA.displayCalls.length)) === 0, "Opening Voice Studio never starts capture automatically");
    const microphone = panel.getByRole("checkbox");
    check(!(await microphone.isChecked()), "Microphone mixing starts disabled");
    check(await panel.evaluate((element) => {
      const style = getComputedStyle(element);
      return parseFloat(style.borderTopWidth) > 0 && style.backgroundColor !== "rgba(0, 0, 0, 0)";
    }), "Meeting panel resolves the application's themed surface and border");
    check(await action("start").evaluate((element) => {
      const style = getComputedStyle(element);
      return element.getBoundingClientRect().height >= 44 && parseFloat(style.borderRadius) > 0 && style.backgroundColor !== "rgba(0, 0, 0, 0)";
    }), "Capture action has a visible styled surface and a 44px touch target");

    await mode("denied");
    await action("start").click();
    await error("Bạn đã hủy").waitFor();
    await phase("idle");
    check((await page.evaluate(() => window.__meetingQA.recorders.length)) === 0, "Display permission refusal creates no recorder");
    check(await action("start").isEnabled(), "Permission refusal permits a deliberate retry");

    await mode("noAudio");
    await action("start").click();
    await error("Nguồn này không có luồng âm thanh").waitFor();
    await stopped();
    check((await page.evaluate(() => window.__meetingQA.recorders.length)) === 0, "No shared audio is an explicit error and closes the video track");

    await mode("pending");
    await action("start").click();
    await phase("selecting");
    await action("cancel").click();
    await phase("idle");
    await page.evaluate(() => window.__meetingQA.resolvePending());
    await stopped();
    check((await page.evaluate(() => window.__meetingQA.recorders.length)) === 0, "Cancelled pending permission releases a stream returned later");

    await action("start").click();
    await phase("selecting");
    await page.evaluate(() => window.dispatchEvent(new Event("lumio:stop-capture")));
    await phase("idle");
    await page.evaluate(() => window.__meetingQA.resolvePending());
    await stopped();
    check((await page.evaluate(() => window.__meetingQA.recorders.length)) === 0, "Native stop cancels a pending display prompt and releases any late grant");

    await mode("normal");
    await action("start").click();
    await phase("recording");
    check(await microphone.isDisabled(), "Active recording locks the microphone source choice");
    check(await page.locator(".lv-start").isDisabled(), "Meeting capture disables the independent microphone recorder");
    check((await page.evaluate(() => window.__meetingQA.microphoneCalls.length)) === 0, "System audio capture never implicitly requests microphone permission");
    check(await page.evaluate(() => {
      const options = window.__meetingQA.displayCalls.at(-1);
      return options.video === true && options.audio === true && options.systemAudio === "include";
    }), "Display selection requests audio and video with system-audio preference");
    check(await page.evaluate(() => window.__meetingQA.recorders.at(-1).kinds.join(",") === "audio"), "MediaRecorder receives audio tracks only");
    await page.waitForTimeout(1150);
    await action("pause").click();
    await phase("paused");
    await action("resume").click();
    await phase("recording");
    check(await action("stop").isEnabled(), "Pause and resume retain an explicit stop control");
    await page.screenshot({ path: "docs/qa-meeting-recording.png", fullPage: true });
    await page.waitForTimeout(350);
    await action("stop").click();
    await phase("idle");
    await action("download").waitFor();
    await stopped();
    await page.waitForFunction(() => {
      const audio = document.querySelector(".lm-meeting-preview audio");
      return audio && audio.readyState >= 1 && !audio.error;
    });
    check(await panel.locator(".lm-meeting-preview audio").evaluate((audio) => !audio.error), "The completed local take decodes as playable audio metadata");
    const downloadPromise = page.waitForEvent("download");
    await action("download").click();
    const download = await downloadPromise;
    check(/^lumio-meeting\.(webm|m4a|ogg)$/.test(download.suggestedFilename()), "Local audio take is downloadable in a supported container");
    check(uploads.length === 0, "Stopping and downloading a take sends no audio to the server");
    await action("use").click();
    await page.locator(".lv-recorded audio").waitFor();
    check(uploads.length === 0, "Moving the take into Voice Studio does not transcribe or upload it");

    const previousTake = await action("download").getAttribute("href");
    await action("start").click();
    await phase("recording");
    await page.evaluate(async () => {
      const audio = document.querySelector(".lv-recorded audio");
      audio.muted = true;
      await audio.play().catch(() => {});
    });
    check(await page.locator(".lv-recorded audio").evaluate((audio) => audio.paused), "Voice preview cannot play into a running meeting capture");
    await page.waitForTimeout(400);
    await action("pause").click();
    await phase("paused");
    await page.evaluate(() => window.dispatchEvent(new Event("lumio:stop-capture")));
    await phase("idle");
    await stopped();
    await page.waitForFunction((previous) => {
      const audio = document.querySelector(".lm-meeting-preview audio");
      const link = document.querySelector('[data-meeting-action="download"]');
      return audio && audio.readyState >= 1 && !audio.error && link?.href !== previous;
    }, previousTake);
    check(await action("start").isEnabled(), "Native stop finalizes a paused meeting take and releases all tracks");

    const microphoneStart = page.locator(".lv-start");
    await microphoneStart.click();
    await page.locator(".lv-orbit--recording").waitFor();
    check(await action("start").isDisabled(), "Independent microphone recording disables meeting capture");
    await page.waitForTimeout(400);
    await page.evaluate(() => window.dispatchEvent(new Event("lumio:stop-capture")));
    await page.locator(".lv-orbit--idle").waitFor();
    await stopped();
    await page.waitForFunction(() => {
      const audio = document.querySelector(".lv-recorded audio");
      return audio && audio.readyState >= 1 && !audio.error;
    });
    check(await microphoneStart.isEnabled(), "Native stop finalizes the independent microphone take with no live tracks");

    await page.evaluate(() => { window.__meetingQA.microphoneMode = "pending"; });
    const recordersBeforePendingMicrophone = await page.evaluate(() => window.__meetingQA.recorders.length);
    await microphoneStart.click();
    await page.locator(".lv-orbit--permission").waitFor();
    await page.evaluate(() => window.dispatchEvent(new Event("lumio:stop-capture")));
    await page.locator(".lv-orbit--idle").waitFor();
    await page.evaluate(() => window.__meetingQA.resolveMicrophonePending());
    await stopped();
    check((await page.evaluate(() => window.__meetingQA.recorders.length)) === recordersBeforePendingMicrophone, "Native stop cancels a pending microphone prompt and releases any late grant");
    await page.evaluate(() => { window.__meetingQA.microphoneMode = "normal"; });

    await mode("normal");
    await action("start").click();
    await phase("recording");
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__meetingQA.endShared());
    await phase("idle");
    await stopped();
    check(await action("start").isEnabled(), "Ending the shared video stops the take and releases all capture tracks");

    await microphone.check();
    await page.evaluate(() => { window.__meetingQA.microphoneMode = "denied"; });
    await action("start").click();
    await error("Chưa thu được micro").waitFor();
    await stopped();
    await phase("idle");
    check(await action("start").isEnabled(), "Microphone refusal releases the previously granted display stream");
    await page.evaluate(() => { window.__meetingQA.microphoneMode = "normal"; });
    await action("start").click();
    await phase("recording");
    check(await page.evaluate(() => window.__meetingQA.recorders.at(-1).kinds.join(",") === "audio"), "Optional microphone mix remains an audio-only recording");
    await action("cancel").click();
    await stopped();
    await phase("idle");
    check(await action("start").isEnabled(), "Cancelling a microphone mix releases display, microphone and mixer tracks");

    await microphone.uncheck();
    await action("start").click();
    await phase("recording");
    await navigate("thu vien cua toi");
    await stopped();
    check((await panel.count()) === 0, "Leaving Voice Studio disposes the active capture without a background recorder");
    await navigate("phong giong noi");
    await phase("idle");
    await page.setViewportSize({ width: 375, height: 812 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Meeting capture fits a 375px mobile viewport");
    await page.screenshot({ path: "docs/qa-meeting-mobile.png", fullPage: true });
    await action("start").click();
    await phase("recording");
    await page.waitForTimeout(400);
    await action("stop").click();
    await phase("idle");
    await action("save").click();
    await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
    await page.locator(".lm-audio-player audio").waitFor();
    check((await panel.count()) === 0, "Saving a take opens the actual audio item in the local library");
    await page.reload();
    await page.getByRole("button", { name: "Tìm nhanh", exact: true }).waitFor();
    await navigate("lumio-meeting");
    await page.getByRole("tab", { name: "Tài liệu gốc", exact: true }).click();
    await page.locator(".lm-audio-player audio").waitFor();
    await page.waitForFunction(() => {
      const audio = document.querySelector(".lm-audio-player audio");
      return audio && audio.readyState >= 1 && !audio.error;
    });
    check(await page.locator(".lm-audio-player audio").evaluate((audio) => !audio.error), "Saved audio blob survives a reload and can be played from the library");
    await page.evaluate(() => Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", { configurable: true, value: undefined }));
    await navigate("thu vien cua toi");
    await navigate("phong giong noi");
    await panel.getByRole("status").filter({ hasText: "Cần HTTPS hoặc localhost" }).waitFor();
    check(await action("start").isDisabled(), "Unsupported display capture has an explicit unavailable state");
    check(await page.locator('.lv-upload input[type="file"]').isEnabled(), "Unsupported capture leaves local audio-file upload available");
    check(uploads.length === 0, "All capture tests use zero paid API requests");
    check(errors.length === 0, `No runtime or hydration errors: ${errors.join(" | ")}`);
    return { status: "PASS", checks: passed.length, passed, syntheticCaptureOnly: true, realDevicesUsed: false, uploadedAudio: false, screenshots: ["qa-meeting-recording.png", "qa-meeting-mobile.png"] };
  } finally {
    await page.evaluate(() => window.__meetingQA?.dispose()).catch(() => {});
  }
}
