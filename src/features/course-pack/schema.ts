import { z } from "zod";

const text = z.string().trim().min(1).max(4000);
const id = z.string().regex(/^[a-z][a-z0-9-]{1,99}$/);
export const errorCategories = [
  "wrong article",
  "wrong gender",
  "wrong number",
  "wrong conjugation",
  "wrong tense",
  "wrong auxiliary",
  "wrong preposition",
  "missing word",
  "extra word",
  "word-order problem",
  "accent/diacritic issue",
  "incorrect answer",
] as const;
export const answerSchema = z.object({
  answers: z.array(text).min(1).max(20),
  allowTypo: z.boolean().default(false),
  errors: z
    .array(
      z.object({
        answer: text,
        category: z.enum(errorCategories),
        explanation: text,
      }),
    )
    .default([]),
});
const exerciseBase = answerSchema.extend({
  id,
  conceptId: id,
  prompt: text,
  explanation: text,
  vocabulary: z.array(id).default([]),
  reviewOf: z.array(id).default([]),
});
export const exerciseSchema = z.discriminatedUnion("kind", [
  exerciseBase.extend({
    kind: z.literal("translate"),
    mode: z.enum(["recognition", "production"]),
  }),
  exerciseBase.extend({
    kind: z.literal("choice"),
    mode: z.literal("recognition"),
    options: z.array(text).min(2).max(6),
  }),
  exerciseBase.extend({
    kind: z.literal("order"),
    mode: z.literal("production"),
    tokens: z.array(text).min(2),
  }),
  exerciseBase.extend({
    kind: z.literal("cloze"),
    mode: z.literal("production"),
  }),
  exerciseBase.extend({
    kind: z.literal("transform"),
    mode: z.literal("production"),
  }),
  exerciseBase.extend({
    kind: z.literal("dictation"),
    mode: z.literal("listening"),
    audioId: id,
  }),
  exerciseBase.extend({
    kind: z.literal("reading"),
    mode: z.literal("recognition"),
    passage: text,
    translation: text,
  }),
]);
const lessonSchema = z.object({
  id,
  unitId: id,
  title: text,
  objective: text,
  cefr: z.literal("A1"),
  prerequisites: z.array(id),
  conceptIds: z.array(id).min(1).max(3),
  vocabulary: z.array(id).max(8),
  explanation: text,
  examples: z
    .array(z.object({ target: text, meaning: text }))
    .min(2)
    .max(6),
  culturalNote: text.optional(),
  exercises: z.array(exerciseSchema).min(4),
  optionalExerciseIds: z.array(id).default([]),
});
export const packSchema = z.object({
  schemaVersion: z.literal(1),
  id,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  language: z.enum(["it", "fr", "es", "pt"]),
  title: text,
  sourceLanguage: z.literal("en"),
  description: text,
  attribution: text,
  units: z.array(z.object({ id, title: text, objective: text })).min(1),
  concepts: z
    .array(
      z.object({
        id,
        title: text,
        explanation: text,
        examples: z.array(z.object({ target: text, meaning: text })).min(1),
        commonError: text,
      }),
    )
    .min(1),
  vocabulary: z.array(
    z.object({
      id,
      word: text,
      meaning: text,
      partOfSpeech: text,
      gender: z.enum(["masculine", "feminine"]).optional(),
      example: text,
    }),
  ),
  media: z.array(
    z.object({
      id,
      url: z
        .string()
        .regex(/^\/audio\/[a-zA-Z0-9/_.-]+$/)
        .refine(
          (url) => !url.split("/").includes(".."),
          "Audio paths cannot traverse directories",
        ),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      transcript: text,
      attribution: text,
    }),
  ),
  lessons: z.array(lessonSchema).min(1),
  dialogues: z
    .array(
      z.object({
        id,
        title: text,
        prerequisite: id,
        goal: text,
        start: id,
        nodes: z
          .array(
            z.object({
              id,
              line: text,
              meaning: text,
              complete: z.boolean().default(false),
              choices: z
                .array(z.object({ text, next: id, feedback: text }))
                .max(5),
            }),
          )
          .min(2),
      }),
    )
    .default([]),
});
export type CoursePack = z.infer<typeof packSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type Lesson = CoursePack["lessons"][number];
export type AnswerSpec = z.input<typeof answerSchema>;

export function validatePack(raw: unknown): CoursePack {
  const p = packSchema.parse(raw);
  const fail = (message: string): never => {
    throw new Error(`${p.id}: ${message}`);
  };
  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length) fail(`duplicate ${label}`);
    return new Set(values);
  };
  const lessons = unique(
    p.lessons.map((l) => l.id),
    "lesson",
  );
  const units = unique(
    p.units.map((u) => u.id),
    "unit",
  );
  const concepts = unique(
    p.concepts.map((c) => c.id),
    "concept",
  );
  const vocabulary = unique(
    p.vocabulary.map((v) => v.id),
    "vocabulary",
  );
  const media = unique(
    p.media.map((m) => m.id),
    "media",
  );
  const exercises = unique(
    p.lessons.flatMap((l) => l.exercises.map((e) => e.id)),
    "exercise",
  );
  const visited = new Set<string>();
  const introduced = new Set<string>();
  const taught = new Set<string>();
  const usedUnits = new Set<string>();
  const usedMedia = new Set<string>();
  const prompts = new Set<string>();
  for (const l of p.lessons) {
    if (!units.has(l.unitId)) fail(`unknown unit in ${l.id}`);
    usedUnits.add(l.unitId);
    const optional = unique(l.optionalExerciseIds, "optional exercise");
    if (l.optionalExerciseIds.some(id => !l.exercises.some(e => e.id === id))) fail(`unknown optional exercise in ${l.id}`);
    if (l.exercises.filter(e => !optional.has(e.id)).length < 4) fail(`optional exercises leave too little required practice in ${l.id}`);
    for (const prerequisite of l.prerequisites)
      if (!lessons.has(prerequisite) || !visited.has(prerequisite))
        fail(`prerequisite is missing, circular or out of order in ${l.id}`);
    if (visited.size && !l.prerequisites.length)
      fail(`unreachable progression: missing prerequisite in ${l.id}`);
    for (const c of l.conceptIds) {
      if (!concepts.has(c)) fail(`unknown concept ${c}`);
      taught.add(c);
    }
    for (const v of l.vocabulary) {
      if (!vocabulary.has(v)) fail(`unknown vocabulary ${v}`);
      introduced.add(v);
    }
    for (const e of l.exercises) {
      if (!taught.has(e.conceptId)) fail(`untaught concept in ${e.id}`);
      for (const v of e.vocabulary)
        if (!introduced.has(v))
          fail(`unknown vocabulary introduced in ${e.id}`);
      for (const ref of e.reviewOf)
        if (!visited.has(ref)) fail(`invalid review reference in ${e.id}`);
      const key = `${e.kind}:${e.prompt.toLocaleLowerCase()}`;
      if (prompts.has(key)) fail(`duplicate prompt in ${e.id}`);
      prompts.add(key);
      if (new Set(e.answers).size !== e.answers.length)
        fail(`duplicate accepted answers in ${e.id}`);
      if (
        e.kind === "choice" &&
        (!e.options.includes(e.answers[0]) ||
          new Set(e.options).size !== e.options.length)
      )
        fail(`invalid choice answers in ${e.id}`);
      if (
        e.kind === "order" &&
        e.tokens.slice().sort().join(" ") !==
          e.answers[0].split(/\s+/).sort().join(" ")
      )
        fail(`invalid ordering tokens in ${e.id}`);
      if (e.kind === "cloze" && !e.prompt.includes("___"))
        fail(`missing cloze blank in ${e.id}`);
      if (e.kind === "dictation") {
        if (!media.has(e.audioId)) fail(`missing audio in ${e.id}`);
        usedMedia.add(e.audioId);
      }
    }
    visited.add(l.id);
  }
  for (const c of concepts) if (!taught.has(c)) fail(`orphaned concept ${c}`);
  for (const v of vocabulary)
    if (!introduced.has(v)) fail(`orphaned vocabulary ${v}`);
  for (const u of units) if (!usedUnits.has(u)) fail(`orphaned unit ${u}`);
  for (const m of media) if (!usedMedia.has(m)) fail(`orphaned audio ${m}`);
  unique(
    p.dialogues.map((d) => d.id),
    "dialogue",
  );
  for (const d of p.dialogues) {
    if (!lessons.has(d.prerequisite))
      fail(`unknown dialogue prerequisite ${d.id}`);
    const nodes = unique(
      d.nodes.map((n) => n.id),
      "dialogue node",
    );
    if (!nodes.has(d.start)) fail(`unknown dialogue start ${d.id}`);
    const reachable = new Set<string>();
    const visit = (nodeId: string) => {
      if (reachable.has(nodeId)) return;
      reachable.add(nodeId);
      const n = d.nodes.find((n) => n.id === nodeId)!;
      for (const c of n.choices) {
        if (!nodes.has(c.next)) fail(`unknown dialogue branch ${c.next}`);
        visit(c.next);
      }
    };
    visit(d.start);
    if (
      reachable.size !== nodes.size ||
      !d.nodes.some((n) => n.complete && reachable.has(n.id))
    )
      fail(`unreachable dialogue goal ${d.id}`);
    for (const n of d.nodes)
      if (!n.complete && !n.choices.length) fail(`dead-end dialogue ${d.id}`);
  }
  if (!exercises.size) fail("no exercises");
  return p;
}
