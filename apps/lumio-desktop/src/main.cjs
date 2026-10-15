"use strict";
const { app, BrowserWindow, session, dialog, Menu, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const crypto = require("node:crypto");
const { ORIGIN, exactOrigin, trustedContents, trustedPermission, trustedDisplayRequest, capturePermissionKind, safeExternalURL, approvedServerSettings } = require("./security.cjs");

const smoke = process.argv.includes("--smoke-test");
const smokeFlag = process.argv.find((value) => value.startsWith("--smoke-report="));
const reportPath = smokeFlag ? path.resolve(smokeFlag.slice("--smoke-report=".length)) : null;
const isolatedFlag = process.argv.find((value) => value.startsWith("--isolated-data="));
if (isolatedFlag) app.setPath("userData", path.resolve(isolatedFlag.slice("--isolated-data=".length)));
else app.setPath("userData", path.join(app.getPath("appData"), "Lumio AI Desktop"));
if (smoke) app.disableHardwareAcceleration();
app.setName("Lumio AI");
app.setAppUserModelId("edu.lumio.desktop");

let win = null;
let backend = null;
let quitting = false;
let confirmPending = false;
let displayPermit = null;
let captureGeneration = 0;
let smokeResult = { status: "RUNNING", version: "0.1.0", checks: [], captureAttempted: false };
const nonce = crypto.randomBytes(32).toString("hex");

function writeSmoke(status, message) {
  if (!smoke || !reportPath) return;
  smokeResult.status = status;
  if (message) smokeResult.error = message;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(smokeResult, null, 2));
}

function resourcePaths() {
  const resource = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "../bundle");
  return { backend: path.join(resource, "backend"), runtime: path.join(resource, "runtime", "node.exe") };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error("PORT_BUSY")));
    probe.listen(3210, "127.0.0.1", () => probe.close(resolve));
  });
}

function serverEnvironment(dataRoot) {
  const env = {};
  // Do not inherit credentials, debugger switches or user app environment.
  for (const name of ["SYSTEMROOT", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "COMSPEC"]) {
    if (process.env[name]) env[name] = process.env[name];
  }
  let settings = {};
  const configFile = path.join(dataRoot, "server-settings.json");
  if (fs.existsSync(configFile)) {
    try { settings = approvedServerSettings(JSON.parse(fs.readFileSync(configFile, "utf8"))); }
    catch { throw new Error("SETTINGS_INVALID"); }
  }
  const secretPath = path.join(dataRoot, "session-secret");
  if (!fs.existsSync(secretPath)) fs.writeFileSync(secretPath, crypto.randomBytes(48).toString("base64url"), { mode: 0o600, flag: "wx" });
  Object.assign(env, settings, {
    NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: "3210",
    LUMIO_DESKTOP: "true", LUMIO_DESKTOP_NONCE: nonce,
    LUMIO_DB_PATH: path.join(dataRoot, "data", "lumio.sqlite"),
    LUMIO_ALLOW_LOCAL_DB_PRODUCTION: "true",
    NEXTAUTH_URL: ORIGIN, NEXTAUTH_SECRET: fs.readFileSync(secretPath, "utf8").trim(),
    NEXT_TELEMETRY_DISABLED: "1",
    LUMIO_AI_ENABLED: (settings.OPENAI_API_KEY && settings.OPENAI_MODEL) || (settings.GEMINI_API_KEY && settings.GEMINI_MODEL) || settings.XAI_API_KEY ? "true" : "false",
  });
  return env;
}

async function startBackend() {
  const resources = resourcePaths();
  if (!fs.existsSync(resources.runtime) || !fs.existsSync(path.join(resources.backend, "server.js"))) throw new Error("BUNDLE_MISSING");
  await freePort();
  const dataRoot = path.join(app.getPath("userData"), "server");
  fs.mkdirSync(path.join(dataRoot, "data"), { recursive: true });
  backend = spawn(resources.runtime, [path.join(resources.backend, "server.js")], { cwd: dataRoot, env: serverEnvironment(dataRoot), windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let backendFailed = false;
  backend.once("error", () => { backendFailed = true; });
  backend.once("exit", () => {
    backendFailed = true;
    if (!smoke && !quitting && win && !win.isDestroyed()) {
      void dialog.showMessageBox(win, { type: "error", title: "Lumio AI", message: "Dịch vụ Lumio trên máy đã dừng.", detail: "Đóng rồi mở lại ứng dụng để tiếp tục. Dữ liệu học đã lưu vẫn được giữ trên máy.", buttons: ["Đóng Lumio"] }).then(() => app.quit());
    }
  });
  // Logs can contain imported learning content. Never persist or forward them.
  backend.stderr.on("data", () => {});
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (backendFailed) throw new Error("SERVER_STOPPED");
    try {
      const response = await fetch(`${ORIGIN}/api/desktop/health`, { headers: { "x-lumio-desktop-token": nonce }, signal: AbortSignal.timeout(1500) });
      const result = response.ok ? await response.json() : null;
      if (result?.desktop === true && result?.nonce === nonce) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  throw new Error("SERVER_TIMEOUT");
}

function stopCapture() {
  captureGeneration++;
  displayPermit = null;
  if (win && !win.isDestroyed()) win.webContents.send("lumio:stop-capture");
}

function openExternal(value) {
  // The app's explicit "Open local web" link is the sole HTTP exception.
  const safe = value === "http://localhost:3000/" || value === "http://127.0.0.1:3000/" ? value : safeExternalURL(value);
  if (safe) void shell.openExternal(safe).catch(() => {});
}

function protectSession(ses) {
  const expected = () => win && !win.isDestroyed() ? win.webContents : null;
  ses.setPermissionCheckHandler((contents, permission, origin, details) => {
    if (!trustedContents(contents, expected()) || !exactOrigin(origin) || details?.isMainFrame !== true || (details.requestingUrl && !exactOrigin(details.requestingUrl))) return false;
    // Never cache media grants: the request handler asks again on each capture.
    return permission === "clipboard-sanitized-write" || permission === "fullscreen";
  });
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (!trustedPermission(contents, expected(), details)) return callback(false);
    if (permission === "clipboard-sanitized-write" || permission === "fullscreen") return callback(true);
    const kind = capturePermissionKind(permission, details);
    if (kind === "denied" || confirmPending) return callback(false);
    if (smoke) {
      if (kind === "system") {
        // Isolated synthetic pipeline probe. Passing this preliminary check
        // does not return media: the final handler below always rejects it.
        smokeResult.systemPermissionProbe = { permission, mediaTypes:details.mediaTypes };
        smokeResult.permissionPipelineProbed = true;
        smokeResult.permissionProbeCount = (smokeResult.permissionProbeCount || 0) + 1;
        return callback(true);
      }
      return callback(false);
    }
    confirmPending = true;
    const generation = captureGeneration;
    let replied = false;
    const reply = (granted) => { if (!replied) { replied = true; try { callback(granted); } catch {} } };
    void (async () => {
      // getDisplayMedia consumes transient activation before the permission
      // callback. The final DisplayMediaRequest.userGesture is authoritative;
      // reading navigator.userActivation here would reject valid button clicks.
      const options = kind === "microphone" ? {
        title: "Cho phép Lumio dùng micro?", message: "Thu giọng nói từ micro của bạn",
        detail: "Chỉ bắt đầu khi bạn chọn Cho phép. Bạn có thể dừng bất cứ lúc nào trong Lumio hoặc menu Dừng thu âm. Quyền này không cấp quyền dùng camera.", buttons: ["Hủy", "Cho phép micro"],
      } : {
        title: "Thu âm thanh máy tính", message: "Cho phép Lumio nghe âm thanh đang phát trên laptop?",
        detail: "Bao gồm Zoom, Teams, Meet, video và các ứng dụng khác đang phát âm thanh; không chỉ riêng Zoom. Hãy thông báo và có sự đồng ý của người tham gia trước khi ghi cuộc họp.\n\nWindows cần một luồng hình ảnh tạm từ cửa sổ Lumio để lấy âm thanh. Lumio không ghi hoặc gửi luồng hình ảnh này. Bạn có thể dừng trong Lumio hoặc menu Dừng thu âm. Micro chỉ được dùng nếu bạn chọn riêng.", buttons: ["Hủy", "Cho phép thu âm"],
      };
      const { response } = await dialog.showMessageBox(win, {type:"question",...options,defaultId:0,cancelId:0,noLink:true});
      const granted = response === 1 && generation === captureGeneration && trustedPermission(contents, expected(), details);
      if (kind === "system" && granted) displayPermit = { contents, frame:contents.mainFrame, generation, expires:Date.now()+5000 };
      reply(granted);
    })().catch(() => reply(false)).finally(() => { confirmPending = false; });
  });
  ses.setDisplayMediaRequestHandler((request, callback) => {
    if (smoke) {
      smokeResult.finalDisplayProbe = { userGesture:request.userGesture, audioRequested:request.audioRequested, videoRequested:request.videoRequested, trusted:trustedDisplayRequest(request, expected()), deniedWithoutCapture:true };
      return callback({});
    }
    const permit = displayPermit; displayPermit = null;
    if (process.platform !== "win32" || smoke || !trustedDisplayRequest(request, expected()) || !permit || permit.contents !== expected() || permit.frame !== request.frame || permit.generation !== captureGeneration || permit.expires < Date.now()) return callback({});
    try { callback({ video: request.frame, audio: "loopback" }); } catch {}
  });
  ses.setDevicePermissionHandler(() => false);
  ses.webRequest.onHeadersReceived({ urls: [`${ORIGIN}/*`] }, (details, callback) => {
    const headers = { ...details.responseHeaders };
    if (details.resourceType === "mainFrame") {
      headers["Content-Security-Policy"] = ["default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: data: https:; frame-src 'self' blob: https://www.youtube-nocookie.com; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'"];
      headers["Permissions-Policy"] = ["camera=(), microphone=(self), display-capture=(self), geolocation=(), usb=(), serial=(), bluetooth=()"];
    }
    callback({ responseHeaders: headers });
  });
}

function createMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "Lumio", submenu: [
      { label: "Dừng thu âm", accelerator: "CmdOrCtrl+Shift+S", click: stopCapture },
      { type: "separator" },
      { label: "Mở bản web trên máy", click: () => openExternal("http://localhost:3000/") },
      { label: "Mở bản web public", click: () => openExternal("https://lumio-ai-demo.onrender.com/") },
      { type: "separator" }, { role: "quit", label: "Thoát Lumio" },
    ]},
    { label: "Chỉnh sửa", submenu: [{role:"undo",label:"Hoàn tác"},{role:"redo",label:"Làm lại"},{type:"separator"},{role:"cut",label:"Cắt"},{role:"copy",label:"Sao chép"},{role:"paste",label:"Dán"},{role:"selectAll",label:"Chọn tất cả"}]},
    { label: "Hiển thị", submenu: [{role:"zoomIn",label:"Phóng to"},{role:"zoomOut",label:"Thu nhỏ"},{role:"resetZoom",label:"Kích thước ban đầu"},{type:"separator"},{role:"togglefullscreen",label:"Toàn màn hình"}]},
    { label: "Trợ giúp", submenu: [{ label: "Về Lumio AI", click: () => void dialog.showMessageBox(win, { title:"Lumio AI", message:"Lumio AI Desktop 0.1.0", detail:"Không gian học tập trên Windows. Dữ liệu riêng được lưu trong tài khoản Windows hiện tại. Bản laptop này dùng được các công cụ học và thu âm trên máy; AI trực tuyến và đăng nhập Google/Facebook dùng bản web.", buttons:["Đóng"] }) }]},
  ]));
}

function configureWindow(ses) {
  win = new BrowserWindow({
    width: 1360, height: 900, minWidth: 840, minHeight: 620,
    title: "Lumio AI", backgroundColor: "#15211f", show: !smoke,
    icon: path.resolve(__dirname, "../assets/lumio-logo.png"),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, backgroundThrottling: false, session: ses, devTools: !app.isPackaged },
  });
  win.on("close", stopCapture);
  win.on("closed", () => { win = null; app.quit(); });
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: "deny" }; });
  const navigation = (event, target) => {
    const url = typeof target === "string" ? target : target.url;
    if (!exactOrigin(url)) { event.preventDefault(); stopCapture(); openExternal(url); }
  };
  win.webContents.on("will-navigate", navigation);
  win.webContents.on("will-redirect", navigation);
  win.webContents.on("will-frame-navigate", (event) => {
    if (!event.isMainFrame) {
      try {
        const url = new URL(event.url);
        if (url.protocol === "https:" && url.hostname === "www.youtube-nocookie.com") return;
        if (url.protocol === "blob:" && url.origin === ORIGIN) return;
      } catch {}
      event.preventDefault();
    }
  });
  win.webContents.on("page-title-updated", (event) => event.preventDefault());
  if (smoke) win.webContents.on("console-message", (event, details, legacyMessage) => {
    const message = typeof event?.message === "string" ? event.message : typeof details === "object" ? details.message : legacyMessage;
    if (typeof message === "string" && /hydration|TypeError|ReferenceError|Uncaught|Minified React error|CLIENT_FETCH_ERROR/i.test(message)) {
      smokeResult.runtimeErrors ||= [];
      smokeResult.runtimeErrors.push(message.slice(0,400));
    }
  });
  win.webContents.on("render-process-gone", () => { stopCapture(); if (!quitting) app.quit(); });
  return win;
}

async function nativeSmoke() {
  const deadline = Date.now() + 30000;
  let ui;
  while (Date.now() < deadline) {
    ui = await win.webContents.executeJavaScript(`({ ready:!!document.querySelector('.lm-main'), title:document.title, desktop:window.lumioDesktop, node:typeof window.require, process:typeof window.process, origin:location.origin, text:document.body.innerText.slice(0,500) })`);
    if (ui.ready) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const prefs = win.webContents.getLastWebPreferences();
  const config = await win.webContents.executeJavaScript("fetch('/api/config').then(r=>r.json())");
  const forbiddenMedia = await win.webContents.executeJavaScript(`navigator.mediaDevices.getUserMedia({video:true}).then(stream=>{stream.getTracks().forEach(t=>t.stop());return 'UNEXPECTED_GRANT';}).catch(e=>e.name)`);
  const displayProbe = await win.webContents.executeJavaScript(`navigator.mediaDevices.getDisplayMedia({video:true,audio:true}).then(stream=>{stream.getTracks().forEach(t=>t.stop());return 'UNEXPECTED_GRANT';}).catch(e=>e.name)`,true);
  const displayWithGesture = smokeResult.finalDisplayProbe;
  const probeCount = smokeResult.permissionProbeCount;
  // A preceding synthetic user gesture can remain active for five seconds in
  // Chromium even after a denied request. Wait for it to expire before proving
  // that a genuinely inactive call cannot request screen/audio permission.
  await new Promise(resolve=>setTimeout(resolve,6000));
  const inactiveBeforeProbe = await win.webContents.executeJavaScript("navigator.userActivation.isActive===false");
  const noGestureProbe = await win.webContents.executeJavaScript(`navigator.mediaDevices.getDisplayMedia({video:true,audio:true}).then(stream=>{stream.getTracks().forEach(t=>t.stop());return 'UNEXPECTED_GRANT';}).catch(e=>e.name)`);
  const inactiveDisplayDenied = smokeResult.permissionProbeCount===probeCount || (smokeResult.finalDisplayProbe?.userGesture===false&&smokeResult.finalDisplayProbe?.trusted===false&&smokeResult.finalDisplayProbe?.deniedWithoutCapture===true);
  smokeResult.displayWithGesture = displayWithGesture;
  smokeResult.displayWithoutGesture = smokeResult.permissionProbeCount===probeCount ? {rejectedBeforePermission:true} : smokeResult.finalDisplayProbe;
  await win.webContents.executeJavaScript("window.__lumioSmokeStop=false; window.addEventListener('lumio:stop-capture',()=>{window.__lumioSmokeStop=true;},{once:true});");
  stopCapture();
  await new Promise(resolve=>setTimeout(resolve,80));
  const stopDelivered = await win.webContents.executeJavaScript("window.__lumioSmokeStop===true");
  await new Promise(resolve=>setTimeout(resolve,650));
  const visual = await win.webContents.executeJavaScript("(()=>{const main=document.querySelector('.lm-content');const rect=main?.getBoundingClientRect();return {opacity:main?Number(getComputedStyle(main).opacity):0,width:rect?.width||0,height:rect?.height||0};})()");
  const checks = [
    ["Native BrowserWindow loaded hydrated Lumio workspace", ui?.ready === true],
    ["Trusted fixed loopback origin", ui?.origin === ORIGIN],
    ["Isolated metadata preload loaded", ui?.desktop?.systemAudio === true && ui.desktop.auth === "browser-only"],
    ["Renderer Node access disabled", ui?.node === "undefined" && ui?.process === "undefined"],
    ["Sandbox and context isolation enabled", prefs.sandbox === true && prefs.contextIsolation === true && prefs.nodeIntegration === false],
    ["Offline config has no embedded social credentials", config.google === false && config.facebook === false],
    ["Camera permission is denied without recording", forbiddenMedia !== "UNEXPECTED_GRANT"],
    ["Pinned Electron display permission shape reaches denied synthetic probe", displayProbe !== "UNEXPECTED_GRANT" && !!smokeResult.systemPermissionProbe && displayWithGesture?.deniedWithoutCapture === true],
    ["Native display request preserves original gesture and owned top frame", displayWithGesture?.trusted === true && displayWithGesture?.userGesture === true],
    ["Inactive display request cannot pass native capture authority", inactiveBeforeProbe&&noGestureProbe!=="UNEXPECTED_GRANT"&&inactiveDisplayDenied],
    ["Native Stop menu event crosses isolated preload", stopDelivered === true],
    ["Hydrated workspace remains visible after entry motion", visual.opacity>=0.99&&visual.width>200&&visual.height>200],
    ["No runtime or hydration errors during native workspace load", !smokeResult.runtimeErrors?.length],
  ];
  smokeResult.checks = checks.map(([name, passed]) => ({ name, passed }));
  smokeResult.backendPid = backend.pid;
  if (reportPath) {
    const shot = await win.webContents.capturePage();
    fs.writeFileSync(path.join(path.dirname(reportPath), "lumio-desktop-preview.png"), shot.toPNG());
  }
  await win.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(button=>button.innerText.includes('Phòng giọng nói'))?.click()");
  const voiceDeadline=Date.now()+15000;
  let voice;
  while(Date.now()<voiceDeadline) {
    voice=await win.webContents.executeJavaScript("(()=>{const section=document.querySelector('.lm-meeting');const start=section?.querySelector('[data-meeting-action=start]');const mic=section?.querySelector('[data-meeting-microphone]');return {loaded:!!section,startEnabled:!!start&&!start.disabled,microphoneOff:!!mic&&!mic.checked,text:section?.innerText||''};})()");
    if(voice.loaded&&voice.startEnabled)break;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  smokeResult.checks.push({name:"Native voice room exposes local system capture with microphone off by default",passed:voice?.loaded===true&&voice.startEnabled===true&&voice.microphoneOff===true&&voice.text.includes("Zoom")});
  if(voice?.startEnabled) {
    await win.webContents.executeJavaScript("document.querySelector('[data-meeting-action=start]').click()",true);
    const deniedDeadline=Date.now()+10000;
    let deniedUI;
    while(Date.now()<deniedDeadline) {
      deniedUI=await win.webContents.executeJavaScript("(()=>{const section=document.querySelector('.lm-meeting');return {phase:section?.dataset.phase,error:!!section?.querySelector('[role=alert]'),startEnabled:section?.querySelector('[data-meeting-action=start]')?.disabled===false};})()");
      if(deniedUI.phase==="idle"&&deniedUI.error)break;
      await new Promise(resolve=>setTimeout(resolve,120));
    }
    smokeResult.checks.push({name:"Actual capture button handles native permission denial and returns to idle",passed:deniedUI?.phase==="idle"&&deniedUI.error===true&&deniedUI.startEnabled===true});
  } else smokeResult.checks.push({name:"Actual capture button handles native permission denial and returns to idle",passed:false});
  await win.webContents.executeJavaScript("document.querySelector('.lm-meeting')?.scrollIntoView({block:'start'})");
  // Offscreen Chromium starts some CSS animation timelines on its first
  // compositor paint. Prime that paint, then verify the actual visible result.
  await win.webContents.capturePage();
  const settledDeadline=Date.now()+5000;
  let voiceVisible=false;
  while(Date.now()<settledDeadline) {
    voiceVisible=await win.webContents.executeJavaScript("(()=>{const main=document.querySelector('.lm-content');const studio=document.querySelector('.lv-studio');return !!main&&!!studio&&Number(getComputedStyle(main).opacity)>=0.99&&Number(getComputedStyle(studio).opacity)>=0.99;})()");
    if(voiceVisible)break;
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  smokeResult.checks.push({name:"Native voice page remains visible after entry animation",passed:voiceVisible});
  if(reportPath) {
    const shot=await win.webContents.capturePage();
    fs.writeFileSync(path.join(path.dirname(reportPath),"lumio-desktop-voice-preview.png"),shot.toPNG());
  }
  const runtimeCheck=smokeResult.checks.find(check=>check.name.startsWith("No runtime or hydration errors"));
  if(runtimeCheck)runtimeCheck.passed=!smokeResult.runtimeErrors?.length;
  writeSmoke(smokeResult.checks.every(check=>check.passed) ? "PASS" : "FAIL");
  app.quit();
}

async function shutdown() {
  if (quitting) return;
  quitting = true; stopCapture();
  if (backend && backend.exitCode === null) {
    backend.kill();
    await new Promise((resolve) => { const timer = setTimeout(resolve, 2200); backend.once("exit", () => { clearTimeout(timer); resolve(); }); });
  }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.on("before-quit", (event) => {
    if (quitting) return;
    event.preventDefault(); void shutdown().finally(() => app.quit());
  });
  app.whenReady().then(async () => {
    writeSmoke("RUNNING");
    const ses = session.fromPartition(smoke ? "lumio-smoke" : "persist:lumio-desktop");
    protectSession(ses); configureWindow(ses); createMenu();
    await win.loadFile(path.resolve(__dirname, "../assets/loading.html"));
    await startBackend();
    await win.loadURL(ORIGIN);
    if (smoke) await nativeSmoke();
  }).catch(async (error) => {
    writeSmoke("FAIL", error?.message || "START_FAILED");
    if (!smoke) {
      const messages = { PORT_BUSY: "Cổng 3210 đang được một chương trình khác sử dụng. Lumio không kết nối đến dịch vụ lạ. Đóng bản Lumio đang mở hoặc chương trình dùng cổng này rồi thử lại.", BUNDLE_MISSING: "Thiếu file ứng dụng. Hãy giải nén toàn bộ ZIP và mở Lumio AI.exe trong thư mục đã giải nén.", SETTINGS_INVALID: "File server-settings.json chưa đúng định dạng. Kiểm tra lại file cấu hình API riêng.", SERVER_TIMEOUT: "Dịch vụ Lumio chưa khởi động được. Đóng ứng dụng rồi mở lại." };
      await dialog.showMessageBox({ type:"error", title:"Không mở được Lumio", message:"Lumio chưa thể khởi động", detail:messages[error?.message] || "Dịch vụ trên máy đã dừng. Hãy giải nén lại bộ ứng dụng rồi thử lại.", buttons:["Đóng"] });
    }
    app.quit();
  });
}
