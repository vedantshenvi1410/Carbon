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
  const fmt = (n,d=1) => {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
  };

  const t = kg => kg == null || !Number.isFinite(Number(kg)) ? null : Number(kg)/1000;
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function renderMixAlternatives() {
    const r = results;
    // No explicit project concrete volume / density is supplied, so mix totals stay unscored.
    const projectVolume = null;
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
    $('material-rows').innerHTML=materials.map(m=>`<tr><td class="material-name"><i class="material-swatch" style="background:${m.color}"></i>${m.name}<small>A1–A3 · illustrative factor</small></td><td><input type="number" min="0" step="any" data-q="${m.id}" aria-label="${m.name} quantity" /></td><td><input type="number" min="0" step="any" data-ef="${m.id}" aria-label="${m.name} factor" value="${m.ef}" /><small>kgCO₂e/kg · ${m.verificationStatus}</small></td><td class="carbon-cell" data-c="${m.id}">—</td></tr>`).join('');
    $('saved-status-text').textContent='Prototype demo loaded';$('side-project').nextElementSibling.textContent='Prototype demo · India';
    $('factor-detail').innerHTML='<strong>Prototype factor register · low confidence</strong><p>All material factors and quantity intensities are illustrative assumptions for demonstrating the workflow. They are not verified Indian EPD values. Replace with cited product data and confirm the system boundary before decisions.</p><div class="factor-record-grid">'+materials.map(m=>`<div><b>${esc(m.name)} · ${esc(m.confidence)} confidence</b><span>Factor: ${m.factor} kgCO₂e/kg · ${esc(m.boundary)}</span><span>Source: ${esc(m.source)} · ${m.publicationYear}</span><span>Region: ${esc(m.region)}</span><span>Manufacturer: ${m.manufacturer||'Not specified'} · EPD: ${m.epdAvailable?'available':'not supplied'}</span><span>Applicability: ${esc(m.applicability)}</span></div>`).join('')+'</div><p>Product-stage estimate = Σ(material quantity × illustrative A1–A3 factor). The demo does not claim certification.</p>';
    $('estimator-inputs').innerHTML=materials.map(m=>{const assumption=structures.rcc.find(x=>x.materialId===m.id);return `<label class="field">${m.name} <span class="unit">kg/m²</span><input type="number" min="0" step="any" data-intensity="${m.id}" value="${assumption?.intensity ?? ''}" /></label>`;}).join('');
    $('opportunity-grid').innerHTML=opts.map(o=>`<label class="opportunity-card"><input type="checkbox" data-option="${o.id}" /><span class="option-icon">↗</span><strong>${o.title}</strong><small>${o.detail}</small><b data-saving="${o.id}">Recalculate to estimate</b></label>`).join('');
    $('material-alternatives').querySelector('.panel-heading').innerHTML='<div><span class="section-kicker">MATERIAL ALTERNATIVES</span><h2>M30 mix candidates</h2><p class="panel-subtitle">Compare project-specific product data. Options remain unscored without supplier factors and engineer validation.</p></div><span class="mix-warning">UNSCORED UNTIL SOURCED</span>';
    $('material-alternatives').querySelector('.alternative-detail').innerHTML=`<div class="mix-context"><label class="field">Application<select id="mix-application"><option>Structural concrete</option><option>Slab / floor</option><option>Foundation</option><option>Non-structural</option></select></label><label class="field">Exposure<select id="mix-exposure"><option>General</option><option>Coastal / chloride</option><option>Sulphate</option><option>Other project exposure</option></select></label><div class="constraint-message"><strong>Eligibility needs project review</strong><span>Verify design strength, curing, durability, IS code requirements and supplier mix data with the project engineer. No universal GGBS cap is applied.</span></div></div><div class="mix-table-wrap"><table class="mix-table"><thead><tr><th>Candidate</th><th>Indicative composition</th><th>Carbon result</th><th>Validation</th></tr></thead><tbody>${DATA.mixCandidates.map((m,i)=>`<tr><td><strong>${String.fromCharCode(65+i)} · ${m.label}</strong></td><td>${m.blend}</td><td>Unscored · factor not supplied</td><td>Project / engineer check</td></tr>`).join('')}</tbody></table></div><div class="alternative-detail"><strong>Evidence needed</strong><p>Enter a supplier-specific EPD or declared A1–A3 factor for a like-for-like strength class, curing regime, exposure and functional unit. This screen does not assume that a mix is eligible or quantify savings.</p></div>`;
    $('method-detail').innerHTML='<div><strong>Prototype calculation</strong><p>Gross floor area = floor plate × floors. Material quantities = gross floor area × editable material-intensity assumptions. Product-stage A1–A3 = Σ(quantity × illustrative factor). B6 and other lifecycle modules are not included in a combined whole-life total without compatible sourced inputs.</p></div><div><strong>Assumption status</strong><p>All demo quantity intensities, material factors, city energy intensities, grid factors, and intervention effects are illustrative assumptions with low confidence. The sensitivity band is a simple ±25% prototype range, not a statistical uncertainty analysis. Replace with traceable project data before decisions.</p></div><div><strong>India context</strong><p>BEE ECSBC 2024 Appendix 6 is included as methodology context for embodied-carbon reporting. This prototype makes no compliance claim.</p><a href="https://beeindia.gov.in/WriteReadData/L45218/7534511430467336.pdf" target="_blank" rel="noreferrer">BEE · ECSBC 2024 ↗</a></div>';
    $('project-name').addEventListener('input',calculate);
    document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',calculate));
    document.addEventListener('input',event=>{if(event.target.matches('[data-cost]'))renderCosts();});
    ['floor-area','floors','structure','location','building-type'].forEach(id=>$(id).addEventListener('change',()=>{if(id==='structure'){const assumptions=structures[$('structure').value]||[];materials.forEach(m=>{const field=document.querySelector(`[data-intensity="${m.id}"]`);const assumption=assumptions.find(x=>x.materialId===m.id);if(field)field.value=assumption?.intensity ?? '';});}applyQuantities();calculate();}));

    $('annual-kwh').addEventListener('input',()=>{$('annual-kwh').dataset.userEdited='true';calculate();});
    $('estimate-quantities').addEventListener('click',applyQuantities);
    $('toggle-details').addEventListener('click',()=>{const x=$('factor-detail');x.hidden=!x.hidden;$('toggle-details').setAttribute('aria-expanded',String(!x.hidden));});
    $('method-toggle').addEventListener('click',()=>{const x=$('method-detail');x.hidden=!x.hidden;$('method-toggle').setAttribute('aria-expanded',String(!x.hidden));});
    $('print-report').addEventListener('click',()=>window.print()); $('footer-print').addEventListener('click',()=>window.print());
    document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.scroll)?.scrollIntoView({behavior:'smooth'})));
    applyQuantities(); calculate();
  }
  function applyQuantities(){
    const floorPlate=Number($('floor-area').value), floors=Number($('floors').value);
    const area=Number.isFinite(floorPlate)&&floorPlate>0&&Number.isInteger(floors)&&floors>0?floorPlate*floors:null;
    materials.forEach(m=>{const intensity=document.querySelector(`[data-intensity="${m.id}"]`); const qtyField=document.querySelector(`[data-q="${m.id}"]`); const raw=intensity?.value; const quantity=area==null?null:raw===''||raw==null?0:Number(raw)*area; if(qtyField)qtyField.value=Number.isFinite(quantity)?String(quantity):'';});
    $('estimator-area').textContent=`Gross floor area: ${fmt(area,1)} m²`; $('estimator-status').textContent='Quantities are area × editable prototype material intensity assumptions.'; calculate();
  }

  function calculate(){
    if(!document.querySelector('[data-q="concrete-opc"]'))return;

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
        factor: document.querySelector(`[data-ef="${m.id}"]`)?.value
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
          quantitySource: 'Prototype benchmark / user-editable input',
          quantityEvidence: 'Estimated GFA intensity assumption or explicit zero for a material not selected by this structure benchmark; not a measured takeoff',
          factor: m.factor,
          factorUnit: matData.factorUnit || '',
          factorYear: matData.publicationYear,
          module: matData.boundary || '',
          sourceName: matData.source || '',
          source: matData.sourceUrl,
          geography: matData.region,
          dataQuality: matData.confidence
        };
      }),
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
        customLosses: 'unknown'
      },
      replacements: { confirmNone: false }
    };

    // 2. Calculate baseline with sourced data only. Intervention cards remain available,
    // but are unscored until their actual input changes and added impacts are modelled.
    const detailedResults = CARBONWISE_ENGINE.calculate(detailedInput, DATA);

    // 4. Adapt result object for the existing render() function
    results = {
      area: detailedResults.grossFloorArea,
      years: detailedResults.studyPeriod,
      loc: DATA.locationAssumptions[input.location] || null,
      annualKwh: Number.isFinite(Number(input.annualKwh)) && input.annualKwh !== '' ? Number(input.annualKwh) : null,
      embodied: detailedResults.modules['A1–A3'].value,
      operational: detailedResults.operational,
      operationalStatus: detailedResults.modules.B6.status,
      operationalMetricUnit: detailedResults.modules.B6.metricUnit,
      operationalSeries: detailedResults.modules.B6.series,
      operationalWarnings: detailedResults.modules.B6.warnings,
      base: detailedResults.wholeLife,
      selected: input.selectedOptions.length ? null : detailedResults.wholeLife,
      lines: detailedResults.materialLines,
      reductions: input.selectedOptions.map(id=>({id,name:opts.find(x=>x.id===id)?.title||id,carbon:null})),
      status: detailedResults.complete ? 'complete' : 'incomplete'
    };

    // Baseline vs Selected
    results.base = detailedResults.wholeLife;

    render();
  }
  function render(){
    const r=results,red=r.base!=null&&r.selected!=null&&r.base>0?100*(r.base-r.selected)/r.base:null, intensity=r.area&&r.base!=null?r.base/r.area:null;
    $('crumb-project').textContent=$('project-name').value||'Demo Residence';$('side-project').textContent=$('crumb-project').textContent;
    $('print-project-meta').textContent=`${$('crumb-project').textContent} · ${$('location').value} · illustrative prototype`; $('print-building-meta').textContent=`${$('building-type').selectedOptions[0]?.text||'Residential'} · ${fmt(r.area,0)} m² GFA · ${r.years}-year estimate`;
    $('study-stamp').textContent=r.years??'—';$('lifecycle-total').textContent=fmt(t(r.base));$('embodied-total').textContent=fmt(t(r.embodied));$('operational-total').textContent=fmt(t(r.operational));$('operational-unit').textContent=`t${r.operationalMetricUnit==='kgCO2e/kWh'?'CO₂e':'CO₂'}`;$('intensity-value').textContent=`${fmt(intensity,1)} kgCO₂e / m²`;
    $('embodied-share').textContent='A1–A3 product-stage subtotal · partial scope';$('annual-energy').textContent=`${fmt(r.annualKwh,0)} kWh / year`;$('annual-grid').textContent=r.operationalStatus==='provisional'?`PROVISIONAL · illustrative ${r.loc?.grid ?? '—'} kgCO₂/kWh for ${$('location').value}; fuel excluded`:(r.operationalStatus==='complete'?'B6 calculated with sourced factor and inputs':'Enter annual electricity and select a location or complete a sourced grid factor');
    $('metric-uncertainty').textContent=r.base==null?'Whole-life total unavailable: required lifecycle modules and compatible sourced factors are missing.':`Illustrative sensitivity range ${fmt(t(r.base*.75),1)}–${fmt(t(r.base*1.25),1)} tCO₂e (±25%) · low confidence`;$('lifecycle-status').textContent=r.status==='complete'?'COMPLETE FOR DECLARED SCOPE':'PARTIAL · INPUTS MISSING';$('op-final-year').textContent=`YEAR ${r.years??'—'}`;
    $('profile-intensity').innerHTML=`${fmt(intensity,1)} <small>kgCO₂e/m²</small>`;$('profile-energy').innerHTML=`${fmt(r.annualKwh,0)} <small>kWh/year</small>`;$('profile-lifetime').innerHTML=`${r.years??'—'} <small>years</small>`;$('scope-caption').textContent='PRODUCT-STAGE A1–A3 PARTIAL ESTIMATE · B6 AND OTHER A–C MODULES UNAVAILABLE';
    $('donut-total').textContent=fmt(t(r.base));const ep=r.base!=null&&r.embodied!=null?r.embodied/r.base*100:null;$('donut').style.background=ep==null?'#edf1ef':`conic-gradient(#739886 0 ${ep}%,#c9dcd2 ${ep}% 100%)`;$('donut-legend').innerHTML=ep==null?'<div class="legend-row"><i></i><span>Whole-life shares unavailable</span><strong>—</strong></div>':`<div class="legend-row"><i></i><span>Non-B6 A–C lifecycle</span><strong>${fmt(ep,1)}%</strong></div><div class="legend-row"><i></i><span>Operational · B6</span><strong>${fmt(100-ep,1)}%</strong></div>`;
    $('total-line-embodied').style.width=`${ep??0}%`;$('total-line-operational').style.width=`${ep==null?0:100-ep}%`;
    r.lines.forEach(x=>{const el=document.querySelector(`[data-c="${x.id}"]`);if(el)el.textContent=`${fmt(x.carbon,0)} kg`;});
    $('embodied-bars').innerHTML=r.lines.map(x=>`<i title="${x.name}: ${fmt(x.carbon,0)} kgCO₂e" style="height:${x.carbon==null?0:Math.max(7,r.embodied?x.carbon/r.embodied*100:0)}%"></i>`).join('');
    const score=red==null?null:Math.max(0,Math.min(100,Math.round(red)));$('score-value').textContent=score==null?'—':String(score);$('score-track').style.width=`${score??0}%`;$('score-copy').textContent=red==null?'No comparable complete baseline/scenario total is available; selected interventions remain unscored.':'Prototype comparison only; not a certification or benchmark.';
    $('confidence-value').textContent='LOW';$('quality-project-bar').style.width='0%';$('quality-source-bar').style.width='0%';$('quality-missing-bar').style.width='100%';$('quality-legend').innerHTML='<span><i class="q-assumed"></i><strong>100%</strong> preliminary assumptions · low confidence</span>';$('quality-foot').textContent='Replace demo assumptions with project quantities, supplier EPDs, and cited energy data.';
    $('optimised-total').textContent=fmt(t(r.selected));$('reduction-chip').textContent=red==null?'UNSCORED':`${fmt(red,1)}% reduction`; $('opportunity-count').textContent=String(r.reductions.length);
    r.reductions.forEach(x=>{const el=document.querySelector(`[data-saving="${x.id}"]`);if(el)el.textContent='Unscored · intervention inputs and impacts not modelled';});
    $('comparison-summary').innerHTML=`<div><small>BASELINE · PARTIAL SCOPE</small><strong>${fmt(t(r.base))} <i>tCO₂e</i></strong><span>Product-stage subtotal ${fmt(t(r.embodied))} tCO₂e · B6 ${fmt(t(r.operational))} t${r.operationalMetricUnit==='kgCO2e/kWh'?'CO₂e':'CO₂'}</span></div><div><small>SELECTED DESIGN</small><strong>${fmt(t(r.selected))} <i>tCO₂e</i></strong><span>${r.reductions.length?esc(r.reductions.map(x=>x.name).join(' · ')):'No interventions selected'}</span></div><div class="avoided-stat"><small>ESTIMATED CHANGE</small><strong>${r.base!=null&&r.selected!=null?`${fmt(t(r.base-r.selected),2)} tCO₂e · ${fmt(red,1)}%`:'Unscored'}</strong><span>Requires comparable complete totals and validated intervention inputs.</span></div>`;
    $('lifecycle-chart').innerHTML=[['A1–A3 · product',r.embodied,'CO₂e'],['B6 · operational',r.operational,r.operationalMetricUnit==='kgCO2e/kWh'?'CO₂e':'CO₂']].map(x=>`<div class="stacked-row"><span>${x[0]}</span><div class="stacked-track"><i class="stack-embodied" style="width:${r.base!=null&&x[1]!=null?x[1]/r.base*100:0}%"></i></div><strong>${fmt(t(x[1]),2)} tCO₂${x[2]==='CO₂e'?'e':''}</strong></div>`).join('')+'<div class="chart-legend">Modules are shown separately; provisional CO₂ B6 is not comparable with CO₂e A1–A3 and is excluded from the whole-life total.</div>';
    $('material-chart').innerHTML=r.lines.map(x=>`<div class="pareto-row"><span>${x.name}</span><div><i style="width:${r.embodied?x.carbon/r.embodied*100:0}%"></i></div><strong>${fmt(t(x.carbon),2)} t</strong></div>`).join('');
    $('scenario-chart').innerHTML=`<div class="scenario-row unscored"><span>Baseline</span><div><i style="width:0%"></i></div><strong>${fmt(t(r.base),2)} t</strong></div><div class="scenario-row unscored"><span>Selected</span><div><i style="width:0%"></i></div><strong>${fmt(t(r.selected),2)} t</strong></div>`;
    const opSeries=r.operationalSeries?.annual||[];
    if(opSeries.length){
      const max=Math.max(...opSeries.map(row=>row.cumulativeKg),1),pointPairs=opSeries.map((row,index)=>`${opSeries.length===1?160:index/(opSeries.length-1)*320},${42-row.cumulativeKg/max*38}`),points=pointPairs.join(' '),linePath=pointPairs.map((point,index)=>`${index?'L':'M'} ${point}`).join(' ');
      $('lifetime-chart').innerHTML=`<svg viewBox="0 0 320 45" preserveAspectRatio="none" role="img" aria-label="Cumulative provisional operational electricity emissions in kilograms of carbon dioxide"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2"/></svg><p class="empty-note">Year 1: ${fmt(t(opSeries[0].carbonKg),3)} tCO₂ · study-period electricity: ${fmt(t(r.operational),2)} tCO₂. ${esc((r.operationalWarnings||[]).join(' '))}</p>`;
      const annualMax=Math.max(...opSeries.map(row=>row.carbonKg),1),annualPairs=opSeries.map((row,index)=>`${opSeries.length===1?160:index/(opSeries.length-1)*320},${42-row.carbonKg/annualMax*38}`),annualLine=annualPairs.map((point,index)=>`${index?'L':'M'} ${point}`).join(' '),areaPath=`M 0,45 ${annualPairs.map(point=>`L ${point}`).join(' ')} L 320,45 Z`;
      $('op-area').setAttribute('d',areaPath);$('op-line').setAttribute('d',annualLine);
    }else{$('lifetime-chart').innerHTML='<p class="empty-note">B6 unavailable: enter annual electricity consumption and select a location with an illustrative grid assumption, or provide a complete sourced grid-factor record. A zero value needs a consumption source and quality selection.</p>'; $('op-area').setAttribute('d','');$('op-line').setAttribute('d','');}
    $('reduction-table').innerHTML=(r.reductions.length?r.reductions.map(x=>`<div class="reduction-row"><span>${esc(x.name)}</span><strong>Unscored</strong><small>Intervention inputs and added impacts are not yet modelled.</small></div>`).join(''):'<p class="empty-note">Choose design interventions above; they will remain unscored until the affected inputs and added lifecycle impacts are supplied.</p>')+`<div class="reduction-row reduction-total"><span>Total reduction</span><strong>${r.base!=null&&r.selected!=null?fmt(t(r.base-r.selected),2)+' tCO₂e':'Unscored'}</strong></div>`;
    $('cost-inputs').innerHTML=r.reductions.map(x=>`<label>${esc(x.name)}<span>₹ <input type="number" min="0" step="1" data-cost="${x.id}" placeholder="Enter quote" /></span></label>`).join('')||'<p class="empty-note">Select options and add project quotes to compare cost and carbon.</p>';renderCosts();
    const budget=Number($('carbon-budget').value);$('budget-view').innerHTML=$('carbon-budget').value===''?'<p class="empty-note">Enter a lifecycle target to compare it with the prototype estimate.</p>':r.selected==null?'<p class="empty-note">Target comparison unavailable until a complete compatible scenario total is calculated.</p>':`<div class="budget-numbers"><span>Target<strong>${fmt(budget,1)} t</strong></span><span>Selected<strong>${fmt(t(r.selected),1)} t</strong></span></div><div class="budget-track"><i style="width:${Math.min(100,t(r.selected)/Math.max(budget,.01)*100)}%"></i></div><div class="budget-state ${t(r.selected)<=budget?'within-budget':''}">${t(r.selected)<=budget?'WITHIN TARGET':`${fmt(t(r.selected)-budget,1)} t over target`}</div>`;
    $('scenario-notice').hidden=false;$('scenario-notice').textContent='Prototype estimate only. Material factors, quantity intensities, grid factors and intervention effects are illustrative assumptions with low confidence; verify against project data.';
    renderMixAlternatives();
  }

  function renderCosts(){
    if(!results)return;const rows=results.reductions.map(x=>({name:x.name,carbon:x.carbon,cost:Number(document.querySelector(`[data-cost="${x.id}"]`)?.value)})).filter(x=>Number.isFinite(x.cost));
    $('cost-plot').innerHTML=rows.length?`<div class="cost-frontier">${rows.map(x=>`<div class="reduction-row"><span>${esc(x.name)}</span><strong>₹${fmt(x.cost,0)} · ${fmt(t(x.carbon),2)} t avoided</strong><small>${x.carbon>0?`₹${fmt(x.cost/(x.carbon/1000),0)} per tCO₂e avoided`: 'No reduction quantified'}</small></div>`).join('')}</div>`:'<div class="plot-axis"><span class="plot-y-label">Carbon reduction</span><span class="plot-empty">Enter option quotes to compare cost and carbon</span></div><span class="plot-x-label">Additional cost (₹)</span>';
  }
  init();
})();
