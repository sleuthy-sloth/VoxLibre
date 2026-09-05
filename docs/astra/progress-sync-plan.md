# Foundation account synchronization design and implementation plan

Goal: synchronize foundation reviews, derived completion and concept evidence without losing offline work or mixing accounts. Continue directly under the user's autonomous execution authorization.

Architecture: preserve guest IndexedDB; add a separate database per account. The user explicitly selects account practice while online. Remember that selection for offline cold starts. Never automatically adopt guest history; backup import is the deliberate transfer mechanism. Every network request verifies the expected account. A remounted workspace prevents an in-flight save from entering a newly selected scope.

Use an additive Prisma event table with a user-scoped mutation key and ordered server sequence. Serialize writes for each user inside a transaction, reject conflicting duplicate payloads, and paginate pulls by sequence. Retain unknown/retired exercise IDs. Client pulls and durably merges pages before uploading locally missing events in batches. Retried uploads are idempotent. Full paginated reconciliation avoids fragile local acknowledgement state; optimize incrementally when scale warrants it. Server APIs are authenticated, no-store, size-bounded, and mutations require CSRF plus same-origin validation.

Alternatives considered: shared guest/account storage risks accidental disclosure; replacing the existing travel progress model would require unrelated migrations. Separate stores and an additive event log preserve existing behavior. Placement and study-plan synchronization are subsequent work.

- [x] Server: tests for unauthenticated access, CSRF, account mismatch, duplicate conflicts and bounded requests; add migration, transactional repository and GET/POST route; run tests and migrate only the isolated local test database.
- [x] Client: tests for replay, pull-before-push durability, changed account and network failure; implement paginated reconciliation, separate storage scope, explicit account/guest controls and automatic reconnect/save synchronization. Save locally before sending; retain data on every network failure.
- [x] Integration: real-account browser test exercises two browser stores, offline save/reconnect, duplicate delivery and account isolation. Run existing suite, production build, typecheck and mobile/browser QA.
- [x] Documentation: update actual data scope, limitations and phased report; commit the verified slice.
