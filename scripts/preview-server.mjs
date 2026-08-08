import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.join(process.cwd(), "dist");
const port = Number(process.env.PORT || 4173);
const mimeTypes = { ".avif": "image/avif", ".css": "text/css", ".gif": "image/gif", ".html": "text/html", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".xml": "application/xml" };

http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const legacyAreaRoutes = { olympia: "/areas/olympia", renton: "/areas/renton" };
  const legacyArea = url.pathname === "/" ? url.searchParams.get("area")?.toLowerCase() : null;

  if (legacyArea && legacyAreaRoutes[legacyArea]) {
    response.writeHead(301, { Location: legacyAreaRoutes[legacyArea] });
    response.end();
    return;
  }

  if (url.pathname.endsWith(".html")) {
    response.writeHead(301, { Location: url.pathname.slice(0, -5) || "/" });
    response.end();
    return;
  }

  const pathname = decodeURIComponent(url.pathname);
  const candidates = pathname === "/"
    ? ["index.html"]
    : [pathname.slice(1), `${pathname.slice(1)}.html`, path.join(pathname.slice(1), "index.html")];
  const filePath = candidates.map((candidate) => path.resolve(root, candidate)).find((candidate) => candidate.startsWith(`${root}${path.sep}`) && fs.existsSync(candidate) && fs.statSync(candidate).isFile());

  if (!filePath) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": `${mimeTypes[path.extname(filePath)] || "application/octet-stream"}; charset=utf-8`, "Cache-Control": "no-store" });
  fs.createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Apex local preview: http://127.0.0.1:${port}`);
});
