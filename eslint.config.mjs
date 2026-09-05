import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".worktrees/**",
    "out/**",
    "public/study.js",
    "test-results/**",
    "playwright-report/**",
    "build/**",
    "next-env.d.ts",
    "services/voice/.venv/**",
    "services/voice/.pilot-venv/**",
  ]),
]);

export default eslintConfig;
