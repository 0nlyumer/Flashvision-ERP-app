import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';

// Defensive number helpers to guarantee 0 crashes
const safeNum = (val) => {
  if (val === null || val === undefined) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

const safeMoney = (val, decimals = 2) => {
  const n = safeNum(val);
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export default function HRSalaryGeneration({ isMobile }) {
  const { state, setCollection, currencySymbol } = useApp();
  const currSym = currencySymbol || 'Rs.';

  // Selected payroll month
  const getCurrentPeriodKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const [payrollPeriod, setPayrollPeriod] = useState(getCurrentPeriodKey);
  
  // Selected departments multi-select state
  const [selectedDepartments, setSelectedDepartments] = useState(['ALL']);
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef(null);

  // UI States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState(null);
  
  // Column options / 3-dot menu popover state
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const columnPickerRef = useRef(null);

  // Local active payroll calculation list (before saving)
  const [localPayrollList, setLocalPayrollList] = useState([]);
  const [payrollStatus, setPayrollStatus] = useState('none'); // 'none' | 'calculated' | 'finalized'
  const [statusFilter, setStatusFilter] = useState('All Records');

  // Resizing state
  const [resizingColId, setResizingColId] = useState(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Dragging state for column reorder
  const [draggedColId, setDraggedColId] = useState(null);

  // Default Columns Definition
  const DEFAULT_COLUMNS = [
    { id: 'employeeId', label: 'Employee ID', visible: true, width: 110, align: 'left', numeric: false },
    { id: 'doj', label: 'Date of Joining', visible: true, width: 120, align: 'left', numeric: false },
    { id: 'designation', label: 'Designation', visible: true, width: 140, align: 'left', numeric: false },
    { id: 'department', label: 'Department', visible: true, width: 140, align: 'left', numeric: false },
    { id: 'section', label: 'Section', visible: true, width: 110, align: 'left', numeric: false },
    { id: 'employeeName', label: 'Employee Name', visible: true, width: 160, align: 'left', numeric: false },
    { id: 'basicSalary', label: `Basic Salary (${currSym})`, visible: true, width: 120, align: 'right', numeric: true },
    { id: 'overtime', label: `Overtime (${currSym})`, visible: true, width: 110, align: 'right', numeric: true },
    { id: 'lateComingHours', label: 'Late Deduction (Hrs)', visible: true, width: 150, align: 'right', numeric: true },
    { id: 'absents', label: `Absents (${currSym})`, visible: true, width: 110, align: 'right', numeric: true },
    { id: 'fine', label: `Fine (${currSym})`, visible: true, width: 90, align: 'right', numeric: true },
    { id: 'allowance', label: `Allowance (${currSym})`, visible: true, width: 110, align: 'right', numeric: true },
    { id: 'advanceAmount', label: `Advance Amount (${currSym})`, visible: true, width: 140, align: 'right', numeric: true },
    { id: 'loan', label: `Loan (${currSym})`, visible: true, width: 100, align: 'right', numeric: true },
    { id: 'netSalary', label: `Net Salary (${currSym})`, visible: true, width: 130, align: 'right', numeric: true }
  ];

  // Column Configuration State with Persistence
  const [columns, setColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('hr_salary_table_columns_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return DEFAULT_COLUMNS.map(def => {
            const found = parsed.find(p => p.id === def.id);
            return found ? { ...def, ...found } : def;
          });
        }
      }
    } catch (e) {}
    return DEFAULT_COLUMNS;
  });

  // Save Column Configurations on change
  useEffect(() => {
    const generatedList = state.hr_generated_salaries || [];
    const existingPeriodRecord = generatedList.find(record => record.month === payrollPeriod);

    if (existingPeriodRecord && Array.isArray(existingPeriodRecord.records) && existingPeriodRecord.status === 'Finalized') {
      setLocalPayrollList(existingPeriodRecord.records);
      setPayrollStatus('finalized');
    } else {
      // Real-time automatic calculation directly from Attendance Management
      const computed = computePayrollForPeriod(payrollPeriod);
      setLocalPayrollList(computed);
      setPayrollStatus('calculated');
    }
  }, [payrollPeriod, state.hr_generated_salaries, state.hr_employees_list, state.hr_uploaded_attendance, state.hr_overtime_requests, state.hr_loan_requests, state.hr_loan_ledger]);

  // Handle Multi-Department Checkbox Selection
  const toggleDepartment = (deptName) => {
    if (deptName === 'ALL') {
      if (selectedDepartments.includes('ALL')) {
        setSelectedDepartments([]);
      } else {
        setSelectedDepartments(['ALL']);
      }
      return;
    }

    setSelectedDepartments(prev => {
      let next = prev.filter(d => d !== 'ALL');
      if (next.includes(deptName)) {
        next = next.filter(d => d !== deptName);
      } else {
        next.push(deptName);
      }
      if (next.length === availableDepartments.length || next.length === 0) {
        return ['ALL'];
      }
      return next;
    });
  };

  // Dynamic REAL Data Salary Calculation Engine EXACTLY synced with Attendance Management
  const runCalculationEngine = () => {
    setIsProcessing(true);
    setProcessingMessage('Fetching saved Attendance Management records, approved overtime claims, and employee profiles...');
    
    setTimeout(() => {
      const allEmployees = state.hr_employees_list || [];
      const attendanceLogs = state.hr_uploaded_attendance || [];
      const overtimeRequests = state.hr_overtime_requests || [];
      const loanRequests = state.hr_loan_requests || [];

      // Filter employees by selected departments
      const filteredEmployees = allEmployees.filter(emp => {
        if (selectedDepartments.includes('ALL')) return true;
        const empDept = emp.department || 'Global Logistics';
        return selectedDepartments.includes(empDept);
      });

      const calculatedRecords = filteredEmployees.map(emp => {
        const baseSalary = safeNum(emp.basicSalary || emp.salary || emp.baseSalary || 35000);
        const doj = emp.doj || emp.dateOfJoining || emp.createdAt?.substring(0, 10) || '2024-01-15';
        const designation = emp.designation || emp.jobTitle || emp.role || 'Associate';
        const department = emp.department || 'Global Logistics';
        const section = emp.section || emp.subSection || emp.departmentSection || 'Operations';

        // REAL Attendance Processing from Attendance Management screen saved data
        let workedDays = 0;
        let absentsCount = 0;
        let lateComingHours = 0;
        let totalFines = 0;
        let otHours = 0;

        // Match saved attendance logs for employee in Attendance Management
        const empAttendanceLogs = attendanceLogs.filter(a => 
          (String(a.employeeId) === String(emp.id) || a.employeeName === emp.name || (a.id && String(a.id) === String(emp.id))) && 
          (a.date && a.date.startsWith(payrollPeriod))
        );

        let hasExplicitAttendanceLogs = false;

        if (empAttendanceLogs.length > 0) {
          hasExplicitAttendanceLogs = true;
          empAttendanceLogs.forEach(a => {
            const st = (a.status || '').toLowerCase();
            if (st === 'present') workedDays += 1;
            else if (st === 'absent') absentsCount += 1;
            lateComingHours += safeNum(a.deductions || a.lateHours || a.lateComingHours);
            totalFines += safeNum(a.fines || a.fine);
            otHours += safeNum(a.ot || a.overtimeHours);
          });
        } else if (emp.attendance) {
          // Embedded attendance object saved from Attendance Management
          Object.entries(emp.attendance).forEach(([dayKey, rec]) => {
            if (dayKey.startsWith(payrollPeriod)) {
              hasExplicitAttendanceLogs = true;
              const st = (rec.status || '').toLowerCase();
              if (st === 'present') workedDays += 1;
              else if (st === 'absent') absentsCount += 1;
              lateComingHours += safeNum(rec.deductions || rec.lateHours);
              totalFines += safeNum(rec.fines || rec.fine);
              otHours += safeNum(rec.ot || rec.overtime);
            }
          });
        }

        workedDays = Math.round(workedDays);
        absentsCount = Math.round(absentsCount);
        const totalWorkingDays = 22; // Standard monthly working days

        // EXACT Attendance Rule: If employee has 0 present logs or default absent in Attendance Management, workedDays = 0, absentsCount = 22!
        if (hasExplicitAttendanceLogs) {
          if (absentsCount === 0 && workedDays < totalWorkingDays) {
            absentsCount = totalWorkingDays - workedDays;
          }
        } else {
          // By default in Attendance Management, if all entries are absent or empty for this month:
          workedDays = 0;
          absentsCount = totalWorkingDays;
        }
        absentsCount = Math.max(0, absentsCount);

        // Approved Overtime Requests
        const empOtReqs = overtimeRequests.filter(req => 
          (req.employeeName === emp.name || String(req.employeeId) === String(emp.id)) &&
          (req.status === 'Approved') &&
          (req.date && req.date.startsWith(payrollPeriod))
        );
        empOtReqs.forEach(r => {
          otHours += safeNum(r.hours);
        });

        // Load Salary & Allowance Configuration rules
        let salaryConfig = null;
        try {
          const savedConfig = localStorage.getItem('hr_salary_allowance_config');
          if (savedConfig) salaryConfig = JSON.parse(savedConfig);
        } catch (e) {}

        const otMultiplier = safeNum(salaryConfig?.overtimeMultipliers?.weekday || 1.5);
        
        // Financial Calculations
        const hourlyRate = baseSalary / 176; // 8 hrs * 22 days
        const otPay = otHours * (hourlyRate * otMultiplier);
        const absentDeduction = absentsCount * (baseSalary / totalWorkingDays);
        const lateDeduction = lateComingHours * hourlyRate;

        // Approved Loan Ledger & Requests sync
        let loanAmount = safeNum(emp.loan || emp.loanAmount);
        const loanLedger = state.hr_loan_ledger || [];
        const activeLedgerItem = loanLedger.find(l => 
          (String(l.employeeId) === String(emp.id) || l.employeeName === emp.name) && 
          l.status === 'Active' && 
          safeNum(l.remainingBalance) > 0
        );
        if (activeLedgerItem && activeLedgerItem.monthlyInstallment) {
          loanAmount = Math.min(safeNum(activeLedgerItem.monthlyInstallment), safeNum(activeLedgerItem.remainingBalance));
        } else {
          const activeLoanReq = loanRequests.find(r => 
            (String(r.employeeId) === String(emp.id) || r.employeeName === emp.name) && r.status === 'Approved'
          );
          if (activeLoanReq && activeLoanReq.monthlyInstallment) {
            loanAmount = safeNum(activeLoanReq.monthlyInstallment);
          }
        }

        // Attendance Allowance Calculation: ALLOWANCE IS ONLY GRANTED IF ABSENTS COUNT IS EXACTLY 0!
        let allowanceAmount = 0;
        if (absentsCount === 0) {
          const configuredBonus = salaryConfig?.attendanceAllowance?.bonusAmount !== undefined 
            ? safeNum(salaryConfig.attendanceAllowance.bonusAmount) 
            : 150;
          allowanceAmount = configuredBonus;
        } else {
          allowanceAmount = 0;
        }

        const advanceAmount = safeNum(emp.advance || emp.advanceAmount);

        const totalAdditions = otPay + allowanceAmount;
        const totalDeductions = absentDeduction + lateDeduction + totalFines + advanceAmount + loanAmount;
        const netSalary = Math.max(0, baseSalary + totalAdditions - totalDeductions);

        return {
          employeeId: emp.id || `EMP-${Date.now()}`,
          doj: doj,
          designation: designation,
          department: department,
          section: section,
          employeeName: emp.name,
          basicSalary: parseFloat(baseSalary.toFixed(2)),
          overtime: parseFloat(otPay.toFixed(2)),
          otHours: parseFloat(otHours.toFixed(1)),
          lateComingHours: parseFloat(lateComingHours.toFixed(1)),
          lateDeduction: parseFloat(lateDeduction.toFixed(2)),
          absents: parseFloat(absentDeduction.toFixed(2)),
          absentsCount: absentsCount,
          fine: parseFloat(totalFines.toFixed(2)),
          allowance: parseFloat(allowanceAmount.toFixed(2)),
          advanceAmount: parseFloat(advanceAmount.toFixed(2)),
          loan: parseFloat(loanAmount.toFixed(2)),
          netSalary: parseFloat(netSalary.toFixed(2)),
          status: 'Calculated'
        };
      });

      setLocalPayrollList(calculatedRecords);
      setPayrollStatus('calculated');
      
      // Update global context state
      const generatedList = state.hr_generated_salaries || [];
      const filterOtherMonths = generatedList.filter(record => record.month !== payrollPeriod);
      
      const newMonthRecord = {
        month: payrollPeriod,
        status: 'Calculated',
        generatedAt: new Date().toISOString(),
        generatedBy: state.currentUser?.name || 'Administrator',
        records: calculatedRecords
      };

      setCollection('hr_generated_salaries', [...filterOtherMonths, newMonthRecord]);
      setIsProcessing(false);
      triggerToast(`Calculated payroll for ${calculatedRecords.length} employees based on Attendance Management logs!`);
    }, 1200);
  };

  // Finalize payroll handler
  const handleFinalizePayroll = () => {
    if (localPayrollList.length === 0) return;

    setIsProcessing(true);
    setProcessingMessage('Locking calculated entries and finalizing payroll account mappings...');

    setTimeout(() => {
      const finalizedRecords = localPayrollList.map(rec => ({
        ...rec,
        status: 'Finalized'
      }));

      setLocalPayrollList(finalizedRecords);
      setPayrollStatus('finalized');

      // Update global context state
      const generatedList = state.hr_generated_salaries || [];
      const filterOtherMonths = generatedList.filter(record => record.month !== payrollPeriod);
      
      const finalizedMonthRecord = {
        month: payrollPeriod,
        status: 'Finalized',
        generatedAt: new Date().toISOString(),
        generatedBy: state.currentUser?.name || 'Administrator',
        records: finalizedRecords
      };

      setCollection('hr_generated_salaries', [...filterOtherMonths, finalizedMonthRecord]);
      setIsProcessing(false);
      triggerToast(`Payroll for ${getPeriodLabel(payrollPeriod)} has been finalized!`);
    }, 1200);
  };

  // Helper toast alert
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  // Calculate Summary Totals for Header Cards with safe numerical reduction
  const summaryTotals = React.useMemo(() => {
    return {
      netPayout: localPayrollList.reduce((acc, curr) => acc + safeNum(curr.netSalary), 0),
      headcount: localPayrollList.length,
      overtime: localPayrollList.reduce((acc, curr) => acc + safeNum(curr.overtime), 0),
      deductions: localPayrollList.reduce((acc, curr) => acc + safeNum(curr.lateDeduction) + safeNum(curr.absents) + safeNum(curr.fine) + safeNum(curr.loan) + safeNum(curr.advanceAmount), 0)
    };
  }, [localPayrollList]);

  // Calculate Table Footer Totals with safe numerical reduction
  const footerTotals = React.useMemo(() => {
    return {
      basicSalary: localPayrollList.reduce((sum, r) => sum + safeNum(r.basicSalary), 0),
      overtime: localPayrollList.reduce((sum, r) => sum + safeNum(r.overtime), 0),
      lateComingHours: localPayrollList.reduce((sum, r) => sum + safeNum(r.lateComingHours), 0),
      lateDeduction: localPayrollList.reduce((sum, r) => sum + safeNum(r.lateDeduction), 0),
      absents: localPayrollList.reduce((sum, r) => sum + safeNum(r.absents), 0),
      fine: localPayrollList.reduce((sum, r) => sum + safeNum(r.fine), 0),
      allowance: localPayrollList.reduce((sum, r) => sum + safeNum(r.allowance), 0),
      advanceAmount: localPayrollList.reduce((sum, r) => sum + safeNum(r.advanceAmount), 0),
      loan: localPayrollList.reduce((sum, r) => sum + safeNum(r.loan), 0),
      netSalary: localPayrollList.reduce((sum, r) => sum + safeNum(r.netSalary), 0)
    };
  }, [localPayrollList]);

  // Filter list by status
  const filteredList = localPayrollList.filter(item => {
    if (statusFilter === 'All Records') return true;
    if (statusFilter === 'Calculated') return item.status === 'Calculated';
    if (statusFilter === 'Finalized') return item.status === 'Finalized';
    return true;
  });

  // Toggle Column Visibility from 3-dot popover
  const toggleColumnVisibility = (colId) => {
    setColumns(prev => 
      prev.map(c => c.id === colId ? { ...c, visible: !c.visible } : c)
    );
  };

  // Column Drag and Drop Reordering Handlers
  const handleDragStart = (e, colId) => {
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetColId) return;

    setColumns(prevCols => {
      const draggedIdx = prevCols.findIndex(c => c.id === draggedColId);
      const targetIdx = prevCols.findIndex(c => c.id === targetColId);
      if (draggedIdx === -1 || targetIdx === -1) return prevCols;

      const newCols = [...prevCols];
      const [removed] = newCols.splice(draggedIdx, 1);
      newCols.splice(targetIdx, 0, removed);
      return newCols;
    });
    setDraggedColId(null);
  };

  // Helper to render dynamic cell content with 100% safe Formatting
  const renderCellContent = (colId, record) => {
    switch (colId) {
      case 'employeeId':
        return <span className="font-mono text-xs font-bold text-on-surface">{record.employeeId}</span>;
      case 'doj':
        return <span className="text-xs text-on-surface-variant font-medium">{record.doj}</span>;
      case 'designation':
        return <span className="text-xs font-semibold text-on-surface-variant">{record.designation}</span>;
      case 'department':
        return <span className="text-xs font-bold text-primary">{record.department}</span>;
      case 'section':
        return <span className="text-xs text-on-surface-variant">{record.section}</span>;
      case 'employeeName':
        return <span className="text-sm font-bold text-on-surface">{record.employeeName}</span>;
      case 'basicSalary':
        return <span className="text-xs font-bold text-on-surface">{currSym} {safeMoney(record.basicSalary)}</span>;
      case 'overtime':
        const otVal = safeNum(record.overtime);
        const otH = safeNum(record.otHours);
        return (
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-secondary">{currSym} {safeMoney(otVal)}</span>
            {otH > 0 && <span className="text-[10px] text-on-surface-variant">{otH} hrs</span>}
          </div>
        );
      case 'lateComingHours':
        const lDed = safeNum(record.lateDeduction);
        const lHrs = safeNum(record.lateComingHours);
        return (
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-error">-{currSym} {safeMoney(lDed)}</span>
            {lHrs > 0 && <span className="text-[10px] text-on-surface-variant">{lHrs} hrs late</span>}
          </div>
        );
      case 'absents':
        const absDed = safeNum(record.absents);
        const absCnt = safeNum(record.absentsCount);
        return (
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-error">-{currSym} {safeMoney(absDed)}</span>
            {absCnt > 0 && <span className="text-[10px] text-on-surface-variant">{absCnt} days</span>}
          </div>
        );
      case 'fine':
        const fn = safeNum(record.fine);
        return <span className={`text-xs font-bold ${fn > 0 ? 'text-error' : 'text-on-surface-variant'}`}>{currSym} {safeMoney(fn)}</span>;
      case 'allowance':
        const al = safeNum(record.allowance);
        return <span className={`text-xs font-bold ${al > 0 ? 'text-green-600' : 'text-on-surface-variant'}`}>+{currSym} {safeMoney(al)}</span>;
      case 'advanceAmount':
        const adv = safeNum(record.advanceAmount);
        return <span className={`text-xs font-bold ${adv > 0 ? 'text-purple-600' : 'text-on-surface-variant'}`}>-{currSym} {safeMoney(adv)}</span>;
      case 'loan':
        const ln = safeNum(record.loan);
        return <span className={`text-xs font-bold ${ln > 0 ? 'text-purple-600' : 'text-on-surface-variant'}`}>-{currSym} {safeMoney(ln)}</span>;
      case 'netSalary':
        return <span className="text-sm font-black text-primary">{currSym} {safeMoney(record.netSalary)}</span>;
      default:
        return null;
    }
  };

  // Helper to render footer total cell with 100% safe Formatting
  const renderFooterTotalCell = (colId) => {
    switch (colId) {
      case 'employeeId':
        return <span className="font-bold text-xs text-on-surface">TOTALS</span>;
      case 'basicSalary':
        return <span className="font-bold text-xs text-on-surface">{currSym} {safeMoney(footerTotals.basicSalary)}</span>;
      case 'overtime':
        return <span className="font-bold text-xs text-secondary">{currSym} {safeMoney(footerTotals.overtime)}</span>;
      case 'lateComingHours':
        return <span className="font-bold text-xs text-error">-{currSym} {safeMoney(footerTotals.lateDeduction)}</span>;
      case 'absents':
        return <span className="font-bold text-xs text-error">-{currSym} {safeMoney(footerTotals.absents)}</span>;
      case 'fine':
        return <span className="font-bold text-xs text-error">-{currSym} {safeMoney(footerTotals.fine)}</span>;
      case 'allowance':
        return <span className="font-bold text-xs text-green-600">+{currSym} {safeMoney(footerTotals.allowance)}</span>;
      case 'advanceAmount':
        return <span className="font-bold text-xs text-purple-600">-{currSym} {safeMoney(footerTotals.advanceAmount)}</span>;
      case 'loan':
        return <span className="font-bold text-xs text-purple-600">-{currSym} {safeMoney(footerTotals.loan)}</span>;
      case 'netSalary':
        return <span className="font-black text-sm text-primary">{currSym} {safeMoney(footerTotals.netSalary)}</span>;
      default:
        return null;
    }
  };

  const visibleColumns = columns.filter(c => c.visible);

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 font-sans">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-green-500 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-6 duration-300 font-semibold font-manrope">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Processing Loader */}
      {isProcessing && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center space-y-5 border border-outline-variant">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 border-4 border-primary/10 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div className="space-y-2">
              <h5 className="text-lg font-bold text-on-surface font-headline">Processing Payroll</h5>
              <p className="text-xs text-on-surface-variant leading-relaxed">{processingMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header, Period Picker & Multi-Department Filter */}
      <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          {/* Payroll Period */}
          <div className="space-y-2 min-w-[200px]">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Payroll Period</label>
            <div className="relative w-full">
              <select 
                value={payrollPeriod}
                onChange={(e) => setPayrollPeriod(e.target.value)}
                className="w-full h-11 pl-4 pr-10 text-sm border border-outline-variant rounded-xl bg-surface-container-lowest hover:border-primary transition-colors focus:border-primary focus:ring-4 focus:ring-primary/10 appearance-none cursor-pointer font-medium text-on-surface"
              >
                {monthsList.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-outline">calendar_month</span>
            </div>
          </div>

          {/* Division Dropdown */}
          <div className="space-y-2 min-w-[200px]">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Division Filter</label>
            <div className="relative w-full">
              <select 
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                className="w-full h-11 pl-4 pr-10 text-sm border border-outline-variant rounded-xl bg-surface-container-lowest hover:border-primary transition-colors focus:border-primary focus:ring-4 focus:ring-primary/10 appearance-none cursor-pointer font-medium text-on-surface"
              >
                {availableDivisions.map(div => (
                  <option key={div} value={div}>
                    {div === 'ALL' ? '🏬 All Divisions' : div}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-outline">apartment</span>
            </div>
          </div>

          {/* Multi-Department Checkbox Dropdown */}
          <div className="space-y-2 relative min-w-[240px]" ref={deptDropdownRef}>
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Department Filter</label>
            
            <button 
              type="button"
              onClick={() => setIsDeptDropdownOpen(prev => !prev)}
              className="w-full h-11 px-4 text-sm border border-outline-variant rounded-xl bg-surface-container-lowest hover:border-primary transition-all flex items-center justify-between cursor-pointer font-medium text-on-surface shadow-xs active:scale-[0.99]"
            >
              <span className="truncate pr-2">
                {selectedDepartments.includes('ALL') 
                  ? 'All Departments' 
                  : `${selectedDepartments.length} Dept${selectedDepartments.length > 1 ? 's' : ''} Selected`}
              </span>
              <span className="material-symbols-outlined text-outline">arrow_drop_down</span>
            </button>

            {/* Department Dropdown Popover */}
            {isDeptDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-2xl z-[150] p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                  <span className="text-xs font-bold text-on-surface">Select Departments</span>
                  <button 
                    onClick={() => toggleDepartment('ALL')} 
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    {selectedDepartments.includes('ALL') ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                  {availableDepartments.map(dept => (
                    <label 
                      key={dept} 
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-primary/5 cursor-pointer text-xs font-semibold text-on-surface transition-colors"
                    >
                      <input 
                        type="checkbox"
                        checked={selectedDepartments.includes('ALL') || selectedDepartments.includes(dept)}
                        onChange={() => toggleDepartment(dept)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                      />
                      <span className="truncate">{dept}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <button 
            onClick={runCalculationEngine}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-primary text-on-primary px-6 h-11 rounded-xl shadow-sm hover:bg-primary-container active:scale-[0.98] transition-all text-xs font-bold cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">sync_alt</span>
            Fetch Data & Calculate
          </button>
          <button 
            onClick={() => triggerToast('Payroll report compiled and exported!')}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 border border-outline-variant text-on-surface-variant px-6 h-11 rounded-xl hover:bg-surface-container-low transition-all text-xs font-bold cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Report
          </button>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Net Payout */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="p-2 bg-primary/5 text-primary rounded-xl material-symbols-outlined text-[20px]">account_balance_wallet</span>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Net Payout</span>
          </div>
          <p className="text-2xl font-black text-primary tracking-tight font-headline">
            {currSym} {safeMoney(summaryTotals.netPayout)}
          </p>
          <p className="text-[10px] text-green-600 font-bold mt-1.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">trending_up</span> Real-time calculated
          </p>
        </div>

        {/* Headcount */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="p-2 bg-surface-container-high text-on-surface-variant rounded-xl material-symbols-outlined text-[20px]">badge</span>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Headcount</span>
          </div>
          <p className="text-2xl font-black text-on-surface tracking-tight font-headline">
            {summaryTotals.headcount}
          </p>
          <p className="text-[10px] text-on-surface-variant mt-1.5">Active employees in selection</p>
        </div>

        {/* Overtime */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="p-2 bg-secondary/5 text-secondary rounded-xl material-symbols-outlined text-[20px]">schedule</span>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Overtime</span>
          </div>
          <p className="text-2xl font-black text-secondary tracking-tight font-headline">
            {currSym} {safeMoney(summaryTotals.overtime)}
          </p>
          <p className="text-[10px] text-secondary font-bold mt-1.5">Approved OT claims</p>
        </div>

        {/* Deductions */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="p-2 bg-error/5 text-error rounded-xl material-symbols-outlined text-[20px]">money_off</span>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Deductions</span>
          </div>
          <p className="text-2xl font-black text-error tracking-tight font-headline">
            {currSym} {safeMoney(summaryTotals.deductions)}
          </p>
          <p className="text-[10px] text-error font-bold mt-1.5">Late, absents, fines & advances</p>
        </div>

      </section>

      {/* Payroll Processing Table Section */}
      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden flex flex-col">
        
        {/* Table Header Filter & Column Settings 3-Dot Button */}
        <div className="p-5 border-b border-outline-variant/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-lowest">
          <div className="space-y-1">
            <h4 className="text-lg font-bold text-on-surface font-headline">Payroll Detail View</h4>
            <p className="text-xs text-on-surface-variant">Detailed breakdown of calculated employee earnings for {getPeriodLabel(payrollPeriod)}.</p>
          </div>
          
          <div className="flex items-center gap-3 self-stretch sm:self-auto justify-end">
            {/* Status Filter */}
            <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/10">
              <span className="text-xs font-semibold text-on-surface-variant">Status:</span>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-bold bg-transparent border-none focus:ring-0 cursor-pointer text-primary p-0 h-auto"
              >
                <option>All Records</option>
                <option>Calculated</option>
                <option>Finalized</option>
              </select>
            </div>

            {/* 3-Dot Column Picker Options Button */}
            <div className="relative" ref={columnPickerRef}>
              <button 
                type="button"
                onClick={() => setIsColumnPickerOpen(prev => !prev)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/20 text-on-surface-variant transition-colors cursor-pointer"
                title="Column Customization Settings"
              >
                <span className="material-symbols-outlined text-[20px]">more_vert</span>
              </button>

              {/* Column Options Popover */}
              {isColumnPickerOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-2xl z-[150] p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-outline-variant/10 pb-2">
                    <span className="text-xs font-bold text-on-surface">Toggle Columns</span>
                    <button 
                      onClick={() => setColumns(DEFAULT_COLUMNS)}
                      className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      Reset Default
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                    {columns.map(col => (
                      <label 
                        key={col.id}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-primary/5 cursor-pointer text-xs font-semibold text-on-surface transition-colors"
                      >
                        <input 
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => toggleColumnVisibility(col.id)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary border-outline-variant cursor-pointer"
                        />
                        <span className="truncate">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Resizable & Drag-and-Drop Table */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse" style={{ minWidth: `${visibleColumns.reduce((acc, c) => acc + c.width, 100)}px` }}>
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/10 select-none">
                {visibleColumns.map((col) => (
                  <th 
                    key={col.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, col.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.id)}
                    style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}
                    className={`p-3.5 text-xs font-bold text-on-surface-variant uppercase tracking-wider relative group cursor-grab active:cursor-grabbing hover:bg-surface-container-high transition-colors ${
                      col.numeric ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{col.label}</span>
                      <span className="material-symbols-outlined text-[14px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">drag_indicator</span>
                    </div>

                    {/* Column Resizer Handle */}
                    <div 
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setResizingColId(col.id);
                        setStartX(e.clientX);
                        setStartWidth(col.width);
                      }}
                      className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 hover:bg-primary/40 cursor-col-resize z-10 transition-all"
                      title="Drag to resize column"
                    />
                  </th>
                ))}
                <th className="p-3.5 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right w-20">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-outline-variant/10">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="text-center py-12 text-sm text-on-surface-variant font-semibold">
                    {localPayrollList.length === 0 
                      ? 'No payroll calculated. Click "Fetch Data & Calculate" above to run real calculations.'
                      : 'No payroll records matching active filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredList.map((req) => (
                  <tr key={req.employeeId} className="hover:bg-primary/5 transition-colors group">
                    {visibleColumns.map((col) => (
                      <td 
                        key={col.id} 
                        style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}
                        className={`p-3.5 ${col.numeric ? 'text-right' : 'text-left'}`}
                      >
                        {renderCellContent(col.id, req)}
                      </td>
                    ))}
                    <td className="p-3.5 text-right">
                      <button 
                        onClick={() => setSelectedRecordForDetail(req)}
                        className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors flex items-center justify-center ml-auto cursor-pointer"
                        title="View Detailed Payslip"
                      >
                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Table Footer Summary Totals Row */}
            {localPayrollList.length > 0 && (
              <tfoot>
                <tr className="bg-surface-container-high/60 border-t-2 border-primary/20 font-bold text-xs text-on-surface">
                  {visibleColumns.map((col) => (
                    <td 
                      key={col.id} 
                      style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}
                      className={`p-3.5 ${col.numeric ? 'text-right' : 'text-left'}`}
                    >
                      {renderFooterTotalCell(col.id)}
                    </td>
                  ))}
                  <td className="p-3.5 text-right text-[10px] text-on-surface-variant font-bold">
                    SUMMARY
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Table Footer Stats */}
        {localPayrollList.length > 0 && (
          <div className="p-4 border-t border-outline-variant/10 flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-container-low/30">
            <p className="text-xs font-bold text-on-surface-variant">
              Showing {filteredList.length} of {localPayrollList.length} calculated records.
            </p>
            <div className="flex items-center gap-1">
              <button disabled className="w-8 h-8 rounded-lg hover:bg-surface-container-high flex items-center justify-center disabled:opacity-30">
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              <button className="w-8 h-8 rounded-lg bg-primary text-on-primary font-bold text-xs">1</button>
              <button disabled className="w-8 h-8 rounded-lg hover:bg-surface-container-high flex items-center justify-center disabled:opacity-30">
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Footer / Finalize Action Box */}
      {payrollStatus === 'calculated' && (
        <footer className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-primary/[0.03] p-6 rounded-xl border border-primary/20 animate-in fade-in duration-300">
          <div className="flex items-start gap-4 text-on-surface-variant max-w-2xl">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-[20px]">info</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-on-surface">Ready to Finalize Real Payroll</p>
              <p className="text-xs leading-relaxed text-on-surface-variant">
                Data synced with Attendance logs, Overtime claims, & Employee records. Finalizing will lock entries for <span className="font-bold text-primary">{summaryTotals.headcount} active employees</span>.
              </p>
            </div>
          </div>
          <button 
            onClick={handleFinalizePayroll}
            className="w-full lg:w-auto bg-primary text-on-primary h-12 px-8 rounded-xl shadow-md hover:bg-primary-container active:scale-[0.98] transition-all text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            Generate & Finalize Payroll
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </footer>
      )}

      {/* Detailed Salary Slip Breakdown Modal */}
      {selectedRecordForDetail && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-2xl border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-outline-variant/10 bg-primary/[0.02] flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-on-surface font-headline">Salary Slip Details</h3>
                <p className="text-[10px] text-on-surface-variant font-medium">{getPeriodLabel(payrollPeriod)} • ID: {selectedRecordForDetail.employeeId}</p>
              </div>
              <button 
                onClick={() => setSelectedRecordForDetail(null)}
                className="text-on-surface-variant hover:bg-surface-container-high p-1 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-6 space-y-6 text-sm">
              
              {/* Employee Info Header */}
              <div className="bg-surface-container-low p-4 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-bold text-base text-on-surface">{selectedRecordForDetail.employeeName}</p>
                  <p className="text-xs font-semibold text-on-surface-variant">{selectedRecordForDetail.designation} • {selectedRecordForDetail.department} {selectedRecordForDetail.division ? '(' + selectedRecordForDetail.division + ')' : ''}</p>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  {selectedRecordForDetail.status}
                </span>
              </div>

              {/* Attendance Management Live Summary */}
              <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/30 space-y-2">
                <div className="flex items-center justify-between border-b border-outline-variant/10 pb-1.5">
                  <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">event_available</span>
                    Attendance Log ({getPeriodLabel(payrollPeriod)})
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded font-bold">
                    Live Synced
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center pt-1">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
                    <p className="text-[9px] font-bold text-emerald-700 uppercase">Present</p>
                    <p className="text-sm font-black text-emerald-800">{safeNum(selectedRecordForDetail.workedDays || (26 - safeNum(selectedRecordForDetail.absentsCount)))} d</p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                    <p className="text-[9px] font-bold text-red-700 uppercase">Absents</p>
                    <p className="text-sm font-black text-red-800">{safeNum(selectedRecordForDetail.absentsCount)} d</p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                    <p className="text-[9px] font-bold text-amber-700 uppercase">Overtime</p>
                    <p className="text-sm font-black text-amber-800">{safeNum(selectedRecordForDetail.otHours)} h</p>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 p-2 rounded-lg">
                    <p className="text-[9px] font-bold text-purple-700 uppercase">Late Deduct</p>
                    <p className="text-sm font-black text-purple-800">{safeNum(selectedRecordForDetail.lateComingHours)} h</p>
                  </div>
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/10 pb-1">Earnings</p>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Base Salary</span>
                  <span className="font-bold text-on-surface">{currSym} {safeMoney(selectedRecordForDetail.basicSalary)}</span>
                </div>
                {safeNum(selectedRecordForDetail.overtime) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Overtime ({safeNum(selectedRecordForDetail.otHours)} hours)</span>
                    <span className="font-bold text-secondary">+{currSym} {safeMoney(selectedRecordForDetail.overtime)}</span>
                  </div>
                )}
                {safeNum(selectedRecordForDetail.allowance) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Allowances</span>
                    <span className="font-bold text-green-600">+{currSym} {safeMoney(selectedRecordForDetail.allowance)}</span>
                  </div>
                )}
              </div>

              {/* Deductions Breakdown */}
              {(safeNum(selectedRecordForDetail.lateDeduction) > 0 || 
                safeNum(selectedRecordForDetail.absents) > 0 || 
                safeNum(selectedRecordForDetail.fine) > 0 || 
                safeNum(selectedRecordForDetail.loan) > 0 || 
                safeNum(selectedRecordForDetail.advanceAmount) > 0) && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/10 pb-1">Deductions</p>
                  {safeNum(selectedRecordForDetail.lateDeduction) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Late Coming ({safeNum(selectedRecordForDetail.lateComingHours)} hours)</span>
                      <span className="font-bold text-error">-{currSym} {safeMoney(selectedRecordForDetail.lateDeduction)}</span>
                    </div>
                  )}
                  {safeNum(selectedRecordForDetail.absents) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Absents ({safeNum(selectedRecordForDetail.absentsCount)} days)</span>
                      <span className="font-bold text-error">-{currSym} {safeMoney(selectedRecordForDetail.absents)}</span>
                    </div>
                  )}
                  {safeNum(selectedRecordForDetail.fine) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Late Fines Penalty</span>
                      <span className="font-bold text-error">-{currSym} {safeMoney(selectedRecordForDetail.fine)}</span>
                    </div>
                  )}
                  {safeNum(selectedRecordForDetail.loan) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Loan Installment Deduction</span>
                      <span className="font-bold text-purple-600">-{currSym} {safeMoney(selectedRecordForDetail.loan)}</span>
                    </div>
                  )}
                  {safeNum(selectedRecordForDetail.advanceAmount) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Salary Advance Return</span>
                      <span className="font-bold text-purple-600">-{currSym} {safeMoney(selectedRecordForDetail.advanceAmount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Net Payout Details */}
              <div className="pt-4 border-t border-outline-variant/20 flex justify-between items-center">
                <span className="text-base font-bold text-on-surface">Net Payout Salary</span>
                <span className="text-xl font-black text-primary font-headline">
                  {currSym} {safeMoney(selectedRecordForDetail.netSalary)}
                </span>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-surface-container-low/50 border-t border-outline-variant/10 flex justify-end gap-2">
              <button 
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-1.5 border border-outline-variant text-on-surface px-4 py-2 rounded-xl text-xs font-bold hover:bg-surface-container-high transition-all active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Print Slip
              </button>
              <button 
                onClick={() => setSelectedRecordForDetail(null)}
                className="bg-primary text-on-primary px-5 py-2 rounded-xl text-xs font-bold hover:bg-primary-container transition-all active:scale-95 shadow-sm cursor-pointer"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
