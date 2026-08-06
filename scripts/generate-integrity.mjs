import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["widget.global.js", "ecommerce.global.js", "styles.css"];
const integrity = {};

for (const file of files) {
  const bytes = await readFile(resolve(root, "dist", file));
  integrity[file] = `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
}

await writeFile(resolve(root, "dist", "integrity.json"), `${JSON.stringify(integrity, null, 2)}\n`);
