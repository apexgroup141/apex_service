// Pre-approved first-screen variants for Google Ads traffic.
// Google Ads sends ?lpv={_svc}-{_intent} through the Final URL suffix, where _svc is an
// ad group custom parameter (hp, ms, fn, ac) and _intent a keyword custom parameter
// (install, replace, cost, local, convert). Only the H1, the short subheading and the
// primary CTA label change; prices, warranty, reviews, canonical and all other content
// stay identical. Unknown or malformed values fall back to the regular page.

export const LANDING_PAGES = {
  hp: "/services/heat-pumps",
  ms: "/services/mini-splits",
  fn: "/services/furnaces",
  ac: "/services/air-conditioning"
};

// Furnace and AC variants are prepared but switched off until the first two are verified.
export const ENABLED_SERVICES = new Set(["hp", "ms"]);

export const LANDING_VARIANTS = {
  "hp-install": {
    h1: "Heat Pump Installation in Puget Sound",
    sub: "Professional heat pump installation with clear pricing, careful system planning and a free on-site estimate.",
    cta: "See My Options & Pricing"
  },
  "hp-replace": {
    h1: "Heat Pump Replacement in Puget Sound",
    sub: "Replace an aging heat pump with a properly sized, efficient system. Clear pricing and a free on-site estimate.",
    cta: "Compare Replacement Options"
  },
  "hp-cost": {
    h1: "Heat Pump Installation Cost in Puget Sound",
    sub: "See typical installed price ranges in about a minute, then get a free on-site estimate for a written quote.",
    cta: "See My Price Range"
  },
  "hp-local": {
    h1: "Local Heat Pump Installers in Puget Sound",
    sub: "Licensed, owner-operated heat pump installers serving Pierce, King and Thurston counties. Free on-site estimate.",
    cta: "See My Options & Pricing"
  },
  "hp-convert": {
    h1: "Replace Your Furnace With a Heat Pump",
    sub: "Switch to efficient electric heating and cooling. We plan the conversion around your home, ductwork and budget.",
    cta: "See Conversion Options"
  },
  "ms-install": {
    h1: "Ductless Mini-Split Installation",
    sub: "Single- and multi-zone ductless systems installed by a licensed, owner-operated team. See estimated price ranges in one minute.",
    cta: "See My Options & Pricing"
  },
  "ms-replace": {
    h1: "Mini-Split Replacement",
    sub: "Replace an old or failing ductless system with a quiet, efficient mini-split. Clear pricing and a free on-site estimate.",
    cta: "Compare Replacement Options"
  },
  "ms-cost": {
    h1: "Mini-Split Installation Cost",
    sub: "See typical installed price ranges for one or more zones in about a minute. No contact details needed.",
    cta: "See My Price Range"
  },
  "ms-local": {
    h1: "Local Mini-Split Installers",
    sub: "Licensed, owner-operated ductless installers serving Pierce, King and Thurston counties. Free on-site estimate.",
    cta: "See My Options & Pricing"
  },
  "fn-install": {
    h1: "Furnace Installation in Puget Sound",
    sub: "Get clear furnace options, estimated pricing and a professional in-home assessment for your installation.",
    cta: "Get My Free Furnace Estimate"
  },
  "fn-replace": {
    h1: "Furnace Replacement in Puget Sound",
    sub: "Replace an old or failing furnace with a properly sized system. Clear options and a free in-home estimate.",
    cta: "Get My Free Furnace Estimate"
  },
  "fn-cost": {
    h1: "New Furnace Cost in Puget Sound",
    sub: "See what affects the installed price, then get a free in-home estimate for a written quote.",
    cta: "Get My Written Quote"
  },
  "fn-local": {
    h1: "Local Furnace Installers in Puget Sound",
    sub: "Licensed, owner-operated furnace installers serving Pierce, King and Thurston counties.",
    cta: "Get My Free Furnace Estimate"
  },
  "ac-install": {
    h1: "Central AC Installation",
    sub: "Central air conditioning installed by a licensed, owner-operated team. Compare central AC with heat pump cooling.",
    cta: "Compare Cooling Options"
  },
  "ac-replace": {
    h1: "Central AC Replacement",
    sub: "Replace an aging air conditioner and compare central AC with heat pump cooling before you decide.",
    cta: "Compare Cooling Options"
  },
  "ac-cost": {
    h1: "Central AC Installation Cost",
    sub: "Pricing depends on system size, coil and ductwork. Request a free in-home estimate for a written quote.",
    cta: "Compare Cooling Options"
  },
  "ac-local": {
    h1: "Local Central AC Installers",
    sub: "Licensed, owner-operated cooling installers serving Pierce, King and Thurston counties.",
    cta: "Compare Cooling Options"
  }
};

const LPV_PATTERN = /^([a-z]{2})-([a-z]{3,12})$/;

export const resolveLandingVariant = (url, { enabled = ENABLED_SERVICES } = {}) => {
  const lpv = String(url.searchParams.get("lpv") || "").toLowerCase();
  const match = lpv.match(LPV_PATTERN);
  if (!match) return null;
  const [, service] = match;
  if (!enabled.has(service) || LANDING_PAGES[service] !== url.pathname) return null;
  const variant = LANDING_VARIANTS[lpv];
  return variant ? { id: lpv, ...variant } : null;
};

const escapeText = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const replaceMarked = (html, tag, slot, value) =>
  html.replace(
    new RegExp(`(<${tag}\\b[^>]*\\bdata-lpv="${slot}"[^>]*>)[\\s\\S]*?(</${tag}>)`),
    (_match, open, close) => `${open}${escapeText(value)}${close}`
  );

export const applyLandingVariant = (html, variant) => {
  if (!variant) return html;
  let result = replaceMarked(html, "h1", "h1", variant.h1);
  result = replaceMarked(result, "p", "sub", variant.sub);
  result = replaceMarked(result, "a", "cta", variant.cta);
  return result.replace(/<html\b([^>]*)>/, (_match, attrs) => `<html${attrs} data-lp-variant="${escapeText(variant.id)}">`);
};
