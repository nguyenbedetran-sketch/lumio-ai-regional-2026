export const ragMigration = {
  version: 9,
  sql: `
CREATE TABLE rag_documents (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), workspace_id TEXT NOT NULL,
 client_item_id TEXT NOT NULL, title TEXT NOT NULL, source_text TEXT NOT NULL, digest TEXT NOT NULL,
 evidence_json TEXT, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at INTEGER NOT NULL,
 embedding_model TEXT, embedding_dimensions INTEGER,
 UNIQUE(user_id,workspace_id,client_item_id)
);
CREATE INDEX rag_documents_owner ON rag_documents(user_id,workspace_id,expires_at);
CREATE TABLE rag_chunks (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), workspace_id TEXT NOT NULL,
 document_id TEXT NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE, ordinal INTEGER NOT NULL,
 segment_json TEXT NOT NULL, vector_json TEXT, UNIQUE(document_id,ordinal)
);
CREATE INDEX rag_chunks_owner ON rag_chunks(user_id,workspace_id,document_id);
CREATE TABLE rag_snapshots (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), session_version INTEGER NOT NULL,
 workspace_id TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX rag_snapshots_owner ON rag_snapshots(user_id,session_version,expires_at);
`,
};
