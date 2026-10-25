import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import AddNewItem from '../components/settings/AddNewItem';
import AddNewCustomer from '../components/settings/AddNewCustomer';
import AddNewSupplier from '../components/settings/AddNewSupplier';
import PrintSettings from '../components/settings/PrintSettings';
import LoginThemeSettings from '../components/settings/LoginThemeSettings';
import DocumentRoutingCenter from '../components/settings/DocumentRoutingCenter';
import DisplaySettings from '../components/settings/DisplaySettings';
import DepartmentSettings from '../components/settings/DepartmentSettings';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function SettingsDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const allSubNavItems = [
    { id: 'add_item', screenId: 'masterData', label: 'Item Master Setup', icon: 'category' },
    { id: 'add_customer', screenId: 'masterData', label: 'Customer Accounts', icon: 'group_add' },
    { id: 'add_supplier', screenId: 'masterData', label: 'Supplier Onboarding', icon: 'storefront' },
    { id: 'department_settings', screenId: 'departmentSettings', label: 'Department Settings', icon: 'corporate_fare' },
    { id: 'print_settings', screenId: 'systemConfig', label: 'Print Settings & Layout', icon: 'print' },
    { id: 'login_theme', screenId: 'systemConfig', label: 'Login Screen Theme', icon: 'wallpaper' },
    { id: 'document_routing', screenId: 'documentRouting', label: 'Document Routing Center', icon: 'account_tree' },
    { id: 'display', screenId: 'displayScale', label: 'Display Settings', icon: 'aspect_ratio' }
  ];

  const permittedItems = allSubNavItems.filter(item => hasPermission('settings', item.screenId));
  const defaultTab = permittedItems.length > 0 ? permittedItems[0].id : 'display';

  const tabParam = searchParams.get('tab');
  const initialActiveTab = (tabParam && permittedItems.some(i => i.id === tabParam))
    ? tabParam
    : defaultTab;

  const [activeTab, setActiveTab] = useState(initialActiveTab);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl === 'finish-good' && permittedItems.some(i => i.id === 'add_item')) {
      setActiveTab('add_item');
    } else if (tabFromUrl && permittedItems.some(i => i.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    } else if (!tabFromUrl && defaultTab && activeTab !== defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [searchParams, defaultTab, permittedItems]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };
  
  const subNavConfig = {
      title: 'Settings',
      moduleName: 'settings',
      items: permittedItems,
      activeId: activeTab,
      onSelect: handleTabChange
  };
  const handleBack = () => {
    navigate(-1);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'add_item':
        return <AddNewItem />;
      case 'add_customer':
        return <AddNewCustomer />;
      case 'add_supplier':
        return <AddNewSupplier />;
      case 'department_settings':
        return <DepartmentSettings />;
      case 'print_settings':
        return <PrintSettings />;
      case 'login_theme':
        return <LoginThemeSettings />;
      case 'document_routing':
        return <DocumentRoutingCenter />;
      case 'display':
        return <DisplaySettings />;
      default:
        return <AddNewItem />;
    }
  };

  return (
    <Layout subNavConfig={subNavConfig}>
      <div className="flex flex-col h-full w-full">
        {/* Module Header & Navigation */}
        <header className="sticky top-0 z-30 bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant/20 pt-4 px-6 shrink-0 pb-4">
          <div className="max-w-full mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex mr-2">
                  <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center bg-surface hover:bg-surface-container-low rounded-lg border border-outline-variant/30 text-slate-500 hover:text-primary transition-all shadow-sm"><span className="material-symbols-outlined text-[18px]">arrow_back</span></button>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary shadow-sm shrink-0">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>settings</span>
                </div>
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-on-surface font-headline leading-tight">Settings Workspace</h1>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold text-primary">Global Modules Configuration</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content Canvas */}
        <main className="flex-1 overflow-y-auto px-6 pt-8 pb-12 w-full custom-scrollbar relative">
          <div className="max-w-full mx-auto w-full pb-20">
            {renderContent()}
          </div>
        </main>
      </div>
    </Layout>
  );
}
