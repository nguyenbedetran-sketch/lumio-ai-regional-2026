"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import type { TeachingFile } from "../../lib/teaching/contracts";
import {
  encodeTeachingFile,
  teachingFileError,
  teachingFilesForTarget,
  TEACHING_FILE_ACCEPT,
  uploadTeachingFile,
  validTeachingFile,
  type TeachingFileTarget,
} from "../../lib/teaching/file-client";
import type { TeachingClient } from "./client";

export function FileAttachments({
  client,
  target,
  allowUpload = false,
  submissionId,
  onSelection,
  onBusy,
  onUnconfirmed,
}: {
  client: TeachingClient;
  target: TeachingFileTarget;
  allowUpload?: boolean;
  submissionId?: string;
  onSelection?: (ids: string[]) => void;
  onBusy?: (busy: boolean) => void;
  onUnconfirmed?: (unconfirmed: boolean) => void;
}) {
  const account = client.data?.actor.accountKey || "",
    orgId = client.data?.organization?.id || "";
  const scope = `${account}:${orgId}:${target.kind}:${target.id}:${submissionId || ""}`;
  const latest = useRef(scope),
    active = useRef(true),
    controller = useRef<AbortController | null>(null),
    selected = useRef<{
      scope: string;
      file: File;
      requestId: string;
      visibility: "reference" | "teacher-only";
      dataBase64?: string;
    } | null>(null);
  latest.current = scope;
  const [local, setLocal] = useState<{
      scope: string;
      files: TeachingFile[];
      removed: string[];
    }>({ scope, files: [], removed: [] }),
    [candidate, setCandidate] = useState<{
      scope: string;
      name: string;
      bytes: number;
    } | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [visibility, setVisibility] = useState<"reference" | "teacher-only">(
      "reference",
    );
  const callbacks = useRef({ onSelection, onBusy, onUnconfirmed });
  callbacks.current = { onSelection, onBusy, onUnconfirmed };
  const labelId = useId(),
    input = useRef<HTMLInputElement>(null);
  const scopedLocal: { files: TeachingFile[]; removed: string[] } =
    local.scope === scope ? local : { files: [], removed: [] };
  const files = teachingFilesForTarget(
    [
      ...new Map(
        [...(client.data?.files || []), ...scopedLocal.files]
          .filter((file) => !scopedLocal.removed.includes(file.id))
          .map((file) => [file.id, file]),
      ).values(),
    ],
    target,
    submissionId,
  );
  const ids = files
      .filter((file) => file.status === "pending")
      .map((file) => file.id),
    signature = ids.join(",");
  useEffect(() => {
    callbacks.current.onSelection?.(ids);
  }, [scope, signature]);
  useEffect(() => {
    active.current = true;
    setError("");
    setNotice("");
    setBusy("");
    setCandidate(null);
    selected.current = null;
    return () => {
      active.current = false;
      controller.current?.abort();
      callbacks.current.onBusy?.(false);
    };
  }, [scope]);
  useEffect(() => {
    callbacks.current.onUnconfirmed?.(candidate?.scope === scope);
  }, [scope, candidate]);
  const current = (snapshot: string, signal?: AbortSignal) =>
    active.current && latest.current === snapshot && !signal?.aborted;
  const operation = async (
    kind: string,
    fn: (signal: AbortSignal, snapshot: string) => Promise<void>,
  ) => {
    if (controller.current || !account || !orgId) return;
    const snapshot = scope,
      request = new AbortController();
    controller.current = request;
    setBusy(kind);
    setError("");
    setNotice("");
    callbacks.current.onBusy?.(true);
    try {
      await fn(request.signal, snapshot);
    } catch (e) {
      if (current(snapshot, request.signal))
        setError(e instanceof Error ? e.message : teachingFileError(null));
    } finally {
      if (controller.current === request) controller.current = null;
      if (current(snapshot)) {
        setBusy("");
        callbacks.current.onBusy?.(false);
      }
    }
  };
  const upload = () =>
    operation("upload", async (signal, snapshot) => {
      const pending = selected.current;
      if (!pending || pending.scope !== snapshot) return;
      if (!pending.dataBase64)
        pending.dataBase64 = encodeTeachingFile(
          new Uint8Array(await pending.file.arrayBuffer()),
        );
      if (!current(snapshot, signal)) return;
      const file = await uploadTeachingFile(
        account,
        {
          requestId: pending.requestId,
          orgId,
          target,
          visibility: pending.visibility,
          filename: pending.file.name,
          dataBase64: pending.dataBase64,
        },
        pending.file.size,
        signal,
      );
      if (!current(snapshot, signal)) return;
      setLocal((previous) => ({
        scope: snapshot,
        files: [
          ...(previous.scope === snapshot ? previous.files : []).filter(
            (row) => row.id !== file.id,
          ),
          file,
        ],
        removed: previous.scope === snapshot ? previous.removed : [],
      }));
      if (target.kind === "submission")
        callbacks.current.onSelection?.([...new Set([...ids, file.id])]);
      setNotice(
        file.status === "pending"
          ? "Máy chủ đã lưu tệp chờ. Bài làm CHƯA được nộp; kiểm tra và bấm Nộp bài để hoàn tất."
          : "Máy chủ đã lưu tệp đính kèm.",
      );
      selected.current = null;
      setCandidate(null);
      callbacks.current.onUnconfirmed?.(false);
      if (input.current) input.current.value = "";
      if (target.kind !== "submission") await client.reload();
    });
  const remove = (file: TeachingFile) =>
    operation("delete:" + file.id, async (signal, snapshot) => {
      const response = await fetch(
          "/api/teaching/files/" + encodeURIComponent(file.id),
          { method: "DELETE", headers: { "X-Lumio-Account": account }, signal },
        ),
        body = await response.json().catch(() => ({}));
      if (!response.ok || body.deleted !== true)
        throw Error(teachingFileError(body.error));
      if (!current(snapshot, signal)) return;
      setLocal((previous) => ({
        scope: snapshot,
        files: previous.scope === snapshot ? previous.files : [],
        removed: [
          ...(previous.scope === snapshot ? previous.removed : []),
          file.id,
        ],
      }));
      callbacks.current.onSelection?.(ids.filter((id) => id !== file.id));
      setNotice("Máy chủ đã xác nhận xóa tệp này.");
      if (target.kind !== "submission") await client.reload();
    });
  const download = (file: TeachingFile) =>
    operation("download:" + file.id, async (signal, snapshot) => {
      const response = await fetch(
        "/api/teaching/files/" + encodeURIComponent(file.id),
        { headers: { "X-Lumio-Account": account }, cache: "no-store", signal },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw Error(teachingFileError(body.error));
      }
      const blob = await response.blob();
      if (!current(snapshot, signal)) return;
      if (blob.size !== file.bytes) throw Error(teachingFileError(null));
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Đã nhận tệp từ máy chủ và yêu cầu trình duyệt tải xuống.");
    });
  return (
    <section
      className="tw-note tw-file-attachments"
      aria-labelledby={labelId}
      aria-busy={!!busy}
      data-file-attachments
    >
      <h4 id={labelId}>Tệp đính kèm</h4>
      {allowUpload && (
        <>
          <p>
            PDF, DOCX, PPTX, PNG, JPEG, WebP, TXT hoặc MD · tối đa 1 MiB/tệp, 3
            tệp/bài, 20 MiB/tổ chức. Tệp lớn dùng liên kết học liệu. Tệp được
            lưu trên máy chủ cho người có quyền xem, không tự gửi đến AI.
          </p>
          {target.kind === "submission" && (
            <p>
              Tệp chờ hết hạn sau 24 giờ nếu chưa nộp cùng bài. Sau khi nộp, tệp
              được giữ cùng bản bài làm đã gửi.
            </p>
          )}
          {target.kind !== "submission" && (
            <label className="tw-field">
              Quyền xem tệp mới
              <select
                value={visibility}
                disabled={!!candidate || !!busy}
                onChange={(e) =>
                  setVisibility(e.target.value as typeof visibility)
                }
              >
                <option value="reference">
                  Tài liệu tham khảo · chia sẻ khi nội dung được công bố
                </option>
                <option value="teacher-only">
                  Nội bộ giáo viên · đáp án / rubric
                </option>
              </select>
            </label>
          )}
          <label className="tw-field">
            Chọn tệp để chuẩn bị tải
            <input
              ref={input}
              type="file"
              accept={TEACHING_FILE_ACCEPT}
              disabled={!!busy || client.busy || files.length >= 3}
              onChange={(e) => {
                const file = e.target.files?.[0];
                setError("");
                setNotice("");
                if (!file) {
                  selected.current = null;
                  setCandidate(null);
                  return;
                }
                if (!validTeachingFile(file)) {
                  selected.current = null;
                  setCandidate(null);
                  setError("Chọn định dạng được hỗ trợ, từ 1 byte đến 1 MiB.");
                  e.target.value = "";
                  return;
                }
                selected.current = {
                  scope,
                  file,
                  requestId: crypto.randomUUID(),
                  visibility,
                };
                setCandidate({ scope, name: file.name, bytes: file.size });
              }}
            />
          </label>
          {candidate?.scope === scope && (
            <p>
              {candidate.name} · {candidate.bytes.toLocaleString("vi-VN")} byte
              · mới chọn, chưa xác nhận lưu trên máy chủ.
            </p>
          )}
          {candidate?.scope === scope && (
            <button
              type="button"
              className="tw-text-button"
              disabled={!!busy}
              onClick={() => {
                selected.current = null;
                setCandidate(null);
                callbacks.current.onUnconfirmed?.(false);
                if (input.current) input.current.value = "";
                setError("");
              }}
            >
              Bỏ tệp đang chọn
            </button>
          )}
          <button
            type="button"
            className="tw-button"
            disabled={
              !candidate || candidate.scope !== scope || !!busy || client.busy
            }
            onClick={() => void upload()}
          >
            <Upload size={15} />
            {error ? "Thử tải lại cùng tệp" : "Tải tệp lên máy chủ"}
          </button>
        </>
      )}
      {!!busy && (
        <p role="status" aria-live="polite">
          {busy === "upload"
            ? "Đang gửi tệp; chờ máy chủ xác nhận…"
            : busy.startsWith("download")
              ? "Đang tải tệp từ máy chủ…"
              : "Đang yêu cầu xóa tệp…"}
          <progress aria-label="Đang xử lý tệp" />
        </p>
      )}
      {!!error && (
        <p className="tw-alert" role="alert">
          {error}
        </p>
      )}
      {!!notice && (
        <p role="status" aria-live="polite">
          {notice}
        </p>
      )}
      {!files.length && (
        <p>Chưa có tệp được máy chủ xác nhận cho nội dung này.</p>
      )}
      {!!files.length && (
        <ul>
          {files.map((file) => (
            <li key={file.id}>
              <span style={{ overflowWrap: "anywhere" }}>{file.name}</span> ·{" "}
              {file.bytes.toLocaleString("vi-VN")} byte ·{" "}
              {file.status === "pending"
                ? "Đã lưu, chờ nộp cùng bài"
                : file.purpose === "teacher-only"
                  ? "Nội bộ giáo viên"
                  : "Đã đính kèm"}
              {file.submissionRevision !== undefined && (
                <span> · Bản nộp {file.submissionRevision}</span>
              )}
              <div className="tw-card-actions">
                <button
                  type="button"
                  className="tw-text-button"
                  disabled={!!busy}
                  onClick={() => void download(file)}
                >
                  <Download size={14} />
                  Tải {file.name}
                </button>
                {allowUpload && (
                  <button
                    type="button"
                    className="tw-text-button"
                    disabled={!!busy || client.busy}
                    onClick={() => void remove(file)}
                  >
                    <Trash2 size={14} />
                    Xóa tệp
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
