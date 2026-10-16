import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import ResizableHeader from '../ui/ResizableHeader';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

// Sales Invoice History module matching professional Stitch templates
export default function SalesInvoiceHistory({ onViewCreate }) {
  const { state, updateSalesInvoice, deleteSalesInvoice } = useApp();
  const { appConfirm, appAlert } = useDialog();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';
  const currencySymbol = state.adminSetup?.baseCurrency ? (state.adminSetup.baseCurrency.match(/\(([^)]+)\)/)?.[1] || 'Rs.') : 'Rs.';

  const [selectedInvoice, setSelectedInvoice] = useState(null); // Detail modal open karne ke liye
  const [printInvoiceData, setPrintInvoiceData] = useState(null); // Universal print preview modal state
  const [editInvoice, setEditInvoice] = useState(null); // Edit modal handler
  const [editRemarks, setEditRemarks] = useState('');
  const [editDate, setEditDate] = useState('');

  // Column selections ke liye local state
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    date: true,
    dcRef: true,
    customer: true,
    total: true,
    status: true,
    actions: true
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Payment voucher check helper: returns true if invoice is mapped in paymentVouchers
  const hasPaymentVoucher = (invoiceId) => {
    return (state.paymentVouchers || []).some(
      pv => pv.invoiceId === invoiceId && pv.invoiceType === 'Sales'
    );
  };

  // Print function opening UniversalPrintPreviewModal (Issue 4)
  const handlePrint = (invoice) => {
    if (!invoice) return;
    const items = (invoice.items || []).map((it, idx) => ({
      sr: idx + 1,
      item_code: it.itemCode || it.code || `ITM-${idx + 1}`,
      description: it.productName || it.description || it.name || 'Sales Item',
      qty: it.quantity || it.qty || 1,
      unit: it.unit || 'PCS',
      unit_price: it.price || it.unitPrice || 0,
      amount: (it.quantity || it.qty || 1) * (it.price || it.unitPrice || 0)
    }));

    const subtotal = invoice.subtotal || invoice.totalAmount || items.reduce((sum, i) => sum + i.amount, 0);
    const tax = invoice.taxAmount || invoice.tax || 0;
    const discount = invoice.discount || 0;
    const grandTotal = invoice.totalAmount || (subtotal + tax - discount);

    setPrintInvoiceData({
      ...invoice,
      id: invoice.id,
      header: {
        invoice_no: invoice.id,
        date: invoice.date ? invoice.date.split('T')[0] : new Date().toISOString().split('T')[0],
        customer_name: invoice.customerName || invoice.customer || 'Customer',
        dc_number: invoice.deliveryId || invoice.dc_number || '—',
        so_number: invoice.soId || invoice.so_number || invoice.soNumber || '—',
        payment_terms: invoice.paymentTerms || '30 Days Net',
        status: invoice.status || 'Posted'
      },
      items,
      totals: {
        subtotal,
        tax,
        discount,
        grandTotal
      }
    });
  };

  // Edit action click trigger
  const handleEditClick = (invoice) => {
    if (hasPaymentVoucher(invoice.id)) {
      appAlert(`Action Blocked: Payment Voucher linked.\n\nInvoice ${invoice.id} is associated with a payment voucher and cannot be edited.`);
      return;
    }
    setEditInvoice(invoice);
    setEditRemarks(invoice.remarks || '');
    setEditDate(invoice.date ? invoice.date.split('T')[0] : new Date().toISOString().split('T')[0]);
  };

  // Save edit changes handler
  const handleSaveEdit = () => {
    if (!editInvoice) return;
    const updatedData = {
      ...editInvoice,
      remarks: editRemarks,
      date: new Date(editDate).toISOString()
    };
    updateSalesInvoice(editInvoice.id, updatedData);
    setEditInvoice(null);
  };

  // Delete invoice action click trigger
  const handleDeleteClick = async (invoice) => {
    if (hasPaymentVoucher(invoice.id)) {
      appAlert(`Action Blocked: Payment Voucher linked.\n\nInvoice ${invoice.id} is associated with a payment voucher and cannot be deleted.`);
      return;
    }

    const proceed = await appConfirm(
      `Are you sure you want to delete invoice ${invoice.id}?\nDeleting this invoice will restore Delivery Challan ${invoice.deliveryId} back to the invoicing dropdown list.`,
      "Delete Invoice Confirmation",
      "Delete",
      "Cancel"
    );

    if (proceed) {
      deleteSalesInvoice(invoice.id);
    }
  };

  return (
    <div className="p-8 max-w-full w-full mx-auto space-y-8">
      {/* Navigation and Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">Sales Invoice History</h2>
            <button
              onClick={onViewCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-xl font-bold text-xs hover:scale-[1.02] transition-all shadow-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              Create Invoice
            </button>
          </div>
        </div>
      </div>

      {/* History table */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] overflow-hidden border border-outline-variant/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-surface-container">
                {visibleColumns.id && <ResizableHeader className="px-6 py-4">Invoice ID</ResizableHeader>}
                {visibleColumns.date && <ResizableHeader className="px-6 py-4">Date</ResizableHeader>}
                {visibleColumns.dcRef && <ResizableHeader className="px-6 py-4">DC Ref</ResizableHeader>}
                {visibleColumns.customer && <ResizableHeader className="px-6 py-4">Customer</ResizableHeader>}
                {visibleColumns.total && <ResizableHeader className="px-6 py-4 text-right">Grand Total</ResizableHeader>}
                {visibleColumns.status && <ResizableHeader className="px-6 py-4">Status</ResizableHeader>}
                {visibleColumns.actions && <ResizableHeader className="px-6 py-4 text-center">Actions</ResizableHeader>}
                
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
                          id: 'Invoice ID',
                          date: 'Date',
                          dcRef: 'DC Reference',
                          customer: 'Customer',
                          total: 'Grand Total',
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
              {(state.salesInvoices || []).length > 0 ? (
                (state.salesInvoices || []).map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-surface transition-colors">
                    {visibleColumns.id && (
                      <td className="px-6 py-4 text-sm font-mono font-bold text-primary">
                        {invoice.id}
                      </td>
                    )}
                    {visibleColumns.date && (
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {new Date(invoice.date).toLocaleDateString()}
                      </td>
                    )}
                    {visibleColumns.dcRef && (
                      <td className="px-6 py-4 text-sm font-mono text-on-surface-variant">
                        {invoice.deliveryId}
                      </td>
                    )}
                    {visibleColumns.customer && (
                      <td className="px-6 py-4 text-sm font-semibold text-on-surface">
                        {invoice.customerName}
                      </td>
                    )}
                    {visibleColumns.total && (
                      <td className="px-6 py-4 text-sm font-bold text-right text-on-surface">
                        {currencyCode} {invoice.grandTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          invoice.status === 'Settled' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td className="px-6 py-4 text-sm text-center">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedInvoice(invoice)}
                            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                          <button
                            onClick={() => handlePrint(invoice)}
                            className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                            title="Print Invoice"
                          >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                          </button>
                          <button
                            onClick={() => handleEditClick(invoice)}
                            className="p-1.5 text-on-surface-variant hover:text-amber-700 hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                            title="Edit Invoice"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteClick(invoice)}
                            className="p-1.5 text-on-surface-variant hover:text-red-700 hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                            title="Delete Invoice"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
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
                  <td colSpan={8} className="text-center p-12 text-on-surface-variant font-medium">
                    No sales invoices found in history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* PDF View Modal Overlay */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center font-body p-4 sm:p-6 overflow-y-auto">
          <div className="absolute inset-0 bg-on-background/25 backdrop-blur-[3px]" onClick={() => setSelectedInvoice(null)}></div>
          
          <div className="relative z-10 w-full max-w-4xl bg-surface-container-lowest rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-1 ring-outline-variant/15 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-surface-container flex justify-between items-center bg-surface-container-low/30 rounded-t-2xl">
              <h3 className="font-headline font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">description</span>
                Sales Invoice Detail ({selectedInvoice.id})
              </h3>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors cursor-pointer text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Content - Scrollable Formatted Invoice */}
            <div className="p-8 overflow-y-auto space-y-8 flex-1">
              <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-surface-container pb-6">
                <div>
                  <h1 className="text-2xl font-black text-on-surface tracking-tight mb-1">FLASHVISION LOGISTICS</h1>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    123 Logistics Avenue, Industrial Estate, TX 75001<br />
                    Phone: +1 (555) 123-4567 | Email: finance@flashvision.com
                  </p>
                </div>
                <div className="text-left md:text-right space-y-1">
                  <h2 className="text-xl font-extrabold text-on-surface uppercase tracking-wide">Sales Invoice</h2>
                  <p className="text-xs text-on-surface-variant"><strong>Invoice ID:</strong> {selectedInvoice.id}</p>
                  <p className="text-xs text-on-surface-variant"><strong>Date:</strong> {new Date(selectedInvoice.date).toLocaleDateString()}</p>
                  <p className="text-xs text-on-surface-variant"><strong>DC Ref:</strong> {selectedInvoice.deliveryId}</p>
                </div>
              </div>

              {/* Client & Billing Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-surface-container-low/30 p-5 rounded-xl border border-outline-variant/10">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase text-on-surface-variant tracking-wider">Client (Bill To)</h4>
                  <p className="text-base font-bold text-on-surface">{selectedInvoice.customerName}</p>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Korangi Industrial Area, Sector 15,<br />
                    Karachi, Pakistan
                  </p>
                </div>
                <div className="space-y-1.5 text-left md:text-right">
                  <h4 className="text-[10px] font-black uppercase text-on-surface-variant tracking-wider">Terms & Summary</h4>
                  <p className="text-xs text-on-surface"><strong>Payment Terms:</strong> Net 30 Days</p>
                  <p className="text-xs text-on-surface"><strong>Status:</strong> <span className="font-bold text-emerald-700">{selectedInvoice.status}</span></p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-outline-variant/20 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-surface-container">
                    <tr>
                      <th className="px-5 py-3.5">Sr.</th>
                      <th className="px-5 py-3.5">Code</th>
                      <th className="px-5 py-3.5">Description</th>
                      <th className="px-5 py-3.5">UOM</th>
                      <th className="px-5 py-3.5 text-right">Qty</th>
                      <th className="px-5 py-3.5 text-right">Rate ({currencyCode})</th>
                      <th className="px-5 py-3.5 text-right">Disc (%)</th>
                      <th className="px-5 py-3.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-xs text-on-surface">
                    {(selectedInvoice.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="px-5 py-3 font-medium text-on-surface-variant">{String(idx + 1).padStart(2, '0')}</td>
                        <td className="px-5 py-3 font-mono font-semibold text-primary">{item.itemCode}</td>
                        <td className="px-5 py-3 font-medium">{item.productName}</td>
                        <td className="px-5 py-3 text-on-surface-variant">{item.uom || 'Units'}</td>
                        <td className="px-5 py-3 text-right font-bold">{item.quantity?.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right font-medium">{item.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-3 text-right text-on-surface-variant font-medium">{item.discountPercent ? `${item.discountPercent}%` : '0%'}</td>
                        <td className="px-5 py-3 text-right font-bold text-on-surface">{item.subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Invoice Summary */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                <div className="flex-1 w-full bg-surface-container-low/20 p-5 rounded-xl border border-outline-variant/10">
                  <h5 className="text-[10px] font-bold uppercase text-on-surface-variant tracking-wider mb-2">Remarks &amp; Notes</h5>
                  <p className="text-xs text-on-surface leading-relaxed italic">
                    {selectedInvoice.remarks || "No internal remarks specified."}
                  </p>
                </div>
                
                <div className="w-full md:w-80 bg-surface-container-low/40 p-5 rounded-xl border border-outline-variant/20 space-y-3.5">
                  <div className="flex justify-between items-center text-xs text-on-surface-variant">
                    <span>Subtotal</span>
                    <span className="font-semibold text-on-surface">{currencyCode} {selectedInvoice.subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-on-surface-variant">
                    <span>Sales Tax (17%)</span>
                    <span className="font-semibold text-on-surface">{currencyCode} {selectedInvoice.tax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="h-px bg-outline-variant/30"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-primary uppercase tracking-widest">Grand Total</span>
                    <span className="text-lg font-headline font-black text-on-surface">
                      {currencyCode} {selectedInvoice.grandTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 border-t border-surface-container flex justify-end gap-3 bg-surface-container-low/30 rounded-b-2xl">
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="px-5 py-2.5 bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close View
              </button>
              <button 
                onClick={() => handlePrint(selectedInvoice)}
                className="px-5 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold rounded-xl text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Print Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal Popup */}
      {editInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center font-body p-4">
          <div className="absolute inset-0 bg-on-background/20 backdrop-blur-[2px]" onClick={() => setEditInvoice(null)}></div>
          
          <div className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.1)] border border-outline-variant/15 flex flex-col p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="font-headline font-extrabold text-xl text-on-surface mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">edit_note</span>
              Edit Invoice ({editInvoice.id})
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Invoice Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Remarks</label>
                <textarea
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full bg-surface border border-outline-variant/30 rounded-xl p-4 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  rows={4}
                  placeholder="Enter remarks..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setEditInvoice(null)}
                className="px-4 py-2.5 bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                className="px-5 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Universal Print Preview Modal (Issue 4) */}
      {printInvoiceData && (
        <UniversalPrintPreviewModal
          isOpen={Boolean(printInvoiceData)}
          onClose={() => setPrintInvoiceData(null)}
          documentType="sales_invoice"
          documentData={printInvoiceData}
        />
      )}
    </div>
  );
}
