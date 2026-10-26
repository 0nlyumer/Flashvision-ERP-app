import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../context/AppContext';
import CustomMultiSelect from '../components/ui/CustomMultiSelect';

import InvDashboard from '../components/inventory/InvDashboard';
import InvStock from '../components/inventory/InvStock';
import InvAdjustment from '../components/inventory/InvAdjustment';
import InvLedger from '../components/inventory/InvLedger';
import InvReturn from '../components/inventory/InvReturn';
import ItemRateProfile from '../components/inventory/ItemRateProfile';
import ReorderLevelSettings from '../components/inventory/ReorderLevelSettings';
import ClothQualitySetup from '../components/inventory/ClothQualitySetup';

import PurchaseDemand from '../components/inventory/PurchaseDemand';
import PurchaseOrder from '../components/inventory/PurchaseOrder';
import InwardGatePass from '../components/inventory/InwardGatePass';
import GoodsReceivingNote from '../components/inventory/GoodsReceivingNote';
import StockTransfer from '../components/inventory/StockTransfer';
import StockTransferHistory from '../components/inventory/StockTransferHistory';
import { useSearchParams } from 'react-router-dom';

export default function InventoryDashboard() {
  const { state, hasPermission } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabInUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() => tabInUrl || 'dashboard');
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([tabInUrl || 'dashboard']));

  const [selectedDepartments, setSelectedDepartments] = useState(() => {
      const saved = localStorage.getItem('InvDashboard_departments');
      return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
      localStorage.setItem('InvDashboard_departments', JSON.stringify(selectedDepartments));
  }, [selectedDepartments]);

  const tabs = [
    { id: 'dashboard', label: 'Inventory Dashboard' },
    { id: 'stock', label: 'Inventory Stock' },
    { id: 'rate-profile', label: 'Item Rate Profile' },
    { id: 'reorder-levels', label: 'Reorder Levels' },
    { id: 'cloth-conversion', label: 'Cloth Quality' },
    { id: 'adjustment', label: 'Inventory Adjustment' },
    { id: 'ledger', label: 'Inventory Ledger' },
    { id: 'return', label: 'Inventory Return' },
    { id: 'purchase-demand', label: 'Purchase Demand' },
    { id: 'purchase-order', label: 'Purchase Order' },
    { id: 'inward-gate-pass', label: 'Inward Gate Pass' },
    { id: 'grn', label: 'Goods Receiving Note' },
    { id: 'stock-transfer', label: 'Stock Transfer', icon: 'sync_alt' },
  ];

  useEffect(() => {
     const tab = searchParams.get('tab');
     if (tab && tabs.find(t => t.id === tab) && tab !== activeTab) {
         setActiveTab(tab);
         setVisitedTabs(prev => {
             if (prev.has(tab)) return prev;
             const next = new Set(prev);
             next.add(tab);
             return next;
         });
     }
  }, [searchParams]);

  const handleTabSelect = (id) => {
     setActiveTab(id);
     setVisitedTabs(prev => {
         if (prev.has(id)) return prev;
         const next = new Set(prev);
         next.add(id);
         return next;
     });
     setSearchParams({ tab: id }, { replace: true });
  };

  // Permissions redesign (2026-10-27): only screens this user may open are
  // listed, and a denied active screen falls back to the first permitted one.
  const permittedTabs = tabs.filter(t => (hasPermission ? hasPermission('inventory', t.id) : true));
  useEffect(() => {
      if (permittedTabs.length && activeTab !== 'stock-transfer-history' && !permittedTabs.find(t => t.id === activeTab)) {
          handleTabSelect(permittedTabs[0].id);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, permittedTabs.length]);

  const subNavConfig = {
      title: 'Inventory',
      moduleName: 'inventory',
      items: permittedTabs.map(tab => ({
          ...tab,
          icon: tab.id === 'dashboard' ? 'dashboard' : 
                tab.id === 'stock' ? 'inventory_2' : 
                tab.id === 'rate-profile' ? 'price_change' : 
                tab.id === 'reorder-levels' ? 'notifications_active' :
                tab.id === 'cloth-conversion' ? 'texture' :
                tab.id === 'adjustment' ? 'tune' : 
                tab.id === 'ledger' ? 'receipt_long' : 
                tab.id === 'return' ? 'assignment_return' :
                tab.id === 'purchase-demand' ? 'assignment' :
                tab.id === 'purchase-order' ? 'shopping_cart' :
                tab.id === 'inward-gate-pass' ? 'local_shipping' :
                tab.id === 'stock-transfer' ? 'sync_alt' : 'inventory'
      })),
      activeId: activeTab,
      onSelect: handleTabSelect
  };

  return (
    <Layout subNavConfig={subNavConfig}>
      <div className="max-w-full px-1 md:px-2 mx-auto w-full flex-1 flex flex-col min-h-0">
        {/* Global Department Filter */}
        {activeTab !== 'rate-profile' && activeTab !== 'reorder-levels' && activeTab !== 'cloth-conversion' && (
          <div className="flex justify-end mb-1.5 pr-1 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="w-[280px]">
                  <CustomMultiSelect 
                      options={(state.departments || []).map(d => ({ label: d.label || d, value: d.value || d }))}
                      selectedValues={selectedDepartments}
                      onChange={setSelectedDepartments}
                      placeholder="All Departments"
                  />
              </div>
          </div>
        )}

        {/* Tab Content with Instant Warm Tab Caching */}
        <div className="w-full flex-1 flex flex-col min-h-0">
          {visitedTabs.has('dashboard') && (
            <div className="h-full flex-1 flex flex-col min-h-0" style={{ display: activeTab === 'dashboard' ? 'flex' : 'none' }}>
              <InvDashboard selectedDepartments={selectedDepartments} />
            </div>
          )}
          {visitedTabs.has('stock') && (
            <div className="h-full flex-1 flex flex-col min-h-0" style={{ display: activeTab === 'stock' ? 'flex' : 'none' }}>
              <InvStock selectedDepartments={selectedDepartments} />
            </div>
          )}
          {visitedTabs.has('rate-profile') && (
            <div style={{ display: activeTab === 'rate-profile' ? 'block' : 'none' }}>
              <ItemRateProfile />
            </div>
          )}
          {visitedTabs.has('reorder-levels') && (
            <div style={{ display: activeTab === 'reorder-levels' ? 'block' : 'none' }}>
              <ReorderLevelSettings />
            </div>
          )}
          {visitedTabs.has('cloth-conversion') && (
            <div style={{ display: activeTab === 'cloth-conversion' ? 'block' : 'none' }}>
              <ClothQualitySetup />
            </div>
          )}
          {visitedTabs.has('adjustment') && (
            <div style={{ display: activeTab === 'adjustment' ? 'block' : 'none' }}>
              <InvAdjustment selectedDepartments={selectedDepartments} />
            </div>
          )}
          {visitedTabs.has('ledger') && (
            <div style={{ display: activeTab === 'ledger' ? 'block' : 'none' }}>
              <InvLedger selectedDepartments={selectedDepartments} />
            </div>
          )}
          {visitedTabs.has('return') && (
            <div style={{ display: activeTab === 'return' ? 'block' : 'none' }}>
              <InvReturn selectedDepartments={selectedDepartments} />
            </div>
          )}
          {visitedTabs.has('purchase-demand') && (
            <div style={{ display: activeTab === 'purchase-demand' ? 'block' : 'none' }}>
              <PurchaseDemand selectedDepartments={selectedDepartments} />
            </div>
          )}
          {visitedTabs.has('purchase-order') && (
            <div style={{ display: activeTab === 'purchase-order' ? 'block' : 'none' }}>
              <PurchaseOrder selectedDepartments={selectedDepartments} />
            </div>
          )}
          {visitedTabs.has('inward-gate-pass') && (
            <div style={{ display: activeTab === 'inward-gate-pass' ? 'block' : 'none' }}>
              <InwardGatePass />
            </div>
          )}
          {visitedTabs.has('grn') && (
            <div style={{ display: activeTab === 'grn' ? 'block' : 'none' }}>
              <GoodsReceivingNote />
            </div>
          )}
          {visitedTabs.has('stock-transfer') && (
            <div style={{ display: activeTab === 'stock-transfer' ? 'block' : 'none' }}>
              <StockTransfer onHistoryClick={() => handleTabSelect('stock-transfer-history')} />
            </div>
          )}
          {visitedTabs.has('stock-transfer-history') && (
            <div style={{ display: activeTab === 'stock-transfer-history' ? 'block' : 'none' }}>
              <StockTransferHistory onNewTransferClick={() => handleTabSelect('stock-transfer')} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
