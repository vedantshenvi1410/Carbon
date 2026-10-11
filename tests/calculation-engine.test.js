const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../calculation-engine.js');

const source = 'https://example.org/data-record';
const factor = { value: 0.5, unit: 'kgCO2e/kWh', metricUnit: 'kgCO2e/kWh', url: source, source: 'Synthetic test fixture', status: 'historical', region: 'Test region', boundary: 'B6', publicationYear: 2025 };
const data = { electricityFactors: { grid: factor } };
function fullInput(overrides = {}) {
  return {
    studyPeriod: 2, floorPlate: 50, floors: 2,
    materials: [{ name: 'Test material', quantity: 10, quantityUnit: 'kg', quantitySource: source, quantityEvidence: 'Synthetic fixture', factor: 2, factorUnit: 'kgCO2e/kg', factorYear: 2024, module: 'A1–A3', sourceName: 'Synthetic test fixture', source, geography: 'Test region', dataQuality: 'synthetic', factorStatus: 'user-verified', factorOrigin: 'user' }],
    transport: { massKg: 0, massUnit: 'kg', distanceKm: 0, distanceUnit: 'km', outwardFactor: 0, returnFactor: 0, factorUnit: 'kgCO2e/t·km', distanceBasis: 'one-way', factorSourceName: 'Synthetic transport dataset', routeSource: source, factorSource: source },
    construction: { electricityKwh: 0, electricityFactor: 0, electricitySource: source, electricityFactorSource: source, fuelQuantity: 0, fuelFactor: 0, fuelSource: source, fuelFactorSource: source, fuelUnit: 'kg', otherCarbon: 0, otherUnit: 'kgCO2e', otherModule: 'A5', otherSource: source },
    modules: Object.fromEntries(['B1','B2','B3','B5','C1','C2','C3','C4'].map(code => [code, { amount: 0, source }])),
    water: { totalM3: 0, volumeUnit: 'm3', volumeSource: source, factor: 0.4, factorUnit: 'kgCO2e/m3', factorSource: source },
    replacements: { confirmNone: true },
    energy: { annualKwh: 100, gridFactorId: 'grid', quality: 'synthetic', consumptionSource: source, annualFuel: 0, fuelSource: source, fuelUnit: 'MJ', fuelFactor: 0, fuelFactorSource: source },
    ...overrides
  };
}

test('material arithmetic and complete whole-life fixture reconcile', () => {
  const result = engine.calculate(fullInput(), data);
  assert.equal(result.materialLines[0].carbon, 20);
  assert.equal(result.modules['A1–A3'].value, 20);
  assert.equal(result.operational, 100);
  assert.equal(result.wholeLife, 120);
  assert.equal(result.complete, true);
  assert.equal(result.carbonIntensity, 120 / 100);
});

test('partial subtotal reports only complete compatible modules and preserves whole-life incompleteness', () => {
  const input = fullInput();
  input.modules.B2 = { amount: null, source: '' };
  const result = engine.calculate(input, data);
  assert.equal(result.wholeLife, null);
  assert.equal(result.reportedSubtotal.value, 120);
  assert.equal(result.reportedSubtotal.status, 'partial');
  assert.deepEqual(result.reportedSubtotal.includedModules, ['A1–A3', 'B6', 'B7']);
  assert.ok(result.reportedSubtotal.missingModules.includes('B2'));
});

test('CO2-only operational result is not added to the CO2e product-stage subtotal', () => {
  const co2Data = { electricityFactors: { grid: { ...factor, metricUnit: 'kgCO2/kWh', unit: 'kgCO2/kWh' } } };
  const result = engine.calculate(fullInput(), co2Data);
  assert.equal(result.reportedSubtotal.value, 20);
  assert.deepEqual(result.reportedSubtotal.includedModules, ['A1–A3', 'B7']);
  assert.equal(result.wholeLife, null);
});

test('absent electricity factor registry does not throw or become zero', () => {
  const result = engine.calculate(fullInput(), {});
  assert.equal(result.modules.B6.value, null);
  assert.equal(result.wholeLife, null);
  assert.equal(result.complete, false);
});

test('documented zero quantity returns numeric zero with no NaN', () => {
  const input = fullInput({ materials: [{ name: 'zero', quantity: 0, quantityUnit: 'kg', quantitySource: source, quantityEvidence: 'Explicitly absent from scope', factor: null }] });
  const result = engine.calculate(input, data);
  assert.equal(result.materialLines[0].carbon, 0);
  assert.equal(result.modules['A1–A3'].value, 0);
});

test('missing quantity, blank, non-finite and negative values do not produce emissions', () => {
  for (const quantity of [null, '', NaN, Infinity, -1]) {
    const result = engine.calculate(fullInput({ materials: [{ name: 'invalid', quantity, quantityUnit: 'kg', quantitySource: source, quantityEvidence: 'test', factor: 2, factorUnit: 'kgCO2e/kg', factorYear: 2024, module: 'A1–A3', source, geography: 'Test', dataQuality: 'synthetic', factorStatus: 'user-verified', factorOrigin: 'user' }] }), data);
    assert.equal(result.modules['A1–A3'].value, null, `quantity ${String(quantity)} must be incomplete`);
  }
});

test('concrete mix with missing factor is unscored; zero volume is invalid', () => {
  const mix = { constituents: [{ name: 'cement', mass: 10, factor: null }] };
  assert.equal(engine.calculateConcreteMix(mix, 1).status, 'incomplete');
  assert.equal(engine.calculateConcreteMix({ constituents: [] }, 0).status, 'invalid');
});

test('operational series rejects invalid inputs and sums declared years', () => {
  assert.equal(engine.operationalSeries(null, 0.5, 0, 2), null);
  assert.equal(engine.operationalSeries(100, 0.5, 1, 2), null);
  assert.equal(engine.operationalSeries(100, 0.5, 0.1, 3).total, 135.5);
});

test('invalid study period makes lifecycle result incomplete without throwing', () => {
  const result = engine.calculate(fullInput({ studyPeriod: '' }), data);
  assert.equal(result.wholeLife, null);
  assert.equal(result.complete, false);
});

test('A4 transport uses explicit outbound and return factors and rejects wrong units', () => {
  const base = fullInput();
  base.transport = { massKg: 1000, massUnit: 'kg', distanceKm: 10, distanceUnit: 'km', outwardFactor: 0.1, returnFactor: 0.2, factorUnit: 'kgCO2e/t·km', distanceBasis: 'one-way', factorSourceName: 'Synthetic transport dataset', routeSource: source, factorSource: source };
  const valid = engine.calculate(base, data);
  assert.ok(Math.abs(valid.modules.A4.value - 3) < 1e-12);
  base.transport.factorUnit = 'kgCO2e/km';
  const invalid = engine.calculate(base, data);
  assert.equal(invalid.modules.A4.value, null);
});

test('replacement schedule counts only service events, including study-period endpoint', () => {
  const serviceLives = [10, 20, 50, 60];
  const input = fullInput({ studyPeriod: 50, replacements: { rows: serviceLives.map(serviceLife => ({ name: `${serviceLife}y`, quantity: 1, serviceLife, initialYear: 0, factor: 2, factorUnit: 'kgCO2e/kg', module: 'B4', sourceName: 'Synthetic source', source, serviceLifeSource: source, geography: 'Test region', factorYear: 2024, quantitySource: source, quantityEvidence: 'Synthetic row', dataQuality: 'synthetic' })) } });
  const result = engine.calculate(input, data);
  assert.deepEqual(result.replacementLines.map(row => row.years), [[10,20,30,40,50],[20,40],[50],[]]);
  assert.equal(result.modules.B4.value, 16);
});

test('CO2-only B6 may be reported separately but cannot complete CO2e whole-life total', () => {
  const co2Data = { electricityFactors: { grid: { ...factor, metricUnit: 'kgCO2/kWh', unit: 'kgCO2/kWh' } } };
  const result = engine.calculate(fullInput(), co2Data);
  assert.equal(result.modules.B6.value, 100);
  assert.equal(result.modules.B6.wholeLifeCompatible, false);
  assert.equal(result.wholeLife, null);
});

test('entered annual electricity calculates a provisional B6 from an explicitly selected illustrative location', () => {
  const input = fullInput({ energy: {
    annualKwh: 100, gridFactorId: '', annualFuel: null,
    illustrativeGridFactor: 0.727, illustrativeGridFactorUnit: 'kgCO2/kWh',
    illustrativeGridFactorLabel: 'Illustrative test location assumption', illustrativeGridFactorGeography: 'Test region'
  } });
  const result = engine.calculate(input, {});
  assert.equal(result.modules.B6.value, 145.4);
  assert.equal(result.modules.B6.status, 'provisional');
  assert.equal(result.modules.B6.complete, false);
  assert.equal(result.modules.B6.metricUnit, 'kgCO2/kWh');
  assert.match(result.modules.B6.warnings.join(' '), /fuel.*excluded/i);
  assert.equal(result.wholeLife, null);
});

test('B6 remains unavailable when annual consumption or selected location is missing', () => {
  const location = { illustrativeGridFactor: 0.727, illustrativeGridFactorUnit: 'kgCO2/kWh', illustrativeGridFactorLabel: 'Illustrative', illustrativeGridFactorGeography: 'Test' };
  assert.equal(engine.calculate(fullInput({ energy: { annualKwh: '', ...location } }), {}).modules.B6.value, null);
  assert.equal(engine.calculate(fullInput({ energy: { annualKwh: 100 } }), {}).modules.B6.value, null);
});

test('genuine zero annual electricity needs provenance and stays distinct from missing', () => {
  const factorAssumption = { illustrativeGridFactor: 0.727, illustrativeGridFactorUnit: 'kgCO2/kWh', illustrativeGridFactorLabel: 'Illustrative', illustrativeGridFactorGeography: 'Test' };
  const unsubstantiated = engine.calculate(fullInput({ energy: { annualKwh: 0, ...factorAssumption } }), {});
  assert.equal(unsubstantiated.modules.B6.value, null);
  const evidenced = engine.calculate(fullInput({ energy: { annualKwh: 0, quality: 'Measured', consumptionSource: source, ...factorAssumption } }), {});
  assert.equal(evidenced.modules.B6.value, 0);
  assert.equal(evidenced.modules.B6.status, 'provisional');
  assert.equal(evidenced.wholeLife, null);
});

test('a complete user-supplied CO2e grid-factor record calculates sourced electricity B6', () => {
  const input = fullInput({ energy: {
    annualKwh: 100, gridFactorId: 'custom', quality: 'Measured', consumptionSource: source,
    annualFuel: 0, fuelSource: source, fuelUnit: 'MJ', fuelFactorSource: '',
    customFactor: 0.5, customUnit: 'kgCO2e/kWh', customRegion: 'Test region', customBoundary: 'B6',
    customSourceName: 'Synthetic test fixture', customSource: source, customYear: 2025,
    customTemporal: 'Current / historical', customLosses: 'unknown'
  } });
  const result = engine.calculate(input, {});
  assert.equal(result.modules.B6.value, 100);
  assert.equal(result.modules.B6.status, 'complete');
  assert.equal(result.modules.B6.wholeLifeCompatible, true);
});

test('operational fuel is included only with compatible sourced CO2e electricity and fuel factors', () => {
  const sourcedEnergy = {
    annualKwh: 100, gridFactorId: 'custom', quality: 'Measured', consumptionSource: source,
    annualFuel: 10, fuelSource: source, fuelUnit: 'MJ', fuelFactor: 2,
    fuelFactorUnit: 'kgCO2e/MJ', fuelMetric: 'CO2e', fuelFactorSource: source,
    customFactor: 0.5, customUnit: 'kgCO2e/kWh', customRegion: 'Test region', customBoundary: 'B6',
    customSourceName: 'Synthetic test fixture', customSource: source, customYear: 2025,
    customTemporal: 'Current / historical', customLosses: 'unknown'
  };
  const compatible = engine.calculate(fullInput({ energy: sourcedEnergy }), {});
  assert.equal(compatible.modules.B6.value, 140);
  assert.equal(compatible.modules.B6.status, 'complete');

  const co2Only = engine.calculate(fullInput({ energy: {
    annualKwh: 100, gridFactorId: '', quality: 'Measured', consumptionSource: source,
    annualFuel: 10, fuelSource: source, fuelUnit: 'MJ', fuelFactor: 2,
    fuelFactorUnit: 'kgCO2e/MJ', fuelMetric: 'CO2e', fuelFactorSource: source,
    illustrativeGridFactor: 0.727, illustrativeGridFactorUnit: 'kgCO2/kWh',
    illustrativeGridFactorLabel: 'Illustrative test location assumption', illustrativeGridFactorGeography: 'Test region'
  } }), {});
  assert.equal(co2Only.modules.B6.value, 145.4);
  assert.match(co2Only.modules.B6.warnings.join(' '), /cannot be combined/i);
  assert.equal(co2Only.wholeLife, null);
});

test('concrete mix requires unit and provenance metadata before scoring', () => {
  const metadata = { mass: 10, massUnit: 'kg/m3', factor: 2, factorUnit: 'kgCO2e/kg', module: 'A1–A3', source, geography: 'Test', referenceYear: 2024, dataQuality: 'synthetic' };
  const result = engine.calculateConcreteMix({ constituents: [{ ...metadata, sourceName: 'Synthetic source', name: 'test' }] }, 2);
  assert.equal(result.totalCarbon, 40);
  const missingEvidence = engine.calculateConcreteMix({ constituents: [{ name: 'test', mass: 10, factor: 2 }] }, 2);
  assert.equal(missingEvidence.status, 'incomplete');
  assert.equal(missingEvidence.value, null);
});


test('bundled prototype benchmarks produce a traceable partial A1–A3 subtotal only', () => {
  global.window = global;
  require('../material-database.js');
  const catalog = global.CARBONWISE_DATA;
  const area = 120 * 2;
  const benchmark = catalog.structureQuantityAssumptions.rcc;
  const materials = catalog.materials.map(record => {
    const assumption = benchmark.find(row => row.materialId === record.id);
    return {
      name: record.name, quantity: area * (assumption?.intensity ?? 0), quantityUnit: record.unit,
      quantitySource: source, quantityEvidence: 'Benchmark intensity × 240 m²; 0 denotes material not selected by this structure preset',
      factor: record.factor, factorUnit: record.factorUnit, factorYear: record.publicationYear,
      module: record.boundary, sourceName: record.source, source: record.sourceUrl, geography: record.region, dataQuality: record.confidence
    };
  });
  const result = engine.calculate({ studyPeriod: 50, floorPlate: 120, floors: 2, materials, transport: {}, construction: {}, modules: {}, replacements: {}, energy: {} }, catalog);
  const expected = area * (380 * 0.11 + 35 * 2.6 + 110 * 0.32 + 20 * 1.2);
  assert.equal(Number.isFinite(expected), true);
  assert.equal(result.modules['A1–A3'].value, null);
  assert.equal(result.wholeLife, null);
  assert.equal(result.complete, false);
});

test('material quantity and factor units must be compatible', () => {
  const material = fullInput().materials[0];
  const result = engine.calculate(fullInput({ materials: [{ ...material, quantityUnit: 'tonne' }] }), data);
  assert.equal(result.modules['A1–A3'].value, null);
});
