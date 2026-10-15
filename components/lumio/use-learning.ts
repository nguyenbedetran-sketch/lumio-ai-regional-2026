"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyLearning,
  learningKey,
  parseLearning,
  recordStudyActivity,
  finishFocus,
  defaultAlarm,
  type StudyActivity,
  type LearningState,
} from "../../lib/lumio/learning-engine";
import { useFocusAlarm } from "./use-focus-alarm";

export function useLearning(account: string) {
  const [state, setState] = useState<LearningState>(emptyLearning),
    [ready, setReady] = useState(false),
    [error, setError] = useState<"read" | "write" | "">("");
  const current = useRef(state),
    readable = useRef(false),
    unsaved = useRef(false);
  const alarm = useFocusAlarm(account, state.alarm || defaultAlarm);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(learningKey(account));
      const next = raw ? parseLearning(JSON.parse(raw)) : emptyLearning();
      current.current = next;
      setState(next);
      readable.current = true;
    } catch {
      setError("read");
    }
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key !== learningKey(account)) return;
      if (unsaved.current) return;
      try {
        const next = event.newValue
          ? parseLearning(JSON.parse(event.newValue))
          : emptyLearning();
        current.current = next;
        setState(next);
        readable.current = true;
        setError("");
      } catch {
        setError("read");
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [account]);
  const update = useCallback(
    (
      change: LearningState | ((old: LearningState) => LearningState),
      restoring = false,
    ) => {
      if (!readable.current && !restoring) return;
      let previous = current.current;
      // Read immediately before a mutation so another tab's recent work is retained.
      if (!restoring && !unsaved.current)
        try {
          const latest = localStorage.getItem(learningKey(account));
          if (latest) previous = parseLearning(JSON.parse(latest));
        } catch {}
      const next = typeof change === "function" ? change(previous) : change;
      if (next === previous) {
        current.current = previous;
        setState(previous);
        return;
      }
      try {
        parseLearning(next);
        localStorage.setItem(learningKey(account), JSON.stringify(next));
        setError("");
        readable.current = true;
        unsaved.current = false;
      } catch {
        setError("write");
        unsaved.current = true;
      }
      current.current = next;
      setState(next);
    },
    [account],
  );
  const recordActivity = useCallback(
    (kind: StudyActivity, itemId: string) => {
      update((old) => recordStudyActivity(old, kind, itemId));
    },
    [update],
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!unsaved.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    if (!ready || !state.focus?.deadline) return;
    const tick = () => {
      const focus = current.current.focus;
      if (!focus?.deadline || focus.deadline > Date.now()) return;
      const complete = () => {
        update((old) => {
          if (old.focus?.deadline !== focus.deadline) return old;
          return finishFocus(old, focus.id);
        });
      };
      // Record once across tabs. Audio is separately claimed by a tab where sound is enabled.
      if (navigator.locks)
        void navigator.locks
          .request(
            `${learningKey(account)}:focus`,
            { ifAvailable: true },
            (lock) => {
              if (lock) complete();
            },
          )
          .catch(() => complete());
      else complete();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [ready, state.focus?.deadline, update, account]);
  const consideredAlarm = useRef("");
  useEffect(() => {
    if (!ready) return;
    const event = state.events.filter((e) => e.kind === "focus").at(-1);
    if (
      !event ||
      consideredAlarm.current === event.id ||
      state.lastAlarmId === event.id
    )
      return;
    consideredAlarm.current = event.id;
    const elapsed = Date.now() - Date.parse(event.at);
    // Restoring an old session must not unexpectedly ring hours later.
    if (elapsed < 0 || elapsed > 30000) return;
    if (!alarm.canPlay()) {
      alarm.reportBlocked();
      return;
    }
    const claim = () => {
      let claimed = false;
      update((old) => {
        if (
          old.lastAlarmId === event.id ||
          !old.events.some((e) => e.id === event.id)
        )
          return old;
        claimed = true;
        return { ...old, lastAlarmId: event.id };
      });
      if (claimed) void alarm.play();
    };
    if (navigator.locks)
      void navigator.locks
        .request(`${learningKey(account)}:alarm`, claim)
        .catch(() => claim());
    else claim();
  }, [
    ready,
    state.events,
    state.lastAlarmId,
    update,
    account,
    alarm.canPlay,
    alarm.reportBlocked,
    alarm.play,
  ]);
  return { state, update, ready, error, recordActivity, alarm };
}
