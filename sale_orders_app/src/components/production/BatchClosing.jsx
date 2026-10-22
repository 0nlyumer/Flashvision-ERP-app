import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import PrintLayout from '../ui/PrintLayout';
import GlobalPagination from '../ui/GlobalPagination';

export default function BatchClosing() {
    const { state, setCollection, handleProductionOutput, deleteProductionOutputs, setDirty, isDirty } = useApp();
    const { appAlert, appConfirm } = useDialog();

    const defaultTypes = [
        { id: 1, name: 'Finished Good', uom: 'Meters', category: 'Finish Good' },
        { id: 2, name: 'Wastage', uom: 'Kgs', category: 'Wastage' },
        { id: 3, name: 'B-Grade', uom: 'Meters', category: 'Finish Good' }
    ];

    const outputTypes = state?.batchOutputTypes || defaultTypes;

    // activeView can be 'list', 'history', or 'form'
    const [activeView, setActiveView] = useState('list');
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [showManageTypes, setShowManageTypes] = useState(false);
    const [printPlan, setPrintPlan] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const handlePrint = (plan) => {
        setPrintPlan(plan);
        setTimeout(() => {
            window.print();
            setPrintPlan(null);
        }, 100);
    };

    const verifyBatchClosingLocks = (plan) => {
        let reasons = [];
        
        (plan.items || []).forEach(pi => {
            if (!pi.outputs || pi.outputs.length === 0) return;
            
            // Find earliest output timestamp
            const earliestOutputTime = pi.outputs.reduce((min, out) => {
                if (!out.createdAt) return min;
                const t = new Date(out.createdAt).getTime();
                return t < min ? t : min;
            }, Infinity);
            
            if (earliestOutputTime === Infinity) return;
            
            // Loop over each recorded output entry for this item
            pi.outputs.forEach(out => {
                const outputQty = parseFloat(out.quantity) || 0;
                if (outputQty <= 0) return;
                
                // Get current stock for this specific typeName/grade
                let currentStock = 0;
                const itemObj = (state.items || []).find(item => item.sku === pi.itemCode || item.id === pi.itemCode);
                if (itemObj) {
                    if (itemObj.stockByType && out.typeName) {
                        currentStock = Number(itemObj.stockByType[out.typeName] || 0);
                    } else {
                        currentStock = Number(itemObj.stock || 0);
                    }
                }
                
                // Check if current stock is less than output quantity
                if (currentStock < outputQty) {
                    reasons.push(
                        `Stock Shortage for ${pi.productName} (${out.typeName}): Current stock is ${currentStock} ${out.uom || 'M'} but output was ${outputQty} ${out.uom || 'M'} (Shortage: ${(outputQty - currentStock).toFixed(2)}). Please restore stock level.`
                    );
                }
                
                // Check subsequent deliveries
                const deliveries = state.deliveries || [];
                deliveries.forEach(d => {
                    const deliveryTime = new Date(d.createdAt || d.date).getTime();
                    if (deliveryTime >= earliestOutputTime) {
                        const hasItem = d.items?.some(di => di.itemCode === pi.itemCode || di.itemId === pi.itemCode);
                        if (hasItem) {
                            reasons.push(`Subsequent Delivery Challan: ${d.id} (Date: ${d.date || 'N/A'}) contains this item. Revert the DC to unlock.`);
                        }
                    }
                });
                
                // Check subsequent stock transfers
                const transfers = state.stockTransfers || [];
                transfers.forEach(t => {
                    const transferTime = new Date(t.createdAt || t.date).getTime();
                    if (transferTime >= earliestOutputTime) {
                        const hasItem = t.items?.some(ti => ti.itemCode === pi.itemCode || ti.itemId === pi.itemCode || ti.sku === pi.itemCode);
                        if (hasItem) {
                            reasons.push(`Subsequent Stock Transfer: ${t.id} (Status: ${t.status || 'N/A'}) contains this item. Revert the Transfer to unlock.`);
                        }
                    }
                });
            });
        });
        
        // De-duplicate reasons
        return Array.from(new Set(reasons));
    };

    // Filter plans safely
    const allPlans = state?.productionPlans || [];
    
    // Active plans: Status is not completed AND no outputs exist yet.
    // Display all active plans, but sort them so plans without consumption are at the top.
    const activePlans = allPlans.filter(p => p.status !== 'Completed' && !p.items?.some(i => i.outputs && i.outputs.length > 0)).sort((a, b) => {
        const aHas = !!(a.consumptions && Object.keys(a.consumptions).length > 0);
        const bHas = !!(b.consumptions && Object.keys(b.consumptions).length > 0);
        return aHas === bHas ? 0 : aHas ? 1 : -1;
    });

    const completedPlans = allPlans.filter(p => p.status === 'Completed');
    const historyPlans = allPlans.filter(p => p.items?.some(i => i.outputs && i.outputs.length > 0));

    const displayedActivePlans = state?.isGlobalPaginated 
        ? activePlans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
        : activePlans;

    const displayedHistoryPlans = state?.isGlobalPaginated 
        ? historyPlans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
        : historyPlans;

    const handleSelectPlan = (plan) => {
        setSelectedPlan(plan);
        setActiveView('form');
        setDirty(true);
    };

    const handleBack = async () => {
        if (isDirty) {
            const proceed = await appConfirm("Unsaved changes will be lost. Proceed?", "Unsaved Changes");
            if (proceed) {
                setDirty(false);
                setSelectedPlan(null);
                setActiveView('list');
            }
        } else {
            setSelectedPlan(null);
            setActiveView('list');
        }
    };

    if (activeView === 'form' && selectedPlan) {
        const isReadOnly = verifyBatchClosingLocks(selectedPlan).length > 0;
        return <BatchClosingForm plan={selectedPlan} onBack={handleBack} outputTypes={outputTypes} setCollection={setCollection} isReadOnly={isReadOnly} />;
    }

    if (activeView === 'history') {
        return (
            <div className="animate-in fade-in duration-300">
                {/* Print View container */}
                {printPlan && (
                    <div className="hidden print:block w-full page-break-after-always">
                        <PrintLayout 
                            documentTitle="Production Batch Output"
                            documentId={printPlan.id}
                            date={printPlan.date || printPlan.createdAt ? new Date(printPlan.createdAt || printPlan.date).toLocaleDateString('en-GB') : 'N/A'}
                            disclaimerKey="production"
                            extraMeta={[
                                { label: 'Status', value: printPlan.status }
                            ]}
                        >
                            <div className="border border-gray-300 mt-4">
                                {printPlan.items?.map((item, idx) => (
                                    <div key={item.itemCode} className={`${idx !== printPlan.items.length - 1 ? 'border-b border-gray-300' : ''} p-4`}>
                                        <div className="flex justify-between items-end mb-4">
                                            <div>
                                                <h3 className="text-sm font-bold uppercase">{item.productName || 'Unknown Product'}</h3>
                                                <p className="text-xs text-gray-500 font-mono">CODE: {item.itemCode}</p>
                                            </div>
                                            <div className="text-sm font-bold">
                                                Target: <span className="text-gray-700">{item.outputQty || 0} M</span>
                                            </div>
                                        </div>
                                        
                                        <table className="w-full text-left border-collapse text-sm border border-gray-200">
                                            <thead>
                                                <tr className="bg-gray-100 border-b border-gray-200">
                                                    <th className="py-2 px-3 font-bold text-xs uppercase text-gray-600">Output Type</th>
                                                    <th className="py-2 px-3 font-bold text-xs uppercase text-gray-600 text-right">Quantity</th>
                                                    <th className="py-2 px-3 font-bold text-xs uppercase text-gray-600 text-left pl-2">UOM</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {item.outputs && item.outputs.length > 0 ? (
                                                    item.outputs.map((out, outIdx) => (
                                                        <tr key={outIdx}>
                                                            <td className="py-2 px-3 font-medium">{out.typeName || 'Unknown'}</td>
                                                            <td className="py-2 px-3 text-right font-bold">{out.quantity}</td>
                                                            <td className="py-2 px-3 text-left pl-2 text-gray-600">{out.uom || 'Unit'}</td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="3" className="py-4 px-3 text-center italic text-gray-500 text-xs">No output entries recorded.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        </PrintLayout>
                    </div>
                )}
                <div className="flex items-center gap-4 mb-8 border-b border-outline-variant/20 pb-6 print:hidden">
                    <button onClick={() => setActiveView('list')} className="p-2 bg-surface-container-low hover:bg-surface-container rounded-full text-on-surface transition-colors flex items-center justify-center border border-outline-variant/30 font-bold hover:shadow-md">
                        <span className="material-symbols-outlined font-bold text-xl">arrow_back</span>
                    </button>
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 text-primary font-bold text-xs tracking-widest uppercase mb-1">
                            <span className="material-symbols-outlined text-sm">history</span>
                            Archive
                        </div>
                        <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-manrope">Batch Closing Plan (History)</h2>
                    </div>
                </div>

                <div className="overflow-hidden border border-outline-variant/30 rounded-3xl bg-surface-container-lowest flex flex-col shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-surface-container-low border-b border-outline-variant/30 text-on-surface-variant">
                                <tr>
                                    <th className="font-semibold px-6 py-4">Plan ID</th>
                                    <th className="font-semibold px-6 py-4">Date</th>
                                    <th className="font-semibold px-6 py-4">Status</th>
                                    <th className="font-semibold px-6 py-4">Items / Products</th>
                                    <th className="font-semibold px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/20">
                                {displayedHistoryPlans.map((plan) => {
                                    const products = plan.items?.map(i => i.productName).join(', ') || 'Unknown';
                                    return (
                                        <tr key={plan.id} className="hover:bg-surface-container/30 transition-colors group">
                                            <td className="px-6 py-4 text-on-surface font-bold">{plan.id}</td>
                                            <td className="px-6 py-4 text-on-surface-variant font-medium">
                                                {plan.date || plan.createdAt ? new Date(plan.createdAt || plan.date).toLocaleDateString('en-GB') : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${plan.status === 'Completed' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30'}`}>
                                                    {plan.status || 'In Process'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-on-surface font-medium max-w-xs truncate" title={products}>
                                                {products}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {/* View Button */}
                                                    <button 
                                                        onClick={() => { setSelectedPlan(plan); setActiveView('form'); }} 
                                                        className="p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container transition-colors flex items-center justify-center animate-all" 
                                                        title="View Details"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                                                    </button>
                                                    
                                                    {/* Edit Button */}
                                                    <button 
                                                        onClick={() => {
                                                            const lockReasons = verifyBatchClosingLocks(plan);
                                                            if (lockReasons.length > 0) {
                                                                appAlert(
                                                                    "This batch closing record cannot be edited due to subsequent activities:\n\n" + 
                                                                    lockReasons.map(r => `• ${r}`).join('\n') + 
                                                                    "\n\nPlease revert these actions first.",
                                                                    "Edit Locked"
                                                                );
                                                            } else {
                                                                setSelectedPlan(plan);
                                                                setActiveView('form');
                                                            }
                                                        }} 
                                                        className="p-1.5 rounded-lg border border-primary/20 text-primary hover:bg-primary/10 transition-colors flex items-center justify-center animate-all" 
                                                        title="Edit Outputs"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                                    </button>
                                                    
                                                    {/* Delete Button */}
                                                    <button 
                                                        onClick={async () => {
                                                            const lockReasons = verifyBatchClosingLocks(plan);
                                                            if (lockReasons.length > 0) {
                                                                appAlert(
                                                                    "This batch closing record cannot be deleted due to subsequent activities:\n\n" + 
                                                                    lockReasons.map(r => `• ${r}`).join('\n') + 
                                                                    "\n\nPlease revert these actions first.",
                                                                    "Delete Locked"
                                                                );
                                                            } else {
                                                                const proceed = await appConfirm(
                                                                    `Are you sure you want to delete outputs for plan ${plan.id}? This will reverse the stock additions in inventory and return the plan to Active state.`,
                                                                    "Confirm Delete Outputs",
                                                                    "Delete",
                                                                    "Cancel"
                                                                );
                                                                if (proceed) {
                                                                    deleteProductionOutputs(plan.id);
                                                                    appAlert(`Outputs for plan ${plan.id} deleted successfully.`, "success");
                                                                }
                                                            }
                                                        }} 
                                                        className="p-1.5 rounded-lg border border-error/20 text-error hover:bg-error/10 transition-colors flex items-center justify-center animate-all" 
                                                        title="Delete Outputs"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>

                                                    {/* Print Button */}
                                                    <button 
                                                        onClick={() => handlePrint(plan)} 
                                                        className="p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container transition-colors flex items-center justify-center animate-all" 
                                                        title="Print"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">print</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {historyPlans.length === 0 && (
                            <div className="text-center py-10 text-on-surface-variant font-medium flex gap-2 flex-col items-center">
                                <span className="material-symbols-outlined text-4xl opacity-50">inventory_2</span>
                                No historical records found.
                            </div>
                        )}
                    </div>
                    
                    <GlobalPagination 
                        totalItems={historyPlans.length}
                        itemsPerPage={itemsPerPage}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-manrope">Batch Closing Plan List</h2>
                    <p className="text-on-surface-variant mt-1 text-sm">Manage finalization and quality validation for current synthetic production cycles.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowManageTypes(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-bold transition-colors shadow-sm border border-outline-variant/30"
                    >
                        <span className="material-symbols-outlined text-[18px]">category</span>
                        Manage Types
                    </button>
                    <button 
                        onClick={() => setActiveView('history')}
                        className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/30 hover:bg-surface-container transition-colors rounded-xl font-bold"
                    >
                        <span className="material-symbols-outlined text-[18px]">history</span>
                        History
                    </button>
                </div>
            </div>

            {/* KPI Cards like Stitch Design */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-6 rounded-3xl border border-outline-variant/20 shadow-sm">
                    <div className="text-on-surface-variant font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-primary">event_note</span>
                        Current Month Plans
                    </div>
                    <div className="text-4xl font-black font-manrope text-on-surface">{activePlans.length}</div>
                </div>
                <div className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-6 rounded-3xl border border-outline-variant/20 shadow-sm">
                    <div className="text-on-surface-variant font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-primary">fact_check</span>
                        Completed Batches
                    </div>
                    <div className="text-4xl font-black font-manrope text-on-surface">{historyPlans.length}</div>
                </div>
                <div className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-6 rounded-3xl border border-outline-variant/20 shadow-sm">
                    <div className="text-on-surface-variant font-bold text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-primary">inventory_2</span>
                        Pending Finalization
                    </div>
                    <div className="text-4xl font-black font-manrope text-on-surface">{activePlans.length}</div>
                </div>
            </div>

            <h3 className="text-lg font-bold font-manrope text-on-surface mb-4">Active Production Records</h3>

            {/* List */}
            <div className="overflow-hidden border border-outline-variant/30 rounded-3xl bg-surface-container-lowest flex flex-col shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-surface-container-low border-b border-outline-variant/30 text-on-surface-variant">
                            <tr>
                                <th className="font-semibold px-6 py-4">Plan ID</th>
                                <th className="font-semibold px-6 py-4">Date</th>
                                <th className="font-semibold px-6 py-4">Status</th>
                                <th className="font-semibold px-6 py-4">Consumption</th>
                                <th className="font-semibold px-6 py-4">Items / Products</th>
                                <th className="font-semibold px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/20">
                            {displayedActivePlans.map((plan) => {
                                const products = plan.items?.map(i => i.productName).join(', ') || 'Unknown';
                                
                                return (
                                    <tr key={plan.id} className="hover:bg-surface-container/30 transition-colors group">
                                        <td className="px-6 py-4 text-on-surface font-bold">{plan.id}</td>
                                        <td className="px-6 py-4 text-on-surface-variant font-medium">
                                            {plan.date || plan.createdAt ? new Date(plan.createdAt || plan.date).toLocaleDateString('en-GB') : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${plan.status === 'Completed' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30'}`}>
                                                {plan.status || 'In Process'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const hasConsumption = plan.consumptions && Object.keys(plan.consumptions).length > 0;
                                                return (
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight flex items-center w-fit gap-1 border ${hasConsumption ? 'bg-tertiary-fixed text-on-tertiary-fixed border-tertiary/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                                                        <span className="material-symbols-outlined text-[14px]">
                                                            {hasConsumption ? 'check_circle' : 'pending_actions'}
                                                        </span>
                                                        {hasConsumption ? 'Added' : 'Pending'}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-on-surface font-medium max-w-xs truncate" title={products}>
                                            {products}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleSelectPlan(plan)}
                                                className="px-4 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary hover:text-on-primary transition-colors text-xs font-bold inline-flex items-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">play_arrow</span> Open
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {activePlans.length === 0 && (
                        <div className="text-center py-10 text-on-surface-variant font-medium flex gap-2 flex-col items-center">
                            <span className="material-symbols-outlined text-4xl opacity-50">inventory_2</span>
                            No active plans found.
                        </div>
                    )}
                </div>
                
                <GlobalPagination 
                    totalItems={activePlans.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                />
            </div>

            {showManageTypes && (
                <ManageTypesModal 
                    types={outputTypes} 
                    onClose={() => setShowManageTypes(false)}
                    onSave={(newTypes) => {
                        setCollection('batchOutputTypes', newTypes);
                        setShowManageTypes(false);
                    }}
                />
            )}
        </div>
    );
}

function ManageTypesModal({ types, onClose, onSave }) {
    const [localTypes, setLocalTypes] = useState([...types]);
    const [newName, setNewName] = useState('');
    const [newUom, setNewUom] = useState('');
    const [newCategory, setNewCategory] = useState('Finish Good');

    const handleAdd = () => {
        if (!newName || !newUom) return;
        setLocalTypes([...localTypes, { id: Date.now(), name: newName, uom: newUom, category: newCategory }]);
        setNewName('');
        setNewUom('');
        setNewCategory('Finish Good');
    };

    const handleRemove = (id) => {
        setLocalTypes(localTypes.filter(t => t.id !== id));
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface rounded-3xl w-full max-w-md shadow-2xl flex flex-col border border-outline-variant/20 animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-outline-variant/10">
                    <h3 className="text-xl font-bold font-manrope text-on-surface">Manage Output Types</h3>
                    <button onClick={onClose} className="p-2 hover:bg-surface-container rounded-full text-on-surface-variant transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div className="flex gap-2 items-center flex-wrap">
                        <input 
                            type="text" 
                            placeholder="Type Name (e.g. Wastage)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm focus:border-primary focus:outline-none text-on-surface min-w-[120px]"
                        />
                        <input 
                            type="text" 
                            placeholder="UOM"
                            value={newUom}
                            onChange={e => setNewUom(e.target.value)}
                            className="w-16 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-sm focus:border-primary focus:outline-none text-on-surface"
                        />
                        <select
                            value={newCategory}
                            onChange={e => setNewCategory(e.target.value)}
                            className="bg-surface-container-low border border-outline-variant/30 rounded-xl px-2 py-2 text-sm focus:border-primary focus:outline-none text-on-surface font-semibold"
                        >
                            <option value="Finish Good">FG</option>
                            <option value="Wastage">Wastage</option>
                        </select>
                        <button onClick={handleAdd} className="bg-primary text-on-primary px-3 py-2 rounded-xl font-bold hover:bg-primary/90 text-sm">Add</button>
                    </div>

                    <div className="space-y-2 mt-4">
                        {localTypes.map(t => {
                            const currentCat = t.category || (t.name?.toLowerCase().includes('wastage') ? 'Wastage' : 'Finish Good');
                            return (
                                <div key={t.id} className="flex justify-between items-center p-3 bg-surface-container-lowest border border-outline-variant/20 rounded-xl">
                                    <div className="flex items-center gap-2 flex-1">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-on-surface">{t.name}</span>
                                            <span className="text-[10px] text-on-surface-variant font-mono bg-surface-container px-1.5 py-0.5 rounded w-fit mt-0.5">{t.uom}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <select 
                                            value={currentCat}
                                            onChange={e => {
                                                setLocalTypes(localTypes.map(item => item.id === t.id ? { ...item, category: e.target.value } : item));
                                            }}
                                            className="bg-surface border border-outline-variant/30 rounded-lg px-2 py-1 text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                                        >
                                            <option value="Finish Good">FG</option>
                                            <option value="Wastage">Wastage</option>
                                        </select>
                                        <button onClick={() => handleRemove(t.id)} className="text-error hover:bg-error/10 p-1.5 rounded-lg transition-colors">
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-6 border-t border-outline-variant/10 bg-surface-container-lowest flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container transition-colors">Cancel</button>
                    <button onClick={() => onSave(localTypes)} className="px-6 py-2.5 rounded-xl font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors">Save Types</button>
                </div>
            </div>
        </div>
    );
}

function BatchClosingForm({ plan, onBack, outputTypes, setCollection, isReadOnly }) {
    const { state, handleProductionOutput, setDirty } = useApp();
    const { appAlert } = useDialog();
    
    // Prepare entries per item
    // Shape: { [itemCode]: [{ typeId, quantity, typeName, uom, remarks }] }
    const [outputs, setOutputs] = useState({});
    const [overallRemarks, setOverallRemarks] = useState(plan.overallRemarks || '');
    const [selectedDepartment, setSelectedDepartment] = useState(plan.department || '');

    // Initialize with existing outputs if any (history view)
    React.useEffect(() => {
        if (!plan) return;
        const init = {};
        plan.items?.forEach(item => {
            init[item.lineCode || item.itemCode] = item.outputs ? JSON.parse(JSON.stringify(item.outputs)) : [];
        });
        setOutputs(init);
    }, [plan]);

    const handleAddRow = (itemCode) => {
        if (isReadOnly) return;
        if (!selectedDepartment) {
            appAlert("Please select a department first before adding outputs.", "Department Required");
            return;
        }
        if (!outputTypes || outputTypes.length === 0) return;
        const initialType = outputTypes[0];
        const isWastage = initialType.category === 'Wastage' || initialType.name?.toLowerCase().includes('wastage');
        setOutputs(prev => ({
            ...prev,
            [itemCode]: [...(prev[itemCode] || []), { 
                typeId: initialType.id, 
                quantity: '', 
                typeName: initialType.name, 
                uom: initialType.uom, 
                remarks: '', 
                isDeliverable: !isWastage 
            }]
        }));
        setDirty(true);
    };

    const handleUpdateRow = (itemCode, index, field, value) => {
        if (isReadOnly) return;
        setOutputs(prev => {
            const arr = [...(prev[itemCode] || [])];
            arr[index][field] = value;
            if (field === 'typeId') {
                const typeObj = outputTypes.find(t => String(t.id) === String(value));
                if (typeObj) {
                    arr[index].typeName = typeObj.name;
                    arr[index].uom = typeObj.uom;
                    const isWastage = typeObj.category === 'Wastage' || typeObj.name?.toLowerCase().includes('wastage');
                    arr[index].isDeliverable = !isWastage;
                }
            }
            return { ...prev, [itemCode]: arr };
        });
        setDirty(true);
    };

    const handleRemoveRow = (itemCode, index) => {
        if (isReadOnly) return;
        setOutputs(prev => {
            const arr = [...(prev[itemCode] || [])];
            arr.splice(index, 1);
            return { ...prev, [itemCode]: arr };
        });
        setDirty(true);
    };

    const handleCloseBatch = () => {
        if (isReadOnly) return;
        if (!selectedDepartment) {
            appAlert("Please select a department before submitting the batch closing.", "Department Required");
            return;
        }
        let hasConsumptionMissing = false;
        let anyEntryAdded = false;
        
        plan.items?.forEach(item => {
            if (!plan.consumptions || !plan.consumptions[item.itemCode]) {
                hasConsumptionMissing = true;
            }
            
            const entries = outputs[item.lineCode || item.itemCode] || [];
            if (entries.length > 0) {
                const validEntries = entries.filter(e => parseFloat(e.quantity) > 0);
                if (validEntries.length > 0) {
                    anyEntryAdded = true;
                    const entriesWithTimestamp = validEntries.map(e => ({
                        ...e,
                        createdAt: e.createdAt || new Date().toISOString()
                    }));
                    handleProductionOutput(plan.id, item.itemCode, entriesWithTimestamp, !hasConsumptionMissing, overallRemarks, selectedDepartment, item.lineCode || null);
                }
            }
        });

        if (!anyEntryAdded) {
            appAlert("Please enter a valid quantity before saving.", "No Inputs");
            return;
        }

        if (hasConsumptionMissing) {
            appAlert("Batch Outputs added to inventory successfully! Note: The plan status remains 'In Process' because consumption for some items is missing.");
        } else {
            appAlert("Batch Outputs saved! Plan marked as Completed and Sale Orders updated successfully!");
        }

        setDirty(false);
        onBack();
    };

    if (!plan) return null;

    let cumulativeTarget = 0;
    let cumulativeOutput = 0;

    return (
        <div className="animate-in fade-in duration-300 max-w-full w-full">
            {/* Header */}
            <div className="mb-8">
                <h2 className="text-4xl font-extrabold text-on-surface tracking-tight font-manrope">Batch Closing</h2>
                <p className="text-on-surface-variant mt-2 text-sm">Record final production output and quality grades for the current plan.</p>
            </div>

            {/* Plan Info Card */}
            <div className="bg-surface-container-lowest rounded-2xl border-l-[3px] border-l-primary border-y border-r border-outline-variant/30 shadow-sm p-6 mb-8 flex justify-between items-center">
                <div className="flex gap-16 items-center">
                    <div>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">Plan ID</div>
                        <div className="text-lg font-bold font-manrope text-primary">{plan.id}</div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">Production Date</div>
                        <div className="text-lg font-bold font-manrope text-on-surface">
                            {plan.date || plan.createdAt ? new Date(plan.createdAt || plan.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">Target Department <span className="text-error font-bold">*</span></div>
                        <select
                            value={selectedDepartment}
                            onChange={e => {
                                setSelectedDepartment(e.target.value);
                                setDirty(true);
                            }}
                            disabled={isReadOnly}
                            className="bg-surface border border-outline-variant/30 rounded-xl px-3 py-1.5 text-sm font-bold text-on-surface focus:outline-none focus:border-primary disabled:opacity-85 disabled:bg-surface-container-low"
                        >
                            <option value="">Select Department</option>
                            {(state.departments || []).map(d => (
                                <option key={d.id || d.value} value={d.value}>{d.label || d.name || d.value}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-1">System Status</div>
                    <div className="text-xs font-bold text-primary flex items-center gap-1.5 justify-end">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                        Live Sync Active
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-sm overflow-hidden mb-8">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-surface-container-low border-b border-outline-variant/30 text-on-surface-variant text-[11px] uppercase tracking-wider">
                            <tr>
                                <th className="font-bold px-6 py-4 w-1/4">Item ID & Name</th>
                                <th className="font-bold px-6 py-4 w-1/4">Customer / Quality Type</th>
                                <th className="font-bold px-6 py-4 w-1/6 text-right">Plan Qty (M)</th>
                                <th className="font-bold px-6 py-4 w-1/6 text-right">Total Output</th>
                                <th className="font-bold px-6 py-4 w-1/6 text-right">Variance</th>
                                <th className="font-bold px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        {plan.items?.map(item => {
                            const hasConsumption = plan.consumptions && plan.consumptions[item.itemCode];
                            const itemOutputs = outputs[item.lineCode || item.itemCode] || [];
                            const targetQty = parseFloat(item.outputQty || item.quantity || 0);
                            const totalOut = itemOutputs.reduce((sum, o) => {
                                const typeObj = outputTypes.find(t => String(t.id) === String(o.typeId) || t.name === o.typeName);
                                const isWastage = (typeObj && typeObj.category) 
                                    ? typeObj.category === 'Wastage' 
                                    : o.typeName?.toLowerCase().includes('wastage');
                                return isWastage ? sum : sum + (parseFloat(o.quantity) || 0);
                            }, 0);
                            const variance = totalOut - targetQty;
                            
                            cumulativeTarget += targetQty;
                            cumulativeOutput += totalOut;

                            return (
                                <tbody key={item.itemCode} className="divide-y divide-outline-variant/10 border-b border-outline-variant/20">
                                    {/* Item Header Row */}
                                    <tr className="group hover:bg-surface-container/20 transition-colors">
                                        <td className="px-6 py-6">
                                            <div className="flex items-center gap-2">
                                                {!hasConsumption && plan.status !== 'Completed' && (
                                                    <span className="material-symbols-outlined text-[16px] text-warning" title="No Consumption">warning</span>
                                                )}
                                                <div>
                                                    <div className="font-bold text-on-surface">{item.itemCode}</div>
                                                    <div className="text-xs text-on-surface-variant uppercase mt-1 tracking-tight">{item.productName || 'Unknown Product'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-on-surface font-medium">{item.customerName || 'Standard Production'}</td>
                                        <td className="px-6 py-6 text-right font-bold text-on-surface-variant">{targetQty.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                        <td className="px-6 py-6 text-right font-bold text-primary">{totalOut.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                        <td className={`px-6 py-6 text-right font-bold ${variance < 0 ? 'text-error' : variance > 0 ? 'text-tertiary' : 'text-primary'}`}>
                                            {variance > 0 ? '+' : ''}{variance.toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            {!isReadOnly && (
                                                <button onClick={() => handleAddRow(item.lineCode || item.itemCode)} className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-xs inline-flex items-center gap-1 transition-colors border border-outline-variant/30 shadow-sm">
                                                    <span className="material-symbols-outlined text-[14px]">add</span> Add Output
                                                </button>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Output Entry Rows */}
                                    {itemOutputs.map((row, idx) => (
                                        <tr key={idx} className="bg-surface-container-lowest/50">
                                            <td className="px-6 py-3 pl-12 text-on-surface-variant flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[16px] opacity-40">subdirectory_arrow_right</span>
                                                <span className="text-xs font-mono">{item.itemCode}</span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <select 
                                                    value={row.typeId}
                                                    onChange={e => handleUpdateRow(item.lineCode || item.itemCode, idx, 'typeId', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full bg-surface border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-semibold text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:opacity-85 disabled:bg-surface-container-low"
                                                >
                                                    {outputTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <input 
                                                        type="number" 
                                                        placeholder="0.00"
                                                        value={row.quantity || ''}
                                                        onChange={e => handleUpdateRow(item.lineCode || item.itemCode, idx, 'quantity', e.target.value)}
                                                        disabled={isReadOnly}
                                                        className="w-24 bg-surface border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-bold text-right text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:opacity-85 disabled:bg-surface-container-low"
                                                    />
                                                    <span className="text-xs text-on-surface-variant font-medium w-12 text-left">{row.uom || 'Unit'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={row.isDeliverable ?? true}
                                                        onChange={e => handleUpdateRow(item.lineCode || item.itemCode, idx, 'isDeliverable', e.target.checked)}
                                                        disabled={isReadOnly}
                                                        className="rounded text-primary focus:ring-primary/20 border-outline-variant/50 w-4 h-4 cursor-pointer" 
                                                    />
                                                    <span className="text-xs font-bold text-on-surface-variant">Deliverable</span>
                                                </label>
                                            </td>
                                            <td className="px-6 py-3">
                                                <input 
                                                    type="text" 
                                                    placeholder="Remarks (Optional)"
                                                    value={row.remarks || ''}
                                                    onChange={e => handleUpdateRow(item.lineCode || item.itemCode, idx, 'remarks', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full bg-surface border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-medium text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:opacity-85 disabled:bg-surface-container-low"
                                                />
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {!isReadOnly && (
                                                        <button onClick={() => handleRemoveRow(item.lineCode || item.itemCode, idx)} className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-md transition-colors">
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            );
                        })}
                        
                        {/* Cumulative Totals Row */}
                        <tfoot className="bg-surface-container-low/50">
                            <tr>
                                <td colSpan="2" className="px-6 py-6 font-bold text-on-surface text-sm">Cumulative Totals</td>
                                <td className="px-6 py-6 text-right font-bold text-on-surface">{cumulativeTarget.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td className="px-6 py-6 text-right font-bold text-primary">{cumulativeOutput.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                <td className={`px-6 py-6 text-right font-bold ${(cumulativeOutput - cumulativeTarget) < 0 ? 'text-error' : (cumulativeOutput - cumulativeTarget) > 0 ? 'text-tertiary' : 'text-primary'}`}>
                                    {(cumulativeOutput - cumulativeTarget).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Bottom Actions & Overall Remarks */}
            <div className="flex gap-6 items-end justify-between">
                <div className="flex-1 max-w-xl">
                    <label className="block text-sm font-bold font-manrope text-on-surface mb-2">Overall Plan Remarks</label>
                    <textarea 
                        rows="2" 
                        value={overallRemarks}
                        onChange={(e) => setOverallRemarks(e.target.value)}
                        placeholder={isReadOnly ? "No remarks recorded." : "Add any overall remarks for this batch..."}
                        disabled={isReadOnly}
                        className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary text-on-surface resize-y disabled:opacity-85 disabled:bg-surface-container-low"
                    ></textarea>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="px-6 py-3 rounded-xl font-bold bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/30 hover:bg-surface-container-low transition-colors shadow-sm">
                        {isReadOnly ? 'Close View' : 'Cancel Batch'}
                    </button>
                    {!isReadOnly && (
                        <button onClick={handleCloseBatch} className="px-8 py-3 rounded-xl font-bold bg-primary text-on-primary shadow-md hover:shadow-lg hover:bg-primary/90 transition-all flex items-center gap-2">
                            <span className="material-symbols-outlined text-[20px]">{plan.status === 'Completed' ? 'update' : 'task_alt'}</span> 
                            {plan.status === 'Completed' ? 'Update Batch' : 'Submit Batch Close'}
                        </button>
                    )}
                    {isReadOnly && (
                        <div className="bg-tertiary/10 text-tertiary px-6 py-3 rounded-xl border border-tertiary/20 text-sm font-bold flex items-center gap-1.5 shadow-sm">
                            <span className="material-symbols-outlined text-[18px]">lock</span>
                            Outputs Locked
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
