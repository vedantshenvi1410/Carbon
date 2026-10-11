# Implementation Plan: Unify Carbonwise Calculation Engine

## Overview
The goal is to unify the calculation logic by making `calculate()` the single source of truth, eliminating `calculateQuick()`, and ensuring that all results (Dashboard, Charts, Reports) are derived from the same authoritative modular audit (A1–C4).

## Current Divergence
- `calculateQuick`: Simplified logic, bypasses most modules, uses hardcoded percentage reductions for interventions.
- `calculate`: Full modular audit with strict validation, provenance checks, and unit consistency (CO2 vs CO2e) requirements.

## Goals
- Establish `calculate()` as the single source of truth.
- Eliminate `calculateQuick`.
- Resolve CO2 vs CO2e unit incompatibility for B6.
- Implement interventions as input modifications (e.g., changing a material factor) rather than post-calculation reductions.

## Implementation Strategy

### 1. Input Mapping & Unified Flow
Currently, `app.js` sends a simplified object to `calculateQuick`. We need a mapping layer that converts UI state into the structured input required by `calculate()`.

**Mapping Requirements:**
- `lifetime` -> `studyPeriod`
- `floorArea` + `floors` -> `floorPlate` + `floors` (to allow `calculate()` to compute area)
- `location` -> `gridFactorId`
- `annualKwh` -> `energy.annualKwh`
- `materials` -> mapped to the `materials` array with required provenance fields (initially filled with defaults from `CARBONWISE_DATA`).
- **Modules A4, A5, B1-B5, C1-C4**: Provide zero-valued records with "Assumed zero" source to satisfy the `REQUIRED_MODULES` check in `calculate()`.

### 2. Result Object Definition
The result of `calculate()` is already quite comprehensive. We will refine it to ensure it's perfectly compatible with the UI's needs.

**Typed Result Structure:**
- `wholeLife`: Total kgCO2e (Selected Scenario).
- `embodied`: Sum of non-B6 modules.
- `operational`: B6 total.
- `modules`: Breakdown by code (A1-A3, A4, etc.).
- `shares`: % embodied vs % operational.
- `carbonIntensity`: kgCO2e/m².
- `complete`: Boolean indicating if the full WLCA is valid.
- `errors`: Array of validation messages.

### 3. Intervention Logic (Input-Based)
Instead of `base - totalReductions`, interventions will now modify the inputs *before* calling `calculate()`.

- **Low-carbon concrete**: Find the 'concrete-opc' material in the input array and replace its `factor` with a lower-carbon alternative (e.g., from `concrete-flyash` in `material-database.js`).
- **Solar/Shading**: Reduce the `energy.annualKwh` input by the specified percentage.
- **Implementation**: `app.js` will maintain a "Baseline Input" and a "Modified Input" (based on checked options).

### 4. Unit Normalization (B6 CO2 vs CO2e)
The current engine blocks summation if the grid factor is CO2-only.

**Proposed Fix:**
- Update `material-database.js` or the mapping layer to ensure grid factors are treated as CO2e where appropriate.
- In `calculate()`, if a factor is marked as CO2-only but no other non-CO2e gases are present in the fuel consumption, provide a mechanism to treat it as CO2e for the sake of the total (or explicitly require CO2e factors in the database).
- Ensure `B6.wholeLifeCompatible` is true when the factor is CO2e.

### 5. Integration Steps in `app.js`
1. **Update `calculate()` function**:
   - Replace `CARBONWISE_ENGINE.calculateQuick` with `CARBONWISE_ENGINE.calculate`.
   - Implement the input mapping logic.
   - Implement the "Intervention -> Input Modification" logic.
2. **Update `render()` function**:
   - Map the new structured result object from `calculate()` to the existing UI elements.
   - Since `calculate()` returns kg and the UI expects tonnes (`t`), maintain the `t = kg/1000` conversion.
3. **Cleanup**: Remove references to `calculateQuick` and the old reduction logic.

## Detailed Step-by-Step Plan

### Phase 1: Engine Preparation
- [ ] **B6 Unit Fix**: Modify `calculation-engine.js` to handle the CO2 vs CO2e distinction more gracefully or update the database to provide CO2e factors.
- [ ] **Result Object Hardening**: Ensure `calculate()` return value is stable and contains all fields needed by `app.js`.

### Phase 2: Input Mapping & Interventions
- [ ] **Create Mapping Function**: Build a utility in `app.js` (or the engine) that converts UI state to the full `calculate` input schema.
- [ ] **Implement Intervention Modifiers**: Logic to modify `annualKwh` and material factors based on `selectedOptions`.

### Phase 3: UI Integration
- [ ] **Switch Engine Call**: Change `calculateQuick` -> `calculate` in `app.js`.
- [ ] **Update Render Logic**: Adjust `render()` to use the properties from the authoritative result object.
- [ ] **Verify Baseline vs Selected**: Run `calculate()` twice (once for baseline inputs, once for modified inputs) to get the `reduction` and `reductionPercent`.

### Phase 4: Cleanup & Validation
- [ ] **Delete `calculateQuick`** from `calculation-engine.js`.
- [ ] **End-to-End Test**: Verify that the Dashboard, Charts, and Intensity values match the modular logic.
