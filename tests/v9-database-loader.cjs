const fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
module.exports = function createLoader(root = path.resolve(__dirname, "..")) {
  const cache = new Map();
  return function load(relative) {
    const file = path.resolve(root, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const m = { exports: {} }; cache.set(file, m);
    const nativeRequire = require("node:module").createRequire(file);
    const localRequire = (name) => name.startsWith(".") ? load(path.resolve(path.dirname(file), name + ".ts")) : nativeRequire(name);
    localRequire.resolve = nativeRequire.resolve;
    new Function("require", "module", "exports", ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText)(localRequire, m, m.exports);
    return m.exports;
  };
};
