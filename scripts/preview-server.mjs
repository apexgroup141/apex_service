import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.join(process.cwd(), "dist");
const port = Number(process.env.PORT || 4173);
const mimeTypes = { ".avif": "image/avif", ".css": "text/css", ".gif": "image/gif", ".html": "text/html", ".ico": "image/x-icon", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".xml": "application/xml" };

http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const legacyAreaSlugs = new Set(["auburn", "bellevue", "black-diamond", "bonney-lake", "bothell", "burien", "covington", "des-moines", "dupont", "edgewood", "enumclaw", "federal-way", "fife", "gig-harbor", "issaquah", "kent", "kirkland", "lacey", "lakewood", "maple-valley", "mercer-island", "milton", "newcastle", "normandy-park", "olympia", "parkland", "puyallup", "redmond", "renton", "rochester", "sammamish", "seatac", "seattle", "south-seattle", "spanaway", "sumner", "tacoma", "tukwila", "tumwater", "university-place", "west-seattle", "yelm"]);
  const legacyServiceSlugs = { "heat pump installation": "heat-pump-installation", "mini-split installation": "mini-split-installation", "furnace repair or replacement": "furnace-repair-replacement", "ac repair or installation": "ac-repair-installation", ductwork: "ductwork", maintenance: "repair-maintenance", "repair and maintenance": "repair-maintenance" };
  const legacyArea = url.pathname === "/" ? url.searchParams.get("area")?.trim() : null;

  if (legacyArea) {
    const areaSlug = legacyArea.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const legacyService = url.searchParams.get("service")?.trim();
    const serviceSlug = legacyServiceSlugs[legacyService?.toLowerCase()];
    const location = legacyAreaSlugs.has(areaSlug) && serviceSlug
      ? `/areas/${areaSlug}-${serviceSlug}`
      : legacyService
        ? `/get-estimate?${url.searchParams.toString()}`
        : "/service-areas";
    response.writeHead(301, { Location: location });
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
