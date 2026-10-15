"use client";
import { useEffect, useRef, useState } from "react";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  ShieldCheck,
} from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import { syncCopy, friendlySyncError } from "../../lib/sync/copy";
import {
  normalizeSyncEnvelope,
  type SyncEnvelope,
  type SyncSnapshot,
} from "../../lib/sync/contracts";
import { mergeSync, type SyncChoice } from "../../lib/sync/merge";
type Cursor = {
  epoch: string;
  revision: number;
  base: SyncEnvelope;
  pending?: { requestId: string; data: SyncEnvelope };
};
export function SyncPanel({
  account,
  locale,
  value,
  onApply,
  disabled = false,
}: {
  account: string;
  locale: Locale;
  value: SyncEnvelope;
  onApply: (data: SyncEnvelope) => Promise<void>;
  disabled?: boolean;
}) {
  const c = syncCopy[locale],
    key = `lumio-sync-v3:${encodeURIComponent(account)}`;
  const [consent, setConsent] = useState(false),
    [status, setStatus] = useState("ready"),
    [conflicts, setConflicts] = useState<string[]>([]),
    [first, setFirst] = useState(false),
    [detail, setDetail] = useState("");
  const alive = useRef(true),
    controller = useRef<AbortController | null>(null),
    busy = useRef(false),
    latest = useRef({ value, onApply });
  latest.current = { value, onApply };
  useEffect(() => {
    alive.current = true;
    try {
      setConsent(localStorage.getItem(key + ":enabled") === "true");
    } catch {}
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, [key]);
  function readCursor(): Cursor | null {
    try {
      const v = JSON.parse(
        localStorage.getItem(key) || "null",
      ) as Cursor | null;
      if (
        v &&
        typeof v.epoch === "string" &&
        Number.isSafeInteger(v.revision) &&
        v.revision >= 0
      ) {
        v.base = normalizeSyncEnvelope(v.base);
        if (v.pending) v.pending.data = normalizeSyncEnvelope(v.pending.data);
        return v;
      }
    } catch {}
    return null;
  }
  function saveCursor(cursor: Cursor) {
    localStorage.setItem(key, JSON.stringify(cursor));
  }
  function backup() {
    const blob = new Blob(
        [JSON.stringify(normalizeSyncEnvelope(latest.current.value), null, 2)],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "lumio-study-snapshot.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function run(choice?: SyncChoice) {
    if (!consent || account === "guest" || disabled || busy.current) return;
    busy.current = true;
    setDetail("");
    setStatus("busy");
    controller.current = new AbortController();
    try {
      const local = normalizeSyncEnvelope(latest.current.value);
      let cursor = readCursor();
      const request = (path: string, options: RequestInit = {}) =>
        fetch(path, {
          ...options,
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.current!.signal,
          headers: { "X-Lumio-Account": account, ...options.headers },
        });
      if (!navigator.onLine) {
        saveCursor(
          cursor
            ? {
                ...cursor,
                pending: { requestId: crypto.randomUUID(), data: local },
              }
            : {
                epoch: "pending-first",
                revision: 0,
                base: local,
                pending: { requestId: crypto.randomUUID(), data: local },
              },
        );
        setStatus("offline");
        return;
      }
      // Replay the identical operation before reading newer state after a lost ACK.
      // A server-side idempotency record prevents a second write.
      if (cursor?.pending && cursor.epoch !== "pending-first") {
        const replay = await request("/api/sync", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            epoch: cursor.epoch,
            expectedRevision: cursor.revision,
            requestId: cursor.pending.requestId,
            data: cursor.pending.data,
          }),
        });
        const ack = (await replay.json()) as {
          epoch: string;
          revision: number;
          error?: string;
        };
        // A server ACK proves only that the server accepted this operation.
        // Local application may have failed or never run after a lost response.
        // Keep the last successfully APPLIED base until onApply completes;
        // otherwise unapplied remote records would look like local deletions.
        if (
          !replay.ok &&
          (replay.status !== 409 || ack.error !== "SYNC_CONFLICT")
        )
          throw Error(ack.error || "SYNC_UNAVAILABLE");
      }
      const response = await request("/api/sync");
      const snapshot = (await response.json()) as SyncSnapshot & {
        error?: string;
      };
      if (!response.ok) throw Error(snapshot.error || "SYNC_UNAVAILABLE");
      if (!alive.current) return;
      let data = local,
        mergeConflicts: string[] = [];
      if (snapshot.data) {
        const remote = normalizeSyncEnvelope(snapshot.data);
        if (cursor && cursor.epoch === snapshot.epoch) {
          const merged = mergeSync(cursor.base, local, remote, choice);
          data = merged.data;
          mergeConflicts = merged.conflicts;
        } else if (!choice) {
          setFirst(true);
          setConflicts([]);
          setStatus("conflict");
          return;
        } else data = choice === "remote" ? remote : local;
      } else if (
        cursor &&
        cursor.epoch !== snapshot.epoch &&
        cursor.epoch !== "pending-first" &&
        !choice
      ) {
        setFirst(true);
        setConflicts([]);
        setStatus("conflict");
        return;
      }
      if (mergeConflicts.length && !choice) {
        setFirst(false);
        setConflicts(mergeConflicts);
        setStatus("conflict");
        return;
      }
      // A newer edit must trigger a fresh comparison, never be replaced by a stale result.
      if (
        JSON.stringify(normalizeSyncEnvelope(latest.current.value)) !==
        JSON.stringify(local)
      )
        throw Error("SYNC_LOCAL_CHANGED");
      if (
        snapshot.data &&
        JSON.stringify(data) ===
          JSON.stringify(normalizeSyncEnvelope(snapshot.data))
      ) {
        await latest.current.onApply(data);
        if (!alive.current) return;
        saveCursor({
          epoch: snapshot.epoch,
          revision: snapshot.revision,
          base: data,
        });
        setConflicts([]);
        setFirst(false);
        setStatus("done");
        return;
      }
      const pending = cursor?.pending;
      const requestId =
        pending &&
        cursor &&
        cursor.epoch === snapshot.epoch &&
        cursor.revision === snapshot.revision &&
        JSON.stringify(pending.data) === JSON.stringify(data)
          ? pending.requestId
          : crypto.randomUUID();
      const next: Cursor = {
        epoch: snapshot.epoch,
        revision: snapshot.revision,
        base: cursor?.epoch === snapshot.epoch ? cursor.base : local,
        pending: { requestId, data },
      };
      saveCursor(next);
      const written = await request("/api/sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          epoch: snapshot.epoch,
          expectedRevision: snapshot.revision,
          requestId,
          data,
        }),
      });
      const result = (await written.json()) as {
        epoch: string;
        revision: number;
        error?: string;
      };
      if (!written.ok) throw Error(result.error || "SYNC_UNAVAILABLE");
      if (!alive.current) return;
      if (
        JSON.stringify(normalizeSyncEnvelope(latest.current.value)) !==
        JSON.stringify(local)
      )
        throw Error("SYNC_LOCAL_CHANGED");
      await latest.current.onApply(data);
      if (!alive.current) return;
      saveCursor({
        epoch: result.epoch,
        revision: result.revision,
        base: data,
      });
      setConflicts([]);
      setFirst(false);
      setStatus("done");
    } catch (e) {
      if (alive.current) {
        setStatus(navigator.onLine ? "error" : "offline");
        setDetail(e instanceof Error ? e.message : "SYNC_UNAVAILABLE");
      }
    } finally {
      busy.current = false;
    }
  }
  const retry = useRef(run);
  retry.current = run;
  async function erase() {
    if (busy.current || account === "guest" || !window.confirm(c.deleteConfirm))
      return;
    busy.current = true;
    setStatus("busy");
    try {
      const headers = { "X-Lumio-Account": account },
        r = await fetch("/api/sync", { headers, cache: "no-store" }),
        s = (await r.json()) as SyncSnapshot & { error?: string };
      if (!r.ok) throw Error(s.error || "SYNC_UNAVAILABLE");
      const deleted = await fetch("/api/sync", {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ epoch: s.epoch, revision: s.revision }),
      });
      if (!deleted.ok) throw Error("SYNC_CONFLICT");
      if (!alive.current) return;
      localStorage.removeItem(key);
      localStorage.setItem(key + ":enabled", "false");
      setConsent(false);
      setConflicts([]);
      setStatus("ready");
    } catch (e) {
      if (alive.current) {
        setStatus("error");
        setDetail(e instanceof Error ? e.message : "SYNC_UNAVAILABLE");
      }
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    if (!consent) return;
    const online = () => {
      if (readCursor()?.pending) void retry.current();
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [consent, key]);
  return (
    <section className="lm-panel lm-sync-panel" data-sync-panel>
      <div className="lm-row">
        <Cloud size={22} />
        <h3>{c.title}</h3>
      </div>
      <p className="lm-help">{c.detail}</p>
      <label className="lm-sync-consent">
        <input
          type="checkbox"
          checked={consent}
          disabled={account === "guest" || disabled || status === "busy"}
          onChange={(e) => {
            const enabled = e.target.checked;
            setConsent(enabled);
            controller.current?.abort();
            try {
              localStorage.setItem(key + ":enabled", String(enabled));
            } catch {}
            if (!enabled) setStatus("ready");
          }}
        />
        {c.consent}
      </label>
      <p role="status" className="lm-help">
        {account === "guest"
          ? c.signin
          : !consent
            ? c.paused
            : status === "done"
              ? c.done
              : status === "offline"
                ? c.offline
                : status === "busy"
                  ? c.busy
                  : status === "conflict"
                    ? c.conflict
                    : status === "error"
                      ? c.error
                      : c.ready}
        {status === "error" && detail && (
          <span> {friendlySyncError(detail, locale)}</span>
        )}
      </p>
      {status === "conflict" && (
        <div className="lm-sync-conflict">
          {first ? (
            <p>{c.first}</p>
          ) : (
            <ul>
              {conflicts.slice(0, 8).map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          )}
          <button className="lm-button" onClick={backup}>
            <Download size={15} />
            {c.backup}
          </button>
          <div className="lm-row">
            <button className="lm-button" onClick={() => void run("local")}>
              {c.local}
            </button>
            <button className="lm-button" onClick={() => void run("remote")}>
              {c.remote}
            </button>
          </div>
        </div>
      )}
      <div className="lm-row">
        <button
          className="lm-button primary"
          disabled={
            !consent || account === "guest" || disabled || status === "busy"
          }
          onClick={() => void run()}
        >
          <RefreshCw size={16} />
          {c.sync}
        </button>
        <button
          className="lm-button"
          disabled={account === "guest" || disabled || status === "busy"}
          onClick={() => void erase()}
        >
          <CloudOff size={16} />
          {c.delete}
        </button>
      </div>
      <p className="lm-help">
        <ShieldCheck size={13} /> {c.accountBound}
      </p>
    </section>
  );
}
