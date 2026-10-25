import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import GlobalPagination from '../ui/GlobalPagination';

export default function InwardGatePass() {
  const { state, setCollection } = useApp();
  const { appAlert, appConfirm } = useDialog();

  const [activeTab, setActiveTab] = useState('create');
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [poId, setPoId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const pendingOrders = useMemo(() => {
    return (state.purchaseOrders || []).filter(po => po.status === 'Pending' || po.status === 'Partially Received');
  }, [state.purchaseOrders]);

  const handlePOSelection = (e) => {
    const selectedPoId = e.target.value;
    setPoId(selectedPoId);
    if (selectedPoId) {
      const po = state.purchaseOrders.find(p => p.id === selectedPoId);
      if (po) {
        setItems(po.items.map(it => ({
          ...it,
          receivedQty: it.orderQty, // Default to full order quantity
        })));
      }
    } else {
      setItems([]);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = parseFloat(value) || 0;
    setItems(newItems);
  };

  const getNextIGPId = () => {
    const igps = state.inwardGatePasses || [];
    let max = 0;
    igps.forEach(igp => {
      const parts = igp.id.split('-');
      if (parts.length === 2 && !isNaN(parts[1])) {
        const num = parseInt(parts[1], 10);
        if (num > max) max = num;
      }
    });
    return `IGP-${String(max + 1).padStart(3, '0')}`;
  };

  const handleSaveIGP = () => {
    if (!poId) {
      appAlert('Please select a Purchase Order.');
      return;
    }
    if (!vehicleNo) {
      appAlert('Please enter Vehicle Number.');
      return;
    }
    if (items.length === 0) {
      appAlert('No items to receive.');
      return;
    }

    const newIGP = {
      id: getNextIGPId(),
      date,
      poId,
      supplierName: state.purchaseOrders.find(po => po.id === poId)?.supplierName || '',
      vehicleNo,
      driverName,
      remarks,
      items,
      status: 'Pending', // Becomes 'Received' when GRN is made
      createdAt: new Date().toISOString()
    };

    setCollection('inwardGatePasses', [newIGP, ...(state.inwardGatePasses || [])]);
    
    // Partially update PO status if needed? Actually we will just wait for GRN for final stock/status, but let's set PO to 'Gate Pass Issued'
    const updatedPOs = state.purchaseOrders.map(po => 
      po.id === poId ? { ...po, status: 'Gate Pass Issued' } : po
    );
    setCollection('purchaseOrders', updatedPOs);

    appAlert(`Inward Gate Pass ${newIGP.id} generated successfully!`, 'success');
    
    // Reset
    setDate(new Date().toISOString().split('T')[0]);
    setPoId('');
    setVehicleNo('');
    setDriverName('');
    setRemarks('');
    setItems([]);
    setActiveTab('history');
  };

  const isIGPLocked = (igpId) => {
    const grns = state.grns || [];
    return grns.some(grn => grn.igpId === igpId);
  };

  const handleDeleteIGP = async (igpId, linkedPoId) => {
    if (isIGPLocked(igpId)) {
      appAlert('This Inward Gate Pass cannot be deleted because a Goods Receiving Note has already been generated against it.');
      return;
    }
    if (await appConfirm(`Are you sure you want to delete ${igpId}?`)) {
      setCollection('inwardGatePasses', (state.inwardGatePasses || []).filter(igp => igp.id !== igpId));
      
      if (linkedPoId) {
        const updatedPOs = state.purchaseOrders.map(po => 
          po.id === linkedPoId ? { ...po, status: 'Pending' } : po
        );
        setCollection('purchaseOrders', updatedPOs);
      }
      appAlert(`${igpId} deleted successfully.`, 'info');
    }
  };

  const handlePrintIGP = (igp) => {
    appAlert('Print functionality will generate a PDF for: ' + igp.id);
  };

  const igps = (state.inwardGatePasses || []).filter(igp => 
    igp.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    igp.vehicleNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedIgps = state?.isGlobalPaginated
      ? igps.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      : igps;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-6">
          <div>
              <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase mb-1">
                  <span className="material-symbols-outlined text-sm">local_shipping</span>
                  Security & Dispatch
              </div>
              <h2 className="text-3xl font-black text-on-surface">Inward Gate Pass</h2>
          </div>
          <div className="flex gap-2 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/20">
              <button 
                  onClick={() => setActiveTab('create')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                  Create IGP
              </button>
              <button 
                  onClick={() => setActiveTab('history')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                  History Logs
              </button>
          </div>
      </div>

      {activeTab === 'create' && (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-sm overflow-hidden flex flex-col flex-1">
            <div className="p-6 border-b border-outline-variant/10 grid grid-cols-1 md:grid-cols-4 gap-6 bg-surface/50">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Arrival Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ref Purchase Order</label>
                    <select value={poId} onChange={handlePOSelection} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary">
                        <option value="">-- Select PO --</option>
                        {pendingOrders.map(po => <option key={po.id} value={po.id}>{po.id} - {po.supplierName}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Vehicle No</label>
                    <input type="text" value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} placeholder="e.g. TX-1234" className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Driver Name & Phone</label>
                    <input type="text" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Name / Contact" className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                </div>
            </div>

            {/* Items Table */}
            <div className="flex-1 overflow-auto p-6">
                {items.length > 0 ? (
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                                <th className="pb-3 font-semibold">Item Code</th>
                                <th className="pb-3 font-semibold">Description</th>
                                <th className="pb-3 font-semibold text-right">Order Qty</th>
                                <th className="pb-3 font-semibold text-right">Gate Received Qty</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                            {items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-surface-container-low/50">
                                    <td className="py-3 text-on-surface font-medium">{it.itemCode}</td>
                                    <td className="py-3 text-on-surface">{it.itemName}</td>
                                    <td className="py-3 text-on-surface-variant text-right">{it.orderQty} {it.uom}</td>
                                    <td className="py-3 text-right">
                                        <input 
                                          type="number" 
                                          value={it.receivedQty} 
                                          onChange={(e) => handleItemChange(idx, 'receivedQty', e.target.value)}
                                          className="w-32 text-right bg-surface border border-outline-variant/30 rounded px-2 py-1 focus:ring-1 focus:ring-primary"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-60 py-10">
                        <span className="material-symbols-outlined text-4xl mb-2">airport_shuttle</span>
                        <p>Select a Purchase Order to view expected items.</p>
                    </div>
                )}
            </div>

            <div className="p-6 border-t border-outline-variant/10 flex justify-between items-center bg-surface-container-lowest/50">
                <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Gate Security Remarks" className="w-1/2 bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                <button onClick={handleSaveIGP} className="bg-primary text-on-primary rounded-xl px-8 py-3 font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-sm hover:shadow">
                    <span className="material-symbols-outlined text-[20px]">save</span>
                    Issue Gate Pass
                </button>
            </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 shadow-sm flex flex-col flex-1 overflow-hidden">
            <div className="p-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface/50">
                <div className="relative w-72">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
                    <input 
                        type="text" 
                        placeholder="Search IGP or Vehicle..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-surface border border-outline-variant/30 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="sticky top-0 bg-surface-container-low/90 backdrop-blur z-10 border-b border-outline-variant/30 text-on-surface-variant">
                        <tr>
                            <th className="px-6 py-4 font-semibold">IGP Number</th>
                            <th className="px-6 py-4 font-semibold">Date</th>
                            <th className="px-6 py-4 font-semibold">Vehicle No</th>
                            <th className="px-6 py-4 font-semibold">Ref PO</th>
                            <th className="px-6 py-4 font-semibold">Supplier</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                        {displayedIgps.map((igp) => {
                            const locked = isIGPLocked(igp.id);
                            return (
                                <tr key={igp.id} className="hover:bg-surface-container-low/30 transition-colors">
                                    <td className="px-6 py-4 text-primary font-bold">{igp.id}</td>
                                    <td className="px-6 py-4 text-on-surface">{igp.date}</td>
                                    <td className="px-6 py-4 text-on-surface font-medium">{igp.vehicleNo}</td>
                                    <td className="px-6 py-4 text-on-surface-variant">{igp.poId}</td>
                                    <td className="px-6 py-4 text-on-surface-variant">{igp.supplierName}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${igp.status === 'Verified' ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-surface-container-highest text-on-surface border-outline-variant/30'}`}>
                                            {igp.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handlePrintIGP(igp)} className="p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors" title="Print">
                                                <span className="material-symbols-outlined text-[18px]">print</span>
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteIGP(igp.id, igp.poId)} 
                                                disabled={locked}
                                                className={`p-1.5 rounded-lg border transition-colors ${locked ? 'border-outline-variant/10 text-on-surface-variant/30 cursor-not-allowed' : 'border-error/30 text-error hover:bg-error hover:text-white'}`} 
                                                title={locked ? "Locked: GRN exists" : "Delete"}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">{locked ? 'lock' : 'delete'}</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {igps.length === 0 && (
                            <tr>
                                <td colSpan="7" className="text-center py-10 text-on-surface-variant">No Inward Gate Passes found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <GlobalPagination 
                totalItems={igps.length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
            />
        </div>
      )}
    </div>
  );
}
