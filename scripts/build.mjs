import fs from "node:fs";
import path from "node:path";
import { pathForHtmlFile, renderSiteHeader } from "./site-navigation.mjs";

const root = process.cwd();
const dist = path.join(root, "dist");
const filesToCopy = [
  "assets",
  "admin.html",
  "admin.js",
  "about.html",
  "areas",
  "services",
  "index.html",
  "blog.html",
  "get-estimate.html",
  "landing",
  "local-hvac-services.html",
  "rebates-financing.html",
  "projects.html",
  "robots.txt",
  "script.js",
  "service-areas.html",
  "reviews.html",
  "sitemap.xml",
  "styles.css",
  "thank-you.html"
];

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".avif": "image/avif",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8"
};

const googleTagId = "G-F4H11YXLLS";
const googleAdsTagId = "AW-18358155203";
const googleTagSnippet = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${googleTagId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${googleTagId}');
  gtag('config', '${googleAdsTagId}');
</script>
<!-- End Google tag -->`;

fs.rmSync(dist, { force: true, recursive: true });
fs.mkdirSync(path.join(dist, "server"), { recursive: true });

for (const item of filesToCopy) {
  const sourcePath = path.join(root, item);
  if (fs.existsSync(sourcePath)) {
    fs.cpSync(sourcePath, path.join(dist, item), { recursive: true });
  }
}

const hostingConfigPath = path.join(root, ".openai", "hosting.json");
if (fs.existsSync(hostingConfigPath)) {
  fs.mkdirSync(path.join(dist, ".openai"), { recursive: true });
  fs.copyFileSync(hostingConfigPath, path.join(dist, ".openai", "hosting.json"));
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    return fullPath;
  });
}

function injectGoogleTagIntoHtml(filePath) {
  let html = fs.readFileSync(filePath, "utf8");
  if (html.includes(`googletagmanager.com/gtag/js?id=${googleTagId}`)) return;

  html = html
    .replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n    ${googleTagSnippet}`);

  fs.writeFileSync(filePath, html);
}

function injectSharedNavigation(filePath) {
  if (path.basename(filePath) === "admin.html") return;
  const relativePath = path.relative(dist, filePath);
  let html = fs.readFileSync(filePath, "utf8");
  html = html.replace(/<header class="site-header[\s\S]*?<\/header>/i, renderSiteHeader(pathForHtmlFile(relativePath)));
  fs.writeFileSync(filePath, html);
}

function injectServiceDiscoveryLinks(filePath) {
  const route = pathForHtmlFile(path.relative(dist, filePath));
  const primaryServices = new Set([
    "/services/heat-pumps",
    "/services/mini-splits",
    "/services/air-conditioning",
    "/services/furnaces",
    "/services/ductwork",
    "/services/repair-maintenance"
  ]);
  if (!primaryServices.has(route)) return;

  let html = fs.readFileSync(filePath, "utf8");
  const section = `<section class="service-discovery" aria-labelledby="service-discovery-title"><div><p class="eyebrow">Plan with confidence</p><h2 id="service-discovery-title">Learn more about Apex before requesting an estimate.</h2></div><nav aria-label="Related Apex resources"><a href="/projects">Project portfolio</a><a href="/reviews">Customer reviews</a><a href="/about">About Apex</a><a href="/blog">HVAC guidance</a><a href="/service-areas">Service areas</a></nav></section>`;
  html = html.replace(/<\/main>/i, `${section}</main>`);
  fs.writeFileSync(filePath, html);
}

function connectServiceEstimateButtons(filePath) {
  const route = pathForHtmlFile(path.relative(dist, filePath));
  if (!route.startsWith("/services/")) return;

  const serviceByRoute = {
    "/services/heat-pumps": "Heat pump installation",
    "/services/mini-splits": "Mini-split installation",
    "/services/air-conditioning": "AC service",
    "/services/cooling": "AC service",
    "/services/furnaces": "Furnace service",
    "/services/heating": "Furnace service",
    "/services/ductwork": "Ductwork",
    "/services/repair-maintenance": "Repair and maintenance",
    "/services/service": "Repair and maintenance"
  };
  const service = serviceByRoute[route] || "Other HVAC service";
  const estimateUrl = `/get-estimate?service=${encodeURIComponent(service)}`;
  let html = fs.readFileSync(filePath, "utf8");
  html = html.replace(/href="\/\#contact"/g, `href="${estimateUrl}"`);
  fs.writeFileSync(filePath, html);
}

for (const filePath of listFiles(dist)) {
  if (path.extname(filePath) === ".html") {
    injectSharedNavigation(filePath);
    connectServiceEstimateButtons(filePath);
    injectServiceDiscoveryLinks(filePath);
    injectGoogleTagIntoHtml(filePath);
  }
}

const assets = {};
for (const filePath of listFiles(dist)) {
  if (filePath.includes(`${path.sep}server${path.sep}`) || filePath.includes(`${path.sep}.openai${path.sep}`)) continue;
  const route = `/${path.relative(dist, filePath).split(path.sep).join("/")}`;
  const extension = path.extname(filePath);
  const contentType = mimeTypes[extension] || "application/octet-stream";
  const isText = /^(text\/|application\/(json|xml)|text\/javascript)/.test(contentType);
  assets[route] = {
    body: fs.readFileSync(filePath).toString(isText ? "utf8" : "base64"),
    contentType,
    encoding: isText ? "text" : "base64"
  };
}

const worker = `const ASSETS = ${JSON.stringify(assets)};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function findAsset(pathname) {
  if (pathname === "/") return ASSETS["/index.html"];
  if (ASSETS[pathname]) return ASSETS[pathname];
  if (!pathname.includes(".") && ASSETS[pathname + ".html"]) return ASSETS[pathname + ".html"];
  if (pathname.endsWith("/") && ASSETS[pathname + "index.html"]) return ASSETS[pathname + "index.html"];
  return null;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const legacyAreaRoutes = { olympia: "/areas/olympia", renton: "/areas/renton" };
    const legacyArea = url.pathname === "/" ? url.searchParams.get("area")?.toLowerCase() : null;

    if (legacyArea && legacyAreaRoutes[legacyArea]) {
      url.pathname = legacyAreaRoutes[legacyArea];
      url.search = "";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname.endsWith(".html")) {
      url.pathname = url.pathname.slice(0, -5) || "/";
      return Response.redirect(url.toString(), 301);
    }

    const asset = findAsset(decodeURIComponent(url.pathname));

    if (!asset) {
      return new Response("Not found", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    const body = asset.encoding === "base64" ? decodeBase64(asset.body) : asset.body;
    const isHtml = asset.contentType.startsWith("text/html");

    return new Response(body, {
      headers: {
        "Cache-Control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
        "Content-Type": asset.contentType
      }
    });
  }
};
`;

fs.writeFileSync(path.join(dist, "server", "index.js"), worker);
