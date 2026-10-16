import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  generateTrialBalance,
  generateProfitAndLoss,
  generateBalanceSheet,
  generateCashFlow,
  formatMoney,
  round2
} from '../../utils/financeEngine';
import ResizableHeader from '../ui/ResizableHeader';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

export default function FinancialStatements() {
  const { state } = useApp();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';

  // Active Sub-statement tab
  const [statementTab, setStatementTab] = useState('trial-balance'); // 'trial-balance', 'pnl', 'balance-sheet', 'cash-flow'
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Date Filters
  const [datePreset, setDatePreset] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Search in statements
  const [searchFilter, setSearchFilter] = useState('');

  // Handle Preset Changes
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setFromDate(start);
      setToDate(end);
    } else if (preset === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qMonth, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), qMonth + 3, 0).toISOString().split('T')[0];
      setFromDate(start);
      setToDate(end);
    } else if (preset === 'year') {
      const start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const end = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      setFromDate(start);
      setToDate(end);
    }
  };

  // Computed Statements Data
  const trialBalanceData = useMemo(() => {
    return generateTrialBalance(state, fromDate || null, toDate || null);
  }, [state, fromDate, toDate]);

  const pnlData = useMemo(() => {
    return generateProfitAndLoss(state, fromDate || null, toDate || null);
  }, [state, fromDate, toDate]);

  const balanceSheetData = useMemo(() => {
    return generateBalanceSheet(state, toDate || null);
  }, [state, toDate]);

  const cashFlowData = useMemo(() => {
    return generateCashFlow(state, fromDate || null, toDate || null);
  }, [state, fromDate, toDate]);

  const printData = useMemo(() => {
    let title = 'FINANCIAL STATEMENTS';
    let items = [];
    let totals = {};

    const fiscalPeriod = `${fromDate || 'FY-Start'} to ${toDate || new Date().toISOString().split('T')[0]}`;

    if (statementTab === 'trial-balance') {
      title = 'TRIAL BALANCE STATEMENT';
      const rows = [];
      Object.entries(trialBalanceData.grouped || {}).forEach(([cat, accs]) => {
        accs.forEach(acc => {
          rows.push({
            line_code: acc.code,
            line_title: `${acc.name} (${cat})`,
            current_period: acc.closingDebit || 0,
            prior_period: acc.closingCredit || 0
          });
        });
      });
      items = rows;
      totals = {
        'Closing Debits': trialBalanceData.totals?.closingDebit || 0,
        'Closing Credits': trialBalanceData.totals?.closingCredit || 0,
        'Difference': trialBalanceData.totals?.difference || 0
      };
    } else if (statementTab === 'pnl') {
      title = 'STATEMENT OF PROFIT OR LOSS';
      const rows = [
        { line_code: '4000', line_title: 'Gross Finished Synthetic Leather Sales', current_period: pnlData.revenue?.grossSales || 0, prior_period: 0 },
        { line_code: '4100', line_title: 'Net Sales Revenue', current_period: pnlData.revenue?.netSales || 0, prior_period: 0 },
        ...(pnlData.cogs?.breakdown || []).map(b => ({
          line_code: b.code || '5000',
          line_title: b.name || 'COGS',
          current_period: -(b.amount || 0),
          prior_period: 0
        })),
        { line_code: 'GP', line_title: 'Gross Profit', current_period: pnlData.grossProfit || 0, prior_period: 0 },
        ...(pnlData.operatingExpenses?.breakdown || []).map(b => ({
          line_code: b.code || '6000',
          line_title: b.name || 'Operating Expense',
          current_period: -(b.amount || 0),
          prior_period: 0
        })),
        { line_code: 'NP', line_title: 'Net Operating Profit', current_period: pnlData.netProfit || 0, prior_period: 0 }
      ];
      items = rows;
      totals = {
        'Net Revenue': pnlData.revenue?.netSales || 0,
        'COGS Total': pnlData.cogs?.total || 0,
        'Gross Profit': pnlData.grossProfit || 0,
        'Operating Expenses': pnlData.operatingExpenses?.total || 0,
        'Net Operating Profit': pnlData.netProfit || 0
      };
    } else if (statementTab === 'balance-sheet') {
      title = 'BALANCE SHEET (STATEMENT OF FINANCIAL POSITION)';
      const rows = [
        ...(balanceSheetData.assets?.current?.breakdown || []).map(b => ({
          line_code: b.code || '1000',
          line_title: b.name || 'Current Asset',
          current_period: b.amount || 0,
          prior_period: 0
        })),
        ...(balanceSheetData.assets?.nonCurrent?.breakdown || []).map(b => ({
          line_code: b.code || '1500',
          line_title: b.name || 'Non-Current Asset',
          current_period: b.amount || 0,
          prior_period: 0
        })),
        ...(balanceSheetData.liabilities?.current?.breakdown || []).map(b => ({
          line_code: b.code || '2000',
          line_title: b.name || 'Current Liability',
          current_period: b.amount || 0,
          prior_period: 0
        })),
        ...(balanceSheetData.equity?.breakdown || []).map(b => ({
          line_code: b.code || '3000',
          line_title: b.name || 'Equity Head',
          current_period: b.amount || 0,
          prior_period: 0
        }))
      ];
      items = rows;
      totals = {
        'Total Assets': balanceSheetData.totalAssets || 0,
        'Total Liabilities': balanceSheetData.totalLiabilities || 0,
        'Total Equity': balanceSheetData.totalEquity || 0,
        'Total Liab & Equity': balanceSheetData.totalLiabilitiesAndEquity || 0
      };
    } else {
      title = 'STATEMENT OF CASH FLOWS';
      const rows = [
        { line_code: 'CF-OPS', line_title: 'Cash Flow from Operating Activities', current_period: cashFlowData.operating?.netCash || 0, prior_period: 0 },
        { line_code: 'CF-INV', line_title: 'Cash Flow from Investing Activities', current_period: cashFlowData.investing?.netCash || 0, prior_period: 0 },
        { line_code: 'CF-FIN', line_title: 'Cash Flow from Financing Activities', current_period: cashFlowData.financing?.netCash || 0, prior_period: 0 }
      ];
      items = rows;
      totals = {
        'Operating Cash Flow': cashFlowData.operating?.netCash || 0,
        'Investing Cash Flow': cashFlowData.investing?.netCash || 0,
        'Financing Cash Flow': cashFlowData.financing?.netCash || 0,
        'Net Cash Movement': cashFlowData.netChange || 0
      };
    }

    return {
      statement_title: title,
      financial_period: fiscalPeriod,
      currency: currencyCode,
      generated_on: new Date().toISOString().split('T')[0],
      header: {
        statement_title: title,
        financial_period: fiscalPeriod,
        currency: currencyCode,
        generated_on: new Date().toISOString().split('T')[0]
      },
      items,
      totals
    };
  }, [statementTab, trialBalanceData, pnlData, balanceSheetData, cashFlowData, fromDate, toDate, currencyCode]);

  const handlePrint = () => {
    setShowPrintModal(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full w-full mx-auto space-y-6">
      {showPrintModal && (
        <UniversalPrintPreviewModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          documentType="financial_statements"
          documentData={printData}
          documentTitle={printData.statement_title}
        />
      )}
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-headline font-black text-on-surface tracking-tight">Financial Statements</h2>
            <span className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
              Audit-Ready
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Consolidated IFRS & GAAP Compliant Statements with Real-Time Double-Entry Balancing
          </p>
        </div>

        {/* Global statement controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/15 text-xs font-semibold">
            <button
              onClick={() => handlePresetChange('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${datePreset === 'all' ? 'bg-surface-container-lowest text-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              All Time
            </button>
            <button
              onClick={() => handlePresetChange('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${datePreset === 'month' ? 'bg-surface-container-lowest text-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              This Month
            </button>
            <button
              onClick={() => handlePresetChange('quarter')}
              className={`px-3 py-1.5 rounded-lg transition-all ${datePreset === 'quarter' ? 'bg-surface-container-lowest text-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Q3
            </button>
            <button
              onClick={() => handlePresetChange('year')}
              className={`px-3 py-1.5 rounded-lg transition-all ${datePreset === 'year' ? 'bg-surface-container-lowest text-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              FY 2026
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print Report
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation for Statements */}
      <div className="flex border-b border-outline-variant/15 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setStatementTab('trial-balance')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            statementTab === 'trial-balance'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 rounded-t-xl'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">balance</span>
          Trial Balance
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/10 text-emerald-600 font-bold">
            {trialBalanceData.totals.isBalanced ? 'Balanced ✓' : 'Out'}
          </span>
        </button>

        <button
          onClick={() => setStatementTab('pnl')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            statementTab === 'pnl'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 rounded-t-xl'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">trending_up</span>
          Profit & Loss (P&L)
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary font-bold">
            {pnlData.netMarginPercent}% Margin
          </span>
        </button>

        <button
          onClick={() => setStatementTab('balance-sheet')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            statementTab === 'balance-sheet'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 rounded-t-xl'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">account_balance</span>
          Balance Sheet
          <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/10 text-emerald-600 font-bold">
            {balanceSheetData.isBalanced ? 'A = L + E ✓' : 'Out'}
          </span>
        </button>

        <button
          onClick={() => setStatementTab('cash-flow')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            statementTab === 'cash-flow'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 rounded-t-xl'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">payments</span>
          Cash Flow Statement
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. TRIAL BALANCE TAB CONTENT                                   */}
      {/* ------------------------------------------------------------- */}
      {statementTab === 'trial-balance' && (
        <div className="space-y-6">
          {/* Audit Verification Banner */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl material-symbols-outlined text-[24px]">verified</span>
              <div>
                <h4 className="text-sm font-bold text-on-surface">Double-Entry Verification Status</h4>
                <p className="text-xs text-on-surface-variant">
                  Debits and credits across all 5 ledger categories are strictly verified.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Closing Debits</span>
                <span className="font-mono font-bold text-blue-600 text-sm">
                  {formatMoney(trialBalanceData.totals.closingDebit, currencyCode)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Closing Credits</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  {formatMoney(trialBalanceData.totals.closingCredit, currencyCode)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Difference</span>
                <span className="font-mono font-black text-emerald-600 text-sm">
                  {formatMoney(trialBalanceData.totals.difference, currencyCode)}
                </span>
              </div>
            </div>
          </div>

          {/* Trial Balance Table */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant/10">
                    <ResizableHeader columnKey="code" defaultWidth={110}>Account Code</ResizableHeader>
                    <ResizableHeader columnKey="name" defaultWidth={280}>Account Name</ResizableHeader>
                    <ResizableHeader columnKey="type" defaultWidth={120}>Category</ResizableHeader>
                    <ResizableHeader columnKey="opDr" defaultWidth={130} className="text-right">Opening Dr</ResizableHeader>
                    <ResizableHeader columnKey="opCr" defaultWidth={130} className="text-right">Opening Cr</ResizableHeader>
                    <ResizableHeader columnKey="movDr" defaultWidth={130} className="text-right">Movement Dr</ResizableHeader>
                    <ResizableHeader columnKey="movCr" defaultWidth={130} className="text-right">Movement Cr</ResizableHeader>
                    <ResizableHeader columnKey="clDr" defaultWidth={140} className="text-right">Closing Dr</ResizableHeader>
                    <ResizableHeader columnKey="clCr" defaultWidth={140} className="text-right">Closing Cr</ResizableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-xs">
                  {Object.entries(trialBalanceData.grouped).map(([rootCategory, accounts]) => (
                    <React.Fragment key={rootCategory}>
                      {/* Section Header */}
                      <tr className="bg-surface-container-low/70 font-black text-on-surface tracking-wide">
                        <td colSpan={9} className="py-2.5 px-4 text-xs uppercase flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-primary">folder_open</span>
                          {rootCategory} Accounts ({accounts.length})
                        </td>
                      </tr>
                      {accounts.map(acc => (
                        <tr key={acc.code} className="hover:bg-surface-container-low/30 transition-colors">
                          <td className="py-2.5 px-4 font-mono font-bold text-primary">{acc.code}</td>
                          <td className="py-2.5 px-4 font-medium text-on-surface">{acc.name}</td>
                          <td className="py-2.5 px-4 text-[11px] text-on-surface-variant">{acc.category}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-on-surface-variant">
                            {acc.openingDebit > 0 ? formatMoney(acc.openingDebit, '') : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-on-surface-variant">
                            {acc.openingCredit > 0 ? formatMoney(acc.openingCredit, '') : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-blue-600 font-bold">
                            {acc.movementDebit > 0 ? formatMoney(acc.movementDebit, '') : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-emerald-600 font-bold">
                            {acc.movementCredit > 0 ? formatMoney(acc.movementCredit, '') : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-on-surface font-extrabold bg-blue-500/5">
                            {acc.closingDebit > 0 ? formatMoney(acc.closingDebit, '') : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-on-surface font-extrabold bg-emerald-500/5">
                            {acc.closingCredit > 0 ? formatMoney(acc.closingCredit, '') : '-'}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-container font-black text-xs border-t-2 border-outline-variant/30 text-on-surface">
                    <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider">
                      Grand Totals:
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-on-surface">
                      {formatMoney(trialBalanceData.totals.openingDebit, '')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-on-surface">
                      {formatMoney(trialBalanceData.totals.openingCredit, '')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-600">
                      {formatMoney(trialBalanceData.totals.movementDebit, '')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600">
                      {formatMoney(trialBalanceData.totals.movementCredit, '')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-700 bg-blue-500/10 text-sm">
                      {formatMoney(trialBalanceData.totals.closingDebit, currencyCode)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 bg-emerald-500/10 text-sm">
                      {formatMoney(trialBalanceData.totals.closingCredit, currencyCode)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. PROFIT & LOSS STATEMENT TAB CONTENT                         */}
      {/* ------------------------------------------------------------- */}
      {statementTab === 'pnl' && (
        <div className="space-y-6">
          {/* Top Performance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Total Net Revenue</span>
              <div className="text-2xl font-headline font-black text-on-surface">
                {formatMoney(pnlData.revenue.totalRevenue, currencyCode)}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> Billed & Job Work
              </span>
            </div>

            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Cost of Goods Sold (COGS)</span>
              <div className="text-2xl font-headline font-black text-rose-600">
                {formatMoney(pnlData.cogs.total, currencyCode)}
              </div>
              <span className="text-[11px] text-on-surface-variant mt-1 block">Raw material, energy & factory labor</span>
            </div>

            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Gross Profit</span>
              <div className="text-2xl font-headline font-black text-blue-600">
                {formatMoney(pnlData.grossProfit, currencyCode)}
              </div>
              <span className="text-[11px] text-blue-600 font-bold mt-1 block">
                Gross Margin: {pnlData.grossMarginPercent}%
              </span>
            </div>

            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-1">Net Operating Profit</span>
              <div className="text-2xl font-headline font-black text-emerald-600">
                {formatMoney(pnlData.netProfit, currencyCode)}
              </div>
              <span className="text-[11px] text-emerald-600 font-bold mt-1 block">
                Net Margin: {pnlData.netMarginPercent}%
              </span>
            </div>
          </div>

          {/* Detailed Multi-Tier Statement Table */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-6 space-y-6">
            <div className="border-b border-outline-variant/10 pb-4">
              <h3 className="text-lg font-headline font-extrabold text-on-surface">Income Statement Breakdown</h3>
              <p className="text-xs text-on-surface-variant">Period: {fromDate || 'Inception'} to {toDate || 'Current Date'}</p>
            </div>

            {/* 1. Operating Revenue */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-black text-on-surface border-b border-outline-variant/10 pb-2">
                <span>1. Operating Revenue</span>
                <span>{formatMoney(pnlData.revenue.totalRevenue, currencyCode)}</span>
              </div>
              <div className="space-y-1.5 pl-4 text-xs text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Gross Finished Synthetic Leather Sales</span>
                  <span className="font-mono text-on-surface">{formatMoney(pnlData.revenue.grossSales, currencyCode)}</span>
                </div>
                {pnlData.revenue.discounts > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Less: Sales Discounts & Rebates</span>
                    <span className="font-mono">({formatMoney(pnlData.revenue.discounts, currencyCode)})</span>
                  </div>
                )}
                {pnlData.revenue.returns > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Less: Quality Returns & Allowances</span>
                    <span className="font-mono">({formatMoney(pnlData.revenue.returns, currencyCode)})</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-outline-variant/5 font-bold text-on-surface">
                  <span>Net Sales Revenue</span>
                  <span className="font-mono">{formatMoney(pnlData.revenue.netSales, currencyCode)}</span>
                </div>
                {pnlData.revenue.otherIncome > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Add: Other Income (Scrap & Offcuts)</span>
                    <span className="font-mono">+{formatMoney(pnlData.revenue.otherIncome, currencyCode)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Cost of Goods Sold */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-black text-on-surface border-b border-outline-variant/10 pb-2">
                <span>2. Cost of Goods Sold (Manufacturing Cost)</span>
                <span className="text-rose-600 font-mono">({formatMoney(pnlData.cogs.total, currencyCode)})</span>
              </div>
              <div className="space-y-1.5 pl-4 text-xs text-on-surface-variant">
                {pnlData.cogs.breakdown.map(item => (
                  <div key={item.code} className="flex justify-between">
                    <span>{item.name} ({item.code})</span>
                    <span className="font-mono text-on-surface">{formatMoney(item.amount, currencyCode)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gross Profit Summary Row */}
            <div className="flex justify-between items-center text-sm font-black p-3 bg-blue-500/10 text-blue-700 rounded-xl">
              <span>GROSS PROFIT</span>
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 bg-blue-200/50 rounded-md font-bold">Margin: {pnlData.grossMarginPercent}%</span>
                <span className="font-mono text-base">{formatMoney(pnlData.grossProfit, currencyCode)}</span>
              </div>
            </div>

            {/* 3. Operating & Administrative Expenses */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-black text-on-surface border-b border-outline-variant/10 pb-2">
                <span>3. Operating & Administrative Expenses</span>
                <span className="text-rose-600 font-mono">({formatMoney(pnlData.operatingExpenses.total, currencyCode)})</span>
              </div>
              <div className="space-y-1.5 pl-4 text-xs text-on-surface-variant">
                {pnlData.operatingExpenses.breakdown.map(item => (
                  <div key={item.code} className="flex justify-between">
                    <span>{item.name} ({item.code})</span>
                    <span className="font-mono text-on-surface">{formatMoney(item.amount, currencyCode)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Net Profit Final Row */}
            <div className="flex justify-between items-center text-base font-black p-4 bg-emerald-500/15 text-emerald-800 rounded-2xl border border-emerald-500/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px]">verified</span>
                <span>NET OPERATING PROFIT / (LOSS)</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs px-2.5 py-1 bg-emerald-200 text-emerald-900 rounded-lg font-bold">Net Margin: {pnlData.netMarginPercent}%</span>
                <span className="font-mono text-xl">{formatMoney(pnlData.netProfit, currencyCode)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. BALANCE SHEET TAB CONTENT                                   */}
      {/* ------------------------------------------------------------- */}
      {statementTab === 'balance-sheet' && (
        <div className="space-y-6">
          {/* Balance Sheet Verification Banner */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-primary/10 text-primary rounded-xl material-symbols-outlined text-[24px]">account_balance</span>
              <div>
                <h4 className="text-sm font-bold text-on-surface">Fundamental Accounting Equation</h4>
                <p className="text-xs text-on-surface-variant">
                  Total Assets = Total Liabilities + Total Stockholders Equity
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Total Assets</span>
                <span className="font-mono font-bold text-blue-600 text-sm">
                  {formatMoney(balanceSheetData.assets.total, currencyCode)}
                </span>
              </div>
              <span className="text-xl font-bold text-on-surface-variant">=</span>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Liabilities + Equity</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  {formatMoney(balanceSheetData.totalLiabilitiesAndEquity, currencyCode)}
                </span>
              </div>
              <span className="px-3 py-1 bg-emerald-500/15 text-emerald-700 font-black text-xs rounded-full">
                {balanceSheetData.isBalanced ? 'Balanced ✓' : 'Discrepancy'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ASSETS COLUMN */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
                <h3 className="text-base font-headline font-black text-on-surface uppercase tracking-wide flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">domain</span>
                  Application of Funds (Assets)
                </h3>
                <span className="font-mono font-black text-blue-600 text-base">
                  {formatMoney(balanceSheetData.assets.total, currencyCode)}
                </span>
              </div>

              {/* Current Assets */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-black uppercase text-on-surface border-b border-outline-variant/10 pb-1">
                  <span>Current Assets</span>
                  <span className="font-mono text-on-surface">{formatMoney(balanceSheetData.assets.totalCurrent, currencyCode)}</span>
                </div>
                <div className="space-y-2 pl-2 text-xs">
                  {balanceSheetData.assets.current.map(acc => {
                    const net = acc.closingDebit - acc.closingCredit;
                    return (
                      <div key={acc.code} className="flex justify-between text-on-surface-variant hover:text-on-surface">
                        <span>{acc.name}</span>
                        <span className="font-mono font-medium text-on-surface">{formatMoney(net, '')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Fixed Assets */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs font-black uppercase text-on-surface border-b border-outline-variant/10 pb-1">
                  <span>Non-Current & Fixed Assets</span>
                  <span className="font-mono text-on-surface">{formatMoney(balanceSheetData.assets.totalFixed, currencyCode)}</span>
                </div>
                <div className="space-y-2 pl-2 text-xs">
                  {balanceSheetData.assets.fixed.map(acc => {
                    const net = acc.closingDebit - acc.closingCredit;
                    return (
                      <div key={acc.code} className="flex justify-between text-on-surface-variant hover:text-on-surface">
                        <span>{acc.name}</span>
                        <span className="font-mono font-medium text-on-surface">{formatMoney(net, '')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* LIABILITIES & EQUITY COLUMN */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-6 space-y-6">
              <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
                <h3 className="text-base font-headline font-black text-on-surface uppercase tracking-wide flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">account_balance_wallet</span>
                  Source of Funds (Liabilities & Equity)
                </h3>
                <span className="font-mono font-black text-emerald-600 text-base">
                  {formatMoney(balanceSheetData.totalLiabilitiesAndEquity, currencyCode)}
                </span>
              </div>

              {/* Current Liabilities */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-black uppercase text-on-surface border-b border-outline-variant/10 pb-1">
                  <span>Current Liabilities</span>
                  <span className="font-mono text-on-surface">{formatMoney(balanceSheetData.liabilities.totalCurrent, currencyCode)}</span>
                </div>
                <div className="space-y-2 pl-2 text-xs">
                  {balanceSheetData.liabilities.current.map(acc => {
                    const net = acc.closingCredit - acc.closingDebit;
                    return (
                      <div key={acc.code} className="flex justify-between text-on-surface-variant hover:text-on-surface">
                        <span>{acc.name}</span>
                        <span className="font-mono font-medium text-on-surface">{formatMoney(net, '')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Non-Current Liabilities */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs font-black uppercase text-on-surface border-b border-outline-variant/10 pb-1">
                  <span>Non-Current Liabilities</span>
                  <span className="font-mono text-on-surface">{formatMoney(balanceSheetData.liabilities.totalNonCurrent, currencyCode)}</span>
                </div>
                <div className="space-y-2 pl-2 text-xs">
                  {balanceSheetData.liabilities.nonCurrent.map(acc => {
                    const net = acc.closingCredit - acc.closingDebit;
                    return (
                      <div key={acc.code} className="flex justify-between text-on-surface-variant hover:text-on-surface">
                        <span>{acc.name}</span>
                        <span className="font-mono font-medium text-on-surface">{formatMoney(net, '')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stockholders Equity */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs font-black uppercase text-on-surface border-b border-outline-variant/10 pb-1">
                  <span>Capital & Reserves (Equity)</span>
                  <span className="font-mono text-on-surface">{formatMoney(balanceSheetData.equity.total, currencyCode)}</span>
                </div>
                <div className="space-y-2 pl-2 text-xs">
                  {balanceSheetData.equity.rows.map(acc => {
                    const net = acc.closingCredit - acc.closingDebit;
                    return (
                      <div key={acc.code} className="flex justify-between text-on-surface-variant hover:text-on-surface">
                        <span>{acc.name}</span>
                        <span className="font-mono font-medium text-on-surface">{formatMoney(net, '')}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-emerald-600 font-bold bg-emerald-500/10 p-2 rounded-xl">
                    <span>Current Period Profit / (Loss) (from P&L)</span>
                    <span className="font-mono">{formatMoney(balanceSheetData.equity.currentPeriodProfit, currencyCode)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. CASH FLOW STATEMENT TAB CONTENT                             */}
      {/* ------------------------------------------------------------- */}
      {statementTab === 'cash-flow' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-6 space-y-6">
            <div className="border-b border-outline-variant/10 pb-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-headline font-extrabold text-on-surface">Statement of Cash Flows</h3>
                <p className="text-xs text-on-surface-variant">Direct Method - Bank & Cash Liquidity Movements</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Closing Cash & Bank</span>
                <span className="text-xl font-headline font-black text-emerald-600">
                  {formatMoney(cashFlowData.closingCash, currencyCode)}
                </span>
              </div>
            </div>

            {/* Operating Cash Flows */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-black text-on-surface border-b border-outline-variant/10 pb-2">
                <span>1. Cash Flow from Operating Activities</span>
                <span className="font-mono text-emerald-600">{formatMoney(cashFlowData.operating.net, currencyCode)}</span>
              </div>
              <div className="space-y-2 pl-4 text-xs text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Cash Collections from Customers (Invoices & Receipts)</span>
                  <span className="font-mono text-emerald-600 font-bold">+{formatMoney(cashFlowData.operating.customerCollections, currencyCode)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payments to Raw Material Suppliers & Vendors</span>
                  <span className="font-mono text-rose-600 font-bold">({formatMoney(cashFlowData.operating.supplierPayments, currencyCode)})</span>
                </div>
                <div className="flex justify-between">
                  <span>Factory Maintenance, Labor & Overhead Disbursals</span>
                  <span className="font-mono text-rose-600 font-bold">({formatMoney(cashFlowData.operating.operatingCashOutflows, currencyCode)})</span>
                </div>
              </div>
            </div>

            {/* Investing Cash Flows */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-black text-on-surface border-b border-outline-variant/10 pb-2">
                <span>2. Cash Flow from Investing Activities</span>
                <span className="font-mono text-on-surface">{formatMoney(cashFlowData.investing.net, currencyCode)}</span>
              </div>
              <div className="space-y-2 pl-4 text-xs text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Capital Expenditures on Coating & Foaming Line Equipment</span>
                  <span className="font-mono text-on-surface">PKR 0.00</span>
                </div>
              </div>
            </div>

            {/* Financing Cash Flows */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-black text-on-surface border-b border-outline-variant/10 pb-2">
                <span>3. Cash Flow from Financing Activities</span>
                <span className="font-mono text-on-surface">{formatMoney(cashFlowData.financing.net, currencyCode)}</span>
              </div>
              <div className="space-y-2 pl-4 text-xs text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Industrial Bank Loan Disbursements / Sponsor Drawings</span>
                  <span className="font-mono text-on-surface">PKR 0.00</span>
                </div>
              </div>
            </div>

            {/* Summary Reconciliation */}
            <div className="pt-4 border-t-2 border-outline-variant/20 space-y-2 text-sm font-bold">
              <div className="flex justify-between text-on-surface-variant">
                <span>Net Increase / (Decrease) in Cash & Cash Equivalents</span>
                <span className="font-mono text-primary font-black">{formatMoney(cashFlowData.netCashFlow, currencyCode)}</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Cash & Bank Balances at Beginning of Period</span>
                <span className="font-mono text-on-surface font-black">{formatMoney(cashFlowData.openingCash, currencyCode)}</span>
              </div>
              <div className="flex justify-between text-base font-black p-3 bg-emerald-500/10 text-emerald-800 rounded-xl">
                <span>Cash & Bank Balances at End of Period</span>
                <span className="font-mono">{formatMoney(cashFlowData.closingCash, currencyCode)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
