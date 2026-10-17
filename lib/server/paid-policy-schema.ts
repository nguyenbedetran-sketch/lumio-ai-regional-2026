export const paidPolicyMigration = {
  version: 20,
  sql: `
CREATE TABLE billing_paid_policies (
 plan_id TEXT PRIMARY KEY CHECK(plan_id IN ('premium','pro')),
 revision INTEGER NOT NULL CHECK(revision>=1),
 policy_json TEXT NOT NULL CHECK(length(policy_json)<=16384),
 updated_by TEXT NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL
);
ALTER TABLE billing_reservations ADD COLUMN pricing_snapshot_json TEXT
 CHECK(pricing_snapshot_json IS NULL OR length(pricing_snapshot_json)<=16384);
`,
};
