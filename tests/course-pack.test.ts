import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { validatePack } from "@/features/course-pack/schema";
import { evaluateAnswer } from "@/features/course-pack/answer";
import {
  conceptEvidence,
  projectProgress,
  selectDaily,
} from "@/features/course-pack/progress";

const readPack = () =>
  JSON.parse(readFileSync("courses/italian/manifest.json", "utf8"));
describe("course packs", () => {
  it.each(["italian", "french"])(
    "validates original %s foundation content",
    (language) => {
      const pack = validatePack(
        JSON.parse(readFileSync(`courses/${language}/manifest.json`, "utf8")),
      );
      expect(pack.lessons.length).toBeGreaterThanOrEqual(16);
      expect(pack.lessons.every((l) => l.exercises.length >= 4)).toBe(true);
    },
  );
  it("rejects incompatible versions and missing answers", () => {
    const p = readPack();
    p.schemaVersion = 2;
    expect(() => validatePack(p)).toThrow();
    p.schemaVersion = 1;
    p.lessons[0].exercises[0].answers = [];
    expect(() => validatePack(p)).toThrow();
  });
  it("rejects cycles, unknown concepts and vocabulary overload", () => {
    const p = readPack();
    p.lessons[0].prerequisites = [p.lessons[1].id];
    expect(() => validatePack(p)).toThrow(/prerequisite/i);
    const q = readPack();
    q.lessons[0].exercises[0].conceptId = "unknown";
    expect(() => validatePack(q)).toThrow(/concept/i);
    const r = readPack();
    r.lessons[0].vocabulary = Array.from(
      { length: 10 },
      (_, i) => `unknown-${i}`,
    );
    expect(() => validatePack(r)).toThrow();
  });
});
const exercise = {
  answers: ["Io ho mangiato.", "Ho mangiato."],
  errors: [
    {
      answer: "Io ha mangiato",
      category: "wrong conjugation" as const,
      explanation: "With io, avere is ho: Io ho mangiato.",
    },
  ],
};
describe("deterministic answers", () => {
  it("normalizes Unicode, punctuation, case and apostrophes", () => {
    expect(
      evaluateAnswer("  J’AI   UN CAFE\u0301 ! ", {
        answers: ["J'ai un café."],
      }).category,
    ).toBe("correct");
  });
  it("accepts only authored grammatical alternatives", () => {
    expect(evaluateAnswer("Ho mangiato", exercise).category).toBe(
      "acceptable alternative",
    );
    expect(evaluateAnswer("Io ha mangiato", exercise)).toMatchObject({
      accepted: false,
      category: "wrong conjugation",
    });
    expect(evaluateAnswer("Non ho mangiato", exercise).accepted).toBe(false);
  });
  it("does not erase grammatical accents or accept fuzzy answers", () => {
    expect(evaluateAnswer("e", { answers: ["è"] }).category).toBe(
      "accent/diacritic issue",
    );
    expect(evaluateAnswer("e", { answers: ["è"] }).accepted).toBe(false);
    expect(evaluateAnswer("mangaito", { answers: ["mangiato"] }).accepted).toBe(
      false,
    );
    expect(
      evaluateAnswer("mangaito", { answers: ["mangiato"], allowTypo: true })
        .category,
    ).toBe("correct with typo");
  });
  it("classifies missing/extra/order errors without counting them correct", () => {
    expect(evaluateAnswer("ho", exercise).category).toBe("missing word");
    expect(evaluateAnswer("mangiato ho", exercise).category).toBe(
      "word-order problem",
    );
    expect(evaluateAnswer("", exercise).accepted).toBe(false);
  });
});
describe("learning evidence", () => {
  it("is idempotent, separates modalities and discounts answer reveal", () => {
    const p = validatePack(readPack());
    const e = p.lessons[0].exercises[0];
    const event = {
      id: "one",
      packId: p.id,
      version: p.version,
      exerciseId: e.id,
      at: "2026-09-05T00:00:00.000Z",
      correct: true,
      revealed: false,
    };
    const state = projectProgress(p, [event, event]);
    expect(state[e.id].successes).toBe(1);
    expect(state[e.id].intervalDays).toBe(1);
    const reveal = projectProgress(p, [{ ...event, revealed: true }]);
    expect(reveal[e.id].successes).toBe(0);
    expect(reveal[e.id].failures).toBe(1);
    expect(Object.keys(state)).toEqual([e.id]);
  });
  it("starts by teaching and never schedules practice before prerequisites", () => {
    const p = validatePack(readPack());
    const session = selectDaily(p, [], 5, new Date("2026-09-05"));
    expect(session.lessonId).toBe(p.lessons[0].id);
    expect(
      session.exerciseIds.every((id) =>
        p.lessons[0].exercises.some((e) => e.id === id),
      ),
    ).toBe(true);
  });
});
it("daily selection advances past successful items and recovered mistakes", () => {
  const p = validatePack(readPack()),
    first = p.lessons[0];
  const events = first.exercises.flatMap((e, i) => [
    {
      id: `fail-${i}`,
      packId: p.id,
      version: p.version,
      exerciseId: e.id,
      at: "2026-09-05T00:00:00.000Z",
      correct: false,
      revealed: false,
    },
    {
      id: `pass-${i}`,
      packId: p.id,
      version: p.version,
      exerciseId: e.id,
      at: "2026-09-05T01:00:00.000Z",
      correct: true,
      revealed: false,
    },
  ]);
  const session = selectDaily(p, events, 5, new Date("2026-09-05T02:00:00Z"));
  expect(session.lessonId).toBe(p.lessons[1].id);
  expect(
    session.exerciseIds.some((id) =>
      p.lessons[1].exercises.some((e) => e.id === id),
    ),
  ).toBe(true);
  const second = p.lessons[1];
  const partial = second.exercises
    .slice(0, 5)
    .map((e, i) => ({
      id: `new-${i}`,
      packId: p.id,
      version: p.version,
      exerciseId: e.id,
      at: "2026-09-05T01:00:00.000Z",
      correct: true,
      revealed: false,
    }));
  expect(
    selectDaily(p, [...events, ...partial], 5, new Date("2026-09-05T02:00:00Z"))
      .exerciseIds,
  ).toContain(second.exercises[5].id);
});
it.each(["italian", "french"])(
  "accepts ordinary English recognition without editorial parentheticals (%s)",
  (language) => {
    const p = validatePack(
      JSON.parse(readFileSync(`courses/${language}/manifest.json`, "utf8")),
    );
    const e = p.lessons[0].exercises.find((e) => e.mode === "recognition")!;
    expect(
      evaluateAnswer(
        language === "italian" ? "I am Italian." : "I am French.",
        e,
      ).accepted,
    ).toBe(true);
  },
);
it("keeps recognition separate in concept summaries", () => {
  const p = validatePack(readPack()),
    e = p.lessons[0].exercises.find((e) => e.mode === "recognition")!;
  const event = {
    id: "recognition",
    packId: p.id,
    version: p.version,
    exerciseId: e.id,
    at: "2026-09-05T00:00:00.000Z",
    correct: true,
    revealed: false,
  };
  const summary = conceptEvidence(p, [event]);
  expect(summary[e.conceptId].recognition.successes).toBe(1);
  expect(summary[e.conceptId].production.successes).toBe(0);
});
it("validates dialogue recovery branches and rejects dangling nodes", () => {
  const raw = readPack();
  expect(validatePack(raw).dialogues.length).toBeGreaterThan(0);
  raw.dialogues[0].nodes[0].choices[0].next = "missing-node";
  expect(() => validatePack(raw)).toThrow(/dialogue/i);
});
