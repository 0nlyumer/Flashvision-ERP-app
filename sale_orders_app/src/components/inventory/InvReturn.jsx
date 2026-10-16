import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import ResizableHeader from '../ui/ResizableHeader';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';
import GlobalPagination from '../ui/GlobalPagination';

export default function InvReturn({ selectedDepartments = [] }) {
  const { state, addReturn, deleteReturn, toggleGlobalPagination } = useApp();
  
  const [activeTab, setActiveTab] = useState('process'); // 'process' | 'history'
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loadedOrder, setLoadedOrder] = useState(null);
  const [returnItems, setReturnItems] = useState({}); // { itemId: { qty: X, reason: Y, checked: true/false } }
  const [globalReason, setGlobalReason] = useState('Damaged');
  const [remarks, setRemarks] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [printData, setPrintData] = useState(null);

  const handleSearch = () => {
      if (!searchQuery.trim()) return;
      const order = state?.saleOrders?.find(o => 
          o.id.toLowerCase() === searchQuery.toLowerCase() ||
          o.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (order) {
          setLoadedOrder(order);
          // Initialize return items
          let initialReturns = {};
          order.items?.forEach(i => {
              initialReturns[i.id] = { qty: 0, reason: globalReason, checked: false, orderedQty: i.quantity, itemCode: i.itemCode, name: i.productName };
          });
          setReturnItems(initialReturns);
      } else {
          alert('No order found matching: ' + searchQuery);
      }
  };

  const handleItemToggle = (itemId) => {
      setReturnItems(prev => ({
          ...prev,
          [itemId]: { ...prev[itemId], checked: !prev[itemId].checked }
      }));
  };

  const handleQtyChange = (itemId, qty) => {
      setReturnItems(prev => ({
          ...prev,
          [itemId]: { ...prev[itemId], qty: qty }
      }));
  };

  const handleReasonChange = (itemId, reason) => {
      setReturnItems(prev => ({
          ...prev,
          [itemId]: { ...prev[itemId], reason: reason }
      }));
  };

  const applyGlobalReason = (e) => {
      const reason = e.target.value;
      setGlobalReason(reason);
      setReturnItems(prev => {
          let next = { ...prev };
          Object.keys(next).forEach(k => {
              next[k].reason = reason;
          });
          return next;
      });
  };

  const handleProcessReturn = () => {
      if (!loadedOrder) return;
      const itemsToReturn = Object.keys(returnItems)
          .filter(k => returnItems[k].checked && parseFloat(returnItems[k].qty) > 0)
          .map(k => ({
              itemId: k,
              itemCode: returnItems[k].itemCode,
              name: returnItems[k].name,
              qty: parseFloat(returnItems[k].qty),
              reason: returnItems[k].reason
          }));

      if (itemsToReturn.length === 0) {
          alert('Please select items and enter valid return quantities.');
          return;
      }

      const returnData = {
          id: `RET-${Date.now()}`,
          orderId: loadedOrder.id,
          customerName: loadedOrder.customerName,
          date: new Date().toLocaleDateString(),
          timestamp: Date.now(),
          remarks: remarks,
          items: itemsToReturn
      };

      addReturn(returnData);
      
      // Reset
      setLoadedOrder(null);
      setReturnItems({});
      setRemarks('');
      setSearchQuery('');
      setActiveTab('history');
  };

  const filteredReturns = useMemo(() => {
      let returns = state?.returns || [];
      return [...returns].sort((a,b) => b.timestamp - a.timestamp);
  }, [state?.returns]);

  // Pagination for history
  const isPaginated = state?.isGlobalPaginated;
  const totalPages = Math.ceil(filteredReturns.length / itemsPerPage) || 1;
  const displayedReturns = isPaginated 
      ? filteredReturns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      : filteredReturns;

  const handleDeleteReturn = (id) => {
      if(window.confirm('Are you sure you want to delete this return? Stock will be reversed (subtracted).')) {
          deleteReturn(id);
      }
  };

  const handlePrintReturn = (ret) => {
      if (!ret) return;
      const cust = state.customers?.find(c => c.name === ret.customerName || (ret.customerId && c.id === ret.customerId));
      const resolvedCustomer = cust?.name || ret.customerName || 'Customer Party';
      const rawItems = ret.items || [];
      const formattedItems = rawItems.map((it, idx) => ({
          serial_no: idx + 1,
          item_code: it.itemCode || it.itemId || `ITM-${idx + 1}`,
          item_name: it.name || it.productName || it.item_name || 'Returned Item',
          inv_qty: it.invoicedQty || it.origQty || it.dispatchedQty || '—',
          returned_qty: it.qty || it.returnQty || 0,
          unit_price: it.price || it.rate || 0,
          reason: it.reason || ret.reason || 'Return'
      }));
      const totalQty = formattedItems.reduce((s, it) => s + (parseFloat(it.returned_qty) || 0), 0);

      setPrintData({
          ...ret,
          id: ret.id,
          return_no: ret.id,
          date: ret.date || new Date().toISOString().split('T')[0],
          party_name: resolvedCustomer,
          customer_name: resolvedCustomer,
          customer: resolvedCustomer,
          reason: ret.reason || ret.remarks || 'Customer Return',
          header: {
              return_no: ret.id,
              date: ret.date || new Date().toISOString().split('T')[0],
              party_name: resolvedCustomer,
              customer_name: resolvedCustomer,
              order_ref: ret.orderId || '—',
              so_ref: ret.orderId || '—',
              reason: ret.reason || ret.remarks || 'Customer Return',
              remarks: ret.remarks || 'None'
          },
          items: formattedItems,
          totals: {
              'Total Items': formattedItems.length,
              'Total Returned Qty': totalQty
          }
      });
  };

  return (
    <>
    <div className="animate-in fade-in duration-500 max-w-full px-6 mx-auto pb-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface mb-2 font-headline">Process Stock Return</h1>
          <p className="text-on-surface-variant text-lg max-w-2xl leading-relaxed font-body">Search for an order or DC to process returns and immediately reconcile inventory levels.</p>
        </div>
        {activeTab === 'process' && (
            <button 
                onClick={() => setActiveTab('history')}
                className="px-6 py-3 rounded-xl bg-surface-container-high border border-outline-variant/20 hover:bg-surface-container-highest transition-colors font-bold text-sm flex items-center gap-2"
            >
                <span className="material-symbols-outlined text-[18px]">history</span>
                View Return History
            </button>
        )}
      </div>

      {activeTab === 'process' && (
          <div className="space-y-8">
              {/* Search Section */}
              <div className="bg-surface-container-lowest p-8 rounded-[2rem] shadow-[0_10px_30px_rgba(0,28,56,0.03)] border border-primary/10">
                <div className="max-w-2xl">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3 block">Primary Search: Sale Order / DC Challan</label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary" style={{ fontVariationSettings: "'FILL' 0" }}>receipt_long</span>
                      <input 
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-primary transition-all text-lg font-semibold outline-none" 
                          placeholder="Enter SO Number (e.g. SO-001)..." 
                          type="text" 
                          onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      />
                    </div>
                    <button onClick={handleSearch} className="bg-primary text-on-primary px-8 py-4 rounded-xl font-bold hover:bg-primary-container transition-colors flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
                      Load Items
                    </button>
                  </div>
                </div>
              </div>

              {/* Form Area */}
              {loadedOrder && (
                  <div className="bg-surface-container-lowest p-8 rounded-[2rem] shadow-[0_20px_40px_rgba(0,28,56,0.04)] border border-outline-variant/10 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                    <div className="flex justify-between items-center mb-6 pl-2">
                      <h3 className="text-xl font-bold flex items-center gap-2 font-headline">
                        <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 0" }}>inventory</span>
                        Items from {loadedOrder.id} ({loadedOrder.customerName})
                      </h3>
                      <span className="text-xs font-bold bg-secondary-container text-on-secondary-fixed-variant px-3 py-1 rounded-full">{loadedOrder.items?.length || 0} Items</span>
                    </div>

                    {/* Loaded Items List */}
                    <div className="space-y-4 mb-8">
                      {loadedOrder.items?.map(item => {
                          const stateItem = returnItems[item.id];
                          if (!stateItem) return null;
                          return (
                          <div key={item.id} className={`grid grid-cols-1 sm:grid-cols-12 items-center p-4 rounded-xl border transition-all gap-4 ${stateItem.checked ? 'bg-primary/5 border-primary/20' : 'bg-surface-container-low border-transparent hover:border-outline-variant/20'}`}>
                            <div className="sm:col-span-1 border-b sm:border-0 pb-2 sm:pb-0 flex justify-start sm:justify-center">
                              <input 
                                  checked={stateItem.checked}
                                  onChange={() => handleItemToggle(item.id)}
                                  className="w-5 h-5 rounded border-outline text-primary focus:ring-primary cursor-pointer" 
                                  type="checkbox" 
                              />
                            </div>
                            <div className="sm:col-span-4">
                              <p className="font-bold text-on-surface">{item.productName}</p>
                              <p className="text-xs text-on-surface-variant font-medium">SKU: {item.itemCode}</p>
                            </div>
                            <div className="sm:col-span-2 text-start sm:text-center">
                              <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Ordered</p>
                              <p className="font-bold text-on-surface">{item.quantity} Units</p>
                            </div>
                            <div className="sm:col-span-2 text-start sm:text-center">
                              <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Produced</p>
                              <p className="font-bold text-on-surface">{item.producedQty || 0} Units</p>
                            </div>
                            <div className="sm:col-span-3 space-y-2">
                              <div>
                                  <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Return Qty</p>
                                  <input 
                                      value={stateItem.qty}
                                      onChange={e => handleQtyChange(item.id, e.target.value)}
                                      className="w-full bg-surface-container-lowest border-outline-variant/50 border rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-primary outline-none text-on-surface" 
                                      type="number" 
                                      min="0"
                                      disabled={!stateItem.checked}
                                  />
                              </div>
                            </div>
                          </div>
                      )})}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-surface-container">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Return Reason (Apply to All)</label>
                        <div className="relative">
                          <select 
                              value={globalReason}
                              onChange={applyGlobalReason}
                              className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-4 focus:ring-2 focus:ring-primary transition-all appearance-none outline-none font-semibold text-sm">
                            <option>Damaged</option>
                            <option>Wrong Item</option>
                            <option>Surplus</option>
                            <option>Quality Failure</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none" style={{ fontVariationSettings: "'FILL' 0" }}>expand_more</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Remarks/Notes</label>
                        <textarea 
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                            className="w-full bg-surface-container-low border border-outline-variant/10 rounded-xl px-4 py-4 focus:ring-2 focus:ring-primary transition-all outline-none text-sm" 
                            placeholder="Additional details about the items' condition or customer feedback..." 
                            rows="1"
                        ></textarea>
                      </div>
                    </div>

                    <div className="flex justify-end mt-8 gap-4">
                        <button onClick={() => setLoadedOrder(null)} className="px-6 py-2.5 rounded-xl border border-outline text-on-surface font-semibold hover:bg-surface-container-low transition-all">Cancel</button>
                        <button onClick={handleProcessReturn} className="px-8 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold shadow-lg shadow-primary/20 flex items-center gap-2 hover:scale-[1.02] transition-all">
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            Process Return
                        </button>
                    </div>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'history' && (
          <div className="animate-in fade-in space-y-6">
              {/* Back Button */}
              <button 
                  onClick={() => setActiveTab('process')}
                  className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-sm font-bold flex items-center gap-2 text-on-surface-variant w-fit"
              >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Back to Process Return
              </button>

              {/* Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>assignment_return</span>
                    </div>
                    <span className="text-[10px] font-bold tracking-widest text-primary bg-primary/5 px-2 py-1 rounded">MONTHLY</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface-variant mb-1">Total Returns</p>
                    <h2 className="text-4xl font-black text-on-surface">{filteredReturns.length.toLocaleString()}</h2>
                    <p className="text-xs font-medium text-primary mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">trending_down</span>
                        12% less than last month
                    </p>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center text-error">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                    </div>
                    <span className="text-[10px] font-bold tracking-widest text-error bg-error/5 px-2 py-1 rounded">ALERT</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface-variant mb-1">Quarantined</p>
                    <h2 className="text-4xl font-black text-on-surface">42</h2>
                    <p className="text-xs font-medium text-error mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">priority_high</span>
                        Action required on 8 items
                    </p>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/10 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center text-tertiary">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <span className="text-[10px] font-bold tracking-widest text-tertiary bg-tertiary/5 px-2 py-1 rounded">SUCCESS</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface-variant mb-1">Processed</p>
                    <h2 className="text-4xl font-black text-on-surface">{filteredReturns.length.toLocaleString()}</h2>
                    <p className="text-xs font-medium text-tertiary mt-2 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">done_all</span>
                        96% clearance rate
                    </p>
                  </div>
                </div>
              </div>

              {/* Detailed History */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 overflow-hidden">
                <div className="p-6 border-b border-outline-variant/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-on-surface font-headline">Detailed History</h3>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
                      <input 
                          className="bg-surface-container-low border border-outline-variant/20 rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none min-w-[250px]" 
                          placeholder="Return ID or Customer..." 
                          type="text" 
                      />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-low border border-outline-variant/20 rounded-lg text-sm font-bold hover:bg-surface-container-high transition-colors text-on-surface">
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 0" }}>filter_list</span>
                      Filter
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant/10">
                    <tr>
                      <ResizableHeader className="px-6 py-4 text-[11px] font-black uppercase tracking-widest">Return ID / Date</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[11px] font-black uppercase tracking-widest">Order Ref</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[11px] font-black uppercase tracking-widest">Customer</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[11px] font-black uppercase tracking-widest">Items Returned</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[11px] font-black uppercase tracking-widest">Remarks</ResizableHeader>
                      <ResizableHeader className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-right">Actions</ResizableHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {displayedReturns.length > 0 ? displayedReturns.map(ret => (
                        <tr key={ret.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-on-surface">{ret.id}</div>
                            <div className="text-[10px] text-on-surface-variant font-mono mt-0.5">{ret.date}</div>
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-primary font-semibold">{ret.orderId}</td>
                          <td className="px-6 py-4 text-sm font-bold text-on-surface">{ret.customerName}</td>
                          <td className="px-6 py-4">
                              <span className="bg-secondary-container text-on-secondary-fixed-variant px-3 py-1 rounded-full text-xs font-bold">
                                  {ret.items.length} Items
                              </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-on-surface-variant max-w-[200px] truncate" title={ret.remarks}>{ret.remarks || '—'}</td>
                          <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2 items-center text-primary">
                                  <button className="p-2 hover:bg-primary/10 rounded-full transition-colors" title="View">
                                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>visibility</span>
                                  </button>
                                  <button onClick={() => handlePrintReturn(ret)} className="p-2 hover:bg-primary/10 rounded-full transition-colors" title="Print">
                                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>print</span>
                                  </button>
                                  <button className="p-2 hover:bg-primary/10 rounded-full transition-colors" title="Edit">
                                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>edit</span>
                                  </button>
                                  <button onClick={() => handleDeleteReturn(ret.id)} className="p-2 text-error hover:bg-error/10 rounded-full transition-colors" title="Delete">
                                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>delete</span>
                                  </button>
                              </div>
                          </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan="6" className="px-6 py-16 text-center text-on-surface-variant">
                                <div className="flex flex-col items-center justify-center">
                                    <span className="material-symbols-outlined text-5xl opacity-20 mb-4" style={{ fontVariationSettings: "'FILL' 0" }}>assignment_return</span>
                                    <p className="font-bold">No returns processed yet</p>
                                    <p className="text-xs mt-1 max-w-md">Search and process a return to see it listed here.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <GlobalPagination 
                  totalItems={filteredReturns.length}
                  itemsPerPage={itemsPerPage}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
              />
          </div>
          </div>
      )}
    </div>

    {printData && (
      <UniversalPrintPreviewModal
        isOpen={Boolean(printData)}
        onClose={() => setPrintData(null)}
        documentType="inventory_return"
        documentData={printData}
        documentTitle={`Stock Return Note #${printData.id}`}
      />
    )}
    </>
  );
}
