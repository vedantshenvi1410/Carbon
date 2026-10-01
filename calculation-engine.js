/* Pure, auditable WLCA calculations. No defaults are substituted for missing project data. */
(function (root) {
  'use strict';

  const REQUIRED_MODULES = ['A1–A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'C1', 'C2', 'C3', 'C4'];
  const isNum = value => Number.isFinite(value) && value >= 0;
  const hasText = value => typeof value === 'string' && value.trim().length > 0;
  const hasUrl = value => { try { const parsed = new URL(value); return parsed.protocol === 'https:' || parsed.protocol === 'http:'; } catch { return false; } };
  const nullableNumber = value => value === '' || value == null ? null : Number(value);

  function sourcedAmount(record) {
    const amount = nullableNumber(record?.amount);
    return { value: isNum(amount) && hasText(record?.source) ? amount : null, amount, source: record?.source || '' };
  }

  function calculate(input, data) {
    const period = nullableNumber(input.studyPeriod);
    const floorPlate = nullableNumber(input.floorPlate);
    const floors = nullableNumber(input.floors);
    const area = isNum(floorPlate) && floorPlate > 0 && Number.isInteger(floors) && floors > 0 ? floorPlate * floors : null;
    const errors = [];
    const checks = [];
    const materials = input.materials || [];
    let materialTotal = 0;
    let materialComplete = materials.length > 0;
    const materialLines = materials.map(line => {
      const quantity = nullableNumber(line.quantity);
      const factor = nullableNumber(line.factor);
      const factorUnit = line.factorUnit || '';
      const module = line.module || '';
      const factorYear = nullableNumber(line.factorYear);
      const quantityEvidenceOk = hasText(line.quantitySource) && hasText(line.quantityEvidence);
      const factorEvidenceOk = isNum(factor) && hasUrl(line.source) && hasText(line.geography) && Number.isInteger(factorYear) && factorYear >= 1900 && hasText(line.dataQuality);
      const unitOk = factorUnit === 'kgCO2e/kg' && module === 'A1–A3';
      const complete = isNum(quantity) && quantityEvidenceOk && (quantity === 0 || (factorEvidenceOk && unitOk));
      const carbon = complete ? quantity * factor : null;
      if (!complete) materialComplete = false;
      else materialTotal += carbon;
      return { name: line.name, quantity, quantityUnit: line.quantityUnit || 'kg', quantitySource: line.quantitySource || '', quantityEvidence: line.quantityEvidence || '', factor, factorUnit, factorYear, module, source: line.source || '', geography: line.geography || '', dataQuality: line.dataQuality || '', carbon, complete };
    });

    const moduleRecords = input.modules || {};
    const modules = Object.create(null);
    modules['A1–A3'] = { value: materialComplete ? materialTotal : null, formula: 'Σ(quantity kg × A1–A3 factor kgCO₂e/kg)', source: 'Product / project records on each material line', complete: materialComplete };

    const transport = input.transport || {};
    const transportMass = nullableNumber(transport.massKg);
    const transportDistance = nullableNumber(transport.distanceKm);
    const outwardFactor = nullableNumber(transport.outwardFactor);
    const returnFactor = nullableNumber(transport.returnFactor);
    const transportComplete = [transportMass, transportDistance, outwardFactor, returnFactor].every(isNum) && hasUrl(transport.routeSource) && hasUrl(transport.factorSource);
    modules.A4 = {
      value: transportComplete ? (transportMass / 1000) * transportDistance * (outwardFactor + 0.5 * returnFactor) : null,
      formula: '(mass kg ÷ 1,000) × distance km × (outward kgCO₂e/t·km + 0.5 × return kgCO₂e/t·km)',
      source: [transport.routeSource, transport.factorSource].filter(Boolean).join('; '), complete: transportComplete
    };

    const construction = input.construction || {};
    const constructionElectricity = nullableNumber(construction.electricityKwh);
    const constructionElectricityFactor = nullableNumber(construction.electricityFactor);
    const constructionFuel = nullableNumber(construction.fuelQuantity);
    const constructionFuelFactor = nullableNumber(construction.fuelFactor);
    const constructionOther = nullableNumber(construction.otherCarbon);
    const constructionElectricityOk = isNum(constructionElectricity) && hasUrl(construction.electricitySource) && (constructionElectricity === 0 || (isNum(constructionElectricityFactor) && hasUrl(construction.electricityFactorSource)));
    const constructionFuelOk = isNum(constructionFuel) && hasUrl(construction.fuelSource) && (constructionFuel === 0 || (isNum(constructionFuelFactor) && hasUrl(construction.fuelFactorSource) && hasText(construction.fuelUnit)));
    const constructionOtherOk = isNum(constructionOther) && hasText(construction.otherSource);
    const constructionComplete = constructionElectricityOk && constructionFuelOk && constructionOtherOk;
    modules.A5 = {
      value: constructionComplete ? constructionElectricity * constructionElectricityFactor + constructionFuel * (constructionFuelFactor || 0) + constructionOther : null,
      formula: 'site electricity kWh × sourced factor + fuel quantity × sourced factor + sourced construction waste / other A5 total',
      source: [construction.electricitySource, construction.electricityFactorSource, construction.fuelSource, construction.fuelFactorSource, construction.otherSource].filter(Boolean).join('; '), complete: constructionComplete
    };

    for (const code of ['B1', 'B2', 'B3', 'B5', 'C1', 'C2', 'C3', 'C4']) {
      const record = sourcedAmount(moduleRecords[code]);
      modules[code] = { value: record.value, formula: 'User-supplied module total (kgCO₂e)', source: record.source, complete: record.value != null };
    }

    const replacements = input.replacements || {};
    const replacementRows = replacements.rows || [];
    let replacementComplete = Boolean(replacements.confirmNone) || replacementRows.length > 0;
    let replacementTotal = replacements.confirmNone ? 0 : 0;
    const replacementLines = replacementRows.map(row => {
      const quantity = nullableNumber(row.quantity);
      const serviceLife = nullableNumber(row.serviceLife);
      const initialYear = nullableNumber(row.initialYear ?? 0);
      const factor = nullableNumber(row.factor);
      const valid = isNum(quantity) && isNum(serviceLife) && serviceLife > 0 && isNum(initialYear) && isNum(factor) && hasUrl(row.source) && hasUrl(row.serviceLifeSource) && hasText(row.quantitySource) && hasText(row.quantityEvidence) && hasText(row.dataQuality);
      const years = valid ? Array.from({ length: Math.floor(Math.max(0, period - initialYear) / serviceLife) }, (_, i) => initialYear + serviceLife * (i + 1)).filter(year => year <= period) : [];
      const replacementsCount = years.length;
      const carbon = valid ? quantity * factor * replacementsCount : null;
      if (!valid) replacementComplete = false;
      else replacementTotal += carbon;
      return { name: row.name || 'Component', quantity, serviceLife, initialYear, factor, replacements: replacementsCount, years, carbon, source: [row.source, row.serviceLifeSource].filter(Boolean).join('; '), quantitySource: row.quantitySource || '', quantityEvidence: row.quantityEvidence || '', dataQuality: row.dataQuality || '', complete: valid };
    });
    if (replacementRows.length === 0 && !replacements.confirmNone) replacementComplete = false;
    modules.B4 = { value: replacementComplete ? replacementTotal : null, formula: 'Σ(quantity × replacement factor × floor((study period − installation year) ÷ service life))', source: replacementLines.map(line => line.source).filter(Boolean).join('; '), complete: replacementComplete };

    const energy = input.energy || {};
    const annualKwh = nullableNumber(energy.annualKwh);
    const annualFuel = nullableNumber(energy.annualFuel);
    const annualFuelFactor = nullableNumber(energy.fuelFactor);
    const annualFuelInputComplete = isNum(annualFuel) && hasUrl(energy.fuelSource) && (annualFuel === 0 || (isNum(annualFuelFactor) && hasText(energy.fuelUnit) && hasUrl(energy.fuelFactorSource)));
    const gridKey = energy.gridFactorId;
    const gridRecord = gridKey === 'custom'
      ? { value: nullableNumber(energy.customFactor), unit: energy.customUnit, region: energy.customRegion, boundary: energy.customBoundary, source: energy.customSource, url: energy.customSource, publicationYear: nullableNumber(energy.customYear), status: energy.customTemporal, metricUnit: energy.customUnit, includesTransmissionDistributionLosses: energy.customLosses === 'yes' ? true : energy.customLosses === 'no' ? false : null, lossNote: energy.customLosses === 'unknown' ? 'Transmission/distribution losses not identified.' : '' }
      : data.electricityFactors[gridKey];
    const energyUseComplete = isNum(annualKwh) && gridRecord && isNum(gridRecord.value) && hasUrl(gridRecord.url) && hasText(energy.quality) && hasUrl(energy.consumptionSource) && annualFuelInputComplete && (gridKey !== 'custom' || (gridRecord.metricUnit === 'kgCO2e/kWh' && Number.isInteger(gridRecord.publicationYear) && gridRecord.publicationYear >= 1900 && hasText(gridRecord.status) && hasText(gridRecord.region) && hasText(gridRecord.boundary))) && !(gridKey !== 'custom' && annualFuel > 0);
    const scenarios = Object.create(null);
    const currentFactor = gridRecord?.value ?? null;
    if (energyUseComplete) {
      const annualFuelCarbon = annualFuel * (annualFuelFactor || 0);
      scenarios.constant = operationalSeries(annualKwh, currentFactor, 0, period, annualFuelCarbon);
      const moderateRate = nullableNumber(energy.moderateAnnualReduction);
      const highRate = nullableNumber(energy.highAnnualReduction);
      scenarios.moderate = isNum(moderateRate) && moderateRate < 1 ? operationalSeries(annualKwh, currentFactor, moderateRate, period, annualFuelCarbon) : null;
      scenarios.high = isNum(highRate) && highRate < 1 ? operationalSeries(annualKwh, currentFactor, highRate, period, annualFuelCarbon) : null;
    } else {
      scenarios.constant = scenarios.moderate = scenarios.high = null;
    }
    const selectedScenario = input.selectedScenario || 'constant';
    const selectedSeries = scenarios[selectedScenario];
    modules.B6 = {
      value: selectedSeries?.total ?? null,
      formula: `Σ((year n electricity kWh × year n grid factor ${gridRecord?.metricUnit || 'kgCO₂/kWh'}) + annual fuel use × sourced fuel factor)`,
      source: [gridRecord?.source, energy.consumptionSource, energy.fuelSource, energy.fuelFactorSource].filter(Boolean).join('; '), complete: selectedSeries != null, metricUnit: gridKey !== 'custom' && annualFuel > 0 ? 'incompatible' : gridRecord?.metricUnit || 'kgCO2/kWh', wholeLifeCompatible: gridRecord?.metricUnit === 'kgCO2e/kWh',
      annualEnergyAssumption: 'Annual electricity and fuel consumption are held constant for every study year.',
      gridRecord, series: selectedSeries
    };

    for (const code of REQUIRED_MODULES) {
      const mod = modules[code];
      if (!mod.complete) errors.push(`${code} is incomplete: enter the required value(s) and source, or explicitly confirm zero where applicable.`);
    }
    if (gridKey !== 'custom' && annualFuel > 0) errors.push('The CEA electricity factor is CO₂-only while the fuel factor is entered as CO₂e; these units cannot be combined. Supply a compatible sourced kgCO₂e/kWh grid factor.');
    if (modules.B6.complete && !modules.B6.wholeLifeCompatible) errors.push('The CEA factor is CO₂-only; it can produce a separate B6 CO₂ result when no fuel is included, but cannot be summed into a CO₂e whole-life total. Supply a sourced kgCO₂e/kWh factor to complete the WLCA.');
    if (!Number.isInteger(period) || period <= 0) errors.push('Study period must be a positive whole number of years.');
    if (area == null) errors.push('Gross floor area cannot be calculated from the current floor plate and floor count.');

    const embodiedCodes = REQUIRED_MODULES.filter(code => code !== 'B6');
    const embodiedComplete = embodiedCodes.every(code => modules[code].complete);
    const embodied = embodiedComplete ? embodiedCodes.reduce((sum, code) => sum + modules[code].value, 0) : null;
    const operational = modules.B6.value;
    const modulesAvailable = REQUIRED_MODULES.every(code => modules[code].complete);
    const wholeLifeComplete = modulesAvailable && modules.B6.wholeLifeCompatible;
    const baselineComplete = embodiedComplete && Boolean(scenarios.constant) && modules.B6.wholeLifeCompatible;
    const constantBaselineWholeLife = baselineComplete ? embodied + scenarios.constant.total : null;
    for (const [name, series] of Object.entries(scenarios)) {
      if (!series) continue;
      series.wholeLife = embodiedComplete && modules.B6.wholeLifeCompatible ? embodied + series.total : null;
      series.reduction = constantBaselineWholeLife != null && series.wholeLife != null ? constantBaselineWholeLife - series.wholeLife : null;
      series.reductionPercent = series.reduction != null && constantBaselineWholeLife !== 0 ? series.reduction / constantBaselineWholeLife * 100 : null;
      series.relativeB6Percent = series.total != null && scenarios.constant?.total ? series.total / scenarios.constant.total * 100 : null;
    }
    const wholeLife = selectedSeries?.wholeLife ?? null;
    const d = sourcedAmount(moduleRecords.D);
    modules.D = { value: d.value, formula: 'User-supplied Module D total (kgCO₂e); reported separately', source: d.source, complete: d.value != null };

    const baseline = { selectedScenario: 'constant', embodied, operational: scenarios.constant?.total ?? null, wholeLife: constantBaselineWholeLife, complete: constantBaselineWholeLife != null };
    const selected = { selectedScenario, embodied, operational: selectedSeries?.total ?? null, wholeLife, reduction: selectedSeries?.reduction ?? null, reductionPercent: selectedSeries?.reductionPercent ?? null, complete: wholeLife != null };
    const delta = selected.reduction;
    const reductionPercent = selected.reductionPercent;
    const shares = wholeLife != null && wholeLife !== 0 ? { embodiedPercent: embodied / wholeLife * 100, operationalPercent: selected.operational / wholeLife * 100 } : null;
    const baselineShares = baseline.wholeLife != null && baseline.wholeLife !== 0 ? { embodiedPercent: embodied / baseline.wholeLife * 100, operationalPercent: baseline.operational / baseline.wholeLife * 100 } : null;
    const carbonIntensity = wholeLife != null && area != null && area > 0 ? wholeLife / area : null;
    const baselineCarbonIntensity = baseline.wholeLife != null && area != null && area > 0 ? baseline.wholeLife / area : null;
    const materialShares = modules['A1–A3'].value != null && modules['A1–A3'].value !== 0 ? Object.fromEntries(materialLines.map(line => [line.name, line.carbon == null ? null : line.carbon / modules['A1–A3'].value * 100])) : null;
    const moduleShares = wholeLife != null && wholeLife !== 0 ? Object.fromEntries(REQUIRED_MODULES.map(code => [code, modules[code].value / wholeLife * 100])) : null;
    const budgetComparison = input.carbonBudget != null && selected.wholeLife != null ? { targetKg: Number(input.carbonBudget) * 1000, differenceKg: selected.wholeLife - Number(input.carbonBudget) * 1000, within: selected.wholeLife <= Number(input.carbonBudget) * 1000 } : null;

    checks.push({ name: 'Study period', pass: Number.isInteger(period) && period > 0, detail: `${period == null ? 'Missing' : Number.isInteger(period) ? period : 'Invalid'} years; all lifetime calculations use the study period field.` });
    checks.push({ name: 'Floor area', pass: area != null, detail: area == null ? 'Area incomplete.' : `${floorPlate} m² × ${floors} floors = ${area} m² GFA.` });
    checks.push({ name: 'Material quantities', pass: materialLines.every(x => isNum(x.quantity) && hasText(x.quantitySource) && hasText(x.quantityEvidence)), detail: `${materialLines.filter(x => isNum(x.quantity) && hasText(x.quantitySource) && hasText(x.quantityEvidence)).length}/${materialLines.length} quantities include a provenance tag and supporting record/calculation.` });
    checks.push({ name: 'Unit consistency', pass: materialLines.every(x => x.factor == null || (x.quantityUnit === 'kg' && x.factorUnit === 'kgCO2e/kg' && x.module === 'A1–A3')), detail: 'Material quantities use kg; product factors use kgCO₂e/kg and must cover A1–A3.' });
    checks.push({ name: 'Emission-factor source availability', pass: materialLines.filter(x => x.factor != null).every(x => hasUrl(x.source) && hasText(x.geography) && Number.isInteger(x.factorYear) && x.factorYear >= 1900 && hasText(x.dataQuality)), detail: 'Entered material factors require a source URL, publication year, geography and data-quality class; A4/A5 and B6 source records are checked separately.' });
    checks.push({ name: 'A1–A3 / A4 / A5 boundary', pass: modules['A1–A3'].complete ? modules['A1–A3'].value != null && modules.A4.formula.startsWith('(mass') && modules.A5.formula.startsWith('site electricity') : null, detail: 'A1–A3, A4 and A5 are calculated and reported as separate modules. No A1–A3-only result is labeled A1–A5.' });
    checks.push({ name: 'Embodied arithmetic', pass: embodiedComplete ? Number.isFinite(embodied) : null, detail: embodiedComplete ? `A1–A3 + A4 + A5 + B1–B5 + C1–C4 = ${embodied} kgCO₂e.` : 'Not calculated until each required embodied module is complete.' });
    checks.push({ name: 'Operational arithmetic', pass: operational != null ? Number.isFinite(operational) : null, detail: operational != null ? `Selected B6 series = ${operational} ${modules.B6.metricUnit === 'kgCO2e/kWh' ? 'kgCO₂e' : 'kgCO₂'} over ${period} years; annual electricity and fuel use are held constant.` : 'Not calculated until annual electricity and fuel use, sources, provenance and study period are provided with compatible units.' });
    checks.push({ name: 'Whole-life total', pass: wholeLifeComplete ? Number.isFinite(wholeLife) : null, detail: wholeLifeComplete ? `A1–A5 + B1–B6 + C1–C4 = ${wholeLife} kgCO₂e; Module D excluded.` : 'Not calculated; one or more required A–C modules are missing.' });
    checks.push({ name: 'Embodied / operational shares', pass: shares ? close(shares.embodiedPercent + shares.operationalPercent, 100, 0.1) : null, detail: shares ? 'Both shares are generated from the selected whole-life total; D is excluded.' : 'Shares are unavailable until the full A–C total is calculable.' });
    checks.push({ name: 'Embodied share', pass: shares ? close(shares.embodiedPercent, embodied / wholeLife * 100, 0.000001) : null, detail: shares ? `${shares.embodiedPercent}% = non-B6 A–C modules ÷ selected whole-life total.` : 'Not calculated until a compatible CO₂e whole-life total is available.' });
    checks.push({ name: 'Operational share', pass: shares ? close(shares.operationalPercent, selected.operational / wholeLife * 100, 0.000001) : null, detail: shares ? `${shares.operationalPercent}% = B6 ÷ selected whole-life total.` : 'Not calculated until a compatible CO₂e whole-life total is available.' });
    checks.push({ name: 'Scenario reduction', pass: reductionPercent != null ? Number.isFinite(reductionPercent) : null, detail: reductionPercent != null ? `Baseline − selected = ${delta} kgCO₂e; reduction ${reductionPercent}%.` : 'No reduction shown until baseline and selected scenario are both complete.' });
    checks.push({ name: 'Replacement schedule', pass: modules.B4.complete, detail: replacementLines.length ? replacementLines.map(line => `${line.name}: ${line.replacements} replacement(s) at ${line.years.join(', ') || 'none in period'}`).join('; ') : replacements.confirmNone ? 'User confirmed no B4 replacements.' : 'No sourced component service-life schedule or zero confirmation provided.' });
    checks.push({ name: 'Grid factor', pass: Boolean(gridRecord?.url) && (gridKey !== 'custom' || (gridRecord.metricUnit === 'kgCO2e/kWh' && Number.isInteger(gridRecord.publicationYear) && hasText(gridRecord.status) && hasText(gridRecord.region) && hasText(gridRecord.boundary))), detail: gridRecord ? `${gridRecord.value} ${gridRecord.metricUnit || gridRecord.unit}; ${gridRecord.status || 'publication year / time status required'}; ${gridRecord.lossNote || (gridRecord.includesTransmissionDistributionLosses == null ? 'T&D-loss treatment is not documented.' : `T&D losses ${gridRecord.includesTransmissionDistributionLosses ? 'included' : 'excluded'}.`)}` : 'Grid factor source missing.' });
    checks.push({ name: 'End of life', pass: ['C1', 'C2', 'C3', 'C4'].every(code => modules[code].complete), detail: 'C1–C4 are explicit, separate module records.' });

    return {
      inputs: { ...input, grossFloorArea: area },
      studyPeriod: period,
      grossFloorArea: area,
      materialLines,
      replacementLines,
      modules,
      embodied,
      operational,
      wholeLife,
      moduleD: d.value,
      baseline,
      scenarios,
      selected,
      shares,
      baselineShares,
      carbonIntensity,
      baselineCarbonIntensity,
      materialShares,
      moduleShares,
      budgetComparison,
      reduction: delta,
      reductionPercent,
      complete: wholeLifeComplete,
      modulesAvailable,
      errors,
      checks
    };
  }

  function operationalSeries(annualKwh, firstYearFactor, annualReduction, period, annualFuelCarbon = 0) {
    if (!Number.isInteger(period) || period <= 0) return null;
    const annual = [];
    for (let year = 1; year <= period; year++) {
      const factor = firstYearFactor * Math.pow(1 - annualReduction, year - 1);
      annual.push({ year, energyKwh: annualKwh, factorKgPerKwh: factor, fuelCarbonKg: annualFuelCarbon, carbonKg: annualKwh * factor + annualFuelCarbon });
    }
    return { total: annual.reduce((sum, row) => sum + row.carbonKg, 0), annual };
  }

  function close(a, b, tolerance) { return Math.abs(a - b) <= tolerance; }
  const api = { REQUIRED_MODULES, calculate, operationalSeries };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CARBONWISE_ENGINE = api;
})(typeof window !== 'undefined' ? window : globalThis);
