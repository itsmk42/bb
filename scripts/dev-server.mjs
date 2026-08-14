// Minimal dependency-free static dev server.
// Forwards --port/-p/--host CLI args and PORT/HOST env vars.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function argValue(names, fallback) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    for (const name of names) {
      if (arg === name && args[i + 1]) return args[i + 1];
      if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
    }
  }
  return fallback;
}

const port = Number(argValue(["--port", "-p"], process.env.PORT)) || 7100;
const host = argValue(["--host", "-H"], process.env.HOST) || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";

    const filePath = normalize(join(root, pathname));
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    let target = filePath;
    const info = await stat(target).catch(() => null);
    if (!info) {
      res.writeHead(404).end("Not found");
      return;
    }
    if (info.isDirectory()) {
      target = join(target, "index.html");
    }

    const body = await readFile(target);
    res.writeHead(200, {
      "Content-Type": MIME[extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500).end("Server error");
  }
});

server.listen(port, host, () => {
  console.log(`Builder Ballery dev server → http://localhost:${port}/`);
});
