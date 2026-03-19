import { defineConfig } from "tsup";

export default defineConfig({
  entry: { widget: "src/widget/index.ts" },
  format: ["iife"],
  globalName: "PromptRailsChat",
  outDir: "dist",
  outExtension: () => ({ js: ".global.js" }),
  noExternal: [/.*/],
  minify: true,
  sourcemap: false,
  platform: "browser",
  target: "es2020",
  treeshake: true,
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
