import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readIfExists(p: string): string | null {
  const full = path.join(ROOT, p);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

describe("deploy + migrations (Task 17)", () => {
  it("Dockerfile exists with multi-stage node:22-alpine, npm ci, build, and prisma migrate deploy", () => {
    const dockerfile = readIfExists("Dockerfile");
    expect(dockerfile, "expected Dockerfile at repo root").not.toBeNull();
    const c = dockerfile!;

    // multi-stage: at least two FROM lines
    const fromLines = c.match(/^FROM\s+/gim) ?? [];
    expect(fromLines.length, "Dockerfile must be multi-stage (at least 2 FROM)").toBeGreaterThanOrEqual(2);

    // stages named builder / runner or at least two stages
    expect(c).toMatch(/FROM\s+node:22-alpine/i);
    expect(c).toMatch(/AS\s+builder/i);
    // runner stage also node:22-alpine (second FROM)
    const nodeAlpineMatches = c.match(/node:22-alpine/g) ?? [];
    expect(nodeAlpineMatches.length, "expected at least 2 node:22-alpine references (builder + runner)").toBeGreaterThanOrEqual(2);

    // builder does npm ci and build
    expect(c).toMatch(/npm ci/);
    expect(c).toMatch(/npm run build|next build/);

    // runner has prisma migrate deploy in entrypoint/cmd/run
    expect(c).toMatch(/prisma migrate deploy/);

    // runner should have prisma generate or copy prisma
    expect(c.toLowerCase()).toMatch(/prisma/);
  });

  it(".env.example documents DATABASE_URL, VERBALIBERA_VOICE_SERVICE_URL, AUTH_JWT_*, WEBAUTHN_RP_ID", () => {
    const envExample = readIfExists(".env.example");
    expect(envExample, "expected .env.example at repo root").not.toBeNull();
    const c = envExample!;

    expect(c).toMatch(/DATABASE_URL/);
    expect(c).toMatch(/VERBALIBERA_VOICE_SERVICE_URL/);
    // AUTH_JWT_* — check at least private and public key variants (file or inline)
    expect(c).toMatch(/AUTH_JWT_PRIVATE_KEY/);
    expect(c).toMatch(/AUTH_JWT_PUBLIC_KEY/);
    expect(c).toMatch(/WEBAUTHN_RP_ID/);
    // Also ensure WEBAUTHN related and JWT overall present
    expect(c).toMatch(/AUTH_JWT/);
  });

  it("compose.yml exists with app + postgres 16 and optional voice", () => {
    const composeYml = readIfExists("compose.yml") ?? readIfExists("compose.yaml");
    expect(composeYml, "expected compose.yml (or compose.yaml) at repo root").not.toBeNull();
    const c = composeYml!;

    // must define services
    expect(c).toMatch(/services\s*:/);

    // app service
    expect(c).toMatch(/\bapp\s*:/);

    // postgres 16
    expect(c).toMatch(/postgres:\s*16/);
    expect(c).toMatch(/image\s*:\s*postgres:16/i);

    // db service (postgres)
    expect(c).toMatch(/\bdb\s*:/);

    // compose should reference DATABASE_URL
    expect(c).toMatch(/DATABASE_URL/);

    // optional voice sidecar — if present, should reference voice
    // we at least check file mentions voice or has a voice service/profile
    // to keep test not overly strict, accept either voice service present or comment about optional
    const hasVoice = /voice\s*:/i.test(c) || /VERBALIBERA_VOICE_SERVICE_URL/i.test(c);
    expect(hasVoice, "compose should mention voice service or VERBALIBERA_VOICE_SERVICE_URL").toBe(true);
  });

  it("README Quick start documents docker compose up and prisma migrate", () => {
    const readme = readIfExists("README.md");
    expect(readme, "expected README.md").not.toBeNull();
    const c = readme!;
    expect(c).toMatch(/docker compose up/i);
    expect(c).toMatch(/prisma migrate/);
  });
});
