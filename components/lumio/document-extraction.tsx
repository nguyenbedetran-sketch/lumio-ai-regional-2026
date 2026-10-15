"use client";
import { useEffect, useRef, useState } from "react";
import { FileSearch, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { parseSourceEvidence } from "../../lib/ai/grounding";
import type { LearningItem } from "../../lib/lumio/types";
import type { Locale } from "../../lib/lumio/i18n";
const copy = {
  vi: {
    title: "Đọc tài liệu có vị trí đối chiếu",
    help: "Phân tích lớp văn bản của PDF, đoạn và tiêu đề DOCX, hoặc thứ tự trang chiếu PPTX. Tệp được gửi tới máy chủ Lumio để trích văn bản, chưa gửi tới AI. Tối đa 6 MB, 100 trang/trang chiếu và 200.000 ký tự. Tài liệu quét, công thức dạng ảnh, bảng phức tạp có thể cần đối chiếu bằng mắt.",
    button: "Phân tích tài liệu",
    again: "Phân tích lại tài liệu",
    busy: "Đang đọc và xác định vị trí…",
    cancel: "Hủy",
    ready: "Đã trích văn bản có vị trí nguồn",
    error: "Không thể đọc tài liệu. Kiểm tra tệp và thử lại.",
    complex:
      "Tài liệu có công thức Office dạng cấu trúc. Hãy xuất sang PDF hoặc dùng ảnh để giữ đúng phân số, căn và số mũ; Lumio không làm phẳng chúng thành văn bản dễ sai.",
    signIn: "Đăng nhập để phân tích tệp an toàn bằng máy chủ Lumio.",
    busyError:
      "Máy chủ đang xử lý tài liệu khác hoặc bạn vừa thử quá nhiều lần. Chờ một chút rồi thử lại.",
    noText:
      "Tệp không có lớp văn bản đọc được. Với tài liệu quét, dùng ảnh rõ nét và kiểm tra lại bằng mắt.",
    large:
      "Tệp vượt giới hạn trích văn bản: 6 MB, 100 trang hoặc 200.000 ký tự.",
    edited:
      "Khi sửa văn bản, vị trí trang/trang chiếu đã xác nhận sẽ được bỏ. Phân tích lại tệp để khôi phục.",
  },
  en: {
    title: "Read with source locations",
    help: "Extract the PDF text layer, DOCX paragraphs/headings, or PPTX slide order. The file is sent to Lumio's server for text extraction, not to AI yet. Limits: 6 MB, 100 pages/slides, 200,000 characters. Scans, image formulas and complex tables may need visual checking.",
    button: "Analyze document",
    again: "Analyze document again",
    busy: "Reading source locations…",
    cancel: "Cancel",
    ready: "Text and source locations extracted",
    error: "Unable to read this document. Check the file and retry.",
    complex:
      "This file contains structured Office math. Export it to PDF or use an image to preserve fractions, radicals and exponents instead of silently flattening them.",
    signIn: "Sign in to process the document on Lumio's server.",
    busyError:
      "The server is processing another document or you have tried too often. Wait a moment and retry.",
    noText:
      "No readable text layer. Use clear images for scanned material and visually check the result.",
    large: "Document exceeds 6 MB, 100 pages or 200,000 characters.",
    edited:
      "Editing the text removes verified page/slide locations. Analyze the original again to restore them.",
  },
};
export function DocumentExtraction({
  item,
  locale,
  update,
}: {
  item: LearningItem;
  locale: Locale;
  update: (item: LearningItem) => void;
}) {
  const c = copy[locale === "vi" ? "vi" : "en"],
    latest = useRef(item),
    abort = useRef<AbortController | null>(null);
  latest.current = item;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => () => abort.current?.abort(), []);
  const filename = item.fileName || "",
    supported = /\.(pdf|docx|pptx)$/i.test(filename) && !!item.blob;
  if (!supported) return null;
  async function extract() {
    if (abort.current || !item.blob) return;
    if (item.blob.size > 6 * 1024 * 1024) {
      setError(c.large);
      return;
    }
    const request = new AbortController(),
      blob = item.blob,
      id = item.id;
    abort.current = request;
    setBusy(true);
    setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("INVALID_DOCUMENT"));
        reader.readAsDataURL(blob);
      });
      request.signal.throwIfAborted();
      const response = await fetch("/api/ingest-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, data }),
        signal: request.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "INVALID_DOCUMENT");
      if (
        request.signal.aborted ||
        latest.current.id !== id ||
        latest.current.blob !== blob
      )
        return;
      if (
        typeof result.text !== "string" ||
        !result.text.trim() ||
        result.text.length > 200000
      )
        throw new Error("INVALID_DOCUMENT");
      const evidence = parseSourceEvidence(result.sourceEvidence, result.text);
      update({
        ...latest.current,
        text: result.text,
        sourceEvidence: evidence,
      });
    } catch (e) {
      if (request.signal.aborted) return;
      const code = e instanceof Error ? e.message : "";
      setError(
        ["SIGN_IN_REQUIRED", "SESSION_REVOKED", "UNAUTHENTICATED"].includes(
          code,
        )
          ? c.signIn
          : code === "LOCAL_RATE_LIMIT"
            ? c.busyError
            : code === "DOCUMENT_COMPLEX_MATH"
              ? c.complex
              : code === "DOCUMENT_NO_TEXT"
                ? c.noText
                : /TOO_LARGE|TOO_MANY_PAGES/.test(code)
                  ? c.large
                  : c.error,
      );
    } finally {
      if (abort.current === request) {
        abort.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <section
      className="lm-card"
      data-document-extraction
      style={{ padding: 20, marginBottom: 18, borderRadius: 18 }}
    >
      <h3
        style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 0 }}
      >
        <FileSearch size={20} />
        {c.title}
      </h3>
      <p className="lm-help">{c.help}</p>
      <div className="lm-row">
        <button
          type="button"
          className="lm-button primary"
          disabled={busy}
          onClick={() => void extract()}
        >
          {busy ? (
            <LoaderCircle size={17} className="lm-spin" />
          ) : (
            <FileSearch size={17} />
          )}{" "}
          {busy ? c.busy : item.sourceEvidence ? c.again : c.button}
        </button>
        {busy && (
          <button
            type="button"
            className="lm-button"
            onClick={() => abort.current?.abort()}
          >
            <X size={16} />
            {c.cancel}
          </button>
        )}
      </div>
      {item.sourceEvidence && (
        <p className="lm-help" role="status">
          <ShieldCheck size={15} /> {c.ready} · {item.sourceEvidence.filename}
        </p>
      )}
      {item.text && <p className="lm-help">{c.edited}</p>}
      {error && (
        <p role="alert" className="lm-error">
          {error}
        </p>
      )}
    </section>
  );
}
