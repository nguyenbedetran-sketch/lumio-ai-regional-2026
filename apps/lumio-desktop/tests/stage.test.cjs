"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

test("staging rejects environment variants before replacing a previously verified bundle",()=>{
  const fixture=fs.mkdtempSync(path.join(__dirname,"stage-guard-"));
  const scripts=path.join(fixture,"scripts");
  const web=path.join(fixture,"web");
  const sentinel=path.join(fixture,"bundle","verified-bundle.txt");
  try {
    fs.mkdirSync(scripts,{recursive:true});
    fs.copyFileSync(path.join(__dirname,"../scripts/stage.cjs"),path.join(scripts,"stage.cjs"));
    fs.mkdirSync(path.join(web,".next","standalone"),{recursive:true});
    fs.writeFileSync(path.join(web,".next","standalone","server.js"),"// inert clean-build fixture\n");
    fs.mkdirSync(path.dirname(sentinel),{recursive:true});
    fs.writeFileSync(sentinel,"verified runtime remains intact");
    for(const name of [".env",".env.local",".env.production",".env.production.local"]) {
      const envFile=path.join(web,name);
      fs.writeFileSync(envFile,"DEMO=not-an-api-key\n");
      const result=spawnSync(process.execPath,[path.join(scripts,"stage.cjs"),`--web=${web}`,`--node=${process.execPath}`],{encoding:"utf8",windowsHide:true,env:{SystemRoot:process.env.SystemRoot||process.env.SYSTEMROOT||"C:\\Windows"}});
      assert.notEqual(result.status,0,name);
      assert.match(result.stderr,/Refusing to stage a source with environment files/,name);
      assert.equal(fs.readFileSync(sentinel,"utf8"),"verified runtime remains intact",name);
      fs.unlinkSync(envFile);
    }
  } finally {
    assert.equal(path.dirname(path.resolve(fixture)),path.resolve(__dirname));
    assert.match(path.basename(fixture),/^stage-guard-/);
    fs.rmSync(fixture,{recursive:true,force:true});
  }
});
