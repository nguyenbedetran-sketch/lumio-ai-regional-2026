import type { KeyboardEvent } from "react";
/** Native modal inertness plus predictable keyboard wrapping inside the document. */
export function containDialogFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey)
    return;
  const controls = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0),
    first = controls[0],
    last = controls.at(-1);
  if (!first) {
    event.preventDefault();
    return;
  }
  if (
    event.shiftKey &&
    (document.activeElement === first ||
      !controls.includes(document.activeElement as HTMLElement))
  ) {
    event.preventDefault();
    last?.focus();
  } else if (
    !event.shiftKey &&
    (document.activeElement === last ||
      !controls.includes(document.activeElement as HTMLElement))
  ) {
    event.preventDefault();
    first.focus();
  }
}
