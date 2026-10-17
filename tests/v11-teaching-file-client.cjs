const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name.startsWith(".")
        ? load(
            path.relative(root, path.resolve(path.dirname(file), name + ".ts")),
          )
        : require(name),
    mod,
    mod.exports,
  );
  return mod.exports;
}

const c = load("lib/teaching/file-client.ts"),
  limits = load("lib/teaching/file-contracts.ts").teachingFileLimits;
const payload = {
  requestId: "bc66cc92-a855-403a-bcf3-c236bd542039",
  orgId: "org",
  target: { kind: "submission", id: "assignment" },
  visibility: "reference",
  filename: "bài.md",
  dataBase64: "aGk=",
};
const meta = (v = {}) => ({
  id: "file",
  name: "bài.md",
  mime: "text/markdown",
  bytes: 2,
  sha256: "a".repeat(64),
  createdAt: "2026-10-17T00:00:00Z",
  orgId: "org",
  classId: "class",
  uploaderId: "user",
  targetKind: "submission",
  targetId: "assignment",
  purpose: "submission",
  status: "pending",
  ...v,
});
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
(async () => {
  await test("Client file limit reuses server contract and rejects active/large formats", () => {
    assert.equal(c.TEACHING_FILE_LIMIT, limits.fileBytes);
    for (const name of [
      "work.PDF",
      "bài.docx",
      "slides.pptx",
      "a.png",
      "b.jpeg",
      "c.webp",
      "d.txt",
      "note.md",
    ])
      assert.ok(c.validTeachingFile({ name, size: 1 }));
    for (const name of ["x.svg", "x.html", "x.zip", "x.mp4", "x.mp3", "x.exe"])
      assert.equal(c.validTeachingFile({ name, size: 1 }), false);
    for (const size of [0, limits.fileBytes + 1, -1])
      assert.equal(c.validTeachingFile({ name: "x.pdf", size }), false);
  });
  await test("Encoder preserves full 1MiB bytes without argument overflow", () => {
    const bytes = Uint8Array.from(
      { length: limits.fileBytes },
      (_, n) => n % 256,
    );
    assert.deepEqual(
      Buffer.from(c.encodeTeachingFile(bytes), "base64"),
      Buffer.from(bytes),
    );
  });
  const old = global.fetch,
    req = [];
  try {
    await test("Upload request and pending ACK bind account, organization and target", async () => {
      global.fetch = async (url, opt) => {
        req.push({ url, ...opt });
        return {
          ok: true,
          json: async () => ({ targetRevision: 1, file: meta() }),
        };
      };
      const saved = await c.uploadTeachingFile(
        "qa-account",
        payload,
        2,
        new AbortController().signal,
      );
      assert.equal(saved.status, "pending");
      assert.equal(saved.submissionId, undefined);
      assert.equal(req[0].url, "/api/teaching/files");
      assert.equal(req[0].headers["X-Lumio-Account"], "qa-account");
      const { visibility, ...expected } = payload;
      assert.deepEqual(JSON.parse(req[0].body), expected);
      assert.equal(JSON.parse(req[0].body).visibility, undefined);
    });
    await test("Retry uses identical UUID and bytes after unavailable ACK", async () => {
      let n = 0;
      const bodies = [];
      global.fetch = async (url, opt) => {
        bodies.push(opt.body);
        return n++
          ? {
              ok: true,
              json: async () => ({ targetRevision: 1, file: meta() }),
            }
          : {
              ok: false,
              json: async () => ({ error: "DATABASE_WRITE_OUTCOME_UNKNOWN" }),
            };
      };
      await assert.rejects(
        c.uploadTeachingFile("qa", payload, 2, new AbortController().signal),
      );
      await c.uploadTeachingFile(
        "qa",
        payload,
        2,
        new AbortController().signal,
      );
      assert.equal(bodies[0], bodies[1]);
    });
    await test("Cross-context, wrong bytes and premature attached receipts fail closed", async () => {
      for (const v of [
        { orgId: "other" },
        { targetId: "other" },
        { targetKind: "lesson" },
        { bytes: 3 },
        { name: "other.md" },
        { status: "attached" },
        { purpose: "teacher-only" },
      ]) {
        global.fetch = async () => ({
          ok: true,
          json: async () => ({ targetRevision: 1, file: meta(v) }),
        });
        await assert.rejects(
          c.uploadTeachingFile("qa", payload, 2, new AbortController().signal),
        );
      }
    });
    await test("Teacher receipts must be attached with the chosen visibility", async () => {
      const p = {
        ...payload,
        target: { kind: "lesson", id: "lesson" },
        visibility: "teacher-only",
      };
      global.fetch = async () => ({
        ok: true,
        json: async () => ({
          targetRevision: 1,
          file: meta({
            targetKind: "lesson",
            targetId: "lesson",
            purpose: "teacher-only",
            status: "attached",
          }),
        }),
      });
      assert.equal(
        (
          await c.uploadTeachingFile(
            "teacher",
            p,
            2,
            new AbortController().signal,
          )
        ).purpose,
        "teacher-only",
      );
      global.fetch = async () => ({
        ok: true,
        json: async () => ({
          targetRevision: 1,
          file: meta({
            targetKind: "lesson",
            targetId: "lesson",
            purpose: "reference",
            status: "attached",
          }),
        }),
      });
      await assert.rejects(
        c.uploadTeachingFile("teacher", p, 2, new AbortController().signal),
      );
    });
    await test("Abort signal forwards and malformed success cannot invent a receipt", async () => {
      const ctrl = new AbortController();
      global.fetch = async (url, opt) => {
        assert.equal(opt.signal, ctrl.signal);
        return {
          ok: true,
          json: async () => {
            throw Error("broken");
          },
        };
      };
      await assert.rejects(c.uploadTeachingFile("qa", payload, 2, ctrl.signal));
    });
  } finally {
    global.fetch = old;
  }
  await test("Pending selection and graded file list filter exact target/submission", () => {
    const rows = [
      meta(),
      meta({ id: "old", status: "attached", submissionId: "old" }),
      meta({ id: "other-target", targetId: "other" }),
      meta({ id: "new", status: "attached", submissionId: "new" }),
    ];
    assert.deepEqual(
      c.teachingFilesForTarget(rows, payload.target).map((x) => x.id),
      ["file"],
    );
    assert.deepEqual(
      c.teachingFilesForTarget(rows, payload.target, "new").map((x) => x.id),
      ["new"],
    );
  });
  await test("Known errors are readable and unknown server text is not reflected", () => {
    for (const code of [
      "TEACHING_FILE_COUNT",
      "TEACHING_FILE_QUOTA",
      "TEACHING_FILE_RATE_LIMIT",
      "TEACHING_FILE_INVALID",
      "TEACHING_FILE_FORBIDDEN",
    ])
      assert.ok(c.teachingFileError(code).length > 30);
    assert.equal(
      c.teachingFileError("private debug secret"),
      c.teachingFileError(null),
    );
    assert.ok(!c.teachingFileError("private debug secret").includes("secret"));
  });
  await test("Final student command includes ACK IDs and guards active upload", () => {
    const source = fs.readFileSync(
      path.join(root, "components/teaching/student.tsx"),
      "utf8",
    );
    assert.match(
      source,
      /if\s*\(fileBusy\s*\|\|\s*unconfirmedFile\s*\|\|\s*!confirmed\)/,
    );
    assert.match(
      source,
      /action: "submission.submit"[\s\S]{0,200}attachmentIds/,
    );
  });
  console.log(
    JSON.stringify({
      status: "PASS",
      checks: passed,
      scope:
        "Actual file-client serialization, receipt validation and integration guards; HTTP mocked, backend authorization/persistence tested separately",
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
