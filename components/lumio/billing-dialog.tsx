"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { containDialogFocus } from "../shared/dialog-focus";

/** Billing review contains no saved draft; calculator edits stay ephemeral. */
export function BillingDialog({
  title,
  label,
  close,
  children,
}: {
  title: string;
  label: string;
  close: () => void;
  children: ReactNode;
}) {
  const heading = useId(),
    ref = useRef<HTMLDialogElement>(null),
    [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setTarget(document.body), []);
  useEffect(() => {
    const dialog = ref.current;
    if (!target || !dialog) return;
    const previous =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [target]);
  if (!target) return null;
  return createPortal(
    <dialog
      ref={ref}
      className="lm-billing-dialog"
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={containDialogFocus}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          close();
      }}
    >
      <header className="lm-billing-dialog-head">
        <h2 id={heading}>{title}</h2>
        <button
          type="button"
          className="lm-icon"
          aria-label={label}
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>,
    target,
  );
}
