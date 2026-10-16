import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import GlobalPagination from '../ui/GlobalPagination';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

export default function PurchaseDemand({ selectedDepartments = [] }) {
  const { state, setCollection } = useApp();
  const { appAlert, appConfirm } = useDialog();

  const [activeTab, setActiveTab] = useState('create'); // 'create', 'history'
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [requestedBy, setRequestedBy] = useState('');
  const [department, setDepartment] = useState('Production');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState([]);

  // Item Input State
  const [selectedItemId, setSelectedItemId] = useState('');
  const [reqQty, setReqQty] = useState('');
  const [expectedDate, setExpectedDate] = useState('');

  // History State
  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const rawMaterials = useMemo(() => {
    return state.items.filter(i => {
        if (!selectedDepartments || selectedDepartments.length === 0) return true;
        return selectedDepartments.includes(i.department);
    });
  }, [state.items, selectedDepartments]);

  const handleAddItem = () => {
    if (!selectedItemId || !reqQty || reqQty <= 0) {
      appAlert('Please select an item and enter a valid quantity.');
      return;
    }
    const itemDef = state.items.find(i => i.id === selectedItemId);
    if (!itemDef) return;

    if (items.find(i => i.itemId === selectedItemId)) {
      appAlert('Item already added to demand.');
      return;
    }

    setItems([...items, {
      itemId: itemDef.id,
      itemCode: itemDef.sku || itemDef.id,
      itemName: itemDef.name,
      uom: itemDef.uom,
      reqQty: parseFloat(reqQty),
      expectedDate: expectedDate || date
    }]);

    setSelectedItemId('');
    setReqQty('');
    setExpectedDate('');
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const getNextPDId = () => {
    const pds = state.purchaseDemands || [];
    let max = 0;
    pds.forEach(pd => {
      const parts = pd.id.split('-');
      if (parts.length === 2 && !isNaN(parts[1])) {
        const num = parseInt(parts[1], 10);
        if (num > max) max = num;
      }
    });
    return `PD-${String(max + 1).padStart(3, '0')}`;
  };

  const handleSaveDemand = () => {
    if (!requestedBy) {
      appAlert('Please enter Requested By name.');
      return;
    }
    if (items.length === 0) {
      appAlert('Please add at least one item to the demand.');
      return;
    }

    const newPD = {
      id: getNextPDId(),
      date,
      requestedBy,
      department,
      remarks,
      items,
      status: 'Pending', // Becomes 'Ordered' when PO is made
      createdAt: new Date().toISOString()
    };

    setCollection('purchaseDemands', [newPD, ...(state.purchaseDemands || [])]);
    appAlert(`Purchase Demand ${newPD.id} generated successfully!`, 'success');
    
    // Reset
    setDate(new Date().toISOString().split('T')[0]);
    setRequestedBy('');
    setDepartment('Production');
    setRemarks('');
    setItems([]);
    setActiveTab('history');
  };

  const isPDLocked = (pdId) => {
    const pos = state.purchaseOrders || [];
    return pos.some(po => po.pdId === pdId);
  };

  const handleDeletePD = async (pdId) => {
    if (isPDLocked(pdId)) {
      appAlert('This Purchase Demand cannot be deleted because a Purchase Order has already been generated against it.');
      return;
    }
    if (await appConfirm(`Are you sure you want to delete ${pdId}?`)) {
      setCollection('purchaseDemands', (state.purchaseDemands || []).filter(pd => pd.id !== pdId));
      appAlert(`${pdId} deleted successfully.`, 'info');
    }
  };

  const [printPDData, setPrintPDData] = useState(null);

  const handlePrintPD = (pd) => {
    const rawItems = pd.items || [];
    const items = rawItems.map((it, idx) => ({
      serial_no: idx + 1,
      item_code: it.itemCode || it.itemId || `RM-${idx + 1}`,
      item_name: it.itemName || it.name || it.itemCode || 'Material',
      required_qty: Number(it.reqQty ?? it.quantity ?? it.qty ?? 0),
      needed_by: pd.neededBy || pd.date || new Date().toISOString().split('T')[0]
    }));
    const totalQty = items.reduce((s, it) => s + (Number(it.required_qty) || 0), 0);
    setPrintPDData({
      ...pd,
      id: pd.id,
      header: {
        pr_no: pd.id,
        date: pd.date || new Date().toISOString().split('T')[0],
        requestor: pd.requestedBy || 'Store Manager',
        priority: pd.priority || 'Normal Priority'
      },
      items,
      totals: {
        totalRequestedItems: items.length,
        totalQuantity: totalQty
      }
    });
  };

  const pds = (state.purchaseDemands || []).filter(pd => 
    pd.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
    pd.requestedBy.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedPds = state?.isGlobalPaginated
      ? pds.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      : pds;

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex justify-between items-end mb-6">
          <div>
              <div className="flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase mb-1">
                  <span className="material-symbols-outlined text-sm">assignment</span>
                  Material Requisition
              </div>
              <h2 className="text-3xl font-black text-on-surface">Purchase Demand</h2>
          </div>
          <div className="flex gap-2 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant/20">
              <button 
                  onClick={() => setActiveTab('create')}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-surface-container-lowest shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                  Create Demand
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
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Demand Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Requested By</label>
                    <input type="text" value={requestedBy} onChange={e => setRequestedBy(e.target.value)} placeholder="Enter name" className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Department</label>
                    <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary">
                        <option value="Production">Production</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Admin">Admin</option>
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Remarks</label>
                    <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional remarks" className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                </div>
            </div>

            {/* Add Item Section */}
            <div className="p-6 bg-surface-container-low/30 border-b border-outline-variant/10">
                <h4 className="text-sm font-bold text-on-surface mb-4">Add Items to Demand</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2 space-y-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">Select Raw Material / Other</label>
                        <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary">
                            <option value="">-- Select Item --</option>
                            {rawMaterials.map(rm => (
                                <option key={rm.id} value={rm.id}>{rm.name} ({rm.sku}) - {rm.stock} {rm.uom} available</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">Required Qty</label>
                        <input type="number" min="0.01" step="0.01" value={reqQty} onChange={e => setReqQty(e.target.value)} placeholder="0.00" className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-on-surface-variant">Expected Date</label>
                        <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary" />
                    </div>
                    <button onClick={handleAddItem} className="bg-secondary text-on-secondary rounded-xl px-6 py-2.5 text-sm font-bold flex items-center justify-center gap-2 hover:bg-secondary/90 transition-colors h-[42px] whitespace-nowrap">
                        <span className="material-symbols-outlined text-[18px]">add</span> Add
                    </button>
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
                                <th className="pb-3 font-semibold">UOM</th>
                                <th className="pb-3 font-semibold text-right">Req. Qty</th>
                                <th className="pb-3 font-semibold text-right">Expected By</th>
                                <th className="pb-3 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/10">
                            {items.map((it, idx) => (
                                <tr key={idx} className="hover:bg-surface-container-low/50">
                                    <td className="py-3 text-on-surface font-medium">{it.itemCode}</td>
                                    <td className="py-3 text-on-surface">{it.itemName}</td>
                                    <td className="py-3 text-on-surface-variant">{it.uom}</td>
                                    <td className="py-3 text-on-surface font-bold text-right">{it.reqQty}</td>
                                    <td className="py-3 text-on-surface-variant text-right">{it.expectedDate}</td>
                                    <td className="py-3 text-right">
                                        <button onClick={() => handleRemoveItem(idx)} className="text-error hover:bg-error/10 p-1.5 rounded-lg transition-colors">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-60 py-10">
                        <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
                        <p>No items added to demand yet.</p>
                    </div>
                )}
            </div>

            <div className="p-6 border-t border-outline-variant/10 flex justify-end bg-surface-container-lowest/50">
                <button onClick={handleSaveDemand} className="bg-primary text-on-primary rounded-xl px-8 py-3 font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-sm hover:shadow">
                    <span className="material-symbols-outlined text-[20px]">save</span>
                    Generate Purchase Demand
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
                        placeholder="Search PD Number or Requestor..." 
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
                            <th className="px-6 py-4 font-semibold">PD Number</th>
                            <th className="px-6 py-4 font-semibold">Date</th>
                            <th className="px-6 py-4 font-semibold">Requested By</th>
                            <th className="px-6 py-4 font-semibold">Department</th>
                            <th className="px-6 py-4 font-semibold">Items</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                        {displayedPds.map((pd) => {
                            const locked = isPDLocked(pd.id);
                            return (
                                <tr key={pd.id} className="hover:bg-surface-container-low/30 transition-colors">
                                    <td className="px-6 py-4 text-primary font-bold">{pd.id}</td>
                                    <td className="px-6 py-4 text-on-surface">{pd.date}</td>
                                    <td className="px-6 py-4 text-on-surface font-medium">{pd.requestedBy}</td>
                                    <td className="px-6 py-4 text-on-surface-variant">{pd.department}</td>
                                    <td className="px-6 py-4 text-on-surface-variant">{pd.items.length} items</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${pd.status === 'Ordered' ? 'bg-secondary/10 text-secondary border-secondary/20' : 'bg-surface-container-highest text-on-surface border-outline-variant/30'}`}>
                                            {pd.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handlePrintPD(pd)} className="p-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors" title="Print">
                                                <span className="material-symbols-outlined text-[18px]">print</span>
                                            </button>
                                            <button 
                                                onClick={() => handleDeletePD(pd.id)} 
                                                disabled={locked}
                                                className={`p-1.5 rounded-lg border transition-colors ${locked ? 'border-outline-variant/10 text-on-surface-variant/30 cursor-not-allowed' : 'border-error/30 text-error hover:bg-error hover:text-white'}`} 
                                                title={locked ? "Locked: Purchase Order exists" : "Delete"}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">{locked ? 'lock' : 'delete'}</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {pds.length === 0 && (
                            <tr>
                                <td colSpan="7" className="text-center py-10 text-on-surface-variant">No Purchase Demands found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <GlobalPagination 
                totalItems={pds.length}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
            />
        </div>
      )}

      {printPDData && (
        <UniversalPrintPreviewModal
          isOpen={Boolean(printPDData)}
          onClose={() => setPrintPDData(null)}
          documentType="purchase_demand"
          documentData={printPDData}
          documentTitle={`Purchase Demand ${printPDData.id}`}
        />
      )}
    </div>
  );
}
