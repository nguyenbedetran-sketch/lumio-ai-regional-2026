const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
const root = path.resolve(__dirname, '..'), cache = new Map();
let session = null;
function load(relative) {
  const filename = path.resolve(root, relative);
  if (filename === path.join(root, 'lib/lumio/auth.ts')) return { authOptions: () => ({}), providerStatus: () => ({ google: true }) };
  if (cache.has(filename)) return cache.get(filename).exports;
  const m = { exports: {} }; cache.set(filename, m);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name === 'next-auth' ? { getServerSession: async () => session } : name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts'))) : require(name), m, m.exports);
  return m.exports;
}
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lumio-paid-policy-'));
const env = { NODE_ENV: 'development', AUTH_TRUST_HOST: 'true', NEXTAUTH_URL: 'http://127.0.0.1:3000', LUMIO_AI_ENABLED: 'true', LUMIO_COMPETITION_PREVIEW: 'false', OPENAI_API_KEY: 'synthetic-key-not-real', OPENAI_MODEL: 'fixture-model', GEMINI_API_KEY: 'synthetic-key-not-real', GEMINI_MODEL: 'fixture-fallback' };
const prior = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]])); Object.assign(process.env, env);
const platform = load('lib/server/store.ts'), filename = path.join(directory, 'isolated.sqlite');
const store = platform.createStore(filename, { adminEmails: ['owner@example.test'] });
Object.assign(platform, { getStore: () => store, getUser: id => store.getUser(id), isFeatureEnabled: k => store.isFeatureEnabled(k), recordAIUsage: e => store.recordAIUsage(e) });
const db = new DatabaseSync(filename), policy = load('lib/billing/paid-policy.ts'), { routeAI } = load('lib/ai/router.ts'), { validateInput } = load('lib/ai/contracts.ts');
const { configuredPaidModelPolicy } = load('lib/server/paid-model-policy.ts');
const endpoint = load('app/api/billing/paid-policy/route.ts'), quoteEndpoint = load('app/api/billing/quote/route.ts'), legacyEndpoint = load('app/api/billing/admin/route.ts'), aiEndpoint = load('app/api/ai/route.ts');
const origin = 'http://127.0.0.1:3000';
const identity = id => store.ensureIdentity({ provider: 'google', providerAccountId: id, email: `${id}@example.test`, emailVerified: true, name: 'Synthetic ' + id });
const owner = identity('owner'), free = identity('free'), plus = identity('plus'), premium = identity('premium'), pro = identity('pro'), outsider = identity('outsider');
const login = u => session = u ? { userId: u.id, sessionVersion: u.sessionVersion, authenticatedAt: Date.now() } : null;
const grant = (u, planId) => store.adminGrant({ actorId: owner.id, sessionVersion: owner.sessionVersion, userId: u.id, requestId: crypto.randomUUID(), planId, credits: 10000, days: 7, reason: 'Isolated synthetic policy test' });
const usage = (u, patch = {}) => ({ userId: u.id, sessionVersion: u.sessionVersion, requestId: crypto.randomUUID(), task: 'chat', kind: 'text', mode: 'quick', ...patch });
const account = u => store.getBillingSnapshot(u.id, u.sessionVersion).account;
const ecode = code => error => error.code === code || error.message === code;
const request = (route, body, patch = {}) => new Request(origin + route, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'content-type': 'application/json', origin } : {}), 'x-lumio-account': session ? store.getUser(session.userId)?.storageKey || '' : '', ...(route === '/api/ai' ? { 'idempotency-key': crypto.randomUUID() } : {}), ...patch }, ...(body ? { body: JSON.stringify(body) } : {}) });
const postPolicy = (planId, config, expectedRevision = 0) => ({ planId, config, expectedRevision, reason: 'Controlled synthetic policy change' });
const financial = () => JSON.stringify(Object.fromEntries(['billing_accounts', 'billing_ledger', 'billing_reservations'].map(t => [t, db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()])));
const originalFetch = global.fetch; let transport, calls = 0, passed = 0; const tests = [];
global.fetch = async (url, options) => { calls++; return transport(String(url), options); };
async function test(name, fn) { calls = 0; transport = () => { throw new Error('Unexpected synthetic provider transport'); }; await fn(); passed++; tests.push({ name, status: 'PASS', interceptedProviderCalls: calls }); console.log('PASS ' + name); }
const textResponse = text => Response.json({ output: [{ content: [{ type: 'output_text', text }] }], usage: { input_tokens: 7, output_tokens: 4 } });
async function expectHttp(response, status, code) { assert.equal(response.status, status); const value = await response.json(); if (code) assert.equal(value.error, code); return value; }
async function main() {
  await test('Default paid proposal is centralized, bounded and has no real provider cost', () => {
    const a = policy.defaultPaidPolicy('premium'), b = policy.defaultPaidPolicy('pro');
    assert.deepEqual([a.monthlyPriceMinor, a.credits, b.monthlyPriceMinor, b.credits], [129000, 1600, 249000, 3500]);
    assert.deepEqual(a.allowedModes, ['quick', 'tutor', 'think']); assert.ok(b.allowedModes.includes('deep'));
    assert.equal(a.maxSourceCharacters, 30000); assert.equal(b.maxSourceCharacters, 100000);
    assert.equal(policy.quotePaidUsage({ planId: 'premium', revision: 0, config: a }, { task: 'chat', kind: 'text', mode: 'quick' }).providerCostMinor, null);
  });
  await test('Strict policy parser rejects model/provider overrides, unknown keys and invalid factors', () => {
    const a = policy.defaultPaidPolicy('premium');
    for (const invalid of [{ ...a, provider: 'manual' }, { ...a, model: 'expensive' }, { ...a, credits: 0 }, { ...a, modeFactorsPermille: { ...a.modeFactorsPermille, quick: 0 } }, { ...a, taskBase: { ...a.taskBase, chat: 1.2 } }, { ...a, allowedModes: ['quick', 'quick'] }]) assert.throws(() => policy.parsePaidPolicyConfig(invalid), ecode('INVALID_PAID_POLICY'));
    assert.deepEqual(policy.parsePaidPolicyConfig(a), a);
  });
  await test('Permille arithmetic rounds up source/video chunks and separates teaching tasks', () => {
    const p = { planId: 'premium', revision: 3, config: policy.defaultPaidPolicy('premium') }, quote = patch => policy.quotePaidUsage(p, { task: 'chat', kind: 'text', mode: 'quick', ...patch });
    assert.equal(quote({}).units, 2); assert.equal(quote({ mode: 'tutor' }).units, 4); assert.equal(quote({ mode: 'think' }).units, 8);
    assert.equal(quote({ sourceCharacters: 12001 }).units, 4); assert.equal(quote({ task: 'summary', kind: 'pdf' }).units, 16);
    assert.equal(quote({ task: 'summary', kind: 'video', duration: 1800 }).units, 24);
    assert.equal(quote({ task: 'summary', pricingFeature: 'teacher.lesson', sourceCharacters: 12001 }).units, 40);
    assert.throws(() => quote({ sourceCharacters: 30001 }), ecode('PAID_SOURCE_LIMIT'));
    assert.throws(() => quote({ mode: 'deep' }), ecode('PLAN_ACCESS_REQUIRED'));
    assert.equal(policy.quotePaidUsage({ planId: 'pro', revision: 0, config: policy.defaultPaidPolicy('pro') }, { task: 'chat', kind: 'text', mode: 'deep' }).units, 20);
  });
  for (const [u, p] of [[plus, 'plus'], [premium, 'premium'], [pro, 'pro']]) grant(u, p);
  account(free);
  await test('Reading proposal/admin aliases does not seed policy or mutate any wallet', () => {
    const before = financial(); const view = store.getPaidPlanPolicies(); assert.equal(view.paymentProviderConfigured, false);
    assert.equal(view.plans.length, 2); assert.equal(view.configuredAliases.length, 4); assert.ok(!JSON.stringify(view.configuredAliases).includes('fixture-model'));
    assert.equal(db.prepare('SELECT count(*) n FROM billing_paid_policies').get().n, 0); assert.equal(financial(), before);
  });
  const originalFreePlus = store.getBillingCatalog().plans.filter(p => ['free', 'plus'].includes(p.id));
  await test('Paid policy CAS changes only paid settings and audit; all financial rows and Free/Plus stay equal', () => {
    const before = financial(), config = policy.defaultPaidPolicy('premium'); config.taskBase.chat = 3;
    store.updatePaidPlanPolicy({ actorId: owner.id, sessionVersion: 1, ...postPolicy('premium', config) });
    assert.equal(financial(), before); assert.deepEqual(store.getBillingCatalog().plans.filter(p => ['free', 'plus'].includes(p.id)), originalFreePlus);
    assert.equal(store.getPaidPlanPolicies().plans[0].revision, 1); assert.equal(db.prepare("SELECT count(*) n FROM audit_events WHERE action='BILLING_PAID_POLICY_UPDATED'").get().n, 1);
    assert.throws(() => store.updatePaidPlanPolicy({ actorId: owner.id, sessionVersion: 1, ...postPolicy('premium', config) }), ecode('PAID_POLICY_CONFLICT'));
    assert.throws(() => store.updatePaidPlanPolicy({ actorId: outsider.id, sessionVersion: 1, ...postPolicy('pro', policy.defaultPaidPolicy('pro')) }), ecode('FORBIDDEN'));
    assert.throws(() => store.updatePaidPlanPolicy({ actorId: owner.id, sessionVersion: 1, ...postPolicy('free', config) }), ecode('INVALID_PAID_POLICY'));
    assert.throws(() => store.updatePaidPlanPolicy({ actorId: owner.id, sessionVersion: 1, ...postPolicy('pro', { ...policy.defaultPaidPolicy('pro'), credits: 1 }) }), ecode('PAID_PRO_INHERITANCE_REQUIRED'));
  });
  await test('Free/Plus reservations keep original rate formula, return shape and null policy snapshot', () => {
    for (const u of [free, plus]) { const hold = store.reserveUsage(usage(u, { sourceCharacters: 9999999, pricingFeature: 'teacher.lesson' })); assert.equal(hold.units, 2); assert.deepEqual(Object.keys(hold).sort(), ['balance', 'planId', 'reservationId', 'units']); assert.equal(db.prepare('SELECT pricing_snapshot_json FROM billing_reservations WHERE id=?').get(hold.reservationId).pricing_snapshot_json, null); store.failUsage({ userId: u.id, reservationId: hold.reservationId }); }
  });
  await test('Paid reservation stores immutable quote/model snapshot and settles original units after config changes', () => {
    const hold = store.reserveUsage(usage(premium, { sourceCharacters: 12001 })); assert.equal(hold.units, 6); assert.equal(hold.pricing.sourceCharacters, 12001);
    const saved = db.prepare('SELECT pricing_snapshot_json FROM billing_reservations WHERE id=?').get(hold.reservationId).pricing_snapshot_json;
    const next = { ...policy.defaultPaidPolicy('premium'), taskBase: { ...policy.defaultPaidPolicy('premium').taskBase, chat: 5 } };
    store.updatePaidPlanPolicy({ actorId: owner.id, sessionVersion: 1, ...postPolicy('premium', next, 1) });
    assert.deepEqual(store.settleUsage({ userId: premium.id, reservationId: hold.reservationId }), { status: 'settled', changed: true });
    assert.equal(store.settleUsage({ userId: premium.id, reservationId: hold.reservationId }).changed, false);
    assert.equal(db.prepare('SELECT pricing_snapshot_json FROM billing_reservations WHERE id=?').get(hold.reservationId).pricing_snapshot_json, saved);
    assert.throws(() => store.reserveUsage(usage(premium, { requestId: db.prepare('SELECT request_id FROM billing_reservations WHERE id=?').get(hold.reservationId).request_id })), ecode('BILLING_REQUEST_FINALIZED'));
  });
  await test('Paid refund is owner bound, once only, and restores held amount without repricing', () => {
    const before = account(pro).balance, hold = store.reserveUsage(usage(pro, { mode: 'deep' })); assert.equal(hold.units, 20);
    assert.throws(() => store.failUsage({ userId: premium.id, reservationId: hold.reservationId }), ecode('BILLING_RESERVATION_NOT_FOUND'));
    assert.equal(store.failUsage({ userId: pro.id, reservationId: hold.reservationId }).changed, true); assert.equal(store.failUsage({ userId: pro.id, reservationId: hold.reservationId }).changed, false); assert.equal(account(pro).balance, before);
  });
  await test('Generic client input cannot inject trusted paid model or teaching context', () => {
    const input = validateInput({ task: 'cards', source: 'An authored source.', question: 'Study it', mode: 'quick', language: 'vi', provider: 'gemini', model: 'expensive', billingModelContext: { mode: 'deep', models: [] }, teachingContext: { kind: 'lesson' } });
    assert.equal(input.billingModelContext, undefined); assert.equal(input.teachingContext, undefined); assert.equal(input.provider, undefined); assert.equal(input.model, undefined);
  });
  const rawInput = () => validateInput({ task: 'chat', source: 'An authored source.', question: 'Explain a concept', mode: 'quick', language: 'vi' });
  await test('Configured alias snapshot rejects environment model changes before any paid dispatch', async () => {
    const input = rawInput(); input.billingModelContext = configuredPaidModelPolicy('quick', 'fixture-v1');
    process.env.OPENAI_MODEL = 'changed-model'; try { await assert.rejects(routeAI(input, global.fetch, new AbortController().signal), ecode('PAID_MODEL_POLICY_CHANGED')); assert.equal(calls, 0); } finally { process.env.OPENAI_MODEL = env.OPENAI_MODEL; }
  });
  await test('A new unlisted fallback never dispatches after an existing primary failure', async () => {
    const input = rawInput(); delete process.env.GEMINI_API_KEY; input.billingModelContext = configuredPaidModelPolicy('quick', 'fixture-v1'); process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
    transport = () => Response.json({ error: { message: 'Synthetic outage' } }, { status: 500 });
    await assert.rejects(routeAI(input, global.fetch, new AbortController().signal)); assert.equal(calls, 1);
  });
  await test('An allowlisted fallback retains existing bounded routing without additional policy charge', async () => {
    const input = rawInput(); input.billingModelContext = configuredPaidModelPolicy('quick', 'fixture-v1');
    transport = url => url.includes('openai') ? Response.json({ error: {} }, { status: 500 }) : Response.json({ candidates: [{ content: { parts: [{ text: 'A concise synthetic explanation.' }] } }] });
    const result = await routeAI(input, global.fetch, new AbortController().signal); assert.match(result.text, /synthetic/); assert.equal(calls, 2);
  });
  await test('Admin policy API enforces guest, recent authentication, canonical account and origin', async () => {
    login(null); await expectHttp(await endpoint.GET(request('/api/billing/paid-policy')), 401, 'SIGN_IN_REQUIRED');
    login(outsider); await expectHttp(await endpoint.GET(request('/api/billing/paid-policy')), 403, 'FORBIDDEN');
    login(owner); session.authenticatedAt = 1; await expectHttp(await endpoint.GET(request('/api/billing/paid-policy')), 401, 'ADMIN_REAUTH_REQUIRED');
    login(owner); await expectHttp(await endpoint.GET(request('/api/billing/paid-policy', null, { 'x-lumio-account': outsider.storageKey })), 401, 'SESSION_REVOKED');
    await expectHttp(await endpoint.POST(request('/api/billing/paid-policy', postPolicy('pro', policy.defaultPaidPolicy('pro')), { origin: 'https://untrusted.example' })), 403, 'INVALID_ORIGIN');
    await expectHttp(await endpoint.GET(request('/api/billing/paid-policy')), 200);
  });
  await test('Quote endpoint is account-bound and read-only, and rejects forged price/model fields', async () => {
    login(premium); const before = financial(); const response = await quoteEndpoint.POST(request('/api/billing/quote', { task: 'chat', mode: 'quick', kind: 'text', sourceCharacters: 12001 }));
    const body = await expectHttp(response, 200); assert.equal(body.quote.units, 10); assert.equal(body.changesBalance, false); assert.equal(body.providerCostKnown, false); assert.equal(financial(), before);
    await expectHttp(await quoteEndpoint.POST(request('/api/billing/quote', { task: 'chat', kind: 'text', model: 'expensive' })), 400, 'INVALID_BILLING_USAGE');
    await expectHttp(await quoteEndpoint.POST(request('/api/billing/quote', { task: 'chat', kind: 'text' }, { 'x-lumio-account': pro.storageKey })), 401, 'SESSION_REVOKED');
    login(free); await expectHttp(await quoteEndpoint.POST(request('/api/billing/quote', { task: 'chat', kind: 'text' })), 403, 'PAID_PLAN_REQUIRED');
  });
  await test('Actual learner handler measures source text instead of forged quote/sourceCharacters', async () => {
    const u = identity('handler'); grant(u, 'premium'); login(u); const before = account(u).balance;
    transport = () => textResponse(JSON.stringify({ cards: [{ front: 'What is stated?', back: 'An authored learning fact.' }] }));
    const source = 'An authored learning fact. '.repeat(800), response = await aiEndpoint.POST(request('/api/ai', { task: 'cards', source, question: 'Study this source', mode: 'quick', language: 'vi', sourceCharacters: 0, quotedUnits: 0, model: 'expensive', planId: 'pro' }));
    const body = await expectHttp(response, 200); assert.ok(body.cards); assert.equal(calls, 1);
    const row = db.prepare('SELECT units,pricing_snapshot_json FROM billing_reservations WHERE user_id=? ORDER BY rowid DESC LIMIT 1').get(u.id), snapshot = JSON.parse(row.pricing_snapshot_json);
    assert.equal(snapshot.sourceCharacters, source.length); assert.equal(snapshot.usageChunks, 2); assert.equal(row.units, 12); assert.equal(account(u).balance, before - 12);
  });
  await test('Actual learner handler refuses Premium deep before transport and keeps plan unchanged', async () => {
    const u = identity('premium-deep'); grant(u, 'premium'); login(u); const before = account(u).balance;
    await expectHttp(await aiEndpoint.POST(request('/api/ai', { task: 'cards', source: 'An authored source.', question: 'Study', mode: 'deep', language: 'vi' })), 403, 'PLAN_ACCESS_REQUIRED');
    assert.equal(calls, 0); assert.equal(account(u).balance, before); assert.equal(account(u).planId, 'premium');
  });
  await test('Actual Pro learner deep uses configured server alias and exact quoted units', async () => {
    const u = identity('pro-deep'); grant(u, 'pro'); login(u); const before = account(u).balance;
    transport = (_url, options) => { assert.equal(JSON.parse(options.body).model, 'fixture-model'); return textResponse(JSON.stringify({ cards: [{ front: 'What is stated?', back: 'An authored learning fact.' }] })); };
    await expectHttp(await aiEndpoint.POST(request('/api/ai', { task: 'cards', source: 'An authored learning fact.', question: 'Study', mode: 'deep', language: 'vi' })), 200);
    assert.equal(calls, 1); assert.equal(account(u).balance, before - 60);
  });
  await test('Genuine schema19 upgrade preserves existing account/ledger/reservation fields and creates no grants', () => {
    const previousFile = path.join(directory, 'genuine19.sqlite'), previous = new DatabaseSync(previousFile);
    previous.exec('PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    for (const migration of load('lib/server/schema.ts').migrations.filter(m => m.version <= 19)) { previous.exec(migration.sql); previous.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(migration.version, '2026-10-17T00:00:00.000Z'); }
    const copy = table => { const columns = previous.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name); const rows = db.prepare(`SELECT ${columns.join(',')} FROM ${table} ORDER BY rowid`).all(); for (const row of rows) previous.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`).run(...columns.map(c => row[c])); return JSON.stringify(rows); };
    copy('users'); const before = Object.fromEntries(['billing_accounts', 'billing_reservations', 'billing_ledger'].map(t => [t, copy(t)]));
    const legacyColumns = Object.fromEntries(Object.keys(before).map(t => [t, previous.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name)])); previous.close();
    const upgraded = platform.createStore(previousFile); upgraded.close(); const check = new DatabaseSync(previousFile);
    try { for (const [table, content] of Object.entries(before)) assert.equal(JSON.stringify(check.prepare(`SELECT ${legacyColumns[table].join(',')} FROM ${table} ORDER BY rowid`).all()), content); assert.equal(check.prepare('SELECT count(*) n FROM billing_paid_policies').get().n, 0); assert.equal(check.prepare('SELECT count(*) n FROM billing_reservations WHERE pricing_snapshot_json IS NOT NULL').get().n, 0); assert.equal(check.prepare('SELECT max(version) v FROM schema_migrations').get().v, 20); } finally { check.close(); }
  });
  await test('Paid proposal never enables checkout, renewals or teacher/class authority', () => {
    const catalog = store.getBillingCatalog(); assert.ok(catalog.plans.every(p => !p.checkoutAvailable)); assert.equal(catalog.paymentProviderConfigured, false);
    assert.equal(account(pro).autoRenewEnabled, false); assert.equal(store.readTeacherApplication(pro.id, pro.sessionVersion).credential.active, false);
  });
  await test('Legacy catalog HTTP cannot bypass paid strict bounds, Pro inheritance or revision/reason CAS', async () => {
    login(owner); const before = financial(), policies = store.getPaidPlanPolicies(), catalog = store.getBillingCatalog();
    for (const [itemId, credits] of [['premium', 1000000000], ['pro', 1], ['premium', 1600]]) await expectHttp(await legacyEndpoint.POST(request('/api/billing/admin', { action: 'catalog_update', itemId, credits, monthlyPriceMinor: 129000, yearlyPriceMinor: 1290000 })), 409, 'PAID_POLICY_REQUIRED');
    assert.equal(financial(), before); assert.deepEqual(store.getPaidPlanPolicies(), policies); assert.deepEqual(store.getBillingCatalog(), catalog);
    await expectHttp(await legacyEndpoint.POST(request('/api/billing/admin', { action: 'catalog_update', itemId: 'plus', credits: 1000000000, monthlyPriceMinor: 59000, yearlyPriceMinor: 590000 })), 200);
    assert.equal(store.getBillingCatalog().plans.find(p => p.id === 'plus').credits, 1000000000); assert.equal(financial(), before);
  });
  await test('Out-of-range historical paid catalog overlay fails closed rather than becoming a trusted policy', () => {
    const original = db.prepare("SELECT credits FROM billing_catalog_settings WHERE item_id='premium'").get().credits;
    db.prepare("UPDATE billing_catalog_settings SET credits=1000000000 WHERE item_id='premium'").run();
    try { assert.throws(() => store.getPaidPlanPolicies(), ecode('PAID_POLICY_UNAVAILABLE')); assert.throws(() => store.getPaidUsageQuote(premium.id, premium.sessionVersion, { task: 'chat', kind: 'text', mode: 'quick' }), ecode('PAID_POLICY_UNAVAILABLE')); }
    finally { db.prepare("UPDATE billing_catalog_settings SET credits=? WHERE item_id='premium'").run(original); }
  });
  const output = path.join(root, 'docs/next/reports/paid-plans'); fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'backend.json'), JSON.stringify({ generatedAt: new Date().toISOString(), status: 'PASS', passed, scope: 'Actual temporary SQLite, shared quote policy, actual route guards/router; synthetic identities/session boundary and intercepted transport only.', realProviderCalls: 0, realPayments: 0, tests, limitations: ['No merchant, payment lifecycle, actual provider pricing/invoice/profit or paid entitlement sale.', 'No real user migration; source-only migration20 is independently covered by focused fixture checks.', 'Teacher permissions are independent of paid plans.'] }, null, 2) + '\n');
  console.log(`\n${passed} paid policy checks PASS; no real provider/payment/user database.`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; db.close(); store.close(); for (const [k, v] of Object.entries(prior)) v === undefined ? delete process.env[k] : process.env[k] = v; fs.rmSync(directory, { recursive: true, force: true }); });
