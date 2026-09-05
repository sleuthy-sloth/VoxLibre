# Content build pipeline

Use Node 22.13+ and `npm ci`. The existing test dependency `@testing-library/jest-dom` requires Node 22; Docker and CI now use Node 22 as well.

- `npm run content:validate`: parse every pack, validate graphs/references and verify declared media hashes. Exits nonzero on failure.
- `npm run content:stats`: count units of content and exercise forms with serialized pack size.
- `npm run content:coverage`: report actual A1 foundation coverage and available audio, without claiming a full syllabus.
- `npm run content:audio-check`: run the same validations and verify file existence/SHA-256 for every declared recording.
- `npm run content:duplicates`: additionally list reused accepted-answer sets for editorial inspection. Reuse is intentional in some retrieval and ordering exercises.
- `npm run content:build`: validate, emit compact JSON in `public/packs/`, generate the course catalog, write reports under `docs/astra/reports/`, and bundle the shared offline React entry with esbuild.

The reporting commands currently share a common report; they are not independent linguistic validators. `npm run dev` and `npm run build` run content:build first. Vercel's build command now invokes npm run build; CI invokes content:build explicitly before tests/Next. Docker copies course and script sources before building, and makes the Prisma schema available for npm ci's postinstall.

The generated offline bundle contains the React runtime, schemas and learning logic; pack JSON is loaded separately. Inspect raw/gzip bundle sizes when adding dependencies. Recordings are reused from existing committed Kokoro assets with attribution and hashes; no new recording generation is claimed. Asset provenance remains in `docs/audio-provenance/`.
