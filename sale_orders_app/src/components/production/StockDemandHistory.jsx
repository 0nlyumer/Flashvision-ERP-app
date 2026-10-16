import React, { useState } from 'react';
import ResizableHeader from '../ui/ResizableHeader';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import GlobalPagination from '../ui/GlobalPagination';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

export default function StockDemandHistory({ onNewRequestClick, onBackClick, onViewClick, onEditClick }) {
    const { state, setCollection } = useApp();
    const { appConfirm, appAlert } = useDialog();
    const [currentPage, setCurrentPage] = useState(1);
    const [showCriticalPopup, setShowCriticalPopup] = useState(false);
    const [printData, setPrintData] = useState(null);

    const handlePrintDemand = (demand) => {
        if (!demand) return;
        const items = (demand.items || []).map((itm, idx) => ({
            serial_no: idx + 1,
            item_code: itm.sku || itm.itemCode || itm.itemId || `RM-${idx + 1}`,
            item_name: itm.name || itm.itemName || 'Material Item',
            demanded_qty: parseFloat(itm.itemQuantity || itm.qty || itm.demanded_qty || 0),
            uom: itm.unit || itm.uom || 'Kg'
        }));

        const totalQty = items.reduce((sum, itm) => sum + (Number(itm.demanded_qty) || 0), 0);

        setPrintData({
            ...demand,
            id: demand.id,
            demand_no: demand.id,
            date: demand.date || new Date().toISOString().split('T')[0],
            from_dept: demand.department || 'Production Department',
            to_store: demand.targetDepartment || 'Main Store',
            header: {
                demand_no: demand.id,
                date: demand.date || new Date().toISOString().split('T')[0],
                from_dept: demand.department || 'Production Department',
                to_store: demand.targetDepartment || 'Main Store',
                requested_by: demand.requestedBy || state?.currentUser?.name || 'Requisitioner',
                status: demand.status || 'Pending'
            },
            items: items.length > 0 ? items : [
                {
                    serial_no: 1,
                    item_code: 'RM-DEFAULT',
                    item_name: 'Raw Material Requisition',
                    demanded_qty: 0,
                    uom: 'Kg'
                }
            ],
            totals: {
                totalDemandedItems: totalQty
            }
        });
    };
    
    // Real Data calculations
    const demands = state.stockDemands || [];
    const pendingDemands = demands.filter(d => d.status === 'Pending');
    const pendingCount = pendingDemands.length;
    
    let pendingQuantity = 0;
    pendingDemands.forEach(d => {
       const hasTransfer = state.stockTransfers?.some(st => st.linkedDemand === d.id);
       if (!hasTransfer) {
           d.items?.forEach(item => {
               pendingQuantity += (parseFloat(item.itemQuantity) || 0);
           });
       }
    });
    
    const fulfilledCount = demands.filter(d => d.status === 'Fulfilled').length;
    const fulfillmentRate = demands.length > 0 ? ((fulfilledCount / demands.length) * 100).toFixed(1) : 100;
    
    const rawMaterials = state.items?.filter(i => i.category === 'Raw Material' || i.type === 'Raw Material') || [];
    const criticalItems = rawMaterials.filter(i => (i.stock || 0) <= 0);
    
    const itemsPerPage = 20;
    const totalPages = Math.ceil(demands.length / itemsPerPage);
    const displayedDemands = state?.isGlobalPaginated 
        ? demands.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
        : demands;

    const handleUpdateCriticalStandard = (itemId, val) => {
        const updatedItems = state.items.map(i => i.id === itemId ? { ...i, criticalStandard: Number(val) } : i);
        setCollection('items', updatedItems);
    };

    const handleDelete = async (demand) => {
        // Check if any document is created against this demand
        const linkedTransfer = (state.stockTransfers || []).find(st => st.linkedDemand === demand.id);
        const linkedReceiving = (state.stockReceivingNotes || []).find(sr => sr.linkedDemand === demand.id); // Assuming we might have this
        
        const linkedDoc = linkedTransfer || linkedReceiving;

        if (linkedDoc) {
            appAlert(`This Stock Demand cannot be deleted because a Stock Transfer Note (${linkedDoc.id}) has already been generated against it. Please delete the associated Transfer Note first.`);
            return;
        }

        if (await appConfirm(`Are you sure you want to delete Demand ${demand.id}?`)) {
            const updated = demands.filter(d => d.id !== demand.id);
            setCollection('stockDemands', updated);
        }
    };

    return (
        <div className="animate-in fade-in zoom-in-95 duration-300">
            {/* Header Section */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-4xl font-extrabold text-on-surface tracking-tight font-manrope">Stock Demand</h2>
                    <p className="font-body text-sm text-on-surface-variant mt-2">Production Department Requisition History</p>
                </div>
                <button onClick={onBackClick || (() => window.history.back())} className="bg-surface-container-low hover:bg-surface-container-high text-on-surface px-6 py-3 rounded-lg font-body font-semibold text-sm shadow-[0_2px_10px_rgba(0,28,56,0.06)] border border-outline-variant/20 flex items-center gap-2 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    Back
                </button>
            </div>

            {/* Dashboard Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                {/* Stat Card 1 */}
                <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-[0_20px_40px_rgba(0,28,56,0.06)]">
                    <p className="font-body text-xs text-on-surface-variant uppercase tracking-wider font-semibold mb-2">Pending Quantity</p>
                    <div className="flex items-end gap-3">
                        <span className="font-headline text-4xl font-bold text-on-surface">{pendingQuantity}</span>
                        <span className="font-body text-sm text-on-surface-variant mb-1">Across {pendingCount} requests</span>
                    </div>
                </div>

                {/* Stat Card 2 */}
                <div onClick={() => setShowCriticalPopup(true)} className="cursor-pointer hover:border-tertiary/50 transition-colors bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-[0_20px_40px_rgba(0,28,56,0.06)] relative overflow-hidden">
                    <div className="relative z-10">
                        <p className="font-body text-xs text-on-surface-variant uppercase tracking-wider font-semibold mb-2">Critical Shortages</p>
                        <div className="flex items-end gap-3">
                            <span className="font-headline text-4xl font-bold text-tertiary">{criticalItems.length}</span>
                            <span className="font-body text-sm text-on-surface-variant mb-1">Requires immediate action</span>
                        </div>
                    </div>
                    {/* Decorative subtle gradient blob */}
                    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-tertiary-fixed opacity-20 rounded-full blur-2xl pointer-events-none"></div>
                </div>

                {/* Stat Card 3 */}
                <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-[0_20px_40px_rgba(0,28,56,0.06)]">
                    <p className="font-body text-xs text-on-surface-variant uppercase tracking-wider font-semibold mb-2">Fulfillment Rate</p>
                    <div className="flex items-end gap-3">
                        <span className="font-headline text-4xl font-bold text-primary">{fulfillmentRate}%</span>
                        <span className="font-body text-sm text-secondary mb-1">Overall</span>
                    </div>
                    <div className="mt-4 w-full bg-surface-container h-1 rounded-full overflow-hidden">
                        <div className="bg-primary h-full rounded-full" style={{ width: `${fulfillmentRate}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-surface-container-lowest rounded-xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] border border-outline-variant/15 overflow-hidden">
                <div className="p-6 bg-surface-container-low flex justify-between items-center border-b border-outline-variant/15">
                    <h3 className="font-headline text-lg font-bold text-on-surface">Recent Requisitions</h3>
                    <div className="flex gap-2">
                        <button className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-sm">filter_list</span>
                        </button>
                        <button className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-sm">more_vert</span>
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                        <thead>
                            <tr className="bg-surface">
                                <ResizableHeader className="font-body text-xs font-semibold text-on-surface-variant tracking-wider py-4 px-6 border-b border-outline-variant/15 uppercase">Demand ID</ResizableHeader>
                                <ResizableHeader className="font-body text-xs font-semibold text-on-surface-variant tracking-wider py-4 px-6 border-b border-outline-variant/15 uppercase">Requested By</ResizableHeader>
                                <ResizableHeader className="font-body text-xs font-semibold text-on-surface-variant tracking-wider py-4 px-6 border-b border-outline-variant/15 uppercase">Date</ResizableHeader>
                                <ResizableHeader className="font-body text-xs font-semibold text-on-surface-variant tracking-wider py-4 px-6 border-b border-outline-variant/15 uppercase">Status</ResizableHeader>
                                <th className="font-body text-xs font-semibold text-on-surface-variant tracking-wider py-4 px-6 border-b border-outline-variant/15 border-l uppercase text-right w-32">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="font-body text-sm divide-y divide-outline-variant/10">
                            {displayedDemands.length > 0 ? displayedDemands.map((item, idx) => (
                                <tr key={item.id || idx} className={`hover:bg-surface-container-low transition-colors group ${idx % 2 !== 0 ? 'bg-surface-container-low/30' : ''}`}>
                                    <td className="py-4 px-6 text-on-surface font-medium border-r border-outline-variant/5">{item.id}</td>
                                    <td className="py-4 px-6 text-on-surface-variant border-r border-outline-variant/5">{item.requestedBy}</td>
                                    <td className="py-4 px-6 text-on-surface-variant border-r border-outline-variant/5">{item.date}</td>
                                    <td className="py-4 px-6 border-r border-outline-variant/5">
                                        <span className={`font-semibold ${
                                            item.status === 'Approved' ? 'text-primary' :
                                            item.status === 'Fulfilled' ? 'text-outline font-medium' :
                                            'text-on-surface-variant font-medium'
                                        }`}>{item.status}</span>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-1.5 text-secondary hover:bg-secondary-container hover:text-on-secondary-container rounded-md transition-colors" title="Print" onClick={() => handlePrintDemand(item)}>
                                                <span className="material-symbols-outlined text-[1.25rem]">print</span>
                                            </button>
                                            <button onClick={() => onViewClick?.(item)} className="p-1.5 text-secondary hover:bg-secondary-container hover:text-on-secondary-container rounded-md transition-colors" title="View">
                                                <span className="material-symbols-outlined text-[1.25rem]">visibility</span>
                                            </button>
                                            <button onClick={() => onEditClick?.(item)} className="p-1.5 text-secondary hover:bg-secondary-container hover:text-on-secondary-container rounded-md transition-colors" title="Edit">
                                                <span className="material-symbols-outlined text-[1.25rem]">edit</span>
                                            </button>
                                            <button onClick={() => handleDelete(item)} className="p-1.5 text-error hover:bg-error/10 hover:text-error rounded-md transition-colors" title="Delete">
                                                <span className="material-symbols-outlined text-[1.25rem]">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="5" className="text-center py-8 text-on-surface-variant">No Requisitions Found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Footer */}
                <GlobalPagination 
                    totalItems={demands.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                />
            </div>

            {/* Critical Shortages Popup */}
            {showCriticalPopup && (
                <div className="fixed inset-0 bg-surface-dim/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-surface rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-outline-variant/20">
                        <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-on-surface">Critical Shortages</h3>
                            <button onClick={() => setShowCriticalPopup(false)} className="text-on-surface-variant hover:text-on-surface">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                            {criticalItems.length === 0 && <p className="text-on-surface-variant">No critical shortages found.</p>}
                            {criticalItems.map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-surface-container-low p-4 rounded-xl">
                                    <div>
                                        <p className="font-bold text-on-surface">{item.name}</p>
                                        <p className="text-sm text-on-surface-variant">{item.sku} - Stock: <span className="font-bold text-error">{item.stock || 0}</span></p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-on-surface-variant">Critical Limit:</span>
                                        <input 
                                            type="number" 
                                            value={item.criticalStandard || 0}
                                            onChange={(e) => handleUpdateCriticalStandard(item.id, e.target.value)}
                                            className="w-20 bg-surface border border-outline-variant/20 rounded px-2 py-1 text-sm text-center"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {printData && (
                <UniversalPrintPreviewModal
                    isOpen={Boolean(printData)}
                    onClose={() => setPrintData(null)}
                    documentType="stock_demand"
                    documentData={printData}
                    documentTitle={`Stock Demand #${printData.id}`}
                />
            )}
        </div>
    );
}
