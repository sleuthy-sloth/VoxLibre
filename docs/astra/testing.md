# Verification

Run `npm test`, `npm run lint`, `npm run build`, then `npm run typecheck`. Run build and typecheck sequentially: Next replaces generated type files during build. `npm run test:e2e` runs Chromium. `npm run test:e2e:webkit` runs the foundation suite in the iPhone 13 WebKit profile; install the browser with `npx playwright install webkit`.

Use `E2E_BASE_URL` for a production server. The real-account scenario additionally requires `E2E_ACCOUNT_TEST=1` and DATABASE_URL pointing to the same disposable local PostgreSQL database as the application. It creates a virtual WebAuthn credential, registers, saves a review, reloads, signs out, signs back in and deletes its test user. Do not run that test against a shared deployment database.

This run migrated and seeded an isolated Postgres 16 container on loopback port 55439, and ran the production application on port 3210. No remote database was migrated, seeded or used for account-test writes.

## Automated coverage

Pack compatibility/types, graph/reference errors, vocabulary limits, deterministic normalization and authored variants, accent/typo distinctions, missing/order errors, idempotent events, hint discounting, mode-separated concept summaries, recovered-mistake scheduling and lesson progression are unit-tested. Browser tests complete French teaching/practice and unlock the next lesson, exercise dialogue recovery, search references, switch languages, and save/reload practice offline. A reading regression checks that translation help prevents unaided-recall credit. Existing auth, PWA, review and voice tests remain.

Baseline: 372 tests passed, 18 lint warnings, typecheck/build passed. One stale Italian placement browser assertion was repaired. Real-database testing later found and fixed an existing passkey bug: the challenge deletion predicate compared expiry to itself. It now requires the expected expiry AND an expiry after the current time, retaining single-use behavior.

## Limits

Playwright documents [service-worker support as Chromium-only](https://playwright.dev/docs/service-workers). In this environment, WebKit had an activated worker and complete cache but its offline emulation failed with an internal error. That single offline test is explicitly skipped in WebKit; it passes in Chromium. Online WebKit coverage is retained. These checks do not claim physical iPhone/Safari standalone verification.

Docker image builds reached dependency installation but failed with `ENOSPC` inside the existing Docker VM. Only this run's failed build containers/intermediate layers were cleaned up; unrelated user containers/images were not pruned. Native production build, local Postgres migrations and full account/browser flows were verified independently. A complete Docker image build remains unverified.

The relocated Python environment's pytest launcher has a stale VoxLibre shebang. `services/voice/.venv/bin/python -m pytest services/voice/tests -q` works and passed all 37 tests with one upstream deprecation warning. The voice implementation was not changed.
