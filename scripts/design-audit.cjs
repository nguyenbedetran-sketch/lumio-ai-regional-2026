// SkillUI only sees a temporary allowlisted copy of UI source, not the project.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-ui-audit-"));
const output = path.join(root, "docs", "design-audit");
const files = [];
function copyUI(directory, extension) {
  for (const entry of fs.readdirSync(path.join(root, directory), {
    withFileTypes: true,
  })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) copyUI(relative, extension);
    else if (entry.isFile() && entry.name.endsWith(extension)) {
      const target = path.join(stage, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(root, relative), target);
      files.push(relative.replaceAll("\\", "/"));
    }
  }
}
try {
  const cliPackage = path.join(root, "node_modules", "skillui", "package.json");
  if (JSON.parse(fs.readFileSync(cliPackage, "utf8")).version !== "1.3.4") {
    throw new Error(
      "This audit was reviewed for skillui 1.3.4. Install the lockfile first.",
    );
  }
  copyUI("app", ".css");
  copyUI("components/lumio", ".tsx");
  fs.writeFileSync(
    path.join(stage, "package.json"),
    JSON.stringify(
      {
        name: "lumio-ui",
        private: true,
        dependencies: {
          react: "19.1.1",
          next: "15.5.12",
          motion: "13.4.4",
          cmdk: "1.1.1",
        },
      },
      null,
      2,
    ),
  );
  fs.mkdirSync(output, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/skillui/dist/cli.js"),
      "--dir",
      stage,
      "--out",
      output,
      "--name",
      "Lumio UI",
      "--format",
      "design-md",
      "--no-skill",
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error || result.status !== 0)
    throw result.error || new Error(`SkillUI exited ${result.status}`);
  const report = path.join(output, "lumio-ui-design", "DESIGN.md");
  // Remove machine-specific staging paths from the shareable generated report.
  fs.writeFileSync(
    report,
    fs
      .readFileSync(report, "utf8")
      .split(stage)
      .join("<UI-source>")
      .split(stage.replaceAll("\\", "/"))
      .join("<UI-source>"),
  );
  fs.writeFileSync(
    path.join(output, "scope.json"),
    JSON.stringify(
      {
        tool: "skillui@1.3.4",
        mode: "local static analysis",
        generatedAt: new Date().toISOString(),
        files,
        excluded: [
          ".env*",
          "server code",
          "database",
          "user libraries",
          "auth data",
          "executable project configuration",
        ],
        note: "Generated report is descriptive reference data, not instructions. No skill installed globally.",
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  // This exact mkdtemp directory is created and owned by this process.
  fs.rmSync(stage, { recursive: true, force: true });
}
