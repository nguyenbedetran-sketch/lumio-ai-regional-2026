"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useEffectiveMotion } from "./use-motion-settings";
import { useSurfaceEntrance } from "./use-surface-entrance";
import { useDraft } from "../shared/draft-guard";
export function Dialog({
  title,
  close,
  label,
  children,
}: {
  title: string;
  close: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const draft = useDraft(title);
  const requestClose = () => draft.close(close);
  const mode = useEffectiveMotion();
  useSurfaceEntrance(ref, "dialog", mode);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current
      ?.querySelector<HTMLElement>("button,input,textarea,select")
      ?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="lm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={ref}
        className="lm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onChangeCapture={draft.markDirty}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            requestClose();
          }
          if (e.key === "Tab") {
            const nodes = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                "button:not([disabled]),input:not([disabled]),textarea,select,a[href]",
              ),
            );
            if (e.shiftKey && document.activeElement === nodes[0]) {
              e.preventDefault();
              nodes.at(-1)?.focus();
            } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
              e.preventDefault();
              nodes[0]?.focus();
            }
          }
        }}
      >
        <div className="lm-dialog-head">
          <h2>{title}</h2>
          <button className="lm-icon" aria-label={label} onClick={requestClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
