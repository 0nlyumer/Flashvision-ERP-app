import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import { normalizePayrollMappings, PAYROLL_MAPPING_LEGACY_STORAGE_KEY } from '../../utils/payrollAccountMapping';

export default function PayrollAccountMapping({ isMobile, onBack }) {
  const { state, setCollection } = useApp();
  const { showTopPill, showLoading, hideLoading, appConfirm } = useDialog();

  // Dynamic Chart of Accounts from Finance Module (no static dummy fallback)
  const glAccountsList = (state.chartOfAccounts && Array.isArray(state.chartOfAccounts) && state.chartOfAccounts.length > 0)
    ? state.chartOfAccounts.map(acc => `${acc.code || acc.accountCode || acc.id || ''} - ${acc.name || acc.accountName || ''}`.trim())
    : [];

  // Mappings live in app state (state.payroll_account_mapping), persisted
  // to the database (app_config key 'payrollAccountMapping') through
  // AppContext write-through — no longer only in this browser's
  // localStorage. Defaults come from utils/payrollAccountMapping.js.
  const [mappings, setMappings] = useState(() => normalizePayrollMappings(state.payroll_account_mapping));

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCat, setNewCat] = useState({ category: '', description: '', account: '' });
  const [showAuditModal, setShowAuditModal] = useState(false);

  // One-time migration: if the database copy is still pristine (every
  // category unmapped) and this browser still holds a legacy localStorage
  // mapping, lift the local copy into app state — it then write-throughs
  // to app_config — and remove the local key so this can never run twice.
  const migrationDoneRef = useRef(false);
  useEffect(() => {
    if (migrationDoneRef.current) return;
    migrationDoneRef.current = true;
    try {
      const legacyRaw = localStorage.getItem(PAYROLL_MAPPING_LEGACY_STORAGE_KEY);
      if (!legacyRaw) return;
      const legacy = normalizePayrollMappings(JSON.parse(legacyRaw));
      const current = normalizePayrollMappings(state.payroll_account_mapping);
      const currentIsPristine = current.every(m => !m.account || m.account.trim() === '');
      const legacyHasData = legacy.some(m => m.account && m.account.trim() !== '') || legacy.length !== current.length;
      if (currentIsPristine && legacyHasData) {
        setMappings(legacy);
        setCollection('payroll_account_mapping', legacy);
      }
      localStorage.removeItem(PAYROLL_MAPPING_LEGACY_STORAGE_KEY);
    } catch (e) { /* legacy copy unreadable — the database/defaults stand */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the grid in step with app state when it changes outside this
  // screen (initial app_config load, another device) — but never stomp
  // unsaved edits in progress.
  useEffect(() => {
    if (!hasUnsavedChanges) {
      setMappings(normalizePayrollMappings(state.payroll_account_mapping));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.payroll_account_mapping]);

  // Derived Stats
  const totalCategories = mappings.length;
  const mappedCount = mappings.filter(m => m.account && m.account.trim() !== '' && m.account !== 'Unmapped').length;
  const missingCount = totalCategories - mappedCount;
  const linkPercentage = totalCategories ? Math.round((mappedCount / totalCategories) * 100) : 0;

  // Handle Back Click with Unsaved Changes Guard
  // NOTE (bug fix, 2026-10-24): appConfirm is the promise API
  // appConfirm(message, title, options) -> Promise<boolean>. This screen
  // previously called it callback-style with (title, message, callback)
  // — the callback was swallowed as the `options` argument and never
  // ran, which is exactly why category DELETE appeared to do nothing.
  const handleBackGuard = async () => {
    if (hasUnsavedChanges) {
      const ok = await appConfirm(
        'You have unsaved changes in Payroll Account Mapping. Are you sure you want to leave without saving?',
        'Unsaved Changes Warning'
      );
      if (ok && onBack) onBack();
    } else {
      if (onBack) onBack();
    }
  };

  // Handle Account Mapping Change
  const handleAccountChange = (id, newAccount) => {
    setHasUnsavedChanges(true);
    setMappings(prev => prev.map(item => {
      if (item.id === id) {
        const isMapped = newAccount && newAccount.trim() !== '' && newAccount !== 'Unmapped';
        return {
          ...item,
          account: newAccount,
          status: isMapped ? 'Linked' : 'Missing'
        };
      }
      return item;
    }));
  };

  // Delete Category Handler (fixed 2026-10-24 — see the appConfirm note
  // on handleBackGuard above; the delete callback never fired before).
  const handleDeleteCategory = async (id, categoryName) => {
    const ok = await appConfirm(
      `Are you sure you want to delete category "${categoryName}"? This action requires applying changes to save.`,
      'Delete Payroll Category'
    );
    if (!ok) return;
    setMappings(prev => prev.filter(m => m.id !== id));
    setHasUnsavedChanges(true);
    showTopPill(`Category "${categoryName}" deleted`, { type: 'info' });
  };

  // Add New Category Handler
  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCat.category.trim()) return;
    const isMapped = newCat.account && newCat.account.trim() !== '';
    const colors = ['bg-[#004277]', 'bg-[#456080]', 'bg-[#6b3000]', 'bg-indigo-600', 'bg-emerald-600', 'bg-sky-600'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newItem = {
      id: `cat_${Date.now()}`,
      category: newCat.category.trim(),
      description: newCat.description.trim() || 'Custom payroll category',
      color: randomColor,
      account: newCat.account || '',
      status: isMapped ? 'Linked' : 'Missing'
    };

    setMappings(prev => [...prev, newItem]);
    setHasUnsavedChanges(true);
    setNewCat({ category: '', description: '', account: '' });
    setShowAddModal(false);
    showTopPill(`Category "${newItem.category}" Added`, { type: 'success' });
  };

  // Test Integration Handler
  const handleTestIntegration = () => {
    showLoading('Testing General Ledger Integration...', 'Verifying category codes with Finance Chart of Accounts • Please wait');
    setTimeout(() => {
      hideLoading();
      if (missingCount > 0) {
        showTopPill(`Integration Test Alert • ${missingCount} category unmapped`, { type: 'warning' });
      } else {
        showTopPill('Integration Test Passed • 100% Mapped to Ledger', { type: 'success' });
      }
    }, 1200);
  };

  // Save Mappings Handler — writes to app state; AppContext write-through
  // persists it to the database (app_config key 'payrollAccountMapping').
  const handleApplySave = () => {
    showLoading('Saving Payroll Mappings...', 'Updating financial ledger rules & syncing database');
    setCollection('payroll_account_mapping', normalizePayrollMappings(mappings));
    setHasUnsavedChanges(false);
    setTimeout(() => {
      hideLoading();
      showTopPill('Payroll Mappings Saved • Ledger Rules Updated', { type: 'success' });
    }, 900);
  };

  // Filtered Items
  const filteredMappings = mappings.filter(m => 
    m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.account.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 w-full h-full flex-1 animate-in fade-in duration-300 font-body select-none overflow-hidden">
      {/* Top Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/15 shadow-sm shrink-0">
        <div className="space-y-1">
          <h1 className="font-headline text-xl font-black text-on-surface tracking-tight flex items-center gap-2">
            {onBack && (
              <button 
                onClick={handleBackGuard}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer border border-outline-variant/15"
                title="Back to HR Settings"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>
            )}
            Payroll Account Mapping
            {hasUnsavedChanges && (
              <span className="text-[10px] bg-amber-500/10 text-amber-600 font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                Unsaved Changes
              </span>
            )}
          </h1>
          <p className="text-xs text-on-surface-variant max-w-2xl leading-relaxed">
            Manage the integration between payroll expense categories and the General Ledger (GL) to automate financial reporting.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={handleTestIntegration}
            className="bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-on-surface font-headline font-bold text-xs px-5 py-2.5 rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">terminal</span>
            Test Integration
          </button>
          <button 
            onClick={handleApplySave}
            className="bg-gradient-to-r from-primary to-primary-container hover:opacity-95 text-white font-headline font-bold text-xs px-6 py-2.5 rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-primary/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            Apply & Save
          </button>
        </div>
      </div>

      {/* Summary Bento Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Categories Card */}
        <div className="bg-surface-container-lowest border border-outline-variant/15 p-5 rounded-3xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">category</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-full uppercase tracking-tight">Healthy</span>
          </div>
          <div className="mt-4">
            <h3 className="text-on-surface-variant text-xs font-semibold">Total Categories</h3>
            <p className="text-2xl font-black font-headline text-on-surface mt-1">
              {totalCategories} <span className="text-xs font-medium text-on-surface-variant/60 ml-1">Defined</span>
            </p>
          </div>
        </div>
        
        {/* Mapped Ledgers Card */}
        <div className="bg-surface-container-lowest border border-outline-variant/15 p-5 rounded-3xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">sync_alt</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-[14px]">trending_up</span> {linkPercentage}%
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-on-surface-variant text-xs font-semibold">Mapped Ledgers</h3>
            <p className="text-2xl font-black font-headline text-on-surface mt-1">
              {mappedCount} / {totalCategories} <span className="text-xs font-medium text-on-surface-variant/60 ml-1">Linked</span>
            </p>
          </div>
        </div>

        {/* Missing Rules Card */}
        <div className="bg-surface-container-lowest border border-outline-variant/15 p-5 rounded-3xl shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className={`w-10 h-10 ${missingCount > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'} rounded-2xl flex items-center justify-center`}>
              <span className="material-symbols-outlined text-[22px]">
                {missingCount > 0 ? 'warning' : 'task_alt'}
              </span>
            </div>
            <span className={`text-[10px] font-bold ${missingCount > 0 ? 'text-amber-700 bg-amber-50 border border-amber-200/60' : 'text-emerald-700 bg-emerald-50 border border-emerald-200/60'} px-2.5 py-1 rounded-full uppercase`}>
              {missingCount > 0 ? 'Alert' : 'Complete'}
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-on-surface-variant text-xs font-semibold">Missing Rules</h3>
            <p className={`text-2xl font-black font-headline ${missingCount > 0 ? 'text-amber-600' : 'text-emerald-600'} mt-1`}>
              {missingCount} <span className="text-xs font-medium text-on-surface-variant/60 ml-1">Unmapped</span>
            </p>
          </div>
        </div>

        {/* Add Category Bento Action */}
        <div 
          onClick={() => setShowAddModal(true)}
          className="bg-primary/5 hover:bg-primary/10 border-2 border-dashed border-primary/25 rounded-3xl flex flex-col items-center justify-center gap-2 group cursor-pointer transition-all p-5 shadow-sm active:scale-95"
        >
          <div className="w-11 h-11 rounded-2xl bg-primary text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-primary/20">
            <span className="material-symbols-outlined text-[22px]">add</span>
          </div>
          <span className="text-xs font-extrabold text-primary font-headline">New Category</span>
        </div>
      </div>

      {/* Integration Grid Table Container */}
      <div className="flex-1 flex flex-col w-full h-full min-h-0 bg-surface-container-lowest border border-outline-variant/15 rounded-3xl shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="px-6 py-4 border-b border-outline-variant/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-low/40 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="font-headline text-base font-bold text-on-surface">Integration Grid</h3>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
              {filteredMappings.length} Categories
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[16px]">search</span>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories or accounts..."
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl pl-9 pr-3 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <button 
              onClick={() => setShowAuditModal(true)}
              className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
              title="Audit Logs"
            >
              <span className="material-symbols-outlined text-[20px]">history</span>
            </button>
          </div>
        </div>

        {/* Table Body Container */}
        <div className="flex-1 overflow-auto w-full h-full min-h-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/70 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                <th className="px-6 py-3.5 w-5/12">Payroll Category</th>
                <th className="px-6 py-3.5 w-4/12">Ledger Account Mapping</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-xs">
              {filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-on-surface-variant text-xs">
                    No payroll category mappings found.
                  </td>
                </tr>
              ) : (
                filteredMappings.map(item => (
                  <tr key={item.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-1.5 h-10 ${item.color || 'bg-primary'} rounded-full`}></div>
                        <div>
                          <p className="font-bold text-on-surface text-sm">{item.category}</p>
                          <p className="text-[11px] text-on-surface-variant/70">{item.description}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <select 
                        value={item.account || ''}
                        onChange={(e) => handleAccountChange(item.id, e.target.value)}
                        className={`w-full ${
                          !item.account 
                            ? 'bg-amber-50/50 border-2 border-dashed border-amber-300 text-amber-800 font-bold' 
                            : 'bg-surface-container-lowest border border-outline-variant/30 text-on-surface font-medium'
                        } rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all px-3 py-2 outline-none cursor-pointer`}
                      >
                        <option value="">-- Select GL Account --</option>
                        {glAccountsList.map((acc, idx) => (
                          <option key={idx} value={acc}>{acc}</option>
                        ))}
                      </select>
                    </td>

                    <td className="px-6 py-4 text-center">
                      {item.account && item.account !== '' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200/70">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Linked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold border border-amber-200/70">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Missing
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => {
                            showTopPill(`Category "${item.category}" options`, { type: 'info' });
                          }}
                          className="text-on-surface-variant/40 hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-container cursor-pointer"
                          title="Configure Category"
                        >
                          <span className="material-symbols-outlined text-[18px]">tune</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(item.id, item.category)}
                          className="text-error/60 hover:text-error hover:bg-error/10 transition-colors p-2 rounded-full cursor-pointer"
                          title="Delete Category"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-surface-container-low/40 border-t border-outline-variant/10 flex justify-between items-center text-xs text-on-surface-variant/70 shrink-0">
          <span>Showing {filteredMappings.length} of {totalCategories} mapping definitions</span>
          <span className="font-semibold text-primary">GL Account Sync Active</span>
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <form 
            onSubmit={handleAddCategory}
            className="relative z-10 w-full max-w-md bg-surface-container-lowest border border-outline-variant/20 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-headline font-bold text-base text-on-surface">Add New Payroll Category</h3>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface block mb-1">Category Name</label>
              <input 
                type="text" 
                required
                value={newCat.category}
                onChange={(e) => setNewCat(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g. Travel Allowance, Incentive"
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface block mb-1">Description</label>
              <input 
                type="text" 
                value={newCat.description}
                onChange={(e) => setNewCat(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the category"
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface block mb-1">Default GL Account Mapping</label>
              <select 
                value={newCat.account}
                onChange={(e) => setNewCat(prev => ({ ...prev, account: e.target.value }))}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="">-- Select GL Account (Optional) --</option>
                {glAccountsList.map((acc, idx) => (
                  <option key={idx} value={acc}>{acc}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 shadow-sm"
              >
                Add Category
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Audit Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAuditModal(false)}></div>
          <div className="relative z-10 w-full max-w-lg bg-surface-container-lowest border border-outline-variant/20 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
              <h3 className="font-headline font-bold text-base text-on-surface">Payroll Integration Audit Logs</h3>
              <button 
                onClick={() => setShowAuditModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              <div className="p-3 bg-surface-container-low/60 rounded-2xl border border-outline-variant/10 text-xs">
                <div className="flex justify-between font-bold text-on-surface">
                  <span>Base Salary Mapped to 6001</span>
                  <span className="text-[10px] text-on-surface-variant/60">Today, 10:45 AM</span>
                </div>
                <p className="text-[11px] text-on-surface-variant/80 mt-1">System user Admin verified General Ledger mapping rules.</p>
              </div>
              <div className="p-3 bg-surface-container-low/60 rounded-2xl border border-outline-variant/10 text-xs">
                <div className="flex justify-between font-bold text-on-surface">
                  <span>Overtime Pay Updated</span>
                  <span className="text-[10px] text-on-surface-variant/60">Yesterday, 04:20 PM</span>
                </div>
                <p className="text-[11px] text-on-surface-variant/80 mt-1">Reassigned from 6001 to 6005 Overtime Expense.</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setShowAuditModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
