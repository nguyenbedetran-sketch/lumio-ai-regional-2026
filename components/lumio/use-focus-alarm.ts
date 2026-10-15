"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultAlarm,
  type AlarmSettings,
} from "../../lib/lumio/learning-engine";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
type AlarmStatus =
  | "ready"
  | "playing"
  | "blocked"
  | "missing"
  | "invalid"
  | "storage"
  | "loading";
type SavedAudio = { blob: Blob; name: string };

function audioStore(
  account: string,
  change?: SavedAudio | null,
): Promise<SavedAudio | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lumio-focus-audio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("alarms");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(
        "alarms",
        change === undefined ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("alarms");
      const operation =
        change === undefined
          ? store.get(account)
          : change === null
            ? store.delete(account)
            : store.put(change, account);
      let result: SavedAudio | undefined;
      operation.onsuccess = () => {
        result = operation.result as SavedAudio | undefined;
      };
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

/** Audio is generated locally. A selected file is kept as a bounded Blob, never a data URL. */
export function useFocusAlarm(
  account: string,
  settings: AlarmSettings = defaultAlarm,
) {
  const [status, setStatus] = useState<AlarmStatus>("ready");
  const [customName, setCustomName] = useState("");
  const context = useRef<AudioContext | null>(null);
  const custom = useRef<SavedAudio | null>(null);
  const decoded = useRef<AudioBuffer | null>(null);
  const sources = useRef<AudioScheduledSourceNode[]>([]);
  const outputGain = useRef<GainNode | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const playback = useRef(0);
  const prefs = useRef(settings);
  prefs.current = settings;

  const stop = useCallback(() => {
    playback.current++;
    for (const source of sources.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    sources.current = [];
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    outputGain.current?.disconnect();
    outputGain.current = null;
    setStatus("ready");
  }, []);
  const getContext = useCallback(() => {
    if (!context.current || context.current.state === "closed")
      context.current = new AudioContext();
    return context.current;
  }, []);
  const unlock = useCallback(async () => {
    try {
      const ctx = getContext();
      if (ctx.state !== "running") await ctx.resume();
      if (ctx.state !== "running") {
        setStatus("blocked");
        return false;
      }
      setStatus("ready");
      return true;
    } catch {
      setStatus("blocked");
      return false;
    }
  }, [getContext]);
  const canPlay = useCallback(
    () =>
      prefs.current.preset === "silent" ||
      prefs.current.volume === 0 ||
      context.current?.state === "running",
    [],
  );
  const reportBlocked = useCallback(() => setStatus("blocked"), []);

  useEffect(() => {
    const token = ++generation.current;
    custom.current = null;
    decoded.current = null;
    setCustomName("");
    audioStore(account)
      .then((saved) => {
        if (generation.current !== token) return;
        if (saved?.blob instanceof Blob && saved.blob.size <= MAX_AUDIO_BYTES) {
          custom.current = saved;
          setCustomName(saved.name);
        }
      })
      .catch(() => {
        if (generation.current === token) setStatus("storage");
      });
    return () => {
      generation.current++;
      stop();
      void context.current?.close().catch(() => {});
      context.current = null;
    };
  }, [account, stop]);

  const play = useCallback(
    async (preview = false) => {
      stop();
      const playId = playback.current;
      const options = prefs.current;
      if (options.preset === "silent" || options.volume === 0) {
        setStatus("ready");
        return;
      }
      try {
        const ctx = getContext();
        // Only a user gesture (Start/Preview) may unlock. Completion must not silently bypass a browser block.
        if (preview && ctx.state !== "running") await ctx.resume();
        if (playId !== playback.current) return;
        if (ctx.state !== "running") {
          setStatus("blocked");
          return;
        }
        const output = ctx.createGain();
        outputGain.current = output;
        output.gain.value = options.volume * 0.4;
        output.connect(ctx.destination);
        let duration = 3;
        if (options.preset === "custom") {
          if (!custom.current) {
            output.disconnect();
            setStatus("missing");
            return;
          }
          if (!decoded.current)
            decoded.current = await ctx.decodeAudioData(
              await custom.current.blob.arrayBuffer(),
            );
          if (playId !== playback.current) {
            output.disconnect();
            return;
          }
          const source = ctx.createBufferSource();
          source.buffer = decoded.current;
          source.connect(output);
          duration = Math.min(preview ? 5 : 8, decoded.current.duration);
          source.start();
          source.stop(ctx.currentTime + duration);
          sources.current.push(source);
        } else {
          const notes =
            options.preset === "bell"
              ? [523.25, 659.25, 783.99]
              : options.preset === "forest"
                ? [392, 523.25, 440, 659.25]
                : [659.25, 880, 1046.5];
          notes.forEach((note, index) => {
            const oscillator = ctx.createOscillator(),
              envelope = ctx.createGain();
            const begin = ctx.currentTime + index * 0.32;
            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(note, begin);
            if (options.preset === "forest")
              oscillator.frequency.exponentialRampToValueAtTime(
                note * 1.08,
                begin + 0.12,
              );
            envelope.gain.setValueAtTime(0, begin);
            envelope.gain.linearRampToValueAtTime(0.7, begin + 0.015);
            envelope.gain.exponentialRampToValueAtTime(0.001, begin + 1.15);
            oscillator.connect(envelope);
            envelope.connect(output);
            oscillator.start(begin);
            oscillator.stop(begin + 1.2);
            oscillator.onended = () => {
              oscillator.disconnect();
              envelope.disconnect();
            };
            sources.current.push(oscillator);
          });
        }
        setStatus("playing");
        timeout.current = setTimeout(
          () => {
            stop();
            output.disconnect();
            setStatus("ready");
          },
          (duration + 0.1) * 1000,
        );
      } catch {
        if (playId !== playback.current) return;
        stop();
        setStatus(prefs.current.preset === "custom" ? "invalid" : "blocked");
      }
    },
    [getContext, stop],
  );

  const saveCustom = useCallback(
    async (file: File) => {
      stop();
      if (
        !file.size ||
        file.size > MAX_AUDIO_BYTES ||
        (!file.type.startsWith("audio/") &&
          !/\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(file.name))
      ) {
        setStatus("invalid");
        return false;
      }
      const token = generation.current;
      setStatus("loading");
      try {
        const buffer = await getContext().decodeAudioData(
          await file.arrayBuffer(),
        );
        if (
          !Number.isFinite(buffer.duration) ||
          buffer.duration <= 0 ||
          buffer.duration > 120
        ) {
          setStatus("invalid");
          return false;
        }
        const value = {
          blob: file.slice(0, file.size, file.type),
          name: file.name.slice(0, 180),
        };
        try {
          await audioStore(account, value);
        } catch {
          setStatus("storage");
          return false;
        }
        if (generation.current !== token) return false;
        custom.current = value;
        decoded.current = buffer;
        setCustomName(value.name);
        setStatus("ready");
        return true;
      } catch {
        setStatus("invalid");
        return false;
      }
    },
    [account, getContext, stop],
  );
  const removeCustom = useCallback(async () => {
    stop();
    try {
      await audioStore(account, null);
      custom.current = null;
      decoded.current = null;
      setCustomName("");
      setStatus("ready");
      return true;
    } catch {
      setStatus("storage");
      return false;
    }
  }, [account, stop]);
  return {
    status,
    customName,
    unlock,
    play,
    saveCustom,
    removeCustom,
    stop,
    canPlay,
    reportBlocked,
  };
}
export type FocusAlarm = ReturnType<typeof useFocusAlarm>;
