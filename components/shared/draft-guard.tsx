"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { containDialogFocus } from "./dialog-focus";

export type DraftEntry = { label: string; dirty: boolean; reset: () => void };
export type DraftGuard = {
  register: (id: string, entry: DraftEntry | null) => void;
  leave: (action: () => void, only?: string) => boolean;
};
const DraftContext = createContext<DraftGuard>({
  register: () => {},
  leave: (action) => {
    action();
    return true;
  },
});

/** Keeps only dirty flags in memory, never copies private form content to storage. */
export type DraftBoundaryCopy = {
  title: string;
  description: (labels: readonly string[]) => ReactNode;
  keep: string;
  leave: string;
};
export type DraftBoundaryStyles = {
  boundary?: string;
  dialog?: string;
  actions?: string;
  keep?: string;
  leave?: string;
};
export function DraftBoundary({
  children,
  copy,
  styles = {},
  captureLinks = true,
}: {
  children: ReactNode;
  copy: DraftBoundaryCopy;
  styles?: DraftBoundaryStyles;
  captureLinks?: boolean;
}) {
  const labelId = useId();
  const entries = useRef(new Map<string, DraftEntry>()),
    dialog = useRef<HTMLDialogElement>(null),
    [pending, setPending] = useState<{
      action: () => void;
      ids: string[];
      labels: string[];
    } | null>(null);
  const register = useCallback((id: string, entry: DraftEntry | null) => {
    if (entry) entries.current.set(id, entry);
    else entries.current.delete(id);
  }, []);
  const leave = useCallback((action: () => void, only?: string) => {
    const dirty = [...entries.current].filter(
      ([id, entry]) => entry.dirty && (!only || only === id),
    );
    if (!dirty.length) {
      action();
      return true;
    }
    setPending({
      action,
      ids: dirty.map(([id]) => id),
      labels: [...new Set(dirty.map(([, e]) => e.label))],
    });
    return false;
  }, []);
  const value = useMemo(() => ({ register, leave }), [register, leave]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if ([...entries.current.values()].some((e) => e.dirty)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    if (!pending) return;
    const previous =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLButtonElement>("[data-keep-draft]")?.focus();
    return () => {
      element?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [pending]);
  return (
    <DraftContext.Provider value={value}>
      <div
        className={styles.boundary}
        onClickCapture={(event) => {
          if (
            !captureLinks ||
            event.defaultPrevented ||
            event.button !== 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          const target =
            event.target instanceof Element
              ? event.target.closest<HTMLAnchorElement>("a[href]")
              : null;
          if (
            !target ||
            target.target === "_blank" ||
            target.hasAttribute("download") ||
            target.getAttribute("href")?.startsWith("#")
          )
            return;
          if ([...entries.current.values()].some((e) => e.dirty)) {
            event.preventDefault();
            leave(() => window.location.assign(target.href));
          }
        }}
      >
        {children}
        {pending && (
          <dialog
            ref={dialog}
            className={styles.dialog}
            aria-labelledby={`${labelId}-title`}
            aria-describedby={`${labelId}-description`}
            onKeyDown={containDialogFocus}
            onCancel={(event) => {
              event.preventDefault();
              setPending(null);
            }}
          >
            <h2 id={`${labelId}-title`}>{copy.title}</h2>
            <p id={`${labelId}-description`}>
              {copy.description(pending.labels)}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.keep}
                data-keep-draft
                onClick={() => setPending(null)}
              >
                {copy.keep}
              </button>
              <button
                type="button"
                className={styles.leave}
                onClick={() => {
                  const next = pending;
                  for (const id of next.ids) {
                    entries.current.get(id)?.reset();
                    entries.current.delete(id);
                  }
                  setPending(null);
                  next.action();
                }}
              >
                {copy.leave}
              </button>
            </div>
          </dialog>
        )}
      </div>
    </DraftContext.Provider>
  );
}
export function useDraftGuard() {
  return useContext(DraftContext);
}
export function useDraft(
  label: string,
  initiallyDirty = false,
  onDiscard?: () => void,
) {
  const guard = useContext(DraftContext),
    id = useId(),
    dirty = useRef(initiallyDirty);
  const discard = useRef(onDiscard);
  discard.current = onDiscard;
  const publish = useCallback(
    () =>
      guard.register(id, {
        label,
        dirty: dirty.current,
        reset: () => {
          dirty.current = false;
          discard.current?.();
        },
      }),
    [guard, id, label],
  );
  useEffect(() => {
    publish();
    return () => guard.register(id, null);
  }, [guard, id, publish]);
  const markDirty = useCallback(
    (event?: FormEvent) => {
      if (
        event?.target instanceof Element &&
        event.target.closest("[data-draft-ignore]")
      )
        return;
      dirty.current = true;
      publish();
    },
    [publish],
  );
  const markClean = useCallback(() => {
    dirty.current = false;
    publish();
  }, [publish]);
  return {
    markDirty,
    markClean,
    close: (action: () => void) => guard.leave(action, id),
  };
}
