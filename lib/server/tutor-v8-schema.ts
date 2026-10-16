/** Private per-exercise support metadata; content and feedback cascade with the existing seven-day session. */
export const tutorV8Migration = {
  version: 18,
  sql: `
ALTER TABLE tutor_turns ADD COLUMN intent TEXT NOT NULL DEFAULT 'progress' CHECK(intent IN('progress','simpler','example','approach'));
CREATE TABLE tutor_feedback (
 turn_id TEXT NOT NULL PRIMARY KEY REFERENCES tutor_turns(id) ON DELETE CASCADE,
 session_id TEXT NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL CHECK(revision>=1),
 usefulness TEXT CHECK(usefulness IN('helpful','not_helpful')),
 correctness TEXT CHECK(correctness IN('possible_error','not_sure')),
 updated_at TEXT NOT NULL,
 CHECK(usefulness IS NOT NULL OR correctness IS NOT NULL)
);
CREATE INDEX tutor_feedback_session ON tutor_feedback(session_id);
CREATE TABLE tutor_feedback_actions (
 user_id TEXT NOT NULL REFERENCES users(id),request_id TEXT NOT NULL,
 session_id TEXT NOT NULL REFERENCES tutor_sessions(id) ON DELETE CASCADE,
 turn_id TEXT NOT NULL REFERENCES tutor_turns(id) ON DELETE CASCADE,
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),
 result_revision INTEGER NOT NULL CHECK(result_revision>=1),
 deleted INTEGER NOT NULL CHECK(deleted IN(0,1)),created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,request_id)
);
CREATE INDEX tutor_feedback_actions_turn ON tutor_feedback_actions(turn_id,result_revision);
`,
};
