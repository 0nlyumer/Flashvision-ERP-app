// --- Print design system (approved family, 2026-10-24) --------------------
// Shared helpers for the print implementation bundle: margin presets,
// Excel-style scaling modes, amount-in-words, and the phase-matrix record
// builders for BOM / Consumption prints. The visual language comes from the
// approved samples (Meta-Grid header + accent title band + dark table header
// for large documents; Phase-Matrix landscape for BOM / Consumption /
// Salary Sheet). Colors and alignment are layout-config driven so they stay
// changeable from Print Settings & Layout.

// --- Margin presets ---------------------------------------------------------
// The sheet model carries its margins as internal padding (@page margin: 0),
// so a preset simply rewrites the four sheet margins.
export const MARGIN_PRESETS = {
  default: { label: 'Default', top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
  minimum: { label: 'Minimum', top: '5mm', right: '5mm', bottom: '5mm', left: '5mm' },
  low: { label: 'Low', top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
  custom: { label: 'Custom' }
};

export const resolveMargins = (layout = {}) => {
  const preset = MARGIN_PRESETS[layout.marginPreset] || MARGIN_PRESETS.default;
  if (layout.marginPreset === 'custom') {
    return {
      top: layout.marginTop || '12mm',
      right: layout.marginRight || '12mm',
      bottom: layout.marginBottom || '12mm',
      left: layout.marginLeft || '12mm'
    };
  }
  if (preset && layout.marginPreset && layout.marginPreset !== 'custom') {
    return { top: preset.top, right: preset.right, bottom: preset.bottom, left: preset.left };
  }
  // Legacy layouts (saved before presets existed) keep their stored margins.
  return {
    top: layout.marginTop || '12mm',
    right: layout.marginRight || '12mm',
    bottom: layout.marginBottom || '12mm',
    left: layout.marginLeft || '12mm'
  };
};

// --- Excel-style scaling ------------------------------------------------------
// 'fill'  — the sheet stretches to fill the full page (fixed page height).
// 'fit'   — one page's content is shrunk (never enlarged) so it fits the page.
// 'actual'— natural flow at 100%, pages break by the row-pagination engine.
export const SCALE_MODES = [
  { id: 'fill', label: 'Fill Page' },
  { id: 'fit', label: 'Fit to Page' },
  { id: 'actual', label: 'Actual Size (100%)' }
];

// --- Amount in words ----------------------------------------------------------
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n) => {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const r = n % 10;
  return r ? `${TENS[t]} ${ONES[r]}` : TENS[t];
};
const threeDigits = (n) => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return twoDigits(r);
  return r ? `${ONES[h]} Hundred ${twoDigits(r)}` : `${ONES[h]} Hundred`;
};

export function amountInWords(num) {
  const n = Math.round(Math.abs(Number(num) || 0));
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

// --- Phase-matrix records (BOM / Consumption) ---------------------------------
// A phase record section: { code, name, qtyLabel, phases: [ { name, rows:
// [{ name, qty, uom }], totals: [{ qty, uom }] } ] }. Phase totals are grouped
// per UOM — quantities of different UOMs are never added together.

export const DEFAULT_PHASE_TITLES = [
  { id: 'top', title: 'TOP Phase', type: 'Raw Material' },
  { id: 'foam', title: 'FOAM Phase', type: 'Raw Material' },
  { id: 'adhesive', title: 'ADHESIVE Phase', type: 'Raw Material' },
  { id: 'packing', title: 'Packing Specs', type: 'Packing Material' }
];

export const fmtQty = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '');
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
};

const totalsByUom = (rows) => {
  const map = new Map();
  rows.forEach((r) => {
    const key = r.uom || '';
    map.set(key, (map.get(key) || 0) + (Number(r.qty) || 0));
  });
  return [...map.entries()].map(([uom, qty]) => ({ uom, qty }));
};

// Resolve a raw material's UOM from its item master; fall back to the phase
// convention only when the master carries none.
export const masterUom = (items, ref, phaseId) => {
  if (ref) {
    const hit = (items || []).find(
      (i) =>
        String(i.id) === String(ref) ||
        String(i.sku || '') === String(ref) ||
        String(i.itemCode || '') === String(ref) ||
        String(i.name || '').toLowerCase() === String(ref).toLowerCase()
    );
    if (hit && (hit.uom || hit.unit)) return hit.uom || hit.unit;
  }
  return phaseId === 'packing' ? 'Pcs' : 'Kg';
};

// Build the phase-matrix record for a BOM (state.boms entry).
export function buildBomPrintRecord(bom, state) {
  const items = state?.items || [];
  const fg = items.find(
    (i) => String(i.id) === String(bom.finishedGoodId) || String(i.name) === String(bom.finishedGoodName || '')
  );
  const phaseConfig = Array.isArray(bom.phaseConfig) && bom.phaseConfig.length > 0
    ? bom.phaseConfig.filter((p) => p.enabled !== false)
    : DEFAULT_PHASE_TITLES;
  const phases = [];
  phaseConfig.forEach((p) => {
    const rows = (bom.phases?.[p.id] || [])
      .filter((r) => Number(r.value ?? r.quantity) > 0)
      .map((r) => ({
        name: r.name,
        qty: Number(r.value ?? r.quantity) || 0,
        uom: masterUom(items, r.rmId || r.itemCode || r.name, p.id)
      }));
    if (rows.length > 0) phases.push({ name: p.title || p.id, rows, totals: totalsByUom(rows) });
  });
  // Backing cloth rides as its own phase panel (it is a real BOM line).
  if (bom.clothName && Number(bom.clothQuantity ?? bom.clothWeight) > 0) {
    const clothRows = [{
      name: bom.clothName,
      qty: Number(bom.clothQuantity ?? bom.clothWeight) || 0,
      uom: masterUom(items, bom.clothName, 'cloth')
    }];
    phases.push({ name: 'Backing Cloth', rows: clothRows, totals: totalsByUom(clothRows) });
  }
  const fgName = fg?.name || bom.finishedGoodName || 'Finished Good';
  const fgCode = fg?.itemCode || fg?.sku || bom.id || '';
  return {
    renderMode: 'phase_matrix',
    id: bom.id,
    docSub: fgName,
    metaRows: [
      { key: 'Item Code', value: fgCode },
      { key: 'Date', value: new Date(bom.createdAt || Date.now()).toLocaleDateString('en-GB') },
      { key: 'Basis', value: bom.batchSize ? `Per ${Number(bom.batchSize).toLocaleString()} Meters` : 'Standard Batch' }
    ],
    sections: [{ code: fgCode, name: null, qtyLabel: '', phases }]
  };
}

// Build the phase-matrix record for a production plan's saved consumption
// (plan.consumptions). One section per plan item, phases in plan order.
export function buildConsumptionPrintRecord(plan, state, onlyItemCode = null) {
  const items = state?.items || [];
  const consumptions = plan.consumptions || {};
  const sections = [];
  Object.keys(consumptions).forEach((itemCode) => {
    if (onlyItemCode && itemCode !== onlyItemCode) return;
    const cData = consumptions[itemCode] || {};
    const planItem = (plan.items || []).find((i) => i.itemCode === itemCode) || {};
    const phaseConfig = Array.isArray(cData.phaseConfig) && cData.phaseConfig.length > 0
      ? cData.phaseConfig.filter((p) => p.enabled !== false)
      : DEFAULT_PHASE_TITLES;
    const phases = [];
    phaseConfig.forEach((p) => {
      const rows = (cData.materials?.[p.id] || [])
        .map((m) => {
          const val = m.adjustedValue !== undefined && m.adjustedValue !== '' ? m.adjustedValue : m.value;
          return { name: m.name, qty: Number(val) || 0, uom: masterUom(items, m.itemCode || m.name, p.id), raw: val };
        })
        .filter((r) => r.qty > 0);
      if (rows.length > 0) phases.push({ name: p.title || p.id, rows, totals: totalsByUom(rows) });
    });
    if (cData.clothName && Number(cData.clothQuantity) > 0) {
      const clothRows = [{
        name: cData.clothName,
        qty: Number(cData.clothQuantity) || 0,
        uom: masterUom(items, cData.clothName, 'cloth')
      }];
      phases.push({ name: 'Backing Cloth', rows: clothRows, totals: totalsByUom(clothRows) });
    }
    const fg = items.find((i) => String(i.sku || '') === String(itemCode) || String(i.itemCode || '') === String(itemCode));
    sections.push({
      code: planItem.lineCode || itemCode,
      name: planItem.productName || fg?.name || itemCode,
      qtyLabel: planItem.outputQty || planItem.quantity
        ? `Qty ${Number(planItem.outputQty || planItem.quantity).toLocaleString()} Meters`
        : '',
      phases
    });
  });
  return {
    renderMode: 'phase_matrix',
    id: plan.id,
    docSub: `Plan ${plan.id}`,
    metaRows: [
      { key: 'Plan ID', value: plan.id },
      { key: 'Plan Date', value: plan.date ? new Date(plan.date).toLocaleDateString('en-GB') : '—' },
      { key: 'Sheet Date', value: new Date().toLocaleDateString('en-GB') }
    ],
    sections
  };
}
