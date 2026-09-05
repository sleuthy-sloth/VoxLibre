import { it, expect, vi } from "vitest";
import { mergeEvents } from "@/features/course-pack/progress";
import { decodeBackup } from "@/features/course-pack/storage";
it("merges backups idempotently and rejects conflicting mutation IDs atomically", () => {
  const e = {
    id: "abc",
    packId: "it-foundations",
    version: "1.0.0",
    exerciseId: "exercise",
    at: "2026-09-05T00:00:00.000Z",
    correct: true,
    revealed: false,
  };
  expect(decodeBackup(JSON.stringify({ format: 1, events: [e, e] }))).toEqual([
    e,
  ]);
  expect(() => mergeEvents([e], [{ ...e, correct: false }])).toThrow(
    /Conflicting/,
  );
  expect(() => decodeBackup('{"format":2,"events":[]}')).toThrow();
});

it("keeps a discoverable installation when two tabs download concurrently", async () => {
  const { installPack } = await import("@/features/course-pack/storage");
  const { validatePack } = await import("@/features/course-pack/schema");
  const { readFileSync } = await import("node:fs");
  const pack = {
    ...validatePack(
      JSON.parse(readFileSync("courses/italian/manifest.json", "utf8")),
    ),
    media: [],
  };
  const stores = new Map<string, Map<string, Response>>();
  const cacheApi = {
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name)!;
      return {
        put: async (key: string, value: Response) => {
          entries.set(key, value);
        },
        match: async (key: string) => entries.get(key),
      };
    },
  };
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let scripts = 0;
  vi.stubGlobal("caches", cacheApi);
  vi.stubGlobal("navigator", {
    serviceWorker: { register: async () => ({}), ready: Promise.resolve() },
  });
  vi.stubGlobal("fetch", async (url: string) => {
    if (url === "/study.js" && ++scripts === 2) await held;
    return new Response(
      url.endsWith(".json") ? JSON.stringify(pack) : "public artifact",
    );
  });
  const time = vi
    .spyOn(Date, "now")
    .mockReturnValueOnce(1)
    .mockReturnValueOnce(2);
  try {
    const first = installPack(pack, "italian"),
      second = installPack(pack, "italian");
    await first;
    release();
    await second;
    const installed = [...stores.values()].filter(
      (c) => c.has("/__course_pack_ready__") && c.has("/packs/italian.json"),
    );
    expect(installed.length).toBeGreaterThan(0);
  } finally {
    release();
    time.mockRestore();
    vi.unstubAllGlobals();
  }
});
