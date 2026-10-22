import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import ResizableHeader from '../ui/ResizableHeader';
import PrintLayout from '../ui/PrintLayout';

export default function DelCreationSlip({ items = [], dcMode = 'Sale Orders', onBack, onFinalize }) {
  const { state, addDelivery } = useApp();
  const { appAlert, appConfirm } = useDialog();
  const isManual = dcMode !== 'Sale Orders';
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';

  // Generate an ID for the new Challan
  const challanId = useMemo(() => {
      const prefix = isManual ? 'MDC' : 'DC';
      const existingCount = (state?.deliveries || []).filter(d => d.id.startsWith(prefix)).length;
      return `${prefix}-${String(existingCount + 1).padStart(3, '0')}`;
  }, [isManual, state?.deliveries]);

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // State for slip items
  const [slipItems, setSlipItems] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [newItemId, setNewItemId] = useState('');
  const [consigneeDetails, setConsigneeDetails] = useState({ contactPerson: '', deliveryAddress: '', contactNumber: '' });
  const [logisticsDetails, setLogisticsDetails] = useState({ driverName: '', driverNumber: '', vehicleNumber: '' });
  const [showErrors, setShowErrors] = useState(false);

  const getAvailableTypes = (itemId) => {
      const product = state?.items?.find(x => x.id === itemId || x.sku === itemId);
      if (!product || !product.stockByType) return state?.settings?.outputTypes || ['Fresh'];
      const available = Object.keys(product.stockByType).filter(t => parseFloat(product.stockByType[t]) > 0);
      return available.length > 0 ? available : (state?.settings?.outputTypes || ['Fresh']);
  };

  const outputTypes = useMemo(() => {
      return state?.settings?.outputTypes || ['Fresh', 'A', 'A2', 'B'];
  }, [state?.settings?.outputTypes]);

  useEffect(() => {
      if (!isManual) {
          setSlipItems(items.map(i => {
              const product = state?.items?.find(x => x.id === i.itemId || x.sku === i.itemCode);
              const rSize = parseFloat(product?.packingStandard) || 50;
              const eq = parseFloat(i.readyQty || 0);
              const availTypes = getAvailableTypes(i.itemId || i.itemCode);
              return {
                  ...i,
                  rolls: (eq > 0 && eq < rSize) ? 1 : (rSize > 0 ? (eq / rSize).toFixed(1) : 0),
                  type: i.stockType || availTypes[0], // Preserve the passed output type
                  editedQty: eq,
                  rollSize: rSize
              };
          }));
      }
  }, [items, isManual, state?.items]);

  // Handle additions
  const handleAddDraftRow = () => {
      setSlipItems(prev => [...prev, {
          uniqueId: `draft-${Date.now()}`,
          isDraft: true,
          itemId: '',
          itemCode: '',
          productName: '',
          category: 'Finished Goods',
          price: 0,
          editedQty: 0,
          rolls: 0,
          type: '',
          rollSize: 50,
          draftSearchText: ''
      }]);
  };

  const handleDuplicateRow = (index) => {
      const src = slipItems[index];
      if (src.isDraft) return;
      const newItems = [...slipItems];
      newItems.splice(index + 1, 0, {
          ...src,
          uniqueId: `duplicate-${Date.now()}`,
          editedQty: 0,
          rolls: 0,
          type: src.type, // Exact same type
      });
      setSlipItems(newItems);
  };

  const handleDraftItemSelect = (index, payload) => {
      setSlipItems(prev => {
          const newItems = [...prev];
          const availTypes = getAvailableTypes(payload.id || payload.itemId);
          newItems[index] = {
              ...newItems[index],
              isDraft: false,
              itemId: payload.id || payload.itemId,
              itemCode: payload.sku || payload.itemCode,
              productName: payload.name || payload.productName,
              category: payload.category,
              price: payload.price || 0,
              rollSize: parseFloat(payload.packingStandard || payload.rollSize) || 50,
              type: availTypes[0],
              orderId: payload.orderId || '',
              readyQty: payload.readyQty || 0
          };
          return newItems;
      });
  };

  const handleRemoveItem = (index) => {
      setSlipItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
      setSlipItems(prev => {
          const newItems = [...prev];
          const item = { ...newItems[index] };
          
          if (field === 'rolls') {
              const rolls = parseFloat(value) || 0;
              item.rolls = value; // Keep as string for input editing, calculate numeric internally
              item.editedQty = rolls * item.rollSize;
          } else if (field === 'editedQty') {
              const qty = parseFloat(value) || 0;
              item.editedQty = value; // Keep as string for input
              if (qty > 0 && qty < item.rollSize) {
                  item.rolls = 1;
              } else {
                  item.rolls = qty / item.rollSize;
              }
          } else if (field === 'draftSearchText') {
              item.draftSearchText = value;
          } else {
              item[field] = value;
          }
          
          newItems[index] = item;
          return newItems;
      });
  };

  // Get customer name
  const customerName = isManual ? (state.customers.find(c => c.id === selectedCustomer)?.name || 'Unknown Customer') : (items.length > 0 ? items[0].customerEntity : 'Various Customers');

  // Calculate totals
  const totals = useMemo(() => {
      let sub = 0;
      slipItems.forEach(i => {
          if (!i.isDraft) {
              sub += (parseFloat(i.editedQty) || 0) * (parseFloat(i.price) || 0);
          }
      });
      return { sub, grand: sub };
  }, [slipItems]);

  const handleBackWarning = async () => {
      if (slipItems.length > 0) {
          const confirmLeave = await appConfirm("You have unsaved changes. Are you sure you want to leave? All entered data will be lost.");
          if (!confirmLeave) return;
      }
      onBack();
  };

  const handleFinalize = () => {
      if (slipItems.length === 0 || slipItems.some(i => i.isDraft)) {
          appAlert('Please complete or remove all draft items before saving.');
          return;
      }
      if (slipItems.some(i => parseFloat(i.editedQty) <= 0)) {
          appAlert('Quantity must be greater than zero for all items.');
          return;
      }

      // Validation for quantity in sale orders
      if (!isManual) {
          const sums = {};
          for (let item of slipItems) {
              const key = item.itemId || item.itemCode;
              sums[key] = (sums[key] || 0) + parseFloat(item.editedQty);
              if (item.readyQty !== undefined && sums[key] > item.readyQty) {
                  appAlert(`Quantity for item ${item.productName || item.itemCode} exceeds available ready quantity (${item.readyQty}).`);
                  return;
              }
          }
      }

      if (isManual && !selectedCustomer) {
          appAlert('Please select a customer for manual delivery.');
          return;
      }
      if (!consigneeDetails.contactPerson || !consigneeDetails.deliveryAddress || !consigneeDetails.contactNumber) {
          setShowErrors(true);
          appAlert('Please fill out all mandatory Consignee Details.');
          return;
      }
      if (!logisticsDetails.driverName || !logisticsDetails.driverNumber || !logisticsDetails.vehicleNumber) {
          setShowErrors(true);
          appAlert('Please fill all logistics details (Driver Name, Driver Number, Vehicle Number).');
          return;
      }

      const deliveryRecord = {
          id: challanId,
          date: new Date().toISOString(),
          customerName: customerName,
          customerId: isManual ? selectedCustomer : (items.length > 0 ? items[0].customerId : null),
          consignee: consigneeDetails,
          logistics: logisticsDetails,
          status: 'Dispatched',
          dcMode: dcMode,
          items: slipItems.map(i => ({
              ...i,
              dispatchedQty: parseFloat(i.editedQty) || 0,
              dispatchedRolls: parseFloat(i.rolls) || 0,
              stockType: i.type
          })),
          totals
      };
      if (addDelivery) addDelivery(deliveryRecord);
      if (onFinalize) onFinalize();
  };

  return (
    <div className="flex-1 animate-in fade-in duration-500 pb-24">
      {/* Breadcrumbs & Header Mode */}
      <div className="flex justify-between items-end mb-6 w-full">
        <div className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
          <button onClick={handleBackWarning} className="hover:text-primary transition-colors flex items-center">
            <span className="material-symbols-outlined text-sm mr-1" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
            Orders
          </button>
          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 0" }}>chevron_right</span>
          <button onClick={handleBackWarning} className="hover:text-primary transition-colors">Delivery Selection</button>
          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 0" }}>chevron_right</span>
          <span className="text-primary font-bold">{challanId}</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Dispatch Mode</span>
            <span className="text-sm font-bold text-primary">{dcMode}</span>
          </div>
          <div className="h-8 w-px bg-outline-variant/30 hidden sm:block"></div>
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Warehouse</span>
            <span className="text-sm font-bold text-on-surface">{isManual ? dcMode : 'Default Godown'}</span>
          </div>
        </div>
      </div>

      {/* Main Document Container */}
      <div className="w-full flex flex-col gap-8">
        
        {/* Action Toolbar Overlay */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-lowest p-6 rounded-xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] sticky top-0 z-30 border border-outline-variant/10">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">{isManual ? 'Manual Dispatch' : 'Current Transaction'}</span>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black font-headline text-primary">{challanId}</span>
              <span className="px-3 py-1 bg-surface-container-high rounded text-xs font-bold text-on-surface">{today}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 text-primary font-semibold text-sm hover:bg-surface-container transition-colors rounded-xl outline-none focus:ring-2 focus:ring-primary/20">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>print</span>
              Print Challan
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 text-secondary font-semibold text-sm bg-secondary-container hover:bg-secondary-container/80 transition-colors rounded-xl outline-none focus:ring-2 focus:ring-secondary/20">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>picture_as_pdf</span>
              Save as PDF
            </button>
            <button onClick={handleFinalize} className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all rounded-xl outline-none">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>check_circle</span>
              Finalize Dispatch
            </button>
          </div>
        </div>

        {/* Bento Grid Layout for Details */}
        <div className="grid grid-cols-12 gap-6">
          {/* Section 1: Header Details */}
          <div className="col-span-12 md:col-span-7 bg-surface-container-low p-8 rounded-xl flex flex-col gap-6">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface mb-2">Consignee Details</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Customer Name <span className="text-error">*</span></label>
                {isManual ? (
                    <div className="relative">
                        <select 
                            value={selectedCustomer}
                            onChange={(e) => setSelectedCustomer(e.target.value)}
                            className="w-full p-3 pl-4 pr-10 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-sm font-bold text-on-surface appearance-none focus:ring-2 focus:ring-primary/30 outline-none transition-shadow cursor-pointer"
                        >
                            <option value="">Select Customer...</option>
                            {state?.customers?.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
                    </div>
                ) : (
                    <div className="p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-xl text-sm font-bold text-on-surface">
                        {customerName}
                    </div>
                )}
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Contact Person</label>
                <input 
                  type="text"
                  placeholder="e.g. Ali Raza"
                  value={consigneeDetails.contactPerson}
                  onChange={(e) => {
                      setConsigneeDetails(p => ({...p, contactPerson: e.target.value}));
                      if (showErrors) setShowErrors(false);
                  }}
                  className={`p-3 bg-surface-container-lowest border ${showErrors && !consigneeDetails.contactPerson ? 'border-error focus:ring-error ring-1 ring-error' : 'border-outline-variant/30 focus:ring-primary/30'} rounded-xl text-sm font-medium text-on-surface focus:ring-2 outline-none transition-shadow`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Contact Number <span className="text-error">*</span></label>
                <input 
                  type="tel"
                  placeholder="0300-1234567"
                  value={consigneeDetails.contactNumber}
                  onChange={(e) => {
                      setConsigneeDetails(p => ({...p, contactNumber: e.target.value}));
                      if (showErrors) setShowErrors(false);
                  }}
                  className={`p-3 bg-surface-container-lowest border ${showErrors && !consigneeDetails.contactNumber ? 'border-error focus:ring-error ring-1 ring-error' : 'border-outline-variant/30 focus:ring-primary/30'} rounded-xl text-sm font-medium text-on-surface focus:ring-2 outline-none transition-shadow`}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Delivery Address</label>
                <input 
                  type="text"
                  placeholder="Enter complete shipping address"
                  value={consigneeDetails.deliveryAddress}
                  onChange={(e) => {
                      setConsigneeDetails(p => ({...p, deliveryAddress: e.target.value}));
                      if (showErrors) setShowErrors(false);
                  }}
                  className={`p-3 bg-surface-container-lowest border ${showErrors && !consigneeDetails.deliveryAddress ? 'border-error focus:ring-error ring-1 ring-error' : 'border-outline-variant/30 focus:ring-primary/30'} rounded-xl text-sm font-medium text-on-surface focus:ring-2 outline-none transition-shadow`}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Logistics & Tracking */}
          <div className="col-span-12 md:col-span-5 bg-primary text-on-primary p-8 rounded-xl flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10 w-full">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-fixed/60 mb-6">Logistics Section</h2>
              <div className="flex flex-col gap-5 w-full">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-primary-fixed/60 uppercase tracking-wider">Vehicle Number <span className="text-error-container">*</span></label>
                  <input 
                    type="text"
                    placeholder="e.g. LXZ-1234"
                    value={logisticsDetails.vehicleNumber}
                    onChange={(e) => {
                        setLogisticsDetails(p => ({...p, vehicleNumber: e.target.value}));
                        if (showErrors) setShowErrors(false);
                    }}
                    className={`p-3 bg-white/10 border ${showErrors && !logisticsDetails.vehicleNumber ? 'border-red-400 focus:ring-red-400 ring-1 ring-red-400' : 'border-white/20 focus:ring-white/40'} rounded-xl text-sm font-bold text-white placeholder-white/30 focus:bg-white/20 focus:ring-2 outline-none transition-all`}
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-primary-fixed/60 uppercase tracking-wider">Driver Name <span className="text-error-container">*</span></label>
                  <input 
                    type="text"
                    placeholder="e.g. Muhammad Ahmad"
                    value={logisticsDetails.driverName}
                    onChange={(e) => {
                        setLogisticsDetails(p => ({...p, driverName: e.target.value}));
                        if (showErrors) setShowErrors(false);
                    }}
                    className={`p-3 bg-white/10 border ${showErrors && !logisticsDetails.driverName ? 'border-red-400 focus:ring-red-400 ring-1 ring-red-400' : 'border-white/20 focus:ring-white/40'} rounded-xl text-sm font-bold text-white placeholder-white/30 focus:bg-white/20 focus:ring-2 outline-none transition-all`}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-primary-fixed/60 uppercase tracking-wider">Driver Contact <span className="text-error-container">*</span></label>
                  <input 
                    type="tel"
                    placeholder="0300-1234567"
                    value={logisticsDetails.driverNumber}
                    onChange={(e) => {
                        setLogisticsDetails(p => ({...p, driverNumber: e.target.value}));
                        if (showErrors) setShowErrors(false);
                    }}
                    className={`p-3 bg-white/10 border ${showErrors && !logisticsDetails.driverNumber ? 'border-red-400 focus:ring-red-400 ring-1 ring-red-400' : 'border-white/20 focus:ring-white/40'} rounded-xl text-sm font-bold text-white placeholder-white/30 focus:bg-white/20 focus:ring-2 outline-none transition-all`}
                  />
                </div>
              </div>
            </div>
            <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-primary-container rounded-full opacity-10 blur-3xl"></div>
          </div>

          {/* Section 3: Main Item Table */}
          <div className="col-span-12 bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-outline-variant/10">
            <div className="p-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
                <h3 className="font-bold text-on-surface">Order Line Items</h3>
                <button 
                    onClick={handleAddDraftRow}
                    className="px-4 py-2 bg-primary text-on-primary font-bold text-sm rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 0" }}>add_circle</span>
                    Add Line
                </button>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-surface-container text-left border-b border-outline-variant/10">
                    <ResizableHeader className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-on-surface-variant w-1">Item ID</ResizableHeader>
                    <ResizableHeader className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-on-surface-variant min-w-[200px]">Item Name</ResizableHeader>
                    <ResizableHeader className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-on-surface-variant w-32">Type</ResizableHeader>
                    <ResizableHeader className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-on-surface-variant w-32">Qty (Mtrs)</ResizableHeader>
                    <ResizableHeader className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-on-surface-variant w-28">Rolls</ResizableHeader>
                    <ResizableHeader className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-on-surface-variant w-28">Packing</ResizableHeader>
                    <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-on-surface-variant w-1">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {slipItems.length === 0 ? (
                      <tr><td colSpan="7" className="py-12 text-center text-on-surface-variant">No items in challan</td></tr>
                  ) : (
                      slipItems.map((item, idx) => {
                          if (item.isDraft) {
                              let searchOptions = [];
                              if (isManual) {
                                  searchOptions = state?.items?.filter(i => i.category === 'Finished Goods' && (i.name.toLowerCase().includes((item.draftSearchText||'').toLowerCase()) || i.sku.toLowerCase().includes((item.draftSearchText||'').toLowerCase()))) || [];
                              } else {
                                  const cId = slipItems.find(i => !i.isDraft)?.customerId || items[0]?.customerId;
                                  if (cId) {
                                      state?.saleOrders?.filter(o => o.customerId === cId && o.status !== 'Completed' && o.status !== 'Cancelled').forEach(order => {
                                          order.items.forEach(oi => {
                                              const readyQty = (parseFloat(oi.producedQty||0) - (parseFloat(oi.deliveredQty||0) + parseFloat(oi.dispatchedQty||0)));
                                              if (readyQty > 0) {
                                                  const pName = oi.productName || oi.itemCode;
                                                  if (pName.toLowerCase().includes((item.draftSearchText||'').toLowerCase())) {
                                                      const product = state?.items?.find(x => x.id === oi.itemId || x.sku === oi.itemCode) || {};
                                                      searchOptions.push({
                                                          ...product,
                                                          ...oi,
                                                          orderId: order.id,
                                                          readyQty: readyQty
                                                      });
                                                  }
                                              }
                                          });
                                      });
                                  }
                              }

                              return (
                                  <tr key={item.uniqueId || idx} className="hover:bg-surface-container-low/50 transition-colors group">
                                      <td className="py-3 px-6 font-mono text-xs text-on-surface-variant text-center">--</td>
                                      <td className="py-3 px-6 relative" colSpan="5">
                                          <input 
                                              type="text" 
                                              placeholder={isManual ? "Search FG Name or SKU..." : "Search pending items for this customer..."}
                                              value={item.draftSearchText || ''}
                                              onChange={(e) => handleItemChange(idx, 'draftSearchText', e.target.value)}
                                              className="w-full max-w-md p-2.5 bg-surface-container-lowest border border-primary/50 rounded-lg focus:ring-2 focus:ring-primary/30 text-sm font-bold text-on-surface outline-none transition-shadow"
                                              autoFocus
                                          />
                                          {item.draftSearchText && (
                                              <div className="absolute top-14 left-6 w-full max-w-md bg-white border border-outline-variant/30 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                                                  {searchOptions.length === 0 ? (
                                                      <div className="p-4 text-sm text-on-surface-variant text-center">No items found</div>
                                                  ) : (
                                                      searchOptions.map((p, pIdx) => (
                                                          <div 
                                                              key={p.id || p.itemCode || pIdx} 
                                                              className="p-3 hover:bg-surface-container-low cursor-pointer border-b border-outline-variant/10 last:border-0"
                                                              onClick={() => handleDraftItemSelect(idx, p)}
                                                          >
                                                              <div className="font-bold text-sm text-on-surface">{p.name || p.productName || p.itemCode}</div>
                                                              <div className="flex gap-4 text-xs font-bold text-on-surface-variant mt-1">
                                                                  <span className="bg-surface-container px-2 py-0.5 rounded">{p.sku || p.itemCode}</span>
                                                                  {!isManual && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">{p.orderId} (Ready: {p.readyQty})</span>}
                                                              </div>
                                                          </div>
                                                      ))
                                                  )}
                                              </div>
                                          )}
                                      </td>
                                      <td className="py-3 px-6 text-center">
                                          <button onClick={() => handleRemoveItem(idx)} className="text-error hover:bg-error-container p-2 rounded-lg transition-colors outline-none" title="Remove row">
                                              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 0" }}>delete</span>
                                          </button>
                                      </td>
                                  </tr>
                              );
                          }

                          const isLoose = parseFloat(item.editedQty) < item.rollSize;
                          const availTypes = getAvailableTypes(item.itemId || item.itemCode);

                          return (
                          <tr key={item.uniqueId || idx} className="hover:bg-surface-container-low/50 transition-colors group relative">
                            <td className="py-3 px-6 font-mono text-xs text-on-surface-variant">{item.itemCode || item.itemId}</td>
                            <td className="py-3 px-6">
                              <p className="font-bold text-sm text-on-surface">{item.productName || item.itemCode}</p>
                              {!isManual && <p className="text-xs text-on-surface-variant">Order: {item.orderId}</p>}
                            </td>
                            <td className="py-3 px-6">
                                {isManual ? (
                                    <div className="relative">
                                        <select 
                                            value={item.type}
                                            onChange={(e) => handleItemChange(idx, 'type', e.target.value)}
                                            className="w-full p-2.5 pr-8 bg-surface-container-lowest border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/30 text-xs font-bold text-primary outline-none appearance-none cursor-pointer transition-shadow"
                                        >
                                            {availTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-primary pointer-events-none text-sm">expand_more</span>
                                    </div>
                                ) : (
                                    <span className="px-3 py-1.5 bg-surface-container-low text-primary font-bold text-xs rounded-lg border border-outline-variant/20 inline-block">
                                        {item.type || 'Fresh'}
                                    </span>
                                )}
                            </td>
                            <td className="py-3 px-6">
                                <input 
                                    type="number" 
                                    value={item.editedQty}
                                    onChange={(e) => handleItemChange(idx, 'editedQty', e.target.value)}
                                    className="w-full p-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/30 text-sm font-bold text-on-surface outline-none transition-shadow"
                                    min="0"
                                />
                            </td>
                            <td className="py-3 px-6">
                                <input 
                                    type="number" 
                                    value={item.rolls}
                                    onChange={(e) => handleItemChange(idx, 'rolls', e.target.value)}
                                    className="w-full p-2.5 bg-surface-container-lowest border border-outline-variant/30 rounded-lg focus:ring-2 focus:ring-primary/30 text-sm font-bold text-on-surface outline-none transition-shadow"
                                    min="0"
                                />
                            </td>
                            <td className="py-3 px-6">
                                <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${isLoose ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                                    {isLoose ? 'Loose' : 'Standard'}
                                </span>
                            </td>
                            <td className="py-3 px-6 text-center">
                                <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => handleDuplicateRow(idx)} className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors outline-none opacity-0 group-hover:opacity-100 focus:opacity-100" title="Duplicate row for loose quantities">
                                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 0" }}>add_box</span>
                                    </button>
                                    <button onClick={() => handleRemoveItem(idx)} className="text-error hover:bg-error-container p-1.5 rounded-lg transition-colors outline-none opacity-0 group-hover:opacity-100 focus:opacity-100" title="Remove item">
                                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 0" }}>delete</span>
                                    </button>
                                </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Totals Section */}
            <div className="p-6 bg-surface-container flex flex-col items-end gap-2 border-t border-outline-variant/10">
                <div className="flex justify-between w-64 text-sm">
                    <span className="text-on-surface-variant font-medium">Subtotal</span>
                    <span className="font-bold">{currencyCode} {totals.sub.toFixed(2)}</span>
                </div>
                <div className="h-px w-64 bg-outline-variant/30 my-1"></div>
                <div className="flex justify-between w-64 text-lg">
                    <span className="text-on-surface font-black">Grand Total</span>
                    <span className="font-black text-primary">{currencyCode} {totals.grand.toFixed(2)}</span>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRINT ONLY UI */}
      {(() => {
          const dcSettings = state?.adminSetup?.printSettings?.moduleSettings?.delivery_challan || {};
          const rowSize = dcSettings.rowSize || 'normal';
          const cellPadding = rowSize === 'compact' ? 'py-1 px-2' : rowSize === 'spacious' ? 'py-4 px-4' : 'py-2 px-3';
          const currencyCode = state?.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';
          
          let colWidths = [];
          if (dcSettings.columnWidths) {
              colWidths = dcSettings.columnWidths.split(',').map(s => s.trim());
          }

          // Chunking
          const maxRows = parseInt(dcSettings.maxRows || '10', 10);
          const printChunks = [];
          const printItems = slipItems.filter(i => !i.isDraft); // exclude draft rows
          for (let i = 0; i < printItems.length; i += maxRows) {
              printChunks.push(printItems.slice(i, i + maxRows));
          }

          if (printChunks.length === 0) printChunks.push([]);

          return (
              <div className="hidden print:block w-full">
                  {printChunks.map((chunk, pageIndex) => (
                      <div key={pageIndex} className="print:break-after-page">
                          <PrintLayout 
                              documentTitle="Delivery Challan (Draft)"
                              documentId={challanId}
                              date={new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                              disclaimerKey="delivery"
                              extraMeta={[
                                  { label: 'Customer', value: customerName || 'N/A' },
                                  { label: 'DC Mode', value: dcMode || 'Sale Orders' },
                                  { label: 'Contact', value: consigneeDetails?.contactNumber || 'N/A' }
                              ]}
                              pagination={printChunks.length > 1 ? { current: pageIndex + 1, total: printChunks.length } : null}
                          >
                              <div className="border border-gray-300 mt-4 text-sm text-gray-800">
                                  <table className="w-full text-left border-collapse">
                                      <thead>
                                          <tr className="bg-gray-100">
                                              <th className="py-2 px-3 text-[11px] font-black uppercase border border-gray-300" style={{ width: colWidths[0] || '15%' }}>Item Code</th>
                                              <th className="py-2 px-3 text-[11px] font-black uppercase border border-gray-300" style={{ width: colWidths[1] || 'auto' }}>Product Name</th>
                                              <th className="py-2 px-3 text-[11px] font-black uppercase border border-gray-300 text-center" style={{ width: colWidths[2] || '12%' }}>Type</th>
                                              <th className="py-2 px-3 text-[11px] font-black uppercase border border-gray-300 text-right" style={{ width: colWidths[3] || '15%' }}>Rolls/Qty</th>
                                              <th className="py-2 px-3 text-[11px] font-black uppercase border border-gray-300 text-right" style={{ width: colWidths[4] || '15%' }}>Total (m)</th>
                                          </tr>
                                      </thead>
                                      <tbody>
                                          {chunk.map((it, iIdx) => (
                                              <tr key={iIdx}>
                                                  <td className={`${cellPadding} text-[11px] font-mono border border-gray-300`}>{it.itemCode || it.itemId}</td>
                                                  <td className={`${cellPadding} text-[11px] border border-gray-300 font-bold`}>{it.productName || it.itemCode}</td>
                                                  <td className={`${cellPadding} text-[11px] border border-gray-300 text-center`}>{it.stockType || it.type || 'Fresh'}</td>
                                                  <td className={`${cellPadding} text-[11px] border border-gray-300 text-right`}>{it.dispatchedRolls || it.rolls || 0}</td>
                                                  <td className={`${cellPadding} text-[11px] font-bold border border-gray-300 text-right`}>{it.dispatchedQty || it.editedQty || 0}</td>
                                              </tr>
                                          ))}
                                          {chunk.length === 0 && (
                                              <tr>
                                                  <td colSpan="5" className="py-6 text-center text-gray-500">No items in this challan</td>
                                              </tr>
                                          )}
                                      </tbody>
                                  </table>
                                  
                                  {pageIndex === printChunks.length - 1 && (
                                      <>
                                        <div className="flex bg-gray-50 border-t border-gray-300">
                                            <div className="flex-1 p-4 border-r border-gray-300">
                                                <h4 className="text-[10px] font-black uppercase mb-1">Consignee Address</h4>
                                                <p className="text-xs">{consigneeDetails?.deliveryAddress || 'N/A'}</p>
                                            </div>
                                            <div className="flex-1 p-4 border-r border-gray-300">
                                                <h4 className="text-[10px] font-black uppercase mb-1">Logistics Info</h4>
                                                <p className="text-xs">Driver: {logisticsDetails?.driverName || 'N/A'} ({logisticsDetails?.driverNumber || 'N/A'})</p>
                                                <p className="text-xs">Vehicle: {logisticsDetails?.vehicleNumber || 'N/A'}</p>
                                            </div>
                                            <div className="w-1/3 p-4 flex flex-col justify-end text-right">
                                                <div className="flex justify-between font-black text-sm">
                                                    <span>Grand Total ({currencyCode})</span>
                                                    <span>{totals.grand.toFixed(2) || '0.00'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 flex justify-between items-end border-t border-gray-300 mt-12 pt-16">
                                            <div className="border-t border-black w-48 text-center text-[10px] font-black uppercase">Prepared By</div>
                                            <div className="border-t border-black w-48 text-center text-[10px] font-black uppercase">Driver Signature</div>
                                            <div className="border-t border-black w-48 text-center text-[10px] font-black uppercase">Receiver Signature</div>
                                        </div>
                                      </>
                                  )}
                              </div>
                          </PrintLayout>
                      </div>
                  ))}
              </div>
          );
      })()}
    </div>
  );
}
