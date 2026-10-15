// One-time local setup form. No third-party requests, logs, or credential echo.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const target = path.join(__dirname, "..", ".env.local");
const token = crypto.randomBytes(32).toString("hex");
const origin = "http://127.0.0.1:3061";
let used = false;
const html = `<!doctype html><html lang="vi"><meta charset="utf-8"><title>Kết nối Google · Lumio AI</title><style>body{font:16px system-ui;max-width:540px;margin:60px auto;padding:25px;background:#f6f4fc;color:#302840}label{display:block;margin-top:20px}input{width:100%;padding:12px;box-sizing:border-box;margin:8px 0;border:1px solid #d6cfea;border-radius:10px}button{padding:12px 20px;background:#6a54d9;color:white;border:0;border-radius:10px}p{line-height:1.7}</style><h1>Kết nối Google cho Lumio</h1><p>Biểu mẫu cài đặt một lần trên máy này. Thông tin được ghi vào .env.local; không gửi tới dịch vụ bên ngoài.</p><form method="post" action="/save"><input type="hidden" name="token" value="${token}"><label>Google Client ID<input name="clientId" required autocomplete="off"></label><label>Google Client Secret<input name="clientSecret" type="password" required autocomplete="off"></label><button>Lưu cấu hình trên máy</button></form></html>`;
const enhance = `<script nonce="${token}">document.querySelector('form').addEventListener('submit',async(event)=>{event.preventDefault();const button=document.querySelector('button');button.disabled=true;button.textContent='Đang lưu…';try{const response=await fetch('/save',{method:'POST',body:new URLSearchParams(new FormData(event.currentTarget))});if(!response.ok)throw Error();document.body.innerHTML='<h1>Đã lưu cấu hình Google trên máy.</h1><p>Có thể đóng trang này. Khởi động lại Lumio để áp dụng.</p>'}catch{button.disabled=false;button.textContent='Không lưu được. Thử lại';}});</script>`;
const server = http.createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'none'; script-src 'nonce-${token}'; connect-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.headers.host !== "127.0.0.1:3061") {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  if (req.method === "GET" && req.url === "/" && !used) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(html + enhance);
  }
  if (
    req.method !== "POST" ||
    req.url !== "/save" ||
    used ||
    req.headers.origin !== origin ||
    !req.headers["content-type"]?.startsWith(
      "application/x-www-form-urlencoded",
    )
  ) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  try {
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      if (Buffer.byteLength(text) > 8192) {
        res.writeHead(413);
        return res.end("Too large");
      }
    }
    const form = new URLSearchParams(text);
    const id = form.get("clientId") || "",
      secret = form.get("clientSecret") || "";
    if (
      form.get("token") !== token ||
      !/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id) ||
      !/^GOCSPX-[\w-]+$/.test(secret)
    )
      throw Error();
    let env = fs.readFileSync(target, "utf8");
    for (const [key, value] of [
      ["GOOGLE_CLIENT_ID", id],
      ["GOOGLE_CLIENT_SECRET", secret],
    ]) {
      const line = key + "=" + JSON.stringify(value);
      const regex = new RegExp("^" + key + "=.*$", "m");
      env = regex.test(env)
        ? env.replace(regex, () => line)
        : env + "\n" + line + "\n";
    }
    fs.writeFileSync(target, env, { mode: 0o600 });
    used = true;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      '<!doctype html><meta charset="utf-8"><title>Đã lưu · Lumio AI</title><h1>Đã lưu cấu hình Google trên máy.</h1><p>Có thể đóng trang này. Khởi động lại Lumio để áp dụng.</p>',
    );
    console.log("Google configuration saved. Setup server is closing.");
    server.close();
  } catch {
    res.writeHead(400);
    res.end("Invalid configuration. No values were logged.");
  }
});
server.listen(3061, "127.0.0.1", () =>
  console.log("One-time setup: " + origin),
);
setTimeout(() => server.close(), 10 * 60 * 1000).unref();
