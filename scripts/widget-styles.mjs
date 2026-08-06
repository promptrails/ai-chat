import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src/widget/styles.css");
const generated = resolve(root, "src/widget/widget-styles.ts");
const css = await readFile(source, "utf8");
await writeFile(
  generated,
  `// Generated from styles.css. Do not edit directly.\n// prettier-ignore\nexport const WIDGET_CSS = ${JSON.stringify(css)};\n`,
);
