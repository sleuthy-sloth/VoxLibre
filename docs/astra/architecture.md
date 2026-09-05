# Course workspace design

Original Next/React, Prisma/Postgres, passkeys, legacy course IDs, SM-2, Anki and voice boundaries remain. New public course JSON is authored separately under `courses/`, validated with Zod and graph/reference checks, then copied into installable public packs. A pack identifies its compatibility schema and content version; IDs remain stable across content edits.

A shared React course workspace runs in Next at `/courses/[language]` and in a bundled static `/study.html` entry for offline cold starts. The browser fetches only the selected language. Public shell/code/course/audio artifacts may be explicitly downloaded. Personalized Next HTML and APIs remain network-only.

Practice uses a pure authored-answer evaluator. It never contacts a translation/model endpoint. Mode-specific append-only practice events feed a deterministic mastery projection and SM-2 schedules. Local events are stored durably in IndexedDB before reporting success, identified by mutation UUID, and explicitly labeled device-only. Existing account-backed travel course progress remains separate. Export/import permits recovery and merges events by ID; it does not impersonate account sync.

Chosen over replacing the legacy engine: additive integration preserves existing working behavior and gives course authoring a clean scalable boundary. Chosen over caching Next navigation: the public static shell has no account material and remains usable on an offline cold start.
