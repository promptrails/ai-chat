import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    setupFiles: ["src/__tests__/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
