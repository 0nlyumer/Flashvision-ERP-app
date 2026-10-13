import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import SalesInvoiceHistory from './SalesInvoiceHistory';
import ResizableHeader from '../ui/ResizableHeader';

// Sales Invoice generator panel matching Stitch template 26c3ab0c527b4bc0949cef1a9a63fd5a
export default function SalesInvoice() {
  const { state, addSalesInvoice } = useApp();
  const { appConfirm } = useDialog();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';
  const currencySymbol = state.adminSetup?.baseCurrency ? (state.adminSetup.baseCurrency.match(/\(([^)]+)\)/)?.[1] || '$') : '$';
  const [selectedDcId, setSelectedDcId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [discounts, setDiscounts] = useState({}); // Stores discount percentage per item index
  
  // View mode switcher: 'create' aur 'history' views ko toggle karne ke liye
  const [viewMode, setViewMode] = useState('create');

  // Columns visibility dropdown picker list handle karne ke liye states
  const [visibleColumns, setVisibleColumns] = useState({
    sr: true,
    code: true,
    name: true,
    uom: true,
    qty: true,
    price: true,
    discount: true, // New discount column
    subtotal: true
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Uninvoiced dispatched/prepared deliveries filter out karna dropdown list ke liye
  const activeDeliveries = (state.deliveries || []).filter(d => !d.isInvoiced);

  // Selected delivery object lookup
  const selectedDc = (state.deliveries || []).find(d => d.id === selectedDcId);

  // Subtotal aur Tax calculation logic
  let subtotal = 0;
  let itemsList = [];

  if (selectedDc) {
    itemsList = selectedDc.items.map((di, idx) => {
      // Item price database se fetch karna, agar nahi ho to default price define karna
      const matchedItem = (state.items || []).find(i => i.id === di.itemId || i.sku === di.itemCode);
      
      let unitPrice = 0;
      if (di.unitPrice) {
        unitPrice = di.unitPrice;
      } else if (matchedItem) {
        // dollar sign remove karna price parsing ke liye
        const rawPrice = parseFloat(matchedItem.price?.replace(/[^0-9.]/g, '')) || 50;
        unitPrice = (matchedItem.price?.startsWith('$') && currencyCode === 'PKR') ? rawPrice * 280 : rawPrice; // USD to PKR rate if applicable
      } else {
        unitPrice = 12000; // standard default price
      }

      const qty = parseFloat(di.dispatchedQty || di.qty) || 1;
      const discPercent = discounts[idx] || 0;
      const itemSubtotalWithoutDisc = qty * unitPrice;
      const discAmount = itemSubtotalWithoutDisc * (discPercent / 100);
      const itemSubtotal = itemSubtotalWithoutDisc - discAmount;
      subtotal += itemSubtotal;

      return {
        ...di,
        unitPrice,
        discountPercent: discPercent,
        discountAmount: discAmount,
        subtotal: itemSubtotal
      };
    });
  }

  const salesTax = subtotal * 0.17;
  const grandTotal = subtotal + salesTax;

  // Invoice generator action click handler
  const handleGenerateInvoice = async () => {
    if (!selectedDc) return;

    const proceed = await appConfirm(
      `Are you sure you want to generate a sales invoice for Delivery Challan ${selectedDcId}?\nGrand Total: ${currencyCode} ${grandTotal.toLocaleString()}`,
      "Confirm Invoice Generation",
      "Generate Invoice",
      "Cancel"
    );

    if (!proceed) return;

    const invoiceId = 'INV-' + (8900 + (state.salesInvoices || []).length + 1);

    const newInvoice = {
      id: invoiceId,
      date: new Date().toISOString(),
      deliveryId: selectedDc.id,
      customerName: selectedDc.customerName,
      customerId: selectedDc.customerId,
      subtotal,
      tax: salesTax,
      grandTotal,
      status: 'Settled',
      remarks,
      items: itemsList.map(it => ({
        itemCode: it.itemCode,
        productName: it.productName,
        quantity: parseFloat(it.dispatchedQty || it.qty) || 1,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent,
        discountAmount: it.discountAmount,
        subtotal: it.subtotal,
        uom: it.uom || 'Units'
      }))
    };

    // Global context dispatch aur state save
    addSalesInvoice(newInvoice);

    // Form settings clear/reset code
    setSelectedDcId('');
    setRemarks('');
    setDiscounts({});
  };

  if (viewMode === 'history') {
    return <SalesInvoiceHistory onViewCreate={() => setViewMode('create')} />;
  }

  return (
    <div className="p-8 max-w-full w-full mx-auto space-y-8">
      {/* Page header and selection bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">Create Sales Invoice</h2>
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
        <div className="w-full md:w-96">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">
            Select Delivery Challan (DC)
          </label>
          <div className="relative group">
            <select 
              value={selectedDcId}
              onChange={(e) => { setSelectedDcId(e.target.value); setDiscounts({}); }}
              className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3.5 pr-10 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm cursor-pointer"
            >
              <option value="">Choose an active DC...</option>
              {activeDeliveries.map(d => (
                <option key={d.id} value={d.id}>{d.id} ({d.customerName})</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none group-hover:text-primary transition-colors">
              expand_more
            </span>
          </div>
        </div>
      </div>

      {selectedDc ? (
        <div className="space-y-8 animate-fade-in" id="invoice-canvas">
          {/* Customer & Address Details */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-surface-container-lowest p-6 rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] flex flex-col gap-4">
              <div className="flex items-center gap-3 text-primary mb-2">
                <span className="material-symbols-outlined">person_pin</span>
                <h3 className="font-headline font-bold text-sm">Customer Details</h3>
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Customer Name</p>
                <p className="text-base font-semibold text-on-surface">{selectedDc.customerName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Contact Details</p>
                <p className="text-sm text-on-surface">
                  {selectedDc.consignee?.contactNumber || selectedDc.logistics?.driverNumber || 'N/A'}
                </p>
              </div>
            </div>

            <div className="lg:col-span-1 bg-surface-container-lowest p-6 rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] flex flex-col gap-4">
              <div className="flex items-center gap-3 text-primary mb-2">
                <span className="material-symbols-outlined">location_on</span>
                <h3 className="font-headline font-bold text-sm">Billing Address</h3>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {selectedDc.consignee?.deliveryAddress || 'Korangi Industrial Area, Sector 15, Karachi, Pakistan'}
              </p>
            </div>

            <div className="lg:col-span-1 bg-surface-container-lowest p-6 rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] flex flex-col gap-4">
              <div className="flex items-center gap-3 text-primary mb-2">
                <span className="material-symbols-outlined">local_shipping</span>
                <h3 className="font-headline font-bold text-sm">Shipping & Transport</h3>
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Driver Details</p>
                <p className="text-sm text-on-surface">
                  {selectedDc.logistics?.driverName || 'N/A'} ({selectedDc.logistics?.vehicleNumber || 'N/A'})
                </p>
              </div>
              <div className="mt-1">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Shipping Address</p>
                <p className="text-xs text-on-surface-variant leading-tight">
                  {selectedDc.consignee?.deliveryAddress || 'Warehouse 12-B, Industrial Estate, Karachi'}
                </p>
              </div>
            </div>
          </section>

          {/* Line Items Table */}
          <section className="bg-surface-container-lowest rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-container flex justify-between items-center bg-surface-container-low/30">
              <h3 className="font-headline font-bold text-on-surface">Line Items</h3>
              <span className="text-xs font-medium px-3 py-1 bg-surface-container text-on-secondary-container rounded-full">
                {itemsList.length} Items linked to {selectedDc.id}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low">
                    {visibleColumns.sr && <ResizableHeader className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Sr.</ResizableHeader>}
                    {visibleColumns.code && <ResizableHeader className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Code</ResizableHeader>}
                    {visibleColumns.name && <ResizableHeader className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Item Name</ResizableHeader>}
                    {visibleColumns.uom && <ResizableHeader className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">UOM</ResizableHeader>}
                    {visibleColumns.qty && <ResizableHeader className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Qty</ResizableHeader>}
                    {visibleColumns.price && <ResizableHeader className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Unit Price ({currencyCode})</ResizableHeader>}
                    {visibleColumns.discount && <ResizableHeader className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Disc (%)</ResizableHeader>}
                    {visibleColumns.subtotal && <ResizableHeader className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Subtotal</ResizableHeader>}
                    
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
                              sr: 'Sr.',
                              code: 'Code',
                              name: 'Item Name',
                              uom: 'UOM',
                              qty: 'Qty',
                              price: 'Unit Price',
                              discount: 'Discount (%)',
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
                <tbody className="divide-y divide-surface-container">
                  {itemsList.map((item, idx) => (
                    <tr key={`${item.itemCode}_${idx}`} className="hover:bg-surface transition-colors">
                      {visibleColumns.sr && (
                        <td className="px-6 py-4 text-sm font-medium text-on-surface-variant">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                      )}
                      {visibleColumns.code && (
                        <td className="px-6 py-4 text-sm font-mono text-primary font-semibold">
                          {item.itemCode}
                        </td>
                      )}
                      {visibleColumns.name && (
                        <td className="px-6 py-4 text-sm text-on-surface font-medium">
                          {item.productName}
                        </td>
                      )}
                      {visibleColumns.uom && (
                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                          {item.uom || 'Units'}
                        </td>
                      )}
                      {visibleColumns.qty && (
                        <td className="px-6 py-4 text-sm text-on-surface font-bold text-right">
                          {(parseFloat(item.dispatchedQty || item.qty) || 0).toLocaleString()}
                        </td>
                      )}
                      {visibleColumns.price && (
                        <td className="px-6 py-4 text-sm text-on-surface font-medium text-right">
                          {item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      {visibleColumns.discount && (
                        <td className="px-6 py-4 text-right">
                          <input
                            type="number"
                            value={item.discountPercent}
                            onChange={(e) => {
                              const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                              setDiscounts(prev => ({ ...prev, [idx]: val }));
                            }}
                            className="w-20 text-right bg-surface-container-low border border-outline-variant/30 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                            min="0"
                            max="100"
                          />
                        </td>
                      )}
                      {visibleColumns.subtotal && (
                        <td className="px-6 py-4 text-sm text-on-surface font-bold text-right">
                          {item.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      {/* Empty cell matching headers row */}
                      <td className="px-4 py-4 w-10"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Remarks & Total Actions */}
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex-1 w-full bg-surface-container-low p-6 rounded-2xl border border-outline-variant/10">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 ml-1">
                Invoice Remarks &amp; Notes
              </label>
              <textarea 
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none" 
                placeholder="Enter special delivery instructions or payment terms..." 
                rows={4}
              />
            </div>
            
            <div className="w-full lg:w-96 bg-surface-container-lowest p-8 rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] border border-primary/5">
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-on-surface-variant">Subtotal</span>
                  <span className="text-sm font-bold text-on-surface">{currencyCode} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-on-surface-variant">Sales Tax (17%)</span>
                  <span className="text-sm font-bold text-on-surface">{currencyCode} {salesTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="h-px bg-outline-variant/30 my-2"></div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Grand Total</p>
                    <span className="text-2xl font-headline font-extrabold text-on-surface">
                      {currencyCode} {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-primary mb-1">payments</span>
                </div>
              </div>
              <div className="space-y-3">
                <button 
                  onClick={handleGenerateInvoice}
                  className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary py-4 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined">receipt</span>
                  Generate Sales Invoice
                </button>
                <button className="w-full bg-secondary-container text-on-secondary-container py-3.5 rounded-xl font-bold text-sm hover:bg-secondary-container/80 transition-all active:scale-95 cursor-pointer">
                  Save Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Dropdown Empty State */
        <div className="min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/30" id="empty-state">
          <div className="w-20 h-20 bg-surface-container-highest rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl text-outline">description</span>
          </div>
          <h3 className="text-xl font-headline font-bold text-on-surface mb-2">No Delivery Challan Selected</h3>
          <p className="text-on-surface-variant max-w-sm mx-auto text-sm leading-relaxed">
            Please select a Delivery Challan from the dropdown menu above to populate the customer information and line items for this invoice.
          </p>
        </div>
      )}
    </div>
  );
}
