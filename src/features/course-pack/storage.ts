import { z } from "zod";
import { eventSchema, mergeEvents, type PracticeEvent } from "./progress";
import type { CoursePack } from "./schema";
const DB = "verbalibera-course-practice";
export function decodeBackup(raw: string): PracticeEvent[] {
  if (raw.length > 10_000_000) throw new Error("Backup is too large.");
  const parsed = z
    .object({ format: z.literal(1), events: z.array(eventSchema).max(25000) })
    .parse(JSON.parse(raw));
  return mergeEvents(parsed.events);
}
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("events", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Device storage could not be opened. Practice has not been saved.",
        ),
      );
  });
}
export async function readEvents(): Promise<PracticeEvent[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const request = tx.objectStore("events").getAll();
    tx.oncomplete = () => {
      db.close();
      try {
        resolve(mergeEvents(request.result));
      } catch (e) {
        reject(e);
      }
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Could not read device practice."));
    };
  });
}
export async function storeEvents(incoming: PracticeEvent[]): Promise<void> {
  const validated = mergeEvents(incoming),
    db = await database();
  return new Promise((resolve, reject) => {
    // Read and write in one serialized transaction; concurrent tabs cannot lose practice.
    const tx = db.transaction("events", "readwrite"),
      store = tx.objectStore("events"),
      read = store.getAll();
    let conflict: unknown;
    read.onsuccess = () => {
      try {
        mergeEvents(read.result, validated);
        for (const event of validated) store.put(event);
      } catch (e) {
        conflict = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      reject(
        conflict ??
          new Error(
            "Storage is full or unavailable. Practice was not saved. Export your existing progress.",
          ),
      );
    };
    tx.onerror = () => {};
  });
}
export async function installPack(
  pack: CoursePack,
  language: string,
): Promise<void> {
  if (!("serviceWorker" in navigator) || !("caches" in window))
    throw new Error(
      "Offline installation needs a secure browser with service worker support.",
    );
  await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  // Capture only already-committed installations. Never delete another tab's
  // in-progress download, including one started while our network requests run.
  const previous: string[] = [];
  for (const key of await caches.keys()) {
    if (!key.startsWith(`verbalibera-pack-${pack.id}-`)) continue;
    const old = await caches.open(key);
    if (await old.match("/__course_pack_ready__")) previous.push(key);
  }
  const name = `verbalibera-pack-${pack.id}-${pack.version}-${crypto.randomUUID()}`;
  const cache = await caches.open(name);
  try {
    for (const url of [
      "/study.html",
      "/study.js",
      "/study.css",
      `/packs/${language}.json`,
      ...pack.media.map((m) => m.url),
    ]) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok)
        throw new Error(`Download failed: ${url}. Retry when connected.`);
      const media = pack.media.find((m) => m.url === url);
      if (media) {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          await response.clone().arrayBuffer(),
        );
        const hash = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        if (hash !== media.sha256)
          throw new Error(
            "Audio integrity check failed. Download was not installed.",
          );
      }
      if (url.endsWith(".json")) {
        const received = await response.clone().json();
        if (received.version !== pack.version || received.id !== pack.id)
          throw new Error(
            "The course changed during download. Reload and retry.",
          );
      }
      await cache.put(url, response);
    }
    // Only caches with this final commit marker are read by the service worker.
    await cache.put("/__course_pack_ready__", new Response(pack.version));
  } catch (error) {
    await caches.delete(name);
    throw error;
  }
  // Replace this language only, after the new installation is complete.
  for (const key of previous) await caches.delete(key);
  await navigator.storage?.persist?.().catch(() => false);
}
export async function installedPack(language: string): Promise<boolean> {
  if (!("caches" in globalThis)) return false;
  for (const key of await caches.keys())
    if (key.startsWith("verbalibera-pack-")) {
      const c = await caches.open(key);
      if (
        (await c.match("/__course_pack_ready__")) &&
        (await c.match(`/packs/${language}.json`))
      )
        return true;
    }
  return false;
}
