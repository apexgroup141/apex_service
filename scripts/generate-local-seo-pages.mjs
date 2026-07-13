import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const baseUrl = "https://apexgroupwa.com";

const areas = [
  ["Seattle Metro", "Seattle"],
  ["Seattle Metro", "West Seattle"],
  ["Seattle Metro", "South Seattle"],
  ["Seattle Metro", "Burien"],
  ["Seattle Metro", "Tukwila"],
  ["Seattle Metro", "SeaTac"],
  ["Seattle Metro", "Des Moines"],
  ["Seattle Metro", "Normandy Park"],
  ["South King County", "Renton"],
  ["South King County", "Kent"],
  ["South King County", "Auburn"],
  ["South King County", "Federal Way"],
  ["South King County", "Maple Valley"],
  ["South King County", "Covington"],
  ["South King County", "Black Diamond"],
  ["South King County", "Enumclaw"],
  ["Eastside", "Bellevue"],
  ["Eastside", "Mercer Island"],
  ["Eastside", "Newcastle"],
  ["Eastside", "Issaquah"],
  ["Eastside", "Sammamish"],
  ["Eastside", "Redmond"],
  ["Eastside", "Kirkland"],
  ["Eastside", "Bothell"],
  ["Pierce County", "Tacoma"],
  ["Pierce County", "Lakewood"],
  ["Pierce County", "University Place"],
  ["Pierce County", "Puyallup"],
  ["Pierce County", "Sumner"],
  ["Pierce County", "Bonney Lake"],
  ["Pierce County", "Fife"],
  ["Pierce County", "Milton"],
  ["Pierce County", "Edgewood"],
  ["Pierce County", "Gig Harbor"],
  ["Pierce County", "Spanaway"],
  ["Pierce County", "Parkland"],
  ["Thurston Area", "Olympia"],
  ["Thurston Area", "Lacey"],
  ["Thurston Area", "Tumwater"],
  ["Thurston Area", "DuPont"],
  ["Thurston Area", "Yelm"],
  ["Thurston Area", "Rochester"]
].map(([group, name]) => ({ group, name, slug: slugify(name) }));

const regionCopy = {
  "Seattle Metro": "homes across the Seattle metro, where older homes, additions and changing comfort needs often require practical HVAC planning",
  "South King County": "South King County homes that need dependable heating, cooling and airflow solutions without overcomplicating the project",
  Eastside: "Eastside homes where comfort, quiet operation, clean installation and clear planning matter before work begins",
  "Pierce County": "Pierce County homes with a mix of older equipment, ductwork constraints, additions and replacement needs",
  "Thurston Area": "Thurston-area homes that need practical repair, replacement and maintenance options with clear next steps"
};

const services = [
  {
    slug: "heat-pump-installation",
    title: "Heat Pump Installation",
    phrase: "heat pump installation",
    serviceValue: "Heat pump installation",
    pagePath: "/services/heat-pumps",
    noun: "heat pump",
    headline: "Heat pump installation and replacement",
    metaVerb: "Heat pump installation and replacement",
    intro: "A properly sized heat pump can handle efficient heating and cooling from one system, but the result depends on equipment selection, airflow, controls and final commissioning.",
    bullets: [
      "Ducted heat pump installation and replacement",
      "Hybrid heat pump and gas furnace options",
      "Airflow and ductwork review before installation",
      "Thermostat, controls and startup testing",
      "Rebate notes and financing options"
    ],
    fit: "Homes with aging AC, electric resistance heat, high utility bills, old furnaces, uneven comfort or owners planning a cleaner year-round comfort upgrade.",
    faq: [
      ["Can a heat pump replace both heating and cooling?", "Often, yes. The right setup depends on ductwork, insulation, electrical capacity and whether backup heat makes sense for the home."],
      ["Do you check ductwork before installation?", "Yes. Airflow problems can make new equipment underperform, so duct size, return air and restrictions should be reviewed before final equipment selection."],
      ["Can rebates or financing apply?", "Eligible projects may qualify for utility incentives, and payment options can be reviewed before approving the project."]
    ]
  },
  {
    slug: "mini-split-installation",
    title: "Mini-Split Installation",
    phrase: "mini-split installation",
    serviceValue: "Mini-split installation",
    pagePath: "/services/mini-splits",
    noun: "mini-split",
    headline: "mini-split installation and ductless comfort planning",
    metaVerb: "Mini-split installation",
    intro: "Ductless systems are flexible, but placement matters. A good mini-split plan considers room layout, outdoor unit location, line-set path, drainage, electrical access and how the space is used.",
    bullets: [
      "Single-zone mini-split installation",
      "Multi-zone ductless system planning",
      "Home office, bedroom, garage, ADU and addition comfort",
      "Outdoor unit placement and line-set routing review",
      "Startup testing, controls setup and clean walkthrough"
    ],
    fit: "Rooms without ducts, additions, upstairs comfort problems, detached spaces, home offices, ADUs and targeted heating or cooling without major duct changes.",
    faq: [
      ["Can one mini-split serve the whole home?", "Sometimes, but many homes need multiple indoor heads or a different system type. Layout, insulation and comfort goals decide the right answer."],
      ["Where can indoor heads go?", "Placement depends on room shape, usable wall area, furniture, drain routing and how air needs to move through the space."],
      ["Can I check financing first?", "Yes. Payment options can be reviewed before choosing the final project scope."]
    ]
  },
  {
    slug: "furnace-repair-replacement",
    title: "Furnace Repair & Replacement",
    phrase: "furnace repair & replacement",
    serviceValue: "Furnace repair or replacement",
    pagePath: "/services/furnaces",
    noun: "furnace",
    headline: "furnace repair, diagnostics and replacement",
    metaVerb: "Furnace repair and replacement",
    intro: "A furnace issue should be reviewed for safety, airflow, controls, age and repair cost. The goal is to understand whether repair, maintenance, replacement or a heat pump upgrade is the better path.",
    bullets: [
      "No-heat diagnostics",
      "Gas furnace repair and replacement",
      "Ignition, blower, thermostat and control troubleshooting",
      "Airflow and filter review",
      "Furnace-to-heat-pump upgrade planning"
    ],
    fit: "Homes with no heat, weak airflow, short cycling, ignition failures, rising bills, noisy startup or older furnaces nearing replacement age.",
    faq: [
      ["Should I repair or replace my furnace?", "It depends on age, safety, part availability, repair cost and whether the home would benefit from a heat pump upgrade."],
      ["Can airflow cause furnace problems?", "Yes. Restricted ductwork, poor return air or dirty filters can create comfort issues and put stress on equipment."],
      ["Do you explain the repair before starting?", "Yes. The diagnosis, repair path and replacement option can be explained before work proceeds."]
    ]
  },
  {
    slug: "ac-repair-installation",
    title: "AC Repair & Installation",
    phrase: "AC repair & installation",
    serviceValue: "AC repair or installation",
    pagePath: "/services/air-conditioning",
    noun: "air conditioner",
    headline: "AC repair, replacement and installation",
    metaVerb: "AC repair and installation",
    intro: "Cooling problems can come from refrigerant issues, coils, capacitors, motors, controls, airflow or aging equipment. A clear diagnosis helps decide whether repair, replacement or a heat pump upgrade is the right move.",
    bullets: [
      "Central AC repair and diagnostics",
      "AC installation and replacement",
      "Coil, capacitor, fan motor and electrical troubleshooting",
      "Airflow and thermostat checks",
      "AC vs heat pump upgrade guidance"
    ],
    fit: "Homes with no cooling, warm supply air, frozen coils, short cycling, breaker trips, loud startup or older central AC systems.",
    faq: [
      ["Why is my AC running but not cooling?", "Possible causes include airflow restrictions, dirty coils, refrigerant issues, electrical parts or equipment age."],
      ["Should I replace AC with a heat pump?", "Sometimes. A heat pump can provide heating and cooling, but the best option depends on the home and existing system."],
      ["Do you check airflow?", "Yes. Airflow problems can mimic equipment failure and should be reviewed before replacing equipment."]
    ]
  },
  {
    slug: "ductwork",
    title: "Ductwork",
    phrase: "ductwork",
    serviceValue: "Ductwork",
    pagePath: "/services/ductwork",
    noun: "ductwork",
    headline: "ductwork replacement, modification and airflow improvement",
    metaVerb: "Ductwork service",
    intro: "New HVAC equipment cannot fix bad airflow by itself. Ductwork should be reviewed when rooms are uncomfortable, airflow is weak, equipment is noisy or a replacement system is being planned.",
    bullets: [
      "Duct replacement and modification",
      "Return-air improvements",
      "Duct changes for heat pump, furnace or AC replacement",
      "Airflow balancing and restriction review",
      "Comfort fixes for hot and cold rooms"
    ],
    fit: "Homes with weak airflow, noisy registers, dusty rooms, hot and cold spots, undersized ducts or equipment that short cycles.",
    faq: [
      ["Can ductwork make new equipment perform badly?", "Yes. Undersized, leaky or restricted ducts can reduce comfort and efficiency even with good equipment."],
      ["When is the best time to review ducts?", "Ductwork is easiest to address during heat pump, furnace or AC replacement planning."],
      ["Do all rooms need new ducts?", "Not always. Sometimes targeted return-air or supply modifications are enough to improve comfort."]
    ]
  },
  {
    slug: "repair-maintenance",
    title: "HVAC Repair & Maintenance",
    phrase: "HVAC repair & maintenance",
    serviceValue: "Maintenance",
    pagePath: "/services/repair-maintenance",
    noun: "HVAC system",
    headline: "HVAC repair, diagnostics and maintenance",
    metaVerb: "HVAC repair and maintenance",
    intro: "Repair and maintenance should identify the immediate issue, explain what caused it and help the homeowner understand whether the system needs service, repair or replacement planning.",
    bullets: [
      "Heating and cooling diagnostics",
      "No heat and no cooling service calls",
      "Thermostat, control and electrical troubleshooting",
      "Short cycling, airflow and high-bill complaints",
      "Seasonal maintenance and tune-ups"
    ],
    fit: "Homes with comfort changes, unexpected shutdowns, weak airflow, high bills, noisy operation, thermostat problems or systems due for seasonal maintenance.",
    faq: [
      ["What should I send before a service visit?", "System age, brand, what changed, whether the home still has heating or cooling and any error codes or symptoms."],
      ["Can maintenance prevent breakdowns?", "Maintenance can catch airflow, coil, filter, electrical and control issues before they turn into larger failures."],
      ["Will I get repair options first?", "Yes. The diagnosis and repair path can be explained before the repair proceeds."]
    ]
  }
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function publicRoute(filePath) {
  if (filePath === "/index.html") return "/";
  return filePath.replace(/\.html$/, "");
}

function header() {
  return `<header class="site-header header-solid" data-header>
      <a class="brand" href="/" aria-label="Apex Service Group home"><img class="brand-symbol" src="/assets/apex-icon.png" alt="" aria-hidden="true" /><span class="brand-text"><strong>APEX</strong><small>Service Group LLC</small></span></a>
      <button class="nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="site-nav" data-nav-toggle><span></span><span></span><span></span></button>
      <nav class="site-nav" id="site-nav" data-nav><div class="nav-item has-menu"><a class="nav-trigger" href="/#services">Services</a><div class="nav-menu" aria-label="Service categories"><a href="/services/heating"><strong>Heating</strong><span>Furnaces & heat pumps</span></a><a href="/services/cooling"><strong>Cooling</strong><span>AC & mini-splits</span></a><a href="/services/service"><strong>Service</strong><span>Repair & maintenance</span></a></div></div><a href="/rebates-financing">Rebates</a><a href="/#process">Process</a><a href="/service-areas">Areas</a><a href="/#contact">Contact</a></nav>
      <a class="header-cta" href="tel:+12533178546">Call (253) 317-8546</a>
    </header>`;
}

function footer() {
  return `<footer class="site-footer"><div><strong>Apex Service Group LLC</strong><span>Licensed HVAC installation, repair and maintenance. License APEXSSG746LJ.</span></div><a href="/service-areas">Areas</a></footer>`;
}

function pageHtml(area, service) {
  const title = `${service.title} ${area.name}, WA | Apex Service Group LLC`;
  const description = `${service.metaVerb} in ${area.name}, WA. Apex Service Group handles diagnostics, planning, clean work, warranty support, financing options and documented HVAC service.`;
  const pathName = `/areas/${area.slug}-${service.slug}`;
  const requestHref = `/?area=${encodeURIComponent(area.name)}&service=${encodeURIComponent(service.serviceValue)}#contact`;
  const regionalText = regionCopy[area.group];
  const faqJson = service.faq.map(([question, answer]) => ({
    "@type": "Question",
    name: `${question} (${area.name})`,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer
    }
  }));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="#061f49" />
    <link rel="icon" type="image/png" href="/assets/apex-icon.png" />
    <link rel="apple-touch-icon" href="/assets/apex-icon.png" />
    <link rel="canonical" href="${baseUrl}${pathName}" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    ${header()}

    <main class="page-main">
      <section class="page-hero">
        <div class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/service-areas">Service Areas</a><span>/</span><span>${escapeHtml(service.title)} ${escapeHtml(area.name)}</span></div>
        <p class="eyebrow">${escapeHtml(area.name)} HVAC service</p>
        <h1>${escapeHtml(service.headline)} in ${escapeHtml(area.name)}, WA.</h1>
        <p>${escapeHtml(service.intro)} Apex Service Group serves ${escapeHtml(regionalText)}.</p>
        <div class="page-actions">
          <a class="button primary" href="${requestHref}">Request ${escapeHtml(area.name)} estimate</a>
          <a class="button secondary" href="${service.pagePath}">View service details</a>
        </div>
      </section>

      <section class="content-section">
        <div class="content-grid">
          <div class="copy-column">
            <p class="eyebrow">Local estimate details</p>
            <h2>What to expect for ${escapeHtml(service.phrase)} in ${escapeHtml(area.name)}.</h2>
            <p>Every home is different, so the right HVAC recommendation should consider the existing equipment, airflow, comfort complaints, access, budget and how soon the work needs to happen. The estimate is built to explain the scope clearly before the project is approved.</p>
            <ul class="check-list">
              ${service.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n              ")}
            </ul>
          </div>
          <aside>
            <div class="seo-card">
              <h3>Good fit for ${escapeHtml(area.name)}</h3>
              <p>${escapeHtml(service.fit)}</p>
            </div>
            <div class="seo-card">
              <h3>Licensed, bonded and insured</h3>
              <p>Apex Service Group LLC is a registered Washington contractor. License, insurance documentation, warranty support and project details can be kept with the job.</p>
            </div>
          </aside>
        </div>
      </section>

      <section class="content-section alt">
        <div class="content-grid">
          <div class="copy-column">
            <p class="eyebrow">Clean scope before work begins</p>
            <h2>Repair, replacement or maintenance should be easy to compare.</h2>
            <p>For ${escapeHtml(area.name)} homeowners, the goal is a clear next step: what is wrong, what can be repaired, when replacement makes sense, what the installation includes and how financing or rebate questions should be handled.</p>
          </div>
          <aside>
            <div class="seo-card">
              <h3>Related services</h3>
              <div class="link-list">
                <a href="/services/heat-pumps">Heat pump installation</a>
                <a href="/services/mini-splits">Mini-split installation</a>
                <a href="/services/furnaces">Furnace repair and replacement</a>
                <a href="/services/repair-maintenance">Repair and maintenance</a>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section class="content-section">
        <div class="section-heading">
          <p class="eyebrow">${escapeHtml(area.name)} ${escapeHtml(service.noun)} FAQ</p>
          <h2>Quick answers before requesting service.</h2>
        </div>
        <div class="mini-grid">
          ${service.faq.map(([question, answer]) => `<article class="mini-card"><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></article>`).join("\n          ")}
        </div>
      </section>

      <section class="content-section alt"><div class="cta-strip"><div><h2>Need ${escapeHtml(service.phrase)} in ${escapeHtml(area.name)}?</h2><p>Send the service area, project type and comfort issue. Apex Service Group will follow up with timing and next steps.</p></div><a class="button primary" href="${requestHref}">Request ${escapeHtml(service.phrase)}</a></div></section>
    </main>

    ${footer()}
    <script src="/script.js"></script>
    <script type="application/ld+json">
      ${JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": "Service",
          name: `${service.title} in ${area.name}, WA`,
          provider: {
            "@type": "LocalBusiness",
            name: "Apex Service Group LLC",
            telephone: "+1-253-317-8546",
            url: `${baseUrl}/`
          },
          areaServed: {
            "@type": "City",
            name: area.name,
            addressRegion: "WA"
          },
          serviceType: service.title
        },
        null,
        8
      )}
    </script>
    <script type="application/ld+json">
      ${JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqJson
        },
        null,
        8
      )}
    </script>
  </body>
</html>
`;
}

function indexHtml(pages) {
  const grouped = services
    .map((service) => {
      const links = pages
        .filter((page) => page.service.slug === service.slug)
        .map((page) => `<li><a href="${page.pathName}">${escapeHtml(service.title)} in ${escapeHtml(page.area.name)}</a></li>`)
        .join("\n              ");
      return `<section class="area-group">
            <h3>${escapeHtml(service.title)}</h3>
            <ul>
              ${links}
            </ul>
          </section>`;
    })
    .join("\n\n          ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Local HVAC Service Pages | Apex Service Group LLC</title>
    <meta name="description" content="Local HVAC service pages for heat pumps, mini-splits, furnaces, AC, ductwork, repair and maintenance across the Seattle metro, Eastside and South Sound." />
    <meta name="theme-color" content="#061f49" />
    <link rel="icon" type="image/png" href="/assets/apex-icon.png" />
    <link rel="apple-touch-icon" href="/assets/apex-icon.png" />
    <link rel="canonical" href="${baseUrl}/local-hvac-services" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    ${header()}
    <main class="page-main">
      <section class="page-hero narrow">
        <div class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/service-areas">Service Areas</a><span>/</span><span>Local HVAC Services</span></div>
        <p class="eyebrow">Local HVAC pages</p>
        <h1>HVAC service pages by city and service type.</h1>
        <p>Find local pages for heat pumps, mini-splits, furnaces, AC, ductwork, repair and maintenance across the Seattle metro, Eastside, South King County, Pierce County and Thurston-area communities.</p>
      </section>
      <section class="content-section">
        <div class="section-heading">
          <p class="eyebrow">Full index</p>
          <h2>${pages.length} local HVAC pages</h2>
        </div>
        <div class="area-groups seo-index-groups">
          ${grouped}
        </div>
      </section>
    </main>
    ${footer()}
    <script src="/script.js"></script>
  </body>
</html>
`;
}

function sitemapXml(pages) {
  const routes = [
    "/",
    "/services/heating",
    "/services/cooling",
    "/services/service",
    "/services/heat-pumps",
    "/services/mini-splits",
    "/services/furnaces",
    "/services/air-conditioning",
    "/services/ductwork",
    "/services/repair-maintenance",
    "/rebates-financing",
    "/service-areas",
    "/local-hvac-services",
    "/areas/seattle",
    "/areas/bellevue",
    "/areas/tacoma",
    "/areas/olympia",
    ...pages.map((page) => page.pathName)
  ];

  const uniqueRoutes = [...new Set(routes)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueRoutes.map((route) => `  <url><loc>${baseUrl}${route}</loc></url>`).join("\n")}
</urlset>
`;
}

const pages = areas.flatMap((area) =>
  services.map((service) => ({
    area,
    service,
    filePath: `/areas/${area.slug}-${service.slug}.html`,
    pathName: publicRoute(`/areas/${area.slug}-${service.slug}.html`)
  }))
);

fs.mkdirSync(path.join(root, "areas"), { recursive: true });
for (const page of pages) {
  fs.writeFileSync(path.join(root, page.filePath), pageHtml(page.area, page.service));
}

fs.writeFileSync(path.join(root, "local-hvac-services.html"), indexHtml(pages));
fs.writeFileSync(path.join(root, "sitemap.xml"), sitemapXml(pages));

console.log(`Generated ${pages.length} local SEO pages.`);
