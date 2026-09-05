# Deterministic answer engine

`src/features/course-pack/answer.ts` runs in the browser and the offline bundle. There is no network request or runtime model in this evaluator.

It normalizes Unicode NFC, case, whitespace, common punctuation and apostrophes. Exact authored variants are accepted. Optional pronouns and ordinary English contractions are explicit variants, not blanket grammatical rewrites. Authored error answers take precedence over fuzzy hints and carry specific explanations. Accent-only differences are identified without automatically accepting meaning-changing forms. Missing/extra words and word-order differences receive conservative feedback.

A bounded edit-distance check can suggest nearly correct. Typo acceptance is off by default. When explicitly enabled it only accepts a single small spelling change in one sufficiently long token; short grammar words remain protected. Arbitrary fuzzy semantic matching is never treated as correct. This engine cannot prove that an unlisted translation is wrong; its feedback says it does not match an authored answer.

Reading translation reveals, glossary lookups and model reveals mark practice assisted. Assisted answers remain in review and do not count as successful unaided recall. Exercise-level SM-2 state separates recognition, production and listening. Concept summaries aggregate their counts by mode without invented percentages or proficiency claims.

The existing `/api/answer-check` travel-course path remains intact, including its optional local non-LLM translation comparison and exact fallback. It has not been silently converted to the new evaluator. `tests/runtime-model-independence.test.ts` guards learner code/dependencies against known generative SDKs, endpoints and API-key names. It is a regression guard for common integrations, not proof against every possible obfuscated integration.
