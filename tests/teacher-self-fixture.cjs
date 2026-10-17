// Actual TeacherPortal and CSS in an intercepted fixture. No product auth/test route.
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), folder = path.join(root, 'work/teacher-self-ui');
function build() {
  fs.mkdirSync(folder,{recursive:true});
  const nodeCache=new Map();
  function load(filename) {
    filename=path.resolve(root,filename);
    if(nodeCache.has(filename))return nodeCache.get(filename).exports;
    const m={exports:{}};nodeCache.set(filename,m);
    const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    new Function('require','module','exports',output)(name=>{
      if(name==='next-auth/react')return {signIn:async()=>undefined};
      if(!name.startsWith('.'))return require(name);
      const base=path.resolve(path.dirname(filename),name);
      return load([base+'.ts',base+'.tsx',base+'.js'].find(fs.existsSync));
    },m,m.exports);return m.exports;
  }
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{TeacherPortal}=load('components/teachers/portal.tsx');
  const guest=renderToStaticMarkup(React.createElement(TeacherPortal,{account:null,providers:{google:true,facebook:true}}));
  assert.ok(guest.includes('Đăng nhập với Google')&&guest.includes('Đăng nhập với Facebook'));
  assert.ok(!guest.includes('<form'));
  const storageNotice=guest.match(/<p class="tp-footnote">([\s\S]*?)<\/p>/)?.[1];
  assert.ok(storageNotice?.includes('cấu hình cơ sở dữ liệu máy chủ'));
  assert.ok(!/Hồ sơ máy chủ có thể mất khi|không bao giờ mất|lưu trữ vĩnh viễn/.test(storageNotice));
  const signed=renderToStaticMarkup(React.createElement(TeacherPortal,{account:{key:'synthetic-teacher-self-a',name:'QA · NGƯỜI GIẢNG DẠY TỔNG HỢP'},providers:{google:true,facebook:true}}));
  assert.ok(signed.includes('<form')&&signed.includes('<fieldset disabled'));
  assert.ok(!signed.includes('QA PRIVATE SERVER PROFILE'));
  const modules=[],ids=new Map();
  function bundle(filename) {
    if(ids.has(filename))return ids.get(filename);
    const id=modules.length;ids.set(filename,id);modules.push('');
    let source=fs.readFileSync(filename,'utf8');
    if(/\.tsx?$/.test(filename))source=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    source=source.replace(/require\((["'])([^"']+)\1\)/g,(_all,_quote,name)=>{
      if(name==='next-auth/react')return '({signIn:async(...args)=>{window.__teacherSignIns.push(args);}})';
      let target;
      if(name.startsWith('.')){const base=path.resolve(path.dirname(filename),name);target=[base,base+'.ts',base+'.tsx',base+'.js'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());}
      else target=require.resolve(name,{paths:[path.dirname(filename)]});
      if(!target)throw Error('FIXTURE_MODULE_MISSING');return `__require(${bundle(target)})`;
    });modules[id]=`function(module,exports,__require){${source}\n}`;return id;
  }
  const react=bundle(require.resolve('react')),client=bundle(require.resolve('react-dom/client')),portal=bundle(path.join(root,'components/teachers/portal.tsx'));
  fs.writeFileSync(path.join(folder,'fixture.js'),`(function(){"use strict";const process={env:{NODE_ENV:"production"}},modules=[${modules.join(',')}],cache={};function __require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,__require);return m.exports;}const React=__require(${react}),{createRoot}=__require(${client}),{TeacherPortal}=__require(${portal}),root=createRoot(document.getElementById('root'));window.__teacherSignIns=[];let renderKey=0;window.__mountTeacherSelf=function(account=null,providers={google:true,facebook:true},remount=true){if(remount)renderKey++;root.render(React.createElement(TeacherPortal,{key:renderKey,account,providers}));};window.__mountTeacherSelf();})();`);
  const layout=fs.readFileSync(path.join(root,'app/layout.tsx'),'utf8');
  const css=[...layout.matchAll(/import "\.\/([^"\n]+\.css)"/g)].map(m=>fs.readFileSync(path.join(root,'app',m[1]),'utf8')).join('\n')+'\n'+fs.readFileSync(path.join(root,'app/teacher/teacher.css'),'utf8');
  fs.writeFileSync(path.join(folder,'fixture.css'),css);
  fs.writeFileSync(path.join(folder,'fixture.html'),'<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teacher self · Synthetic UI verification</title><link rel="stylesheet" href="/__teacher-self-fixture.css"><body style="margin:0"><div style="padding:10px 18px;background:#214438;color:#cbf3dc;font:12px system-ui">KIỂM THỬ UI · Hồ sơ tổng hợp · Không phải giáo viên thật</div><div id="root"></div><script src="/__teacher-self-fixture.js"></script></body></html>');
  return {unitChecks:6,folder};
}
module.exports={build};
if(require.main===module)console.log(JSON.stringify({status:'PASS',...build()}));
