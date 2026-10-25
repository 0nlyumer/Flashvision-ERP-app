// Smoke harness for ~/workspace/erp-table-migration/smoke-header-designs.mjs —
// renders the REAL MetaGridHeader / PrintTableSheet / PrintLayout with every
// graphic header design in all 3 alignments so the smoke can assert, in a
// real browser: no render errors, the company name present, the design
// marker present (and ABSENT for classic), and band colors flowing into the
// shapes. NOT part of the app build.
import '../src/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MetaGridHeader, PrintTableSheet } from '../src/components/ui/PrintSheetParts';
import PrintLayout from '../src/components/ui/PrintLayout';
import { AppProvider } from '../src/context/AppContext';
import { DEFAULT_LAYOUT_SETTINGS } from '../src/utils/printSchemaRegistry';

class Guard extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return <div data-error={String(this.state.err && this.state.err.message || this.state.err)} />;
    return this.props.children;
  }
}

const margins = { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' };
const DESIGNS = ['classic', 'ribbon', 'wave', 'sideblock', 'topstrip', 'frame'];
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

const columns = [
  { key: 'item_name', label: 'Item Name', width: '50%', align: 'left' },
  { key: 'qty', label: 'Qty', width: '25%', align: 'right', total: true },
  { key: 'amount', label: 'Amount', width: '25%', align: 'right', total: true }
];
const items = [
  { item_name: '170 PK DTY BLACK (WHITE)', qty: 1500, amount: 285000 },
  { item_name: '106 S PK COLLAR CREAM (PC WHITE)', qty: 1000, amount: 165000 }
];

// PrintLayout slip with a saved sideblock design (follow-up check: slips
// must render exactly as today — no graphic shapes — until ported).
try {
  localStorage.setItem('fv_print_layout_sale_order', JSON.stringify({ ...DEFAULT_LAYOUT_SETTINGS, headerDesign: 'sideblock' }));
} catch (e) { /* file:// storage may be unavailable */ }

function App() {
  return (
    <div>
      {DESIGNS.map((d) => ALIGNS.map((a) => (
        <div key={`${d}-${a}`} data-case={`mg-${d}-${a}`}>
          <Guard><MgCase design={d} align={a} /></Guard>
        </div>
      )))}
      <div data-case="mg-ribbon-colorA">
        <Guard><MgCase design="ribbon" align="left" extra={{ bandColor: '#4338ca', bandColor2: '#4f46e5' }} /></Guard>
      </div>
      <div data-case="mg-ribbon-colorB">
        <Guard><MgCase design="ribbon" align="left" extra={{ bandColor: '#dc2626', bandColor2: '#b91c1c' }} /></Guard>
      </div>
      <div data-case="mg-sideblock-plan">
        <Guard>
          <MetaGridHeader
            layout={{ ...DEFAULT_LAYOUT_SETTINGS, headerDesign: 'sideblock', headerAlign: 'left' }}
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
      <div data-case="sheet-wave-center">
        <Guard>
          <PrintTableSheet
            layout={{ ...DEFAULT_LAYOUT_SETTINGS, headerDesign: 'wave', headerAlign: 'center' }}
            companyName="FLASHVISION"
            companyLegal="Flashvision (Pvt) Limited"
            companyAddress="Plot 42-B, Industrial Zone Phase III, Karachi, Pakistan"
            party={party}
            metaRows={metaRows}
            docTitle="SALE ORDER"
            docSub="ORDER LIST"
            columns={columns}
            items={items}
            getCellValue={(k, row) => row[k]}
            columnTotals={{ qty: 2500, amount: 450000 }}
            margins={margins}
            paperWidth="210mm"
            paperHeight="297mm"
          />
        </Guard>
      </div>
      <div data-case="slip-sideblock-saved">
        <Guard>
          <AppProvider>
            <PrintLayout documentTitle="SALE ORDER" documentType="sale_order" date="24/10/2026" customerName="NADEEM LEATHER STORE">
              <p>slip body</p>
            </PrintLayout>
          </AppProvider>
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
    trace[c.getAttribute('data-case')] = {
      error: c.querySelector('[data-error]')?.getAttribute('data-error') || null,
      text: c.textContent || '',
      design: c.querySelector('[data-header-design]')?.getAttribute('data-header-design') || null,
      shapes: c.querySelectorAll('[data-design-shape]').length,
      shapeBgImage: shape ? (getComputedStyle(shape).backgroundImage || '') : '',
      bandText: (() => {
        const b = c.querySelector('.fv-bandtext');
        return b ? getComputedStyle(b).color : null;
      })()
    };
  });
  document.getElementById('trace').textContent = JSON.stringify(trace);
}, 1200);
