"use client";
import { useEffect, useRef, type ReactNode } from "react";
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
            {title && <h2>{title}</h2>}
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
export function Modal({
  title,
  children,
  onClose,
  disabled = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
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
      onCancel={(e) => {
        e.preventDefault();
        if (!disabled) onClose();
      }}
    >
      <header>
        <div>
          <span className="tw-eyebrow">LUMIO · GIẢNG DẠY</span>
          <h2>{title}</h2>
        </div>
        <button
          type="button"
          aria-label="Đóng biểu mẫu"
          disabled={disabled}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
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
  return (
    <div className="tw-form-footer">
      <Button secondary type="button" disabled={busy} onClick={onClose}>
        Hủy
      </Button>
      <Button type="submit" busy={busy}>
        {label}
        <ArrowRight size={16} />
      </Button>
    </div>
  );
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
