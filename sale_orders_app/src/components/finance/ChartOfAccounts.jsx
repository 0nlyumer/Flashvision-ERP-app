import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import { generateTrialBalance, formatMoney, round2, DEFAULT_CHART_OF_ACCOUNTS } from '../../utils/financeEngine';
import ResizableHeader from '../ui/ResizableHeader';

export default function ChartOfAccounts() {
  const { state, setCollection } = useApp();
  const { appConfirm, appAlert } = useDialog();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';

  // View Mode: 'tree' or 'table'
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'table'
  const [activeRootType, setActiveRootType] = useState('All'); // 'All', 'Asset', 'Liability', 'Equity', 'Income', 'Expense'

  // Filters state
  const [filterId, setFilterId] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterCategory, setFilterCategory] = useState('All Categories');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  // Active items for CRUD
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [editAccount, setEditAccount] = useState(null);

  // Form states for creating a new account
  const [newAccId, setNewAccId] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccRootType, setNewAccRootType] = useState('Asset');
  const [newAccCategory, setNewAccCategory] = useState('Current Asset');
  const [newAccParentId, setNewAccParentId] = useState('');
  const [newAccIsGroup, setNewAccIsGroup] = useState(false);
  const [newAccDebit, setNewAccDebit] = useState(0);
  const [newAccCredit, setNewAccCredit] = useState(0);

  // Form states for editing
  const [editAccName, setEditAccName] = useState('');
  const [editAccCategory, setEditAccCategory] = useState('Current Asset');
  const [editAccRootType, setNewAccEditRootType] = useState('Asset');
  const [editAccDebit, setEditAccDebit] = useState(0);
  const [editAccCredit, setEditAccCredit] = useState(0);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    name: true,
    rootType: true,
    category: true,
    debit: true,
    credit: true,
    balance: true,
    actions: true
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Raw accounts from state with fallback to standard master
  const rawAccounts = (state.chartOfAccounts && state.chartOfAccounts.length > 0)
    ? state.chartOfAccounts
    : DEFAULT_CHART_OF_ACCOUNTS;

  // Calculate live balances for each account from General Ledger
  const tb = useMemo(() => {
    return generateTrialBalance(state);
  }, [state]);

  const liveBalanceMap = useMemo(() => {
    const map = new Map();
    tb.rows.forEach(r => {
      map.set(r.id || r.code, r);
    });
    return map;
  }, [tb]);

  // Merge live balances into account definitions
  const enrichedAccounts = useMemo(() => {
    return rawAccounts.map(acc => {
      const live = liveBalanceMap.get(acc.id || acc.code);
      const isDebitNormal = acc.isDebitNormal !== false;
      const closingDr = live ? live.closingDebit : (acc.openingDebit || acc.debit || 0);
      const closingCr = live ? live.closingCredit : (acc.openingCredit || acc.credit || 0);
      const netBal = isDebitNormal ? (closingDr - closingCr) : (closingCr - closingDr);

      return {
        ...acc,
        code: acc.code || acc.id,
        liveDebit: closingDr,
        liveCredit: closingCr,
        netBalance: netBal,
        isDebitNormal
      };
    });
  }, [rawAccounts, liveBalanceMap]);

  // Filter application
  const filteredAccounts = useMemo(() => {
    return enrichedAccounts.filter(acc => {
      if (activeRootType !== 'All' && acc.rootType !== activeRootType) return false;
      const matchId = filterId ? (acc.id || acc.code).toLowerCase().includes(filterId.toLowerCase()) : true;
      const matchName = filterName ? acc.name.toLowerCase().includes(filterName.toLowerCase()) : true;
      const matchCat = filterCategory && filterCategory !== 'All Categories' ? acc.category === filterCategory : true;
      return matchId && matchName && matchCat;
    });
  }, [enrichedAccounts, activeRootType, filterId, filterName, filterCategory]);

  // Group accounts hierarchically for tree view
  const hierarchicalTree = useMemo(() => {
    const roots = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
    const tree = {};

    roots.forEach(root => {
      const accountsInRoot = enrichedAccounts.filter(a => a.rootType === root);
      const groups = accountsInRoot.filter(a => a.isGroup);
      const ledgers = accountsInRoot.filter(a => !a.isGroup);

      tree[root] = {
        groups: groups.map(g => ({
          ...g,
          children: ledgers.filter(l => l.parentId === g.id || l.parentId === g.code)
        })),
        standaloneLedgers: ledgers.filter(l => !l.parentId || !groups.some(g => g.id === l.parentId || g.code === l.parentId))
      };
    });

    return tree;
  }, [enrichedAccounts]);

  const handleResetFilters = () => {
    setFilterId('');
    setFilterName('');
    setFilterCategory('All Categories');
    setActiveRootType('All');
  };

  const openCreateModal = () => {
    const nextAccId = 'ACC-' + (4800 + rawAccounts.length + 1);
    setNewAccId(nextAccId);
    setNewAccName('');
    setNewAccRootType('Asset');
    setNewAccCategory('Current Asset');
    setNewAccParentId('');
    setNewAccIsGroup(false);
    setNewAccDebit(0);
    setNewAccCredit(0);
    setShowCreateModal(true);
  };

  const handleSaveNewAccount = () => {
    if (!newAccName.trim()) {
      appAlert("Account Name is required.");
      return;
    }
    if (rawAccounts.some(acc => (acc.id || acc.code).toLowerCase() === newAccId.toLowerCase())) {
      appAlert(`An account with ID ${newAccId} already exists.`);
      return;
    }

    const isDrNormal = newAccRootType === 'Asset' || newAccRootType === 'Expense';

    const newAccount = {
      id: newAccId,
      code: newAccId,
      name: newAccName,
      rootType: newAccRootType,
      category: newAccCategory,
      parentId: newAccParentId || null,
      isGroup: newAccIsGroup,
      isDebitNormal: isDrNormal,
      openingDebit: Number(newAccDebit) || 0,
      openingCredit: Number(newAccCredit) || 0
    };

    setCollection('chartOfAccounts', [...rawAccounts, newAccount]);
    setShowCreateModal(false);
    appAlert("Account created successfully!");
  };

  const openEditModal = (account) => {
    setEditAccount(account);
    setEditAccName(account.name);
    setEditAccCategory(account.category || 'Current Asset');
    setNewAccEditRootType(account.rootType || 'Asset');
    setEditAccDebit(account.openingDebit || account.debit || 0);
    setEditAccCredit(account.openingCredit || account.credit || 0);
    setShowEditModal(true);
  };

  const handleSaveEditAccount = () => {
    if (!editAccName.trim()) {
      appAlert("Account Name is required.");
      return;
    }

    const updatedAccounts = rawAccounts.map(acc => {
      if ((acc.id || acc.code) === (editAccount.id || editAccount.code)) {
        return {
          ...acc,
          name: editAccName,
          category: editAccCategory,
          rootType: editAccRootType,
          openingDebit: Number(editAccDebit) || 0,
          openingCredit: Number(editAccCredit) || 0
        };
      }
      return acc;
    });

    setCollection('chartOfAccounts', updatedAccounts);
    setShowEditModal(false);
    appAlert("Account details updated successfully!");
  };

  const handleDeleteAccount = async (account) => {
    const proceed = await appConfirm(
      `Are you sure you want to delete the account: ${account.name} (${account.id || account.code})?`,
      "Delete Account Confirmation",
      "Delete",
      "Cancel"
    );

    if (proceed) {
      const updatedAccounts = rawAccounts.filter(acc => (acc.id || acc.code) !== (account.id || account.code));
      setCollection('chartOfAccounts', updatedAccounts);
      appAlert("Account deleted successfully!");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full w-full mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-headline font-black text-on-surface tracking-tight">Chart of Accounts (COA)</h2>
            <span className="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
              {enrichedAccounts.length} Master Accounts
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            5-Tier Standard Hierarchy (Assets, Liabilities, Equity, Income, Expenses) with Real-Time GL Balances
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/15 text-xs font-bold">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'tree' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">account_tree</span>
              Hierarchy Tree
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">table_rows</span>
              Table View
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs hover:opacity-90 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            Add Account
          </button>
        </div>
      </div>

      {/* Root Type Filter Pill Tabs */}
      <div className="flex border-b border-outline-variant/15 gap-2 overflow-x-auto pb-1">
        {['All', 'Asset', 'Liability', 'Equity', 'Income', 'Expense'].map(type => (
          <button
            key={type}
            onClick={() => setActiveRootType(type)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeRootType === type
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            {type === 'All' ? 'All Tiers' : `${type} Accounts`}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. HIERARCHY TREE VIEW                                         */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'tree' && (
        <div className="space-y-6">
          {Object.entries(hierarchicalTree)
            .filter(([root]) => activeRootType === 'All' || activeRootType === root)
            .map(([root, content]) => (
              <div key={root} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">folder</span>
                    <h3 className="text-base font-headline font-black text-on-surface uppercase tracking-wide">
                      {root} Accounts
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-on-surface-variant">
                    {content.groups.length} Parent Groups • {content.standaloneLedgers.length + content.groups.reduce((s, g) => s + g.children.length, 0)} Posting Ledgers
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Parent Groups with Child Accounts */}
                  {content.groups.map(group => (
                    <div key={group.code} className="border border-outline-variant/10 rounded-xl overflow-hidden bg-surface-container-low/20">
                      <div className="p-3 bg-surface-container-low flex justify-between items-center text-xs font-bold text-on-surface">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[18px]">folder_open</span>
                          <span className="font-mono text-primary font-bold">{group.code}</span>
                          <span>{group.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-semibold">Group Header</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(group)}
                            className="p-1 hover:bg-surface-container rounded text-on-surface-variant hover:text-primary cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                        </div>
                      </div>

                      {/* Child Ledger Accounts */}
                      {group.children.length > 0 && (
                        <div className="divide-y divide-outline-variant/10 pl-6 pr-3 py-1 bg-surface-container-lowest">
                          {group.children.map(child => (
                            <div key={child.code} className="py-2.5 flex justify-between items-center text-xs hover:bg-surface-container-low/30 px-2 rounded-lg transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-[16px] text-on-surface-variant opacity-60">subdirectory_arrow_right</span>
                                <span className="font-mono font-bold text-on-surface-variant">{child.code}</span>
                                <span className="font-bold text-on-surface">{child.name}</span>
                                <span className="text-[10px] text-on-surface-variant">({child.category})</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <span className="font-mono font-extrabold text-on-surface">
                                    {formatMoney(Math.abs(child.netBalance), currencyCode)}
                                  </span>
                                  <span className="text-[10px] ml-1 font-bold text-on-surface-variant">
                                    {child.netBalance >= 0 ? (child.isDebitNormal ? 'Dr' : 'Cr') : (child.isDebitNormal ? 'Cr' : 'Dr')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openEditModal(child)}
                                    className="p-1 hover:bg-surface-container rounded text-on-surface-variant hover:text-primary cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAccount(child)}
                                    className="p-1 hover:bg-surface-container rounded text-on-surface-variant hover:text-rose-600 cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Standalone Ledgers */}
                  {content.standaloneLedgers.length > 0 && (
                    <div className="space-y-1 pt-2">
                      {content.standaloneLedgers.map(child => (
                        <div key={child.code} className="py-2 px-3 flex justify-between items-center text-xs bg-surface-container-low/30 rounded-xl">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-on-surface-variant">{child.code}</span>
                            <span className="font-bold text-on-surface">{child.name}</span>
                            <span className="text-[10px] text-on-surface-variant">({child.category})</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-mono font-bold text-on-surface">
                              {formatMoney(Math.abs(child.netBalance), currencyCode)}
                            </span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEditModal(child)} className="p-1 text-on-surface-variant hover:text-primary cursor-pointer">
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                              <button onClick={() => handleDeleteAccount(child)} className="p-1 text-on-surface-variant hover:text-rose-600 cursor-pointer">
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. FLAT TABLE VIEW                                             */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <section className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[180px] space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Account Code / ID</label>
              <input
                type="text"
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g. 111010"
              />
            </div>
            <div className="flex-1 min-w-[180px] space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Account Name</label>
              <input
                type="text"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g. Cash in Hand"
              />
            </div>
            <div className="flex-1 min-w-[180px] space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Category</label>
              <input
                type="text"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="e.g. Current Asset"
              />
            </div>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              Reset
            </button>
          </section>

          {/* Table */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant/10">
                    <ResizableHeader columnKey="id" defaultWidth={110}>Code / ID</ResizableHeader>
                    <ResizableHeader columnKey="name" defaultWidth={280}>Account Name</ResizableHeader>
                    <ResizableHeader columnKey="root" defaultWidth={110}>Root Type</ResizableHeader>
                    <ResizableHeader columnKey="category" defaultWidth={150}>Category</ResizableHeader>
                    <ResizableHeader columnKey="debit" defaultWidth={140} className="text-right">Debit</ResizableHeader>
                    <ResizableHeader columnKey="credit" defaultWidth={140} className="text-right">Credit</ResizableHeader>
                    <ResizableHeader columnKey="balance" defaultWidth={150} className="text-right">Live Net Balance</ResizableHeader>
                    <ResizableHeader columnKey="actions" defaultWidth={100} className="text-center">Actions</ResizableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-xs">
                  {filteredAccounts.map(acc => (
                    <tr key={acc.code} className="hover:bg-surface-container-low/40">
                      <td className="py-3 px-4 font-mono font-bold text-primary">{acc.code}</td>
                      <td className="py-3 px-4 font-bold text-on-surface flex items-center gap-2">
                        {acc.isGroup ? <span className="material-symbols-outlined text-[16px] text-primary">folder</span> : null}
                        {acc.name}
                      </td>
                      <td className="py-3 px-4 font-medium text-on-surface-variant">{acc.rootType}</td>
                      <td className="py-3 px-4 text-on-surface-variant">{acc.category}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-600">
                        {acc.liveDebit > 0 ? formatMoney(acc.liveDebit, '') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {acc.liveCredit > 0 ? formatMoney(acc.liveCredit, '') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-on-surface">
                        {formatMoney(Math.abs(acc.netBalance), currencyCode)}
                        <span className="text-[10px] ml-1 font-bold text-on-surface-variant">
                          {acc.netBalance >= 0 ? (acc.isDebitNormal ? 'Dr' : 'Cr') : (acc.isDebitNormal ? 'Cr' : 'Dr')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(acc)}
                            className="p-1 hover:bg-surface-container rounded text-on-surface-variant hover:text-primary cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(acc)}
                            className="p-1 hover:bg-surface-container rounded text-on-surface-variant hover:text-rose-600 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">add_circle</span>
                <h3 className="text-lg font-black text-on-surface">Create New Ledger Account</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Account Code / ID</label>
                <input
                  type="text"
                  value={newAccId}
                  onChange={(e) => setNewAccId(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 font-mono font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Root Type</label>
                <select
                  value={newAccRootType}
                  onChange={(e) => setNewAccRootType(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 font-bold outline-none"
                >
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                  <option value="Equity">Equity</option>
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Account Name</label>
                <input
                  type="text"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  placeholder="e.g. PU Resin Raw Material Account"
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Category</label>
                <input
                  type="text"
                  value={newAccCategory}
                  onChange={(e) => setNewAccCategory(e.target.value)}
                  placeholder="e.g. Current Asset"
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Parent Group Code</label>
                <input
                  type="text"
                  value={newAccParentId}
                  onChange={(e) => setNewAccParentId(e.target.value)}
                  placeholder="e.g. 110000"
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Opening Debit</label>
                <input
                  type="number"
                  value={newAccDebit}
                  onChange={(e) => setNewAccDebit(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Opening Credit</label>
                <input
                  type="number"
                  value={newAccCredit}
                  onChange={(e) => setNewAccCredit(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 outline-none font-mono"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-surface-container text-on-surface rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewAccount}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-md"
              >
                Save Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">edit</span>
                <h3 className="text-lg font-black text-on-surface">Edit Account ({editAccount.code || editAccount.id})</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-1 text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Account Name</label>
                <input
                  type="text"
                  value={editAccName}
                  onChange={(e) => setEditAccName(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 font-bold outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Category</label>
                <input
                  type="text"
                  value={editAccCategory}
                  onChange={(e) => setEditAccCategory(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Opening Debit</label>
                  <input
                    type="number"
                    value={editAccDebit}
                    onChange={(e) => setEditAccDebit(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Opening Credit</label>
                  <input
                    type="number"
                    value={editAccCredit}
                    onChange={(e) => setEditAccCredit(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2 outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-surface-container text-on-surface rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditAccount}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-md"
              >
                Update Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
