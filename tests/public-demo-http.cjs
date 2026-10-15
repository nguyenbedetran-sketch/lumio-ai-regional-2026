const assert = require("node:assert/strict");
const base = process.env.LUMIO_TEST_ORIGIN;
if (!base)
  throw new Error(
    "Set LUMIO_TEST_ORIGIN to the isolated production demo origin.",
  );
async function main() {
  const config = await (await fetch(base + "/api/config")).json();
  assert.equal(config.publicDemo, true);
  assert.equal(config.ai, false);
  assert.equal(config.google, false);
  assert.equal(config.facebook, false);
  console.log("PASS production public-demo config and capabilities");
  let passed = 1;
  for (const path of [
    "/api/auth/session",
    "/api/auth/providers",
    "/api/billing/catalog",
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    await response.json();
    passed++;
    console.log("PASS demo read " + path);
  }
  for (const path of [
    "/api/ai",
    "/api/voice",
    "/api/ingest",
    "/api/account/link",
    "/api/billing/admin",
    "/api/billing/checkout",
    "/api/auth/signin/google",
  ]) {
    const response = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base },
      body: "{}",
      redirect: "manual",
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "PUBLIC_DEMO_ONLY");
    passed++;
    console.log("PASS demo mutation denied " + path);
  }
  for (const path of ["/api/admin", "/api/account", "/api/billing"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "PUBLIC_DEMO_ONLY");
    passed++;
    console.log("PASS private demo read denied " + path);
  }
  const admin = await fetch(base + "/admin", { redirect: "manual" });
  assert.ok([302, 307].includes(admin.status));
  assert.match(admin.headers.get("location"), /publicDemo=1/);
  passed++;
  console.log("PASS demo admin page unavailable");
  console.log(
    `\n${passed} public-demo HTTP checks passed; no paid provider requests.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
