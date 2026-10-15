import type { TeachingState } from "../../lib/teaching/contracts";
/** Only frozen question keys and teacher-visible published answers, never current editable keys. */
export function observedErrors(
  data: Pick<TeachingState, "assignments" | "submissions">,
) {
  const rows = new Map<
    string,
    {
      id: string;
      revision: number;
      prompt: string;
      topic: string;
      choices: string[];
      correctIndex: number;
      observed: number;
      wrong: number;
      counts: number[];
    }
  >();
  for (const submission of data.submissions) {
    if (submission.status !== "published") continue;
    const assignment = data.assignments.find(
      (a) => a.id === submission.assignmentId,
    );
    if (!assignment) continue;
    for (const q of assignment.questions) {
      if (
        q.kind !== "mcq" ||
        !Number.isInteger(q.correctIndex) ||
        q.correctIndex! < 0 ||
        q.correctIndex! >= q.choices.length
      )
        continue;
      const answer = submission.answers.find(
        (a) => a.questionId === q.id,
      )?.response;
      if (
        typeof answer !== "number" ||
        !Number.isInteger(answer) ||
        answer < 0 ||
        answer >= q.choices.length
      )
        continue;
      const key = q.id + ":" + q.revision;
      let row = rows.get(key);
      if (!row) {
        row = {
          id: q.id,
          revision: q.revision,
          prompt: q.prompt,
          topic: q.topic,
          choices: [...q.choices],
          correctIndex: q.correctIndex!,
          observed: 0,
          wrong: 0,
          counts: q.choices.map(() => 0),
        };
        rows.set(key, row);
      }
      // A conflicting frozen snapshot must not be aggregated as one question version.
      if (
        row.correctIndex !== q.correctIndex ||
        row.prompt !== q.prompt ||
        JSON.stringify(row.choices) !== JSON.stringify(q.choices)
      )
        continue;
      row.observed++;
      row.counts[answer]++;
      if (answer !== q.correctIndex) row.wrong++;
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.wrong - a.wrong || b.observed - a.observed,
  );
}
