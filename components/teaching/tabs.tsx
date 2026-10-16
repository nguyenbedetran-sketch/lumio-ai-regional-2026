"use client";
import { useId, useRef, type KeyboardEvent } from "react";
export function useTeachingTabs(
  value: string,
  tabs: readonly (readonly [string, string])[],
  onChange: (id: string) => void,
) {
  const id = useId(),
    ref = useRef<HTMLDivElement>(null);
  function onKeyDown(event: KeyboardEvent) {
    if (
      !(event.target instanceof HTMLElement) ||
      event.target.getAttribute("role") !== "tab" ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const index = tabs.findIndex(([key]) => key === value),
      next =
        event.key === "ArrowRight"
          ? (index + 1) % tabs.length
          : event.key === "ArrowLeft"
            ? (index - 1 + tabs.length) % tabs.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(tabs[next][0]);
    ref.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  }
  return {
    listProps: { ref, onKeyDown, role: "tablist" as const },
    panelProps: {
      role: "tabpanel" as const,
      id: `${id}-panel`,
      className: "tw-tab-panel",
      "aria-labelledby": `${id}-${value}`,
    },
    buttonProps: (key: string) => ({
      id: `${id}-${key}`,
      role: "tab" as const,
      "aria-selected": value === key,
      "aria-controls": `${id}-panel`,
      tabIndex: value === key ? 0 : -1,
      onClick: () => onChange(key),
    }),
  };
}
