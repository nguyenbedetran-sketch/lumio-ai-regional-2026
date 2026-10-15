const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const moduleValue = { exports: {} };
new Function(
  "exports",
  "module",
  ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../lib/lumio/motion-policy.ts"),
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
)(moduleValue.exports, moduleValue);
const { parseMotionPreference, resolveMotionMode } = moduleValue.exports;
for (const value of [null, undefined, "invalid", "FULL", {}, 42])
  assert.equal(parseMotionPreference(value), "full");
console.log("PASS Invalid or missing preference restores full mode");
for (const mode of ["full", "subtle", "off"])
  assert.equal(parseMotionPreference(mode), mode);
console.log("PASS Valid stored settings round-trip");
for (const mode of ["full", "subtle", "off"])
  assert.equal(resolveMotionMode(mode, true), "off");
console.log("PASS OS reduced motion overrides all user settings");
for (const mode of ["full", "subtle", "off"])
  assert.equal(resolveMotionMode(mode, false), mode);
console.log("PASS Restoring OS preference returns the saved user setting");
console.log("4 motion policy checks passed.");
