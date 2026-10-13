import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import PurchaseInvoiceHistory from './PurchaseInvoiceHistory';
import ResizableHeader from '../ui/ResizableHeader';

// Purchase Invoice creation sheet matching Stitch template 0713537418f7400f9bbd8efad27fb2fd
export default function PurchaseInvoice() {
  const { state, addPurchaseInvoice } = useApp();
  const { appConfirm } = useDialog();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';
  const currencySymbol = state.adminSetup?.baseCurrency ? (state.adminSetup.baseCurrency.match(/\(([^)]+)\)/)?.[1] || '$') : '$';
  const [sourceType, setSourceType] = useState('IGP'); // 'IGP' | 'GRN'
  const [selectedDocId, setSelectedDocId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [customRates, setCustomRates] = useState({});

  // View mode switcher: 'create' aur 'history' views ko toggle karne ke liye
  const [viewMode, setViewMode] = useState('create');

  // Columns visibility dropdown picker list handle karne ke liye states
  const [visibleColumns, setVisibleColumns] = useState({
    itemId: true,
    name: true,
    uom: true,
    qty: true,
    rate: true,
    subtotal: true
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Source type key mutabiq active (uninvoiced) documents load karna
  const activeDocs = sourceType === 'IGP' 
    ? (state.inwardGatePasses || []).filter(doc => !doc.isInvoiced)
    : (state.grns || []).filter(doc => !doc.isInvoiced);

  // Selected document object details fetch karna
  const selectedDoc = sourceType === 'IGP'
    ? (state.inwardGatePasses || []).find(doc => doc.id === selectedDocId)
    : (state.grns || []).find(doc => doc.id === selectedDocId);

  // Helper function to find the last purchase rate for an itemCode
  const getLastPurchaseRate = (itemCode, defaultRate) => {
    const invoices = state.purchaseInvoices || [];
    if (invoices.length === 0) return defaultRate;
    const sorted = [...invoices].sort((a, b) => new Date(b.date) - new Date(a.date));
    for (const inv of sorted) {
      const match = (inv.items || []).find(it => it.itemCode === itemCode);
      if (match && match.unitPrice !== undefined) {
        return match.unitPrice;
      }
    }
    return defaultRate;
  };

  // Calculation parameters
  let subtotal = 0;
  let itemsList = [];

  if (selectedDoc) {
    itemsList = selectedDoc.items.map((item, idx) => {
      // Rates lookup - uses last purchase rate from history if available
      const customRate = customRates[idx];
      const defaultRate = getLastPurchaseRate(item.itemCode, item.unitPrice || 1000);
      const rate = customRate !== undefined ? customRate : defaultRate;
      const qty = parseFloat(item.receivedQty || item.qty) || 1;
      const itemSubtotal = qty * rate;
      subtotal += itemSubtotal;

      return {
        ...item,
        rate,
        qty,
        subtotal: itemSubtotal
      };
    });
  }

  const tax = subtotal * 0.17;
  const withholdingTax = 0.00;
  const grandTotal = subtotal + tax + withholdingTax;

  // Post invoice function handler click
  const handlePostInvoice = async () => {
    if (!selectedDoc) return;

    const proceed = await appConfirm(
      `Are you sure you want to generate a purchase invoice for ${sourceType} ${selectedDocId}?\nGrand Total: ${currencyCode} ${grandTotal.toLocaleString()}`,
      "Confirm Posting Invoice",
      "Post Invoice",
      "Cancel"
    );

    if (!proceed) return;

    const invoiceId = 'PINV-' + (7800 + (state.purchaseInvoices || []).length + 1);

    const newInvoice = {
      id: invoiceId,
      date: new Date().toISOString(),
      sourceType,
      sourceId: selectedDoc.id,
      vendorName: selectedDoc.supplierName || 'Nexis Chem-Corp International',
      vendorId: selectedDoc.supplierId || 'VND-99201-P',
      subtotal,
      tax,
      grandTotal,
      status: 'Posted',
      remarks,
      items: itemsList.map(it => ({
        itemCode: it.itemCode,
        productName: it.itemName || it.productSpecification || it.itemCode,
        quantity: it.qty,
        unitPrice: it.rate,
        subtotal: it.subtotal,
        uom: it.uom || 'Metric Ton'
      }))
    };

    // Context state update dynamic call
    addPurchaseInvoice(newInvoice);

    // Form resetting
    setSelectedDocId('');
    setRemarks('');
  };

  if (viewMode === 'history') {
    return <PurchaseInvoiceHistory onViewCreate={() => setViewMode('create')} />;
  }

  return (
    <div className="p-8 max-w-full mx-auto w-full flex flex-col gap-8">
      {/* Header section */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-4">
            <h3 className="text-3xl font-bold tracking-tight text-on-surface">New Purchase Invoice</h3>
            <button
              onClick={() => setViewMode('history')}
              className="flex items-center gap-1.5 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-xl font-bold text-xs hover:opacity-90 transition-all shadow-sm cursor-pointer"
              title="View Invoice History"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              View History
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="px-6 py-2.5 border border-outline-variant text-on-surface font-semibold rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer">
            Save Draft
          </button>
          <button 
            disabled={!selectedDoc}
            onClick={handlePostInvoice}
            className={`px-6 py-2.5 text-on-primary font-bold rounded-lg shadow-xl transition-all ${
              selectedDoc 
                ? 'bg-gradient-to-br from-primary to-primary-container shadow-primary/20 hover:scale-[1.02] cursor-pointer' 
                : 'bg-slate-400 cursor-not-allowed opacity-55'
            }`}
          >
            Post Purchase Invoice
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Details & Items */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          
          {/* Source Selection Panel */}
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block">
                  Document Source
                </label>
                <div className="inline-flex p-1 bg-surface-container rounded-lg">
                  <button 
                    onClick={() => { setSourceType('IGP'); setSelectedDocId(''); setCustomRates({}); }}
                    className={`px-6 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                      sourceType === 'IGP' ? 'bg-white shadow-sm text-primary font-bold' : 'text-on-surface-variant font-semibold hover:text-on-surface'
                    }`}
                  >
                    Inward Gate Pass (IGP)
                  </button>
                  <button 
                    onClick={() => { setSourceType('GRN'); setSelectedDocId(''); setCustomRates({}); }}
                    className={`px-6 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                      sourceType === 'GRN' ? 'bg-white shadow-sm text-primary font-bold' : 'text-on-surface-variant font-semibold hover:text-on-surface'
                    }`}
                  >
                    Goods Receive Note (GRN)
                  </button>
                </div>
              </div>

              <div className="flex-1 min-w-[280px] space-y-4">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block">
                  Reference Document
                </label>
                <div className="relative">
                  <select 
                    value={selectedDocId}
                    onChange={(e) => { setSelectedDocId(e.target.value); setCustomRates({}); }}
                    className="w-full pl-4 pr-10 py-2.5 bg-surface-container-low border-none rounded-lg text-sm appearance-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="">Select Document to Populate...</option>
                    {activeDocs.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.id} ({doc.supplierName || 'Chemical Supplier'})
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                    keyboard_arrow_down
                  </span>
                </div>
              </div>
            </div>
          </section>

          {selectedDoc ? (
            <div className="space-y-8 animate-fade-in">
              {/* Vendor Information Panel */}
              <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary-fixed"></div>
                <h4 className="text-sm font-bold text-on-surface flex items-center gap-2 mb-6 uppercase tracking-wider">
                  <span className="material-symbols-outlined text-lg">factory</span>
                  Vendor Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-on-surface-variant">Vendor Name</span>
                    <p className="text-base font-bold text-on-surface">{selectedDoc.supplierName || 'Nexis Chem-Corp International'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-on-surface-variant">Vendor ID</span>
                    <p className="text-base font-bold text-on-surface">{selectedDoc.supplierId || 'VND-99201-P'}</p>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <span className="text-xs font-medium text-on-surface-variant">Primary Office Address</span>
                    <p className="text-base text-on-surface leading-relaxed">
                      {selectedDoc.address || 'Suite 405, Industrial Zone B, Port Qasim, Karachi, Pakistan'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-on-surface-variant">Point of Contact</span>
                    <p className="text-base font-bold text-on-surface">{selectedDoc.poc || 'Ahmed Raza Sheikh'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-on-surface-variant">Direct Contact Number</span>
                    <p className="text-base font-bold text-on-surface">{selectedDoc.phone || '+92 21 3456 7890'}</p>
                  </div>
                </div>
              </section>

              {/* Items List Table */}
              <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm overflow-hidden">
                <div className="p-6 flex justify-between items-center bg-surface-container-low/30">
                  <h4 className="text-sm font-bold text-on-surface uppercase tracking-wider">Line Items</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-low text-[11px] font-black uppercase tracking-tighter text-on-surface-variant border-b border-outline-variant/10">
                      <tr>
                        {visibleColumns.itemId && <ResizableHeader className="px-6 py-4">Item ID</ResizableHeader>}
                        {visibleColumns.name && <ResizableHeader className="px-6 py-4">Product Specification</ResizableHeader>}
                        {visibleColumns.uom && <ResizableHeader className="px-6 py-4">UOM</ResizableHeader>}
                        {visibleColumns.qty && <ResizableHeader className="px-6 py-4 text-right">Quantity</ResizableHeader>}
                        {visibleColumns.rate && <ResizableHeader className="px-6 py-4 text-right">Rate ({currencyCode})</ResizableHeader>}
                        {visibleColumns.subtotal && <ResizableHeader className="px-6 py-4 text-right">Subtotal</ResizableHeader>}
                        
                        {/* Three-dot menu button row right edge edge par conversion click */}
                        <th className="px-4 py-4 w-10 text-center relative">
                          <button
                            onClick={() => setShowColPicker(!showColPicker)}
                            className="p-1 hover:bg-surface-container rounded-lg transition-colors cursor-pointer flex items-center justify-center mx-auto"
                            title="Toggle Columns"
                          >
                            <span className="material-symbols-outlined text-[20px] text-on-surface-variant hover:text-primary">more_vert</span>
                          </button>
                          {showColPicker && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setShowColPicker(false)}></div>
                              <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-lg p-3 space-y-2.5 z-20 text-sm text-on-surface text-left normal-case tracking-normal">
                                <p className="font-bold text-[10px] text-on-surface-variant uppercase tracking-widest px-1 mb-1">Toggle Columns</p>
                                <div className="h-px bg-outline-variant/20 my-1"></div>
                                {Object.entries({
                                  itemId: 'Item ID',
                                  name: 'Product Specification',
                                  uom: 'UOM',
                                  qty: 'Quantity',
                                  rate: 'Rate',
                                  subtotal: 'Subtotal'
                                }).map(([key, label]) => (
                                  <label key={key} className="flex items-center gap-2 px-1 py-0.5 hover:bg-surface rounded cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={visibleColumns[key]}
                                      onChange={() => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))}
                                      className="rounded border-outline-variant text-primary focus:ring-primary/20 w-4 h-4"
                                    />
                                    <span className="font-medium text-xs">{label}</span>
                                  </label>
                                ))}
                              </div>
                            </>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 text-sm text-on-surface">
                      {itemsList.map((item, idx) => (
                        <tr key={`${item.itemCode}_${idx}`} className="hover:bg-surface-container-low transition-colors">
                          {visibleColumns.itemId && <td className="px-6 py-5 font-mono text-on-surface-variant">{item.itemCode}</td>}
                          {visibleColumns.name && <td className="px-6 py-5 font-bold">{item.itemName || item.productSpecification || item.itemCode}</td>}
                          {visibleColumns.uom && <td className="px-6 py-5">{item.uom || 'Metric Ton'}</td>}
                          {visibleColumns.qty && <td className="px-6 py-5 text-right font-medium">{item.qty.toLocaleString()}</td>}
                          {visibleColumns.rate && (
                            <td className="px-6 py-5 text-right">
                              <input
                                type="number"
                                value={item.rate}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setCustomRates(prev => ({ ...prev, [idx]: val }));
                                }}
                                className="w-28 text-right bg-surface-container-low border border-outline-variant/30 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                min="0"
                              />
                            </td>
                          )}
                          {visibleColumns.subtotal && <td className="px-6 py-5 text-right font-bold text-on-surface">{item.subtotal.toLocaleString()}</td>}
                          
                          {/* Empty cell matching headers row */}
                          <td className="px-4 py-5 w-10"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : (
            /* Selected empty state warning box */
            <div className="p-12 text-center bg-surface-container-low border border-dashed border-outline-variant/30 rounded-xl">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">find_in_page</span>
              <p className="text-sm text-on-surface-variant">
                Document select karein taake items details load ki jaa sakein.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Financial Summary */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* Summary Panel */}
          <section className="bg-primary text-on-primary p-8 rounded-xl shadow-2xl shadow-primary/30 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
            <h4 className="text-xs font-black uppercase tracking-widest opacity-80 mb-8 border-b border-white/10 pb-4">
              Financial Summary
            </h4>
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium opacity-80">Gross Subtotal</span>
                <span className="text-lg font-semibold tracking-tight">{currencyCode} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium opacity-80">Sales Tax (17.00%)</span>
                <span className="text-lg font-semibold tracking-tight">{currencyCode} {tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium opacity-80">Withholding Tax (0.00%)</span>
                <span className="text-lg font-semibold tracking-tight">{currencyCode} {withholdingTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-6 border-t border-white/20 mt-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-black uppercase tracking-widest text-primary-fixed">Grand Total (Incl. Tax)</span>
                  <span className="text-4xl font-black tracking-tighter">
                    {currencyCode} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Details & Signature metadata */}
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block">Invoice Terms</label>
              <div className="p-4 bg-surface-container-low rounded-lg text-sm text-on-surface leading-relaxed">
                Net 30 days from the date of issuance. Penalty for late payment applies. Partial deliveries accepted.
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant block">Remarks / Internal Notes</label>
              <textarea 
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full p-4 bg-surface-container-low border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 h-24" 
                placeholder="Add optional remarks for the finance department..."
              />
            </div>
            <div className="pt-4 flex items-center justify-between">
              <div className="flex -space-x-2">
                <img className="w-8 h-8 rounded-full border-2 border-white" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB4vkeEGZCAN3aveTYpJpf3yzrrU2sTl-uWxNpftOYq1m2ymj6LkAdkh6v2b0mSpLXH5MVAR-ErbdQxg3Jy9nHzCOHTXslrzDErDHsSmB_utQJd2qMPGGG6XhVUHoQ2HTYUgCKoy6PGh2h9Y1GDEUfCkXWtB-60wYVXLSqBl86YjGsWmT8q9pk2UbYjlKe8L1Ez2JnK6Lmsnjm4E70T4iBxQe-KZKOpZOzBGnapNGL_UIXfUAPNCYstxxRRGA2DD9-Ug1UtaQqqHwlz" alt="Reviewer" />
                <img className="w-8 h-8 rounded-full border-2 border-white" src="https://lh3.googleusercontent.com/aida-public/AB6AXuChqNih6rrsl6NAB9XudcP4UjTUNtsveUDRYYy4fQRI89-RxoUumLFNQd4I6TNG8RBIVbLGNPazHL_EbrY4Q81-6qjWJvST2uflFPuhizTyMP3-sVUmT8rT6M3kBbIOQubnPlWxx96qOiFhITWxK0viYXcEquvV0jnjAVfOwXC7VTtYTw5gh5sJqJio5fC11wmnKP4BablkuqT_8Kng60AF9_wOBV_jxa1wTLEig5wF02tdwRwOXXgtuWvX6rbCV247RFgfH5QdJVRT" alt="Reviewer" />
                <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center text-[10px] font-bold border-2 border-white text-on-surface-variant">+2</div>
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant italic">Pending Verification</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
