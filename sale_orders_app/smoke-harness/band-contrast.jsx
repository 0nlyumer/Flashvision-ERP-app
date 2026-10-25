// Smoke harness for ~/workspace/erp-table-migration/smoke-band-contrast.mjs — renders the REAL print components (incl. the full Universal Print Studio) with realistic saved-layout values so the smoke can assert the band title's final computed color in a real browser. NOT part of the app build.
import '../src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PhaseMatrixSheet, MetaGridHeader } from '../src/components/ui/PrintSheetParts';
import UniversalPrintStudioModal from '../src/components/ui/UniversalPrintStudioModal';
import { AppProvider } from '../src/context/AppContext';
import { DialogProvider } from '../src/context/DialogContext';
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
      <div data-case="bom-default">
        <PhaseMatrixSheet record={bomRecord} layout={bomLayout} companyName="AJ SYNTHETIC" companyLegal="AJ Synthetic Leather & Footwear Industries Pvt. Limited" margins={margins} paperWidth="297mm" paperHeight="210mm" />
      </div>
      <div data-case="bom-hsl-dark-text">
        <PhaseMatrixSheet record={bomRecord} layout={{ ...bomLayout, bandColor: 'hsl(243, 75%, 59%)', bandColor2: 'hsl(243, 75%, 65%)', bandTextColor: '#1b1e2e' }} companyName="AJ SYNTHETIC" companyLegal="AJ Synthetic Leather & Footwear Industries Pvt. Limited" margins={margins} paperWidth="297mm" paperHeight="210mm" />
      </div>
      <div data-case="bom-named-dark-text">
        <PhaseMatrixSheet record={bomRecord} layout={{ ...bomLayout, bandColor: 'indigo', bandColor2: 'indigo', bandTextColor: '#000000' }} companyName="AJ SYNTHETIC" companyLegal="AJ Synthetic Leather & Footwear Industries Pvt. Limited" margins={margins} paperWidth="297mm" paperHeight="210mm" />
      </div>
      <div data-case="studio-modal">
        <AppProvider>
          <DialogProvider>
            <UniversalPrintStudioModal isOpen onClose={() => {}} documentType="bom_master" documentData={null} />
          </DialogProvider>
        </AppProvider>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);

setTimeout(() => {
  const bands = [];
  document.querySelectorAll('div').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.backgroundImage && cs.backgroundImage.includes('linear-gradient') && el.querySelector('div')) {
      const kids = [...el.querySelectorAll('div')];
      if (!kids.length) return;
      const path = [];
      let p = el;
      for (let i = 0; i < 5 && p; i++) { path.push((p.className && typeof p.className === 'string' ? p.className : p.tagName).slice(0, 40)); p = p.parentElement; }
      bands.push({
        text: (el.textContent || '').slice(0, 40),
        bandColor: cs.color,
        titleColor: getComputedStyle(kids[0]).color,
        titleInline: kids[0].getAttribute('style'),
        ancestors: path
      });
    }
  });
  const pre = document.createElement('pre');
  pre.id = 'trace';
  pre.textContent = JSON.stringify(bands, null, 1);
  document.body.appendChild(pre);
  document.title = 'TRACE_DONE';
}, 4000);
