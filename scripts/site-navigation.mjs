const serviceLinks = [
  ["Home", "/"],
  ["Heat Pumps", "/services/heat-pumps"],
  ["Mini Splits", "/services/mini-splits"],
  ["Air Conditioning", "/services/air-conditioning"],
  ["Furnaces", "/services/furnaces"],
  ["Ductwork", "/services/ductwork"],
  ["Repair & Maintenance", "/services/repair-maintenance"]
];

const aboutLinks = [
  ["About Apex Service Group", "/about"],
  ["Our Projects", "/projects"],
  ["Customer Reviews", "/reviews"],
  ["HVAC Tips & Guides", "/blog"]
];

const normalizePath = (pathname) => pathname.replace(/index\.html$/, "").replace(/\.html$/, "") || "/";

const navLink = ([label, href], currentPath, className = "") => {
  const active = normalizePath(href) === currentPath;
  return `<a${className ? ` class="${className}"` : ""} href="${href}"${active ? ' aria-current="page"' : ""}>${label}</a>`;
};

export function renderSiteHeader(pathname = "/") {
  const currentPath = normalizePath(pathname);
  const isHome = currentPath === "/";
  const aboutActive = aboutLinks.some(([, href]) => normalizePath(href) === currentPath);

  return `<header class="site-header${isHome ? "" : " header-solid"}" data-header>
    <div class="site-header-shell">
      <a class="brand" href="/" aria-label="Apex Service Group home"><img class="brand-symbol" src="/assets/apex-icon-header-84.webp" width="84" height="84" alt="" aria-hidden="true" /><span class="brand-text"><strong>APEX</strong><small>Service Group LLC</small></span></a>
      <button class="nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="site-nav" data-nav-toggle><span></span><span></span><span></span></button>
      <nav class="site-nav" id="site-nav" aria-label="Primary navigation" data-nav>
        <div class="nav-service-links">${serviceLinks.map((link) => navLink(link, currentPath)).join("")}</div>
        <div class="nav-item has-menu${aboutActive ? " is-current" : ""}">
          <button class="nav-trigger" type="button" aria-expanded="false" aria-controls="about-menu" data-submenu-toggle>About<span class="dropdown-indicator" aria-hidden="true"></span></button>
          <div class="nav-menu" id="about-menu" aria-label="About Apex Service Group">${aboutLinks.map((link) => navLink(link, currentPath)).join("")}</div>
        </div>
        <div class="nav-actions">
          <a class="estimate-cta" href="/get-estimate" data-cta-location="header">Get Free Estimate</a>
          <a class="header-cta" href="tel:+12532821126">Call (253) 282-1126</a>
        </div>
      </nav>
    </div>
    </header>`;
}

const mobileCtaExcludedPaths = new Set(["/admin", "/get-estimate", "/thank-you", "/yard"]);
const mobileCtaExcludedPrefixes = ["/instant-estimate/", "/landing/"];

export function shouldRenderMobileCtaBar(pathname = "/") {
  const currentPath = normalizePath(pathname);
  if (mobileCtaExcludedPaths.has(currentPath)) return false;
  return !mobileCtaExcludedPrefixes.some((prefix) => currentPath.startsWith(prefix));
}

export function renderMobileCtaBar() {
  return `<nav class="mobile-cta-bar" aria-label="Contact Apex Service Group" data-mobile-cta-bar>
      <a class="mobile-cta-call" href="tel:+12532821126">Call</a>
      <a class="mobile-cta-estimate" href="/get-estimate" data-cta-location="mobile_bar">Free Estimate</a>
    </nav>`;
}

export const socialProfiles = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/apexgroupwa",
    icon: '<path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21z"/>'
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/apexgroupwa",
    icon: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2"/>'
  }
];

// Ad landing pages and instant-estimate flows keep the form as the only exit.
export function shouldRenderFooterSocialLinks(currentPath) {
  return currentPath !== "/admin" && !currentPath.startsWith("/landing/") && !currentPath.startsWith("/instant-estimate");
}

export function renderFooterSocialLinks() {
  const links = socialProfiles
    .map(
      ({ name, href, icon }) =>
        `<a href="${href}" target="_blank" rel="noopener" aria-label="Apex Service Group on ${name}"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">${icon}</svg></a>`
    )
    .join("");
  return `<nav class="footer-social" aria-label="Apex Service Group on social media" data-footer-social>${links}</nav>`;
}

export function pathForHtmlFile(relativePath) {
  const normalized = relativePath.split("\\").join("/");
  if (normalized === "index.html") return "/";
  return `/${normalized.replace(/\.html$/, "")}`;
}
