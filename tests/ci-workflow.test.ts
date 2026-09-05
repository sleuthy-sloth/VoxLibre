import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const WORKFLOW_PATH = path.join(process.cwd(), ".github/workflows/ci.yml");

function readWorkflow(): string {
  if (!fs.existsSync(WORKFLOW_PATH)) {
    throw new Error(`Workflow not found at ${WORKFLOW_PATH}`);
  }
  return fs.readFileSync(WORKFLOW_PATH, "utf8");
}

describe("CI workflow", () => {
  it("exists at .github/workflows/ci.yml", () => {
    expect(fs.existsSync(WORKFLOW_PATH), "expected .github/workflows/ci.yml to exist").toBe(true);
  });

  it("is valid YAML with jobs and steps", async () => {
    const content = readWorkflow();
    // must contain top-level keys
    expect(content).toMatch(/jobs\s*:/);
    expect(content).toMatch(/steps\s*:/);
    expect(content).toMatch(/on\s*:/);

    // yaml validation via js-yaml if available, otherwise basic structural check
    let parsed: unknown = null;
    let yamlError: unknown = null;
    try {
      // js-yaml is a transitive dep via eslint; use dynamic import to avoid hard dep
      // @ts-expect-error - js-yaml types not installed but runtime is available transitively
      const mod = await import("js-yaml");
      const load =
        (mod as unknown as { load: (s: string) => unknown }).load ??
        (mod as unknown as { default: { load: (s: string) => unknown } }).default.load;
      parsed = load(content);
    } catch (e) {
      yamlError = e;
      // fallback: if js-yaml not available, ensure file is non-empty and has expected keys
      if (String(e).includes("Cannot find") || String(e).includes("Failed to resolve")) {
        yamlError = null;
        parsed = { jobs: {}, on: {} };
      }
    }
    expect(yamlError, yamlError ? String(yamlError) : "yaml parse failed").toBeNull();
    expect(parsed).toBeTruthy();
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      expect(obj.jobs, "yaml must contain jobs").toBeTruthy();
    }
  });

  it("uses Node 22", () => {
    const c = readWorkflow();
    expect(c).toMatch(/node-version\s*:\s*['"]?22['"]?/);
  });

  it("sets up Python 3.11 without downloading models", () => {
    const c = readWorkflow();
    expect(c).toMatch(/python-version\s*:\s*['"]?3\.11['"]?/);
    // ensure no model download – kokoro models are large and should not be fetched in CI
    const lower = c.toLowerCase();
    expect(lower).not.toMatch(/kokoro/);
    expect(lower).not.toMatch(/huggingface.*snapshot_download/);
    expect(lower).not.toMatch(/wget.*kokoro/);
    expect(lower).not.toMatch(/hf_hub_download/);
    // should not contain generic model download that would pull large binaries
    // allow pip install but not model blobs
    expect(c).not.toMatch(/download.*model/i);
  });

  it("caches node_modules and pip", () => {
    const c = readWorkflow();
    // must cache npm / node_modules and pip
    // setup-node cache or actions/cache
    const lower = c.toLowerCase();
    expect(lower).toMatch(/cache/);
    // check node cache
    const hasNodeCache =
      /cache:\s*['\"]?npm['\"]?/.test(c) ||
      /actions\/cache/.test(c) ||
      /cache-dependency-path/.test(c);
    expect(hasNodeCache, "expected npm/node cache configuration").toBe(true);
    // check pip cache
    const hasPipCache =
      /cache:\s*['\"]?pip['\"]?/.test(c) ||
      /cache-dependency-path.*requirements/i.test(c) ||
      /actions\/cache/.test(c) ||
      /setup-python.*cache/.test(c);
    expect(hasPipCache, "expected pip cache configuration").toBe(true);
  });

  it("contains required steps: npm ci, prisma validate, prisma generate, vitest run, next build, playwright test", () => {
    const c = readWorkflow();
    expect(c).toMatch(/npm ci/);
    expect(c).toMatch(/prisma validate/);
    expect(c).toMatch(/prisma generate/);
    // vitest run: either 'vitest run' or 'npm run test' or 'npm test' that invokes vitest
    expect(c).toMatch(/vitest run/);
    // next build: either 'next build' or 'npm run build'
    expect(c).toMatch(/next build/);
    expect(c).toMatch(/playwright test/);
  });

  it("installs playwright browsers with deps and runs chromium project", () => {
    const c = readWorkflow();
    expect(c).toMatch(/playwright install --with-deps/);
    expect(c).toMatch(/playwright test.*--project=chromium|playwright test.*chromium/);
  });

  it("uses npm ci deterministically (not npm install)", () => {
    const c = readWorkflow();
    // should use npm ci, and not bare npm install without ci
    expect(c).toMatch(/npm ci/);
    // ensure not using npm install without ci in same workflow (allow comments)
    const lines = c.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    const hasBareInstall = lines.some(
      (l) => /npm install/.test(l) && !/npm ci/.test(l)
    );
    expect(hasBareInstall, "should use 'npm ci' not 'npm install'").toBe(false);
  });
});
