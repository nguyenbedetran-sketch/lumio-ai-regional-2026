// Reuse the maintained compiled teaching/auth harness, append real HTTP file
// checks, and retain historical accepted teaching reports unchanged.
const fs = require("node:fs"),
  path = require("node:path"),
  Module = require("node:module");
const root = path.resolve(__dirname, ".."),
  filename = path.join(root, "scripts/test-teaching-production.cjs"),
  m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
let source = fs.readFileSync(filename, "utf8");
const anchor = "  for (const phase of [1, 2, 3, 4])";
if (source.split(anchor).length !== 2)
  throw Error("COMPILED_HARNESS_ANCHOR_CHANGED");
source = source
  .replace(
    "docs/next/reports/compiled-http-report.json",
    "docs/next/reports/teaching-files/compiled-http.json",
  )
  .replace(
    anchor,
    fs.readFileSync(
      path.join(root, "tests/teaching-files-production.fragment.js"),
      "utf8",
    ) +
      "\n" +
      anchor.replace("[1, 2, 3, 4]", "[1, 2, 3, 4, 5]"),
  );
m._compile(source, filename);
