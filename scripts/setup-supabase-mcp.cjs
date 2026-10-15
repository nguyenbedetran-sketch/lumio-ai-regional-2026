#!/usr/bin/env node
// Offline template generator: no credentials, OAuth, network or global config.
const fs = require("node:fs");
const path = require("node:path");

const HELP = `Create a project-scoped, read-only Supabase MCP template.

Usage:
  node scripts/setup-supabase-mcp.cjs --project-ref REF_OR_URL --print
  node scripts/setup-supabase-mcp.cjs --project-ref REF_OR_URL --output-dir tooling/supabase-config

REF must be exactly 20 lowercase letters, or https://REF.supabase.co[/].
--print writes only the TOML template to stdout.
--output-dir must be an explicit dedicated subdirectory of this project.
The helper creates OUTPUT/.codex/config.toml and never overwrites a file.
Review and manually merge the section into your trusted project's config.
No connection, authentication or database migration is performed.
`;

class SetupError extends Error {}
function invalid(message) {
  throw new SetupError(message);
}

function parseArguments(args) {
  if (args.length === 1 && ["--help", "-h"].includes(args[0]))
    return { help: true };
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (!["--project-ref", "--output-dir", "--print"].includes(argument)) {
      invalid("Unknown option. Use --help; no input values were logged.");
    }
    if (Object.hasOwn(options, argument))
      invalid("Duplicate option. Use --help.");
    if (argument === "--print") {
      options[argument] = true;
      continue;
    }
    const value = args[++index];
    if (!value || value.startsWith("--"))
      invalid("Missing option value. Use --help.");
    options[argument] = value;
  }
  if (!options["--project-ref"])
    invalid("Supply --project-ref; no project is assumed.");
  if (!!options["--print"] === !!options["--output-dir"]) {
    invalid(
      "Choose exactly one of --print or --output-dir. Nothing was written.",
    );
  }
  return options;
}

function projectRef(input) {
  const match = /^(?:([a-z]{20})|https:\/\/([a-z]{20})\.supabase\.co\/?)$/.exec(
    input,
  );
  if (!match) {
    invalid(
      "Invalid project ref. Use 20 lowercase letters or the standard HTTPS Supabase project URL only; do not supply credentials.",
    );
  }
  return match[1] || match[2];
}

function template(ref) {
  return `# Lumio Supabase MCP: review before merging into project .codex/config.toml.
# No credentials. This template does not authenticate or migrate a database.
[mcp_servers.supabase_lumio_readonly]
url = "https://mcp.supabase.com/mcp?project_ref=${ref}&read_only=true&features=database,docs"
`;
}

function outputSegments(value) {
  if (path.isAbsolute(value) || path.win32.isAbsolute(value)) {
    invalid(
      "Output must be a relative dedicated subdirectory inside this project.",
    );
  }
  const segments = value.split(/[\\/]/);
  if (
    !segments.length ||
    segments.some(
      (part) =>
        !/^[a-zA-Z0-9_.-]+$/.test(part) ||
        part === "." ||
        part === ".." ||
        /[. ]$/.test(part) ||
        [".codex", ".git", ".data", "node_modules"].includes(
          part.toLowerCase(),
        ) ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),
    )
  ) {
    invalid(
      "Use a dedicated path such as tooling/supabase-config, without traversal, reserved names or configuration directories.",
    );
  }
  return segments;
}

function contained(root, target) {
  const relative = path.relative(root, target);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function inspectDirectory(root, target) {
  const status = fs.lstatSync(target, { throwIfNoEntry: false });
  if (!status) return false;
  if (
    status.isSymbolicLink() ||
    !status.isDirectory() ||
    !contained(root, fs.realpathSync(target))
  ) {
    invalid(
      "Output path must contain ordinary project directories, not links, junctions or files.",
    );
  }
  return true;
}

function writeTemplate(projectRoot, segments, text) {
  const root = fs.realpathSync(projectRoot);
  let directory = root;
  // Walk before creating anything, so an existing escaping link is rejected.
  for (const part of [...segments, ".codex"]) {
    directory = path.join(directory, part);
    inspectDirectory(root, directory);
  }
  const target = path.join(directory, "config.toml");
  if (fs.lstatSync(target, { throwIfNoEntry: false })) {
    invalid(
      "Config already exists. Use --print and manually merge the reviewed section; existing config was not changed.",
    );
  }
  directory = root;
  for (const part of [...segments, ".codex"]) {
    directory = path.join(directory, part);
    if (!inspectDirectory(root, directory)) {
      try {
        fs.mkdirSync(directory, { mode: 0o700 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      inspectDirectory(root, directory);
    }
  }
  // Exclusive creation also denies a file created after the preflight check.
  try {
    fs.writeFileSync(target, text, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code === "EEXIST") {
      invalid(
        "Config already exists. Use --print and manually merge; existing config was not changed.",
      );
    }
    throw error;
  }
  return path.relative(root, target);
}

function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  const text = template(projectRef(options["--project-ref"]));
  if (options["--print"]) {
    process.stdout.write(text);
    return;
  }
  const target = writeTemplate(
    path.resolve(__dirname, ".."),
    outputSegments(options["--output-dir"]),
    text,
  );
  console.log(
    `Created ${target}. Review and manually merge into the intended project config. Supabase is not connected.`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(
      error instanceof SetupError
        ? error.message
        : "Could not create the template. Check directory permissions. No configuration was intentionally overwritten.",
    );
    process.exitCode = 1;
  }
}

module.exports = { projectRef, template, outputSegments, writeTemplate, main };
