// Offline checks only; actual handlers/SQLite, intercepted HTTP, no real credentials.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  crypto = require("node:crypto");
const runner = require("../scripts/evaluate-v7-live.cjs");
const root = path.resolve(__dirname, "..");
const report = () => ({
  mode: "check",
  providerAttempts: [],
  transportAttempts: 0,
  actualProviderHTTPAttempts: 0,
});
const request = {
  method: "POST",
  headers: { Authorization: "Bearer synthetic-not-real" },
  body: '{"model":"fixture-model"}',
};
const response = (value, provider = "openai") =>
  Response.json(
    provider === "openai"
      ? {
          model: "fixture-model-response",
          output: [
            { content: [{ type: "output_text", text: JSON.stringify(value) }] },
          ],
          usage: {
            input_tokens: 11,
            output_tokens: 7,
            total_tokens: 18,
            input_tokens_details: { cached_tokens: 2 },
          },
        }
      : {
          modelVersion: "fixture-gemini-response",
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: JSON.stringify(value) }] },
            },
          ],
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 8,
            totalTokenCount: 20,
            cachedContentTokenCount: 3,
          },
        },
  );
const hints = [
  {
    hint: "Hãy xác định hằng số được cộng vào vế trái của phương trình.",
    question: "Em cần thực hiện phép toán ngược nào?",
  },
  {
    hint: "Hãy trừ cùng một hằng số ở hai vế để giữ đẳng thức tương đương.",
    question: "Vế trái còn bao nhiêu lần ẩn?",
  },
  {
    hint: "Hãy tìm hệ số của ẩn sau khi em đã thu gọn hai vế của phương trình.",
    question: "Em nên chia hai vế cho số nào khác không?",
  },
];
const credentials = {
  OPENAI_API_KEY: "synthetic-provider-key-not-real",
  OPENAI_MODEL: "fixture-model",
};
const options = (patch) => ({
  mode: "check",
  suite: "tutor",
  maxProviderCalls: 4,
  caseIds: ["linear"],
  languages: ["vi"],
  ...patch,
});
async function runChecks() {
  const checks = [],
    folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-v7-runner-check-"));
  const check = async (name, run) => {
    await run();
    checks.push({ name, status: "PASS" });
    console.log("PASS " + name);
  };
  try {
    await check(
      "CLI requires one explicit mode, bounded cap and rejects unknown/duplicate flags",
      () => {
        for (const args of [
          [],
          ["--live", "--check"],
          ["--check", "--max-provider-calls=61"],
          ["--check", "--max-provider-calls=0"],
          ["--check", "--oops"],
          ["--check", "--check"],
        ])
          assert.throws(() => runner.parseOptions(args));
        assert.equal(runner.parseOptions(["--check"]).maxProviderCalls, 40);
        assert.throws(
          () => runner.parseOptions(["--live"]),
          /EXPLICIT_ENV_FILE_REQUIRED/,
        );
      },
    );
    await check(
      "Offline mode cannot read an env-file or use an implicit real fetch",
      async () => {
        assert.throws(
          () => runner.parseOptions(["--check", "--env-file=private.env"]),
          /CHECK_MUST_NOT_READ_CREDENTIALS/,
        );
        await assert.rejects(
          runner.runEvaluation(options()),
          /CHECK_TRANSPORT_REQUIRED/,
        );
      },
    );
    await check(
      "Provider env parser ignores DB/auth/Node overrides and accepts only key/model allowlist",
      () => {
        const value = runner.parseProviderEnv(
          "OPENAI_API_KEY=synthetic-provider-key-not-real\nOPENAI_MODEL=fixture-model\nLUMIO_DB_PATH=do-not-use.sqlite\nNEXTAUTH_SECRET=do-not-use\nNODE_OPTIONS=do-not-use\nXAI_API_KEY=do-not-use",
        );
        assert.deepEqual(Object.keys(value).sort(), [
          "OPENAI_API_KEY",
          "OPENAI_MODEL",
        ]);
        assert.throws(
          () =>
            runner.parseProviderEnv(
              "OPENAI_API_KEY=x\nOPENAI_MODEL=x\nOPENAI_MODEL=y",
            ),
          /DUPLICATE/,
        );
        assert.throws(
          () =>
            runner.parseProviderEnv(
              "OPENAI_API_KEY=x\nOPENAI_MODEL=https://bad.example",
            ),
          /INVALID_MODEL_CONFIG/,
        );
      },
    );
    await check("Only an explicit absolute private env path is read", () => {
      const file = path.join(folder, "fixture.env");
      fs.writeFileSync(
        file,
        "OPENAI_API_KEY=synthetic-only\nOPENAI_MODEL=fixture-model",
      );
      assert.equal(runner.readProviderEnv(file).OPENAI_MODEL, "fixture-model");
      assert.throws(
        () => runner.readProviderEnv("relative.env"),
        /ABSOLUTE_PRIVATE/,
      );
      const publicFile = path.join(
        root,
        "docs/v7/reports/v7-live-env-fixture.tmp",
      );
      fs.writeFileSync(publicFile, "synthetic-only");
      try {
        assert.throws(
          () => runner.readProviderEnv(publicFile),
          /PUBLIC_ENV_PATH_FORBIDDEN/,
        );
      } finally {
        fs.unlinkSync(publicFile);
      }
    });
    await check(
      "Output is confined to new V7 report basenames and never overwrites old or existing reports",
      () => {
        for (const value of [
          "../regional/tutor-live-final.json",
          "C:/temp/out.json",
          "tutor-live-final.json",
          "v7-live-../old.json",
        ])
          assert.throws(
            () => runner.outputFile(value),
            /INVALID_EVALUATION_OUTPUT/,
          );
        const name = "v7-live-check-" + crypto.randomUUID() + ".json",
          file = runner.outputFile(name);
        fs.writeFileSync(file, "synthetic existing");
        try {
          assert.throws(
            () => runner.outputFile(name),
            /EVALUATION_OUTPUT_EXISTS/,
          );
          assert.equal(fs.readFileSync(file, "utf8"), "synthetic existing");
        } finally {
          fs.unlinkSync(file);
        }
      },
    );
    await check(
      "Every local request has canonical account binding and a UUID including early-full gate",
      () => {
        const r = runner.makeRequest(
          { storageKey: "canonical-fixture-account" },
          { question: "Authored question" },
        );
        assert.equal(
          r.headers.get("x-lumio-account"),
          "canonical-fixture-account",
        );
        assert.match(
          r.headers.get("idempotency-key"),
          /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/,
        );
        assert.equal(r.headers.get("origin"), "http://127.0.0.1:3000");
        assert.equal(r.headers.get("authorization"), null);
      },
    );
    await check(
      "Strict provider origins, endpoints, methods and redirect policy prevent credential forwarding",
      async () => {
        let calls = 0;
        const r = report(),
          send = runner.createBudgetTransport({
            limit: 2,
            report: r,
            transport: async (url, init) => {
              calls++;
              assert.equal(init.redirect, "error");
              return response(hints[0]);
            },
          });
        for (const target of [
          "http://api.openai.com/v1/responses",
          "https://api.openai.com.evil.invalid/v1/responses",
          "https://user:pass@api.openai.com/v1/responses",
          "https://api.openai.com/v1/responses?key=x",
          "https://api.openai.com/other",
          "https://generativelanguage.googleapis.com.evil.invalid/v1beta/models/x:generateContent",
        ])
          await assert.rejects(
            send(target, request),
            /EVALUATION_ENDPOINT_BLOCKED/,
          );
        await assert.rejects(
          send("https://api.openai.com/v1/responses", {
            ...request,
            method: "GET",
          }),
          /EVALUATION_ENDPOINT_BLOCKED/,
        );
        assert.equal(calls, 0);
        await send("https://api.openai.com/v1/responses", request);
        assert.equal(calls, 1);
        assert.ok(!JSON.stringify(r).includes("synthetic-not-real"));
      },
    );
    await check(
      "Hard HTTP cap includes failed attempts and blocks a second transport before send",
      async () => {
        let calls = 0;
        const r = report(),
          send = runner.createBudgetTransport({
            limit: 1,
            report: r,
            transport: async () => {
              calls++;
              throw Object.assign(Error("NETWORK_FAILED"), {
                code: "NETWORK_FAILED",
              });
            },
          });
        await assert.rejects(
          send("https://api.openai.com/v1/responses", request),
          /NETWORK_FAILED/,
        );
        await assert.rejects(
          send("https://api.openai.com/v1/responses", request),
          /EVALUATION_PROVIDER_CAP/,
        );
        assert.equal(calls, 1);
        assert.equal(r.providerAttempts.length, 1);
        assert.equal(r.providerAttempts[0].responseReceived, false);
      },
    );
    await check(
      "Report persistence failure blocks dispatch instead of losing the paid-call budget record",
      async () => {
        let calls = 0;
        const r = report(),
          send = runner.createBudgetTransport({
            limit: 1,
            report: r,
            save: () => {
              throw Error("SYNTHETIC_DISK_FAILURE");
            },
            transport: async () => {
              calls++;
              return response(hints[0]);
            },
          });
        await assert.rejects(
          send("https://api.openai.com/v1/responses", request),
          /SYNTHETIC_DISK_FAILURE/,
        );
        assert.equal(calls, 0);
        assert.equal(r.providerAttempts[0].dispatched, false);
      },
    );
    await check(
      "Provider response metadata fixtures capture model/status/latency/tokens without request headers",
      async () => {
        const r = report(),
          send = runner.createBudgetTransport({
            limit: 2,
            report: r,
            transport: async (url) =>
              response(
                hints[0],
                String(url).includes("google") ? "gemini" : "openai",
              ),
          });
        await send("https://api.openai.com/v1/responses", request);
        await send(
          "https://generativelanguage.googleapis.com/v1beta/models/fixture-model:generateContent",
          request,
        );
        assert.equal(
          r.providerAttempts[0].responseModel,
          "fixture-model-response",
        );
        assert.equal(r.providerAttempts[0].usage.cachedTokens, 2);
        assert.equal(r.providerAttempts[1].provider, "gemini");
        assert.equal(r.providerAttempts[1].usage.inputTokens, 12);
        assert.ok(
          r.providerAttempts.every(
            (v) => v.httpStatus === 200 && v.latencyMs >= 0,
          ),
        );
        assert.ok(!JSON.stringify(r).includes("Authorization"));
        assert.equal(r.actualProviderHTTPAttempts, 0);
      },
    );
    await check(
      "Five-language content plans retain injection/unrelated-goal/conflict labels without missing-source claims",
      () => {
        const corpus = JSON.parse(
          fs.readFileSync(
            path.join(root, "tests/fixtures/v7-ai-evaluation.v1.json"),
            "utf8",
          ),
        );
        for (const row of corpus.languages) {
          const cases = runner.contentCases(row);
          assert.equal(cases.length, 6);
          assert.ok(cases.every((c) => c.language === row.language));
          assert.ok(cases.find((c) => c.canary).source.includes(row.attack));
          assert.ok(
            cases.some((c) => c.unrelatedGoal) &&
              cases.some((c) => c.conflictingSource),
          );
        }
      },
    );
    await check(
      "Real handler/SQLite four-turn tutor check uses canonical headers and never pretends to be a student pilot",
      async () => {
        let calls = 0;
        const priorFetch = global.fetch,
          priorAI = process.env.LUMIO_AI_ENABLED;
        const result = await runner.runEvaluation(options(), {
          credentials,
          saveReport: false,
          transport: async () => {
            const turn = calls++;
            return response(
              turn < 3
                ? hints[turn]
                : {
                    solution:
                      "\\(2x+3=11 \\Leftrightarrow 2x=8 \\Leftrightarrow x=4\\). Thay lại: 2*4+3=11.",
                    candidateSolutions: [4],
                  },
            );
          },
        });
        assert.equal(calls, 4);
        assert.equal(result.report.routeRequests, 5);
        assert.equal(result.report.transportAttempts, 4);
        assert.equal(result.report.actualProviderHTTPAttempts, 0);
        assert.equal(
          result.report.cases[0].technicalChecks
            .earlyFullBlockedWithoutProvider,
          true,
        );
        assert.equal(result.report.cases[0].technicalChecks.fullGate, true);
        assert.equal(
          result.report.cases[0].technicalChecks.referenceCandidates,
          true,
        );
        assert.equal(
          result.report.cases[0].technicalChecks.earlyFullBlockedWithoutCredit,
          true,
        );
        assert.equal(result.report.cases[0].credits.before.balance, 200);
        assert.equal(result.report.cases[0].credits.after.balance, 184);
        assert.equal(result.report.cases[0].credits.after.reserved, 0);
        assert.equal(
          result.report.runtime.runnerSHA256,
          crypto
            .createHash("sha256")
            .update(
              fs.readFileSync(path.join(root, "scripts/evaluate-v7-live.cjs")),
            )
            .digest("hex"),
        );
        assert.equal(result.report.manualReview.status, "PENDING");
        assert.equal(result.report.manualReview.semanticAccuracyClaim, false);
        for (const filename of [
          "lib/ai/grounding.ts",
          "lib/ai/summary.ts",
          "lib/ai/quiz-option-order.ts",
          "lib/tutor/math-exact.ts",
        ])
          assert.equal(
            result.report.sourceHashes[filename],
            crypto.createHash("sha256")
              .update(fs.readFileSync(path.join(root, filename)))
              .digest("hex"),
          );
        assert.match(result.report.sourceHashScope, /not a complete transitive/);
        assert.equal(global.fetch, priorFetch);
        assert.equal(process.env.LUMIO_AI_ENABLED, priorAI);
      },
    );
    await check(
      "Duplicate valid full-answer roots are compared as mathematical sets",
      async () => {
        let calls = 0;
        const result = await runner.runEvaluation(options(), {
          credentials,
          saveReport: false,
          transport: async () => {
            const turn = calls++;
            return response(
              turn < 3
                ? hints[turn]
                : {
                    solution: "2x+3=11, 2x=8, x=4. Thay lại: 2*4+3=11.",
                    candidateSolutions: [4, 4],
                  },
            );
          },
        });
        assert.equal(calls, 4);
        assert.equal(
          result.report.cases[0].status,
          "TECHNICAL_PASS_REVIEW_PENDING",
        );
        assert.equal(
          result.report.cases[0].technicalChecks.referenceCandidates,
          true,
        );
        assert.deepEqual(
          runner.numericCandidateSet(result.report.cases[0].mathVerification),
          [4],
        );
      },
    );
    await check(
      "A rejected incorrect full answer is a recorded technical FAIL with refunded full-answer hold",
      async () => {
        let calls = 0;
        const result = await runner.runEvaluation(options(), {
          credentials,
          saveReport: false,
          transport: async () => {
            const turn = calls++;
            return response(
              turn < 3
                ? hints[turn]
                : { solution: "x=5", candidateSolutions: [5] },
            );
          },
        });
        const item = result.report.cases[0];
        assert.equal(item.transcript.at(-1).http, 502);
        assert.equal(item.error, "MATH_VERIFICATION_FAILED");
        assert.equal(item.status, "FAIL");
        assert.equal(result.report.summary.fail, 1);
        assert.equal(item.credits.after.balance, 188);
        assert.equal(item.credits.after.reserved, 0);
        assert.match(result.report.providerAttempts.at(-1).rawOutput, /x=5/);
      },
    );
    await check(
      "Full-phase terminal errors or exhausted caps use the same stop policy as hint-phase errors",
      async () => {
        for (const [http, code, status, cap] of [
          [401, "PROVIDER_AUTH_ERROR", "BLOCKED", 4],
          [429, "PROVIDER_RATE_LIMIT", "BLOCKED", 4],
          [null, "EVALUATION_PROVIDER_CAP", "PARTIAL_LIMIT", 3],
        ]) {
          let calls = 0;
          const result = await runner.runEvaluation(
            options({
              caseIds: ["linear", "wrong-first"],
              maxProviderCalls: cap,
            }),
            {
              credentials,
              saveReport: false,
              transport: async () => {
                const turn = calls++;
                return turn < 3
                  ? response(hints[turn])
                  : Response.json(
                      { error: { code: "synthetic-terminal" } },
                      { status: http },
                    );
              },
            },
          );
          assert.equal(calls, cap);
          assert.equal(result.report.stoppedReason, code);
          assert.equal(result.report.cases[0].status, status);
          assert.equal(result.report.notTestedCases.length, 1);
          assert.equal(result.report.summary.fail, 0);
          assert.equal(result.report.cases[0].credits.after.reserved, 0);
        }
      },
    );
    await check(
      "Derived technical review changes classification only and preserves raw fixtures without HTTP",
      () => {
        const derive =
          require("../scripts/review-v7-live-technical.cjs").deriveTechnicalReport;
        const make = (id, http, body, reference = [4]) => ({
          id,
          suite: "tutor",
          status: "PARTIAL",
          reference,
          technicalChecks: {
            earlyFullBlockedWithoutProvider: true,
            earlyFullBlockedWithoutCredit: true,
            serverHintProgression: true,
            noLeakedCreditHold: true,
          },
          transcript: [{ student: "[Explicit full after hints]", http, body }],
        });
        const raw = {
          mode: "check",
          status: "PARTIAL_REVIEW_REQUIRED",
          actualProviderHTTPAttempts: 0,
          cases: [
            make("duplicate", 200, {
              tutor: { canUnlock: true, guidance: "full" },
              verification: {
                candidates: [
                  { value: 4, valid: true },
                  { value: 4, valid: true },
                ],
              },
            }),
            make("wrong", 502, { error: "MATH_VERIFICATION_FAILED" }),
            make("auth", 502, { error: "PROVIDER_AUTH_ERROR" }),
            make("cap", 429, { error: "EVALUATION_PROVIDER_CAP" }),
            make(
              "missing",
              409,
              { error: "TUTOR_LOCKED", tutor: { hintCount: 0 } },
              null,
            ),
          ],
        };
        const before = JSON.stringify(raw),
          result = derive(raw, {
            sourceReport: "offline-fixture",
            sourceSHA256: "synthetic",
          });
        assert.equal(JSON.stringify(raw), before);
        assert.deepEqual(
          result.cases.map((item) => item.revisedStatus),
          [
            "TECHNICAL_PASS_REVIEW_PENDING",
            "FAIL",
            "BLOCKED",
            "PARTIAL_LIMIT",
            "TECHNICAL_PASS_REVIEW_PENDING",
          ],
        );
        assert.equal(result.newProviderRequests, 0);
        assert.equal(result.newModelOutputs, 0);
        assert.equal(result.semanticAccuracyClaim, false);
        assert.equal(result.originalRunnerSHA256, null);
      },
    );
    await check(
      "Actual product fallback is counted and cannot bypass the total HTTP cap",
      async () => {
        let calls = 0;
        const result = await runner.runEvaluation(
          options({ maxProviderCalls: 1 }),
          {
            credentials: {
              ...credentials,
              GEMINI_API_KEY: "synthetic-gemini-key-not-real",
              GEMINI_MODEL: "fixture-gemini",
            },
            saveReport: false,
            transport: async () => {
              calls++;
              return Response.json(
                { error: { code: "server_error" } },
                { status: 500 },
              );
            },
          },
        );
        assert.equal(calls, 1);
        assert.equal(result.report.transportAttempts, 1);
        assert.equal(result.report.cases[0].error, "EVALUATION_PROVIDER_CAP");
        assert.equal(result.report.providerAttempts[0].httpStatus, 500);
      },
    );
    await check(
      "Actual fallback records both provider attempts and their independent raw responses",
      async () => {
        let calls = 0;
        const result = await runner.runEvaluation(
          options({ maxProviderCalls: 2 }),
          {
            credentials: {
              ...credentials,
              GEMINI_API_KEY: "synthetic-gemini-key-not-real",
              GEMINI_MODEL: "fixture-gemini",
            },
            saveReport: false,
            transport: async (url) => {
              calls++;
              return String(url).includes("openai")
                ? Response.json(
                    { error: { code: "server_error" } },
                    { status: 500 },
                  )
                : response(hints[0], "gemini");
            },
          },
        );
        assert.equal(calls, 2);
        assert.deepEqual(
          result.report.providerAttempts.map((e) => e.provider),
          ["openai", "gemini"],
        );
        assert.match(result.report.providerAttempts[1].rawOutput, /hằng số/);
        assert.equal(result.report.providerAttempts[0].httpStatus, 500);
      },
    );
    await check(
      "Terminal provider authentication or rate-limit errors stop new cases without retries or benchmark failures",
      async () => {
        for (const [http, code] of [
          [401, "PROVIDER_AUTH_ERROR"],
          [429, "PROVIDER_RATE_LIMIT"],
        ]) {
          let calls = 0;
          const result = await runner.runEvaluation(
            options({
              caseIds: ["linear", "rational-domain", "wrong-first"],
              maxProviderCalls: 12,
            }),
            {
              credentials: {
                ...credentials,
                GEMINI_API_KEY: "synthetic-gemini-key-not-real",
                GEMINI_MODEL: "fixture-gemini",
              },
              saveReport: false,
              transport: async () => {
                calls++;
                return Response.json(
                  { error: { code: "synthetic-terminal" } },
                  { status: http },
                );
              },
            },
          );
          assert.equal(calls, 1);
          assert.equal(result.report.status, "STOPPED");
          assert.equal(result.report.stoppedReason, code);
          assert.equal(result.report.cases[0].status, "BLOCKED");
          assert.equal(result.report.summary.fail, 0);
          assert.equal(result.report.summary.blocked, 1);
          assert.equal(result.report.notTestedCases.length, 2);
          assert.ok(
            result.report.notTestedCases.every(
              (item) => item.status === "NOT_TESTED" && item.reason === code,
            ),
          );
          assert.equal(result.report.cases[0].credits.after.balance, 200);
          assert.equal(result.report.cases[0].credits.after.reserved, 0);
        }
      },
    );
    await check(
      "Three consecutive validator failures stop the run and retain unstarted cases as NOT_TESTED",
      async () => {
        let calls = 0;
        const result = await runner.runEvaluation(
          options({
            caseIds: [
              "linear",
              "rational-domain",
              "radical-extraneous",
              "wrong-first",
              "repeated-mistake",
            ],
            maxProviderCalls: 20,
          }),
          {
            credentials,
            saveReport: false,
            transport: async () => {
              calls++;
              return response({ solution: "x=4", candidateSolutions: [4] });
            },
          },
        );
        assert.equal(calls, 3);
        assert.equal(result.report.stoppedReason, "CONSECUTIVE_CASE_FAILURES");
        assert.equal(result.report.summary.fail, 3);
        assert.equal(result.report.notTestedCases.length, 2);
        assert.ok(
          result.report.cases.every(
            (item) =>
              item.error === "TUTOR_SOLUTION_LEAK" &&
              item.credits.after.reserved === 0,
          ),
        );
      },
    );
    await check(
      "A provider cap stops a partial case and labels the remaining case NOT_TESTED",
      async () => {
        let calls = 0;
        const result = await runner.runEvaluation(
          options({ caseIds: ["linear", "wrong-first"], maxProviderCalls: 1 }),
          {
            credentials,
            saveReport: false,
            transport: async () => {
              calls++;
              return response(hints[0]);
            },
          },
        );
        assert.equal(calls, 1);
        assert.equal(result.report.stoppedReason, "EVALUATION_PROVIDER_CAP");
        assert.equal(result.report.cases[0].status, "PARTIAL_LIMIT");
        assert.equal(result.report.summary.fail, 0);
        assert.equal(result.report.notTestedCases.length, 1);
        assert.equal(
          result.report.notTestedCases[0].reason,
          "EVALUATION_PROVIDER_CAP",
        );
        assert.equal(result.report.cases[0].credits.after.reserved, 0);
      },
    );
    await check(
      "Missing-data tutor checks state and locked full answer while leaving semantic clarification review pending",
      async () => {
        let calls = 0;
        const result = await runner.runEvaluation(
          options({ caseIds: ["missing-data"], maxProviderCalls: 3 }),
          {
            credentials,
            saveReport: false,
            transport: async () =>
              response({ ...hints[calls++], needsClarification: true }),
          },
        );
        assert.equal(calls, 3);
        const item = result.report.cases[0];
        assert.equal(item.status, "TECHNICAL_PASS_REVIEW_PENDING");
        assert.equal(item.technicalChecks.clarificationState, true);
        assert.equal(item.technicalChecks.fullGate, true);
        assert.equal(item.missingDataReview.status, "PENDING");
        assert.match(item.missingDataReview.reference, /chiều rộng/);
        assert.equal(item.transcript.at(-1).http, 409);
        assert.equal(item.credits.after.reserved, 0);
        assert.equal(result.report.manualReview.semanticAccuracyClaim, false);
      },
    );
    await check(
      "Actual content route accepts a valid source summary despite an unrelated goal without claiming missing-source abstention",
      async () => {
        const row = JSON.parse(
          fs.readFileSync(
            path.join(root, "tests/fixtures/v7-ai-evaluation.v1.json"),
            "utf8",
          ),
        ).languages[0];
        let calls = 0;
        const result = await runner.runEvaluation(
          options({ suite: "content", maxProviderCalls: 6 }),
          {
            credentials,
            saveReport: false,
            transport: async () => {
              const index = calls++,
                quote =
                  index === 5
                    ? row.conflictKey + ":20 " + row.unit + "."
                    : row.quote;
              const references = [{ segmentId: "s1", quote }];
              if (index === 1)
                return response({
                  cards: [
                    { front: "Điều kiện của mẫu số?", back: quote, references },
                  ],
                });
              if (index === 2)
                return response({
                  questions: [
                    {
                      prompt:
                        "Mẫu số của phân thức cần thỏa mãn điều kiện nào?",
                      options: [
                        "Khác không",
                        "Bằng không",
                        "Luôn âm",
                        "Luôn dương",
                      ],
                      correct: 0,
                      explanation: quote,
                      difficulty: "beginner",
                      topic: "Phân thức",
                      references,
                    },
                  ],
                });
              return response({
                title: "Tóm tắt nguồn tự soạn",
                overview: quote,
                keyPoints: [quote],
                chapters: [
                  {
                    title: "Điều kiện từ nguồn",
                    summary: quote,
                    bullets: [quote],
                    references,
                  },
                ],
                mindMap: {
                  nodes: [
                    { id: "root", label: "Nguồn", detail: quote },
                    {
                      id: "idea",
                      label: "Ý chính",
                      detail: quote,
                      chapterIndex: 0,
                    },
                  ],
                  edges: [{ source: "root", target: "idea" }],
                },
              });
            },
          },
        );
        assert.equal(calls, 6);
        const item = result.report.cases.find(
          (item) => item.id === "vi-unrelated-goal-summary",
        );
        assert.equal(item.result.http, 200);
        assert.equal(item.status, "TECHNICAL_PASS_REVIEW_PENDING");
        assert.equal(item.scopeReview.status, "PENDING");
        assert.equal(item.scopeReview.missingSourceAbstentionClaim, false);
        assert.equal(item.technicalChecks.hasExactSourceReferences, true);
        assert.equal(result.report.summary.fail, 0);
        assert.equal(result.report.actualProviderHTTPAttempts, 0);
      },
    );
    await check(
      "Rejected raw authored output stays recorded; report redacts credentials and makes no semantic PASS",
      async () => {
        const name = "v7-live-check-redaction-" + crypto.randomUUID() + ".json";
        let file;
        try {
          const result = await runner.runEvaluation(
            options({ maxProviderCalls: 1, out: name }),
            {
              credentials,
              transport: async () =>
                response({
                  solution: "x=4 " + credentials.OPENAI_API_KEY,
                  candidateSolutions: [4],
                }),
            },
          );
          file = result.file;
          const written = fs.readFileSync(file, "utf8");
          assert.ok(!written.includes(credentials.OPENAI_API_KEY));
          const data = JSON.parse(written);
          assert.equal(data.cases[0].status, "FAIL");
          assert.match(data.providerAttempts[0].rawOutput, /x=4/);
          assert.match(data.providerAttempts[0].rawOutput, /\[REDACTED\]/);
          assert.equal(
            data.cases[0].transcript.at(-1).body.error,
            "TUTOR_SOLUTION_LEAK",
          );
          assert.equal(data.manualReview.semanticAccuracyClaim, false);
          assert.equal(data.actualProviderHTTPAttempts, 0);
        } finally {
          if (file) fs.unlinkSync(file);
        }
      },
    );
    const result = {
      status: "PASS",
      checkedAt: new Date().toISOString(),
      passed: checks.length,
      checks,
      providerRequests: 0,
      scope:
        "Offline cap/path/header/metadata tests plus actual local AI handlers and temporary SQLite with injected synthetic auth and intercepted provider transport. No private credentials, real provider calls or semantic/student review.",
    };
    fs.writeFileSync(
      path.join(root, "docs/v7/reports/live-runner-check.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(
      "V7 live runner preparation: " +
        checks.length +
        " checks PASS; 0 actual provider requests.",
    );
    return result;
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}
module.exports = { runChecks };
if (require.main === module)
  runChecks().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
