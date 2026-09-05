"use client";
import { useState } from "react";
import type { CoursePack } from "./schema";
export function GlossedText({
  text,
  pack,
  onLookup,
}: {
  text: string;
  pack: CoursePack;
  onLookup: () => void;
}) {
  const [definition, setDefinition] = useState("");
  const glossary = new Map(
    pack.vocabulary
      .filter((v) => !v.word.includes(" "))
      .map((v) => [v.word.toLocaleLowerCase(), v.meaning]),
  );
  return (
    <>
      <blockquote lang={pack.language}>
        {text.split(/([\p{L}’']+)/u).map((part, i) => {
          const meaning = glossary.get(part.toLocaleLowerCase());
          return meaning ? (
            <button
              className="gloss-word"
              key={i}
              aria-label={`Meaning of ${part}`}
              onClick={() => {
                setDefinition(`${part}: ${meaning}`);
                onLookup();
              }}
            >
              {part}
            </button>
          ) : (
            part
          );
        })}
      </blockquote>
      {definition ? <p aria-live="polite">{definition}</p> : null}
    </>
  );
}
