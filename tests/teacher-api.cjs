// Actual handlers, canonical policy and isolated SQLite. No OAuth/network/real teacher PII.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  ts = require("typescript"),
  { DatabaseSync } = require("node:sqlite");
const root = path.resolve(__dirname, ".."),
  cache = new Map(),
  cases = [];
const originalFetch = global.fetch,
  networkCalls = [];
global.fetch = async (...args) => {
  networkCalls.push(String(args[0]));
  throw Error("UNEXPECTED_NETWORK_IN_TEACHER_TEST");
};
let session = null,
  clock = Date.now();
function load(relative) {
  const file = path.resolve(root, relative);
  if (file === path.resolve(root, "lib/lumio/auth.ts"))
    return { authOptions: () => ({}) };
  if (cache.has(file)) return cache.get(file).exports;
  const m = { exports: {} };
  cache.set(file, m);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name === "next-auth"
        ? { getServerSession: async () => session }
        : name.startsWith(".")
          ? load(
              path.relative(
                root,
                path.resolve(path.dirname(file), name + ".ts"),
              ),
            )
          : require(name),
    m,
    m.exports,
  );
  return m.exports;
}
const env = {
    NODE_ENV: "development",
    AUTH_TRUST_HOST: "true",
    NEXTAUTH_URL: "http://127.0.0.1:3000",
  },
  saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
Object.assign(process.env, env);
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "lumio-teacher-api-")),
  file = path.join(folder, "isolated.sqlite");
const platform = load("lib/server/store.ts"),
  store = platform.createStore(file, {
    adminEmails: ["teacher-admin@example.test"],
    now: () => clock,
  }),
  db = new DatabaseSync(file);
Object.assign(platform, {
  getStore: () => store,
  getUser: (id) => store.getUser(id),
});
const own = load("app/api/teacher-application/route.ts"),
  admin = load("app/api/admin/teachers/route.ts"),
  policy = load("lib/server/policy.ts"),
  contracts = load("lib/teachers/contracts.ts");
const origin = "http://127.0.0.1:3000";
const user = (name, overrides = {}) =>
  store.ensureIdentity({
    provider: "google",
    providerAccountId: "teacher-test-" + name,
    name: "Synthetic account " + name,
    email: name + "@example.test",
    emailVerified: false,
    ...overrides,
  });
const owner = user("owner", {
    email: "teacher-admin@example.test",
    emailVerified: true,
  }),
  ordinary = user("ordinary"),
  dev = user("dev"),
  regularAdmin = user("regular-admin");
db.prepare("UPDATE users SET role='DEV' WHERE id=?").run(dev.id);
db.prepare("UPDATE users SET role='ADMIN' WHERE id=?").run(regularAdmin.id);
const profile = (extra = {}) => ({
  applicantName: "Synthetic teacher declaration",
  countryCode: "VN",
  country: "Việt Nam",
  provinceCity: "Tỉnh kiểm thử",
  ward: "Phường kiểm thử",
  school: "Synthetic school",
  teachingLevel: "lower_secondary",
  subjects: ["Toán"],
  teacherDeclaration: true,
  storageConsent: true,
  ...extra,
});
const submit = (
  p = profile(),
  expectedRevision = 0,
  requestId = crypto.randomUUID(),
) => ({ requestId, expectedRevision, profile: p });
const review = (application, action = "approve", extra = {}) => ({
  applicationId: application.id,
  expectedRevision: application.revision,
  action,
  note: "Synthetic manual review note",
  requestId: crypto.randomUUID(),
  ...extra,
});
function request(actor, method = "GET", body, options = {}) {
  session = actor
    ? {
        userId: actor.id,
        sessionVersion: actor.sessionVersion,
        authenticatedAt: Date.now(),
        ...options.session,
      }
    : null;
  return new Request(
    origin +
      (options.admin ? "/api/admin/teachers" : "/api/teacher-application") +
      (options.query || ""),
    {
      method,
      headers: {
        ...(actor ? { "x-lumio-account": actor.storageKey } : {}),
        ...(method !== "GET"
          ? { "content-type": "application/json", origin }
          : {}),
        ...options.headers,
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === "string" ? body : JSON.stringify(body) }),
    },
  );
}
async function response(r, status = 200, code) {
  assert.equal(r.status, status);
  assert.match(r.headers.get("cache-control"), /no-store/);
  const v = await r.json();
  if (code) {
    assert.equal(v.error, code);
    for (const k of [
      "stack",
      "sql",
      "profile",
      "userId",
      "email",
      "cookie",
      "accessToken",
    ])
      assert.equal(v[k], undefined);
  }
  return v;
}
const read = (actor) => own.GET(request(actor));
const post = (actor, body, options) =>
  own.POST(request(actor, "POST", body, options));
const list = (actor, options = {}) =>
  admin.GET(request(actor, "GET", undefined, { ...options, admin: true }));
const patch = (actor, body, options = {}) =>
  admin.PATCH(request(actor, "PATCH", body, { ...options, admin: true }));
async function check(name, fn) {
  session = null;
  await fn();
  cases.push(name);
  console.log("PASS " + name);
}
const rejects = (code) => (error) => error.code === code;
const count = (table, where = "", ...args) =>
  Number(
    db
      .prepare(
        `SELECT count(*) n FROM ${table}${where ? " WHERE " + where : ""}`,
      )
      .get(...args).n,
  );
const fingerprint = () =>
  JSON.stringify(
    db
      .prepare(
        "SELECT status,revision,profile_json FROM teacher_applications ORDER BY id",
      )
      .all(),
  );
(async () => {
  try {
    await check(
      "Migration11 preserves v10 users, roles and private learning snapshots",
      () => {
        const oldFile = path.join(folder, "upgrade.sqlite"),
          old = new DatabaseSync(oldFile),
          migrations = load("lib/server/schema.ts").migrations;
        old.exec(
          "PRAGMA foreign_keys=ON; CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
        );
        for (const m of migrations.filter((m) => m.version <= 10)) {
          old.exec(m.sql);
          old
            .prepare("INSERT INTO schema_migrations VALUES (?,?)")
            .run(m.version, new Date(clock).toISOString());
        }
        old
          .prepare(
            "INSERT INTO users(id,storage_key,name,role,created_at,last_seen_at) VALUES ('legacy-user','legacy-storage','Synthetic legacy','USER',?,?)",
          )
          .run(new Date(clock).toISOString(), new Date(clock).toISOString());
        const legacyData = {
          version: 1,
          library: { version: 1, items: [], spaces: [] },
          learning: {
            version: 1,
            tasks: [],
            reviews: [],
            events: [
              {
                id: "synthetic-private-legacy-activity",
                at: new Date(clock).toISOString(),
                kind: "read",
                itemId: "synthetic-old-item",
              },
            ],
            focus: null,
          },
          preferences: { version: 1, enabled: true, feedback: [] },
        };
        old
          .prepare(
            "INSERT INTO sync_snapshots(user_id,epoch,revision,payload_json,digest,updated_at,expires_at) VALUES ('legacy-user','private-legacy-epoch',3,?,'synthetic-legacy-digest',?,?)",
          )
          .run(
            JSON.stringify(legacyData),
            new Date(clock).toISOString(),
            clock + 86400000,
          );
        old.close();
        const upgraded = platform.createStore(oldFile);
        assert.equal(upgraded.getUser("legacy-user").role, "USER");
        assert.equal(upgraded.getMemberships("legacy-user").length, 0);
        assert.deepEqual(upgraded.syncRead("legacy-user", 1).data, legacyData);
        upgraded.close();
        const verify = new DatabaseSync(oldFile);
        assert.equal(
          verify
            .prepare(
              "SELECT count(*) n FROM schema_migrations WHERE version=11",
            )
            .get().n,
          1,
        );
        verify.close();
      },
    );
    await check(
      "Preschool and all supported teaching levels normalize bounded declarations without an age gate",
      () => {
        for (const teachingLevel of contracts.teachingLevels) {
          const result = contracts.parseTeacherProfile(
            profile({
              teachingLevel,
              subjects: ["Toán", "Toán"],
              workEmail: "",
              publicEvidenceUrl: "",
            }),
          );
          assert.equal(result.teachingLevel, teachingLevel);
          assert.deepEqual(result.subjects, ["Toán"]);
          assert.equal(result.adultDeclaration, undefined);
          assert.equal(result.workEmail, undefined);
        }
        assert.ok(contracts.teachingLevels.includes("preschool"));
      },
    );
    await check(
      "Anonymous, forged account binding and revoked sessions cannot access own application",
      async () => {
        await response(await read(null), 401, "SIGN_IN_REQUIRED");
        await response(await post(null, submit()), 401, "SIGN_IN_REQUIRED");
        await response(
          await own.GET(
            request(ordinary, "GET", undefined, {
              headers: { "x-lumio-account": "someone-else" },
            }),
          ),
          401,
          "SESSION_REVOKED",
        );
        const u = user("revoked");
        db.prepare(
          "UPDATE users SET session_version=session_version+1 WHERE id=?",
        ).run(u.id);
        await response(await read(u), 401, "SESSION_REVOKED");
        const disabled = user("disabled");
        db.prepare("UPDATE users SET disabled=1 WHERE id=?").run(disabled.id);
        await response(await post(disabled, submit()), 401, "SESSION_REVOKED");
      },
    );
    await check(
      "Own/admin origins, native auth rejection and bounded JSON are enforced",
      async () => {
        await response(
          await own.GET(
            request(ordinary, "GET", undefined, {
              headers: { "sec-fetch-site": "cross-site" },
            }),
          ),
          403,
          "INVALID_ORIGIN",
        );
        await response(
          await list(owner, { headers: { "sec-fetch-site": "same-site" } }),
          403,
          "INVALID_ORIGIN",
        );
        await response(
          await post(ordinary, submit(), {
            headers: { origin: "https://attacker.example.test" },
          }),
          403,
          "INVALID_ORIGIN",
        );
        await response(
          await post(ordinary, submit(), {
            headers: { "content-type": "text/plain" },
          }),
          415,
          "INVALID_CONTENT_TYPE",
        );
        await response(await post(ordinary, "{"), 400, "INVALID_JSON");
        await response(
          await post(ordinary, { padding: "x".repeat(8300) }),
          413,
          "PAYLOAD_TOO_LARGE",
        );
        await response(
          await own.GET(
            request(ordinary, "GET", undefined, {
              headers: { authorization: "Bearer synthetic-native" },
            }),
          ),
          401,
          "SIGN_IN_REQUIRED",
        );
      },
    );
    let first, firstBody;
    await check(
      "A submitted declaration stays pending, grants no system/org privilege and retains optional private fields",
      async () => {
        const empty = await response(await read(ordinary));
        assert.equal(empty.application, null);
        assert.equal(empty.credential.active, false);
        firstBody = submit(
          profile({
            workEmail: "SYNTHETIC-WORK@example.test",
            publicEvidenceUrl: "https://school.example.test/staff",
          }),
        );
        first = await response(await post(ordinary, firstBody));
        assert.equal(first.application.status, "pending");
        assert.equal(first.application.revision, 1);
        assert.equal(first.credential.active, false);
        assert.equal(first.credential.identityVerified, false);
        assert.equal(first.credential.basis, "manual-review-of-declaration");
        assert.equal(
          first.application.profile.workEmail,
          "synthetic-work@example.test",
        );
        assert.equal(store.getUser(ordinary.id).role, "USER");
        assert.deepEqual(store.getMemberships(ordinary.id), []);
        assert.equal(
          store.isApprovedTeacher(ordinary.id, ordinary.sessionVersion),
          false,
        );
      },
    );
    await check(
      "Forged approvals, system roles, minor/student records and coercible values are rejected",
      async () => {
        const before = fingerprint();
        for (const body of [
          { ...submit(), status: "approved" },
          { ...submit(), role: "ADMIN" },
          { ...submit(), userId: owner.id },
          submit(profile({ identityVerified: true })),
          submit(profile({ studentIds: ["synthetic-minor"] })),
          submit(profile({ dateOfBirth: "synthetic" })),
          submit(profile({ guardianName: "synthetic" })),
          submit(profile({ storageConsent: "true" })),
          submit(profile({ teacherDeclaration: false })),
          submit(profile({ teachingLevel: ["primary"] })),
          submit(profile({ subjects: ["x".repeat(81)] })),
          submit(profile({ countryCode: "vn" })),
          { ...submit(), expectedRevision: "1" },
          { ...submit(), requestId: 42 },
        ])
          assert.equal((await post(ordinary, body)).status, 400);
        assert.equal(fingerprint(), before);
      },
    );
    await check(
      "Own endpoint never accepts another applicant ID or returns another account's form",
      async () => {
        const other = user("private-other");
        await response(
          await post(
            other,
            submit(
              profile({ applicantName: "Synthetic confidential teacher" }),
            ),
          ),
        );
        const result = await response(await read(ordinary));
        assert.equal(result.application.userId, ordinary.id);
        assert.equal(
          JSON.stringify(result).includes("Synthetic confidential teacher"),
          false,
        );
        await response(
          await own.GET(
            request(ordinary, "GET", undefined, {
              query: "?userId=" + other.id,
            }),
          ),
          400,
          "INVALID_TEACHER_REQUEST",
        );
        await response(await list(ordinary), 403, "FORBIDDEN");
        await response(await list(store.getUser(dev.id)), 403, "FORBIDDEN");
      },
    );
    await check(
      "Pending edit is CAS guarded; identical lost-ACK resubmission has one audit/operation",
      async () => {
        const oldCount = count("teacher_application_operations"),
          audits = count(
            "audit_events",
            "action='TEACHER_APPLICATION_SUBMITTED' AND actor_id=?",
            ordinary.id,
          );
        const replay = await response(await post(ordinary, firstBody));
        assert.equal(replay.application.revision, 1);
        assert.equal(count("teacher_application_operations"), oldCount);
        assert.equal(
          count(
            "audit_events",
            "action='TEACHER_APPLICATION_SUBMITTED' AND actor_id=?",
            ordinary.id,
          ),
          audits,
        );
        await response(
          await post(ordinary, {
            ...firstBody,
            profile: profile({ school: "Different payload" }),
          }),
          409,
          "TEACHER_REQUEST_REUSED",
        );
        await response(
          await post(ordinary, submit(profile(), 0)),
          409,
          "TEACHER_CONFLICT",
        );
        first = await response(
          await post(
            ordinary,
            submit(profile({ school: "Updated declaration school" }), 1),
          ),
        );
        assert.equal(first.application.revision, 2);
        assert.equal(first.application.status, "pending");
      },
    );
    await check(
      "Only current ADMIN/SUPER_ADMIN may list; stale authentication and org teacher membership do not suffice",
      async () => {
        const all = await response(await list(owner, { query: "?status=all" }));
        assert.ok(all.total >= 2);
        assert.equal(all.limit, 30);
        await response(await list(store.getUser(regularAdmin.id)), 200);
        await response(
          await list(owner, {
            session: { authenticatedAt: Date.now() - 3600001 },
          }),
          401,
          "ADMIN_REAUTH_REQUIRED",
        );
        await response(
          await patch(ordinary, review(first.application)),
          403,
          "FORBIDDEN",
        );
        const actor = {
          user: ordinary,
          memberships: [
            { organizationId: "synthetic-school", role: "TEACHER" },
          ],
        };
        assert.equal(
          policy.can(actor, "teachers.read", { scope: "SYSTEM" }),
          false,
        );
        assert.equal(
          policy.can(actor, "teachers.review", { scope: "SYSTEM" }),
          false,
        );
        assert.equal(
          policy.can(actor, "learning.read", {
            scope: "SELF",
            ownerId: owner.id,
          }),
          false,
        );
      },
    );
    await check(
      "Admin account binding and malformed/forged reviews reject without changing the application",
      async () => {
        const before = fingerprint();
        await response(
          await patch(owner, review(first.application), {
            headers: { "x-lumio-account": ordinary.storageKey },
          }),
          401,
          "SESSION_REVOKED",
        );
        for (const change of [
          { status: "approved" },
          { role: "SUPER_ADMIN" },
          { action: ["approve"] },
          { expectedRevision: "2" },
          { note: "short" },
          { requestId: 123 },
          { note: "bad\u0000note" },
        ])
          assert.equal(
            (await patch(owner, review(first.application, "approve", change)))
              .status,
            400,
          );
        assert.equal(fingerprint(), before);
      },
    );
    await check(
      "An admin cannot approve or review their own application",
      async () => {
        const app = await response(await post(owner, submit()));
        await response(
          await patch(owner, review(app.application)),
          403,
          "TEACHER_SELF_REVIEW_FORBIDDEN",
        );
        assert.equal(
          store.readTeacherApplication(owner.id, owner.sessionVersion)
            .credential.active,
          false,
        );
        assert.ok(
          count(
            "audit_events",
            "action='TEACHER_REVIEW_DENIED' AND actor_id=?",
            owner.id,
          ) >= 1,
        );
      },
    );
    await check(
      "Declaring an admin's professional email or display name never bootstraps privilege",
      async () => {
        const u = user("claimed-admin-address");
        const result = await response(
          await post(
            u,
            submit(
              profile({
                workEmail: "teacher-admin@example.test",
                applicantName: owner.name,
              }),
            ),
          ),
        );
        assert.equal(result.application.status, "pending");
        assert.equal(result.credential.active, false);
        assert.equal(store.getUser(u.id).role, "USER");
        await response(await list(u), 403, "FORBIDDEN");
      },
    );
    let approval;
    await check(
      "Manual approval grants only a separate active credential, leaves USER role and private student policies intact",
      async () => {
        approval = review(first.application, "approve", {
          note: "Synthetic first line\nSecond line",
        });
        first = await response(
          await patch(store.getUser(regularAdmin.id), approval),
        );
        assert.equal(first.application.status, "approved");
        assert.equal(
          first.application.reviewNote,
          "Synthetic first line Second line",
        );
        assert.equal(first.credential.active, true);
        assert.equal(first.credential.identityVerified, false);
        assert.equal(
          store.isApprovedTeacher(ordinary.id, ordinary.sessionVersion),
          true,
        );
        assert.equal(store.getUser(ordinary.id).role, "USER");
        assert.deepEqual(store.getMemberships(ordinary.id), []);
        await response(await list(ordinary), 403, "FORBIDDEN");
        assert.equal(
          policy.can(
            { user: store.getUser(ordinary.id), memberships: [] },
            "learning.read",
            { scope: "SELF", ownerId: owner.id },
          ),
          false,
        );
        await response(
          await post(ordinary, submit(profile(), first.application.revision)),
          409,
          "TEACHER_ALREADY_APPROVED",
        );
      },
    );
    await check(
      "Review idempotency and stale revision protect against a duplicate grant or conflicting admin decisions",
      async () => {
        const audits = count(
            "audit_events",
            "action='TEACHER_APPLICATION_APPROVED' AND target=?",
            first.application.id,
          ),
          rev = first.application.revision;
        const duplicate = await response(
          await patch(store.getUser(regularAdmin.id), approval),
        );
        assert.equal(duplicate.application.revision, rev);
        assert.equal(
          count(
            "audit_events",
            "action='TEACHER_APPLICATION_APPROVED' AND target=?",
            first.application.id,
          ),
          audits,
        );
        await response(
          await patch(
            owner,
            review({ ...first.application, revision: rev - 1 }, "revoke"),
          ),
          409,
          "TEACHER_CONFLICT",
        );
        await response(
          await patch(store.getUser(regularAdmin.id), {
            ...approval,
            note: "Different duplicate review",
          }),
          409,
          "TEACHER_REQUEST_REUSED",
        );
        await response(
          await patch(owner, review(first.application, "reject")),
          409,
          "TEACHER_INVALID_TRANSITION",
        );
      },
    );
    await check(
      "Revocation disables the teacher credential; replaying an old approval cannot resurrect it",
      async () => {
        first = await response(
          await patch(owner, review(first.application, "revoke")),
        );
        assert.equal(first.application.status, "revoked");
        assert.equal(first.credential.active, false);
        assert.ok(first.credential.revokedAt);
        assert.equal(
          store.isApprovedTeacher(ordinary.id, ordinary.sessionVersion),
          false,
        );
        const replay = await response(
          await patch(store.getUser(regularAdmin.id), approval),
        );
        assert.equal(replay.application.status, "revoked");
        assert.equal(replay.credential.active, false);
        await response(
          await patch(owner, review(first.application, "approve")),
          409,
          "TEACHER_INVALID_TRANSITION",
        );
      },
    );
    await check(
      "Rejected or revoked applicants can resubmit through a new pending revision, never directly restore privilege",
      async () => {
        first = await response(
          await post(
            ordinary,
            submit(
              profile({ school: "New self-declared school" }),
              first.application.revision,
            ),
          ),
        );
        assert.equal(first.application.status, "pending");
        assert.equal(first.application.reviewNote, null);
        assert.equal(first.credential.active, false);
        first = await response(
          await patch(owner, review(first.application, "reject")),
        );
        assert.equal(first.application.status, "rejected");
        first = await response(
          await post(ordinary, submit(profile(), first.application.revision)),
        );
        assert.equal(first.application.status, "pending");
        assert.equal(first.credential.active, false);
      },
    );
    await check(
      "Session revocation and permission loss between authorization and body parsing are rechecked inside the write transaction",
      async () => {
        const u = user("race-user"),
          req = request(u, "POST", submit()),
          reader = req.body.getReader.bind(req.body);
        let changed = false;
        req.body.getReader = () => {
          const r = reader();
          return {
            read: () => {
              if (!changed) {
                changed = true;
                db.prepare(
                  "UPDATE users SET session_version=session_version+1 WHERE id=?",
                ).run(u.id);
              }
              return r.read();
            },
            cancel: () => r.cancel(),
          };
        };
        await response(await own.POST(req), 401, "SESSION_REVOKED");
        assert.equal(count("teacher_applications", "user_id=?", u.id), 0);
        const raceAdmin = user("race-admin");
        db.prepare("UPDATE users SET role='ADMIN' WHERE id=?").run(
          raceAdmin.id,
        );
        const reviewReq = request(
            store.getUser(raceAdmin.id),
            "PATCH",
            review(first.application),
            { admin: true },
          ),
          readReview = reviewReq.body.getReader.bind(reviewReq.body);
        reviewReq.body.getReader = () => {
          const r = readReview();
          return {
            read: () => {
              db.prepare("UPDATE users SET role='DEV' WHERE id=?").run(
                raceAdmin.id,
              );
              return r.read();
            },
            cancel: () => r.cancel(),
          };
        };
        await response(await admin.PATCH(reviewReq), 403, "FORBIDDEN");
        assert.equal(
          store.readTeacherApplication(ordinary.id, ordinary.sessionVersion)
            .application.status,
          "pending",
        );
      },
    );
    await check(
      "Disabled target cannot receive a new teacher grant and revoked admin sessions cannot review",
      async () => {
        const applicant = user("disabled-applicant"),
          app = await response(await post(applicant, submit()));
        db.prepare("UPDATE users SET disabled=1 WHERE id=?").run(applicant.id);
        await response(
          await patch(owner, review(app.application)),
          409,
          "TEACHER_APPLICANT_UNAVAILABLE",
        );
        const expiredAdmin = user("expired-admin");
        db.prepare(
          "UPDATE users SET role='ADMIN',session_version=session_version+1 WHERE id=?",
        ).run(expiredAdmin.id);
        await response(
          await patch(expiredAdmin, review(first.application)),
          401,
          "SESSION_REVOKED",
        );
      },
    );
    await check(
      "Audit insertion failure rolls back status, credential and idempotency together",
      async () => {
        const before = fingerprint(),
          ops = count("teacher_application_operations"),
          audit = count("audit_events");
        db.exec(
          "CREATE TRIGGER synthetic_teacher_audit_fault BEFORE INSERT ON audit_events WHEN NEW.action='TEACHER_APPLICATION_APPROVED' BEGIN SELECT RAISE(ABORT,'SYNTHETIC_AUDIT_FAULT'); END",
        );
        const result = await patch(owner, review(first.application));
        await response(result, 503, "PLATFORM_UNAVAILABLE");
        db.exec("DROP TRIGGER synthetic_teacher_audit_fault");
        assert.equal(fingerprint(), before);
        assert.equal(count("teacher_application_operations"), ops);
        assert.equal(count("audit_events"), audit);
        assert.equal(
          store.isApprovedTeacher(ordinary.id, ordinary.sessionVersion),
          false,
        );
      },
    );
    await check(
      "Idempotency-log failure also rolls back the credential and append-only audit event",
      async () => {
        const before = fingerprint(),
          ops = count("teacher_application_operations"),
          audit = count("audit_events");
        db.exec(
          "CREATE TRIGGER synthetic_teacher_operation_fault BEFORE INSERT ON teacher_application_operations WHEN NEW.action='approve' BEGIN SELECT RAISE(ABORT,'SYNTHETIC_OPERATION_FAULT'); END",
        );
        await response(
          await patch(owner, review(first.application)),
          503,
          "PLATFORM_UNAVAILABLE",
        );
        db.exec("DROP TRIGGER synthetic_teacher_operation_fault");
        assert.equal(fingerprint(), before);
        assert.equal(count("teacher_application_operations"), ops);
        assert.equal(count("audit_events"), audit);
        assert.equal(
          store.isApprovedTeacher(ordinary.id, ordinary.sessionVersion),
          false,
        );
      },
    );
    await check(
      "Teacher audit metadata contains lifecycle decisions, no form, work email, school, subjects or reviewer prose",
      () => {
        const audit = db
          .prepare(
            "SELECT before_json,after_json FROM audit_events WHERE action LIKE 'TEACHER_%'",
          )
          .all();
        assert.ok(audit.length > 8);
        const text = JSON.stringify(audit);
        for (const value of [
          "Synthetic teacher declaration",
          "synthetic-work@example.test",
          "Synthetic school",
          "Synthetic manual review note",
          "Tỉnh kiểm thử",
          "Phường kiểm thử",
        ])
          assert.equal(text.includes(value), false);
        assert.ok(text.includes("credentialActive"));
      },
    );
    await check(
      "Queue search is bounded literal SQL, paginated and excludes optional work email from search",
      async () => {
        for (let i = 0; i < 33; i++) {
          clock++;
          const u = user("queue-" + i);
          store.submitTeacherApplication(
            u.id,
            u.sessionVersion,
            submit(
              profile({
                applicantName: "Queue synthetic " + i,
                school:
                  i === 0
                    ? "School 50%_Campus"
                    : "Other synthetic queue school",
                workEmail: "excluded-search@example.test",
              }),
            ),
          );
        }
        const page1 = await response(
            await list(owner, { query: "?status=pending&sort=oldest" }),
          ),
          page2 = await response(
            await list(owner, {
              query: "?status=pending&sort=oldest&offset=30",
            }),
          );
        assert.equal(page1.items.length, 30);
        assert.ok(page2.items.length > 0);
        assert.equal(
          new Set([...page1.items, ...page2.items].map((i) => i.id)).size,
          page1.items.length + page2.items.length,
        );
        const literal = await response(
          await list(owner, {
            query: "?status=all&q=" + encodeURIComponent("%_"),
          }),
        );
        assert.equal(literal.total, 1);
        const injection = await response(
          await list(owner, {
            query: "?status=all&q=" + encodeURIComponent("%' OR 1=1--"),
          }),
        );
        assert.equal(injection.total, 0);
        const emailSearch = await response(
          await list(owner, {
            query: "?status=all&q=excluded-search%40example.test",
          }),
        );
        assert.equal(emailSearch.total, 0);
        for (const query of [
          "?q=" + "a".repeat(101),
          "?offset=-1",
          "?offset=1.2",
          "?sort=arbitrary",
          "?status=USER",
          "?q=a&q=b",
          "?userId=forged",
        ])
          assert.equal((await list(owner, { query })).status, 400);
      },
    );
    await check(
      "Submission rate is bounded; valid idempotent replay still works after the daily limit",
      async () => {
        const u = user("rate"),
          firstRequest = submit();
        let state = await response(await post(u, firstRequest));
        for (let i = 1; i < 10; i++)
          state = await response(
            await post(u, submit(profile(), state.application.revision)),
          );
        await response(
          await post(u, submit(profile(), state.application.revision)),
          429,
          "TEACHER_RATE_LIMIT",
        );
        const replay = await response(await post(u, firstRequest));
        assert.equal(replay.application.revision, 10);
      },
    );
    await check(
      "Optional evidence is never fetched, credentials are rejected, and no real minor learning data enters teacher views",
      async () => {
        assert.throws(
          () =>
            contracts.parseTeacherProfile(
              profile({ publicEvidenceUrl: "javascript:alert(1)" }),
            ),
          rejects("INVALID_TEACHER_PROFILE"),
        );
        assert.throws(
          () =>
            contracts.parseTeacherProfile(
              profile({
                publicEvidenceUrl: "https://user:pass@school.example.test/",
              }),
            ),
          rejects("INVALID_TEACHER_PROFILE"),
        );
        const child = user("synthetic-minor-boundary");
        const snap = store.syncRead(child.id, child.sessionVersion);
        store.syncWrite(child.id, child.sessionVersion, {
          epoch: snap.epoch,
          expectedRevision: snap.revision,
          requestId: crypto.randomUUID(),
          data: {
            version: 1,
            library: {
              version: 1,
              items: [
                {
                  id: "private-item",
                  title: "SYNTHETIC-PRIVATE-STUDENT-LESSON",
                  kind: "text",
                  spaceId: "",
                  createdAt: new Date(clock).toISOString(),
                  updatedAt: new Date(clock).toISOString(),
                  text: "SYNTHETIC-PRIVATE-STUDENT-CONTENT",
                  notes: "",
                  cards: [],
                  questions: [],
                  attempts: [],
                  favorite: false,
                },
              ],
              spaces: [],
            },
            learning: {
              version: 1,
              tasks: [],
              reviews: [],
              events: [],
              focus: null,
            },
            preferences: { version: 1, enabled: true, feedback: [] },
          },
        });
        const views = JSON.stringify([
          await response(await list(owner, { query: "?status=all" })),
          await response(await read(ordinary)),
        ]);
        assert.equal(views.includes("SYNTHETIC-PRIVATE-STUDENT"), false);
        assert.equal(count("organizations"), 0);
        assert.equal(count("memberships"), 0);
        assert.equal(networkCalls.length, 0);
      },
    );
    await check(
      "Current schema readiness requires every teacher table, not only a recorded migration number",
      () => {
        assert.deepEqual(store.runtimeHealth(), {
          ready: true,
          schemaVersion: 17,
        });
        const brokenPath = path.join(folder, "missing-teacher-table.sqlite"),
          broken = platform.createStore(brokenPath),
          fault = new DatabaseSync(brokenPath);
        fault.exec("DROP TABLE teacher_application_operations");
        fault.close();
        assert.throws(
          () => broken.runtimeHealth(),
          /teacher_application_operations/,
        );
        broken.close();
      },
    );
    await check(
      "Two SQLite store instances resolve competing admin decisions by revision, without duplicate credentials",
      () => {
        const other = platform.createStore(file, { now: () => clock }),
          app = store.readTeacherApplication(
            ordinary.id,
            ordinary.sessionVersion,
          ).application;
        const approved = store.reviewTeacherApplication(
          owner.id,
          owner.sessionVersion,
          review(app),
        );
        assert.equal(approved.credential.active, true);
        assert.throws(
          () =>
            other.reviewTeacherApplication(
              store.getUser(regularAdmin.id).id,
              regularAdmin.sessionVersion,
              review(app, "reject"),
            ),
          rejects("TEACHER_CONFLICT"),
        );
        assert.equal(
          count("teacher_credentials", "user_id=? AND active=1", ordinary.id),
          1,
        );
        other.close();
      },
    );
    await check(
      "A disabled or session-revoked approved account cannot use the canonical teacher privilege check",
      () => {
        assert.equal(
          store.isApprovedTeacher(ordinary.id, ordinary.sessionVersion),
          true,
        );
        db.prepare(
          "UPDATE users SET disabled=1,session_version=session_version+1 WHERE id=?",
        ).run(ordinary.id);
        assert.throws(
          () => store.isApprovedTeacher(ordinary.id, ordinary.sessionVersion),
          rejects("SESSION_REVOKED"),
        );
        const current = store.getUser(ordinary.id);
        assert.throws(
          () => store.isApprovedTeacher(current.id, current.sessionVersion),
          rejects("SESSION_REVOKED"),
        );
      },
    );
    const report = {
      status: "PASS",
      passed: cases.length,
      cases,
      checkedAt: new Date().toISOString(),
      fixture:
        "Synthetic teacher declarations only; actual Request/Response handlers and isolated SQLite. No real OAuth, teacher verification, student data or network/provider calls.",
    };
    fs.writeFileSync(
      path.join(root, "docs/v3/qa-teacher-api-report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    db.close();
    store.close();
    fs.rmSync(folder, { recursive: true, force: true });
    for (const [k, v] of Object.entries(saved))
      v === undefined ? delete process.env[k] : (process.env[k] = v);
    global.fetch = originalFetch;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
