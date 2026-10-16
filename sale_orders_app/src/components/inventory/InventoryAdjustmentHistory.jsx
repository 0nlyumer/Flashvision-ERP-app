import React, { useState, useMemo } from 'react';
import ResizableHeader from '../ui/ResizableHeader';
import { useApp } from '../../context/AppContext';
import GlobalPagination from '../ui/GlobalPagination';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

export default function InventoryAdjustmentHistory({ onBack }) {
    const { state, setCollection, addNotification } = useApp();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [printData, setPrintData] = useState(null);
    const itemsPerPage = 20;

    const departmentOptions = useMemo(() => {
        const depts = (state.departments || []).map(d => d.label || d.value || d.name);
        return ['All', ...depts];
    }, [state.departments]);

    // Drag and Drop Columns State
    const [columns, setColumns] = useState([
        { id: 'id', label: 'ID & Date', width: 140 },
        { id: 'item', label: 'Item Details', width: 220 },
        { id: 'department', label: 'Department', width: 140 },
        { id: 'typeQty', label: 'Type & Qty', width: 120 },
        { id: 'reason', label: 'Reason & Remarks', width: 200 },
        { id: 'addedBy', label: 'Added By', width: 140 },
        { id: 'editedBy', label: 'Edited Info', width: 160 },
        { id: 'actions', label: 'Actions', width: 120 }
    ]);
    const [draggedColIdx, setDraggedColIdx] = useState(null);

    // Editing State
    const [editingAdjustment, setEditingAdjustment] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    // Prepare data
    const allAdjustments = useMemo(() => {
        let adjs = state.adjustments || [];
        
        if (selectedDepartment && selectedDepartment !== 'All') {
            adjs = adjs.filter(a => {
                const itm = state.items?.find(i => i.id === a.itemId || i.sku === a.itemCode);
                const primaryDept = itm ? (itm.department || '').split(',').map(d => d.trim()).filter(Boolean)[0] : null;
                const adjDept = a.department || primaryDept || '';
                return adjDept.toLowerCase() === selectedDepartment.toLowerCase();
            });
        }

        if (searchQuery) {
            const lowerQ = searchQuery.toLowerCase();
            adjs = adjs.filter(a => 
                (a.id || '').toLowerCase().includes(lowerQ) ||
                (a.itemName || '').toLowerCase().includes(lowerQ) ||
                (a.parentId || '').toLowerCase().includes(lowerQ)
            );
        }
        return adjs.sort((a, b) => b.timestamp - a.timestamp);
    }, [state.adjustments, searchQuery, selectedDepartment]);

    const displayedEvents = state?.isGlobalPaginated
        ? allAdjustments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
        : allAdjustments;

    // --- Column Drag Handlers ---
    const handleDragStart = (e, index) => {
        setDraggedColIdx(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, index) => {
        e.preventDefault();
        if (draggedColIdx === null || draggedColIdx === index) return;
        const newCols = [...columns];
        const draggedItem = newCols.splice(draggedColIdx, 1)[0];
        newCols.splice(index, 0, draggedItem);
        setColumns(newCols);
        setDraggedColIdx(null);
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
            approved_by: act.approvedBy || act.addedBy || act.user || 'Warehouse Manager',
            reason: act.reason || act.remarks || 'Periodic Stock Audit',
            header: {
                adj_id: act.id,
                date: act.date || new Date().toISOString().split('T')[0],
                approved_by: act.approvedBy || act.addedBy || act.user || 'Warehouse Manager',
                reason: act.reason || act.remarks || 'Periodic Stock Audit',
                department: act.department || 'Warehouse',
                type: isSub ? 'Negative Adjustment (Reduction)' : 'Positive Adjustment (Addition)'
            },
            items: [
                {
                    serial_no: 1,
                    item_code: act.itemCode || act.itemId || 'ITEM-001',
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

    // --- CRUD Handlers ---
    const handleDelete = (adjId) => {
        const adj = state.adjustments.find(a => a.id === adjId);
        if (!adj) return;

        const updatedItems = [...state.items];
        const item = updatedItems.find(i => i.id === adj.itemId);
        
        if (item) {
            const qty = parseFloat(adj.qty) || 0;
            const netChange = adj.type === 'add' ? qty : -qty;
            
            const targetDept = adj.department || (item.department || '').split(',').map(d => d.trim()).filter(Boolean)[0] || 'Warehouse';
            if (targetDept) {
                if (!item.stockByDepartment) item.stockByDepartment = {};
                item.stockByDepartment[targetDept] = Math.max(0, (item.stockByDepartment[targetDept] || 0) - netChange);
                item.stock = Object.values(item.stockByDepartment).reduce((sum, val) => sum + Number(val || 0), 0);
            }

            if (item.category === 'Finished Goods' && adj.outputType) {
                if (item.stockByType && item.stockByType[adj.outputType] !== undefined) {
                    item.stockByType[adj.outputType] -= netChange;
                }
            }
        }

        const updatedAdjustments = state.adjustments.filter(a => a.id !== adjId);
        setCollection('items', updatedItems);
        setCollection('adjustments', updatedAdjustments);
        setDeleteConfirmId(null);
        addNotification('Success', 'Adjustment deleted successfully and stock reverted.', 'success');
    };

    const reasonsList = [
        "Damage / Spoilage", "Correction / Miscount", "Initial Stock Entry", 
        "Return to Vendor", "Internal Use", "Others"
    ];

    const saveEdit = () => {
        if (!editingAdjustment) return;
        if (parseFloat(editingAdjustment.qty) <= 0) {
            addNotification('Error', 'Quantity must be greater than 0', 'error');
            return;
        }

        const updatedItems = [...state.items];
        const item = updatedItems.find(i => i.id === editingAdjustment.itemId);
        const originalAdj = state.adjustments.find(a => a.id === editingAdjustment.id);
        
        if (!originalAdj) return;

        const oldQty = parseFloat(originalAdj.qty) || 0;
        const oldNetChange = originalAdj.type === 'add' ? oldQty : -oldQty;
        
        const newQty = parseFloat(editingAdjustment.qty) || 0;
        const newNetChange = originalAdj.type === 'add' ? newQty : -newQty;

        const diff = newNetChange - oldNetChange;

        if (item) {
            const targetDept = originalAdj.department || (item.department || '').split(',').map(d => d.trim()).filter(Boolean)[0] || 'Warehouse';
            if (targetDept) {
                if (!item.stockByDepartment) item.stockByDepartment = {};
                item.stockByDepartment[targetDept] = Math.max(0, (item.stockByDepartment[targetDept] || 0) + diff);
                item.stock = Object.values(item.stockByDepartment).reduce((sum, val) => sum + Number(val || 0), 0);
            }

            if (item.category === 'Finished Goods') {
                if (!item.stockByType) item.stockByType = {};
                
                // If outputType changed, we need to revert the old and apply the new
                if (originalAdj.outputType !== editingAdjustment.outputType) {
                    if (originalAdj.outputType) {
                        item.stockByType[originalAdj.outputType] = (item.stockByType[originalAdj.outputType] || 0) - oldNetChange;
                    }
                    if (editingAdjustment.outputType) {
                        item.stockByType[editingAdjustment.outputType] = (item.stockByType[editingAdjustment.outputType] || 0) + newNetChange;
                    }
                } else if (editingAdjustment.outputType) {
                    item.stockByType[editingAdjustment.outputType] = (item.stockByType[editingAdjustment.outputType] || 0) + diff;
                }
            }
        }

        const updatedAdjustments = state.adjustments.map(a => {
            if (a.id === editingAdjustment.id) {
                return {
                    ...a,
                    qty: newQty,
                    reason: editingAdjustment.reason,
                    remarks: editingAdjustment.remarks,
                    outputType: editingAdjustment.outputType,
                    editedBy: state?.currentUser?.name || 'Admin',
                    editedDate: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                };
            }
            return a;
        });

        setCollection('items', updatedItems);
        setCollection('adjustments', updatedAdjustments);
        setEditingAdjustment(null);
        addNotification('Success', 'Adjustment updated successfully.', 'success');
    };

    // Render cell content based on column id
    const renderCell = (col, adj) => {
        switch (col.id) {
            case 'id':
                return (
                    <div>
                        <p className="font-headline text-sm font-bold text-on-surface">{adj.id}</p>
                        <p className="font-body text-[10px] text-on-surface-variant">{adj.date}</p>
                    </div>
                );
            case 'item':
                return (
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-on-surface">{adj.itemName}</span>
                        <span className="text-[10px] font-mono text-outline-variant">{adj.itemCode}</span>
                        {adj.outputType && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded w-fit mt-1">{adj.outputType}</span>
                        )}
                    </div>
                );
            case 'department': {
                const itm = state.items?.find(i => i.id === adj.itemId || i.sku === adj.itemCode);
                const primaryDept = itm ? (itm.department || '').split(',').map(d => d.trim()).filter(Boolean)[0] : null;
                const displayDept = adj.department || primaryDept || '-';
                return (
                    <span className="text-sm font-semibold text-primary">{displayDept}</span>
                );
            }
            case 'typeQty':
                return (
                    <span className={`text-xs font-bold px-2 py-1 rounded w-fit inline-block ${adj.type === 'add' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                        {adj.type === 'add' ? '+' : '-'}{adj.qty}
                    </span>
                );
            case 'reason':
                return (
                    <div className="flex flex-col max-w-[200px]">
                        <span className="text-sm font-semibold text-on-surface truncate" title={adj.reason}>{adj.reason}</span>
                        {adj.remarks && <span className="text-xs text-on-surface-variant truncate" title={adj.remarks}>{adj.remarks}</span>}
                    </div>
                );
            case 'addedBy':
                return (
                    <span className="text-sm text-on-surface font-medium">{adj.addedBy || 'System'}</span>
                );
            case 'editedBy':
                return (
                    <div className="flex flex-col">
                        <span className="text-sm text-on-surface font-medium">{adj.editedBy || '-'}</span>
                        {adj.editedDate && <span className="text-[10px] text-on-surface-variant">{adj.editedDate}</span>}
                    </div>
                );
            case 'actions':
                return (
                    <div className="flex items-center gap-1">
                        <button onClick={() => handlePrint(adj)} className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-lg transition-colors" title="Print">
                            <span className="material-symbols-outlined text-[1rem]">print</span>
                        </button>
                        <button onClick={() => setEditingAdjustment({...adj})} className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-lg transition-colors" title="Edit">
                            <span className="material-symbols-outlined text-[1rem]">edit</span>
                        </button>
                        {deleteConfirmId === adj.id ? (
                            <div className="flex items-center gap-1 bg-error/10 rounded-lg p-1">
                                <button onClick={() => handleDelete(adj.id)} className="p-1 text-error hover:bg-error/20 rounded transition-colors text-[10px] font-bold">Yes</button>
                                <button onClick={() => setDeleteConfirmId(null)} className="p-1 text-on-surface-variant hover:bg-surface-container rounded transition-colors text-[10px] font-bold">No</button>
                            </div>
                        ) : (
                            <button onClick={() => setDeleteConfirmId(adj.id)} className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-colors" title="Delete">
                                <span className="material-symbols-outlined text-[1rem]">delete</span>
                            </button>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="animate-in fade-in zoom-in-95 duration-300">
            {/* Page Header */}
            <div className="pt-8 pb-8 flex justify-between items-end">
                <div className="space-y-2">
                    <p className="font-body text-sm text-on-surface-variant uppercase tracking-widest font-semibold">Inventory</p>
                    <h2 className="text-4xl font-extrabold text-on-surface tracking-tight font-manrope">Adjustment History</h2>
                    <p className="font-body text-on-surface-variant max-w-2xl mt-4">Registry of all manual stock corrections and adjustments.</p>
                </div>
                {onBack && (
                    <button onClick={onBack} className="bg-surface-container-low text-on-surface-variant border border-outline-variant/20 rounded-lg px-6 py-3 font-body font-medium flex items-center gap-2 hover:bg-surface-container transition-colors shadow-sm">
                        <span className="material-symbols-outlined text-[1.25rem]">arrow_back</span> Back
                    </button>
                )}
            </div>

            {/* Filter/Search Bar */}
            <div className="mb-8 z-30 sticky top-4 hidden md:block print:hidden">
                <div className="bg-surface-variant/80 backdrop-blur-xl rounded-xl px-6 py-4 flex items-center justify-between gap-6 shadow-[0_20px_40px_rgba(0,28,56,0.06)] border border-outline-variant/15">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
                        <input 
                            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg py-3 pl-12 pr-4 text-sm font-body text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:border-outline-variant/40 transition-all focus:ring-0" 
                            placeholder="Search by Adjustment ID, Parent ID, or Item Name..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {/* Department Dropdown Filter */}
                    <div className="w-72 shrink-0">
                        <select 
                            value={selectedDepartment}
                            onChange={e => { setSelectedDepartment(e.target.value); setCurrentPage(1); }}
                            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg py-3 px-4 text-sm font-body text-on-surface focus:outline-none focus:bg-surface-container-lowest focus:border-outline-variant/40 transition-all focus:ring-0 cursor-pointer"
                        >
                            {departmentOptions.map(dept => (
                                <option key={dept} value={dept}>
                                    {dept === 'All' ? 'All Departments' : dept}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="pb-20 flex-1 print:pb-0">
                <div className="bg-surface-container-lowest rounded-xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] border border-outline-variant/15 overflow-hidden">
                    <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                            <thead>
                                <tr className="bg-surface-container-highest/30 text-on-surface-variant font-body text-xs tracking-wider uppercase border-b border-outline-variant/15">
                                    {columns.map((col, idx) => (
                                        <ResizableHeader 
                                            key={col.id} 
                                            className="py-4 px-6 font-semibold cursor-grab active:cursor-grabbing" 
                                            defaultWidth={col.width}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, idx)}
                                            onDragOver={(e) => handleDragOver(e, idx)}
                                            onDrop={(e) => handleDrop(e, idx)}
                                        >
                                            {col.label}
                                        </ResizableHeader>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {displayedEvents.map((adj) => (
                                    <tr key={adj.id} className="border-b border-outline-variant/10 hover:bg-surface-bright transition-colors group">
                                        {columns.map(col => (
                                            <td key={`${adj.id}-${col.id}`} className="py-4 px-6 align-middle border-r border-outline-variant/5">
                                                {renderCell(col, adj)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {allAdjustments.length === 0 && (
                                    <tr>
                                        <td colSpan={columns.length} className="py-10 text-center text-on-surface-variant">No adjustments found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="print:hidden mt-6">
                    <GlobalPagination 
                        totalItems={allAdjustments.length}
                        itemsPerPage={itemsPerPage}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                    />
                </div>
            </div>

            {/* Edit Modal */}
            {editingAdjustment && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-scrim/40 backdrop-blur-sm print:hidden">
                    <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-outline-variant/20 animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
                            <div>
                                <h3 className="text-lg font-bold text-on-surface">Edit Adjustment</h3>
                                <p className="text-xs text-on-surface-variant mt-0.5">{editingAdjustment.id} • {editingAdjustment.itemName}</p>
                            </div>
                            <button onClick={() => setEditingAdjustment(null)} className="text-on-surface-variant hover:text-error transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-on-surface mb-1 uppercase tracking-wider">Type</label>
                                    <div className={`px-4 py-3 rounded-lg text-sm font-bold border ${editingAdjustment.type === 'add' ? 'bg-success/10 border-success/20 text-success' : 'bg-error/10 border-error/20 text-error'}`}>
                                        {editingAdjustment.type === 'add' ? 'Addition (+)' : 'Subtraction (-)'}
                                    </div>
                                    <p className="text-[10px] text-on-surface-variant mt-1 px-1">Type cannot be changed.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-on-surface mb-1 uppercase tracking-wider">Quantity</label>
                                    <input 
                                        type="number" 
                                        value={editingAdjustment.qty}
                                        onChange={e => setEditingAdjustment({...editingAdjustment, qty: e.target.value})}
                                        className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-on-surface"
                                    />
                                </div>
                            </div>

                            {/* Show Output Type if applicable */}
                            {(() => {
                                const itm = state.items?.find(i => i.id === editingAdjustment.itemId);
                                if (itm && itm.category === 'Finished Goods') {
                                    return (
                                        <div>
                                            <label className="block text-xs font-bold text-on-surface mb-1 uppercase tracking-wider text-primary">Output Type</label>
                                            <select 
                                                value={editingAdjustment.outputType || ''}
                                                onChange={e => setEditingAdjustment({...editingAdjustment, outputType: e.target.value})}
                                                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-on-surface"
                                            >
                                                <option value="" disabled>Select Output Type...</option>
                                                {(state?.batchOutputTypes || []).map(t => (
                                                    <option key={t.id} value={t.name}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            <div>
                                <label className="block text-xs font-bold text-on-surface mb-1 uppercase tracking-wider">Reason</label>
                                <select 
                                    value={editingAdjustment.reason}
                                    onChange={e => setEditingAdjustment({...editingAdjustment, reason: e.target.value})}
                                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-on-surface"
                                >
                                    {reasonsList.map(r => <option key={r} value={r}>{r}</option>)}
                                    {!reasonsList.includes(editingAdjustment.reason) && (
                                        <option value={editingAdjustment.reason}>{editingAdjustment.reason}</option>
                                    )}
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-on-surface mb-1 uppercase tracking-wider">Remarks</label>
                                <textarea 
                                    value={editingAdjustment.remarks || ''}
                                    onChange={e => setEditingAdjustment({...editingAdjustment, remarks: e.target.value})}
                                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none text-on-surface resize-none h-20"
                                    placeholder="Add any additional notes..."
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface-container-low flex justify-end gap-3">
                            <button onClick={() => setEditingAdjustment(null)} className="px-4 py-2 rounded-lg font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-colors">Cancel</button>
                            <button onClick={saveEdit} className="px-6 py-2 rounded-lg font-bold text-sm bg-primary text-on-primary hover:bg-primary/90 transition-colors shadow-md">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
            {printData && (
                <UniversalPrintPreviewModal
                    isOpen={Boolean(printData)}
                    onClose={() => setPrintData(null)}
                    documentType="inventory_adjustment"
                    documentData={printData}
                    documentTitle={`Stock Adjustment #${printData.id}`}
                />
            )}
        </div>
    );
}
