# Carbonwise prototype

A hackathon MVP for the workflow: building inputs → estimated material quantities → embodied carbon → energy estimate → operational carbon → lifecycle estimate → alternatives → optimisation → score → printable report.

## Run locally

Open `index.html` in a browser, or serve the folder with a static HTTP server. The demo uses plain HTML, CSS and JavaScript so there is no build step.

## What it calculates

- Gross floor area = floor plate × floors.
- Material quantities = gross floor area × editable material-intensity assumptions selected by structural system.
- Embodied estimate = Σ(material quantity × A1–A3 proxy factor).
- Annual energy uses the editable electricity input. The starting estimate is floor area × city energy intensity × building-type factor.
- Operational estimate = annual electricity × city grid factor × study years.
- Prototype lifecycle estimate = embodied + operational carbon.
- Shading, solar and lower-carbon concrete options show simple illustrative scenario changes. Users can enter project costs; mix candidates are shown but remain unscored without product data.
- Sensitivity band is a simple ±25% demo range. The 0–100 index is a transparent prototype mapping, not a rating system.

## Data quality and limits

Every numeric material factor, quantity intensity, city energy intensity, city grid factor, and intervention effect is illustrative, unverified, and low-confidence. Records in `material-database.js` include boundary, region, year, source label, applicability, manufacturer and EPD status. These demo values are not authoritative Indian EPD/LCA data. Replace them with traceable project or supplier data and state the applicable system boundary before using the results for real decisions.

The simplified lifecycle estimate includes A1–A3 and B6 only. It does not calculate transport, construction, maintenance, replacements, end of life, renewable export credits, structural eligibility, or engineering performance. M30 candidates require supplier-specific EPD/factors and project engineer validation; no universal GGBS limit is applied. The BEE ECSBC link is methodology context only; the prototype makes no compliance claim.

## Files

- `index.html` — app structure and report view
- `styles.css`, `analysis.css` — interface styles
- `app.js` — demo calculator, comparisons, score and print report
- `material-database.js` — structured prototype assumptions and mix candidates
- `calculation-engine.js` — retained audit engine reference, not loaded by this MVP UI