import FGCombinationBuilder from "../ui/FGCombinationBuilder";
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import ResizableHeader from '../ui/ResizableHeader';
import InvStock from '../inventory/InvStock';

export default function DelCreation({ onGenerateChallan }) {
  const { state } = useApp();
  const [viewMode, setViewMode] = useState('Order-wise');
  const [dcMode, setDcMode] = useState('Sale Orders'); // 'Sale Orders' | 'Default Godown'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOutputTypes, setSelectedOutputTypes] = useState([]);

  const toggleOutputType = (type) => {
      setSelectedOutputTypes(prev => 
          prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
      );
  };
  const [expandedItems, setExpandedItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]); // Stores `${orderId}:::${itemId}` for orders, or `itemId` for manual

  // Compute Finished Goods Departments dynamically
  const finishedGoodsDepartments = useMemo(() => {
      const depts = new Set();
      state?.items?.forEach(item => {
          if (item.category === 'Finished Goods' || item.category === 'Finish Good' || item.rawMaterialType === 'Finished Good') {
              if (item.department) {
                  item.department.split(',').map(d => d.trim()).filter(Boolean).forEach(d => {
                      const cleanDept = (d.toLowerCase() === 'finishgood' || d.toLowerCase() === 'finishgood department' || d.toLowerCase() === 'finished goods') ? 'Finished Goods Department' : d;
                      depts.add(cleanDept);
                  });
              }
              if (item.stockByDepartment) {
                  Object.keys(item.stockByDepartment).forEach(d => {
                      if (item.stockByDepartment[d] > 0) {
                          const cleanDept = (d.toLowerCase() === 'finishgood' || d.toLowerCase() === 'finishgood department' || d.toLowerCase() === 'finished goods') ? 'Finished Goods Department' : d;
                          depts.add(cleanDept);
                      }
                  });
              }
          }
      });
      if (depts.size === 0) {
          depts.add('Finished Goods Department');
      }
      return Array.from(depts);
  }, [state?.items]);

  // 1. Compute eligible orders
  const eligibleOrders = useMemo(() => {
      if (!state?.saleOrders) return [];
      return state.saleOrders.filter(so => {
          if (so.status === 'Cancelled' || so.status === 'Delivered') return false;
          return so.items?.some(i => {
              const produced = parseFloat(i.producedQty || 0);
              const delivered = parseFloat(i.deliveredQty || 0) + parseFloat(i.dispatchedQty || 0);
              return produced > delivered;
          });
      });
  }, [state?.saleOrders]);

  // 2. Compute eligible items
  const eligibleItemsList = useMemo(() => {
      let list = [];
      eligibleOrders.forEach(so => {
          const cust = state?.customers?.find(c => c.id === so.customerId);
          const cName = cust ? cust.name : (so.customerName || so.customerId || 'Walk-in Customer');
          
          so.items?.forEach(i => {
              const produced = parseFloat(i.producedQty || 0);
              const delivered = parseFloat(i.deliveredQty || 0) + parseFloat(i.dispatchedQty || 0);
              if (produced > delivered) {
                  const itemObj = state?.items?.find(x => x.id === i.itemId || x.sku === i.itemCode);
                  const pName = itemObj ? itemObj.name : 'Unknown';
                  
                  list.push({
                      ...i,
                      productName: pName,
                      orderId: so.id,
                      customerId: so.customerId,
                      orderDate: so.orderDate || so.date,
                      customerEntity: cName,
                      readyQty: produced - delivered,
                      totalOrderQty: parseFloat(i.quantity || i.qty || 0),
                      totalOutput: produced,
                      totalDelivered: delivered,
                      uniqueId: `${so.id}:::${i.id || i.itemCode}`
                  });
              }
          });
      });
      return list;
  }, [eligibleOrders, state?.customers, state?.items]);

  // 3. Output Types and Search Filtering
  const availableOutputTypes = useMemo(() => {
      const types = new Set();
      eligibleItemsList.forEach(i => {
          const itemObj = state?.items?.find(x => x.id === i.itemId || x.sku === i.itemCode);
          if (itemObj?.stockByType) {
              Object.keys(itemObj.stockByType).forEach(t => types.add(t));
          } else {
              types.add('Fresh');
          }
      });
      return Array.from(types);
  }, [eligibleItemsList, state?.items]);

  const filteredOrders = useMemo(() => {
      if (!searchQuery) return eligibleOrders;
      const lower = searchQuery.toLowerCase();
      return eligibleOrders.filter(o => 
          (o.id || '').toLowerCase().includes(lower) || 
          (o.customerName || '').toLowerCase().includes(lower)
      );
  }, [eligibleOrders, searchQuery]);

  const getOutputTypesForItem = (item) => {
      if (item.orderId && dcMode === 'Sale Orders') {
          const typeMap = {};
          
          // 1. Calculate Produced Qty by Type for this Sale Order
          if (state?.productionPlans) {
              state.productionPlans.forEach(plan => {
                  if (plan.status !== 'Cancelled') {
                      plan.items?.forEach(pi => {
                          if (pi.orderId === item.orderId && (pi.itemCode === item.itemCode || pi.itemId === item.itemId)) {
                                  pi.outputs?.forEach(out => {
                                      const qty = parseFloat(out.quantity) || 0;
                                      if (qty > 0 && out.typeName && out.isDeliverable) {
                                          typeMap[out.typeName] = (typeMap[out.typeName] || 0) + qty;
                                      }
                                  });
                          }
                      });
                  }
              });
          }
          
          // 2. Deduct Delivered Qty by Type for this Sale Order
          if (state?.deliveries) {
              state.deliveries.forEach(del => {
                  if (del.dcMode === 'Sale Orders') {
                      del.items?.forEach(di => {
                          if (di.orderId === item.orderId && (di.itemCode === item.itemCode || di.itemId === item.itemId)) {
                              const qty = parseFloat(di.dispatchedQty) || 0;
                              const typeName = di.stockType || 'Fresh';
                              if (qty > 0 && typeMap[typeName] !== undefined) {
                                  typeMap[typeName] = Math.max(0, typeMap[typeName] - qty);
                              }
                          }
                      });
                  }
              });
          }
          
          let types = Object.entries(typeMap).filter(([_, qty]) => qty > 0);
          
          // If no outputs found or all delivered, fallback to totalOutput - delivered (just in case of manual data entry or older data structure)
          if (types.length === 0) {
              const remaining = item.readyQty || 0;
              if (remaining > 0) {
                  types = [['Fresh', remaining]];
              }
          }
          
          return types.map(([t, q]) => ({ typeName: t, qty: q, uniqueId: `${item.uniqueId}:::${t}` }));
      } else {
          // Manual mode
          const itemObj = state?.items?.find(x => x.id === item.itemId || x.sku === item.itemCode);
          const types = itemObj?.stockByType ? Object.entries(itemObj.stockByType) : [['Fresh', item.stock || 0]];
          return types.filter(([_, q]) => q > 0).map(([t, q]) => ({ typeName: t, qty: q, uniqueId: `${item.uniqueId}:::${t}` }));
      }
  };

  const filteredItems = useMemo(() => {
      let result = eligibleItemsList;
      if (searchQuery) {
          const lower = searchQuery.toLowerCase();
          result = result.filter(i => 
              (i.orderId || '').toLowerCase().includes(lower) || 
              (i.customerEntity || '').toLowerCase().includes(lower) ||
              (i.productName || '').toLowerCase().includes(lower) ||
              (i.itemCode || '').toLowerCase().includes(lower)
          );
      }
      if (selectedOutputTypes.length > 0) {
          result = result.filter(i => {
              const types = getOutputTypesForItem(i).map(t => t.typeName);
              return types.some(t => selectedOutputTypes.includes(t));
          });
      }
      return result;
  }, [eligibleItemsList, searchQuery, selectedOutputTypes, state?.productionPlans, state?.deliveries, dcMode]);

  const toggleExpand = (uniqueId) => {
      setExpandedItems(prev => prev.includes(uniqueId) ? prev.filter(id => id !== uniqueId) : [...prev, uniqueId]);
  };

  // 4. Selection Handlers
  const handleSelectAll = (e) => {
      if (e.target.checked) {
          if (viewMode === 'Order-wise') {
              const allIds = filteredOrders.flatMap(o => {
                  return o.items.filter(i => {
                      const produced = parseFloat(i.producedQty || 0);
                      const delivered = parseFloat(i.deliveredQty || 0) + parseFloat(i.dispatchedQty || 0);
                      return produced > delivered;
                  }).map(i => `${o.id}:::${i.id || i.itemCode}`);
              });
              setSelectedItemIds([...new Set([...selectedItemIds, ...allIds])]);
          } else {
              const allIds = filteredItems.flatMap(i => getOutputTypesForItem(i).map(t => t.uniqueId));
              setSelectedItemIds([...new Set([...selectedItemIds, ...allIds])]);
          }
      } else {
          if (viewMode === 'Order-wise') {
              const currentViewIds = new Set(filteredOrders.flatMap(o => o.items.map(i => `${o.id}:::${i.id || i.itemCode}`)));
              setSelectedItemIds(prev => prev.filter(id => !currentViewIds.has(id)));
          } else {
              const currentViewIds = new Set(filteredItems.flatMap(i => getOutputTypesForItem(i).map(t => t.uniqueId)));
              setSelectedItemIds(prev => prev.filter(id => !currentViewIds.has(id)));
          }
      }
  };

  const handleSelectOrder = (order, checked) => {
      const orderReadyItemIds = order.items.filter(i => {
          const produced = parseFloat(i.producedQty || 0);
          const delivered = parseFloat(i.deliveredQty || 0) + parseFloat(i.dispatchedQty || 0);
          return produced > delivered;
      }).map(i => `${order.id}:::${i.id || i.itemCode}`);

      if (checked) {
          setSelectedItemIds([...new Set([...selectedItemIds, ...orderReadyItemIds])]);
      } else {
          setSelectedItemIds(prev => prev.filter(id => !orderReadyItemIds.includes(id)));
      }
  };

  const handleSelectItem = (item, checked) => {
      const outputTypes = getOutputTypesForItem(item);
      const typeIds = outputTypes.map(t => t.uniqueId);
      if (checked) {
          setSelectedItemIds([...new Set([...selectedItemIds, ...typeIds])]);
      } else {
          setSelectedItemIds(prev => prev.filter(id => !typeIds.includes(id)));
      }
  };

  const handleSelectOutputType = (uniqueId, checked) => {
      if (checked) {
          setSelectedItemIds(prev => [...prev, uniqueId]);
      } else {
          setSelectedItemIds(prev => prev.filter(id => id !== uniqueId));
      }
  };

  // 5. Summary Calculations
  const selectedItemsData = useMemo(() => {
      if (dcMode === 'Sale Orders') {
          const selected = [];
          eligibleItemsList.forEach(i => {
              const outputTypes = getOutputTypesForItem(i);
              outputTypes.forEach(out => {
                  if (selectedItemIds.includes(out.uniqueId)) {
                      selected.push({
                          ...i,
                          uniqueId: out.uniqueId,
                          stockType: out.typeName,
                          readyQty: out.qty > 0 ? Math.min(i.readyQty, out.qty) : i.readyQty,
                          stock: out.qty
                      });
                  }
              });
          });
          return selected;
      } else {
          const manualItems = [];
          state?.items?.forEach(item => {
              if (item.stockByType && Object.keys(item.stockByType).length > 0) {
                  Object.entries(item.stockByType).forEach(([typeName, qty]) => {
                      const uid = `${item.id}:::${typeName}`;
                      if (selectedItemIds.includes(uid)) {
                          manualItems.push({
                              ...item,
                              uniqueId: uid,
                              stockType: typeName,
                              stock: qty,
                              name: `${item.name} (${typeName})`
                          });
                      }
                  });
              } else {
                  if (selectedItemIds.includes(item.id)) {
                      manualItems.push({
                          ...item,
                          uniqueId: item.id,
                          stockType: 'Standard'
                      });
                  }
              }
          });
          return manualItems;
      }
  }, [eligibleItemsList, selectedItemIds, dcMode, state?.items]);

  const totalSelectedUnits = dcMode === 'Sale Orders' 
      ? selectedItemsData.reduce((sum, item) => sum + (item.readyQty || 0), 0)
      : selectedItemsData.reduce((sum, item) => sum + (item.stock || 0), 0); // Simplified for manual, actual qty selected in slip

  const totalRolls = dcMode === 'Sale Orders'
      ? selectedItemsData.reduce((sum, item) => sum + parseFloat(item.rolls || 0), 0)
      : selectedItemsData.reduce((sum, item) => sum + (item.rollSize > 0 ? ((item.stock || 0) / item.rollSize) : 0), 0);

  // Determine indeterminate state for Select All
  const isAllSelected = viewMode === 'Order-wise' 
      ? filteredOrders.length > 0 && filteredOrders.every(o => {
          const orderIds = o.items.filter(i => (parseFloat(i.producedQty||0) - (parseFloat(i.deliveredQty||0) + parseFloat(i.dispatchedQty||0))) > 0).map(i => `${o.id}:::${i.id || i.itemCode}`);
          return orderIds.every(id => selectedItemIds.includes(id));
      })
      : filteredItems.length > 0 && filteredItems.flatMap(i => getOutputTypesForItem(i).map(t => t.uniqueId)).every(id => selectedItemIds.includes(id));

  const isSomeSelected = selectedItemIds.length > 0 && !isAllSelected;

  const handleGenerate = () => {
      if (selectedItemIds.length === 0) return;
      if (onGenerateChallan) {
          onGenerateChallan(selectedItemsData, dcMode);
      }
  };

  const handleInvSelectToggle = (id, checked) => {
      if (checked) {
          setSelectedItemIds(prev => [...prev, id]);
      } else {
          setSelectedItemIds(prev => prev.filter(i => i !== id));
      }
  };

  const handleInvSelectAll = (ids, checked) => {
      if (checked) {
          setSelectedItemIds([...new Set([...selectedItemIds, ...ids])]);
      } else {
          setSelectedItemIds(prev => prev.filter(id => !ids.includes(id)));
      }
  };

  return (
    <div className="flex-1 animate-in fade-in duration-500 pb-36 relative">
      <div className="w-full">
        {/* Editorial Header */}
        <div className="mb-10">
          <span className="text-primary font-bold tracking-widest text-[10px] uppercase mb-2 block">Dispatch Management</span>
          <h1 className="font-headline text-4xl font-extrabold text-on-surface tracking-tight leading-none mb-4">Select Goods for Dispatch</h1>
          <p className="text-on-surface-variant max-w-xl text-sm font-body">Review and consolidate ready-to-ship inventory. Select items below to generate your delivery challan and initiate the dispatch workflow.</p>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button 
                onClick={() => { setDcMode('Sale Orders'); setSelectedItemIds([]); }} 
                className={`p-5 rounded-2xl border text-left flex flex-col gap-2 transition-all outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer ${dcMode === 'Sale Orders' ? 'bg-gradient-to-br from-primary to-primary-container text-white shadow-xl shadow-primary/20 border-transparent scale-[1.02]' : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/30 hover:shadow-md'}`}
            >
                <div className="flex items-center justify-between w-full">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${dcMode === 'Sale Orders' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>Automated</span>
                    {dcMode === 'Sale Orders' && <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                </div>
                <span className="font-extrabold text-lg mt-1">Sale Orders</span>
            </button>
            {finishedGoodsDepartments.map(dept => (
                <button 
                    key={dept} 
                    onClick={() => { setDcMode(dept); setSelectedItemIds([]); }} 
                    className={`p-5 rounded-2xl border text-left flex flex-col gap-2 transition-all outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer ${dcMode === dept ? 'bg-gradient-to-br from-primary to-primary-container text-white shadow-xl shadow-primary/20 border-transparent scale-[1.02]' : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/30 hover:shadow-md'}`}
                >
                    <div className="flex items-center justify-between w-full">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${dcMode === dept ? 'bg-white/20 text-white' : 'bg-tertiary/10 text-tertiary'}`}>Manual</span>
                        {dcMode === dept && <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                    </div>
                    <span className="font-extrabold text-lg mt-1">{dept}</span>
                </button>
            ))}
        </div>

        {dcMode === 'Sale Orders' ? (
        <>
        <div className="mb-8 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:max-w-2xl">
<div className="relative w-full sm:max-w-md">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline" style={{ fontVariationSettings: "'FILL' 0" }}>person_search</span>
                <input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium text-on-surface placeholder:text-on-surface-variant/50 outline-none" 
                    placeholder="Search by Order # or Customer..." 
                    type="text" 
                />
            </div>
<FGCombinationBuilder compact={false} placeholder="Filter FG Combination" allowCreation={false} onSelectItem={(chosen) => setSearchQuery(chosen.name)} />
</div>
            {viewMode === 'Item-wise' && availableOutputTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center w-full bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 shadow-sm">
                    <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mr-2 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">filter_list</span> Output Types Filter:</span>
                    {availableOutputTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => toggleOutputType(type)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                                selectedOutputTypes.includes(type)
                                    ? 'bg-primary text-white border-primary shadow-sm'
                                    : 'bg-surface border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                    {selectedOutputTypes.length > 0 && (
                        <button 
                            onClick={() => setSelectedOutputTypes([])}
                            className="text-xs text-error hover:underline ml-2 font-bold"
                        >
                            Clear Filter
                        </button>
                    )}
                </div>
            )}
        </div>

        {/* Tabs & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div className="flex bg-surface-container-low p-1.5 rounded-full shadow-inner flex-1 max-w-sm w-full">
            <button 
                onClick={() => setViewMode('Order-wise')}
                className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-all focus:outline-none ${viewMode === 'Order-wise' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                Order-wise
            </button>
            <button 
                onClick={() => setViewMode('Item-wise')}
                className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-all focus:outline-none ${viewMode === 'Item-wise' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                Item-wise
            </button>
          </div>
          {viewMode === 'Item-wise' && (
              <button 
                  onClick={() => {
                      if (expandedItems.length === filteredItems.length && filteredItems.length > 0) {
                          setExpandedItems([]);
                      } else {
                          setExpandedItems(filteredItems.map(i => i.uniqueId));
                      }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-sm font-bold text-primary hover:bg-primary/5 transition-colors"
              >
                  <span className="material-symbols-outlined text-[18px]">unfold_more</span>
                  {expandedItems.length === filteredItems.length && filteredItems.length > 0 ? 'Collapse All' : 'Expand All'}
              </button>
          )}
        </div>

        {/* Table Container */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_20px_40px_rgba(0,28,56,0.04)] overflow-hidden border border-outline-variant/10 cursor-default">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-outline-variant/20">
                  <th className="py-5 px-6 w-12 text-center">
                    <input 
                        type="checkbox"
                        checked={isAllSelected}
                        ref={input => { if(input) input.indeterminate = isSomeSelected; }}
                        onChange={handleSelectAll}
                        className="rounded text-primary focus:ring-primary/20 border-outline-variant/50 w-4 h-4 cursor-pointer" 
                    />
                  </th>
                  {viewMode === 'Order-wise' ? (
                      <>
                        <ResizableHeader className="py-5 px-4 font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider">Order #</ResizableHeader>
                        <ResizableHeader className="py-5 px-4 font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider">Customer Entity</ResizableHeader>
                        <ResizableHeader className="py-5 px-4 font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Order Date</ResizableHeader>
                        <ResizableHeader className="py-5 px-4 font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Output Qty</ResizableHeader>
                        <ResizableHeader className="py-5 px-4 font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Delivered Qty</ResizableHeader>
                        <ResizableHeader className="py-5 px-4 font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Status</ResizableHeader>
                      </>
                  ) : (
                      <>
                        <ResizableHeader className="py-5 px-4 w-10"></ResizableHeader>
                        <ResizableHeader className="py-5 px-4 font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider">Order #</ResizableHeader>
                        <ResizableHeader className="py-5 px-4 font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider">Product Name</ResizableHeader>
                        <ResizableHeader className="py-5 px-4 font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider">Item Code</ResizableHeader>
                        <ResizableHeader className="py-5 px-4 font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Customer</ResizableHeader>
                        <ResizableHeader className="py-5 px-4 font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Output Qty</ResizableHeader>
                        <ResizableHeader className="py-5 px-4 font-headline text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Delivered Qty</ResizableHeader>
                      </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {viewMode === 'Order-wise' ? (
                    filteredOrders.length === 0 ? (
                        <tr><td colSpan="6" className="py-8 text-center text-sm text-on-surface-variant">No orders ready for dispatch.</td></tr>
                    ) : (
                        filteredOrders.map(order => {
                            const readyItems = order.items.filter(i => (parseFloat(i.producedQty||0) - (parseFloat(i.deliveredQty||0) + parseFloat(i.dispatchedQty||0))) > 0);
                            const totalReadyQty = readyItems.reduce((sum, i) => sum + (parseFloat(i.producedQty||0) - (parseFloat(i.deliveredQty||0) + parseFloat(i.dispatchedQty||0))), 0);
                            
                            const totalOrderQty = order.items.reduce((sum, i) => sum + parseFloat(i.quantity || i.qty || 0), 0);
                            const totalOrderProduced = order.items.reduce((sum, i) => sum + parseFloat(i.producedQty || 0), 0);
                            const totalOrderDelivered = order.items.reduce((sum, i) => sum + parseFloat(i.deliveredQty || 0) + parseFloat(i.dispatchedQty || 0), 0);
                            
                            const outputPercentage = totalOrderQty > 0 ? Math.min(100, (totalOrderProduced / totalOrderQty) * 100) : (totalOrderProduced > 0 ? 100 : 0);
                            const deliveredPercentage = totalOrderProduced > 0 ? Math.min(100, (totalOrderDelivered / totalOrderProduced) * 100) : (totalOrderDelivered > 0 ? 100 : 0);
                            
                            const orderIds = readyItems.map(i => `${order.id}:::${i.id || i.itemCode}`);
                            const isOrderSelected = orderIds.length > 0 && orderIds.every(id => selectedItemIds.includes(id));
                            
                            const cust = state?.customers?.find(c => c.id === order.customerId);
                            const cName = cust ? cust.name : (order.customerName || order.customerId || 'Walk-in Customer');

                            return (
                                <tr key={order.id} className="group hover:bg-surface-container-low transition-colors">
                                    <td className="py-5 px-6 text-center">
                                        <input 
                                            type="checkbox"
                                            checked={isOrderSelected}
                                            onChange={(e) => handleSelectOrder(order, e.target.checked)}
                                            className="rounded text-primary focus:ring-primary border-outline-variant w-4 h-4 cursor-pointer" 
                                        />
                                    </td>
                                    <td className="py-5 px-4 font-bold text-primary text-sm whitespace-nowrap">{order.id}</td>
                                    <td className="py-5 px-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-on-surface">{cName}</span>
                                        </div>
                                    </td>
                                    <td className="py-5 px-4 text-center text-sm font-medium whitespace-nowrap">{new Date(order.orderDate || order.date || new Date()).toLocaleDateString('en-GB')}</td>
                                    <td className="py-5 px-4 text-center">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <span className="bg-primary-fixed text-on-primary-fixed px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">{totalOrderProduced} / {totalOrderQty} MTRS</span>
                                            <div className="w-full max-w-[100px] h-1.5 bg-surface-container rounded-full overflow-hidden">
                                                <div className="h-full bg-primary" style={{ width: `${outputPercentage}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-5 px-4 text-center">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">{totalOrderDelivered} / {totalOrderProduced} MTRS</span>
                                            <div className="w-full max-w-[100px] h-1.5 bg-surface-container rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${deliveredPercentage}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-5 px-4 text-right">
                                        <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded whitespace-nowrap">Ready</span>
                                    </td>
                                </tr>
                            );
                        })
                    )
                ) : (
                    filteredItems.length === 0 ? (
                        <tr><td colSpan="5" className="py-8 text-center text-sm text-on-surface-variant">No items ready for dispatch.</td></tr>
                    ) : (
                        filteredItems.map(item => {
                            const outputPercentage = item.totalOrderQty > 0 ? Math.min(100, (item.totalOutput / item.totalOrderQty) * 100) : (item.totalOutput > 0 ? 100 : 0);
                            const deliveredPercentage = item.totalOutput > 0 ? Math.min(100, (item.totalDelivered / item.totalOutput) * 100) : (item.totalDelivered > 0 ? 100 : 0);

                            const outputTypes = getOutputTypesForItem(item);
                            const itemTypeIds = outputTypes.map(t => t.uniqueId);
                            const isAllItemTypesSelected = itemTypeIds.length > 0 && itemTypeIds.every(id => selectedItemIds.includes(id));
                            const isSomeItemTypesSelected = itemTypeIds.some(id => selectedItemIds.includes(id)) && !isAllItemTypesSelected;
                            const isExpanded = expandedItems.includes(item.uniqueId);

                            return (
                                <React.Fragment key={item.uniqueId}>
                                    <tr 
                                        className="group hover:bg-surface-container-low transition-colors cursor-pointer"
                                        onDoubleClick={() => toggleExpand(item.uniqueId)}
                                    >
                                        <td className="py-5 px-6 text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox"
                                                checked={isAllItemTypesSelected}
                                                ref={input => { if(input) input.indeterminate = isSomeItemTypesSelected; }}
                                                onChange={(e) => handleSelectItem(item, e.target.checked)}
                                                className="rounded text-primary focus:ring-primary border-outline-variant w-4 h-4 cursor-pointer" 
                                            />
                                        </td>
                                        <td className="py-5 px-2 text-center">
                                            <button 
                                                onClick={() => toggleExpand(item.uniqueId)} 
                                                className="p-1 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant"
                                            >
                                                <span className={`material-symbols-outlined transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                            </button>
                                        </td>
                                        <td className="py-5 px-4 font-bold text-primary text-sm whitespace-nowrap">{item.orderId}</td>
                                        <td className="py-5 px-4">
                                            <span className="text-sm font-bold text-on-surface">{item.productName || item.itemCode}</span>
                                        </td>
                                        <td className="py-5 px-4">
                                            <span className="text-sm text-on-surface-variant font-medium bg-surface-container px-2 py-1 rounded">{item.itemCode}</span>
                                        </td>
                                        <td className="py-5 px-4 text-center text-sm font-medium whitespace-nowrap">{item.customerEntity}</td>
                                        <td className="py-5 px-4 text-center">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <span className="bg-primary-fixed text-on-primary-fixed px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">{item.totalOutput} / {item.totalOrderQty} MTRS</span>
                                                <div className="w-full max-w-[100px] h-1.5 bg-surface-container rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary" style={{ width: `${outputPercentage}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-5 px-4 text-center">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">{item.totalDelivered} / {item.totalOutput} MTRS</span>
                                                <div className="w-full max-w-[100px] h-1.5 bg-surface-container rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500" style={{ width: `${deliveredPercentage}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && outputTypes.map(out => (
                                        <tr key={out.uniqueId} className="bg-surface-container-lowest/50 border-t border-outline-variant/10 hover:bg-primary/5 transition-colors">
                                            <td className="py-5 px-6 text-center border-l-4 border-l-primary/30">
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedItemIds.includes(out.uniqueId)}
                                                    onChange={(e) => handleSelectOutputType(out.uniqueId, e.target.checked)}
                                                    className="rounded text-primary focus:ring-primary border-outline-variant w-4 h-4 cursor-pointer" 
                                                />
                                            </td>
                                            <td className="py-5 px-2 text-center"></td>
                                            <td className="py-5 px-4 font-medium text-on-surface-variant text-sm whitespace-nowrap">{item.orderId}</td>
                                            <td className="py-5 px-4">
                                                <span className="text-sm font-bold text-on-surface">{item.productName || item.itemCode} ({out.typeName})</span>
                                            </td>
                                            <td className="py-5 px-4">
                                                <span className="text-sm text-on-surface-variant font-medium bg-surface-container px-2 py-1 rounded">{item.itemCode}</span>
                                            </td>
                                            <td className="py-5 px-4 text-center text-sm font-medium whitespace-nowrap">{item.customerEntity}</td>
                                            <td className="py-5 px-4 text-center" colSpan={2}>
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <span className="text-[10px] font-bold uppercase text-on-surface-variant">Available Stock</span>
                                                    <span className="bg-secondary-fixed text-on-secondary-fixed px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">{out.qty} MTRS</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })
                    )
                )}
              </tbody>
            </table>
          </div>
          
          <div className="p-6 bg-surface-container-low/30 border-t border-surface-container-low flex justify-between items-center">
            <p className="text-xs text-on-surface-variant">Showing {viewMode === 'Order-wise' ? filteredOrders.length : filteredItems.length} records</p>
          </div>
        </div>
        </>
        ) : (
            <div className="w-full">
               <InvStock 
                   selectedDepartments={dcMode === 'Finished Goods Department' ? ['Finished Goods Department', 'Finishgood Department', 'Finishgood', 'Finished Goods'] : [dcMode]} 
                   selectable={true} 
                   selectedIds={selectedItemIds}
                   onToggleSelect={handleInvSelectToggle}
                   onSelectAll={handleInvSelectAll}
                   flattenTypes={true}
                   excludeSaleOrderStock={true}
               />
            </div>
        )}
      </div>

      {/* Sticky Bottom Summary Bar */}
      <div className={`sticky bottom-6 z-50 pointer-events-none transition-all duration-300 mt-6 ${selectedItemIds.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
        <div className="w-full pointer-events-auto">
            <div className="bg-surface-container-lowest/90 backdrop-blur-xl border border-white/40 shadow-[0_15px_50px_rgba(0,28,56,0.15)] rounded-2xl p-6 flex flex-col xl:flex-row items-center justify-between gap-6 relative overflow-hidden group">
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-primary/0 via-primary/[0.02] to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex flex-wrap items-center gap-6 sm:gap-10 mx-auto xl:mx-0 w-full xl:w-auto justify-center xl:justify-start relative z-10">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>inventory</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Total Selected</span>
                    <span className="text-2xl font-extrabold text-on-surface tracking-tight">{totalSelectedUnits.toLocaleString()} <span className="text-sm font-medium text-on-surface-variant">Units</span></span>
                  </div>
                </div>
                
                <div className="h-10 w-px bg-outline-variant/30 hidden sm:block"></div>
                
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 0" }}>inventory_2</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Total Rolls</span>
                    <span className="text-2xl font-extrabold text-on-surface tracking-tight">{totalRolls.toLocaleString()} <span className="text-sm font-medium text-on-surface-variant">Rolls</span></span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 w-full xl:w-auto mt-4 xl:mt-0 relative z-10">
                <button 
                    onClick={() => setSelectedItemIds([])}
                    className="flex-1 xl:flex-none px-6 py-4 rounded-xl text-on-surface-variant font-bold hover:bg-surface-container transition-colors outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer">
                  Clear All
                </button>
                <button 
                  onClick={handleGenerate}
                  className="flex-[2] xl:flex-none px-10 py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl font-bold shadow-xl shadow-primary/30 flex items-center justify-center gap-3 hover:scale-[1.02] hover:shadow-primary/40 active:scale-95 transition-all outline-none cursor-pointer"
                >
                  <span className="whitespace-nowrap">Generate Delivery Challan</span>
                  <span className="material-symbols-outlined text-xl shrink-0" style={{ fontVariationSettings: "'FILL' 0" }}>arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
