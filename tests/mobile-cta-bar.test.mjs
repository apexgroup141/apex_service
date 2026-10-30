import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { renderMobileCtaBar, renderSiteHeader, shouldRenderMobileCtaBar } from "../scripts/site-navigation.mjs";

test("the mobile bar reuses the site phone number and the tracked estimate link", () => {
  const bar = renderMobileCtaBar();
  const headerPhone = renderSiteHeader("/").match(/href="(tel:[^"]+)"/)[1];

  assert.ok(bar.includes(`href="${headerPhone}"`));
  assert.match(bar, /href="\/get-estimate" data-cta-location="mobile_bar"/);
  assert.doesNotMatch(bar, /gtag|dataLayer|onclick/);
});

test("the mobile bar is excluded from form, confirmation and admin pages", () => {
  for (const route of ["/", "/services/furnaces", "/blog", "/blog/furnace-not-blowing-warm-air", "/areas/tacoma", "/reviews"]) {
    assert.equal(shouldRenderMobileCtaBar(route), true, route);
  }
  for (const route of ["/get-estimate", "/thank-you", "/admin", "/instant-estimate/heat-pump", "/landing/furnace-repair"]) {
    assert.equal(shouldRenderMobileCtaBar(route), false, route);
  }
});

test("the shared script does not add tracking events for the mobile bar", () => {
  const source = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");
  const barLogic = source.slice(source.indexOf("const mobileCtaBar"), source.indexOf("const setNavOpen"));
  assert.ok(barLogic.length > 0);
  assert.doesNotMatch(barLogic, /trackEvent|gtag|sendBeacon|dataLayer/);
});
