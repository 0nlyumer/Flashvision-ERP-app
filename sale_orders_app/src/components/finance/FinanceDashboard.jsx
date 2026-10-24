import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { generateFinanceOverviewKpis, formatMoney, round2 } from '../../utils/financeEngine';

export default function FinanceDashboard({ onNavigateTab }) {
  const { state } = useApp();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';

  // Compute live real-time financial metrics from financeEngine
  const kpis = useMemo(() => {
    return generateFinanceOverviewKpis(state);
  }, [state]);

  const {
    cashAndBank,
    totalReceivables,
    totalPayables,
    netRevenue,
    netProfit,
    grossProfit,
    grossMargin,
    netMargin,
    currentRatio,
    quickRatio,
    dso,
    recentTransactions
  } = kpis;

  const handleExport = () => {
    window.print();
  };

  // Cockpit height refinement (Omer, 2026-10-24): the ~10% dead band under
  // the GL panel was the Layout content wrapper's bottom padding (p-6 =
  // 24px, lg:p-8 = 32px) PLUS this root's own py-6 bottom (24px) = 56px of
  // white between panel and footer. This root now has pb-0 and its height
  // reaches THROUGH the wrapper padding (calc 100% + wrapper bottom
  // padding, shrink-0 so flex never shrinks it back), so the GL panel ends
  // flush on the footer top edge — only the footer's own strip remains.
  // Scoped to this page only: Layout wrapper, footer and every other
  // finance tab are untouched; the height chain ancestors carry no
  // overflow-hidden, so the extension paints visibly.
  return (
    <div className="shrink-0 min-h-0 w-full max-w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-0 flex flex-col gap-6 h-[calc(100%+24px)] lg:h-[calc(100%+32px)]">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
              Finance & Accounts Cockpit
            </h2>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20">
              Live GL Connected
            </span>
          </div>
          <p className="font-body text-xs sm:text-sm text-on-surface-variant mt-1">
            Real-time executive performance indicators for FlashVision Synthetic Leather Mills
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-xl shadow-md hover:opacity-90 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print Executive Brief
          </button>
        </div>
      </div>

      {/* 1. TOP 4 PRIMARY FINANCIAL HEALTH METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Net Revenue */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl">
              <span className="material-symbols-outlined text-[22px]">trending_up</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600">
              Gross Margin: {grossMargin}%
            </span>
          </div>
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold mb-1">Net Sales Revenue</h3>
          <div className="text-2xl font-headline font-black text-on-surface">
            {formatMoney(netRevenue, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant block mt-1">Synthetic leather dispatches</span>
        </div>

        {/* Cash & Bank Balances */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <span className="material-symbols-outlined text-[22px]">account_balance</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600">
              Quick: {quickRatio}x
            </span>
          </div>
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold mb-1">Cash & Bank Liquidity</h3>
          <div className="text-2xl font-headline font-black text-emerald-600">
            {formatMoney(cashAndBank, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant block mt-1">Cash in Hand & Bank Account</span>
        </div>

        {/* Accounts Receivable */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
              <span className="material-symbols-outlined text-[22px]">pending_actions</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600">
              DSO: {dso} Days
            </span>
          </div>
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold mb-1">Accounts Receivable (AR)</h3>
          <div className="text-2xl font-headline font-black text-amber-600">
            {formatMoney(totalReceivables, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant block mt-1">Active customer dues pending</span>
        </div>

        {/* Accounts Payable */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 shadow-sm relative overflow-hidden group">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl">
              <span className="material-symbols-outlined text-[22px]">receipt_long</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600">
              Current: {currentRatio}x
            </span>
          </div>
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold mb-1">Accounts Payable (AP)</h3>
          <div className="text-2xl font-headline font-black text-rose-600">
            {formatMoney(totalPayables, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant block mt-1">Raw material vendor liabilities</span>
        </div>
      </div>

      {/* 2. PROFITABILITY ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Net Profit Summary */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 shadow-sm flex flex-col justify-between md:col-span-3">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Net Operating Profit</span>
              <span className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl material-symbols-outlined text-[20px]">savings</span>
            </div>
            <div className="text-3xl font-headline font-black text-on-surface">
              {formatMoney(netProfit, currencyCode)}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 text-xs font-black">
                {netMargin}% Net Margin
              </span>
              <span className="text-xs text-on-surface-variant">Gross Profit: {formatMoney(grossProfit, '')}</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-outline-variant/10 flex justify-between text-xs text-on-surface-variant">
            <span>Operating Health</span>
            <span className="font-bold text-emerald-600">High Profitability</span>
          </div>
        </div>
      </div>

      {/* 3. RECENT TRANSACTIONS STREAM — grows to fill the remaining
          vertical space so the cockpit never leaves a dead white gap
          under the cards (Omer, 2026-10-24). */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-6 space-y-4 flex-1 flex flex-col min-h-[320px]">
        <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
          <div>
            <h3 className="text-base font-headline font-black text-on-surface">Recent General Ledger Activity</h3>
            <p className="text-xs text-on-surface-variant">Latest double-entry postings across all finance journals</p>
          </div>
          <span className="text-xs font-bold text-primary">Live Posting Stream</span>
        </div>

        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Voucher Ref</th>
                <th className="py-2.5 px-3">Account</th>
                <th className="py-2.5 px-3">Party</th>
                <th className="py-2.5 px-3">Narration</th>
                <th className="py-2.5 px-3 text-right">Debit (Dr)</th>
                <th className="py-2.5 px-3 text-right">Credit (Cr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {recentTransactions.map(t => (
                <tr key={t.id} className="hover:bg-surface-container-low/40">
                  <td className="py-2.5 px-3 font-mono text-on-surface-variant">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="py-2.5 px-3 font-bold text-primary">{t.voucherNo}</td>
                  <td className="py-2.5 px-3 font-medium text-on-surface">{t.accountName}</td>
                  <td className="py-2.5 px-3 text-on-surface">{t.party}</td>
                  <td className="py-2.5 px-3 text-on-surface-variant max-w-[200px] truncate">{t.narration}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600">
                    {t.debit > 0 ? formatMoney(t.debit, '') : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                    {t.credit > 0 ? formatMoney(t.credit, '') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
