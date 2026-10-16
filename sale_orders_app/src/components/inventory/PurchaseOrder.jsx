import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import GlobalPagination from '../ui/GlobalPagination';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

export default function PurchaseOrder() {
  const { state, setCollection } = useApp();
  const { appAlert, appConfirm } = useDialog();

  const [activeTab, setActiveTab] = useState('create');
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [pdId, setPdId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState([]);

  // Direct Item Add State (if no PD)
  const [selectedItemId, setSelectedItemId] = useState('');
  const [orderQty, setOrderQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const pendingDemands = useMemo(() => {
    return (state.purchaseDemands || []).filter(pd => pd.status === 'Pending');
  }, [state.purchaseDemands]);

  const rawMaterials = useMemo(() => {
    return state.items.filter(i => i.type !== 'Finish Good' && i.category !== 'Finished Goods');
  }, [state.items]);

  const handlePDSelection = (e) => {
    const selectedPdId = e.target.value;
    setPdId(selectedPdId);
    if (selectedPdId) {
      const pd = state.purchaseDemands.find(p => p.id === selectedPdId);
      if (pd) {
        setItems(pd.items.map(it => ({
          ...it,
          orderQty: it.reqQty,
          unitPrice: 0,
        })));
      }
    } else {
      setItems([]);
    }
  };

  const handleAddDirectItem = () => {
    if (!selectedItemId || !orderQty || orderQty <= 0) {
      appAlert('Please select an item and enter a valid quantity.');
      return;
    }
    const itemDef = state.items.find(i => i.id === selectedItemId);
    if (!itemDef) return;

    if (items.find(i => i.itemId === selectedItemId)) {
      appAlert('Item already added to order.');
      return;
    }

    setItems([...items, {
      itemId: itemDef.id,
      itemCode: itemDef.sku || itemDef.id,
      itemName: itemDef.name,
      uom: itemDef.uom,
      reqQty: 0,
      orderQty: parseFloat(orderQty),
      unitPrice: parseFloat(unitPrice) || 0
    }]);

    setSelectedItemId('');
    setOrderQty('');
    setUnitPrice('');
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = parseFloat(value) || 0;
    setItems(newItems);
  };

  const getNextPOId = () => {
    const pos = state.purchaseOrders || [];
    let max = 0;
    pos.forEach(po => {
      const parts = po.id.split('-');
      if (parts.length === 2 && !isNaN(parts[1])) {
        const num = parseInt(parts[1], 10);
        if (num > max) max = num;
      }
    });
    return `PO-${String(max + 1).padStart(3, '0')}`;
  };

  const handleSavePO = () => {
    if (!supplierId) {
      appAlert('Please select a supplier.');
      return;
    }
    if (items.length === 0) {
      appAlert('Please add at least one item to the order.');
      return;
    }

    const newPO = {
      id: getNextPOId(),
      date,
      supplierId,
      supplierName: state.suppliers.find(s => s.id === supplierId)?.name || '',
      pdId: pdId || null,
      expectedDate,
      remarks,
      items,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    setCollection('purchaseOrders', [newPO, ...(state.purchaseOrders || [])]);
    
    // If PD is referenced, update its status
    if (pdId) {
      const updatedPDs = state.purchaseDemands.map(pd => 
        pd.id === pdId ? { ...pd, status: 'Ordered' } : pd
      );
      setCollection('purchaseDemands', updatedPDs);
    }

    appAlert(`Purchase Order ${newPO.id} generated successfully!`, 'success');
    
    // Reset
    setDate(new Date().toISOString().split('T')[0]);
    setSupplierId('');
    setPdId('');
    setExpectedDate('');
    setRemarks('');
    setItems([]);
    setActiveTab('history');
  };

  const isPOLocked = (poId) => {
    const igps = state.inwardGatePasses || [];
    return igps.some(igp => igp.poId === poId);
  };

  const handleDeletePO = async (poId, linkedPdId) => {
    if (isPOLocked(poId)) {
      appAlert('This Purchase Order cannot be deleted because an Inward Gate Pass has already been generated against it.');
      return;
    }
    if (await appConfirm(`Are you sure you want to delete ${poId}?`)) {
      setCollection('purchaseOrders', (state.purchaseOrders || []).filter(po => po.id !== poId));
      
      if (linkedPdId) {
        const updatedPDs = state.purchaseDemands.map(pd => 
          pd.id === linkedPdId ? { ...pd, status: 'Pending' } : pd
        );
        setCollection('purchaseDemands', updatedPDs);
      }
      appAlert(`${poId} deleted successfully.`, 'info');
    }
  };

  const [printPOData, setPrintPOData] = useState(null);

  const handlePrintPO = (po) => {
    const rawItems = po.items || [];
    const items = rawItems.map((it, idx) => {
      const qty = Number(it.orderQty ?? it.quantity ?? it.qty ?? 0);
      const unitPrice = Number(it.unitPrice ?? it.price ?? 0);
      const taxRate = Number(it.tax ?? 0);
      const amount = qty * unitPrice * (1 + taxRate / 100);
      return {
        serial_no: idx + 1,
        item_code: it.itemCode || it.itemId || `RM-${idx + 1}`,
        item_name: it.itemName || it.name || it.itemCode || 'Material',
        qty,
        unit_price: unitPrice,
        tax: `${taxRate}%`,
        amount
      };
    });
    const subtotal = items.reduce((s, it) => s + (it.qty * it.unit_price), 0);
    const grandTotal = items.reduce((s, it) => s + it.amount, 0);
    setPrintPOData({
      ...po,
      id: po.id,
      header: {
        po_number: po.id,
        po_date: po.date || new Date().toISOString().split('T')[0],
        supplier_name: po.supplierName || 'Vendor / Supplier',
        payment_terms: po.paymentTerms || 'Net 30 Days',
        delivery_location: po.deliveryLocation || 'Central Warehouse Gate 2'
      },
      items,
      totals: {
        subtotal,
        taxAmount: grandTotal - subtotal,
        grandTotal
      }
    });
  };

  const pos = (state.purchaseOrders || []).filter(po => 
    po.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    po.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedPos = state?.isGlobalPaginated
      ? pos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      : pos;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-6">
          <div>
              <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase mb-1">
                  <span className="material-symbols-outlined text-sm">shopping_cart</span>
                  Procurement
              </div>
              <h2 className="text-3xl font-black text-on-surface">Purchase Order</h2>
          </div>
          <div className="flex gap-2 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/20">
              <button 
                  onClick={() => setActiveTab('create')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                  Create PO
              </button>
              <button 
                  onClick={() => setActiveTab('history')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                  History Logs
              </button>
          </div>
      </div>

      {activeTab === 'create' && (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-sm overflow-hidden flex flex-col flex-1">
            <div className="p-6 border-b border-outline-variant/10 grid grid-cols-1 md:grid-cols-4 gap-6 bg-surface/50">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">PO Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Supplier / Vendor</label>
                    <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary">
                        <option value="">-- Select Supplier --</option>
                        {state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ref Purchase Demand</label>
                    <select value={pdId} onChange={handlePDSelection} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary">
                        <option value="">Direct Order (No PD)</option>
                        {pendingDemands.map(pd => <option key={pd.id} value={pd.id}>{pd.id} - {pd.requestedBy}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Expected Delivery</label>
                    <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                </div>
            </div>

            {/* Add Item Section (only if not from PD) */}
            {!pdId && (
              <div className="p-6 bg-surface-container-low/30 border-b border-outline-variant/10">
                  <h4 className="text-sm font-bold text-on-surface mb-4">Add Direct Items</h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                      <div className="md:col-span-2 space-y-1.5">
                          <label className="text-xs font-semibold text-on-surface-variant">Select Raw Material / Other</label>
                          <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary">
                              <option value="">-- Select Item --</option>
                              {rawMaterials.map(rm => (
                                  <option key={rm.id} value={rm.id}>{rm.name} ({rm.sku})</option>
                              ))}
                          </select>
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-on-surface-variant">Order Qty</label>
                          <input type="number" min="0.01" step="0.01" value={orderQty} onChange={e => setOrderQty(e.target.value)} placeholder="0.00" className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-on-surface-variant">Unit Price</label>
                          <input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0.00" className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                      </div>
                      <button onClick={handleAddDirectItem} className="bg-secondary text-on-secondary rounded-xl px-6 py-2.5 text-sm font-bold flex items-center justify-center gap-2 hover:bg-secondary/90 transition-colors h-[42px] whitespace-nowrap">
                          <span className="material-symbols-outlined text-[18px]">add</span> Add
                      </button>
                  </div>
              </div>
            )}

            {/* Items Table */}
            <div className="flex-1 overflow-auto p-6">
                {items.length > 0 ? (
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                                <th className="pb-3 font-semibold">Item Code</th>
                                <th className="pb-3 font-semibold">Description</th>
                                <th className="pb-3 font-semibold">UOM</th>
                                {pdId && <th className="pb-3 font-semibold text-right">Req. Qty</th>}
                                <th className="pb-3 font-semibold text-right">Order Qty</th>
                                <th className="pb-3 font-semibold text-right">Unit Price</th>
                                <th className="pb-3 font-semibold text-right">Total Amount</th>
                                <th className="pb-3 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                            {items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-surface-container-low/50">
                                    <td className="py-3 text-on-surface font-medium">{it.itemCode}</td>
                                    <td className="py-3 text-on-surface">{it.itemName}</td>
                                    <td className="py-3 text-on-surface-variant">{it.uom}</td>
                                    {pdId && <td className="py-3 text-on-surface-variant text-right">{it.reqQty}</td>}
                                    <td className="py-3 text-right">
                                        <input 
                                          type="number" 
                                          value={it.orderQty} 
                                          onChange={(e) => handleItemChange(idx, 'orderQty', e.target.value)}
                                          className="w-24 text-right bg-surface border border-outline-variant/30 rounded px-2 py-1 focus:ring-1 focus:ring-primary"
                                        />
                                    </td>
                                    <td className="py-3 text-right">
                                        <input 
                                          type="number" 
                                          value={it.unitPrice} 
                                          onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                                          className="w-24 text-right bg-surface border border-outline-variant/30 rounded px-2 py-1 focus:ring-1 focus:ring-primary"
                                        />
                                    </td>
                                    <td className="py-3 text-on-surface font-bold text-right">
                                        {(it.orderQty * it.unitPrice).toFixed(2)}
                                    </td>
                                    <td className="py-3 text-right">
                                        <button onClick={() => handleRemoveItem(idx)} className="text-error hover:bg-error/10 p-1.5 rounded-lg transition-colors">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-outline-variant/30">
                                <td colSpan={pdId ? "6" : "5"} className="py-4 text-right font-bold text-on-surface">Total Order Value:</td>
                                <td className="py-4 text-right font-black text-primary text-lg">
                                    {items.reduce((sum, it) => sum + (it.orderQty * it.unitPrice), 0).toFixed(2)}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-60 py-10">
                        <span className="material-symbols-outlined text-4xl mb-2">shopping_basket</span>
                        <p>No items in order. Select a PD or add items directly.</p>
                    </div>
                )}
            </div>

            <div className="p-6 border-t border-outline-variant/10 flex justify-between items-center bg-surface-container-lowest/50">
                <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Terms & Conditions / Remarks" className="w-1/2 bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                <button onClick={handleSavePO} className="bg-primary text-on-primary rounded-xl px-8 py-3 font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-sm hover:shadow">
                    <span className="material-symbols-outlined text-[20px]">save</span>
                    Generate Purchase Order
                </button>
            </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-sm flex flex-col flex-1 overflow-hidden">
            <div className="p-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface/50">
                <div className="relative w-72">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                    <input 
                        type="text" 
                        placeholder="Search PO Number or Supplier..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant/30 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="sticky top-0 bg-surface-container-low/90 backdrop-blur z-10 border-b border-outline-variant/30 text-on-surface-variant">
                        <tr>
                            <th className="px-6 py-4 font-semibold">PO Number</th>
                            <th className="px-6 py-4 font-semibold">Date</th>
                            <th className="px-6 py-4 font-semibold">Supplier</th>
                            <th className="px-6 py-4 font-semibold">Ref PD</th>
                            <th className="px-6 py-4 font-semibold text-right">Value</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                        {displayedPos.map((po) => {
                            const locked = isPOLocked(po.id);
                            return (
                                <tr key={po.id} className="hover:bg-surface-container-low/30 transition-colors">
                                    <td className="px-6 py-4 text-primary font-bold">{po.id}</td>
                                    <td className="px-6 py-4 text-on-surface">{po.date}</td>
                                    <td className="px-6 py-4 text-on-surface font-medium">{po.supplierName}</td>
                                    <td className="px-6 py-4 text-on-surface-variant">{po.pdId || '-'}</td>
                                    <td className="px-6 py-4 text-on-surface font-bold text-right">
                                        {po.items.reduce((s, it) => s + (it.orderQty * it.unitPrice), 0).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${po.status === 'Received' ? 'bg-tertiary/10 text-tertiary border-tertiary/20' : 'bg-surface-container-highest text-on-surface border-outline-variant/30'}`}>
                                            {po.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handlePrintPO(po)} className="p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors" title="Print">
                                                <span className="material-symbols-outlined text-[18px]">print</span>
                                            </button>
                                            <button 
                                                onClick={() => handleDeletePO(po.id, po.pdId)} 
                                                disabled={locked}
                                                className={`p-1.5 rounded-lg border transition-colors ${locked ? 'border-outline-variant/10 text-on-surface-variant/30 cursor-not-allowed' : 'border-error/30 text-error hover:bg-error hover:text-white'}`} 
                                                title={locked ? "Locked: IGP exists" : "Delete"}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">{locked ? 'lock' : 'delete'}</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {pos.length === 0 && (
                            <tr>
                                <td colSpan="7" className="text-center py-10 text-on-surface-variant">No Purchase Orders found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <GlobalPagination 
                totalItems={pos.length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
            />
        </div>
      )}

      {printPOData && (
        <UniversalPrintPreviewModal
          isOpen={Boolean(printPOData)}
          onClose={() => setPrintPOData(null)}
          documentType="purchase_order"
          documentData={printPOData}
          documentTitle={`Purchase Order ${printPOData.id}`}
        />
      )}
    </div>
  );
}
