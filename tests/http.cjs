// Run after `pnpm dev`. No login, API calls to AI providers, or personal data output.
const assert = require("node:assert/strict");
const base = "http://127.0.0.1:3000";
async function main() {
  for (const route of [
    "/api/config",
    "/api/auth/session",
    "/api/auth/providers",
    "/api/auth/csrf",
  ]) {
    const response = await fetch(base + route);
    assert.equal(
      response.status,
      200,
      `${route} must succeed (configure auth first)`,
    );
    assert.match(
      response.headers.get("content-type") || "",
      /application\/json/,
    );
    const body = await response.json();
    if (route === "/api/config") {
      assert.equal(typeof body.google, "boolean");
      assert.equal(typeof body.capabilities.tutor, "boolean");
      assert.ok(
        !/openai|gemini|xai|client.?secret|api.?key/i.test(
          JSON.stringify(body),
        ),
      );
    }
    if (route === "/api/auth/csrf")
      assert.ok(
        typeof body.csrfToken === "string" && body.csrfToken.length > 10,
      );
    if (route === "/api/auth/providers")
      assert.ok(Object.keys(body).length > 0);
    console.log(`PASS ${route}: valid JSON, HTTP 200`);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
