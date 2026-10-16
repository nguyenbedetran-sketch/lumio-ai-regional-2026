// Reclassify existing authored transcripts only. No handlers, auth, DB or HTTP.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const runner = require("./evaluate-v7-live.cjs");
const root = path.resolve(__dirname, ".."),
  directory = path.join(root, "docs/v7/reports");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
function deriveTechnicalReport(original, provenance) {
  if (
    !Array.isArray(original.cases) ||
    original.cases.some((item) => item.suite !== "tutor")
  )
    throw Error("TUTOR_TRANSCRIPTS_REQUIRED");
  const cases = original.cases.map((item) => {
    const checks = { ...item.technicalChecks },
      full = item.transcript.find(
        (turn) => turn.student === "[Explicit full after hints]",
      );
    let error = item.error || null,
      candidateSet = null,
      referenceSet = null;
    if (full) {
      const failure = runner.fullTutorFailure(item.reference, full);
      if (failure) error = failure;
      checks.fullGate =
        item.reference === null
          ? full.http === 409 &&
            full.body.error === "TUTOR_LOCKED" &&
            full.body.tutor?.hintCount === 0
          : full.http === 200 &&
            full.body.tutor?.canUnlock === true &&
            full.body.tutor?.guidance === "full";
      if (Array.isArray(item.reference) && full.http === 200) {
        candidateSet = runner.numericCandidateSet(full.body.verification);
        referenceSet = [...new Set(item.reference)].sort((a, b) => a - b);
        checks.referenceCandidates = runner.sameReferenceCandidates(
          full.body.verification,
          item.reference,
        );
      }
    }
    if (checks.noLeakedCreditHold === false)
      error = "EVALUATION_CREDIT_HOLD_LEAK";
    const revisedStatus = error
      ? runner.technicalErrorStatus(error)
      : Object.values(checks).every((value) => value === true)
        ? "TECHNICAL_PASS_REVIEW_PENDING"
        : "PARTIAL";
    return {
      id: item.id,
      rawCaseSHA256: hash(JSON.stringify(item)),
      originalStatus: item.status,
      revisedStatus,
      error,
      classificationChanged: item.status !== revisedStatus,
      fullHTTP: full?.http ?? null,
      candidateSet,
      referenceSet,
      technicalChecks: checks,
      semanticReview: "NOT_PERFORMED_BY_THIS_SCRIPT",
    };
  });
  return {
    schema: 1,
    status: "DERIVED_TECHNICAL_CORRECTION_ONLY",
    createdAt: new Date().toISOString(),
    provenance,
    originalStatus: original.status,
    originalMode: original.mode,
    originalActualProviderHTTPAttempts: original.actualProviderHTTPAttempts,
    newProviderRequests: 0,
    newModelOutputs: 0,
    sourceMutated: false,
    correctionScriptSHA256: hash(fs.readFileSync(__filename)),
    currentRunnerSHA256: hash(
      fs.readFileSync(path.join(__dirname, "evaluate-v7-live.cjs")),
    ),
    originalRunnerSHA256: original.runtime?.runnerSHA256 ?? null,
    originalRunnerHashLimitation: original.runtime?.runnerSHA256
      ? null
      : "Original runner did not record its own hash. Do not assign the current runner hash retrospectively to the original generation.",
    knownOldRunnerIssues: [
      "Unexpected non200 full-answer responses were recorded but not propagated to FAIL/BLOCKED/PARTIAL_LIMIT, so full-phase errors could appear PARTIAL with fail0.",
      "Valid candidate roots were compared as arrays; duplicate equal roots could incorrectly make a correct mathematical set PARTIAL.",
    ],
    revisedCriteria: [
      "Any non200 full answer is an error except the expected missing-data TUTOR_LOCKED409 with hintCount0.",
      "Provider auth/rate/config/AI_DISABLED errors are BLOCKED; HTTP provider cap is PARTIAL_LIMIT; other error responses are FAIL.",
      "Compare finite valid candidate values with the authored golden as unique sorted numeric sets.",
      "Retain existing gate/progression/credit-hold checks; do not infer narrative math correctness or meaningful pedagogy from them.",
    ],
    cases,
    summary: {
      reviewed: cases.length,
      changed: cases.filter((item) => item.classificationChanged).length,
      technicalPass: cases.filter(
        (item) => item.revisedStatus === "TECHNICAL_PASS_REVIEW_PENDING",
      ).length,
      partial: cases.filter((item) =>
        ["PARTIAL", "PARTIAL_LIMIT"].includes(item.revisedStatus),
      ).length,
      blocked: cases.filter((item) => item.revisedStatus === "BLOCKED").length,
      fail: cases.filter((item) => item.revisedStatus === "FAIL").length,
    },
    semanticAccuracyClaim: false,
    studentTrial: "NOT_TESTED",
    independentTeacherReview: "NOT_TESTED",
    companionDeveloperReview: "docs/v7/reports/v7-live-tutor-review.json",
    limitations: [
      "This is a deterministic reinterpretation of immutable recorded HTTP transcripts, not a new generation or a rerun after product fixes.",
      "Stop-on-error policy is not applied retrospectively: every original case remains evidence of the request actually made.",
      "No source/model output was reconstructed, replaced or corrected. An unchanged technical classification does not dismiss the companion developer review findings.",
      "Gate, exact candidate set and canonical credit checks do not verify every written step, arithmetic, source implication, pedagogical quality or learning outcome.",
    ],
  };
}
function main(argv) {
  const options = new Map();
  for (const arg of argv) {
    const match = /^--(source|out)=(.+)$/.exec(arg);
    if (!match || options.has(match[1])) throw Error("INVALID_REVIEW_OPTION");
    options.set(match[1], match[2]);
  }
  const name =
    options.get("source") || "v7-live-tutor-acceptance-20261016.json";
  if (!/^v7-live-[A-Za-z0-9_-]+\.json$/.test(name))
    throw Error("INVALID_REVIEW_SOURCE");
  const source = path.join(directory, name),
    bytes = fs.readFileSync(source),
    sourceSHA256 = hash(bytes),
    original = JSON.parse(bytes);
  if (original.mode !== "live" || original.status === "RUNNING")
    throw Error("COMPLETED_LIVE_REPORT_REQUIRED");
  const out = runner.outputFile(
    options.get("out") || "v7-live-tutor-technical-correction.json",
  );
  const report = deriveTechnicalReport(original, {
    sourceReport: "docs/v7/reports/" + name,
    sourceSHA256,
  });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  if (hash(fs.readFileSync(source)) !== sourceSHA256)
    throw Error("SOURCE_CHANGED_DURING_REVIEW");
  console.log(
    JSON.stringify({
      status: report.status,
      sourceSHA256,
      ...report.summary,
      newProviderRequests: 0,
    }),
  );
  return report;
}
module.exports = { deriveTechnicalReport, main };
if (require.main === module)
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
