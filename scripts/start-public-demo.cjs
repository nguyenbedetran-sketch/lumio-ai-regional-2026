const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawn } = require("node:child_process");

// Dedicated free-host entry point: refuse an accidental full/private deployment.
if (
  process.env.LUMIO_PUBLIC_DEMO !== "true" ||
  process.env.NODE_ENV !== "production"
) {
  console.error(
    "Public demo startup requires LUMIO_PUBLIC_DEMO=true and NODE_ENV=production.",
  );
  process.exit(1);
}
const forbidden = [
  "NEXTAUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "FACEBOOK_CLIENT_ID",
  "FACEBOOK_CLIENT_SECRET",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "XAI_API_KEY",
  "LUMIO_ADMIN_EMAILS",
  "DATABASE_URL",
  "LUMIO_DB_PATH",
];
const privateFiles = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  ".data",
];
if (
  forbidden.some((key) => !!process.env[key]) ||
  privateFiles.some((name) => existsSync(resolve(process.cwd(), name))) ||
  process.env.LUMIO_ALLOW_LOCAL_DB_PRODUCTION === "true"
) {
  console.error(
    "Public demo refuses private environment configuration or local data. Use a clean source-only deployment with no credentials or database.",
  );
  process.exit(1);
}
const port = Number(process.env.PORT || "3000");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("Invalid public demo port.");
  process.exit(1);
}
const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    "start",
    "--hostname",
    "0.0.0.0",
    "--port",
    String(port),
  ],
  {
    stdio: "inherit",
    shell: false,
    env: { ...process.env, LUMIO_AI_ENABLED: "false" },
  },
);
child.once("error", () => {
  console.error("Could not start the public demo server.");
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
