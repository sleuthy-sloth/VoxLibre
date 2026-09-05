# Offline course operation

1. Open `/courses/italian` or `/courses/french` while connected.
2. Select Download for offline study. Installation fetches `/study.html`, `/study.js`, `/study.css`, the selected JSON pack and its declared media. Audio SHA-256 hashes are verified. A final cache marker makes the installation visible only after all requests succeed.
3. Open the provided `/study.html?language=italian` link. This public shell runs the same React workspace without Next navigation or account HTML. Save/bookmark this entry for offline cold starts.
4. Study, practise, review and use references offline. The browser commits practice to IndexedDB before advancing or claiming success.

## Privacy and durability

The existing worker still keeps `/api/*` and personalized Next navigation network-only. Course caches contain explicitly public files only. The legacy offline reconnect page remains the fallback for other navigation. Installing one language does not remove the other. A failed install removes its incomplete cache; a completed replacement removes only installations of that language that were already committed when it began; concurrent in-progress installs are preserved. Browser storage eviction or user deletion can remove local data, so export is available and persistent-storage permission is requested opportunistically.

New practice uses a separate IndexedDB database, `verbalibera-course-practice`, with an append-only events store. Each selected account uses a separate database suffixed with its encoded user ID. The selected account remains available for offline study on this browser; use a trusted device. Signing out does not erase these local copies. Select guest practice to return to the separate guest history. Events contain a UUID, pack/version, exercise ID, timestamp and outcome/hint flags. They do not contain typed answers, audio, cookies or account credentials. Read/write transactions serialize concurrent imports and saves; duplicate UUIDs count once and conflicting UUID payloads abort the import. Quota/storage errors are displayed. No successful-save message appears before commit.

## Synchronization and compatibility

Foundation practice starts in guest mode. **Use signed-in account** verifies the active session and opens its separate store; it never silently imports guest history. Account events synchronize on opening, after a local save/import, on reconnection, or with **Sync now**. Session expiry/account changes stop uploads with visible feedback. Every GET/POST binds the expected user ID to the authenticated session. Switching workspace scope remounts the practice session so an in-flight save retains its original owner.

GET `/api/course-progress` identifies the current account. With expected `userId` and `after`, it returns up to 500 events ordered by server sequence. POST accepts up to 100 events / 128 KB, requires CSRF and same-origin headers, and returns success only after transaction commit. All responses are no-store; the worker never caches APIs. Per-account row locks serialize insertion before sequence allocation. The unique account/mutation key deduplicates retries; different payloads under one key abort the entire batch. Old or unknown exercise IDs are retained.

The client durably merges each downloaded page before uploading local IDs missing from the remote snapshot. Network failure may leave some batches committed; retries reconcile them without duplication. No local events are deleted after upload. Reconciliation currently reads the full paginated account log, so incremental acknowledgements remain a performance improvement for very large histories. Lesson completion and concept evidence synchronize through their source events; placement and study-plan preferences do not yet sync.

Export/import provides manual recovery and deliberate guest-to-account transfer, limited to 10 MB / 25,000 events per import. Back up before clearing browser storage.

Compatible content versions retain practice by stable exercise ID. Retired/unknown IDs stay in the event store and exports but do not contribute to the current course projection. An incompatible schema is rejected explicitly. This is an additive content boundary: pack installation changes no account records; deploying account sync requires the additive 20260905140000_foundation_practice migration.

Chromium cold-start offline practice, persistence and private-page fallback are covered by browser tests. WebKit online learning is tested; actual Safari/iPhone offline cold starts remain unverified because Playwright WebKit offline emulation failed internally despite an activated worker and complete cache.
