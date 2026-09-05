"use client";
import { useState } from "react";
import type { CoursePack } from "./schema";
export function DialogueView({
  dialogue,
  language,
}: {
  dialogue: CoursePack["dialogues"][number];
  language: string;
}) {
  const [nodeId, setNodeId] = useState(dialogue.start),
    [feedback, setFeedback] = useState("");
  const node = dialogue.nodes.find((n) => n.id === nodeId)!;
  return (
    <article className="study-grammar">
      <h3>{dialogue.title}</h3>
      <p>{dialogue.goal}</p>
      <blockquote lang={language}>{node.line}</blockquote>
      <details>
        <summary>Meaning</summary>
        {node.meaning}
      </details>
      {feedback ? <p role="status">{feedback}</p> : null}
      {node.complete ? (
        <>
          <p>Conversation complete. You reached the goal.</p>
          <button
            onClick={() => {
              setNodeId(dialogue.start);
              setFeedback("");
            }}
          >
            Try the conversation again
          </button>
        </>
      ) : (
        <div className="study-actions">
          {node.choices.map((c) => (
            <button
              lang={language}
              key={c.text}
              onClick={() => {
                setNodeId(c.next);
                setFeedback(c.feedback);
              }}
            >
              {c.text}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
