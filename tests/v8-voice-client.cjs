const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  cache = new Map();
const browserIntentStorage = new Map();
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: {
    getItem: (key) => browserIntentStorage.get(key) ?? null,
    setItem: (key, value) => browserIntentStorage.set(key, value),
  },
});
let session = null;
function load(relative) {
  const filename = path.resolve(root, relative);
  if (filename === path.resolve(root, "lib/lumio/auth.ts"))
    return {
      authOptions: () => ({}),
      providerStatus: () => ({ google: true }),
    };
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name === "next-auth"
        ? { getServerSession: async () => session }
        : name.startsWith(".")
          ? load(
              path.relative(
                root,
                path.resolve(path.dirname(filename), name + ".ts"),
              ),
            )
          : require(name),
    module,
    module.exports,
  );
  return module.exports;
}

const checks = [];
async function test(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
const client = load("lib/voice/client.ts"),
  sessions = load("lib/voice/session.ts"),
  copy = load("lib/voice/copy.ts").voiceCopy;
const originalFetch = global.fetch;
let calls = 0,
  transport;
global.fetch = async (...args) => {
  calls++;
  return transport(...args);
};
const state = {
  sessionId: "10000000-0000-4000-8000-000000000001",
  hintCount: 1,
  requiredHints: 3,
  canUnlock: false,
  guidance: "hints",
  revision: 1,
  expiresAt: "2099-01-01T00:00:00Z",
  latestTurn: {
    id: "20000000-0000-4000-8000-000000000001",
    ordinal: 1,
    intent: "progress",
    counted: true,
    feedbackRevision: 0,
    feedback: null,
  },
};
const ref = {
  segmentId: "s1",
  quote: "same operation",
  start: 0,
  end: 14,
  paragraph: 1,
  verification: "exact-excerpt",
};
(async () => {
  try {
    await test("Source/account/language/evidence selection are all bound in opaque session slot without storing source", async () => {
      const slot = await sessions.voiceSessionSlot(
        "account-a",
        "vi",
        "private-source",
        "item-1",
        "proof-1",
      );
      assert(!slot.includes("private-source"));
      assert(!slot.includes("proof-1"));
      for (const args of [
        ["account-b", "vi", "private-source", "item-1", "proof-1"],
        ["account-a", "en", "private-source", "item-1", "proof-1"],
        ["account-a", "vi", "changed", "item-1", "proof-1"],
        ["account-a", "vi", "private-source", "item-2", "proof-1"],
        ["account-a", "vi", "private-source", "item-1", "proof-2"],
      ])
        assert.notEqual(slot, await sessions.voiceSessionSlot(...args));
    });
    await test("Voice uses owned canonical history and preserves references/verification/turn metadata and explicit evidence", async () => {
      let metadata, canonical;
      transport = (url, init) => {
        assert.equal(url, "/api/ai");
        const b = JSON.parse(init.body);
        assert.deepEqual(b.history, []);
        assert.equal(b.source, "source");
        assert.deepEqual(b.sourceEvidence, { proof: "synthetic-proof" });
        assert.equal(b.tutorIntent, "simpler");
        assert.equal(
          new Headers(init.headers).get("x-lumio-account"),
          "account-a",
        );
        return Response.json({
          text: "Hint",
          tutor: state,
          references: [ref],
          verification: { status: "not_supported", note: "unsupported" },
        });
      };
      const text = await client.askVoiceTutor(
        "Question",
        [{ id: "x", role: "assistant", text: "do not upload this history" }],
        "vi",
        "source",
        new AbortController().signal,
        undefined,
        (s) => (canonical = s),
        "hints",
        "account-a",
        {
          sourceEvidence: { proof: "synthetic-proof" },
          tutorIntent: "simpler",
          onResult: (r) => (metadata = r),
        },
      );
      assert.equal(text, "Hint");
      assert.equal(canonical.latestTurn.id, state.latestTurn.id);
      assert.deepEqual(metadata.references, [ref]);
      assert.equal(metadata.verification.status, "not_supported");
    });
    await test("Source oversize fails locally rather than silently truncating signed evidence or spending", async () => {
      const n = calls;
      await assert.rejects(
        () =>
          client.askVoiceTutor(
            "Question",
            [],
            "vi",
            "x".repeat(200001),
            new AbortController().signal,
          ),
        /INVALID_INPUT/,
      );
      assert.equal(calls, n);
    });
    await test("Abort after body decoding cannot apply metadata callbacks to a changed source/account", async () => {
      const controller = new AbortController();
      let updates = 0;
      transport = () => ({
        ok: true,
        status: 200,
        json: async () => {
          controller.abort();
          return { text: "Late private output", tutor: state };
        },
      });
      await assert.rejects(
        () =>
          client.askVoiceTutor(
            "Late question",
            [],
            "vi",
            "source",
            controller.signal,
            undefined,
            () => updates++,
            "hints",
            "account-a",
            { onResult: () => updates++ },
          ),
        (e) => e.name === "AbortError",
      );
      assert.equal(updates, 0);
    });
    await test("Completed paid intent recovers the canonical owned session via GET with no second AI request", async () => {
      const view = {
        ...state,
        problem: "Question",
        turns: [
          {
            ...state.latestTurn,
            student: "Question",
            assistant: "Saved hint",
            references: [ref],
            verification: { status: "not_supported" },
            guidance: "hints",
            needsClarification: false,
            createdAt: "2026-10-16T00:00:00Z",
          },
        ],
        retentionDays: 7,
        continuity: {
          lastQuestion: null,
          lastStudentAttempt: "Question",
          lastStep: null,
          note: "recorded-not-verified",
        },
      };
      let paid = 0,
        restored;
      transport = (url, init) => {
        if (url === "/api/ai") {
          paid++;
          return Response.json(
            {
              error: "AI_REQUEST_COMPLETED",
              receipt: { status: "completed", tutorSessionId: state.sessionId },
            },
            { status: 409 },
          );
        }
        assert(url.startsWith("/api/tutor/session?"));
        assert.equal(
          new Headers(init.headers).get("x-lumio-account"),
          "account-a",
        );
        return Response.json(view);
      };
      const text = await client.askVoiceTutor(
        "Lost ACK",
        [],
        "vi",
        "source",
        new AbortController().signal,
        undefined,
        undefined,
        "hints",
        "account-a",
        { onRestored: (v) => (restored = v) },
      );
      assert.equal(text, "Saved hint");
      assert.equal(paid, 1);
      assert.equal(restored.turns.length, 1);
      const turns = sessions.restoreVoiceTurns(restored);
      assert.equal(turns.length, 2);
      assert.equal(turns[1].id, state.latestTurn.id);
      assert.deepEqual(turns[1].references, [ref]);
      assert.equal(turns[1].turn.feedbackRevision, 0);
    });
    await test("A locked response still exposes only canonical state needed to retain its recoverable pointer", async () => {
      let updated;
      transport = () =>
        Response.json({ error: "TUTOR_LOCKED", tutor: state }, { status: 409 });
      await assert.rejects(
        () =>
          client.askVoiceTutor(
            "Full now",
            [],
            "vi",
            "source",
            new AbortController().signal,
            undefined,
            (s) => (updated = s),
            "full",
            "account-a",
          ),
        /TUTOR_LOCKED/,
      );
      assert.equal(updated.sessionId, state.sessionId);
    });
    await test("Privacy copy truthfully distinguishes local audio from seven-day server tutor text", () => {
      for (const locale of ["en", "vi"]) {
        assert(/7/.test(copy[locale].local));
        assert(!/only in this tab|chỉ nằm trong tab/.test(copy[locale].local));
        assert(!/last 6|6 tin/.test(copy[locale].privacy));
      }
    });
    const report = {
      status: "PASS",
      passed: checks.length,
      checks,
      providerRequests: 0,
      scope:
        "Client helpers with synthetic fetch and storage; no real provider, browser microphone/speaker, OAuth or audio-quality validation.",
    };
    fs.mkdirSync(path.join(root, "docs/v8/reports"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs/v8/reports/voice-client.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  } finally {
    global.fetch = originalFetch;
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
