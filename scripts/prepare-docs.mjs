import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = resolve(root, "docs/assets");
await mkdir(assets, { recursive: true });
for (const file of ["widget.global.js", "ecommerce.global.js"]) {
  await copyFile(resolve(root, "dist", file), resolve(assets, file));
}
