# Apex Service Group LLC website

Static HVAC website for Apex Service Group LLC.

## Local preview

```bash
python3 -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173/index.html
```

## Production build

```bash
npm run build
```

The build output is generated into:

```text
dist
```

## Cloudflare Pages settings

Use these settings when connecting the GitHub repository:

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
Root directory: /
```

## Main pages

- `/index.html`
- `/services/heating.html`
- `/services/cooling.html`
- `/services/service.html`
- `/services/heat-pumps.html`
- `/services/mini-splits.html`
- `/services/furnaces.html`
- `/services/air-conditioning.html`
- `/services/ductwork.html`
- `/services/repair-maintenance.html`
- `/rebates-financing.html`
- `/service-areas.html`
- `/areas/seattle.html`
- `/areas/bellevue.html`
- `/areas/tacoma.html`
- `/areas/olympia.html`
