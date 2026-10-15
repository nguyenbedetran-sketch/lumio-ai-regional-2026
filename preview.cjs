const http = require("node:http");
const next = require("next");
// Dev-only origin selection. Never trust arbitrary forwarded headers.
process.env.AUTH_TRUST_HOST = "true";
process.env.LUMIO_DEV_ORIGIN_SELECTION = "true";
// Keep these keys present but empty before dotenv/Next initialization. Deleting
// them lets a development hot reload restore the .env URL and pin both hosts.
process.env.NEXTAUTH_URL = "";
process.env.NEXTAUTH_URL_INTERNAL = "";
const app = next({ dev: true, hostname: "127.0.0.1", port: 3000 });
app.prepare().then(() => {
  // Patched NextAuth prioritizes NEXTAUTH_URL over forwarded headers. Only this
  // loopback proxy may select either approved local origin per request. Never
  // mutate a process-wide URL for individual concurrent requests.
  process.env.LUMIO_DEV_ORIGIN_SELECTION = "true";
  delete process.env.NEXTAUTH_URL;
  delete process.env.NEXTAUTH_URL_INTERNAL;
  const handle = app.getRequestHandler();
  http
    .createServer((req, res) => {
      // Next development reloads may restore initial dotenv values. This proxy
      // always clears the override; it never selects a global URL per request.
      delete process.env.NEXTAUTH_URL;
      delete process.env.NEXTAUTH_URL_INTERNAL;
      const host = req.headers.host;
      if (!["127.0.0.1:3000", "localhost:3000"].includes(host)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "INVALID_HOST" }));
        return;
      }
      for (const key of Object.keys(req.headers)) {
        if (key === "forwarded" || key.startsWith("x-forwarded-"))
          delete req.headers[key];
      }
      req.headers["x-forwarded-host"] = host;
      req.headers["x-forwarded-proto"] = "http";
      handle(req, res);
    })
    .listen(3000, "127.0.0.1", () =>
      console.log(
        "Lumio AI preview: http://localhost:3000 (also 127.0.0.1:3000)",
      ),
    );
});
