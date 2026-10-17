"use strict";
// libsql-js 0.5.29 exposes local SQLite codes as properties. Its pinned Rust
// remote Hrana StreamError path instead wraps the structured server error in
// a Debug string and sets code="". Accept only that entire exact envelope;
// never infer SQL success/rollback from a substring in a transport error.
const DEFINITE_SQL = /^SQLITE_(?:CONSTRAINT(?:_[A-Z_]+)?|BUSY(?:_[A-Z_]+)?|LOCKED(?:_[A-Z_]+)?|RANGE|MISMATCH|TOOBIG|READONLY(?:_[A-Z_]+)?)$/;
const HRANA_STREAM = /^Hrana\(StreamError\(Error \{ message: ("(?:[^"\\]|\\.)*"), code: ("(?:[^"\\]|\\.)*") \}\)\)$/;
module.exports = function errorInfo(error) {
  let code = typeof error?.code === "string" ? error.code : "";
  let message = typeof error?.message === "string" ? error.message : "";
  if (code === "" && message.length <= 65536) {
    const match = HRANA_STREAM.exec(message);
    if (match) {
      try {
        const serverCode = JSON.parse(match[2]), serverMessage = JSON.parse(match[1]);
        if (typeof serverCode === "string" && DEFINITE_SQL.test(serverCode) && typeof serverMessage === "string") {
          code = serverCode; message = serverMessage;
        }
      } catch { /* Unrecognized debug escaping remains an uncertain failure. */ }
    }
  }
  if (DEFINITE_SQL.test(code)) {
    const guard = ["AUDIT_APPEND_ONLY", "LEDGER_APPEND_ONLY", "TEACHING_HISTORY_IMMUTABLE"].find(text => message.includes(text));
    return {kind:"sql",code,...(guard ? {guard} : {})};
  }
  return {kind:"transport"};
};
