/**
 * OMS "In Stock" figure for a sale-order line (Omer, 2026-10-26).
 *
 * Pure logic only (no React / JSX) so the maths can be smoke-tested in node.
 *
 * The figure answers Omer's question on the OMS (Sale Orders) item-wise
 * list: "is this item already lying in stock, and how much?" — the item's
 * CURRENT in-stock quantity, comparable against the line's order quantity
 * (which is in metres for FG).
 *
 * Source of truth — the item master record in AppContext state (`state.items`,
 * hydrated from the server items table; the same live source the Delivery
 * screen and Inventory read — no browser-only copy):
 *  - `item.stockByType` is the GLOBAL per-grade split. The Delivery screen's
 *    stock-based (godown/manual) mode dispatches from exactly these
 *    per-grade quantities, so the column is consistent with it.
 *  - The metres total is the sum of the METER grades only (A + A2 + B per
 *    the configured batch output types' UOMs). Cut piece / Wastage are
 *    kilograms and are NEVER added into a metres figure.
 *  - No dept x grade matrix exists anywhere in the app (audited
 *    2026-10-24 — see stockReportUtils.js header): `stockByDepartment`
 *    holds per-department totals with kg grades mixed in, so it cannot
 *    produce a metres figure. The maths therefore reuses the Stock
 *    Report's audited `buildStockRow` with the scope set to every
 *    department that holds this item's stock.
 */
import {
  buildStockRow,
  stockHoldingDepartments,
  rollsFromMeters,
} from './stockReportUtils.js';

/**
 * @returns {{ meters: number, rolls: number|null }}
 *   meters — in-stock quantity in metres (0 when there is no stock).
 *   rolls  — meters / packing size (truncated 2dp, the FG pattern), or
 *            null when the item has no packing size to divide by.
 */
export function getLineInStock(item, batchOutputTypes = []) {
  if (!item) return { meters: 0, rolls: null };
  const row = buildStockRow(item, {
    departments: stockHoldingDepartments(item),
    batchOutputTypes,
  });
  let meters = row.totalMeters || 0;
  let rolls = row.rolls;
  if (!row.hasTypes && meters === 0) {
    // Untyped legacy item whose department map was never seeded (no
    // department on the item and no stored per-dept figure): item.stock is
    // the only figure that exists — the same fallback DelCreation's manual
    // mode uses when an item has no stockByType.
    const raw = parseFloat(item.stock) || 0;
    if (raw > 0) {
      meters = raw;
      rolls = rollsFromMeters(meters, row.packingSize);
    }
  }
  return { meters, rolls };
}

/** True when the in-stock metres fully cover the line's order quantity. */
export function inStockCoversOrder(meters, orderQty) {
  const q = parseFloat(orderQty) || 0;
  return q > 0 && (parseFloat(meters) || 0) >= q;
}

/** Display format: thousands separators, at most 2 decimals (trimmed). */
export function formatStockMeters(value) {
  const n = parseFloat(value) || 0;
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
