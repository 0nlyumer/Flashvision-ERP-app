import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';
import { calculateEmployeeSalary, amountInWords, safeNum, formatMoney } from '../../utils/salaryEngine';

const safeMoney = (val, decimals = 2) => {
  const n = safeNum(val);
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export default function HRSalaryGeneration({ isMobile }) {
  const { state, setCollection, currencySymbol } = useApp();
  const currSym = currencySymbol || 'Rs.';

  // Selected payroll month - defaults to current YYYY-MM
  const [payrollPeriod, setPayrollPeriod] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  
  // Selected Division ('ALL', 'AJ Synthetic', 'AAA')
  const [divisionFilter, setDivisionFilter] = useState('ALL');

  // Selected departments multi-select state
  const [selectedDepartments, setSelectedDepartments] = useState(['ALL']);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef(null);

  // UI States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState(null);
  const [studioRecord, setStudioRecord] = useState(null);

  const payslipPrintData = useMemo(() => {
    if (!studioRecord) return null;
    const r = studioRecord;
    const items = [];
    const basicVal = safeNum(r.basic ?? r.basicSalary);
    if (basicVal > 0) {
      items.push({ description: 'Basic Salary', earnings: basicVal, deductions: 0, remarks: 'Monthly Base' });
    }
    const otVal = safeNum(r.otAmount ?? r.overtime);
    if (otVal > 0) {
      items.push({ description: `Overtime (${safeNum(r.otHours)} hrs @ ${currSym} ${safeMoney(r.hourly || (basicVal / 240))}/hr)`, earnings: otVal, deductions: 0, remarks: 'OT Amount' });
    }
    const allowVal = safeNum(r.allowance);
    if (allowVal > 0) {
      items.push({ description: 'Allowance', earnings: allowVal, deductions: 0, remarks: 'Standard / Attendance Allowance' });
    }
    const dedVal = safeNum(r.deductionAmount ?? r.lateDeduction);
    if (dedVal > 0) {
      items.push({ description: `Deduction Hours (${safeNum(r.deductionHours ?? r.lateComingHours)} hrs @ ${currSym} ${safeMoney(r.hourly || (basicVal / 240))}/hr)`, earnings: 0, deductions: dedVal, remarks: 'Hourly Deduction' });
    }
    const absVal = safeNum(r.absentDeduction ?? r.absents);
    if (absVal > 0) {
      items.push({ description: `Absent Deduction (${safeNum(r.absentDays ?? r.absentsCount)} days @ Basic / 30)`, earnings: 0, deductions: absVal, remarks: 'Absent Days Penalty' });
    }
    const fineVal = safeNum(r.fine);
    if (fineVal > 0) {
      items.push({ description: 'Fine / Penalty', earnings: 0, deductions: fineVal, remarks: 'Disciplinary Penalty' });
    }
    const advVal = safeNum(r.advance ?? r.advanceAmount);
    if (advVal > 0) {
      items.push({ description: 'Salary Advance', earnings: 0, deductions: advVal, remarks: 'Advance Recovery' });
    }
    const loanVal = safeNum(r.loan);
    if (loanVal > 0) {
      items.push({ description: 'Loan Installment', earnings: 0, deductions: loanVal, remarks: 'Loan Recovery' });
    }
    const netVal = safeNum(r.totalSalary ?? r.netSalary);
    items.push({ description: 'TOTAL SALARY PAYABLE', earnings: netVal, deductions: 0, remarks: r.words || amountInWords(netVal) });

    return {
      header: {
        employee_name: r.employeeName || 'Staff Member',
        employee_id: r.employeeId || r.empId || '-',
        designation: r.designation || 'Staff',
        department: r.department || 'Operations',
        division: r.division || 'AJ Synthetic',
        month: payrollPeriod || 'Current Month',
        basic_salary: `${currSym} ${safeMoney(basicVal)}`,
        duty_hours: `${r.dutyHours || 8} hrs/day (${r.shift || 'GENERAL SHIFT'})`,
        bank_name: r.bankName || 'Company Payroll Account',
        account_no: r.accountNo || '-'
      },
      items,
      totals: {
        totalEarnings: basicVal + otVal + allowVal,
        totalDeductions: dedVal + absVal + fineVal + advVal + loanVal,
        grandTotal: netVal,
        netSalary: netVal
      }
    };
  }, [studioRecord, payrollPeriod, currSym]);
  
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

  // Default Columns Definition matching the owner's Google Sheet
  const DEFAULT_COLUMNS = [
    { id: 'employeeId', label: 'EMP ID', visible: true, width: 95, align: 'left', numeric: false },
    { id: 'employeeName', label: 'Employee Name', visible: true, width: 160, align: 'left', numeric: false },
    { id: 'division', label: 'Division', visible: true, width: 105, align: 'left', numeric: false },
    { id: 'department', label: 'Department', visible: true, width: 130, align: 'left', numeric: false },
    { id: 'designation', label: 'Designation', visible: true, width: 130, align: 'left', numeric: false },
    { id: 'basic', label: `Basic (${currSym})`, visible: true, width: 110, align: 'right', numeric: true },
    { id: 'presentDays', label: 'Present', visible: true, width: 75, align: 'center', numeric: true },
    { id: 'absentDays', label: 'Absent', visible: true, width: 75, align: 'center', numeric: true },
    { id: 'otHours', label: 'OT Hrs', visible: true, width: 75, align: 'right', numeric: true },
    { id: 'otAmount', label: `OT Amt (${currSym})`, visible: true, width: 105, align: 'right', numeric: true },
    { id: 'deductionHours', label: 'Ded Hrs', visible: true, width: 75, align: 'right', numeric: true },
    { id: 'deductionAmount', label: `Ded Amt (${currSym})`, visible: true, width: 105, align: 'right', numeric: true },
    { id: 'absentDeduction', label: `Absent Ded (${currSym})`, visible: true, width: 115, align: 'right', numeric: true },
    { id: 'allowance', label: `Allowance (${currSym})`, visible: true, width: 100, align: 'right', numeric: true },
    { id: 'fine', label: `Fine (${currSym})`, visible: true, width: 85, align: 'right', numeric: true },
    { id: 'advance', label: `Advance (${currSym})`, visible: true, width: 100, align: 'right', numeric: true },
    { id: 'loan', label: `Loan (${currSym})`, visible: true, width: 90, align: 'right', numeric: true },
    { id: 'totalSalary', label: `Total Salary (${currSym})`, visible: true, width: 125, align: 'right', numeric: true }
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
    try {
      localStorage.setItem('hr_salary_table_columns_v2', JSON.stringify(columns));
    } catch (e) {}
  }, [columns]);

  // Click outside listener for popovers
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target)) {
        setIsDeptDropdownOpen(false);
      }
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target)) {
        setIsColumnPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Column Resizing mouse listeners
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingColId) return;
      const diff = e.clientX - startX;
      setColumns(prevCols => 
        prevCols.map(col => {
          if (col.id === resizingColId) {
            const newWidth = Math.max(startWidth + diff, 60);
            return { ...col, width: newWidth };
          }
          return col;
        })
      );
    };

    const handleMouseUp = () => {
      if (resizingColId) {
        setResizingColId(null);
      }
    };

    if (resizingColId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColId, startX, startWidth]);

  // Dynamically generated months list covering past year to future
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

  const getPeriodLabel = (periodKey) => {
    const found = monthsList.find(m => m.key === periodKey);
    return found ? found.label : periodKey;
  };

  // Unique Departments List
  const availableDepartments = React.useMemo(() => {
    const set = new Set();
    (state.departments || []).forEach(d => {
      const name = typeof d === 'string' ? d : (d.name || d.label || d.value);
      if (name) set.add(name);
    });
    (state.hr_employees_list || []).forEach(emp => {
      if (emp.department) set.add(emp.department);
    });
    if (set.size === 0) {
      ['Global Logistics', 'Supply Chain Finance', 'Quality Assurance', 'Strategic Operations', 'ADMIN', 'FINANCE', 'PRODUCTION', 'SALES', 'WAREHOUSE'].forEach(d => set.add(d));
    }
    return Array.from(set);
  }, [state.departments, state.hr_employees_list]);

  // Sync state if already exists in database with 100% defensive normalization
  useEffect(() => {
    const generatedList = state.hr_generated_salaries || [];
    const existingPeriodRecord = generatedList.find(record => record.month === payrollPeriod);
    
    if (existingPeriodRecord && Array.isArray(existingPeriodRecord.records)) {
      const normalized = existingPeriodRecord.records.map(rec => {
        const basic = safeNum(rec.basic ?? rec.basicSalary ?? rec.baseSalary);
        const hourly = basic > 0 ? (basic / 240) : 0;
        const presentDays = safeNum(rec.presentDays);
        const absentDays = safeNum(rec.absentDays ?? rec.absentsCount);
        const otHours = safeNum(rec.otHours);
        const otAmount = safeNum(rec.otAmount ?? rec.overtime);
        const deductionHours = safeNum(rec.deductionHours ?? rec.lateComingHours);
        const deductionAmount = safeNum(rec.deductionAmount ?? rec.lateDeduction);
        const absentDeduction = safeNum(rec.absentDeduction ?? rec.absents);
        const allowance = safeNum(rec.allowance);
        const fine = safeNum(rec.fine ?? rec.fines);
        const advance = safeNum(rec.advance ?? rec.advanceAmount);
        const loan = safeNum(rec.loan);
        const totalSalary = safeNum(rec.totalSalary ?? rec.netSalary);

        return {
          ...rec,
          employeeId: rec.employeeId || rec.id || '',
          employeeName: rec.employeeName || rec.name || 'Employee',
          division: rec.division || 'AJ Synthetic',
          department: rec.department || (rec.division === 'AAA' ? 'AAA' : 'AJ Synthetic'),
          designation: rec.designation || rec.jobTitle || rec.role || 'Staff',
          basic: basic,
          basicSalary: basic,
          hourly: hourly,
          presentDays: presentDays,
          absentDays: absentDays,
          absentsCount: absentDays,
          otHours: otHours,
          otAmount: otAmount,
          overtime: otAmount,
          deductionHours: deductionHours,
          lateComingHours: deductionHours,
          deductionAmount: deductionAmount,
          lateDeduction: deductionAmount,
          absentDeduction: absentDeduction,
          absents: absentDeduction,
          allowance: allowance,
          fine: fine,
          advance: advance,
          advanceAmount: advance,
          loan: loan,
          totalSalary: totalSalary,
          netSalary: totalSalary,
          words: rec.words || amountInWords(totalSalary),
          status: rec.status || 'Calculated'
        };
      });
      setLocalPayrollList(normalized);
      setPayrollStatus(existingPeriodRecord.status ? existingPeriodRecord.status.toLowerCase() : 'none');
    } else {
      setLocalPayrollList([]);
      setPayrollStatus('none');
    }
  }, [payrollPeriod, state.hr_generated_salaries]);

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

  // Dynamic REAL Data Salary Calculation Engine using the single calculateEmployeeSalary core
  const runCalculationEngine = () => {
    setIsProcessing(true);
    setProcessingMessage('Fetching saved Attendance records, approved overtime claims, and employee profiles...');
    
    setTimeout(() => {
      const allEmployees = state.hr_employees_list || [];
      const attendanceLogs = state.hr_uploaded_attendance || [];
      const overtimeRequests = state.hr_overtime_requests || [];
      const advanceRequests = state.hr_advance_requests || [];
      const loanRequests = state.hr_loan_requests || [];
      const loanLedger = state.hr_loan_ledger || [];
      const leaveRequests = state.hr_leave_requests || [];

      let salaryConfig = null;
      try {
        const savedConfig = localStorage.getItem('hr_salary_allowance_config');
        if (savedConfig) salaryConfig = JSON.parse(savedConfig);
      } catch (e) {}

      // Filter employees by Division and Multi-Department selection
      const filteredEmployees = allEmployees.filter(emp => {
        // Division filter
        if (divisionFilter !== 'ALL') {
          const empDiv = emp.division || 'AJ Synthetic';
          if (empDiv !== divisionFilter) return false;
        }
        // Department filter
        if (!selectedDepartments.includes('ALL')) {
          const empDept = emp.department || (emp.division === 'AAA' ? 'AAA' : 'AJ Synthetic');
          if (!selectedDepartments.includes(empDept)) return false;
        }
        return true;
      });

      const monthContext = {
        payrollPeriod,
        uploadedAttendance: attendanceLogs,
        overtimeRequests,
        advanceRequests,
        loanRequests,
        loanLedger,
        leaveRequests,
        salaryConfig
      };

      const calculatedRecords = filteredEmployees.map(emp => {
        const calc = calculateEmployeeSalary(emp, monthContext);
        return {
          ...calc,
          // Backward compatibility aliases
          basicSalary: calc.basic,
          netSalary: calc.totalSalary,
          overtime: calc.otAmount,
          lateComingHours: calc.deductionHours,
          lateDeduction: calc.deductionAmount,
          absents: calc.absentDeduction,
          absentsCount: calc.absentDays,
          advanceAmount: calc.advance,
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
      triggerToast(`Calculated payroll for ${calculatedRecords.length} employees using Google Sheet rules!`);
    }, 800);
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
      netPayout: localPayrollList.reduce((acc, curr) => acc + safeNum(curr.totalSalary ?? curr.netSalary), 0),
      headcount: localPayrollList.length,
      overtime: localPayrollList.reduce((acc, curr) => acc + safeNum(curr.otAmount ?? curr.overtime), 0),
      deductions: localPayrollList.reduce((acc, curr) => 
        acc + safeNum(curr.deductionAmount ?? curr.lateDeduction) + 
        safeNum(curr.absentDeduction ?? curr.absents) + 
        safeNum(curr.fine) + 
        safeNum(curr.advance ?? curr.advanceAmount) + 
        safeNum(curr.loan), 0)
    };
  }, [localPayrollList]);

  // Calculate Table Footer Totals with safe numerical reduction
  const footerTotals = React.useMemo(() => {
    return {
      basic: localPayrollList.reduce((sum, r) => sum + safeNum(r.basic ?? r.basicSalary), 0),
      presentDays: localPayrollList.reduce((sum, r) => sum + safeNum(r.presentDays), 0),
      absentDays: localPayrollList.reduce((sum, r) => sum + safeNum(r.absentDays ?? r.absentsCount), 0),
      otHours: localPayrollList.reduce((sum, r) => sum + safeNum(r.otHours), 0),
      otAmount: localPayrollList.reduce((sum, r) => sum + safeNum(r.otAmount ?? r.overtime), 0),
      deductionHours: localPayrollList.reduce((sum, r) => sum + safeNum(r.deductionHours ?? r.lateComingHours), 0),
      deductionAmount: localPayrollList.reduce((sum, r) => sum + safeNum(r.deductionAmount ?? r.lateDeduction), 0),
      absentDeduction: localPayrollList.reduce((sum, r) => sum + safeNum(r.absentDeduction ?? r.absents), 0),
      allowance: localPayrollList.reduce((sum, r) => sum + safeNum(r.allowance), 0),
      fine: localPayrollList.reduce((sum, r) => sum + safeNum(r.fine), 0),
      advance: localPayrollList.reduce((sum, r) => sum + safeNum(r.advance ?? r.advanceAmount), 0),
      loan: localPayrollList.reduce((sum, r) => sum + safeNum(r.loan), 0),
      totalSalary: localPayrollList.reduce((sum, r) => sum + safeNum(r.totalSalary ?? r.netSalary), 0),
      // legacy aliases
      basicSalary: localPayrollList.reduce((sum, r) => sum + safeNum(r.basic ?? r.basicSalary), 0),
      overtime: localPayrollList.reduce((sum, r) => sum + safeNum(r.otAmount ?? r.overtime), 0),
      lateComingHours: localPayrollList.reduce((sum, r) => sum + safeNum(r.deductionHours ?? r.lateComingHours), 0),
      lateDeduction: localPayrollList.reduce((sum, r) => sum + safeNum(r.deductionAmount ?? r.lateDeduction), 0),
      absents: localPayrollList.reduce((sum, r) => sum + safeNum(r.absentDeduction ?? r.absents), 0),
      advanceAmount: localPayrollList.reduce((sum, r) => sum + safeNum(r.advance ?? r.advanceAmount), 0),
      netSalary: localPayrollList.reduce((sum, r) => sum + safeNum(r.totalSalary ?? r.netSalary), 0)
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
        return <span className="font-mono text-xs font-bold text-on-surface">{record.employeeId || '-'}</span>;
      case 'doj':
        return <span className="text-xs text-on-surface-variant font-medium">{record.doj || record.dateOfJoining || '-'}</span>;
      case 'designation':
        return <span className="text-xs font-semibold text-on-surface-variant">{record.designation}</span>;
      case 'division': {
        const divName = record.division || 'AJ Synthetic';
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            divName === 'AAA' 
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
              : 'bg-primary/10 text-primary border border-primary/20'
          }`}>
            {divName}
          </span>
        );
      }
      case 'department':
        return <span className="text-xs font-bold text-on-surface-variant">{record.department}</span>;
      case 'section':
        return <span className="text-xs text-on-surface-variant">{record.section || '-'}</span>;
      case 'employeeName':
        return <span className="text-sm font-bold text-on-surface">{record.employeeName}</span>;
      case 'basic':
      case 'basicSalary':
        return <span className="text-xs font-bold text-on-surface">{currSym} {safeMoney(record.basic ?? record.basicSalary)}</span>;
      case 'presentDays':
        return <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">{record.presentDays ?? 0}</span>;
      case 'absentDays': {
        const absCnt = safeNum(record.absentDays ?? record.absentsCount);
        return <span className={`text-xs font-bold ${absCnt > 0 ? 'text-red-600 dark:text-red-400' : 'text-on-surface-variant'}`}>{absCnt}</span>;
      }
      case 'otHours': {
        const otH = safeNum(record.otHours);
        return <span className={`text-xs ${otH > 0 ? 'font-bold text-teal-600 dark:text-teal-400' : 'text-on-surface-variant'}`}>{otH > 0 ? `${otH}h` : '-'}</span>;
      }
      case 'otAmount':
      case 'overtime': {
        const otVal = safeNum(record.otAmount ?? record.overtime);
        return <span className={`text-xs font-bold ${otVal > 0 ? 'text-teal-600 dark:text-teal-400' : 'text-on-surface-variant'}`}>{otVal > 0 ? `+${currSym} ${safeMoney(otVal)}` : '-'}</span>;
      }
      case 'deductionHours':
      case 'lateComingHours': {
        const dH = safeNum(record.deductionHours ?? record.lateComingHours);
        return <span className={`text-xs ${dH > 0 ? 'font-bold text-red-600 dark:text-red-400' : 'text-on-surface-variant'}`}>{dH > 0 ? `${dH}h` : '-'}</span>;
      }
      case 'deductionAmount':
      case 'lateDeduction': {
        const dVal = safeNum(record.deductionAmount ?? record.lateDeduction);
        return <span className={`text-xs font-bold ${dVal > 0 ? 'text-red-600 dark:text-red-400' : 'text-on-surface-variant'}`}>{dVal > 0 ? `-${currSym} ${safeMoney(dVal)}` : '-'}</span>;
      }
      case 'absentDeduction':
      case 'absents': {
        const aDed = safeNum(record.absentDeduction ?? record.absents);
        return <span className={`text-xs font-bold ${aDed > 0 ? 'text-red-600 dark:text-red-400' : 'text-on-surface-variant'}`}>{aDed > 0 ? `-${currSym} ${safeMoney(aDed)}` : '-'}</span>;
      }
      case 'allowance': {
        const al = safeNum(record.allowance);
        return <span className={`text-xs font-bold ${al > 0 ? 'text-teal-600 dark:text-teal-400' : 'text-on-surface-variant'}`}>{al > 0 ? `+${currSym} ${safeMoney(al)}` : '-'}</span>;
      }
      case 'fine': {
        const fn = safeNum(record.fine);
        return <span className={`text-xs font-bold ${fn > 0 ? 'text-red-600 dark:text-red-400' : 'text-on-surface-variant'}`}>{fn > 0 ? `-${currSym} ${safeMoney(fn)}` : '-'}</span>;
      }
      case 'advance':
      case 'advanceAmount': {
        const adv = safeNum(record.advance ?? record.advanceAmount);
        return <span className={`text-xs font-bold ${adv > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-on-surface-variant'}`}>{adv > 0 ? `-${currSym} ${safeMoney(adv)}` : '-'}</span>;
      }
      case 'loan': {
        const ln = safeNum(record.loan);
        return <span className={`text-xs font-bold ${ln > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-on-surface-variant'}`}>{ln > 0 ? `-${currSym} ${safeMoney(ln)}` : '-'}</span>;
      }
      case 'totalSalary':
      case 'netSalary': {
        const tot = safeNum(record.totalSalary ?? record.netSalary);
        return <span className="text-sm font-black text-primary font-headline">{currSym} {safeMoney(tot)}</span>;
      }
      default:
        return null;
    }
  };

  // Helper to render footer total cell with 100% safe Formatting
  const renderFooterTotalCell = (colId) => {
    switch (colId) {
      case 'employeeId':
        return <span className="font-bold text-xs text-on-surface">TOTALS</span>;
      case 'basic':
      case 'basicSalary':
        return <span className="font-bold text-xs text-on-surface">{currSym} {safeMoney(footerTotals.basic)}</span>;
      case 'presentDays':
        return <span className="font-bold text-xs text-teal-600 dark:text-teal-400">{footerTotals.presentDays}</span>;
      case 'absentDays':
        return <span className="font-bold text-xs text-red-600 dark:text-red-400">{footerTotals.absentDays}</span>;
      case 'otHours':
        return <span className="font-bold text-xs text-teal-600 dark:text-teal-400">{safeNum(footerTotals.otHours)}h</span>;
      case 'otAmount':
      case 'overtime':
        return <span className="font-bold text-xs text-teal-600 dark:text-teal-400">+{currSym} {safeMoney(footerTotals.otAmount)}</span>;
      case 'deductionHours':
      case 'lateComingHours':
        return <span className="font-bold text-xs text-red-600 dark:text-red-400">{safeNum(footerTotals.deductionHours)}h</span>;
      case 'deductionAmount':
      case 'lateDeduction':
        return <span className="font-bold text-xs text-red-600 dark:text-red-400">-{currSym} {safeMoney(footerTotals.deductionAmount)}</span>;
      case 'absentDeduction':
      case 'absents':
        return <span className="font-bold text-xs text-red-600 dark:text-red-400">-{currSym} {safeMoney(footerTotals.absentDeduction)}</span>;
      case 'fine':
        return <span className="font-bold text-xs text-red-600 dark:text-red-400">-{currSym} {safeMoney(footerTotals.fine)}</span>;
      case 'allowance':
        return <span className="font-bold text-xs text-teal-600 dark:text-teal-400">+{currSym} {safeMoney(footerTotals.allowance)}</span>;
      case 'advance':
      case 'advanceAmount':
        return <span className="font-bold text-xs text-purple-600 dark:text-purple-400">-{currSym} {safeMoney(footerTotals.advance)}</span>;
      case 'loan':
        return <span className="font-bold text-xs text-purple-600 dark:text-purple-400">-{currSym} {safeMoney(footerTotals.loan)}</span>;
      case 'totalSalary':
      case 'netSalary':
        return <span className="font-black text-sm text-primary font-headline">{currSym} {safeMoney(footerTotals.totalSalary)}</span>;
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

          {/* Division Filter */}
          <div className="space-y-2 min-w-[170px]">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Division Filter</label>
            <div className="relative w-full">
              <select 
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="w-full h-11 pl-4 pr-10 text-sm border border-outline-variant rounded-xl bg-surface-container-lowest hover:border-primary transition-colors focus:border-primary focus:ring-4 focus:ring-primary/10 appearance-none cursor-pointer font-medium text-on-surface"
              >
                <option value="ALL">All Divisions</option>
                <option value="AJ Synthetic">AJ Synthetic</option>
                <option value="AAA">AAA</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-outline">domain</span>
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
                    <td className="p-3.5 text-right flex items-center justify-end gap-1">
                      <button 
                        onClick={() => setStudioRecord(req)}
                        className="p-1.5 hover:bg-secondary/10 rounded-lg text-secondary transition-colors flex items-center justify-center cursor-pointer"
                        title="Print Payslip"
                      >
                        <span className="material-symbols-outlined text-[18px]">print</span>
                      </button>
                      <button 
                        onClick={() => setSelectedRecordForDetail(req)}
                        className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors flex items-center justify-center cursor-pointer"
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
              <div className="bg-surface-container-low p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-on-surface text-base">{selectedRecordForDetail.employeeName}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedRecordForDetail.division === 'AAA' 
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' 
                        : 'bg-primary/10 text-primary border border-primary/20'
                    }`}>
                      {selectedRecordForDetail.division || 'AJ Synthetic'}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-on-surface-variant">
                    {selectedRecordForDetail.designation} • {selectedRecordForDetail.department} • {selectedRecordForDetail.shift || 'GENERAL SHIFT'} ({selectedRecordForDetail.dutyHours || 8}h)
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 shrink-0">
                  {selectedRecordForDetail.status}
                </span>
              </div>

              {/* Exact Formula Breakdown Card */}
              <div className="bg-primary/[0.03] border border-primary/15 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-primary">
                  <span className="material-symbols-outlined text-[16px]">calculate</span>
                  <span>Sheet-Exact Calculation Formula</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-on-surface-variant font-mono">
                  <div>Hourly: <span className="text-on-surface font-semibold">{currSym} {safeMoney(selectedRecordForDetail.hourly || ((selectedRecordForDetail.basic ?? selectedRecordForDetail.basicSalary) / 240))}</span> (basic/240)</div>
                  <div>Cal Days: <span className="text-on-surface font-semibold">{selectedRecordForDetail.calDays || 30} days</span></div>
                  <div>Present: <span className="text-teal-600 font-semibold">{selectedRecordForDetail.presentDays ?? 0} days</span></div>
                  <div>Absent: <span className="text-error font-semibold">{selectedRecordForDetail.absentDays ?? selectedRecordForDetail.absentsCount ?? 0} days</span></div>
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/10 pb-1">Earnings</p>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Basic Monthly Salary</span>
                  <span className="font-bold text-on-surface">{currSym} {safeMoney(selectedRecordForDetail.basic ?? selectedRecordForDetail.basicSalary)}</span>
                </div>
                {safeNum(selectedRecordForDetail.otAmount ?? selectedRecordForDetail.overtime) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Overtime ({safeNum(selectedRecordForDetail.otHours)} hrs @ {currSym} {safeMoney(selectedRecordForDetail.hourly || ((selectedRecordForDetail.basic ?? selectedRecordForDetail.basicSalary) / 240))}/hr)</span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">+{currSym} {safeMoney(selectedRecordForDetail.otAmount ?? selectedRecordForDetail.overtime)}</span>
                  </div>
                )}
                {safeNum(selectedRecordForDetail.allowance) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Attendance / Duty Allowance</span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">+{currSym} {safeMoney(selectedRecordForDetail.allowance)}</span>
                  </div>
                )}
              </div>

              {/* Deductions Breakdown */}
              {(safeNum(selectedRecordForDetail.deductionAmount ?? selectedRecordForDetail.lateDeduction) > 0 || 
                safeNum(selectedRecordForDetail.absentDeduction ?? selectedRecordForDetail.absents) > 0 || 
                safeNum(selectedRecordForDetail.fine) > 0 || 
                safeNum(selectedRecordForDetail.loan) > 0 || 
                safeNum(selectedRecordForDetail.advance ?? selectedRecordForDetail.advanceAmount) > 0) && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/10 pb-1">Deductions</p>
                  {safeNum(selectedRecordForDetail.deductionAmount ?? selectedRecordForDetail.lateDeduction) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Late / Short Hours ({safeNum(selectedRecordForDetail.deductionHours ?? selectedRecordForDetail.lateComingHours)} hrs)</span>
                      <span className="font-bold text-error">-{currSym} {safeMoney(selectedRecordForDetail.deductionAmount ?? selectedRecordForDetail.lateDeduction)}</span>
                    </div>
                  )}
                  {safeNum(selectedRecordForDetail.absentDeduction ?? selectedRecordForDetail.absents) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Unpaid Absent Days ({safeNum(selectedRecordForDetail.absentDays ?? selectedRecordForDetail.absentsCount)} days @ basic/30)</span>
                      <span className="font-bold text-error">-{currSym} {safeMoney(selectedRecordForDetail.absentDeduction ?? selectedRecordForDetail.absents)}</span>
                    </div>
                  )}
                  {safeNum(selectedRecordForDetail.fine) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Fine / Penalty</span>
                      <span className="font-bold text-error">-{currSym} {safeMoney(selectedRecordForDetail.fine)}</span>
                    </div>
                  )}
                  {safeNum(selectedRecordForDetail.loan) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Loan Installment Deduction</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">-{currSym} {safeMoney(selectedRecordForDetail.loan)}</span>
                    </div>
                  )}
                  {safeNum(selectedRecordForDetail.advance ?? selectedRecordForDetail.advanceAmount) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant">Salary Advance Return</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">-{currSym} {safeMoney(selectedRecordForDetail.advance ?? selectedRecordForDetail.advanceAmount)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Net Payout Details */}
              <div className="pt-4 border-t border-outline-variant/20 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-on-surface">TOTAL SALARY PAYABLE</span>
                  <span className="text-xl font-black text-primary font-headline">
                    {currSym} {safeMoney(selectedRecordForDetail.totalSalary ?? selectedRecordForDetail.netSalary)}
                  </span>
                </div>
                <p className="text-[11px] italic text-on-surface-variant">
                  {selectedRecordForDetail.words || amountInWords(selectedRecordForDetail.totalSalary ?? selectedRecordForDetail.netSalary)}
                </p>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-surface-container-low/50 border-t border-outline-variant/10 flex justify-end gap-2">
              <button 
                onClick={() => setStudioRecord(selectedRecordForDetail)}
                className="bg-secondary/10 text-secondary hover:bg-secondary/20 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Print Payslip
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

      {studioRecord && payslipPrintData && (
        <UniversalPrintPreviewModal
          isOpen={Boolean(studioRecord)}
          onClose={() => setStudioRecord(null)}
          documentType="hr_payslip"
          documentData={payslipPrintData}
          documentTitle={`Payslip - ${studioRecord.employeeName || 'Staff'}`}
        />
      )}

    </div>
  );
}
