"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Command } from "cmdk";
import { animate } from "motion/mini";
import {
  ArrowUpRight,
  BookOpen,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Link,
  LockKeyhole,
  Music2,
  Search,
  Video,
  X,
} from "lucide-react";
import type { LearningItem, Space } from "../../lib/lumio/types";
import type { Locale } from "../../lib/lumio/i18n";
import { commandCopy } from "../../lib/lumio/command-copy";
import { useEffectiveMotion } from "./use-motion-settings";
import {
  buildCommandIndex,
  commandMatches,
  isCommandShortcut,
  searchCommandItems,
  COMMAND_QUERY_LIMIT,
  type CommandDestination,
  type CommandView,
} from "../../lib/lumio/command-search";

export type CommandMenuProps = {
  locale: Locale;
  items: readonly LearningItem[];
  spaces?: readonly Space[];
  navigation: readonly CommandDestination[];
  onNavigate: (view: CommandView, spaceId?: string) => void;
  onOpenItem: (item: LearningItem) => void;
  disabled?: boolean;
  className?: string;
};

const emptySpaces: readonly Space[] = [];
const kindIcons = {
  text: FileText,
  pdf: FileText,
  image: ImageIcon,
  audio: Music2,
  video: Video,
  link: Link,
};

/** A local command surface. It never changes the current view until selection. */
export function CommandMenu({
  locale,
  items,
  spaces = emptySpaces,
  navigation,
  onNavigate,
  onOpenItem,
  disabled = false,
  className = "",
}: CommandMenuProps) {
  const c = commandCopy[locale];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const entrance = useRef<ReturnType<typeof animate>[]>([]);
  const id = useId();
  const motionMode = useEffectiveMotion();
  const settleEntrance = useCallback(() => {
    for (const animation of entrance.current) animation.cancel();
    entrance.current = [];
    if (panel.current) {
      panel.current.style.opacity = "1";
      panel.current.style.transform = "none";
    }
    if (backdrop.current) backdrop.current.style.opacity = "1";
  }, []);
  useEffect(() => {
    if (!open || !panel.current || !backdrop.current) return;
    settleEntrance();
    if (motionMode !== "off") {
      // Animate existing DOM refs; the base markup stays visible if setup fails.
      try {
        entrance.current.push(
          animate(backdrop.current, { opacity: [0, 1] }, { duration: 0.16 }),
        );
        entrance.current.push(
          animate(
            panel.current,
            motionMode === "full"
              ? {
                  opacity: [0.65, 1],
                  transform: ["translateY(8px) scale(0.99)", "none"],
                }
              : { opacity: [0.8, 1] },
            { duration: 0.18, ease: "easeOut" },
          ),
        );
      } catch {
        settleEntrance();
      }
    }
    // Leave no hidden intermediate style if a browser interrupts animation.
    const complete = window.setTimeout(settleEntrance, 300);
    return () => {
      window.clearTimeout(complete);
      settleEntrance();
    };
  }, [open, motionMode, settleEntrance]);
  // The source index exists only while open, and only for this workspace's props.
  const index = useMemo(
    () => (open ? buildCommandIndex(items, spaces) : []),
    [open, items, spaces],
  );
  const matches = useMemo(
    () => searchCommandItems(index, query),
    [index, query],
  );
  const destinations = navigation.filter((entry) =>
    commandMatches(query, entry.label, [entry.id, ...(entry.keywords || [])]),
  );
  const matchingSpaces = spaces
    .filter((space) => commandMatches(query, space.name))
    .slice(0, 6);
  const count =
    matches.items.length + destinations.length + matchingSpaces.length;

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  const show = useCallback(() => {
    if (disabled) return;
    if (
      document.querySelector(
        'dialog[open], [role="dialog"], [aria-modal="true"]',
      )
    )
      return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setQuery("");
    setOpen(true);
  }, [disabled]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (disabled || !isCommandShortcut(event)) return;
      // Existing editors/modal flows own their shortcuts until dismissed.
      if (
        !open &&
        document.querySelector(
          'dialog[open], [role="dialog"], [aria-modal="true"]',
        )
      )
        return;
      event.preventDefault();
      if (open) close();
      else show();
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [open, disabled, show, close]);

  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    const oldOverflow = document.body.style.overflow;
    if (!element.open) element.showModal();
    document.body.style.overflow = "hidden";
    input.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      document.body.style.overflow = oldOverflow;
      const target = previousFocus.current?.isConnected
        ? previousFocus.current
        : trigger.current;
      target?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (disabled) close();
  }, [disabled, close]);

  function navigate(view: CommandView, spaceId?: string) {
    close();
    onNavigate(view, spaceId);
  }

  return (
    <>
      <button
        ref={trigger}
        className={`lc-command-trigger ${className}`}
        type="button"
        onClick={show}
        disabled={disabled}
        aria-label={c.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        aria-keyshortcuts="Control+k Meta+k"
      >
        <Search size={18} aria-hidden="true" />
        <span>{c.trigger}</span>
        <kbd>⌘ / Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        id={id}
        className="lc-command-dialog"
        aria-label={c.title}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-privacy`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        {open && (
          <>
            <div
              ref={backdrop}
              className="lc-command-backdrop"
              aria-hidden="true"
            />
            <div
              className="lc-command-stage"
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <div ref={panel} className="lc-command-panel">
                <div className="lc-command-heading">
                  <h2 id={`${id}-title`}>{c.title}</h2>
                  <button type="button" onClick={close} aria-label={c.close}>
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <Command
                  label={c.title}
                  shouldFilter={false}
                  loop
                  vimBindings={false}
                >
                  <div className="lc-command-field">
                    <Search size={21} aria-hidden="true" />
                    <Command.Input
                      ref={input}
                      value={query}
                      onValueChange={setQuery}
                      maxLength={COMMAND_QUERY_LIMIT}
                      placeholder={c.placeholder}
                      aria-label={c.trigger}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          input.current?.focus();
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        aria-label={c.clear}
                      >
                        <X size={17} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <Command.List className="lc-command-list" label={c.trigger}>
                    {destinations.length > 0 && (
                      <Command.Group heading={c.navigation}>
                        {destinations.map((entry) => (
                          <Command.Item
                            key={`view:${entry.id}`}
                            value={`view:${entry.id}`}
                            onSelect={() => navigate(entry.id)}
                          >
                            <span className="lc-command-icon">
                              <ArrowUpRight size={18} aria-hidden="true" />
                            </span>
                            <span className="lc-command-item-text">
                              {entry.label}
                            </span>
                            <ArrowUpRight
                              className="lc-command-enter"
                              size={16}
                              aria-hidden="true"
                            />
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                    {matchingSpaces.length > 0 && (
                      <Command.Group heading={c.spaces}>
                        {matchingSpaces.map((space) => (
                          <Command.Item
                            key={`space:${space.id}`}
                            value={`space:${space.id}`}
                            onSelect={() => navigate("space", space.id)}
                          >
                            <span className="lc-command-icon">
                              <FolderOpen size={18} aria-hidden="true" />
                            </span>
                            <span className="lc-command-item-text">
                              {space.name}
                            </span>
                            <ArrowUpRight
                              className="lc-command-enter"
                              size={16}
                              aria-hidden="true"
                            />
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}
                    {matches.items.length > 0 && (
                      <Command.Group
                        heading={matches.query ? c.materials : c.recent}
                      >
                        {matches.items.map(({ item, matchedIn }) => {
                          const Icon = kindIcons[item.kind];
                          return (
                            <Command.Item
                              key={`item:${item.id}`}
                              value={`item:${item.id}`}
                              onSelect={() => {
                                close();
                                onOpenItem(item);
                              }}
                            >
                              <span className="lc-command-icon lc-command-source">
                                <Icon size={18} aria-hidden="true" />
                              </span>
                              <span className="lc-command-item-text">
                                <span>{item.title}</span>
                                <small>
                                  {c.kind[item.kind]}
                                  {matches.query && matchedIn !== "title"
                                    ? ` · ${c.match[matchedIn]}`
                                    : ""}
                                </small>
                              </span>
                              <ArrowUpRight
                                className="lc-command-enter"
                                size={16}
                                aria-hidden="true"
                              />
                            </Command.Item>
                          );
                        })}
                      </Command.Group>
                    )}
                    {count === 0 && (
                      <div className="lc-command-empty">
                        <Search size={27} aria-hidden="true" />
                        <strong>{c.empty}</strong>
                        <p>{c.emptyHint}</p>
                      </div>
                    )}
                    {!matches.query && !items.length && (
                      <p className="lc-command-library-empty">
                        <BookOpen size={17} aria-hidden="true" />
                        {c.noLibrary}
                      </p>
                    )}
                    {matches.query && matches.total > matches.items.length && (
                      <p className="lc-command-more">{c.more}</p>
                    )}
                  </Command.List>
                </Command>
                <footer className="lc-command-footer">
                  <div className="lc-command-hints">
                    <span>
                      <kbd>↑</kbd>
                      <kbd>↓</kbd> {c.move}
                    </span>
                    <span>
                      <kbd>↵</kbd> {c.select}
                    </span>
                    <span>
                      <kbd>Esc</kbd> {c.dismiss}
                    </span>
                  </div>
                  <div id={`${id}-privacy`} className="lc-command-privacy">
                    <LockKeyhole size={13} aria-hidden="true" />
                    <span>{c.local}</span>
                  </div>
                  <details className="lc-command-scope">
                    <summary>{c.scopeLabel}</summary>
                    <p>{c.scope}</p>
                  </details>
                </footer>
                <span
                  className="lc-command-sr"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {matches.query ? `${matches.total} ${c.results}` : ""}
                </span>
              </div>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
