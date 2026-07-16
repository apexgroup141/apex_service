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

const adLandingPages = [
  {
    slug: "heat-pump-installation",
    title: "Heat Pump Installation",
    serviceValue: "Heat pump installation",
    meta: "Heat pump installation estimates with sizing, airflow review, rebate guidance, warranty support and financing options from Apex Service Group LLC.",
    eyebrow: "Heat pump installation",
    headline: "Replace old heating and cooling with a clean heat pump plan.",
    intro: "Get a clear heat pump installation estimate with equipment options, ductwork notes, startup testing, warranty details and rebate or financing guidance before you approve the work.",
    bullets: ["Ducted heat pump replacement", "Hybrid heat pump options", "Airflow and ductwork review", "Rebate and financing guidance"],
    urgency: "Best for high bills, aging AC, electric resistance heat, oil heat, old furnaces and homeowners planning an efficient year-round comfort upgrade.",
    warranty: "Installation scope, equipment model details, startup notes and warranty information are kept with the project.",
    brands: ["Mitsubishi", "Carrier", "Fujitsu", "Midea", "Trane"],
    faq: [
      ["Can a heat pump replace my furnace and AC?", "Often, yes. The right setup depends on ductwork, electrical capacity, insulation and whether backup heat makes sense."],
      ["Will you check rebates?", "Eligible heat pump projects can be reviewed for utility incentives and financing options before approval."]
    ]
  },
  {
    slug: "furnace-repair",
    title: "Furnace Repair",
    serviceValue: "Furnace repair or replacement",
    meta: "Furnace repair and no-heat diagnostics with clear repair options, replacement planning, warranty support and fast scheduling.",
    eyebrow: "Furnace repair",
    headline: "No heat, weak airflow or a furnace that keeps shutting off?",
    intro: "Request furnace diagnostics with a clear explanation of the issue, repair path, safety notes and whether replacement or a heat pump upgrade should be compared.",
    bullets: ["No-heat diagnostics", "Ignition and blower troubleshooting", "Thermostat and control checks", "Repair vs replacement options"],
    urgency: "Best for no heat, short cycling, strange startup noise, weak airflow, frequent faults or older equipment that may not be worth repeated repair.",
    warranty: "Repair work is documented so the homeowner knows what was diagnosed, approved and completed.",
    brands: ["Carrier", "Trane", "Ameristar", "Fujitsu", "Hitachi"],
    faq: [
      ["Should I repair or replace the furnace?", "That depends on age, safety, parts, repair cost and whether a newer heat pump or furnace makes better long-term sense."],
      ["Can airflow cause furnace problems?", "Yes. Restricted ducts, filters or returns can create comfort and equipment problems."]
    ]
  },
  {
    slug: "ac-repair",
    title: "AC Repair",
    serviceValue: "AC repair or installation",
    meta: "AC repair and cooling diagnostics with fast scheduling, clear options, warranty support, financing and replacement guidance.",
    eyebrow: "AC repair",
    headline: "AC not cooling? Get a clear cooling diagnosis before replacing parts.",
    intro: "Apex Service Group checks airflow, electrical parts, coils, controls and system condition so you can compare repair, replacement or heat pump upgrade options.",
    bullets: ["No-cool diagnostics", "Capacitor, fan and control checks", "Frozen coil and airflow review", "AC replacement guidance"],
    urgency: "Best for warm supply air, frozen coils, breaker trips, short cycling, loud starts, high bills or older central AC systems.",
    warranty: "The recommended repair or replacement path is explained before work begins, with equipment and warranty details kept clear.",
    brands: ["Carrier", "Trane", "Midea", "Mitsubishi", "Fujitsu"],
    faq: [
      ["Why is my AC running but not cooling?", "Common causes include airflow restrictions, dirty coils, electrical parts, refrigerant issues or aging equipment."],
      ["Should I replace AC with a heat pump?", "Sometimes. A heat pump may provide both heating and cooling, but the home needs to be reviewed first."]
    ]
  },
  {
    slug: "mini-split-installation",
    title: "Mini-Split Installation",
    serviceValue: "Mini-split installation",
    meta: "Mini-split installation estimates for bedrooms, additions, garages, ADUs and whole-home ductless comfort with financing options.",
    eyebrow: "Mini-split installation",
    headline: "Add quiet heating and cooling where ducts do not reach.",
    intro: "Get a ductless mini-split estimate with indoor head placement, outdoor unit location, line-set route, drainage, electrical access and warranty details explained clearly.",
    bullets: ["Single-zone ductless installs", "Multi-zone system planning", "ADU, garage and addition comfort", "Clean line-set and drain routing"],
    urgency: "Best for additions, upstairs rooms, home offices, garages, ADUs, detached spaces and targeted comfort without major ductwork changes.",
    warranty: "Brand, model, placement and startup details are documented so warranty questions stay simple after installation.",
    brands: ["Mitsubishi", "Fujitsu", "Midea", "Hitachi", "Carrier"],
    faq: [
      ["Can one mini-split serve the whole home?", "Sometimes, but many homes need multiple zones or another system type. Layout and comfort goals decide the answer."],
      ["Can I finance a mini-split project?", "Payment options can be checked before choosing the final scope."]
    ]
  },
  {
    slug: "hvac-maintenance",
    title: "HVAC Maintenance",
    serviceValue: "Maintenance",
    meta: "HVAC maintenance, tune-ups and diagnostics for heating, cooling, airflow, controls and seasonal reliability.",
    eyebrow: "HVAC maintenance",
    headline: "Keep heating and cooling running before the busy season hits.",
    intro: "Seasonal HVAC maintenance helps catch airflow, coil, filter, electrical, thermostat and performance issues before they become larger repair calls.",
    bullets: ["Heating and cooling tune-ups", "Thermostat and control checks", "Airflow and filter review", "Repair recommendations explained"],
    urgency: "Best for systems with rising bills, weak airflow, uneven comfort, noisy operation or equipment that has not been serviced recently.",
    warranty: "Maintenance notes help keep a clearer record of system condition, recommended repairs and follow-up needs.",
    brands: ["Carrier", "Mitsubishi", "Trane", "Fujitsu", "Midea"],
    faq: [
      ["How often should HVAC be maintained?", "Most systems should be checked seasonally or at least once a year, depending on age, usage and equipment type."],
      ["Can maintenance prevent breakdowns?", "It can catch many common issues early, especially airflow, coil, filter, electrical and control problems."]
    ]
  },
  {
    slug: "rebates-financing",
    title: "Rebates & Financing",
    serviceValue: "Heat pump installation",
    meta: "HVAC rebates and financing options for heat pumps, mini-splits, AC and replacement systems with clear estimates from Apex Service Group LLC.",
    eyebrow: "Rebates and financing",
    headline: "Compare comfort, efficiency, rebates and payment options before approving HVAC work.",
    intro: "For larger HVAC projects, Apex Service Group helps compare equipment scope, utility incentive notes, financing options and what is included in the installation.",
    bullets: ["Acorn Finance payment options", "Heat pump rebate guidance", "Ductless project review", "Clear quote options"],
    urgency: "Best for homeowners planning a system replacement, heat pump upgrade, ductless install or AC/furnace replacement where monthly payment options matter.",
    warranty: "The estimate separates equipment, installation scope, rebate notes, financing path, permit items and warranty information.",
    brands: ["Mitsubishi", "Carrier", "Fujitsu", "Midea", "Trane"],
    faq: [
      ["Does checking financing affect credit?", "Acorn Finance states that checking rates will not impact your credit score."],
      ["Can rebates be guaranteed?", "Eligibility depends on utility rules, equipment, home details and program availability, so it should be reviewed before approval."]
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

function brandLogoTile(brand) {
  const logos = {
    Mitsubishi: "/assets/logos/mitsubishi-electric.svg",
    Midea: "/assets/logos/midea.svg",
    Carrier: "/assets/logos/carrier-wordmark.svg",
    Fujitsu: "/assets/logos/fujitsu.svg",
    Hitachi: "/assets/logos/hitachi.svg",
    Trane: "/assets/logos/trane.svg"
  };

  if (logos[brand]) {
    return `<figure class="logo-tile"><img src="${logos[brand]}" alt="${escapeHtml(brand)} logo" /><figcaption>${escapeHtml(brand)}</figcaption></figure>`;
  }

  return `<figure class="logo-tile"><span class="wordmark wordmark-ameristar">${escapeHtml(brand)}</span><figcaption>${escapeHtml(brand)}</figcaption></figure>`;
}

function landingPageHtml(page) {
  const route = `/landing/${page.slug}`;
  const requestHref = `/?service=${encodeURIComponent(page.serviceValue)}#contact`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page.title)} | Apex Service Group LLC</title>
    <meta name="description" content="${escapeHtml(page.meta)}" />
    <meta name="theme-color" content="#061f49" />
    <link rel="icon" type="image/png" href="/assets/apex-icon.png" />
    <link rel="apple-touch-icon" href="/assets/apex-icon.png" />
    <link rel="canonical" href="${baseUrl}${route}" />
    <link rel="preload" as="image" href="/assets/hvac-hero-mobile.avif" type="image/avif" media="(max-width: 640px)" />
    <link rel="preload" as="image" href="/assets/hvac-hero-tablet.avif" type="image/avif" media="(min-width: 641px)" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    ${header()}

    <main class="landing-main">
      <section class="landing-hero">
        <div class="landing-copy">
          <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
          <h1>${escapeHtml(page.headline)}</h1>
          <p>${escapeHtml(page.intro)}</p>
          <div class="landing-cta-row">
            <a class="button primary" href="#estimate">Get a free estimate</a>
            <a class="button secondary" href="tel:+12533178546">Call (253) 317-8546</a>
            <span class="finance-cta-note">
              <a class="button secondary" href="https://www.acornfinance.com/pre-qualify/?d=UK5SN&utm_medium=web_pre_qual_banner" target="_blank" rel="noopener noreferrer">Check financing</a>
              <small>Checking your rate won't impact your credit score.</small>
            </span>
          </div>
          <div class="landing-proof" aria-label="Apex service highlights">
            <div><strong>Licensed</strong><span>WA contractor APEXSSG746LJ</span></div>
            <div><strong>Bonded & insured</strong><span>documents available for larger work</span></div>
            <div><strong>Clear warranty</strong><span>equipment and scope kept documented</span></div>
          </div>
        </div>

        <aside class="landing-form-card" id="estimate">
          <h2>Request service</h2>
          <p>Send the basics. Apex will follow up with timing and the right next step.</p>
          <form class="lead-form" data-lead-form data-endpoint="/api/lead">
            <input type="hidden" name="service" value="${escapeHtml(page.serviceValue)}" />
            <label>
              Name
              <input name="name" autocomplete="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" autocomplete="email" required />
            </label>
            <label>
              Phone
              <span class="phone-input">
                <span class="phone-prefix">+1</span>
                <input name="phone" type="tel" autocomplete="tel-national" inputmode="tel" placeholder="(253) 317-8546" required data-phone-field />
              </span>
            </label>
            <label>
              City / service area
              <input name="area" autocomplete="address-level2" required data-area-field />
            </label>
            <label>
              Message
              <textarea name="message" rows="4" placeholder="Tell us what is happening and when you need help." required></textarea>
            </label>
            <label class="form-honeypot" aria-hidden="true">
              Company
              <input name="company" tabindex="-1" autocomplete="off" />
            </label>
            <p class="form-status" aria-live="polite" data-form-status></p>
            <button class="button primary" type="submit">Request estimate</button>
          </form>
        </aside>
      </section>

      <section class="landing-section">
        <div class="landing-grid">
          <div>
            <p class="eyebrow">Why this page exists</p>
            <h2>Built for people who need one clear HVAC answer, not a tour of the whole website.</h2>
            <p>${escapeHtml(page.urgency)}</p>
            <ul class="landing-benefits">
              ${page.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n              ")}
            </ul>
          </div>
          <aside>
            <div class="landing-side-card">
              <h3>Warranty and protection</h3>
              <p>${escapeHtml(page.warranty)}</p>
            </div>
            <div class="landing-side-card">
              <h3>Financing available</h3>
              <p>Payment options can be checked through Acorn Finance before approving a larger installation or replacement project. Checking your rate won't impact your credit score.</p>
              <a class="text-link" href="https://www.acornfinance.com/pre-qualify/?d=UK5SN&utm_medium=web_pre_qual_banner" target="_blank" rel="noopener noreferrer">Check payment options</a>
              <a class="finance-qr-link" href="https://www.acornfinance.com/pre-qualify/?d=UK5SN&utm_medium=web_pre_qual_banner" target="_blank" rel="noopener noreferrer" aria-label="Scan Acorn Finance QR code">
                <img src="/assets/acorn-finance-qr.jpg" alt="Acorn Finance QR code for payment options" loading="lazy" />
                <span>Scan the QR code</span>
              </a>
            </div>
          </aside>
        </div>
      </section>

      <section class="landing-section alt">
        <div class="section-heading">
          <p class="eyebrow">Brands and equipment</p>
          <h2>Recognizable HVAC equipment options.</h2>
          <p class="section-lead">Apex works with established HVAC suppliers and can compare equipment options for comfort, warranty, availability and budget.</p>
        </div>
        <div class="landing-brand-row" aria-label="HVAC equipment brands">
          ${page.brands.map((brand) => brandLogoTile(brand)).join("\n          ")}
        </div>
      </section>

      <section class="landing-section">
        <div class="section-heading">
          <p class="eyebrow">Quick answers</p>
          <h2>Before you request an estimate.</h2>
        </div>
        <div class="mini-grid">
          ${page.faq.map(([question, answer]) => `<article class="mini-card"><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></article>`).join("\n          ")}
          <article class="mini-card"><h3>What happens after I submit?</h3><p>Apex follows up with scheduling, the right visit type and any details needed to prepare a clear repair or installation path.</p></article>
        </div>
      </section>

      <section class="content-section alt"><div class="cta-strip"><div><h2>Ready to talk through ${escapeHtml(page.title).toLowerCase()}?</h2><p>Call now or send the short form. The request also lands in the lead system for follow-up and tracking.</p></div><a class="button primary" href="${requestHref}">Start request</a></div></section>
    </main>

    ${footer()}
    <script src="/script.js"></script>
  </body>
</html>
`;
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
    ...adLandingPages.map((page) => `/landing/${page.slug}`),
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
fs.mkdirSync(path.join(root, "landing"), { recursive: true });
for (const page of pages) {
  fs.writeFileSync(path.join(root, page.filePath), pageHtml(page.area, page.service));
}

for (const page of adLandingPages) {
  fs.writeFileSync(path.join(root, "landing", `${page.slug}.html`), landingPageHtml(page));
}

fs.writeFileSync(path.join(root, "local-hvac-services.html"), indexHtml(pages));
fs.writeFileSync(path.join(root, "sitemap.xml"), sitemapXml(pages));

console.log(`Generated ${pages.length} local SEO pages and ${adLandingPages.length} ad landing pages.`);
