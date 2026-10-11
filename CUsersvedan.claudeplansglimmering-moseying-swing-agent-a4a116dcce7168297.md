# Implementation Plan: Carbonwise Calculation Engine Unification

## 1. Overview
Unify the divergent calculation paths in the Carbonwise engine by establishing `calculate()` as the single source of truth. Eliminate `calculateQuick()` and replace it with a unified flow that maps simplified UI inputs to a rigorous modular WLCA structure.

## 2. Strategy: Replacing `calculateQuick`
Instead of having two functions, `app.js` will now prepare a structured `detailedInput` object based on the current UI state and pass it to `CARBONWISE_ENGINE.calculate()`.

### Input Mapping Logic
The "Quick" inputs will be mapped to the modular format as follows:
- **Study Period**: `lifetime` $\rightarrow$ `studyPeriod`
- **Area**: `floorArea` $\times$ `floors` $\rightarrow$ `floorPlate` & `floors`
- **Materials**: `materials` array $\rightarrow$ `materials` array (mapping `quantity` and `factor` while providing default provenance strings for prototype mode).
- **Energy**: `annualKwh` $\rightarrow$ `energy.annualKwh`.
- **Grid Factor**: `location` $\rightarrow$ `energy.gridFactorId`.
- **Defaults**: For the "Quick" experience, modules A4, A5, B1-B5, and C1-C4 will be initialized with `amount: 0` and `source: 'Prototype assumption (zero)'` to satisfy the rigorous validation of `calculate()`.

## 3. Structured Result Object
The `calculate()` function will be updated to return a consistent, typed object that the UI can rely on.

### Result Schema:
```typescript
{
  totalWholeLife: number | null,      // Sum of A1-C4
  totalEmbodied: number | null,      // Sum of A1-C4 excluding B6
  totalOperational: number | null,   // B6 result
  moduleBreakdown: {
    [moduleCode: string]: {
      value: number | null,
      complete: boolean,
      formula: string,
      source: string
    }
  },
  materialBreakdown: Array<{
    name: string,
    carbon: number | null,
    complete: boolean
  }>,
  validation: {
    isComplete: boolean,
    errors: string[],
    checks: Array<{ name: string, pass: boolean, detail: string }>
  },
  baseline: {
    wholeLife: number | null,
    operational: number | null
  },
  reduction: {
    absolute: number | null,
    percent: number | null
  }
}
```

## 4. Unit Normalization (CO2 vs CO2e)
### The Problem
Current India grid factors in `material-database.js` (e.g., `0.727`) are treated as $\text{kgCO}_2/\text{kWh}$, while other modules use $\text{kgCO}_2\text{e}$. This prevents summation.

### The Fix
1. **Database Update**: Update `CARBONWISE_DATA.locationAssumptions` to include explicit units and GWP (Global Warming Potential) factors if available, or standardize all factors to $\text{kgCO}_2\text{e}$ by applying a conversion constant.
2. **Engine Logic**: 
   - In `calculate()`, check the `metricUnit` of the grid factor.
   - If `metricUnit === 'kgCO2/kWh'`, multiply by a standard GWP factor (or flag as incompatible if mixed with other non-CO2 GHGs in fuel).
   - Update the B6 calculation to strictly enforce `kgCO2e` for whole-life summation.

## 5. Intervention Logic
Interventions will move from "post-calculation percentage reductions" to "pre-calculation input modifications".

### Implementation Mechanism:
- **Concrete Interventions**: If "Lower-carbon concrete" is selected, the input mapper in `app.js` will find the `concrete-opc` material line and replace its `factor` with the factor of a lower-carbon alternative (e.g., `concrete-flyash`) from `material-database.js`.
- **Energy Interventions**: 
    - **Shading**: Reduce the `annualKwh` input by the shading saving percentage (e.g., $8\%$) *before* calling `calculate()`.
    - **Solar**: Subtract the solar offset (calculated as $\text{annualKwh} \times \text{saving\%}$) from the `annualKwh` passed to the engine.

## 6. Integration Plan for `app.js`
To avoid breaking UX, the update will follow these steps:
1. **Update `calculate()`**: Modify the engine to return the new structured result object.
2. **Modify `app.js.calculate()`**:
   - Implement the mapping logic described in Section 2.
   - Apply interventions as input modifications (Section 5).
   - Call `CARBONWISE_ENGINE.calculate(detailedInput, data)`.
3. **Update `app.js.render()`**:
   - Map the new structured result object to the existing DOM elements.
   - Since `calculate()` returns more detailed data (errors, checks), add a small UI indicator for "Validation Status" (e.g., a "Complete/Incomplete" badge).

## 7. Step-by-Step Execution Sequence
1. **Phase 1: Engine Hardening**
   - Modify `calculation-engine.js` to standardize the return object.
   - Implement the CO2 $\rightarrow$ CO2e normalization in B6 logic.
2. **Phase 2: Input Mapping & Interventions**
   - Create a helper function `mapQuickToDetailed(uiInput, data)` in `app.js`.
   - Implement the intervention modification logic within this helper.
3. **Phase 3: UI Integration**
   - Update `app.js` to call the new flow.
   - Refactor `render()` to use the new result schema.
4. **Phase 4: Cleanup**
   - Delete `calculateQuick` from `calculation-engine.js`.
   - Remove outdated reduction logic from `app.js`.

### Critical Files for Implementation
- `calculation-engine.js`
- `app.js`
- `material-database.js`
EOF`
