# Foundation course packs implementation plan

Goal: deliver complete teaching/practice/offline vertical slices for Italian and French without runtime models.

Architecture: versioned JSON contracts and pure evaluator/progress functions shared by Next and a static React offline entry. Tech: existing Next/React/SM-2 plus Zod validation and esbuild authoring bundle. Spec: `docs/astra/architecture.md`.

Constraints: preserve existing accounts/data/routes; no runtime LLM; content quality over count; no false audio or CEFR claims; device progress explicitly separate from account sync.

- [x] Content boundary: `src/features/course-pack/schema.ts`, `courses/{italian,french}/manifest.json`, CLI `scripts/content.ts`. Tests reject incompatible schemas, missing answers, bad references, cycles, duplicate IDs and excessive vocabulary. Validate originals and emit reports.
- [x] Deterministic engine: `answer.ts` exports `evaluateAnswer(response, exercise)` with Unicode/apostrophe normalization, conservative typo hints, exact authored variants and error classifications. Tests distinguish tense/negation/accent errors from correct alternatives.
- [x] Learning projection: `progress.ts` consumes immutable events keyed by UUID; replays chronologically and separates recognition/production/listening. `selectDaily` prioritizes due and weak practice among introduced lessons, then prerequisite-ready new learning. Tests cover duplicate events, reveals and deterministic scheduling.
- [x] Workspace: reusable teaching, exercise, vocabulary and grammar components, per-language fetch, links from existing lesson index. Test complete learner flow with browser-local checking and saved local practice.
- [x] Offline: shared static entry, intentional public asset installation, IndexedDB progress, recovery export/import, explicit storage errors and data scope. Chromium tests verify network-off cold starts and saved practice; the French online flow completes a lesson. WebKit offline emulation is explicitly excluded with the reason documented.
- [x] Verify: repair baseline stale placement assertion, run content checks/unit tests/lint/build/typecheck sequentially where generated types depend on build; run browser suite, mobile visual checks and document results and gaps.
