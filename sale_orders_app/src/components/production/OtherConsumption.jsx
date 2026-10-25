import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import CustomMultiSelect from '../ui/CustomMultiSelect';
import UniversalPrintStudioModal from '../ui/UniversalPrintStudioModal';
import { buildOtherConsumptionRecord } from '../../utils/printRecords';

export default function OtherConsumption() {
    const { state, setCollection, setDirty } = useApp();
    const { appConfirm, appAlert } = useDialog();

    // Form states
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [selectedDept, setSelectedDept] = useState([]);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [qtyInput, setQtyInput] = useState('');
    const [pendingEntries, setPendingEntries] = useState([]);

    // Modal open states
    const [printRecord, setPrintRecord] = useState(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [editQty, setEditQty] = useState('');

    // Dropdown open states
    const [planDropdownOpen, setPlanDropdownOpen] = useState(false);
    const [itemDropdownOpen, setItemDropdownOpen] = useState(false);
    const [itemSearch, setItemSearch] = useState('');
    const [historySearch, setHistorySearch] = useState('');

    // Helper: calculate total non-wastage output for a plan item
    const getItemProducedQty = (item) => {
        let total = 0;
        (item.outputs || []).forEach(out => {
            const qty = parseFloat(out.quantity) || 0;
            const isWastage = out.typeName?.toLowerCase().includes('wastage');
            if (!isWastage) {
                total += qty;
            }
        });
        return total;
    };

    // Helper: check if a plan has any non-wastage output recorded
    const hasPlanOutputs = (plan) => {
        return (plan.items || []).some(item => {
            const outputs = item.outputs || [];
            return outputs.some(out => {
                const qty = parseFloat(out.quantity) || 0;
                const isWastage = out.typeName?.toLowerCase().includes('wastage');
                return qty > 0 && !isWastage;
            });
        });
    };

    // Filter plans: ONLY show plans that have outputs recorded
    const plansList = useMemo(() => {
        return (state.productionPlans || []).filter(p => p.status !== 'Cancelled' && hasPlanOutputs(p));
    }, [state.productionPlans]);

    // Selected plan details
    const selectedPlan = useMemo(() => {
        return (state.productionPlans || []).find(p => p.id === selectedPlanId);
    }, [selectedPlanId, state.productionPlans]);

    // Total outputs of the selected plan
    const selectedPlanTotalOutputs = useMemo(() => {
        if (!selectedPlan) return 0;
        return selectedPlan.items.reduce((sum, item) => sum + getItemProducedQty(item), 0);
    }, [selectedPlan]);

    // Filter raw materials for consumption selection
    const rawMaterials = useMemo(() => {
        return (state.items || []).filter(i => i.type === 'Raw Material' || i.category === 'Raw Material');
    }, [state.items]);

    // Filtered materials based on search term
    const filteredMaterials = useMemo(() => {
        if (!itemSearch) return rawMaterials;
        const lower = itemSearch.toLowerCase();
        return rawMaterials.filter(m => 
            m.name.toLowerCase().includes(lower) || 
            (m.sku && m.sku.toLowerCase().includes(lower))
        );
    }, [rawMaterials, itemSearch]);

    // Find details of the selected item in the form
    const selectedItem = useMemo(() => {
        return rawMaterials.find(i => i.id === selectedItemId);
    }, [selectedItemId, rawMaterials]);

    // Add entry to pending list
    const handleAddEntry = () => {
        if (!selectedItemId) {
            appAlert('Please select an item to consume.', 'error');
            return;
        }
        const qty = parseFloat(qtyInput);
        if (isNaN(qty) || qty <= 0) {
            appAlert('Please enter a valid positive quantity.', 'error');
            return;
        }

        // Check if item already exists in pending list
        if (pendingEntries.some(e => e.itemId === selectedItemId)) {
            appAlert('This item is already added to the list.', 'warning');
            return;
        }

        const priceStr = selectedItem.price ? String(selectedItem.price).replace(/[^0-9.]/g, '') : '0';
        const price = parseFloat(priceStr) || 0;

        setPendingEntries(prev => [
            ...prev,
            {
                itemId: selectedItem.id,
                itemCode: selectedItem.sku || selectedItem.id,
                itemName: selectedItem.name,
                unit: selectedItem.uom || 'kg',
                price: price,
                quantity: qty,
                cost: qty * price
            }
        ]);

        // Reset item selector
        setSelectedItemId('');
        setItemSearch('');
        setQtyInput('');
    };

    // Remove entry from pending list
    const handleRemoveEntry = (index) => {
        setPendingEntries(prev => prev.filter((_, i) => i !== index));
    };

    // Save consumption data
    const handleSave = async () => {
        if (!selectedPlanId) {
            appAlert('Please select a production plan.', 'error');
            return;
        }
        if (selectedDept.length === 0) {
            appAlert('Please select at least one source department.', 'error');
            return;
        }
        if (pendingEntries.length === 0) {
            appAlert('Please add at least one consumed item to record.', 'error');
            return;
        }

        // 1. Verify stock availability in department
        const dept = selectedDept[0];
        const shortages = [];
        pendingEntries.forEach(entry => {
            const itemInDb = state.items.find(i => i.id === entry.itemId);
            const deptStock = itemInDb?.stockByDepartment?.[dept] || 0;
            if (entry.quantity > deptStock) {
                shortages.push(`${entry.itemName} (Needs ${entry.quantity}${entry.unit}, but only ${deptStock}${entry.unit} is available in ${dept})`);
            }
        });

        if (shortages.length > 0) {
            appAlert(`Insufficient stock in selected department:\n- ${shortages.join('\n- ')}`, 'error');
            return;
        }

        // 2. Decrement stock levels
        const updatedItems = (state.items || []).map(item => {
            const entry = pendingEntries.find(e => e.itemId === item.id);
            if (entry) {
                const nextItem = { ...item };
                if (!nextItem.stockByDepartment) nextItem.stockByDepartment = {};
                nextItem.stockByDepartment = { ...nextItem.stockByDepartment };
                
                nextItem.stockByDepartment[dept] = Math.max(0, (nextItem.stockByDepartment[dept] || 0) - entry.quantity);
                nextItem.stock = Object.values(nextItem.stockByDepartment).reduce((sum, v) => sum + Number(v || 0), 0);
                return nextItem;
            }
            return item;
        });

        // 3. Create other consumptions records
        const newRecords = pendingEntries.map(entry => ({
            id: 'OC-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            planId: selectedPlanId,
            itemId: entry.itemId,
            itemCode: entry.itemCode,
            itemName: entry.itemName,
            unit: entry.unit,
            price: entry.price,
            quantity: entry.quantity,
            cost: entry.cost,
            department: dept,
            date: new Date().toISOString()
        }));

        const nextOtherConsumptions = [
            ...(state.otherConsumptions || []),
            ...newRecords
        ];

        setCollection('items', updatedItems);
        setCollection('otherConsumptions', nextOtherConsumptions);
        setDirty(true);

        setPendingEntries([]);
        appAlert('Other consumption recorded and distributed proportionally successfully!', 'success');
    };

    // Delete a previously recorded other consumption record
    const handleDeleteRecord = async (recordId) => {
        const record = (state.otherConsumptions || []).find(r => r.id === recordId);
        if (!record) return;

        const proceed = await appConfirm(
            `Are you sure you want to delete this consumption record? This will add back ${record.quantity}${record.unit} of ${record.itemName} to the ${record.department} stock.`,
            'Delete Record',
            'Delete',
            'Cancel'
        );
        if (!proceed) return;

        // Restore stock
        const updatedItems = (state.items || []).map(item => {
            if (item.id === record.itemId) {
                const nextItem = { ...item };
                if (!nextItem.stockByDepartment) nextItem.stockByDepartment = {};
                nextItem.stockByDepartment = { ...nextItem.stockByDepartment };
                nextItem.stockByDepartment[record.department] = (nextItem.stockByDepartment[record.department] || 0) + record.quantity;
                nextItem.stock = Object.values(nextItem.stockByDepartment).reduce((sum, v) => sum + Number(v || 0), 0);
                return nextItem;
            }
            return item;
        });

        const nextOtherConsumptions = (state.otherConsumptions || []).filter(r => r.id !== recordId);
        setCollection('items', updatedItems);
        setCollection('otherConsumptions', nextOtherConsumptions);
        setDirty(true);
        appAlert('Record deleted and stock restored.', 'success');
    };

    // Open Edit overlay
    const startEditing = (record) => {
        setEditingRecord(record);
        setEditQty(record.quantity.toString());
    };

    // Save edited consumption record
    const handleSaveEdit = () => {
        if (!editingRecord) return;
        const newQty = parseFloat(editQty);
        if (isNaN(newQty) || newQty <= 0) {
            appAlert('Please enter a valid positive quantity.', 'error');
            return;
        }

        const diff = newQty - editingRecord.quantity;
        const itemInDb = state.items.find(i => i.id === editingRecord.itemId);
        const deptStock = itemInDb?.stockByDepartment?.[editingRecord.department] || 0;

        if (diff > 0 && diff > deptStock) {
            appAlert(`Insufficient stock in ${editingRecord.department}. Available: ${deptStock}${editingRecord.unit}.`, 'error');
            return;
        }

        // Adjust stock
        const updatedItems = (state.items || []).map(item => {
            if (item.id === editingRecord.itemId) {
                const nextItem = { ...item };
                if (!nextItem.stockByDepartment) nextItem.stockByDepartment = {};
                nextItem.stockByDepartment = { ...nextItem.stockByDepartment };
                nextItem.stockByDepartment[editingRecord.department] = Math.max(0, (nextItem.stockByDepartment[editingRecord.department] || 0) - diff);
                nextItem.stock = Object.values(nextItem.stockByDepartment).reduce((sum, v) => sum + Number(v || 0), 0);
                return nextItem;
            }
            return item;
        });

        // Update record
        const updatedCost = newQty * (parseFloat(editingRecord.price) || 0);
        const nextOtherConsumptions = (state.otherConsumptions || []).map(oc => {
            if (oc.id === editingRecord.id) {
                return {
                    ...oc,
                    quantity: newQty,
                    cost: updatedCost
                };
            }
            return oc;
        });

        setCollection('items', updatedItems);
        setCollection('otherConsumptions', nextOtherConsumptions);
        setDirty(true);
        setEditingRecord(null);
        appAlert('Consumption record updated successfully.', 'success');
    };

    // Print a specific consumption voucher
    const handlePrintRecord = (oc) => {
        // Studio print (2026-10-25): the voucher opens in the Universal
        // Print Studio with the same single record the old popup voucher
        // printed — document 'other_consumptions'.
        setPrintRecord(buildOtherConsumptionRecord(oc));
    };

    // Filter history entries by search query
    const filteredHistory = useMemo(() => {
        const query = historySearch.toLowerCase();
        return (state.otherConsumptions || []).filter(oc => 
            oc.planId.toLowerCase().includes(query) || 
            oc.itemName.toLowerCase().includes(query) ||
            oc.department.toLowerCase().includes(query)
        ).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [state.otherConsumptions, historySearch]);

    return (
        <div className="flex flex-col h-full bg-background p-8 lg:px-12 overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
            
            {/* Header / View Actions */}
            <div className="flex justify-between items-center mb-10 flex-wrap gap-4 border-b border-outline-variant/10 pb-6">
                <div>
                    <h2 className="font-display text-4xl font-extrabold text-on-surface tracking-tight font-manrope">Other Item Consumption</h2>
                    <p className="text-on-surface-variant font-body text-sm mt-1 max-w-xl">
                        Record general expenses (Diesel, LPG, etc.) and distribute them proportionally across plans based on actual item output.
                    </p>
                </div>
                <div>
                    <button 
                        onClick={() => setHistoryOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-surface-container-highest text-on-surface font-label font-semibold hover:bg-surface-dim transition-colors shadow-sm"
                    >
                        <span className="material-symbols-outlined text-base">history</span>
                        View History
                    </button>
                </div>
            </div>

            {/* Core Redesigned centered card */}
            <div className="max-w-3xl mx-auto w-full mb-10">
                <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-[2.5rem] p-10 shadow-lg flex flex-col gap-8">
                    
                    <div>
                        <h3 className="text-xl font-manrope font-extrabold text-on-surface flex items-center gap-2 border-b border-outline-variant/10 pb-4">
                            <span className="material-symbols-outlined text-primary text-2xl">edit_document</span>
                            Record Material Consumption Form
                        </h3>
                        <p className="text-xs text-on-surface-variant mt-2 font-medium">Select target plan, source department, and record the general materials consumed.</p>
                    </div>

                    {/* Step 1: Select Plan & Department */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Custom Plan Dropdown */}
                        <div className="relative">
                            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Production Plan (With Output)</label>
                            <button 
                                onClick={() => setPlanDropdownOpen(prev => !prev)}
                                className="w-full text-left bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-semibold flex justify-between items-center text-on-surface hover:bg-surface-container-high transition-colors"
                            >
                                <span>{selectedPlanId ? selectedPlanId : 'Select Plan with Output'}</span>
                                <span className="material-symbols-outlined">arrow_drop_down</span>
                            </button>

                            {planDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setPlanDropdownOpen(false)}></div>
                                    <div className="absolute left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto py-2 custom-scrollbar">
                                        {plansList.length > 0 ? (
                                            plansList.map(p => {
                                                const totOut = p.items?.reduce((s, i) => s + getItemProducedQty(i), 0) || 0;
                                                return (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => {
                                                            setSelectedPlanId(p.id);
                                                            setPlanDropdownOpen(false);
                                                        }}
                                                        className="w-full text-left px-4 py-3 hover:bg-surface-container-low transition-colors text-xs font-semibold text-on-surface border-b border-outline-variant/5 last:border-none"
                                                    >
                                                        <div className="font-bold text-primary mb-0.5 text-left">{p.id}</div>
                                                        <div className="text-[10px] text-on-surface-variant text-left truncate mb-0.5">
                                                            Items: {p.items?.map(i => i.productName).join(', ')}
                                                        </div>
                                                        <div className="text-[9px] text-tertiary text-left font-bold">
                                                            Total Output Yield: {totOut.toLocaleString()} m
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <div className="px-4 py-3 text-xs text-on-surface-variant italic">No production plans with completed outputs found.</div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Department Selection */}
                        <div>
                            <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Source Department</label>
                            <CustomMultiSelect
                                options={state.departments?.filter(d => d.itemTypes?.includes('Raw Material')).map(dept => ({ label: dept.label, value: dept.value })) || []}
                                selectedValues={selectedDept}
                                onChange={setSelectedDept}
                                placeholder="Select Source Department"
                            />
                        </div>
                    </div>

                    {/* Step 2: Add Raw Material */}
                    <div className="border-t border-outline-variant/10 pt-6">
                        <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Add Consumed Item</label>
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            
                            {/* Searchable Material Selector */}
                            <div className="flex-1 relative w-full">
                                <input 
                                    type="text" 
                                    placeholder="Search Material (e.g. Diesel, LPG)"
                                    value={itemSearch}
                                    onChange={e => {
                                        setItemSearch(e.target.value);
                                        setItemDropdownOpen(true);
                                    }}
                                    onFocus={() => setItemDropdownOpen(true)}
                                    className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
                                />

                                {itemDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setItemDropdownOpen(false)}></div>
                                        <ul className="absolute left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto py-1 custom-scrollbar">
                                            {filteredMaterials.length > 0 ? (
                                                filteredMaterials.map(m => (
                                                    <li
                                                        key={m.id}
                                                        onClick={() => {
                                                            setSelectedItemId(m.id);
                                                            setItemSearch(m.name);
                                                            setItemDropdownOpen(false);
                                                        }}
                                                        className="px-4 py-2.5 text-xs hover:bg-surface-container-low cursor-pointer font-semibold text-on-surface flex justify-between border-b border-outline-variant/5 last:border-none"
                                                    >
                                                        <span>{m.name}</span>
                                                        <span className="text-primary-dim font-bold">{m.sku}</span>
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="px-4 py-3 text-xs text-on-surface-variant italic">No raw materials found.</li>
                                            )}
                                        </ul>
                                    </>
                                )}
                            </div>

                            {/* Qty Input */}
                            <div className="w-full md:w-32">
                                <input 
                                    type="number"
                                    placeholder="Qty"
                                    value={qtyInput}
                                    onChange={e => setQtyInput(e.target.value)}
                                    className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary text-on-surface text-right"
                                />
                            </div>

                            {/* Add Button */}
                            <button 
                                onClick={handleAddEntry}
                                className="px-6 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                <span className="material-symbols-outlined text-lg font-bold">add</span>
                                Add Item
                            </button>
                        </div>
                    </div>

                    {/* Pending Entries Table */}
                    {pendingEntries.length > 0 && (
                        <div className="border border-outline-variant/10 rounded-2xl overflow-hidden mt-2">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-surface-container-low text-on-surface-variant font-bold">
                                        <th className="py-3 px-4">Material Name</th>
                                        <th className="py-3 px-4 text-right">Unit Price</th>
                                        <th className="py-3 px-4 text-right">Quantity</th>
                                        <th className="py-3 px-4 text-right">Estimated Cost</th>
                                        <th className="py-3 px-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingEntries.map((e, index) => (
                                        <tr key={e.itemId} className="border-b border-outline-variant/5 hover:bg-surface-container-low/20 transition-colors">
                                            <td className="py-3 px-4 font-semibold">{e.itemName}</td>
                                            <td className="py-3 px-4 text-right font-medium">${e.price.toFixed(2)}</td>
                                            <td className="py-3 px-4 text-right font-bold">{e.quantity} {e.unit}</td>
                                            <td className="py-3 px-4 text-right font-bold text-primary">${e.cost.toFixed(2)}</td>
                                            <td className="py-3 px-4 text-center">
                                                <button onClick={() => handleRemoveEntry(index)} className="p-1 hover:bg-error/10 hover:text-error text-on-surface-variant rounded transition-colors">
                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Record Submit Button */}
                    <button
                        onClick={handleSave}
                        className="w-full py-4 mt-2 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white font-bold text-sm shadow-[0_8px_16px_rgba(0,66,119,0.2)] hover:opacity-95 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        Record & Distribute Consumption
                    </button>
                </div>
            </div>

            {/* View History Modal */}
            {historyOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
                    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-[2.5rem] shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-8 py-6 border-b border-outline-variant/10 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold font-manrope text-on-surface">Other Consumption History</h3>
                                <p className="text-xs text-on-surface-variant">Ledger of general item consumptions recorded and distributed across plans.</p>
                            </div>
                            <button 
                                onClick={() => setHistoryOpen(false)}
                                className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Search bar */}
                        <div className="px-8 py-4 border-b border-outline-variant/5 bg-surface-container/20">
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
                                <input 
                                    type="text"
                                    placeholder="Search by Plan ID, Material Name, or Department..."
                                    value={historySearch}
                                    onChange={e => setHistorySearch(e.target.value)}
                                    className="w-full bg-surface-container border border-outline-variant/20 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
                                />
                            </div>
                        </div>

                        {/* History Table Container */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[850px]">
                                <thead>
                                    <tr className="bg-surface-container-low text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">
                                        <th className="py-4 px-4">Plan Ref</th>
                                        <th className="py-4 px-4">Material Item</th>
                                        <th className="py-4 px-4">Source Dept</th>
                                        <th className="py-4 px-4 text-right">Quantity</th>
                                        <th className="py-4 px-4 text-right">Total Cost</th>
                                        <th className="py-4 px-4">Date Recorded</th>
                                        <th className="py-4 px-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant/10 text-xs">
                                    {filteredHistory.length > 0 ? (
                                        filteredHistory.map(oc => (
                                            <tr key={oc.id} className="hover:bg-surface-container-low/30 transition-colors">
                                                <td className="py-3 px-4 font-bold text-primary">{oc.planId}</td>
                                                <td className="py-3 px-4 font-semibold text-on-surface">{oc.itemName}</td>
                                                <td className="py-3 px-4 font-semibold text-on-surface">{oc.department}</td>
                                                <td className="py-3 px-4 text-right font-bold">{oc.quantity} {oc.unit}</td>
                                                <td className="py-3 px-4 text-right font-black text-primary">${(oc.cost || 0).toFixed(2)}</td>
                                                <td className="py-3 px-4 text-on-surface-variant font-semibold">
                                                    {new Date(oc.date).toLocaleDateString()}
                                                </td>
                                                <td className="py-3 px-4 text-center flex items-center justify-center gap-1">
                                                    <button 
                                                        onClick={() => handlePrintRecord(oc)}
                                                        className="p-1.5 hover:bg-primary-fixed/20 text-primary-dim rounded-lg transition-colors"
                                                        title="Print Voucher"
                                                    >
                                                        <span className="material-symbols-outlined text-base">print</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => startEditing(oc)}
                                                        className="p-1.5 hover:bg-tertiary-fixed/20 text-tertiary rounded-lg transition-colors"
                                                        title="Edit Quantity"
                                                    >
                                                        <span className="material-symbols-outlined text-base">edit</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteRecord(oc.id)}
                                                        className="p-1.5 hover:bg-error-container text-error rounded-lg transition-colors"
                                                        title="Delete & Restore Stock"
                                                    >
                                                        <span className="material-symbols-outlined text-base">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="py-10 text-center text-on-surface-variant italic">No other consumption logs found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Qty Modal Overlay */}
            {editingRecord && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
                    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-[2rem] shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        <div>
                            <h4 className="text-base font-bold text-on-surface">Edit Consumption Quantity</h4>
                            <p className="text-[11px] text-on-surface-variant">Update consumed quantity for item: <span className="font-bold">{editingRecord.itemName}</span></p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">Department Source</label>
                                <input type="text" value={editingRecord.department} disabled className="w-full bg-surface-container border border-outline-variant/10 rounded-xl px-4 py-2.5 text-xs text-on-surface-variant font-semibold" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">New Quantity ({editingRecord.unit})</label>
                                <input 
                                    type="number" 
                                    value={editQty}
                                    onChange={e => setEditQty(e.target.value)}
                                    className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs text-on-surface font-semibold focus:outline-none focus:ring-1 focus:ring-primary text-right"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end mt-2">
                            <button 
                                onClick={() => setEditingRecord(null)}
                                className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveEdit}
                                className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-white text-xs font-semibold transition-colors"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {printRecord && (
                <UniversalPrintStudioModal
                    isOpen={!!printRecord}
                    onClose={() => setPrintRecord(null)}
                    documentType="other_consumptions"
                    documentData={printRecord}
                />
            )}
        </div>
    );
}
