// Tells Bing (and the other IndexNow engines) which sitemap pages changed since the last deploy.
// Run after `wrangler deploy`, so the pages are live. `--dry-run` lists the pages without sending.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const INDEXNOW_KEY = "d91b3f2688ddf0abd3f2f416e0f57ebc";
const site = "https://apexgroupwa.com";
const keyLocation = `${site}/${INDEXNOW_KEY}.txt`;

const hash = (text) => crypto.createHash("sha256").update(text).digest("hex");

// Returns the sitemap pages whose built HTML differs from what was last sent, skipping noindex pages.
export const changedPages = (sitemapXml, readPage, sent) => {
  const pages = [];
  for (const [, url] of sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const html = readPage(new URL(url).pathname);
    if (!html || /name="robots" content="[^"]*noindex/i.test(html)) continue;
    const digest = hash(html);
    if (sent[url] !== digest) pages.push({ url, digest });
  }
  return pages;
};

const main = async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dist = path.join(root, "dist");
  const stateFile = path.join(root, ".indexnow-sent.json");
  const dryRun = process.argv.includes("--dry-run");
  const readPage = (pathname) => {
    const base = pathname === "/" ? "index" : pathname.replace(/^\/|\/$/g, "");
    for (const file of [`${base}.html`, path.join(base, "index.html")]) {
      const full = path.join(dist, file);
      if (fs.existsSync(full)) return fs.readFileSync(full, "utf8");
    }
    return "";
  };
  let sent = {};
  try { sent = JSON.parse(fs.readFileSync(stateFile, "utf8")); } catch {}

  const pages = changedPages(fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8"), readPage, sent);
  if (!pages.length) return console.log("IndexNow: no changed pages.");
  if (dryRun) return console.log(`IndexNow (dry run): ${pages.length} pages\n${pages.map((page) => page.url).join("\n")}`);

  const keyFile = await fetch(keyLocation).then((response) => response.text()).catch(() => "");
  if (keyFile.trim() !== INDEXNOW_KEY) throw new Error(`IndexNow key file is not live at ${keyLocation}`);

  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(site).host, key: INDEXNOW_KEY, keyLocation, urlList: pages.map((page) => page.url) })
  });
  if (response.status !== 200 && response.status !== 202) throw new Error(`IndexNow answered ${response.status}: ${await response.text()}`);
  for (const page of pages) sent[page.url] = page.digest;
  fs.writeFileSync(stateFile, `${JSON.stringify(sent, null, 2)}\n`);
  console.log(`IndexNow: sent ${pages.length} changed pages (${response.status}).`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
