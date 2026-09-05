# Implementation report — 2026-09-05

The initial slice described below delivers an additive Italian/French foundation course system with genuine offline practice and deterministic grading. It is a substantial working foundation, not a complete A1–C2 curriculum or completion of every requested phase. Existing travel courses, accounts, database schema, placement, study plans, Anki and local voice remain available.

## Latest continuation: listening and final verification

Foundation packs are now version 1.1.0: 32 lessons, **224 exercises**, and **32 newly generated recordings** (16 per language, in addition to the two reused recordings). Every lesson offers model playback and optional dictation with slow replay. Optional exercise IDs preserve previous text completion and maintain separate listening evidence. Numeric notation is accepted where equivalent. See [listening authoring and QA](foundation-listening.md) and the [full phase-status tracker](phase-status.md).

All 32 new waveforms passed rate/duration/silence/clipping checks. Local Whisper matched 26/32 transcripts after punctuation/case normalization; the remaining six were reviewed as homophones or numeric notation, as detailed in the raw report. Native-speaker listening/prosody review remains open. Runtime TTS is not required. New WAV storage is 1,489,904 bytes Italian and 1,363,904 bytes French. The shared offline bundle is 664,203 bytes raw / 160,035 gzip; see the current [asset report](reports/asset-sizes.json).

Final verification after both continuations: **408 unit/component tests**, **26 Chromium production E2E tests**, **4 WebKit tests**, **37 Python tests**, production build and TypeScript passed. Lint has zero errors and the same 18 existing warnings. Browser tests verify actual audio playback, slow replay, listening evidence, and Chromium offline playback. WebKit retains one explicitly skipped offline-emulation scenario; physical Safari offline verification remains open. Italian/French layouts at 320/390/430/844/1280 pixels had no overflow, audited lesson views had zero axe violations, and the visual-QA traversal had no browser exceptions or console errors. [Listening mobile screenshot](screenshots/listening-french-390.png).

Both continuations received independent code review with no important unresolved findings. No remote database writes, pushes or deployments occurred. The Docker disk-space limitation from the initial slice remains unresolved and no repeated image build was attempted.

## Continuation: account synchronization

Added explicit account/guest selection, isolated local databases and authenticated two-way event synchronization. Reviews, derived completion and concept evidence now follow the account across browsers. Offline saves upload on reconnect. Conflicting mutation payloads fail atomically, concurrent identical uploads count once, and a changed session cannot receive another account’s pending work. Guest data is never uploaded automatically. Deployment requires the additive `20260905140000_foundation_practice` migration; it was applied only to the isolated local test database.

Verified: 404 unit tests, lint (0 errors / 18 existing warnings), production build and typecheck. A real passkey/Postgres browser flow verified two independent browser stores, offline save/reload/reconnect, guest isolation, eight concurrent replay requests, conflict rollback and account mismatch rejection. An independent code review found no important defects. Placement and study-plan sync remain deferred; full-log reconciliation is intentionally simple and should become incremental for very large histories. The sections below retain the initial slice’s scope and results as historical context; their device-only limitation is superseded by this continuation.

## Completed

- Versioned, validated JSON course packs, a generated language catalog and per-language lazy loading. Content is independent of React application code.
- Italian and French each have 4 units, 16 lessons, 16 concepts, 64 vocabulary/expression records, 96 exercises, 16 original short readings and 2 branching dialogues. Total: 32 lessons and 192 exercises. Teaching precedes practice; prerequisites gate progression and later lessons retrieve earlier material.
- Shared exercise renderers for authored translations, ordering, cloze, reading and prerecorded dictation; contracts/renderers also support choice and transformation. Deterministic normalization, explicit variants, authored error feedback, conservative typo handling and assisted-answer tracking run locally.
- Immutable practice events, idempotent backup merging, mode-separated concept evidence, SM-2 review state and bounded daily selection prioritizing due/weak work before new material. Revealing a model or reading translation, or looking up a reading word, prevents unaided recall credit.
- Searchable vocabulary, linked grammar explanations and static dialogue choices with recovery branches.
- Intentional course downloads with audio hash checks and completion markers; a shared static study entry supports offline cold starts. IndexedDB commits precede success messages. Export/import supports manual backup and transfer. Concurrent installs cannot delete another in-progress installation.
- Content validation/build/report commands and CI integration; regression guards against common runtime generative-model SDKs, endpoints and keys.
- Quiet Ink course navigation, keyboard focus handling, reduced-motion support and responsive layouts. Italian/French entry links appear on the existing lesson index.
- Fixed an existing passkey challenge-consumption expiry predicate discovered by real local-database browser testing. Its independent commit is `c9d8692`.

## Partially completed

- **A1 depth:** both packs are explicitly partial foundation syllabuses. They introduce distinct grammar progressions but do not cover all requested domains or provide a full course's volume of varied retrieval.
- **Listening:** one existing attributed recording per pack, with normal/slow playback and dictation. Other lessons disclose that they are text-only. This is limited integration, not broad listening expansion.
- **Mastery/adaptation:** transparent exercise/mode evidence and scheduling are implemented. Vocabulary status is an approximate projection from associated exercises. Rich concept stability models, exercise-diversity balancing and goal-driven scheduling remain open.
- **Offline/sync:** foundation study works locally with manual export/import. New foundation progress does not sync to accounts, even when signed in. Existing account-backed travel progress and its offline queue remain separate.
- **Reading:** short original texts, glossary lookup and optional translation are implemented; saving individual reading words, sentence-level audio and longer graded materials are not.
- **Content QA:** schemas validate declared references, bounds, graphs, answers and media. They cannot establish translation correctness, discover every undeclared word or certify CEFR alignment. Native-speaker editorial review remains necessary.

## Intentionally deferred

New Spanish/Portuguese packs; advanced CEFR courses; expanded/adaptive placement and study-plan integration; full cross-language interference data; conjugation dictionaries; the entire proposed exercise catalogue; new pronunciation scoring; FSRS migration; remote pack marketplace; automatic synchronization of foundation events, placement and study plans. Existing working implementations were retained instead of replaced with placeholders.

## Remaining technical debt

- Two course systems coexist. Future migration needs explicit stable-ID mapping and account-event ingestion with ownership checks and server-side idempotency; no database migration was needed for this additive slice.
- The offline bundle includes runtime schema validation: 658,612 bytes raw / 158,370 gzip. Italian JSON is 88,032 / 10,806 gzip; French is 90,196 / 10,865 gzip. Only the selected language is fetched. See [asset sizes](reports/asset-sizes.json). Network timing and database-query performance were not benchmarked.
- Browser storage can be evicted. Persistent-storage requests and backup support reduce, but cannot remove, this risk.
- Generated public artifacts are committed and rebuilt by tooling. CI validates source content; future work could enforce a generated-artifact diff check.
- Eighteen pre-existing lint warnings remain. No lint errors were introduced.
- A full Docker image build remains unverified because the local Docker VM ran out of space during dependency installation. Unrelated containers/images were left intact.
- Physical iPhone Safari/PWA offline and keyboard behavior remain unverified. Playwright WebKit offline emulation failed internally; its offline test is explicitly skipped. Chromium offline coverage passes.

## Remaining content work

Prioritize native-speaker review and additional varied practice within the existing progression, then prerecorded listening for each lesson. Expand time/dates, work/school, shopping/prices, weather, directions, health/emergencies and invitations. Deepen auxiliary selection, conjugation paradigms and object pronouns only after their prerequisites are taught. Recordings, minimal pairs and pronunciation prompts need language-specific review and provenance. Do not label either foundation pack a complete A1 course before these gaps are addressed.

## Final verification

| Check | Result |
| --- | --- |
| Unit/component tests | 63 files, 393 tests passed (baseline: 372) |
| ESLint | 0 errors; 18 existing warnings |
| Production build | Passed, including validated pack/offline artifact generation |
| TypeScript | Passed after production build |
| Chromium production E2E | 23 passed, including real passkey registration/sign-in, persisted account review, placement, study plan, Italian offline cold start and French progression |
| iPhone-profile WebKit | 2 passed; 1 offline test explicitly skipped for the emulation limitation |
| Voice Python tests | 37 passed; 1 upstream deprecation warning |
| Layout/visual QA | Italian and French in Chromium/WebKit at 320, 390, 430, 844 landscape and 1280 pixels; no horizontal overflow |
| Accessibility audit | Zero WCAG 2 A/AA and 2.1 AA axe violations in the audited lesson views |
| Browser diagnostics | No page exceptions or console errors in the course visual-QA traversal |
| Docker image | Blocked externally by Docker VM ENOSPC; not counted as passing |

Screenshots: [desktop course](screenshots/chromium-course-1280.png), [Italian mobile](screenshots/chromium-italian-390.png), [French WebKit](screenshots/webkit-french-390.png). Machine-readable results: [browser QA](reports/browser-qa.json), [Italian content](reports/italian.json), [French content](reports/french.json). These are representative views, not an exhaustive accessibility certification.

Production preview runs at `http://localhost:3210/courses/italian`. Real account verification used only the isolated `verbalibera-astra-test-db` Postgres container on loopback port 55439. No remote database was migrated or used for test writes. No changes were pushed or deployed. See [testing instructions](testing.md) to reproduce checks.
