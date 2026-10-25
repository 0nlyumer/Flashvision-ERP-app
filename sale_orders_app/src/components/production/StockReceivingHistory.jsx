import React, { useState } from 'react';
import ResizableHeader from '../ui/ResizableHeader';
import { useApp } from '../../context/AppContext';
import GlobalPagination from '../ui/GlobalPagination';
import UniversalPrintStudioModal from '../ui/UniversalPrintStudioModal';
import { buildStockReceivingRecord } from '../../utils/printRecords';

export default function StockReceivingHistory({ onNewReceiptClick }) {
    const { state, deleteStockReceivingNote } = useApp();
    const [printReceipt, setPrintReceipt] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const realData = (state?.stockTransfers || []).filter(t => t.status === 'Received').map(t => ({
        id: t.id.replace('TRF', 'RCV'),
        date: new Date(t.date || new Date()).toLocaleDateString('en-GB'),
        transferRef: t.id,
        demandId: t.linkedDemand || 'N/A',
        itemsCount: t.receivedItems ? t.receivedItems.length : (t.items ? t.items.length : 0),
        status: t.status,
        originalTransfer: t
    }));

    const displayedData = state?.isGlobalPaginated 
        ? realData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
        : realData;

    // Calculate Stats
    const totalReceipts = realData.length;
    const pendingProcessing = (state?.stockTransfers || []).filter(t => t.status !== 'Received').length;
    const itemsReceived = realData.reduce((sum, item) => sum + item.itemsCount, 0);

    return (
        <div className="animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
            {/* Header Section */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-4xl font-extrabold text-on-surface tracking-tight mb-2 font-manrope">Stock Receiving History</h2>
                    <p className="font-body text-sm text-on-surface-variant">Review and manage past stock receipts securely.</p>
                </div>
                <div className="flex gap-4">
                    <button className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 px-4 py-2 rounded-lg hover:bg-surface-container transition-colors">
                        <span className="material-symbols-outlined text-on-surface-variant text-sm">filter_list</span>
                        <span className="font-body text-sm font-medium text-on-surface">Filter</span>
                    </button>
                    <button className="flex items-center gap-2 bg-surface-container-low border border-outline-variant/20 px-4 py-2 rounded-lg hover:bg-surface-container transition-colors">
                        <span className="material-symbols-outlined text-on-surface-variant text-sm">calendar_today</span>
                        <span className="font-body text-sm font-medium text-on-surface">Last 30 Days</span>
                    </button>
                    <button 
                        onClick={onNewReceiptClick}
                        className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-2 rounded-lg shadow-[0_20px_40px_rgba(0,28,56,0.06)] hover:opacity-90 transition-opacity"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span className="font-body text-sm font-semibold">New Receipt</span>
                    </button>
                </div>
            </div>

            {/* Bento Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-surface-container-lowest p-6 rounded-xl relative overflow-hidden group shadow-[0_10px_30px_rgba(0,28,56,0.03)] border border-outline-variant/15">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-start mb-4">
                        <span className="font-body text-sm font-medium text-on-surface-variant">Total Receipts</span>
                        <span className="material-symbols-outlined text-primary">receipt_long</span>
                    </div>
                    <div className="font-headline text-3xl font-bold text-on-surface">{totalReceipts}</div>
                </div>
                
                <div className="bg-surface-container-lowest p-6 rounded-xl relative overflow-hidden group shadow-[0_10px_30px_rgba(0,28,56,0.03)] border border-outline-variant/15">
                    <div className="absolute inset-0 bg-gradient-to-br from-tertiary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-start mb-4">
                        <span className="font-body text-sm font-medium text-on-surface-variant">Pending Processing</span>
                        <span className="material-symbols-outlined text-tertiary">pending_actions</span>
                    </div>
                    <div className="font-headline text-3xl font-bold text-on-surface">{pendingProcessing}</div>
                    <div className="mt-2 text-xs font-body text-tertiary font-medium flex items-center gap-1">
                        Requires attention
                    </div>
                </div>
                
                <div className="bg-surface-container-lowest p-6 rounded-xl relative overflow-hidden group shadow-[0_10px_30px_rgba(0,28,56,0.03)] border border-outline-variant/15">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-container/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-start mb-4">
                        <span className="font-body text-sm font-medium text-on-surface-variant">Items Received (YTD)</span>
                        <span className="material-symbols-outlined text-primary-container">inventory_2</span>
                    </div>
                    <div className="font-headline text-3xl font-bold text-on-surface">{itemsReceived > 1000 ? (itemsReceived / 1000).toFixed(1) + 'k' : itemsReceived}</div>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-surface-container-lowest rounded-xl flex flex-col flex-1 shadow-[0_20px_40px_rgba(0,28,56,0.06)] border border-outline-variant/15 overflow-hidden">
                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                        <thead>
                            <tr className="bg-surface-container-low text-on-surface-variant font-body text-xs uppercase tracking-wider border-b border-outline-variant/15">
                                <ResizableHeader className="py-4 px-6 font-medium" style={{ width: '15%' }}>Receipt ID</ResizableHeader>
                                <ResizableHeader className="py-4 px-6 font-medium" style={{ width: '15%' }}>Date</ResizableHeader>
                                <ResizableHeader className="py-4 px-6 font-medium" style={{ width: '15%' }}>Transfer Ref</ResizableHeader>
                                <ResizableHeader className="py-4 px-6 font-medium" style={{ width: '15%' }}>Demand ID</ResizableHeader>
                                <ResizableHeader className="py-4 px-6 font-medium text-right" style={{ width: '10%' }}>Items Count</ResizableHeader>
                                <ResizableHeader className="py-4 px-6 font-medium" style={{ width: '10%' }}>Status</ResizableHeader>
                                <ResizableHeader className="py-4 px-6 font-medium text-right" style={{ width: '20%' }}>Actions</ResizableHeader>
                            </tr>
                        </thead>
                        <tbody className="font-body text-sm text-on-surface">
                            {displayedData.map((item, idx) => (
                                <tr key={item.id} className={`border-b border-outline-variant/10 hover:bg-surface/50 transition-colors ${idx % 2 !== 0 ? 'bg-surface-container-low/30' : ''}`}>
                                    <td className="py-4 px-6 font-semibold border-r border-outline-variant/5">{item.id}</td>
                                    <td className="py-4 px-6 text-on-surface-variant border-r border-outline-variant/5">{item.date}</td>
                                    <td className="py-4 px-6 border-r border-outline-variant/5">{item.transferRef}</td>
                                    <td className="py-4 px-6 border-r border-outline-variant/5">{item.demandId}</td>
                                    <td className="py-4 px-6 text-right border-r border-outline-variant/5">{item.itemsCount}</td>
                                    <td className="py-4 px-6 border-r border-outline-variant/5">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                className="text-on-surface-variant hover:text-primary transition-colors p-1" 
                                                title="View"
                                                onClick={() => alert(`View receipt ${item.id}`)}
                                            >
                                                <span className="material-symbols-outlined text-sm">visibility</span>
                                            </button>
                                            <button 
                                                className="text-on-surface-variant hover:text-primary transition-colors p-1" 
                                                title="Edit"
                                                onClick={() => alert(`Edit receipt ${item.id}`)}
                                            >
                                                <span className="material-symbols-outlined text-sm">edit</span>
                                            </button>
                                            <button 
                                                className="text-on-surface-variant hover:text-secondary transition-colors p-1" 
                                                title="Print"
                                                onClick={() => setPrintReceipt(item.originalTransfer)}
                                            >
                                                <span className="material-symbols-outlined text-sm">print</span>
                                            </button>
                                            <button 
                                                className="text-on-surface-variant hover:text-error transition-colors p-1" 
                                                title="Delete"
                                                onClick={() => {
                                                    if (window.confirm('Are you sure you want to delete this receipt?')) {
                                                        deleteStockReceivingNote(item.originalTransfer.id);
                                                    }
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <GlobalPagination 
                    totalItems={realData.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                />
            </div>

            {printReceipt && (
                <UniversalPrintStudioModal
                    isOpen={!!printReceipt}
                    onClose={() => setPrintReceipt(null)}
                    documentType="stock_receiving_history"
                    documentData={buildStockReceivingRecord(printReceipt)}
                />
            )}
        </div>
    );
}
