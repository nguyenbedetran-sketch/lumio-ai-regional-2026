"use client";
import { useEffect, useState } from "react";
import {
  MOTION_STORAGE_KEY,
  parseMotionPreference,
  resolveMotionMode,
  type MotionMode,
} from "../../lib/lumio/motion-policy";

export function useMotionSettings() {
  const [preference, setPreference] = useState<MotionMode>("full");
  const [systemReduced, setSystemReduced] = useState(true);
  const [ready, setReady] = useState(false);
  const [stored, setStored] = useState(true);
  useEffect(() => {
    try {
      setPreference(
        parseMotionPreference(localStorage.getItem(MOTION_STORAGE_KEY)),
      );
    } catch {}
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(media.matches);
    const storage = (event: StorageEvent) => {
      if (event.key === MOTION_STORAGE_KEY || event.key === null) {
        try {
          setPreference(
            parseMotionPreference(localStorage.getItem(MOTION_STORAGE_KEY)),
          );
        } catch {}
      }
    };
    update();
    setReady(true);
    media.addEventListener("change", update);
    window.addEventListener("storage", storage);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("storage", storage);
    };
  }, []);
  const mode = resolveMotionMode(preference, systemReduced);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.motion = mode;
    window.dispatchEvent(new CustomEvent("lumio:motion", { detail: { mode } }));
    try {
      localStorage.setItem(MOTION_STORAGE_KEY, preference);
      setStored(true);
    } catch {
      setStored(false);
    }
  }, [mode, preference, ready]);
  return { preference, mode, systemReduced, stored, setPreference };
}

/** React to preferences without creating a second persisted settings owner. */
export function useEffectiveMotion(): MotionMode {
  const [mode, setMode] = useState<MotionMode>("off");
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setMode(
        resolveMotionMode(
          parseMotionPreference(document.documentElement.dataset.motion),
          media.matches,
        ),
      );
    update();
    media.addEventListener("change", update);
    window.addEventListener("lumio:motion", update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("lumio:motion", update);
    };
  }, []);
  return mode;
}
