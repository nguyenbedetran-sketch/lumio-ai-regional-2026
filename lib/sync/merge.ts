import { normalizeSyncEnvelope, type SyncEnvelope } from "./contracts";
export type SyncChoice = "local" | "remote";
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
/** Three-way merge. A missing record means deletion only relative to a known base. */
export function mergeSync(
  base: SyncEnvelope,
  local: SyncEnvelope,
  remote: SyncEnvelope,
  choice?: SyncChoice,
) {
  const conflicts: string[] = [];
  function one<T>(
    before: T | undefined,
    here: T | undefined,
    there: T | undefined,
    label: string,
  ): T | undefined {
    if (equal(here, there)) return here;
    if (equal(here, before)) return there;
    if (equal(there, before)) return here;
    conflicts.push(label);
    return choice === "remote" ? there : here;
  }
  function list<T>(
    before: T[],
    here: T[],
    there: T[],
    key: (v: T) => string,
    label: string,
  ) {
    const b = new Map(before.map((v) => [key(v), v])),
      l = new Map(here.map((v) => [key(v), v])),
      r = new Map(there.map((v) => [key(v), v]));
    return [...new Set([...b.keys(), ...l.keys(), ...r.keys()])].flatMap(
      (id) => {
        const v = one(b.get(id), l.get(id), r.get(id), label + ": " + id);
        return v === undefined ? [] : [v];
      },
    );
  }
  const result: SyncEnvelope = {
    version: 1,
    library: {
      version: 1,
      items: list(
        base.library.items,
        local.library.items,
        remote.library.items,
        (v) => v.id,
        "Học liệu",
      ),
      spaces: list(
        base.library.spaces,
        local.library.spaces,
        remote.library.spaces,
        (v) => v.id,
        "Không gian",
      ),
    },
    learning: {
      version: 1,
      focus: null,
      tasks: list(
        base.learning.tasks,
        local.learning.tasks,
        remote.learning.tasks,
        (v) => v.id,
        "Mục tiêu",
      ),
      reviews: list(
        base.learning.reviews,
        local.learning.reviews,
        remote.learning.reviews,
        (v) => v.key,
        "Lịch ôn",
      ),
      events: list(
        base.learning.events,
        local.learning.events,
        remote.learning.events,
        (v) => v.id,
        "Hoạt động",
      ),
    },
    preferences: one(
      base.preferences,
      local.preferences,
      remote.preferences,
      "Cá nhân hóa",
    )!,
  };
  return { data: normalizeSyncEnvelope(result), conflicts };
}
