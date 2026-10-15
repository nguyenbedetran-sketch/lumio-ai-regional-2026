// Local-only helper. Never prints secrets and never uploads configuration.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const target = path.join(root, ".env.local");
let text = fs.existsSync(target)
  ? fs.readFileSync(target, "utf8")
  : fs.readFileSync(path.join(root, ".env.example"), "utf8");
function get(key) {
  const match = text.match(new RegExp("^" + key + "=(.*)$", "m"));
  return match?.[1]?.trim().replace(/^"|"$/g, "") || "";
}
function set(key, value) {
  if (/[\r\n]/.test(value)) throw Error("INVALID_VALUE");
  const line = key + "=" + JSON.stringify(value);
  const re = new RegExp("^" + key + "=.*$", "m");
  text = re.test(text)
    ? text.replace(re, () => line)
    : text + "\n" + line + "\n";
}
function save() {
  fs.writeFileSync(target, text, { mode: 0o600 });
}
const args = process.argv.slice(2);
if (args.includes("--init")) {
  if (!get("NEXTAUTH_SECRET"))
    set("NEXTAUTH_SECRET", crypto.randomBytes(32).toString("base64url"));
  if (!get("NEXTAUTH_URL")) set("NEXTAUTH_URL", "http://localhost:3000");
  save();
  console.log("Local session configuration ready. No secrets printed.");
}
const index = args.indexOf("--google");
if (index >= 0) {
  try {
    const credentials = JSON.parse(
      fs.readFileSync(path.resolve(args[index + 1] || ""), "utf8"),
    ).web;
    if (
      !credentials ||
      typeof credentials.client_id !== "string" ||
      !credentials.client_id.endsWith(".apps.googleusercontent.com") ||
      typeof credentials.client_secret !== "string" ||
      !credentials.client_secret
    )
      throw Error();
    const callback = get("NEXTAUTH_URL") + "/api/auth/callback/google";
    if (
      !Array.isArray(credentials.redirect_uris) ||
      !credentials.redirect_uris.includes(callback)
    )
      throw Error();
    set("GOOGLE_CLIENT_ID", credentials.client_id);
    set("GOOGLE_CLIENT_SECRET", credentials.client_secret);
    save();
    console.log("Google credentials imported locally. Restart the server.");
  } catch {
    console.error(
      "Import failed: select the Web OAuth JSON with the matching callback URI. No configuration was changed.",
    );
    process.exitCode = 1;
  }
}
console.log(
  JSON.stringify({
    origin: get("NEXTAUTH_URL"),
    sessionConfigured: !!get("NEXTAUTH_SECRET"),
    googleConfigured:
      !!get("GOOGLE_CLIENT_ID") && !!get("GOOGLE_CLIENT_SECRET"),
    facebookConfigured:
      !!get("FACEBOOK_CLIENT_ID") && !!get("FACEBOOK_CLIENT_SECRET"),
  }),
);
