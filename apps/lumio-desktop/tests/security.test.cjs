"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ORIGIN, exactOrigin, trustedContents, trustedPermission, trustedDisplayRequest, allowedMicrophone, capturePermissionKind, safeExternalURL, approvedServerSettings } = require("../src/security.cjs");

function contents() {
  const frame = { url: `${ORIGIN}/`, top: null }; frame.top = frame;
  return { mainFrame: frame, isDestroyed: () => false, getURL: () => `${ORIGIN}/` };
}
test("trust only the exact loopback origin and owned window", () => {
  const c = contents();
  assert.equal(exactOrigin(`${ORIGIN}/voice`), true);
  for (const url of ["http://localhost:3210", "http://127.0.0.1:3211", "http://127.0.0.1.evil.test:3210", "file:///C:/test", "https://127.0.0.1:3210", "http://u:p@127.0.0.1:3210"]) assert.equal(exactOrigin(url), false, url);
  assert.equal(trustedContents(c, c), true);
  assert.equal(trustedContents(contents(), c), false);
  assert.equal(trustedContents(null, c), false);
});
test("permissions reject subframes, unknown request origins and destroyed windows", () => {
  const c = contents(); const details = { isMainFrame: true, requestingUrl: ORIGIN, securityOrigin: ORIGIN };
  assert.equal(trustedPermission(c, c, details), true);
  assert.equal(trustedPermission(c, c, { ...details, isMainFrame: false }), false);
  assert.equal(trustedPermission(c, c, { ...details, requestingUrl: "https://evil.test" }), false);
  assert.equal(trustedPermission(c, c, { ...details, securityOrigin: "https://evil.test" }), false);
  c.isDestroyed = () => true;
  assert.equal(trustedPermission(c, c, details), false);
});
test("display capture requires an active user gesture, both tracks, own top frame", () => {
  const c = contents(); const r = { frame: c.mainFrame, securityOrigin: ORIGIN, userGesture: true, videoRequested: true, audioRequested: true };
  assert.equal(trustedDisplayRequest(r, c), true);
  for (const changed of [{userGesture:false},{audioRequested:false},{videoRequested:false},{securityOrigin:"https://evil.test"},{frame:null},{frame:contents().mainFrame}]) assert.equal(trustedDisplayRequest({ ...r, ...changed }, c), false);
  const top = c.mainFrame.top; c.mainFrame.top = {};
  assert.equal(trustedDisplayRequest(r, c), false); c.mainFrame.top = top;
});
test("microphone permissions never grant camera, combined media or unknown types", () => {
  assert.equal(allowedMicrophone({mediaTypes:["audio"]}), true);
  for (const types of [["video"],["audio","video"],[],["unknown"]]) assert.equal(allowedMicrophone({mediaTypes:types}), false);
  assert.equal(allowedMicrophone({}), false);
});
test("Electron 44 and future display permission shapes require system consent, never camera consent", () => {
  assert.equal(capturePermissionKind("media", {mediaTypes:[]}),"system");
  assert.equal(capturePermissionKind("display-capture", {mediaTypes:["video","audio"]}),"system");
  assert.equal(capturePermissionKind("media", {mediaTypes:["audio"]}),"microphone");
  for (const [permission,details] of [["media",{}],["media",{mediaTypes:["video"]}],["media",{mediaTypes:["video","audio"]}],["display-capture",{mediaTypes:["video"]}],["display-capture",{mediaTypes:["audio","video","unknown"]}],["unknown",{mediaTypes:[]}]]) assert.equal(capturePermissionKind(permission,details),"denied");
});
test("external navigation rejects executable/local/injected credentials", () => {
  assert.equal(safeExternalURL("https://lumio-ai-demo.onrender.com/"), "https://lumio-ai-demo.onrender.com/");
  for (const url of ["javascript:alert(1)","file:///C:/Windows", "http://example.com", "https://u:p@example.com", "https://localhost", "https://127.0.0.1"]) assert.equal(safeExternalURL(url), null);
});
test("private server settings cannot alter origin, capture, paths or executable settings", () => {
  assert.deepEqual(approvedServerSettings({OPENAI_API_KEY:"example-local-only",PORT:"80",NODE_OPTIONS:"--inspect",NEXTAUTH_URL:"https://evil",LUMIO_DB_PATH:"bad",XAI_STT_MODEL:"model",GEMINI_MODEL:"bad\nvalue"}), {OPENAI_API_KEY:"example-local-only",XAI_STT_MODEL:"model"});
  assert.deepEqual(approvedServerSettings(null), {});
});
