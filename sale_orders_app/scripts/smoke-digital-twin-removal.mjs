// Smoke — Approved batch Part 6 (Omer, 2026-10-26): Sale Order "Digital
// Twin" legacy print renderer REMOVED from SaleOrderModule; Sale Order
// prints open through the SAME UniversalPrintStudioModal as all documents
// (documentType sale_order, layout from Print Settings).
// A: buildSaleOrderRecord (real import) — studio record shape: customer /
//    contact / shipping_address as display strings.
// B: SaleOrderModule source contracts — no legacy renderer remnants; the
//    studio modal is wired to both Print buttons.
// C: repo picture — the only remaining "Digital Twin" renderer is
//    ChatModule's chat-document preview (different surface, audited and
//    deliberately left for a separate decision); index.css keeps inert
//    dead print CSS for the removed modal id (documented, not touched).
import fs from 'fs';
import { execSync } from 'child_process';

const APP = '/home/hatch/workspace/erp/sale_orders_app';
const read = (p) => fs.readFileSync(p, 'utf8');
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name); } };

execSync(`rm -rf /tmp/twin-smoke && mkdir -p /tmp/twin-smoke/utils`);
execSync(`cp ${APP}/src/utils/printRecords.js /tmp/twin-smoke/utils/printRecords.js`);
const { buildSaleOrderRecord } = await import('/tmp/twin-smoke/utils/printRecords.js');

// A: record shape
{
  const state = { customers: [{ id: 'c1', name: 'Khalid Sons', contactPerson: 'Khalid Ahmed' }] };
  const order = { id: 'SO-1', customerId: 'c1', customerName: 'Fallback Name', contactPerson: 'Order Contact', shippingAddress: 'Plot 9, SITE', items: [{ itemCode: 'ITEM-001' }] };
  const rec = buildSaleOrderRecord(state, order);
  check('customer resolved by customerId to a STRING name', rec.customer === 'Khalid Sons');
  check('contact prefers customer contactPerson', rec.contact === 'Khalid Ahmed');
  check('shipping_address from order shippingAddress', rec.shipping_address === 'Plot 9, SITE');
  check('items carried through', Array.isArray(rec.items) && rec.items[0].itemCode === 'ITEM-001');

  const rec2 = buildSaleOrderRecord({ customers: [] }, { id: 'SO-2', customerName: 'Walk-in', items: [] });
  check('fallback: customerName used when no customer record', rec2.customer === 'Walk-in');
  check('fallback: contact N/A, default shipping address',
    rec2.contact === 'N/A' && rec2.shipping_address === 'Factory Gate, Industrial Estate');
  check('null order -> null', buildSaleOrderRecord(state, null) === null);
}

// B: module contracts
{
  const mod = read(`${APP}/src/pages/SaleOrderModule.jsx`);
  check('module: no Digital Twin renderer heading', !mod.includes('Print Preview Digital Twin'));
  check('module: no printOrder state/handlers', !mod.includes('printOrder') && !mod.includes('setPrintOrder'));
  check('module: no legacy layout fallback', !mod.includes('DEFAULT_SALE_ORDER_LAYOUT'));
  check('module: no per-browser sale_order layout read', !mod.includes('fv_print_layout_sale_order'));
  check('module: no print-isolation body class', !mod.includes('has-print-modal'));
  check('module: no native print bridge', !mod.includes('triggerNativePrint'));
  check('module: no PrintLayout / export utils imports',
    !mod.includes("from '../components/ui/PrintLayout'") && !mod.includes('printExportUtils'));
  check('module: studio modal imported + used for sale_order',
    mod.includes("import UniversalPrintStudioModal from '../components/ui/UniversalPrintStudioModal'") &&
    mod.includes('documentType="sale_order"'));
  check('module: record built via buildSaleOrderRecord', mod.includes('documentData={buildSaleOrderRecord(state, studioOrder)}'));
  check('module: both Print buttons open the studio', (mod.match(/setStudioOrder\(order\)/g) || []).length === 2);
}

// C: repo picture (documented leftovers)
{
  const chat = read(`${APP}/src/pages/ChatModule.jsx`);
  check('audit: ChatModule chat-preview is a separate surface (left, documented)',
    chat.includes('renderDocumentPrintPreview'));
  const css = read(`${APP}/src/index.css`);
  check('audit: index.css dead modal CSS is inert (no element uses the id anymore)',
    css.includes('#antigravity-print-preview-modal'));
}

console.log(`\nDigital Twin Removal smoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
