/**
 * Stock Report utilities — FG Stock Report + Stock Register (InvLedger).
 *
 * Pure logic only (no React / JSX) so the maths can be smoke-tested in node.
 *
 * Data-model facts this module is built on (audited 2026-10-24 against
 * AppContext writers — see brief-fg-stock-report-2026-10-24-result.md):
 *  - item.stockByType {typeName: qty} is the GLOBAL per-grade split. It is
 *    maintained by production output (handleProductionOutput), deliveries
 *    (addDelivery/deleteDelivery) and FG adjustments (InvAdjustment).
 *  - item.stockByDepartment {dept: qty} holds per-department TOTALS (no
 *    grade split is stored per department anywhere in the app).
 *  - item.stock is the item total.
 * Because no dept×grade matrix exists, a grade split is only ever shown when
 * the report scope covers every department that holds the item's stock —
 * otherwise the split is reported as unavailable ('—') instead of inventing
 * an allocation. Department totals always come from stockByDepartment,
 * exactly as InvStock derives them (getSafeItemWithDeptStock semantics).
 */

export const UNGRADED = '-';

// ---------------------------------------------------------------- rates ---
export function parseRate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Type-wise rate: pricesByType[type] -> pricesByType['Base Item'] -> item.price. */
export function rateForType(item, typeName) {
  const pbt = item?.pricesByType || {};
  const direct = parseRate(pbt[typeName]);
  if (direct !== null) return direct;
  const base = parseRate(pbt['Base Item']);
  if (base !== null) return base;
  return parseRate(item?.price);
}

// ---------------------------------------------------------------- types ---
export function isWastageType(typeName, batchOutputTypes = []) {
  if (!typeName) return false;
  const t = (batchOutputTypes || []).find(
    (x) => x && (x.name === typeName || String(x.id) === String(typeName)),
  );
  if (t && t.category) return t.category === 'Wastage';
  return String(typeName).toLowerCase().includes('wastage');
}

export function typeUnit(typeName, batchOutputTypes = []) {
  const t = (batchOutputTypes || []).find((x) => x && x.name === typeName);
  return (t && t.uom) || 'Meters';
}

export function isMeterType(typeName, batchOutputTypes = []) {
  return typeUnit(typeName, batchOutputTypes).toLowerCase().startsWith('meter');
}

/** Configured grade list, in config order: [{ name, uom, category, isWastage }]. */
export function getTypeMeta(batchOutputTypes = []) {
  return (batchOutputTypes || [])
    .filter((t) => t && t.name)
    .map((t) => ({
      name: t.name,
      uom: t.uom || 'Meters',
      category: t.category || '',
      isWastage: isWastageType(t.name, batchOutputTypes),
    }));
}

// ------------------------------------------------------- paper / packing ---
/**
 * Paper code for an FG item — same precedence as the FG Combo's
 * matchItemToCombination: structured combinationDetails first, then the
 * item name. Name fallback: the first name token (or '-'-separated part of
 * one of the first tokens) that is a CONFIGURED paper code; else 'Other'.
 */
export function extractPaperCode(item, paperCodes = []) {
  const details = item?.combinationDetails || {};
  if (details.paperCode) return String(details.paperCode);
  const codes = new Set(
    (paperCodes || []).map((c) => String(c?.code ?? c).trim()).filter(Boolean),
  );
  if (codes.size && item?.name) {
    const tokens = String(item.name).split(/\s+/).filter(Boolean);
    for (const tok of tokens.slice(0, 3)) {
      const clean = tok.replace(/[()]/g, '');
      if (codes.has(clean)) return clean;
      for (const part of clean.split('-').filter(Boolean)) {
        if (codes.has(part)) return part;
      }
    }
  }
  return 'Other';
}

export function getPackingSize(item) {
  const raw = item?.packingSize ?? item?.packingSizeRaw ?? item?.rollSize ?? item?.uomNumber;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function getPackingLabel(item, packings = []) {
  if (item?.packingName) return String(item.packingName);
  const size = getPackingSize(item);
  if (!size) return '—';
  const found = (packings || []).find((p) => Number(p.size) === size);
  if (found?.name) return String(found.name);
  return `${size}M`;
}

/** Rolls = meters / packing size, truncated to 2dp (never rounded up). */
export function rollsFromMeters(meters, packingSize) {
  const size = parseFloat(packingSize);
  if (!Number.isFinite(size) || size <= 0) return null;
  const m = parseFloat(meters) || 0;
  const r = m / size;
  return (Math.trunc(Math.abs(r) * 100) / 100) * (r < 0 ? -1 : 1);
}

// ------------------------------------------------------------ departments ---
/** stockByDepartment with InvStock's fallback: first mapped dept holds the
 *  item total when no per-dept figure was ever stored for it. */
export function getSafeDeptStock(item) {
  const map = { ...(item?.stockByDepartment || {}) };
  const depts = String(item?.department || '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  depts.forEach((dept, idx) => {
    if (map[dept] === undefined) {
      map[dept] = idx === 0 ? parseFloat(item?.stock) || 0 : 0;
    }
  });
  return map;
}

export function deptScopeTotal(item, departments = []) {
  const map = getSafeDeptStock(item);
  return (departments || []).reduce((s, d) => s + (parseFloat(map[d]) || 0), 0);
}

/** Departments that actually hold (non-zero) stock of this item. */
export function stockHoldingDepartments(item) {
  const map = getSafeDeptStock(item);
  return Object.keys(map).filter((d) => (parseFloat(map[d]) || 0) !== 0);
}

// ------------------------------------------------------------- stock rows ---
/**
 * One stock-report row for an item inside a department scope.
 * opts: { departments, batchOutputTypes, showValue }
 * typeQtys covers every known grade (config order, then extra stored keys):
 * a qty is null when the grade split is not stored for this scope.
 */
export function buildStockRow(item, opts = {}) {
  const departments = opts.departments || [];
  const batchOutputTypes = opts.batchOutputTypes || [];
  const showValue = !!opts.showValue;

  const deptTotal = deptScopeTotal(item, departments);
  const holding = stockHoldingDepartments(item);
  const splitExact = holding.every((d) => departments.includes(d));
  const byType = item?.stockByType || {};
  const hasTypes = Object.keys(byType).length > 0;

  const knownTypes = [];
  getTypeMeta(batchOutputTypes).forEach((t) => {
    if (!knownTypes.includes(t.name)) knownTypes.push(t.name);
  });
  Object.keys(byType).forEach((t) => {
    if (!knownTypes.includes(t)) knownTypes.push(t);
  });

  const typeQtys = {};
  knownTypes.forEach((t) => {
    typeQtys[t] = hasTypes && splitExact ? parseFloat(byType[t]) || 0 : null;
  });

  let totalMeters;
  if (hasTypes && splitExact) {
    totalMeters = knownTypes
      .filter((t) => isMeterType(t, batchOutputTypes))
      .reduce((s, t) => s + (typeQtys[t] || 0), 0);
  } else {
    // Untyped item, or the split is not stored for this scope: the exact
    // figure available is the department-scope total itself.
    totalMeters = deptTotal;
  }

  const packingSize = getPackingSize(item);
  const rolls = rollsFromMeters(totalMeters, packingSize);

  // Value (only computed when the caller is allowed to see it at all)
  let value = null;
  let missingRate = false;
  if (showValue) {
    if (hasTypes && splitExact) {
      let sum = 0;
      let ok = true;
      knownTypes.forEach((t) => {
        const qty = typeQtys[t] || 0;
        if (qty === 0) return;
        const rate = rateForType(item, t);
        if (rate === null) {
          ok = false;
          missingRate = true;
        } else {
          sum += qty * rate;
        }
      });
      value = ok ? sum : null;
    } else if (!hasTypes) {
      const rate = rateForType(item, 'Base Item');
      if (rate === null) {
        if (deptTotal !== 0) missingRate = true;
      } else {
        value = deptTotal * rate;
      }
    }
    // hasTypes && !splitExact -> value stays null (split unavailable).
  }

  return {
    item,
    itemId: item?.id,
    name: item?.name || '',
    sku: item?.sku || '',
    packingSize,
    typeQtys,
    totalMeters,
    rolls,
    value,
    missingRate,
    splitExact,
    hasTypes,
    deptTotal,
  };
}

export function sumStockRows(rows = []) {
  const typeTotals = {};
  let totalMeters = 0;
  let rolls = 0;
  let hasRolls = false;
  let value = 0;
  let hasValue = false;
  rows.forEach((r) => {
    Object.keys(r.typeQtys || {}).forEach((t) => {
      const q = r.typeQtys[t];
      if (q === null || q === undefined) return;
      typeTotals[t] = (typeTotals[t] || 0) + q;
    });
    totalMeters += r.totalMeters || 0;
    if (r.rolls !== null && r.rolls !== undefined) {
      rolls += r.rolls;
      hasRolls = true;
    }
    if (r.value !== null && r.value !== undefined) {
      value += r.value;
      hasValue = true;
    }
  });
  return { typeTotals, totalMeters, rolls: hasRolls ? rolls : null, value: hasValue ? value : null };
}

/** Group stock rows: 'item' (flat) | 'paper' | 'packing'. */
export function groupStockRows(rows = [], grouping = 'item', opts = {}) {
  const paperCodes = opts.paperCodes || [];
  const packings = opts.packings || [];
  if (grouping === 'paper') {
    const map = new Map();
    rows.forEach((r) => {
      const code = extractPaperCode(r.item, paperCodes);
      const label = code === 'Other' ? 'Other' : `Paper ${code}`;
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    });
    return [...map.entries()]
      .sort((a, b) => {
        if (a[0] === 'Other') return 1;
        if (b[0] === 'Other') return -1;
        return a[0].localeCompare(b[0], undefined, { numeric: true });
      })
      .map(([label, rs]) => ({ key: `paper-${label}`, label, rows: rs }));
  }
  if (grouping === 'packing') {
    const map = new Map();
    rows.forEach((r) => {
      const label = getPackingLabel(r.item, packings);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([label, rs]) => ({ key: `packing-${label}`, label, rows: rs }));
  }
  return [{ key: 'all', label: '', rows: [...rows] }];
}

// --------------------------------------------------------- ledger entries ---
function toTs(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, value);
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? Math.max(1, t) : fallback;
}

function dateStrOf(ts, raw) {
  if (raw) return String(raw);
  if (ts) return new Date(ts).toLocaleDateString();
  return '—';
}

/**
 * Build the register's movement stream from the CURRENT stock writers
 * (audit 2026-10-24 — see result brief for the source-by-source verdict):
 *  - Production outputs: productionPlans items' outputs (the live home of
 *    productionOutputs; handleProductionOutput maintains stock from them).
 *  - Deliveries: state.deliveries (addDelivery deducts stockByType +
 *    stock/stockByDepartment). Sale-order deliveredQty is a PROJECTION of
 *    deliveries, so the old saleOrders source double-counted and is gone.
 *  - GRNs: purchase receipts (addGRN is the only purchase-side stock-in).
 *  - Adjustments: state.adjustments (flat records, department + outputType).
 *  - Returns: state.returns (stock-in).
 *  - Stock transfers: RECEIVED transfers only — stock moves on receipt
 *    (updateStockTransferStatus), as an OUT at source + IN at destination.
 *  - Other consumptions: state.otherConsumptions (department stock-out).
 * Legacy plan fabricRequiredQty (a requirement estimate, not a movement)
 * and the productionOutputs collection (no live writer) are NOT sources.
 */
export function buildLedgerEntries(state = {}) {
  const entries = [];
  const push = (e) => entries.push(e);

  // 1. Production outputs (plan-embedded — the live output store)
  (state.productionPlans || []).forEach((plan) => {
    if (!plan || plan.status === 'Cancelled') return;
    (plan.items || []).forEach((pi) => {
      (pi.outputs || []).forEach((out, idx) => {
        const qty = parseFloat(out.quantity) || 0;
        if (qty <= 0) return;
        const ts = toTs(out.createdAt || out.date || plan.createdDate || plan.createdAt || plan.date);
        push({
          id: `out-${plan.id}-${pi.itemCode || pi.id}-${idx}`,
          timestamp: ts,
          dateStr: dateStrOf(ts, out.date),
          itemRef: pi.itemCode || pi.itemId,
          itemName: pi.productName || '',
          type: 'Production',
          ref: plan.id,
          outputType: out.typeName || UNGRADED,
          department: out.department || plan.department || '',
          qtyIn: qty,
          qtyOut: 0,
        });
      });
    });
  });

  // 2. Deliveries (stock-out by grade)
  (state.deliveries || []).forEach((del) => {
    if (!del) return;
    (del.items || []).forEach((di, idx) => {
      const qty = parseFloat(di.dispatchedQty) || 0;
      if (qty <= 0) return;
      const ts = toTs(del.date || del.createdAt);
      const dept =
        del.dcMode && del.dcMode !== 'Sale Orders'
          ? del.dcMode
          : di.department || del.department || '';
      push({
        id: `del-${del.id}-${idx}`,
        timestamp: ts,
        dateStr: dateStrOf(ts, del.date),
        itemRef: di.itemId || di.itemCode,
        itemName: di.productName || di.itemName || '',
        type: 'Sale',
        ref: del.id,
        outputType: di.stockType || UNGRADED,
        department: dept,
        qtyIn: 0,
        qtyOut: qty,
      });
    });
  });

  // 3. GRNs / purchase receipts (stock-in, ungraded)
  (state.grns || []).forEach((grn) => {
    if (!grn) return;
    (grn.items || []).forEach((gi, idx) => {
      const qty = parseFloat(gi.qty ?? gi.quantity) || 0;
      if (qty <= 0) return;
      const ts = toTs(grn.date || grn.createdAt);
      push({
        id: `grn-${grn.id}-${idx}`,
        timestamp: ts,
        dateStr: dateStrOf(ts, grn.date),
        itemRef: gi.itemId || gi.itemCode || gi.sku,
        itemName: gi.itemName || '',
        type: 'Purchase',
        ref: grn.id,
        outputType: UNGRADED,
        department: gi.department || grn.department || '',
        qtyIn: qty,
        qtyOut: 0,
      });
    });
  });

  // 4. Manual adjustments
  (state.adjustments || []).forEach((adj) => {
    if (!adj) return;
    const qty = parseFloat(adj.qty) || 0;
    if (qty === 0) return;
    const ts = toTs(adj.timestamp || adj.date);
    push({
      id: `adj-${adj.id}`,
      timestamp: ts,
      dateStr: dateStrOf(ts, adj.date),
      itemRef: adj.itemId || adj.itemCode,
      itemName: adj.itemName || '',
      type: 'Adjustment',
      ref: adj.parentId || adj.id,
      outputType: adj.outputType || UNGRADED,
      department: adj.department || '',
      qtyIn: adj.type === 'add' ? qty : 0,
      qtyOut: adj.type === 'sub' ? qty : 0,
    });
  });

  // 5. Returns (stock-in)
  (state.returns || []).forEach((ret) => {
    if (!ret) return;
    (ret.items || []).forEach((ri, idx) => {
      const qty = parseFloat(ri.qty ?? ri.quantity) || 0;
      if (qty <= 0) return;
      const ts = toTs(ret.timestamp || ret.date || ret.createdAt);
      push({
        id: `ret-${ret.id}-${idx}`,
        timestamp: ts,
        dateStr: dateStrOf(ts, ret.date),
        itemRef: ri.itemId || ri.itemCode || ri.name,
        itemName: ri.name || ri.itemName || '',
        type: 'Return',
        ref: ret.id,
        outputType: ri.outputType || ri.type || UNGRADED,
        department: ret.department || ri.department || '',
        qtyIn: qty,
        qtyOut: 0,
      });
    });
  });

  // 6. Stock transfers — stock moves on RECEIPT only
  (state.stockTransfers || []).forEach((st) => {
    if (!st || st.status !== 'Received') return;
    const received =
      st.receivedItems && st.receivedItems.length
        ? st.receivedItems
        : (st.items || []).map((i) => ({ ...i, receivedQty: i.quantity }));
    received.forEach((ri, idx) => {
      const qty = parseFloat(ri.receivedQty ?? ri.quantity) || 0;
      if (qty <= 0) return;
      const ts = toTs(st.receivedDate || st.date || st.createdAt);
      const base = {
        timestamp: ts,
        dateStr: dateStrOf(ts, st.date),
        itemRef: ri.itemId || ri.itemCode || ri.sku,
        itemName: ri.itemName || '',
        type: 'Transfer',
        ref: st.id,
        outputType: ri.outputType || ri.stockType || UNGRADED,
      };
      push({ ...base, id: `tr-out-${st.id}-${idx}`, department: st.source || '', qtyIn: 0, qtyOut: qty });
      push({ ...base, id: `tr-in-${st.id}-${idx}`, department: st.destination || '', qtyIn: qty, qtyOut: 0 });
    });
  });

  // 7. Other consumptions (department stock-out, ungraded)
  (state.otherConsumptions || []).forEach((oc) => {
    if (!oc) return;
    const qty = parseFloat(oc.quantity) || 0;
    if (qty <= 0) return;
    const ts = toTs(oc.date || oc.createdAt);
    push({
      id: `oc-${oc.id}`,
      timestamp: ts,
      dateStr: dateStrOf(ts, null),
      itemRef: oc.itemId || oc.itemCode,
      itemName: oc.itemName || '',
      type: 'Consumption',
      ref: oc.id,
      outputType: UNGRADED,
      department: oc.department || '',
      qtyIn: 0,
      qtyOut: qty,
    });
  });

  return entries;
}

/**
 * Match entries to items and compute running balances per item × grade.
 * Anchor rule (the register's reconciliation identity):
 *  - graded stream (grade ≠ '-'): opening = stockByType[grade] − Σ stream,
 *    so the closing balance ALWAYS equals the current stockByType figure.
 *  - ungraded stream of an item WITHOUT stockByType: opening = item.stock
 *    − Σ stream (closing = current total stock).
 *  - ungraded stream of a typed item: department-level flows (transfers,
 *    GRN) that never touch stockByType — shown unanchored from 0, exactly
 *    as the previous register behaved.
 * Opening entries (type 'Initial', timestamp 0) are synthesised when the
 * opening is non-zero for anchored streams.
 */
export function computeLedgerBalances(entries = [], items = []) {
  const findItem = (ref, name) =>
    (items || []).find((i) => i.id === ref || i.sku === ref || i.name === ref) ||
    (name ? (items || []).find((i) => i.name === name) : undefined);

  const matched = [];
  entries.forEach((e) => {
    const item = findItem(e.itemRef, e.itemName);
    if (item) matched.push({ ...e, matchedItem: item });
  });

  // Group per item × grade
  const groups = new Map();
  matched.forEach((e) => {
    const key = `${e.matchedItem.id}::${e.outputType || UNGRADED}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  });

  const out = [];
  groups.forEach((stream, key) => {
    const [itemId, grade] = key.split('::');
    const item = stream[0].matchedItem;
    const sorted = [...stream].sort((a, b) => a.timestamp - b.timestamp);
    const net = sorted.reduce((s, e) => s + (e.qtyIn || 0) - (e.qtyOut || 0), 0);
    const hasTypes = item.stockByType && Object.keys(item.stockByType).length > 0;

    let opening = null; // null = unanchored
    if (grade !== UNGRADED) {
      opening = (parseFloat(item.stockByType?.[grade]) || 0) - net;
    } else if (!hasTypes) {
      opening = (parseFloat(item.stock) || 0) - net;
    }

    let balance = opening === null ? 0 : opening;
    if (opening !== null && opening !== 0) {
      out.push({
        id: `init-${itemId}-${grade}`,
        timestamp: 0,
        dateStr: 'Initial',
        itemRef: item.id,
        itemName: item.name,
        type: 'Initial',
        ref: '-',
        outputType: grade,
        department: '',
        qtyIn: opening > 0 ? opening : 0,
        qtyOut: opening < 0 ? Math.abs(opening) : 0,
        matchedItem: item,
        balance,
      });
    }
    sorted.forEach((e) => {
      balance += (e.qtyIn || 0) - (e.qtyOut || 0);
      out.push({ ...e, balance });
    });
  });

  out.sort((a, b) => a.timestamp - b.timestamp);
  return out;
}

// ------------------------------------------------------------------- CSV ---
export function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(lines = []) {
  return lines.map((row) => row.map(csvEscape).join(',')).join('\n');
}
