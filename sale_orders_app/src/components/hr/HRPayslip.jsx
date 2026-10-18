import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';

export default function HRPayslip({ isMobile }) {
  const { state, currencySymbol } = useApp();
  const currSym = currencySymbol || state.adminSetup?.baseCurrency?.match(/\(([^)]+)\)/)?.[1] || 'Rs';

  // Get all generated salaries from state
  const generatedSalaries = useMemo(() => {
    return state.hr_generated_salaries || [];
  }, [state.hr_generated_salaries]);

  // Distinct generated months for period dropdown
  const availableMonths = useMemo(() => {
    const months = [];
    generatedSalaries.forEach(item => {
      if (item && item.month && (item.records || []).length > 0) {
        if (!months.includes(item.month)) {
          months.push(item.month);
        }
      }
    });
    return months.sort().reverse();
  }, [generatedSalaries]);

  // Selected period state
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    return availableMonths[0] || '';
  });

  // Keep period updated if months list changes
  React.useEffect(() => {
    if (availableMonths.length > 0 && (!selectedPeriod || !availableMonths.includes(selectedPeriod))) {
      setSelectedPeriod(availableMonths[0]);
    }
  }, [availableMonths, selectedPeriod]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [selectedSlipForDetail, setSelectedSlipForDetail] = useState(null);

  // Active month salary record
  const currentMonthRecord = useMemo(() => {
    return generatedSalaries.find(s => s.month === selectedPeriod) || null;
  }, [generatedSalaries, selectedPeriod]);

  // Raw records for this month
  const rawRecords = useMemo(() => {
    return currentMonthRecord?.records || [];
  }, [currentMonthRecord]);

  // Available divisions from current month records
  const availableDivisions = useMemo(() => {
    const set = new Set();
    rawRecords.forEach(r => {
      const div = r.division || r.section;
      if (div) set.add(div);
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [rawRecords]);

  // Available departments cascaded by division
  const availableDepartments = useMemo(() => {
    const set = new Set();
    rawRecords.forEach(r => {
      const div = r.division || r.section;
      if (divisionFilter === 'ALL' || div === divisionFilter) {
        if (r.department) set.add(r.department);
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [rawRecords, divisionFilter]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return rawRecords.filter(r => {
      // Division
      if (divisionFilter !== 'ALL') {
        const div = r.division || r.section;
        if (div !== divisionFilter) return false;
      }
      // Department
      if (departmentFilter !== 'ALL') {
        if (r.department !== departmentFilter) return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (r.employeeName || '').toLowerCase().includes(q);
        const matchesId = (r.employeeId || '').toLowerCase().includes(q);
        const matchesDesig = (r.designation || '').toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesDesig) return false;
      }
      return true;
    });
  }, [rawRecords, divisionFilter, departmentFilter, searchQuery]);

  // Summary KPI Totals
  const kpiTotals = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => {
      acc.count += 1;
      acc.basic += Number(curr.basicSalary) || 0;
      acc.overtime += Number(curr.overtime) || 0;
      acc.allowance += Number(curr.allowance) || 0;
      acc.lateDeduction += Number(curr.lateDeduction) || 0;
      acc.absents += Number(curr.absents) || 0;
      acc.fine += Number(curr.fine) || 0;
      acc.loan += Number(curr.loan) || 0;
      acc.advance += Number(curr.advanceAmount) || 0;
      acc.netSalary += Number(curr.netSalary) || 0;
      return acc;
    }, {
      count: 0,
      basic: 0,
      overtime: 0,
      allowance: 0,
      lateDeduction: 0,
      absents: 0,
      fine: 0,
      loan: 0,
      advance: 0,
      netSalary: 0
    });
  }, [filteredRecords]);

  const totalDeductions = kpiTotals.lateDeduction + kpiTotals.absents + kpiTotals.fine + kpiTotals.loan + kpiTotals.advance;
  const totalGross = kpiTotals.basic + kpiTotals.overtime + kpiTotals.allowance;

  // Formatting helpers
  const formatMoney = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatPeriodLabel = (periodKey) => {
    if (!periodKey) return 'N/A';
    const [year, month] = periodKey.split('-');
    if (year && month) {
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      }
    }
    return periodKey;
  };

  const numberToWords = (num) => {
    const n = Math.round(Number(num) || 0);
    if (n === 0) return 'Zero';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    function inWords(val) {
      if (val < 20) return a[val];
      if (val < 100) return b[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + a[val % 10] : '');
      if (val < 1000) return a[Math.floor(val / 100)] + ' Hundred' + (val % 100 !== 0 ? ' and ' + inWords(val % 100) : '');
      if (val < 100000) return inWords(Math.floor(val / 1000)) + ' Thousand' + (val % 1000 !== 0 ? ' ' + inWords(val % 1000) : '');
      if (val < 10000000) return inWords(Math.floor(val / 100000)) + ' Lakh' + (val % 100000 !== 0 ? ' ' + inWords(val % 100000) : '');
      return inWords(Math.floor(val / 10000000)) + ' Crore' + (val % 10000000 !== 0 ? ' ' + inWords(val % 10000000) : '');
    }
    return inWords(n) + ' Only';
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 space-y-6 max-w-full overflow-hidden font-body animate-fade-in select-none">
      
      {/* Top Banner & Title Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">receipt_long</span>
            </div>
            <div>
              <h1 className="font-headline text-xl sm:text-2xl font-black text-on-surface tracking-tight">
                Employee Payslips
              </h1>
              <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                Official Monthly Salary Slips, Disbursal Breakdowns & Print Vouchers
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {filteredRecords.length > 0 && (
            <button
              onClick={() => {
                if (filteredRecords.length > 0) {
                  setSelectedSlipForDetail(filteredRecords[0]);
                  setTimeout(() => window.print(), 300);
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface shadow-xs transition-all cursor-pointer"
              title="Print payslips for this period"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">print</span>
              Print Slips
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          
          {/* Payroll Period Picker */}
          <div className="relative min-w-[210px]">
            <label className="text-[10px] uppercase font-bold text-outline block mb-1">Payroll Period</label>
            <div className="relative">
              <select
                value={selectedPeriod}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value);
                  setDivisionFilter('ALL');
                  setDepartmentFilter('ALL');
                }}
                className="w-full h-10 pl-3 pr-8 text-xs font-bold border border-outline-variant/30 rounded-xl bg-surface-container-low hover:border-primary text-on-surface outline-none cursor-pointer appearance-none"
              >
                {availableMonths.length === 0 ? (
                  <option value="" disabled>No Generated Periods Found</option>
                ) : (
                  availableMonths.map(m => (
                    <option key={m} value={m}>{formatPeriodLabel(m)}</option>
                  ))
                )}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-[18px] text-outline pointer-events-none">calendar_month</span>
            </div>
          </div>

          {/* Division Filter */}
          <div className="relative min-w-[170px]">
            <label className="text-[10px] uppercase font-bold text-outline block mb-1">Division</label>
            <div className="relative">
              <select
                value={divisionFilter}
                onChange={(e) => {
                  setDivisionFilter(e.target.value);
                  setDepartmentFilter('ALL');
                }}
                className="w-full h-10 pl-3 pr-8 text-xs font-bold border border-outline-variant/30 rounded-xl bg-surface-container-low hover:border-primary text-on-surface outline-none cursor-pointer appearance-none"
              >
                {availableDivisions.map(div => (
                  <option key={div} value={div}>{div === 'ALL' ? '🏬 All Divisions' : div}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-[18px] text-outline pointer-events-none">apartment</span>
            </div>
          </div>

          {/* Department Filter */}
          <div className="relative min-w-[170px]">
            <label className="text-[10px] uppercase font-bold text-outline block mb-1">Department</label>
            <div className="relative">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full h-10 pl-3 pr-8 text-xs font-bold border border-outline-variant/30 rounded-xl bg-surface-container-low hover:border-primary text-on-surface outline-none cursor-pointer appearance-none"
              >
                {availableDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept === 'ALL' ? '🏢 All Departments' : dept}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-[18px] text-outline pointer-events-none">domain</span>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <label className="text-[10px] uppercase font-bold text-outline block mb-1">Search Employee</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Name, ID, designation..."
              className="w-full h-10 pl-9 pr-4 text-xs font-medium border border-outline-variant/30 rounded-xl bg-surface-container-low hover:border-primary focus:border-primary text-on-surface outline-none"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-outline block">Total Payslips</span>
          <p className="text-xl sm:text-2xl font-black text-on-surface mt-1 font-headline">
            {kpiTotals.count} Staff
          </p>
          <p className="text-[10px] text-primary font-semibold mt-0.5">{formatPeriodLabel(selectedPeriod)}</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-outline block">Gross Payout</span>
          <p className="text-xl sm:text-2xl font-black text-on-surface mt-1 font-headline">
            {currSym} {formatMoney(totalGross)}
          </p>
          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Basic + OT + Allowances</p>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-outline block">Total Deductions</span>
          <p className="text-xl sm:text-2xl font-black text-rose-600 mt-1 font-headline">
            -{currSym} {formatMoney(totalDeductions)}
          </p>
          <p className="text-[10px] text-rose-500 font-semibold mt-0.5">Late, Absents, Loans, Advance</p>
        </div>

        <div className="bg-gradient-to-br from-primary/10 via-surface-container-lowest to-surface-container-lowest p-5 rounded-2xl border border-primary/20 shadow-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-primary block">Net Disbursal</span>
          <p className="text-xl sm:text-2xl font-black text-primary mt-1 font-headline">
            {currSym} {formatMoney(kpiTotals.netSalary)}
          </p>
          <p className="text-[10px] text-on-surface-variant font-semibold mt-0.5">Final Bank Transfers</p>
        </div>
      </div>

      {/* Main Payslip Cards / Table Area */}
      {availableMonths.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-3xl p-12 text-center border border-outline-variant/20 shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">hourglass_empty</span>
          </div>
          <h3 className="font-headline text-lg font-bold text-on-surface">No Generated Payslips Found</h3>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
            Please navigate to the <b>Salary Generation</b> screen first, compute attendance logs for a payroll month, and click <b>Generate & Finalize Payroll</b> to create verified payslips.
          </p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-3xl p-12 text-center border border-outline-variant/20 shadow-sm space-y-2">
          <span className="material-symbols-outlined text-4xl text-outline">search_off</span>
          <h3 className="font-headline text-base font-bold text-on-surface">No Matching Payslips Found</h3>
          <p className="text-xs text-on-surface-variant">Try adjusting your search query, division, or department filter.</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-outline-variant/15 bg-surface-container-low/40 text-[10px] font-bold uppercase tracking-wider text-outline">
                  <th className="p-4">Emp Code</th>
                  <th className="p-4">Employee Details</th>
                  <th className="p-4">Division & Dept</th>
                  <th className="p-4 text-right">Basic Salary</th>
                  <th className="p-4 text-right">Overtime</th>
                  <th className="p-4 text-right">Allowances</th>
                  <th className="p-4 text-right">Deductions</th>
                  <th className="p-4 text-right font-black text-primary">Net Payout</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filteredRecords.map((r, idx) => {
                  const rDeductions = (Number(r.lateDeduction) || 0) + (Number(r.absents) || 0) + (Number(r.fine) || 0) + (Number(r.loan) || 0) + (Number(r.advanceAmount) || 0);

                  return (
                    <tr key={r.employeeId || idx} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="p-4 font-mono font-bold text-on-surface">{r.employeeId}</td>
                      <td className="p-4">
                        <p className="font-bold text-on-surface text-xs">{r.employeeName}</p>
                        <p className="text-[10px] text-on-surface-variant font-medium">{r.designation || 'Staff'}</p>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-on-surface">{r.division || r.section || 'General'}</span>
                        <p className="text-[10px] text-on-surface-variant font-medium">{r.department || '-'}</p>
                      </td>
                      <td className="p-4 text-right font-mono font-semibold text-on-surface">
                        {currSym} {formatMoney(r.basicSalary)}
                      </td>
                      <td className="p-4 text-right font-mono font-semibold text-secondary">
                        {Number(r.overtime) > 0 ? `+${currSym} ${formatMoney(r.overtime)}` : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-semibold text-emerald-600">
                        {Number(r.allowance) > 0 ? `+${currSym} ${formatMoney(r.allowance)}` : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-semibold text-rose-600">
                        {rDeductions > 0 ? `-${currSym} ${formatMoney(rDeductions)}` : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-black text-primary text-sm">
                        {currSym} {formatMoney(r.netSalary)}
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Finalized
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedSlipForDetail(r)}
                            className="p-1.5 rounded-lg bg-surface-container hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                            title="View Full Salary Voucher"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSlipForDetail(r);
                              setTimeout(() => window.print(), 300);
                            }}
                            className="p-1.5 rounded-lg bg-surface-container hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                            title="Print Voucher"
                          >
                            <span className="material-symbols-outlined text-[16px]">print</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Printable Payslip Voucher Modal */}
      {selectedSlipForDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-surface-container-lowest max-w-2xl w-full rounded-3xl border border-outline-variant/30 shadow-2xl overflow-hidden animate-scale-up text-on-surface my-8">
            
            {/* Modal Bar */}
            <div className="p-4 border-b border-outline-variant/15 flex justify-between items-center bg-surface-container-low/40 no-print">
              <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                Verified Monthly Salary Voucher
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSlip}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  Print Payslip
                </button>
                <button
                  onClick={() => setSelectedSlipForDetail(null)}
                  className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Printable Voucher Paper */}
            <div id="printable-payslip" className="p-8 space-y-6 bg-white text-slate-900 font-sans print:p-0">
              
              {/* Header Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 font-headline uppercase">
                    FLASHVISION ENTERPRISE
                  </h2>
                  <p className="text-xs font-bold text-slate-600 mt-0.5">
                    AJ Synthetic Operational Wing • Human Resources Division
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Industrial Estate, Plot 14-B • Flashvision ERP Automated Ledger
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-slate-100 border border-slate-300 rounded text-[10px] font-black tracking-wider uppercase inline-block">
                    CONFIDENTIAL PAYSLIP
                  </span>
                  <p className="text-xs font-bold text-slate-800 mt-2 font-mono">
                    Period: {formatPeriodLabel(selectedPeriod)}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500">
                    Slip No: SLP-{selectedSlipForDetail.employeeId}-{selectedPeriod}
                  </p>
                </div>
              </div>

              {/* Employee Particulars Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Employee Code</span>
                  <span className="font-mono font-bold text-slate-900">{selectedSlipForDetail.employeeId}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Employee Name</span>
                  <span className="font-bold text-slate-900">{selectedSlipForDetail.employeeName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Designation</span>
                  <span className="font-semibold text-slate-800">{selectedSlipForDetail.designation || 'Staff'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Division</span>
                  <span className="font-bold text-indigo-700">{selectedSlipForDetail.division || selectedSlipForDetail.section || 'AJ Synthetic'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Department</span>
                  <span className="font-semibold text-slate-800">{selectedSlipForDetail.department || 'Operations'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Join Date</span>
                  <span className="font-mono text-slate-700">{selectedSlipForDetail.doj || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Payment Mode</span>
                  <span className="font-bold text-emerald-700">Bank Transfer</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Disbursal Status</span>
                  <span className="font-bold text-emerald-700">Finalized & Approved</span>
                </div>
              </div>

              {/* Attendance Log Particulars */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-around text-center text-xs">
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-500 block">Worked Days</span>
                  <span className="font-mono font-bold text-emerald-700">{selectedSlipForDetail.workedDays || (26 - (Number(selectedSlipForDetail.absentsCount) || 0))} Days</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-500 block">Absents</span>
                  <span className="font-mono font-bold text-rose-700">{selectedSlipForDetail.absentsCount || 0} Days</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-500 block">Overtime Hours</span>
                  <span className="font-mono font-bold text-blue-700">{selectedSlipForDetail.otHours || 0} Hours</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold uppercase text-slate-500 block">Late Coming</span>
                  <span className="font-mono font-bold text-purple-700">{selectedSlipForDetail.lateComingHours || 0} Hours</span>
                </div>
              </div>

              {/* Financial Earnings vs Deductions Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Earnings Column */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-emerald-50 px-3.5 py-2 border-b border-slate-200 font-bold text-xs text-emerald-900 flex justify-between">
                    <span>EARNING HEADS</span>
                    <span>AMOUNT ({currSym})</span>
                  </div>
                  <div className="p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Basic Monthly Salary</span>
                      <span className="font-mono font-bold">{formatMoney(selectedSlipForDetail.basicSalary)}</span>
                    </div>
                    {Number(selectedSlipForDetail.overtime) > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Overtime ({selectedSlipForDetail.otHours}h)</span>
                        <span className="font-mono font-bold">+{formatMoney(selectedSlipForDetail.overtime)}</span>
                      </div>
                    )}
                    {Number(selectedSlipForDetail.allowance) > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Standard Allowance</span>
                        <span className="font-mono font-bold">+{formatMoney(selectedSlipForDetail.allowance)}</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-slate-50 px-3.5 py-2 border-t border-slate-200 font-bold text-xs flex justify-between">
                    <span>Total Gross Earnings</span>
                    <span className="font-mono text-emerald-800">
                      {currSym} {formatMoney((Number(selectedSlipForDetail.basicSalary) || 0) + (Number(selectedSlipForDetail.overtime) || 0) + (Number(selectedSlipForDetail.allowance) || 0))}
                    </span>
                  </div>
                </div>

                {/* Deductions Column */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-rose-50 px-3.5 py-2 border-b border-slate-200 font-bold text-xs text-rose-900 flex justify-between">
                    <span>DEDUCTION HEADS</span>
                    <span>AMOUNT ({currSym})</span>
                  </div>
                  <div className="p-3.5 space-y-2 text-xs">
                    {Number(selectedSlipForDetail.lateDeduction) > 0 ? (
                      <div className="flex justify-between text-rose-700">
                        <span>Late Deduction ({selectedSlipForDetail.lateComingHours}h)</span>
                        <span className="font-mono font-bold">-{formatMoney(selectedSlipForDetail.lateDeduction)}</span>
                      </div>
                    ) : null}
                    {Number(selectedSlipForDetail.absents) > 0 ? (
                      <div className="flex justify-between text-rose-700">
                        <span>Absent Penalty ({selectedSlipForDetail.absentsCount}d)</span>
                        <span className="font-mono font-bold">-{formatMoney(selectedSlipForDetail.absents)}</span>
                      </div>
                    ) : null}
                    {Number(selectedSlipForDetail.fine) > 0 ? (
                      <div className="flex justify-between text-rose-700">
                        <span>Late / Disciplinary Fine</span>
                        <span className="font-mono font-bold">-{formatMoney(selectedSlipForDetail.fine)}</span>
                      </div>
                    ) : null}
                    {Number(selectedSlipForDetail.loan) > 0 ? (
                      <div className="flex justify-between text-purple-700">
                        <span>Loan Installment Recovery</span>
                        <span className="font-mono font-bold">-{formatMoney(selectedSlipForDetail.loan)}</span>
                      </div>
                    ) : null}
                    {Number(selectedSlipForDetail.advanceAmount) > 0 ? (
                      <div className="flex justify-between text-purple-700">
                        <span>Salary Advance Recovery</span>
                        <span className="font-mono font-bold">-{formatMoney(selectedSlipForDetail.advanceAmount)}</span>
                      </div>
                    ) : null}

                    {!(Number(selectedSlipForDetail.lateDeduction) > 0 || Number(selectedSlipForDetail.absents) > 0 || Number(selectedSlipForDetail.fine) > 0 || Number(selectedSlipForDetail.loan) > 0 || Number(selectedSlipForDetail.advanceAmount) > 0) && (
                      <div className="text-slate-400 italic text-center py-4">No deductions recorded</div>
                    )}
                  </div>
                  <div className="bg-slate-50 px-3.5 py-2 border-t border-slate-200 font-bold text-xs flex justify-between">
                    <span>Total Deductions</span>
                    <span className="font-mono text-rose-700">
                      -{currSym} {formatMoney((Number(selectedSlipForDetail.lateDeduction) || 0) + (Number(selectedSlipForDetail.absents) || 0) + (Number(selectedSlipForDetail.fine) || 0) + (Number(selectedSlipForDetail.loan) || 0) + (Number(selectedSlipForDetail.advanceAmount) || 0))}
                    </span>
                  </div>
                </div>

              </div>

              {/* Net Payable Highlight Banner */}
              <div className="p-4 bg-slate-900 text-white rounded-xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">NET PAYABLE AMOUNT</span>
                  <p className="text-xs italic text-slate-300 mt-0.5 font-medium">
                    {numberToWords(selectedSlipForDetail.netSalary)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono tracking-tight text-emerald-400">
                    {currSym} {formatMoney(selectedSlipForDetail.netSalary)}
                  </span>
                </div>
              </div>

              {/* Signatures Area */}
              <div className="pt-8 grid grid-cols-3 gap-6 text-center text-[10px] font-bold text-slate-600 border-t border-slate-200">
                <div>
                  <div className="border-b border-slate-300 pb-1 mb-1 font-mono text-[9px] text-slate-400">System Verified</div>
                  Prepared By (HR Department)
                </div>
                <div>
                  <div className="border-b border-slate-300 pb-1 mb-1 font-mono text-[9px] text-slate-400">Accounts Audited</div>
                  Checked By (Finance Lead)
                </div>
                <div>
                  <div className="border-b border-slate-300 pb-1 mb-1">&nbsp;</div>
                  Employee Acknowledgment Signature
                </div>
              </div>

              {/* Computerized Watermark */}
              <p className="text-[9px] text-center text-slate-400 font-mono pt-2">
                This is a computer-generated salary voucher produced by Flashvision ERP. No physical stamp required.
              </p>

            </div>

          </div>
        </div>
      )}

      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-payslip, #printable-payslip * {
            visibility: visible;
          }
          #printable-payslip {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
