// Test-only preload: exercises existing store suites through the native-child
// SQL bridge using THEIR temporary local SQLite files, never production config.
const Module = require("node:module");
const native = require("node:sqlite");
const originalLoad = Module._load;
const { SqliteWorkerConnection } = require("./v9-database-loader.cjs")()("lib/server/database-remote.ts");
Module._load = function(request, parent, isMain) {
  if (request === "node:sqlite") return { ...native, DatabaseSync: class {
    constructor(filename, options) {
      // Some test helpers inspect snapshots read-only; retain their exact native
      // read-only enforcement. Application createStore connections use bridge.
      if (options?.readOnly) return new native.DatabaseSync(filename, options);
      const database = new SqliteWorkerConnection({ url: filename });
      // These are local test files: mirror node:sqlite test WAL/lock waiting.
      // Production remote factory never applies these local-only PRAGMAs.
      database.exec("PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;");
      return database;
    }
  } };
  return originalLoad.call(this, request, parent, isMain);
};
