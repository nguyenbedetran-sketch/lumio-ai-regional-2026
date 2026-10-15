// Requires the local dev server. No cookies, provider requests, or database mutations.
const assert = require("node:assert/strict");
const base = process.env.LUMIO_TEST_ORIGIN || "http://127.0.0.1:3000";
if (!["http://127.0.0.1:3000", "http://localhost:3000"].includes(base))
  throw new Error("Tests only run against the local preview");
(async () => {
  for (const path of [
    "/api/admin",
    "/api/admin/users",
    "/api/admin/audit",
    "/api/admin/usage",
  ]) {
    const result = await fetch(base + path);
    assert.equal(result.status, 401, path);
    assert.match(result.headers.get("content-type"), /application\/json/);
    assert.equal((await result.json()).error, "SIGN_IN_REQUIRED");
    assert.match(result.headers.get("cache-control"), /no-store/);
    console.log("PASS unauthenticated denial " + path);
  }
  for (const path of ["/api/admin/users", "/api/admin/flags"]) {
    const result = await fetch(base + path, {
      method: "PATCH",
      headers: {
        origin: "https://invalid.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(result.status, 403);
    assert.equal((await result.json()).error, "INVALID_ORIGIN");
    console.log("PASS cross-origin denial " + path);
  }
  for (const path of ["/api/auth/session", "/api/account", "/api/config"]) {
    const result = await fetch(base + path);
    assert.equal(result.status, 200, path);
    assert.match(result.headers.get("content-type"), /application\/json/);
    await result.json();
    console.log("PASS JSON response " + path);
  }
  console.log("\n9 local HTTP checks passed.");
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
