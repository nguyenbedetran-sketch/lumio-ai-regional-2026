"use strict";
// Native code lives only in this persistent, killable process. Credentials are
// delivered through private advanced IPC, never command-line arguments.
const { serialize } = require("node:v8");
const errorInfo = require("./database-errors.cjs");
let database, packetLimit = 32 * 1024 * 1024, initialized = false;
function send(message) {
  if (serialize(message).byteLength > packetLimit)
    message = { id: message.id, ok: false, error: { kind: "size" } };
  if (process.connected) process.send(message);
}
function normalize(value) {
  if (typeof value === "bigint") return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(value) : value;
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object" && !ArrayBuffer.isView(value))
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  return value;
}
function binding(value) {
  if (value === null || typeof value === "string" || typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  throw new Error("INVALID_BINDING");
}
process.on("message", (message) => {
  try {
    if (!initialized) {
      if (message.op !== "initialize" || message.id !== 0) throw new Error("INVALID_RPC");
      initialized = true;
      packetLimit = message.packetLimit;
      const Database = require(message.driverPath);
      database = new Database(message.url, { authToken: message.authToken });
      database.defaultSafeIntegers(true);
      send({ id: 0, ok: true });
      return;
    }
    if (!database || !Number.isSafeInteger(message.id) || serialize(message).byteLength > packetLimit) throw new Error("INVALID_RPC");
    let value;
    if (message.op === "close") { database.close(); database = null; }
    else if (message.op === "exec") database.exec(message.sql);
    else if (["get", "all", "run"].includes(message.op)) {
      const statement = database.prepare(message.sql);
      const args = (message.args || []).map(binding);
      if (message.op === "run") {
        const result = statement.run(...args);
        const lastInsertRowid = Number.isSafeInteger(result.lastInsertRowid)
          ? result.lastInsertRowid : database.prepare("SELECT last_insert_rowid() AS id").get().id;
        value = { changes: result.changes, lastInsertRowid };
      } else {
        const columns = statement.columns().map((column) => column.name);
        statement.raw(true);
        const row = (values) => values === undefined ? undefined : Object.fromEntries(columns.map((name, i) => [name, values[i]]));
        value = message.op === "get" ? row(statement.get(...args)) : statement.all(...args).map(row);
      }
    } else throw new Error("INVALID_RPC");
    send({ id: message.id, ok: true, value: normalize(value) });
    if (message.op === "close") process.disconnect();
  } catch (error) { send({ id: Number.isSafeInteger(message?.id) ? message.id : -1, ok: false, error: errorInfo(error) }); }
});
// A healthy disconnect can close naturally. During native network blockage the
// broker/main watchdog kills this OS process; callbacks cannot preempt native IO.
process.on("disconnect", () => { if (database) { try { database.close(); } catch {} database = null; } });
