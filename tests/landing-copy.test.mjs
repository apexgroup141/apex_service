import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");

const htmlFiles = (dir) => fs.readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((entry) => {
  const relative = path.posix.join(dir, entry.name);
  if (entry.isDirectory()) return htmlFiles(`${relative}/`);
  return entry.name.endsWith(".html") ? [relative] : [];
});

const sitePages = [
  ...fs.readdirSync(new URL("./", root)).filter((name) => name.endsWith(".html")),
  ...["services/", "instant-estimate/", "landing/", "areas/", "projects/"].flatMap((dir) => (fs.existsSync(new URL(dir, root)) ? htmlFiles(dir) : []))
];

test("no page still offers the old 2-year warranty or a paid labor extension", () => {
  for (const file of sitePages) {
    const text = read(file).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    assert.doesNotMatch(text, /2[- ]year workmanship/i, file);
    assert.doesNotMatch(text, /extended labor (coverage|warranty)/i, file);
    assert.doesNotMatch(text, /labor warranty available/i, file);
    for (const match of text.matchAll(/up to (12|twelve)[- ]years?[^.]*/gi)) {
      assert.match(match[0], /depending on (the equipment )?brand/i, `${file}: ${match[0]}`);
    }
  }
});

test("the AC page has no placeholder and no unapproved price", () => {
  const ac = read("services/air-conditioning.html");
  assert.doesNotMatch(ac, /Owner Confirmation/i);
  assert.match(ac, /Central AC pricing depends on system size, coil and ductwork\. Request a free in-home estimate for a written quote\./);
  assert.doesNotMatch(ac.replace(/<script[\s\S]*?<\/script>/g, ""), /From \$\d/);
  assert.match(ac, /<!-- GOOGLE_RATING_BADGE -->/);
});

test("approved starting prices and the service area appear in each landing page hero", () => {
  const heroOf = (file) => read(file).match(/<section class="[^"]*hero[^"]*"[\s\S]*?<\/section>/)?.[0] || "";
  const area = "Serving homeowners in Tacoma, Olympia, Seattle and across Pierce, King &amp; Thurston counties.";
  assert.match(heroOf("services/heat-pumps.html"), /Heat Pumps From \$7,500/);
  assert.match(heroOf("services/mini-splits.html"), /Mini Splits From \$5,000 Installed/);
  assert.match(heroOf("services/furnaces.html"), /New Furnaces From \$3,500 Installed/);
  for (const file of ["services/heat-pumps.html", "services/mini-splits.html", "services/furnaces.html", "services/air-conditioning.html"]) {
    assert.ok(heroOf(file).includes(area), file);
  }
  assert.match(heroOf("services/mini-splits.html"), /<h1[^>]*>Ductless Mini-Split Installation<\/h1>/);
  assert.match(heroOf("services/mini-splits.html"), /Get Free Estimate/);
  assert.match(heroOf("services/mini-splits.html"), /See My Options &amp; Pricing/);
});

test("ad landing heroes lead with the included 10-year labor warranty and explain it below", () => {
  for (const file of ["services/heat-pumps.html", "services/mini-splits.html", "services/furnaces.html", "services/air-conditioning.html"]) {
    const page = read(file);
    const hero = page.match(/<section class="[^"]*hero[^"]*"[\s\S]*?<\/section>/)?.[0] || "";
    assert.match(hero, /<span>10-Year Labor Warranty Included<\/span>/, file);
    const warranty = page.match(/<section[^>]*id="warranty"[\s\S]*?<\/section>/)?.[0] || "";
    assert.match(warranty, /10-year labor warranty<\/strong> included with every installation and system replacement/, file);
    assert.match(warranty, /Manufacturer parts warranty up to 12 years<\/strong>, depending on the equipment brand/, file);
  }
});

test("both instant estimates show the price first and ask for phone or email afterwards", () => {
  for (const file of ["instant-estimate/heat-pump.html", "instant-estimate/mini-split.html"]) {
    const page = read(file);
    const results = page.indexOf("data-results");
    const contact = page.indexOf("data-contact");
    assert.ok(results > 0 && contact > results, file);
    assert.match(page, /Want an Exact Written Quote\?/);
    assert.match(page, /Request My Free Estimate/);
    assert.doesNotMatch(page, /name="phone"[^>]*required/, `${file}: phone must stay optional`);
    assert.doesNotMatch(page, /name="email"[^>]*required/, `${file}: email must stay optional`);
  }
});

test("the AC page is served through the Worker so the rating badge renders", () => {
  assert.match(read("wrangler.jsonc"), /"\/services\/air-conditioning"/);
  assert.match(read("worker.js"), /url\.pathname === "\/services\/air-conditioning"/);
});
