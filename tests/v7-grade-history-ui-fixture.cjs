// Reuse the actual teaching/student component bundle; this suite owns its work/evidence files.
const fs = require("node:fs"),
  path = require("node:path"),
  { build: buildTeaching } = require("./v7-teaching-ui-fixture.cjs");
function build() {
  const built = buildTeaching(),
    folder = path.resolve(__dirname, "../work/v7-grade-history-ui");
  fs.mkdirSync(folder, { recursive: true });
  for (const file of ["fixture.html", "fixture.js", "fixture.css"])
    fs.copyFileSync(path.join(built.folder, file), path.join(folder, file));
  return { ...built, folder };
}
module.exports = { build };
if (require.main === module)
  console.log(JSON.stringify({ status: "PASS", ...build() }));
