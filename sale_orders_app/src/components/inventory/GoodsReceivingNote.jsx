import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import GlobalPagination from '../ui/GlobalPagination';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

export default function GoodsReceivingNote() {
  const { state, setCollection, addGRN, deleteGRN } = useApp();
  const { appAlert, appConfirm } = useDialog();

  const [activeTab, setActiveTab] = useState('create');
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [igpId, setIgpId] = useState('');
  const [checkedBy, setCheckedBy] = useState('');
  const [qcStatus, setQcStatus] = useState('Passed');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');

  const pendingIGPs = useMemo(() => {
    return (state.inwardGatePasses || []).filter(igp => igp.status === 'Pending' || igp.status === 'Partially Verified');
  }, [state.inwardGatePasses]);

  const handleIGPSelection = (e) => {
    const selectedIgpId = e.target.value;
    setIgpId(selectedIgpId);
    if (selectedIgpId) {
      const igp = state.inwardGatePasses.find(p => p.id === selectedIgpId);
      if (igp) {
        setItems(igp.items.map(it => ({
          ...it,
          qty: it.receivedQty, // Default GRN qty to what was received at gate
          rejectedQty: 0
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

  const getNextGRNId = () => {
    const grns = state.grns || [];
    let max = 0;
    grns.forEach(grn => {
      const parts = grn.id.split('-');
      if (parts.length === 2 && !isNaN(parts[1])) {
        const num = parseInt(parts[1], 10);
        if (num > max) max = num;
      }
    });
    return `GRN-${String(max + 1).padStart(3, '0')}`;
  };

  const handleSaveGRN = () => {
    if (!igpId) {
      appAlert('Please select an Inward Gate Pass.');
      return;
    }
    if (!checkedBy) {
      appAlert('Please enter Checked By name.');
      return;
    }
    if (items.length === 0) {
      appAlert('No items to receive.');
      return;
    }

    const linkedIgp = state.inwardGatePasses.find(igp => igp.id === igpId);

    const newGRN = {
      id: getNextGRNId(),
      date,
      igpId,
      poId: linkedIgp?.poId || '',
      supplierName: linkedIgp?.supplierName || '',
      checkedBy,
      qcStatus,
      remarks,
      items,
      createdAt: new Date().toISOString()
    };

    // Use addGRN from AppContext to handle both collection update and item stock increment
    addGRN(newGRN);
    
    // Update IGP status
    const updatedIGPs = state.inwardGatePasses.map(igp => 
      igp.id === igpId ? { ...igp, status: 'Verified' } : igp
    );
    setCollection('inwardGatePasses', updatedIGPs);

    // Also mark PO as 'Received' if linked
    if (linkedIgp?.poId) {
       const updatedPOs = state.purchaseOrders.map(po => 
         po.id === linkedIgp.poId ? { ...po, status: 'Received' } : po
       );
       setCollection('purchaseOrders', updatedPOs);
    }

    appAlert(`Goods Receiving Note ${newGRN.id} generated and stock updated successfully!`, 'success');
    
    // Reset
    setDate(new Date().toISOString().split('T')[0]);
    setIgpId('');
    setCheckedBy('');
    setQcStatus('Passed');
    setRemarks('');
    setItems([]);
    setActiveTab('history');
  };

  const handleDeleteGRN = async (grn) => {
    if (await appConfirm(`Are you sure you want to delete ${grn.id}? This will REVERT the item stock.`)) {
      
      // Use deleteGRN to revert stock and remove document
      deleteGRN(grn.id);
      
      // Revert IGP status to 'Pending'
      if (grn.igpId) {
        const updatedIGPs = state.inwardGatePasses.map(igp => 
          igp.id === grn.igpId ? { ...igp, status: 'Pending' } : igp
        );
        setCollection('inwardGatePasses', updatedIGPs);
      }
      
      appAlert(`${grn.id} deleted and stock reverted successfully.`, 'info');
    }
  };

  const [printGRNData, setPrintGRNData] = useState(null);

  const handlePrintGRN = (grn) => {
    const rawItems = grn.items || [];
    const items = rawItems.map((it, idx) => ({
      serial_no: idx + 1,
      item_code: it.itemCode || it.itemId || `RM-${idx + 1}`,
      item_name: it.itemName || it.name || it.productName || it.description || 'Raw Material Item',
      ordered_qty: Number(it.orderQty ?? it.reqQty ?? it.qty ?? 0),
      received_qty: Number(it.qty ?? it.receivedQty ?? 0),
      accepted_qty: Math.max(0, Number(it.qty ?? it.receivedQty ?? 0) - Number(it.rejectedQty ?? 0)),
      rejected_qty: Number(it.rejectedQty ?? 0)
    }));

    const totalRec = items.reduce((s, it) => s + it.received_qty, 0);
    const totalAcc = items.reduce((s, it) => s + it.accepted_qty, 0);
    const totalRej = items.reduce((s, it) => s + it.rejected_qty, 0);

    setPrintGRNData({
      ...grn,
      id: grn.id,
      header: {
        grn_number: grn.id,
        grn_date: grn.date || new Date().toISOString().split('T')[0],
        po_ref: grn.poId || '—',
        supplier_name: grn.supplierName || 'Supplier',
        inspector: grn.checkedBy || 'QC Lead'
      },
      items,
      totals: {
        totalReceived: totalRec,
        totalAccepted: totalAcc,
        totalRejected: totalRej
      }
    });
  };

  const grns = (state.grns || []).filter(grn => 
    grn.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    grn.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const displayedGRNs = state?.isGlobalPaginated
    ? grns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : grns;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-6">
          <div>
              <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase mb-1">
                  <span className="material-symbols-outlined text-sm">inventory</span>
                  Warehouse Receiving
              </div>
              <h2 className="text-3xl font-black text-on-surface">Goods Receiving Note</h2>
          </div>
          <div className="flex gap-2 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/20">
              <button 
                  onClick={() => setActiveTab('create')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                  Create GRN
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
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Receiving Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Ref Inward Gate Pass</label>
                    <select value={igpId} onChange={handleIGPSelection} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary">
                        <option value="">-- Select IGP --</option>
                        {pendingIGPs.map(igp => <option key={igp.id} value={igp.id}>{igp.id} - {igp.supplierName}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Checked By (Store Incharge)</label>
                    <input type="text" value={checkedBy} onChange={e => setCheckedBy(e.target.value)} placeholder="Store Officer Name" className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">QC Status</label>
                    <select value={qcStatus} onChange={e => setQcStatus(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary">
                        <option value="Passed">QC Passed</option>
                        <option value="Conditional">Conditional Acceptance</option>
                        <option value="Rejected">Rejected</option>
                    </select>
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
                                <th className="pb-3 font-semibold text-right">Gate Qty</th>
                                <th className="pb-3 font-semibold text-right">Accepted Qty (Add to Stock)</th>
                                <th className="pb-3 font-semibold text-right">Rejected Qty</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                            {items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-surface-container-low/50">
                                    <td className="py-3 text-on-surface font-medium">{it.itemCode}</td>
                                    <td className="py-3 text-on-surface">{it.itemName}</td>
                                    <td className="py-3 text-on-surface-variant text-right">{it.receivedQty} {it.uom}</td>
                                    <td className="py-3 text-right">
                                        <input 
                                          type="number" 
                                          value={it.qty} 
                                          onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                                          className="w-32 text-right bg-surface border border-outline-variant/30 rounded px-2 py-1 focus:ring-2 focus:ring-primary font-bold text-primary"
                                        />
                                    </td>
                                    <td className="py-3 text-right">
                                        <input 
                                          type="number" 
                                          value={it.rejectedQty} 
                                          onChange={(e) => handleItemChange(idx, 'rejectedQty', e.target.value)}
                                          className="w-32 text-right bg-surface border border-outline-variant/30 rounded px-2 py-1 focus:ring-1 focus:ring-error text-error"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-60 py-10">
                        <span className="material-symbols-outlined text-4xl mb-2">fact_check</span>
                        <p>Select an Inward Gate Pass to view items for GRN.</p>
                    </div>
                )}
            </div>

            <div className="p-6 border-t border-outline-variant/10 flex justify-between items-center bg-surface-container-lowest/50">
                <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Final Remarks / Store Notes" className="w-1/2 bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                <button onClick={handleSaveGRN} className="bg-primary text-on-primary rounded-xl px-8 py-3 font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-sm hover:shadow">
                    <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                    Finalize GRN & Add Stock
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
                        placeholder="Search GRN, PO or Supplier..." 
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
                            <th className="px-6 py-4 font-semibold">GRN Number</th>
                            <th className="px-6 py-4 font-semibold">Date</th>
                            <th className="px-6 py-4 font-semibold">Supplier</th>
                            <th className="px-6 py-4 font-semibold">Ref PO</th>
                            <th className="px-6 py-4 font-semibold">Ref IGP</th>
                            <th className="px-6 py-4 font-semibold">QC Status</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                        {displayedGRNs.map((grn) => {
                            return (
                                <tr key={grn.id} className="hover:bg-surface-container-low/30 transition-colors">
                                    <td className="px-6 py-4 text-primary font-bold">{grn.id}</td>
                                    <td className="px-6 py-4 text-on-surface">{grn.date}</td>
                                    <td className="px-6 py-4 text-on-surface font-medium">{grn.supplierName}</td>
                                    <td className="px-6 py-4 text-on-surface-variant">{grn.poId || '-'}</td>
                                    <td className="px-6 py-4 text-on-surface-variant">{grn.igpId}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${grn.qcStatus === 'Passed' ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-error/10 text-error border-error/20'}`}>
                                            {grn.qcStatus}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handlePrintGRN(grn)} className="p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors" title="Print">
                                                <span className="material-symbols-outlined text-[18px]">print</span>
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteGRN(grn)} 
                                                className="p-1.5 rounded-lg border border-error/30 text-error hover:bg-error hover:text-white transition-colors" 
                                                title="Delete & Revert Stock"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {grns.length === 0 && (
                            <tr>
                                <td colSpan="7" className="text-center py-10 text-on-surface-variant">No Goods Receiving Notes found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <GlobalPagination 
              totalItems={grns.length}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
            />
        </div>
      )}

      {printGRNData && (
        <UniversalPrintPreviewModal
          isOpen={Boolean(printGRNData)}
          onClose={() => setPrintGRNData(null)}
          documentType="grn_note"
          documentData={printGRNData}
          documentTitle={`Goods Receiving Note ${printGRNData.id}`}
        />
      )}
    </div>
  );
}
