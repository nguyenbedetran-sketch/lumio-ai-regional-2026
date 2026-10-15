"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyPreferences,
  parsePreferences,
  preferenceKey,
  type Preferences,
} from "../../lib/lumio/recommendations";
export function usePersonalization(account: string) {
  const [snapshot, setSnapshot] = useState<{
    account: string;
    state: Preferences;
    error: boolean;
  }>(() => ({ account, state: emptyPreferences(), error: false }));
  const current = useRef({ account, state: snapshot.state, writable: false }),
    activeAccount = useRef(account);
  activeAccount.current = account;
  useEffect(() => {
    let active = true;
    current.current = { account, state: emptyPreferences(), writable: false };
    function read() {
      if (!active || activeAccount.current !== account) return;
      try {
        const text = localStorage.getItem(preferenceKey(account));
        const next = text
          ? parsePreferences(JSON.parse(text))
          : emptyPreferences();
        current.current = { account, state: next, writable: true };
        setSnapshot({ account, state: next, error: false });
      } catch {
        // Never retain another account's preferences after an unreadable namespace.
        const next = emptyPreferences();
        current.current = { account, state: next, writable: false };
        setSnapshot({ account, state: next, error: true });
      }
    }
    read();
    const sync = (e: StorageEvent) => {
      if (e.key === null || e.key === preferenceKey(account)) read();
    };
    window.addEventListener("storage", sync);
    return () => {
      active = false;
      current.current.writable = false;
      window.removeEventListener("storage", sync);
    };
  }, [account]);
  const update = useCallback(
    (
      change: Preferences | ((old: Preferences) => Preferences),
      restore = false,
    ) => {
      // Guard new and stale callbacks while the account-change effect is pending.
      if (
        activeAccount.current !== account ||
        current.current.account !== account ||
        (!current.current.writable && !restore)
      )
        return;
      try {
        const saved = restore
          ? null
          : localStorage.getItem(preferenceKey(account));
        const previous = saved
          ? parsePreferences(JSON.parse(saved))
          : emptyPreferences();
        const next = parsePreferences(
          typeof change === "function" ? change(previous) : change,
        );
        localStorage.setItem(preferenceKey(account), JSON.stringify(next));
        current.current = { account, state: next, writable: true };
        setSnapshot({ account, state: next, error: false });
      } catch {
        current.current.writable = false;
        setSnapshot((old) =>
          old.account === account ? { ...old, error: true } : old,
        );
      }
    },
    [account],
  );
  const visible =
    snapshot.account === account
      ? snapshot
      : { account, state: emptyPreferences(), error: false };
  return { state: visible.state, update, error: visible.error };
}
