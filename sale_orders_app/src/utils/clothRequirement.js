/**
 * Cloth Requirement utilities (FG Combo phase, 2026-10-23).
 *
 * Pure functions over ERP state-shaped data — no React, no imports — so the
 * OMS "Cloth Requirement" report, the FG Builder stock badges and the
 * Sale Order cloth hint all share one resolver and one stock convention:
 *
 *   cloth stock (meters) = item.stock (kg) x item.clothQuality (m per kg)
 *
 * which is the app's own convention (ClothQualitySetup / BOMCalculator).
 * When a cloth item has no clothQuality set, its meter stock is UNKNOWN
 * (null) — never invented; the report shows its kg figure instead and no
 * shortage/order is computed for it.
 */

const FINISHED_ORDER_STATUSES = ['completed', 'delivered', 'cancelled', 'canceled', 'closed'];

export function isNonWovenText(text) {
  const t = String(text || '').toUpperCase().replace(/[\s_-]+/g, ' ');
  return t.includes('NON WOVEN') || t.includes('NONWOVEN');
}

/** Stock picture for one cloth (RM) item: kg on hand and meters when the
 *  item's clothQuality (meters per kg) is known. */
export function clothStockMeters(clothItem) {
  if (!clothItem) return { kg: 0, quality: null, meters: null };
  const kg = Number(clothItem.stock ?? 0) || 0;
  const quality = Number(clothItem.clothQuality || 0) || null;
  return {
    kg,
    quality,
    meters: quality ? Math.round(kg * quality * 100) / 100 : null
  };
}

/** Fabric type token for matching cloth items: the last word of a fabric
 *  name ("PK DTY" -> "DTY", "DTY" -> "DTY", "PC" -> "PC"). */
export function fabricTypeToken(fabricName) {
  const parts = String(fabricName || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

/**
 * Finds the inventory cloth item matching a fabric + fabric color pair
 * (e.g. fabric "DTY" + color "White" -> RM item "PK DTY WHITE"). Matches on
 * the fabric type token and the color both appearing in the item name.
 * Returns null when nothing matches — callers show nothing, never a guess.
 */
export function findClothItemForFabric(fabricName, fabricColor, items = []) {
  const token = fabricTypeToken(fabricName);
  const color = String(fabricColor || '').trim().toUpperCase();
  if (!token) return null;
  const candidates = (items || []).filter(i =>
    i && i.category !== 'Finished Goods' && String(i.name || '').toUpperCase().includes(token)
  );
  if (color) {
    const byColor = candidates.find(i => String(i.name || '').toUpperCase().includes(color));
    if (byColor) return byColor;
  }
  // Exact "<token> <color>" style name or a single candidate for the token
  const exact = candidates.find(i => String(i.name || '').trim().toUpperCase() === `${token} ${color}`.trim());
  if (exact) return exact;
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Resolves the backing cloth for a Finished Good:
 *  1. the item's explicit backClothId link (the registry's own linkage);
 *  2. its combinationDetails fabric + fabric color, matched to a cloth item;
 *  3. the spec carried in its name ("170 PK DTY BLACK (WHITE)") -> fabric
 *     token + bracket color, matched the same way.
 * Returns { clothItem, label, fabricName, fabricColor, nonWoven } — label is
 * the cloth item's name when resolved, else a composed "FABRIC COLOR" label.
 */
export function resolveClothForFG(item, itemsById = {}, allItems = []) {
  if (!item) return null;
  const details = item.combinationDetails || {};

  if (item.backClothId && itemsById[item.backClothId]) {
    const cloth = itemsById[item.backClothId];
    return {
      clothItem: cloth,
      label: cloth.name || 'Cloth',
      fabricName: details.fabricName || '',
      fabricColor: details.fabricColor || '',
      nonWoven: isNonWovenText(cloth.name) || isNonWovenText(details.fabricName)
    };
  }

  let fabricName = details.fabricName || '';
  let fabricColor = details.fabricColor || '';

  if (!fabricName) {
    // Parse the name-carried spec: "... DTY ..." / COLLAR / MISMA -> PC,
    // CN -> CN, and the bracket "(WHITE)" is the cloth color.
    const name = String(item.name || '').toUpperCase();
    const bracket = name.match(/\(([^)]+)\)/);
    if (bracket) fabricColor = bracket[1].trim().split(/\s+/).pop() || '';
    if (name.includes('DTY')) fabricName = 'DTY';
    else if (name.includes('COLLAR') || name.includes('MISMA')) fabricName = 'PC';
    else if (/\bCN\b/.test(name)) fabricName = 'CN';
    else if (isNonWovenText(name)) fabricName = 'Non-Woven';
  }

  const clothItem = fabricName ? findClothItemForFabric(fabricName, fabricColor, allItems) : null;
  const label = clothItem
    ? (clothItem.name || 'Cloth')
    : ([fabricName, fabricColor].filter(Boolean).join(' ').trim() || 'Unspecified cloth');
  return {
    clothItem,
    label,
    fabricName,
    fabricColor,
    nonWoven: isNonWovenText(fabricName) || isNonWovenText(clothItem?.name)
  };
}

/** Convenience wrapper: resolve a Finished Good's cloth from a flat items
 *  list (builds the id index internally). */
export function resolveClothForFGFromList(item, allItems = []) {
  const itemsById = {};
  (allItems || []).forEach(i => { if (i && i.id) itemsById[i.id] = i; });
  return resolveClothForFG(item, itemsById, allItems);
}

/**
 * Aggregates the cloth requirement of all not-yet-completed sale orders.
 * Required per line = order qty - produced qty (meters still to produce).
 * Lines fully produced (or on finished orders) drop out. Non-woven-backed
 * lines are excluded from the shortage table (non-woven is always plenty)
 * and returned as a summary count instead.
 */
export function aggregateClothRequirements(saleOrders = [], items = []) {
  const itemsById = {};
  (items || []).forEach(i => { if (i && i.id) itemsById[i.id] = i; });
  const itemBySku = {};
  (items || []).forEach(i => { if (i && i.sku) itemBySku[String(i.sku).toUpperCase()] = i; });

  const rowsByKey = new Map();
  const nonWoven = { orderIds: new Set(), lineCount: 0, requiredMeters: 0 };

  for (const order of (saleOrders || [])) {
    const status = String(order?.status || '').toLowerCase();
    if (FINISHED_ORDER_STATUSES.includes(status)) continue;
    for (const line of (order?.items || [])) {
      const qty = Number(line?.quantity ?? line?.qty ?? 0) || 0;
      const produced = Number(line?.producedQty ?? 0) || 0;
      const remaining = Math.round((qty - produced) * 100) / 100;
      if (remaining <= 0) continue;

      const fgItem = (line.itemId && itemsById[line.itemId])
        || (line.itemCode && itemBySku[String(line.itemCode).toUpperCase()])
        || null;
      if (!fgItem) continue;

      const resolved = resolveClothForFG(fgItem, itemsById, items);
      if (!resolved) continue;

      if (resolved.nonWoven) {
        nonWoven.orderIds.add(order.id);
        nonWoven.lineCount += 1;
        nonWoven.requiredMeters += remaining;
        continue;
      }

      const key = resolved.clothItem ? `item:${resolved.clothItem.id}` : `label:${resolved.label.toUpperCase()}`;
      if (!rowsByKey.has(key)) {
        const stock = resolved.clothItem ? clothStockMeters(resolved.clothItem) : { kg: null, quality: null, meters: null };
        rowsByKey.set(key, {
          key,
          label: resolved.label,
          clothItem: resolved.clothItem || null,
          clothItemId: resolved.clothItem?.id || null,
          orderIds: new Set(),
          lineCount: 0,
          requiredMeters: 0,
          stockKg: stock.kg,
          stockQuality: stock.quality,
          stockMeters: stock.meters,
          shortageMeters: null
        });
      }
      const row = rowsByKey.get(key);
      row.orderIds.add(order.id);
      row.lineCount += 1;
      row.requiredMeters += remaining;
    }
  }

  const rows = [...rowsByKey.values()].map(r => {
    const required = Math.round(r.requiredMeters * 100) / 100;
    return {
      ...r,
      requiredMeters: required,
      orderCount: r.orderIds.size,
      shortageMeters: (r.stockMeters === null || r.stockMeters === undefined)
        ? null
        : Math.max(0, Math.round((required - r.stockMeters) * 100) / 100)
    };
  });

  // Shortage rows first (largest first); unknown-stock rows last.
  rows.sort((a, b) => {
    if (a.shortageMeters === null && b.shortageMeters === null) return b.requiredMeters - a.requiredMeters;
    if (a.shortageMeters === null) return 1;
    if (b.shortageMeters === null) return -1;
    return b.shortageMeters - a.shortageMeters;
  });

  return {
    rows,
    nonWoven: {
      orderCount: nonWoven.orderIds.size,
      lineCount: nonWoven.lineCount,
      requiredMeters: Math.round(nonWoven.requiredMeters * 100) / 100
    }
  };
}

/** Next purchase-order id in the app's native PO-### series. */
export function nextPoId(purchaseOrders = []) {
  let max = 0;
  (purchaseOrders || []).forEach(po => {
    const parts = String(po?.id || '').split('-');
    if (parts.length === 2 && !Number.isNaN(Number(parts[1]))) {
      const num = parseInt(parts[1], 10);
      if (num > max) max = num;
    }
  });
  return `PO-${String(max + 1).padStart(3, '0')}`;
}

/**
 * Builds a purchase order in the app's native shape (same fields the
 * Purchasing module creates) for one cloth-shortage row. Returns null when
 * the shortage is not computable (stock unknown) or not positive.
 */
export function buildShortagePO(row, purchaseOrders = []) {
  if (!row || !row.clothItem || row.shortageMeters === null || row.shortageMeters <= 0) return null;
  const cloth = row.clothItem;
  const today = new Date();
  return {
    id: nextPoId(purchaseOrders),
    date: today.toISOString().split('T')[0],
    supplierId: '',
    supplierName: '',
    pdId: null,
    expectedDate: '',
    remarks: `FG Combo shortage — ${row.label}`,
    items: [{
      itemId: cloth.id,
      itemCode: cloth.sku || '',
      itemName: cloth.name || row.label,
      reqQty: row.shortageMeters,
      orderQty: row.shortageMeters,
      unitPrice: 0,
      uom: cloth.uom || 'Meters (m)'
    }],
    status: 'Pending',
    createdAt: today.toISOString()
  };
}
