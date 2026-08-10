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
  ["Blog", "/blog"]
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
      <a class="brand" href="/" aria-label="Apex Service Group home"><img class="brand-symbol" src="/assets/apex-icon.png" alt="" aria-hidden="true" /><span class="brand-text"><strong>APEX</strong><small>Service Group LLC</small></span></a>
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

export function pathForHtmlFile(relativePath) {
  const normalized = relativePath.split("\\").join("/");
  if (normalized === "index.html") return "/";
  return `/${normalized.replace(/\.html$/, "")}`;
}
