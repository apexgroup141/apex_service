import assert from "node:assert/strict";
import test from "node:test";
import { renderFooterSocialLinks, shouldRenderFooterSocialLinks, socialProfiles } from "../scripts/site-navigation.mjs";

test("the footer links to the Facebook page and Instagram profile in a new tab", () => {
  const nav = renderFooterSocialLinks();
  for (const { href } of socialProfiles) {
    assert.ok(nav.includes(`href="${href}" target="_blank" rel="noopener"`), href);
  }
  assert.match(nav, /facebook\.com\/apexgroupwa/);
  assert.match(nav, /instagram\.com\/apexgroupwa/);
});

test("ad landing pages and estimate flows keep the form as the only exit", () => {
  for (const route of ["/", "/services/furnaces", "/blog", "/areas/tacoma", "/get-estimate"]) {
    assert.equal(shouldRenderFooterSocialLinks(route), true, route);
  }
  for (const route of ["/admin", "/landing/furnace-repair", "/instant-estimate/heat-pump"]) {
    assert.equal(shouldRenderFooterSocialLinks(route), false, route);
  }
});
