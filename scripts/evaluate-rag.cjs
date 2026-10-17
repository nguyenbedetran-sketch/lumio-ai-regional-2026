/* --offline exercises current production selection without network or credentials.
 * --live retains the historical bounded paid evaluator; it is not run offline. */
if (process.argv.includes('--offline')) {
  try { require('./rag-offline-evaluation.cjs').main(process.argv.slice(2)); }
  catch (error) { console.error(error); process.exitCode = 1; }
  return;
}
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),output=path.join(root,'docs/regional/rag-live-evaluation.json'),vectorsOutput=path.join(root,'docs/regional/rag-live-vectors.json');
if(!process.argv.includes('--live')){console.log('No provider call made. Run node scripts/evaluate-rag.cjs --offline for current production selection, or --live for the historical bounded paid evaluation.');process.exit(0);}
if(fs.existsSync(output)){console.error('Evaluation report already exists. Refusing to overwrite/repeat paid requests.');process.exit(1);}
for(const key of ['OPENAI_API_KEY','OPENAI_EMBEDDING_MODEL','LUMIO_EMBEDDINGS_ENABLED'])delete process.env[key];
const env=fs.readFileSync(path.join(root,'.env.local'),'utf8');for(const line of env.split(/\r?\n/)){const match=/^(OPENAI_API_KEY|OPENAI_EMBEDDING_MODEL)=(.*)$/.exec(line);if(match)process.env[match[1]]=match[2].trim().replace(/^(['"])(.*)\1$/,'$2');}
process.env.LUMIO_EMBEDDINGS_ENABLED='true';
const {load}=require('../tests/source-grounding.cjs'),{embedTexts}=load('lib/rag/embeddings.ts'),{lexicalRank,cosine,hybridRank}=load('lib/rag/retrieval.ts');
const corpus=[
 {id:'equation',text:'To isolate an unknown in a linear equation, perform the same operation on both sides. When dividing, the divisor must be nonzero.'},
 {id:'triangle',text:'A right triangle with perpendicular legs 6 cm and 8 cm has a hypotenuse of 10 cm. Its area is 24 square centimetres.'},
 {id:'plants',text:'Green plants use sunlight to turn water and carbon dioxide into sugars through photosynthesis. Oxygen is released during this process.'},
 {id:'recall',text:'Difficult flashcards should be reviewed sooner. After successful recall, space later reviews farther apart to practise long-term memory.'},
 {id:'boiling-a',text:'The recorded boiling temperature = 100 degrees. This is an authored example of one laboratory table.'},
 {id:'boiling-b',text:'The recorded boiling temperature = 90 degrees. This is an authored example of another laboratory table.'},
];
const queries=[
 {text:'nonzero divisor',expected:['equation']},
 {text:'How can I keep both expressions equal while solving for an unknown?',expected:['equation']},
 {text:'How do leaves make their own food?',expected:['plants']},
 {text:'What is the longest edge when the perpendicular sides are 6 and 8?',expected:['triangle']},
 {text:'I forget a card repeatedly. When should it return?',expected:['recall']},
 {text:'recorded boiling temperature',expected:['boiling-a','boiling-b']},
 {text:'Who won the football world cup in 1998?',expected:[]},
];
const report={startedAt:new Date().toISOString(),status:'RUNNING',requests:0,maxRequests:4,scope:'Authored six-chunk corpus and seven authored retrieval questions, no student data or OAuth. Retrieval ranking only; not generated-answer or learning-outcome accuracy.',configuration:{dimensions:256,semanticThreshold:0.35,rrfK:60,topK:3,promptVersion:'rag-embedding-v1'},queries:[]};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
const transport=async(url,init)=>{assert.equal(String(url),'https://api.openai.com/v1/embeddings');if(report.requests>=report.maxRequests)throw Error('REQUEST_BUDGET_EXHAUSTED');report.requests++;save();return fetch(url,init);};
async function main(){try{
 const start=Date.now(),docs=await embedTexts(corpus.map(d=>d.text),transport),questions=await embedTexts(queries.map(q=>q.text),transport);report.model=docs.model;report.latencyMs=Date.now()-start;report.tokens=(docs.totalTokens||0)+(questions.totalTokens||0);
 fs.writeFileSync(vectorsOutput,JSON.stringify({model:docs.model,dimensions:256,source:'Actual provider responses for authored fixtures; no synthetic vectors.',corpus:corpus.map((d,i)=>({...d,vector:docs.vectors[i]})),queries:queries.map((q,i)=>({...q,vector:questions.vectors[i]}))},null,2));
 const rows=corpus.map((d,i)=>({id:'s'+(i+1),text:d.text,start:0,end:d.text.length,paragraph:1,chunkId:d.id,documentId:d.id,documentTitle:d.id,documentDigest:'authored-fixture',documentRevision:1,score:0}));
 for(let i=0;i<queries.length;i++){const query=queries[i],lexical=lexicalRank(rows,query.text),semantic=rows.map((r,j)=>({...r,score:cosine(docs.vectors[j],questions.vectors[i])})).filter(r=>r.score>=0.35).sort((a,b)=>b.score-a.score),hybrid=hybridRank(lexical,semantic);const result={question:query.text,expected:query.expected,lexical:lexical.slice(0,3).map(r=>r.chunkId),semantic:semantic.slice(0,3).map(r=>({id:r.chunkId,score:r.score})),hybrid:hybrid.slice(0,3).map(r=>r.chunkId)};report.queries.push(result);}
 const answerable=report.queries.filter(q=>q.expected.length),metrics={};for(const mode of ['lexical','hybrid']){let recall=0,mrr=0;for(const q of answerable){const ranked=q[mode];recall+=q.expected.filter(id=>ranked.includes(id)).length/q.expected.length;const rank=ranked.findIndex(id=>q.expected.includes(id));mrr+=rank<0?0:1/(rank+1);}metrics[mode]={recallAt3:recall/answerable.length,mrrAt3:mrr/answerable.length,outOfCorpusFalsePositiveQueries:report.queries.filter(q=>!q.expected.length&&q[mode].length).length};}report.metrics=metrics;report.status='PARTIAL';report.limitations=['Small authored corpus; not a school-scale or teacher-reviewed benchmark.','The cosine threshold 0.35 is an initial heuristic, not calibrated confidence.','Hybrid can retrieve excerpts that do not contain an answer; retrieved excerpts must still be checked by the tutor and learner.','No claim about provider invoice cost, full-document comprehension, or student outcomes.','No vector database added; bounded in-process ranking over owner-scoped SQLite chunks.'];report.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,requests:report.requests,model:report.model,metrics:report.metrics,report:path.relative(root,output)}));
 }catch(e){report.status='FAIL';report.error=e.code||String(e.message).replace(/(?:sk-proj-|xai-)[A-Za-z0-9_-]+/g,'[redacted]').slice(0,300);save();console.error(JSON.stringify({status:report.status,requests:report.requests,error:report.error}));process.exitCode=1;}}
main();
