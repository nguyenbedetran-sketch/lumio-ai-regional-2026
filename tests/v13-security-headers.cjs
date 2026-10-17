"use strict";
const assert = require("node:assert/strict");
const config = require("./v9-database-loader.cjs")()("next.config.ts").default;
async function main() {
  for (const phase of ["phase-development-server", "phase-production-build"]) {
    const rules = await config(phase).headers();
    const all = rules.filter(rule => rule.source === "/:path*");
    assert.equal(all.length, 1);
    const values = Object.fromEntries(all[0].headers.map(h => [h.key.toLowerCase(), h.value]));
    assert.equal(values["x-frame-options"], "DENY");
    assert.equal(values["content-security-policy"], "frame-ancestors 'none'");
    assert.equal(values["x-content-type-options"], "nosniff");
    assert.equal(values["referrer-policy"], "strict-origin-when-cross-origin");
    // This increment deliberately does not disable the existing outbound
    // embed, script, voice, worker or theme capabilities with an untested CSP.
    assert.ok(!/script-src|frame-src|connect-src|default-src/.test(values["content-security-policy"]));
    for (const source of ["/", "/admin/:path*", "/teacher/:path*", "/classroom/:path*", "/api/:path*", "/preview-mobile.html"])
      assert.match(rules.find(rule => rule.source === source).headers.find(h => h.key === "X-Robots-Tag").value,/noindex.*nofollow.*noarchive/);
  }
  console.log("PASS Shared browser defenses and existing indexing/capability policy in dev and production (24 assertions)");
}
main().catch(e => {console.error(e);process.exitCode=1;});
