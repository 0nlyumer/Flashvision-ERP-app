import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import LoanLedgerPrintPopup from './LoanLedgerPrintPopup';
import EmployeeLoanStatementPopup from './EmployeeLoanStatementPopup';
import { settleRepaidLoanRequests } from '../../utils/loanLifecycle';

export default function HRLoanLedger({ isMobile }) {
  const { state, setCollection, currencySymbol, hasPermission } = useApp();
  const navigate = useNavigate();
  const currSym = currencySymbol || 'Rs.';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [divisionFilter, setDivisionFilter] = useState('ALL');
  const [selectedLedgerItem, setSelectedLedgerItem] = useState(null);
  const [showLedgerPrint, setShowLedgerPrint] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Manual Repayment State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualRepayAmount, setManualRepayAmount] = useState('');
  const [manualRepayNotes, setManualRepayNotes] = useState('');

  const rawLedgerList = state.hr_loan_ledger || [];

  // Employee-wise loan statement (Omer, 2026-10-27): one print per
  // employee covering ALL their loans — disbursed / recovered / balance.
  const [showEmployeeStatement, setShowEmployeeStatement] = useState(false);
  // The registry's Loan Ledger PRINT action gates both ledger prints
  // (future-screens rule): without it the buttons render grey + dead.
  const canPrintLedger = typeof hasPermission === 'function'
    ? hasPermission('hr', 'hrLoanLedger', 'print')
    : true;

  // LOAN SETTLEMENT (2026-10-28): the moment a ledger entry completes,
  // its loan request flips to 'Repaid' (loanLifecycle rule 2) so salary
  // can never deduct it again. The AppContext reconcile self-heals the
  // same flip on every state pass; doing it here makes it instant.
  const settleRequestsForLedger = (ledgerList) => {
    const settled = settleRepaidLoanRequests(state.hr_loan_requests || [], ledgerList);
    if (settled.changed) setCollection('hr_loan_requests', settled.requests);
  };

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  // Auto-Deduction Engine: Checks for due deduction dates on active loans
  useEffect(() => {
    if (!rawLedgerList || rawLedgerList.length === 0) return;

    const todayStr = new Date().toISOString().substring(0, 10);
    let updated = false;

    const newList = rawLedgerList.map(item => {
      if (item.status !== 'Active' || !item.nextDeductionDate) return item;

      // Check if current date has reached or passed nextDeductionDate
      if (todayStr >= item.nextDeductionDate && item.remainingBalance > 0) {
        const inst = Math.min(parseFloat(item.monthlyInstallment || 0), parseFloat(item.remainingBalance || 0));
        if (inst <= 0) return item;

        const newPaid = parseFloat((item.paidAmount + inst).toFixed(2));
        const newRem = parseFloat(Math.max(0, item.remainingBalance - inst).toFixed(2));
        const isDone = newRem <= 0;

        // Calculate next month deduction date YYYY-MM-DD
        const currentDeduction = new Date(item.nextDeductionDate);
        const nextMonth = new Date(currentDeduction.getFullYear(), currentDeduction.getMonth() + 1, currentDeduction.getDate());
        const nextDateStr = nextMonth.toISOString().substring(0, 10);

        const newHistory = [
          ...(item.deductionsHistory || []),
          {
            id: `DED-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            date: todayStr,
            amount: inst,
            type: 'Scheduled Payroll Deduction',
            remainingBalanceAfter: newRem,
            notes: `Auto deduction for ${todayStr.substring(0,7)}`
          }
        ];

        updated = true;
        return {
          ...item,
          paidAmount: newPaid,
          remainingBalance: newRem,
          nextDeductionDate: isDone ? null : nextDateStr,
          status: isDone ? 'Completed' : 'Active',
          deductionsHistory: newHistory
        };
      }
      return item;
    });

    if (updated) {
      setCollection('hr_loan_ledger', newList);
      settleRequestsForLedger(newList);
      triggerToast('Scheduled loan deductions auto-processed successfully!');
    }
  }, []);

  
  // Distinct Departments & Divisions for Loan Ledger Filtering
  const departmentsList = React.useMemo(() => {
    const set = new Set();
    (state.hr_employees_list || []).filter(e => (e.status || 'Active').toLowerCase() === 'active').forEach(emp => {
      if (emp.department) set.add(emp.department);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [state.hr_employees_list]);

  const divisionsList = React.useMemo(() => {
    const set = new Set();
    (state.hr_employees_list || []).forEach(emp => {
      const div = emp.division || emp.section;
      if (div && (departmentFilter === 'ALL' || !departmentFilter || emp.department === departmentFilter)) {
        set.add(div);
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [state.hr_employees_list, departmentFilter]);

  // Filtered Ledger List
  const filteredLedger = rawLedgerList.filter(item => {
    const emp = (state.hr_employees_list || []).find(e => String(e.id) === String(item.employeeId) || e.name === item.employeeName);
    const itemDept = item.department || emp?.department || '';
    const itemDiv = item.division || item.section || emp?.division || emp?.section || '';

    const matchDept = departmentFilter === 'ALL' || !departmentFilter || itemDept === departmentFilter;
    const matchDiv = divisionFilter === 'ALL' || !divisionFilter || itemDiv === divisionFilter;
    if (!matchDept || !matchDiv) return false;

    const matchesSearch = 
      (item.employeeName && item.employeeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.employeeId && item.employeeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.id && item.id.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (statusFilter === 'All') return true;
    return item.status.toLowerCase() === statusFilter.toLowerCase();
  });

  // KPI Calculations
  const totalPrincipal = rawLedgerList.reduce((acc, curr) => acc + (parseFloat(curr.totalLoanAmount) || 0), 0);
  const totalPaid = rawLedgerList.reduce((acc, curr) => acc + (parseFloat(curr.paidAmount) || 0), 0);
  const totalRemaining = rawLedgerList.reduce((acc, curr) => acc + (parseFloat(curr.remainingBalance) || 0), 0);
  const activeCount = rawLedgerList.filter(item => item.status === 'Active').length;

  // Handle Manual Repayment Entry
  const handleRecordManualRepayment = (e) => {
    if (e) e.preventDefault();
    if (!selectedLedgerItem) return;

    const amountNum = parseFloat(manualRepayAmount);
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid repayment amount.');
      return;
    }

    if (amountNum > selectedLedgerItem.remainingBalance) {
      alert(`Repayment amount cannot exceed remaining balance (${currSym} ${selectedLedgerItem.remainingBalance.toLocaleString()}).`);
      return;
    }

    const todayStr = new Date().toISOString().substring(0, 10);
    const newPaid = parseFloat((selectedLedgerItem.paidAmount + amountNum).toFixed(2));
    const newRem = parseFloat(Math.max(0, selectedLedgerItem.remainingBalance - amountNum).toFixed(2));
    const isDone = newRem <= 0;

    const newHistory = [
      ...(selectedLedgerItem.deductionsHistory || []),
      {
        id: `MAN-${Date.now()}`,
        date: todayStr,
        amount: amountNum,
        type: 'Manual Repayment',
        remainingBalanceAfter: newRem,
        notes: manualRepayNotes || 'Direct manual payment received'
      }
    ];

    const updatedItem = {
      ...selectedLedgerItem,
      paidAmount: newPaid,
      remainingBalance: newRem,
      status: isDone ? 'Completed' : 'Active',
      nextDeductionDate: isDone ? null : selectedLedgerItem.nextDeductionDate,
      deductionsHistory: newHistory
    };

    const updatedList = rawLedgerList.map(l => l.id === selectedLedgerItem.id ? updatedItem : l);
    setCollection('hr_loan_ledger', updatedList);
    if (isDone) settleRequestsForLedger(updatedList);
    setSelectedLedgerItem(updatedItem);

    setManualRepayAmount('');
    setManualRepayNotes('');
    setShowManualModal(false);
    triggerToast(`Manual repayment of ${currSym} ${amountNum.toLocaleString()} recorded for ${selectedLedgerItem.employeeName}!`);
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 font-sans">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-green-600 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-6 duration-300 font-semibold font-manrope">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-on-surface font-headline tracking-tight">Loan Ledger</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary uppercase border border-primary/20">
              Live Payroll Sync
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Centralized loan ledger tracking approved employee loans, repayment schedules, auto deductions, and active balances.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => canPrintLedger && setShowEmployeeStatement(true)}
            disabled={!canPrintLedger}
            title={canPrintLedger ? 'Print one employee\u2019s complete loan ledger — every loan, recovered amount and balance' : 'No print permission for the Loan Ledger'}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 ${canPrintLedger ? 'bg-surface-container-high text-on-surface border border-outline-variant/40 hover:bg-surface-container active:scale-[0.98] cursor-pointer' : 'bg-surface-container-high text-on-surface/40 border border-outline-variant/40 opacity-50 cursor-not-allowed'}`}
          >
            <span className="material-symbols-outlined text-[18px]">summarize</span>
            Employee Loan Statement
          </button>
          <button
            type="button"
            onClick={() => navigate('/hr?tab=loan')}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-sm hover:bg-primary-container active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            New Loan Request
          </button>
        </div>
      </div>

      {/* Stitch KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-outline">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Active Borrowers</span>
            <span className="p-2 bg-blue-500/10 text-blue-600 rounded-lg material-symbols-outlined text-[20px]">groups</span>
          </div>
          <p className="text-2xl font-black text-on-surface font-headline">{activeCount}</p>
          <p className="text-[10px] text-on-surface-variant font-medium">Approved employees with active loans</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-outline">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Principal Issued</span>
            <span className="p-2 bg-purple-500/10 text-purple-600 rounded-lg material-symbols-outlined text-[20px]">account_balance_wallet</span>
          </div>
          <p className="text-2xl font-black text-on-surface font-headline">{currSym} {totalPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-on-surface-variant font-medium">Sum of all approved loan amounts</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-outline">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Recovered / Paid</span>
            <span className="p-2 bg-green-500/10 text-green-600 rounded-lg material-symbols-outlined text-[20px]">payments</span>
          </div>
          <p className="text-2xl font-black text-green-700 font-headline">{currSym} {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-green-600 font-bold">Deducted via payroll & manual payments</p>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-outline">
            <span className="text-[11px] font-bold uppercase tracking-wider">Remaining Loan Balance</span>
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-lg material-symbols-outlined text-[20px]">pending_actions</span>
          </div>
          <p className="text-2xl font-black text-amber-700 font-headline">{currSym} {totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-amber-700 font-medium">Outstanding amount to be recovered</p>
        </div>

      </div>

      {/* Main Ledger Table Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm space-y-4">
        
        {/* Table Search & Filter Bar */}
        <div className="p-6 border-b border-outline-variant/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-outline">search</span>
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employee name, ID, or Loan ID..."
              className="w-full h-10 pl-9 pr-4 text-xs font-semibold border border-outline-variant rounded-xl bg-surface focus:ring-2 focus:ring-primary focus:border-primary text-on-surface"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <span className="text-xs font-bold text-outline uppercase shrink-0">Filter Status:</span>
            <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/10 shrink-0">
              {['All', 'Active', 'Completed'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === tab 
                      ? 'bg-surface-container-lowest text-primary shadow-xs' 
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Responsive Table Container */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/10 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                <th className="p-4">Ledger Ref / Request</th>
                <th className="p-4">Employee</th>
                <th className="p-4">Loan Type</th>
                <th className="p-4 text-right">Total Principal</th>
                <th className="p-4 text-right">Monthly Installment</th>
                <th className="p-4 text-right">Paid Amount</th>
                <th className="p-4 text-right">Remaining Balance</th>
                <th className="p-4">Deduction Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <span className="material-symbols-outlined text-4xl text-outline/60">menu_book</span>
                      <p className="text-sm font-bold text-on-surface">No loan ledger entries found</p>
                      <p className="text-xs text-on-surface-variant max-w-md">
                        When loan applications are approved in the Loan Request screen, employees will automatically appear here with their detailed repayment ledgers.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLedger.map(item => {
                  const pctPaid = item.totalLoanAmount > 0 ? Math.min(100, (item.paidAmount / item.totalLoanAmount) * 100) : 0;
                  return (
                    <tr key={item.id} className="hover:bg-primary/5 transition-colors">
                      
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-xs text-on-surface">{item.id}</span>
                          <span className="text-[10px] text-outline font-mono">{item.loanRequestId}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-on-surface">{item.employeeName}</span>
                          <span className="text-[10px] text-outline font-mono">{item.employeeId} • {item.department}</span>
                        </div>
                      </td>

                      <td className="p-4 text-xs font-semibold text-on-surface">{item.loanType}</td>

                      <td className="p-4 text-right font-mono font-bold text-xs text-on-surface">
                        {currSym} {item.totalLoanAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-right font-mono font-bold text-xs text-primary">
                        {currSym} {item.monthlyInstallment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-right font-mono font-bold text-xs text-green-700">
                        {currSym} {item.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-right font-mono font-black text-xs text-amber-700">
                        {currSym} {item.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-xs font-bold text-on-surface-variant">
                        {item.nextDeductionDate || item.repaymentStartDate || 'N/A'}
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                          item.status === 'Completed' ? 'bg-green-500/10 text-green-700 border-green-200' :
                          item.status === 'Active' ? 'bg-blue-500/10 text-blue-700 border-blue-200' :
                          'bg-gray-500/10 text-gray-700 border-gray-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <button 
                          onClick={() => setSelectedLedgerItem(item)}
                          className="px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          Ledger
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Detailed Employee Ledger Drawer / Modal */}
      {selectedLedgerItem && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-2xl w-full rounded-2xl border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-outline-variant/10 bg-primary/[0.02] flex justify-between items-center shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-on-surface font-headline">Employee Loan Ledger Statement</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-primary/10 text-primary">
                    {selectedLedgerItem.id}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                  {selectedLedgerItem.employeeName} ({selectedLedgerItem.employeeId}) • {selectedLedgerItem.department}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => canPrintLedger && setShowLedgerPrint(true)}
                  disabled={!canPrintLedger}
                  className={`px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${canPrintLedger ? 'hover:bg-primary-container cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                  title={canPrintLedger ? 'Print Ledger Statement' : 'No print permission for the Loan Ledger'}
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  Print Ledger Statement
                </button>
                <button 
                  onClick={() => setSelectedLedgerItem(null)}
                  className="text-on-surface-variant hover:bg-surface-container-high p-1 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              
              {/* Loan Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-container-low p-4 rounded-xl border border-outline-variant/20">
                <div>
                  <span className="text-[10px] font-bold text-outline uppercase block">Principal Amount</span>
                  <span className="text-sm font-extrabold text-on-surface font-mono">{currSym} {selectedLedgerItem.totalLoanAmount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-outline uppercase block">Monthly Installment</span>
                  <span className="text-sm font-extrabold text-primary font-mono">{currSym} {selectedLedgerItem.monthlyInstallment.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-outline uppercase block">Total Recovered</span>
                  <span className="text-sm font-extrabold text-green-700 font-mono">{currSym} {selectedLedgerItem.paidAmount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-outline uppercase block">Balance Due</span>
                  <span className="text-sm font-extrabold text-amber-700 font-mono">{currSym} {selectedLedgerItem.remainingBalance.toLocaleString()}</span>
                </div>
              </div>

              {/* Repayment Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-on-surface-variant">Loan Repayment Progress</span>
                  <span className="text-primary font-mono font-extrabold">
                    {selectedLedgerItem.totalLoanAmount > 0 
                      ? Math.min(100, Math.round((selectedLedgerItem.paidAmount / selectedLedgerItem.totalLoanAmount) * 100)) 
                      : 0}% Repaid
                  </span>
                </div>
                <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-500 rounded-full"
                    style={{ width: `${selectedLedgerItem.totalLoanAmount > 0 ? Math.min(100, (selectedLedgerItem.paidAmount / selectedLedgerItem.totalLoanAmount) * 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Key Details Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium bg-surface p-4 rounded-xl border border-outline-variant/20">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-outline">Loan Category:</span>
                    <span className="font-bold text-on-surface">{selectedLedgerItem.loanType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Term Duration:</span>
                    <span className="font-bold text-on-surface">{selectedLedgerItem.termMonths} Months</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Repayment Start:</span>
                    <span className="font-bold text-on-surface">{selectedLedgerItem.repaymentStartDate}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-outline">Next Scheduled Date:</span>
                    <span className="font-bold text-primary">{selectedLedgerItem.nextDeductionDate || 'Loan Cleared'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Ledger Status:</span>
                    <span className="font-bold text-on-surface">{selectedLedgerItem.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-outline">Loan Request Ref:</span>
                    <span className="font-bold text-on-surface">{selectedLedgerItem.loanRequestId}</span>
                  </div>
                </div>
              </div>

              {/* Deductions & Payments History Log */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">Transaction Deduction History</h4>
                  {selectedLedgerItem.status === 'Active' && (
                    <button 
                      onClick={() => setShowManualModal(true)}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      Record Manual Payment
                    </button>
                  )}
                </div>

                <div className="border border-outline-variant/20 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-surface-container-low text-on-surface-variant font-bold border-b border-outline-variant/10">
                        <th className="p-3">Date</th>
                        <th className="p-3">Transaction Type</th>
                        <th className="p-3 text-right">Amount ({currSym})</th>
                        <th className="p-3 text-right">Balance After</th>
                        <th className="p-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 font-mono">
                      {(!selectedLedgerItem.deductionsHistory || selectedLedgerItem.deductionsHistory.length === 0) ? (
                        <tr>
                          <td colSpan="5" className="p-4 text-center text-outline font-sans">
                            No repayments or deductions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        selectedLedgerItem.deductionsHistory.map((log, idx) => (
                          <tr key={log.id || idx} className="hover:bg-surface-container-low/40">
                            <td className="p-3 text-on-surface font-semibold">{log.date}</td>
                            <td className="p-3 font-sans font-medium text-on-surface">{log.type}</td>
                            <td className="p-3 text-right font-bold text-green-700">+{log.amount.toLocaleString()}</td>
                            <td className="p-3 text-right font-bold text-on-surface">{log.remainingBalanceAfter.toLocaleString()}</td>
                            <td className="p-3 font-sans text-on-surface-variant text-[11px] truncate">{log.notes || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-surface-container-low/50 border-t border-outline-variant/10 flex justify-end items-center shrink-0">
              <button
                onClick={() => setSelectedLedgerItem(null)}
                className="bg-primary text-on-primary px-6 py-2 rounded-xl text-xs font-bold hover:bg-primary-container transition-all cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Manual Repayment Modal */}
      {showManualModal && selectedLedgerItem && (
        <div className="fixed inset-0 bg-on-surface/50 backdrop-blur-xs z-[250] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-sm w-full rounded-2xl border border-outline-variant shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150">
            
            <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
              <h3 className="text-sm font-bold text-on-surface font-headline">Record Manual Repayment</h3>
              <button 
                onClick={() => setShowManualModal(false)}
                className="text-on-surface-variant hover:bg-surface-container-high p-1 rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleRecordManualRepayment} className="space-y-4 text-xs">
              <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 space-y-1">
                <p className="text-[10px] font-bold text-primary uppercase">Employee</p>
                <p className="font-bold text-on-surface">{selectedLedgerItem.employeeName} ({selectedLedgerItem.employeeId})</p>
                <p className="text-[11px] text-amber-700 font-semibold">Remaining Balance: {currSym} {selectedLedgerItem.remainingBalance.toLocaleString()}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                  Repayment Amount ({currSym})
                </label>
                <input 
                  type="number"
                  value={manualRepayAmount}
                  onChange={(e) => setManualRepayAmount(e.target.value)}
                  placeholder={`Max ${selectedLedgerItem.remainingBalance}`}
                  className="w-full h-10 px-3 border border-outline-variant rounded-xl bg-surface focus:ring-2 focus:ring-primary focus:border-primary text-xs font-bold text-on-surface"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                  Payment Remarks / Mode
                </label>
                <input 
                  type="text"
                  value={manualRepayNotes}
                  onChange={(e) => setManualRepayNotes(e.target.value)}
                  placeholder="e.g. Cash payment / Bank transfer"
                  className="w-full h-10 px-3 border border-outline-variant rounded-xl bg-surface focus:ring-2 focus:ring-primary focus:border-primary text-xs text-on-surface"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 py-2.5 border border-outline-variant rounded-xl text-on-surface-variant font-bold text-xs hover:bg-surface-container-high transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-bold text-xs hover:bg-green-700 transition-all cursor-pointer shadow-xs"
                >
                  Save Repayment
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Print — Loan Ledger Statement (shared slip renderer; the statement
          states the salary-deduction truth per payroll's own resolution) */}
      <LoanLedgerPrintPopup
        isOpen={showLedgerPrint && !!selectedLedgerItem}
        onClose={() => setShowLedgerPrint(false)}
        ledgerItem={selectedLedgerItem}
      />

      {/* Print — Employee Loan Statement (all of one employee's loans) */}
      <EmployeeLoanStatementPopup
        isOpen={showEmployeeStatement}
        onClose={() => setShowEmployeeStatement(false)}
        canPrint={canPrintLedger}
      />

    </div>
  );
}
