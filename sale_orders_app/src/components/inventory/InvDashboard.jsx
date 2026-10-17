import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import ResizableHeader from '../ui/ResizableHeader';

export default function InvDashboard({ selectedDepartments = [] }) {
  const { state, currencySymbol } = useApp();
  const currSym = currencySymbol || state?.adminSetup?.baseCurrency?.match(/\(([^)]+)\)/)?.[1] || 'Rs';
  const [saleOrderViewType, setSaleOrderViewType] = useState('Sale Order Wise'); // 'Sale Order Wise', 'Item Wise'

  // Filter items based on selectedDepartments
  const filteredItems = useMemo(() => {
      let items = state?.items || [];
      if (selectedDepartments && selectedDepartments.length > 0) {
          items = items.filter(item => {
              const depts = (item.department || '').split(',').map(d => d.trim()).filter(Boolean);
              return depts.some(d => selectedDepartments.includes(d));
          });
      }
      return items;
  }, [state?.items, selectedDepartments]);

  // Calculate total stock value
  const totalStockValue = useMemo(() => {
      return filteredItems.reduce((acc, item) => {
          const priceStr = String(item.price || '0').replace(/[^0-9.]/g, '');
          const price = parseFloat(priceStr) || 0;
          return acc + (item.stock * price);
      }, 0);
  }, [filteredItems]);

  // Top 10 items by stock
  const top10Items = useMemo(() => {
      return [...filteredItems].sort((a, b) => (b.stock || 0) - (a.stock || 0)).slice(0, 10);
  }, [filteredItems]);

  // Max stock for scaling the bars
  const maxStock = top10Items.length > 0 ? Math.max(...top10Items.map(i => i.stock || 0)) : 1;

  // Completed/Progressing Sale Orders
  const displayOrdersData = useMemo(() => {
      const orders = state?.saleOrders || [];
      if (saleOrderViewType === 'Sale Order Wise') {
          return orders.filter(o => o.status === 'Completed' || o.items?.some(i => i.producedQty > 0)).map(o => {
              const totalQty = o.items?.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0) || 0;
              const totalProd = o.items?.reduce((sum, i) => sum + (parseFloat(i.producedQty) || 0), 0) || 0;
              const totalDisp = o.items?.reduce((sum, i) => sum + (parseFloat(i.dispatchedQty) || 0), 0) || 0;
              
              const progress = totalQty > 0 ? (totalProd / totalQty) * 100 : 0;
              const dispProgress = totalQty > 0 ? (totalDisp / totalQty) * 100 : 0;
              
              return {
                  id: o.id,
                  title: `Order ${o.id}`,
                  subtitle: o.items?.map(i => {
                      const sItem = state?.items?.find(x => x.id === i.itemId || x.sku === i.itemCode);
                      return i.productName || sItem?.name || i.itemCode || 'Unknown';
                  }).join(', ') || 'No Items',
                  itemCode: '-',
                  customer: state?.customers?.find(c => c.id === o.customerId)?.name || 'Unknown',
                  date: o.orderDate || 'N/A',
                  totalQty: totalQty,
                  progress: Math.min(100, Math.max(0, progress)),
                  totalDisp: totalDisp,
                  dispProgress: Math.min(100, Math.max(0, dispProgress)),
                  uom: 'Units'
              };
          });
      } else {
          // Item wise
          const itemsList = [];
          orders.forEach(o => {
              const custName = state?.customers?.find(c => c.id === o.customerId)?.name || 'Unknown';
              o.items?.forEach(i => {
                  if (i.status === 'Completed' || i.producedQty > 0) {
                      const qty = parseFloat(i.quantity) || 0;
                      const prod = parseFloat(i.producedQty) || 0;
                      const disp = parseFloat(i.dispatchedQty) || 0;
                      
                      const progress = qty > 0 ? (prod / qty) * 100 : 0;
                      const dispProgress = qty > 0 ? (disp / qty) * 100 : 0;
                      
                      if (selectedDepartments && selectedDepartments.length > 0 && sysItem) {
                          const depts = (sysItem.department || '').split(',').map(d => d.trim()).filter(Boolean);
                          if (!depts.some(d => selectedDepartments.includes(d))) return;
                      }

                      itemsList.push({
                          id: `${o.id}-${i.itemCode}`,
                          title: i.productName || sysItem?.name || 'Unknown Item',
                          subtitle: `Order: ${o.id}`,
                          itemCode: i.itemCode,
                          customer: custName,
                          date: o.orderDate || 'N/A',
                          totalQty: qty,
                          progress: Math.min(100, Math.max(0, progress)),
                          totalDisp: disp,
                          dispProgress: Math.min(100, Math.max(0, dispProgress)),
                          uom: i.unit || 'Units'
                      });
                  }
              });
          });
          return itemsList;
      }
  }, [state?.saleOrders, state?.customers, state?.items, saleOrderViewType, selectedDepartments]);

  return (
    <div className="animate-in fade-in duration-500 max-w-full px-6 mx-auto pb-4">
      {/* Header / Top Bar */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
        <div>
          <h2 className="text-3xl font-headline font-extrabold tracking-tight text-on-surface">Inventory Dashboard</h2>
          <p className="text-on-surface-variant mt-1 font-body">Real-time oversight of global synthetic asset distribution.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontVariationSettings: "'FILL' 0" }}>search</span>
            <input 
              className="pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant/20 rounded-full text-sm focus:ring-2 focus:ring-primary w-64 transition-all outline-none" 
              placeholder="Search SKU or Batch..." 
              type="text"
            />
          </div>
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-on-surface" style={{ fontVariationSettings: "'FILL' 0" }}>notifications</span>
          </button>
        </div>
      </header>

      {/* KPI Cards Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {/* Total Stock Value */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-[0_20px_40px_rgba(0,28,56,0.04)] flex flex-col justify-between h-32 relative overflow-hidden">
          <div className="z-10">
            <p className="text-xs font-label font-bold text-on-surface-variant uppercase tracking-widest">Total Stock Value</p>
            <h3 className="text-2xl font-headline font-extrabold text-on-surface mt-1">{currSym} {(totalStockValue / 1000).toFixed(1)}k</h3>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 z-10">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 0" }}>inventory_2</span>
            <span>{filteredItems.length} Items</span>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-8xl" style={{ fontVariationSettings: "'FILL' 0" }}>payments</span>
          </div>
        </div>

        {/* Recent Movements */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-[0_20px_40px_rgba(0,28,56,0.04)] flex flex-col justify-between h-32 relative overflow-hidden">
          <div className="z-10">
            <p className="text-xs font-label font-bold text-on-surface-variant uppercase tracking-widest">Departments Active</p>
            <h3 className="text-2xl font-headline font-extrabold text-on-surface mt-1 text-ellipsis overflow-hidden whitespace-nowrap">{selectedDepartments.length > 0 ? selectedDepartments.join(', ') : 'All Departments'}</h3>
          </div>
          <p className="text-xs font-medium text-on-surface-variant z-10">Filtered View</p>
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
            <span className="material-symbols-outlined text-8xl" style={{ fontVariationSettings: "'FILL' 0" }}>filter_alt</span>
          </div>
        </div>
      </section>

      {/* Data Visualization Grid */}
      <section className="mb-10">
        <div className="bg-surface-container-lowest p-8 rounded-[2rem] border border-outline-variant/10 shadow-[0_20px_40px_rgba(0,28,56,0.04)]">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-xl font-headline font-bold text-on-surface">Top 10 High-Stock Items (Graph)</h3>
              <p className="text-xs text-on-surface-variant mt-1 font-medium tracking-wide">Volume distribution across top assets</p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-primary/10 rounded-full text-[10px] font-bold uppercase tracking-wider text-primary">Volume Graph</span>
            </div>
          </div>
          
          <div className="w-full h-72 relative">
            {/* Y-Axis Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between z-0 pointer-events-none pb-8">
               {[100, 75, 50, 25, 0].map(percent => (
                   <div key={percent} className="w-full border-t border-outline-variant/10 flex items-center relative">
                       <span className="absolute -left-10 text-[10px] font-bold text-on-surface-variant w-8 text-right bg-surface-container-lowest py-0.5">
                          {Math.round((percent / 100) * maxStock)}
                       </span>
                   </div>
               ))}
            </div>

            {/* X-Axis and Bars */}
            <div className="absolute inset-0 left-4 right-0 bottom-0 flex justify-around items-end z-10 pt-4 pb-8 pl-4">
              {top10Items.length > 0 ? top10Items.map((item, idx) => {
                  const percentage = Math.max(2, ((item.stock || 0) / maxStock) * 100);
                  return (
                      <div key={item.id} className="group relative flex flex-col items-center justify-end h-full w-full max-w-[48px]">
                          {/* Tooltip */}
                          <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-on-surface text-surface text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap pointer-events-none z-20">
                              {item.name}
                              <div className="text-primary-container font-mono">{item.stock} {item.uom?.split(' ')[0]}</div>
                          </div>
                          
                          {/* Bar */}
                          <div 
                              className="w-full bg-gradient-to-t from-primary to-primary-container rounded-t-md shadow-[0_0_15px_rgba(0,0,0,0.1)] group-hover:brightness-125 group-hover:shadow-primary/50 transition-all duration-500 ease-out" 
                              style={{ height: `${percentage}%` }}
                          ></div>
                          
                          {/* X-Axis Label */}
                          <div className="absolute -bottom-8 w-24 text-center">
                              <span className="text-[10px] font-bold text-on-surface-variant truncate block w-full px-1" title={item.name}>
                                  {item.sku || item.name.substring(0,10)}
                              </span>
                          </div>
                      </div>
                  );
              }) : (
                  <div className="w-full h-full flex items-center justify-center text-on-surface-variant text-sm font-medium">
                      No items found for the selected type.
                  </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Completed Sale Orders Table */}
      <section className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/10 shadow-[0_20px_40px_rgba(0,28,56,0.04)] overflow-hidden">
        <div className="p-8 flex justify-between items-center bg-surface-container-low/50 border-b border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-6 bg-primary rounded-full"></div>
            <h3 className="text-xl font-headline font-bold text-on-surface">Completed Sale Orders</h3>
          </div>
          
          {/* Local Toggle for View Type */}
          <div className="flex items-center gap-4">
              <div className="flex bg-surface-container border border-outline-variant/20 rounded-lg p-1">
                  <button 
                      onClick={() => setSaleOrderViewType('Sale Order Wise')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${saleOrderViewType === 'Sale Order Wise' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                      Order Wise
                  </button>
                  <button 
                      onClick={() => setSaleOrderViewType('Item Wise')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${saleOrderViewType === 'Item Wise' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                      Item Wise
                  </button>
              </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-surface-container text-left border-b border-outline-variant/20">
                <ResizableHeader className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  <div className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                    {saleOrderViewType === 'Sale Order Wise' ? 'Order Ref' : 'Item Name'} <span className="material-symbols-outlined text-[14px]">swap_vert</span>
                  </div>
                </ResizableHeader>
                {saleOrderViewType === 'Item Wise' && (
                  <ResizableHeader className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Item Code</ResizableHeader>
                )}
                <ResizableHeader className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Customer</ResizableHeader>
                <ResizableHeader className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant text-center">Order Date</ResizableHeader>
                <ResizableHeader className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Completion</ResizableHeader>
                <ResizableHeader className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Dispatch</ResizableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {displayOrdersData.length > 0 ? displayOrdersData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-container-low/30 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface text-sm max-w-[200px] truncate" title={row.title}>{row.title}</span>
                          <span className="text-xs text-on-surface-variant max-w-[200px] truncate" title={row.subtitle}>{row.subtitle}</span>
                        </div>
                      </td>
                      {saleOrderViewType === 'Item Wise' && (
                          <td className="px-8 py-6 text-sm font-mono font-bold text-on-surface">
                              {row.itemCode}
                          </td>
                      )}
                      <td className="px-8 py-6">
                        <span className="text-sm font-medium text-on-surface">{row.customer}</span>
                      </td>
                      <td className="px-8 py-6 text-center text-sm text-on-surface-variant">{row.date}</td>
                      <td className="px-8 py-6">
                          <div className="flex flex-col gap-1.5 w-32">
                              <div className="flex justify-between items-center text-xs font-bold">
                                  <span className={row.progress === 100 ? 'text-emerald-500' : 'text-primary'}>{Math.round(row.progress)}%</span>
                                  <span className="text-on-surface-variant font-medium">{row.totalQty} {row.uom}</span>
                              </div>
                              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${row.progress === 100 ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${row.progress}%` }}></div>
                              </div>
                          </div>
                      </td>
                      <td className="px-8 py-6">
                          <div className="flex flex-col gap-1.5 w-32">
                              <div className="flex justify-between items-center text-xs font-bold">
                                  <span className={row.dispProgress === 100 ? 'text-emerald-500' : 'text-tertiary'}>{Math.round(row.dispProgress)}%</span>
                                  <span className="text-on-surface-variant font-medium">{row.totalDisp} {row.uom}</span>
                              </div>
                              <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${row.dispProgress === 100 ? 'bg-emerald-500' : 'bg-tertiary'}`} style={{ width: `${row.dispProgress}%` }}></div>
                              </div>
                          </div>
                      </td>
                  </tr>
              )) : (
                  <tr>
                      <td colSpan={saleOrderViewType === 'Item Wise' ? "6" : "5"} className="px-8 py-10 text-center text-on-surface-variant font-medium">No completed or progressing orders found.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
