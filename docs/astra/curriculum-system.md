# Curriculum system

Original foundation packs live in `courses/italian/manifest.json` and `courses/french/manifest.json`. Each has 4 units, 16 lessons, 16 linked concepts, 64 vocabulary/expression records, 112 exercises, 16 short readings, two branching conversations, and 17 attributed recordings (16 newly authored models and one reused café clip). These supplement the existing four eight-pattern travel courses; they are not complete A1 syllabuses.

The sequence starts with identity, people, family and age; builds articles, descriptions, number and daily activity; then introduces requests, destinations, the past and plans. French explicitly teaches obligatory subjects, elision, written negation, est-ce que and aller + infinitive. Italian teaches omitted subjects, noun/adjective agreement, non, reflexive routines and present-tense future plans. Both only introduce the first-person past with avere/avoir; full auxiliary selection is future work.

Every lesson has an objective, prerequisites, explanation, at least two worked examples, a bounded glossary and controlled/retrieval/reading practice. Later lessons retrieve a previous model. Every lesson has a real model recording and an optional listening exercise. Optional IDs are validated against the lesson and excluded from required completion so audio additions preserve previous text completion. Native-speaker editorial and listening review remain outstanding. Parenthetical gender guidance belongs in teaching, not required answer text.

## Contracts and authoring

`src/features/course-pack/schema.ts` defines compatibility version 1, semantic content versions, units, lessons, concepts, examples, vocabulary, accepted answers, authored errors, media and dialogues. Exercise types form a discriminated union; a renderer registry maps supported forms to components. Translation, ordering, cloze, reading and dictation are used in the foundation packs. Choice and transformation contracts/renderers are available but not populated in these packs. Existing picture-choice and pronunciation tools remain on the legacy routes.

Add a supported-language directory with a manifest and run `npm run content:build`. The build discovers course directories and generates the small catalog used by the language selector and dynamic route. No all-course content import reaches the shared client; only the selected pack is fetched. New exercises require both a schema variant and a renderer. New semantic content gets a new stable ID. Do not reuse a retired ID for a different meaning.

## Validation limits

Automated checks validate types, reference integrity, ordering and circular prerequisites, duplicate IDs/prompts, answer coverage, choice/order/cloze consistency, glossary bounds, orphaned declared concepts/words/media, dialogue branches and media hashes. Duplicate answer-set reports include intentional reconstruction/retrieval reuse. Declared vocabulary references are checked; arbitrary sentence vocabulary, translation equivalence and CEFR pedagogy are not linguistically proven by a schema. All require editorial review. The scope does not include full CEFR coverage, conjugation dictionaries, placement changes or cross-language interference.
