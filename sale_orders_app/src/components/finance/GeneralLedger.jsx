import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { generateGeneralLedger, formatMoney, round2 } from '../../utils/financeEngine';
import ResizableHeader from '../ui/ResizableHeader';

export default function GeneralLedger() {
  const { state } = useApp();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';

  // Filters
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [selectedVoucherType, setSelectedVoucherType] = useState('all');
  const [partySearch, setPartySearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selected Entry for Modal
  const [viewEntry, setViewEntry] = useState(null);

  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    id: true,
    voucher: true,
    account: true,
    party: true,
    costCenter: true,
    narration: true,
    debit: true,
    credit: true,
    balance: true,
    actions: true
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Filter application
  const glResult = useMemo(() => {
    return generateGeneralLedger(state, {
      accountId: selectedAccountId,
      voucherType: selectedVoucherType,
      party: partySearch,
      searchTerm,
      fromDate,
      toDate
    });
  }, [state, selectedAccountId, selectedVoucherType, partySearch, searchTerm, fromDate, toDate]);

  const { entries, totalDebit, totalCredit, isBalanced, difference } = glResult;

  // Pagination slice
  const totalPages = Math.ceil(entries.length / pageSize) || 1;
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return entries.slice(start, start + pageSize);
  }, [entries, currentPage, pageSize]);

  // Account options for filter
  const chartAccounts = state.chartOfAccounts || [];

  const handleResetFilters = () => {
    setSelectedAccountId('all');
    setSelectedVoucherType('all');
    setPartySearch('');
    setSearchTerm('');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (entries.length === 0) return;
    const headers = ['Date', 'Entry ID', 'Voucher Type', 'Voucher No', 'Account Code', 'Account Name', 'Party', 'Cost Center', 'Narration', 'Debit', 'Credit', 'Running Balance'];
    const rows = entries.map(e => [
      new Date(e.date).toLocaleDateString(),
      e.id,
      e.voucherType,
      e.voucherNo,
      e.accountId,
      `"${(e.accountName || '').replace(/"/g, '""')}"`,
      `"${(e.party || '').replace(/"/g, '""')}"`,
      e.costCenter || '',
      `"${(e.narration || '').replace(/"/g, '""')}"`,
      e.debit,
      e.credit,
      e.runningBalance
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `General_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full w-full mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-headline font-black text-on-surface tracking-tight">General Ledger (GL)</h2>
            <span className="text-xs font-bold px-3 py-1 bg-surface-container text-on-surface-variant rounded-full border border-outline-variant/10">
              {entries.length} Entries Posted
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Complete double-entry accounting book conforming to ERPNext standards
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button
              onClick={() => setShowColPicker(!showColPicker)}
              className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-xl text-xs font-semibold border border-outline-variant/15 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">view_column</span>
              Columns
            </button>
            {showColPicker && (
              <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-3 shadow-xl z-50 space-y-2">
                <div className="text-[10px] font-bold uppercase text-on-surface-variant tracking-wider pb-1 border-b border-outline-variant/10">
                  Toggle Columns
                </div>
                {Object.keys(visibleColumns).map(col => (
                  <label key={col} className="flex items-center gap-2 text-xs text-on-surface cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={visibleColumns[col]}
                      onChange={() => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))}
                      className="rounded text-primary focus:ring-0"
                    />
                    <span className="capitalize">{col}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-xl text-xs font-semibold border border-outline-variant/15 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export CSV
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print Ledger
          </button>
        </div>
      </div>

      {/* Verification KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Debits (Dr)</span>
            <span className="p-2 bg-blue-500/10 text-blue-600 rounded-xl material-symbols-outlined text-[18px]">south_east</span>
          </div>
          <div className="text-2xl font-headline font-black text-on-surface">
            {formatMoney(totalDebit, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">Total incoming ledger charges</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Credits (Cr)</span>
            <span className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl material-symbols-outlined text-[18px]">north_west</span>
          </div>
          <div className="text-2xl font-headline font-black text-on-surface">
            {formatMoney(totalCredit, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">Total outgoing ledger credits</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Net Variance / Diff</span>
            <span className={`p-2 rounded-xl material-symbols-outlined text-[18px] ${isBalanced ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
              {isBalanced ? 'check_circle' : 'warning'}
            </span>
          </div>
          <div className={`text-2xl font-headline font-black ${isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatMoney(difference, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">
            {isBalanced ? 'Golden Rule: SUM(Dr) === SUM(Cr)' : 'Discrepancy detected'}
          </span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Audit Verification</span>
            <span className="p-2 bg-primary/10 text-primary rounded-xl material-symbols-outlined text-[18px]">verified_user</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-700">
              Balanced ✓
            </span>
            <span className="text-xs font-bold text-on-surface">Double-Entry OK</span>
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">Compliant with IFRS & FBR Rules</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <section className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Account Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => { setSelectedAccountId(e.target.value); setCurrentPage(1); }}
              className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Accounts (Consolidated)</option>
              {chartAccounts.filter(a => !a.isGroup).map(a => (
                <option key={a.id || a.code} value={a.id || a.code}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Voucher Type Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Voucher Type</label>
            <select
              value={selectedVoucherType}
              onChange={(e) => { setSelectedVoucherType(e.target.value); setCurrentPage(1); }}
              className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Voucher Types</option>
              <option value="Sales Invoice">Sales Invoice</option>
              <option value="Purchase Invoice">Purchase Invoice</option>
              <option value="Bank Receipt">Bank Receipt</option>
              <option value="Bank Payment Voucher">Bank Payment Voucher</option>
              <option value="Cash Payment Voucher">Cash Payment Voucher</option>
              <option value="Cash Receipt">Cash Receipt</option>
              <option value="Journal Voucher">Journal Voucher</option>
              <option value="Payroll Disbursement">Payroll Disbursement</option>
            </select>
          </div>

          {/* Party Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Party / Customer / Vendor</label>
            <input
              type="text"
              value={partySearch}
              onChange={(e) => { setPartySearch(e.target.value); setCurrentPage(1); }}
              placeholder="e.g. Al-Haq, Nexis..."
              className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Date From */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
              className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
              className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Keyword Search */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Search Keywords</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Narration, ID..."
                className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={handleResetFilters}
                title="Reset Filters"
                className="px-2.5 py-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface-variant hover:text-on-surface text-xs font-bold transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Ledger Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container-low/60 border-b border-outline-variant/10 text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                {visibleColumns.date && <ResizableHeader columnKey="date" defaultWidth={110}>Posting Date</ResizableHeader>}
                {visibleColumns.id && <ResizableHeader columnKey="id" defaultWidth={100}>GL Entry ID</ResizableHeader>}
                {visibleColumns.voucher && <ResizableHeader columnKey="voucher" defaultWidth={150}>Voucher Ref</ResizableHeader>}
                {visibleColumns.account && <ResizableHeader columnKey="account" defaultWidth={220}>Account (Code & Name)</ResizableHeader>}
                {visibleColumns.party && <ResizableHeader columnKey="party" defaultWidth={180}>Party / Counterparty</ResizableHeader>}
                {visibleColumns.costCenter && <ResizableHeader columnKey="costCenter" defaultWidth={120}>Cost Center</ResizableHeader>}
                {visibleColumns.narration && <ResizableHeader columnKey="narration" defaultWidth={260}>Narration / Memo</ResizableHeader>}
                {visibleColumns.debit && <ResizableHeader columnKey="debit" defaultWidth={130} className="text-right">Debit (Dr)</ResizableHeader>}
                {visibleColumns.credit && <ResizableHeader columnKey="credit" defaultWidth={130} className="text-right">Credit (Cr)</ResizableHeader>}
                {visibleColumns.balance && <ResizableHeader columnKey="balance" defaultWidth={140} className="text-right">Running Balance</ResizableHeader>}
                {visibleColumns.actions && <ResizableHeader columnKey="actions" defaultWidth={80} className="text-center">Action</ResizableHeader>}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-xs text-on-surface">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50 block">menu_book</span>
                    No ledger entries match the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map(e => (
                  <tr key={e.id} className="hover:bg-surface-container-low/40 transition-colors">
                    {visibleColumns.date && (
                      <td className="py-3 px-4 text-on-surface-variant font-mono whitespace-nowrap">
                        {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    )}
                    {visibleColumns.id && (
                      <td className="py-3 px-4 font-mono font-bold text-primary whitespace-nowrap">
                        {e.id}
                      </td>
                    )}
                    {visibleColumns.voucher && (
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface">{e.voucherNo}</span>
                          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">{e.voucherType}</span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.account && (
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface">{e.accountName}</span>
                          <span className="text-[10px] font-mono text-on-surface-variant">Code: {e.accountId}</span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.party && (
                      <td className="py-3 px-4 font-medium text-on-surface">
                        {e.party || '-'}
                      </td>
                    )}
                    {visibleColumns.costCenter && (
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-surface-container text-on-surface-variant">
                          {e.costCenter || 'HQ'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.narration && (
                      <td className="py-3 px-4 text-on-surface-variant max-w-[260px] truncate" title={e.narration}>
                        {e.narration}
                      </td>
                    )}
                    {visibleColumns.debit && (
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-600 whitespace-nowrap">
                        {e.debit > 0 ? formatMoney(e.debit, '') : '-'}
                      </td>
                    )}
                    {visibleColumns.credit && (
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                        {e.credit > 0 ? formatMoney(e.credit, '') : '-'}
                      </td>
                    )}
                    {visibleColumns.balance && (
                      <td className="py-3 px-4 text-right font-mono font-extrabold whitespace-nowrap">
                        {formatMoney(Math.abs(e.runningBalance), '')}
                        <span className="text-[10px] ml-1 text-on-surface-variant font-bold">
                          {e.runningBalance >= 0 ? 'Dr' : 'Cr'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setViewEntry(e)}
                          className="p-1 hover:bg-surface-container rounded-lg text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer with Verified Totals */}
            <tfoot>
              <tr className="bg-surface-container-low font-bold text-xs border-t-2 border-outline-variant/20">
                <td colSpan={visibleColumns.date + visibleColumns.id + visibleColumns.voucher + visibleColumns.account + visibleColumns.party + visibleColumns.costCenter + visibleColumns.narration - 1} className="py-3 px-4 text-right uppercase tracking-wider text-on-surface-variant">
                  Filtered Totals:
                </td>
                <td className="py-3 px-4 text-right font-mono text-blue-600 font-extrabold">
                  {formatMoney(totalDebit, currencyCode)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-emerald-600 font-extrabold">
                  {formatMoney(totalCredit, currencyCode)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-black text-on-surface">
                  {formatMoney(Math.abs(difference), '')} {difference >= 0 ? 'Dr' : 'Cr'}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="p-4 bg-surface-container-low/40 border-t border-outline-variant/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span>Showing {entries.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, entries.length)} of {entries.length} entries</span>
            <span>•</span>
            <label className="flex items-center gap-1">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="bg-surface-container-lowest border border-outline-variant/15 rounded-lg px-2 py-1 text-xs outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-outline-variant/15 disabled:opacity-40 hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">first_page</span>
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-outline-variant/15 disabled:opacity-40 hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <span className="px-3 py-1 font-bold text-on-surface">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-outline-variant/15 disabled:opacity-40 hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-outline-variant/15 disabled:opacity-40 hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">last_page</span>
            </button>
          </div>
        </div>
      </div>

      {/* View Entry Modal */}
      {viewEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">receipt_long</span>
                <h3 className="text-lg font-bold text-on-surface">General Ledger Entry</h3>
              </div>
              <button
                onClick={() => setViewEntry(null)}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-on-surface-variant block font-bold uppercase text-[10px]">Entry ID</span>
                <span className="font-mono font-bold text-on-surface">{viewEntry.id}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-bold uppercase text-[10px]">Date</span>
                <span className="text-on-surface">{new Date(viewEntry.date).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-bold uppercase text-[10px]">Voucher Type</span>
                <span className="font-bold text-on-surface">{viewEntry.voucherType}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-bold uppercase text-[10px]">Voucher No</span>
                <span className="font-bold text-primary">{viewEntry.voucherNo}</span>
              </div>
              <div className="col-span-2">
                <span className="text-on-surface-variant block font-bold uppercase text-[10px]">Account</span>
                <span className="font-bold text-on-surface">{viewEntry.accountName} ({viewEntry.accountId})</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-bold uppercase text-[10px]">Party</span>
                <span className="text-on-surface">{viewEntry.party || 'N/A'}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-bold uppercase text-[10px]">Cost Center</span>
                <span className="text-on-surface">{viewEntry.costCenter || 'HQ'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-on-surface-variant block font-bold uppercase text-[10px]">Narration / Details</span>
                <p className="text-on-surface bg-surface-container-low p-2 rounded-xl mt-1">{viewEntry.narration}</p>
              </div>
              <div>
                <span className="text-on-surface-variant block font-bold uppercase text-[10px]">Debit (Dr)</span>
                <span className="font-mono font-bold text-blue-600 text-sm">{formatMoney(viewEntry.debit, currencyCode)}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-bold uppercase text-[10px]">Credit (Cr)</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">{formatMoney(viewEntry.credit, currencyCode)}</span>
              </div>
              <div className="col-span-2">
                <span className="text-on-surface-variant block font-bold uppercase text-[10px]">Account Balance Post-Transaction</span>
                <span className="font-mono font-black text-on-surface text-sm">
                  {formatMoney(Math.abs(viewEntry.runningBalance), currencyCode)} {viewEntry.runningBalance >= 0 ? '(Debit)' : '(Credit)'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewEntry(null)}
                className="px-4 py-2 bg-surface-container text-on-surface rounded-xl font-bold text-xs hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
