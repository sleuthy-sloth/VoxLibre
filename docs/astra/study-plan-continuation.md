# September 5: review and operational study plans

Reviewed GitHub main through `18adcce` (study-plan integration, slice 3) and `44d70bb` (Italian fixed placement). The repository's phased status document remains the source of development priorities; neither commit records a numbered slice-4 specification. This continuation advances operational study plans and account synchronization (phases 8, 16 and 18).

## Review findings and repairs

- Default weekly plans grouped all teaching before drills. Truncating to a daily budget could select only teaching, while advancement required a successful drill. Daily selection now pairs teaching with retrieval without changing stored checklist positions or keys.
- The plan branch returned before adding overdue practice. It now reserves room for due reviews within the configured session budget.
- Shallow casts accepted malformed nested weeks/items and mismatched concept/drill references. A shared parser validates stored structure and course ownership before scheduling or rendering.
- The dashboard read guest storage even for signed-in users. Account plan summaries now come from the authenticated progress snapshot.
- The account session queried StudyPlan rows, but the builder never wrote them. The builder now loads, saves and resets account plans through authenticated, CSRF-protected routes using the existing table.
- Plan drill links omitted the selected drill, making above-A1 plan drills inaccessible through the checklist. Links now pass a drill reference; lesson composition validates that it belongs to the requested concept and teaches before the requested practice.
- Account daily counts now reflect actual composed plan steps, excluding separately scheduled due reviews.

The baseline passed 439 unit/component tests despite these integration gaps. Added regression cases reproduced the failures before repairs. An independent code review identified the drill-link and daily-count issues, both addressed here.

## Account behavior

Guests retain the existing browser-local plan and manual checklist. Account plans are stored separately and do not silently import guest plans or checkmarks. Placement prefill remains browser-local and optional. Signed-in plan completion derives from successful saved drills; it is not certification or a separate mastery record. Repeated checklist entries share drill evidence, while actual spaced reviews remain driven by SRS due dates.

Saves append a plan revision; reads use the latest creation time and ID. A reset removes plans for the authenticated account and selected course, preserving practice history. The editor binds mutations to its loaded account identity and reports failures instead of claiming a save. Conflicting simultaneous edits use the latest saved revision; offline account-plan editing is not provided.

## Remaining phase work

Foundation packs still have their own progress and daily selector. This travel-plan integration does not claim foundation-aware placement, goal-weighted foundation scheduling, placement synchronization, a complete A1 syllabus, or calibrated CEFR placement. Guest checklist actions remain manual and do not automatically advance from preview practice. Continue with foundation-aware placement and operational preferences, then curated conjugation references and deeper curriculum content, following `phase-status.md`.

## Verification

Final results are recorded after the checks complete. Account browser tests use a disposable local database, never a shared deployment database.

2026-09-05 (Hermes, continuing this branch): 461/461 unit/component tests pass; production build, typecheck and eslint (0 errors) pass. Account e2e `study-plan-account.spec.ts` passes against disposable Postgres `verbalibera_plan_test` on loopback :55439 (passkey registration, account plan save with no guest localStorage leak, plan-driven session, drill completion, second-browser resume with checked/disabled items, dashboard plan link, reset preserving history, placement-prefill stretch drill) with zero leftover users. Full Chromium e2e: 24 passed, 3 failed — two stale Italian expectations from the earlier 15-item placement set (`placement.spec.ts` "1 of 8", `learning-release.spec.ts` 8-skip loop), updated to 15; the third (`guided-session` typed-answer) passes in isolation and failed only under full-suite dev-server load. Rerun the full suite after the fixes before merging.

2026-09-05 follow-up: full Chromium suite passes 27/27 serially (`--workers=1`, account spec included). Parallel full-suite runs show moving single-test failures (typed-answer, mobile picture-tap) that pass in isolation — Turbopack dev-server compile contention, not code regressions. Prefer serial e2e on `next dev`; the release flow tests production builds.
