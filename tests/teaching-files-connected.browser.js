async (page) => {
  const fixture = __SESSION__,
    files = __FILES__,
    cases = [],
    errors = [],
    external = [],
    receipts = [],
    downloads = [];
  const folder = "docs/next/reports/teaching-files-browser/",
    title = "SYNTHETIC UI · Tệp bài làm " + Date.now();
  const check = (ok, name) => {
    if (!ok) throw Error(name);
    cases.push(name);
  };
  const signIn = async (user, route) => {
    await page.context().clearCookies();
    const at = user.cookie.indexOf("=");
    await page.context().addCookies([
      {
        name: user.cookie.slice(0, at),
        value: user.cookie.slice(at + 1),
        url: fixture.origin,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto(fixture.origin + route);
  };
  const nav = async (name) => {
    const target = page
      .locator(".tw-sidebar nav")
      .getByRole("button", { name, exact: true });
    if (!(await target.isVisible()))
      await page.locator(".tw-more-nav > summary").click();
    await target.click();
  };
  const dialog = () => page.locator("dialog.tw-dialog[open]").last();
  const select = async (box, file) =>
    box.locator('input[type="file"]').evaluate((el, v) => {
      const raw = atob(v.base64),
        bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0)),
        dt = new DataTransfer();
      dt.items.add(new File([bytes], v.name, { type: v.mime }));
      el.files = dt.files;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, file);
  const upload = async (box, file) => {
    await select(box, file);
    const ack = page.waitForResponse(
      (r) =>
        r.url() === fixture.origin + "/api/teaching/files" &&
        r.request().method() === "POST",
    );
    await box
      .getByRole("button", { name: "Tải tệp lên máy chủ", exact: true })
      .click();
    const response = await ack,
      body = await response.json();
    check(
      response.status() === 200 &&
        body.file?.bytes === file.bytes &&
        body.file?.sha256 === file.sha256,
      "Actual compiled upload acknowledges exact " + file.name + " bytes",
    );
    return body.file;
  };
  try {
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(
      (url) => url.origin !== fixture.origin,
      (route) => {
        external.push(route.request().url());
        return route.abort();
      },
    );
    page.on("response", async (response) => {
      if (
        response.url() === fixture.origin + "/api/teaching/files" &&
        response.request().method() === "POST"
      )
        receipts.push({
          status: response.status(),
          boundAccount: !!response.request().headers()["x-lumio-account"],
        });
    });
    await signIn(fixture.teacher, "/teacher");
    await page.locator(".tw-stat").first().waitFor();
    await page.setViewportSize({ width: 1440, height: 1050 });
    await nav("Bài tập");
    await page
      .getByRole("button", { name: "Tạo bài tập", exact: true })
      .first()
      .click();
    let modal = dialog();
    await modal.waitFor();
    await modal
      .getByRole("textbox", { name: "Tên bài tập", exact: true })
      .fill(title);
    await modal
      .getByRole("combobox", { name: "Lớp nhận bài", exact: true })
      .selectOption(fixture.classId);
    await modal
      .locator('input[type="datetime-local"]')
      .first()
      .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await modal
      .getByRole("textbox", { name: "Hướng dẫn", exact: true })
      .fill(
        "SYNTHETIC · Chọn câu trả lời và gửi tệp tự soạn để kiểm tra lưu trữ; không phải đánh giá học sinh thật.",
      );
    await modal.getByRole("checkbox", { name: /Tính 2 \+ 2\./ }).check();
    await modal
      .getByRole("button", { name: "Lưu đề nháp", exact: false })
      .click();
    let card = page
      .locator(".tw-content article.tw-card")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await card.waitFor();
    let box = card.locator("[data-file-attachments]");
    const reference = await upload(box, files.reference);
    await card
      .getByRole("button", { name: "Tải " + files.reference.name, exact: true })
      .waitFor();
    await box
      .getByRole("combobox", { name: "Quyền xem tệp mới", exact: true })
      .selectOption("teacher-only");
    await upload(box, files.private);
    await card
      .getByRole("button", { name: "Tải " + files.private.name, exact: true })
      .waitFor();
    check(
      (await card.innerText()).includes("Nội bộ giáo viên"),
      "Teacher draft file purpose remains explicit after actual server reload",
    );
    const review = page.waitForResponse(
      (r) =>
        r.url() === fixture.origin + "/api/teaching" &&
        r.request().method() === "POST",
    );
    await card
      .getByRole("button", { name: "Duyệt đề & đối tượng", exact: true })
      .click();
    check(
      (await review).status() === 200,
      "Actual teacher review uses current attachment revision",
    );
    await card.getByRole("button", { name: "Giao bài", exact: true }).click();
    await card.getByText("Đã giao", { exact: true }).waitFor();
    await signIn(fixture.student, "/classroom");
    await page.getByRole("tab", { name: "Bài tập", exact: true }).waitFor();
    card = page
      .locator(".tw-content article.tw-card")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await card.getByRole("button", { name: "Mở bài tập", exact: true }).click();
    modal = dialog();
    await modal.waitFor();
    check(
      (await modal
        .getByRole("button", {
          name: "Tải " + files.reference.name,
          exact: true,
        })
        .count()) === 1 &&
        !(await modal.innerText()).includes(files.private.name),
      "Real student payload exposes published reference while hiding teacher-only file metadata",
    );
    box = modal
      .locator("[data-file-attachments]")
      .filter({ has: page.locator('input[type="file"]') });
    const selected = [];
    for (const file of files.answers) {
      const meta = await upload(box, file);
      check(
        meta.status === "pending" && !meta.submissionId,
        "Actual " + file.name + " ACK is pending, not a submitted assignment",
      );
      selected.push(meta);
      await box
        .getByRole("button", { name: "Tải " + file.name, exact: true })
        .waitFor();
    }
    check(
      await box.locator('input[type="file"]').isDisabled(),
      "Three acknowledged pending files enforce the bounded UI file count",
    );
    await modal.getByRole("radio").first().check();
    await modal.getByRole("checkbox").last().check();
    const submitted = page.waitForResponse(
      (r) =>
        r.url() === fixture.origin + "/api/teaching" &&
        r.request().method() === "POST" &&
        r.request().postDataJSON()?.action === "submission.submit",
    );
    await modal
      .getByRole("button", { name: "Nộp bài cho giáo viên", exact: false })
      .click();
    const response = await submitted,
      body = await response.json(),
      snapshot = body.state,
      assignment = snapshot?.assignments?.find((a) => a.title === title),
      submission = snapshot?.submissions?.find(
        (s) => s.assignmentId === assignment?.id,
      );
    check(
      response.status() === 200 &&
        !!submission &&
        selected.every((f) =>
          snapshot.files.some(
            (stored) =>
              stored.id === f.id &&
              stored.status === "attached" &&
              stored.submissionId === submission.id,
          ),
        ),
      "Actual final submit atomically binds the three acknowledged files to the saved submission",
    );
    check(
      !JSON.stringify(snapshot.files).includes(files.private.name),
      "Teacher-only filename stays absent from the final student server response",
    );
    await page.setViewportSize({ width: 390, height: 950 });
    await card
      .getByRole("button", {
        name: "Chờ kết quả giáo viên công bố",
        exact: false,
      })
      .waitFor();
    await page.getByRole("tab", { name: "Kết quả", exact: true }).click();
    const result = page
      .locator(".tw-panel")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await result.waitFor();
    check(
      (await result.innerText()).includes("Bản nộp 1") &&
        (await result.locator("[data-file-attachments] li").count()) === 3,
      "Student result view labels the attached submission revision after actual ACK",
    );
    await result.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const note = document.createElement("div");
      note.textContent =
        "KIỂM THỬ · Tài khoản và bài nộp tổng hợp · Máy chủ thử nghiệm";
      Object.assign(note.style, {
        position: "fixed",
        left: "0",
        bottom: "0",
        zIndex: 99999,
        background: "#244d3d",
        color: "white",
        font: "10px system-ui",
        padding: "4px",
        pointerEvents: "none",
      });
      document.body.append(note);
    });
    await page.screenshot({ path: folder + "student-submitted-phone.png" });
    await signIn(fixture.teacher, "/teacher");
    await page.locator(".tw-stat").first().waitFor();
    await nav("Chấm & nhận xét");
    const row = page.locator("tbody tr").filter({ hasText: title });
    await row
      .getByRole("button", { name: "Chấm & nhận xét", exact: true })
      .click();
    modal = dialog();
    await modal.waitFor();
    check(
      selected.every((f) => f.name) &&
        (await modal.locator("[data-file-attachments] li").count()) === 3,
      "Actual teacher grading inbox lists the exact three submitted files",
    );
    for (const file of files.answers) {
      const savedDownload = page.waitForEvent("download");
      const received = page.waitForResponse(
        (r) =>
          r.url().includes("/api/teaching/files/") &&
          r.request().method() === "GET",
      );
      await modal
        .getByRole("button", { name: "Tải " + file.name, exact: true })
        .click();
      const download = await received,
        actualDownload = await savedDownload;
      await actualDownload.saveAs(file.downloadPath);
      downloads.push({
        format: file.name.split(".").at(-1),
        status: download.status(),
        expectedBytes: file.bytes,
        contentType: download.headers()["content-type"],
        suggestedFilename: actualDownload.suggestedFilename(),
      });
      check(
        download.status() === 200 &&
          actualDownload.suggestedFilename() === file.name,
        "Grader receives the native " +
          file.name +
          " download after compiled API 200 ACK",
      );
    }
    await page.screenshot({
      path: folder + "teacher-connected-files-phone.png",
    });
    check(
      errors.length === 0 && external.length === 0,
      "No browser exceptions, API mocks or real external provider requests",
    );
    return JSON.stringify({
      status: "PASS",
      passed: cases.length,
      cases,
      errors,
      externalRequests: external.length,
      receipts,
      downloads,
      scope:
        "Actual compiled teacher/classroom React + file serializer + HTTP + SQLite; isolated synthetic signed sessions, no business API interception, real OAuth/provider playback not tested",
    });
  } catch (e) {
    await page.screenshot({
      path: folder + "connected-debug.png",
      fullPage: true,
    });
    return JSON.stringify({
      status: "FAIL",
      passed: cases.length,
      cases,
      error: e.message,
      errors,
      externalRequests: external.length,
      downloads,
    });
  }
};
