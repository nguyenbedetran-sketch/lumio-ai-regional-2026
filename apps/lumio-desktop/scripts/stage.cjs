"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const sourceArg = process.argv.find((arg) => arg.startsWith("--web="));
const nodeArg = process.argv.find((arg) => arg.startsWith("--node="));
const web = path.resolve(sourceArg ? sourceArg.slice(6) : path.join(root, "../eduvi"));
const nodeExe = path.resolve(nodeArg ? nodeArg.slice(7) : process.execPath);
const standalone = path.join(web, ".next", "standalone");
const stage = path.join(root, "bundle");
const version = execFileSync(nodeExe, ["--version"], { encoding: "utf8" }).trim();
if (!/^v24\./.test(version)) throw new Error("Desktop backend requires an independently bundled Node 24 executable.");
if (!fs.existsSync(path.join(standalone, "server.js"))) throw new Error("Missing clean standalone build. Run pnpm build in the clean desktop web staging source first.");
if (fs.readdirSync(web).some(name=>/^\.env(?:\..*)?$/i.test(name)&&name!==".env.example")) throw new Error("Refusing to stage a source with environment files. Only .env.example is allowed; use the clean desktop source staging directory.");

// A fixed, verified child of this project's root is the only deletion target.
if (path.dirname(stage) !== root || path.basename(stage) !== "bundle") throw new Error("Unsafe staging directory.");
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(path.join(stage, "runtime"), { recursive: true });
const excluded = /(^|[\\/])(?:\.env(?:\..*)?|\.data|\.git|\.next-dev|\.cache|.*\.sqlite(?:-wal|-shm)?|.*\.db|.*\.log)(?:[\\/]|$)/i;
const filter = (filename) => {
  const relative = path.relative(standalone,filename);
  return !excluded.test(relative) && relative!=="node_modules" && !relative.startsWith(`node_modules${path.sep}`);
};
fs.cpSync(standalone, path.join(stage, "backend"), { recursive: true, dereference: true, filter });
const moduleRoot=path.join(standalone,"node_modules",".pnpm");
const modules=new Map();
function addModule(dir) {
  if(fs.lstatSync(dir).isSymbolicLink())return;
  const jsonPath=path.join(dir,"package.json");
  if(!fs.existsSync(jsonPath))return;
  const json=JSON.parse(fs.readFileSync(jsonPath,"utf8"));
  if(!json.name||!json.version)throw new Error("Traced package metadata is missing.");
  const previous=modules.get(json.name);
  if(previous&&previous.version!==json.version)throw new Error(`Cannot flatten conflicting traced package versions: ${json.name}`);
  modules.set(json.name,{dir,version:json.version});
}
if(!fs.existsSync(moduleRoot))throw new Error("Expected pnpm standalone module layout was not found.");
for(const store of fs.readdirSync(moduleRoot)) {
  const deps=path.join(moduleRoot,store,"node_modules");
  if(!fs.existsSync(deps))continue;
  for(const name of fs.readdirSync(deps)) {
    const dir=path.join(deps,name);
    if(fs.lstatSync(dir).isSymbolicLink())continue;
    if(name.startsWith("@"))for(const scoped of fs.readdirSync(dir))addModule(path.join(dir,scoped));
    else addModule(dir);
  }
}
if(!modules.has("next")||!modules.has("react")||!modules.has("react-dom"))throw new Error("Required traced runtime modules are missing.");

// Windows Next 15 tracing can recreate a directory symlink as a file symlink,
// causing EPERM. All traced packages here have unique versions, so materialize
// the standard flat npm layout instead of shipping symlinks/junctions in ZIP.
function copyNotices(sourceDir,targetDir) {
  if(fs.existsSync(sourceDir))for(const entry of fs.readdirSync(sourceDir,{withFileTypes:true})) {
    if(entry.isFile()&&/^(?:licen[cs]e|notice|copyright|third.party)(?:[._-].*)?$/i.test(entry.name))fs.copyFileSync(path.join(sourceDir,entry.name),path.join(targetDir,entry.name));
  }
  for(const entry of fs.readdirSync(targetDir,{withFileTypes:true}))if(entry.isDirectory())copyNotices(path.join(sourceDir,entry.name),path.join(targetDir,entry.name));
}
for(const [name,module] of modules) {
  const target=path.join(stage,"backend","node_modules",name);
  fs.cpSync(module.dir,target,{recursive:true,dereference:true,filter:filename=>!excluded.test(path.relative(module.dir,filename))});
  const original=path.join(web,path.relative(standalone,module.dir));
  copyNotices(original,target);
}
fs.cpSync(path.join(web, ".next", "static"), path.join(stage, "backend", ".next", "static"), { recursive: true });
fs.cpSync(path.join(web, "public"), path.join(stage, "backend", "public"), { recursive: true });
fs.copyFileSync(nodeExe, path.join(stage, "runtime", "node.exe"));
const nodeLicense = fs.existsSync(path.join(path.dirname(nodeExe), "LICENSE"))
  ? path.join(path.dirname(nodeExe), "LICENSE")
  : path.join(root,"docs",`NODE-LICENSE-${version.slice(1)}.txt`);
if (fs.existsSync(nodeLicense)) fs.copyFileSync(nodeLicense, path.join(stage, "runtime", "NODE-LICENSE.txt"));
else throw new Error("Node distribution LICENSE is required for packaging.");

const files = [];
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else files.push(file); } }
walk(stage);
const patterns = [ /sk-proj-[A-Za-z0-9_-]{20,}/g, /xai-[A-Za-z0-9_-]{30,}/g, /AIza[A-Za-z0-9_-]{20,}/g ];
const manifest = { desktopVersion: "0.1.0", nodeVersion: version, generatedAt: new Date().toISOString(), webVersion: JSON.parse(fs.readFileSync(path.join(web,"package.json"),"utf8")).version, modules:Object.fromEntries([...modules].map(([name,module])=>[name,module.version])), files: {} };
for (const file of files) {
  const rel = path.relative(stage, file).replaceAll("\\", "/");
  if (excluded.test(rel)) throw new Error("Excluded private path found in staged bundle.");
  const data = fs.readFileSync(file);
  if (/\.(js|json|html|txt|css|map|cjs|mjs)$/i.test(rel)) {
    const text = data.toString("utf8");
    for (const pattern of patterns) { pattern.lastIndex = 0; if (pattern.test(text)) throw new Error(`Credential-like token detected in staged source: ${rel}`); }
  }
  manifest.files[rel] = { size: data.length, sha256: crypto.createHash("sha256").update(data).digest("hex") };
}
fs.writeFileSync(path.join(stage,"BUNDLE-MANIFEST.json"),JSON.stringify(manifest,null,2));
console.log(`Staged ${files.length} clean runtime files; Node ${version}; web ${manifest.webVersion}.`);
