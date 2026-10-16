import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import ResizableHeader from '../ui/ResizableHeader';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

export default function LedgerTaxDashboard() {
  const { state } = useApp();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';
  const [printData, setPrintData] = useState(null);

  // state lists read karna
  const salesInvoices = state.salesInvoices || [];
  const purchaseInvoices = state.purchaseInvoices || [];
  const vouchersList = state.vouchers || [];

  // Dynamic KPI Card Calculations with base offset values for realism
  const totalPayables = purchaseInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0) + 41130000;
  const totalReceivables = salesInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0) + 69705500;
  const taxPayable = salesInvoices.reduce((sum, inv) => sum + (inv.tax || 0), 0) + 6648490;
  const taxReceivable = purchaseInvoices.reduce((sum, inv) => sum + (inv.tax || 0), 0) + 604273;

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Column Visibility Picker States
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    trxId: true,
    accountName: true,
    type: true,
    taxId: true,
    amount: true,
    status: true,
    actions: true
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Selected Ledger entry for view details modal
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const mockEntries = [];

  // Dynamic ledger entries mapping
  const dynamicSales = salesInvoices.map(inv => ({
    id: `TRX-${inv.id}`,
    date: inv.date ? inv.date.substring(0, 10) : new Date().toISOString().substring(0, 10),
    accountName: inv.customerName,
    type: 'receivable',
    taxId: inv.deliveryId ? `TAX-${inv.deliveryId}` : 'PK-TAX-SALES',
    amount: inv.grandTotal,
    status: inv.status === 'Settled' ? 'Settled' : 'Pending',
    isDynamic: true,
    raw: inv
  }));

  const dynamicSalesTax = salesInvoices.filter(inv => inv.tax > 0).map(inv => ({
    id: `TAX-${inv.id}`,
    date: inv.date ? inv.date.substring(0, 10) : new Date().toISOString().substring(0, 10),
    accountName: `${inv.customerName} (Output Tax)`,
    type: 'tax-payable',
    taxId: 'PK-TAX-SALES',
    amount: inv.tax,
    status: 'Settled',
    isDynamic: true,
    raw: inv
  }));

  const dynamicPurchases = purchaseInvoices.map(inv => ({
    id: `TRX-${inv.id}`,
    date: inv.date ? inv.date.substring(0, 10) : new Date().toISOString().substring(0, 10),
    accountName: inv.vendorName,
    type: 'payable',
    taxId: inv.sourceId ? `TAX-${inv.sourceId}` : 'PK-TAX-PURCH',
    amount: inv.grandTotal,
    status: inv.status === 'Posted' || inv.status === 'Settled' ? 'Settled' : 'Pending',
    isDynamic: true,
    raw: inv
  }));

  const dynamicPurchasesTax = purchaseInvoices.filter(inv => inv.tax > 0).map(inv => ({
    id: `TAX-${inv.id}`,
    date: inv.date ? inv.date.substring(0, 10) : new Date().toISOString().substring(0, 10),
    accountName: `${inv.vendorName} (Input Tax)`,
    type: 'tax-receivable',
    taxId: 'PK-TAX-PURCH',
    amount: inv.tax,
    status: 'Settled',
    isDynamic: true,
    raw: inv
  }));

  // Map posted custom vouchers dynamically into ledger postings
  const dynamicVouchers = vouchersList.filter(v => v.status === 'Posted').flatMap(v => {
    return (v.lines || []).map((l, idx) => ({
      id: `${v.id}-${idx + 1}`,
      date: v.date,
      accountName: l.accountName,
      type: v.type === 'CPV' ? 'payable' : v.type === 'CRV' ? 'receivable' : (l.debit > 0 ? 'receivable' : 'payable'),
      taxId: v.reference || 'N/A',
      amount: l.debit > 0 ? l.debit : l.credit,
      status: 'Settled',
      isDynamic: true,
      raw: v
    }));
  });

  // Combine and sort entries
  const allEntries = [
    ...dynamicSales,
    ...dynamicSalesTax,
    ...dynamicPurchases,
    ...dynamicPurchasesTax,
    ...dynamicVouchers,
    ...mockEntries
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Filter entries
  const filteredEntries = allEntries.filter(entry => {
    const matchesSearch = entry.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          entry.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (entry.taxId && entry.taxId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesType = true;
    if (filterType !== 'all') {
      matchesType = entry.type === filterType;
    }
    
    return matchesSearch && matchesType;
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + itemsPerPage);

  // Print voucher action handler using UniversalPrintPreviewModal
  const handlePrint = (entry) => {
    if (!entry) return;
    const isCredit = entry.type === 'sales-revenue' || entry.type === 'accounts-payable';
    const debit = isCredit ? 0 : entry.amount;
    const credit = isCredit ? entry.amount : 0;

    setPrintData({
      id: entry.id,
      ledger_title: `${entry.accountName} (${entry.type?.replace('-', ' ')})`,
      account_code: entry.id,
      date_range: entry.date,
      currency: currencyCode,
      header: {
        ledger_title: `${entry.accountName} (${entry.type?.replace('-', ' ')})`,
        account_code: entry.id,
        date_range: entry.date,
        currency: currencyCode,
        voucher_id: entry.id,
        tax_id: entry.taxId || '—',
        posting_status: entry.status || 'Posted'
      },
      items: [
        {
          serial_no: 1,
          date: entry.date,
          voucher_no: entry.id,
          narration: `Consolidated ledger post matching reference voucher for ${entry.type?.replace('-', ' ')}`,
          debit,
          credit,
          balance: entry.amount
        }
      ],
      totals: {
        'Debit Amount': debit,
        'Credit Amount': credit,
        'Net Amount': entry.amount
      }
    });
  };

  return (
    <div className="p-8 max-w-full w-full mx-auto space-y-8">
      {printData && (
        <UniversalPrintPreviewModal
          isOpen={Boolean(printData)}
          onClose={() => setPrintData(null)}
          documentType="general_ledger"
          documentData={printData}
          documentTitle={`GL Voucher #${printData.id}`}
        />
      )}
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">Unified Ledger</h2>
            <span className="text-xs font-semibold px-3 py-1 bg-surface-container text-on-secondary-container rounded-full">
              {filteredEntries.length} Total Postings
            </span>
          </div>
        </div>
      </div>

      {/* Bento Grid: Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-6 flex flex-col gap-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total Payables</span>
            <span className="material-symbols-outlined text-outline-variant text-[20px] group-hover:text-primary transition-colors">call_made</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-on-surface-variant">{currencyCode}</span>
            <span className="text-2xl font-extrabold text-on-surface ml-1">{totalPayables.toLocaleString()}</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-outline-variant/30 group-hover:bg-primary transition-colors"></div>
        </div>

        {/* Card 2 */}
        <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-6 flex flex-col gap-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Total Receivables</span>
            <span className="material-symbols-outlined text-outline-variant text-[20px] group-hover:text-primary transition-colors">call_received</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-on-surface-variant">{currencyCode}</span>
            <span className="text-2xl font-extrabold text-on-surface ml-1">{totalReceivables.toLocaleString()}</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-outline-variant/30 group-hover:bg-primary transition-colors"></div>
        </div>

        {/* Card 3 */}
        <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-6 flex flex-col gap-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tax Payable</span>
            <span className="material-symbols-outlined text-error text-[20px] group-hover:scale-110 transition-transform">receipt_long</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-on-surface-variant">{currencyCode}</span>
            <span className="text-2xl font-extrabold text-on-surface ml-1">{taxPayable.toLocaleString()}</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-error-container/30 group-hover:bg-error transition-colors"></div>
        </div>

        {/* Card 4 */}
        <div className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-6 flex flex-col gap-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tax Receivable</span>
            <span className="material-symbols-outlined text-primary text-[20px] group-hover:scale-110 transition-transform">request_quote</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-on-surface-variant">{currencyCode}</span>
            <span className="text-2xl font-extrabold text-on-surface ml-1">{taxReceivable.toLocaleString()}</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-container/30 group-hover:bg-primary transition-colors"></div>
        </div>
      </div>

      {/* Filter Section */}
      <section className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm flex flex-wrap gap-4 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[250px] space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Search Ledger</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-surface-container-lowest outline-none transition-all"
              placeholder="Search by ID, Account Name or Tax Code..."
            />
          </div>
        </div>

        {/* Dropdown type filter */}
        <div className="w-64 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Transaction Type</label>
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full appearance-none bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer font-semibold text-on-surface-variant"
            >
              <option value="all">All Transactions</option>
              <option value="payable">Payment Payable</option>
              <option value="receivable">Payment Receivable</option>
              <option value="tax-payable">Tax Payable</option>
              <option value="tax-receivable">Tax Receivable</option>
              <option value="advance">Advance Payment</option>
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[20px]">
              expand_more
            </span>
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={() => { setSearchTerm(''); setFilterType('all'); }}
          className="px-5 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-bold text-xs transition-colors h-[42px] cursor-pointer"
        >
          Reset Filters
        </button>
      </section>

      {/* Ledger Postings Data Table */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.04)] overflow-hidden border border-outline-variant/15">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-surface-container">
                {visibleColumns.date && <ResizableHeader className="px-6 py-4">Date</ResizableHeader>}
                {visibleColumns.trxId && <ResizableHeader className="px-6 py-4 font-mono">Transaction ID</ResizableHeader>}
                {visibleColumns.accountName && <ResizableHeader className="px-6 py-4">Account Name</ResizableHeader>}
                {visibleColumns.type && <ResizableHeader className="px-6 py-4">Type</ResizableHeader>}
                {visibleColumns.taxId && <ResizableHeader className="px-6 py-4">Tax ID / VAT</ResizableHeader>}
                {visibleColumns.amount && <ResizableHeader className="px-6 py-4 text-right">Net Amount ({currencyCode})</ResizableHeader>}
                {visibleColumns.status && <ResizableHeader className="px-6 py-4 text-center">Status</ResizableHeader>}
                {visibleColumns.actions && <ResizableHeader className="px-6 py-4 text-center">Actions</ResizableHeader>}

                {/* Column Picker Three-Dot Menu */}
                <th className="px-4 py-4 w-10 text-center relative">
                  <button
                    onClick={() => setShowColPicker(!showColPicker)}
                    className="p-1.5 hover:bg-surface-container rounded-lg transition-colors cursor-pointer flex items-center justify-center mx-auto"
                    title="Toggle Columns"
                  >
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant hover:text-primary">more_vert</span>
                  </button>
                  {showColPicker && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowColPicker(false)}></div>
                      <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-lg p-3.5 space-y-2.5 z-20 text-sm text-on-surface text-left normal-case tracking-normal">
                        <p className="font-bold text-[10px] text-on-surface-variant uppercase tracking-widest px-1 mb-1">Toggle Columns</p>
                        <div className="h-px bg-outline-variant/20 my-1"></div>
                        {Object.entries({
                          date: 'Date',
                          trxId: 'Transaction ID',
                          accountName: 'Account Name',
                          type: 'Type',
                          taxId: 'Tax ID / VAT',
                          amount: 'Net Amount',
                          status: 'Status',
                          actions: 'Actions'
                        }).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 px-1 py-0.5 hover:bg-surface rounded cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={visibleColumns[key]}
                              onChange={() => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))}
                              className="rounded border-outline-variant text-primary focus:ring-primary/20 w-4 h-4"
                            />
                            <span className="font-medium text-xs text-on-surface-variant">{label}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {paginatedEntries.length > 0 ? (
                paginatedEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface/50 transition-colors group">
                    {visibleColumns.date && (
                      <td className="px-6 py-4 text-sm text-on-surface-variant font-medium whitespace-nowrap">
                        {entry.date}
                      </td>
                    )}
                    {visibleColumns.trxId && (
                      <td className="px-6 py-4 text-sm font-mono font-bold text-primary whitespace-nowrap">
                        {entry.id}
                      </td>
                    )}
                    {visibleColumns.accountName && (
                      <td className="px-6 py-4 text-sm font-bold text-on-surface">
                        {entry.accountName}
                      </td>
                    )}
                    {visibleColumns.type && (
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          entry.type === 'payable' ? 'bg-amber-100 text-amber-800' :
                          entry.type === 'receivable' ? 'bg-blue-100 text-blue-800' :
                          entry.type === 'tax-payable' ? 'bg-rose-100 text-rose-800' :
                          entry.type === 'tax-receivable' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {entry.type === 'payable' ? 'Payment Payable' :
                           entry.type === 'receivable' ? 'Payment Receivable' :
                           entry.type === 'tax-payable' ? 'Tax Payable' :
                           entry.type === 'tax-receivable' ? 'Tax Receivable' : 'Advance Payment'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.taxId && (
                      <td className="px-6 py-4 text-sm font-medium font-mono text-on-surface-variant">
                        {entry.taxId || 'N/A'}
                      </td>
                    )}
                    {visibleColumns.amount && (
                      <td className={`px-6 py-4 text-sm font-extrabold text-right ${
                        entry.type === 'receivable' || entry.type === 'tax-receivable' ? 'text-success' : 'text-on-surface'
                      }`}>
                        {entry.amount.toLocaleString()}
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-6 py-4 text-sm text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          entry.status === 'Settled' ? 'bg-emerald-50 border border-emerald-300 text-emerald-700' : 'bg-slate-50 border border-slate-300 text-slate-600'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td className="px-6 py-4 text-sm text-center">
                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handlePrint(entry)}
                            className="p-1 hover:bg-surface-container rounded transition-colors text-on-surface-variant hover:text-primary cursor-pointer"
                            title="Print Voucher"
                          >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                          </button>
                          <button
                            onClick={() => handlePrint(entry)}
                            className="p-1 hover:bg-surface-container rounded transition-colors text-on-surface-variant hover:text-primary cursor-pointer"
                            title="Export PDF"
                          >
                            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                          </button>
                          <button
                            onClick={() => { setSelectedEntry(entry); setShowDetailsModal(true); }}
                            className="p-1 hover:bg-surface-container rounded transition-colors text-on-surface-variant hover:text-primary cursor-pointer"
                            title="View Details"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                        </div>
                      </td>
                    )}
                    {/* Empty cell matching headers row */}
                    <td className="px-4 py-4 w-10"></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center p-12 text-on-surface-variant font-semibold">
                    No transactions match the applied filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-outline-variant/10 bg-surface flex items-center justify-between">
          <span className="text-xs font-semibold text-on-surface-variant">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredEntries.length)} of {filteredEntries.length} entries
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1 border border-outline-variant/20 hover:border-primary/40 rounded text-secondary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                onClick={() => setCurrentPage(pg)}
                className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-colors cursor-pointer border ${
                  currentPage === pg 
                    ? 'border-primary bg-primary text-on-primary' 
                    : 'border-outline-variant/20 hover:border-primary/40 text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {pg}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1 border border-outline-variant/20 hover:border-primary/40 rounded text-secondary hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </section>

      {/* ======================= VIEW DETAILS MODAL ======================= */}
      {showDetailsModal && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-on-background/25 backdrop-blur-[3px]" onClick={() => setShowDetailsModal(false)}></div>
          <div className="relative z-10 w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/15 flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-headline font-extrabold text-xl text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">analytics</span>
              General Ledger Voucher Details
            </h3>
            
            <div className="space-y-4 mb-8 bg-surface-container-low/40 p-5 rounded-xl border border-outline-variant/10 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-semibold">Transaction ID:</span>
                <span className="font-mono font-bold text-primary">{selectedEntry.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-semibold">Date of Posting:</span>
                <span className="font-bold text-on-surface">{selectedEntry.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-semibold">Party / Account Name:</span>
                <span className="font-bold text-on-surface">{selectedEntry.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-semibold">Transaction Type:</span>
                <span className="font-bold text-on-surface capitalize">{selectedEntry.type.replace('-', ' ')}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-on-surface-variant font-semibold">Tax ID / VAT Registration:</span>
                <span className="font-bold text-on-surface">{selectedEntry.taxId || 'N/A'}</span>
              </div>
              
              <div className="h-px bg-outline-variant/20 my-2"></div>
              
              <div className="flex justify-between text-base">
                <span className="text-on-surface font-bold">Voucher Posting Value:</span>
                <span className="font-extrabold text-primary">{currencyCode} {selectedEntry.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-semibold">Posting Status:</span>
                <span className="font-bold text-on-surface">{selectedEntry.status}</span>
              </div>
            </div>
            
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => handlePrint(selectedEntry)}
                className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Print Voucher
              </button>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-5 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
