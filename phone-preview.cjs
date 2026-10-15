// LAN-only bridge to the existing local preview. No public hosting or tunnel.
const http = require("node:http");
const os = require("node:os");
const addresses = Object.values(os.networkInterfaces())
  .flat()
  .filter(
    (a) =>
      a &&
      a.family === "IPv4" &&
      !a.internal &&
      /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address),
  );
if (!addresses.length) throw new Error("No private IPv4 interface found.");
const host = addresses[0].address;
http
  .createServer((req, res) => {
    // The LAN bridge exposes UI only, never local AI bypass or OAuth.
    let pathname = "";
    try {
      pathname = decodeURIComponent(
        new URL(req.url || "/", "http://preview.local").pathname,
      ).replace(/\\/g, "/");
    } catch {}
    if (
      !pathname ||
      !["GET", "HEAD"].includes(req.method || "") ||
      /^\/admin(?:\/|$)/i.test(pathname) ||
      (/^\/api(?:\/|$)/i.test(pathname) && pathname !== "/api/config")
    ) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "LAN_PREVIEW_ONLY" }));
      return;
    }
    const publicHeaders = { ...req.headers, host: "127.0.0.1:3000" };
    delete publicHeaders.cookie;
    delete publicHeaders.authorization;
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: 3000,
        path: req.url,
        method: req.method,
        headers: publicHeaders,
      },
      (reply) => {
        res.writeHead(reply.statusCode || 502, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
      res.end(
        "Bản Lumio AI local chưa chạy. Hãy chạy node preview.cjs trên máy tính.",
      );
    });
    req.pipe(upstream);
  })
  .listen(3001, host, () => console.log(`Phone preview: http://${host}:3001`));
