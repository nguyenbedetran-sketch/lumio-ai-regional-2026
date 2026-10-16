import type { NextConfig } from "next";
export default function config(phase: string): NextConfig {
  return {
    output: "standalone",
    serverExternalPackages: ["unpdf", "fflate", "htmlparser2", "libsql"],
    // The isolated document worker resolves fflate's Node export at runtime.
    // Next's trace otherwise omits lib/node.cjs from the standalone package.
    outputFileTracingIncludes: {
      "/*": [
        "./scripts/database-worker.cjs",
        "./scripts/database-child.cjs",
        "./node_modules/@libsql/**/*",
        "./node_modules/.pnpm/libsql@*/node_modules/libsql/**/*",
        "./node_modules/.pnpm/libsql@*/node_modules/@neon-rs/**/*",
        "./node_modules/.pnpm/libsql@*/node_modules/detect-libc/**/*",
        "./node_modules/.pnpm/libsql@*/node_modules/@libsql/**/*",
        "./node_modules/.pnpm/@libsql+*/node_modules/@libsql/**/*",
      ],
      "/api/ingest-document": [
        "./node_modules/fflate/**/*",
        "./node_modules/.pnpm/fflate@*/node_modules/fflate/**/*",
      ],
    },
    distDir: phase === "phase-development-server" ? ".next-dev" : ".next",
    devIndicators: false,
    async headers() {
      const privateHeaders = [
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      ];
      return ["/", "/admin/:path*", "/teacher/:path*", "/classroom/:path*", "/api/:path*", "/preview-mobile.html"].map(
        (source) => ({ source, headers: privateHeaders }),
      );
    },
    experimental: {
      webpackBuildWorker: false,
      cpus: 1,
      // Next 15 static generation sends function-valued config to its worker.
      // Child-process workers support that transport; worker_threads do not.
      workerThreads: phase === "phase-development-server",
    },
  };
}
