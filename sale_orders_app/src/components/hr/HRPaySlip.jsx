import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateEmployeeSalary, amountInWords, formatMoney, safeNum } from '../../utils/salaryEngine';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

const COMPANY_NAME = "AJ Synthetic Leather & footware Industries Pvt. Limited";

export default function HRPaySlip({ isMobile }) {
  const { state, currencySymbol } = useApp();
  const currSym = currencySymbol || 'Rs.';

  // Month selector state - default to current YYYY-MM
  const [payrollPeriod, setPayrollPeriod] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  // Division filter state ('ALL', 'AJ Synthetic', 'AAA')
  const [divisionFilter, setDivisionFilter] = useState('ALL');

  // Employee search query & selected employee ID
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Universal Print Preview Modal state
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Dynamic months list (last 12 months up to next 2 months)
  const monthsList = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = -10; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      list.push({ key, label });
    }
    return list.reverse();
  }, []);

  const allEmployees = state.hr_employees_list || [];

  // Filtered employees list based on Division and Search Query
  const filteredEmployees = useMemo(() => {
    return allEmployees.filter(emp => {
      if (divisionFilter !== 'ALL') {
        const div = emp.division || 'AJ Synthetic';
        if (div !== divisionFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (emp.name || '').toLowerCase();
        const id = (emp.id || '').toLowerCase();
        const dept = (emp.department || '').toLowerCase();
        const desig = (emp.designation || '').toLowerCase();
        return name.includes(q) || id.includes(q) || dept.includes(q) || desig.includes(q);
      }
      return true;
    });
  }, [allEmployees, divisionFilter, searchQuery]);

  // Selected employee (auto-select first if not set)
  const currentEmployee = useMemo(() => {
    if (selectedEmpId) {
      const found = allEmployees.find(e => String(e.id) === String(selectedEmpId) || e.name === selectedEmpId);
      if (found) return found;
    }
    if (filteredEmployees.length > 0) {
      return filteredEmployees[0];
    }
    if (allEmployees.length > 0) {
      return allEmployees[0];
    }
    return null;
  }, [allEmployees, filteredEmployees, selectedEmpId]);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute salary record for the current employee in the selected month
  const salaryRecord = useMemo(() => {
    if (!currentEmployee) return null;

    let salaryConfig = null;
    try {
      const savedConfig = localStorage.getItem('hr_salary_allowance_config');
      if (savedConfig) salaryConfig = JSON.parse(savedConfig);
    } catch (e) {}

    const monthContext = {
      payrollPeriod,
      uploadedAttendance: state.hr_uploaded_attendance || [],
      overtimeRequests: state.hr_overtime_requests || [],
      advanceRequests: state.hr_advance_requests || [],
      loanRequests: state.hr_loan_requests || [],
      loanLedger: state.hr_loan_ledger || [],
      leaveRequests: state.hr_leave_requests || [],
      salaryConfig
    };

    return calculateEmployeeSalary(currentEmployee, monthContext);
  }, [currentEmployee, payrollPeriod, state.hr_uploaded_attendance, state.hr_overtime_requests, state.hr_advance_requests, state.hr_loan_requests, state.hr_loan_ledger, state.hr_leave_requests]);

  // Parse Month / Year for Header Box
  const periodDisplay = useMemo(() => {
    const [y, m] = (payrollPeriod || '2026-09').split('-');
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    const monthName = date.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    return { monthName, year: y };
  }, [payrollPeriod]);

  // Navigate to previous or next employee in the filtered list
  const handlePrevEmployee = () => {
    if (filteredEmployees.length === 0 || !currentEmployee) return;
    const currIdx = filteredEmployees.findIndex(e => (e.id && e.id === currentEmployee.id) || e.name === currentEmployee.name);
    if (currIdx > 0) {
      setSelectedEmpId(filteredEmployees[currIdx - 1].id || filteredEmployees[currIdx - 1].name);
    }
  };

  const handleNextEmployee = () => {
    if (filteredEmployees.length === 0 || !currentEmployee) return;
    const currIdx = filteredEmployees.findIndex(e => (e.id && e.id === currentEmployee.id) || e.name === currentEmployee.name);
    if (currIdx >= 0 && currIdx < filteredEmployees.length - 1) {
      setSelectedEmpId(filteredEmployees[currIdx + 1].id || filteredEmployees[currIdx + 1].name);
    }
  };

  // Prepare payload for UniversalPrintPreviewModal
  const universalPrintData = useMemo(() => {
    if (!salaryRecord) return null;
    const r = salaryRecord;
    const items = [];
    const basicVal = safeNum(r.basic);
    if (basicVal > 0) {
      items.push({ description: 'Basic Monthly Salary', earnings: basicVal, deductions: 0, remarks: 'Monthly Base' });
    }
    const otVal = safeNum(r.otAmount);
    if (otVal > 0) {
      items.push({ description: `Overtime (${safeNum(r.otHours)} hrs @ ${currSym} ${r.hourly?.toFixed(2)}/hr)`, earnings: otVal, deductions: 0, remarks: 'OT Amount' });
    }
    const allowVal = safeNum(r.allowance);
    if (allowVal > 0) {
      items.push({ description: 'Attendance / Incharge Allowance', earnings: allowVal, deductions: 0, remarks: 'Standard Allowance' });
    }
    const dedVal = safeNum(r.deductionAmount);
    if (dedVal > 0) {
      items.push({ description: `Deduction Hours (${safeNum(r.deductionHours)} hrs @ ${currSym} ${r.hourly?.toFixed(2)}/hr)`, earnings: 0, deductions: dedVal, remarks: 'Hourly Deduction' });
    }
    const absVal = safeNum(r.absentDeduction);
    if (absVal > 0) {
      items.push({ description: `Absent Deduction (${safeNum(r.absentDays)} days @ basic/30)`, earnings: 0, deductions: absVal, remarks: 'Unpaid Absences' });
    }
    const fineVal = safeNum(r.fine);
    if (fineVal > 0) {
      items.push({ description: 'Fine / Disciplinary Penalty', earnings: 0, deductions: fineVal, remarks: 'Penalty' });
    }
    const advVal = safeNum(r.advance);
    if (advVal > 0) {
      items.push({ description: 'Salary Advance Return', earnings: 0, deductions: advVal, remarks: 'Advance Recovery' });
    }
    const loanVal = safeNum(r.loan);
    if (loanVal > 0) {
      items.push({ description: 'Loan Installment Deduction', earnings: 0, deductions: loanVal, remarks: 'Loan Recovery' });
    }
    const netVal = safeNum(r.totalSalary);
    items.push({ description: 'TOTAL SALARY PAYABLE', earnings: netVal, deductions: 0, remarks: r.words || amountInWords(netVal) });

    return {
      header: {
        employee_name: r.employeeName,
        employee_id: r.employeeId || '-',
        designation: r.designation,
        department: r.department,
        division: r.division,
        month: `${periodDisplay.monthName} ${periodDisplay.year}`,
        basic_salary: `${currSym} ${basicVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        duty_hours: `${r.dutyHours || 8} hrs/day (${r.shift || 'GENERAL SHIFT'})`,
        bank_name: COMPANY_NAME,
        account_no: '-'
      },
      items,
      totals: {
        totalEarnings: basicVal + otVal + allowVal,
        totalDeductions: dedVal + absVal + fineVal + advVal + loanVal,
        grandTotal: netVal,
        netSalary: netVal
      }
    };
  }, [salaryRecord, periodDisplay, currSym]);

  const handleBrowserPrint = () => {
    window.print();
  };

  // Days register split: 1-15 (left), 16-31 (right)
  const leftDays = useMemo(() => salaryRecord?.days?.filter(d => d.day <= 15) || [], [salaryRecord]);
  const rightDays = useMemo(() => salaryRecord?.days?.filter(d => d.day > 15) || [], [salaryRecord]);

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-sans">
      
      {/* Print styles injected for single-page A4 guarantee */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 10mm;
          }
          body {
            background: white !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .payslip-page-wrapper {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Control Bar (Hidden when printing) */}
      <section className="no-print bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        
        {/* Selectors Group */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          
          {/* Month Selector */}
          <div className="space-y-1 min-w-[170px]">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Payroll Period</label>
            <div className="relative">
              <select
                value={payrollPeriod}
                onChange={(e) => setPayrollPeriod(e.target.value)}
                className="w-full h-10 pl-3 pr-8 text-xs font-semibold border border-outline-variant rounded-xl bg-surface-container-lowest hover:border-primary transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer text-on-surface"
              >
                {monthsList.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 pointer-events-none text-[18px] text-outline">calendar_month</span>
            </div>
          </div>

          {/* Division Selector */}
          <div className="space-y-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Division Filter</label>
            <div className="relative">
              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="w-full h-10 pl-3 pr-8 text-xs font-semibold border border-outline-variant rounded-xl bg-surface-container-lowest hover:border-primary transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer text-on-surface"
              >
                <option value="ALL">All Divisions</option>
                <option value="AJ Synthetic">AJ Synthetic</option>
                <option value="AAA">AAA</option>
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 pointer-events-none text-[18px] text-outline">domain</span>
            </div>
          </div>

          {/* Employee Autocomplete Dropdown */}
          <div className="space-y-1 relative min-w-[260px] flex-1 sm:flex-none" ref={dropdownRef}>
            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Select Employee</label>
            <div className="relative">
              <input
                type="text"
                placeholder={currentEmployee ? `${currentEmployee.id ? currentEmployee.id + ' - ' : ''}${currentEmployee.name}` : "Search employee..."}
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full h-10 pl-9 pr-8 text-xs font-semibold border border-outline-variant rounded-xl bg-surface-container-lowest hover:border-primary transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface"
              />
              <span className="material-symbols-outlined absolute left-2.5 top-2.5 pointer-events-none text-[18px] text-outline">search</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            {/* Dropdown list */}
            {isDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-full min-w-[320px] max-h-64 overflow-y-auto bg-surface-container-lowest border border-outline-variant/40 rounded-xl shadow-2xl z-[150] p-1.5 custom-scrollbar">
                {filteredEmployees.length === 0 ? (
                  <div className="p-3 text-center text-xs text-on-surface-variant font-medium">No matching employee found</div>
                ) : (
                  filteredEmployees.map(emp => (
                    <button
                      key={emp.id || emp.name}
                      type="button"
                      onClick={() => {
                        setSelectedEmpId(emp.id || emp.name);
                        setSearchQuery('');
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        currentEmployee && (currentEmployee.id === emp.id || currentEmployee.name === emp.name)
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'hover:bg-primary/5 text-on-surface'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="font-mono text-[11px] opacity-75 mr-1.5">{emp.id || '-'}</span>
                        <span className="font-semibold">{emp.name}</span>
                        <span className="text-[10px] opacity-65 ml-2">({emp.designation || 'Staff'})</span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase shrink-0 ${
                        emp.division === 'AAA' ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'
                      }`}>
                        {emp.division || 'AJ Synthetic'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Quick Prev / Next Buttons */}
          <div className="flex items-center gap-1 pt-4 sm:pt-0">
            <button
              onClick={handlePrevEmployee}
              disabled={filteredEmployees.length <= 1 || (currentEmployee && ((filteredEmployees[0].id && filteredEmployees[0].id === currentEmployee.id) || filteredEmployees[0].name === currentEmployee.name))}
              className="h-10 px-2.5 rounded-xl border border-outline-variant hover:bg-surface-container-low transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer text-on-surface-variant"
              title="Previous Employee"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button
              onClick={handleNextEmployee}
              disabled={filteredEmployees.length <= 1 || (currentEmployee && ((filteredEmployees[filteredEmployees.length - 1].id && filteredEmployees[filteredEmployees.length - 1].id === currentEmployee.id) || filteredEmployees[filteredEmployees.length - 1].name === currentEmployee.name))}
              className="h-10 px-2.5 rounded-xl border border-outline-variant hover:bg-surface-container-low transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer text-on-surface-variant"
              title="Next Employee"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex-1 sm:flex-none h-10 px-4 rounded-xl border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-all text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            title="Open Universal Print Preview"
          >
            <span className="material-symbols-outlined text-[18px]">preview</span>
            Print Preview
          </button>
          <button
            onClick={handleBrowserPrint}
            className="flex-1 sm:flex-none h-10 px-5 rounded-xl bg-primary text-on-primary hover:bg-primary-container active:scale-[0.98] transition-all text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Print Payslip
          </button>
        </div>

      </section>

      {/* Main Single-Page Payslip Document Container */}
      {!salaryRecord ? (
        <div className="bg-surface-container-lowest p-16 rounded-2xl border border-outline-variant/30 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant">person_search</span>
          <p className="text-base font-bold text-on-surface">No Employee Selected</p>
          <p className="text-xs text-on-surface-variant">Please choose an employee and payroll period from the top bar.</p>
        </div>
      ) : (
        <div className="payslip-page-wrapper mx-auto max-w-[800px] bg-white text-slate-900 border border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 space-y-4 print:p-0 print:border-none print:shadow-none print:max-w-none print:bg-white print:text-slate-900 transition-colors">
          
          {/* Top Banner Header */}
          <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800 print:border-slate-300">
            {/* Left: AJ Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-10 rounded-lg border-2 border-slate-900 dark:border-slate-100 print:border-slate-900 flex items-center justify-center font-black text-lg tracking-tight text-slate-900 dark:text-slate-100 print:text-slate-900 shrink-0">
                AJ
              </div>
              <div className="leading-tight">
                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 print:text-slate-900 uppercase">
                  AJ SYNTHETIC
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 print:text-slate-500 font-medium">
                  Payroll Audit Division &bull; {COMPANY_NAME}
                </p>
              </div>
            </div>

            {/* Right: Period Box & Title */}
            <div className="text-right flex flex-col items-end">
              <div className="border-2 border-slate-900 dark:border-slate-100 print:border-slate-900 rounded-lg px-4 py-1 font-black text-xs text-slate-900 dark:text-slate-100 print:text-slate-900 uppercase tracking-wide">
                {periodDisplay.monthName} {periodDisplay.year}
              </div>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 print:text-slate-500 mt-1 font-medium">
                Monthly Pay Slip &amp; Time Log
              </span>
            </div>
          </div>

          {/* Employee Info Card Grid */}
          <div className="rounded-xl border border-slate-300 dark:border-slate-700 print:border-slate-300 overflow-hidden text-xs">
            <div className="grid grid-cols-4 divide-x divide-slate-300 dark:divide-slate-700 print:divide-slate-300 border-b border-slate-300 dark:border-slate-700 print:border-slate-300">
              <div className="p-2 sm:p-2.5 space-y-0.5">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase tracking-wider block">EMPLOYEE ID</span>
                <span className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 print:text-slate-900">{salaryRecord.employeeId || '-'}</span>
              </div>
              <div className="p-2 sm:p-2.5 space-y-0.5 col-span-1 truncate">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase tracking-wider block">EMPLOYEE NAME</span>
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100 print:text-slate-900 truncate block">{salaryRecord.employeeName}</span>
              </div>
              <div className="p-2 sm:p-2.5 space-y-0.5 truncate">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase tracking-wider block">DESIGNATION / ROLE</span>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 print:text-slate-800 truncate block">{salaryRecord.designation}</span>
              </div>
              <div className="p-2 sm:p-2.5 space-y-0.5 text-right">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase tracking-wider block">BASIC MONTHLY SALARY</span>
                <span className="font-bold text-xs text-blue-600 dark:text-blue-400 print:text-blue-700">{formatMoney(salaryRecord.basic)}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 divide-x divide-slate-300 dark:divide-slate-700 print:divide-slate-300">
              <div className="p-2 sm:p-2.5 space-y-0.5">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase tracking-wider block">DEPARTMENT</span>
                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 print:text-slate-900 truncate block">{salaryRecord.department}</span>
              </div>
              <div className="p-2 sm:p-2.5 space-y-0.5">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase tracking-wider block">SHIFT SCHEDULE</span>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 print:text-slate-800 block">{salaryRecord.shift || 'GENERAL SHIFT'} ({salaryRecord.dutyHours || 8}h)</span>
              </div>
              <div className="p-2 sm:p-2.5 space-y-0.5">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase tracking-wider block">WORKING DAYS</span>
                <span className="font-bold text-xs text-teal-600 dark:text-teal-400 print:text-teal-700 block">{salaryRecord.paidDays} Paid / {salaryRecord.presentDays} Present</span>
              </div>
              <div className="p-2 sm:p-2.5 space-y-0.5 text-right">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase tracking-wider block">TOTAL CALENDAR DAYS</span>
                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 print:text-slate-900 block">{salaryRecord.calDays} Days</span>
              </div>
            </div>
          </div>

          {/* 31-Day Attendance, Overtime & Deduction Register */}
          <div className="rounded-xl border border-slate-300 dark:border-slate-700 print:border-slate-300 overflow-hidden">
            {/* Header bar */}
            <div className="bg-slate-100 dark:bg-slate-800/80 print:bg-slate-100 px-3 py-1.5 border-b border-slate-300 dark:border-slate-700 print:border-slate-300">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 print:text-slate-800">
                31-DAY ATTENDANCE, OVERTIME (OT) &amp; DEDUCTION (DT) REGISTER
              </span>
            </div>

            {/* Dual Panel Grid */}
            <div className="grid grid-cols-2 divide-x divide-slate-300 dark:divide-slate-700 print:divide-slate-300 text-[10px]">
              
              {/* Left Column: Days 1 to 15 */}
              <div>
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-slate-700 print:border-slate-300 font-bold text-[9px] text-slate-500 dark:text-slate-400 print:text-slate-500">
                      <th className="py-1 px-1.5 text-left pl-2.5">DATE</th>
                      <th className="py-1 px-1">ATT</th>
                      <th className="py-1 px-1">OT</th>
                      <th className="py-1 px-1">DT</th>
                      <th className="py-1 px-1 text-left pr-2">REMARKS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-slate-200">
                    {leftDays.map(d => (
                      <tr 
                        key={d.day} 
                        className={`transition-colors ${
                          d.isSunday 
                            ? 'bg-amber-500/5 print:bg-slate-50' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 print:hover:bg-transparent'
                        }`}
                      >
                        <td className="py-0.5 px-1.5 text-left pl-2.5 font-bold font-mono text-[9px]">{String(d.day).padStart(2, '0')}</td>
                        <td className="py-0.5 px-1">
                          {d.att === 'P' && <span className="font-black text-teal-600 dark:text-teal-400 print:text-teal-700">P</span>}
                          {d.att === 'ABS' && <span className="font-black text-red-600 dark:text-red-400 print:text-red-700">ABS</span>}
                          {d.att === 'L' && <span className="font-black text-blue-600 dark:text-blue-400 print:text-blue-700">L</span>}
                          {d.att === '-' && <span className="text-slate-400 dark:text-slate-500 print:text-slate-400">-</span>}
                          {d.att !== 'P' && d.att !== 'ABS' && d.att !== 'L' && d.att !== '-' && <span>{d.att}</span>}
                        </td>
                        <td className="py-0.5 px-1">
                          {d.ot > 0 ? <span className="font-bold text-teal-600 dark:text-teal-400 print:text-teal-700">+{d.ot.toFixed(1)}h</span> : <span className="text-slate-400 dark:text-slate-500 print:text-slate-400">-</span>}
                        </td>
                        <td className="py-0.5 px-1">
                          {d.ded > 0 ? <span className="font-bold text-red-600 dark:text-red-400 print:text-red-700">-{d.ded.toFixed(1)}h</span> : <span className="text-slate-400 dark:text-slate-500 print:text-slate-400">-</span>}
                        </td>
                        <td className="py-0.5 px-1 text-left pr-2 truncate max-w-[90px] text-slate-500 dark:text-slate-400 print:text-slate-500 text-[8.5px]">
                          {d.remarks || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right Column: Days 16 to 31 */}
              <div>
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 dark:border-slate-700 print:border-slate-300 font-bold text-[9px] text-slate-500 dark:text-slate-400 print:text-slate-500">
                      <th className="py-1 px-1.5 text-left pl-2.5">DATE</th>
                      <th className="py-1 px-1">ATT</th>
                      <th className="py-1 px-1">OT</th>
                      <th className="py-1 px-1">DT</th>
                      <th className="py-1 px-1 text-left pr-2">REMARKS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-slate-200">
                    {rightDays.map(d => (
                      <tr 
                        key={d.day} 
                        className={`transition-colors ${
                          d.isSunday 
                            ? 'bg-amber-500/5 print:bg-slate-50' 
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 print:hover:bg-transparent'
                        }`}
                      >
                        <td className="py-0.5 px-1.5 text-left pl-2.5 font-bold font-mono text-[9px]">{String(d.day).padStart(2, '0')}</td>
                        <td className="py-0.5 px-1">
                          {d.att === 'P' && <span className="font-black text-teal-600 dark:text-teal-400 print:text-teal-700">P</span>}
                          {d.att === 'ABS' && <span className="font-black text-red-600 dark:text-red-400 print:text-red-700">ABS</span>}
                          {d.att === 'L' && <span className="font-black text-blue-600 dark:text-blue-400 print:text-blue-700">L</span>}
                          {d.att === '-' && <span className="text-slate-400 dark:text-slate-500 print:text-slate-400">-</span>}
                          {d.att !== 'P' && d.att !== 'ABS' && d.att !== 'L' && d.att !== '-' && <span>{d.att}</span>}
                        </td>
                        <td className="py-0.5 px-1">
                          {d.ot > 0 ? <span className="font-bold text-teal-600 dark:text-teal-400 print:text-teal-700">+{d.ot.toFixed(1)}h</span> : <span className="text-slate-400 dark:text-slate-500 print:text-slate-400">-</span>}
                        </td>
                        <td className="py-0.5 px-1">
                          {d.ded > 0 ? <span className="font-bold text-red-600 dark:text-red-400 print:text-red-700">-{d.ded.toFixed(1)}h</span> : <span className="text-slate-400 dark:text-slate-500 print:text-slate-400">-</span>}
                        </td>
                        <td className="py-0.5 px-1 text-left pr-2 truncate max-w-[90px] text-slate-500 dark:text-slate-400 print:text-slate-500 text-[8.5px]">
                          {d.remarks || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>

          {/* Breakdown Section: 2 Cards Side by Side */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            
            {/* Left Card: TIME & ATTENDANCE BREAKDOWN */}
            <div className="rounded-xl border border-slate-300 dark:border-slate-700 print:border-slate-300 overflow-hidden">
              <div className="bg-slate-100 dark:bg-slate-800/80 print:bg-slate-100 px-3 py-1.5 border-b border-slate-300 dark:border-slate-700 print:border-slate-300 flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 print:text-slate-800">
                  TIME &amp; ATTENDANCE BREAKDOWN
                </span>
                <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase">
                  MONTHLY UNITS
                </span>
              </div>
              <div className="p-2 space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-100 text-[10px]">
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-700 dark:text-slate-300 print:text-slate-700">Overtime Hours (OT)</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400 print:text-teal-700">
                    {salaryRecord.otHours.toFixed(1)} Hrs (+ {formatMoney(salaryRecord.otAmount)})
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-700 dark:text-slate-300 print:text-slate-700">Decrease / Short Hours (DT)</span>
                  <span className={`font-bold ${salaryRecord.deductionAmount > 0 ? 'text-red-600 dark:text-red-400 print:text-red-700' : 'text-slate-400 dark:text-slate-500'}`}>
                    {salaryRecord.deductionHours.toFixed(1)} Hrs (- {formatMoney(salaryRecord.deductionAmount)})
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-700 dark:text-slate-300 print:text-slate-700">Unpaid Absence Days</span>
                  <span className={`font-bold ${salaryRecord.absentDeduction > 0 ? 'text-red-600 dark:text-red-400 print:text-red-700' : 'text-slate-400 dark:text-slate-500'}`}>
                    {salaryRecord.absentDays} Day (- {formatMoney(salaryRecord.absentDeduction)})
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-700 dark:text-slate-300 print:text-slate-700">Fine / Disciplinary Penalty</span>
                  <span className={`font-bold ${salaryRecord.fine > 0 ? 'text-red-600 dark:text-red-400 print:text-red-700' : 'text-slate-400 dark:text-slate-500'}`}>
                    - {formatMoney(salaryRecord.fine)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Card: FINANCIALS & ADVANCE RECOVERY */}
            <div className="rounded-xl border border-slate-300 dark:border-slate-700 print:border-slate-300 overflow-hidden">
              <div className="bg-slate-100 dark:bg-slate-800/80 print:bg-slate-100 px-3 py-1.5 border-b border-slate-300 dark:border-slate-700 print:border-slate-300 flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 print:text-slate-800">
                  FINANCIALS &amp; ADVANCE RECOVERY
                </span>
                <span className="text-[8px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-500 uppercase">
                  AMOUNT (PKR)
                </span>
              </div>
              <div className="p-2 space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-100 text-[10px]">
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-700 dark:text-slate-300 print:text-slate-700">Attendance / Incharge Allowance</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400 print:text-teal-700">
                    + {formatMoney(salaryRecord.allowance)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-700 dark:text-slate-300 print:text-slate-700">Company Advance Amount</span>
                  <span className={`font-bold ${salaryRecord.advance > 0 ? 'text-red-600 dark:text-red-400 print:text-red-700' : 'text-slate-400 dark:text-slate-500'}`}>
                    - {formatMoney(salaryRecord.advance)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-700 dark:text-slate-300 print:text-slate-700">Personal Loan Installment</span>
                  <span className={`font-bold ${salaryRecord.loan > 0 ? 'text-red-600 dark:text-red-400 print:text-red-700' : 'text-slate-400 dark:text-slate-500'}`}>
                    - {formatMoney(salaryRecord.loan)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-700 dark:text-slate-300 print:text-slate-700">Net Overtime &amp; Adjustment Balance</span>
                  <span 
                    className="font-bold" 
                    style={{ color: salaryRecord.netAdjCol }}
                  >
                    {salaryRecord.netAdjTxt}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Total Net Payable Amount Box */}
          <div className="rounded-xl border-2 border-slate-900 dark:border-slate-100 print:border-slate-900 p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="space-y-0.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 print:text-slate-900 block">
                TOTAL NET PAYABLE AMOUNT
              </span>
              <span className="text-[10px] italic text-slate-500 dark:text-slate-400 print:text-slate-500 block">
                {salaryRecord.words || amountInWords(salaryRecord.totalSalary)}
              </span>
            </div>
            <div className="text-right flex items-baseline gap-1 sm:self-auto self-end">
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400 print:text-slate-500">Rs</span>
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100 print:text-slate-900 font-headline tracking-tight">
                {salaryRecord.totalSalary.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Document Footer */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 flex justify-between items-center text-[8.5px] text-slate-500 dark:text-slate-400 print:text-slate-500 font-medium">
            <span>{COMPANY_NAME} &bull; Confidential Pay Sheet</span>
            <span className="font-black text-slate-800 dark:text-slate-200 print:text-slate-800 tracking-wider">
              POWERED BY FLASHVISION
            </span>
            <span>Page 1 of 1</span>
          </div>

        </div>
      )}

      {/* Universal Print Preview Modal Integration */}
      {showPrintModal && universalPrintData && (
        <UniversalPrintPreviewModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          documentType="hr_payslip"
          documentData={universalPrintData}
          documentTitle={`Pay Slip - ${salaryRecord?.employeeName || 'Staff'}`}
        />
      )}

    </div>
  );
}
