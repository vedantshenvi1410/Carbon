/* Demo catalog. Every numeric factor is illustrative, unverified, and low-confidence. */
window.CARBONWISE_DATA = {
  schemaVersion: '0.2-prototype',
  provenanceNote: 'All numeric records are illustrative assumptions for the hackathon demo, not product EPD data.',
  materials: [
    { id:'concrete', name:'Concrete', unit:'kg', factor:0.12, boundary:'A1–A3 proxy', region:'India demo; not verified', manufacturer:null, epdAvailable:false, applicability:'Generic prototype proxy', confidence:'Low', source:'Carbonwise prototype assumption', year:2026, color:'#739886' },
    { id:'steel', name:'Structural steel', unit:'kg', factor:1.85, boundary:'A1–A3 proxy', region:'India demo; not verified', manufacturer:null, epdAvailable:false, applicability:'Generic prototype proxy', confidence:'Low', source:'Carbonwise prototype assumption', year:2026, color:'#c9a174' },
    { id:'masonry', name:'Masonry', unit:'kg', factor:0.22, boundary:'A1–A3 proxy', region:'India demo; not verified', manufacturer:null, epdAvailable:false, applicability:'Generic prototype proxy', confidence:'Low', source:'Carbonwise prototype assumption', year:2026, color:'#8298a0' },
    { id:'glazing', name:'Glazing / finishes', unit:'kg', factor:1.1, boundary:'A1–A3 proxy', region:'India demo; not verified', manufacturer:null, epdAvailable:false, applicability:'Generic prototype proxy', confidence:'Low', source:'Carbonwise prototype assumption', year:2026, color:'#b4c3b9' }
  ],
  structureQuantityAssumptions: { rcc:[450,40,120,22], steel:[280,72,110,22], masonry:[180,18,260,19], composite:[340,55,115,22] },
  locationAssumptions: {
    Mumbai:{climate:'Warm humid',eui:115,grid:0.72}, Delhi:{climate:'Composite',eui:132,grid:0.71},
    Bengaluru:{climate:'Temperate',eui:92,grid:0.69}, Jaipur:{climate:'Hot dry',eui:126,grid:0.71}
  },
  buildingTypeFactors:{residential:1,commercial:1.72,institutional:1.28},
  mixCandidates:[
    {id:'m30-reference',label:'M30 reference',blend:'OPC reference',scored:false},
    {id:'m30-ggbs-20',label:'GGBS blend',blend:'20% GGBS candidate',scored:false},
    {id:'m30-ggbs-30',label:'GGBS blend',blend:'30% GGBS candidate',scored:false},
    {id:'m30-ggbs-40',label:'GGBS blend',blend:'40% GGBS candidate',scored:false},
    {id:'m30-flyash-25',label:'Fly ash blend',blend:'25% fly ash candidate',scored:false},
    {id:'m30-lc3',label:'LC3 / blended cement',blend:'Supplier formulation required',scored:false}
  ],
  methodology:{beeUrl:'https://beeindia.gov.in/WriteReadData/L45218/7534511430467336.pdf'}
};