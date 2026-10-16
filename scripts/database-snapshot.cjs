// Operator-only CLI. Never exposes a backup endpoint or replaces a running database.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
// Node24's native type stripping reads the exact same contract as app health.
// No development compiler, migration execution or source secrets are needed.
const {
  assertDatabaseIntegrity,
} = require("../lib/server/database-integrity.ts");
function inspect(filename) {
  const file = path.resolve(filename);
  if (!fs.statSync(file).isFile()) throw Error("SOURCE_NOT_FILE");
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    if (db.prepare("PRAGMA quick_check").get().quick_check !== "ok")
      throw Error("INTEGRITY_FAILED");
    if (db.prepare("PRAGMA foreign_key_check").all().length)
      throw Error("FOREIGN_KEYS_FAILED");
    const { schemaVersion } = assertDatabaseIntegrity(db, {
      allowPrefix: true,
    });
    // Keep the verified pre-upgrade snapshot usable without migrating it from
    // an operator inspect/restore command. Unreviewed old/future schemas fail.
    if (![13, 14, 15, 16, 17, 18].includes(schemaVersion))
      throw Error("SCHEMA_NOT_SUPPORTED");
    return { integrity: "ok", schemaVersion };
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
