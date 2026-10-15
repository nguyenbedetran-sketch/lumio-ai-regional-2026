"use client";
import { useState } from "react";
import {
  Plus,
  Check,
  Pencil,
  Trash2,
  ArrowRight,
  CalendarDays,
  Clock,
  BookOpen,
} from "lucide-react";
import type { Locale } from "../../lib/lumio/i18n";
import type { LearningItem } from "../../lib/lumio/types";
import {
  dayKey,
  type StudyTask,
  type LearningState,
} from "../../lib/lumio/learning-engine";
import { learningCopy } from "../../lib/lumio/learning-copy";
import { experienceCopy } from "../../lib/lumio/experience-copy";
import { Dialog } from "./dialog";
export function Planner({
  locale,
  items,
  state,
  update,
  toggleTask,
  open,
}: {
  locale: Locale;
  items: LearningItem[];
  state: LearningState;
  update: (fn: (old: LearningState) => LearningState) => void;
  toggleTask: (task: StudyTask) => void;
  open: (item: LearningItem) => void;
}) {
  const c = learningCopy[locale],
    [editing, setEditing] = useState<StudyTask | "new" | null>(null),
    [title, setTitle] = useState(""),
    [date, setDate] = useState(dayKey()),
    [minutes, setMinutes] = useState(25),
    [itemId, setItemId] = useState(""),
    [filter, setFilter] = useState("all"),
    [deleting, setDeleting] = useState<string | null>(null);
  function edit(task: StudyTask | "new") {
    setEditing(task);
    setTitle(task === "new" ? "" : task.title);
    setDate(task === "new" ? dayKey() : task.date);
    setMinutes(task === "new" ? 25 : task.minutes);
    setItemId(task === "new" ? "" : task.itemId);
  }
  const today = dayKey(),
    list = state.tasks
      .filter(
        (t) =>
          filter === "all" ||
          (filter === "today" && t.date === today) ||
          (filter === "done" && t.done) ||
          (filter === "overdue" && !t.done && t.date < today),
      )
      .sort(
        (a, b) =>
          Number(a.done) - Number(b.done) ||
          a.date.localeCompare(b.date) ||
          a.createdAt.localeCompare(b.createdAt),
      );
  return (
    <div className="lx-page lv-planner">
      <div className="lx-page-title">
        <div>
          <span className="lx-kicker">LUMIO / {c.planner}</span>
          <h1>{c.noPlan}</h1>
          <p>{c.planHint}</p>
        </div>
        <button
          className="lm-button primary"
          disabled={state.tasks.length >= 2000}
          onClick={() => edit("new")}
        >
          <Plus size={17} />
          {c.addGoal}
        </button>
      </div>
      <div className="lx-filter-row">
        {[
          ["all", c.all],
          ["today", c.todayLabel],
          ["overdue", c.overdue],
          ["done", c.done],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={filter === value}
            className={filter === value ? "selected" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
            <span>
              {
                state.tasks.filter(
                  (t) =>
                    value === "all" ||
                    (value === "today" && t.date === today) ||
                    (value === "overdue" && !t.done && t.date < today) ||
                    (value === "done" && t.done),
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      {!list.length ? (
        <section className="lx-empty-state">
          <CalendarDays size={44} />
          <h2>
            {state.tasks.length
              ? experienceCopy[locale].filteredTitle
              : c.noGoals}
          </h2>
          <p>
            {state.tasks.length
              ? experienceCopy[locale].filteredHint
              : c.noPlanHint}
          </p>
          {state.tasks.length > 0 && (
            <button className="lm-button" onClick={() => setFilter("all")}>
              {experienceCopy[locale].resetFilter}
            </button>
          )}
          <button className="lm-button primary" onClick={() => edit("new")}>
            <Plus size={16} />
            {c.addGoal}
          </button>
        </section>
      ) : (
        <div className="lx-plan-list">
          {list.map((task) => {
            const item = items.find((i) => i.id === task.itemId);
            return (
              <article
                className={`lx-plan-item ${task.done ? "done" : ""}`}
                key={task.id}
              >
                <button
                  className="lx-check"
                  aria-label={task.done ? c.undo : c.complete}
                  aria-pressed={task.done}
                  onClick={() => toggleTask(task)}
                >
                  {task.done && <Check size={17} />}
                </button>
                <div className="lx-plan-body">
                  <h3>{task.title}</h3>
                  <div className="lx-plan-meta">
                    <span
                      className={
                        !task.done && task.date < today ? "overdue" : ""
                      }
                    >
                      <CalendarDays size={13} />
                      {task.date === today
                        ? c.todayLabel
                        : new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                          }).format(new Date(`${task.date}T12:00:00`))}
                    </span>
                    <span>
                      <Clock size={13} />
                      {task.minutes} {c.minuteUnit}
                    </span>
                    {item && (
                      <button onClick={() => open(item)}>
                        <BookOpen size={13} />
                        {item.title}
                      </button>
                    )}
                  </div>
                </div>
                <div className="lx-plan-actions">
                  {!task.done && task.date < today && (
                    <button
                      className="lx-round-button"
                      title={c.reschedule}
                      aria-label={c.reschedule}
                      onClick={() =>
                        update((old) => ({
                          ...old,
                          tasks: old.tasks.map((t) =>
                            t.id === task.id ? { ...t, date: today } : t,
                          ),
                        }))
                      }
                    >
                      <ArrowRight size={17} />
                    </button>
                  )}
                  <button
                    className="lx-round-button"
                    aria-label={c.edit}
                    onClick={() => edit(task)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="lx-round-button"
                    aria-label={c.remove}
                    onClick={() => setDeleting(task.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {editing && (
        <Dialog
          title={editing === "new" ? c.addGoal : c.edit}
          label={c.cancel}
          close={() => setEditing(null)}
        >
          <form
            className="lx-goal-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !title.trim() ||
                (editing === "new" && state.tasks.length >= 2000)
              )
                return;
              const task: StudyTask =
                editing === "new"
                  ? {
                      id: crypto.randomUUID(),
                      title: title.trim(),
                      date,
                      minutes,
                      itemId,
                      done: false,
                      createdAt: new Date().toISOString(),
                    }
                  : { ...editing, title: title.trim(), date, minutes, itemId };
              update((old) => ({
                ...old,
                tasks:
                  editing === "new"
                    ? [...old.tasks, task]
                    : old.tasks.map((t) => (t.id === task.id ? task : t)),
              }));
              setEditing(null);
            }}
          >
            <label className="lm-field">
              {c.goalTitle}
              <input
                required
                autoFocus
                value={title}
                maxLength={200}
                placeholder={c.goalPlaceholder}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="lx-form-columns">
              <label className="lm-field">
                {c.date}
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="lm-field">
                {c.minutes}
                <input
                  type="number"
                  required
                  min={5}
                  max={240}
                  step={5}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
              </label>
            </div>
            <label className="lm-field">
              {c.resource}
              <select
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
              >
                <option value="">{c.none}</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="lm-row">
              <button
                className="lm-button"
                type="button"
                onClick={() => setEditing(null)}
              >
                {c.cancel}
              </button>
              <button className="lm-button primary" type="submit">
                {c.save}
                <Check size={16} />
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title={c.removeGoal}
          label={c.cancel}
          close={() => setDeleting(null)}
        >
          <div className="lm-row">
            <button className="lm-button" onClick={() => setDeleting(null)}>
              {c.cancel}
            </button>
            <button
              className="lm-button danger-fill"
              onClick={() => {
                update((old) => ({
                  ...old,
                  tasks: old.tasks.filter((t) => t.id !== deleting),
                }));
                setDeleting(null);
              }}
            >
              {c.remove}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
