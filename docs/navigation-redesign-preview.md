# Apex navigation redesign — local preview notes

Status: local preview only on `preview/navigation-redesign`. Do not push, merge, deploy, or add these routes to the production sitemap before approval and real content review.

## Current structure audit

- Technology: dependency-free static HTML, CSS and JavaScript. `scripts/generate-local-seo-pages.mjs` creates local SEO and ad landing pages; `scripts/build.mjs` packages them into a Cloudflare Worker asset bundle.
- Routing: the Worker maps extensionless paths to matching `.html` files. The local preview server mirrors this behavior.
- Deployment: the repository documentation/user context says a push to `main` triggers Cloudflare. This branch is intentionally local and unpushed.
- Existing navigation: fixed header, desktop service dropdown and compact mobile popup. Header markup was duplicated across pages.
- Existing forms: the homepage form at `/#contact` posts to `/api/lead`, then tracks `generate_lead` and redirects to `/thank-you`.
- Existing call tracking: all `tel:` links track `phone_click` and send `/api/call-click` telemetry.
- Existing analytics: GA `G-F4H11YXLLS` and Google Ads `AW-18358155203` are injected once per built HTML page.
- Existing design: system/Inter typography, navy `#061f49`, blue `#0965d8`, red `#e50914`, 8px corners, fixed 76px header and responsive breakpoints at 980px/640px.

## Proposed sitemap and navigation

Desktop order: Home → Heat Pumps → Mini Splits → Air Conditioning → Furnaces → Ductwork → Repair & Maintenance → About ▾ → Get Free Estimate → Call (253) 282-1126. The logo also links home.

About submenu: About Apex Service Group → Our Projects → Customer Reviews → Blog.

Mobile order: Home and the same six services immediately visible, expandable About submenu, then full-width Get Free Estimate and `Call (253) 282-1126` actions.

Proposed new top-level routes:

- `/about`
- `/projects`
- `/reviews`
- `/blog`

Existing routes kept unchanged include `/`, `/thank-you`, `/service-areas`, `/rebates-financing`, `/local-hvac-services`, all `/areas/*`, all `/landing/*`, all generated local SEO pages, and every current `/services/*` route.

## Route overlap review

No existing `/about`, `/projects`, `/reviews`, or `/blog` files existed. Homepage `/#about` is related to `/about` but is not a duplicate route. Existing aggregate routes `/services/heating`, `/services/cooling`, and `/services/service` overlap conceptually with the five primary service pages but should remain live. `/services/service` and `/services/repair-maintenance` need a later content/canonical review; neither is removed or redirected in this preview.

## Page layouts

- Reviews: breadcrumb/hero → verified rating summary placeholder → three responsive review placeholders → integration requirements → Google actions → estimate CTA. No rating, count, quote, or Review schema is invented.
- Projects: breadcrumb/hero → category chips → reusable two-column project records with image/gallery and metadata areas → estimate CTA. All visible examples are labeled as layout examples, not completed Apex projects.
- Blog: breadcrumb/hero → category navigation → planned-topic cards → estimate CTA. No article route, draft post, or sitemap entry is created.
- About: hero → company/accountability narrative → residential/local/license facts → warranty explanation → estimate/phone CTA.

Documentation-only schemas live under `content/*.example.json`; the build intentionally does not copy them into `dist`.

## SEO and internal linking

The four proposed pages have unique titles, descriptions, canonical URLs, Open Graph metadata, one H1 and breadcrumbs. They are intentionally absent from the production sitemap pending approval. The five priority service pages receive a related-resources strip linking Projects, Reviews, About, Blog and Service Areas. Homepage links Reviews and Projects; project examples demonstrate links to related services.

Before publication: validate final copy, add real project media/alt text, connect verified Google links, add approved pages to sitemap, request indexing, and only add Article/Breadcrumb structured data when matching real visible content. Do not add self-serving aggregate rating/Review schema.

## Accessibility and performance

The About menu uses a real button with `aria-expanded`/`aria-controls`, opens on hover and focus, tolerates pointer movement, closes on Escape/outside click, and returns focus after Escape. The mobile menu locks background scroll, exposes large actions and closes after link selection. Active routes use `aria-current`; visible focus rings and reduced-motion behavior are included.

No framework, font, image library, review SDK, or third-party widget was added. Review placeholders carry zero third-party network cost. If a widget is considered later, review its lazy-loading, consent/privacy behavior, JavaScript weight and layout-shift impact before approval.

## Analytics recommendations (not activated)

Keep `generate_lead` and `phone_click` unchanged. After approval, consider distinct events or parameters for `header_estimate_click`, `mobile_estimate_click`, `review_read_all_click`, `review_leave_click`, and `project_cta_click`. Define them in the existing GA/GTM plan before changing production tracking to avoid duplicate conversions.

## Publication decisions and information needed

- Official Google Business Profile public URL.
- Direct Google “Leave a review” URL.
- Google Place ID only if an approved server-side/API integration requires it.
- Approval of a widget/embed provider, if any; no paid service is recommended or selected yet.
- Verified current Google rating and review total from the chosen live source.
- Approved customer review content/source permissions.
- Approved real project titles, cities, equipment, descriptions, dates and images with alt text.
- Final confirmation of About-page warranty wording and county coverage.
- Editorial owner/author and approval workflow for future blog posts.

## Analytics, deployment and safety notes

The preview does not alter Cloudflare, D1, secrets, DNS, Google Ads, GA/GTM, Search Console or live data. It does not modify `sitemap.xml` or `robots.txt`. No secret or credential is stored in code. Forms, thank-you behavior and their event names remain intact.
