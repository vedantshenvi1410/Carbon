/* Carbonwise hackathon MVP: transparent prototype estimates, not certification. */
(() => {
  const $ = id => document.getElementById(id);
  const DATA=window.CARBONWISE_DATA, structures=DATA.structureQuantityAssumptions;
  const materials=DATA.materials.map(m=>({...m,ef:m.factor}));
  const opts = [
    {id:'low-concrete', title:'Specify lower-carbon concrete', detail:'Requires comparable supplier factors and mix quantities; currently unscored.', type:'embodied'},
    {id:'shading', title:'Add external shading', detail:'Requires a cooling-energy baseline and shading performance inputs; currently unscored.', type:'energy'},
    {id:'solar', title:'Add rooftop solar PV', detail:'Requires generation, self-consumption, lifetime and system-factor inputs; currently unscored.', type:'energy'}
  ];
  let results;
  let hasCalculated = false;
  let replacementIndex = 0;
  let restoringDraft = false;
  const fmt = (n,d=1) => {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
  };

  const t = kg => kg == null || !Number.isFinite(Number(kg)) ? null : Number(kg)/1000;
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderMixAlternatives() {
    const r = results;
    // Do not infer a project volume. Score only after the user supplies it.
    const rawVolume = $('mix-project-volume')?.value;
    const projectVolume = rawVolume == null || rawVolume.trim() === '' ? null : Number(rawVolume);
    const referenceMix = DATA.mixCandidates[0];
    const refResult = CARBONWISE_ENGINE.calculateConcreteMix(referenceMix, projectVolume);
    const refCarbonPerM3 = refResult?.carbonPerM3 ?? null;

    const rows = DATA.mixCandidates.map((mix, i) => {
      const res = CARBONWISE_ENGINE.calculateConcreteMix(mix, projectVolume);
      if (!res || !res.complete) {
        return `<tr class="mix-row unscored"><td><strong>${String.fromCharCode(65+i)} · ${mix.label}</strong></td><td>${mix.blend}</td><td class="mix-result">Unscored</td><td><span class="tag-warn">Source data / project volume needed</span></td></tr>`;
      }

      const reduction = refResult?.status === 'complete' && refCarbonPerM3 > 0 ? ((refCarbonPerM3 - res.carbonPerM3) / refCarbonPerM3 * 100) : null;
      const reductionClass = reduction >= 0 ? 'saving' : 'increase';

      return `<tr class="mix-row">
        <td><strong>${String.fromCharCode(65+i)} · ${mix.label}</strong></td>
        <td>${mix.blend}</td>
        <td class="mix-result">
          ${fmt(res.totalCarbon / 1000, 2)} t <br>
          <small>${fmt(res.carbonPerM3, 2)} kg/m³</small>
        </td>
        <td>${reduction == null ? '<span class="tag-warn">Unscored reference</span>' : `<span class="tag ${reductionClass}">${reduction >= 0 ? '↓' : '↑'} ${fmt(Math.abs(reduction), 1)}%</span>`}</td>
      </tr>`;
    }).join('');

    const table = $('material-alternatives').querySelector('table');
    if (table) {
      table.querySelector('tbody').innerHTML = rows;
    }

    const warning = $('material-alternatives').querySelector('.mix-warning');
    if (warning) {
      warning.textContent = 'UNSCORED · DATA NEEDED';
      warning.className = 'mix-warning';
    }
  }

  function init() {
    if (!$('project-name').value) $('project-name').value='Demo Residence';
    if (!$('floor-area').value) $('floor-area').value=120;
    if (!$('floors').value) $('floors').value=2;
    if (!$('lifetime').value) $('lifetime').value=50;
    if (!$('structure').value) $('structure').value='rcc';
    $('material-rows').innerHTML=materials.map(m=>`<tr><td class="material-name"><i class="material-swatch" style="background:${m.color}"></i>${m.name}<small>A1–A3 · illustrative catalog default</small></td><td><input type="number" min="0" step="any" data-q="${m.id}" aria-label="${m.name} quantity" /><input type="url" data-quantity-source="${m.id}" aria-label="${m.name} quantity source URL" placeholder="Quantity source URL" /></td><td><input type="number" min="0" step="any" data-ef="${m.id}" aria-label="${m.name} factor" value="${m.ef}" /><small>kgCO₂e/kg · ${m.verificationStatus}</small><input type="text" data-factor-name="${m.id}" aria-label="${m.name} factor source name" placeholder="Factor source / EPD" /><input type="url" data-factor-source="${m.id}" aria-label="${m.name} factor source URL" placeholder="Factor source URL" /><input type="text" data-factor-region="${m.id}" aria-label="${m.name} factor geography" placeholder="Geography" /><input type="number" min="1900" max="2100" step="1" data-factor-year="${m.id}" aria-label="${m.name} factor publication year" placeholder="Year" /><select data-factor-status="${m.id}" aria-label="${m.name} factor verification status"><option value="unverified">Unverified</option><option value="user-verified">I verified this source</option></select></td><td class="carbon-cell" data-c="${m.id}">—</td></tr>`).join('');
    $('module-inputs').innerHTML=['B1','B2','B3','B5','C1','C2','C3','C4','D'].map(code=>`<div class="transport-fields"><strong>${code} · ${code==='D'?'Benefits beyond the system boundary':'Lifecycle module'}</strong><div class="audit-input-grid"><label class="field">Module total <span class="unit">kgCO₂e</span><input id="module-${code}-amount" type="number" min="0" step="any" /></label><label class="field">Source or documented zero basis<input id="module-${code}-source" type="text" placeholder="Source URL or explain zero / not applicable" /></label></div></div>`).join('')+`<div class="transport-fields"><strong>B7 · Operational water</strong><div class="audit-input-grid"><label class="field">Total water use over study period <span class="unit">m³</span><input id="b7-volume" type="number" min="0" step="any" /></label><label class="field">Water source URL<input id="b7-volume-source" type="url" placeholder="Metered or modelled water record" /></label><label class="field">B7 factor <span class="unit">kgCO₂e/m³</span><input id="b7-factor" type="number" min="0" step="any" /></label><label class="field">Factor source URL<input id="b7-factor-source" type="url" /></label></div></div>`;
    $('add-replacement').addEventListener('click',addReplacementRow);
    $('saved-status-text').textContent='Prototype demo loaded';$('side-project').nextElementSibling.textContent='Prototype demo · India';
    renderFactorRegister();
    $('estimator-inputs').innerHTML=materials.map(m=>{const assumption=structures.rcc.find(x=>x.materialId===m.id);return `<label class="field">${m.name} <span class="unit">kg/m²</span><input type="number" min="0" step="any" data-intensity="${m.id}" value="${assumption?.intensity ?? ''}" /></label>`;}).join('');
    $('opportunity-grid').innerHTML=opts.map(o=>`<label class="opportunity-card"><input type="checkbox" data-option="${o.id}" /><span class="option-icon">↗</span><strong>${o.title}</strong><small>${o.detail}</small><b data-saving="${o.id}">Press Calculate to update</b></label>`).join('');
    $('material-alternatives').querySelector('.panel-heading').innerHTML='<div><span class="section-kicker">MATERIAL ALTERNATIVES</span><h2>M30 mix candidates</h2><p class="panel-subtitle">Compare project-specific product data. Options remain unscored without supplier factors and engineer validation.</p></div><span class="mix-warning">UNSCORED UNTIL SOURCED</span>';
    $('material-alternatives').querySelector('.alternative-detail').innerHTML=`<div class="mix-context"><label class="field">Application<select id="mix-application"><option>Structural concrete</option><option>Slab / floor</option><option>Foundation</option><option>Non-structural</option></select></label><label class="field">Exposure<select id="mix-exposure"><option>General</option><option>Coastal / chloride</option><option>Sulphate</option><option>Other project exposure</option></select></label><label class="field">Project concrete volume <span class="unit">m³</span><input id="mix-project-volume" type="number" min="0" step="any" placeholder="Required to calculate project totals" /></label><div class="constraint-message"><strong>Eligibility needs project review</strong><span>Verify design strength, curing, durability, IS code requirements and supplier mix data with the project engineer. No universal GGBS cap is applied.</span></div></div><div class="mix-table-wrap"><table class="mix-table"><thead><tr><th>Candidate</th><th>Indicative composition</th><th>Carbon result</th><th>Validation</th></tr></thead><tbody>${DATA.mixCandidates.map((m,i)=>`<tr><td><strong>${String.fromCharCode(65+i)} · ${m.label}</strong></td><td>${m.blend}</td><td>Unscored · factor not supplied</td><td>Project / engineer check</td></tr>`).join('')}</tbody></table></div><div class="alternative-detail"><strong>Evidence needed</strong><p>Enter a supplier-specific EPD or declared A1–A3 factor for a like-for-like strength class, curing regime, exposure and functional unit. This screen does not assume that a mix is eligible or quantify savings.</p></div>`;
    $('method-detail').innerHTML='<div><strong>Prototype calculation</strong><p>Gross floor area = floor plate × floors. Material quantities = gross floor area × editable material-intensity assumptions. Product-stage A1–A3 = Σ(quantity × illustrative factor). B6 and other lifecycle modules are not included in a combined whole-life total without compatible sourced inputs.</p></div><div><strong>Assumption status</strong><p>All demo quantity intensities, material factors, city energy intensities, grid factors, and intervention effects are illustrative assumptions with low confidence. The sensitivity band is a simple ±25% prototype range, not a statistical uncertainty analysis. Replace with traceable project data before decisions.</p></div><div><strong>India context</strong><p>BEE ECSBC 2024 Appendix 6 is included as methodology context for embodied-carbon reporting. This prototype makes no compliance claim.</p><a href="https://beeindia.gov.in/WriteReadData/L45218/7534511430467336.pdf" target="_blank" rel="noreferrer">BEE · ECSBC 2024 ↗</a></div>';
    document.addEventListener('input',markInputsChanged);
    document.addEventListener('change',markInputsChanged);
    $('calculate-button').addEventListener('click',()=>calculate({persist:true}));
    $('structure').addEventListener('change',()=>{
      const assumptions=structures[$('structure').value]||[];
      materials.forEach(m=>{
        const field=document.querySelector(`[data-intensity="${m.id}"]`);
        const assumption=assumptions.find(x=>x.materialId===m.id);
        if(field)field.value=assumption?.intensity ?? '';
      });
      markInputsChanged();
    });
    $('estimate-quantities').addEventListener('click',applyQuantities);
    $('toggle-details').addEventListener('click',()=>{const x=$('factor-detail');x.hidden=!x.hidden;$('toggle-details').setAttribute('aria-expanded',String(!x.hidden));});
    $('method-toggle').addEventListener('click',()=>{const x=$('method-detail');x.hidden=!x.hidden;$('method-toggle').setAttribute('aria-expanded',String(!x.hidden));});
    $('print-report').addEventListener('click',()=>window.print()); $('footer-print').addEventListener('click',()=>window.print());
    document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.scroll)?.scrollIntoView({behavior:'smooth'})));
  }
  function markInputsChanged(){
    $('calculation-state').textContent=hasCalculated?'Inputs changed since the last calculation. Press Calculate to refresh results.':'Enter or review your inputs, then press Calculate.';
    renderFactorRegister();
    if(!restoringDraft)window.CarbonwiseSession?.queueSave?.();
  }
  function renderFactorRegister(){
    const box=$('factor-detail');
    if(!box||!document.querySelector('[data-ef]'))return;
    box.innerHTML='<strong>Active factor register · provenance shown per line</strong><p>Catalog values are illustrative and unverified. A nonzero material line is eligible only after you supply its factor source, geography, year, and verification status. A user-entered status is an attestation, not independent verification by Carbonwise.</p><div class="factor-record-grid">'+materials.map(m=>{
      const active=document.querySelector(`[data-ef="${m.id}"]`)?.value;
      const sourceName=document.querySelector(`[data-factor-name="${m.id}"]`)?.value;
      const source=document.querySelector(`[data-factor-source="${m.id}"]`)?.value;
      const region=document.querySelector(`[data-factor-region="${m.id}"]`)?.value;
      const year=document.querySelector(`[data-factor-year="${m.id}"]`)?.value;
      const status=document.querySelector(`[data-factor-status="${m.id}"]`)?.value||'unverified';
      return `<div><b>${esc(m.name)}</b><span>Active factor: ${esc(active)} kgCO₂e/kg · A1–A3</span><span>Catalog default: ${m.factor} kgCO₂e/kg · illustrative / unverified</span><span>Status: ${esc(status)}</span><span>Source: ${esc(sourceName||'Not supplied')} · ${esc(source||'URL missing')}</span><span>Geography / year: ${esc(region||'Not supplied')} · ${esc(year||'Not supplied')}</span></div>`;
    }).join('')+'</div>';
  }
  function applyQuantities(options={}){
    const floorPlate=Number($('floor-area').value), floors=Number($('floors').value);
    const area=Number.isFinite(floorPlate)&&floorPlate>0&&Number.isInteger(floors)&&floors>0?floorPlate*floors:null;
    materials.forEach(m=>{const intensity=document.querySelector(`[data-intensity="${m.id}"]`); const qtyField=document.querySelector(`[data-q="${m.id}"]`); if(options.onlyBlank&&qtyField?.value.trim()!=='')return; const raw=intensity?.value; const quantity=area==null?null:raw===''||raw==null?0:Number(raw)*area; if(qtyField)qtyField.value=Number.isFinite(quantity)?String(quantity):'';});
    $('estimator-area').textContent=`Gross floor area: ${fmt(area,1)} m²`; $('estimator-status').textContent='Quantities are area × editable prototype material intensity assumptions.'; markInputsChanged();
  }

  function addReplacementRow(){
    const id=++replacementIndex;
    const row=document.createElement('div');
    row.className='transport-fields replacement-row';
    row.dataset.replacementRow='true';
    row.innerHTML=`<strong>B4 · Component ${id}</strong><div class="audit-input-grid">
      <label class="field">Component name<input data-r-name /></label>
      <label class="field">Quantity <span class="unit">kg</span><input data-r-quantity type="number" min="0" step="any" /></label>
      <label class="field">Service life <span class="unit">years</span><input data-r-life type="number" min="1" step="1" /></label>
      <label class="field">Installation year<input data-r-year type="number" min="0" step="1" value="0" /></label>
      <label class="field">Replacement factor <span class="unit">kgCO₂e/kg</span><input data-r-factor type="number" min="0" step="any" /></label>
      <label class="field">Factor year<input data-r-factor-year type="number" min="1900" step="1" /></label>
      <label class="field">Factor source name<input data-r-source-name /></label>
      <label class="field">Factor source URL<input data-r-factor-source type="url" /></label>
      <label class="field">Service-life source URL<input data-r-life-source type="url" /></label>
      <label class="field">Factor geography<input data-r-region /></label>
      <label class="field field-wide">Quantity source URL<input data-r-quantity-source type="url" /></label>
      </div><button class="text-button" type="button" data-remove-replacement>Remove component</button>`;
    row.querySelector('[data-remove-replacement]').addEventListener('click',()=>{row.remove();markInputsChanged();});
    $('replacement-inputs').appendChild(row);
    $('no-replacements').checked=false;
    markInputsChanged();
  }

  function calculate(options={}){
    if(!document.querySelector('[data-q="concrete-opc"]'))return;

    // The explicit Calculate action may fill estimated quantities, but never
    // overwrites a quantity the user has already entered.
    applyQuantities({onlyBlank:true});

    const input = {
      floorArea: $('floor-area').value,
      floors: $('floors').value,
      lifetime: $('lifetime').value,
      location: $('location').value,
      buildingType: $('building-type').value,
      annualKwh: $('annual-kwh').value,
      materials: materials.map(m => ({
        id: m.id,
        name: m.name,
        quantity: document.querySelector(`[data-q="${m.id}"]`)?.value,
        factor: document.querySelector(`[data-ef="${m.id}"]`)?.value,
        quantitySource: document.querySelector(`[data-quantity-source="${m.id}"]`)?.value,
        factorName: document.querySelector(`[data-factor-name="${m.id}"]`)?.value,
        factorSource: document.querySelector(`[data-factor-source="${m.id}"]`)?.value,
        factorRegion: document.querySelector(`[data-factor-region="${m.id}"]`)?.value,
        factorYear: document.querySelector(`[data-factor-year="${m.id}"]`)?.value,
        factorStatus: document.querySelector(`[data-factor-status="${m.id}"]`)?.value
      })),
      selectedOptions: [...document.querySelectorAll('[data-option]:checked')].map(x => x.dataset.option)
    };

    // --- UNIFIED CALCULATION FLOW ---
    // 1. Map "Quick" UI inputs to the rigorous "Detailed" engine format
    const detailedInput = {
      studyPeriod: input.lifetime,
      floorPlate: input.floorArea,
      floors: input.floors,
      materials: input.materials.map(m => {
        const matData = DATA.materials.find(dbM => dbM.id === m.id) || {};
        return {
          name: m.name,
          quantity: m.quantity,
          quantityUnit: matData.unit || '',
          quantitySource: m.quantitySource,
          quantityEvidence: m.quantitySource ? 'User-provided quantity source; review the cited record and unit.' : '',
          factor: m.factor,
          factorUnit: matData.factorUnit || '',
          factorYear: m.factorYear,
          module: matData.boundary || '',
          sourceName: m.factorName,
          source: m.factorSource,
          geography: m.factorRegion,
          dataQuality: m.factorStatus === 'user-verified' ? 'user-verified; review required' : 'unverified',
          factorStatus: m.factorStatus,
          factorOrigin: 'user'
        };
      }),
      transport: {
        massKg: $('a4-mass').value, massUnit: 'kg', distanceKm: $('a4-distance').value, distanceUnit: 'km', distanceBasis: 'one-way',
        outwardFactor: $('a4-outward').value, returnFactor: $('a4-return').value, factorUnit: 'kgCO2e/t·km',
        factorSourceName: $('a4-factor-source').value ? 'User-provided transport factor' : '', routeSource: $('a4-route-source').value, factorSource: $('a4-factor-source').value
      },
      construction: {
        electricityKwh: $('a5-electricity').value, electricityFactor: $('a5-electricity-factor').value,
        electricitySource: $('a5-electricity-source').value, electricityFactorSource: $('a5-electricity-factor-source').value,
        electricityFactorUnit: 'kgCO2e/kWh', electricityFactorModule: 'A5',
        fuelQuantity: $('a5-fuel').value, fuelUnit: $('a5-fuel-unit').value,
        fuelFactor: $('a5-fuel-factor').value,
        fuelFactorUnit: ({kg:'kgCO2e/kg',L:'kgCO2e/L',MJ:'kgCO2e/MJ'})[$('a5-fuel-unit').value] || '',
        fuelSource: $('a5-fuel-source').value, fuelFactorSource: $('a5-fuel-factor-source').value, fuelFactorModule: 'A5',
        otherCarbon: $('a5-other').value, otherUnit: 'kgCO2e', otherModule: 'A5', otherSource: $('a5-other-source').value
      },
      modules: Object.fromEntries(['B1','B2','B3','B5','C1','C2','C3','C4','D'].map(code=>[code,{amount:$(`module-${code}-amount`).value,source:$(`module-${code}-source`).value}])),
      water: { totalM3:$('b7-volume').value, volumeUnit:'m3', volumeSource:$('b7-volume-source').value, factor:$('b7-factor').value, factorUnit:'kgCO2e/m3', factorSource:$('b7-factor-source').value },
      energy: {
        annualKwh: input.annualKwh,
        gridFactorId: $('grid-factor-kind').value,
        quality: $('energy-quality').value,
        consumptionSource: $('energy-source').value,
        annualFuel: $('annual-fuel').value,
        fuelUnit: $('annual-fuel-unit').value,
        fuelFactor: $('annual-fuel-factor').value,
        fuelFactorUnit: ({kg:'kgCO2e/kg',L:'kgCO2e/L',MJ:'kgCO2e/MJ'})[$('annual-fuel-unit').value] || '',
        fuelMetric: 'CO2e',
        fuelSource: $('annual-fuel-source').value,
        fuelFactorSource: $('annual-fuel-factor-source').value,
        illustrativeGridFactor: $('grid-factor-kind').value === 'custom' ? null : DATA.locationAssumptions[input.location]?.grid,
        illustrativeGridFactorUnit: 'kgCO2/kWh',
        illustrativeGridFactorLabel: input.location && $('grid-factor-kind').value !== 'custom' ? `Carbonwise illustrative location assumption (${input.location}; unverified)` : '',
        illustrativeGridFactorGeography: input.location && $('grid-factor-kind').value !== 'custom' ? input.location : '',
        customFactor: $('custom-grid-factor').value,
        customUnit: 'kgCO2e/kWh',
        customRegion: $('custom-grid-region').value,
        customBoundary: 'B6',
        customSourceName: $('custom-grid-source').value ? 'User-entered grid factor record' : '',
        customSource: $('custom-grid-source').value,
        customYear: $('custom-grid-year').value,
        customTemporal: $('custom-grid-temporal').value,
        customLosses: $('custom-grid-losses').value,
        moderateAnnualReduction: $('moderate-rate').value === '' ? null : Number($('moderate-rate').value) / 100,
        highAnnualReduction: $('high-rate').value === '' ? null : Number($('high-rate').value) / 100
      },
      replacements: { confirmNone: $('no-replacements').checked, rows: [...document.querySelectorAll('[data-replacement-row]')].map(row=>({
        name:row.querySelector('[data-r-name]').value, quantity:row.querySelector('[data-r-quantity]').value,
        serviceLife:row.querySelector('[data-r-life]').value, initialYear:row.querySelector('[data-r-year]').value,
        factor:row.querySelector('[data-r-factor]').value, factorUnit:'kgCO2e/kg', module:'B4',
        factorYear:row.querySelector('[data-r-factor-year]').value, sourceName:row.querySelector('[data-r-source-name]').value,
        source:row.querySelector('[data-r-factor-source]').value, serviceLifeSource:row.querySelector('[data-r-life-source]').value,
        geography:row.querySelector('[data-r-region]').value, quantitySource:row.querySelector('[data-r-quantity-source]').value,
        quantityEvidence:row.querySelector('[data-r-quantity-source]').value ? 'User-provided component quantity record; review the cited record and unit.' : '',
        dataQuality:row.querySelector('[data-r-quantity-source]').value ? 'user-provided; review required' : ''
      })) },
      selectedScenario: $('grid-scenario').value,
    };

    // 2. Calculate baseline with sourced data only. Intervention cards remain available,
    // but are unscored until their actual input changes and added impacts are modelled.
    let detailedResults;
    try {
      detailedResults = CARBONWISE_ENGINE.calculate(detailedInput, DATA);
      if (!detailedResults || !detailedResults.modules || !detailedResults.modules['A1–A3'] || !detailedResults.modules.B6 || !detailedResults.reportedSubtotal) {
        throw new Error('The calculation engine returned an incomplete result structure.');
      }
    } catch (error) {
      console.error('Carbonwise calculation failed:', error);
      $('calculation-state').textContent=`Calculation failed: ${error instanceof Error ? error.message : 'unexpected calculation error'}. Check the inputs and try again.`;
      return;
    }

    // 4. Adapt result object for the existing render() function
    results = {
      area: detailedResults.grossFloorArea,
      years: detailedResults.studyPeriod,
      loc: DATA.locationAssumptions[input.location] || null,
      annualKwh: Number.isFinite(Number(input.annualKwh)) && input.annualKwh !== '' ? Number(input.annualKwh) : null,
      embodied: detailedResults.modules['A1–A3'].value,
      water: detailedResults.modules.B7.value,
      reportedSubtotal: detailedResults.reportedSubtotal,
      operational: detailedResults.operational,
      operationalStatus: detailedResults.modules.B6.status,
      operationalMetricUnit: detailedResults.modules.B6.metricUnit,
      operationalSeries: detailedResults.modules.B6.series,
      operationalWarnings: detailedResults.modules.B6.warnings,
      base: detailedResults.wholeLife,
      selected: input.selectedOptions.length ? null : detailedResults.reportedSubtotal.value,
      lines: detailedResults.materialLines,
      reductions: input.selectedOptions.map(id=>({id,name:opts.find(x=>x.id===id)?.title||id,carbon:null})),
      status: detailedResults.complete ? 'complete' : 'incomplete'
    };

    // Baseline vs Selected
    results.base = detailedResults.wholeLife;

    render();
    hasCalculated = true;
    $('calculation-state').textContent='Results updated using the current inputs.';
    if(options.persist)window.CarbonwiseSession?.saveCurrentProject?.().catch(error=>{console.error(error);$('saved-status-text').textContent='Save failed';});
  }

  function captureDraft(){
    const fields={};
    document.querySelectorAll('.app-shell input[id],.app-shell select[id],.app-shell textarea[id]').forEach(el=>{if(el.matches('input[type="checkbox"]'))fields[el.id]=el.checked;else fields[el.id]=el.value;});
    const intensities=Object.fromEntries([...document.querySelectorAll('[data-intensity]')].map(el=>[el.dataset.intensity,el.value]));
    const costs=Object.fromEntries([...document.querySelectorAll('[data-cost]')].map(el=>[el.dataset.cost,el.value]));
    const materialRows=materials.map(m=>({id:m.id,quantity:$(`[data-q="${m.id}"]`)?.value??'',quantitySource:$(`[data-quantity-source="${m.id}"]`)?.value??'',factor:$(`[data-ef="${m.id}"]`)?.value??'',factorName:$(`[data-factor-name="${m.id}"]`)?.value??'',factorSource:$(`[data-factor-source="${m.id}"]`)?.value??'',factorRegion:$(`[data-factor-region="${m.id}"]`)?.value??'',factorYear:$(`[data-factor-year="${m.id}"]`)?.value??'',factorStatus:$(`[data-factor-status="${m.id}"]`)?.value??'unverified'}));
    const replacements=[...document.querySelectorAll('[data-replacement-row]')].map(row=>Object.fromEntries(['name','quantity','life','year','factor','factor-year','source-name','factor-source','life-source','region','quantity-source'].map(key=>[key,row.querySelector(`[data-r-${key}]`)?.value??''])));
    return {version:1,fields,intensities,costs,materials:materialRows,replacements,selectedOptions:[...document.querySelectorAll('[data-option]:checked')].map(el=>el.dataset.option)};
  }
  function restoreDraft(state={}){
    restoringDraft=true;
    try{
      for(const [id,value] of Object.entries(state.fields||{})){const el=$(id);if(!el)continue;if(el.matches('input[type="checkbox"]'))el.checked=Boolean(value);else if(el.matches('input,select,textarea'))el.value=value??'';}
      for(const [id,value] of Object.entries(state.intensities||{})){const el=document.querySelector(`[data-intensity="${id}"]`);if(el)el.value=value??'';}
      for(const [id,value] of Object.entries(state.costs||{})){const el=document.querySelector(`[data-cost="${id}"]`);if(el)el.value=value??'';}
      for(const item of state.materials||[]){const set=(selector,value)=>{const el=document.querySelector(selector);if(el)el.value=value??'';};set(`[data-q="${item.id}"]`,item.quantity);set(`[data-quantity-source="${item.id}"]`,item.quantitySource);set(`[data-ef="${item.id}"]`,item.factor);set(`[data-factor-name="${item.id}"]`,item.factorName);set(`[data-factor-source="${item.id}"]`,item.factorSource);set(`[data-factor-region="${item.id}"]`,item.factorRegion);set(`[data-factor-year="${item.id}"]`,item.factorYear);set(`[data-factor-status="${item.id}"]`,item.factorStatus||'unverified');}
      $('replacement-inputs').replaceChildren();
      for(const item of state.replacements||[]){addReplacementRow();const row=$('replacement-inputs').lastElementChild;for(const [key,value] of Object.entries(item)){const el=row.querySelector(`[data-r-${key}]`);if(el)el.value=value??'';}}
      document.querySelectorAll('[data-option]').forEach(el=>{el.checked=(state.selectedOptions||[]).includes(el.dataset.option);});
    }finally{restoringDraft=false;}
    renderFactorRegister();
    if(state.fields)calculate({persist:false});
  }
  function resetProjectForm(){
    restoringDraft=true;
    try{
      document.querySelectorAll('.app-shell input, .app-shell select, .app-shell textarea').forEach(el=>{if(el.matches('input[type="checkbox"]'))el.checked=false;else if(el.dataset.ef){const item=materials.find(m=>m.id===el.dataset.ef);el.value=item?.ef??'';}else if(el.matches('select'))el.selectedIndex=0;else el.value='';});
      const assumptions=structures.rcc||[];
      document.querySelectorAll('[data-intensity]').forEach(el=>{el.value=assumptions.find(item=>item.materialId===el.dataset.intensity)?.intensity??'';});
      $('replacement-inputs').replaceChildren();
      document.querySelectorAll('[data-option]').forEach(el=>{el.checked=false;});
      $('structure').value='rcc';
    }finally{restoringDraft=false;}
    hasCalculated=false;
    $('lifecycle-total').textContent='—';$('embodied-total').textContent='—';$('operational-total').textContent='—';
  }
  function applyProjectDetails(project){
    $('project-name').value=project.name||'';$('location').value=project.location||'';$('building-type').value=project.building_type||'';
    $('floor-area').value=project.floor_plate_m2??'';$('floors').value=project.floors??'';$('lifetime').value=project.study_period_years??'';
    restoringDraft=true;try{calculate({persist:false});}finally{restoringDraft=false;}
  }
  window.CarbonwiseApp={captureDraft,restoreDraft,resetProjectForm,applyProjectDetails,calculate};
  function render(){
    const r=results,red=r.base!=null&&r.selected!=null&&r.base>0?100*(r.base-r.selected)/r.base:null, intensity=r.area&&r.base!=null?r.base/r.area:null;
    $('crumb-project').textContent=$('project-name').value||'Demo Residence';$('side-project').textContent=$('crumb-project').textContent;
    $('print-project-meta').textContent=`${$('crumb-project').textContent} · ${$('location').value} · illustrative prototype`; $('print-building-meta').textContent=`${$('building-type').selectedOptions[0]?.text||'Residential'} · ${fmt(r.area,0)} m² GFA · ${r.years}-year estimate`;
    const subtotal=r.reportedSubtotal;
    $('study-stamp').textContent=r.years??'—';$('lifecycle-heading').textContent=r.status==='complete'?'Whole-life A–C carbon':'Partial carbon subtotal';$('lifecycle-total').textContent=fmt(t(subtotal?.value));$('embodied-total').textContent=fmt(t(r.embodied));$('operational-total').textContent=fmt(t(r.operational));$('operational-unit').textContent=`t${r.operationalMetricUnit==='kgCO2e/kWh'?'CO₂e':'CO₂'}`;$('intensity-value').textContent=intensity==null?'Whole-life intensity unavailable':`${fmt(intensity,1)} kgCO₂e / m²`;
    $('embodied-share').textContent='A1–A3 product-stage subtotal · partial scope';$('annual-energy').textContent=`${fmt(r.annualKwh,0)} kWh / year`;$('annual-grid').textContent=r.operationalStatus==='provisional'?`PROVISIONAL · illustrative ${r.loc?.grid ?? '—'} kgCO₂/kWh for ${$('location').value}; fuel excluded`:(r.operationalStatus==='complete'?'B6 calculated with sourced factor and inputs':'Enter annual electricity and select a location or complete a sourced grid factor');
    const missingModules=subtotal?.missingModules||[];
    $('metric-uncertainty').textContent=r.status==='complete'?'Complete for the declared A–C module scope; Module D is separate.':subtotal?.value!=null?`Includes ${subtotal.includedModules.join(' + ')} only. Missing: ${missingModules.join(', ')}. This is not a whole-life total.`:'No compatible subtotal: complete A1–A3 data and/or a sourced, CO₂e-compatible B6 record is required.';$('lifecycle-status').textContent=r.status==='complete'?'COMPLETE FOR DECLARED SCOPE':subtotal?.value!=null?`PARTIAL · ${subtotal.includedModules.join(' + ')}`:'NO COMPATIBLE SUBTOTAL';$('op-final-year').textContent=`YEAR ${r.years??'—'}`;
    $('profile-intensity').innerHTML=`${fmt(intensity,1)} <small>kgCO₂e/m²</small>`;$('profile-energy').innerHTML=`${fmt(r.annualKwh,0)} <small>kWh/year</small>`;$('profile-lifetime').innerHTML=`${r.years??'—'} <small>years</small>`;$('scope-caption').textContent='PRODUCT-STAGE A1–A3 PARTIAL ESTIMATE · B6 AND OTHER A–C MODULES UNAVAILABLE';
    $('donut-total').textContent=fmt(t(subtotal?.value));const ep=r.base!=null&&r.embodied!=null?r.embodied/r.base*100:null;$('donut').style.background=ep==null?'#edf1ef':`conic-gradient(#739886 0 ${ep}%,#c9dcd2 ${ep}% 100%)`;$('donut-legend').innerHTML=ep==null?`<div class="legend-row"><i></i><span>${subtotal?.value!=null?`Partial subtotal · ${subtotal.includedModules.join(' + ')}; shares unavailable`:'Whole-life shares unavailable'}</span><strong>—</strong></div>`:`<div class="legend-row"><i></i><span>Non-B6 A–C lifecycle</span><strong>${fmt(ep,1)}%</strong></div><div class="legend-row"><i></i><span>Operational · B6</span><strong>${fmt(100-ep,1)}%</strong></div>`;
    $('total-line-embodied').style.width=`${ep??0}%`;$('total-line-operational').style.width=`${ep==null?0:100-ep}%`;
    r.lines.forEach(x=>{const el=document.querySelector(`[data-c="${x.id}"]`);if(el)el.textContent=`${fmt(x.carbon,0)} kg`;});
    $('embodied-bars').innerHTML=r.lines.map(x=>`<i title="${x.name}: ${fmt(x.carbon,0)} kgCO₂e" style="height:${x.carbon==null?0:Math.max(7,r.embodied?x.carbon/r.embodied*100:0)}%"></i>`).join('');
    const score=red==null?null:Math.max(0,Math.min(100,Math.round(red)));$('score-value').textContent=score==null?'—':String(score);$('score-track').style.width=`${score??0}%`;$('score-copy').textContent=red==null?'No comparable complete baseline/scenario total is available; selected interventions remain unscored.':'Prototype comparison only; not a certification or benchmark.';
    $('confidence-value').textContent='LOW';$('quality-project-bar').style.width='0%';$('quality-source-bar').style.width='0%';$('quality-missing-bar').style.width='100%';$('quality-legend').innerHTML='<span><i class="q-assumed"></i><strong>100%</strong> preliminary assumptions · low confidence</span>';$('quality-foot').textContent='Replace demo assumptions with project quantities, supplier EPDs, and cited energy data.';
    $('optimised-total').textContent=r.selected==null?'Unscored':fmt(t(r.selected));$('reduction-chip').textContent=red==null?'UNSCORED':`${fmt(red,1)}% reduction`; $('opportunity-count').textContent=String(r.reductions.length);
    r.reductions.forEach(x=>{const el=document.querySelector(`[data-saving="${x.id}"]`);if(el)el.textContent='Unscored · intervention inputs and impacts not modelled';});
    $('comparison-summary').innerHTML=`<div><small>BASELINE · ${subtotal?.status==='complete'?'COMPLETE A–C':'PARTIAL SCOPE'}</small><strong>${fmt(t(subtotal?.value))} <i>tCO₂e</i></strong><span>${subtotal?.value!=null?`Included: ${subtotal.includedModules.join(' + ')} · `:''}Product stage ${fmt(t(r.embodied))} tCO₂e · B6 ${fmt(t(r.operational))} t${r.operationalMetricUnit==='kgCO2e/kWh'?'CO₂e':'CO₂'} · B7 water ${fmt(t(r.water))} tCO₂e</span></div><div><small>SELECTED DESIGN</small><strong>${r.selected==null?'Unscored':`${fmt(t(r.selected))} tCO₂e`}</strong><span>${r.reductions.length?`${esc(r.reductions.map(x=>x.name).join(' · '))} · comparison unscored`:'No interventions selected; partial subtotal shown where compatible'}</span></div><div class="avoided-stat"><small>ESTIMATED CHANGE</small><strong>${r.base!=null&&r.selected!=null?`${fmt(t(r.base-r.selected),2)} tCO₂e · ${fmt(red,1)}%`:'Unscored'}</strong><span>Requires comparable complete totals and validated intervention inputs.</span></div>`;
    $('lifecycle-chart').innerHTML=[['A1–A3 · product',r.embodied,'CO₂e'],['B6 · electricity / fuel',r.operational,r.operationalMetricUnit==='kgCO2e/kWh'?'CO₂e':'CO₂'],['B7 · water',r.water,'CO₂e']].map(x=>`<div class="stacked-row"><span>${x[0]}</span><div class="stacked-track"><i class="stack-embodied" style="width:${r.base!=null&&x[1]!=null?x[1]/r.base*100:0}%"></i></div><strong>${fmt(t(x[1]),2)} tCO₂${x[2]==='CO₂e'?'e':''}</strong></div>`).join('')+'<div class="chart-legend">Modules are shown separately; provisional CO₂ B6 is not comparable with CO₂e results and is excluded from the whole-life total.</div>';
    $('material-chart').innerHTML=r.lines.map(x=>`<div class="pareto-row"><span>${x.name}</span><div><i style="width:${r.embodied?x.carbon/r.embodied*100:0}%"></i></div><strong>${fmt(t(x.carbon),2)} t</strong></div>`).join('');
    $('scenario-chart').innerHTML=`<div class="scenario-row unscored"><span>Baseline · ${subtotal?.status==='complete'?'complete':'partial'}</span><div><i style="width:0%"></i></div><strong>${fmt(t(subtotal?.value),2)} t</strong></div><div class="scenario-row unscored"><span>Selected</span><div><i style="width:0%"></i></div><strong>${r.reductions.length||r.selected==null?'Unscored':`${fmt(t(r.selected),2)} t`}</strong></div>`;
    const opSeries=r.operationalSeries?.annual||[];
    if(opSeries.length){
      const max=Math.max(...opSeries.map(row=>row.cumulativeKg),1),pointPairs=opSeries.map((row,index)=>`${opSeries.length===1?160:index/(opSeries.length-1)*320},${42-row.cumulativeKg/max*38}`),points=pointPairs.join(' '),linePath=pointPairs.map((point,index)=>`${index?'L':'M'} ${point}`).join(' ');
      $('lifetime-chart').innerHTML=`<svg viewBox="0 0 320 45" preserveAspectRatio="none" role="img" aria-label="Cumulative provisional operational electricity emissions in kilograms of carbon dioxide"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2"/></svg><p class="empty-note">Year 1: ${fmt(t(opSeries[0].carbonKg),3)} tCO₂ · study-period electricity: ${fmt(t(r.operational),2)} tCO₂. ${esc((r.operationalWarnings||[]).join(' '))}</p>`;
      const annualMax=Math.max(...opSeries.map(row=>row.carbonKg),1),annualPairs=opSeries.map((row,index)=>`${opSeries.length===1?160:index/(opSeries.length-1)*320},${42-row.carbonKg/annualMax*38}`),annualLine=annualPairs.map((point,index)=>`${index?'L':'M'} ${point}`).join(' '),areaPath=`M 0,45 ${annualPairs.map(point=>`L ${point}`).join(' ')} L 320,45 Z`;
      $('op-area').setAttribute('d',areaPath);$('op-line').setAttribute('d',annualLine);
    }else{$('lifetime-chart').innerHTML='<p class="empty-note">B6 unavailable: enter annual electricity consumption and select a location with an illustrative grid assumption, or provide a complete sourced grid-factor record. A zero value needs a consumption source and quality selection.</p>'; $('op-area').setAttribute('d','');$('op-line').setAttribute('d','');}
    $('reduction-table').innerHTML=(r.reductions.length?r.reductions.map(x=>`<div class="reduction-row"><span>${esc(x.name)}</span><strong>Unscored</strong><small>Intervention inputs and added impacts are not yet modelled.</small></div>`).join(''):'<p class="empty-note">Choose design interventions above; they will remain unscored until the affected inputs and added lifecycle impacts are supplied.</p>')+`<div class="reduction-row reduction-total"><span>Total reduction</span><strong>${r.base!=null&&r.selected!=null?fmt(t(r.base-r.selected),2)+' tCO₂e':'Unscored'}</strong></div>`;
    $('cost-inputs').innerHTML=r.reductions.map(x=>`<label>${esc(x.name)}<span>₹ <input type="number" min="0" step="1" data-cost="${x.id}" placeholder="Enter quote" /></span></label>`).join('')||'<p class="empty-note">Select options and add project quotes to compare cost and carbon.</p>';renderCosts();
    const budget=Number($('carbon-budget').value);$('budget-view').innerHTML=$('carbon-budget').value===''?'<p class="empty-note">Enter a lifecycle target to compare it with the prototype estimate.</p>':r.status!=='complete'||r.selected==null?'<p class="empty-note">Target comparison unavailable until a complete compatible whole-life total is calculated.</p>':`<div class="budget-numbers"><span>Target<strong>${fmt(budget,1)} t</strong></span><span>Selected<strong>${fmt(t(r.selected),1)} t</strong></span></div><div class="budget-track"><i style="width:${Math.min(100,t(r.selected)/Math.max(budget,.01)*100)}%"></i></div><div class="budget-state ${t(r.selected)<=budget?'within-budget':''}">${t(r.selected)<=budget?'WITHIN TARGET':`${fmt(t(r.selected)-budget,1)} t over target`}</div>`;
    $('scenario-notice').hidden=false;$('scenario-notice').textContent='Prototype estimate only. Material factors, quantity intensities, grid factors and intervention effects are illustrative assumptions with low confidence; verify against project data.';
    renderMixAlternatives();
  }

  function renderCosts(){
    if(!results)return;const rows=results.reductions.map(x=>({name:x.name,carbon:x.carbon,cost:Number(document.querySelector(`[data-cost="${x.id}"]`)?.value)})).filter(x=>Number.isFinite(x.cost));
    $('cost-plot').innerHTML=rows.length?`<div class="cost-frontier">${rows.map(x=>`<div class="reduction-row"><span>${esc(x.name)}</span><strong>₹${fmt(x.cost,0)} · ${fmt(t(x.carbon),2)} t avoided</strong><small>${x.carbon>0?`₹${fmt(x.cost/(x.carbon/1000),0)} per tCO₂e avoided`: 'No reduction quantified'}</small></div>`).join('')}</div>`:'<div class="plot-axis"><span class="plot-y-label">Carbon reduction</span><span class="plot-empty">Enter option quotes to compare cost and carbon</span></div><span class="plot-x-label">Additional cost (₹)</span>';
  }
  init();
})();
