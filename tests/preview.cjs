const assert = require("node:assert/strict");
const http = require("node:http");
async function main() {
  const base = "http://127.0.0.1:3000";
  // undici strips Host overrides; node:http tests the actual inbound header.
  const hostile = await new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path: "/api/auth/providers",
        headers: { host: "attacker.invalid:3000" },
      },
      (response) => {
        let text = "";
        response.on("data", (chunk) => (text += chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode, body: JSON.parse(text) }),
        );
      },
    );
    request.on("error", reject);
    request.end();
  });
  assert.equal(hostile.status, 400);
  assert.equal(hostile.body.error, "INVALID_HOST");
  console.log("PASS preview rejects unapproved Host before NextAuth");
  const spoofed = await fetch(base + "/api/auth/providers", {
    headers: {
      "x-forwarded-host": "attacker.invalid",
      "x-forwarded-proto": "https",
    },
  });
  const providers = await spoofed.json();
  for (const provider of Object.values(providers))
    assert.equal(new URL(provider.signinUrl).origin, base);
  assert.ok(Object.keys(providers).length);
  console.log("PASS preview overwrites untrusted forwarded origin");
  const cross = await fetch(base + "/api/account/link", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ provider: "facebook" }),
  });
  assert.equal(cross.status, 403);
  assert.equal((await cross.json()).error, "INVALID_ORIGIN");
  console.log("PASS local origins cannot cross-submit account linking");
  const local = await fetch("http://localhost:3000/api/auth/providers");
  for (const provider of Object.values(await local.json()))
    assert.equal(new URL(provider.callbackUrl).origin, "http://localhost:3000");
  console.log("PASS localhost callbacks stay on localhost for Facebook");
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
