# Phased upgrade status

Status after the account-sync, foundation-listening, Italian placement and account study-plan continuations. “Partial” means working functionality exists, with the named gaps still open; it is not a completion claim for the full phase.

| Phase | Status and remaining work |
| --- | --- |
| 1 Audit | Completed initial audit and baseline verification. |
| 2 Content architecture | Versioned JSON packs, schema and references implemented; richer level/stage/skill metadata remains partial. |
| 3 Curriculum | Italian/French: 16 lessons each; partial A1. More domains, depth and native-speaker review remain. |
| 4 Exercises | Reusable registry and seven contracts; five populated forms. Full proposed catalogue remains partial. |
| 5 Answer evaluator | Deterministic variants, normalization, authored errors and conservative typo handling implemented; broader morphology data remains. |
| 6 Mastery | Mode-separated concept evidence and exercise schedules implemented; richer concept stability summaries remain. |
| 7 SRS | Existing SM-2 retained with separate recognition/production/listening histories. FSRS intentionally deferred. |
| 8 Daily lessons | Due/weak/prerequisite selection and session bounds implemented; diversity and goal weighting remain partial. |
| 9 Interference | Deferred. |
| 10 Dialogues | Four static branching scenarios; wider situations and constrained typed branches remain partial. |
| 11 Reading | 32 short original readings, lookup and optional translation; saved words and longer materials remain partial. |
| 12 Listening | 32 new prerecorded models: every foundation lesson now has optional listening practice. Slow replay/dictation work offline; minimal pairs, listen-and-order, longer dialogue audio and human prosody review remain. |
| 13 Pronunciation | Existing optional local transcription retained; no invented pronunciation score. |
| 14 Course packs | Validated downloadable packs, compatibility/content versions, media hashes and attribution implemented. |
| 15 Offline | Static cold-start study, teaching, audio and durable practice verified in Chromium. Physical Safari/PWA QA remains open. |
| 16 Sync | Account-scoped immutable foundation events, duplicate/conflict handling and reconnect synchronization implemented. Travel study plans now save/load/reset across accounts and devices. Placement sync and foundation study preferences remain open. |
| 17 Placement | Italian now has a fixed 15-item A1/A2/B1 travel assessment; French retains its adaptive checkpoint. These are rough starting-point suggestions, not CEFR certification. Foundation-aware assessment and placement sync remain open. |
| 18 Study plans | Travel plans now drive account sessions with paired teaching/retrieval, due reviews and pace bounds; account plan storage and derived completion are connected to the builder/dashboard. Guest checklists remain browser-local. Goal-driven foundation scheduling and preference sync remain open. |
| 19 Vocabulary | Search, meaning, examples and evidence labels implemented; richer metadata and dedicated per-word scheduling remain partial. |
| 20 Grammar | Linked explanations, examples, errors and concept evidence implemented; paradigms and targeted drill selection remain partial. |
| 21 Conjugation | Dedicated reference/search/drill system deferred. |
| 22 Learner experience | Quiet Ink, mobile controls, focus handling and visible storage/sync states improved. Broader user testing remains. |
| 23 iPhone QA | Chromium/WebKit layouts and online audio tested; physical keyboard/standalone/offline Safari testing remains open. |
| 24 Pipeline | Validation/build/stats/coverage/duplicates/audio integrity commands implemented; linguistic checks require editorial review. |
| 25 Static authoring | Course content and audio stored as ordinary assets. Authoring uses local tooling; no runtime LLM added. |
| 26 Tests | Expanded unit, browser, account, offline and audio coverage. See implementation report for latest totals. |
| 27 Performance | Per-language loading and asset-size reports implemented; load timing/database query benchmarks and incremental sync remain open. |
| 28 Documentation | Architecture, behavior, testing, provenance and honest implementation reports maintained. |

See `study-plan-continuation.md` for the September 5 review and continuation scope. No numbered slice-4 specification was present in the repository or the two latest commit messages.

Next priorities: deepen Italian/French A1 domains and varied retrieval; improve foundation placement and operational study preferences; add curated conjugation references; then broader listening forms and interference content. Avoid expanding language count before the first two courses have adequate instructional depth.
