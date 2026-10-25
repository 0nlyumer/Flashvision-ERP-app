// Smoke harness — auto-contrast detector vs gradient band (2026-10-25).
// Renders (1) the real PhaseMatrixSheet (purple gradient band, white title
// by design) and (2) a bare gradient band outside any print sheet, then
// starts the app's real initAutoContrastDetector, waits for its scans, and
// traces the band titles' final computed colors into #trace.
import '../src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PhaseMatrixSheet } from '../src/components/ui/PrintSheetParts';
import { initAutoContrastDetector } from '../src/utils/contrastDetector';
import { DEFAULT_LAYOUT_SETTINGS, DEFAULT_DOCUMENT_SCHEMAS } from '../src/utils/printSchemaRegistry';

const margins = { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' };
const bomRecord = {
  docTitle: 'BILL OF MATERIALS',
  docSub: 'A 106 PK DTY SOFT BROWN (PK DTY WHITE)',
  metaRows: [
    { key: 'Item Code', value: 'FG-077' },
    { key: 'Date', value: '11/07/2026' },
    { key: 'Basis', value: 'Per 1,000 Meters' }
  ],
  sections: [{
    code: 'FG-077', name: 'A 106 PK DTY SOFT BROWN',
    phases: [{ name: 'TOP Phase', rows: [{ name: 'PVC 682', qty: 100, uom: 'Kilograms (kg)' }], totals: [{ qty: 100, uom: 'Kilograms (kg)' }] }]
  }]
};
const bomLayout = { ...DEFAULT_LAYOUT_SETTINGS, ...(DEFAULT_DOCUMENT_SCHEMAS.bom_master || {}) };

function App() {
  return (
    <div>
      <div data-case="sheet">
        <PhaseMatrixSheet record={bomRecord} layout={bomLayout} companyName="AJ SYNTHETIC" companyLegal="AJ Synthetic Leather & Footwear Industries Pvt. Limited" margins={margins} paperWidth="297mm" paperHeight="210mm" />
      </div>
      <div data-case="bare" style={{ background: 'linear-gradient(90deg, #4338ca, #4f46e5)', padding: '10px 18px', borderRadius: '6px' }}>
        <div data-bare-title style={{ fontSize: '13pt', fontWeight: 700, color: '#ffffff' }}>BARE GRADIENT TITLE</div>
      </div>
      <pre id="trace" style={{ display: 'none' }}></pre>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);

setTimeout(() => {
  initAutoContrastDetector();
  // Initial scan fires ~50ms after init; the interval pulse re-scans at
  // 2.5s. Sample after both have had their chance to (wrongly) recolor.
  setTimeout(() => {
    const titles = [...document.querySelectorAll('div')].filter((e) => e.textContent === 'BILL OF MATERIALS');
    const bare = document.querySelector('[data-bare-title]');
    const out = {
      sheetTitleColor: titles.length ? getComputedStyle(titles[0]).color : null,
      sheetTitleFixed: titles.length ? titles[0].getAttribute('data-contrast-fixed') : null,
      bareTitleColor: bare ? getComputedStyle(bare).color : null,
      bareTitleFixed: bare ? bare.getAttribute('data-contrast-fixed') : null
    };
    document.getElementById('trace').textContent = JSON.stringify(out);
  }, 3200);
}, 300);
