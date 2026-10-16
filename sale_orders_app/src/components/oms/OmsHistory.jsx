import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import ResizableHeader from '../ui/ResizableHeader';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';
import GlobalPagination from '../ui/GlobalPagination';

export default function OmsHistory({ completedRuns = [], onEditPlan }) {
    const { state, setCollection, updateSaleOrderItemStatus } = useApp();
    const { appConfirm, appAlert } = useDialog();
    const [viewPlan, setViewPlan] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [printData, setPrintData] = useState(null);
    const itemsPerPage = 20;

    const handlePrint = (plan) => {
        if (!plan) return;
        const items = (plan.items || []).map((itm, idx) => {
            const cust = state.customers?.find(c => (itm.customerId && c.id === itm.customerId) || c.name === itm.customerName || c.name === itm.customer);
            const canonicalCustomer = cust?.name || itm.customerName || itm.customer || '—';
            return {
                serial_no: idx + 1,
                order_ref: itm.orderId || itm.order_ref || '—',
                customer: canonicalCustomer,
                customer_name: canonicalCustomer,
                item_name: itm.productName || itm.itemName || itm.itemCode || '—',
                item_code: itm.itemCode || '—',
                target_qty: itm.outputQty || itm.quantity || 0,
                order_qty: itm.quantity || 0,
                allocated_shift: itm.shift || itm.allocated_shift || 'Day',
                est_hours: itm.estHours || itm.est_hours || '—'
            };
        });

        const totalPlannedQty = items.reduce((sum, i) => sum + (Number(i.target_qty) || 0), 0);

        setPrintData({
            ...plan,
            id: plan.id,
            plan_id: plan.id,
            plan_date: plan.date ? new Date(plan.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            planner_name: plan.createdBy || state?.currentUser?.name || 'System Admin',
            production_line: plan.line || plan.productionLine || 'Standard Line',
            status: plan.status || 'Active',
            header: {
                plan_id: plan.id,
                plan_date: plan.date ? new Date(plan.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                planner_name: plan.createdBy || state?.currentUser?.name || 'System Admin',
                production_line: plan.line || plan.productionLine || 'Standard Line',
                status: plan.status || 'Active'
            },
            items,
            totals: {
                totalPlannedQty,
                totalItems: items.length
            }
        });
    };

    const handleDelete = async (planId) => {
        const planToDelete = state.productionPlans.find(p => p.id === planId);
        if (planToDelete && planToDelete.consumptions && Object.keys(planToDelete.consumptions).length > 0) {
            appAlert('Cannot Delete Plan', 'This plan has saved consumption entries. Please delete the consumption data first before deleting the plan.');
            return;
        }

        if(await appConfirm('Are you sure you want to delete this production plan?')) {
            if (planToDelete && planToDelete.items) {
                planToDelete.items.forEach(item => {
                    updateSaleOrderItemStatus(item.orderId, item.itemCode, 'Pending');
                });
            }
            const newPlans = state.productionPlans.filter(p => p.id !== planId);
            setCollection('productionPlans', newPlans);
        }
    };

    const sortedRuns = useMemo(() => {
        let filtered = [...completedRuns];
        if (searchTerm) {
            filtered = filtered.filter(r => r.id.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [completedRuns, searchTerm]);

    const paginatedData = useMemo(() => {
        if (!state?.isGlobalPaginated) return sortedRuns;
        const start = (currentPage - 1) * itemsPerPage;
        return sortedRuns.slice(start, start + itemsPerPage);
    }, [sortedRuns, currentPage, state?.isGlobalPaginated]);

    const totalPages = Math.ceil(sortedRuns.length / itemsPerPage) || 1;

    // Monthly Metrics Calculation
    const { monthlyMetres, efficiencyScore, deviations } = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const currentMonthRuns = completedRuns.filter(r => {
            const d = new Date(r.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        let tOutput = 0;
        let aOutput = 0;

        currentMonthRuns.forEach(r => {
            if (r.items) {
                r.items.forEach(i => {
                    tOutput += parseInt(i.outputQty || 0);
                    const actualOut = (i.outputs || []).reduce((s, o) => s + parseFloat(o.quantity || 0), 0);
                    aOutput += actualOut;
                });
            }
        });
        
        let eff = '0.0';
        let dev = '0.0';
        if (tOutput > 0) {
            eff = ((aOutput / tOutput) * 100).toFixed(1);
            dev = Math.abs(100 - (aOutput / tOutput) * 100).toFixed(1);
        }

        return {
            monthlyMetres: aOutput.toLocaleString(),
            efficiencyScore: eff,
            deviations: dev
        };
    }, [completedRuns]);

    return (
        <div className="animate-in fade-in duration-500 max-w-full w-full pb-24 relative">
            
            {/* Header */}
            <div className="mb-10 print:hidden">
                <h1 className="text-3xl font-manrope font-extrabold tracking-tight text-on-surface">Planning History</h1>
                <p className="text-on-surface-variant font-body mt-1">Review finalized production plans and efficiency deviations over time.</p>
            </div>

            {/* Filters & Actions Bar */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 print:hidden">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Search Plan</label>
                        <div className="flex items-center bg-surface-container-lowest rounded-xl p-1 shadow-sm border border-outline-variant/10 px-3">
                            <span className="material-symbols-outlined text-outline text-[18px]">search</span>
                            <input 
                                className="bg-transparent border-none text-sm focus:ring-0 py-1.5 px-2 w-full text-on-surface" 
                                type="text" 
                                placeholder="e.g. PLN-001"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Date Range</label>
                        <div className="flex items-center bg-surface-container-lowest rounded-xl p-1 shadow-sm border border-outline-variant/10">
                            <input className="bg-transparent border-none text-sm focus:ring-0 py-1.5 px-3 text-on-surface" type="date" />
                            <span className="text-outline mx-1">/</span>
                            <input className="bg-transparent border-none text-sm focus:ring-0 py-1.5 px-3 text-on-surface" type="date" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant ml-1">Status</label>
                        <select className="bg-surface-container-lowest border-none rounded-xl text-sm py-2.5 px-4 shadow-sm focus:ring-2 focus:ring-primary/10 pr-10 appearance-none">
                            <option>All Statuses</option>
                            <option>Completed</option>
                            <option>In Progress</option>
                            <option>Cancelled</option>
                        </select>
                    </div>
                    <button className="bg-surface-container-high text-on-surface font-semibold text-sm py-2.5 px-6 rounded-xl hover:bg-surface-dim transition-all flex items-center gap-2">
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>filter_list</span>
                        Apply Filters
                    </button>
                </div>
            </div>

            {/* Bento Grid - Table Container */}
            <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_20px_40px_rgba(0,28,56,0.06)] overflow-hidden border border-outline-variant/10 print:hidden">
                <div className="overflow-x-auto min-h-[400px] custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-surface-container-low/50">
                                <ResizableHeader className="py-6 px-8 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">Plan ID</ResizableHeader>
                                <ResizableHeader className="py-6 px-8 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">Date Created</ResizableHeader>
                                <ResizableHeader className="py-6 px-8 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">Plan Created By</ResizableHeader>
                                <ResizableHeader className="py-6 px-8 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">Items</ResizableHeader>
                                <ResizableHeader className="py-6 px-8 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">Total Metres</ResizableHeader>
                                <ResizableHeader className="py-6 px-8 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10">Status</ResizableHeader>
                                <ResizableHeader className="py-6 px-8 text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant/10 text-right">Actions</ResizableHeader>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                            {paginatedData.length > 0 ? paginatedData.map((run, idx) => {
                                const isStarted = run.status === 'Completed' || (run.progress && run.progress > 0) || state.productionOutputs?.some(o => o.planId === run.id);
                                return (
                                <tr key={idx} className="hover:bg-surface-container-low/30 transition-colors group">
                                    <td className="py-5 px-8">
                                        <span className="font-bold text-primary">{run.id}</span>
                                    </td>
                                    <td className="py-5 px-8 text-sm font-medium text-on-surface">{new Date(run.date).toLocaleDateString()} <span className="text-on-surface-variant ml-1 font-normal">{new Date(run.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></td>
                                    <td className="py-5 px-8 text-sm font-medium text-on-surface">{run.createdBy || 'System Admin'}</td>
                                    <td className="py-5 px-8 text-sm font-semibold">{run.items?.length || 0}</td>
                                    <td className="py-5 px-8 text-sm font-semibold">{run.items ? run.items.reduce((acc, i) => acc + parseInt(i.outputQty || 0), 0) : 0}m</td>
                                    <td className="py-5 px-8">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${run.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full mr-2 ${run.status === 'Completed' ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`}></span>
                                            {run.status || 'In Progress'}
                                        </span>
                                    </td>
                                    <td className="py-5 px-8 text-right">
                                        <div className="flex justify-end gap-2 group-hover:opacity-100 transition-opacity">
                                            {!isStarted && (
                                                <button onClick={() => onEditPlan && onEditPlan(run.id)} className="p-2 hover:bg-surface-container-high text-on-surface-variant rounded-lg transition-colors" title="Edit Plan"><span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>edit</span></button>
                                            )}
                                            <button onClick={() => setViewPlan(run)} className="p-2 hover:bg-primary-fixed text-primary rounded-lg transition-colors" title="View"><span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>visibility</span></button>
                                            <button onClick={() => handlePrint(run)} className="p-2 hover:bg-primary-fixed text-primary rounded-lg transition-colors" title="Print"><span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>print</span></button>
                                            <button onClick={() => handleDelete(run.id)} className="p-2 hover:bg-error-container text-error rounded-lg transition-colors" title="Delete"><span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>delete</span></button>
                                        </div>
                                    </td>
                                </tr>
                            )}) : (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-on-surface-variant text-sm border-b border-outline-variant/10">No planning history available.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <GlobalPagination 
                    totalItems={sortedRuns.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                />
            </div>

            {/* Dashboard Stats Summary (Bento Sub-element) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 print:hidden">
                <div className="bg-surface-container-highest p-6 rounded-[1.5rem] flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">This Month Efficiency</p>
                        <p className="text-xl font-black text-on-surface">{efficiencyScore}%</p>
                    </div>
                </div>
                <div className="bg-surface-container-highest p-6 rounded-[1.5rem] flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>straighten</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">This Month Metres</p>
                        <p className="text-xl font-black text-on-surface">{monthlyMetres}m</p>
                    </div>
                </div>
                <div className="bg-tertiary-fixed p-6 rounded-[1.5rem] flex items-center gap-4 border border-tertiary/10 text-on-tertiary-fixed-variant">
                    <div className="w-12 h-12 rounded-2xl bg-tertiary/10 flex items-center justify-center text-tertiary">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider">This Month Deviations</p>
                        <p className="text-xl font-black">{deviations}%</p>
                    </div>
                </div>
            </div>

            {/* View Modal (UI only, hidden on print) */}
            {viewPlan && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm print:hidden p-4">
                    <div className="bg-surface text-on-surface w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl shadow-2xl relative flex flex-col">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-surface/90 backdrop-blur-md px-8 py-6 border-b border-outline-variant/20 flex justify-between items-center z-10 shrink-0">
                            <div>
                                <h2 className="text-2xl font-extrabold tracking-tight">Production Plan Document</h2>
                                <p className="text-sm font-semibold text-primary">{viewPlan.id}</p>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => handlePrint(viewPlan)} className="bg-primary text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">print</span>
                                    Print Document
                                </button>
                                <button onClick={() => setViewPlan(null)} className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-8 mb-10">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-outline mb-1">Date Created</h3>
                                    <p className="text-base font-semibold">{new Date(viewPlan.date).toLocaleString()}</p>
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-outline mb-1">Status</h3>
                                    <p className="text-base font-semibold text-primary">{viewPlan.status}</p>
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-outline mb-1">Created By</h3>
                                    <p className="text-base font-semibold">{viewPlan.createdBy || 'System Admin'}</p>
                                </div>
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-outline-variant/30">
                                        <ResizableHeader className="py-3 px-2 text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant">Sale Order</ResizableHeader>
                                        <ResizableHeader className="py-3 px-2 text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant">Customer</ResizableHeader>
                                        <ResizableHeader className="py-3 px-2 text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant">Item</ResizableHeader>
                                        <ResizableHeader className="py-3 px-2 text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant text-right">Order Qty</ResizableHeader>
                                        <ResizableHeader className="py-3 px-2 text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant text-right">Prod Target</ResizableHeader>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant/10">
                                    {viewPlan.items && viewPlan.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="py-4 px-2 font-bold text-sm text-on-surface">{item.orderId}</td>
                                            <td className="py-4 px-2 text-sm font-medium">{item.customerName || item.customer || 'Unknown'}</td>
                                            <td className="py-4 px-2 text-sm font-medium">
                                                {item.productName} <br />
                                                <span className="text-xs font-mono text-outline">{item.itemCode}</span>
                                            </td>
                                            <td className="py-4 px-2 text-sm font-bold text-right text-on-surface-variant">{item.quantity}m</td>
                                            <td className="py-4 px-2 text-sm font-bold text-right text-primary">{item.outputQty || 0}m</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-outline-variant/30">
                                        <th colSpan="4" className="py-4 px-2 text-right text-[11px] font-extrabold uppercase tracking-widest text-on-surface-variant">Total Production Target:</th>
                                        <th className="py-4 px-2 text-right text-lg font-black text-on-surface">
                                            {viewPlan.items ? viewPlan.items.reduce((acc, i) => acc + parseInt(i.outputQty || 0), 0) : 0}m
                                        </th>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {printData && (
                <UniversalPrintPreviewModal
                    isOpen={Boolean(printData)}
                    onClose={() => setPrintData(null)}
                    documentType="planning_history"
                    documentData={printData}
                    documentTitle={`Production Plan #${printData.id}`}
                />
            )}
        </div>
    );
}
