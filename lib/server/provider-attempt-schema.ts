/** Additive metadata journal only; never rewrites credit or historical outcomes. */
export const providerAttemptMigration = {
  version: 17,
  sql: `
CREATE TABLE ai_provider_attempts (
 id TEXT NOT NULL PRIMARY KEY,logical_request_id TEXT NOT NULL CHECK(length(logical_request_id) BETWEEN 1 AND 100),
 dispatch_ordinal INTEGER NOT NULL CHECK(dispatch_ordinal>=1),user_id TEXT NOT NULL REFERENCES users(id),
 session_version INTEGER NOT NULL CHECK(session_version>=1),reservation_id TEXT NOT NULL REFERENCES billing_reservations(id),
 feature TEXT NOT NULL CHECK(feature IN('learner.chat','learner.tutor','learner.summary','learner.cards','learner.quiz','teacher.lesson','teacher.questions','teacher.feedback','teacher.assistant','job.summary-part')),
 provider TEXT NOT NULL CHECK(provider IN('openai','gemini')),endpoint_kind TEXT NOT NULL CHECK(endpoint_kind IN('responses','generate-content')),
 requested_model TEXT NOT NULL CHECK(length(requested_model) BETWEEN 1 AND 100),response_model TEXT CHECK(length(response_model) BETWEEN 1 AND 100),
 provider_request_id TEXT CHECK(length(provider_request_id) BETWEEN 1 AND 100),
 status TEXT NOT NULL DEFAULT 'prepared' CHECK(status IN('prepared','response_received','network_unknown','timeout_unknown','cancelled_unknown')),
 http_status INTEGER CHECK(http_status BETWEEN 100 AND 599),
 input_tokens INTEGER CHECK(input_tokens>=0),output_tokens INTEGER CHECK(output_tokens>=0),cached_tokens INTEGER CHECK(cached_tokens>=0),
 total_tokens INTEGER CHECK(total_tokens>=0),reasoning_tokens INTEGER CHECK(reasoning_tokens>=0),latency_ms INTEGER CHECK(latency_ms>=0),
 safe_error_code TEXT CHECK(length(safe_error_code) BETWEEN 1 AND 80),
 usage_source TEXT CHECK(usage_source IN('openai-response-usage','gemini-usage-metadata')),
 estimated_cost_usd REAL CHECK(estimated_cost_usd IS NULL),prepared_at TEXT NOT NULL,ended_at TEXT,
 UNIQUE(logical_request_id,dispatch_ordinal),
 CHECK((status='prepared' AND ended_at IS NULL) OR (status!='prepared' AND ended_at IS NOT NULL)),
 CHECK((provider='openai' AND endpoint_kind='responses') OR (provider='gemini' AND endpoint_kind='generate-content'))
);
CREATE INDEX ai_provider_attempts_retention ON ai_provider_attempts(ended_at,id) WHERE ended_at IS NOT NULL;
CREATE INDEX ai_provider_attempts_unresolved ON ai_provider_attempts(user_id) WHERE status='prepared';
CREATE INDEX ai_provider_attempts_created ON ai_provider_attempts(prepared_at,provider,requested_model);
`,
};
