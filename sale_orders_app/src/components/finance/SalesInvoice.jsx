import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import SalesInvoiceHistory from './SalesInvoiceHistory';
import ResizableHeader from '../ui/ResizableHeader';
import { resolveSalesLineRate } from '../../utils/typePricing';
import { normalizeSourceDocLines, itemsForDepartment, siLinkedSourceIds } from '../../utils/invoiceSource';

// Sales Invoice generator panel matching Stitch template 26c3ab0c527b4bc0949cef1a9a63fd5a
//
// Source documents (Omer's order, 2026-10-24): an invoice can be raised
// against a Delivery Challan (the original flow), against a GRN, against
// an Inward Gate Pass, or standalone (department select -> that
// department's items -> any item). Every invoice records sourceType +
// sourceId so it stays linked to its document. GRN / IGP linking is
// LINK-ONLY: their isInvoiced flag belongs to the Purchase Invoice flow
// and is never touched here (see utils/invoiceSource.js). The DC flag
// keeps its exact old behaviour — marked on post, never on draft.
// Stable per-row id for standalone manual lines — customRates/discounts
// are keyed by this id so deleting a middle row never shifts another
// row's edited rate/discount.
let manualLineSeq = 0;
const newManualLine = () => ({ id: 'ml' + (++manualLineSeq), itemId: '', qty: 1 });

export default function SalesInvoice() {
  const { state, addSalesInvoice } = useApp();
  const { appConfirm } = useDialog();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';
  const currencySymbol = state.adminSetup?.baseCurrency ? (state.adminSetup.baseCurrency.match(/\(([^)]+)\)/)?.[1] || '$') : '$';
  const [sourceType, setSourceType] = useState('DC'); // 'DC' | 'GRN' | 'IGP' | 'STANDALONE'
  const [selectedDcId, setSelectedDcId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState(''); // GRN / IGP document id
  const [departmentId, setDepartmentId] = useState(''); // standalone
  const [customerId, setCustomerId] = useState(''); // standalone
  const [manualLines, setManualLines] = useState([newManualLine()]); // standalone rows (stable ml.id per row)
  const [customRates, setCustomRates] = useState({}); // editable rate overrides (non-DC modes)
  const [remarks, setRemarks] = useState('');
  const [discounts, setDiscounts] = useState({}); // Stores discount percentage per item index
  // Tax is OPTIONAL per document (Omer's order, 2026-10-24): the toggle
  // drives the tax leg; the choice is stored on the invoice
  // (taxApplied) and restated in the save/post confirmation so a user
  // who forgot the tax is reminded before saving.
  const [taxApplied, setTaxApplied] = useState(true);

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

  // GRN / IGP documents: all of them EXCEPT ones already held by a posted
  // sales invoice of the same source type (a draft holds nothing, and
  // the documents' own isInvoiced flag belongs to Purchase Invoices, so
  // it is NOT consulted here).
  const linkedGrnIds = siLinkedSourceIds(state.salesInvoices, 'GRN');
  const linkedIgpIds = siLinkedSourceIds(state.salesInvoices, 'IGP');
  const activeGrns = (state.grns || []).filter(g => !linkedGrnIds.has(g.id));
  const activeIgps = (state.inwardGatePasses || []).filter(g => !linkedIgpIds.has(g.id));

  const selectedDoc = sourceType === 'GRN'
    ? (state.grns || []).find(d => d.id === selectedDocId)
    : sourceType === 'IGP'
      ? (state.inwardGatePasses || []).find(d => d.id === selectedDocId)
      : null;

  // Standalone lookups: departments (Inventory mapping) + customers
  const departments = state.departments || [];
  const selectedDepartment = departments.find(d => d.id === departmentId) || null;
  const deptItems = itemsForDepartment(state.items, selectedDepartment);
  const customers = state.customers || [];
  const selectedCustomer = customers.find(c => c.id === customerId) || null;

  const switchSourceType = (type) => {
    setSourceType(type);
    setSelectedDcId('');
    setSelectedDocId('');
    setDepartmentId('');
    setCustomerId('');
    setManualLines([newManualLine()]);
    setCustomRates({});
    setDiscounts({});
  };

  // Subtotal aur Tax calculation logic — one uniform line shape for all
  // four source modes: { itemCode, productName, stockType, qty, uom,
  // unitPrice, discountPercent, discountAmount, subtotal }
  let subtotal = 0;
  let itemsList = [];

  const pushLine = (base, idx) => {
    const discPercent = discounts[idx] || 0;
    const gross = (parseFloat(base.qty) || 0) * (parseFloat(base.unitPrice) || 0);
    const discAmount = gross * (discPercent / 100);
    const line = {
      ...base,
      discountPercent: discPercent,
      discountAmount: discAmount,
      subtotal: gross - discAmount
    };
    subtotal += line.subtotal;
    itemsList.push(line);
    return line;
  };

  if (sourceType === 'DC' && selectedDc) {
    itemsList = [];
    subtotal = 0;
    selectedDc.items.map((di, idx) => {
      // Item price database se fetch karna, agar nahi ho to default price define karna
      const matchedItem = (state.items || []).find(i => i.id === di.itemId || i.sku === di.itemCode);

      // Rate ab challan line se ata hai: DC line ka rate Item Rate Profile ke
      // type-wise rate (pricesByType) se resolve hota hai, is liye invoice
      // wohi type pricing dikhati hai jo challan par lagi thi. Challan rate
      // na ho to resolver purane master-price fallback par girta hai.
      const unitPrice = resolveSalesLineRate(di, matchedItem, currencyCode);

      const qty = parseFloat(di.dispatchedQty || di.qty) || 1;
      return pushLine({ ...di, qty, unitPrice }, idx);
    });
  } else if ((sourceType === 'GRN' || sourceType === 'IGP') && selectedDoc) {
    itemsList = [];
    subtotal = 0;
    normalizeSourceDocLines(selectedDoc).map((line, idx) => {
      const matchedItem = (state.items || []).find(i => i.id === line.itemId || i.sku === line.itemCode);
      // Rate: document ki apni rate (agar hai) resolver ke pehle step se
      // aati hai; warna Item Rate Profile / master price. Screen par rate
      // editable hai (customRates override).
      const resolved = resolveSalesLineRate(
        { unitPrice: line.carriedRate, stockType: null },
        matchedItem,
        currencyCode
      );
      const unitPrice = customRates[idx] !== undefined ? customRates[idx] : resolved;
      return pushLine({
        itemCode: line.itemCode,
        productName: line.productName,
        stockType: null,
        qty: line.qty,
        uom: line.uom,
        unitPrice
      }, idx);
    });
  } else if (sourceType === 'STANDALONE' && selectedDepartment && selectedCustomer) {
    itemsList = [];
    subtotal = 0;
    // Standalone rows are keyed by their stable ml.id — deleting a middle
    // row (or filling an empty row above) never shifts another row's
    // edited rate/discount.
    manualLines.forEach((ml) => {
      const item = (state.items || []).find(i => i.id === ml.itemId);
      if (!item) return;
      // Rate Item Rate Profile / item master price se, screen par editable.
      const resolved = resolveSalesLineRate({}, item, currencyCode);
      const unitPrice = customRates[ml.id] !== undefined ? customRates[ml.id] : resolved;
      pushLine({
        lineId: ml.id,
        itemCode: item.sku,
        productName: item.name,
        stockType: null,
        qty: parseFloat(ml.qty) || 0,
        uom: item.uom || 'Units',
        unitPrice
      }, ml.id);
    });
  }

  const salesTax = taxApplied ? subtotal * 0.17 : 0;
  const grandTotal = subtotal + salesTax;

  // Party (jis ke naam invoice banta hai) per source mode
  const party = sourceType === 'DC' && selectedDc
    ? { name: selectedDc.customerName, id: selectedDc.customerId }
    : (sourceType === 'GRN' || sourceType === 'IGP') && selectedDoc
      ? { name: selectedDoc.supplierName || 'Unknown Party', id: selectedDoc.supplierId || null }
      : sourceType === 'STANDALONE' && selectedCustomer
        ? { name: selectedCustomer.name, id: selectedCustomer.id }
        : { name: '', id: null };

  const formReady = sourceType === 'DC'
    ? !!selectedDc
    : sourceType === 'STANDALONE'
      ? !!(selectedDepartment && selectedCustomer)
      : !!selectedDoc;

  const canGenerate = formReady && itemsList.length > 0
    && itemsList.every(it => (parseFloat(it.qty) || 0) > 0);

  const sourcePhrase = sourceType === 'DC'
    ? `Delivery Challan ${selectedDcId}`
    : sourceType === 'GRN'
      ? `GRN ${selectedDocId}`
      : sourceType === 'IGP'
        ? `Inward Gate Pass ${selectedDocId}`
        : `a standalone sale (Department: ${selectedDepartment?.name || '—'}, Customer: ${selectedCustomer?.name || '—'})`;

  const sourceChip = sourceType === 'DC' && selectedDc
    ? `${itemsList.length} Items linked to ${selectedDc.id}`
    : (sourceType === 'GRN' || sourceType === 'IGP') && selectedDoc
      ? `${itemsList.length} Items linked to ${selectedDoc.id}`
      : `Department: ${selectedDepartment?.name || '—'}`;

  const buildInvoice = (invoiceId, status) => ({
    id: invoiceId,
    date: new Date().toISOString(),
    deliveryId: sourceType === 'DC' ? selectedDc.id : null,
    sourceType,
    sourceId: sourceType === 'DC' ? selectedDc.id : sourceType === 'STANDALONE' ? null : selectedDoc.id,
    department: sourceType === 'STANDALONE' ? (selectedDepartment?.name || null) : null,
    customerName: party.name,
    customerId: party.id,
    subtotal,
    tax: salesTax,
    taxApplied,
    grandTotal,
    status,
    remarks,
    items: itemsList.map(it => ({
      itemCode: it.itemCode,
      productName: it.productName,
      stockType: it.stockType || null,
      quantity: it.qty,
      unitPrice: it.unitPrice,
      discountPercent: it.discountPercent,
      discountAmount: it.discountAmount,
      subtotal: it.subtotal,
      uom: it.uom || 'Units'
    }))
  });

  const resetInvoiceForm = () => {
    setSelectedDcId('');
    setSelectedDocId('');
    setDepartmentId('');
    setCustomerId('');
    setManualLines([newManualLine()]);
    setCustomRates({});
    setRemarks('');
    setDiscounts({});
    setTaxApplied(true);
  };

  // Invoice generator action click handler
  const handleGenerateInvoice = async () => {
    if (!canGenerate) return;

    const proceed = await appConfirm(
      `Are you sure you want to generate a sales invoice for ${sourcePhrase}?\nGrand Total: ${currencyCode} ${grandTotal.toLocaleString()}\n\nSales Tax (17%): ${taxApplied ? `APPLIED — ${currencyCode} ${salesTax.toLocaleString()}` : 'NOT APPLIED'} (use the Tax toggle on the form to change this before generating).`,
      "Confirm Invoice Generation",
      "Generate Invoice",
      "Cancel"
    );

    if (!proceed) return;

    const invoiceId = 'INV-' + (8900 + (state.salesInvoices || []).length + 1);

    // Global context dispatch aur state save
    addSalesInvoice(buildInvoice(invoiceId, 'Settled'));

    // Form settings clear/reset code
    resetInvoiceForm();
  };

  // Save Draft handler (Omer's order, 2026-10-24): saves the invoice with
  // Draft status. A draft has no GL posting, no stock movement and no AR
  // effect, and it does NOT hold its source document (the challan stays
  // un-invoiced; GRN / IGP are link-only in every case) — it can be
  // posted later from Invoice History, which runs the normal flow.
  const handleSaveDraft = async () => {
    if (!canGenerate) return;

    const proceed = await appConfirm(
      `Save this sales invoice for ${sourcePhrase} as a DRAFT?\nGrand Total: ${currencyCode} ${grandTotal.toLocaleString()}\n\nSales Tax (17%): ${taxApplied ? `APPLIED — ${currencyCode} ${salesTax.toLocaleString()}` : 'NOT APPLIED'} (use the Tax toggle on the form to change this before saving).\n\nDrafts do not post to the ledger — post it from Invoice History when ready.`,
      "Save Draft Invoice",
      "Save Draft",
      "Cancel"
    );

    if (!proceed) return;

    const invoiceId = 'INV-' + (8900 + (state.salesInvoices || []).length + 1);

    addSalesInvoice(buildInvoice(invoiceId, 'Draft'));

    resetInvoiceForm();
  };

  if (viewMode === 'history') {
    return <SalesInvoiceHistory onViewCreate={() => setViewMode('create')} />;
  }

  const selectClass = "w-full appearance-none bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3.5 pr-10 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm cursor-pointer";
  const sourceTabClass = (active) => `px-4 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${active ? 'bg-surface-container-lowest shadow-sm text-primary font-bold' : 'text-on-surface-variant font-semibold hover:text-on-surface'}`;

  return (
    <div className="p-8 max-w-full w-full mx-auto space-y-8">
      {/* Page header */}
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
      </div>

      {/* Invoice Source selection */}
      <section className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            Invoice Source
          </label>
          <div className="inline-flex flex-wrap p-1 bg-surface-container rounded-xl gap-1">
            <button type="button" onClick={() => switchSourceType('DC')} className={sourceTabClass(sourceType === 'DC')}>
              Delivery Challan
            </button>
            <button type="button" onClick={() => switchSourceType('GRN')} className={sourceTabClass(sourceType === 'GRN')}>
              GRN
            </button>
            <button type="button" onClick={() => switchSourceType('IGP')} className={sourceTabClass(sourceType === 'IGP')}>
              Inward Gate Pass
            </button>
            <button type="button" onClick={() => switchSourceType('STANDALONE')} className={sourceTabClass(sourceType === 'STANDALONE')}>
              Standalone (No Document)
            </button>
          </div>
        </div>

        {sourceType === 'DC' && (
          <div className="w-full md:w-96">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">
              Select Delivery Challan (DC)
            </label>
            <div className="relative group">
              <select
                value={selectedDcId}
                onChange={(e) => { setSelectedDcId(e.target.value); setDiscounts({}); setCustomRates({}); }}
                className={selectClass}
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
        )}

        {sourceType === 'GRN' && (
          <div className="w-full md:w-96">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">
              Select GRN (Goods Receive Note)
            </label>
            <div className="relative group">
              <select
                value={selectedDocId}
                onChange={(e) => { setSelectedDocId(e.target.value); setDiscounts({}); setCustomRates({}); }}
                className={selectClass}
              >
                <option value="">Choose a GRN...</option>
                {activeGrns.map(g => (
                  <option key={g.id} value={g.id}>{g.id} ({g.supplierName || 'Unknown Party'})</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none group-hover:text-primary transition-colors">
                expand_more
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2 ml-1">
              Link-only: the invoice records this GRN as its source. The GRN's Purchase-Invoice status is not changed.
            </p>
          </div>
        )}

        {sourceType === 'IGP' && (
          <div className="w-full md:w-96">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">
              Select Inward Gate Pass
            </label>
            <div className="relative group">
              <select
                value={selectedDocId}
                onChange={(e) => { setSelectedDocId(e.target.value); setDiscounts({}); setCustomRates({}); }}
                className={selectClass}
              >
                <option value="">Choose an Inward Gate Pass...</option>
                {activeIgps.map(g => (
                  <option key={g.id} value={g.id}>{g.id} ({g.supplierName || 'Unknown Party'})</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none group-hover:text-primary transition-colors">
                expand_more
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2 ml-1">
              Link-only: the invoice records this Gate Pass as its source. The Gate Pass's Purchase-Invoice status is not changed.
            </p>
          </div>
        )}

        {sourceType === 'STANDALONE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">
                Select Department
              </label>
              <div className="relative group">
                <select
                  value={departmentId}
                  onChange={(e) => { setDepartmentId(e.target.value); setManualLines([newManualLine()]); setCustomRates({}); setDiscounts({}); }}
                  className={selectClass}
                >
                  <option value="">Choose a department...</option>
                  {departments.filter(d => !d.disabled).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none group-hover:text-primary transition-colors">
                  expand_more
                </span>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 ml-1">
                Select Customer
              </label>
              <div className="relative group">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Choose a customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none group-hover:text-primary transition-colors">
                  expand_more
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {formReady ? (
        <div className="space-y-8 animate-fade-in" id="invoice-canvas">
          {/* Party & Source Details */}
          {sourceType === 'DC' && selectedDc && (
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
          )}

          {(sourceType === 'GRN' || sourceType === 'IGP') && selectedDoc && (
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-surface-container-lowest p-6 rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] flex flex-col gap-4">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <span className="material-symbols-outlined">factory</span>
                  <h3 className="font-headline font-bold text-sm">Source Party (Supplier)</h3>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Party Name</p>
                  <p className="text-base font-semibold text-on-surface">{selectedDoc.supplierName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Party ID</p>
                  <p className="text-sm text-on-surface">{selectedDoc.supplierId || 'N/A'}</p>
                </div>
              </div>

              <div className="lg:col-span-1 bg-surface-container-lowest p-6 rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] flex flex-col gap-4">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <span className="material-symbols-outlined">contact_phone</span>
                  <h3 className="font-headline font-bold text-sm">Contact Details</h3>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Point of Contact</p>
                  <p className="text-sm text-on-surface">{selectedDoc.poc || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Phone</p>
                  <p className="text-sm text-on-surface">{selectedDoc.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Address</p>
                  <p className="text-xs text-on-surface-variant leading-tight">{selectedDoc.address || 'N/A'}</p>
                </div>
              </div>

              <div className="lg:col-span-1 bg-surface-container-lowest p-6 rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] flex flex-col gap-4">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <span className="material-symbols-outlined">description</span>
                  <h3 className="font-headline font-bold text-sm">Source Document</h3>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">{sourceType === 'GRN' ? 'GRN Number' : 'Gate Pass Number'}</p>
                  <p className="text-base font-semibold text-on-surface font-mono">{selectedDoc.id}</p>
                </div>
                <div className="flex gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Date</p>
                    <p className="text-sm text-on-surface">{selectedDoc.date || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">PO Ref</p>
                    <p className="text-sm text-on-surface">{selectedDoc.poId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Status</p>
                    <p className="text-sm text-on-surface">{selectedDoc.status || 'N/A'}</p>
                  </div>
                </div>
                {sourceType === 'IGP' && (
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Vehicle / Driver</p>
                    <p className="text-sm text-on-surface">{selectedDoc.driverName || 'N/A'} ({selectedDoc.vehicleNo || 'N/A'})</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {sourceType === 'STANDALONE' && selectedDepartment && selectedCustomer && (
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-surface-container-lowest p-6 rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] flex flex-col gap-4">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <span className="material-symbols-outlined">person_pin</span>
                  <h3 className="font-headline font-bold text-sm">Customer Details</h3>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Customer Name</p>
                  <p className="text-base font-semibold text-on-surface">{selectedCustomer.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Contact</p>
                  <p className="text-sm text-on-surface">{selectedCustomer.contactPerson || 'N/A'} {selectedCustomer.phone ? `(${selectedCustomer.phone})` : ''}</p>
                </div>
              </div>

              <div className="lg:col-span-1 bg-surface-container-lowest p-6 rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] flex flex-col gap-4">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <span className="material-symbols-outlined">location_on</span>
                  <h3 className="font-headline font-bold text-sm">Billing Address</h3>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {selectedCustomer.address || 'N/A'}
                </p>
              </div>

              <div className="lg:col-span-1 bg-surface-container-lowest p-6 rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] flex flex-col gap-4">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <span className="material-symbols-outlined">warehouse</span>
                  <h3 className="font-headline font-bold text-sm">Department</h3>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Selected Department</p>
                  <p className="text-base font-semibold text-on-surface">{selectedDepartment.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter mb-1">Items Available</p>
                  <p className="text-sm text-on-surface">{deptItems.length} items mapped to this department</p>
                </div>
              </div>
            </section>
          )}

          {/* Line Items Table */}
          <section className="bg-surface-container-lowest rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-container flex justify-between items-center bg-surface-container-low/30">
              <h3 className="font-headline font-bold text-on-surface">Line Items</h3>
              <span className="text-xs font-medium px-3 py-1 bg-surface-container text-on-secondary-container rounded-full">
                {sourceChip}
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
                  {sourceType === 'STANDALONE' ? (
                    manualLines.map((ml, idx) => {
                      // Stable-id lookup — rows without an item selected
                      // have no built line.
                      const line = ml.itemId ? itemsList.find(l => l.lineId === ml.id) : undefined;
                      const item = (state.items || []).find(i => i.id === ml.itemId);
                      return (
                        <tr key={ml.id} className="hover:bg-surface transition-colors">
                          {visibleColumns.sr && (
                            <td className="px-6 py-4 text-sm font-medium text-on-surface-variant">
                              {String(idx + 1).padStart(2, '0')}
                            </td>
                          )}
                          {visibleColumns.code && (
                            <td className="px-6 py-4 text-sm font-mono text-primary font-semibold">
                              {item ? item.sku : '—'}
                            </td>
                          )}
                          {visibleColumns.name && (
                            <td className="px-6 py-4 text-sm text-on-surface font-medium">
                              <select
                                value={ml.itemId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setManualLines(prev => prev.map((r, ri) => ri === idx ? { ...r, itemId: val } : r));
                                }}
                                className="w-full min-w-[220px] appearance-none bg-surface-container-low border border-outline-variant/30 rounded-lg px-3 py-2 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none cursor-pointer"
                              >
                                <option value="">Select an item...</option>
                                {deptItems.map(it => (
                                  <option key={it.id} value={it.id}>{it.sku} — {it.name}</option>
                                ))}
                              </select>
                            </td>
                          )}
                          {visibleColumns.uom && (
                            <td className="px-6 py-4 text-sm text-on-surface-variant">
                              {item ? (item.uom || 'Units') : '—'}
                            </td>
                          )}
                          {visibleColumns.qty && (
                            <td className="px-6 py-4 text-right">
                              <input
                                type="number"
                                value={ml.qty}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setManualLines(prev => prev.map((r, ri) => ri === idx ? { ...r, qty: val } : r));
                                }}
                                className="w-24 text-right bg-surface-container-low border border-outline-variant/30 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                min="0"
                              />
                            </td>
                          )}
                          {visibleColumns.price && (
                            <td className="px-6 py-4 text-right">
                              <input
                                type="number"
                                value={line ? line.unitPrice : 0}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  // customRates is keyed by the row's stable id.
                                  if (ml.itemId) setCustomRates(prev => ({ ...prev, [ml.id]: val }));
                                }}
                                className="w-28 text-right bg-surface-container-low border border-outline-variant/30 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                min="0"
                              />
                            </td>
                          )}
                          {visibleColumns.discount && (
                            <td className="px-6 py-4 text-right">
                              <input
                                type="number"
                                value={line ? line.discountPercent : 0}
                                onChange={(e) => {
                                  const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                                  if (ml.itemId) setDiscounts(prev => ({ ...prev, [ml.id]: val }));
                                }}
                                className="w-20 text-right bg-surface-container-low border border-outline-variant/30 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                min="0"
                                max="100"
                              />
                            </td>
                          )}
                          {visibleColumns.subtotal && (
                            <td className="px-6 py-4 text-sm text-on-surface font-bold text-right">
                              {line ? line.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                            </td>
                          )}
                          <td className="px-4 py-4 w-10 text-center">
                            <button
                              type="button"
                              onClick={() => setManualLines(prev => prev.filter((_, ri) => ri !== idx))}
                              className="p-1 text-on-surface-variant hover:text-red-700 hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                              title="Remove line"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    itemsList.map((item, idx) => (
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
                            {item.stockType && (
                              <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary font-bold text-[10px] rounded-md uppercase tracking-wide">{item.stockType}</span>
                            )}
                          </td>
                        )}
                        {visibleColumns.uom && (
                          <td className="px-6 py-4 text-sm text-on-surface-variant">
                            {item.uom || 'Units'}
                          </td>
                        )}
                        {visibleColumns.qty && (
                          <td className="px-6 py-4 text-sm text-on-surface font-bold text-right">
                            {(sourceType === 'DC'
                              ? (parseFloat(item.dispatchedQty || item.qty) || 0)
                              : (parseFloat(item.qty) || 0)).toLocaleString()}
                          </td>
                        )}
                        {visibleColumns.price && (
                          sourceType === 'DC' ? (
                            <td className="px-6 py-4 text-sm text-on-surface font-medium text-right">
                              {item.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                          ) : (
                            <td className="px-6 py-4 text-right">
                              <input
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setCustomRates(prev => ({ ...prev, [idx]: val }));
                                }}
                                className="w-28 text-right bg-surface-container-low border border-outline-variant/30 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                min="0"
                              />
                            </td>
                          )
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {sourceType === 'STANDALONE' && (
              <div className="px-6 py-4 border-t border-surface-container bg-surface-container-low/30">
                <button
                  type="button"
                  onClick={() => setManualLines(prev => [...prev, newManualLine()])}
                  className="flex items-center gap-1.5 px-4 py-2 bg-secondary-container text-on-secondary-container rounded-xl font-bold text-xs hover:opacity-90 transition-all shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Add Item
                </button>
              </div>
            )}
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
                  <span className="text-sm font-medium text-on-surface-variant flex items-center gap-2">
                    Sales Tax (17%)
                    <button
                      type="button"
                      onClick={() => setTaxApplied(prev => !prev)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${taxApplied ? 'bg-primary' : 'bg-outline-variant/50'}`}
                      role="switch"
                      aria-checked={taxApplied}
                      title="Toggle sales tax on this invoice (tax is optional per document)"
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${taxApplied ? 'translate-x-4' : 'translate-x-0.5'}`}></span>
                    </button>
                  </span>
                  <span className="text-sm font-bold text-on-surface">{taxApplied ? `${currencyCode} ${salesTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Not Applied'}</span>
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
                  disabled={!canGenerate}
                  className={`w-full bg-gradient-to-br from-primary to-primary-container text-on-primary py-4 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95 ${canGenerate ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                >
                  <span className="material-symbols-outlined">receipt</span>
                  Generate Sales Invoice
                </button>
                <button
                  onClick={handleSaveDraft}
                  disabled={!canGenerate}
                  className={`w-full bg-secondary-container text-on-secondary-container py-3.5 rounded-xl font-bold text-sm hover:bg-secondary-container/80 transition-all active:scale-95 ${canGenerate ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                >
                  Save Draft
                </button>
                {!canGenerate && formReady && (
                  <p className="text-[11px] text-on-surface-variant text-center">
                    Add at least one item with a quantity above zero to enable saving.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Source Empty State */
        <div className="min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-surface-container-low rounded-3xl border-2 border-dashed border-outline-variant/30" id="empty-state">
          <div className="w-20 h-20 bg-surface-container-highest rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl text-outline">description</span>
          </div>
          <h3 className="text-xl font-headline font-bold text-on-surface mb-2">
            {sourceType === 'DC' && 'No Delivery Challan Selected'}
            {sourceType === 'GRN' && 'No GRN Selected'}
            {sourceType === 'IGP' && 'No Inward Gate Pass Selected'}
            {sourceType === 'STANDALONE' && 'Select Department & Customer'}
          </h3>
          <p className="text-on-surface-variant max-w-sm mx-auto text-sm leading-relaxed">
            {sourceType === 'DC' && 'Please select a Delivery Challan from the dropdown menu above to populate the customer information and line items for this invoice.'}
            {sourceType === 'GRN' && 'Please select a GRN from the dropdown menu above to populate the party information and line items for this invoice.'}
            {sourceType === 'IGP' && 'Please select an Inward Gate Pass from the dropdown menu above to populate the party information and line items for this invoice.'}
            {sourceType === 'STANDALONE' && 'Please select a department and a customer above — the department\'s items will load so you can invoice any of them without a source document.'}
          </p>
        </div>
      )}
    </div>
  );
}
