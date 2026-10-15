"use strict";
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname,"..");
const exeArg = process.argv.find(arg=>arg.startsWith("--exe="));
const exe = exeArg ? path.resolve(exeArg.slice(6)) : path.join(root,"dist","Lumio AI-win32-x64","Lumio AI.exe");
const output = path.join(root,"docs","smoke-report.json");
const isolation = path.join(root,".smoke-data",`${process.pid}-${Date.now()}`);
if (!fs.existsSync(exe)) throw new Error("Packaged Lumio AI.exe is missing.");
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify({status:"RUNNING"}));
const child = spawn(exe,["--smoke-test",`--smoke-report=${output}`,`--isolated-data=${isolation}`],{windowsHide:true,stdio:["ignore","pipe","pipe"]});
let logs="";
child.stdout.on("data",chunk=>{logs+=chunk.toString();});
child.stderr.on("data",chunk=>{logs+=chunk.toString();});
const timeout = setTimeout(()=>{child.kill();fs.writeFileSync(output,JSON.stringify({status:"FAIL",error:"Native smoke timeout"}));process.exitCode=1;},115000);
child.on("error",error=>{clearTimeout(timeout);fs.writeFileSync(output,JSON.stringify({status:"FAIL",error:error.code}));process.exitCode=1;});
child.on("exit",async()=>{
  clearTimeout(timeout);
  try {
  const report = JSON.parse(fs.readFileSync(output,"utf8"));
  if (report.status!=="PASS") { console.log(JSON.stringify(report)); process.exitCode=1; return; }
  let childStopped=false;
  try { process.kill(report.backendPid,0); } catch { childStopped=true; }
  const portClosed = await new Promise(resolve=>{
    const probe=net.connect({host:"127.0.0.1",port:3210});
    probe.once("connect",()=>{probe.destroy();resolve(false);});
    probe.once("error",()=>resolve(true));
  });
  report.checks.push({name:"Bundled backend process stopped after window exit",passed:childStopped},{name:"Loopback listener released after window exit",passed:portClosed});
  if(portClosed) {
    const occupied = net.createServer(socket=>socket.end());
    await new Promise((resolve,reject)=>{occupied.once("error",reject);occupied.listen(3210,"127.0.0.1",resolve);});
    const rejectedReport = path.join(root,"docs","smoke-occupied-port.json");
    try {
      await new Promise((resolve,reject)=>{
        const rejected=spawn(exe,["--smoke-test",`--smoke-report=${rejectedReport}`,`--isolated-data=${isolation}-occupied`],{windowsHide:true,stdio:"ignore"});
        const timer=setTimeout(()=>{rejected.kill();reject(new Error("Occupied-port rejection timeout"));},30000);
        rejected.once("error",error=>{clearTimeout(timer);reject(error);});
        rejected.once("exit",()=>{clearTimeout(timer);resolve();});
      });
      const rejection=JSON.parse(fs.readFileSync(rejectedReport,"utf8"));
      report.checks.push({name:"Refuses an occupied foreign loopback service",passed:rejection.status==="FAIL"&&rejection.error==="PORT_BUSY"});
      report.occupiedPortProbe={expectedRejection:true,code:rejection.error};
    } finally { await new Promise(resolve=>occupied.close(resolve)); }
  }
  report.status=report.checks.every(check=>check.passed)?"PASS":"FAIL";
  fs.writeFileSync(output,JSON.stringify(report,null,2));
  console.log(`Native desktop smoke: ${report.status} (${report.checks.length} checks, no microphone or real system capture).`);
  if(report.status!=="PASS")process.exitCode=1;
  } catch(error) {
    fs.writeFileSync(output,JSON.stringify({status:"FAIL",error:error.message},null,2));
    console.error(`Native desktop smoke failed: ${error.message}`);
    process.exitCode=1;
  }
});
