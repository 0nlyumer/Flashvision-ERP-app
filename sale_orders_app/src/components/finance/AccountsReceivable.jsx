import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { generateARAging, formatMoney, round2 } from '../../utils/financeEngine';
import ResizableHeader from '../ui/ResizableHeader';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

export default function AccountsReceivable() {
  const { state } = useApp();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [agingFilter, setAgingFilter] = useState('all'); // 'all', 'current', 'overdue_30', 'overdue_60', 'overdue_90'
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [printData, setPrintData] = useState(null);

  // Compute AR Data
  const arData = useMemo(() => {
    return generateARAging(state);
  }, [state]);

  const { customers, grandTotalReceivables, totalBilled, totalCollected, bucketTotals } = arData;

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.customerId.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      if (agingFilter === 'current') return c.bucket_0_30 > 0;
      if (agingFilter === 'overdue_30') return c.bucket_31_60 > 0;
      if (agingFilter === 'overdue_60') return c.bucket_61_90 > 0;
      if (agingFilter === 'overdue_90') return c.bucket_90_plus > 0;
      if (agingFilter === 'has_balance') return c.outstanding > 0;
      return true;
    });
  }, [customers, searchTerm, agingFilter]);

  const handlePrintStatement = () => {
    setPrintData({
      header: {
        report_title: 'CUSTOMER RECEIVABLES & AGING STATEMENT',
        date: new Date().toISOString().split('T')[0],
        total_debtors: filteredCustomers.length,
        aging_filter: agingFilter.toUpperCase()
      },
      items: filteredCustomers.map((c, idx) => ({
        sr: idx + 1,
        customer_name: c.customerName,
        total_billed: c.totalBilled,
        total_paid: c.totalCollected,
        current_due: c.bucket_0_30,
        days_30: c.bucket_31_60,
        days_60: c.bucket_61_90,
        days_90_plus: c.bucket_90_plus,
        net_outstanding: c.outstanding
      })),
      totals: {
        total_billed: totalBilled,
        total_paid: totalCollected,
        grandTotal: grandTotalReceivables
      }
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full w-full mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-headline font-black text-on-surface tracking-tight">Customer Receivables & Aging</h2>
            <span className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
              {customers.length} Debtors Managed
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            4-Tier Aging Matrix, Credit Terms & Customer Statement Ledgers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintStatement}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print AR Summary
          </button>
        </div>
      </div>

      {/* KPI Cockpit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Invoiced</span>
            <span className="p-2 bg-blue-500/10 text-blue-600 rounded-xl material-symbols-outlined text-[18px]">receipt</span>
          </div>
          <div className="text-2xl font-headline font-black text-on-surface">
            {formatMoney(totalBilled, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">All posted sales invoices</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Recovered</span>
            <span className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl material-symbols-outlined text-[18px]">check_circle</span>
          </div>
          <div className="text-2xl font-headline font-black text-emerald-600">
            {formatMoney(totalCollected, currencyCode)}
          </div>
          <span className="text-[11px] text-emerald-600 font-bold mt-1">
            Collection Ratio: {totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : 0}%
          </span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Outstanding AR</span>
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-xl material-symbols-outlined text-[18px]">pending</span>
          </div>
          <div className="text-2xl font-headline font-black text-amber-600">
            {formatMoney(grandTotalReceivables, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">Active unpaid customer dues</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Critical Overdue (&gt;60d)</span>
            <span className="p-2 bg-rose-500/10 text-rose-600 rounded-xl material-symbols-outlined text-[18px]">warning</span>
          </div>
          <div className="text-2xl font-headline font-black text-rose-600">
            {formatMoney(bucketTotals.days_61_90 + bucketTotals.days_90_plus, currencyCode)}
          </div>
          <span className="text-[11px] text-rose-600 font-bold mt-1">Follow-up recovery required</span>
        </div>
      </div>

      {/* 4-Tier Aging Buckets Visual Matrix */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-headline font-black text-on-surface uppercase tracking-wide flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">calendar_view_week</span>
            Receivables Aging Spectrum
          </h3>
          <span className="text-xs text-on-surface-variant font-mono">
            Total Outstanding: {formatMoney(grandTotalReceivables, currencyCode)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[10px] font-bold uppercase text-blue-700 block">0 - 30 Days (Current)</span>
            <div className="text-lg font-mono font-black text-blue-800 mt-1">
              {formatMoney(bucketTotals.current, currencyCode)}
            </div>
            <span className="text-[10px] text-blue-600 block mt-1">Within standard credit window</span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] font-bold uppercase text-amber-700 block">31 - 60 Days (Mild Overdue)</span>
            <div className="text-lg font-mono font-black text-amber-800 mt-1">
              {formatMoney(bucketTotals.days_31_60, currencyCode)}
            </div>
            <span className="text-[10px] text-amber-600 block mt-1">First reminder sent</span>
          </div>

          <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <span className="text-[10px] font-bold uppercase text-orange-700 block">61 - 90 Days (Aging Alert)</span>
            <div className="text-lg font-mono font-black text-orange-800 mt-1">
              {formatMoney(bucketTotals.days_61_90, currencyCode)}
            </div>
            <span className="text-[10px] text-orange-600 block mt-1">Sales team intervention</span>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-[10px] font-bold uppercase text-rose-700 block">&gt; 90 Days (Bad Debt Risk)</span>
            <div className="text-lg font-mono font-black text-rose-800 mt-1">
              {formatMoney(bucketTotals.days_90_plus, currencyCode)}
            </div>
            <span className="text-[10px] text-rose-600 block mt-1">Credit hold placed</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-2xl border border-outline-variant/10 shadow-sm">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-on-surface-variant">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customer name or ID..."
            className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setAgingFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${agingFilter === 'all' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'}`}
          >
            All Customers
          </button>
          <button
            onClick={() => setAgingFilter('has_balance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${agingFilter === 'has_balance' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'}`}
          >
            Has Balance
          </button>
          <button
            onClick={() => setAgingFilter('overdue_60')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${agingFilter === 'overdue_60' ? 'bg-rose-600 text-white shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'}`}
          >
            Critical Overdue
          </button>
        </div>
      </div>

      {/* Main Customers Aging Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant/10">
                <ResizableHeader columnKey="id" defaultWidth={110}>Customer ID</ResizableHeader>
                <ResizableHeader columnKey="name" defaultWidth={240}>Customer Name</ResizableHeader>
                <ResizableHeader columnKey="total" defaultWidth={140} className="text-right">Total Invoiced</ResizableHeader>
                <ResizableHeader columnKey="paid" defaultWidth={130} className="text-right">Total Paid</ResizableHeader>
                <ResizableHeader columnKey="outstanding" defaultWidth={140} className="text-right">Outstanding</ResizableHeader>
                <ResizableHeader columnKey="b1" defaultWidth={110} className="text-right">0-30 Days</ResizableHeader>
                <ResizableHeader columnKey="b2" defaultWidth={110} className="text-right">31-60 Days</ResizableHeader>
                <ResizableHeader columnKey="b3" defaultWidth={110} className="text-right">61-90 Days</ResizableHeader>
                <ResizableHeader columnKey="b4" defaultWidth={110} className="text-right">&gt;90 Days</ResizableHeader>
                <ResizableHeader columnKey="action" defaultWidth={100} className="text-center">Action</ResizableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-xs">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-on-surface-variant">
                    No customers match the current aging filters.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(c => (
                  <tr key={c.customerId} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary">{c.customerId}</td>
                    <td className="py-3 px-4 font-bold text-on-surface">{c.customerName}</td>
                    <td className="py-3 px-4 text-right font-mono text-on-surface-variant">
                      {formatMoney(c.totalInvoiced, '')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-bold">
                      {formatMoney(c.totalPaid, '')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-on-surface font-extrabold bg-surface-container-low/30">
                      {formatMoney(c.outstanding, currencyCode)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-600 font-medium">
                      {c.bucket_0_30 > 0 ? formatMoney(c.bucket_0_30, '') : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-600 font-medium">
                      {c.bucket_31_60 > 0 ? formatMoney(c.bucket_31_60, '') : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-orange-600 font-medium">
                      {c.bucket_61_90 > 0 ? formatMoney(c.bucket_61_90, '') : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 font-bold">
                      {c.bucket_90_plus > 0 ? formatMoney(c.bucket_90_plus, '') : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-primary rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        Statement
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-surface-container font-black text-xs border-t-2 border-outline-variant/30 text-on-surface">
                <td colSpan={2} className="py-3 px-4 text-right uppercase tracking-wider">Total Portfolio Dues:</td>
                <td className="py-3 px-4 text-right font-mono">{formatMoney(totalBilled, '')}</td>
                <td className="py-3 px-4 text-right font-mono text-emerald-600">{formatMoney(totalCollected, '')}</td>
                <td className="py-3 px-4 text-right font-mono font-extrabold text-primary">{formatMoney(grandTotalReceivables, currencyCode)}</td>
                <td className="py-3 px-4 text-right font-mono text-blue-600">{formatMoney(bucketTotals.current, '')}</td>
                <td className="py-3 px-4 text-right font-mono text-amber-600">{formatMoney(bucketTotals.days_31_60, '')}</td>
                <td className="py-3 px-4 text-right font-mono text-orange-600">{formatMoney(bucketTotals.days_61_90, '')}</td>
                <td className="py-3 px-4 text-right font-mono text-rose-600">{formatMoney(bucketTotals.days_90_plus, '')}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Customer Statement Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3">
              <div>
                <h3 className="text-lg font-black text-on-surface">Party Ledger & Statement of Account</h3>
                <p className="text-xs text-on-surface-variant font-bold">
                  {selectedCustomer.customerName} ({selectedCustomer.customerId})
                </p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3 bg-surface-container-low rounded-xl text-xs">
              <div>
                <span className="text-on-surface-variant block font-bold text-[10px] uppercase">Total Invoiced</span>
                <span className="font-mono font-bold text-on-surface">{formatMoney(selectedCustomer.totalInvoiced, currencyCode)}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-bold text-[10px] uppercase">Total Collected</span>
                <span className="font-mono font-bold text-emerald-600">{formatMoney(selectedCustomer.totalPaid, currencyCode)}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-bold text-[10px] uppercase">Net Due</span>
                <span className="font-mono font-black text-rose-600">{formatMoney(selectedCustomer.outstanding, currencyCode)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Invoices & Transactions</h4>
              <div className="border border-outline-variant/10 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-surface-container-low text-on-surface-variant text-[10px] font-bold uppercase">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Invoice No</th>
                      <th className="py-2 px-3">Details</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {selectedCustomer.invoices.map(inv => (
                      <tr key={inv.id}>
                        <td className="py-2 px-3 font-mono">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="py-2 px-3 font-mono font-bold text-primary">{inv.id}</td>
                        <td className="py-2 px-3 text-on-surface-variant truncate max-w-[180px]">{inv.remarks}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-on-surface">{formatMoney(inv.amount, '')}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'Paid' || inv.status === 'Settled' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={handlePrintStatement}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Print Statement
              </button>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 bg-surface-container text-on-surface rounded-xl font-bold text-xs hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Universal Print Preview Modal (Issue 4) */}
      {printData && (
        <UniversalPrintPreviewModal
          isOpen={Boolean(printData)}
          onClose={() => setPrintData(null)}
          documentType="customer_aging"
          documentData={printData}
        />
      )}
    </div>
  );
}
