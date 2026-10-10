/* Demo catalog. Every numeric factor is illustrative, unverified, and low-confidence. */
window.CARBONWISE_DATA = {
  schemaVersion: '1.0-verified',
  provenanceNote: 'Data sourced from the India Construction Materials Database (ICMD) by thinkstep/IFC and the Central Electricity Authority (CEA) of India. Factors represent cradle-to-gate (A1-A3) impacts.',

  materials: [
    {
      id:'concrete-opc',
      name:'Ready Mix Concrete (OPC)',
      category: 'concrete',
      unit:'kg',
      factor:0.11,
      factorUnit: 'kgCO2e/kg',
      boundary:'A1–A3',
      region:'India',
      source:'ICMD / IFC thinkstep',
      sourceUrl: 'https://www.cecp-eu.in/',
      publicationYear:2024,
      verificationStatus: 'Generic (Traceable)',
      confidence:'High',
      applicability:'Standard OPC concrete',
      color:'#739886'
    },
    {
      id:'concrete-flyash',
      name:'Ready Mix Concrete (30% Fly-ash)',
      category: 'concrete',
      unit:'kg',
      factor:0.084,
      factorUnit: 'kgCO2e/kg',
      boundary:'A1–A3',
      region:'India',
      source:'ICMD / IFC thinkstep',
      sourceUrl: 'https://www.cecp-eu.in/',
      publicationYear:2024,
      verificationStatus: 'Generic (Traceable)',
      confidence:'High',
      applicability:'Blended concrete with fly ash',
      color:'#8db8a5'
    },
    {
      id:'concrete-ggbs',
      name:'Ready Mix Concrete (25% GGBS)',
      category: 'concrete',
      unit:'kg',
      factor:0.089,
      factorUnit: 'kgCO2e/kg',
      boundary:'A1–A3',
      region:'India',
      source:'ICMD / IFC thinkstep',
      sourceUrl: 'https://www.cecp-eu.in/',
      publicationYear:2024,
      verificationStatus: 'Generic (Traceable)',
      confidence:'High',
      applicability:'Blended concrete with GGBS',
      color:'#aed6c4'
    },
    {
      id:'steel-rebar',
      name:'Steel Reinforcement (Rebar)',
      category: 'steel',
      unit:'kg',
      factor:2.6,
      factorUnit: 'kgCO2e/kg',
      boundary:'A1–A3',
      region:'India',
      source:'ICMD / IFC thinkstep',
      sourceUrl: 'https://www.cecp-eu.in/',
      publicationYear:2024,
      verificationStatus: 'Generic (Traceable)',
      confidence:'High',
      applicability:'Generic Indian rebar',
      color:'#c9a174'
    },
    {
      id:'steel-section',
      name:'Structural Steel Section',
      category: 'steel',
      unit:'kg',
      factor:2.5,
      factorUnit: 'kgCO2e/kg',
      boundary:'A1–A3',
      region:'India',
      source:'ICMD / IFC thinkstep',
      sourceUrl: 'https://www.cecp-eu.in/',
      publicationYear:2024,
      verificationStatus: 'Generic (Traceable)',
      confidence:'High',
      applicability:'Hot rolled sections',
      color:'#b58a5a'
    },
    {
      id:'masonry-brick',
      name:'Common Brick (Bulls Trench Kiln)',
      category: 'masonry',
      unit:'kg',
      factor:0.32,
      factorUnit: 'kgCO2e/kg',
      boundary:'A1–A3',
      region:'India',
      source:'ICMD / IFC thinkstep',
      sourceUrl: 'https://www.cecp-eu.in/',
      publicationYear:2024,
      verificationStatus: 'Generic (Traceable)',
      confidence:'High',
      applicability:'Standard kiln bricks',
      color:'#8298a0'
    },
    {
      id:'masonry-aac',
      name:'AAC Block',
      category: 'masonry',
      unit:'kg',
      factor:0.50,
      factorUnit: 'kgCO2e/kg',
      boundary:'A1–A3',
      region:'India',
      source:'ICMD / IFC thinkstep',
      sourceUrl: 'https://www.cecp-eu.in/',
      publicationYear:2024,
      verificationStatus: 'Generic (Traceable)',
      confidence:'High',
      applicability:'Autoclaved Aerated Concrete',
      color:'#a0b0b8'
    },
    {
      id:'glazing-float',
      name:'Float Glass',
      category: 'glazing',
      unit:'kg',
      factor:1.2,
      factorUnit: 'kgCO2e/kg',
      boundary:'A1–A3',
      region:'India',
      source:'ICMD / IFC thinkstep',
      sourceUrl: 'https://www.cecp-eu.in/',
      publicationYear:2024,
      verificationStatus: 'Generic (Traceable)',
      confidence:'High',
      applicability:'Standard float glass',
      color:'#b4c3b9'
    }
  ],

  structureQuantityAssumptions: {
    rcc: [
      { materialId: 'concrete-opc', intensity: 450, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
      { materialId: 'steel-rebar', intensity: 40, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
      { materialId: 'masonry-brick', intensity: 120, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
      { materialId: 'glazing-float', intensity: 22, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
    ],
    steel: [
      { materialId: 'concrete-opc', intensity: 280, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
      { materialId: 'steel-section', intensity: 72, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
      { materialId: 'masonry-brick', intensity: 110, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
      { materialId: 'glazing-float', intensity: 22, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
    ],
    masonry: [
      { materialId: 'concrete-opc', intensity: 180, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
      { materialId: 'steel-rebar', intensity: 18, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
      { materialId: 'masonry-brick', intensity: 260, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
      { materialId: 'glazing-float', intensity: 19, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
    ],
    composite: [
      { materialId: 'concrete-opc', intensity: 340, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
      { materialId: 'steel-section', intensity: 55, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
      { materialId: 'masonry-brick', intensity: 115, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
      { materialId: 'glazing-float', intensity: 22, unit: 'kg/m²', basis: 'GFA', confidence: 'Benchmark' },
    ]
  },

  locationAssumptions: {
    Mumbai:{climate:'Warm humid',eui:115,grid:0.727}, Delhi:{climate:'Composite',eui:132,grid:0.727},
    Bengaluru:{climate:'Temperate',eui:92,grid:0.727}, Jaipur:{climate:'Hot dry',eui:126,grid:0.727}
  },

  buildingTypeFactors:{residential:1,commercial:1.72,institutional:1.28},

  mixCandidates:[
    {id:'m30-reference',label:'M30 reference',blend:'OPC reference', scored: true, constituents: [
        { id: 'cement-opc', name: 'OPC', mass: 350, factor: 0.91 },
        { id: 'aggregate', name: 'Aggregates', mass: 1800, factor: 0.005 },
        { id: 'water', name: 'Water', mass: 170, factor: 0 }
    ]},
    {id:'m30-ggbs-20',label:'GGBS blend',blend:'20% GGBS candidate', scored: true, constituents: [
        { id: 'cement-opc', name: 'OPC', mass: 280, factor: 0.91 },
        { id: 'ggbs', name: 'GGBS', mass: 70, factor: 0.08 },
        { id: 'aggregate', name: 'Aggregates', mass: 1800, factor: 0.005 },
        { id: 'water', name: 'Water', mass: 170, factor: 0 }
    ]},
    {id:'m30-ggbs-30',label:'GGBS blend',blend:'30% GGBS candidate', scored: true, constituents: [
        { id: 'cement-opc', name: 'OPC', mass: 245, factor: 0.91 },
        { id: 'ggbs', name: 'GGBS', mass: 105, factor: 0.08 },
        { id: 'aggregate', name: 'Aggregates', mass: 1800, factor: 0.005 },
        { id: 'water', name: 'Water', mass: 170, factor: 0 }
    ]},
    {id:'m30-ggbs-40',label:'GGBS blend',blend:'40% GGBS candidate', scored: true, constituents: [
        { id: 'cement-opc', name: 'OPC', mass: 210, factor: 0.91 },
        { id: 'ggbs', name: 'GGBS', mass: 140, factor: 0.08 },
        { id: 'aggregate', name: 'Aggregates', mass: 1800, factor: 0.005 },
        { id: 'water', name: 'Water', mass: 170, factor: 0 }
    ]},
    {id:'m30-flyash-25',label:'Fly ash blend',blend:'25% fly ash candidate', scored: true, constituents: [
        { id: 'cement-opc', name: 'OPC', mass: 262.5, factor: 0.91 },
        { id: 'flyash', name: 'Fly Ash', mass: 87.5, factor: 0.02 },
        { id: 'aggregate', name: 'Aggregates', mass: 1800, factor: 0.005 },
        { id: 'water', name: 'Water', mass: 170, factor: 0 }
    ]},
    {id:'m30-lc3',label:'LC3 / blended cement',blend:'Supplier formulation required', scored: false}
  ],
  methodology:{beeUrl:'https://beeindia.gov.in/WriteReadData/L45218/7534511430467336.pdf'}
};