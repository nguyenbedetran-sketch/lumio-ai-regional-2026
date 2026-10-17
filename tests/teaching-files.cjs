// Actual API handlers + canonical teaching store/transactions. Synthetic OAuth
// session and authored fixture records only; no provider or production accounts.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  ts = require("typescript"),
  { DatabaseSync } = require("node:sqlite"),
  { randomUUID, createHash } = require("node:crypto"),
  { zipSync, strToU8 } = require("fflate");
const root = path.resolve(__dirname, ".."),
  cache = new Map(),
  checks = [],
  remote = process.argv.includes("--remote"),
  native = process.argv.includes("--native-adapter"),
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-files-qa-")),
  file = path.join(folder, "test.sqlite");
let session = null,
  store,
  db,
  clock = Date.now(),
  activeCase = "configuration",
  trace = { count: 0, ms: 0, slowest: [], mutations: [] };
const originalFetch = global.fetch;
function load(relative) {
  const filename = path.resolve(root, relative);
  if (filename === path.join(root, "lib/lumio/auth.ts"))
    return { authOptions: () => ({}) };
  if (cache.has(filename)) return cache.get(filename).exports;
  const m = { exports: {} };
  cache.set(filename, m);
  const nativeRequire = require("node:module").createRequire(filename);
  const local = (name) =>
    name === "next-auth"
      ? { getServerSession: async () => session }
      : name.startsWith(".")
        ? load(path.resolve(path.dirname(filename), name + ".ts"))
        : nativeRequire(name);
  local.resolve = nativeRequire.resolve;
  new Function(
    "require",
    "module",
    "exports",
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  )(local, m, m.exports);
  return m.exports;
}
Object.assign(process.env, {
  NODE_ENV: "development",
  AUTH_TRUST_HOST: "true",
  NEXTAUTH_URL: "http://127.0.0.1:3000",
  NEXTAUTH_SECRET: "synthetic-teaching-files-secret-no-provider",
  LUMIO_COMPETITION_PREVIEW: "false",
  LUMIO_BACKGROUND_JOBS_DISABLED: "true",
});
function config() {
  if (remote) {
    assert.equal(process.env.LUMIO_DATABASE_QA_CONFIRM, "isolated-synthetic");
    const parsed = load(
      "lib/server/database-connection.ts",
    ).databaseConfiguration();
    assert.equal(parsed.mode, "remote-libsql");
    assert.equal(
      new URL(parsed.url).hostname,
      "lumio-v9-qa-20261017-lumio-ai26a0048.aws-ap-northeast-1.turso.io",
    );
    return parsed;
  }
  return { url: file };
}
const options = config(),
  platform = load("lib/server/store.ts"),
  ownerEmail = `files-${randomUUID()}@example.test`;
function open() {
  db =
    remote || native
      ? new (load("lib/server/database-remote.ts").SqliteWorkerConnection)(
          options,
        )
      : new DatabaseSync(file);
  const originalPrepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const statement = originalPrepare(sql),
      id = createHash("sha256").update(sql).digest("hex").slice(0, 16);
    const invoke = (kind, args) => {
      const start = performance.now();
      try {
        return statement[kind](...args);
      } finally {
        const ms = Math.round(performance.now() - start);
        trace.count++;
        trace.ms += ms;
        trace.slowest.push({ kind, query: id, ms });
        trace.slowest.sort((a, b) => b.ms - a.ms);
        trace.slowest.length = Math.min(trace.slowest.length, 5);
      }
    };
    return {
      get: (...args) => invoke("get", args),
      all: (...args) => invoke("all", args),
      run: (...args) => invoke("run", args),
    };
  };
  store = platform.createStore(":file-qa:", {
    database: db,
    adminEmails: [ownerEmail],
    now: () => clock,
  });
  const mutate = store.mutateTeaching;
  store.mutateTeaching = (...args) => {
    const start = performance.now(),
      before = trace.count;
    try {
      const value = mutate(...args);
      trace.mutations.push({
        action: args[2]?.action,
        status: "success",
        queries: trace.count - before,
        ms: Math.round(performance.now() - start),
      });
      return value;
    } catch (error) {
      trace.mutations.push({
        action: args[2]?.action,
        status: "error",
        code: error?.code || "ERROR",
        queries: trace.count - before,
        ms: Math.round(performance.now() - start),
      });
      throw error;
    }
  };
  Object.assign(platform, {
    getStore: () => store,
    getUser: (id) => store.getUser(id),
  });
}
const uploadAPI = load("app/api/teaching/files/route.ts"),
  objectAPI = load("app/api/teaching/files/[id]/route.ts"),
  teachingAPI = load("app/api/teaching/route.ts"),
  origin = "http://127.0.0.1:3000";
const record = async (name, fn) => {
  activeCase = name;
  trace = { count: 0, ms: 0, slowest: [], mutations: [] };
  const started = performance.now();
  await fn();
  checks.push({
    name,
    status: "PASS",
    ms: Math.round(performance.now() - started),
    queries: trace.count,
    sqlTimeMs: trace.ms,
    mutations: trace.mutations,
    slowestQueries: trace.slowest,
  });
  console.log("PASS " + name);
};
function req(user, method, body, headers = {}, id = "") {
  session = user
    ? { userId: user.id, sessionVersion: user.sessionVersion }
    : null;
  return new Request(origin + "/api/teaching/files" + (id ? "/" + id : ""), {
    method,
    headers: {
      ...(user ? { "x-lumio-account": user.storageKey } : {}),
      ...(method === "GET"
        ? {}
        : { origin, "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function upload(user, body, status = 200, headers = {}) {
  const response = await uploadAPI.POST(req(user, "POST", body, headers)),
    value = await response.json();
  assert.equal(response.status, status, JSON.stringify(value));
  return value;
}
async function download(user, id, status = 200, headers = {}) {
  const response = await objectAPI.GET(
    req(user, "GET", undefined, headers, id),
    { params: Promise.resolve({ id }) },
  );
  assert.equal(response.status, status, "download status");
  return response;
}
const rejected = (fn, code) =>
  assert.throws(fn, (error) => error.code === code);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const testedSourceSha256 = Object.fromEntries(
  [
    "lib/server/teaching-files.ts",
    "lib/server/teaching-file-validation.ts",
    "lib/server/teaching-core.ts",
    "lib/server/teaching-file-schema.ts",
    "lib/server/database-integrity.ts",
  ].map((file) => [file, digest(fs.readFileSync(path.join(root, file)))]),
);
const out = path.join(
  root,
  "docs/next/reports/teaching-files",
  remote ? "remote-qa.json" : native ? "native-adapter.json" : "local-api.json",
);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  JSON.stringify(
    {
      status: "RUNNING",
      checkedAt: new Date().toISOString(),
      sourceSha256: testedSourceSha256,
    },
    null,
    2,
  ) + "\n",
);
async function main() {
  if (!remote && !native)
    await record(
      "Real schema18 snapshot remains inspectable and migrates additively to19",
      () => {
        const initial = new DatabaseSync(file);
        initial.exec(
          "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
        );
        for (const migration of load("lib/server/schema.ts").migrations.filter(
          (m) => m.version <= 18,
        )) {
          initial.exec(migration.sql);
          initial
            .prepare("INSERT INTO schema_migrations VALUES (?,?)")
            .run(migration.version, new Date(clock).toISOString());
        }
        initial.close();
        const snapshot = require("../scripts/database-snapshot.cjs");
        assert.equal(snapshot.inspect(file).schemaVersion, 18);
        snapshot.snapshot(file, path.join(folder, "before18.sqlite"));
      },
    );
  open();
  assert.equal(store.runtimeHealth().schemaVersion >= 19, true);
  const user = (name, admin = false) =>
    store.ensureIdentity({
      provider: "google",
      providerAccountId: "files-qa-" + randomUUID(),
      email: admin ? ownerEmail : undefined,
      emailVerified: admin,
      name: "Synthetic " + name,
    });
  const owner = user("owner", true),
    student = user("student"),
    other = user("other"),
    outsider = user("outsider", true),
    prefix = randomUUID(),
    orgId = prefix + "-o",
    classId = prefix + "-c",
    assignmentId = prefix + "-a",
    lessonId = prefix + "-l",
    questionId = prefix + "-q",
    stamp = new Date(clock).toISOString();
  const question = {
    id: questionId,
    revision: 1,
    prompt: "Tính 2 + 2.",
    kind: "mcq",
    choices: ["4", "5", "3", "2"],
    correctIndex: 0,
    maxPoints: 1,
    topic: "Số học",
    difficulty: "basic",
    explanation: "2 + 2 = 4.",
    references: [],
  };
  const assignment = {
    title: "Synthetic file assignment",
    instructions: "Answer and attach authored files.",
    questionIds: [questionId],
    questions: [question],
    target: { kind: "class", ids: [] },
    dueAt: new Date(clock + 86400000).toISOString(),
    maxPoints: 1,
  };
  // Author fixtures directly; every tested authorization/upload/submission below
  // invokes the real handler and canonical store rather than a seeded UI.
  db.prepare("INSERT INTO organizations(id,name,created_at) VALUES(?,?,?)").run(
    orgId,
    "Synthetic files QA",
    stamp,
  );
  db.prepare(
    "INSERT INTO teaching_organizations(organization_id,settings_json,created_by) VALUES(?,?,?)",
  ).run(
    orgId,
    JSON.stringify({
      name: "Synthetic files QA",
      timezone: "Asia/Ho_Chi_Minh",
      allowLateSubmissions: false,
    }),
    owner.id,
  );
  for (const [u, role] of [
    [owner, "OWNER"],
    [student, "STUDENT"],
    [other, "STUDENT"],
  ])
    db.prepare(
      "INSERT INTO memberships(user_id,organization_id,role) VALUES(?,?,?)",
    ).run(u.id, orgId, role);
  db.prepare(
    "INSERT INTO teaching_classes(id,organization_id,name,subject,grade,description,created_at) VALUES(?,?,?,?,?,?,?)",
  ).run(classId, orgId, "Synthetic9", "Math", "9", "Synthetic only", stamp);
  for (const u of [student, other])
    db.prepare(
      "INSERT INTO teaching_enrollments(id,class_id,user_id,joined_at) VALUES(?,?,?,?)",
    ).run(randomUUID(), classId, u.id, stamp);
  db.prepare(
    "INSERT INTO teaching_content(id,organization_id,class_id,kind,data_json,status,created_by,created_at,updated_at) VALUES(?,?,?,'lesson',?,'draft',?,?,?)",
  ).run(
    lessonId,
    orgId,
    classId,
    JSON.stringify({
      title: "Synthetic lesson",
      topic: "Math",
      grade: "9",
      objectives: ["Learn"],
      sections: [
        { title: "Start", body: "Authored safe content.", references: [] },
      ],
      sourceIds: [],
    }),
    owner.id,
    stamp,
    stamp,
  );
  db.prepare(
    "INSERT INTO teaching_assignments(id,organization_id,class_id,data_json,created_by,created_at) VALUES(?,?,?,?,?,?)",
  ).run(
    assignmentId,
    orgId,
    classId,
    JSON.stringify(assignment),
    owner.id,
    stamp,
  );
  db.prepare(
    "INSERT INTO teaching_assessment_windows(assignment_id,root_assignment_id,attempt_no,available_from,created_by,created_at) VALUES(?,?,1,?,?,?)",
  ).run(assignmentId, assignmentId, stamp, owner.id, stamp);
  for (const u of [student, other])
    db.prepare(
      "INSERT INTO teaching_assignment_targets(assignment_id,user_id) VALUES(?,?)",
    ).run(assignmentId, u.id);
  const body = (
    target = "assignment",
    data = Buffer.from("Authored worksheet $x^2=9$."),
    filename = "worksheet.txt",
  ) => ({
    requestId: randomUUID(),
    orgId,
    target: { kind: target, id: target === "lesson" ? lessonId : assignmentId },
    filename,
    dataBase64: data.toString("base64"),
  });
  let reference, privateFile, pending, ownOther, submissionId, submittedBody;
  const pendingSelection = [];
  await record(
    "Filename, extension, binary magic, UTF8 and OOXML zip limits fail closed",
    () => {
      const { validateTeachingFile: validate } = load(
        "lib/server/teaching-file-validation.ts",
      );
      for (const [name, bytes] of [
        ["x.svg", "<svg/>"],
        ["../x.txt", "hello"],
        ["x.pdf", "not a PDF"],
        ["x.png", "not PNG"],
        ["x.txt", Buffer.from([255, 254, 0])],
        ["x.docx", "not ZIP"],
      ])
        assert.throws(() =>
          validate(name, Buffer.from(bytes).toString("base64")),
        );
      const docx = zipSync({
        "[Content_Types].xml": strToU8(
          '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        ),
        "word/document.xml": strToU8(
          "<w:document><w:p>Authored worksheet</w:p></w:document>",
        ),
      });
      assert.equal(
        validate(
          "worksheet.docx",
          Buffer.from(docx).toString("base64"),
        ).mime.includes("wordprocessingml"),
        true,
      );
      const pptx = zipSync({
        "[Content_Types].xml": strToU8(
          '<Types><Override ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>',
        ),
        "ppt/presentation.xml": strToU8("<p:presentation/>"),
      });
      assert.equal(
        validate(
          "slides.pptx",
          Buffer.from(pptx).toString("base64"),
        ).mime.includes("presentationml"),
        true,
      );
      for (const extra of [
        { "word/vbaProject.bin": new Uint8Array([1]) },
        {
          "word/_rels/document.xml.rels": strToU8(
            '<Relationship TargetMode="External" Target="https://example.invalid"/>',
          ),
        },
        { "../bad.xml": strToU8("bad") },
        { "word/bomb.xml": new Uint8Array(1024 * 1024) },
      ]) {
        const archive = zipSync({
          "[Content_Types].xml": strToU8("wordprocessingml.document.main+xml"),
          "word/document.xml": strToU8("<w:document/>"),
          ...extra,
        });
        assert.throws(() =>
          validate("bad.docx", Buffer.from(archive).toString("base64")),
        );
      }
      const forged = Buffer.from(
        zipSync({
          "[Content_Types].xml": strToU8("wordprocessingml.document.main+xml"),
          "word/document.xml": new Uint8Array(8 * 1024 * 1024),
        }),
      );
      let central = forged.length - 22;
      while (forged.readUInt32LE(central) !== 0x06054b50) central--;
      let entry = forged.readUInt32LE(central + 16);
      for (let n = 0; n < forged.readUInt16LE(central + 10); n++) {
        const length = forged.readUInt16LE(entry + 28),
          name = forged.subarray(entry + 46, entry + 46 + length).toString();
        if (name === "word/document.xml")
          forged.writeUInt32LE(1024, entry + 24);
        entry +=
          46 +
          length +
          forged.readUInt16LE(entry + 30) +
          forged.readUInt16LE(entry + 32);
      }
      const bombStarted = performance.now();
      assert.throws(() => validate("forged.docx", forged.toString("base64")));
      assert.ok(
        performance.now() - bombStarted < 2000,
        "native output ceiling rejects forged expansion promptly",
      );
      const corrupt = Buffer.from(docx);
      const payload = corrupt.indexOf(Buffer.from("PK"));
      corrupt[
        payload +
          30 +
          corrupt.readUInt16LE(payload + 26) +
          corrupt.readUInt16LE(payload + 28)
      ] ^= 1;
      assert.throws(() => validate("corrupt.docx", corrupt.toString("base64")));
      assert.throws(() =>
        validate("large.txt", Buffer.alloc(1048577, 65).toString("base64")),
      );
    },
  );
  await record(
    "Actual upload handler requires origin, canonical login and captured account",
    async () => {
      await upload(null, body(), 401);
      await upload(owner, body(), 401, {
        "x-lumio-account": student.storageKey,
      });
      await upload(owner, body(), 403, { origin: "https://evil.invalid" });
      await upload(owner, body(), 401, { authorization: "Bearer invented" });
    },
  );
  await record(
    "Bounded HTTP stream rejects oversized bytes without trusting Content-Length",
    async () => {
      session = { userId: owner.id, sessionVersion: owner.sessionVersion };
      const request = new Request(origin + "/api/teaching/files", {
        method: "POST",
        headers: {
          origin,
          "x-lumio-account": owner.storageKey,
          "content-type": "application/json",
        },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(1404097));
            controller.close();
          },
        }),
        duplex: "half",
      });
      const response = await uploadAPI.POST(request);
      assert.equal(response.status, 413);
    },
  );
  await record(
    "Actual reference upload persists bytes and same-UUID lostACK retry has one object",
    async () => {
      const input = body();
      reference = (await upload(owner, input)).file;
      const replay = (await upload(owner, input)).file;
      assert.equal(reference.id, replay.id);
      assert.equal(reference.status, "attached");
      assert.equal(
        Number(
          db
            .prepare("SELECT count(*) n FROM teaching_files WHERE request_id=?")
            .get(input.requestId).n,
        ),
        1,
      );
      await upload(
        owner,
        { ...input, dataBase64: Buffer.from("different").toString("base64") },
        409,
      );
      const response = await download(owner, reference.id);
      assert.equal(
        Buffer.from(await response.arrayBuffer()).toString(),
        "Authored worksheet $x^2=9$.",
      );
      for (const [key, expected] of [
        ["cache-control", /private.*no-store/],
        ["content-disposition", /^attachment/],
        ["x-content-type-options", /^nosniff$/],
        ["content-security-policy", /sandbox/],
      ])
        assert.match(response.headers.get(key), expected);
    },
  );
  await record(
    "Target file-count cap and safe draft deletion use real handlers",
    async () => {
      const deletedRequest = body();
      const second = (await upload(owner, deletedRequest)).file;
      const third = (await upload(owner, body())).file;
      assert.equal(
        (await upload(owner, body(), 409)).error,
        "TEACHING_FILE_COUNT",
      );
      for (const item of [second, third, third]) {
        const response = await objectAPI.DELETE(
          req(owner, "DELETE", undefined, {}, item.id),
          { params: Promise.resolve({ id: item.id }) },
        );
        assert.equal(response.status, 200);
      }
      assert.equal(
        (await upload(owner, deletedRequest, 409)).error,
        "TEACHING_FILE_REQUEST_FINALIZED",
      );
      assert.equal(
        db
          .prepare("SELECT id FROM teaching_files WHERE request_id=?")
          .get(deletedRequest.requestId),
        undefined,
      );
    },
  );
  if (!remote)
    await record(
      "Mid-chunk write failure rolls back metadata, bytes, audit and target revision",
      async () => {
        const input = body("lesson", Buffer.alloc(700000, 65), "rollback.txt"),
          originalPrepare = db.prepare.bind(db),
          revision = db
            .prepare("SELECT revision FROM teaching_content WHERE id=?")
            .get(lessonId).revision;
        db.prepare = (sql) => {
          const statement = originalPrepare(sql);
          if (!sql.startsWith("INSERT INTO teaching_file_chunks"))
            return statement;
          return {
            run(...args) {
              if (args[1] === 1) throw Error("AUTHORED_CHUNK_FAILURE");
              return statement.run(...args);
            },
          };
        };
        try {
          const value = await upload(owner, input, 503);
          assert.equal(value.error, "PLATFORM_UNAVAILABLE");
          assert.equal(JSON.stringify(value).includes("AUTHORED"), false);
        } finally {
          db.prepare = originalPrepare;
        }
        assert.equal(
          db
            .prepare("SELECT id FROM teaching_files WHERE request_id=?")
            .get(input.requestId),
          undefined,
        );
        assert.equal(
          db
            .prepare("SELECT revision FROM teaching_content WHERE id=?")
            .get(lessonId).revision,
          revision,
        );
      },
    );
  await record(
    "Teacher-only/draft files never enter student payload or unauthorized downloads",
    async () => {
      privateFile = (
        await upload(owner, {
          ...body(),
          visibility: "teacher-only",
          filename: "private-key.txt",
        })
      ).file;
      await download(student, reference.id, 403);
      await download(student, privateFile.id, 403);
      await download(outsider, reference.id, 403);
      assert.equal(
        store.readTeaching(student.id, student.sessionVersion, { orgId }).files
          .length,
        0,
      );
      await download(owner, reference.id, 401, { "x-lumio-account": "wrong" });
      await download(null, reference.id, 401);
    },
  );
  db.prepare("UPDATE teaching_assignments SET status='issued' WHERE id=?").run(
    assignmentId,
  );
  await record(
    "Issued reference accessible only to current recipients; teacher-only metadata stays hidden",
    async () => {
      assert.equal((await download(student, reference.id)).status, 200);
      await download(student, privateFile.id, 403);
      const files = store.readTeaching(student.id, student.sessionVersion, {
        orgId,
      }).files;
      assert.ok(files.some((f) => f.id === reference.id));
      assert.ok(!files.some((f) => f.id === privateFile.id));
      await upload(owner, body(), 409);
    },
  );
  await record(
    "Student upload remains pending/owner-only and does not create a submission",
    async () => {
      pending = (
        await upload(
          student,
          body(
            "submission",
            Buffer.from("Authored student calculation."),
            "answer.md",
          ),
        )
      ).file;
      ownOther = (
        await upload(
          other,
          body(
            "submission",
            Buffer.from("Another authored answer."),
            "other.txt",
          ),
        )
      ).file;
      pendingSelection.push(pending.id);
      for (const name of ["steps.txt", "project.md"])
        pendingSelection.push(
          (
            await upload(
              student,
              body("submission", Buffer.from("Authored " + name), name),
            )
          ).file.id,
        );
      assert.equal(pending.status, "pending");
      assert.equal(
        Number(
          db
            .prepare(
              "SELECT count(*) n FROM teaching_submissions WHERE assignment_id=?",
            )
            .get(assignmentId).n,
        ),
        0,
      );
      await download(owner, pending.id, 403);
      await download(other, pending.id, 403);
      await download(student, pending.id);
      assert.ok(
        store
          .readTeaching(student.id, student.sessionVersion, { orgId })
          .files.some((f) => f.id === pending.id),
      );
      assert.ok(
        !store
          .readTeaching(owner.id, owner.sessionVersion, { orgId })
          .files.some((f) => f.id === pending.id),
      );
    },
  );
  await record(
    "Foreign attachment ID causes atomic rollback of actual submission mutation",
    () => {
      rejected(
        () =>
          store.mutateTeaching(student.id, student.sessionVersion, {
            requestId: randomUUID(),
            orgId,
            action: "submission.submit",
            assignmentId,
            expectedRevision: 0,
            answers: [{ questionId, response: 0 }],
            attachmentIds: [ownOther.id],
          }),
        "TEACHING_FILE_FORBIDDEN",
      );
      assert.equal(
        Number(
          db
            .prepare(
              "SELECT count(*) n FROM teaching_submissions WHERE assignment_id=?",
            )
            .get(assignmentId).n,
        ),
        0,
      );
      assert.equal(
        db
          .prepare("SELECT submission_id FROM teaching_files WHERE id=?")
          .get(pending.id).submission_id,
        null,
      );
    },
  );
  await record(
    "ServerACK atomically binds exact own pending files; submission idempotency preserves bytes",
    async () => {
      submittedBody = {
        requestId: randomUUID(),
        orgId,
        action: "submission.submit",
        assignmentId,
        expectedRevision: 0,
        answers: [{ questionId, response: 0 }],
        attachmentIds: pendingSelection,
      };
      const saved = store.mutateTeaching(
        student.id,
        student.sessionVersion,
        submittedBody,
      );
      submissionId = saved.result.id;
      assert.equal(
        store.mutateTeaching(student.id, student.sessionVersion, submittedBody)
          .replayed,
        true,
      );
      const bound = saved.state.files.find((f) => f.id === pending.id);
      assert.equal(bound.submissionId, submissionId);
      assert.equal(bound.submissionRevision, 1);
      assert.equal(bound.status, "attached");
      assert.equal(
        saved.state.files.filter(
          (file) =>
            file.submissionId === submissionId && file.submissionRevision === 1,
        ).length,
        3,
      );
      await download(owner, pending.id);
      await download(other, pending.id, 403);
      await download(outsider, pending.id, 403);
    },
  );
  await record(
    "Submitted file bytes and identity reject mutation/deletion, including direct SQL history tampering",
    async () => {
      session = { userId: student.id, sessionVersion: student.sessionVersion };
      const response = await objectAPI.DELETE(
        req(student, "DELETE", undefined, {}, pending.id),
        { params: Promise.resolve({ id: pending.id }) },
      );
      assert.equal(response.status, 403);
      for (const sql of [
        "UPDATE teaching_file_chunks SET data=x'41' WHERE file_id=?",
        "DELETE FROM teaching_file_chunks WHERE file_id=?",
        "DELETE FROM teaching_files WHERE id=?",
        "UPDATE teaching_files SET filename='replacement.txt' WHERE id=?",
      ])
        assert.throws(() => db.prepare(sql).run(pending.id));
    },
  );
  await record(
    "Canonical membership/session revocation removes file access and idempotent replay rights",
    async () => {
      db.prepare(
        "UPDATE teaching_enrollments SET active=0 WHERE user_id=? AND class_id=?",
      ).run(student.id, classId);
      await download(student, pending.id, 403);
      rejected(
        () =>
          store.mutateTeaching(
            student.id,
            student.sessionVersion,
            submittedBody,
          ),
        "TEACHING_FORBIDDEN",
      );
      db.prepare(
        "UPDATE teaching_enrollments SET active=1 WHERE user_id=? AND class_id=?",
      ).run(student.id, classId);
      db.prepare(
        "UPDATE users SET session_version=session_version+1 WHERE id=?",
      ).run(student.id);
      await download(student, pending.id, 401);
      student.sessionVersion++;
    },
  );
  await record(
    "Deadline is rechecked at finalization and rejected submission leaves pending bytes intact",
    async () => {
      clock += 86400001;
      rejected(
        () =>
          store.mutateTeaching(other.id, other.sessionVersion, {
            requestId: randomUUID(),
            orgId,
            action: "submission.submit",
            assignmentId,
            expectedRevision: 0,
            answers: [{ questionId, response: 0 }],
            attachmentIds: [ownOther.id],
          }),
        "TEACHING_DUE_PASSED",
      );
      assert.equal(
        db
          .prepare("SELECT submission_id FROM teaching_files WHERE id=?")
          .get(ownOther.id).submission_id,
        null,
      );
      clock -= 86400001;
    },
  );
  let large;
  await record(
    "OneMiB uses four bounded BLOB chunks, exact bytes survive connection close/reopen",
    async () => {
      const bytes = Buffer.alloc(1048576, 65);
      large = (await upload(owner, body("lesson", bytes, "large.txt"))).file;
      const rows = db
        .prepare(
          "SELECT length(data) n FROM teaching_file_chunks WHERE file_id=?",
        )
        .all(large.id);
      assert.equal(rows.length, 4);
      assert.ok(rows.every((r) => r.n <= 262144));
      store.close();
      open();
      const response = await download(owner, large.id);
      assert.equal(
        digest(Buffer.from(await response.arrayBuffer())),
        digest(bytes),
      );
      await download(owner, pending.id);
    },
  );
  await record(
    "Pending expiration cleanup never purges attached or submitted objects",
    async () => {
      clock += 86400001;
      await upload(
        owner,
        body("lesson", Buffer.from("Cleanup trigger"), "cleanup.txt"),
      );
      assert.equal(
        db.prepare("SELECT id FROM teaching_files WHERE id=?").get(ownOther.id),
        undefined,
      );
      assert.ok(
        db.prepare("SELECT id FROM teaching_files WHERE id=?").get(pending.id),
      );
      assert.ok(
        db.prepare("SELECT id FROM teaching_files WHERE id=?").get(large.id),
      );
    },
  );
  if (!remote)
    await record(
      "Real stored BLOB bytes reach the organization cap; persisted synthetic audit events enforce daily rate",
      async () => {
        let targetId = "",
          used = 3;
        const block = Buffer.alloc(1048576, 66);
        while (
          Number(
            db
              .prepare(
                "SELECT coalesce(sum(bytes),0) n FROM teaching_files WHERE organization_id=?",
              )
              .get(orgId).n,
          ) +
            block.length <=
          20971520
        ) {
          if (used === 3) {
            targetId = randomUUID();
            used = 0;
            db.prepare(
              "INSERT INTO teaching_content(id,organization_id,class_id,kind,data_json,status,created_by,created_at,updated_at) VALUES(?,?,?,'lesson',?,'draft',?,?,?)",
            ).run(
              targetId,
              orgId,
              classId,
              JSON.stringify({
                title: "Authored quota fixture",
                topic: "Math",
                grade: "9",
                objectives: ["Learn"],
                sections: [{ title: "Start", body: "Fixture", references: [] }],
                sourceIds: [],
              }),
              owner.id,
              new Date(clock).toISOString(),
              new Date(clock).toISOString(),
            );
          }
          await upload(owner, {
            ...body("lesson", block, "quota.txt"),
            target: { kind: "lesson", id: targetId },
          });
          used++;
        }
        assert.equal(
          (
            await upload(
              owner,
              {
                ...body("lesson", block, "quota-next.txt"),
                target: { kind: "lesson", id: targetId },
              },
              409,
            )
          ).error,
          "TEACHING_FILE_QUOTA",
        );
        assert.ok(
          Number(
            db
              .prepare(
                "SELECT coalesce(sum(length(c.data)),0) n FROM teaching_file_chunks c JOIN teaching_files f ON f.id=c.file_id WHERE f.organization_id=?",
              )
              .get(orgId).n,
          ) <= 20971520,
        );
        for (let i = 0; i < 60; i++)
          store.recordAudit({
            actorId: owner.id,
            action: "TEACHING_FILE_UPLOADED",
            target: "synthetic-rate-boundary",
            after: { synthetic: true },
          });
        assert.equal(
          (
            await upload(
              owner,
              body("lesson", Buffer.from("a"), "rate.txt"),
              429,
            )
          ).error,
          "TEACHING_FILE_RATE_LIMIT",
        );
      },
    );
  if (!remote && !native)
    await record(
      "Full schema19 snapshot/restore preserves file hashes, submitted history and legacy18 inspection",
      () => {
        store.close();
        store = null;
        const snapshot = require("../scripts/database-snapshot.cjs"),
          backup = path.join(folder, "with-files19.sqlite"),
          restored = path.join(folder, "restored19.sqlite");
        assert.equal(snapshot.snapshot(file, backup).schemaVersion >= 19, true);
        snapshot.snapshot(backup, restored);
        assert.equal(
          snapshot.inspect(path.join(folder, "before18.sqlite")).schemaVersion,
          18,
        );
        const recovered = new DatabaseSync(restored),
          restoredStore = platform.createStore(":restore:", {
            database: recovered,
            now: () => clock,
          });
        assert.equal(
          restoredStore.readTeachingFile(
            owner.id,
            owner.sessionVersion,
            large.id,
          ).file.sha256,
          large.sha256,
        );
        assert.equal(
          restoredStore.readTeachingFile(
            owner.id,
            owner.sessionVersion,
            pending.id,
          ).file.submissionId,
          submissionId,
        );
        restoredStore.close();
        open();
      },
    );
  const result = {
    status: "PASS",
    schemaVersion: store.runtimeHealth().schemaVersion,
    fileSchemaVersion: 19,
    sourceSha256: testedSourceSha256,
    checkedAt: new Date().toISOString(),
    passed: checks.length,
    checks,
    scope: remote
      ? "Approved isolated Turso QA database; authored fixtures + actual API/store/remote BLOB persist/reopen; synthetic OAuth only, no production users/provider/payments"
      : native
        ? "Actual native libSQL child/IPC with local SQLite; NOT remote durability evidence; actual handlers and authored fixtures"
        : "Actual handlers, canonical store, isolated SQLite, additive migration18toCurrent and real snapshot/restore; synthetic OAuth/fixture records only",
    limits: {
      bytesPerFile: 1048576,
      filesPerTarget: 3,
      organizationBytes: 20971520,
      organizationFiles: 200,
      uploadsPerActorPerDay: 60,
      pendingHours: 24,
    },
    unverified: [
      "No malware scanning",
      "No inline PDF/Office preview/conversion",
      "No large media upload",
      "No genuine Google/browser login acceptance",
      "Historical submitted bytes count toward organization quota",
    ],
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify({
      status: "PASS",
      passed: checks.length,
      mode: remote ? "remote-qa" : native ? "native-adapter" : "local-api",
    }),
  );
}
if (!remote && !native)
  global.fetch = async () => {
    throw Error("EXTERNAL_NETWORK_FORBIDDEN");
  };
main()
  .catch((error) => {
    fs.writeFileSync(
      out,
      JSON.stringify(
        {
          status: "FAIL",
          checkedAt: new Date().toISOString(),
          passed: checks.length,
          checks,
          activeCase,
          trace,
          sourceSha256: testedSourceSha256,
          errorCode: /^[A-Z_]+$/.test(error?.code || "")
            ? error.code
            : "FILE_QA_FAILED",
          scope: remote
            ? "Isolated approved QA Turso only; synthetic fixtures"
            : "Isolated local fixtures",
        },
        null,
        2,
      ) + "\n",
    );
    console.error(
      JSON.stringify({
        status: "FAIL",
        passed: checks.length,
        code: /^[A-Z_]+$/.test(error?.code || "")
          ? error.code
          : "FILE_QA_FAILED",
        message: remote ? undefined : error.message,
        stack: remote ? undefined : error.stack,
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      store?.close();
    } catch {}
    global.fetch = originalFetch;
  });
