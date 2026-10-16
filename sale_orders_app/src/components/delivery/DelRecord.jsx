import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import ResizableHeader from '../ui/ResizableHeader';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

export default function DelRecord() {
  const { state, deleteDelivery } = useApp();
  const { appAlert, appConfirm } = useDialog();
  const { deliveries = [] } = state;
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';

  const [searchTerm, setSearchTerm] = useState('');
  const [printData, setPrintData] = useState(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [viewDc, setViewDc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('latest');
  const itemsPerPage = 10;

  const handlePrint = (dc) => {
    const rawItems = dc.items || [];
    const sumDispatched = rawItems.reduce((acc, it) => acc + (parseFloat(it.dispatchedQty ?? it.editedQty ?? it.dispatch_qty ?? it.quantity ?? it.qty ?? 0) || 0), 0);
    const sumRolls = rawItems.reduce((acc, it) => acc + (parseFloat(it.dispatchedRolls ?? it.rolls ?? it.weight ?? 0) || 0), 0);

    const richDc = {
      ...dc,
      id: dc.id,
      header: {
        challan_no: dc.id,
        challan_number: dc.id,
        date: dc.date ? new Date(dc.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
        customer: dc.customerName || 'N/A',
        customer_name: dc.customerName || 'N/A',
        dc_mode: dc.dcMode || 'Sale Orders',
        driver_name: dc.logistics?.driverName || dc.driverName || '—',
        driver_contact: dc.logistics?.driverNumber || dc.driverContact || '—',
        vehicle_no: dc.logistics?.vehicleNumber || dc.vehicleNumber || '—',
        contact_person: dc.consignee?.contactPerson || dc.contactPerson || '—',
        contact_number: dc.consignee?.contactNumber || dc.contactNumber || '—',
        delivery_address: dc.consignee?.deliveryAddress || dc.deliveryAddress || '—',
        destination: dc.consignee?.deliveryAddress || '—',
        status: dc.status || 'Dispatched'
      },
      consignee: dc.consignee || {},
      logistics: dc.logistics || {},
      items: rawItems.map((it, idx) => ({
        ...it,
        serial_no: idx + 1,
        item_code: it.itemCode || it.sku || it.itemId || '—',
        item_name: it.productName || it.name || it.item_name || 'Item',
        ordered_qty: parseFloat(it.orderedQty ?? it.readyQty ?? it.quantity ?? it.dispatchedQty ?? 0) || 0,
        dispatch_qty: parseFloat(it.dispatchedQty ?? it.editedQty ?? it.dispatch_qty ?? it.quantity ?? it.qty ?? 0) || 0,
        packing_type: it.type || it.stockType || it.packing_type || 'Standard',
        weight: parseFloat(it.dispatchedRolls ?? it.rolls ?? it.weight ?? 0) || 0,
        remarks: it.remarks || '—'
      })),
      totals: {
        'Total Items': rawItems.length,
        ...(sumRolls > 0 ? { 'Total Rolls': sumRolls } : {}),
        'Dispatched Qty': sumDispatched,
        'Grand Total': sumDispatched
      }
    };
    setPrintData(richDc);
  };

  const filteredDeliveries = useMemo(() => {
      return deliveries.filter(d => {
          let matchesSearch = true;
          if (searchTerm) {
              matchesSearch = (d.id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (d.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
          }
          let matchesDate = true;
          if (dateRange.from && dateRange.to) {
              const dDate = new Date(d.date);
              const fDate = new Date(dateRange.from);
              const tDate = new Date(dateRange.to);
              tDate.setHours(23, 59, 59, 999);
              matchesDate = dDate >= fDate && dDate <= tDate;
          }
          return matchesSearch && matchesDate;
      }).sort((a, b) => {
          if (sortOrder === 'latest') return new Date(b.date) - new Date(a.date);
          return new Date(a.date) - new Date(b.date);
      });
  }, [deliveries, searchTerm, dateRange, sortOrder]);

  const totalPages = Math.ceil(filteredDeliveries.length / itemsPerPage);
  const paginatedDeliveries = filteredDeliveries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const stats = useMemo(() => {
    let inTransit = 0;
    let deliveredToday = 0;
    let pendingDrafts = 0;
    const today = new Date().toDateString();

    deliveries.forEach(d => {
      if (d.status === 'Dispatched' || d.status === 'In Transit') inTransit++;
      
      const dDate = new Date(d.date).toDateString();
      if (dDate === today) deliveredToday++;

      if (d.status === 'Draft' || d.status === 'Pending') pendingDrafts++;
    });

    return { inTransit, deliveredToday, pendingDrafts };
  }, [deliveries]);

  return (
      <>
        {printData && (
          <UniversalPrintPreviewModal
            isOpen={Boolean(printData)}
            onClose={() => setPrintData(null)}
            documentType="delivery_challan"
            documentData={printData}
            documentTitle={`Delivery Challan #${printData.id}`}
          />
        )}
    <div className="flex-1 animate-in fade-in duration-500 pb-24">
      {/* Header Section with Asymmetric Layout */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6 w-full">
        <div className="max-w-2xl">
          <nav className="flex items-center gap-2 text-xs font-semibold text-primary mb-2 tracking-widest uppercase">
            <span>Logistics</span>
            <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 0" }}>chevron_right</span>
            <span className="text-on-surface-variant">History</span>
          </nav>
          <h2 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight">Delivery Challan History</h2>
          <p className="text-on-surface-variant mt-3 text-sm leading-relaxed max-w-lg">
            Manage and track your synthetic logistics documentation. View real-time status updates and historical data for all generated delivery challans.
          </p>
        </div>

        {/* Filters: Date Range and More */}
        <div className="flex items-center gap-3 bg-surface-container-low p-2 rounded-2xl shrink-0">
          <div className="flex flex-col px-4 border-r border-outline-variant/20">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">Date Range</span>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dateRange.from} 
                onChange={(e) => setDateRange(prev => ({...prev, from: e.target.value}))}
                className="bg-transparent text-sm font-semibold text-on-surface outline-none cursor-pointer"
              />
              <span className="text-on-surface-variant">-</span>
              <input 
                type="date" 
                value={dateRange.to} 
                onChange={(e) => setDateRange(prev => ({...prev, to: e.target.value}))}
                className="bg-transparent text-sm font-semibold text-on-surface outline-none cursor-pointer"
              />
              <button 
                onClick={() => setDateRange({from: '', to: ''})}
                className="material-symbols-outlined text-sm text-on-surface-variant hover:text-error transition-colors"
                title="Clear Dates"
              >
                close
              </button>
            </div>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-surface-container-lowest rounded-xl text-sm font-semibold text-on-surface shadow-sm hover:shadow-md transition-all outline-none focus:ring-2 focus:ring-primary/20">
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>filter_list</span>
            More Filters
          </button>
        </div>
      </div>

      {/* Bento Stats Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 w-full">
        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-[0_20px_40px_rgba(0,28,56,0.04)] flex flex-col justify-between h-32 border border-outline-variant/5">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Total Challans</span>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black text-on-surface">{deliveries.length}</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Real-time</span>
          </div>
        </div>
        
        <div className="bg-primary text-white p-6 rounded-3xl shadow-xl shadow-primary/10 flex flex-col justify-between h-32">
          <span className="text-xs font-bold text-primary-fixed-dim uppercase tracking-widest">In Transit</span>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black">{stats.inTransit}</span>
            <span className="material-symbols-outlined opacity-50 text-4xl" style={{ fontVariationSettings: "'FILL' 0" }}>local_shipping</span>
          </div>
        </div>
        
        <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-[0_20px_40px_rgba(0,28,56,0.04)] flex flex-col justify-between h-32 border border-outline-variant/5">
          <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Delivered Today</span>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black text-on-surface">{stats.deliveredToday}</span>
            <span className="text-xs font-bold text-primary bg-primary-fixed px-2 py-1 rounded-lg">High Flow</span>
          </div>
        </div>
        
        <div className="bg-tertiary-fixed text-on-tertiary-fixed p-6 rounded-3xl shadow-[0_20px_40px_rgba(0,28,56,0.04)] flex flex-col justify-between h-32">
          <span className="text-xs font-bold text-on-tertiary-fixed-variant uppercase tracking-widest">Pending Drafts</span>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-black">{stats.pendingDrafts < 10 ? `0${stats.pendingDrafts}` : stats.pendingDrafts}</span>
            <span className="material-symbols-outlined opacity-50 text-4xl" style={{ fontVariationSettings: "'FILL' 0" }}>edit_document</span>
          </div>
        </div>
      </div>

      {/* Professional Data Table */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 w-full">
        <div className="relative w-full max-w-md group shrink-0">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-on-surface-variant/50 shadow-sm outline-none" placeholder="Search by Challan ID or Customer Name..." type="text" />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-on-surface-variant uppercase tracking-widest shrink-0">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>sort</span>
          <select 
            value={sortOrder} 
            onChange={e => setSortOrder(e.target.value)}
            className="bg-transparent font-bold text-on-surface outline-none cursor-pointer hover:text-primary transition-colors"
          >
            <option value="latest">Sort by: Latest First</option>
            <option value="oldest">Sort by: Oldest First</option>
          </select>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-[2rem] shadow-[0_40px_80px_rgba(0,28,56,0.05)] overflow-hidden border border-outline-variant/10 w-full mb-10 cursor-default">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container-low/50">
                <ResizableHeader className="px-6 py-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Challan ID</ResizableHeader>
                <ResizableHeader className="px-6 py-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Order/Demand ID</ResizableHeader>
                <ResizableHeader className="px-6 py-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Date</ResizableHeader>
                <ResizableHeader className="px-6 py-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Customer</ResizableHeader>
                <ResizableHeader className="px-6 py-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Mode</ResizableHeader>
                <ResizableHeader className="px-6 py-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Value</ResizableHeader>
                <ResizableHeader className="px-6 py-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Status</ResizableHeader>
                <th className="px-6 py-5 text-[11px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {paginatedDeliveries.length === 0 ? (
                  <tr>
                      <td colSpan="8" className="px-8 py-12 text-center text-on-surface-variant">No delivery challans found.</td>
                  </tr>
              ) : (
                  paginatedDeliveries.map((dc) => {
                      const dateObj = new Date(dc.date);
                      const formattedDate = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
                      const totalItemsCount = dc.items ? dc.items.reduce((acc, it) => acc + (parseFloat(it.dispatchedQty)||0), 0) : 0;
                      const value = dc.totals ? dc.totals.grand : 0;

                      return (
                          <tr key={dc.id} className="hover:bg-surface-container-low/50 transition-colors group">
                            <td className="px-6 py-5 font-bold text-primary tracking-tight whitespace-nowrap">{dc.id}</td>
                            <td className="px-6 py-5 text-sm font-mono text-on-surface-variant whitespace-nowrap">{dc.items?.[0]?.orderId || '-'}</td>
                            <td className="px-6 py-5 text-sm text-on-surface-variant whitespace-nowrap">{formattedDate}</td>
                            <td className="px-6 py-5 font-semibold text-on-surface whitespace-nowrap">{dc.customerName || 'N/A'}</td>
                            <td className="px-6 py-5 text-xs text-on-surface-variant whitespace-nowrap"><span className="bg-surface-container px-2 py-1 rounded">{dc.dcMode || 'Sale Orders'}</span></td>
                            <td className="px-6 py-5 font-bold text-on-surface whitespace-nowrap">{value.toFixed(2)}</td>
                            <td className="px-6 py-5">
                              <div className="flex justify-center">
                                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-primary-fixed text-primary tracking-tighter flex items-center gap-1.5 whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                  {dc.status || 'Dispatched'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center justify-end gap-1 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setViewDc(dc)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary/10 text-secondary transition-colors outline-none focus:ring-2 focus:ring-secondary/20" title="View">
                                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>visibility</span>
                                </button>
                                <button onClick={() => appAlert('Edit is not permitted for finalized delivery challans. Please delete and recreate if needed.')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-tertiary/10 text-tertiary transition-colors outline-none focus:ring-2 focus:ring-tertiary/20" title="Edit">
                                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>edit</span>
                                </button>
                                 <button onClick={() => handlePrint(dc)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer" title="Print">
                                   <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>print</span>
                                 </button>
                                <button onClick={async () => { if(await appConfirm('Are you sure you want to delete this delivery challan? Stock will be reverted.')) { deleteDelivery?.(dc.id) } }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-error/10 text-error transition-colors outline-none focus:ring-2 focus:ring-error/20" title="Delete">
                                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                      );
                  })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Custom Pagination */}
        <div className="px-8 py-6 bg-surface-container-low/20 flex flex-col sm:flex-row items-center justify-between border-t border-outline-variant/10 gap-4">
          <p className="text-sm text-on-surface-variant">Showing <span className="font-bold text-on-surface">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredDeliveries.length)} - {Math.min(currentPage * itemsPerPage, filteredDeliveries.length)}</span> of <span className="font-bold text-on-surface">{filteredDeliveries.length}</span> challans</p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant/30 hover:bg-surface-container transition-colors disabled:opacity-30 outline-none focus:ring-2 focus:ring-primary/20"
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>chevron_left</span>
              </button>
              
              {[...Array(totalPages)].map((_, idx) => {
                const page = idx + 1;
                // Show first, last, current, and +/- 1 from current
                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                  return (
                    <button 
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors font-semibold outline-none focus:ring-2 focus:ring-primary/20 ${currentPage === page ? 'bg-primary text-white shadow-md' : 'hover:bg-surface-container text-on-surface'}`}
                    >
                      {page}
                    </button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-2 text-on-surface-variant">...</span>;
                }
                return null;
              })}

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant/30 hover:bg-surface-container transition-colors disabled:opacity-30 outline-none focus:ring-2 focus:ring-primary/20"
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>chevron_right</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* View Modal Placeholder */}
      {viewDc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-lg w-full">
                  <h3 className="text-lg font-bold mb-4">Delivery Challan {viewDc.id}</h3>
                  <div className="flex flex-col gap-2 text-sm">
                      <p><strong>Date:</strong> {new Date(viewDc.date).toLocaleDateString()}</p>
                      <p><strong>Customer:</strong> {viewDc.customerName}</p>
                      <p><strong>Mode:</strong> {viewDc.dcMode}</p>
                      <p><strong>Total Value:</strong> {currencyCode} {viewDc.totals?.grand?.toFixed(2)}</p>
                      <p><strong>Driver:</strong> {viewDc.logistics?.driverName || 'N/A'}</p>
                      <p><strong>Vehicle:</strong> {viewDc.logistics?.vehicleNumber || 'N/A'}</p>
                  </div>
                  <div className="mt-6 flex justify-end">
                      <button onClick={() => setViewDc(null)} className="px-4 py-2 bg-primary text-white rounded-lg">Close</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  </>
  );
}
