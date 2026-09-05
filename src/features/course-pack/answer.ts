import type { AnswerSpec } from "./schema";
export type Evaluation = {
  accepted: boolean;
  category: string;
  explanation: string;
  model: string;
};
export function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[¿¡!?.,;:"“”()[\]{}]/g, " ")
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
const unaccent = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");
// Bounded edit distance, including adjacent transposition. Never a semantic grader.
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  rows[0] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  return rows[a.length][b.length];
}
export function evaluateAnswer(response: string, spec: AnswerSpec): Evaluation {
  const input = normalize(response);
  const model = spec.answers[0] ?? "";
  const result = (
    category: string,
    explanation: string,
    accepted = false,
  ): Evaluation => ({ category, explanation, accepted, model });
  if (!input || input.length > 1000)
    return result(
      "incorrect answer",
      "Write an answer, or study the model and try again.",
    );
  const exact = spec.answers.findIndex((a) => normalize(a) === input);
  if (exact >= 0)
    return result(
      exact === 0 ? "correct" : "acceptable alternative",
      "That matches an authored answer.",
      true,
    );
  const error = spec.errors?.find((e) => normalize(e.answer) === input);
  if (error) return result(error.category, error.explanation);
  for (const answer of spec.answers)
    if (unaccent(normalize(answer)) === unaccent(input))
      return result(
        "accent/diacritic issue",
        "Check the accents. They can change the meaning or grammatical form.",
      );
  for (const answer of spec.answers) {
    const expected = normalize(answer);
    const a = input.split(" ");
    const b = expected.split(" ");
    if (
      a.length === b.length &&
      a.slice().sort().join(" ") === b.slice().sort().join(" ")
    )
      return result(
        "word-order problem",
        "The words are here; check their order against the model.",
      );
  }
  for (const answer of spec.answers) {
    const a = input.split(" "),
      b = normalize(answer).split(" ");
    const subsequence = (short: string[], long: string[]) => {
      let i = 0;
      for (const word of long) if (word === short[i]) i++;
      return i === short.length;
    };
    if (a.length < b.length && subsequence(a, b))
      return result(
        "missing word",
        "One or more words are missing. Compare the complete phrase.",
      );
    if (a.length > b.length && subsequence(b, a))
      return result(
        "extra word",
        "There are extra words. They may change the meaning. Compare the model.",
      );
  }
  for (const answer of spec.answers) {
    const expected = normalize(answer);
    if (expected.length <= 1000 && distance(input, expected) <= 1) {
      // Even an opted-in typo never forgives a one-letter grammar word.
      const a = input.split(" "),
        b = expected.split(" ");
      const changed = a.filter((w, i) => w !== b[i]);
      const safe =
        a.length === b.length &&
        changed.length === 1 &&
        changed[0].length >= 5 &&
        b[a.findIndex((w, i) => w !== b[i])]?.length >= 5;
      if (spec.allowTypo && safe)
        return result(
          "correct with typo",
          "Meaning accepted with a small spelling slip; study the exact spelling.",
          true,
        );
      return result(
        "nearly correct",
        "A small spelling or grammar difference remains. Compare the model.",
      );
    }
  }
  return result(
    "incorrect answer",
    "This does not match an authored answer. Study the explanation, then try again.",
  );
}
