// Temporary loopback-only setup; secrets are never returned or logged.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const origin = "http://127.0.0.1:3062";
const token = crypto.randomBytes(32).toString("hex");
const target = path.join(__dirname, "..", ".env.local");
const fields = {
  OPENAI_API_KEY: "OpenAI API key",
  GEMINI_API_KEY: "Gemini API key",
  XAI_API_KEY: "xAI API key",
  FACEBOOK_CLIENT_ID: "Facebook App ID",
  FACEBOOK_CLIENT_SECRET: "Facebook App secret",
};
const defaults = {
  OPENAI_MODEL: "gpt-5-mini",
  GEMINI_MODEL: "gemini-3.8-flash",
  XAI_STT_MODEL: "grok-voice-transcribe-2.0",
  XAI_VOICE: "eve",
};
let saved = false;
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'none'; script-src 'nonce-${token}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'`,
  );
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.headers.host !== "127.0.0.1:3062") {
    res.writeHead(403);
    return res.end();
  }
  if (req.method === "GET" && req.url === "/" && !saved) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(
      `<!doctype html><html lang="vi"><meta charset="utf-8"><title>Kết nối dịch vụ · Lumio</title><style>body{font:16px system-ui;max-width:620px;margin:40px auto;padding:24px;background:#f5f3fb;color:#242137}label{display:block;margin-top:18px}input{width:100%;padding:12px;border:1px solid #d8d1eb;border-radius:9px;box-sizing:border-box}button{margin-top:22px;padding:14px;background:#6854dc;color:white;border:0;border-radius:10px}p{line-height:1.6}</style><h1>Kết nối Lumio trên máy</h1><p>Nhập cấu hình cần bổ sung. Ô trống giữ nguyên cấu hình đã có. Dữ liệu chỉ được lưu vào .env.local trên máy.</p><form><input type="hidden" name="token" value="${token}">${Object.entries(
        fields,
      )
        .map(
          ([key, label]) =>
            `<label>${label}<input name="${key}" type="password" autocomplete="off"></label>`,
        )
        .join(
          "",
        )}<button>Lưu cấu hình</button></form><script nonce="${token}">document.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const b=document.querySelector('button');b.disabled=true;try{const r=await fetch('/save',{method:'POST',body:new URLSearchParams(new FormData(e.currentTarget))});if(!r.ok)throw Error();document.body.innerHTML='<h1>Đã lưu cấu hình riêng trên máy.</h1>'}catch{b.disabled=false;b.textContent='Không lưu được. Thử lại'}})</script></html>`,
    );
  }
  if (
    req.method !== "POST" ||
    req.url !== "/save" ||
    req.headers.origin !== origin ||
    saved ||
    !req.headers["content-type"]?.startsWith(
      "application/x-www-form-urlencoded",
    )
  ) {
    res.writeHead(403);
    return res.end();
  }
  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 10000) throw Error();
    }
    const input = new URLSearchParams(body);
    if (input.get("token") !== token) throw Error();
    const updates = {};
    for (const key of Object.keys(fields)) {
      const value = input.get(key)?.trim();
      if (value) {
        if (!/^[A-Za-z0-9._-]{10,512}$/.test(value)) throw Error();
        updates[key] = value;
      }
    }
    if (!Object.keys(updates).length) throw Error();
    if (Object.keys(updates).some((key) => key.endsWith("_API_KEY")))
      Object.assign(updates, defaults, { LUMIO_AI_ENABLED: "true" });
    let env = fs.readFileSync(target, "utf8");
    for (const [key, value] of Object.entries(updates)) {
      const re = new RegExp("^" + key + "=.*$", "m"),
        line = key + "=" + JSON.stringify(value);
      env = re.test(env)
        ? env.replace(re, () => line)
        : env + "\n" + line + "\n";
    }
    fs.writeFileSync(target, env, { mode: 0o600 });
    saved = true;
    res.end("Saved");
    console.log("Service configuration saved locally.");
    server.close();
  } catch {
    res.writeHead(400);
    res.end("Invalid configuration");
  }
});
server.listen(3062, "127.0.0.1", () =>
  console.log("Temporary setup: " + origin),
);
setTimeout(() => server.close(), 10 * 60 * 1000).unref();
