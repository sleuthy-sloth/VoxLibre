// Development invariant: learner code cannot silently acquire a generative-model dependency.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { it, expect } from "vitest";
const sdk =
  /(?:^|[/'"\s])(?:openai|@anthropic-ai|@google\/generative-ai|@google\/genai|@ai-sdk|langchain|ollama|openrouter)(?:[/\s'"-]|$)/i;
const endpoint =
  /(?:api\.(?:openai|anthropic|deepseek)\.com|generativelanguage\.googleapis\.com|openrouter\.ai|\/v1\/chat\/completions|(?:OPENAI|ANTHROPIC|GEMINI|DEEPSEEK|OPENROUTER)_API_KEY)/i;
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(dir, e.name))
      : /\.(?:ts|tsx|js)$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}
it("rejects generative SDKs, endpoints and keys in learner runtime", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  expect(
    Object.keys(pkg.dependencies).filter((name) => sdk.test(name)),
  ).toEqual([]);
  const violations = files("src")
    .filter((path) => !path.includes("/test/"))
    .filter((path) => {
      const source = readFileSync(path, "utf8");
      return (
        endpoint.test(source) ||
        source
          .split("\n")
          .some((line) => /(?:import|require\()/i.test(line) && sdk.test(line))
      );
    });
  expect(violations).toEqual([]);
});
it("the guard recognizes known hosted and local model imports", () => {
  for (const sample of [
    'import OpenAI from "openai"',
    'import {generateText} from "@ai-sdk/openai"',
    'require("ollama")',
  ])
    expect(sdk.test(sample)).toBe(true);
  for (const sample of [
    "OPENAI_API_KEY",
    "https://api.anthropic.com",
    "http://localhost:11434/v1/chat/completions",
  ])
    expect(endpoint.test(sample)).toBe(true);
});
