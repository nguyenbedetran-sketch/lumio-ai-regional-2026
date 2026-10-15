"use client";
import { useEffect, type RefObject } from "react";
import { animate } from "motion/mini";
import type { MotionMode } from "../../lib/lumio/motion-policy";

/** Animate visible DOM, with no delayed mounts or hidden fallback styles. */
export function useSurfaceEntrance(
  ref: RefObject<HTMLElement | null>,
  identity: string,
  mode: MotionMode,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element || mode === "off" || document.hidden) return;
    let animation: ReturnType<typeof animate> | undefined;
    const settle = () => {
      animation?.cancel();
      element.style.opacity = "1";
      element.style.transform = "none";
    };
    try {
      animation = animate(
        element,
        mode === "full"
          ? { opacity: [0.86, 1], transform: ["translateY(9px)", "none"] }
          : { opacity: [0.92, 1] },
        { duration: mode === "full" ? 0.3 : 0.14, ease: "easeOut" },
      );
    } catch {
      settle();
    }
    const timer = window.setTimeout(settle, 420);
    const visibility = () => {
      if (document.hidden) settle();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
      settle();
    };
  }, [ref, identity, mode]);
}
