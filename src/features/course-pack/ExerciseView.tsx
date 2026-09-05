"use client";
import { useEffect, useRef, useState } from "react";
import { GlossedText } from "./GlossedText";
import type { CoursePack, Exercise } from "./schema";
import { evaluateAnswer, type Evaluation } from "./answer";

type InputProps = {
  exercise: Exercise;
  value: string;
  onChange: (s: string) => void;
  disabled: boolean;
  onHint: () => void;
  pack: CoursePack;
};
function TextInput({ value, onChange, disabled }: InputProps) {
  return (
    <label>
      Your answer
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={2}
        autoComplete="off"
        autoCapitalize="sentences"
        spellCheck={false}
      />
    </label>
  );
}
function ChoiceInput(props: InputProps) {
  if (props.exercise.kind !== "choice") return null;
  return (
    <fieldset>
      <legend>Choose an answer</legend>
      {props.exercise.options.map((option) => (
        <label key={option}>
          <input
            type="radio"
            name="answer"
            checked={props.value === option}
            onChange={() => props.onChange(option)}
            disabled={props.disabled}
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}
function OrderInput(props: InputProps) {
  const [used, setUsed] = useState<number[]>([]);
  if (props.exercise.kind !== "order") return null;
  const tokens = props.exercise.tokens;
  return (
    <div>
      <p aria-live="polite">
        {props.value || "Choose words to build the sentence."}
      </p>
      <div className="word-bank">
        {tokens.map((token, i) => (
          <button
            type="button"
            key={i}
            disabled={props.disabled || used.includes(i)}
            onClick={() => {
              const next = [...used, i];
              setUsed(next);
              props.onChange(next.map((j) => tokens[j]).join(" "));
            }}
          >
            {token}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => {
          setUsed([]);
          props.onChange("");
        }}
      >
        Reset words
      </button>
    </div>
  );
}
function ListeningInput(props: InputProps) {
  const ref = useRef<HTMLAudioElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [slow, setSlow] = useState(false);
  if (props.exercise.kind !== "dictation") return null;
  const media = props.pack.media.find(
    (m) =>
      m.id ===
      (props.exercise as Extract<Exercise, { kind: "dictation" }>).audioId,
  );
  return (
    <>
      <audio
        ref={ref}
        controls
        preload="none"
        src={media?.url}
        onError={() => setUnavailable(true)}
        aria-label="Dictation audio"
      />
      <button
        type="button"
        onClick={() => {
          const next = !slow;
          setSlow(next);
          if (ref.current) ref.current.playbackRate = next ? 0.75 : 1;
        }}
      >
        {slow ? "Use normal speed (1×)" : "Use slow replay (0.75×)"}
      </button>
      {unavailable ? (
        <p>
          Audio could not play. Reveal the model to study this item; it will
          remain due.
        </p>
      ) : null}
      <TextInput {...props} />
    </>
  );
}
function ReadingInput(props: InputProps) {
  if (props.exercise.kind !== "reading") return null;
  return (
    <>
      <GlossedText
        text={props.exercise.passage}
        pack={props.pack}
        onLookup={props.onHint}
      />
      <details>
        <summary onClick={props.onHint}>Sentence translation</summary>
        <p>{props.exercise.translation}</p>
      </details>
      <TextInput {...props} />
    </>
  );
}
const renderers: Record<Exercise["kind"], React.ComponentType<InputProps>> = {
  translate: TextInput,
  choice: ChoiceInput,
  order: OrderInput,
  cloze: TextInput,
  transform: TextInput,
  dictation: ListeningInput,
  reading: ReadingInput,
};
export function ExerciseView({
  exercise,
  pack,
  onSave,
}: {
  exercise: Exercise;
  pack: CoursePack;
  onSave: (result: Evaluation, revealed: boolean) => Promise<void>;
}) {
  const [value, setValue] = useState(""),
    [result, setResult] = useState<Evaluation | null>(null),
    [revealed, setRevealed] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const Input = renderers[exercise.kind];
  return (
    <section className="practice-panel" aria-labelledby="practice-title">
      <p className="study-eyebrow">
        {exercise.mode} · {exercise.kind}
      </p>
      <h2 id="practice-title" ref={heading} tabIndex={-1}>
        {exercise.prompt}
      </h2>
      <Input
        exercise={exercise}
        pack={pack}
        value={value}
        onChange={setValue}
        disabled={!!result}
        onHint={() => setRevealed(true)}
      />
      <div className="study-actions">
        {!result ? (
          <button
            className="study-primary"
            disabled={!value.trim()}
            onClick={() => setResult(evaluateAnswer(value, exercise))}
          >
            Check answer
          </button>
        ) : null}
        <button
          onClick={() => {
            setRevealed(true);
            if (!result)
              setResult({
                accepted: false,
                category: "model revealed",
                explanation: "Study the model. This remains a review item.",
                model: exercise.answers[0],
              });
          }}
        >
          Reveal model
        </button>
      </div>
      {result ? (
        <div role="status" className="study-feedback">
          <strong>{result.category}</strong>
          <p>{result.explanation}</p>
          {revealed ? (
            <p>Assisted practice. This will remain in review.</p>
          ) : null}
          {!result.accepted || revealed ? (
            <p lang={pack.language}>{result.model}</p>
          ) : null}
          <p>{exercise.explanation}</p>
          <button
            className="study-primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                await onSave(result, revealed);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not save. Try again.",
                );
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save and continue"}
          </button>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
