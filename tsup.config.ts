import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/core/index.ts",
    "src/components/index.ts",
    "src/providers/index.ts",
    "src/browser/index.ts",
    "src/ui/index.ts",
    "src/ecommerce/index.ts",
    "src/ecommerce/react.tsx",
    "src/ecommerce/types.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  outDir: "dist",
});
