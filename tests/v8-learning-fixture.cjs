// Actual learning components in an intercepted, synthetic-only browser fixture.
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const root = path.resolve(__dirname, ".."),
  folder = path.join(root, "work/v8-learning-ui");
function build() {
  fs.mkdirSync(folder, { recursive: true });
  const modules = [],
    ids = new Map(),
    moduleCSS = [];
  function bundle(filename) {
    if (ids.has(filename)) return ids.get(filename);
    const id = modules.length;
    ids.set(filename, id);
    modules.push("");
    let source = fs.readFileSync(filename, "utf8");
    if (filename.endsWith(".module.css")) {
      source = source.replace(/:global\(([^)]+)\)/g, "$1");
      const names = [
        ...new Set(
          [...source.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]),
        ),
      ];
      const styles = Object.fromEntries(
        names.map((name) => [name, "v8-module-" + id + "-" + name]),
      );
      moduleCSS.push(
        source.replace(
          /\.([a-zA-Z_][\w-]*)/g,
          (_m, name) => "." + styles[name],
        ),
      );
      modules[id] =
        `function(module){module.exports=${JSON.stringify(styles)}}`;
      return id;
    }
    if (/\.tsx?$/.test(filename))
      source = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      }).outputText;
    source = source.replace(
      /require\((["'])([^"']+)\1\)/g,
      (_all, _q, name) => {
        let target;
        if (name.startsWith(".")) {
          const base = path.resolve(path.dirname(filename), name);
          target = [base, base + ".ts", base + ".tsx", base + ".js"].find(
            (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
          );
        } else
          target = require.resolve(name, { paths: [path.dirname(filename)] });
        if (!target) throw Error("FIXTURE_MODULE_MISSING:" + name);
        return `__require(${bundle(target)})`;
      },
    );
    modules[id] = `function(module,exports,__require){${source}\n}`;
    return id;
  }
  const react = bundle(require.resolve("react")),
    client = bundle(require.resolve("react-dom/client")),
    plan = bundle(path.join(root, "components/lumio/learning-plan.tsx")),
    skills = bundle(path.join(root, "components/lumio/skill-evidence.tsx")),
    review = bundle(path.join(root, "components/lumio/review.tsx")),
    evidence = bundle(path.join(root, "lib/lumio/skill-evidence.ts")),
    engine = bundle(path.join(root, "lib/lumio/learning-engine.ts")),
    hook = bundle(path.join(root, "components/lumio/use-learning.ts"));
  const entry = `const React=__require(${react}),{createRoot}=__require(${client}),{DailyLearningPlan}=__require(${plan}),{SkillEvidencePanel}=__require(${skills}),{Review}=__require(${review}),E=__require(${engine}),S=__require(${evidence}),{useLearning}=__require(${hook});
const stamp=new Date().toISOString(),base=(id,title)=>({id,title,kind:'text',spaceId:'',createdAt:stamp,updatedAt:stamp,text:'Tài liệu tổng hợp để kiểm thử giao diện, không phải dữ liệu người học thật.',notes:'',cards:[],questions:[],attempts:[],favorite:false});
const questions=[1,2].map(n=>({id:'qa-q'+n,prompt:'Giải phương trình x + '+n+' = 5',options:['1','2','3','4'],correct:n===1?3:2,explanation:'Trừ cùng một số ở hai vế.',topic:'Phương trình bậc nhất',difficulty:'beginner'}));
const a={date:stamp,score:0,total:2,answers:questions.map(q=>({questionId:q.id,selected:0,correct:false,topic:q.topic})),skillEvidence:S.createSkillEvidence(questions,[0,0],[],'qa-attempt-weak')};
const math={...base('qa-math','KIỂM THỬ · Phương trình bậc nhất'),questions,attempts:[a]},cards={...base('qa-cards','KIỂM THỬ · Phân số cần ôn'),cards:[{id:'new',front:'Thẻ mới chưa ôn',back:'Nội dung tổng hợp'},{id:'due',front:'Tính một phần hai cộng một phần hai',back:'Kết quả bằng một.'}]},third=base('qa-read','KIỂM THỬ · Khoa học quanh ta'),initialItems=[math,cards,third];
const initialLearning={...E.emptyLearning(),reviews:[E.scheduleReview(undefined,'again',{itemId:cards.id,cardId:'due',fingerprint:E.cardFingerprint(cards.cards[1].front,cards.cards[1].back)},new Date(Date.now()-86400000))]};
localStorage.setItem(E.learningKey('qa-review-fault'),JSON.stringify(initialLearning));function FaultReview(){const learning=useLearning('qa-review-fault');React.useEffect(()=>{window.__v8FaultData={state:learning.state,error:learning.error};},[learning.state,learning.error]);return learning.ready?React.createElement(Review,{items:initialItems,state:learning.state,update:learning.update,locale:'vi',library:()=>{},open:()=>{},storageError:!!learning.error}):null;}window.__v8Root=createRoot(document.getElementById('root'));function App({account}){const [items,setItems]=React.useState(account==='a'?initialItems:[]),[learning,setLearning]=React.useState(account==='a'?initialLearning:E.emptyLearning()),[preferences,setPreferences]=React.useState({version:1,enabled:true,feedback:[]}),[tab,setTab]=React.useState('plan'),[locale,setLocale]=React.useState('vi');React.useEffect(()=>{window.__v8Data={items,learning,preferences,account};},[items,learning,preferences,account]);return React.createElement('main',{style:{maxWidth:1100,margin:'0 auto',padding:16}},React.createElement('p',{className:'lm-help'},'KIỂM THỬ UI · Dữ liệu tổng hợp · Không phải kết quả học sinh thật'),React.createElement('nav',{style:{display:'flex',gap:10,flexWrap:'wrap'}},...['plan','evidence','review','fault-review'].map(name=>React.createElement('button',{key:name,className:'lm-button','data-qa-tab':name,onClick:()=>setTab(name)},name)),React.createElement('select',{'aria-label':'Ngôn ngữ kiểm thử',value:locale,onChange:e=>setLocale(e.target.value)},...['vi','en','zh-CN','ja','ko'].map(l=>React.createElement('option',{key:l,value:l},l)))),tab==='plan'?React.createElement(DailyLearningPlan,{items,learning,preferences,locale,open:i=>window.__v8Opened=i.id,onReview:()=>setTab('review'),onPreferences:setPreferences}):tab==='evidence'?React.createElement(SkillEvidencePanel,{items,preferences,update:setPreferences,locale,open:i=>window.__v8Opened=i.id,storageError:false,onClearSkillEvidence:()=>{if(window.__v8ClearFail){window.__v8ClearFailed=true;return;}setItems(old=>S.stripSkillEvidence(old));}}):tab==='fault-review'?React.createElement(FaultReview):React.createElement(Review,{items,state:learning,update:setLearning,locale,library:()=>setTab('plan'),open:i=>window.__v8Opened=i.id}));}window.__switchV8Account=account=>window.__v8Root.render(React.createElement(App,{key:account,account}));window.__switchV8Account('a');`;
  fs.writeFileSync(
    path.join(folder, "fixture.js"),
    `(()=>{const process={env:{NODE_ENV:'production'}},modules=[${modules.join(",")}],cache={};function __require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,__require);return m.exports;}${entry}})();`,
  );
  const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8"),
    css = [...layout.matchAll(/import "([^"\n]+\.css)"/g)].map((m) =>
      m[1].startsWith("./")
        ? path.join(root, "app", m[1])
        : require.resolve(m[1]),
    );
  fs.writeFileSync(
    path.join(folder, "fixture.css"),
    css.map((f) => fs.readFileSync(f, "utf8")).join("\n") +
      "\n" +
      moduleCSS.join("\n"),
  );
  fs.writeFileSync(
    path.join(folder, "fixture.html"),
    '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumio V8 learning · Synthetic fixture</title><link rel="stylesheet" href="/fixture.css"><body style="margin:0"><div id="root"></div><script src="/fixture.js"></script></body></html>',
  );
  return { folder };
}
module.exports = { build };
