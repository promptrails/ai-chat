import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: ".vitest-cache",
  test: {
    environment: "happy-dom",
    setupFiles: ["src/__tests__/test-setup.ts"],
    include: ["src/**/*.test.{js,ts,tsx}"],
  },
});
