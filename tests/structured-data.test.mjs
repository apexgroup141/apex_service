import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { changedPages, INDEXNOW_KEY } from "../scripts/indexnow.mjs";

const root = new URL("..", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");

const htmlFiles = (dir) => fs.readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((entry) => {
  const relative = path.posix.join(dir, entry.name);
  if (entry.isDirectory()) return htmlFiles(`${relative}/`);
  return entry.name.endsWith(".html") ? [relative] : [];
});

const sitePages = [
  ...fs.readdirSync(new URL("./", root)).filter((name) => name.endsWith(".html")),
  ...["services/", "instant-estimate/", "landing/", "areas/", "projects/", "blog/"].flatMap((dir) => (fs.existsSync(new URL(dir, root)) ? htmlFiles(dir) : []))
];

const markupOf = (file) => [...read(file).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) => JSON.parse(json));
const visibleText = (file) => read(file).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("all structured data is valid JSON and keeps out the address, self-made ratings and rebate claims", () => {
  for (const file of sitePages) {
    for (const data of markupOf(file)) {
      const json = JSON.stringify(data);
      assert.doesNotMatch(json, /streetAddress|postalCode|19512/, `${file}: the business address stays hidden`);
      assert.doesNotMatch(json, /aggregateRating|"review"/i, `${file}: no self-made rating markup`);
      assert.doesNotMatch(json, /\bPSE\b|Clean Heat|tax credit/i, file);
    }
    assert.doesNotMatch(read(file), /19422|Mountain Hwy/i, `${file}: the street address stays off the site`);
  }
});

test("area pages make no PSE or Seattle Clean Heat rebate claims", () => {
  for (const file of htmlFiles("areas/")) {
    assert.doesNotMatch(visibleText(file), /\bPSE\b|Puget Sound Energy|Clean Heat|tax credit/i, file);
  }
});

test("each main service page describes its service, and every marked-up price is shown on the page", () => {
  for (const slug of ["heat-pumps", "mini-splits", "furnaces", "air-conditioning", "repair-maintenance", "ductwork"]) {
    const file = `services/${slug}.html`;
    const service = markupOf(file).find((data) => data["@type"] === "Service");
    assert.ok(service, file);
    assert.equal(service.url, `https://apexgroupwa.com/services/${slug}`);
    assert.equal(service.provider["@id"], "https://apexgroupwa.com/#business");
    assert.doesNotMatch(service.description, /rebate/i, file);
    const offers = [service.offers || []].flat();
    for (const price of offers.flatMap((offer) => [offer.price, offer.lowPrice, offer.highPrice]).filter((value) => value !== undefined)) {
      assert.ok(visibleText(file).includes(`$${price.toLocaleString("en-US")}`), `${file}: $${price} is not on the page`);
    }
  }
  assert.match(read("index.html"), /"@type":"HVACBusiness","@id":"https:\/\/apexgroupwa\.com\/#business"/);
});

test("every project page has Article markup that matches its heading", () => {
  for (const file of htmlFiles("projects/")) {
    const article = markupOf(file).find((data) => data["@type"] === "Article");
    assert.ok(article, file);
    assert.match(article.mainEntityOfPage, /^https:\/\/apexgroupwa\.com\/projects\//);
    assert.ok(article.image.startsWith("https://apexgroupwa.com/assets/"), file);
  }
});

test("IndexNow sends only changed indexable pages and its key file ships with the site", () => {
  const sitemap = ["/", "/a", "/hidden", "/missing"].map((p) => `<url><loc>https://apexgroupwa.com${p}</loc></url>`).join("");
  const pages = { "/": "<html>home</html>", "/a": "<html>a</html>", "/hidden": '<meta name="robots" content="noindex,follow" />' };
  const first = changedPages(sitemap, (pathname) => pages[pathname] || "", {});
  assert.deepEqual(first.map((page) => page.url), ["https://apexgroupwa.com/", "https://apexgroupwa.com/a"]);
  const sent = Object.fromEntries(first.map((page) => [page.url, page.digest]));
  pages["/a"] = "<html>a, edited</html>";
  assert.deepEqual(changedPages(sitemap, (pathname) => pages[pathname] || "", sent).map((page) => page.url), ["https://apexgroupwa.com/a"]);
  assert.equal(read(`${INDEXNOW_KEY}.txt`).trim(), INDEXNOW_KEY);
  assert.match(read("scripts/build.mjs"), new RegExp(`"${INDEXNOW_KEY}\\.txt"`));
});
