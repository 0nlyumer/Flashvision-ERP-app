// Smoke — OMS "In Stock" column (Omer, 2026-10-26): the OMS (Sale Orders)
// item-wise list gains an "In Stock (m)" column right after Order Metres,
// showing the line item's CURRENT in-stock quantity — the meter-grade total
// (A + A2 + B) from item.stockByType, kg grades (Cut piece / Wastage)
// never mixed in. Display-only: no flow logic touched.
// A: getLineInStock / inStockCoversOrder / formatStockMeters — the REAL
//    util (src/utils/omsInStock.js) imported and run on fixtures.
// B: source contracts — SaleOrderModule wires the column into the
//    item-wise table (header placement + cell), order-wise untouched.
import fs from 'fs';
import { execSync } from 'child_process';

const APP = '/home/hatch/workspace/erp/sale_orders_app';
const read = (p) => fs.readFileSync(p, 'utf8');
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name); } };

execSync(`rm -rf /tmp/oms-instock-smoke && mkdir -p /tmp/oms-instock-smoke/utils`);
execSync(`cp ${APP}/src/utils/stockReportUtils.js /tmp/oms-instock-smoke/utils/stockReportUtils.js`);
execSync(`cp ${APP}/src/utils/omsInStock.js /tmp/oms-instock-smoke/utils/omsInStock.js`);
const { getLineInStock, inStockCoversOrder, formatStockMeters } = await import('/tmp/oms-instock-smoke/utils/omsInStock.js');

const TYPES = [
  { name: 'A', uom: 'Meters' },
  { name: 'A2', uom: 'Meters' },
  { name: 'B', uom: 'Meters' },
  { name: 'Cut piece', uom: 'Kilograms' },
  { name: 'Wastage', uom: 'Kilograms', category: 'Wastage' },
];

// --- A: the figure maths -------------------------------------------------
{
  // Known stock: 700 + 300 + 200 = 1,200 m across the meter grades; the
  // 40 kg Cut piece and 10 kg Wastage must NOT leak into the metres figure.
  const known = {
    id: 'FG-001', sku: 'FG-001', name: '170 PK DTY BLACK (WHITE)',
    department: 'Finishing', packingSize: 50,
    stock: 1250,
    stockByDepartment: { Finishing: 1250 },
    stockByType: { A: 700, A2: 300, B: 200, 'Cut piece': 40, Wastage: 10 },
  };
  const r = getLineInStock(known, TYPES);
  check('known item: meters = A+A2+B = 1200 exactly', r.meters === 1200);
  check('known item: kg grades excluded (not 1250)', r.meters !== 1250);
  check('known item: rolls = 1200 / 50 = 24', r.rolls === 24);

  // Stock split across two departments — the grade split is global, the
  // metres total is unchanged.
  const split = {
    ...known,
    stockByDepartment: { Production: 500, Finishing: 750 },
  };
  check('split departments: meters still 1200', getLineInStock(split, TYPES).meters === 1200);

  // Zero stock — stored zeros and a never-stocked item both read 0.
  const zeroTyped = { ...known, stock: 0, stockByDepartment: { Finishing: 0 }, stockByType: { A: 0, A2: 0, B: 0 } };
  check('zero-stock item (typed zeros): meters = 0', getLineInStock(zeroTyped, TYPES).meters === 0);
  const neverStocked = { id: 'FG-002', sku: 'FG-002', name: 'X', department: 'Finishing', stock: 0 };
  check('never-stocked item: meters = 0', getLineInStock(neverStocked, TYPES).meters === 0);
  check('never-stocked item: rolls = 0 (packing unknown -> null or 0)', [null, 0].includes(getLineInStock(neverStocked, TYPES).rolls));

  // An item holding ONLY kg grades has 0 metres in stock.
  const kgOnly = { ...known, stock: 40, stockByDepartment: { Finishing: 40 }, stockByType: { 'Cut piece': 40 } };
  check('kg-only item: meters = 0 (kg never shown as metres)', getLineInStock(kgOnly, TYPES).meters === 0);

  // Untyped legacy item: department total is the figure (as InvStock reads it).
  const untyped = { id: 'FG-003', sku: 'FG-003', name: 'Y', department: 'Finishing', stock: 500, stockByDepartment: { Finishing: 500 } };
  check('untyped item with dept stock: meters = 500', getLineInStock(untyped, TYPES).meters === 500);
  const untypedBare = { id: 'FG-004', sku: 'FG-004', name: 'Z', department: '', stock: 300 };
  check('untyped item, no dept map: falls back to item.stock = 300', getLineInStock(untypedBare, TYPES).meters === 300);

  // Missing item record (deleted master) must not crash and reads 0.
  check('missing item: meters = 0', getLineInStock(undefined, TYPES).meters === 0);
  check('null item: meters = 0', getLineInStock(null, TYPES).meters === 0);

  // No packing size -> rolls null (cell shows metres only).
  const noPacking = { ...known };
  delete noPacking.packingSize;
  check('no packing size: rolls = null', getLineInStock(noPacking, TYPES).rolls === null);
}

// --- A2: cover test + formatting ------------------------------------------
{
  check('covers: 1200 >= 1000', inStockCoversOrder(1200, 1000) === true);
  check('covers: 1200 >= 1200 (exact)', inStockCoversOrder(1200, 1200) === true);
  check('covers: 1200 < 1201', inStockCoversOrder(1200, 1201) === false);
  check('covers: zero stock never covers', inStockCoversOrder(0, 500) === false);
  check('covers: zero order qty is not a cover', inStockCoversOrder(500, 0) === false);
  check('format: 1200 -> "1,200"', formatStockMeters(1200) === '1,200');
  check('format: 0 -> "0"', formatStockMeters(0) === '0');
  check('format: 24 -> "24"', formatStockMeters(24) === '24');
  check('format: 1234.5 -> "1,234.5"', formatStockMeters(1234.5) === '1,234.5');
}

// --- B: source contracts ----------------------------------------------------
{
  const src = read(`${APP}/src/pages/SaleOrderModule.jsx`);
  check('module imports the omsInStock util', src.includes("from '../utils/omsInStock'"));
  check('module calls getLineInStock for the row item', src.includes('getLineInStock(prodObj, state.batchOutputTypes)'));

  // Anchor inside the ITEM-WISE table (the order-wise table has its own
  // "Order Metres"/"Output (m)" headers earlier in the file).
  const tableStart = src.indexOf('ITEM-WISE TABLE');
  const headerIdx = src.indexOf('In Stock (m)', tableStart);
  const orderMetresIdx = src.indexOf('Order Metres', tableStart);
  const outputIdx = src.indexOf('Output (m)', tableStart);
  check('header "In Stock (m)" exists in item-wise table', tableStart > -1 && headerIdx > -1);
  check('header sits AFTER "Order Metres"', orderMetresIdx > -1 && headerIdx > orderMetresIdx);
  check('header sits BEFORE "Output (m)"', outputIdx > -1 && headerIdx < outputIdx);
  check('exactly one "In Stock (m)" header (item-wise only)', src.split('In Stock (m)').length - 1 === 1);
  check('cover highlight wired (emerald + check_circle)', src.includes('text-emerald-600') && src.includes('check_circle'));
  check('zero renders as a figure, not blank (formatStockMeters used in cell)', src.includes('formatStockMeters(inStock.meters)'));
  check('rolls sub-line wired', src.includes('inStock.rolls != null'));
  check('empty-row colSpan widened to 10', src.includes('colSpan="10"'));
}

console.log(`\nsmoke-oms-instock: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
