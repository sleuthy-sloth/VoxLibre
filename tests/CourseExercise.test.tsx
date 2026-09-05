import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { it, expect, vi } from "vitest";
import { validatePack } from "@/features/course-pack/schema";
import { ExerciseView } from "@/features/course-pack/ExerciseView";
it("records reading with a revealed translation as assisted practice", async () => {
  const p = validatePack(
      JSON.parse(readFileSync("courses/italian/manifest.json", "utf8")),
    ),
    e = p.lessons[0].exercises.find((e) => e.kind === "reading")!;
  const save = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  render(<ExerciseView pack={p} exercise={e} onSave={save} />);
  await user.click(screen.getByText("Sentence translation"));
  await user.type(screen.getByLabelText("Your answer"), "Anna");
  await user.click(screen.getByRole("button", { name: "Check answer" }));
  await user.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ accepted: true }),
    true,
  );
});
