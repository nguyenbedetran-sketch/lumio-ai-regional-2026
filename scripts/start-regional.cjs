// Explicit free-host competition preview, never an assertion of durable storage.
const {spawn} = require('node:child_process');
const {resolve} = require('node:path');
function stop(reason) { console.error('Regional preview refused: '+reason);process.exit(1); }
if (process.env.LUMIO_COMPETITION_PREVIEW !== 'true') stop('explicit preview flag required');
if (process.env.LUMIO_PUBLIC_DEMO === 'true' || process.env.LUMIO_DESKTOP === 'true') stop('conflicting runtime modes');
delete process.env.AUTH_TRUST_HOST;
delete process.env.LUMIO_DEV_ORIGIN_SELECTION;
if (process.env.LUMIO_AI_ENABLED !== 'true') stop('AI must be configured for the regional entry');
if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length<32) stop('authentication secret missing');
let origin;
try { origin=new URL(process.env.NEXTAUTH_URL); } catch {stop('valid HTTPS origin required');}
if (origin.protocol!=='https:' || origin.username || origin.password || origin.pathname!=='/' || origin.search || origin.hash) stop('valid HTTPS origin required');
if (!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)) stop('Google sign-in configuration missing');
if (!(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL && process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL)) stop('core tutor and document services missing');
const port=Number(process.env.PORT||3000);
if (!Number.isSafeInteger(port) || port<1024 || port>65535) stop('invalid port');
// Do not silently enable the durable-production override on an ephemeral host.
process.env.LUMIO_ALLOW_LOCAL_DB_PRODUCTION='false';
process.env.LUMIO_DB_PATH ||= resolve(process.cwd(),'.data','regional-preview.sqlite');
console.log(process.env.LUMIO_DATABASE_MODE === 'remote-libsql'
  ? 'Lumio regional competition preview. Remote database configured; readiness is checked by the server. Free hosting may sleep. Payments disabled.'
  : 'Lumio regional competition preview. Server accounts/credits/tutor sessions may reset on free-host restart. Payments disabled.');
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','0.0.0.0','--port',String(port)],{cwd:process.cwd(),env:process.env,stdio:'inherit',windowsHide:true});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>child.kill(signal));
child.on('error',()=>stop('server could not start'));
child.on('exit',(code)=>process.exit(code??1));
