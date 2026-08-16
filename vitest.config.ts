import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFilesAfterEnv: ["<rootDir>/vitest.setup.ts"],
  },
});
