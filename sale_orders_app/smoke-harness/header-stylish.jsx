// Smoke harness for ~/workspace/erp-table-migration/smoke-header-stylish.mjs —
// renders the REAL MetaGridHeader with the Round 5 STYLISH header designs
// (diagonal / ribbonfold / medallion / swoosh / watermark / premium) plus
// classic, in all 3 alignments, so the smoke can assert in a real browser:
// no render errors, the company name present, the design marker + graphic
// shapes present (and ABSENT for classic), band colors flowing into the
// shapes, and Premium Dark's gold accent staying gold. NOT part of the
// app build.
import '../src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MetaGridHeader } from '../src/components/ui/PrintSheetParts';
import { DEFAULT_LAYOUT_SETTINGS } from '../src/utils/printSchemaRegistry';

class Guard extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return <div data-error={String(this.state.err && this.state.err.message || this.state.err)} />;
    return this.props.children;
  }
}

const DESIGNS = ['classic', 'diagonal', 'ribbonfold', 'medallion', 'swoosh', 'watermark', 'premium'];
const ALIGNS = ['left', 'center', 'right'];

const metaRows = [
  { label: 'Order Date', value: '24/10/2026', key: 'date', strong: false },
  { label: 'Status', value: 'Pending', key: 'status', strong: false }
];
const party = { label: 'Customer', value: 'NADEEM LEATHER STORE' };

function MgCase({ design, align, extra = {} }) {
  const layout = { ...DEFAULT_LAYOUT_SETTINGS, headerDesign: design, headerAlign: align, ...extra };
  return (
    <MetaGridHeader
      layout={layout}
      companyName="FLASHVISION"
      companyLegal="Flashvision (Pvt) Limited"
      companyAddress="Plot 42-B, Industrial Zone Phase III, Karachi, Pakistan"
      party={party}
      metaRows={metaRows}
      docTitle="SALE ORDER"
      docSub="ORDER LIST"
    />
  );
}

function App() {
  return (
    <div>
      {DESIGNS.map((d) => ALIGNS.map((a) => (
        <div key={`${d}-${a}`} data-case={`mg-${d}-${a}`}>
          <Guard><MgCase design={d} align={a} /></Guard>
        </div>
      )))}
      <div data-case="mg-diagonal-colorA">
        <Guard><MgCase design="diagonal" align="left" extra={{ bandColor: '#4338ca', bandColor2: '#4f46e5' }} /></Guard>
      </div>
      <div data-case="mg-diagonal-colorB">
        <Guard><MgCase design="diagonal" align="left" extra={{ bandColor: '#dc2626', bandColor2: '#b91c1c' }} /></Guard>
      </div>
      <div data-case="mg-premium-colorA">
        <Guard><MgCase design="premium" align="left" extra={{ bandColor: '#4338ca', bandColor2: '#4f46e5' }} /></Guard>
      </div>
      <div data-case="mg-premium-colorB">
        <Guard><MgCase design="premium" align="left" extra={{ bandColor: '#dc2626', bandColor2: '#b91c1c' }} /></Guard>
      </div>
      <div data-case="mg-diagonal-plan">
        <Guard>
          <MetaGridHeader
            layout={{ ...DEFAULT_LAYOUT_SETTINGS, headerDesign: 'diagonal', headerAlign: 'left' }}
            companyName="AJ SYNTHETIC"
            companyLegal="AJ Synthetic Leather & Footwear Industries Pvt. Limited"
            companyAddress=""
            party={null}
            metaRows={metaRows}
            docTitle="Production Plan"
            docSub="ORDER LIST"
            planVariant
          />
        </Guard>
      </div>
      <pre id="trace" style={{ display: 'none' }} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);

setTimeout(() => {
  const trace = {};
  document.querySelectorAll('[data-case]').forEach((c) => {
    const shape = c.querySelector('[data-design-shape]');
    const shapeInfo = {};
    c.querySelectorAll('[data-design-shape]').forEach((s) => {
      const n = s.getAttribute('data-design-shape');
      if (!(n in shapeInfo)) {
        const cs = getComputedStyle(s);
        shapeInfo[n] = { bg: cs.backgroundImage || '', bgColor: cs.backgroundColor || '', color: cs.color || '' };
      }
    });
    trace[c.getAttribute('data-case')] = {
      error: c.querySelector('[data-error]')?.getAttribute('data-error') || null,
      text: c.textContent || '',
      design: c.querySelector('[data-header-design]')?.getAttribute('data-header-design') || null,
      shapes: c.querySelectorAll('[data-design-shape]').length,
      shapeBgImage: shape ? (getComputedStyle(shape).backgroundImage || '') : '',
      shapeInfo,
      bandText: (() => {
        const b = c.querySelector('.fv-bandtext');
        return b ? getComputedStyle(b).color : null;
      })()
    };
  });
  document.getElementById('trace').textContent = JSON.stringify(trace);
}, 1200);
