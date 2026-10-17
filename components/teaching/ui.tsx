"use client";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MathText } from "../lumio/math-text";
import { useTeachingDraft } from "./draft-guard";
import { containDialogFocus } from "./dialog-focus";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";

export function Button({
  children,
  secondary = false,
  danger = false,
  busy = false,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  secondary?: boolean;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={busy || props.disabled}
      className={`tw-button ${secondary ? "secondary" : ""} ${danger ? "danger" : ""} ${props.className || ""}`}
    >
      {busy && <LoaderCircle size={16} className="tw-spin" />}
      {children}
    </button>
  );
}
export function Panel({
  title,
  eyebrow,
  children,
  action,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`tw-panel ${className}`}>
      {(title || action) && (
        <header className="tw-panel-heading">
          <div>
            {eyebrow && <span className="tw-eyebrow">{eyebrow}</span>}
            {title && (
              <h2>
                <MathText text={title} inline />
              </h2>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
export function Empty({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="tw-empty">
      <span>
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="tw-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "indigo";
}) {
  return <span className={`tw-tag ${tone}`}>{children}</span>;
}
const ModalCloseContext = createContext<null | (() => void)>(null);
export function Modal({
  title,
  children,
  onClose,
  disabled = false,
  initiallyDirty = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  disabled?: boolean;
  initiallyDirty?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId(),
    draft = useTeachingDraft(title, initiallyDirty);
  const close = () => {
    if (!disabled) draft.close(onClose);
  };
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null,
      dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      before?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="tw-dialog"
      aria-labelledby={titleId}
      onInputCapture={draft.markDirty}
      onChangeCapture={draft.markDirty}
      onKeyDown={containDialogFocus}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <div>
          <span className="tw-eyebrow">LUMIO · GIẢNG DẠY</span>
          <h2 id={titleId}>
            <MathText text={title} inline />
          </h2>
        </div>
        <button
          type="button"
          aria-label="Đóng biểu mẫu"
          disabled={disabled}
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      <ModalCloseContext.Provider value={close}>
        {children}
      </ModalCloseContext.Provider>
    </dialog>
  );
}
export function FormFooter({
  busy,
  onClose,
  label = "Lưu thay đổi",
}: {
  busy: boolean;
  onClose: () => void;
  label?: string;
}) {
  const close = useContext(ModalCloseContext) || onClose;
  return (
    <div className="tw-form-footer">
      <Button secondary type="button" disabled={busy} onClick={close}>
        Hủy
      </Button>
      <Button type="submit" busy={busy}>
        {label}
        <ArrowRight size={16} />
      </Button>
    </div>
  );
}
export function ModalCancelButton({
  onClose,
  children,
  disabled = false,
}: {
  onClose: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  const close = useContext(ModalCloseContext) || onClose;
  return (
    <Button secondary disabled={disabled} onClick={close}>
      {children}
    </Button>
  );
}
export function useTeachingConfirmation() {
  const [pending, setPending] = useState<{
      title: string;
      description: string;
      label: string;
      action: () => Promise<unknown>;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const running = useRef(false);
  return {
    ask: (next: NonNullable<typeof pending>) => {
      if (!running.current) {
        setPending(next);
        setError("");
      }
    },
    dialog: pending ? (
      <Modal
        title={pending.title}
        onClose={() => setPending(null)}
        disabled={busy}
      >
        <div className="tw-pad tw-form">
          <p className="tw-note">{pending.description}</p>
          {error && (
            <div className="tw-alert" role="alert">
              {error}
            </div>
          )}
          <div className="tw-form-footer">
            <ModalCancelButton onClose={() => setPending(null)} disabled={busy}>
              Giữ nguyên
            </ModalCancelButton>
            <Button
              danger
              busy={busy}
              onClick={async () => {
                if (running.current) return;
                running.current = true;
                setBusy(true);
                setError("");
                try {
                  await pending.action();
                  setPending(null);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Chưa hoàn tất thay đổi. Hãy thử lại.",
                  );
                } finally {
                  running.current = false;
                  setBusy(false);
                }
              }}
            >
              {pending.label}
            </Button>
          </div>
        </div>
      </Modal>
    ) : null,
  };
}
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick}>
      <Plus size={16} />
      {children}
    </Button>
  );
}
export function dateTime(value?: string | null, timeZone?: string) {
  if (!value) return "Chưa đặt";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
        ...(timeZone ? { timeZone } : {}),
      }).format(date)
    : "Chưa đặt";
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="tw-notice" role="status">
      <CheckCircle2 size={17} />
      {children}
    </div>
  );
}
export function downloadText(
  name: string,
  content: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: unknown[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let cell = String(value ?? "");
            if (/^[\s]*[=+@-]/.test(cell)) cell = "'" + cell;
            return '"' + cell.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n")
  );
}
