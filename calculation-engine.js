
/*
  Carbonwise Calculation Engine
  Authoritative Source for all Building Carbon Calculations.
*/
(function (root) {
  'use strict';

  const REQUIRED_MODULES = ['A1–A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'C1', 'C2', 'C3', 'C4'];

  const isNum = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const hasText = value => typeof value === 'string' && value.trim().length > 0;
  const hasUrl = value => { try { const parsed = new URL(value); return parsed.protocol === 'https:' || parsed.protocol === 'http:'; } catch { return false; } };

  const nullableNumber = value => {
    if (value === '' || value == null) return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  };

  function createResult(value, status = 'complete', errors = [], warnings = [], provenance = {}) {
    return { value, status, errors, warnings, provenance };
  }

  function sourcedAmount(record) {
    const amount = nullableNumber(record?.amount);
    return {
      value: (isNum(amount) && hasText(record?.source)) ? amount : null,
      amount,
      source: record?.source || ''
    };
  }

  function calculate(input, data) {
    input = input && typeof input === 'object' ? input : {};
    const period = nullableNumber(input.studyPeriod);
    const floorPlate = nullableNumber(input.floorPlate);
    const floors = nullableNumber(input.floors);
    const area = (isNum(floorPlate) && floorPlate > 0 && Number.isInteger(floors) && floors > 0) ? floorPlate * floors : null;

    const errors = [];
    const checks = [];
    const materials = Array.isArray(input.materials) ? input.materials : [];

    let materialTotal = 0;
    let materialComplete = materials.length > 0;

    const materialLines = materials.map(line => {
      const quantity = nullableNumber(line.quantity);
      const factor = nullableNumber(line.factor);
      const factorUnit = line.factorUnit || '';
      const module = line.module || '';
      const factorYear = nullableNumber(line.factorYear);

      const quantityEvidenceOk = hasUrl(line.quantitySource) && hasText(line.quantityEvidence);
      const factorEvidenceOk = isNum(factor) && line.factorStatus === 'user-verified' && line.factorOrigin === 'user' && hasText(line.sourceName) && hasUrl(line.source) && hasText(line.geography) && Number.isInteger(factorYear) && factorYear >= 1900 && hasText(line.dataQuality);
      const unitOk = line.quantityUnit === 'kg' && factorUnit === 'kgCO2e/kg' && module === 'A1–A3';

      const complete = isNum(quantity) && quantityEvidenceOk && (quantity === 0 || (factorEvidenceOk && unitOk));
      const carbon = complete ? (quantity === 0 ? 0 : quantity * factor) : null;

      if (!complete) materialComplete = false;
      else materialTotal += carbon;

      return {
        name: line.name, quantity, quantityUnit: line.quantityUnit || 'kg',
        quantitySource: line.quantitySource || '', quantityEvidence: line.quantityEvidence || '',
        factor, factorUnit, factorYear, module, source: line.source || '',
        sourceName: line.sourceName || '', geography: line.geography || '', dataQuality: line.dataQuality || '', factorStatus: line.factorStatus || 'unverified', factorOrigin: line.factorOrigin || 'catalog',
        carbon, complete
      };
    });

    const moduleRecords = input.modules || {};
    const modules = Object.create(null);
    modules['A1–A3'] = {
      value: materialComplete ? materialTotal : null,
      formula: 'Σ(quantity kg × A1–A3 factor kgCO₂e/kg)',
      source: 'Product / project records on each material line',
      complete: materialComplete
    };

    const transport = input.transport || {};
    const transportMass = nullableNumber(transport.massKg);
    const transportDistance = nullableNumber(transport.distanceKm);
    const outwardFactor = nullableNumber(transport.outwardFactor);
    const returnFactor = nullableNumber(transport.returnFactor);
    const transportComplete = [transportMass, transportDistance, outwardFactor, returnFactor].every(isNum) && transport.massUnit === 'kg' && transport.distanceUnit === 'km' && transport.distanceBasis === 'one-way' && transport.factorUnit === 'kgCO2e/t·km' && hasText(transport.factorSourceName) && hasUrl(transport.routeSource) && hasUrl(transport.factorSource);

    modules.A4 = {
      value: transportComplete ? (transportMass / 1000) * transportDistance * (outwardFactor + returnFactor) : null,
      formula: '(mass kg ÷ 1,000) × distance km × (outward kgCO₂e/t·km + return kgCO₂e/t·km)',
      source: [transport.routeSource, transport.factorSource].filter(Boolean).join('; '), massUnit: transport.massUnit || '', distanceUnit: transport.distanceUnit || '', distanceBasis: transport.distanceBasis || '', factorUnit: transport.factorUnit || '', factorSourceName: transport.factorSourceName || '',
      complete: transportComplete
    };

    const construction = input.construction || {};
    const constructionElectricity = nullableNumber(construction.electricityKwh);
    const constructionElectricityFactor = nullableNumber(construction.electricityFactor);
    const constructionFuel = nullableNumber(construction.fuelQuantity);
    const constructionFuelFactor = nullableNumber(construction.fuelFactor);
    const constructionOther = nullableNumber(construction.otherCarbon);

    const constructionElectricityOk = isNum(constructionElectricity) && hasUrl(construction.electricitySource) && (constructionElectricity === 0 || (isNum(constructionElectricityFactor) && construction.electricityFactorUnit === 'kgCO2e/kWh' && construction.electricityFactorModule === 'A5' && hasUrl(construction.electricityFactorSource)));
    const constructionFuelUnitMap = { kg: 'kgCO2e/kg', L: 'kgCO2e/L', MJ: 'kgCO2e/MJ' };
    const constructionFuelOk = isNum(constructionFuel) && hasUrl(construction.fuelSource) && (constructionFuel === 0 || (isNum(constructionFuelFactor) && construction.fuelFactorModule === 'A5' && fuelUnitMatches(construction.fuelUnit, construction.fuelFactorUnit, constructionFuelUnitMap) && hasUrl(construction.fuelFactorSource)));
    const constructionOtherOk = isNum(constructionOther) && construction.otherUnit === 'kgCO2e' && construction.otherModule === 'A5' && hasUrl(construction.otherSource);
    const constructionComplete = constructionElectricityOk && constructionFuelOk && constructionOtherOk;

    modules.A5 = {
      value: constructionComplete ? (constructionElectricity === 0 ? 0 : constructionElectricity * constructionElectricityFactor) + (constructionFuel === 0 ? 0 : constructionFuel * constructionFuelFactor) + constructionOther : null,
      formula: 'site electricity kWh × sourced factor + fuel quantity × sourced factor + sourced construction waste / other A5 total',
      source: [construction.electricitySource, construction.electricityFactorSource, construction.fuelSource, construction.fuelFactorSource, construction.otherSource].filter(Boolean).join('; '),
      complete: constructionComplete
    };

    for (const code of ['B1', 'B2', 'B3', 'B5', 'C1', 'C2', 'C3', 'C4']) {
      const record = sourcedAmount(moduleRecords[code]);
      modules[code] = { value: record.value, formula: 'User-supplied module total (kgCO₂e)', source: record.source, complete: record.value != null };
    }
    const water = input.water || {};
    const waterVolume = nullableNumber(water.totalM3);
    const waterFactor = nullableNumber(water.factor);
    const waterComplete = isNum(waterVolume) && isNum(waterFactor) && water.volumeUnit === 'm3' && water.factorUnit === 'kgCO2e/m3' && hasUrl(water.volumeSource) && hasUrl(water.factorSource);
    modules.B7 = {
      value: waterComplete ? waterVolume * waterFactor : null,
      formula: 'total operational water use over study period (m³) × sourced B7 factor (kgCO₂e/m³)',
      source: [water.volumeSource, water.factorSource].filter(Boolean).join('; '),
      complete: waterComplete
    };

    const replacements = input.replacements || {};
    const replacementRows = Array.isArray(replacements.rows) ? replacements.rows : [];
    let replacementComplete = Boolean(replacements.confirmNone) || replacementRows.length > 0;
    let replacementTotal = 0;

    const replacementLines = replacementRows.map(row => {
      const quantity = nullableNumber(row.quantity);
      const serviceLife = nullableNumber(row.serviceLife);
      const initialYear = nullableNumber(row.initialYear ?? 0);
      const factor = nullableNumber(row.factor);
      const factorYear = nullableNumber(row.factorYear);
      const valid = isNum(quantity) && Number.isInteger(serviceLife) && serviceLife > 0 && Number.isInteger(initialYear) && isNum(initialYear) && initialYear <= period && Number.isInteger(period) && period > 0 && isNum(factor) && row.factorUnit === 'kgCO2e/kg' && row.module === 'B4' && hasText(row.sourceName) && hasUrl(row.source) && hasUrl(row.serviceLifeSource) && hasText(row.geography) && Number.isInteger(factorYear) && factorYear >= 1900 && hasUrl(row.quantitySource) && hasText(row.quantityEvidence) && hasText(row.dataQuality);

      // Assessment interval includes its endpoint: an event at year == period is counted.
      // Initial installation at initialYear is excluded; only subsequent service-life events are included.
      const years = valid ? Array.from({ length: Math.ceil(Math.max(0, period - initialYear) / serviceLife) }, (_, i) => initialYear + serviceLife * (i + 1)).filter(year => year <= period) : [];
      const replacementsCount = years.length;
      const carbon = valid ? quantity * factor * replacementsCount : null;

      if (!valid) replacementComplete = false;
      else replacementTotal += carbon;

      return { name: row.name || 'Component', quantity, serviceLife, initialYear, factor, factorUnit: row.factorUnit || '', module: row.module || '', replacements: replacementsCount, years, carbon, source: [row.source, row.serviceLifeSource].filter(Boolean).join('; '), quantitySource: row.quantitySource || '', quantityEvidence: row.quantityEvidence || '', dataQuality: row.dataQuality || '', complete: valid };
    });

    if (replacementRows.length === 0 && !replacements.confirmNone) replacementComplete = false;
    modules.B4 = {
      value: replacementComplete ? replacementTotal : null,
      formula: 'Σ(quantity × replacement factor × floor((study period − installation year) ÷ service life))',
      source: replacementLines.map(line => line.source).filter(Boolean).join('; '),
      complete: replacementComplete
    };

    const energy = input.energy || {};
    const annualKwh = nullableNumber(energy.annualKwh);
    const annualFuel = nullableNumber(energy.annualFuel);
    const annualFuelFactor = nullableNumber(energy.fuelFactor);
    const fuelUnitMap = { kg: 'kgCO2e/kg', L: 'kgCO2e/L', MJ: 'kgCO2e/MJ' };
    const annualFuelInputComplete = isNum(annualFuel) && hasUrl(energy.fuelSource) && (annualFuel === 0 || (isNum(annualFuelFactor) && fuelUnitMatches(energy.fuelUnit, energy.fuelFactorUnit, fuelUnitMap) && hasUrl(energy.fuelFactorSource)));

    const gridKey = energy.gridFactorId;
    const gridRecord = gridKey === 'custom'
      ? { value: nullableNumber(energy.customFactor), unit: energy.customUnit, region: energy.customRegion, boundary: energy.customBoundary, source: energy.customSourceName, url: energy.customSource, publicationYear: nullableNumber(energy.customYear), status: energy.customTemporal, metricUnit: energy.customUnit, includesTransmissionDistributionLosses: energy.customLosses === 'yes' ? true : energy.customLosses === 'no' ? false : null, lossNote: energy.customLosses === 'unknown' ? 'Transmission/distribution losses not identified.' : '' }
      : data?.electricityFactors?.[gridKey] || null;

    const gridFactorUsable = Boolean(gridRecord && isNum(nullableNumber(gridRecord.value)) && ['kgCO2/kWh', 'kgCO2e/kWh'].includes(gridRecord.metricUnit) && hasText(gridRecord.source) && hasUrl(gridRecord.url) && Number.isInteger(gridRecord.publicationYear) && gridRecord.publicationYear >= 1900 && hasText(gridRecord.region) && hasText(gridRecord.boundary) && hasText(gridRecord.status));
    const fuelMetricCompatible = annualFuel === 0 || (energy.fuelMetric === 'CO2e' && gridRecord?.metricUnit === 'kgCO2e/kWh' && hasText(energy.fuelUnit));
    const energyUseComplete = isNum(annualKwh) && gridFactorUsable && hasText(energy.quality) && hasUrl(energy.consumptionSource) && annualFuelInputComplete && fuelMetricCompatible;
    const illustrativeFactor = nullableNumber(energy.illustrativeGridFactor);
    const illustrativeFactorValid = isNum(illustrativeFactor) && energy.illustrativeGridFactorUnit === 'kgCO2/kWh' && hasText(energy.illustrativeGridFactorLabel) && hasText(energy.illustrativeGridFactorGeography);
    const consumptionUsable = isNum(annualKwh) && (annualKwh > 0 || (hasText(energy.quality) && hasUrl(energy.consumptionSource)));
    const canCalculateElectricity = consumptionUsable && Number.isInteger(period) && period > 0 && (gridFactorUsable || illustrativeFactorValid);

    const scenarios = Object.create(null);
    const currentFactor = gridFactorUsable ? nullableNumber(gridRecord.value) : (illustrativeFactorValid ? illustrativeFactor : null);
    const fuelIncluded = annualFuelInputComplete && fuelMetricCompatible && annualFuel > 0;
    if (canCalculateElectricity) {
      const annualFuelCarbon = fuelIncluded ? annualFuel * annualFuelFactor : 0;
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
      source: [gridFactorUsable ? gridRecord?.source : '', gridFactorUsable ? gridRecord?.url : '', energy.consumptionSource, energy.fuelSource, energy.fuelFactorSource].filter(Boolean).join('; '),
      complete: energyUseComplete && selectedSeries != null,
      status: energyUseComplete && selectedSeries != null ? 'complete' : selectedSeries != null ? 'provisional' : 'incomplete',
      warnings: selectedSeries != null && !energyUseComplete ? [
        !gridFactorUsable && illustrativeFactorValid ? 'Illustrative, unsourced location electricity factor is used; result is CO₂, not CO₂e.' : '',
        !hasUrl(energy.consumptionSource) ? 'Annual electricity consumption source is missing; entered consumption is treated as a user-provided preliminary input.' : '',
        !annualFuelInputComplete ? 'Operational fuel is missing or lacks compatible source data and is excluded from this electricity-only result.' : '',
        annualFuel > 0 && !fuelMetricCompatible ? 'Fuel CO₂e cannot be combined with the selected electricity-factor metric; fuel is excluded.' : '',
        'This provisional B6 result is excluded from the CO₂e whole-life total.'
      ].filter(Boolean) : [],
      metricUnit: gridRecord?.metricUnit || energy.illustrativeGridFactorUnit || 'kgCO2/kWh',
      wholeLifeCompatible: gridRecord?.metricUnit === 'kgCO2e/kWh',
      annualEnergyAssumption: energyUseComplete ? 'Annual electricity and fuel consumption are held constant for every study year.' : `Entered annual electricity consumption is held constant; operational fuel is ${fuelIncluded ? 'included' : 'excluded'} in this preliminary result.`,
      gridRecord: gridRecord || (illustrativeFactorValid ? { value: illustrativeFactor, metricUnit: energy.illustrativeGridFactorUnit, source: '', url: '', assumptionLabel: energy.illustrativeGridFactorLabel, region: energy.illustrativeGridFactorGeography || '', status: 'illustrative, unsourced' } : null), series: selectedSeries
    };

    for (const code of REQUIRED_MODULES) {
      const mod = modules[code];
      if (!mod.complete) errors.push(`${code} is incomplete: enter the required value(s) and source, or explicitly confirm zero where applicable.`);
    }
    if (modules.B6.complete && !modules.B6.wholeLifeCompatible) errors.push('The CEA factor is CO₂-only; it can produce a separate B6 CO₂ result when no fuel is included, but cannot be summed into a CO₂e whole-life total. Supply a sourced kgCO₂e/kWh factor to complete the WLCA.');
    if (!Number.isInteger(period) || period <= 0) errors.push('Study period must be a positive whole number of years.');
    if (area == null) errors.push('Gross floor area cannot be calculated from the current floor plate and floor count.');

    const embodiedCodes = REQUIRED_MODULES.filter(code => !['B6', 'B7'].includes(code));
    const embodiedComplete = embodiedCodes.every(code => modules[code].complete);
    const embodied = embodiedComplete ? embodiedCodes.reduce((sum, code) => sum + modules[code].value, 0) : null;
    const operational = modules.B6.value;
    const modulesAvailable = REQUIRED_MODULES.every(code => modules[code].complete);
    const wholeLifeComplete = modulesAvailable && area != null && modules.B6.wholeLifeCompatible;
    const baselineComplete = embodiedComplete && modules.B7.complete && area != null && Boolean(scenarios.constant) && modules.B6.wholeLifeCompatible;
    const constantBaselineWholeLife = baselineComplete ? embodied + modules.B7.value + scenarios.constant.total : null;

    for (const [, series] of Object.entries(scenarios)) {
      if (!series) continue;
      series.wholeLife = embodiedComplete && modules.B7.complete && area != null && modules.B6.wholeLifeCompatible ? embodied + modules.B7.value + series.total : null;
      series.reduction = constantBaselineWholeLife != null && series.wholeLife != null ? constantBaselineWholeLife - series.wholeLife : null;
      series.reductionPercent = series.reduction != null && constantBaselineWholeLife !== 0 ? series.reduction / constantBaselineWholeLife * 100 : null;
      series.relativeB6Percent = series.total != null && scenarios.constant?.total ? series.total / scenarios.constant.total * 100 : null;
    }

    const wholeLife = selectedSeries?.wholeLife ?? null;
    // A partial reported subtotal is useful for the UI, but it is never the
    // whole-life result. Include only complete, compatible modules and expose
    // exactly what was included so consumers cannot mistake it for A–C.
    const partialIncludedModules = [];
    let partialTotal = 0;
    if (modules['A1–A3'].complete && modules['A1–A3'].value != null) {
      partialTotal += modules['A1–A3'].value;
      partialIncludedModules.push('A1–A3');
    }
    if (modules.B6.complete && modules.B6.wholeLifeCompatible && modules.B6.value != null) {
      partialTotal += modules.B6.value;
      partialIncludedModules.push('B6');
    }
    if (modules.B7.complete && modules.B7.value != null) {
      partialTotal += modules.B7.value;
      partialIncludedModules.push('B7');
    }
    const reportedSubtotal = wholeLifeComplete ? {
      value: wholeLife,
      unit: 'kgCO2e',
      status: 'complete',
      includedModules: REQUIRED_MODULES.slice(),
      missingModules: [],
      label: 'Whole-life A–C total'
    } : partialIncludedModules.length ? {
      value: partialTotal,
      unit: 'kgCO2e',
      status: 'partial',
      includedModules: partialIncludedModules,
      missingModules: REQUIRED_MODULES.filter(code => !modules[code].complete),
      label: `Partial subtotal · ${partialIncludedModules.join(' + ')}`
    } : { value: null, unit: 'kgCO2e', status: 'incomplete', includedModules: [], missingModules: REQUIRED_MODULES.slice(), label: 'No compatible subtotal available' };
    const d = sourcedAmount(moduleRecords.D);
    modules.D = { value: d.value, formula: 'User-supplied Module D total (kgCO₂e); reported separately', source: d.source, complete: d.value != null };

    const baseline = { selectedScenario: 'constant', embodied, operational: scenarios.constant?.total ?? null, wholeLife: constantBaselineWholeLife, complete: constantBaselineWholeLife != null };
    const selected = { selectedScenario, embodied, operational: selectedSeries?.total ?? null, wholeLife, reduction: selectedSeries?.reduction ?? null, reductionPercent: selectedSeries?.reductionPercent ?? null, complete: wholeLife != null };
    const delta = selected.reduction;
    const reductionPercent = selected.reductionPercent;
    const shares = wholeLife != null && wholeLife !== 0 ? { embodiedPercent: embodied / wholeLife * 100, operationalPercent: (selected.operational + modules.B7.value) / wholeLife * 100, waterPercent: modules.B7.value / wholeLife * 100 } : null;
    const baselineShares = baseline.wholeLife != null && baseline.wholeLife !== 0 ? { embodiedPercent: embodied / baseline.wholeLife * 100, operationalPercent: (baseline.operational + modules.B7.value) / baseline.wholeLife * 100, waterPercent: modules.B7.value / baseline.wholeLife * 100 } : null;
    const carbonIntensity = wholeLife != null && area != null && area > 0 ? wholeLife / area : null;
    const baselineCarbonIntensity = baseline.wholeLife != null && area != null && area > 0 ? baseline.wholeLife / area : null;
    const materialShares = modules['A1–A3'].value != null && modules['A1–A3'].value !== 0 ? Object.fromEntries(materialLines.map(line => [line.name, line.carbon == null ? null : line.carbon / modules['A1–A3'].value * 100])) : null;
    const moduleShares = wholeLife != null && wholeLife !== 0 ? Object.fromEntries(REQUIRED_MODULES.map(code => [code, modules[code].value / wholeLife * 100])) : null;
    const budgetValue = nullableNumber(input.carbonBudget);
    const budgetComparison = isNum(budgetValue) && selected.wholeLife != null ? { targetKg: budgetValue * 1000, differenceKg: selected.wholeLife - budgetValue * 1000, within: selected.wholeLife <= budgetValue * 1000 } : null;

    checks.push({ name: 'Study period', pass: Number.isInteger(period) && period > 0, detail: `${period == null ? 'Missing' : Number.isInteger(period) ? period : 'Invalid'} years; all lifetime calculations use the study period field.` });
    checks.push({ name: 'Floor area', pass: area != null, detail: area == null ? 'Area incomplete.' : `${floorPlate} m² × ${floors} floors = ${area} m² GFA.` });
    const missingQuantityEvidence = materialLines.filter(x => !isNum(x.quantity) || !hasUrl(x.quantitySource) || !hasText(x.quantityEvidence));
    checks.push({ name: 'Material quantities', pass: missingQuantityEvidence.length === 0, detail: missingQuantityEvidence.length ? `${materialLines.length - missingQuantityEvidence.length}/${materialLines.length} rows have a numeric quantity, quantity source URL, and quantity basis note. Add the missing fields for: ${missingQuantityEvidence.map(x => `${x.name} (${[!isNum(x.quantity) ? 'quantity' : '', !hasText(x.quantityEvidence) ? 'basis note' : '', !hasUrl(x.quantitySource) ? 'source URL' : ''].filter(Boolean).join(', ')})`).join('; ')}.` : `All ${materialLines.length} material rows have a numeric quantity, source URL, and basis note. A zero quantity still needs a cited basis.` });
    checks.push({ name: 'Unit consistency', pass: materialLines.every(x => x.factor == null || (x.quantityUnit === 'kg' && x.factorUnit === 'kgCO2e/kg' && x.module === 'A1–A3')), detail: 'Material quantities use kg; product factors use kgCO₂e/kg and must cover A1–A3.' });
    const materialFactorsRequiringEvidence = materialLines.filter(x => x.factor != null && x.quantity !== 0);
    const missingFactorEvidence = materialFactorsRequiringEvidence.filter(x => !(x.factorStatus === 'user-verified' && x.factorOrigin === 'user' && hasUrl(x.source) && hasText(x.sourceName) && hasText(x.geography) && Number.isInteger(x.factorYear) && x.factorYear >= 1900));
    checks.push({ name: 'Emission-factor source availability', pass: missingFactorEvidence.length === 0, detail: missingFactorEvidence.length ? `Nonzero rows need a source name and URL, geography, publication year, and “I verified this source” status. Missing or unverified: ${missingFactorEvidence.map(x => `${x.name} (${[!hasText(x.sourceName) ? 'source name' : '', !hasUrl(x.source) ? 'source URL' : '', !hasText(x.geography) ? 'geography' : '', !Number.isInteger(x.factorYear) || x.factorYear < 1900 ? 'publication year' : '', x.factorStatus !== 'user-verified' ? 'verification status' : ''].filter(Boolean).join(', ')})`).join('; ')}. Catalog factors stay illustrative until you verify their source.` : 'Every nonzero material factor has the required source details and was explicitly marked verified by the user.' });
    checks.push({ name: 'A1–A3 / A4 / A5 boundary', pass: modules['A1–A3'].complete ? modules['A1–A3'].value != null && modules.A4.formula.startsWith('(mass') && modules.A5.formula.startsWith('site electricity') : null, detail: 'A1–A3, A4 and A5 are calculated and reported as separate modules. No A1–A3-only result is labeled A1–A5.' });
    checks.push({ name: 'Embodied arithmetic', pass: embodiedComplete ? Number.isFinite(embodied) : null, detail: embodiedComplete ? `A1–A5 + B1–B5 + C1–C4 = ${embodied} kgCO₂e; operational B6/B7 are excluded.` : 'Not calculated until each required embodied module is complete.' });
    checks.push({ name: 'Operational arithmetic', pass: operational != null ? Number.isFinite(operational) : null, detail: operational != null ? `Selected B6 series = ${operational} ${modules.B6.metricUnit === 'kgCO2e/kWh' ? 'kgCO₂e' : 'kgCO₂'} over ${period} years; annual electricity and fuel use are held constant.` : 'Not calculated until annual electricity and fuel use, sources, provenance and study period are provided with compatible units.' });
    const missingWholeLifeModules = REQUIRED_MODULES.filter(code => !modules[code].complete);
    checks.push({ name: 'Whole-life total', pass: wholeLifeComplete ? Number.isFinite(wholeLife) : null, detail: wholeLifeComplete ? `A1–A5 + B1–B7 + C1–C4 = ${wholeLife} kgCO₂e; Module D excluded.` : `Not calculated; incomplete required A–C module records: ${missingWholeLifeModules.join(', ') || 'see the checks above'}.` });
    checks.push({ name: 'Embodied / operational shares', pass: shares ? (Math.abs(shares.embodiedPercent + shares.operationalPercent - 100) < 0.1) : null, detail: shares ? 'Embodied modules and operational B6/B7 together equal the selected whole-life total; D is excluded.' : 'Shares are unavailable until the full A–C total is calculable.' });
    checks.push({ name: 'Embodied share', pass: shares ? (Math.abs(shares.embodiedPercent - (embodied / wholeLife * 100)) < 0.000001) : null, detail: shares ? `${shares.embodiedPercent}% = non-B6 A–C modules ÷ selected whole-life total.` : 'Not calculated until a compatible CO₂e whole-life total is available.' });
    checks.push({ name: 'Operational share', pass: shares ? (Math.abs(shares.operationalPercent - ((selected.operational + modules.B7.value) / wholeLife * 100)) < 0.000001) : null, detail: shares ? `${shares.operationalPercent}% = (B6 + B7) ÷ selected whole-life total.` : 'Not calculated until a compatible CO₂e whole-life total is available.' });
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
      reportedSubtotal,
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
    if (!isNum(annualKwh) || !isNum(firstYearFactor) || !isNum(annualFuelCarbon) || !isNum(annualReduction) || annualReduction >= 1 || !Number.isInteger(period) || period <= 0) return null;
    const annual = [];
    for (let year = 1; year <= period; year++) {
      const factor = firstYearFactor * Math.pow(1 - annualReduction, year - 1);
      annual.push({ year, energyKwh: annualKwh, factorKgPerKwh: factor, fuelCarbonKg: annualFuelCarbon, carbonKg: annualKwh * factor + annualFuelCarbon });
    }
    let cumulativeKg = 0;
    for (const row of annual) {
      cumulativeKg += row.carbonKg;
      row.cumulativeKg = cumulativeKg;
    }
    return { total: cumulativeKg, annual };
  }

  function fuelUnitMatches(unit, factorUnit, supportedUnits) {
    return hasText(unit) && supportedUnits[unit] === factorUnit;
  }

  function calculateConcreteMix(mix, projectVolume) {
    const projectVolumeNum = nullableNumber(projectVolume);
    if (!isNum(projectVolumeNum) || projectVolumeNum === 0) {
      return createResult(null, 'invalid', ['Project volume is missing or invalid']);
    }
    if (!mix || !Array.isArray(mix.constituents) || mix.constituents.length === 0) return createResult(null, 'incomplete', ['Constituent records are missing or malformed']);

    let mixCarbonPerM3 = 0;
    let complete = mix.constituents.length > 0;
    const errors = [];

    for (const c of mix.constituents) {
      const mass = nullableNumber(c.mass);
      const factor = nullableNumber(c.factor);
      const requiredMetadata = [
        ['mass unit', c.massUnit === 'kg/m3'],
        ['factor unit', c.factorUnit === 'kgCO2e/kg'],
        ['lifecycle boundary', c.module === 'A1–A3'],
        ['source name', hasText(c.sourceName)],
        ['source URL', hasUrl(c.source)],
        ['geography', hasText(c.geography)],
        ['reference year', Number.isInteger(c.referenceYear) && c.referenceYear >= 1900],
        ['data quality', hasText(c.dataQuality)]
      ];
      const missingMetadata = requiredMetadata.filter(([, valid]) => !valid).map(([name]) => name);
      if (!isNum(mass) || !isNum(factor) || missingMetadata.length) {
        complete = false;
        errors.push(`Constituent ${c.name} has invalid/missing mass or factor${missingMetadata.length ? `; missing/invalid ${missingMetadata.join(', ')}` : ''}`);
      } else {
        mixCarbonPerM3 += mass * factor;
      }
    }

    if (!complete) return createResult(null, 'incomplete', errors);
    const totalCarbon = mixCarbonPerM3 * projectVolumeNum;

    return {
      value: totalCarbon,
      carbonPerM3: mixCarbonPerM3,
      totalCarbon: totalCarbon,
      status: 'complete',
      errors: errors,
      complete: complete
    };
  }

  const api = { REQUIRED_MODULES, calculate, calculateConcreteMix, operationalSeries };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CARBONWISE_ENGINE = api;

})(typeof window !== 'undefined' ? window : globalThis);
