# Initial audit — 2026-09-05

Checkout: `sleuthy-sloth/VerbaLibera`, baseline `d9bb6e8`. The supplied VoxLibre working directory no longer exists; the clean sibling VerbaLibera checkout is the matching repository.

## Evidence

Read repository guidance, README, Prisma schema and migrations, curriculum contracts/fixtures/teaching/CEFR/access policy, session composition and renderer, answer checking, SM-2, placement, plan generation, offline queue and service worker, voice contracts/routes, tests, and historical plan/design headings and relevant decisions. Existing plans describe deliberate production practice, truthful preview progress, original audio, and account isolation; preserve those constraints.

Baseline: 59 Vitest files / 372 tests pass. Production build passes. Typecheck passes after build (concurrent typecheck saw build replacing generated Next types; run these sequentially). ESLint has 18 warnings, zero errors. Playwright: 18 pass, one skipped account test, one failure: Italian placement assertion expects `Placement · 1 of 8` while rendered accessible text is `Placement · question 1 of 8`. This is a stale assertion, not a placement failure.

## Findings

- Four course fixtures contain eight travel patterns each. Large TypeScript fixture and separate teaching tables duplicate content responsibilities. All-language fixture imports reach client components. Scaling those arrays would inflate every initial download.
- Existing lesson rendering intertwines progression, checking, audio, persistence and six exercise forms. A typed registry and separate content boundary can grow independently while existing users retain their lessons.
- CEFR spine supports A1–C2 tags, but coverage is not a complete A1 syllabus. French placement contains higher-level questions that exceed available lessons. Keep recommendations explicitly provisional.
- Answer checking uses authored exact variants, then optional translation and English content-word overlap. That overlap cannot establish grammatical correctness. New practice should use browser-local deterministic grading with authored mistakes and accent feedback.
- SM-2 is pure, bounded, and tested. Preserve it; there is no evidence warranting an algorithm replacement. Existing mastery is assessment-level, not skill-modality evidence.
- Service worker deliberately avoids personalized navigation/API caching. Offline fallback requires reconnection. Review queue is session-bound and cannot provide offline teaching or persistent course access.
- Existing review route checks idempotency and computes state outside its write transaction; simultaneous submissions remain a concurrency risk. Avoid extending that model casually.
- Account data, preview data, placement and plan local storage have different persistence semantics. New local progress must clearly disclose its device scope and never imply account sync.
- Prerecorded assets and optional voice infrastructure are useful. No new audio should be claimed until generated and checked. Transcription is not pronunciation scoring.

## Chosen vertical slice

Add validated versioned Italian/French foundation packs, deterministic grading, mode-specific evidence and review selection, a teaching-first course workspace, vocabulary/grammar references, and intentional offline installation. Keep old routes, stable database IDs, passkeys, Anki and audio intact. Do not import all new packs into shared client code. Reuse the exact workspace code in a public static offline entry; cache only explicit public artifacts. Report account synchronization and curriculum/audio gaps honestly rather than introduce unsafe migration shortcuts.
