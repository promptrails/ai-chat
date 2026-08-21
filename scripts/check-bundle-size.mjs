import { stat } from "node:fs/promises";

const limits = {
  "dist/widget.global.js": 190 * 1024,
  // Safe standalone CTA parsing and rendering is part of the ecommerce bundle.
  "dist/ecommerce.global.js": 52 * 1024,
  "dist/styles.css": 40 * 1024,
};

let failed = false;
for (const [file, limit] of Object.entries(limits)) {
  const { size } = await stat(file);
  const kib = (size / 1024).toFixed(1);
  const limitKib = (limit / 1024).toFixed(0);
  console.log(`${file}: ${kib} KiB / ${limitKib} KiB`);
  if (size > limit) failed = true;
}
if (failed) {
  console.error("Bundle size budget exceeded.");
  process.exitCode = 1;
}
