// Builds actual React admin components for an intercepted browser fixture.
// No test route, role switch or authentication bypass is added to the product.
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  folder = path.join(root, "work", "teacher-admin-ui");

function build() {
  fs.mkdirSync(folder, { recursive: true });
  const nodeCache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (nodeCache.has(filename)) return nodeCache.get(filename).exports;
    const module = { exports: {} };
    nodeCache.set(filename, module);
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    new Function("require", "module", "exports", output)(
      (name) => {
        if (name === "next-auth/react")
          return { signIn: async () => undefined };
        if (!name.startsWith(".")) return require(name);
        const base = path.resolve(path.dirname(filename), name);
        return load([base + ".ts", base + ".tsx"].find(fs.existsSync));
      },
      module,
      module.exports,
    );
    return module.exports;
  }
  const store = load("lib/server/store.ts").createStore(":memory:", {
      now: () => Date.UTC(2026, 9, 15, 12),
      adminEmails: ["synthetic-admin@example.test"],
    }),
    admin = store.ensureIdentity({
      provider: "google",
      providerAccountId: "synthetic-teacher-admin-ui",
      email: "synthetic-admin@example.test",
      emailVerified: true,
      name: "QUẢN TRỊ KIỂM THỬ",
    }),
    snapshot = {
      actor: {
        id: admin.id,
        accountKey: admin.storageKey,
        name: admin.name,
        role: admin.role,
      },
      permissions: load("lib/server/policy.ts").permissionsFor({
        user: admin,
        memberships: [],
      }),
      dashboard: store.getDashboard(),
      users: store.listUsers(),
      usage: [],
      audit: [],
      flags: store.listFlags(),
    };
  store.close();
  const React = require("react"),
    { renderToStaticMarkup } = require("react-dom/server"),
    { AdminConsole } = load("components/admin/console.tsx"),
    html = renderToStaticMarkup(
      React.createElement(AdminConsole, { initial: snapshot }),
    ),
    dev = renderToStaticMarkup(
      React.createElement(AdminConsole, {
        initial: {
          ...snapshot,
          actor: { ...snapshot.actor, role: "DEV" },
          permissions: [
            "admin.read",
            "ai.usage.read",
            "features.read",
            "system.read",
          ],
          users: null,
        },
      }),
    );
  assert.ok(
    html.includes("Xét duyệt giáo viên"),
    "ADMIN has teacher queue entry point",
  );
  assert.ok(
    !dev.includes("Xét duyệt giáo viên"),
    "DEV never renders a private teacher queue entry point",
  );
  assert.ok(
    !html.includes("KIỂM THỬ GIÁO VIÊN"),
    "SSR does not seed applicants or private profiles",
  );
  const modules = [],
    ids = new Map();
  function bundle(filename) {
    if (ids.has(filename)) return ids.get(filename);
    const id = modules.length;
    ids.set(filename, id);
    modules.push("");
    let source = fs.readFileSync(filename, "utf8");
    if (/\.tsx?$/.test(filename))
      source = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText;
    source = source.replace(
      /require\((["'])([^"']+)\1\)/g,
      (_all, _quote, name) => {
        if (name === "next-auth/react") return "({signIn:async()=>undefined})";
        let target;
        if (name.startsWith(".")) {
          const base = path.resolve(path.dirname(filename), name);
          target = [base, base + ".ts", base + ".tsx", base + ".js"].find(
            (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
          );
        } else
          target = require.resolve(name, { paths: [path.dirname(filename)] });
        if (!target) throw Error("FIXTURE_MODULE_MISSING");
        return `__require(${bundle(target)})`;
      },
    );
    modules[id] = `function(module,exports,__require){${source}\n}`;
    return id;
  }
  const reactId = bundle(require.resolve("react")),
    clientId = bundle(require.resolve("react-dom/client")),
    consoleId = bundle(path.join(root, "components/admin/console.tsx"));
  fs.writeFileSync(
    path.join(folder, "fixture.js"),
    `(function(){"use strict";const process={env:{NODE_ENV:"production"}};const modules=[${modules.join(",")}],cache={};function __require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,__require);return m.exports;}const React=__require(${reactId}),{createRoot}=__require(${clientId}),{AdminConsole}=__require(${consoleId});const root=createRoot(document.getElementById("root")),initial=${JSON.stringify(snapshot)};window.__teacherFixture=initial;window.__mountTeacherAdmin=function(mode="admin"){const next=structuredClone(initial);if(mode==="dev"){next.actor.role="DEV";next.permissions=["admin.read","ai.usage.read","features.read","system.read"];next.users=null;}if(mode==="read-only")next.permissions=next.permissions.filter(p=>p!=="teachers.review");root.render(React.createElement(AdminConsole,{key:mode,initial:next}));};window.__mountTeacherAdmin();})();`,
  );
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8"),
    css =
      [...layout.matchAll(/import "\.\/([^"\n]+\.css)"/g)]
        .map((m) => fs.readFileSync(path.join(root, "app", m[1]), "utf8"))
        .join("\n") +
      "\n" +
      fs.readFileSync(path.join(root, "app/admin/admin.css"), "utf8");
  fs.writeFileSync(path.join(folder, "fixture.css"), css);
  fs.writeFileSync(
    path.join(folder, "fixture.html"),
    '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teacher admin · Synthetic UI verification</title><link rel="stylesheet" href="/__teacher-admin-fixture.css"><body style="margin:0"><div style="padding:10px 18px;background:#214438;color:#cbf3dc;font:12px system-ui">KIỂM THỬ UI · Hồ sơ tổng hợp · Không phải giáo viên thật</div><div id="root"></div><script src="/__teacher-admin-fixture.js"></script></body></html>',
  );
  return { unitChecks: 3, folder };
}
module.exports = { build };
if (require.main === module)
  console.log(JSON.stringify({ status: "PASS", ...build() }));
