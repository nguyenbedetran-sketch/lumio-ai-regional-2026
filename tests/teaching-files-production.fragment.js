report.fileSourceSha256 = Object.fromEntries(
  [
    "lib/server/teaching-files.ts",
    "lib/server/teaching-file-validation.ts",
    "lib/server/teaching-core.ts",
    "components/teaching/file-attachments.tsx",
    "lib/teaching/file-client.ts",
  ]
    .filter((file) => fs.existsSync(path.join(root, file)))
    .map((file) => [
      file,
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(root, file)))
        .digest("hex"),
    ]),
);
report.compiledBuildIdSha256 = crypto
  .createHash("sha256")
  .update(fs.readFileSync(path.join(root, ".next/BUILD_ID")))
  .digest("hex");
// Extension of the established compiled-server harness: same real HTTP,
// signed synthetic cookies and fixture SQLite. No app route/auth bypass.
let fileLesson,
  lessonReference,
  privateAnswer,
  fileAssignment,
  fileQuestion,
  pendingFiles = [];
async function fileUpload(user, payload, status = 200, extra = {}) {
  const response = await fetch(origin + "/api/teaching/files", {
    method: "POST",
    headers: headers(user, extra),
    body: JSON.stringify(payload),
  });
  const value = await response.json();
  assert.equal(response.status, status, value.error || "File upload status");
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  return value;
}
async function fileDownload(user, id, status = 200, extra = {}) {
  const response = await fetch(origin + "/api/teaching/files/" + id, {
    headers: headers(user, extra),
  });
  assert.equal(response.status, status, "File download status");
  return response;
}
const filePayload = (kind, id, filename, bytes, extra = {}) => ({
  requestId: crypto.randomUUID(),
  orgId: orgA,
  target: { kind, id },
  filename,
  dataBase64: Buffer.from(bytes).toString("base64"),
  ...extra,
});
await check(
  5,
  "Compiled file routes enforce cookie/captured-account/origin/body limits before accepting bytes",
  async () => {
    const value = filePayload("lesson", "unknown", "test.txt", "Authored");
    await fileUpload(null, value, 401);
    await fileUpload(users.teacher, value, 401, {
      "x-lumio-account": users.student.key,
    });
    await fileUpload(users.teacher, value, 403, {
      origin: "https://evil.invalid",
    });
    const response = await fetch(origin + "/api/teaching/files", {
      method: "POST",
      headers: headers(users.teacher),
      body: " ".repeat(1404097),
    });
    assert.equal(response.status, 413);
  },
);
await check(
  5,
  "Compiled teacher file ACK persists one exact object, retries safely and advances preview revision",
  async () => {
    const saved = await mutate(users.teacher, {
      action: "lesson.create",
      orgId: orgA,
      draft: {
        classId: classA.id,
        title: "Authored file lesson",
        topic: "Số học",
        grade: "9",
        objectives: ["Đối chiếu phép cộng."],
        sections: [
          {
            title: "Khái niệm",
            body: "Phép cộng gộp hai nhóm đối tượng.",
            references: [],
          },
          {
            title: "Luyện tập",
            body: "Tự nêu ví dụ rồi kiểm tra lại.",
            references: [],
          },
        ],
        sourceIds: [],
      },
    });
    fileLesson = saved.state.lessons.find(
      (lesson) => lesson.id === saved.result.id,
    );
    const input = filePayload(
      "lesson",
      fileLesson.id,
      "reference.txt",
      "Authored reference $x^2=9$.",
    );
    const first = await fileUpload(users.teacher, input),
      retry = await fileUpload(users.teacher, input);
    lessonReference = first.file;
    assert.equal(retry.file.id, first.file.id);
    assert.equal(first.targetRevision, fileLesson.revision + 1);
    assert.equal(retry.targetRevision, first.targetRevision);
    await fileUpload(
      users.teacher,
      {
        ...input,
        dataBase64: Buffer.from("Different bytes").toString("base64"),
      },
      409,
    );
    const response = await fileDownload(users.teacher, first.file.id);
    assert.equal(await response.text(), "Authored reference $x^2=9$.");
    assert.match(response.headers.get("content-disposition"), /^attachment/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("content-security-policy"), /sandbox/);
    assert.match(response.headers.get("cache-control"), /private.*no-store/);
    await mutate(
      users.teacher,
      {
        action: "lesson.review",
        orgId: orgA,
        id: fileLesson.id,
        expectedRevision: fileLesson.revision,
      },
      409,
    );
    privateAnswer = (
      await fileUpload(
        users.teacher,
        filePayload(
          "lesson",
          fileLesson.id,
          "teacher-only.txt",
          "Internal teacher-only answer.",
          { visibility: "teacher-only" },
        ),
      )
    ).file;
    await fileDownload(users.student, first.file.id, 403);
    await fileDownload(users.otherTeacher, first.file.id, 403);
    await fileDownload(null, first.file.id, 401);
  },
);
await check(
  5,
  "Compiled lesson publication releases reference metadata and bytes while teacher-only files stay private",
  async () => {
    let lesson = (await get(users.teacher, orgA)).v.lessons.find(
      (item) => item.id === fileLesson.id,
    );
    const review = await mutate(users.teacher, {
      action: "lesson.review",
      orgId: orgA,
      id: lesson.id,
      expectedRevision: lesson.revision,
    });
    lesson = review.state.lessons.find((item) => item.id === lesson.id);
    await mutate(users.teacher, {
      action: "lesson.publish",
      orgId: orgA,
      id: lesson.id,
      expectedRevision: lesson.revision,
    });
    const state = (await get(users.student, orgA)).v;
    assert.ok(state.files.some((file) => file.id === lessonReference.id));
    assert.ok(!state.files.some((file) => file.id === privateAnswer.id));
    await fileDownload(users.student, lessonReference.id);
    await fileDownload(users.student, privateAnswer.id, 403);
  },
);
await check(
  5,
  "Compiled assignment receives pending image, DOCX and PPTX without claiming submission",
  async () => {
    const saved = await mutate(users.teacher, {
      action: "question.create",
      orgId: orgA,
      draft: {
        classId: classA.id,
        prompt: "Tính 2 + 2.",
        kind: "mcq",
        choices: ["4", "5", "3", "2"],
        correctIndex: 0,
        explanation: "2 + 2 = 4.",
        maxPoints: 1,
        topic: "Số học",
        difficulty: "basic",
        references: [],
      },
    });
    fileQuestion = saved.state.questions.find((q) => q.id === saved.result.id);
    await mutate(users.teacher, {
      action: "question.review",
      orgId: orgA,
      id: fileQuestion.id,
      expectedRevision: fileQuestion.revision,
    });
    const created = await mutate(users.teacher, {
      action: "assignment.create",
      orgId: orgA,
      draft: {
        classId: classA.id,
        title: "Authored image and presentation homework",
        instructions: "Answer and attach authored image, worksheet and slides.",
        questionIds: [fileQuestion.id],
        target: { kind: "class", ids: [] },
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    fileAssignment = created.state.assignments.find(
      (a) => a.id === created.result.id,
    );
    const reviewed = await mutate(users.teacher, {
      action: "assignment.review",
      orgId: orgA,
      id: fileAssignment.id,
      expectedRevision: fileAssignment.revision,
    });
    fileAssignment = reviewed.state.assignments.find(
      (a) => a.id === fileAssignment.id,
    );
    await mutate(users.teacher, {
      action: "assignment.issue",
      orgId: orgA,
      id: fileAssignment.id,
      expectedRevision: fileAssignment.revision,
    });
    const { zipSync, strToU8 } = require("fflate"),
      png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=",
        "base64",
      );
    const authored = [
      ["calculation.png", png],
      [
        "worksheet.docx",
        zipSync({
          "[Content_Types].xml": strToU8(
            '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
          ),
          "word/document.xml": strToU8(
            "<w:document><w:p>Authored worksheet</w:p></w:document>",
          ),
        }),
      ],
      [
        "slides.pptx",
        zipSync({
          "[Content_Types].xml": strToU8(
            '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>',
          ),
          "ppt/presentation.xml": strToU8("<p:presentation/>"),
        }),
      ],
    ];
    for (const [name, bytes] of authored) {
      const uploaded = await fileUpload(
        users.student,
        filePayload("submission", fileAssignment.id, name, bytes),
      );
      assert.equal(uploaded.file.status, "pending");
      pendingFiles.push({ metadata: uploaded.file, bytes: Buffer.from(bytes) });
    }
    const state = (await get(users.student, orgA)).v;
    assert.ok(
      !state.submissions.some((s) => s.assignmentId === fileAssignment.id),
    );
    for (const { metadata } of pendingFiles) {
      await fileDownload(users.teacher, metadata.id, 403);
      await fileDownload(users.otherStudent, metadata.id, 403);
    }
  },
);
await check(
  5,
  "Compiled submit transaction rejects another student's file then binds own three files after server ACK",
  async () => {
    const foreign = (
      await fileUpload(
        users.otherStudent,
        filePayload(
          "submission",
          fileAssignment.id,
          "other.txt",
          "Other authored answer.",
        ),
      )
    ).file;
    const command = {
      requestId: crypto.randomUUID(),
      action: "submission.submit",
      orgId: orgA,
      assignmentId: fileAssignment.id,
      expectedRevision: 0,
      answers: [{ questionId: fileQuestion.id, response: 0 }],
      attachmentIds: [foreign.id],
    };
    await mutate(users.student, command, 403);
    assert.equal(
      Number(
        db
          .prepare(
            "SELECT count(*) n FROM teaching_submissions WHERE assignment_id=? AND student_id=?",
          )
          .get(fileAssignment.id, users.student.id).n,
      ),
      0,
    );
    const valid = {
        ...command,
        requestId: crypto.randomUUID(),
        attachmentIds: pendingFiles.map((file) => file.metadata.id),
      },
      saved = await mutate(users.student, valid);
    assert.equal((await mutate(users.student, valid)).replayed, true);
    for (const item of pendingFiles) {
      const bound = saved.state.files.find(
        (file) => file.id === item.metadata.id,
      );
      assert.equal(bound.status, "attached");
      assert.equal(bound.submissionId, saved.result.id);
      assert.equal(bound.submissionRevision, 1);
      const response = await fileDownload(users.teacher, item.metadata.id);
      assert.equal(
        crypto
          .createHash("sha256")
          .update(Buffer.from(await response.arrayBuffer()))
          .digest("hex"),
        crypto.createHash("sha256").update(item.bytes).digest("hex"),
      );
      await fileDownload(users.otherStudent, item.metadata.id, 403);
    }
    const denied = await fetch(
      origin + "/api/teaching/files/" + pendingFiles[0].metadata.id,
      {
        headers: headers(users.student, {
          "x-lumio-account": users.teacher.key,
        }),
      },
    );
    assert.equal(denied.status, 401);
  },
);
await check(
  5,
  "Compiled uploaded bytes survive real SQLite backup/restore with immutable submission metadata",
  async () => {
    const { snapshot } = require("./database-snapshot.cjs"),
      backup = path.join(scratch, "files-backup.sqlite"),
      restored = path.join(scratch, "files-restored.sqlite");
    snapshot(dbPath, backup);
    snapshot(backup, restored);
    const copy = new DatabaseSync(restored, { readOnly: true });
    for (const item of pendingFiles) {
      const row = copy
        .prepare("SELECT * FROM teaching_files WHERE id=?")
        .get(item.metadata.id);
      assert.ok(row.submission_id);
      assert.equal(Number(row.submission_revision), 1);
      const chunks = copy
        .prepare(
          "SELECT data FROM teaching_file_chunks WHERE file_id=? ORDER BY ordinal",
        )
        .all(item.metadata.id);
      assert.deepEqual(
        Buffer.concat(chunks.map((chunk) => Buffer.from(chunk.data))),
        item.bytes,
      );
    }
    copy.close();
    report.fileAcceptance = {
      status: "PASS",
      uploadedFormats: ["PNG", "DOCX", "PPTX"],
      submittedAttachments: pendingFiles.length,
      privateTeacherFilesHidden: true,
      snapshotRestore: true,
      mode: "Compiled HTTP + actual cookies and isolated SQLite; synthetic authored Office packages validate storage/type, not full Office rendering fidelity",
    };
  },
);
if (process.env.LUMIO_FILES_HTTP_UI_HOLD === "isolated-synthetic") {
  const fixturePath = path.join(scratch, "browser-session.json"),
    donePath = path.join(scratch, "browser-done.json");
  fs.writeFileSync(
    fixturePath,
    JSON.stringify(
      {
        origin,
        teacher: users.teacher,
        student: users.student,
        otherStudent: users.otherStudent,
        orgId: orgA,
        classId: classA.id,
        publishedLessonId: fileLesson.id,
        questionId: fileQuestion.id,
        donePath,
        scope:
          "Isolated compiled application, synthetic signed JWT sessions, authored records only; no real OAuth or accounts",
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log("CONNECTED_BROWSER_FIXTURE=" + fixturePath);
  const deadline = Date.now() + 12 * 60 * 1000;
  while (!fs.existsSync(donePath) && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 500));
  assert.ok(fs.existsSync(donePath), "CONNECTED_BROWSER_ACCEPTANCE_TIMED_OUT");
  const accepted = JSON.parse(fs.readFileSync(donePath, "utf8"));
  assert.equal(accepted.status, "PASS", "CONNECTED_BROWSER_ACCEPTANCE_FAILED");
  assert.ok(Number.isSafeInteger(accepted.passed) && accepted.passed > 0);
  report.connectedBrowserAcceptance = {
    status: "PASS",
    passed: accepted.passed,
    scope:
      "Actual browser form/client + compiled HTTP/SQLite; synthetic JWT sessions, no intercepted business API",
    ...(typeof accepted.report === "string" &&
    /^docs\/[A-Za-z0-9_./-]+\.json$/.test(accepted.report)
      ? { report: accepted.report }
      : {}),
  };
  save();
}
