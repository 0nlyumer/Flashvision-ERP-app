// "From Stock" production outputs — pure helpers (Omer, 2026-10-26).
//
// An output entry on a production-plan item may carry `source: 'stock'`,
// meaning the quantity was NOT produced — the order line is fulfilled from
// the item's existing finished-goods stock. Such an entry:
//   * counts toward the sale-order line's producedQty exactly like a
//     production output (the order completes without production),
//   * NEVER adds to (or reverses out of) inventory stock — the goods are
//     already counted in item.stockByType; adding them again would
//     double-count, and delivery later decrements the same pool once,
//   * becomes deliverable for its line in Delivery, tagged FROM STOCK,
//   * is capped by the claim guard below, so two order lines can never
//     claim the same physical stock twice.
//
// Everything here mirrors the maths Delivery (DelCreation) already uses:
// pools are built from non-cancelled production plans whose items belong
// to a real sale order, counting only deliverable outputs, and deliveries
// in 'Sale Orders' mode subtract per stock type.

export const OUTPUT_SOURCE_PRODUCTION = 'production';
export const OUTPUT_SOURCE_STOCK = 'stock';

// FG stock physically sits in Finishing (the settled stock mapping);
// from-stock output rows are stamped with this department so Delivery's
// department filter shows them where the goods actually are.
export const FROM_STOCK_DEPARTMENT = 'Finishing';

export function isStockOutput(out) {
  return out?.source === OUTPUT_SOURCE_STOCK;
}

export function outputSource(out) {
  return isStockOutput(out) ? OUTPUT_SOURCE_STOCK : OUTPUT_SOURCE_PRODUCTION;
}

// Does saving / removing this output entry move inventory stock?
// Only real production outputs do.
export function outputMovesStock(out) {
  return !isStockOutput(out);
}

const num = (v) => parseFloat(v) || 0;

function planItemBelongsToSaleOrder(state, pi, soIds) {
  return !!pi?.orderId && soIds.has(pi.orderId);
}

function planItemMatchesItem(pi, item) {
  if (!pi || !item) return false;
  return pi.itemCode === item.sku || pi.itemCode === item.id || pi.itemId === item.id;
}

function deliveryItemMatchesItem(di, item) {
  if (!di || !item) return false;
  return di.itemId === item.id || di.itemCode === item.sku || di.itemCode === item.id;
}

// Per-grade pools for one item master, exactly as Delivery computes them
// globally (no department filter):
//   produced  — deliverable production outputs on sale-order plan items
//   fromStock — deliverable from-stock outputs on sale-order plan items
//   delivered — dispatched qty on 'Sale Orders' deliveries, per stock type
export function computeItemTypePools(state, item) {
  const pools = {};
  const ensure = (t) => pools[t] || (pools[t] = { produced: 0, fromStock: 0, delivered: 0 });
  if (!item) return pools;
  const soIds = new Set((state?.saleOrders || []).map((o) => o.id));

  (state?.productionPlans || []).forEach((plan) => {
    if (plan.status === 'Cancelled') return;
    (plan.items || []).forEach((pi) => {
      if (!planItemBelongsToSaleOrder(state, pi, soIds)) return;
      if (!planItemMatchesItem(pi, item)) return;
      (pi.outputs || []).forEach((out) => {
        const qty = num(out.quantity);
        if (qty <= 0 || !out.typeName || !out.isDeliverable) return;
        const p = ensure(out.typeName);
        if (isStockOutput(out)) p.fromStock += qty;
        else p.produced += qty;
      });
    });
  });

  (state?.deliveries || []).forEach((del) => {
    if (del.dcMode !== 'Sale Orders') return;
    (del.items || []).forEach((di) => {
      if (!deliveryItemMatchesItem(di, item)) return;
      const qty = num(di.dispatchedQty);
      if (qty <= 0) return;
      ensure(di.stockType || 'Fresh').delivered += qty;
    });
  });

  return pools;
}

// Claim availability per grade type for NEW from-stock entries:
//   available = physical stock (stockByType) − the undelivered deliverable
//   pool already promised to sale-order lines (produced + from-stock −
//   delivered). A new claim may only eat stock nobody has promised yet —
//   that is what stops two lines claiming the same physical stock twice.
export function getStockClaimAvailability(state, item) {
  const pools = computeItemTypePools(state, item);
  const result = {};
  const types = new Set([
    ...Object.keys(item?.stockByType || {}),
    ...Object.keys(pools),
  ]);
  types.forEach((t) => {
    const physical = num(item?.stockByType?.[t]);
    const p = pools[t] || { produced: 0, fromStock: 0, delivered: 0 };
    const poolRemaining = Math.max(0, p.produced + p.fromStock - p.delivered);
    result[t] = {
      physical,
      produced: p.produced,
      fromStock: p.fromStock,
      delivered: p.delivered,
      poolRemaining,
      available: physical - poolRemaining,
    };
  });
  return result;
}

// Validate a batch of from-stock saves for ONE item master.
// requests: [{ planId, lineCode, itemCode, stockByType: { typeName: qty } }]
// Saving replaces a plan item's outputs wholesale, so the plan items named
// here first RELEASE their previous from-stock claims; the new quantities
// are then checked against (availability + released).
export function validateStockClaims(state, item, requests) {
  const availability = getStockClaimAvailability(state, item);
  const soIds = new Set((state?.saleOrders || []).map((o) => o.id));
  const released = {};
  const requested = {};

  (requests || []).forEach((req) => {
    const plan = (state?.productionPlans || []).find((p) => p.id === req.planId);
    const pi = plan?.items?.find((x) => (req.lineCode ? x.lineCode === req.lineCode : x.itemCode === req.itemCode));
    if (pi && planItemBelongsToSaleOrder(state, pi, soIds)) {
      (pi.outputs || []).forEach((out) => {
        if (isStockOutput(out) && out.isDeliverable && out.typeName) {
          released[out.typeName] = (released[out.typeName] || 0) + num(out.quantity);
        }
      });
    }
    Object.entries(req.stockByType || {}).forEach(([t, q]) => {
      requested[t] = (requested[t] || 0) + num(q);
    });
  });

  const violations = [];
  Object.entries(requested).forEach(([t, qty]) => {
    if (qty <= 0) return;
    const avail = (availability[t]?.available || 0) + (released[t] || 0);
    if (qty > avail + 1e-9) {
      violations.push({ typeName: t, requested: qty, available: avail });
    }
  });

  return { ok: violations.length === 0, violations, availability, released, requested };
}

// Split one line + type's remaining deliverable quantity by source.
// Deliveries consume the from-stock portion FIRST (the earmarked existing
// stock is dispatched before newly produced goods); whatever from-stock
// quantity remains undelivered keeps the FROM STOCK tag.
export function splitRemainingBySource(produced, fromStock, delivered) {
  const p = num(produced);
  const s = num(fromStock);
  const d = num(delivered);
  const stockRemaining = Math.max(0, s - d);
  const producedRemaining = Math.max(0, p - Math.max(0, d - s));
  return { stockRemaining, producedRemaining, total: stockRemaining + producedRemaining };
}

// Suffix for the delivery challan print's product-name cell. Unit-neutral
// on purpose — the challan's quantity column carries the unit context.
export function fromStockPrintSuffix(dispatchedQty, fromStockQty) {
  const q = num(dispatchedQty);
  const fs = Math.min(num(fromStockQty), q);
  if (fs <= 0 || q <= 0) return '';
  return fs >= q ? ' (FROM STOCK)' : ` (FROM STOCK: ${fs})`;
}

// The department a from-stock row is stamped with: Finishing when the
// company has such a department, else the department picked on the
// output screen (the row must never fall out of Delivery's filters).
export function resolveFromStockDepartment(state, fallbackDepartment) {
  const values = (state?.departments || []).map((d) =>
    typeof d === 'string' ? d : (d.value || d.label || d.name)
  );
  return values.includes(FROM_STOCK_DEPARTMENT) ? FROM_STOCK_DEPARTMENT : (fallbackDepartment || '');
}
