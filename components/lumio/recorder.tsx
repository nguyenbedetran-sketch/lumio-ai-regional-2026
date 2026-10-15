"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square } from "lucide-react";
import type { Messages } from "../../lib/lumio/i18n";
export function Recorder({
  t,
  onSave,
}: {
  t: Messages;
  onSave: (blob: Blob) => void;
}) {
  const rec = useRef<MediaRecorder | null>(null),
    mounted = useRef(true),
    requesting = useRef(false),
    stream = useRef<MediaStream | null>(null),
    chunks = useRef<Blob[]>([]),
    bytes = useRef(0),
    [status, setStatus] = useState<"idle" | "recording" | "paused" | "stopped">(
      "idle",
    ),
    [seconds, setSeconds] = useState(0),
    [audio, setAudio] = useState<Blob | null>(null),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (rec.current?.state !== "inactive") rec.current?.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    if (!audio) return;
    const u = URL.createObjectURL(audio);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [audio]);
  useEffect(() => {
    if (status !== "recording") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);
  useEffect(() => {
    if (seconds >= 600 && status === "recording") {
      rec.current?.stop();
      setError(t.maxRecording);
    }
  }, [seconds, status, t.maxRecording]);
  async function start() {
    if (requesting.current) return;
    requesting.current = true;
    setError("");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error();
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current) {
        stream.current.getTracks().forEach((track) => track.stop());
        return;
      }
      const r = new MediaRecorder(stream.current);
      rec.current = r;
      chunks.current = [];
      bytes.current = 0;
      setAudio(null);
      setSeconds(0);
      r.ondataavailable = (e) => {
        if (e.data.size) {
          chunks.current.push(e.data);
          bytes.current += e.data.size;
          if (bytes.current >= 30 * 1024 * 1024 && r.state !== "inactive") {
            r.stop();
            setError(t.maxRecording);
          }
        }
      };
      r.onstop = () => {
        if (!mounted.current) return;
        setAudio(new Blob(chunks.current, { type: r.mimeType }));
        stream.current?.getTracks().forEach((track) => track.stop());
        setStatus("stopped");
      };
      r.onerror = () => {
        setError(t.recordError);
        stream.current?.getTracks().forEach((track) => track.stop());
        setStatus("idle");
      };
      r.start(1000);
      setStatus("recording");
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      setError(t.recordError);
    } finally {
      requesting.current = false;
    }
  }
  return (
    <div className="lm-record">
      <div className={`lm-record-orb ${status === "recording" ? "live" : ""}`}>
        <Mic size={35} />
      </div>
      <strong className="lm-timer">
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:
        {String(seconds % 60).padStart(2, "0")}
      </strong>
      <p>{t.recordHint}</p>
      {error && (
        <p className="lm-error" role="alert">
          {error}
        </p>
      )}
      <div className="lm-row lm-center">
        {["idle", "stopped"].includes(status) ? (
          <button className="lm-button primary" onClick={start}>
            <Mic size={17} />
            {t.recordStart}
          </button>
        ) : (
          <>
            <button
              className="lm-button"
              onClick={() => {
                if (status === "recording") {
                  rec.current?.pause();
                  setStatus("paused");
                } else {
                  rec.current?.resume();
                  setStatus("recording");
                }
              }}
            >
              {status === "recording" ? (
                <Pause size={17} />
              ) : (
                <Play size={17} />
              )}{" "}
              {status === "recording" ? t.pause : t.resume}
            </button>
            <button className="lm-button" onClick={() => rec.current?.stop()}>
              <Square size={17} />
              {t.stop}
            </button>
          </>
        )}
      </div>
      {audio && (
        <>
          <audio controls src={url} />
          <button className="lm-button primary" onClick={() => onSave(audio)}>
            {t.recordSave}
          </button>
        </>
      )}
    </div>
  );
}
