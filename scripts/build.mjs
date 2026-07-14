import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const filesToCopy = [
  "assets",
  "admin.html",
  "admin.js",
  "areas",
  "services",
  "index.html",
  "landing",
  "local-hvac-services.html",
  "rebates-financing.html",
  "robots.txt",
  "script.js",
  "service-areas.html",
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

const gtmId = "GTM-5DM8M275";
const gtmHeadSnippet = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');</script>
<!-- End Google Tag Manager -->`;
const gtmBodySnippet = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

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

function injectGtmIntoHtml(filePath) {
  let html = fs.readFileSync(filePath, "utf8");
  if (html.includes(`googletagmanager.com/gtm.js?id=${gtmId}`)) return;

  html = html
    .replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n    ${gtmHeadSnippet}`)
    .replace(/<body(\s[^>]*)?>/i, (match) => `${match}\n    ${gtmBodySnippet}`);

  fs.writeFileSync(filePath, html);
}

for (const filePath of listFiles(dist)) {
  if (path.extname(filePath) === ".html") {
    injectGtmIntoHtml(filePath);
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
