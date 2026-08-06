import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve("docs");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css; charset=utf-8", ".md": "text/markdown; charset=utf-8" };

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  const candidate = resolve(root, pathname === "/" ? "index.html" : `.${pathname}`);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "Content-Type": types[extname(candidate)] || "application/octet-stream" });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(4177, "127.0.0.1", () => console.log("Docs: http://127.0.0.1:4177"));
