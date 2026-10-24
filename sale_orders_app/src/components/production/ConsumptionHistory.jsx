import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import ResizableHeader from '../ui/ResizableHeader';
import UniversalPrintStudioModal from '../ui/UniversalPrintStudioModal';
import { buildConsumptionPrintRecord } from '../../utils/printDesign';

export default function ConsumptionHistory({ onEdit }) {
    const { state, setCollection, setState, currencySymbol } = useApp();
    const { appAlert, appConfirm } = useDialog();

    const [viewMode, setViewMode] = useState('plan'); // 'plan' | 'item'
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    
    // For pagination
    const isPaginated = state?.isGlobalPaginated !== undefined ? state.isGlobalPaginated : true;
    const ITEMS_PER_PAGE = 20;

    const [activeDropdown, setActiveDropdown] = useState(null);
    const [viewModalData, setViewModalData] = useState(null);
    const [printTarget, setPrintTarget] = useState(null); // { plan, itemCode? }
    const [printRecord, setPrintRecord] = useState(null);

    // Build the print record ONCE at click time (a snapshot) instead of
    // rebuilding it inline on every render while the studio is open.
    const openPrint = (plan, itemCode) => {
        try {
            setPrintRecord(buildConsumptionPrintRecord(plan, state, itemCode));
            setPrintTarget({ plan, itemCode });
        } catch (e) {
            console.error('Consumption print failed:', e);
            appAlert('Could not build the consumption print: ' + (e?.message || e));
        }
    };
    const closePrint = () => { setPrintTarget(null); setPrintRecord(null); };

    // Build data
    const allPlans = state.productionPlans || [];
    
    const plansWithConsumption = useMemo(() => {
        return allPlans.filter(p => p.consumptions && Object.keys(p.consumptions).length > 0)
        .sort((a, b) => {
            const aDate = Math.max(...Object.values(a.consumptions).map(c => new Date(c.metadata?.createdAt || 0).getTime()));
            const bDate = Math.max(...Object.values(b.consumptions).map(c => new Date(c.metadata?.createdAt || 0).getTime()));
            return bDate - aDate;
        });
    }, [allPlans]);

    const itemWiseData = useMemo(() => {
        const list = [];
        plansWithConsumption.forEach(plan => {
            if (plan.consumptions) {
                Object.keys(plan.consumptions).forEach(itemCode => {
                    const cData = plan.consumptions[itemCode];
                    const planItem = plan.items?.find(i => i.itemCode === itemCode);
                    list.push({
                        planId: plan.id,
                        planStatus: plan.status,
                        saleOrderNo: plan.saleOrderNo || planItem?.saleOrderNo || '-',
                        itemId: planItem?.id || itemCode,
                        itemCode: itemCode,
                        productName: planItem?.productName || itemCode,
                        consumptionData: cData,
                        metadata: cData.metadata || {},
                        planRef: plan
                    });
                });
            }
        });
        return list.sort((a, b) => new Date(b.metadata.createdAt || 0) - new Date(a.metadata.createdAt || 0));
    }, [plansWithConsumption]);

    // Filtering
    const filteredPlans = useMemo(() => {
        return plansWithConsumption.filter(p => 
            p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.saleOrderNo?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [plansWithConsumption, searchTerm]);

    const filteredItems = useMemo(() => {
        return itemWiseData.filter(i => 
            i.planId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.itemId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            i.saleOrderNo.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [itemWiseData, searchTerm]);

    // Pagination logic
    const currentData = viewMode === 'plan' ? filteredPlans : filteredItems;
    const totalPages = Math.ceil(currentData.length / ITEMS_PER_PAGE);
    const paginatedData = isPaginated 
        ? currentData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
        : currentData;

    const handleDeletePlan = async (plan) => {
        if (await appConfirm('Are you sure you want to delete the consumption history for this plan? Note: Raw Material stock logic is intentionally disabled.', 'Delete Consumption', 'Delete', 'Cancel')) {
            const updatedPlans = allPlans.map(p => {
                if (p.id === plan.id) {
                    const newP = { ...p };
                    delete newP.consumptions;
                    return newP;
                }
                return p;
            });
            setCollection('productionPlans', updatedPlans);
            appAlert('Consumption history deleted.', 'success');
            setActiveDropdown(null);
        }
    };

    const handleDeleteItem = async (planId, itemCode) => {
        if (await appConfirm('Are you sure you want to delete the consumption history for this item?', 'Delete Consumption', 'Delete', 'Cancel')) {
            const updatedPlans = allPlans.map(p => {
                if (p.id === planId && p.consumptions) {
                    const newP = { ...p, consumptions: { ...p.consumptions } };
                    delete newP.consumptions[itemCode];
                    return newP;
                }
                return p;
            });
            setCollection('productionPlans', updatedPlans);
            appAlert('Consumption history deleted.', 'success');
            setActiveDropdown(null);
        }
    };

    const handleEditPlan = (plan) => {
        if (plan.status === 'Completed' || plan.status === 'Closed' || plan.output) {
            appAlert('Cannot edit consumption: Output has already been recorded for this plan.', 'error');
            return;
        }
        setActiveDropdown(null);
        onEdit(plan);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString();
    };

    const getPlanMetadata = (plan) => {
        if (!plan.consumptions) return {};
        const values = Object.values(plan.consumptions);
        const latestMeta = values.reduce((latest, current) => {
            const lDate = latest.metadata?.createdAt ? new Date(latest.metadata.createdAt) : new Date(0);
            const cDate = current.metadata?.createdAt ? new Date(current.metadata.createdAt) : new Date(0);
            return cDate > lDate ? current : latest;
        }, values[0] || {});
        return latestMeta.metadata || {};
    };

    const renderConsumptionDetails = (consumptions) => {
        if (!consumptions) return <p className="text-sm text-on-surface-variant italic">No consumption records available.</p>;
        
        const itemKeys = Object.keys(consumptions).filter(k => k !== 'metadata');

        if (itemKeys.length === 0) {
            return <p className="text-sm text-on-surface-variant italic">No consumption records available.</p>;
        }

        return (
            <div className="flex flex-col gap-6">
                {itemKeys.map(itemCode => {
                    const itemData = consumptions[itemCode];
                    if (!itemData) return null;
                    const phaseConfig = itemData.phaseConfig || [];
                    const materials = itemData.materials || {};
                    
                    return (
                        <div key={itemCode} className="border border-outline-variant/10 rounded-2xl p-5 bg-surface-container-lowest shadow-sm flex flex-col gap-4">
                            <div className="flex flex-wrap justify-between items-center gap-4 border-b border-outline-variant/10 pb-3">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-label">Produced Product</span>
                                    <span className="font-extrabold text-primary text-sm">{itemCode}</span>
                                </div>
                                {itemData.clothName && (
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-label">Back Cloth Consumed</span>
                                        <span className="text-xs font-semibold text-on-surface">
                                            {itemData.clothName} - <span className="font-extrabold text-secondary">{itemData.clothQuantity || 0}m</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Phases Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {phaseConfig.filter(p => p.enabled).map(phase => {
                                    const list = materials[phase.id] || [];
                                    return (
                                        <div key={phase.id} className="border border-outline-variant/10 rounded-xl p-3 bg-surface-container-low/40">
                                            <div className="flex justify-between items-center border-b border-outline-variant/10 pb-1.5 mb-2">
                                                <span className="text-xs font-bold text-on-surface font-headline">{phase.title}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{phase.tank || phase.type}</span>
                                            </div>
                                            {list.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {list.map((m, mIdx) => (
                                                        <div key={mIdx} className="flex justify-between items-center text-xs py-1 hover:bg-surface px-1.5 rounded transition-colors">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-on-surface">{m.name}</span>
                                                                <span className="text-[10px] text-slate-400 font-mono">{m.itemCode || m.rmId || '-'}</span>
                                                            </div>
                                                            <div className="text-right flex flex-col items-end">
                                                                <span className="font-extrabold text-primary">{m.value || 0} {phase.unit || 'kg'}</span>
                                                                {m.bomValue && <span className="text-[9px] text-slate-400 font-medium">BOM: {m.bomValue}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-on-surface-variant italic font-body">No materials consumed.</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* Header / Actions */}
            <header className="flex items-center justify-between px-8 py-4 border-b border-outline-variant/20 bg-surface">
                <div className="flex items-center gap-6">
                    <h2 className="text-2xl font-headline font-bold text-on-surface">Consumption History</h2>
                    <div className="h-6 w-px bg-outline-variant/30"></div>
                    <div className="flex bg-surface-container-low rounded-xl p-1 border border-outline-variant/20">
                        <button 
                            onClick={() => { setViewMode('plan'); setCurrentPage(1); }}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${viewMode === 'plan' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface hover:bg-surface-container'}`}
                        >
                            Plan Wise
                        </button>
                        <button 
                            onClick={() => { setViewMode('item'); setCurrentPage(1); }}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${viewMode === 'item' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface hover:bg-surface-container'}`}
                        >
                            Item Wise
                        </button>
                    </div>
                </div>
                <div className="relative w-64">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                    <input 
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant/30 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-medium text-on-surface placeholder:text-on-surface-variant"
                    />
                </div>
            </header>

            {/* Table Area */}
            <div className="flex-1 overflow-x-auto relative">
                <table className="w-full min-w-[1200px] text-left border-collapse">
                    <thead className="bg-surface-container-lowest sticky top-0 z-10 shadow-sm border-b border-outline-variant/20 text-xs uppercase tracking-wider text-on-surface-variant">
                        <tr>
                            {viewMode === 'plan' ? (
                                <>
                                    <ResizableHeader className="font-semibold px-6 py-4 w-40">Plan ID</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4 w-40">Plan Date</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4 w-48">Consumption Date</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4 w-40">Created By</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4 w-48">Last Edited</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4 w-32 text-right">Actions</ResizableHeader>
                                </>
                            ) : (
                                <>
                                    <ResizableHeader className="font-semibold px-6 py-4 w-32">Plan ID</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4 w-32">Sale Order No</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4 w-32">Item ID</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4 min-w-[200px]">Product Name</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4 w-48">Consumption Date</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4 w-40">Created By</ResizableHeader>
                                    <ResizableHeader className="font-semibold px-6 py-4 w-32 text-right">Actions</ResizableHeader>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                        {paginatedData.map((row, idx) => {
                            if (viewMode === 'plan') {
                                const meta = getPlanMetadata(row);
                                return (
                                    <tr key={row.id} className="hover:bg-surface-container-lowest/50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-primary">{row.id}</td>
                                        <td className="px-6 py-4 font-medium text-on-surface">{new Date(row.planDate || row.creationDate).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDate(meta.createdAt)}</td>
                                        <td className="px-6 py-4 text-sm font-medium">{meta.createdBy || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-on-surface-variant">
                                            {meta.lastEditedAt ? `${formatDate(meta.lastEditedAt)} by ${meta.lastEditedBy}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 items-center relative">
                                                <button 
                                                    onClick={() => setViewModalData({ type: 'plan', data: row })}
                                                    className="w-8 h-8 rounded hover:bg-primary/10 text-primary flex items-center justify-center transition-colors"
                                                    title="View Details"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">visibility</span>
                                                </button>
                                                <button 
                                                    onClick={() => setActiveDropdown(activeDropdown === row.id ? null : row.id)}
                                                    className="w-8 h-8 rounded hover:bg-surface-container-highest text-on-surface-variant flex items-center justify-center transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                                </button>

                                                {activeDropdown === row.id && (
                                                    <div className="absolute right-0 top-10 mt-1 w-48 bg-surface border border-outline-variant/20 rounded-xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
                                                        <button 
                                                            onClick={() => handleEditPlan(row)}
                                                            className="w-full text-left px-4 py-2 hover:bg-surface-container text-sm font-medium flex items-center gap-2"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">edit</span> Edit
                                                        </button>
                                                        <button
                                                            onClick={() => { setActiveDropdown(null); openPrint(row, null); }}
                                                            className="w-full text-left px-4 py-2 hover:bg-surface-container text-sm font-medium flex items-center gap-2"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">print</span> Print
                                                        </button>
                                                        <div className="my-1 border-t border-outline-variant/10"></div>
                                                        <button
                                                            onClick={() => handleDeletePlan(row)}
                                                            className="w-full text-left px-4 py-2 hover:bg-error/10 text-error text-sm font-medium flex items-center gap-2"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            } else {
                                return (
                                    <tr key={`${row.planId}-${row.itemCode}`} className="hover:bg-surface-container-lowest/50 transition-colors group">
                                        <td className="px-6 py-4 font-bold text-primary">{row.planId}</td>
                                        <td className="px-6 py-4 font-medium text-on-surface">{row.saleOrderNo}</td>
                                        <td className="px-6 py-4 font-medium text-on-surface">{row.itemId}</td>
                                        <td className="px-6 py-4 font-bold text-on-surface">{row.productName}</td>
                                        <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDate(row.metadata.createdAt)}</td>
                                        <td className="px-6 py-4 text-sm font-medium">{row.metadata.createdBy || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 items-center relative">
                                                <button 
                                                    onClick={() => setViewModalData({ type: 'item', data: row })}
                                                    className="w-8 h-8 rounded hover:bg-primary/10 text-primary flex items-center justify-center transition-colors"
                                                    title="View Details"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">visibility</span>
                                                </button>
                                                <button 
                                                    onClick={() => setActiveDropdown(activeDropdown === `${row.planId}-${row.itemCode}` ? null : `${row.planId}-${row.itemCode}`)}
                                                    className="w-8 h-8 rounded hover:bg-surface-container-highest text-on-surface-variant flex items-center justify-center transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">more_vert</span>
                                                </button>

                                                {activeDropdown === `${row.planId}-${row.itemCode}` && (
                                                    <div className="absolute right-0 top-10 mt-1 w-48 bg-surface border border-outline-variant/20 rounded-xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
                                                        <button 
                                                            onClick={() => handleEditPlan(row.planRef)}
                                                            className="w-full text-left px-4 py-2 hover:bg-surface-container text-sm font-medium flex items-center gap-2"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">edit</span> Edit Plan
                                                        </button>
                                                        <button
                                                            onClick={() => { setActiveDropdown(null); openPrint(row.planRef, row.itemCode); }}
                                                            className="w-full text-left px-4 py-2 hover:bg-surface-container text-sm font-medium flex items-center gap-2"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">print</span> Print
                                                        </button>
                                                        <div className="my-1 border-t border-outline-variant/10"></div>
                                                        <button
                                                            onClick={() => handleDeleteItem(row.planId, row.itemCode)}
                                                            className="w-full text-left px-4 py-2 hover:bg-error/10 text-error text-sm font-medium flex items-center gap-2"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }
                        })}
                        {paginatedData.length === 0 && (
                            <tr>
                                <td colSpan={viewMode === 'plan' ? 6 : 7} className="px-6 py-12 text-center text-on-surface-variant">
                                    No consumption history found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Consumption Print (Universal Print Studio) */}
            {printTarget && printRecord && (
                <UniversalPrintStudioModal
                    isOpen
                    onClose={closePrint}
                    documentType="consumption_history"
                    documentData={printRecord}
                />
            )}

            {/* View Modal */}
            {viewModalData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-lowest">
                            <h3 className="text-xl font-headline font-bold">
                                {viewModalData.type === 'plan' ? `Plan ${viewModalData.data.id} Consumption` : `Item Consumption Details`}
                            </h3>
                            <button onClick={() => setViewModalData(null)} className="p-2 hover:bg-surface-container rounded-full transition-colors">
                                <span className="material-symbols-outlined text-on-surface-variant">close</span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar bg-surface-container-low/20">
                            {viewModalData.type === 'plan' ? (
                                renderConsumptionDetails(viewModalData.data.consumptions)
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="bg-surface border border-outline-variant/15 rounded-xl p-4 shadow-sm flex flex-col gap-3">
                                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-on-surface border-b border-outline-variant/10 pb-3">
                                            <div>
                                                <span className="text-slate-400 uppercase text-[9px] block font-label">Plan ID</span>
                                                <span className="text-sm font-bold text-primary">{viewModalData.data.planId}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 uppercase text-[9px] block font-label">Sale Order No</span>
                                                <span className="text-sm font-bold">{viewModalData.data.saleOrderNo}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 uppercase text-[9px] block font-label">Product Name</span>
                                                <span className="text-sm font-bold text-secondary">{viewModalData.data.productName}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 uppercase text-[9px] block font-label">Product Code</span>
                                                <span className="text-sm font-bold">{viewModalData.data.itemId}</span>
                                            </div>
                                        </div>
                                        
                                        {viewModalData.data.consumptionData && (
                                            <div className="mt-2">
                                                {renderConsumptionDetails({ [viewModalData.data.itemCode]: viewModalData.data.consumptionData })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Global Pagination Toggle (Similar to TableGlobalToggle behavior) */}
            <div className="p-4 border-t border-outline-variant/20 bg-surface-container-lowest flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold transition-colors ${!isPaginated ? 'text-primary' : 'text-on-surface-variant'}`}>List View</span>
                    <button 
                        onClick={() => setState(prev => ({ ...prev, isGlobalPaginated: !isPaginated }))}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${isPaginated ? 'bg-primary' : 'bg-surface-container-highest border border-outline-variant/30'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-sm ${isPaginated ? 'left-7' : 'left-1'}`}></div>
                    </button>
                    <span className={`text-sm font-semibold transition-colors ${isPaginated ? 'text-primary' : 'text-on-surface-variant'}`}>Pages</span>
                </div>

                {isPaginated && totalPages > 1 && (
                    <div className="flex items-center gap-2 bg-surface border border-outline-variant/20 rounded-lg p-1">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="p-1 rounded hover:bg-surface-container disabled:opacity-50 transition-colors flex items-center justify-center text-on-surface"
                        >
                            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                        </button>
                        <span className="text-sm font-medium px-3 text-on-surface-variant">
                            <span className="text-on-surface font-bold">{currentPage}</span> / {totalPages}
                        </span>
                        <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="p-1 rounded hover:bg-surface-container disabled:opacity-50 transition-colors flex items-center justify-center text-on-surface"
                        >
                            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
