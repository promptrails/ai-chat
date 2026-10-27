import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = resolve(root, "docs/assets");
await mkdir(assets, { recursive: true });
for (const file of ["widget.global.js", "ecommerce.global.js"]) {
  await copyFile(resolve(root, "dist", file), resolve(assets, file));
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
await writeFile(
  resolve(assets, "version.js"),
  `window.PromptRailsAiChatVersion = ${JSON.stringify(packageJson.version)};\n`,
);
