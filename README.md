# Carbonwise prototype

A hackathon MVP for building inputs, a partial A1–A3 product-stage estimate, and lifecycle data entry. Whole-life totals and intervention reductions remain unavailable until complete, compatible, sourced module data is supplied.

## Run locally

Open `index.html` in a browser, or serve the folder with a static HTTP server. The demo uses plain HTML, CSS and JavaScript so there is no build step.

## What it calculates

- Gross floor area = floor plate × floors.
- Material quantities = gross floor area × editable material-intensity assumptions selected by structural system.
- Product-stage estimate = Σ(material quantity × illustrative A1–A3 proxy factor).
- Operational results require a sourced factor record with compatible units and are not fabricated from location assumptions.
- Shading, solar and lower-carbon concrete remain visible but unscored until their actual inputs and added impacts are modeled. Mix candidates remain unscored without compatible product data.
- No combined whole-life total or carbon intensity is shown when required modules, area, or compatible factors are missing.

## Data quality and limits

Every numeric material factor, quantity intensity, city energy intensity, and city grid factor is illustrative, unverified, and low-confidence. Source labels and URLs are leads for review and do not establish independent verification. These demo values are not authoritative Indian EPD/LCA data. Replace them with traceable project or supplier data and state the applicable system boundary before real-building decisions.

The bundled data can support a partial illustrative A1–A3 subtotal. It does not include the sourced electricity-factor registry or project data needed to score B6, A4–A5, B1–B5, or C1–C4. M30 candidates require supplier-specific EPD/factors and project engineer validation; no universal GGBS limit is applied. The BEE ECSBC link is methodology context only; the prototype makes no compliance claim.

## Files

- `index.html` — app structure and report view
- `styles.css`, `analysis.css` — interface styles
- `app.js` — demo calculator, comparisons, score and print report
- `material-database.js` — structured prototype assumptions and mix candidates
- `calculation-engine.js` — calculation engine loaded by the MVP UI
