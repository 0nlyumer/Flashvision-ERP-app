import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import FinanceDashboard from '../components/finance/FinanceDashboard';
import GeneralLedger from '../components/finance/GeneralLedger';
import FinancialStatements from '../components/finance/FinancialStatements';
import AccountsReceivable from '../components/finance/AccountsReceivable';
import AccountsPayable from '../components/finance/AccountsPayable';
import SalesInvoice from '../components/finance/SalesInvoice';
import PurchaseInvoice from '../components/finance/PurchaseInvoice';
import Vouchers from '../components/finance/Vouchers';
import TaxManagement from '../components/finance/TaxManagement';
import BankReconciliation from '../components/finance/BankReconciliation';
import CostCenters from '../components/finance/CostCenters';
import ChartOfAccounts from '../components/finance/ChartOfAccounts';
import { useSearchParams } from 'react-router-dom';

export default function FinanceModule() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  
  // Normalize legacy tab names
  const normalizedTab = rawTab === 'ledger-tax' ? 'general-ledger' : (rawTab || 'overview');

  const [activeTab, setActiveTab] = useState(() => normalizedTab);
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([normalizedTab]));

  useEffect(() => {
    const raw = searchParams.get('tab');
    const target = raw === 'ledger-tax' ? 'general-ledger' : (raw || 'overview');
    if (target !== activeTab) {
      setActiveTab(target);
      setVisitedTabs(prev => {
        if (prev.has(target)) return prev;
        const next = new Set(prev);
        next.add(target);
        return next;
      });
    }
  }, [searchParams]);

  // World-Class 12-Screen ERPNext & SAP Finance Navigation
  const tabs = [
    { id: 'overview', label: 'Finance Overview', icon: 'monitoring' },
    { id: 'general-ledger', label: 'General Ledger (GL)', icon: 'menu_book' },
    { id: 'financial-statements', label: 'Financial Statements', icon: 'analytics' },
    { id: 'accounts-receivable', label: 'Accounts Receivable (AR)', icon: 'contact_page' },
    { id: 'accounts-payable', label: 'Accounts Payable (AP)', icon: 'payments' },
    { id: 'sales-invoice', label: 'Sales Invoice', icon: 'receipt' },
    { id: 'purchase-invoice', label: 'Purchase Invoice', icon: 'shopping_bag' },
    { id: 'vouchers', label: 'Vouchers & Journal', icon: 'account_balance_wallet' },
    { id: 'taxation', label: 'Tax & Withholding', icon: 'percent' },
    { id: 'bank-reconciliation', label: 'Bank Reconciliation', icon: 'account_balance' },
    { id: 'cost-centers', label: 'Cost Centers', icon: 'hub' },
    { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: 'account_tree' }
  ];

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

  const subNavConfig = {
    title: "Finance & Accounts",
    items: tabs,
    activeId: activeTab,
    onSelect: handleTabSelect,
    moduleName: "finance"
  };

  return (
    <Layout subNavConfig={subNavConfig}>
      <div className="max-w-full mx-auto w-full flex-1 flex flex-col min-h-0">
        {/* 1. Overview */}
        {visitedTabs.has('overview') && (
          <div style={{ display: activeTab === 'overview' ? 'flex' : 'none' }} className="flex-col flex-1 min-h-0">
            <FinanceDashboard onNavigateTab={handleTabSelect} />
          </div>
        )}

        {/* 2. General Ledger */}
        {(visitedTabs.has('general-ledger') || visitedTabs.has('ledger-tax')) && (
          <div style={{ display: (activeTab === 'general-ledger' || activeTab === 'ledger-tax') ? 'block' : 'none' }}>
            <GeneralLedger />
          </div>
        )}

        {/* 3. Financial Statements */}
        {visitedTabs.has('financial-statements') && (
          <div style={{ display: activeTab === 'financial-statements' ? 'block' : 'none' }}>
            <FinancialStatements />
          </div>
        )}

        {/* 4. Accounts Receivable */}
        {visitedTabs.has('accounts-receivable') && (
          <div style={{ display: activeTab === 'accounts-receivable' ? 'block' : 'none' }}>
            <AccountsReceivable />
          </div>
        )}

        {/* 5. Accounts Payable */}
        {visitedTabs.has('accounts-payable') && (
          <div style={{ display: activeTab === 'accounts-payable' ? 'block' : 'none' }}>
            <AccountsPayable />
          </div>
        )}

        {/* 6. Sales Invoice */}
        {visitedTabs.has('sales-invoice') && (
          <div style={{ display: activeTab === 'sales-invoice' ? 'block' : 'none' }}>
            <SalesInvoice />
          </div>
        )}

        {/* 7. Purchase Invoice */}
        {visitedTabs.has('purchase-invoice') && (
          <div style={{ display: activeTab === 'purchase-invoice' ? 'block' : 'none' }}>
            <PurchaseInvoice />
          </div>
        )}

        {/* 8. Vouchers & Journal */}
        {visitedTabs.has('vouchers') && (
          <div style={{ display: activeTab === 'vouchers' ? 'block' : 'none' }}>
            <Vouchers />
          </div>
        )}

        {/* 9. Taxation & Withholding */}
        {visitedTabs.has('taxation') && (
          <div style={{ display: activeTab === 'taxation' ? 'block' : 'none' }}>
            <TaxManagement />
          </div>
        )}

        {/* 10. Bank Reconciliation */}
        {visitedTabs.has('bank-reconciliation') && (
          <div style={{ display: activeTab === 'bank-reconciliation' ? 'block' : 'none' }}>
            <BankReconciliation />
          </div>
        )}

        {/* 11. Cost Centers */}
        {visitedTabs.has('cost-centers') && (
          <div style={{ display: activeTab === 'cost-centers' ? 'block' : 'none' }}>
            <CostCenters />
          </div>
        )}

        {/* 12. Chart of Accounts */}
        {visitedTabs.has('chart-of-accounts') && (
          <div style={{ display: activeTab === 'chart-of-accounts' ? 'block' : 'none' }}>
            <ChartOfAccounts />
          </div>
        )}
      </div>
    </Layout>
  );
}
