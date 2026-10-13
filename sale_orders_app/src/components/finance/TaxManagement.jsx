import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { generateTaxRegisters, formatMoney, round2 } from '../../utils/financeEngine';
import ResizableHeader from '../ui/ResizableHeader';

export default function TaxManagement() {
  const { state } = useApp();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';

  // Active Tax View: 'overview', 'output', 'input', 'wht'
  const [activeTab, setActiveTab] = useState('overview');

  // Selected WHT Certificate for Modal
  const [selectedCert, setSelectedCert] = useState(null);

  // Compute Tax Registers
  const taxData = useMemo(() => {
    return generateTaxRegisters(state);
  }, [state]);

  const {
    outputRegister,
    totalOutputTax,
    inputRegister,
    totalInputTax,
    netSalesTaxPayable,
    whtRegister,
    totalWht
  } = taxData;

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
            <span className="text-primary font-semibold">Taxation & Withholding</span>
          </nav>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-headline font-black text-on-surface tracking-tight">Taxation & Withholding Register</h2>
            <span className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
              FBR & SRB Compliant
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Output Sales Tax (18%), Input Tax Credit (Adjustable), and Withholding Tax (Section 153/236)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print Tax Return Sheet
          </button>
        </div>
      </div>

      {/* Tax KPI Cockpit */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Output Tax (Sales 18%)</span>
            <span className="p-2 bg-blue-500/10 text-blue-600 rounded-xl material-symbols-outlined text-[18px]">receipt</span>
          </div>
          <div className="text-2xl font-headline font-black text-on-surface">
            {formatMoney(totalOutputTax, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">Collected on customer sales invoices</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Input Tax (Purchases 18%)</span>
            <span className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl material-symbols-outlined text-[18px]">shopping_bag</span>
          </div>
          <div className="text-2xl font-headline font-black text-emerald-600">
            {formatMoney(totalInputTax, currencyCode)}
          </div>
          <span className="text-[11px] text-emerald-600 font-bold mt-1">Claimable raw material input credit</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Net Sales Tax Payable</span>
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-xl material-symbols-outlined text-[18px]">account_balance</span>
          </div>
          <div className="text-2xl font-headline font-black text-amber-600">
            {formatMoney(netSalesTaxPayable, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">Net challan liability to FBR treasury</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Withholding Tax (WHT)</span>
            <span className="p-2 bg-purple-500/10 text-purple-600 rounded-xl material-symbols-outlined text-[18px]">percent</span>
          </div>
          <div className="text-2xl font-headline font-black text-purple-600">
            {formatMoney(totalWht, currencyCode)}
          </div>
          <span className="text-[11px] text-purple-600 font-bold mt-1">Sec 153/236 vendor deductions</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/15 gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface rounded-t-xl'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">analytics</span>
          Tax Reconciliation Summary
        </button>
        <button
          onClick={() => setActiveTab('output')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'output'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface rounded-t-xl'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">receipt</span>
          Output Tax Register ({outputRegister.length})
        </button>
        <button
          onClick={() => setActiveTab('input')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'input'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface rounded-t-xl'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
          Input Tax Register ({inputRegister.length})
        </button>
        <button
          onClick={() => setActiveTab('wht')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'wht'
              ? 'border-primary text-primary bg-primary/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface rounded-t-xl'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">verified</span>
          WHT Certificates ({whtRegister.length})
        </button>
      </div>

      {/* OVERVIEW SUMMARY TAB */}
      {activeTab === 'overview' && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-6 space-y-6">
          <div className="border-b border-outline-variant/10 pb-3">
            <h3 className="text-base font-black text-on-surface">Monthly Sales Tax Return Reconciliation</h3>
            <p className="text-xs text-on-surface-variant">Annexure-C (Sales) vs Annexure-A (Domestic Purchases)</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3 bg-surface-container-low rounded-xl">
              <div>
                <span className="font-bold text-on-surface block">A. Total Output Sales Tax Collected (Annexure C)</span>
                <span className="text-on-surface-variant text-[11px]">Calculated @ 18% standard rate on supplies</span>
              </div>
              <span className="font-mono font-bold text-blue-600 text-sm">{formatMoney(totalOutputTax, currencyCode)}</span>
            </div>

            <div className="flex justify-between p-3 bg-surface-container-low rounded-xl">
              <div>
                <span className="font-bold text-on-surface block">B. Total Input Tax Credit Claimable (Annexure A)</span>
                <span className="text-on-surface-variant text-[11px]">Adjustable sales tax paid on raw materials (PVC/PU resins)</span>
              </div>
              <span className="font-mono font-bold text-emerald-600 text-sm">({formatMoney(totalInputTax, currencyCode)})</span>
            </div>

            <div className="flex justify-between p-4 bg-primary/10 rounded-2xl border border-primary/20 text-sm font-black">
              <div>
                <span className="text-primary block">C. NET SALES TAX LIABILITY PAYABLE TO NATIONAL TREASURY</span>
                <span className="text-on-surface-variant text-xs font-normal">Formula: Output Tax (A) minus Input Tax (B)</span>
              </div>
              <span className="font-mono text-base text-primary">{formatMoney(netSalesTaxPayable, currencyCode)}</span>
            </div>
          </div>
        </div>
      )}

      {/* OUTPUT REGISTER TAB */}
      {activeTab === 'output' && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant/10">
                  <ResizableHeader columnKey="id" defaultWidth={110}>Invoice No</ResizableHeader>
                  <ResizableHeader columnKey="date" defaultWidth={110}>Date</ResizableHeader>
                  <ResizableHeader columnKey="party" defaultWidth={240}>Buyer / Customer Name</ResizableHeader>
                  <ResizableHeader columnKey="taxId" defaultWidth={140}>Buyer STRN</ResizableHeader>
                  <ResizableHeader columnKey="val" defaultWidth={140} className="text-right">Taxable Value</ResizableHeader>
                  <ResizableHeader columnKey="rate" defaultWidth={80} className="text-center">Rate</ResizableHeader>
                  <ResizableHeader columnKey="tax" defaultWidth={130} className="text-right">Sales Tax (18%)</ResizableHeader>
                  <ResizableHeader columnKey="total" defaultWidth={140} className="text-right">Invoice Total</ResizableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-xs">
                {outputRegister.map(r => (
                  <tr key={r.id} className="hover:bg-surface-container-low/40">
                    <td className="py-3 px-4 font-mono font-bold text-primary">{r.id}</td>
                    <td className="py-3 px-4 font-mono text-on-surface-variant">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-bold text-on-surface">{r.partyName}</td>
                    <td className="py-3 px-4 font-mono text-on-surface-variant">{r.taxId}</td>
                    <td className="py-3 px-4 text-right font-mono text-on-surface">{formatMoney(r.taxableValue, '')}</td>
                    <td className="py-3 px-4 text-center font-bold text-primary">{r.taxRate}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-600">{formatMoney(r.taxAmount, '')}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-on-surface">{formatMoney(r.invoiceTotal, currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INPUT REGISTER TAB */}
      {activeTab === 'input' && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant/10">
                  <ResizableHeader columnKey="id" defaultWidth={110}>Bill Ref No</ResizableHeader>
                  <ResizableHeader columnKey="date" defaultWidth={110}>Date</ResizableHeader>
                  <ResizableHeader columnKey="party" defaultWidth={240}>Supplier / Vendor Name</ResizableHeader>
                  <ResizableHeader columnKey="taxId" defaultWidth={140}>Supplier STRN</ResizableHeader>
                  <ResizableHeader columnKey="val" defaultWidth={140} className="text-right">Taxable Value</ResizableHeader>
                  <ResizableHeader columnKey="rate" defaultWidth={80} className="text-center">Rate</ResizableHeader>
                  <ResizableHeader columnKey="tax" defaultWidth={130} className="text-right">Input Tax Claimable</ResizableHeader>
                  <ResizableHeader columnKey="total" defaultWidth={140} className="text-right">Bill Total</ResizableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-xs">
                {inputRegister.map(r => (
                  <tr key={r.id} className="hover:bg-surface-container-low/40">
                    <td className="py-3 px-4 font-mono font-bold text-primary">{r.id}</td>
                    <td className="py-3 px-4 font-mono text-on-surface-variant">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-bold text-on-surface">{r.partyName}</td>
                    <td className="py-3 px-4 font-mono text-on-surface-variant">{r.taxId}</td>
                    <td className="py-3 px-4 text-right font-mono text-on-surface">{formatMoney(r.taxableValue, '')}</td>
                    <td className="py-3 px-4 text-center font-bold text-primary">{r.taxRate}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">{formatMoney(r.taxAmount, '')}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-on-surface">{formatMoney(r.invoiceTotal, currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WHT CERTIFICATES TAB */}
      {activeTab === 'wht' && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant/10">
                  <ResizableHeader columnKey="id" defaultWidth={110}>Cert ID</ResizableHeader>
                  <ResizableHeader columnKey="date" defaultWidth={110}>Date</ResizableHeader>
                  <ResizableHeader columnKey="party" defaultWidth={240}>Withholdee / Vendor</ResizableHeader>
                  <ResizableHeader columnKey="section" defaultWidth={160}>Income Tax Section</ResizableHeader>
                  <ResizableHeader columnKey="gross" defaultWidth={140} className="text-right">Gross Amount</ResizableHeader>
                  <ResizableHeader columnKey="rate" defaultWidth={80} className="text-center">WHT %</ResizableHeader>
                  <ResizableHeader columnKey="wht" defaultWidth={130} className="text-right">WHT Deducted</ResizableHeader>
                  <ResizableHeader columnKey="cpr" defaultWidth={140}>CPR Challan Ref</ResizableHeader>
                  <ResizableHeader columnKey="action" defaultWidth={100} className="text-center">Action</ResizableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-xs">
                {whtRegister.map(r => (
                  <tr key={r.id} className="hover:bg-surface-container-low/40">
                    <td className="py-3 px-4 font-mono font-bold text-primary">{r.id}</td>
                    <td className="py-3 px-4 font-mono text-on-surface-variant">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-bold text-on-surface">{r.party}</td>
                    <td className="py-3 px-4 font-medium text-on-surface-variant">{r.section}</td>
                    <td className="py-3 px-4 text-right font-mono text-on-surface">{formatMoney(r.grossAmount, '')}</td>
                    <td className="py-3 px-4 text-center font-bold text-purple-600">{r.rate}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-purple-700">{formatMoney(r.whtAmount, '')}</td>
                    <td className="py-3 px-4 font-mono font-bold text-on-surface-variant">{r.cprNo}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedCert(r)}
                        className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-primary rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <span className="material-symbols-outlined text-[14px]">description</span>
                        Cert
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WHT Certificate Printable Modal */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">verified</span>
                <h3 className="text-base font-black text-on-surface">Income Tax Withholding Certificate</h3>
              </div>
              <button
                onClick={() => setSelectedCert(null)}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="border border-outline-variant/20 rounded-xl p-4 space-y-3 bg-surface-container-low/20 text-xs">
              <div className="text-center pb-2 border-b border-outline-variant/10">
                <h4 className="font-black text-sm uppercase text-on-surface">FlashVision Synthetic Leather Mills Ltd</h4>
                <p className="text-[10px] text-on-surface-variant">Tax Withholding Agent • NTN: 4192014-9 • STRN: 3277890-1</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Certificate Ref</span>
                  <span className="font-mono font-bold text-on-surface">{selectedCert.id}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Deduction Date</span>
                  <span className="font-mono text-on-surface">{new Date(selectedCert.date).toLocaleDateString()}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Name of Taxpayer</span>
                  <span className="font-bold text-on-surface">{selectedCert.party}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Tax Law Section</span>
                  <span className="font-bold text-primary">{selectedCert.section}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Withholding Tax Rate</span>
                  <span className="font-bold text-purple-600">{selectedCert.rate}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Gross Transaction Value</span>
                  <span className="font-mono font-bold text-on-surface">{formatMoney(selectedCert.grossAmount, currencyCode)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Tax Deducted & Deposited</span>
                  <span className="font-mono font-black text-purple-700">{formatMoney(selectedCert.whtAmount, currencyCode)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] uppercase font-bold text-on-surface-variant block">State Bank / FBR CPR Number</span>
                  <span className="font-mono font-bold text-on-surface bg-surface-container p-1 rounded inline-block">{selectedCert.cprNo}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Print Certificate
              </button>
              <button
                onClick={() => setSelectedCert(null)}
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
