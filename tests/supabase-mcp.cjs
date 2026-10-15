const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-supabase-mcp-"));
const project = path.join(temporary, "project");
const outside = path.join(temporary, "outside");
const fakeHome = path.join(temporary, "fake-home");
const script = path.join(project, "scripts", "setup-supabase-mcp.cjs");
const ref = "abcdefghijklmnopqrst";
let passed = 0;
fs.mkdirSync(path.dirname(script), { recursive: true });
fs.mkdirSync(outside);
fs.mkdirSync(path.join(fakeHome, ".codex"), { recursive: true });
fs.mkdirSync(path.join(project, ".codex"));
fs.copyFileSync(
  path.join(__dirname, "../scripts/setup-supabase-mcp.cjs"),
  script,
);
fs.writeFileSync(
  path.join(fakeHome, ".codex/config.toml"),
  "# global sentinel\n",
);
fs.writeFileSync(
  path.join(project, ".codex/config.toml"),
  "# project sentinel\n",
);

function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: outside,
    encoding: "utf8",
    timeout: 10000,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      HOME: fakeHome,
      USERPROFILE: fakeHome,
      CODEX_HOME: path.join(fakeHome, ".codex"),
      SUPABASE_ACCESS_TOKEN: "synthetic-test-secret-never-output",
    },
  });
}
function reject(args, pattern) {
  const result = run(args);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  if (pattern) assert.match(result.stderr, pattern);
  assert.ok(!result.stdout.includes("synthetic-test-secret"));
  assert.ok(!result.stderr.includes("synthetic-test-secret"));
  return result;
}
function test(name, callback) {
  callback();
  passed++;
  console.log("PASS " + name);
}
function inventory(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? [name, ...inventory(name)] : [name];
  });
}

try {
  test("Print accepts only a canonical project ref and emits a scoped read-only URL", () => {
    const result = run(["--project-ref", ref, "--print"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^\[mcp_servers\.supabase_lumio_readonly\]$/m);
    const url = new URL(JSON.parse(result.stdout.match(/^url = (.+)$/m)[1]));
    assert.equal(url.origin, "https://mcp.supabase.com");
    assert.equal(url.pathname, "/mcp");
    assert.deepEqual(
      [...url.searchParams],
      [
        ["project_ref", ref],
        ["read_only", "true"],
        ["features", "database,docs"],
      ],
    );
    assert.ok(
      !/synthetic-test-secret|Authorization|bearer|approval_policy|sandbox_mode/.test(
        result.stdout,
      ),
    );
  });
  test("Standard HTTPS project URLs normalize to exactly the same template", () => {
    const plain = run(["--project-ref", ref, "--print"]);
    for (const value of [
      `https://${ref}.supabase.co`,
      `https://${ref}.supabase.co/`,
    ]) {
      const result = run(["--project-ref", value, "--print"]);
      assert.equal(result.status, 0);
      assert.equal(result.stdout, plain.stdout);
    }
  });
  test("Invalid ref, credentials, lookalike host and URL options are rejected without echo", () => {
    for (const value of [
      "",
      ref.slice(1),
      ref + "x",
      ref.toUpperCase(),
      "1" + ref.slice(1),
      ref + "\n",
      `http://${ref}.supabase.co`,
      `https://${ref}.supabase.co:443`,
      `https://${ref}.supabase.co.evil.test`,
      `https://${ref}.supabase.co/path`,
      `https://${ref}.supabase.co/?read_only=false`,
      `https://${ref}.supabase.co/#token`,
      `https://user:synthetic-test-secret@${ref}.supabase.co`,
      `https://${ref.toUpperCase()}.supabase.co`,
      `https://${ref}.supabase.co\\evil`,
      `https://${ref}.supabase.co%2f`,
      '"\n[mcp_servers.attacker]\nurl="https://evil.test"',
    ]) {
      reject(["--project-ref", value, "--print"]);
    }
  });
  test("CLI requires an explicit mode and rejects duplicate, missing or unknown arguments", () => {
    for (const args of [
      [],
      ["--print"],
      ["--project-ref", ref],
      ["--project-ref", ref, "--print", "--output-dir", "safe"],
      ["--project-ref", ref, "--print", "--print"],
      ["--project-ref", ref, "--project-ref", ref, "--print"],
      ["--project-ref", ref, "--output-dir"],
      ["--project-ref", ref, "--force"],
      ["--help", "--print"],
    ])
      reject(args);
    assert.equal(run(["--help"]).status, 0);
  });
  test("Print and help never create directories, configs or credential artifacts", () => {
    const before = inventory(temporary);
    assert.equal(run(["--project-ref", ref, "--print"]).status, 0);
    assert.equal(run(["--help"]).status, 0);
    assert.deepEqual(inventory(temporary), before);
  });
  test("Write creates only the selected project subdirectory regardless of caller cwd", () => {
    const before = inventory(temporary);
    const result = run([
      "--project-ref",
      ref,
      "--output-dir",
      "tooling/supabase-review",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Supabase is not connected/);
    const config = path.join(
      project,
      "tooling/supabase-review/.codex/config.toml",
    );
    assert.equal(
      fs.readFileSync(config, "utf8"),
      run(["--project-ref", ref, "--print"]).stdout,
    );
    assert.deepEqual(
      inventory(temporary).filter((file) => !before.includes(file)),
      [
        path.join(project, "tooling"),
        path.join(project, "tooling/supabase-review"),
        path.join(project, "tooling/supabase-review/.codex"),
        config,
      ],
    );
  });
  test("An existing config is byte-preserved and the user receives manual merge instructions", () => {
    const config = path.join(
      project,
      "tooling/supabase-review/.codex/config.toml",
    );
    const custom =
      '# preserved\n[mcp_servers.existing]\nurl = "https://example.test"\n';
    fs.writeFileSync(config, custom);
    reject(
      ["--project-ref", ref, "--output-dir", "tooling/supabase-review"],
      /already exists.*--print.*manually merge/,
    );
    assert.equal(fs.readFileSync(config, "utf8"), custom);
  });
  test("Traversal, global, absolute and reserved output paths cause no filesystem writes", () => {
    const before = inventory(temporary);
    for (const output of [
      ".",
      "..",
      "../outside",
      "folder/../../outside",
      outside,
      fakeHome,
      "/tmp/escape",
      "C:\\escape",
      "\\\\server\\share",
      ".codex",
      "folder/.codex",
      ".git/config",
      "node_modules/tool",
      "tooling//nested",
      "folder/..",
      "folder/.",
      "folder/trailing.",
      "C:escape",
      "CON",
      "aux.txt",
    ]) {
      reject(["--project-ref", ref, "--output-dir", output]);
    }
    assert.deepEqual(inventory(temporary), before);
  });
  test("A symlink or Windows junction cannot redirect generated config outside the project", () => {
    const link = path.join(project, "redirect");
    fs.symlinkSync(
      outside,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    const before = fs.readdirSync(outside);
    reject(
      ["--project-ref", ref, "--output-dir", "redirect/config-output"],
      /links, junctions/,
    );
    assert.deepEqual(fs.readdirSync(outside), before);
    fs.unlinkSync(link);
  });
  test("A symlink at the nested .codex directory also cannot redirect writes", () => {
    const output = path.join(project, "nested-review");
    fs.mkdirSync(output);
    const link = path.join(output, ".codex");
    fs.symlinkSync(
      outside,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    reject(
      ["--project-ref", ref, "--output-dir", "nested-review"],
      /links, junctions/,
    );
    assert.equal(fs.existsSync(path.join(outside, "config.toml")), false);
    fs.unlinkSync(link);
  });
  test("Global and active project configuration remain untouched throughout all CLI cases", () => {
    assert.equal(
      fs.readFileSync(path.join(fakeHome, ".codex/config.toml"), "utf8"),
      "# global sentinel\n",
    );
    assert.equal(
      fs.readFileSync(path.join(project, ".codex/config.toml"), "utf8"),
      "# project sentinel\n",
    );
  });
  console.log(
    `\n${passed}/${passed} Supabase MCP template checks passed; isolated files, no network/OAuth/database connection.`,
  );
} finally {
  const resolved = fs.realpathSync(temporary);
  const relative = path.relative(fs.realpathSync(os.tmpdir()), resolved);
  assert.ok(
    relative.startsWith("lumio-supabase-mcp-") && !relative.includes(path.sep),
  );
  fs.rmSync(resolved, { recursive: true, force: true });
}
