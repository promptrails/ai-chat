import { defineConfig } from "tsup";

export default defineConfig({
  entry: { ecommerce: "src/ecommerce/widget.js" },
  format: ["iife"],
  globalName: "PromptRailsEcommerceChat",
  outDir: "dist",
  outExtension: () => ({ js: ".global.js" }),
  minify: true,
  sourcemap: false,
  platform: "browser",
  target: "es2020",
  treeshake: true,
});
