import React, { useState } from 'react';
import ResizableHeader from '../ui/ResizableHeader';
import DraggableResizableHeader from '../ui/DraggableResizableHeader';
import useDynamicColumns from '../../hooks/useDynamicColumns';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import GlobalPagination from '../ui/GlobalPagination';
import UniversalPrintStudioModal from '../ui/UniversalPrintStudioModal';
import { buildStockTransferRecord } from '../../utils/printRecords';

const DEFAULT_COLUMNS = [
  { id: 'transferId', label: 'Transfer ID & Date', visible: true, width: 250 },
  { id: 'route', label: 'Route', visible: true, width: 300 },
  { id: 'payload', label: 'Payload Summary', visible: true, width: 200 },
  { id: 'status', label: 'Status', visible: true, width: 150 },
  { id: 'actions', label: 'Actions', visible: true, width: 200 }
];

export default function StockTransferHistory({ onNewTransferClick }) {
    const { state, deleteStockTransfer, addNotification } = useApp();
    const { appConfirm, appAlert } = useDialog();
    const [searchQuery, setSearchQuery] = useState('');
    const [printTransfer, setPrintTransfer] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    
    const { columns, visibleColumns, toggleColumn, resizeColumn, moveColumn } = useDynamicColumns(DEFAULT_COLUMNS, 'StockTransferHistory_columns');

    const transfers = (state.stockTransfers || []).filter(t => 
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.destination.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const displayedTransfers = state?.isGlobalPaginated
        ? transfers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
        : transfers;

    const handleDelete = async (id, status) => {
        if (status === 'Received') {
            appAlert(`This Transfer Note cannot be deleted because a Stock Receiving Note has already been generated against it. Please delete the associated Stock Receiving Note first.`);
            return;
        }
        if (await appConfirm(`Are you sure you want to delete Transfer ${id}? This action cannot be undone.`)) {
            deleteStockTransfer(id);
            addNotification('Transfer Deleted', `Transfer ${id} has been deleted successfully.`, 'success');
        }
    }
    return (
        <div className="animate-in fade-in zoom-in-95 duration-300">
            {/* Page Header & Actions */}
            <div className="pt-8 pb-8 flex justify-between items-end">
                <div className="space-y-2">
                    <button onClick={() => window.history.back()} className="mb-2 bg-surface-container-low hover:bg-surface-container-high text-on-surface px-4 py-2 rounded-lg font-body font-semibold text-xs shadow-[0_2px_10px_rgba(0,28,56,0.06)] border border-outline-variant/20 flex items-center gap-2 transition-colors w-fit">
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                        Back
                    </button>
                    <p className="font-body text-sm text-on-surface-variant uppercase tracking-widest font-semibold">Shipping</p>
                    <h2 className="text-4xl font-extrabold text-on-surface tracking-tight font-manrope">Stock Transfer History</h2>
                    <p className="font-body text-on-surface-variant max-w-2xl mt-4">Registry of all internal stock movements across regional distribution centers.</p>
                </div>
                <button 
                    onClick={onNewTransferClick}
                    className="bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-lg px-6 py-3 font-body font-medium flex items-center gap-2 hover:opacity-90 transition-opacity shadow-[0_20px_40px_rgba(0,28,56,0.06)]"
                >
                    <span className="material-symbols-outlined text-[1.25rem]">add</span>
                    New Transfer
                </button>
            </div>

            {/* Filter/Search Bar */}
            <div className="mb-8 z-30 sticky top-4 hidden md:block">
                <div className="bg-surface-variant/80 backdrop-blur-xl rounded-xl px-6 py-4 flex items-center justify-between shadow-[0_20px_40px_rgba(0,28,56,0.06)] border border-outline-variant/15">
                    <div className="flex items-center gap-6 w-full max-w-3xl">
                        <div className="relative w-full">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
                            <input 
                                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg py-3 pl-12 pr-4 text-sm font-body text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest focus:border-outline-variant/40 transition-all focus:ring-0" 
                                placeholder="Search by Transfer ID or Destination..." 
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button className="flex items-center gap-2 text-primary font-body font-semibold text-sm px-4 py-2 hover:bg-surface-container-low rounded-lg transition-colors shrink-0">
                            <span className="material-symbols-outlined">filter_list</span>
                            Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="pb-20 flex-1">
                <div className="grid grid-cols-1 gap-6">
                    {/* Status Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                        <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/15">
                            <p className="font-body text-sm text-on-surface-variant mb-2">Total Transfers</p>
                            <p className="font-headline text-3xl font-bold text-on-surface">{state.stockTransfers?.length || 0}</p>
                        </div>
                        <div className="bg-surface-container-lowest rounded-xl p-6 shadow-[0_20px_40px_rgba(0,28,56,0.06)] border border-outline-variant/15 relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-24 h-full bg-primary/5 -skew-x-12 translate-x-4"></div>
                            <p className="font-body text-sm text-on-surface-variant mb-2">In Transit / Pending Receipt</p>
                            <div className="flex items-end gap-3">
                                <p className="font-headline text-3xl font-bold text-primary">{state.stockTransfers?.filter(t => t.status === 'Pending Receipt' || t.status === 'In Transit').length || 0}</p>
                                <span className="material-symbols-outlined text-primary mb-1">local_shipping</span>
                            </div>
                        </div>
                        <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/15">
                            <p className="font-body text-sm text-on-surface-variant mb-2">Received</p>
                            <p className="font-headline text-3xl font-bold text-tertiary">{state.stockTransfers?.filter(t => t.status === 'Received').length || 0}</p>
                        </div>
                        <div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/15">
                            <p className="font-body text-sm text-on-surface-variant mb-2">Flagged / Cancelled</p>
                            <p className="font-headline text-3xl font-bold text-error">{state.stockTransfers?.filter(t => t.status === 'Cancelled' || t.status === 'Flagged').length || 0}</p>
                        </div>
                    </div>

                    {/* Complex List Header & Items as Table */}
                    <div className="bg-surface-container-lowest rounded-xl shadow-[0_20px_40px_rgba(0,28,56,0.06)] border border-outline-variant/15 overflow-hidden">
                        <div className="overflow-x-auto min-h-[300px]">
                            <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', minWidth: `${visibleColumns.reduce((acc, col) => acc + (col.width || 120), 0)}px` }}>
                                <thead className="sticky top-0 bg-surface-container-low/90 backdrop-blur-md z-10 border-b border-outline-variant/20 shadow-sm">
                                    <tr className="bg-surface-container-highest/30 text-[11px] text-on-surface-variant font-black tracking-widest uppercase border-b border-outline-variant/15">
                                        {visibleColumns.map((col, index) => (
                                            <DraggableResizableHeader 
                                                key={col.id}
                                                id={col.id}
                                                defaultWidth={col.width}
                                                onResize={resizeColumn}
                                                onMove={moveColumn}
                                                className={`py-4 px-6 font-semibold`}
                                            >
                                                {col.label}
                                            </DraggableResizableHeader>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedTransfers.map((t, idx) => (
                                        <tr key={idx} className="border-b border-outline-variant/10 hover:bg-surface-bright transition-colors group relative">
                                            {visibleColumns.map(col => {
                                                if (col.id === 'transferId') {
                                                    return (
                                                        <td key={col.id} className="py-4 px-6 align-middle border-r border-outline-variant/5 relative truncate">
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                                                            <p className="font-headline text-sm font-bold text-on-surface">{t.id}</p>
                                                            <p className="font-body text-xs text-on-surface-variant">{t.date}</p>
                                                        </td>
                                                    );
                                                }
                                                if (col.id === 'route') {
                                                    return (
                                                        <td key={col.id} className="py-4 px-6 align-middle border-r border-outline-variant/5 truncate">
                                                            <div className="flex items-center gap-3">
                                                                <div>
                                                                    <p className="font-body text-sm font-medium text-on-surface">{t.source}</p>
                                                                </div>
                                                                <span className="material-symbols-outlined text-outline-variant text-sm">arrow_forward</span>
                                                                <div>
                                                                    <p className="font-body text-sm font-medium text-on-surface">{t.destination}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                }
                                                if (col.id === 'payload') {
                                                    return (
                                                        <td key={col.id} className="py-4 px-6 align-middle border-r border-outline-variant/5 truncate">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded bg-surface-container-low flex items-center justify-center shrink-0">
                                                                    <span className="material-symbols-outlined text-primary">inventory_2</span>
                                                                </div>
                                                                <div>
                                                                    <p className="font-body text-sm text-on-surface">{t.items?.length || 0} Items</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    );
                                                }
                                                if (col.id === 'status') {
                                                    return (
                                                        <td key={col.id} className="py-4 px-6 align-middle border-r border-outline-variant/5 truncate">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container/50 text-on-secondary-container text-xs font-semibold tracking-wide">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                                                {t.status}
                                                            </span>
                                                        </td>
                                                    );
                                                }
                                                if (col.id === 'actions') {
                                                    return (
                                                        <td key={col.id} className="py-4 px-6 align-middle text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button className="p-1.5 text-secondary hover:bg-secondary-container hover:text-on-secondary-container rounded-md transition-colors" title="Print" onClick={() => setPrintTransfer(t)}>
                                                                    <span className="material-symbols-outlined text-[1.25rem]">print</span>
                                                                </button>
                                                                <button className="p-1.5 text-secondary hover:bg-secondary-container hover:text-on-secondary-container rounded-md transition-colors" title="View">
                                                                    <span className="material-symbols-outlined text-[1.25rem]">visibility</span>
                                                                </button>
                                                                <button className="p-1.5 text-secondary hover:bg-secondary-container hover:text-on-secondary-container rounded-md transition-colors" title="Edit">
                                                                    <span className="material-symbols-outlined text-[1.25rem]">edit</span>
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDelete(t.id, t.status)}
                                                                    className="p-1.5 text-error hover:bg-error/10 hover:text-error rounded-md transition-colors" 
                                                                    title="Delete"
                                                                >
                                                                    <span className="material-symbols-outlined text-[1.25rem]">delete</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    );
                                                }
                                                return null;
                                            })}
                                        </tr>
                                    ))}
                                    {transfers.length === 0 && (
                                        <tr>
                                            <td colSpan={visibleColumns.length} className="py-10 text-center text-on-surface-variant">No transfers found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <GlobalPagination 
                        totalItems={transfers.length}
                        itemsPerPage={itemsPerPage}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                    />
                </div>
            </div>

            {printTransfer && (
                <UniversalPrintStudioModal
                    isOpen={!!printTransfer}
                    onClose={() => setPrintTransfer(null)}
                    documentType="stock_transfer"
                    documentData={buildStockTransferRecord(printTransfer, state.items || [])}
                />
            )}
        </div>
    );
}
