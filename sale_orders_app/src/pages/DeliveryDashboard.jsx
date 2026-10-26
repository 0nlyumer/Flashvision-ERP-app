import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useSearchParams } from 'react-router-dom';
import DelDashboard from '../components/delivery/DelDashboard';
import DelCreation from '../components/delivery/DelCreation';
import DelCreationSlip from '../components/delivery/DelCreationSlip';
import DelRecord from '../components/delivery/DelRecord';
import { useApp } from '../context/AppContext';

export default function DeliveryDashboard() {
  const { hasPermission } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [challanItems, setChallanItems] = useState([]);
  const [dcMode, setDcMode] = useState('Sale Orders');

  const handleGenerateChallan = (items, mode) => {
      setChallanItems(items);
      setDcMode(mode || 'Sale Orders');
      setActiveTab('dc_creation_slip');
  };

  const handleFinalizeChallan = () => {
      setChallanItems([]);
      setActiveTab('dc_record');
  };

  // Permissions redesign (2026-10-27): a screen this user may not open is
  // never rendered — fall back to the first permitted delivery screen. The
  // challan slip (button-opened sub-screen) needs its own or DC Creation's
  // permission.
  const canTab = (id) => (hasPermission ? hasPermission('delivery', id) : true);
  const permittedTabIds = ['dashboard', 'dc_creation', 'dc_record'].filter(canTab);
  const effectiveTab = activeTab === 'dc_creation_slip'
    ? ((canTab('dc_creation_slip') || canTab('dc_creation')) ? 'dc_creation_slip' : (permittedTabIds[0] || 'dashboard'))
    : (canTab(activeTab) ? activeTab : (permittedTabIds[0] || 'dashboard'));

  const renderContent = () => {
    switch (effectiveTab) {
      case 'dashboard':
        return <DelDashboard setActiveTab={handleTabChange} />;
      case 'dc_creation':
        return <DelCreation onGenerateChallan={handleGenerateChallan} />;
      case 'dc_creation_slip':
        return <DelCreationSlip items={challanItems} dcMode={dcMode} onBack={() => setActiveTab('dc_creation')} onFinalize={handleFinalizeChallan} />;
      case 'dc_record':
        return <DelRecord />;
      default:
        return <DelDashboard setActiveTab={handleTabChange} />;
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Delivery Dashboard', icon: 'dashboard' },
    { id: 'dc_creation', label: 'DC Creation', icon: 'local_shipping' },
    { id: 'dc_record', label: 'DC Record', icon: 'history' }
  ];

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
     const tab = searchParams.get('tab');
     if (tab && tabs.find(t => t.id === tab)) {
         setActiveTab(tab);
     }
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const subNavConfig = {
      title: "Delivery",
      moduleName: 'delivery',
      items: tabs.filter(t => permittedTabIds.includes(t.id)),
      activeId: activeTab === 'dc_creation_slip' ? 'dc_creation' : activeTab,
      onSelect: handleTabChange
  };

  return (
    <Layout subNavConfig={subNavConfig}>
      <div className="flex flex-col h-full w-full">
        {/* Module Header & Navigation */}


        {/* Dynamic Content Canvas */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 pt-8 pb-12 w-full custom-scrollbar">
          <div className="w-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </Layout>
  );
}
