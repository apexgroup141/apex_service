import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import worker from "../worker.js";
import { ENABLED_SERVICES, LANDING_PAGES, LANDING_VARIANTS, applyLandingVariant, resolveLandingVariant } from "../landing-variants.js";

const pageFiles = {
  "/services/heat-pumps": "services/heat-pumps.html",
  "/services/mini-splits": "services/mini-splits.html",
  "/services/furnaces": "services/furnaces.html",
  "/services/air-conditioning": "services/air-conditioning.html"
};
const source = (path) => fs.readFileSync(new URL(`../${pageFiles[path]}`, import.meta.url), "utf8");

const env = {
  ASSETS: {
    fetch: async (request) => {
      const path = new URL(request.url).pathname;
      return pageFiles[path]
        ? new Response(source(path), { headers: { "Content-Type": "text/html" } })
        : new Response("Not found", { status: 404 });
    }
  }
};

const load = async (pathAndQuery) => {
  const response = await worker.fetch(new Request(`https://apexgroupwa.com${pathAndQuery}`), env);
  return { response, html: await response.text() };
};

const between = (html, pattern) => html.match(pattern)?.[1];
const h1 = (html) => between(html, /<h1 data-lpv="h1">([\s\S]*?)<\/h1>/);
const sub = (html) => between(html, /<p data-lpv="sub">([\s\S]*?)<\/p>/);
const cta = (html) => between(html, /<a [^>]*data-lpv="cta"[^>]*>([\s\S]*?)<\/a>/);
const amp = (value) => value.replaceAll("&", "&amp;");

test("every landing page marks exactly one H1, subheading and CTA", () => {
  for (const path of Object.values(LANDING_PAGES)) {
    const html = source(path);
    assert.equal((html.match(/data-lpv="h1"/g) || []).length, 1, path);
    assert.equal((html.match(/data-lpv="sub"/g) || []).length, 1, path);
    assert.equal((html.match(/data-lpv="cta"/g) || []).length, 1, path);
  }
});

test("every variant id matches its page prefix and fits the copy limits", () => {
  for (const [id, variant] of Object.entries(LANDING_VARIANTS)) {
    assert.ok(LANDING_PAGES[id.split("-")[0]], id);
    assert.ok(variant.h1.length <= 60 && variant.sub.length <= 160 && variant.cta.length <= 32, id);
    assert.doesNotMatch(`${variant.h1} ${variant.sub} ${variant.cta}`, /\$|warrant|rebate|guarantee/i, `${id} must not change prices or promises`);
  }
});

test("the 17 variants keep the copy the owner approved on 2026-10-30", async () => {
  const { createHash } = await import("node:crypto");
  // Any wording change must be re-approved; update this hash only together with that approval.
  const digest = createHash("sha256").update(JSON.stringify(LANDING_VARIANTS)).digest("hex");
  assert.equal(Object.keys(LANDING_VARIANTS).length, 17);
  assert.equal(digest, "245aba64acac9fd002d6ee65ad238e540aa4d7c2cafebb8c057958c252eb7bd3");
});

test("only Heat Pump and Mini-Split are switched on for the first launch", () => {
  assert.deepEqual([...ENABLED_SERVICES].sort(), ["hp", "ms"]);
});

test("an approved variant swaps only the H1, subheading and CTA label", async () => {
  const plain = await load("/services/heat-pumps");
  const { response, html } = await load("/services/heat-pumps?lpv=hp-cost&gclid=test");
  const variant = LANDING_VARIANTS["hp-cost"];
  assert.equal(h1(html), variant.h1);
  assert.equal(sub(html), variant.sub);
  assert.equal(cta(html), amp(variant.cta));
  assert.equal(response.headers.get("Cache-Control"), "private, max-age=300");
  assert.match(plain.response.headers.get("Cache-Control"), /^public/);

  const strip = (value) => value
    .replace(/<h1 data-lpv="h1">[\s\S]*?<\/h1>/, "")
    .replace(/<p data-lpv="sub">[\s\S]*?<\/p>/, "")
    .replace(/(<a [^>]*data-lpv="cta"[^>]*>)[\s\S]*?<\/a>/, "$1")
    .replace(/<html([^>]*?) data-lp-variant="[^"]*">/, "<html$1>");
  assert.equal(strip(html), strip(plain.html), "everything else is byte-identical");
  assert.match(html, /<link rel="canonical" href="https:\/\/apexgroupwa\.com\/services\/heat-pumps" \/>/);
  assert.match(html, /<html[^>]*data-lp-variant="hp-cost"/);
});

test("unknown, malformed, cross-page and disabled variants show the regular page", async () => {
  const plain = (await load("/services/mini-splits")).html;
  for (const query of ["?lpv=ms-unknown", "?lpv=MS-<script>", "?lpv=hp-cost", "?lpv=ms-", "?lpv=", "?lpv=ms-cost-extra"]) {
    assert.equal((await load(`/services/mini-splits${query}`)).html, plain, query);
  }
  const furnace = (await load("/services/furnaces")).html;
  assert.equal((await load("/services/furnaces?lpv=fn-cost")).html, furnace, "furnace variants stay off");
  const ac = (await load("/services/air-conditioning")).html;
  assert.equal((await load("/services/air-conditioning?lpv=ac-cost")).html, ac, "AC variants stay off");
});

test("prepared furnace and AC variants render correctly once enabled", () => {
  const enabled = new Set(["fn", "ac"]);
  for (const [path, id] of [["/services/furnaces", "fn-replace"], ["/services/air-conditioning", "ac-install"]]) {
    const variant = resolveLandingVariant(new URL(`https://apexgroupwa.com${path}?lpv=${id}`), { enabled });
    const html = applyLandingVariant(source(path), variant);
    assert.equal(h1(html), LANDING_VARIANTS[id].h1);
    assert.equal(cta(html), amp(LANDING_VARIANTS[id].cta));
  }
});

test("variant text is escaped even if the dictionary ever contains markup", () => {
  const html = applyLandingVariant('<html><h1 data-lpv="h1">x</h1></html>', { id: "hp-install", h1: "<img src=x onerror=alert(1)>", sub: "", cta: "" });
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
