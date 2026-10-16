import FGCombinationBuilder from "../ui/FGCombinationBuilder";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';
import InventoryAdjustmentHistory from './InventoryAdjustmentHistory';
import CustomMultiSelect from '../ui/CustomMultiSelect';
import { useDialog } from '../../context/DialogContext';
import { supabase } from '../../utils/supabaseClient';

export default function InvAdjustment({ selectedDepartments = [], onBack }) {
  const { state, setCollection, addNotification } = useApp();
  const { appAlert } = useDialog();
  
  const [showHistory, setShowHistory] = useState(false);
  
  // State for the multi-item form
  const [lines, setLines] = useState([
      { id: Date.now(), itemId: '', type: 'Addition', qty: '', reason: '', customReason: '', remarks: '', outputType: '' }
  ]);

  // Local department filter for modules that don't pass it down
  const [localDepartments, setLocalDepartments] = useState(() => {
      if (selectedDepartments && selectedDepartments.length > 0) {
          return [selectedDepartments[0]];
      }
      const depts = state?.departments || [];
      return depts.length > 0 ? [depts[0].value || depts[0].name] : [];
  });
  
  // Searchable dropdown state for Items (per line)
  const [openItemDropdownId, setOpenItemDropdownId] = useState(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  // Dropdown state for Reasons (per line)
  const [openReasonDropdownId, setOpenReasonDropdownId] = useState(null);

  // Print state
  const [printData, setPrintData] = useState(null);

  const effectiveDepartments = selectedDepartments.length > 0 ? selectedDepartments : localDepartments;

  const filteredItems = useMemo(() => {
    if (!effectiveDepartments || effectiveDepartments.length === 0) return [];
    return state?.items?.filter(item => {
        const depts = (item.department || '').split(',').map(d => d.trim()).filter(Boolean);
        return depts.some(d => effectiveDepartments.includes(d));
    }) || [];
  }, [state?.items, effectiveDepartments]);

  const searchedItems = useMemo(() => {
    if (!itemSearchQuery) return filteredItems;
    const lowerQ = itemSearchQuery.toLowerCase();
    return filteredItems.filter(item => 
        (item.name || '').toLowerCase().includes(lowerQ) || 
        (item.sku || '').toLowerCase().includes(lowerQ)
    );
  }, [filteredItems, itemSearchQuery]);

  const reasons = [
      "Damage / Spoilage",
      "Correction / Miscount",
      "Initial Stock Entry",
      "Return to Vendor",
      "Internal Use",
      "Others"
  ];

  const handleAddLine = () => {
      setLines([...lines, { id: Date.now(), itemId: '', type: 'Addition', qty: '', reason: '', customReason: '', remarks: '', outputType: '' }]);
  };

  const handleRemoveLine = (idToRemove) => {
      if (lines.length > 1) {
          setLines(lines.filter(l => l.id !== idToRemove));
      }
  };

  const updateLine = (id, field, value) => {
      setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleProcessAdjustment = async () => {
      // Validate
      const validLines = lines.filter(l => l.itemId && l.qty && l.reason);
      if (validLines.length === 0) {
          addNotification('Error', 'Please complete at least one line (Item, Qty, Reason).', 'error');
          return;
      }
      
      let hasError = false;
      let errorMsg = 'Quantity must be > 0 and Custom Reason must be provided if "Others" is selected.';
      
      validLines.forEach(l => {
          if (parseFloat(l.qty) <= 0) hasError = true;
          if (l.reason === 'Others' && !l.customReason) hasError = true;
          
          const item = state.items.find(i => i.id === l.itemId);
          if (item && item.category === 'Finished Goods' && !l.outputType) {
              hasError = true;
              errorMsg = `Output Type is required for Finished Good: ${item.name}`;
          }
      });

      if (hasError) {
          addNotification('Error', errorMsg, 'error');
          return;
      }

      // Check internet and Supabase connection
      if (!navigator.onLine) {
          appAlert("Network Offline Error\n\nYour internet connection appears to be offline. Please reconnect to the internet and try again.");
          return;
      }

      try {
          const { data, error } = await supabase.from('erp_state').select('id').eq('id', 'main_state').maybeSingle();
          if (error) throw error;
      } catch (err) {
          console.error("Supabase connection check failed:", err);
          appAlert("Cloud Database Sync Error\n\nCould not establish a connection to the central database. Please make sure the database server is online and try again.");
          return;
      }

      // Generate Sequential ID
      let maxIdNum = 0;
      if (state.adjustments && state.adjustments.length > 0) {
          state.adjustments.forEach(adj => {
              if (adj.parentId && adj.parentId.startsWith('ADJ-')) {
                  const numStr = adj.parentId.replace('ADJ-', '');
                  const num = parseInt(numStr, 10);
                  if (!isNaN(num) && num > maxIdNum) {
                      maxIdNum = num;
                  }
              }
          });
      }
      const nextIdNum = maxIdNum + 1;
      const parentId = `ADJ-${nextIdNum.toString().padStart(3, '0')}`;

      const updatedItems = [...state.items];
      const newAdjustments = [];

      validLines.forEach((line, idx) => {
          const qty = parseFloat(line.qty) || 0;
          const netChange = line.type === 'Addition' ? qty : -qty;
          const selectedItem = updatedItems.find(i => i.id === line.itemId);
          
          let targetDept = effectiveDepartments[0] || 'Warehouse';
          if (selectedItem) {
              if (!selectedItem.stockByDepartment) selectedItem.stockByDepartment = {};
              
              // Auto-associate department if not in item mapped list
              const existingDepts = (selectedItem.department || '').split(',').map(d => d.trim()).filter(Boolean);
              if (!existingDepts.includes(targetDept)) {
                  existingDepts.push(targetDept);
                  selectedItem.department = existingDepts.join(', ');
              }
              
              selectedItem.stockByDepartment[targetDept] = (selectedItem.stockByDepartment[targetDept] || 0) + netChange;
              selectedItem.stock = Object.values(selectedItem.stockByDepartment).reduce((sum, val) => sum + Number(val || 0), 0);
              
              // Handle Output Type stock if it's a finished good
              if (selectedItem.category === 'Finished Goods' && line.outputType) {
                  if (!selectedItem.stockByType) selectedItem.stockByType = {};
                  selectedItem.stockByType[line.outputType] = (selectedItem.stockByType[line.outputType] || 0) + netChange;
              }
          }

          newAdjustments.push({
              id: `${parentId}-${idx + 1}`,
              parentId: parentId,
              itemId: line.itemId,
              itemCode: selectedItem?.sku || '',
              itemName: selectedItem?.name || '',
              type: line.type === 'Addition' ? 'add' : 'sub',
              qty: qty,
              reason: line.reason === 'Others' ? line.customReason : line.reason,
              outputType: line.outputType || '',
              remarks: line.remarks,
              department: targetDept,
              addedBy: state?.currentUser?.name || 'Admin',
              date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              timestamp: new Date().getTime()
          });
      });

      const updatedAdjustments = [...newAdjustments, ...(state.adjustments || [])];

      setCollection('items', updatedItems);
      setCollection('adjustments', updatedAdjustments);
      
      setLines([{ id: Date.now(), itemId: '', type: 'Addition', qty: '', reason: '', customReason: '', remarks: '', outputType: '' }]);
      addNotification('Success', `Processed ${validLines.length} stock adjustment(s).`, 'success');
  };

  const handleDiscard = () => {
      setLines([{ id: Date.now(), itemId: '', type: 'Addition', qty: '', reason: '', customReason: '', remarks: '', outputType: '' }]);
  };

  const handlePrint = (act) => {
      if (!act) return;
      const isSub = act.type === 'sub' || act.type === 'Subtraction';
      const varianceVal = isSub ? -Math.abs(parseFloat(act.qty) || 0) : Math.abs(parseFloat(act.qty) || 0);

      setPrintData({
          ...act,
          id: act.id,
          adj_id: act.id,
          date: act.date || new Date().toISOString().split('T')[0],
          approved_by: act.approvedBy || act.user || 'Warehouse Manager',
          reason: act.reason || act.remarks || 'Periodic Stock Audit',
          header: {
              adj_id: act.id,
              date: act.date || new Date().toISOString().split('T')[0],
              approved_by: act.approvedBy || act.user || 'Warehouse Manager',
              reason: act.reason || act.remarks || 'Periodic Stock Audit',
              department: act.department || 'Main Godown',
              type: isSub ? 'Negative Adjustment (Reduction)' : 'Positive Adjustment (Addition)'
          },
          items: [
              {
                  serial_no: 1,
                  item_code: act.itemCode || 'ITEM-001',
                  item_name: act.itemName || 'Adjusted Inventory Item',
                  system_qty: act.prevQty ?? act.systemQty ?? '—',
                  physical_qty: act.newQty ?? act.physicalQty ?? '—',
                  adj_qty: `${varianceVal > 0 ? '+' : ''}${varianceVal}`
              }
          ],
          totals: {
              'Adjusted Quantity': Math.abs(parseFloat(act.qty) || 0),
              'Net Variance': varianceVal
          }
      });
  };

  // Activity generator based on the selected items
  const recentActivities = useMemo(() => {
      if (!state.adjustments || effectiveDepartments.length === 0) return [];
      let acts = state.adjustments;
      // Filter by local department if applicable
      const deptItemIds = filteredItems.map(i => i.id);
      acts = acts.filter(a => deptItemIds.includes(a.itemId));
      return acts.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [state.adjustments, filteredItems, effectiveDepartments]);

  if (showHistory) {
      return <InventoryAdjustmentHistory onBack={() => setShowHistory(false)} />;
  }

  return (
    <>
    <div className="animate-in fade-in duration-500 max-w-full px-6 mx-auto pb-4">
      {/* Header section */}
      <header className="mb-10 flex justify-between items-end">
        <div>
            {/* Added onBack handler */}
            {onBack && (
               <button 
                  onClick={onBack}
                  className="mb-4 text-primary font-bold text-sm flex items-center gap-1 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors -ml-3"
               >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_back</span>
                  Back to Production
               </button>
            )}
            <h1 className="text-4xl font-extrabold text-on-surface tracking-tight mb-2 font-headline">Manual Stock Adjustment</h1>
            <p className="text-on-surface-variant font-body">Correct inventory discrepancies with high-precision tracking.</p>
        </div>
        <div className="flex items-center gap-4">
              {selectedDepartments.length === 0 && (
                  <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Department:</span>
                      <div className="w-[200px] z-50 relative">
                          <select
                              value={localDepartments[0] || ''}
                              onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalDepartments(val ? [val] : []);
                                  // Clear selections if department changes
                                  setLines([{ id: Date.now(), itemId: '', type: 'Addition', qty: '', reason: '', customReason: '', remarks: '', outputType: '' }]);
                              }}
                              className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg py-2.5 px-4 text-sm font-body text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:border-outline-variant/40 transition-all cursor-pointer font-bold"
                          >
                              <option value="" disabled>Select Department...</option>
                              {(state?.departments || []).map(dept => (
                                  <option key={dept.id || dept.value} value={dept.value || dept.name}>
                                      {dept.label || dept.name}
                                  </option>
                              ))}
                          </select>
                      </div>
                  </div>
              )}
            <button 
                onClick={() => setShowHistory(true)}
                className="bg-surface-container-low text-on-surface-variant border border-outline-variant/20 rounded-lg px-6 py-3 font-body font-medium flex items-center gap-2 hover:bg-surface-container transition-colors shadow-sm"
            >
                <span className="material-symbols-outlined text-[1.25rem]">history</span>
                Adjustment History
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Form Section */}
        <section className="xl:col-span-8 space-y-8">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-[0_20px_40px_rgba(0,28,56,0.06)] p-8">
            <form className="space-y-6">
                
              {lines.map((line, index) => {
                  const selectedItem = filteredItems.find(i => i.id === line.itemId);
                  return (
                  <div key={line.id} className="p-6 bg-surface border border-outline-variant/10 rounded-xl relative group">
                      {lines.length > 1 && (
                          <button 
                              type="button" 
                              onClick={() => handleRemoveLine(line.id)}
                              className="absolute -right-3 -top-3 w-8 h-8 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                          >
                              <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                      )}
                      <h4 className="text-xs font-bold text-outline-variant uppercase tracking-widest mb-4 border-b border-outline-variant/10 pb-2">Line {index + 1}</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          {/* Searchable Item Selection */}
                          <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-bold text-on-surface tracking-wide uppercase text-[10px]">Select Item</label>
                              <FGCombinationBuilder compact={true} allowCreation={false} onSelectItem={(chosen) => { updateLine(line.id, 'itemId', chosen.id); setItemSearchQuery(''); setOpenItemDropdownId(null); }} />
                            </div>
                            <div 
                                className="relative cursor-pointer"
                                onClick={() => setOpenItemDropdownId(openItemDropdownId === line.id ? null : line.id)}
                            >
                              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary" style={{ fontVariationSettings: "'FILL' 0" }}>inventory_2</span>
                              <input 
                                  type="text"
                                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-12 pr-10 py-4 focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all outline-none font-medium text-sm text-on-surface cursor-pointer"
                                  placeholder="Search or select an item..."
                                  value={openItemDropdownId === line.id ? itemSearchQuery : (selectedItem ? `${selectedItem.name} (${selectedItem.sku})` : '')}
                                  onChange={(e) => {
                                      setItemSearchQuery(e.target.value);
                                      setOpenItemDropdownId(line.id);
                                      if (e.target.value === '') updateLine(line.id, 'itemId', '');
                                  }}
                                  onFocus={() => {
                                      setOpenItemDropdownId(line.id);
                                      setItemSearchQuery('');
                                  }}
                              />
                              <span className={`material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant transition-transform duration-300 pointer-events-none ${openItemDropdownId === line.id ? 'rotate-180' : ''}`}>expand_more</span>
                            </div>
                            
                            {openItemDropdownId === line.id && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenItemDropdownId(null)}></div>
                                    <div className="absolute z-50 w-full mt-2 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                                        {searchedItems.length > 0 ? (
                                            <ul className="py-2">
                                                {searchedItems.map(item => (
                                                    <li 
                                                        key={item.id}
                                                        className="px-4 py-3 hover:bg-surface-container-low cursor-pointer flex items-center gap-3 transition-colors group"
                                                        onClick={() => {
                                                            updateLine(line.id, 'itemId', item.id);
                                                            setOpenItemDropdownId(null);
                                                            setItemSearchQuery('');
                                                        }}
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                            <span className="material-symbols-outlined text-[16px]">conveyor_belt</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{item.name}</p>
                                                            <p className="text-[10px] font-mono text-outline-variant">{item.sku}</p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="p-6 text-center text-on-surface-variant text-sm">
                                                No items found
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                          </div>
                          
                          {/* Adjustment Type & Quantity */}
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-sm font-bold text-on-surface mb-2 tracking-wide uppercase text-[10px]">Type</label>
                                  <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/20 h-[54px]">
                                      <button 
                                          onClick={() => updateLine(line.id, 'type', 'Addition')}
                                          className={`flex-1 flex items-center justify-center rounded-lg font-bold text-xs transition-all ${line.type === 'Addition' ? 'bg-primary-container text-on-primary-container shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'}`} 
                                          type="button"
                                      >
                                          + Add
                                      </button>
                                      <button 
                                          onClick={() => updateLine(line.id, 'type', 'Subtraction')}
                                          className={`flex-1 flex items-center justify-center rounded-lg font-bold text-xs transition-all ${line.type === 'Subtraction' ? 'bg-error-container text-error shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'}`} 
                                          type="button"
                                      >
                                          - Sub
                                      </button>
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-sm font-bold text-on-surface mb-2 tracking-wide uppercase text-[10px]">Quantity</label>
                                  <div className="relative">
                                      <input 
                                          value={line.qty}
                                          onChange={(e) => updateLine(line.id, 'qty', e.target.value)}
                                          className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 h-[54px] focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all outline-none text-on-surface font-mono font-bold" 
                                          placeholder="0.00" 
                                          type="number" 
                                      />
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className={`grid grid-cols-1 md:grid-cols-${selectedItem && selectedItem.category === 'Finished Goods' ? '3' : '2'} gap-6`}>
                          {/* Reason */}
                          <div className="relative">
                            <label className="block text-sm font-bold text-on-surface mb-2 tracking-wide uppercase text-[10px]">Reason</label>
                            <div 
                                className="relative cursor-pointer"
                                onClick={() => setOpenReasonDropdownId(openReasonDropdownId === line.id ? null : line.id)}
                            >
                              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant" style={{ fontVariationSettings: "'FILL' 0" }}>help</span>
                              <div className={`w-full bg-surface-container-low border rounded-xl pl-12 pr-10 py-4 transition-all outline-none text-sm font-medium ${openReasonDropdownId === line.id ? 'border-primary ring-2 ring-primary/20 bg-surface-container-lowest' : 'border-outline-variant/20 hover:bg-surface-container'} ${line.reason ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                                  {line.reason || "Select a reason..."}
                              </div>
                              <span className={`material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant transition-transform duration-300 pointer-events-none ${openReasonDropdownId === line.id ? 'rotate-180' : ''}`}>expand_more</span>
                            </div>
                            
                            {openReasonDropdownId === line.id && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenReasonDropdownId(null)}></div>
                                    <div className="absolute z-50 w-full mt-2 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2">
                                        <ul className="py-1">
                                            {reasons.map(r => (
                                                <li 
                                                    key={r}
                                                    className={`px-4 py-3 hover:bg-surface-container-low cursor-pointer text-sm font-medium transition-colors ${line.reason === r ? 'bg-primary/5 text-primary' : 'text-on-surface'}`}
                                                    onClick={() => {
                                                        updateLine(line.id, 'reason', r);
                                                        setOpenReasonDropdownId(null);
                                                    }}
                                                >
                                                    {r}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            )}
                          </div>

                          {/* Custom Reason / Remarks */}
                          <div>
                            {line.reason === 'Others' ? (
                                <>
                                    <label className="block text-sm font-bold text-on-surface mb-2 tracking-wide uppercase text-[10px] text-primary">Custom Reason *</label>
                                    <input 
                                        type="text"
                                        value={line.customReason}
                                        onChange={(e) => updateLine(line.id, 'customReason', e.target.value)}
                                        className="w-full bg-surface-container-low border border-primary/40 rounded-xl px-4 py-4 focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all outline-none text-sm text-on-surface" 
                                        placeholder="Specify custom reason..." 
                                    />
                                </>
                            ) : (
                                <>
                                    <label className="block text-sm font-bold text-on-surface mb-2 tracking-wide uppercase text-[10px]">Remarks (Optional)</label>
                                    <input 
                                        type="text"
                                        value={line.remarks}
                                        onChange={(e) => updateLine(line.id, 'remarks', e.target.value)}
                                        className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-4 focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all outline-none text-sm text-on-surface" 
                                        placeholder="Add notes..." 
                                    />
                                </>
                            )}
                          </div>
                          
                          {/* Output Type (Only for Finished Goods) */}
                          {selectedItem && selectedItem.category === 'Finished Goods' && (
                              <div className="relative">
                                  <label className="block text-sm font-bold text-on-surface mb-2 tracking-wide uppercase text-[10px] text-primary">Output Type *</label>
                                  <div className="relative">
                                      <select
                                          className={`w-full bg-surface-container-low border rounded-xl px-4 py-4 focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all outline-none text-sm font-medium appearance-none ${line.outputType ? 'border-primary ring-2 ring-primary/20 bg-surface-container-lowest text-on-surface' : 'border-outline-variant/20 hover:bg-surface-container text-on-surface-variant'}`}
                                          value={line.outputType || ''}
                                          onChange={(e) => updateLine(line.id, 'outputType', e.target.value)}
                                      >
                                          <option value="" disabled>Select Output Type...</option>
                                          {(state?.batchOutputTypes || []).map(t => (
                                              <option key={t.id} value={t.name}>{t.name}</option>
                                          ))}
                                      </select>
                                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none">expand_more</span>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
                  );
              })}

              <div className="flex justify-center">
                  <button 
                      type="button"
                      onClick={handleAddLine}
                      className="text-primary font-bold text-sm px-6 py-3 rounded-xl hover:bg-primary/5 border border-dashed border-primary/30 hover:border-primary/60 transition-colors flex items-center gap-2"
                  >
                      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                      Add Another Item
                  </button>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t border-outline-variant/10">
                <button onClick={handleDiscard} className="px-8 py-4 rounded-xl text-on-surface-variant font-bold hover:bg-surface-container transition-colors" type="button">Discard</button>
                <button onClick={handleProcessAdjustment} className="px-10 py-4 rounded-xl bg-gradient-to-br from-primary to-primary-container text-white font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all" type="button">Process Adjustment</button>
              </div>
            </form>
          </div>
        </section>

        {/* Reference / Reference Info Section */}
        <aside className="xl:col-span-4 space-y-6">
          {/* Expanded Recent History Bento */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 shadow-sm flex flex-col min-h-[550px] flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-on-surface tracking-widest uppercase flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">history</span>
                  Recent Activity
              </h3>
              <button onClick={() => setShowHistory(true)} className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors">View All</button>
            </div>
            
            <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {recentActivities.length > 0 ? recentActivities.map(act => (
                  <div key={act.id} className="flex flex-col gap-2 p-4 bg-surface rounded-xl border border-outline-variant/5 hover:border-outline-variant/20 hover:shadow-sm transition-all group">
                    <div className="flex justify-between items-start">
                        <p className="font-bold text-sm text-on-surface line-clamp-1">{act.itemName}</p>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] font-bold text-outline-variant">{act.date}</p>
                            <button onClick={() => handlePrint(act)} className="text-outline-variant hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-[14px]">print</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <p className={`text-lg font-black ${act.type === 'sub' ? 'text-error' : 'text-primary'}`}>
                            {act.type === 'sub' ? '-' : '+'}{act.qty} <span className="text-xs font-bold opacity-70">Units</span>
                        </p>
                        <span className="text-[10px] bg-surface-container-low px-2 py-1 rounded-md text-on-surface-variant font-medium max-w-[120px] truncate" title={act.reason}>
                            {act.reason}
                        </span>
                    </div>
                  </div>
              )) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                      <span className="material-symbols-outlined text-4xl text-outline-variant/30 mb-2">history</span>
                      <p className="text-sm font-bold text-on-surface-variant">No recent activity</p>
                  </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>

    {printData && (
      <UniversalPrintPreviewModal
        isOpen={Boolean(printData)}
        onClose={() => setPrintData(null)}
        documentType="inventory_adjustment"
        documentData={printData}
        documentTitle={`Stock Adjustment #${printData.id}`}
      />
    )}
    </>
  );
}
