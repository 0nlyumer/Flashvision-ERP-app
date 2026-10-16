import React, { useState } from 'react';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';
import { useApp } from '../../context/AppContext';
import GlobalPagination from '../ui/GlobalPagination';

export default function OmsSlip({ activeRuns = [] }) {
    const { state } = useApp();
    const [currentPage, setCurrentPage] = useState(1);
    const [printData, setPrintData] = useState(null);
    const itemsPerPage = 20;

    const displayedData = state?.isGlobalPaginated 
        ? activeRuns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
        : activeRuns;

    if (activeRuns.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <span className="material-symbols-outlined text-[80px] text-surface-container-highest mb-4">description</span>
                <h2 className="text-2xl font-manrope font-extrabold text-on-surface">No Production Slips Generated</h2>
                <p className="text-on-surface-variant font-medium mt-2 max-w-md text-center">
                    Plan a production run from the Planning tab to generate job sheets and tracking slips.
                </p>
            </div>
        );
    }

    const handlePrint = (run) => {
        if (!run) return;
        const cust = state.customers?.find(c => (run.customerId && c.id === run.customerId) || c.name === run.customerName);
        const canonicalCustomer = cust?.name || run.customerName || 'Customer Party';

        setPrintData({
            ...run,
            id: run.id,
            manifest_no: run.id,
            plan_id: run.planId || run.id,
            date: run.startTime ? new Date(run.startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            production_line: run.line || run.productionLine || 'Main Factory Floor',
            supervisor: run.supervisor || state?.currentUser?.name || 'Shift Supervisor',
            shift: run.shift || 'General Shift',
            customer_name: canonicalCustomer,
            header: {
                manifest_no: run.id,
                plan_id: run.planId || run.id,
                date: run.startTime ? new Date(run.startTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                production_line: run.line || run.productionLine || 'Main Factory Floor',
                supervisor: run.supervisor || state?.currentUser?.name || 'Shift Supervisor',
                shift: run.shift || 'General Shift',
                sale_order: run.orderId || '—',
                customer: canonicalCustomer
            },
            items: [
                {
                    serial_no: 1,
                    item_code: run.itemCode || '—',
                    item_name: run.productName || '—',
                    target_qty: run.quantity || 0,
                    uom: 'Meters',
                    batch_no: run.batchNo || run.id,
                    status: run.remaining === 0 ? 'Completed' : 'Running',
                    output_qty: run.outputQty || 0,
                    remaining_qty: run.remaining !== undefined ? run.remaining : run.quantity,
                    required_material: run.requiredFabricName || '—'
                }
            ],
            totals: {
                totalTargetQty: `${run.quantity || 0} Meters`,
                totalOutputQty: `${run.outputQty || 0} Meters`,
                totalRemainingQty: `${run.remaining !== undefined ? run.remaining : run.quantity} Meters`
            }
        });
    };

    return (
        <>
        {/* ON-SCREEN UI */}
        <div className="animate-in fade-in duration-500 max-w-[1920px] mx-auto pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
                <div>
                    <h1 className="text-3xl font-manrope font-extrabold tracking-tight text-on-surface">Final Production Slip</h1>
                    <p className="text-on-surface-variant font-body mt-1">Generate and print production routing slips for the factory floor.</p>
                </div>
            </div>

            {/* Slip Cards Container */}
            <div className="grid grid-cols-1 gap-6">
                {displayedData.map((run, idx) => (
                    <div key={run.id} className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/15 shadow-sm relative overflow-hidden group">
                        
                        {/* Decorative Background Element */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                        <div className="relative z-10 flex flex-col xl:flex-row justify-between gap-8">
                            
                            {/* Header Info */}
                            <div className="xl:w-1/4 pr-8 xl:border-r border-outline-variant/20">
                                <div className="mb-6">
                                    <span className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest mb-1 block">Production Routing Slip</span>
                                    <h2 className="text-2xl font-manrope font-black text-on-surface">{run.id}</h2>
                                    <p className="text-sm font-medium text-on-surface-variant mt-1">Generated: {new Date(run.startTime).toLocaleString()}</p>
                                </div>
                                <button 
                                    onClick={() => handlePrint(run)}
                                    className="w-full bg-surface-container-low hover:bg-primary/10 text-primary font-bold py-3 px-4 rounded-xl transition-colors border border-outline-variant/20 flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>print</span>
                                    Print Job Card
                                </button>
                            </div>

                            {/* Main Details Table Area */}
                            <div className="xl:w-3/4 overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b-2 border-outline-variant/10">
                                            <th className="py-2 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Sale Order</th>
                                            <th className="py-2 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Customer</th>
                                            <th className="py-2 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Item details</th>
                                            <th className="py-2 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Required Material</th>
                                            <th className="py-2 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Order Metres</th>
                                            <th className="py-2 px-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Output</th>
                                            <th className="py-2 px-4 text-[10px] font-extrabold text-tertiary uppercase tracking-wider text-right">Remaining</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y border-outline-variant/10">
                                        <tr>
                                            <td className="py-4 px-4 align-top">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-sm text-on-surface">{run.orderId || 'N/A'}</span>
                                                    <span className="text-xs text-on-surface-variant">{run.orderDate ? new Date(run.orderDate).toLocaleDateString() : 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 align-top">
                                                <span className="font-semibold text-sm text-on-surface">{run.customerName || 'Unknown'}</span>
                                            </td>
                                            <td className="py-4 px-4 align-top">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-sm text-on-surface">{run.productName}</span>
                                                    <span className="font-mono text-xs bg-slate-100 text-slate-600 px-1 py-0.5 rounded w-fit">{run.itemCode}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 align-top">
                                                <span className="text-sm font-semibold text-on-surface">{run.requiredFabricName || 'None'}</span>
                                            </td>
                                            <td className="py-4 px-4 align-top text-right">
                                                <span className="font-manrope font-black text-on-surface">{run.quantity} <span className="text-xs text-on-surface-variant font-medium">m</span></span>
                                            </td>
                                            <td className="py-4 px-4 align-top text-right">
                                                <span className="font-manrope font-black text-on-surface-variant">{run.outputQty || 0} <span className="text-xs text-on-surface-variant font-medium">m</span></span>
                                            </td>
                                            <td className="py-4 px-4 align-top text-right">
                                                <span className="font-manrope font-black text-tertiary text-lg">{run.remaining !== undefined ? run.remaining : run.quantity} <span className="text-sm text-on-surface-variant font-medium">m</span></span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Footer Bar of the slip row */}
                                <div className="mt-8 flex items-center justify-between bg-surface-container-low rounded-xl p-4 border border-outline-variant/10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                                        <span className="text-xs font-bold text-primary uppercase tracking-widest">Routing Sent to Machine Line</span>
                                    </div>
                                    <div className="text-xs font-mono text-on-surface-variant">BARCODE: {run.id.replace('RUN-', '')}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-8">
                <GlobalPagination 
                    totalItems={activeRuns.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                />
            </div>
        </div>

        {printData && (
            <UniversalPrintPreviewModal
                isOpen={Boolean(printData)}
                onClose={() => setPrintData(null)}
                documentType="production_manifest"
                documentData={printData}
                documentTitle={`Production Slip #${printData.id}`}
            />
        )}
        </>
    );
}
