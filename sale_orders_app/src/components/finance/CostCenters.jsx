import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { generateCostCenterReport, formatMoney, round2 } from '../../utils/financeEngine';
import ResizableHeader from '../ui/ResizableHeader';

export default function CostCenters() {
  const { state } = useApp();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';

  const costCenterData = useMemo(() => {
    return generateCostCenterReport(state);
  }, [state]);

  const { rows, totalBudget, totalSpent, netVariance } = costCenterData;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full w-full mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-xs text-on-surface-variant mb-2">
            <span>Finance & Accounts</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-semibold">Cost Centers</span>
          </nav>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-headline font-black text-on-surface tracking-tight">Cost Centers & Line Allocations</h2>
            <span className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
              {rows.length} Active Lines
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Production Line Departmental Budgets, Chemical Consumption & Variance Analysis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print Variance Report
          </button>
        </div>
      </div>

      {/* KPI Cockpit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Plant Budget</span>
            <span className="p-2 bg-blue-500/10 text-blue-600 rounded-xl material-symbols-outlined text-[18px]">account_balance_wallet</span>
          </div>
          <div className="text-2xl font-headline font-black text-on-surface">
            {formatMoney(totalBudget, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">Monthly allocated budget ceiling</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Actual Direct Spend</span>
            <span className="p-2 bg-purple-500/10 text-purple-600 rounded-xl material-symbols-outlined text-[18px]">payments</span>
          </div>
          <div className="text-2xl font-headline font-black text-purple-600">
            {formatMoney(totalSpent, currencyCode)}
          </div>
          <span className="text-[11px] text-purple-600 font-bold mt-1">
            Overall Utilization: {totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : 0}%
          </span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Net Variance</span>
            <span className={`p-2 rounded-xl material-symbols-outlined text-[18px] ${
              netVariance >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
            }`}>
              {netVariance >= 0 ? 'thumb_up' : 'warning'}
            </span>
          </div>
          <div className={`text-2xl font-headline font-black ${
            netVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {formatMoney(netVariance, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">
            {netVariance >= 0 ? 'Favorable (Under Budget)' : 'Unfavorable (Over Budget)'}
          </span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Primary Cost Center</span>
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-xl material-symbols-outlined text-[18px]">precision_manufacturing</span>
          </div>
          <div className="text-base font-headline font-black text-on-surface truncate">
            Dry Coating & Foaming
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">Highest chemical resin consumption</span>
        </div>
      </div>

      {/* Line Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(cc => (
          <div key={cc.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                  {cc.code}
                </span>
                <h4 className="text-sm font-black text-on-surface mt-1">{cc.name}</h4>
                <p className="text-[11px] text-on-surface-variant">{cc.manager}</p>
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                cc.isOverBudget ? 'bg-rose-500/15 text-rose-700' : 'bg-emerald-500/15 text-emerald-700'
              }`}>
                {cc.percentUsed}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    cc.isOverBudget ? 'bg-rose-600' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, cc.percentUsed)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-on-surface-variant font-mono">
                <span>Spent: {formatMoney(cc.actualSpent, '')}</span>
                <span>Budget: {formatMoney(cc.monthlyBudget, '')}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-outline-variant/10 flex justify-between items-center text-xs">
              <span className="text-on-surface-variant">Budget Variance:</span>
              <span className={`font-mono font-bold ${cc.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {cc.variance >= 0 ? '+' : ''}{formatMoney(cc.variance, currencyCode)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Comprehensive Line Allocations Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant/10">
                <ResizableHeader columnKey="code" defaultWidth={120}>Line Code</ResizableHeader>
                <ResizableHeader columnKey="name" defaultWidth={260}>Cost Center / Department</ResizableHeader>
                <ResizableHeader columnKey="mgr" defaultWidth={180}>Incharge / Manager</ResizableHeader>
                <ResizableHeader columnKey="budget" defaultWidth={140} className="text-right">Monthly Budget</ResizableHeader>
                <ResizableHeader columnKey="actual" defaultWidth={140} className="text-right">Actual Cost</ResizableHeader>
                <ResizableHeader columnKey="variance" defaultWidth={140} className="text-right">Variance</ResizableHeader>
                <ResizableHeader columnKey="util" defaultWidth={110} className="text-center">Utilized %</ResizableHeader>
                <ResizableHeader columnKey="status" defaultWidth={110} className="text-center">Status</ResizableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-xs">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-surface-container-low/40">
                  <td className="py-3 px-4 font-mono font-bold text-primary">{r.code}</td>
                  <td className="py-3 px-4 font-bold text-on-surface">{r.name}</td>
                  <td className="py-3 px-4 text-on-surface-variant">{r.manager}</td>
                  <td className="py-3 px-4 text-right font-mono text-on-surface">{formatMoney(r.monthlyBudget, '')}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-purple-600">{formatMoney(r.actualSpent, '')}</td>
                  <td className={`py-3 px-4 text-right font-mono font-bold ${
                    r.variance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {formatMoney(r.variance, '')}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold">{r.percentUsed}%</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      r.isOverBudget ? 'bg-rose-500/15 text-rose-700' : 'bg-emerald-500/15 text-emerald-700'
                    }`}>
                      {r.isOverBudget ? 'Over Budget' : 'Within Budget'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-container font-black text-xs border-t-2 border-outline-variant/30 text-on-surface">
                <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider">Consolidated Plant Operations:</td>
                <td className="py-3 px-4 text-right font-mono">{formatMoney(totalBudget, '')}</td>
                <td className="py-3 px-4 text-right font-mono text-purple-600">{formatMoney(totalSpent, '')}</td>
                <td className={`py-3 px-4 text-right font-mono ${netVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatMoney(netVariance, currencyCode)}
                </td>
                <td className="py-3 px-4 text-center font-mono">{((totalSpent / totalBudget) * 100).toFixed(1)}%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
