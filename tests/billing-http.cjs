const assert = require("node:assert/strict");
const base = process.env.LUMIO_TEST_ORIGIN || "http://127.0.0.1:3000";
async function check(name, path, status, options = {}, verify = () => {}) {
  const response = await fetch(base + path, { ...options, redirect: "manual" });
  assert.equal(response.status, status, `${name}: HTTP ${response.status}`);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  const body = await response.json();
  verify(body);
  console.log("PASS " + name);
}
async function main() {
  await check(
    "Anonymous catalog advertises no purchasable checkout",
    "/api/billing/catalog",
    200,
    {},
    (body) => {
      assert.equal(body.plans.length, 4);
      assert.equal(body.paymentProviderConfigured, false);
      assert.ok(body.plans.every((plan) => plan.checkoutAvailable === false));
      assert.ok(!JSON.stringify(body).includes("apiKey"));
    },
  );
  await check(
    "Billing balances require a canonical signed-in identity",
    "/api/billing",
    401,
  );
  await check(
    "Billing admin requires authentication",
    "/api/billing/admin",
    401,
  );
  const post = (body, origin = base) => ({
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
  await check(
    "Cross-origin checkout is denied before any payment",
    "/api/billing/checkout",
    403,
    post({ itemId: "plus", interval: "month" }, "https://untrusted.example"),
  );
  await check(
    "Forged actor/price cannot start an anonymous checkout",
    "/api/billing/checkout",
    401,
    post({ itemId: "plus", interval: "month", userId: "invented", amount: 0 }),
  );
  await check(
    "Anonymous subscription changes remain denied JSON",
    "/api/billing/subscription",
    401,
    post({ requestId: crypto.randomUUID(), action: "cancel" }),
  );
  await check(
    "Anonymous users cannot grant credits to themselves",
    "/api/billing/admin",
    401,
    post({
      action: "sandbox_grant",
      confirmSandbox: true,
      userId: "invented",
      planId: "pro",
      credits: 100000,
      days: 30,
      requestId: crypto.randomUUID(),
      reason: "Forged self grant",
    }),
  );
  console.log(
    "\n7 billing HTTP checks passed; anonymous requests, no charges or provider calls.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
