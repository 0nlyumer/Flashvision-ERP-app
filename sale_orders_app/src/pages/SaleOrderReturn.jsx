import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import UniversalPrintPreviewModal from '../components/ui/UniversalPrintPreviewModal';

export default function SaleOrderReturn() {
  const navigate = useNavigate();
  const [returnId] = useState(`RTN-${Math.floor(10000 + Math.random() * 90000)}`);
  
  const [printData, setPrintData] = useState(null);

  const handlePrint = () => {
      setPrintData({ 
          id: returnId, 
          return_no: returnId,
          order_id: "SO-2024-8842", 
          customer_name: "Customer Party", 
          reason: "Defective Product",
          date: new Date().toISOString().split('T')[0],
          header: {
              return_no: returnId,
              order_id: "SO-2024-8842",
              customer_name: "Customer Party",
              party_name: "Customer Party",
              reason: "Defective Product",
              date: new Date().toISOString().split('T')[0]
          },
          items: [
              {
                  serial_no: 1,
                  item_code: "FG-ITEM-01",
                  item_name: "Returned Merchandise",
                  returned_qty: 1,
                  inv_qty: 1,
                  unit_price: 0
              }
          ],
          totals: {
              totalReturnedQty: 1
          }
      });
  };

  return (
    <Layout>
      <div className="print:hidden">
        <header className="mb-10 flex flex-col justify-between gap-2">
          <div className="flex items-center gap-3">
             <button onClick={() => navigate('/all-sale-orders')} className="p-2 hover:bg-surface-container rounded-xl transition-colors">
                <span className="material-symbols-outlined text-outline">arrow_back</span>
             </button>
             <h1 className="text-3xl font-extrabold tracking-tight text-error font-headline">Process Sale Return</h1>
          </div>
          <p className="text-on-surface-variant font-body ml-12">Log customer returns, initiate QC inspections, and process credit notes.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Return Details */}
          <div className="lg:col-span-8 space-y-8">
             <section className="bg-surface-container-lowest p-8 rounded-3xl asymmetric-shadow border border-white/50">
               <h2 className="text-lg font-bold font-headline mb-6 text-on-surface border-b border-surface-container-low pb-4">Return Authorization Details</h2>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Return ID</label>
                    <input readOnly type="text" value={returnId} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-error font-black px-4 py-3 focus:outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Original Sale Order ID</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">search</span>
                      <input type="text" placeholder="e.g. SO-2024-8842" className="w-full pl-12 pr-4 py-3 bg-surface-container-low border border-outline-variant/20 rounded-xl focus:bg-surface-container-lowest focus:ring-2 focus:ring-error/30 transition-all font-bold text-on-surface" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Customer Account</label>
                    <input readOnly type="text" value="Auto-filled on SO selection" className="w-full bg-surface-container/50 border border-transparent rounded-xl px-4 py-3 text-sm text-slate-500 italic focus:outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Return Reason</label>
                    <select className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-4 py-3 focus:ring-2 focus:ring-error/30 transition-all font-semibold">
                      <option>Defective Product</option>
                      <option>Shipping Damage</option>
                      <option>Wrong Item Shipped</option>
                      <option>Excess Quantity</option>
                    </select>
                  </div>
               </div>
             </section>

             <section className="bg-surface-container-lowest p-0 rounded-3xl asymmetric-shadow border border-white/50 overflow-hidden">
               <div className="p-6 border-b border-surface-container-low bg-error/5 flex justify-between items-center">
                 <h3 className="text-lg font-bold font-headline text-error">Items to Return</h3>
                 <button className="text-sm font-bold text-error bg-error/10 px-4 py-2 rounded-lg hover:bg-error/20 transition-colors">Fetch from SO</button>
               </div>
               <div className="p-8 flex flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">inventory_2</span>
                  <p className="text-slate-400 font-medium">Enter an Original Sale Order ID to populate the line items eligible for return.</p>
               </div>
             </section>
          </div>

          {/* Inspection & Action */}
          <div className="lg:col-span-4 space-y-8">
             <section className="bg-gradient-to-br from-error to-red-900 text-white p-8 rounded-3xl shadow-xl shadow-error/20 relative overflow-hidden">
               <div className="absolute -right-10 -bottom-10 opacity-10 transform -rotate-12">
                 <span className="material-symbols-outlined text-[150px]" style={{ fontVariationSettings: "'FILL' 1" }}>policy</span>
               </div>
               
               <h3 className="text-2xl font-bold font-headline mb-4 relative z-10">Quality Inspection</h3>
               <p className="text-red-100 text-sm mb-6 relative z-10 leading-relaxed">Returned goods must be routed to the quarantine zone for QA inspection before stock reversal is authorized.</p>
               
               <div className="space-y-4 relative z-10">
                 <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input className="peer sr-only" type="checkbox" />
                      <div className="w-5 h-5 border-2 border-white/50 rounded group-hover:border-white peer-checked:bg-white peer-checked:border-white transition-all"></div>
                      <span className="material-symbols-outlined absolute inset-0 text-error text-[14px] flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                        check
                      </span>
                    </div>
                    <span className="text-sm text-white font-medium">Route to Quarantine Zone</span>
                 </label>
                 <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input className="peer sr-only" type="checkbox" />
                      <div className="w-5 h-5 border-2 border-white/50 rounded group-hover:border-white peer-checked:bg-white peer-checked:border-white transition-all"></div>
                      <span className="material-symbols-outlined absolute inset-0 text-error text-[14px] flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                        check
                      </span>
                    </div>
                    <span className="text-sm text-white font-medium">Generate Quality Alert Ticket</span>
                 </label>
               </div>
             </section>

             <div className="flex flex-col gap-4">
               <button onClick={handlePrint} className="w-full py-4 bg-error text-white font-black rounded-xl hover:bg-red-600 transition-colors shadow-[0_10px_20px_rgba(220,38,38,0.2)]">
                 Authorize Return & Print Slip
               </button>
               <button className="w-full py-4 bg-surface-container text-on-surface-variant font-bold rounded-xl hover:bg-surface-container-high transition-colors">
                 Cancel Setup
               </button>
             </div>
          </div>
        </div>
      </div>

      {printData && (
          <UniversalPrintPreviewModal
              isOpen={Boolean(printData)}
              onClose={() => setPrintData(null)}
              documentType="inventory_return"
              documentData={printData}
              documentTitle={`Return Authorization #${printData.id}`}
          />
      )}
    </Layout>
  );
}
