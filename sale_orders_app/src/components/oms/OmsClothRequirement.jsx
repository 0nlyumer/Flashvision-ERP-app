import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import { aggregateClothRequirements, buildShortagePO } from '../../utils/clothRequirement';

/**
 * OMS — Cloth Requirement report (FG Combo phase, 2026-10-23).
 *
 * For every not-yet-completed sale order, the meters still to produce are
 * aggregated by the backing cloth of each line's Finished Good. In-stock
 * meters use the app's own convention (cloth kg x clothQuality); when a
 * cloth item's quality is not set, its stock is shown in kg and no
 * shortage (or order) is computed for it — never invented. Non-woven
 * backed lines are excluded (non-woven is always plenty) and summarized
 * in the footnote. A shortage row can raise a purchase order in the app's
 * native Purchasing structure with one click.
 */
export default function OmsClothRequirement() {
  const { state, setCollection } = useApp();
  const { appAlert } = useDialog();
  const [orderedKeys, setOrderedKeys] = useState({});

  const { rows, nonWoven } = useMemo(
    () => aggregateClothRequirements(state.saleOrders || [], state.items || []),
    [state.saleOrders, state.items]
  );

  const existingShortagePO = (row) => (state.purchaseOrders || []).find(po =>
    po && po.status !== 'Cancelled' && po.status !== 'Received' &&
    typeof po.remarks === 'string' && po.remarks === `FG Combo shortage — ${row.label}` &&
    (po.items || []).some(it => it.itemId === row.clothItemId)
  );

  const handleOrder = (row) => {
    const po = buildShortagePO(row, state.purchaseOrders || []);
    if (!po) return;
    setCollection('purchaseOrders', [po, ...(state.purchaseOrders || [])]);
    setOrderedKeys(prev => ({ ...prev, [row.key]: po.id }));
    appAlert(`Purchase Order ${po.id} generated successfully for ${row.label} (${po.items[0].orderQty.toLocaleString()} m).`, 'success');
  };

  const totals = useMemo(() => ({
    required: rows.reduce((s, r) => s + (r.requiredMeters || 0), 0),
    shortage: rows.reduce((s, r) => s + (r.shortageMeters || 0), 0),
    cloths: rows.length
  }), [rows]);

  const fmt = (n) => (n === null || n === undefined) ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="p-6 space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[26px]">dry_cleaning</span>
            Cloth Requirement — Pending Orders
          </h2>
          <p className="text-xs text-on-surface-variant font-medium mt-1 max-w-2xl">
            Backing cloth still needed to produce every pending sale order, per cloth. Required = order qty − produced qty.
            Stock in meters = cloth kg × its quality (set per cloth in Inventory → Cloth Quality Setup).
          </p>
        </div>
        <div className="flex gap-2.5">
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-center shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Cloths Needed</p>
            <p className="text-lg font-black text-on-surface leading-tight">{totals.cloths}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-2.5 text-center shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Total Required</p>
            <p className="text-lg font-black text-on-surface leading-tight">{fmt(totals.required)} m</p>
          </div>
          <div className="rounded-2xl border border-red-500/25 bg-red-500/5 px-4 py-2.5 text-center shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-wider text-red-500">Total Shortage</p>
            <p className="text-lg font-black text-red-500 leading-tight">{fmt(totals.shortage)} m</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-outline-variant/20 bg-surface-container-lowest overflow-hidden shadow-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low text-left">
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">Cloth</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-on-surface-variant text-center">Pending Orders</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-on-surface-variant text-right">Required (m)</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-on-surface-variant text-right">In Stock</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-wider text-on-surface-variant text-right">Shortage (m)</th>
              <th className="px-5 py-3 text-[11px] font-black uppercase tracking-wider text-on-surface-variant text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const existing = existingShortagePO(row);
              const orderedId = orderedKeys[row.key] || existing?.id;
              const canOrder = row.shortageMeters !== null && row.shortageMeters > 0 && !!row.clothItem;
              return (
                <tr key={row.key} className="border-t border-outline-variant/10 hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-extrabold text-on-surface">{row.label}</span>
                    {row.clothItem?.sku && (
                      <span className="ml-2 font-mono text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md border border-primary/20">{row.clothItem.sku}</span>
                    )}
                    {!row.clothItem && (
                      <span className="block text-[11px] text-on-surface-variant font-medium mt-0.5">Not linked to an inventory cloth item</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center font-bold text-on-surface">{row.orderCount}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-on-surface">{fmt(row.requiredMeters)}</td>
                  <td className="px-4 py-3.5 text-right font-bold text-on-surface">
                    {row.stockMeters !== null
                      ? `${fmt(row.stockMeters)} m`
                      : (row.stockKg !== null && row.stockKg !== undefined
                          ? <span title="This cloth's quality (meters per kg) is not set, so its meter stock cannot be computed">{fmt(row.stockKg)} kg · quality not set</span>
                          : '—')}
                  </td>
                  <td className={`px-4 py-3.5 text-right font-black ${row.shortageMeters > 0 ? 'text-red-500' : 'text-on-surface'}`}>
                    {row.shortageMeters === null ? '—' : fmt(row.shortageMeters)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {orderedId ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Ordered · {orderedId}
                      </span>
                    ) : canOrder ? (
                      <button
                        type="button"
                        onClick={() => handleOrder(row)}
                        className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-[11px] font-black px-3.5 py-1.5 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                        title={`Create a purchase order for the ${fmt(row.shortageMeters)} m shortage of ${row.label}`}
                      >
                        <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
                        Order {fmt(row.shortageMeters)} m
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-on-surface-variant/60">
                        {row.shortageMeters === null ? 'Set cloth quality to compute' : 'Stock covers requirement'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm font-bold text-on-surface-variant italic">
                  No pending cloth requirement — every pending order line is fully produced or carries no backing cloth.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nonWoven.lineCount > 0 && (
        <p className="text-[11px] text-on-surface-variant font-medium flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">info</span>
          Non-woven backed lines are excluded from this shortage report (non-woven is always in plenty): {nonWoven.lineCount} line{nonWoven.lineCount === 1 ? '' : 's'} across {nonWoven.orderCount} order{nonWoven.orderCount === 1 ? '' : 's'}, {fmt(nonWoven.requiredMeters)} m still to produce.
        </p>
      )}
    </div>
  );
}
