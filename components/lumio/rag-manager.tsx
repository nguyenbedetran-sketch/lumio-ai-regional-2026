"use client";
import { useAccountScope } from "./account-scope";
import { accountHeaders, paidFetch } from "../../lib/ai/request-client";
import { useEffect, useState } from "react";
import {
  Database,
  Search,
  Trash2,
  Plus,
  Layers,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import type { LearningItem } from "../../lib/lumio/types";
import type { Locale } from "../../lib/lumio/i18n";
import type { RagDocument, RagHit, RagScope } from "../../lib/rag/types";
import styles from "./rag-manager.module.css";
export function ragError(code: string, vi: boolean) {
  return (
    (
      {
        RAG_NO_EVIDENCE: vi
          ? "Chưa tìm thấy bằng chứng phù hợp. Hãy thêm học liệu hoặc viết câu hỏi cụ thể hơn."
          : "No matching evidence. Add a source or ask a more specific question.",
        RAG_SOURCE_CHANGED: vi
          ? "Nguồn đã thay đổi. Bắt đầu bài mới để truy xuất lại."
          : "Sources changed. Start a new exercise to retrieve again.",
        RAG_SNAPSHOT_NOT_FOUND: vi
          ? "Phiên nguồn đã hết hạn. Bắt đầu bài mới."
          : "The source snapshot expired. Start a new exercise.",
        RAG_DOCUMENT_NOT_FOUND: vi
          ? "Học liệu không còn trong phạm vi truy cập của tài khoản này."
          : "A selected source is no longer accessible to this account.",
        RAG_LIBRARY_LIMIT: vi
          ? "Đạt giới hạn 5 tài liệu, 250.000 ký tự hoặc 300 đoạn. Xóa bớt bản lập chỉ mục."
          : "Index limit reached: 5 documents, 250,000 characters or 300 chunks. Remove an indexed copy.",
        SIGN_IN_REQUIRED: vi
          ? "Đăng nhập để lập chỉ mục riêng cho tài khoản."
          : "Sign in to index sources for your account.",
        RAG_CONSENT_REQUIRED: vi
          ? "Cần đồng ý với phạm vi dữ liệu trước khi tiếp tục."
          : "Confirm the data scope before continuing.",
        EMBEDDINGS_DISABLED: vi
          ? "Tìm theo nghĩa chưa được cấu hình; tìm từ khóa vẫn dùng được."
          : "Semantic search is not configured; keyword search still works.",
        RAG_EMBEDDINGS_STALE: vi
          ? "Nguồn chưa có vector theo cấu hình hiện tại. Tạo lại ngữ nghĩa trong Cài đặt hoặc dùng tìm từ khóa."
          : "Sources need vectors for the current configuration. Rebuild semantic indexing in Settings or use keyword search.",
        RAG_SNAPSHOT_LIMIT: vi
          ? "Đã đạt giới hạn bản nguồn đang lưu. Xóa bản chỉ mục không còn dùng hoặc đợi bản nguồn hết hạn."
          : "The stored snapshot limit was reached. Remove an unused indexed copy or wait for snapshots to expire.",
        EMBEDDING_INPUT_LIMIT: vi
          ? "Câu hỏi tìm theo nghĩa cần tối đa 2.000 ký tự. Rút gọn câu hỏi hoặc chọn tìm từ khóa."
          : "Semantic queries must be at most 2,000 characters. Shorten the question or use keyword search.",
        CREDITS_INSUFFICIENT: vi
          ? "Không đủ credit. Tìm từ khóa không tốn credit."
          : "Insufficient credits. Keyword search is free.",
        INVALID_RAG_OUTPUT: vi
          ? "Câu trả lời chưa có trích dẫn khớp nguồn; yêu cầu không được ghi nhận."
          : "The answer has no matching citation; the request was not recorded.",
      } as Record<string, string>
    )[code] ||
    (vi
      ? "Không thực hiện được. Hãy kiểm tra đăng nhập/kết nối và thử lại."
      : "Could not complete this action. Check your sign-in and connection, then retry.")
  );
}
async function api(
  url: string,
  body?: unknown,
  signal?: AbortSignal,
  account = "guest",
) {
  const value = body as
    { action?: string; scope?: { mode?: string } } | undefined;
  const paid =
    (url === "/api/rag/documents" && value?.action === "embed") ||
    (url === "/api/rag/search" && value?.scope?.mode === "hybrid");
  const init: RequestInit = {
    ...(body
      ? {
          method: "POST",
          body: JSON.stringify(body),
        }
      : {}),
    cache: "no-store",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...accountHeaders(account),
    },
    signal,
  };
  const response = paid
    ? await paidFetch(
        url as "/api/rag/search" | "/api/rag/documents",
        init,
        account,
      )
    : await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "RAG_UNAVAILABLE");
  return data;
}
export function RAGManager({
  items,
  workspaceId = "main",
  spaces = [],
  locale,
}: {
  items: LearningItem[];
  workspaceId?: string;
  spaces?: { id: string; name: string }[];
  locale: Locale;
}) {
  const vi = locale === "vi";
  const account = useAccountScope();
  const [space, setSpace] = useState(workspaceId || "main");
  useEffect(() => setSpace(workspaceId || "main"), [workspaceId]);
  const [documents, setDocuments] = useState<RagDocument[]>([]),
    [available, setAvailable] = useState(false),
    [storage, setStorage] = useState(false),
    [external, setExternal] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [mode, setMode] = useState<"lexical" | "hybrid">("lexical"),
    [hits, setHits] = useState<RagHit[] | null>(null);
  async function refresh(signal?: AbortSignal) {
    const d = await api(
      `/api/rag/documents?workspaceId=${encodeURIComponent(space)}`,
      undefined,
      signal,
      account,
    );
    setDocuments(d.documents);
    setAvailable(d.embeddingsAvailable === true);
  }
  useEffect(() => {
    const c = new AbortController();
    setDocuments([]);
    setHits(null);
    setStorage(false);
    setExternal(false);
    void refresh(c.signal).catch((e) => {
      if (e.name !== "AbortError") setError(ragError(e.message, vi));
    });
    return () => c.abort();
  }, [space]);
  async function action(body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api("/api/rag/documents", body, undefined, account);
      await refresh();
      window.dispatchEvent(new Event("lumio-rag-changed"));
      setHits(null);
    } catch (e) {
      setError(ragError(e instanceof Error ? e.message : "", vi));
    } finally {
      setBusy(false);
    }
  }
  const eligible = items.filter(
    (i) =>
      (i.spaceId || "main") === space &&
      i.text.trim() &&
      i.text.length <= 100000,
  );
  return (
    <section className={styles.panel} data-rag-manager>
      <div className={styles.heading}>
        <Database />
        <div>
          <h3>{vi ? "Kho nguồn riêng của bạn" : "Your indexed sources"}</h3>
          <p>
            {vi
              ? "Tìm và đối chiếu nhiều tài liệu trong cùng không gian."
              : "Search and compare documents within this workspace."}
          </p>
        </div>
      </div>
      <label className="lm-field">
        {vi ? "Không gian học được lập chỉ mục" : "Workspace to index"}
        <select
          aria-label={
            vi ? "Không gian học được lập chỉ mục" : "Workspace to index"
          }
          value={space}
          disabled={busy}
          onChange={(e) => setSpace(e.target.value)}
        >
          <option value="main">
            {vi ? "Học liệu chưa phân loại" : "Unassigned sources"}
          </option>
          {spaces
            .filter((s) => s.id !== "main")
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </label>
      <p className={styles.notice}>
        <ShieldCheck size={16} />
        {vi
          ? "Chỉ mục riêng theo tài khoản; tối đa 5 tài liệu, 250.000 ký tự, 300 đoạn; mỗi tài liệu tối đa 100.000 ký tự. Bản sao văn bản lưu trên máy chủ tối đa 7 ngày. Bản miễn phí có thể mất dữ liệu sau khi khởi động lại."
          : "Account-private index: up to 5 documents, 250,000 characters and 300 chunks; at most 100,000 characters per document. Text copies remain on the server for up to 7 days. Free hosting can lose data after restart."}
      </p>
      <label className={styles.consent}>
        <input
          type="checkbox"
          checked={storage}
          onChange={(e) => setStorage(e.target.checked)}
        />
        {vi
          ? "Tôi đồng ý lưu bản văn bản và vị trí nguồn đã xử lý lên máy chủ để tìm kiếm. Chưa gửi tới dịch vụ AI ở bước lập chỉ mục từ khóa."
          : "I agree to store processed text and source locations on the server for search. Keyword indexing does not send it to an AI service."}
      </label>
      <div className={styles.grid}>
        {eligible.map((item) => {
          const doc = documents.find((d) => d.clientItemId === item.id);
          return (
            <article key={item.id} className={styles.card}>
              <strong>{item.title}</strong>
              <small>
                {item.text.length.toLocaleString()}{" "}
                {vi ? "ký tự" : "characters"}
              </small>
              <button
                type="button"
                className="lm-button"
                disabled={busy || !storage}
                onClick={() =>
                  void action({
                    action: "index",
                    workspaceId: space,
                    clientItemId: item.id,
                    title: item.title,
                    text: item.text,
                    sourceEvidence: item.sourceEvidence,
                    storageConsent: storage,
                  })
                }
              >
                <Plus size={15} />
                {doc
                  ? vi
                    ? "Cập nhật chỉ mục"
                    : "Update index"
                  : vi
                    ? "Lập chỉ mục"
                    : "Index source"}
              </button>
            </article>
          );
        })}
      </div>
      {!eligible.length && (
        <p>
          {vi
            ? "Thêm văn bản hoặc trích xuất PDF/DOCX/PPTX trong Nguồn học liệu trước. Ảnh/video chưa có bản chữ không được coi là đã lập chỉ mục."
            : "Add text or extract a PDF/DOCX/PPTX first. Images and videos without processed text are not indexed."}
        </p>
      )}
      <div className={styles.list}>
        {documents.map((doc) => (
          <article key={doc.id}>
            <Layers size={18} />
            <div>
              <strong>{doc.title}</strong>
              <small>
                {doc.chunks} {vi ? "đoạn" : "chunks"} · v{doc.revision} ·{" "}
                {doc.semantic
                  ? vi
                    ? "Từ khóa + ngữ nghĩa"
                    : "Keyword + semantic"
                  : vi
                    ? "Từ khóa"
                    : "Keyword"}
              </small>
            </div>
            <button
              className="lm-button"
              disabled={busy || !external || !available || doc.semantic}
              onClick={() =>
                void action({
                  action: "embed",
                  workspaceId: space,
                  documentId: doc.id,
                  externalConsent: external,
                })
              }
            >
              {vi ? "Thêm ngữ nghĩa · 2 credit" : "Add semantic · 2 credits"}
            </button>
            <button
              className="lm-icon"
              aria-label={`${vi ? "Xóa bản chỉ mục" : "Remove indexed copy"} ${doc.title}`}
              disabled={busy}
              onClick={() =>
                void action({
                  action: "delete",
                  workspaceId: space,
                  documentId: doc.id,
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </article>
        ))}
      </div>
      <label className={styles.consent}>
        <input
          type="checkbox"
          checked={external}
          disabled={!available}
          onChange={(e) => setExternal(e.target.checked)}
        />
        {vi
          ? "Tùy chọn: gửi văn bản tài liệu / câu truy vấn tới dịch vụ AI bên ngoài để tạo vector ngữ nghĩa. Mỗi lần tạo hoặc tìm theo nghĩa tốn 2 credit; lỗi được hoàn credit. Không tự động bật."
          : "Optional: send document text / search query to an external AI service for semantic vectors. Each indexing or semantic search action costs 2 credits; errors are refunded. Never enabled automatically."}
      </label>
      {!available && (
        <small>
          {vi
            ? "Ngữ nghĩa chưa bật trên máy chủ; chỉ mục và tìm từ khóa vẫn hoạt động."
            : "Semantic search is disabled on the server; keyword indexing and search still work."}
        </small>
      )}
      <form
        className={styles.search}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await api(
              "/api/rag/search",
              {
                scope: {
                  workspaceId: space,
                  documentIds: documents.map((d) => d.id),
                  mode,
                  consent: external,
                },
                query,
              },
              undefined,
              account,
            );
            setHits(result.hits);
          } catch (e) {
            setError(ragError(e instanceof Error ? e.message : "", vi));
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          aria-label={vi ? "Tìm trong kho nguồn" : "Search indexed sources"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={2000}
          placeholder={
            vi ? "Bạn cần đối chiếu điều gì?" : "What do you want to find?"
          }
        />
        <select
          aria-label={vi ? "Kiểu tìm kiếm" : "Search method"}
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
        >
          <option value="lexical">
            {vi ? "Từ khóa · miễn phí" : "Keyword · free"}
          </option>
          <option value="hybrid" disabled={!available || !external}>
            {vi ? "Kết hợp · 2 credit" : "Hybrid · 2 credits"}
          </option>
        </select>
        <button
          className="lm-button primary"
          disabled={
            busy ||
            !query.trim() ||
            !documents.length ||
            (mode === "hybrid" && !external)
          }
        >
          {busy ? (
            <LoaderCircle className="lm-spin" size={16} />
          ) : (
            <Search size={16} />
          )}
        </button>
      </form>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {hits && (
        <div className={styles.results}>
          {!hits.length ? (
            <p>
              {vi
                ? "Chưa tìm thấy bằng chứng phù hợp; không có câu trả lời AI được tạo."
                : "No matching evidence; no AI answer was generated."}
            </p>
          ) : (
            hits.map((h) => (
              <blockquote key={h.chunkId}>
                <strong>
                  {h.documentTitle} ·{" "}
                  {h.page
                    ? `${vi ? "Trang" : "Page"} ${h.page}`
                    : h.slide
                      ? `${vi ? "Trang chiếu" : "Slide"} ${h.slide}`
                      : `${vi ? "Đoạn" : "Paragraph"} ${h.paragraph}`}
                </strong>
                <p>{h.text}</p>
                <small>
                  {vi
                    ? "Trích nguyên văn; thứ hạng tìm kiếm không chứng minh tính đúng đắn."
                    : "Verbatim excerpt; search ranking does not prove correctness."}
                </small>
              </blockquote>
            ))
          )}
        </div>
      )}
      <small>
        {vi
          ? "Xóa bản chỉ mục không xóa tài liệu trên trình duyệt hoặc các đoạn đã có trong lịch sử trò chuyện (tối đa 7 ngày)."
          : "Removing an index does not delete the browser original or excerpts already in conversation history (up to 7 days)."}
      </small>
    </section>
  );
}
export function RAGScopeSelector({
  workspaceId = "main",
  locale,
  value,
  onChange,
  disabled,
}: {
  workspaceId?: string;
  locale: Locale;
  value: RagScope | undefined;
  onChange: (value: RagScope | undefined) => void;
  disabled?: boolean;
}) {
  const account = useAccountScope();
  const vi = locale === "vi",
    space = workspaceId || "main",
    [documents, setDocuments] = useState<RagDocument[]>([]),
    [available, setAvailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      void api(
        `/api/rag/documents?workspaceId=${encodeURIComponent(space)}`,
        undefined,
        controller.signal,
        account,
      )
        .then((d) => {
          setDocuments(d.documents);
          setAvailable(d.embeddingsAvailable === true);
        })
        .catch(() => setDocuments([]));
    };
    refresh();
    window.addEventListener("lumio-rag-changed", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("lumio-rag-changed", refresh);
    };
  }, [space]);
  if (!documents.length && !value) return null;
  return (
    <fieldset className={styles.scope} disabled={disabled}>
      <legend>
        <Database size={15} />
        {vi
          ? "Phạm vi đối chiếu nhiều tài liệu"
          : "Compare multiple indexed sources"}
      </legend>
      <label>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? {
                    workspaceId: space,
                    documentIds: documents.map((d) => d.id),
                    mode: "lexical",
                  }
                : undefined,
            )
          }
        />
        {vi
          ? "Dùng kho nguồn đã lập chỉ mục thay cho tài liệu đang mở"
          : "Use indexed sources instead of the open document"}
      </label>
      {value && (
        <>
          <div>
            {documents.map((doc) => (
              <label key={doc.id}>
                <input
                  type="checkbox"
                  checked={value.documentIds.includes(doc.id)}
                  onChange={(e) => {
                    const ids = e.target.checked
                      ? [...value.documentIds, doc.id]
                      : value.documentIds.filter((id) => id !== doc.id);
                    onChange(
                      ids.length
                        ? { ...value, documentIds: ids, snapshotId: undefined }
                        : undefined,
                    );
                  }}
                />
                {doc.title} · v{doc.revision}
              </label>
            ))}
          </div>
          <p>
            {vi
              ? "Chỉ các đoạn được truy xuất trong tài liệu đã chọn được gửi tới AI. Một bản nguồn cố định được giữ suốt bài; thay đổi nguồn cần bắt đầu bài mới."
              : "Only retrieved excerpts from selected sources are sent to AI. One fixed source snapshot is used throughout the exercise; source changes require a new exercise."}
          </p>
          <label>
            <input
              type="checkbox"
              disabled={
                !available ||
                value.documentIds.some(
                  (id) => !documents.find((d) => d.id === id)?.semantic,
                )
              }
              checked={value.mode === "hybrid"}
              onChange={(e) =>
                onChange({
                  ...value,
                  mode: e.target.checked ? "hybrid" : "lexical",
                  consent: e.target.checked,
                  snapshotId: undefined,
                })
              }
            />
            {vi
              ? "Tùy chọn: gửi câu hỏi tới dịch vụ AI để tìm theo nghĩa, thêm 2 credit khi bắt đầu bài. Các nguồn đã chọn phải có vector."
              : "Optional: send the question to an AI service for semantic search, 2 additional credits at exercise start. Selected sources must have vectors."}
          </label>
        </>
      )}
    </fieldset>
  );
}
