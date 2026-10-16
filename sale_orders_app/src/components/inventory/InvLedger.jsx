import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import ResizableHeader from '../ui/ResizableHeader';
import PrintLayout from '../ui/PrintLayout';
import GlobalPagination from '../ui/GlobalPagination';
import CustomMultiSelect from '../ui/CustomMultiSelect';
import UniversalPrintStudioModal from '../ui/UniversalPrintStudioModal';

export default function InvLedger({ selectedDepartments = [], onBack }) {
  const { state, toggleGlobalPagination } = useApp();
  
  // States
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const itemDropdownRef = useRef(null);
  
  const [activeItemIds, setActiveItemIds] = useState([]); // Controls what is actually fetched
  const [showStudioModal, setShowStudioModal] = useState(false);

  // Local department filter for modules that don't pass it down (like ProductionModule)
  const [localDepartments, setLocalDepartments] = useState([]);
  
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedTypes, setSelectedTypes] = useState(['Purchase', 'Sale', 'Production', 'Adjustment', 'Initial']);
  const [selectedOutputTypes, setSelectedOutputTypes] = useState([]); // Array for multi-select output types
  
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isOutputDropdownOpen, setIsOutputDropdownOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const typeDropdownRef = useRef(null);
  const outputDropdownRef = useRef(null);

  const [currentPages, setCurrentPages] = useState({});
  const itemsPerPage = 20;

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target)) setIsItemDropdownOpen(false);
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) setIsTypeDropdownOpen(false);
      if (outputDropdownRef.current && !outputDropdownRef.current.contains(event.target)) setIsOutputDropdownOpen(false);
      if (!event.target.closest('.export-dropdown')) setIsExportDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const effectiveDepartments = selectedDepartments.length > 0 ? selectedDepartments : localDepartments;

  const filteredItems = useMemo(() => {
    if (!effectiveDepartments || effectiveDepartments.length === 0) return state?.items || [];
    return state?.items?.filter(item => {
        const depts = (item.department || '').split(',').map(d => d.trim()).filter(Boolean);
        return depts.length === 0 || depts.some(d => effectiveDepartments.includes(d));
    }) || [];
  }, [state?.items, effectiveDepartments]);

  const searchedItems = useMemo(() => {
    if (!itemSearchQuery) return filteredItems;
    const lowerQ = itemSearchQuery.toLowerCase().trim();
    return filteredItems.filter(item => 
        (item.name || '').toLowerCase().includes(lowerQ) || 
        (item.sku || '').toLowerCase().includes(lowerQ) ||
        (item.itemCode || '').toLowerCase().includes(lowerQ) ||
        (item.code || '').toLowerCase().includes(lowerQ) ||
        String(item.id || '').toLowerCase().includes(lowerQ)
    );
  }, [filteredItems, itemSearchQuery]);

  const handleToggleItem = (id) => {
      setSelectedItemIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleOutputType = (type) => {
      setSelectedOutputTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const handleToggleType = (type) => {
      setSelectedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };
  // Helper to calculate exact stock 
  const getAccurateStock = (itm) => {
      return parseFloat(itm.stock) || 0;
  };

  // Build Ledger Entries
  const allEntries = useMemo(() => {
      let entries = [];

      // 1. Sale Orders (Sale -> Qty Out)
      state?.saleOrders?.forEach(so => {
          if (so.status !== 'Cancelled' && so.items) {
              so.items.forEach(si => {
                  let qtyOut = parseFloat(si.deliveredQty) || parseFloat(si.dispatchedQty) || 0;
                  if (qtyOut === 0 && (so.status === 'Completed' || so.status === 'Delivered')) {
                      qtyOut = parseFloat(si.quantity) || 0;
                  }
                  
                  if (qtyOut > 0) {
                      entries.push({
                          id: `so-${so.id}-${si.id}`,
                          timestamp: new Date(so.orderDate || new Date()).getTime(),
                          dateStr: so.orderDate || new Date().toLocaleDateString(),
                          itemId: si.productName || si.itemCode, // Try matching by name first since itemCode might be sale order specific ID
                          type: 'Sale',
                          ref: so.id,
                          outputType: si.outputType || si.type || '-',
                          qtyIn: 0,
                          qtyOut: qtyOut
                      });
                  }
              });
          }
      });

      // 2. Production Plans (Production -> Qty In / Consumption -> Qty Out)
      state?.productionPlans?.forEach(pp => {
          if (pp.status !== 'Cancelled' && pp.items) {
              pp.items.forEach(pi => {
                  // Production Output (Inward)
                  if (pi.outputs) {
                      pi.outputs.forEach((out, idx) => {
                          const qty = parseFloat(out.quantity) || 0;
                          if (qty > 0) {
                              entries.push({
                                  id: `pp-${pp.id}-${pi.itemCode}-${idx}`,
                                  timestamp: new Date(pp.createdDate || new Date()).getTime() + idx,
                                  dateStr: pp.createdDate || new Date().toLocaleDateString(),
                                  itemId: pi.productName || pi.itemCode, // Use productName because itemCode might be linked to SO
                                  type: 'Production',
                                  ref: pp.id,
                                  outputType: out.typeName || '', // Track the output type
                                  qtyIn: qty,
                                  qtyOut: 0
                              });
                          }
                      });
                  }
                  
                  // Production Consumption (Outward)
                  const consumedQty = parseFloat(pi.fabricRequiredQty) || 0;
                  if (consumedQty > 0) {
                      entries.push({
                          id: `pp-cons-${pp.id}-${pi.itemCode}`,
                          timestamp: new Date(pp.createdDate || new Date()).getTime(),
                          dateStr: pp.createdDate || new Date().toLocaleDateString(),
                          itemId: pi.requiredFabricId || pi.requiredFabricName,
                          type: 'Consumption',
                          ref: pp.id,
                          outputType: '-',
                          qtyIn: 0,
                          qtyOut: consumedQty
                      });
                  }
              });
          }
      });

      // 3. Returns (Return -> Qty In)
      state?.returns?.forEach(ret => {
          if (ret.items) {
              ret.items.forEach(ri => {
                  const qty = parseFloat(ri.qty) || 0;
                  if (qty > 0) {
                      entries.push({
                          id: `ret-${ret.id}-${ri.itemId}`,
                          timestamp: ret.timestamp || new Date().getTime(),
                          dateStr: ret.date || new Date().toLocaleDateString(),
                          itemId: ri.itemCode || ri.name, // Try matching by code or name
                          type: 'Return',
                          ref: ret.id,
                          outputType: ri.outputType || ri.type || '-',
                          qtyIn: qty,
                          qtyOut: 0
                      });
                  }
              });
          }
      });

      // 4. Adjustments (Adjustment -> Qty In / Out)
      state?.adjustments?.forEach(adj => {
          entries.push({
              id: adj.id,
              timestamp: adj.timestamp,
              dateStr: adj.date,
              itemId: adj.itemId, // Actual item ID
              type: 'Adjustment',
              ref: 'MANUAL-ADJ',
              outputType: adj.outputType || '-',
              qtyIn: adj.type === 'add' ? adj.qty : 0,
              qtyOut: adj.type === 'sub' ? adj.qty : 0
          });
      });

      // Compute balances chronologically
      // Sort ascending first
      entries.sort((a, b) => a.timestamp - b.timestamp);

      // Match items correctly
      const getMatchingItem = (refId) => {
          if (!refId) return null;
          const s = String(refId).toLowerCase().trim();
          return (state?.items || []).find(i => 
              String(i.id).toLowerCase() === s || 
              String(i.sku || '').toLowerCase() === s || 
              String(i.name || '').toLowerCase() === s ||
              String(i.itemCode || '').toLowerCase() === s ||
              String(i.code || '').toLowerCase() === s
          );
      };

      let itemMovements = {};
      entries.forEach(e => {
          const itm = getMatchingItem(e.itemId);
          if (itm) {
              const oType = e.outputType || '-';
              const key = `${itm.id}-${oType}`;
              itemMovements[key] = (itemMovements[key] || 0) + e.qtyIn - e.qtyOut;
              e.matchedItem = itm;
          }
      });

      // Calculate chronological balances so that the final balance matches current stock
      let currentBalances = {};
      filteredItems.forEach(itm => {
          currentBalances[itm.id] = {};
          if (itm.stockByType && Object.keys(itm.stockByType).length > 0) {
              Object.entries(itm.stockByType).forEach(([oType, qty]) => {
                  const key = `${itm.id}-${oType}`;
                  const mov = itemMovements[key] || 0;
                  const initialStock = qty - mov;
                  currentBalances[itm.id][oType] = initialStock;
                  
                  if (initialStock !== 0) {
                      entries.unshift({
                          id: `init-${itm.id}-${oType}`,
                          timestamp: 0,
                          dateStr: 'Initial',
                          itemId: itm.id,
                          type: 'Initial',
                          ref: '-',
                          outputType: oType,
                          qtyIn: initialStock > 0 ? initialStock : 0,
                          qtyOut: initialStock < 0 ? Math.abs(initialStock) : 0,
                          matchedItem: itm
                      });
                  }
              });
              // Add any outputTypes that were in movements but not currently in stockByType
              Object.keys(itemMovements).filter(k => k.startsWith(`${itm.id}-`)).forEach(k => {
                  const oType = k.split('-').slice(1).join('-');
                  if (oType !== '-' && currentBalances[itm.id][oType] === undefined) {
                      const mov = itemMovements[k] || 0;
                      const initialStock = 0 - mov;
                      currentBalances[itm.id][oType] = initialStock;
                      if (initialStock !== 0) {
                          entries.unshift({
                              id: `init-${itm.id}-${oType}`,
                              timestamp: 0,
                              dateStr: 'Initial',
                              itemId: itm.id,
                              type: 'Initial',
                              ref: '-',
                              outputType: oType,
                              qtyIn: initialStock > 0 ? initialStock : 0,
                              qtyOut: initialStock < 0 ? Math.abs(initialStock) : 0,
                              matchedItem: itm
                          });
                      }
                  }
              });
          } else {
              const key = `${itm.id}--`;
              const mov = itemMovements[key] || 0;
              const initialStock = getAccurateStock(itm) - mov;
              currentBalances[itm.id]['-'] = initialStock;
              
              if (initialStock !== 0) {
                  entries.unshift({
                      id: `init-${itm.id}`,
                      timestamp: 0,
                      dateStr: 'Initial',
                      itemId: itm.id,
                      type: 'Initial',
                      ref: '-',
                      outputType: '-',
                      qtyIn: initialStock > 0 ? initialStock : 0,
                      qtyOut: initialStock < 0 ? Math.abs(initialStock) : 0,
                      matchedItem: itm
                  });
              }
          }
      });

      // Sort ascending to calculate running balance correctly
      entries.sort((a, b) => a.timestamp - b.timestamp);

      entries.forEach(e => {
          if (e.matchedItem) {
              const oType = e.outputType || '-';
              if (currentBalances[e.matchedItem.id][oType] === undefined) {
                  currentBalances[e.matchedItem.id][oType] = 0;
              }
              if (e.type !== 'Initial') {
                  currentBalances[e.matchedItem.id][oType] += (e.qtyIn - e.qtyOut);
              }
              e.balance = currentBalances[e.matchedItem.id][oType];
          }
      });

      // Keep chronological sorting! (Start date wise table me entries honi chahie)
      return entries.filter(e => e.matchedItem);
  }, [state, filteredItems]);

  const filteredEntries = useMemo(() => {
      return allEntries.filter(e => {
          // Date Filter
          if (dateFrom) {
              const dFrom = new Date(dateFrom).getTime();
              const eTime = new Date(e.dateStr || e.timestamp).getTime();
              if (eTime < dFrom && (dFrom - eTime) > 86400000) return false; 
          }
          if (dateTo) {
              const dTo = new Date(dateTo).getTime();
              const eTime = new Date(e.dateStr || e.timestamp).getTime();
              if (eTime > dTo + 86400000) return false;
          }

          // Type Filter
          if (!selectedTypes.includes(e.type)) return false;

          // Output Type Filter for Production
          if (selectedOutputTypes.length > 0 && e.type === 'Production') {
              if (e.outputType && !selectedOutputTypes.includes(e.outputType)) return false;
          }

          // Item Filter (Driven by activeItemIds instead of selectedItemIds)
          if (activeItemIds.length > 0 && !activeItemIds.includes(e.matchedItem.id)) return false;

          return true;
      });
  }, [allEntries, dateFrom, dateTo, selectedTypes, activeItemIds, selectedOutputTypes]);

  // Group entries by item and output type
  const groupedEntries = useMemo(() => {
      const groups = {};
      filteredEntries.forEach(e => {
          const itemId = e.matchedItem.id;
          const outputType = e.outputType || '-';
          const groupKey = `${itemId}::${outputType}`;
          
          if (!groups[groupKey]) {
              groups[groupKey] = {
                  id: groupKey,
                  item: e.matchedItem,
                  outputType: outputType,
                  entries: [],
                  inward: 0,
                  outward: 0
              };
          }
          groups[groupKey].entries.push(e);
          groups[groupKey].inward += e.qtyIn || 0;
          groups[groupKey].outward += e.qtyOut || 0;
      });
      return groups;
  }, [filteredEntries]);

  // Stats
  const stats = useMemo(() => {
      let totalStock = 0;
      let itemsCount = new Set();
      let inward = 0;
      let outward = 0;
      
      // Calculate current stock of active items
      const targetItems = activeItemIds.length > 0 ? filteredItems.filter(i => activeItemIds.includes(i.id)) : filteredItems;
      targetItems.forEach(i => {
          let tStock = i.stock || 0;
          // Use stockByType if available to be accurate, especially with outputTypeFilter
          if (i.stockByType && Object.keys(i.stockByType).length > 0) {
              tStock = 0;
              Object.entries(i.stockByType).forEach(([typeName, qty]) => {
                  // Only sum the filtered output type, or sum all if no filter
                  if (selectedOutputTypes.length === 0 || selectedOutputTypes.includes(typeName)) {
                      tStock += qty;
                  }
              });
          }
          
          totalStock += tStock;
          itemsCount.add(i.id);
      });

      // Calculate movements in the current filtered view
      filteredEntries.forEach(e => {
          inward += e.qtyIn;
          outward += e.qtyOut;
      });

      return { totalStock, itemCount: itemsCount.size, inward, outward, txCount: filteredEntries.length };
  }, [filteredEntries, filteredItems, activeItemIds, selectedOutputTypes]);

  const handleGetLedger = () => {
      setActiveItemIds(selectedItemIds);
  };

  const printLedgerData = useMemo(() => ({
    header: {
      ledger_id: `LEDGER-${new Date().toISOString().slice(0, 10)}`,
      period: (dateFrom && dateTo) ? `${dateFrom} to ${dateTo}` : (dateFrom ? `From ${dateFrom}` : (dateTo ? `Up to ${dateTo}` : 'All Time History')),
      warehouse: effectiveDepartments.length > 0 ? effectiveDepartments.join(', ') : 'Central Stores & Multi-Warehouse',
      date: new Date().toLocaleDateString(),
      total_stock: stats.totalStock,
      item_count: stats.itemCount,
      inward: stats.inward,
      outward: stats.outward
    },
    items: filteredEntries.map((e, idx) => ({
      serial_no: idx + 1,
      date: e.dateStr || new Date(e.timestamp).toLocaleDateString(),
      ref_no: e.ref || '-',
      item_name: e.matchedItem?.name || e.itemId || 'Item',
      type: e.type,
      qty_in: e.qtyIn || 0,
      qty_out: e.qtyOut || 0,
      balance: e.balance !== undefined ? e.balance : '—'
    }))
  }), [filteredEntries, dateFrom, dateTo, effectiveDepartments, stats]);

  const handlePrint = () => {
    setShowStudioModal(true);
  };

  const handleExport = () => {
      if (filteredEntries.length === 0) return;
      const csvContent = "data:text/csv;charset=utf-8," 
          + "Date,Item,SKU,Type,Ref,Qty In,Qty Out,Balance\n"
          + filteredEntries.map(e => 
              `${new Date(e.timestamp).toLocaleDateString()},"${e.matchedItem.name}","${e.matchedItem.sku}",${e.type},${e.ref},${e.qtyIn || 0},${e.qtyOut || 0},${e.balance}`
          ).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Inventory_Ledger_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const resetFilters = () => {
      setSelectedItemIds([]);
      setActiveItemIds([]);
      setDateFrom('');
      setDateTo('');
      setSelectedTypes(['Purchase', 'Sale', 'Production', 'Adjustment', 'Return', 'Initial']);
      setSelectedOutputTypes([]);
  };

  return (
    <>
    <div className="animate-in fade-in duration-500 max-w-full px-6 mx-auto pb-4 print:hidden">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-transparent pb-4 mb-8">
        <div className="space-y-4 flex-1 w-full max-w-2xl">
          <div className="flex items-center gap-4">
            {onBack && (
              <button 
                onClick={onBack}
                className="w-10 h-10 flex items-center justify-center bg-surface-container-high rounded-full hover:bg-surface-container-highest transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
              </button>
            )}
            <div>
              <h1 className="text-4xl font-extrabold text-on-surface tracking-tight leading-tight mb-1 font-headline">Multi-Item Ledger</h1>
              <p className="text-on-surface-variant text-base font-body">Consolidated tracking for multiple stocks with advanced filtering.</p>
            </div>
          </div>
          
          {/* Multi-Select Search Dropdown */}
          <div className="relative w-full" ref={itemDropdownRef}>
            <div 
                className="flex flex-wrap items-center gap-2 p-2 bg-surface-container-lowest border border-outline-variant/30 rounded-xl min-h-[52px] shadow-sm cursor-text"
                onClick={() => setIsItemDropdownOpen(true)}
            >
              {selectedItemIds.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-primary-container text-on-primary-container px-3 py-1 rounded-lg text-xs font-bold border border-primary/20 shrink-0">
                      <span>{selectedItemIds.length} item(s) selected</span>
                  </div>
              )}
              <input 
                  className="flex-1 min-w-[120px] border-none focus:ring-0 text-sm bg-transparent outline-none" 
                  placeholder={selectedItemIds.length === 0 ? "Search and select items..." : "Search more..."} 
                  type="text" 
                  value={itemSearchQuery}
                  onChange={(e) => {
                      setItemSearchQuery(e.target.value);
                      setIsItemDropdownOpen(true);
                  }}
              />
              {selectedItemIds.length > 0 && (
                  <button className="px-2 text-outline-variant hover:text-error" onClick={(e) => { e.stopPropagation(); setSelectedItemIds([]); }}>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>close</span>
                  </button>
              )}
              <button className="px-2 text-on-surface-variant">
                <span className={`material-symbols-outlined transition-transform ${isItemDropdownOpen ? 'rotate-180' : ''}`} style={{ fontVariationSettings: "'FILL' 0" }}>keyboard_arrow_down</span>
              </button>
            </div>
            
            {isItemDropdownOpen && (
                <div className="absolute z-50 w-full mt-2 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {searchedItems.length > 0 ? (
                        <ul className="py-2">
                            {searchedItems.map(item => {
                                const isSelected = selectedItemIds.includes(item.id);
                                return (
                                <li 
                                    key={item.id}
                                    className={`px-4 py-3 hover:bg-surface-container-low cursor-pointer flex items-center justify-between transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                                    onClick={() => handleToggleItem(item.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary text-white' : 'border-outline-variant/50 bg-surface-container-highest text-transparent'}`}>
                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold transition-colors ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{item.name}</p>
                                            <p className="text-[10px] font-mono text-outline-variant">{item.sku}</p>
                                        </div>
                                    </div>
                                </li>
                            )})}
                        </ul>
                    ) : (
                        <div className="p-6 text-center text-on-surface-variant text-sm">No items found.</div>
                    )}
                </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          {selectedDepartments.length === 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Department:</span>
              <div className="w-[200px]">
                  <CustomMultiSelect
                      options={state?.departments?.map(dept => ({ label: dept.label, value: dept.value })) || []}
                      selectedValues={localDepartments}
                      onChange={(vals) => {
                          setLocalDepartments(vals);
                          setSelectedItemIds([]);
                          setActiveItemIds([]);
                      }}
                      placeholder="Select Depts"
                  />
              </div>
            </div>
          )}
          <div className="flex gap-3 items-center">
          <button 
              onClick={handleGetLedger} 
              className="flex items-center gap-2 px-6 py-3 bg-tertiary-container text-on-tertiary-container rounded-xl font-bold shadow-sm hover:shadow hover:bg-tertiary-container/80 transition-all border border-tertiary/20"
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>analytics</span>
            <span>Get Ledger</span>
          </button>
          
          <div className="relative export-dropdown">
              <button onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)} className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest rounded-xl font-bold text-on-surface hover:bg-surface-container-high transition-colors shadow-sm hover:shadow">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>ios_share</span>
                <span>Export Options</span>
              </button>
              {isExportDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
                      <button onClick={() => { handleExport(); setIsExportDropdownOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors font-semibold text-sm rounded-t-xl">Export CSV</button>
                      <button onClick={() => { handlePrint(); setIsExportDropdownOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors font-semibold text-sm">Export PDF (via Print)</button>
                      <button onClick={() => { handlePrint(); setIsExportDropdownOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors font-semibold text-sm rounded-b-xl">Export PNG (via Print)</button>
                  </div>
              )}
          </div>

          <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-br from-primary to-primary-container rounded-xl font-bold text-white shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>print</span>
            <span>Print Ledger</span>
          </button>
        </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl"></div>
          <div className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest mb-4">Total Current Stock</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-primary tracking-tight font-headline">{stats.totalStock.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
            <span className="text-sm font-medium text-on-surface-variant">Units</span>
          </div>
          <div className="mt-4 flex items-center text-xs text-primary font-bold">
            <span className="material-symbols-outlined text-sm mr-1" style={{ fontVariationSettings: "'FILL' 0" }}>analytics</span>
            Across {stats.itemCount} Items
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm">
          <div className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest mb-4">Total Transactions</div>
          <div className="text-3xl font-black text-on-surface tracking-tight font-headline">{stats.txCount}</div>
          <div className="mt-4 text-xs text-on-surface-variant font-medium">In selected date range</div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm">
          <div className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest mb-4">Total Inward</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-secondary tracking-tight font-headline">{stats.inward.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
          </div>
          <div className="mt-4 text-xs text-secondary font-bold flex items-center">
            <span className="material-symbols-outlined text-sm mr-1" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_downward</span>
            Stock Received
          </div>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm">
          <div className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest mb-4">Total Outward</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-error tracking-tight font-headline">{stats.outward.toLocaleString(undefined, {maximumFractionDigits:2})}</span>
          </div>
          <div className="mt-4 text-xs text-error font-bold flex items-center">
            <span className="material-symbols-outlined text-sm mr-1" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_upward</span>
            Stock Consumed/Sold
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="bg-surface-container-lowest p-6 rounded-2xl flex flex-wrap items-center justify-between gap-6 mb-8 border border-outline-variant/10 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          {/* Advanced Date Range */}
          <div className="space-y-1.5 p-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Date Range</label>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>calendar_today</span>
                    <input 
                        type="date" 
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-medium py-2 pl-9 pr-3 focus:ring-2 focus:ring-primary outline-none transition-all appearance-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full" 
                    />
                </div>
                <span className="text-outline-variant font-bold">to</span>
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>calendar_today</span>
                    <input 
                        type="date" 
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-medium py-2 pl-9 pr-3 focus:ring-2 focus:ring-primary outline-none transition-all appearance-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full" 
                    />
                </div>
            </div>
          </div>
          
          {/* Transaction Type Multi-select */}
          <div className="space-y-1.5 p-2 relative" ref={typeDropdownRef}>
            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Transaction Types</label>
            <div 
                className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-medium py-2 px-4 cursor-pointer min-w-[200px]"
                onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
            >
                <span className="flex-1">{selectedTypes.length === 5 ? 'All Transactions' : `${selectedTypes.length} Selected`}</span>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>expand_more</span>
            </div>
            
            {isTypeDropdownOpen && (
                <div className="absolute z-50 top-full mt-2 w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-lg p-2 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {['Purchase', 'Sale', 'Production', 'Adjustment', 'Return'].map(type => (
                        <label key={type} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low rounded-lg cursor-pointer transition-colors">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant/30"
                                checked={selectedTypes.includes(type)}
                                onChange={() => handleToggleType(type)}
                            />
                            <span className="text-sm font-medium text-on-surface">{type}</span>
                        </label>
                    ))}
                </div>
            )}
          </div>

          {/* Production Output Type Filter */}
          <div className="space-y-1.5 p-2 relative" ref={outputDropdownRef}>
            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">Output Type (Production)</label>
            <div 
                className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-medium py-2 px-4 cursor-pointer min-w-[200px]"
                onClick={() => setIsOutputDropdownOpen(!isOutputDropdownOpen)}
            >
                <span className="material-symbols-outlined text-outline-variant text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>category</span>
                <span className="flex-1 text-on-surface text-sm font-medium">{selectedOutputTypes.length === 0 ? 'All Outputs' : `${selectedOutputTypes.length} Selected`}</span>
                <span className="material-symbols-outlined text-sm text-outline-variant" style={{ fontVariationSettings: "'FILL' 0" }}>expand_more</span>
            </div>
            
            {isOutputDropdownOpen && (
                <div className="absolute z-50 top-full mt-2 w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-lg p-2 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {(state?.batchOutputTypes || []).map(t => (
                        <label key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-container-low rounded-lg cursor-pointer transition-colors">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant/30"
                                checked={selectedOutputTypes.includes(t.name)}
                                onChange={() => handleToggleOutputType(t.name)}
                            />
                            <span className="text-sm font-medium text-on-surface">{t.name}</span>
                        </label>
                    ))}
                    {(state?.batchOutputTypes || []).length === 0 && (
                         <div className="px-3 py-2 text-sm text-on-surface-variant text-center">No types available</div>
                    )}
                </div>
            )}
          </div>
        </div>
        <button onClick={resetFilters} className="text-primary font-bold text-sm flex items-center gap-1 hover:bg-primary/10 px-4 py-2 rounded-lg transition-colors">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>filter_list_off</span>
          Reset Filters
        </button>
      </section>

      {/* Grouped Ledger Sections */}
      {activeItemIds.length === 0 ? (
          <div className="bg-surface-container-lowest p-12 rounded-2xl flex flex-col items-center justify-center border border-outline-variant/10 shadow-sm text-center">
              <span className="material-symbols-outlined text-6xl text-outline-variant/50 mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
              <h3 className="text-xl font-bold text-on-surface mb-2">No Item Selected</h3>
              <p className="text-on-surface-variant max-w-md">Please search and select one or more items from the dropdown above to view their detailed ledger transactions.</p>
          </div>
      ) : Object.values(groupedEntries).length > 0 ? Object.values(groupedEntries).map(group => (
          <section key={group.id} className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/10 mb-8">
            {/* Item Header */}
            <div className="bg-surface-container-low px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/10">
                <div>
                    <h3 className="text-lg font-black text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
                        {group.item.name}
                        {group.outputType !== '-' && <span className="ml-2 text-xs px-2 py-1 bg-primary text-on-primary rounded-full font-bold">{group.outputType}</span>}
                    </h3>
                    <p className="text-xs font-mono text-on-surface-variant mt-1">{group.item.sku} • {group.entries.length} Transactions</p>
                </div>
                <div className="flex gap-6">
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Total Inward</p>
                        <p className="text-sm font-bold text-success">+{group.inward.toLocaleString(undefined, {maximumFractionDigits:2})}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Total Outward</p>
                        <p className="text-sm font-bold text-error">-{group.outward.toLocaleString(undefined, {maximumFractionDigits:2})}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Final Balance</p>
                        <p className="text-sm font-bold text-primary">{(group.entries[group.entries.length - 1]?.balance || 0).toLocaleString(undefined, {maximumFractionDigits:2})}</p>
                    </div>
                </div>
            </div>

            {/* Item Ledger Table */}
            <div className="overflow-x-auto min-h-[100px]">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="bg-surface-container-low/50 text-on-surface-variant border-b border-outline-variant/10">
                  <tr>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest">Date / Time</ResizableHeader>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest">Type</ResizableHeader>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest">Ref #</ResizableHeader>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest">Output Type</ResizableHeader>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-right">Qty In</ResizableHeader>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-right">Qty Out</ResizableHeader>
                    <ResizableHeader className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-right">Balance</ResizableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {(() => {
                      const page = currentPages[group.item.id] || 1;
                      const displayedEntries = state?.isGlobalPaginated
                          ? group.entries.slice((page - 1) * itemsPerPage, page * itemsPerPage)
                          : group.entries;
                      
                      return displayedEntries.map((e, index) => {
                          const d = new Date(e.timestamp);
                          return (
                              <tr key={`${e.id}-${index}`} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-6 py-4">
                              {e.timestamp === 0 ? (
                                <div className="text-sm font-bold text-on-surface">Opening Balance</div>
                              ) : (
                                <>
                                  <div className="text-sm font-bold text-on-surface">{d.toLocaleDateString()}</div>
                                  <div className="text-[10px] font-bold text-on-surface-variant uppercase">{d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                </>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase
                                  ${e.type === 'Sale' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 
                                    e.type === 'Production' ? 'bg-surface-container-highest text-on-surface-variant' : 
                                    e.type === 'Adjustment' ? 'bg-error-container text-error' : 
                                    e.type === 'Initial' ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary-container text-on-primary-container'}
                              `}>
                                  {e.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-mono text-primary font-semibold">{e.ref}</td>
                            <td className="px-6 py-4 text-sm font-medium text-on-surface-variant">{e.outputType || '—'}</td>
                            <td className="px-6 py-4 text-right font-bold text-success text-sm">{e.qtyIn ? `+${e.qtyIn.toLocaleString(undefined, {maximumFractionDigits:2})}` : '—'}</td>
                            <td className="px-6 py-4 text-right font-bold text-error text-sm">{e.qtyOut ? `-${e.qtyOut.toLocaleString(undefined, {maximumFractionDigits:2})}` : '—'}</td>
                            <td className="px-6 py-4 text-right font-bold text-on-surface text-sm">{e.balance.toLocaleString(undefined, {maximumFractionDigits:2})}</td>
                          </tr>
                      );
                  });
                  })()}
                </tbody>
              </table>
            </div>
            
            <GlobalPagination 
                totalItems={group.entries.length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPages[group.id] || 1}
                setCurrentPage={(page) => setCurrentPages(prev => ({...prev, [group.id]: page}))}
            />
          </section>
      )) : (
          <div className="bg-surface-container-lowest p-12 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-outline-variant" style={{ fontVariationSettings: "'FILL' 0" }}>receipt_long</span>
            </div>
            <h3 className="text-lg font-black text-on-surface mb-2 tracking-tight">No ledger entries found</h3>
            <p className="text-sm font-medium text-on-surface-variant max-w-sm">Adjust your filters or ensure the selected item has logged transactions.</p>
          </div>
      )}
    </div>

    {/* PRINT ONLY UI */}
    <div className="hidden print:block w-full">
        {Object.values(groupedEntries).length > 0 && Object.values(groupedEntries).map((group, groupIdx) => (
            <div key={`print-${group.id}`} className="mb-10 page-break-after-always" style={{ pageBreakAfter: groupIdx === Object.values(groupedEntries).length - 1 ? 'auto' : 'always' }}>
                <PrintLayout 
                    documentTitle="Inventory Ledger"
                    documentId={`ITEM-${group.item.sku || group.item.id}`}
                    date={new Date().toLocaleDateString()}
                    disclaimerKey="production"
                    extraMeta={[
                        { label: 'Item Name', value: `${group.item.name} ${group.outputType !== '-' ? `(${group.outputType})` : ''}` },
                        { label: 'Total Inward', value: group.inward.toLocaleString(undefined, {maximumFractionDigits:2}) },
                        { label: 'Total Outward', value: group.outward.toLocaleString(undefined, {maximumFractionDigits:2}) },
                        { label: 'Final Balance', value: (group.entries[group.entries.length - 1]?.balance || 0).toLocaleString(undefined, {maximumFractionDigits:2}) }
                    ]}
                >
                    <div className="border border-gray-300 mt-4">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300">Date/Time</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300">Type</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300">Ref #</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300">Output Type</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300 text-right">Qty In</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300 text-right">Qty Out</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-gray-700 uppercase border border-gray-300 text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.entries.map((e, index) => {
                                    const d = new Date(e.timestamp);
                                    return (
                                        <tr key={`p-${e.id}-${index}`}>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300">
                                                {e.timestamp === 0 ? 'Opening Balance' : d.toLocaleString()}
                                            </td>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300 font-bold">{e.type}</td>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300">{e.ref}</td>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300">{e.outputType || '—'}</td>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300 text-right">{e.qtyIn || '—'}</td>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300 text-right">{e.qtyOut || '—'}</td>
                                            <td className="py-2 px-3 text-[11px] border border-gray-300 text-right font-bold">{e.balance.toLocaleString(undefined, {maximumFractionDigits:2})}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </PrintLayout>
            </div>
        ))}
    </div>

    {showStudioModal && (
      <UniversalPrintStudioModal
        isOpen={showStudioModal}
        onClose={() => setShowStudioModal(false)}
        documentType="inventory_ledger"
        documentData={printLedgerData}
        documentTitle="Multi-Item Inventory Ledger"
      />
    )}
    </>
  );
}
