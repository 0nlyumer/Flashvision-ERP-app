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

// Unit display for prints (Omer, 2026-10-25): quantities on paper carry
// ONLY the unit symbol — '100 kg', never the stored full form
// '100 Kilograms (kg)'. Rendering-only: stored UOM values stay as they
// are ('Kilograms (kg)' etc. in the UOM master). A value already in
// short form ('Kg', '480 Kg' style quantities, 'm', 'Rolls') is left
// untouched; 'Name (symbol)' collapses to the symbol, and a bare known
// full name maps to its symbol.
const UOM_FULL_NAME_TO_SYMBOL = {
  kilograms: 'kg', kilogram: 'kg',
  liters: 'L', liter: 'L', litres: 'L', litre: 'L',
  meters: 'm', meter: 'm', metres: 'm', metre: 'm',
  units: 'ea', unit: 'ea'
};
export function uomSymbol(uom) {
  if (uom === null || uom === undefined) return '';
  const s = String(uom).trim();
  if (!s) return s;
  const bracket = s.match(/\(([^)]+)\)\s*$/);
  if (bracket) return bracket[1].trim();
  const mapped = UOM_FULL_NAME_TO_SYMBOL[s.toLowerCase()];
  return mapped || s;
}

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

// Representative SAMPLE phase-matrix record for the BOM document — used
// ONLY by the Print Settings / studio sample path when no real BOM record
// resolves, so the BOM test preview shows the phase panels filled instead
// of an empty sheet (Omer, 2026-10-25). Real BOM prints never pass
// through here: they arrive as explicit records built by
// buildBomPrintRecord.
export function buildSampleBomPrintRecord() {
  const phases = [
    {
      name: 'TOP Phase',
      rows: [
        { name: 'PVC 682', qty: 480, uom: 'Kg' },
        { name: 'MARBLE M3500', qty: 100, uom: 'Kg' },
        { name: 'KEROSINE OIL', qty: 30, uom: 'Kg' }
      ]
    },
    {
      name: 'FOAM Phase',
      rows: [
        { name: 'PVC 682', qty: 100, uom: 'Kg' },
        { name: 'EPOXY OIL', qty: 10, uom: 'Kg' },
        { name: 'WET CARBON BLACK 8000', qty: 10, uom: 'Kg' }
      ]
    },
    {
      name: 'ADHESIVE Phase',
      rows: [
        { name: 'MARBLE M600', qty: 100, uom: 'Kg' },
        { name: 'DOP', qty: 10, uom: 'Kg' },
        { name: 'STABLIZER B.C 8020', qty: 10, uom: 'Kg' }
      ]
    },
    {
      name: 'Backing Cloth',
      rows: [
        { name: 'PK DTY WHITE', qty: 86.364, uom: 'Kg' }
      ]
    }
  ].map((p) => ({ ...p, totals: totalsByUom(p.rows) }));
  return {
    renderMode: 'phase_matrix',
    id: 'BOM-SAMPLE',
    docSub: '170 PK DTY BLACK (WHITE)',
    metaRows: [
      { key: 'Item Code', value: 'FG-001' },
      { key: 'Date', value: new Date().toLocaleDateString('en-GB') },
      { key: 'Basis', value: 'Per 950 Meters' }
    ],
    sections: [{ code: 'FG-001', name: null, qtyLabel: '', phases }]
  };
}

// --- Batch Record print record (Master Batch Record, 2026-10-25) -------------
// Builds the Universal Print Studio record for one MasterBatchRecord batch
// object (the exact shape MasterBatchRecord.jsx derives from production
// plans): batch meta + costing summary as header fields, the consumption
// details as the line table, and the Estimated Labor Cost as its own
// header line — '—' when the date has no attendance data / no selection
// (never a guessed zero). fmtMoney is injected by the caller (the screen
// passes its context formatter) so the app's single currency rules apply.

export function buildBatchRecordPrintRecord(batch, { laborCost = null, fmtMoney } = {}) {
  const fmt = typeof fmtMoney === 'function'
    ? fmtMoney
    : (v) => `Rs ${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fgOutputs = (batch.outputDetails || []).filter((o) => !o.isWastage);
  const wastageOutputs = (batch.outputDetails || []).filter((o) => o.isWastage);
  const fgValue = fgOutputs.reduce((s, o) => s + (Number(o.value) || 0), 0);
  const wastageValue = wastageOutputs.reduce((s, o) => s + (Number(o.value) || 0), 0);
  const otherConsumptionCost = (batch.consumptionDetails || [])
    .filter((c) => c.name && c.name.includes('(Other Cons. Split)'))
    .reduce((s, c) => s + (Number(c.cost) || 0), 0);
  const totalCost = Number(batch.totalConsumedCost) || 0;
  const rawMaterialCost = totalCost - otherConsumptionCost;
  const totalFgQty = fgOutputs.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
  const costPerUnit = totalFgQty > 0 ? totalCost / totalFgQty : 0;
  const fgUom = fgOutputs[0]?.uom || 'Meters';

  return {
    id: batch.batchCode,
    batch_code: batch.batchCode,
    product_name: batch.productName,
    production_date: batch.date,
    plan_id: batch.planId,
    status: batch.status,
    requested_qty: `${Number(batch.requestedQty || 0).toLocaleString()} m`,
    produced_qty: `${Number(batch.totalOutputQty || 0).toLocaleString()} m`,
    efficiency: `${Number(batch.efficiency || 0).toFixed(1)}%`,
    finished_goods_value: fmt(fgValue),
    wastage_value: fmt(wastageValue),
    raw_material_cost: fmt(rawMaterialCost),
    other_consumption_cost: fmt(otherConsumptionCost),
    est_labor_cost: laborCost === null || laborCost === undefined ? '—' : fmt(laborCost),
    cost_per_unit: `${fmt(costPerUnit)} / ${fgUom}`,
    items: (batch.consumptionDetails || []).map((m) => ({
      material_name: m.name,
      target_qty: Number(m.target) > 0 ? `${Number(m.target).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${m.unit}` : '—',
      actual_qty: `${Number(m.actual || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${m.unit}`,
      unit_price: Number(m.price) || 0,
      total_cost: Number(m.cost) || 0,
      variance: Number(m.target) > 0 ? `${Number(m.variance) > 0 ? '+' : ''}${Number(m.variance || 0).toFixed(1)}%` : '—'
    }))
  };
}

// Representative SAMPLE record for the Batch Record document — used ONLY
// by the Print Settings / studio sample path so the Master Batch Record
// test preview shows a filled record (with an Estimated Labor Cost line)
// instead of a generic mock. Real batch prints are built by
// buildBatchRecordPrintRecord from the actual batch.
export function buildSampleBatchRecordPrintRecord() {
  const fmt = (v) => `Rs ${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return buildBatchRecordPrintRecord({
    batchCode: 'ITEM-001',
    productName: '170 PK DTY BLACK (WHITE)',
    date: new Date().toISOString(),
    status: 'Completed',
    requestedQty: 2000,
    totalOutputQty: 1950,
    totalConsumedCost: 84517.76,
    efficiency: 96.4,
    consumptionDetails: [
      { name: 'PVC 682', unit: 'Kg', target: 480, actual: 472, price: 120, cost: 56640, variance: -1.7 },
      { name: 'MARBLE M3500', unit: 'Kg', target: 100, actual: 98, price: 210, cost: 20580, variance: -2.0 },
      { name: 'PK DTY WHITE', unit: 'Kg', target: 86.364, actual: 86.364, price: 84.5, cost: 7297.76, variance: 0 }
    ],
    outputDetails: [
      { typeName: 'A', quantity: 1950, value: 487500, uom: 'Meters', isWastage: false },
      { typeName: 'Wastage', quantity: 12, value: 0, uom: 'Kgs', isWastage: true }
    ],
    planId: 'PLAN-SAMPLE'
  }, { laborCost: 1397.42, fmtMoney: fmt });
}

// Normalize a resolved studio record for phase documents. A raw BOM
// (state.boms entry) is converted with the same builder real prints
// use; when nothing usable resolves, the representative sample above
// fills the preview. Non-BOM documents pass through untouched.
export function ensurePhaseMatrixRecord(record, docType, state) {
  if (docType !== 'bom_master') return record;
  if (record && record.renderMode === 'phase_matrix') return record;
  const looksLikeRawBom = record && typeof record === 'object' && (
    record.phases || record.phaseConfig || record.finishedGoodId || record.finishedGoodName || record.clothName
  );
  if (looksLikeRawBom) {
    try {
      const built = buildBomPrintRecord(record, state);
      const hasRows = (built.sections || []).some((s) => (s.phases || []).length > 0);
      if (hasRows) return built;
    } catch (e) { /* fall through to the sample */ }
  }
  return buildSampleBomPrintRecord();
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

// ---------------------------------------------------------------------------
// Contrast guard (Omer, 2026-10-25 — system-wide print rule): wherever a
// print block sits on a DARK background its text must be light; dark-on-
// dark must never render. Saved layouts can carry any band/header text
// color, so rendering — not the config — enforces the rule: when the
// configured text color has insufficient contrast against the actual
// background, it is replaced by whichever of white / ink contrasts best.
// ---------------------------------------------------------------------------
export function parseCssColorToRgb(color) {
  if (!color || typeof color !== 'string') return null;
  const hex = color.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

export function relativeLuminanceOfRgb([r, g, b]) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatioRgb(rgbA, rgbB) {
  const la = relativeLuminanceOfRgb(rgbA);
  const lb = relativeLuminanceOfRgb(rgbB);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// `bg` may be a gradient string — its first color stop decides.
export function ensureContrastText(bg, fg, minRatio = 3) {
  const bgRgb = parseCssColorToRgb(bg);
  if (!bgRgb) return fg;
  const white = [255, 255, 255];
  const ink = [27, 30, 46];
  const ideal = contrastRatioRgb(bgRgb, white) >= contrastRatioRgb(bgRgb, ink) ? '#ffffff' : '#1b1e2e';
  const fgRgb = parseCssColorToRgb(fg);
  if (!fgRgb) return ideal;
  return contrastRatioRgb(bgRgb, fgRgb) >= minRatio ? fg : ideal;
}
