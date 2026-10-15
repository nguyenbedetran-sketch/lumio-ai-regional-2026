"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { packager } = require("@electron/packager");
const root = path.resolve(__dirname, "..");
const bundle = path.join(root,"bundle");
if (!fs.existsSync(path.join(bundle,"backend","server.js"))) throw new Error("Run stage first with the clean standalone web build.");
async function run() {
  const paths = await packager({
    dir:root, name:"Lumio AI", executableName:"Lumio AI", appVersion:"0.1.0", appBundleId:"edu.lumio.desktop",
    platform:"win32", arch:"x64", electronVersion:"44.5.1",
    icon:path.join(root,"assets","lumio.ico"),
    out:path.join(root,"dist"), overwrite:true, asar:true, prune:true,
    ignore:[/^\/bundle(?:\/|$)/,/^\/dist(?:\/|$)/,/^\/tests(?:\/|$)/,/^\/scripts(?:\/|$)/,/^\/docs(?:\/|$)/,/^\/\.smoke-data(?:\/|$)/,/^\/node_modules(?:\/|$)/,/^\/package-lock\.json$/,/^\/\.git(?:\/|$)/,/^\/\.env(?:\..*)?$/i,/\.(?:sqlite(?:-wal|-shm)?|db|log)$/i],
    extraResource:[path.join(bundle,"backend"),path.join(bundle,"runtime"),path.join(bundle,"BUNDLE-MANIFEST.json")],
    win32metadata:{CompanyName:"Lumio",FileDescription:"Lumio AI learning workspace",ProductName:"Lumio AI",InternalName:"Lumio AI",OriginalFilename:"Lumio AI.exe"},
  });
  for (const folder of paths) {
    fs.copyFileSync(path.join(root,"README.md"),path.join(folder,"HUONG-DAN.md"));
    fs.copyFileSync(path.join(root,"docs","PRIVACY.md"),path.join(folder,"PRIVACY.md"));
    fs.copyFileSync(path.join(root,"docs","THIRD-PARTY.md"),path.join(folder,"THIRD-PARTY.md"));
  }
  console.log(JSON.stringify({version:"0.1.0",folders:paths}));
}
run().catch((error)=>{console.error(error.message);process.exitCode=1;});
