import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { generateAPAging, formatMoney, round2 } from '../../utils/financeEngine';
import ResizableHeader from '../ui/ResizableHeader';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

export default function AccountsPayable() {
  const { state } = useApp();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [agingFilter, setAgingFilter] = useState('all');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [printData, setPrintData] = useState(null);

  // Compute AP Data
  const apData = useMemo(() => {
    return generateAPAging(state);
  }, [state]);

  const { vendors, grandTotalPayables, totalInvoiced, totalPaid, bucketTotals } = apData;

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchSearch = v.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.vendorId.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      if (agingFilter === 'current') return v.bucket_0_30 > 0;
      if (agingFilter === 'overdue_30') return v.bucket_31_60 > 0;
      if (agingFilter === 'overdue_60') return v.bucket_61_90 > 0;
      if (agingFilter === 'overdue_90') return v.bucket_90_plus > 0;
      if (agingFilter === 'has_balance') return v.outstanding > 0;
      return true;
    });
  }, [vendors, searchTerm, agingFilter]);

  const handlePrint = () => {
    setPrintData({
      header: {
        report_title: 'ACCOUNTS PAYABLE & VENDOR AGING STATEMENT',
        date: new Date().toISOString().split('T')[0],
        total_vendors: filteredVendors.length,
        aging_filter: agingFilter.toUpperCase()
      },
      items: filteredVendors.map((v, idx) => ({
        sr: idx + 1,
        vendor_name: v.vendorName,
        total_invoiced: v.totalInvoiced,
        total_paid: v.totalPaid,
        current_due: v.bucket_0_30,
        days_30: v.bucket_31_60,
        days_60: v.bucket_61_90,
        days_90_plus: v.bucket_90_plus,
        net_outstanding: v.outstanding
      })),
      totals: {
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        grandTotal: grandTotalPayables
      }
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full w-full mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-headline font-black text-on-surface tracking-tight">Supplier Payables & Aging</h2>
            <span className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
              {vendors.length} Vendors Managed
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Raw Material Creditors, Cash Outlay Scheduling & Purchase Ledger Statements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print AP Summary
          </button>
        </div>
      </div>

      {/* KPI Cockpit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Bills Incurred</span>
            <span className="p-2 bg-blue-500/10 text-blue-600 rounded-xl material-symbols-outlined text-[18px]">receipt_long</span>
          </div>
          <div className="text-2xl font-headline font-black text-on-surface">
            {formatMoney(totalInvoiced, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">Total raw material purchase bills</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Disbursed</span>
            <span className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl material-symbols-outlined text-[18px]">payments</span>
          </div>
          <div className="text-2xl font-headline font-black text-emerald-600">
            {formatMoney(totalPaid, currencyCode)}
          </div>
          <span className="text-[11px] text-emerald-600 font-bold mt-1">
            Disbursement Ratio: {totalInvoiced > 0 ? ((totalPaid / totalInvoiced) * 100).toFixed(1) : 0}%
          </span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Outstanding Trade Payables</span>
            <span className="p-2 bg-rose-500/10 text-rose-600 rounded-xl material-symbols-outlined text-[18px]">account_balance_wallet</span>
          </div>
          <div className="text-2xl font-headline font-black text-rose-600">
            {formatMoney(grandTotalPayables, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">Pending payments to chemical mills</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Due Within 30 Days</span>
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-xl material-symbols-outlined text-[18px]">calendar_today</span>
          </div>
          <div className="text-2xl font-headline font-black text-amber-600">
            {formatMoney(bucketTotals.current, currencyCode)}
          </div>
          <span className="text-[11px] text-amber-600 font-bold mt-1">Upcoming bank transfer commitments</span>
        </div>
      </div>

      {/* 4-Tier Aging Spectrum */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-headline font-black text-on-surface uppercase tracking-wide flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">schedule</span>
            Payables Aging Spectrum
          </h3>
          <span className="text-xs text-on-surface-variant font-mono">
            Total Outstanding: {formatMoney(grandTotalPayables, currencyCode)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[10px] font-bold uppercase text-blue-700 block">0 - 30 Days (Current Credit)</span>
            <div className="text-lg font-mono font-black text-blue-800 mt-1">
              {formatMoney(bucketTotals.current, currencyCode)}
            </div>
            <span className="text-[10px] text-blue-600 block mt-1">Within regular payment cycle</span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] font-bold uppercase text-amber-700 block">31 - 60 Days (Aging)</span>
            <div className="text-lg font-mono font-black text-amber-800 mt-1">
              {formatMoney(bucketTotals.days_31_60, currencyCode)}
            </div>
            <span className="text-[10px] text-amber-600 block mt-1">Schedule payment this week</span>
          </div>

          <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <span className="text-[10px] font-bold uppercase text-orange-700 block">61 - 90 Days (Overdue)</span>
            <div className="text-lg font-mono font-black text-orange-800 mt-1">
              {formatMoney(bucketTotals.days_61_90, currencyCode)}
            </div>
            <span className="text-[10px] text-orange-600 block mt-1">Prioritize supplier relationship</span>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-[10px] font-bold uppercase text-rose-700 block">&gt; 90 Days (Past Maturity)</span>
            <div className="text-lg font-mono font-black text-rose-800 mt-1">
              {formatMoney(bucketTotals.days_90_plus, currencyCode)}
            </div>
            <span className="text-[10px] text-rose-600 block mt-1">Review with Finance Director</span>
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
            placeholder="Search vendor name or ID..."
            className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setAgingFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${agingFilter === 'all' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'}`}
          >
            All Vendors
          </button>
          <button
            onClick={() => setAgingFilter('has_balance')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${agingFilter === 'has_balance' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'}`}
          >
            Has Balance
          </button>
          <button
            onClick={() => setAgingFilter('overdue_30')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${agingFilter === 'overdue_30' ? 'bg-amber-600 text-white shadow-sm' : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'}`}
          >
            Overdue
          </button>
        </div>
      </div>

      {/* Main Vendors Aging Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant/10">
                <ResizableHeader columnKey="id" defaultWidth={110}>Vendor ID</ResizableHeader>
                <ResizableHeader columnKey="name" defaultWidth={240}>Supplier / Vendor Name</ResizableHeader>
                <ResizableHeader columnKey="total" defaultWidth={140} className="text-right">Total Invoiced</ResizableHeader>
                <ResizableHeader columnKey="paid" defaultWidth={130} className="text-right">Total Paid</ResizableHeader>
                <ResizableHeader columnKey="outstanding" defaultWidth={140} className="text-right">Outstanding Dues</ResizableHeader>
                <ResizableHeader columnKey="b1" defaultWidth={110} className="text-right">0-30 Days</ResizableHeader>
                <ResizableHeader columnKey="b2" defaultWidth={110} className="text-right">31-60 Days</ResizableHeader>
                <ResizableHeader columnKey="b3" defaultWidth={110} className="text-right">61-90 Days</ResizableHeader>
                <ResizableHeader columnKey="b4" defaultWidth={110} className="text-right">&gt;90 Days</ResizableHeader>
                <ResizableHeader columnKey="action" defaultWidth={100} className="text-center">Action</ResizableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-xs">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-on-surface-variant">
                    No suppliers match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredVendors.map(v => (
                  <tr key={v.vendorId} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary">{v.vendorId}</td>
                    <td className="py-3 px-4 font-bold text-on-surface">{v.vendorName}</td>
                    <td className="py-3 px-4 text-right font-mono text-on-surface-variant">
                      {formatMoney(v.totalInvoiced, '')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-bold">
                      {formatMoney(v.totalPaid, '')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 font-extrabold bg-surface-container-low/30">
                      {formatMoney(v.outstanding, currencyCode)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-blue-600 font-medium">
                      {v.bucket_0_30 > 0 ? formatMoney(v.bucket_0_30, '') : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-amber-600 font-medium">
                      {v.bucket_31_60 > 0 ? formatMoney(v.bucket_31_60, '') : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-orange-600 font-medium">
                      {v.bucket_61_90 > 0 ? formatMoney(v.bucket_61_90, '') : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 font-bold">
                      {v.bucket_90_plus > 0 ? formatMoney(v.bucket_90_plus, '') : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedVendor(v)}
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
                <td colSpan={2} className="py-3 px-4 text-right uppercase tracking-wider">Total Supplier Dues:</td>
                <td className="py-3 px-4 text-right font-mono">{formatMoney(totalInvoiced, '')}</td>
                <td className="py-3 px-4 text-right font-mono text-emerald-600">{formatMoney(totalPaid, '')}</td>
                <td className="py-3 px-4 text-right font-mono font-extrabold text-rose-600">{formatMoney(grandTotalPayables, currencyCode)}</td>
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

      {/* Vendor Statement Modal */}
      {selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3">
              <div>
                <h3 className="text-lg font-black text-on-surface">Supplier Ledger & Statement of Dues</h3>
                <p className="text-xs text-on-surface-variant font-bold">
                  {selectedVendor.vendorName} ({selectedVendor.vendorId})
                </p>
              </div>
              <button
                onClick={() => setSelectedVendor(null)}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3 bg-surface-container-low rounded-xl text-xs">
              <div>
                <span className="text-on-surface-variant block font-bold text-[10px] uppercase">Total Invoiced</span>
                <span className="font-mono font-bold text-on-surface">{formatMoney(selectedVendor.totalInvoiced, currencyCode)}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-bold text-[10px] uppercase">Total Paid</span>
                <span className="font-mono font-bold text-emerald-600">{formatMoney(selectedVendor.totalPaid, currencyCode)}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-bold text-[10px] uppercase">Pending Payable</span>
                <span className="font-mono font-black text-rose-600">{formatMoney(selectedVendor.outstanding, currencyCode)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Purchase Bills & History</h4>
              <div className="border border-outline-variant/10 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-surface-container-low text-on-surface-variant text-[10px] font-bold uppercase">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Bill No</th>
                      <th className="py-2 px-3">Details</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {selectedVendor.invoices.map(inv => (
                      <tr key={inv.id}>
                        <td className="py-2 px-3 font-mono">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="py-2 px-3 font-mono font-bold text-primary">{inv.id}</td>
                        <td className="py-2 px-3 text-on-surface-variant truncate max-w-[180px]">{inv.remarks}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-on-surface">{formatMoney(inv.amount, '')}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
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
                onClick={handlePrint}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Print Statement
              </button>
              <button
                onClick={() => setSelectedVendor(null)}
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
          documentType="vendor_aging"
          documentData={printData}
        />
      )}
    </div>
  );
}
