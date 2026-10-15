// Operator-only CLI. Never exposes a backup endpoint or replaces a running database.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
function inspect(filename) {
  const file = path.resolve(filename);
  if (!fs.statSync(file).isFile()) throw Error("SOURCE_NOT_FILE");
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    if (db.prepare("PRAGMA quick_check").get().quick_check !== "ok")
      throw Error("INTEGRITY_FAILED");
    if (db.prepare("PRAGMA foreign_key_check").all().length)
      throw Error("FOREIGN_KEYS_FAILED");
    const versions = db
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all()
      .map((r) => Number(r.version));
    if (versions.length !== 13 || versions.some((v, i) => v !== i + 1))
      throw Error("SCHEMA_NOT_SUPPORTED");
    for (const table of [
      "users",
      "identities",
      "feature_flags",
      "billing_accounts",
      "billing_reservations",
      "billing_ledger",
      "ai_usage",
      "mobile_sessions",
      "tutor_sessions",
      "tutor_turns",
      "runtime_rate_windows",
      "runtime_ai_leases",
      "sync_snapshots",
      "sync_operations",
      "rag_documents",
      "rag_chunks",
      "rag_snapshots",
      "summary_jobs",
      "summary_job_parts",
      "teacher_applications",
      "teacher_credentials",
      "teacher_application_operations",
      "teaching_organizations",
      "teaching_classes",
      "teaching_class_teachers",
      "teaching_enrollments",
      "teaching_groups",
      "teaching_group_members",
      "teaching_invites",
      "teaching_content",
      "teaching_assignments",
      "teaching_assignment_targets",
      "teaching_submissions",
      "teaching_announcements",
      "teaching_events",
      "teaching_operations",
      "teaching_preferences",
    ])
      db.prepare("SELECT 1 FROM " + table + " LIMIT 1").get();
    return { integrity: "ok", schemaVersion: 13 };
  } finally {
    db.close();
  }
}
function snapshot(source, destination) {
  const src = path.resolve(source),
    out = path.resolve(destination);
  if (src === out || fs.existsSync(out)) throw Error("DESTINATION_MUST_BE_NEW");
  const project = path.resolve(__dirname, "..");
  for (const dir of ["public", "docs", "app"]) {
    const relative = path.relative(path.join(project, dir), out);
    if (
      !relative ||
      (!relative.startsWith(".." + path.sep) &&
        relative !== ".." &&
        !path.isAbsolute(relative))
    )
      throw Error("PUBLIC_DESTINATION_FORBIDDEN");
  }
  inspect(src);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const db = new DatabaseSync(src, { readOnly: true });
  try {
    db.exec("VACUUM INTO '" + out.replaceAll("'", "''") + "'");
  } finally {
    db.close();
  }
  fs.chmodSync(out, 0o600);
  const result = inspect(out);
  return {
    ...result,
    bytes: fs.statSync(out).size,
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(out))
      .digest("hex"),
  };
}
module.exports = { inspect, snapshot };
if (require.main === module) {
  try {
    const [command, ...args] = process.argv.slice(2),
      value = (name) => args[args.indexOf(name) + 1];
    if (
      !["inspect", "backup", "restore"].includes(command) ||
      !args.includes("--source") ||
      (command !== "inspect" && !args.includes("--out"))
    )
      throw Error(
        "USAGE: inspect|backup|restore --source <file> [--out <new-file>]",
      );
    const result =
      command === "inspect"
        ? inspect(value("--source"))
        : snapshot(value("--source"), value("--out"));
    console.log(
      JSON.stringify({ status: "PASS", operation: command, ...result }),
    );
  } catch (e) {
    const safe =
      e instanceof Error && /^[A-Z_:| <>\[\]a-z-]+$/.test(e.message)
        ? e.message
        : "SNAPSHOT_FAILED";
    console.error(safe);
    process.exitCode = 1;
  }
}
