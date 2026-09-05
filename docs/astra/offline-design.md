# Offline course operation

1. Open `/courses/italian` or `/courses/french` while connected.
2. Select Download for offline study. Installation fetches `/study.html`, `/study.js`, `/study.css`, the selected JSON pack and its declared media. Audio SHA-256 hashes are verified. A final cache marker makes the installation visible only after all requests succeed.
3. Open the provided `/study.html?language=italian` link. This public shell runs the same React workspace without Next navigation or account HTML. Save/bookmark this entry for offline cold starts.
4. Study, practise, review and use references offline. The browser commits practice to IndexedDB before advancing or claiming success.

## Privacy and durability

The existing worker still keeps `/api/*` and personalized Next navigation network-only. Course caches contain explicitly public files only. The legacy offline reconnect page remains the fallback for other navigation. Installing one language does not remove the other. A failed install removes its incomplete cache; a completed replacement removes only installations of that language that were already committed when it began; concurrent in-progress installs are preserved. Browser storage eviction or user deletion can remove local data, so export is available and persistent-storage permission is requested opportunistically.

New practice uses a separate IndexedDB database, `verbalibera-course-practice`, with an append-only events store. Events contain a UUID, pack/version, exercise ID, timestamp and outcome/hint flags. They do not contain typed answers, audio, cookies or account credentials. Read/write transactions serialize concurrent imports and saves; duplicate UUIDs count once and conflicting UUID payloads abort the import. Quota/storage errors are displayed. No successful-save message appears before commit.

## Synchronization and compatibility

Foundation practice is device-local, including when the learner is signed in. It is deliberately distinct from the account-backed travel courses. No automatic account/cloud synchronization is implemented for foundation events, completion, placement or study-plan preferences. Export/import provides manual recovery/transfer, not cloud sync. Backups are limited to 10 MB / 25,000 events on import.

Compatible content versions retain practice by stable exercise ID. Retired/unknown IDs stay in the event store and exports but do not contribute to the current course projection. An incompatible schema is rejected explicitly. This is an additive content boundary: no existing Prisma migration or account record is changed by pack installation.

Chromium cold-start offline practice, persistence and private-page fallback are covered by browser tests. WebKit online learning is tested; actual Safari/iPhone offline cold starts remain unverified because Playwright WebKit offline emulation failed internally despite an activated worker and complete cache.
