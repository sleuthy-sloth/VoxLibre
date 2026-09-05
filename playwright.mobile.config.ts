import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "course-packs.spec.ts",
  projects: [
    {
      name: "iphone-webkit",
      use: {
        ...devices["iPhone 13"],
        baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
        trace: "retain-on-failure",
      },
    },
  ],
});
