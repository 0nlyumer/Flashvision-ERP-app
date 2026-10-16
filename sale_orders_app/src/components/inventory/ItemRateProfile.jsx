import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import { formatCurrencyPKR } from '../../utils/currencyUtils';

export default function ItemRateProfile() {
  const { state, setState } = useApp();
  const { appAlert, appConfirm } = useDialog();

  const items = state.items || [];
  const departments = state.departments || [];

  // Filter States
  const [selectedDept, setSelectedDept] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Item & Grade/Sub-type
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedType, setSelectedType] = useState('Base Item');

  // Form States
  const [newRate, setNewRate] = useState('');
  const [updateDate, setUpdateDate] = useState(() => {
    const now = new Date();
    // Format to local date input format: YYYY-MM-DD
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  });

  // Filter items list based on department selection and search
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // 1. Department match (supporting comma-separated multi-departments)
      if (selectedDept) {
        const depts = (item.department || '').split(',').map(d => d.trim()).filter(Boolean);
        if (!depts.includes(selectedDept)) return false;
      }
      // 2. Search match
      if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        const nameMatch = (item.name || '').toLowerCase().includes(lowerQ);
        const skuMatch = (item.sku || '').toLowerCase().includes(lowerQ);
        if (!nameMatch && !skuMatch) return false;
      }
      return true;
    });
  }, [items, selectedDept, searchQuery]);

  // Set first item as selected by default if nothing is selected or if filtered list changes
  const activeItem = useMemo(() => {
    if (selectedItemId) {
      const found = filteredItems.find(i => i.id === selectedItemId);
      if (found) return found;
    }
    return filteredItems.length > 0 ? filteredItems[0] : null;
  }, [filteredItems, selectedItemId]);

  // Reset selected sub-type to 'Base Item' when active item changes
  useEffect(() => {
    setSelectedType('Base Item');
  }, [selectedItemId]);

  // Resolve available sub-types (Grades/Output Types) for the active item
  const availableTypes = useMemo(() => {
    if (!activeItem) return [];

    const isFG = activeItem.category === 'Finished Goods' || activeItem.category === 'Finish Good' || activeItem.rawMaterialType === 'Finished Good';
    if (!isFG) return ['Base Item'];

    const types = new Set();
    types.add('Base Item');

    // Add types from stockByType if any exist in inventory
    if (activeItem.stockByType) {
      Object.keys(activeItem.stockByType).forEach(t => types.add(t));
    }

    // Add types from state.batchOutputTypes configuration
    const batchTypes = state?.batchOutputTypes || [
      { id: 1, name: 'Finished Good', uom: 'Meters' },
      { id: 3, name: 'B-Grade', uom: 'Meters' }
    ];
    batchTypes.forEach(t => {
      if (t.name !== 'Wastage') {
        types.add(t.name);
      }
    });

    return Array.from(types);
  }, [activeItem, state?.batchOutputTypes]);

  // Get current active rate for the selected item and sub-type
  const currentRateValue = useMemo(() => {
    if (!activeItem) return 'Rs. 0.00';
    if (selectedType === 'Base Item') {
      return formatCurrencyPKR(activeItem.price);
    }
    return formatCurrencyPKR(activeItem.pricesByType?.[selectedType] || activeItem.price);
  }, [activeItem, selectedType]);

  // Compile unified Rate History from Manual Updates, POs, and Invoices for the selected type
  const itemRateHistory = useMemo(() => {
    if (!activeItem) return [];

    const itemSku = activeItem.sku;
    const itemId = activeItem.id;

    // 1. Purchase Orders rates (only applicable for Base Item)
    const poRates = selectedType === 'Base Item'
      ? (state.purchaseOrders || [])
        .filter(po => po.items?.some(it => it.itemCode === itemSku || it.itemCode === itemId || it.itemId === itemId))
        .map(po => {
          const poItem = po.items.find(it => it.itemCode === itemSku || it.itemCode === itemId || it.itemId === itemId);
          return {
            id: `po-${po.id}-${poItem.itemCode}`,
            rate: Number(poItem.unitPrice || 0),
            formattedRate: `Rs. ${Number(poItem.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            date: po.date || po.createdAt || new Date().toISOString(),
            updatedBy: po.supplierName || 'Supplier',
            type: `Purchase Order (${po.id})`
          };
        })
      : [];

    // 2. Purchase Invoices rates (only applicable for Base Item)
    const pinvRates = selectedType === 'Base Item'
      ? (state.purchaseInvoices || [])
        .filter(inv => inv.items?.some(it => it.itemCode === itemSku || it.itemCode === itemId))
        .map(inv => {
          const invItem = inv.items.find(it => it.itemCode === itemSku || it.itemCode === itemId);
          return {
            id: `pinv-${inv.id}-${invItem.itemCode}`,
            rate: Number(invItem.unitPrice || 0),
            formattedRate: `Rs. ${Number(invItem.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            date: inv.date || new Date().toISOString(),
            updatedBy: inv.vendorName || 'Vendor',
            type: `Purchase Invoice (${inv.id})`
          };
        })
      : [];

    // 3. Manual updates recorded on item itself for this sub-type
    const manualRates = (activeItem.rateHistory || [])
      .filter(r => (r.subType || 'Base Item') === selectedType)
      .map(r => ({
        id: r.id || `rate-man-${Math.random()}`,
        rate: Number(r.rate || 0),
        formattedRate: `Rs. ${Number(r.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        date: r.date,
        updatedBy: r.updatedBy || 'admin',
        type: r.type || 'Manual Update'
      }));

    // Combine all rates
    const combined = [...poRates, ...pinvRates, ...manualRates];

    // Sort by date (descending)
    combined.sort((a, b) => new Date(b.date) - new Date(a.date));

    // If history is empty, fall back to current price
    if (combined.length === 0) {
      const fallbackPriceStr = selectedType === 'Base Item' 
        ? formatCurrencyPKR(activeItem.price)
        : formatCurrencyPKR(activeItem.pricesByType?.[selectedType] || activeItem.price);
      const cleanPrice = parseFloat(String(fallbackPriceStr).replace(/[^0-9.]/g, '')) || 0;
      combined.push({
        id: `init-${itemId}-${selectedType}`,
        rate: cleanPrice,
        formattedRate: fallbackPriceStr,
        date: new Date().toISOString(),
        updatedBy: 'system',
        type: 'Initial Rate'
      });
    }

    return combined;
  }, [activeItem, selectedType, state.purchaseOrders, state.purchaseInvoices]);

  // Calculate Stock Quantity and Valuation for the selected Item and sub-type/grade
  const { stockQty, totalVal } = useMemo(() => {
    if (!activeItem) return { stockQty: 0, totalVal: 0 };
    
    let qty = 0;
    if (selectedType === 'Base Item') {
      if (activeItem.stockByType && Object.keys(activeItem.stockByType).length > 0) {
        qty = Object.values(activeItem.stockByType).reduce((sum, v) => sum + (Number(v) || 0), 0);
      } else {
        qty = Number(activeItem.stock || 0);
      }
    } else {
      qty = Number(activeItem.stockByType?.[selectedType] || 0);
    }

    const rateNum = parseFloat(String(currentRateValue).replace(/[^0-9.]/g, '')) || 0;

    return {
      stockQty: qty,
      totalVal: qty * rateNum
    };
  }, [activeItem, selectedType, currentRateValue]);

  // Handle Rate Update Submission
  const handleUpdateRate = async (e) => {
    e.preventDefault();
    if (!activeItem) return;

    const rateVal = parseFloat(newRate);
    if (isNaN(rateVal) || rateVal < 0) {
      appAlert('Please enter a valid rate greater than or equal to 0.', 'error');
      return;
    }

    const proceed = await appConfirm(
      `Are you sure you want to update the rate for "${activeItem.name}" (${selectedType}) to Rs. ${rateVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}?`,
      "Confirm Rate Update",
      "Update",
      "Cancel"
    );

    if (proceed) {
      const formattedRateStr = `Rs. ${rateVal.toFixed(2)}`;
      
      const newRecord = {
        id: 'rate-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        rate: rateVal,
        formattedRate: formattedRateStr,
        date: new Date(updateDate).toISOString(),
        updatedBy: state.currentUser?.username || 'admin',
        type: 'Manual Update',
        subType: selectedType
      };

      const updatedItems = items.map(it => {
        if (it.id === activeItem.id) {
          const newPricesByType = {
            ...(it.pricesByType || {}),
            [selectedType]: formattedRateStr
          };

          return {
            ...it,
            // Update base price field if Base Item is selected
            ...(selectedType === 'Base Item' ? { price: formattedRateStr } : {}),
            pricesByType: newPricesByType,
            rateHistory: [newRecord, ...(it.rateHistory || [])]
          };
        }
        return it;
      });

      // Save using direct state single transaction to avoid race conditions
      setState(prev => ({
        ...prev,
        items: updatedItems
      }));

      appAlert(`${selectedType} rate updated successfully!`, 'success');
      setNewRate('');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      
      {/* Header bar and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/15 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase mb-1">
            <span className="material-symbols-outlined text-[16px]">price_change</span>
            Inventory Pricing
          </div>
          <h2 className="text-3xl font-black text-on-surface">Item Rate Profile</h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center shrink-0 w-full md:w-auto">
          {/* Department Filter */}
          <div className="relative w-full sm:w-64">
            <select
              value={selectedDept}
              onChange={e => {
                setSelectedDept(e.target.value);
                setSelectedItemId(null); // Reset selection
              }}
              className="w-full pl-4 pr-10 py-3 bg-surface border border-outline-variant/30 rounded-2xl text-sm focus:ring-2 focus:ring-primary outline-none appearance-none font-bold text-on-surface"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id || dept} value={dept.name || dept}>
                  {dept.name || dept}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">expand_more</span>
          </div>

          {/* Item Search Bar */}
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input
              type="text"
              placeholder="Search by Name or SKU..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSelectedItemId(null); // Reset selection
              }}
              className="w-full pl-11 pr-4 py-3 bg-surface border border-outline-variant/30 rounded-2xl text-sm focus:ring-2 focus:ring-primary outline-none text-on-surface"
            />
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start min-h-[500px]">
        
        {/* Left Card List (1/3 width) */}
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm p-4 overflow-hidden flex flex-col max-h-[700px] lg:col-span-1">
          <header className="px-4 py-3 border-b border-outline-variant/10 flex justify-between items-center">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
              Items Listing ({filteredItems.length})
            </span>
          </header>
          
          <div className="overflow-y-auto divide-y divide-outline-variant/10 flex-1 pr-1 mt-2">
            {filteredItems.length > 0 ? (
              filteredItems.map(item => {
                const isActive = activeItem && activeItem.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`p-4 cursor-pointer rounded-2xl my-1 transition-all flex items-center justify-between group ${
                      isActive 
                        ? 'bg-primary/10 border-l-4 border-primary pl-3' 
                        : 'hover:bg-surface-container-low border-l-4 border-transparent hover:border-outline-variant/30'
                    }`}
                  >
                    <div className="space-y-1 pr-2 truncate">
                      <div className={`font-bold text-sm truncate ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                        {item.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-surface rounded text-primary font-bold border border-primary/10">
                          {item.sku || item.id}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-medium">
                          {item.category || 'Item'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <div className="font-extrabold text-sm text-on-surface">
                        {formatCurrencyPKR(item.price)}
                      </div>
                      <div className="text-[9px] text-on-surface-variant font-medium">
                        {item.uom || 'Units'}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-on-surface-variant text-sm font-medium">
                No items found matching criteria.
              </div>
            )}
          </div>
        </div>

        {/* Right Details Panel (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {activeItem ? (
            <div className="space-y-6">
              
              {/* Item Overview Profile */}
              <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm p-6 flex flex-col md:flex-row justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] pointer-events-none z-0"></div>
                
                <div className="space-y-3 z-10">
                  <span className="px-3 py-1 bg-secondary/15 text-secondary rounded-full text-xs font-bold uppercase tracking-wider">
                    {activeItem.category || 'General Item'}
                  </span>
                  <h3 className="text-2xl font-black text-on-surface leading-tight">
                    {activeItem.name}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-6 text-sm text-on-surface-variant font-medium">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider block text-on-surface-variant/75">SKU / Code</span>
                      <strong className="text-on-surface font-mono">{activeItem.sku || activeItem.id}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider block text-on-surface-variant/75">Department</span>
                      <strong className="text-on-surface">{activeItem.department || 'Not Assigned'}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase tracking-wider block text-on-surface-variant/75">Unit UOM</span>
                      <strong className="text-on-surface">{activeItem.uom || activeItem.unit || 'Units'}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 shrink-0 z-10 w-full md:w-auto">
                  {/* Active Rate Card */}
                  <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex flex-col justify-center items-center sm:items-end text-center sm:text-right flex-1 sm:flex-initial min-w-[170px]">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">
                      Active Rate ({selectedType})
                    </span>
                    <div className="text-2xl font-black text-primary tracking-tight">
                      {currentRateValue}
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-semibold mt-0.5">
                      Per {activeItem.uom || 'Unit'}
                    </span>
                  </div>

                  {/* Stock Value Card */}
                  <div className="bg-tertiary/5 border border-tertiary/10 rounded-2xl p-5 flex flex-col justify-center items-center sm:items-end text-center sm:text-right flex-1 sm:flex-initial min-w-[170px]">
                    <span className="text-[10px] font-bold text-tertiary uppercase tracking-widest mb-1">
                      Stock Value ({selectedType})
                    </span>
                    <div className="text-2xl font-black text-tertiary tracking-tight">
                      Rs. {totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-semibold mt-0.5">
                      Stock: {stockQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} {activeItem.uom || 'Units'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sub-types Selector (only for Finished Goods with multiple types) */}
              {availableTypes.length > 1 && (
                <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm p-6 space-y-3">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest block">
                    Product Type / Grade
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {availableTypes.map(t => {
                      const isSel = selectedType === t;
                      const typeRate = t === 'Base Item' 
                        ? formatCurrencyPKR(activeItem.price) 
                        : formatCurrencyPKR(activeItem.pricesByType?.[t] || activeItem.price);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedType(t)}
                          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border shadow-sm ${
                            isSel
                              ? 'bg-primary border-primary text-on-primary'
                              : 'bg-surface border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {t === 'Base Item' ? 'layers' : 'grade'}
                          </span>
                          {t}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isSel ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                            {typeRate}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Update Rate Form */}
              <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm p-6">
                <header className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-[20px]">add_circle</span>
                  <h4 className="font-black text-on-surface text-base">Update {selectedType} Rate</h4>
                </header>
                
                <form onSubmit={handleUpdateRate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">New Rate (Rs.)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">Rs.</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={newRate}
                        onChange={e => setNewRate(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-surface border border-outline-variant/30 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none font-bold text-on-surface"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Effective Date</label>
                    <input
                      type="datetime-local"
                      value={updateDate}
                      onChange={e => setUpdateDate(e.target.value)}
                      className="w-full px-4 py-3 bg-surface border border-outline-variant/30 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none font-bold text-on-surface"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="bg-primary text-on-primary rounded-xl py-3 px-6 text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary/95 transition-all shadow-md active:scale-95 h-[46px]"
                  >
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    Update Rate
                  </button>
                </form>
              </div>

              {/* Rate History Ledger */}
              <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm flex flex-col overflow-hidden">
                <header className="px-6 py-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low/20">
                  <span className="text-xs font-bold text-on-surface uppercase tracking-widest">
                    Rate History Ledger ({selectedType})
                  </span>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                    {itemRateHistory.length} Records
                  </span>
                </header>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-surface-container-low/40 text-on-surface-variant border-b border-outline-variant/10">
                      <tr>
                        <th className="px-6 py-3.5 font-bold text-xs uppercase tracking-wider">Date & Time</th>
                        <th className="px-6 py-3.5 font-bold text-xs uppercase tracking-wider text-right">Rate</th>
                        <th className="px-6 py-3.5 font-bold text-xs uppercase tracking-wider">Update Source</th>
                        <th className="px-6 py-3.5 font-bold text-xs uppercase tracking-wider">Updated By / vendor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 font-medium">
                      {itemRateHistory.map((rec, index) => (
                        <tr 
                          key={rec.id} 
                          className={`transition-colors hover:bg-surface-container-low/20 ${index === 0 ? 'bg-primary/[0.03]' : ''}`}
                        >
                          <td className="px-6 py-4 text-xs text-on-surface-variant font-mono">
                            {new Date(rec.date).toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className={`px-6 py-4 text-sm text-right font-black ${index === 0 ? 'text-primary' : 'text-on-surface'}`}>
                            {rec.formattedRate}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.type.startsWith('Purchase Order') ? 'bg-secondary/15 text-secondary' :
                              rec.type.startsWith('Purchase Invoice') ? 'bg-tertiary/15 text-tertiary' :
                              rec.type === 'Initial Rate' ? 'bg-slate-100 text-slate-700' : 'bg-primary/10 text-primary'
                            }`}>
                              {rec.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-on-surface-variant">
                            {rec.updatedBy}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <span className="material-symbols-outlined text-primary/30 text-5xl mb-4" style={{ fontVariationSettings: "'FILL' 0" }}>price_change</span>
              <h3 className="text-lg font-bold text-on-surface mb-1">Select an Item</h3>
              <p className="text-sm text-on-surface-variant max-w-sm">
                Select an item from the left panel listing to view its profile, update rates, and view manual and purchase historical rates.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
