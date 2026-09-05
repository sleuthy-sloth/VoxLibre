import { z } from "zod";
import { scheduleReview, type SrsState } from "../srs/scheduler";
import type { CoursePack } from "./schema";
export const eventSchema = z.object({
  id: z.string().min(1).max(100),
  packId: z.string().min(1).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  exerciseId: z.string().min(1).max(100),
  at: z.string().datetime(),
  correct: z.boolean(),
  revealed: z.boolean(),
});
export type PracticeEvent = z.infer<typeof eventSchema>;
export type Evidence = SrsState & {
  successes: number;
  failures: number;
  mode: "production" | "recognition" | "listening";
};
export function mergeEvents(
  ...collections: PracticeEvent[][]
): PracticeEvent[] {
  const map = new Map<string, PracticeEvent>();
  for (const event of collections.flat()) {
    const parsed = eventSchema.parse(event);
    const old = map.get(parsed.id);
    if (old && JSON.stringify(old) !== JSON.stringify(parsed))
      throw new Error(
        "Conflicting practice mutation ID. Import was not applied.",
      );
    map.set(parsed.id, parsed);
  }
  return [...map.values()].sort(
    (a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id),
  );
}
export function projectProgress(
  pack: CoursePack,
  events: PracticeEvent[],
): Record<string, Evidence> {
  const exercises = new Map(
    pack.lessons.flatMap((l) => l.exercises).map((e) => [e.id, e]),
  );
  const result: Record<string, Evidence> = {};
  for (const event of mergeEvents(events)) {
    if (event.packId !== pack.id) continue;
    const exercise = exercises.get(event.exerciseId);
    if (!exercise) continue; // retired IDs remain in export, never silently erased
    const at = new Date(event.at);
    const previous = result[exercise.id] ?? {
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      dueAt: at,
      lapseCount: 0,
      lastReviewedAt: at,
      lastQuality: 0 as const,
      lastLatencyMs: null,
      successes: 0,
      failures: 0,
      mode: exercise.mode,
    };
    const success = event.correct && !event.revealed;
    result[exercise.id] = {
      ...scheduleReview(previous, success ? 4 : 1, at),
      mode: exercise.mode,
      successes: previous.successes + (success ? 1 : 0),
      failures: previous.failures + (success ? 0 : 1),
    };
  }
  return result;
}
export function completedLessons(
  pack: CoursePack,
  events: PracticeEvent[],
): Set<string> {
  const progress = projectProgress(pack, events);
  return new Set(
    pack.lessons
      .filter((l) => l.exercises.every((e) => l.optionalExerciseIds.includes(e.id) || progress[e.id]?.successes > 0))
      .map((l) => l.id),
  );
}
export function selectDaily(
  pack: CoursePack,
  events: PracticeEvent[],
  minutes: number,
  now = new Date(),
): { lessonId: string; exerciseIds: string[]; reason: string } {
  const state = projectProgress(pack, events),
    completed = completedLessons(pack, events);
  const budget = Math.max(
    4,
    Math.min(20, Math.floor(Number.isFinite(minutes) ? minutes : 10)),
  );
  const next =
    pack.lessons.find(
      (l) =>
        !completed.has(l.id) &&
        l.prerequisites.every((id) => completed.has(id)),
    ) ?? pack.lessons[0];
  const eligible = pack.lessons.filter(
    (l) => completed.has(l.id) || l.id === next.id,
  );
  const exercises = eligible.flatMap((l) => l.exercises);
  const due = exercises
    .filter((e) => state[e.id] && state[e.id].dueAt <= now)
    .sort((a, b) => state[a.id].dueAt.getTime() - state[b.id].dueAt.getTime());
  const weak = exercises
    .filter((e) => state[e.id] && state[e.id].lastQuality < 3)
    .sort((a, b) => state[b.id].failures - state[a.id].failures);
  const chosen = [
    ...new Set([
      ...due.map((e) => e.id),
      ...weak.map((e) => e.id),
      ...next.exercises.filter((e) => !state[e.id]?.successes).map((e) => e.id),
    ]),
  ].slice(0, budget);
  return {
    lessonId: next.id,
    exerciseIds: chosen,
    reason: due.length
      ? "Due reviews, then weak practice and your next lesson."
      : "Your next foundation, with retrieval of earlier material.",
  };
}

export function conceptEvidence(pack: CoursePack, events: PracticeEvent[]) {
  const projected = projectProgress(pack, events);
  const fresh = () => ({
    successes: 0,
    failures: 0,
    lastExposure: null as string | null,
  });
  const result: Record<
    string,
    Record<"recognition" | "production" | "listening", ReturnType<typeof fresh>>
  > = {};
  for (const concept of pack.concepts)
    result[concept.id] = {
      recognition: fresh(),
      production: fresh(),
      listening: fresh(),
    };
  for (const exercise of pack.lessons.flatMap((l) => l.exercises)) {
    const evidence = projected[exercise.id];
    if (!evidence) continue;
    const summary = result[exercise.conceptId][exercise.mode];
    summary.successes += evidence.successes;
    summary.failures += evidence.failures;
    const date = evidence.lastReviewedAt.toISOString();
    if (!summary.lastExposure || date > summary.lastExposure)
      summary.lastExposure = date;
  }
  return result;
}
