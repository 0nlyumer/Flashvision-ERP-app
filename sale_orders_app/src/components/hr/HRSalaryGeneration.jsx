import HRPayslipModal from './HRPayslipModal';
import { getEffectiveDutyHours, getEffectiveOvertimeMultiplier } from '../../utils/hrDutyHours';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { exportDocumentToPdf, exportDocumentToImage, exportDocumentToCsv } from '../../utils/printExportUtils';

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

// Safe date normalizer (converts DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD into standard YYYY-MM-DD)
const normalizeDate = (dateStr) => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    let year, month, day;
    if (parts[0].length === 4) {
      year = parts[0];
      month = parts[1].padStart(2, '0');
      day = parts[2].padStart(2, '0');
    } else if (parts[2].length === 4) {
      year = parts[2];
      month = parts[0].padStart(2, '0');
      day = parts[1].padStart(2, '0');
    } else {
      return str;
    }
    return `${year}-${month}-${day}`;
  }
  return str;
};

export default function HRSalaryGeneration({ isMobile }) {
  const { state, setCollection, currencySymbol } = useApp();
  const currSym = currencySymbol || 'Rs.';

  // Sub-tabs: 'generate' (Active Salary Generation) vs 'history' (Finalized Payroll History)
  const [activeSubTab, setActiveSubTab] = useState('generate');

  // Selected payroll month
  const [payrollPeriod, setPayrollPeriod] = useState('');

  // Selected division filter state: by default NO division is selected (har dafa select kerna pare)
  const [selectedDivision, setSelectedDivision] = useState('ALL');

  // Search & Filter Keys for Payroll Detail View
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('az'); // 'az' | 'za' | 'highest_pay' | 'lowest_pay' | 'paid_days' | 'ot'
  const [quickFilter, setQuickFilter] = useState('ALL'); // 'ALL' | 'WITH_OT' | 'WITH_DEDUCTIONS' | 'FULL_ATTENDANCE'
  const [statusFilter, setStatusFilter] = useState('All Records'); // 'All Records' | 'Calculated' | 'Finalized'

  // History Screen States
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [viewingHistoryRecord, setViewingHistoryRecord] = useState(null);
  const [historyExportDropdownMonth, setHistoryExportDropdownMonth] = useState(null); // which row has export menu open
  const [isExporting, setIsExporting] = useState(false);
  const [monthToDelete, setMonthToDelete] = useState(null); // modal confirmation for delete
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);

  // UI Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState(null);

  // Column options / 3-dot menu popover state
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const columnPickerRef = useRef(null);
  const exportDropdownRef = useRef(null);

  // Local active payroll calculation list (before saving)
  const [localPayrollList, setLocalPayrollList] = useState([]);
  const [payrollStatus, setPayrollStatus] = useState('none'); // 'none' | 'calculated' | 'finalized'

  // Resizing state
  const [resizingColId, setResizingColId] = useState(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  // Dragging state for column reorder
  const [draggedColId, setDraggedColId] = useState(null);

  // Hidden print container ref for PDF / Image export
  const printStatementRef = useRef(null);
  const [exportTargetRecord, setExportTargetRecord] = useState(null);

  // Default Columns Definition (includes Paid Days / Payable Days column)
  const DEFAULT_COLUMNS = [
    { id: 'employeeId', label: 'Employee ID', visible: true, width: 110, align: 'left', numeric: false },
    { id: 'employeeName', label: 'Employee Name', visible: true, width: 160, align: 'left', numeric: false },
    { id: 'designation', label: 'Designation', visible: true, width: 140, align: 'left', numeric: false },
    { id: 'department', label: 'Department', visible: true, width: 130, align: 'left', numeric: false },
    { id: 'division', label: 'Division', visible: true, width: 110, align: 'left', numeric: false },
    { id: 'payableDays', label: 'Paid Days', visible: true, width: 105, align: 'center', numeric: true },
    { id: 'basicSalary', label: `Basic Salary (${currSym})`, visible: true, width: 120, align: 'right', numeric: true },
    { id: 'otHours', label: 'OT (Hrs)', visible: true, width: 95, align: 'right', numeric: true },
    { id: 'overtime', label: `Overtime (${currSym})`, visible: true, width: 110, align: 'right', numeric: true },
    { id: 'lateComingHours', label: 'Late (Hrs)', visible: true, width: 95, align: 'right', numeric: true },
    { id: 'lateDeduction', label: `Late Deduct (${currSym})`, visible: true, width: 120, align: 'right', numeric: true },
    { id: 'absents', label: `Absents (${currSym})`, visible: true, width: 110, align: 'right', numeric: true },
    { id: 'fine', label: `Fine (${currSym})`, visible: true, width: 90, align: 'right', numeric: true },
    { id: 'allowance', label: `Allowance (${currSym})`, visible: true, width: 110, align: 'right', numeric: true },
    { id: 'advanceAmount', label: `Advance (${currSym})`, visible: true, width: 110, align: 'right', numeric: true },
    { id: 'loan', label: `Loan (${currSym})`, visible: true, width: 100, align: 'right', numeric: true },
    { id: 'netSalary', label: `Net Salary (${currSym})`, visible: true, width: 130, align: 'right', numeric: true }
  ];

  // Column Configuration State with Persistence
  const [columns, setColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('hr_salary_table_columns_v3');
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
      localStorage.setItem('hr_salary_table_columns_v3', JSON.stringify(columns));
    } catch (e) {}
  }, [columns]);

  // Click outside listener for popovers
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target)) {
        setIsColumnPickerOpen(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setHistoryExportDropdownMonth(null);
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

  // RULE: Collect ALL months where ANY active employee has at least a single date's verified attendance saved
  const monthsWithAttendance = useMemo(() => {
    const monthSet = new Set();
    const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])/;

    let allEmployees = (state.hr_employees_list || []).filter(e => (e.status || 'Active').toLowerCase() === 'active');
    if (allEmployees.length === 0) {
      try {
        const savedEmps = localStorage.getItem('hr_employees_list');
        if (savedEmps) {
          const parsed = JSON.parse(savedEmps);
          if (Array.isArray(parsed)) allEmployees = parsed.filter(e => (e.status || 'Active').toLowerCase() === 'active');
        }
      } catch (e) {}
    }

    const activeIds = new Set();
    const activeCodes = new Set();
    const activeNames = new Set();
    allEmployees.forEach(e => {
      if (e.id) activeIds.add(String(e.id).trim());
      if (e.employeeCode) activeCodes.add(String(e.employeeCode).trim());
      if (e.name) activeNames.add(String(e.name).toLowerCase().trim());
    });

    // 1. Uploaded & Flash AM mobile punch attendance logs
    let uploaded = state.hr_uploaded_attendance || [];
    try {
      const savedUploaded = localStorage.getItem('hr_uploaded_attendance');
      if (savedUploaded) {
        const parsed = JSON.parse(savedUploaded);
        if (Array.isArray(parsed)) uploaded = [...uploaded, ...parsed];
      }
      const flashAmCached = localStorage.getItem('flasham_cached_attendance');
      if (flashAmCached) {
        const parsed = JSON.parse(flashAmCached);
        if (Array.isArray(parsed)) uploaded = [...uploaded, ...parsed];
      }
    } catch (e) {}

    uploaded.forEach(log => {
      const logEmpId = String(log.employeeId || log.id || '').trim();
      const logEmpCode = String(log.employeeCode || log.code || '').trim();
      const logName = String(log.employeeName || log.name || '').toLowerCase().trim();

      const isActEmp = (logEmpId && (activeIds.has(logEmpId) || activeCodes.has(logEmpId))) ||
                       (logEmpCode && (activeCodes.has(logEmpCode) || activeIds.has(logEmpCode))) ||
                       (logName && (activeNames.has(logName) || Array.from(activeNames).some(n => n.includes(logName) || logName.includes(n))));
      if (!isActEmp) return;

      const rawDt = log?.date || log?.logDate || log?.punchDate;
      const dt = normalizeDate(rawDt);
      const st = String(log?.status || '').toLowerCase();
      // Must have actual attendance (present, completed, leave, or punch in/out)
      if (dt && typeof dt === 'string' && MONTH_REGEX.test(dt) && (st.includes('present') || st === 'completed' || st.includes('leave') || log.inTime || log.outTime)) {
        monthSet.add(dt.substring(0, 7));
      }
    });

    // 2. Embedded employee attendance logs for active employees
    allEmployees.forEach(emp => {
      if (emp && emp.attendance && typeof emp.attendance === 'object') {
        Object.entries(emp.attendance).forEach(([dayKey, dayVal]) => {
          const normKey = normalizeDate(dayKey);
          if (typeof normKey === 'string' && MONTH_REGEX.test(normKey) && dayVal) {
            const st = String(dayVal.status || '').toLowerCase();
            // Must have actual positive attendance mark (present, completed, leave, or valid punch)
            if (st.includes('present') || st === 'completed' || st.includes('leave') || dayVal.inTime || (dayVal.userEdited && st !== 'absent')) {
              monthSet.add(normKey.substring(0, 7));
            }
          }
        });
      }
    });

    return Array.from(monthSet);
  }, [state.hr_uploaded_attendance, state.hr_employees_list]);

  // Set of months where salary has already been generated
  const generatedMonthsSet = useMemo(() => {
    const set = new Set();
    const list = state.hr_generated_salaries || [];
    list.forEach(item => {
      if (item && item.month && (item.status === 'Finalized' || (Array.isArray(item.records) && item.records.length > 0))) {
        set.add(item.month);
      }
    });
    return set;
  }, [state.hr_generated_salaries]);

  // Dropdown options: ONLY months with attendance AND NOT already generated
  // If a generated salary is deleted, it immediately returns to this list!
  const monthsList = useMemo(() => {
    const pendingMonths = monthsWithAttendance
      .filter(m => !generatedMonthsSet.has(m))
      .sort()
      .reverse();

    return pendingMonths.map(key => {
      const [year, month] = key.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const label = !isNaN(d.getTime()) 
        ? d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
        : key;
      return { key, label };
    });
  }, [monthsWithAttendance, generatedMonthsSet]);

  const getPeriodLabel = (periodKey) => {
    if (!periodKey) return 'No Period Selected';
    const found = monthsList.find(m => m.key === periodKey);
    if (found) return found.label;
    const [year, month] = periodKey.split('-');
    if (year && month) {
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      if (!isNaN(d.getTime())) return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }
    return periodKey;
  };

  // Sync selected payroll period with available months
  useEffect(() => {
    if (monthsList.length > 0) {
      if (!payrollPeriod || !monthsList.some(m => m.key === payrollPeriod)) {
        setPayrollPeriod(monthsList[0].key);
      }
    } else {
      setPayrollPeriod('');
    }
  }, [monthsList, payrollPeriod]);

  // Dynamic Divisions for Dropdown: Includes 'ALL' for whole company
  const availableDivisions = useMemo(() => {
    const set = new Set();
    let emps = state.hr_employees_list || [];
    try {
      const savedEmps = localStorage.getItem('hr_employees_list');
      if (savedEmps) {
        const parsed = JSON.parse(savedEmps);
        if (Array.isArray(parsed) && parsed.length > 0) emps = parsed;
      }
    } catch (e) {}

    emps.forEach(emp => {
      const isAct = (emp.status || 'Active').toLowerCase() === 'active';
      if (isAct) {
        const div = emp.division || emp.section;
        if (div && typeof div === 'string' && div.trim()) set.add(div.trim());
      }
    });
    if (set.size === 0) {
      ['AAA', 'AJ Synthetic', 'Operations'].forEach(d => set.add(d));
    }
    return ['ALL', ...Array.from(set).sort()];
  }, [state.hr_employees_list]);

  // Comprehensive Realtime Payroll Calculation Engine
  // RULE: Calculates for all active employees with >= 1 day attendance in that month (Supports All Divisions & App Punches)
  const computePayrollForPeriod = (period, divisionToUse) => {
    if (!period) return [];
    const divFilter = (divisionToUse || 'ALL').trim().toLowerCase();

    let allEmployees = (state.hr_employees_list || []).filter(emp => {
      const isAct = (emp.status || 'Active').toLowerCase() === 'active';
      if (!isAct) return false;
      if (divFilter === 'all') return true;
      const empDiv = (emp.division || emp.section || '').trim().toLowerCase();
      return empDiv === divFilter;
    });

    if (allEmployees.length === 0) {
      try {
        const savedEmps = localStorage.getItem('hr_employees_list');
        if (savedEmps) {
          const parsed = JSON.parse(savedEmps);
          if (Array.isArray(parsed)) {
            allEmployees = parsed.filter(emp => {
              const isAct = (emp.status || 'Active').toLowerCase() === 'active';
              if (!isAct) return false;
              if (divFilter === 'all') return true;
              const empDiv = (emp.division || emp.section || '').trim().toLowerCase();
              return empDiv === divFilter;
            });
          }
        }
      } catch (e) {}
    }

    // Load multi-source uploaded attendance logs (State + LocalStorage + Flash AM mobile app cache)
    let attendanceLogs = state.hr_uploaded_attendance || [];
    try {
      const savedUploaded = localStorage.getItem('hr_uploaded_attendance');
      if (savedUploaded) {
        const parsed = JSON.parse(savedUploaded);
        if (Array.isArray(parsed)) attendanceLogs = [...attendanceLogs, ...parsed];
      }
      const flashAmCached = localStorage.getItem('flasham_cached_attendance');
      if (flashAmCached) {
        const parsed = JSON.parse(flashAmCached);
        if (Array.isArray(parsed)) attendanceLogs = [...attendanceLogs, ...parsed];
      }
    } catch (e) {}

    const overtimeRequests = state.hr_overtime_requests || [];
    const loanRequests = state.hr_loan_requests || [];
    const loanLedger = state.hr_loan_ledger || [];

    let salaryConfig = null;
    try {
      const savedConfig = localStorage.getItem('hr_salary_allowance_config');
      if (savedConfig) salaryConfig = JSON.parse(savedConfig);
    } catch (e) {}

    let dutySettings = state?.hr_duty_settings || null;
    try {
      if (!dutySettings) {
        const savedDuty = localStorage.getItem('hr_duty_settings');
        if (savedDuty) dutySettings = JSON.parse(savedDuty);
      }
    } catch (e) {}

    const [yearStr, monthStr] = period.split('-');
    const currentMonthDays = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
    const daysInMonth = currentMonthDays;
    const totalWorkingDays = currentMonthDays;

    const results = allEmployees.map(emp => {
      const baseSalary = safeNum(emp.basicSalary || emp.salary || emp.baseSalary || 35000);
      const doj = emp.doj || emp.dateOfJoining || '2024-01-15';
      const designation = emp.designation || emp.jobTitle || emp.role || 'Associate';
      const department = emp.department || 'Global Logistics';
      const section = emp.section || emp.subSection || emp.division || 'Operations';
      const division = emp.division || emp.section || (divisionToUse === 'ALL' ? 'General' : divisionToUse);

      let workedDays = 0;
      let absentsCount = 0;
      let leavesCount = 0;
      let lateComingHours = 0;
      let totalFines = 0;
      let otHours = 0;

      const empIdStr = String(emp.id || '').trim();
      const empCodeStr = String(emp.employeeCode || emp.code || '').trim();
      const empNameLower = String(emp.name || '').trim().toLowerCase();

      // Attendance logs from uploaded / biometric punches / Flash AM mobile app
      const matchedLogs = attendanceLogs.filter(a => {
        const aEmpId = String(a.employeeId || (a.id && String(a.id).startsWith('EMP-') ? a.id : '')).trim();
        const aEmpCode = String(a.employeeCode || a.code || '').trim();
        const aName = String(a.employeeName || a.name || '').trim().toLowerCase();

        const idMatches = (aEmpId && (aEmpId === empIdStr || aEmpId === empCodeStr)) ||
                          (aEmpCode && (aEmpCode === empIdStr || aEmpCode === empCodeStr));
        const nameMatches = aName && empNameLower && (aName === empNameLower || aName.includes(empNameLower) || empNameLower.includes(aName));

        const aNormDate = normalizeDate(a.date || a.logDate || a.punchDate);
        const dateMatches = aNormDate && aNormDate.startsWith(period);

        return (idMatches || nameMatches) && dateMatches;
      });

      // Daily attendance mapping from employee's embedded attendance
      const dailyMap = {};
      if (emp.attendance && typeof emp.attendance === 'object') {
        Object.entries(emp.attendance).forEach(([dayKey, rec]) => {
          const normKey = normalizeDate(dayKey);
          if (normKey && normKey.startsWith(period) && rec) {
            dailyMap[normKey] = { ...rec };
          }
        });
      }

      // Merge matched uploaded / Flash AM punches
      matchedLogs.forEach(log => {
        const logDate = normalizeDate(log.date || log.logDate || log.punchDate);
        if (logDate && logDate.startsWith(period)) {
          if (!dailyMap[logDate] || !dailyMap[logDate].userEdited) {
            dailyMap[logDate] = {
              ...(dailyMap[logDate] || {}),
              status: log.status || 'present',
              inTime: log.inTime || dailyMap[logDate]?.inTime,
              outTime: log.outTime || dailyMap[logDate]?.outTime,
              ot: parseFloat(log.ot || log.overtimeHours || dailyMap[logDate]?.ot || 0) || 0,
              fines: parseFloat(log.fines || log.fine || dailyMap[logDate]?.fines || 0) || 0,
              deductions: parseFloat(log.deductions || log.lateHours || dailyMap[logDate]?.deductions || 0) || 0
            };
          }
        }
      });

      // Approved Overtime Requests
      const empOtReqs = overtimeRequests.filter(req => {
        const reqEmpId = String(req.employeeId || '').trim();
        const reqEmpCode = String(req.employeeCode || '').trim();
        const reqName = String(req.employeeName || '').trim().toLowerCase();

        const idMatches = (reqEmpId && (reqEmpId === empIdStr || reqEmpId === empCodeStr)) ||
                          (reqEmpCode && (reqEmpCode === empIdStr || reqEmpCode === empCodeStr));
        const nameMatches = reqName && empNameLower && (reqName === empNameLower || reqName.includes(empNameLower) || empNameLower.includes(reqName));

        const reqDate = normalizeDate(req.date);
        return (idMatches || nameMatches) && req.status === 'Approved' && reqDate && reqDate.startsWith(period);
      });
      empOtReqs.forEach(r => {
        otHours += safeNum(r.hours);
      });

      // RULE: If employee has 0 attendance records for this month AND 0 approved OT, EXCLUDE!
      if (Object.keys(dailyMap).length === 0 && otHours === 0) {
        return null; // Skip employee with 0 attendance
      }

      // Aggregate mapped attendance (supports Flash AM 'Completed', 'Present', 'inTime', etc.)
      Object.values(dailyMap).forEach(rec => {
        const st = String(rec.status || '').toLowerCase().trim();
        const hasPunch = Boolean(rec.inTime || rec.outTime);

        if (st.includes('present') || st === 'completed' || st === 'p' || hasPunch) {
          workedDays += 1;
        } else if (st.includes('half')) {
          workedDays += 0.5;
          if (dutySettings?.attendanceStatusRules?.halfday?.isPaid !== false) {
            leavesCount += 0.5;
          }
        } else if (st.includes('offday') || st.includes('off day') || st === 'off') {
          if (dutySettings?.attendanceStatusRules?.offday?.isPaid !== false) {
            leavesCount += 1;
          } else {
            absentsCount += 1;
          }
        } else if (st.includes('holiday')) {
          if (dutySettings?.attendanceStatusRules?.holiday?.isPaid !== false) {
            leavesCount += 1;
          } else {
            absentsCount += 1;
          }
        } else if (st.includes('leave') || st === 'l' || st === 'paid_leave') {
          if (dutySettings?.attendanceStatusRules?.leave?.isPaid !== false) {
            leavesCount += 1;
          } else {
            absentsCount += 1;
          }
        } else if (st.includes('abs')) {
          absentsCount += 1;
        } else {
          workedDays += 1; // Default any positive activity as worked
        }

        otHours += safeNum(rec.ot);
        lateComingHours += safeNum(rec.deductions);
        totalFines += safeNum(rec.fines);
      });

      // (basic salary / current month days = 1 day amount / duty hours = 1 hours amount)
      const oneDayAmount = currentMonthDays > 0 ? (baseSalary / currentMonthDays) : 0;
      const dailyRate = oneDayAmount;

      // Duty Hours Resolution: HR Settings Employee Wise Custom Override -> Profile -> Dept -> Division -> Shift -> Standard
      const dutyInfo = getEffectiveDutyHours(emp, dutySettings);
      const empDutyHours = Number(dutyInfo?.hours) || 8;

      const oneHourAmount = empDutyHours > 0 ? (oneDayAmount / empDutyHours) : 0;
      const hourlyRate = oneHourAmount;

      // Overtime Multiplier & Hourly Rate strictly based on Hourly Rate
      const otMultiplier = getEffectiveOvertimeMultiplier(emp, dutySettings);
      const otHourlyRate = hourlyRate * otMultiplier;

      // Paid Days = Actual worked days + paid leaves
      const payableDays = Math.min(currentMonthDays, Math.max(0, workedDays + leavesCount));

      // If employee has 0 paid days and 0 worked days and 0 OT, exclude:
      if (payableDays === 0 && otHours === 0 && workedDays === 0) {
        return null;
      }

      // Absents Count = Remaining unworked days in the current month
      absentsCount = Math.max(0, currentMonthDays - payableDays);

      const earnedBasicSalary = Math.round(dailyRate * payableDays * 100) / 100;
      const absentDeduction = Math.round(dailyRate * absentsCount * 100) / 100;
      const otPay = Math.round(otHours * otHourlyRate * 100) / 100;
      const lateDeduction = Math.round(lateComingHours * hourlyRate * 100) / 100;

      // Loans & Advances
      let loanAmount = safeNum(emp.loan || emp.loanAmount);
      const activeLedgerItem = loanLedger.find(l => 
        (String(l.employeeId) === empIdStr || String(l.employeeCode || '') === empCodeStr || String(l.employeeName || '').toLowerCase() === empNameLower) && 
        l.status === 'Active' && 
        safeNum(l.remainingBalance) > 0
      );
      if (activeLedgerItem && activeLedgerItem.monthlyInstallment) {
        loanAmount = Math.min(safeNum(activeLedgerItem.monthlyInstallment), safeNum(activeLedgerItem.remainingBalance));
      } else {
        const activeLoanReq = loanRequests.find(r => 
          (String(r.employeeId) === empIdStr || String(r.employeeCode || '') === empCodeStr || String(r.employeeName || '').toLowerCase() === empNameLower) && r.status === 'Approved'
        );
        if (activeLoanReq && activeLoanReq.monthlyInstallment) {
          loanAmount = safeNum(activeLoanReq.monthlyInstallment);
        }
      }

      // Configured Employee Allowance Lookup (Default PKR 1,500)
      let customAllowanceLimit = 1500;
      try {
        const savedMap = localStorage.getItem('hr_employee_allowance_map');
        if (savedMap) {
          const parsed = JSON.parse(savedMap);
          if (parsed && (parsed[emp.id] !== undefined || parsed[emp.name] !== undefined)) {
            customAllowanceLimit = safeNum(parsed[emp.id] !== undefined ? parsed[emp.id] : parsed[emp.name]);
          } else if (emp.allowance !== undefined && emp.allowance !== null && Number(emp.allowance) > 0) {
            customAllowanceLimit = safeNum(emp.allowance);
          }
        } else if (emp.allowance !== undefined && emp.allowance !== null && Number(emp.allowance) > 0) {
          customAllowanceLimit = safeNum(emp.allowance);
        }
      } catch (e) {}

      // Attendance allowance rule: ZERO ABSENCES REQUIRED
      let allowanceAmount = 0;
      const isZeroAbsencesEnforced = salaryConfig?.attendanceAllowance?.zeroAbsences !== false; // Default true
      const isZeroLateEnforced = salaryConfig?.attendanceAllowance?.zeroLate === true;

      if (isZeroAbsencesEnforced) {
        if (absentsCount === 0 && payableDays >= currentMonthDays) {
          if (!isZeroLateEnforced || lateComingHours === 0) {
            allowanceAmount = customAllowanceLimit;
          }
        }
      } else {
        const allowedAbsences = safeNum(salaryConfig?.attendanceAllowance?.maxAbsencesAllowed || 0);
        if (absentsCount <= allowedAbsences && payableDays >= (currentMonthDays - allowedAbsences)) {
          if (!isZeroLateEnforced || lateComingHours === 0) {
            allowanceAmount = customAllowanceLimit;
          }
        }
      }

      const totalAdditions = otPay + allowanceAmount;
      const totalDeductions = lateDeduction + totalFines + loanAmount + safeNum(emp.advance);

      // Net Salary = Earned Basic Salary + Additions - Deductions
      const netSalary = Math.max(0, earnedBasicSalary + totalAdditions - totalDeductions);

      return {
        employeeId: emp.employeeCode || empIdStr || `EMP-${Date.now()}`,
        doj: doj,
        designation: designation,
        department: department,
        section: section,
        division: division,
        employeeName: emp.name || 'Employee',
        payableDays: payableDays,
        basicSalary: parseFloat(baseSalary.toFixed(2)),
        dailyRate: parseFloat(dailyRate.toFixed(2)),
        hourlyRate: parseFloat(hourlyRate.toFixed(2)),
        dutyHours: empDutyHours,
        currentMonthDays: currentMonthDays,
        otHours: parseFloat(otHours.toFixed(1)),
        otMultiplier: otMultiplier,
        otHourlyRate: parseFloat(otHourlyRate.toFixed(2)),
        overtime: parseFloat(otPay.toFixed(2)),
        lateComingHours: parseFloat(lateComingHours.toFixed(1)),
        lateDeduction: parseFloat(lateDeduction.toFixed(2)),
        absents: parseFloat(absentDeduction.toFixed(2)),
        absentsCount: absentsCount,
        workedDays: workedDays,
        leavesCount: leavesCount,
        totalWorkingDays: currentMonthDays,
        daysInMonth: currentMonthDays,
        fine: parseFloat(totalFines.toFixed(2)),
        allowance: parseFloat(allowanceAmount.toFixed(2)),
        advanceAmount: safeNum(emp.advance),
        loan: parseFloat(loanAmount.toFixed(2)),
        earnedBasicSalary: parseFloat(earnedBasicSalary.toFixed(2)),
        netSalary: parseFloat(netSalary.toFixed(2)),
        status: 'Calculated'
      };
    }).filter(Boolean);

    return results;
  };

  // Helper toast alert
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  // RULE: Fetch Data & Calculate Handler with mandatory division validation
    const runCalculationEngine = () => {
    const divToUse = selectedDivision || 'ALL';
    if (!payrollPeriod) {
      triggerToast('Please select a valid pending Payroll Period!');
      return;
    }

    setIsProcessing(true);
    const divLabel = divToUse === 'ALL' ? 'All Divisions' : `Division "${divToUse}"`;
    setProcessingMessage(`Fetching Attendance Management & App records for ${divLabel} in ${getPeriodLabel(payrollPeriod)}...`);

    setTimeout(() => {
      const computed = computePayrollForPeriod(payrollPeriod, divToUse);
      setLocalPayrollList(computed);
      setPayrollStatus('calculated');
      setIsProcessing(false);

      if (computed.length === 0) {
        triggerToast(`Notice: No active employees ${divToUse !== 'ALL' ? `in "${divToUse}"` : ''} have attendance recorded for ${getPeriodLabel(payrollPeriod)}.`);
      } else {
        triggerToast(`Calculated payroll for ${computed.length} employees with verified attendance (${divLabel})!`);
      }
    }, 900);
  };

  // Finalize payroll trigger: Validates > 0 Net Salary and opens Confirmation Modal
  const handleFinalizePayroll = () => {
    if (localPayrollList.length === 0) {
      triggerToast('⚠️ No payroll records available to finalize.');
      return;
    }

    // RULE: 0 net salary amount ho to salary generate nahi honi chahie, > 0 net amount ho gi to he generate ho gi
    if (summaryTotals.netPayout <= 0) {
      triggerToast('⚠️ Cannot finalize payroll with Net Payout of 0. Net amount must be greater than 0.');
      return;
    }

    // Open confirmation popup
    setIsFinalizeModalOpen(true);
  };

  // Execution after user confirms on confirmation popup
  const executeFinalizePayroll = () => {
    setIsFinalizeModalOpen(false);
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
        division: selectedDivision,
        status: 'Finalized',
        generatedAt: new Date().toISOString(),
        generatedBy: state.currentUser?.name || 'Administrator',
        records: finalizedRecords
      };

      setCollection('hr_generated_salaries', [...filterOtherMonths, finalizedMonthRecord]);
      setIsProcessing(false);
      triggerToast(`Payroll for ${getPeriodLabel(payrollPeriod)} has been finalized and saved to History!`);
    }, 1000);
  };

  // RULE: Delete generated payroll record
  // When deleted, that month returns to the Payroll Period dropdown automatically!
  const handleDeleteGeneratedMonth = (monthKey) => {
    const list = state.hr_generated_salaries || [];
    const updated = list.filter(item => item.month !== monthKey);
    setCollection('hr_generated_salaries', updated);

    // If viewing this record in detail modal, close it
    if (viewingHistoryRecord && viewingHistoryRecord.month === monthKey) {
      setViewingHistoryRecord(null);
    }
    setIsDeleteModalOpen(false);
    setMonthToDelete(null);

    const [year, month] = monthKey.split('-');
    const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const label = !isNaN(d.getTime()) ? d.toLocaleString('en-US', { month: 'long', year: 'numeric' }) : monthKey;

    triggerToast(`Payroll for ${label} has been deleted! It is now restored in the Payroll Period dropdown.`);
  };

  // Filter & Search & Sort List for "Payroll Detail View"
  const filteredList = useMemo(() => {
    if (localPayrollList.length === 0) return [];

    let list = [...localPayrollList];

    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => 
        (item.employeeName && item.employeeName.toLowerCase().includes(q)) ||
        (item.employeeId && item.employeeId.toLowerCase().includes(q)) ||
        (item.designation && item.designation.toLowerCase().includes(q)) ||
        (item.department && item.department.toLowerCase().includes(q)) ||
        (item.section && item.section.toLowerCase().includes(q))
      );
    }

    // 2. Quick Filter Keys
    if (quickFilter === 'WITH_OT') {
      list = list.filter(item => safeNum(item.otHours) > 0);
    } else if (quickFilter === 'WITH_DEDUCTIONS') {
      list = list.filter(item => (safeNum(item.lateDeduction) + safeNum(item.absents) + safeNum(item.fine) + safeNum(item.loan) + safeNum(item.advanceAmount)) > 0);
    } else if (quickFilter === 'FULL_ATTENDANCE') {
      list = list.filter(item => safeNum(item.absentsCount) === 0 && safeNum(item.payableDays) > 0);
    }

    // 3. Status Filter
    if (statusFilter === 'Calculated') {
      list = list.filter(item => item.status === 'Calculated');
    } else if (statusFilter === 'Finalized') {
      list = list.filter(item => item.status === 'Finalized');
    }

    // 4. Sorting Keys
    if (sortKey === 'az') {
      list.sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
    } else if (sortKey === 'za') {
      list.sort((a, b) => (b.employeeName || '').localeCompare(a.employeeName || ''));
    } else if (sortKey === 'highest_pay') {
      list.sort((a, b) => safeNum(b.netSalary) - safeNum(a.netSalary));
    } else if (sortKey === 'lowest_pay') {
      list.sort((a, b) => safeNum(a.netSalary) - safeNum(b.netSalary));
    } else if (sortKey === 'paid_days') {
      list.sort((a, b) => safeNum(b.payableDays) - safeNum(a.payableDays));
    } else if (sortKey === 'ot') {
      list.sort((a, b) => safeNum(b.otHours) - safeNum(a.otHours));
    }

    return list;
  }, [localPayrollList, selectedDivision, searchQuery, quickFilter, statusFilter, sortKey]);

  // Summary Totals for Header Cards strictly from filteredList
  // Exact 110% Formatted Salary Slip Data for HRPayslipModal
  const formattedDetailSlip = useMemo(() => {
    if (!selectedRecordForDetail) return null;
    const r = selectedRecordForDetail;
    const currentMonthDays = r.currentMonthDays || 30;

    const empIdStr = String(r.employeeId || '');
    const empNameLower = String(r.employeeName || '').toLowerCase().trim();
    const attendanceLogs = state.hr_uploaded_attendance || [];

    const [yStr, mStr] = (payrollPeriod || '').split('-');
    const y = parseInt(yStr) || 2026;
    const m = parseInt(mStr) || (new Date().getMonth() + 1);

    const allEmployees = state.hr_employees_list || [];
    const empObj = allEmployees.find(e => 
      (e.id && String(e.id).trim() === empIdStr) ||
      (e.employeeCode && String(e.employeeCode).trim() === empIdStr) ||
      (e.name && String(e.name).toLowerCase().trim() === empNameLower)
    );
    const empAttendance = empObj?.attendance || {};
    const overtimeRequests = state.hr_overtime_requests || [];

    const dailyRecords = [];
    for (let d = 1; d <= currentMonthDays; d++) {
      const dateStr = String(d).padStart(2, '0');
      const fullDate = `${y}-${String(m).padStart(2, '0')}-${dateStr}`;

      const dayRecord = empAttendance[fullDate] || empAttendance[`${y}-${m}-${d}`] || empAttendance[d] || null;

      const log = attendanceLogs.find(l => 
        (String(l.employeeId) === empIdStr || String(l.employeeCode || '') === empIdStr || String(l.employeeName || '').toLowerCase().trim() === empNameLower) &&
        (l.date === fullDate || (typeof normalizeDate === 'function' ? normalizeDate(l.date) === fullDate : l.date === fullDate))
      );

      const otReq = overtimeRequests.find(req => 
        req.status === 'Approved' &&
        (String(req.employeeId) === empIdStr || String(req.employeeCode || '') === empIdStr || String(req.employeeName || '').toLowerCase().trim() === empNameLower) &&
        (req.date === fullDate || (typeof normalizeDate === 'function' ? normalizeDate(req.date) === fullDate : req.date === fullDate))
      );

      let status = dayRecord?.status || log?.status;
      if (!status && log?.inTime) status = 'present';
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      if (!status) {
        if (dayOfWeek === 0) {
          status = 'off day';
        } else {
          status = 'absent';
        }
      }

      let att = 'ABS';
      const s = String(status || '').toLowerCase();
      if (s.includes('present') || s === 'p') att = 'P';
      else if (s.includes('offday') || s.includes('off day') || s === 'off') att = 'OFF';
      else if (s.includes('holiday')) att = 'HOL';
      else if (s.includes('leave') || s === 'l' || s === 'paid_leave') att = 'L';
      else if (s.includes('half')) att = 'HLD';
      else att = 'ABS';

      let otVal = parseFloat(dayRecord?.ot || log?.ot || log?.overtimeHours || otReq?.hours || 0) || 0;
      if (otReq && parseFloat(otReq.hours || 0) > 0) {
        otVal = Math.max(otVal, parseFloat(otReq.hours || 0));
      }
      const ot = otVal > 0 ? `+${otVal.toFixed(1)}h` : '-';

      let dtVal = parseFloat(dayRecord?.deductions || log?.dt || log?.lateHours || 0) || 0;
      const dt = dtVal > 0 ? `-${dtVal.toFixed(1)}h` : '-';

      const remarks = dayRecord?.remarks || log?.remarks || (att === 'OFF' || dayOfWeek === 0 ? 'Weekly Off' : (att === 'HOL' ? 'Public Holiday' : '-'));

      dailyRecords.push({ dateStr, att, ot, dt, remarks });
    }

    const otPay = safeNum(r.overtime);
    const allowances = safeNum(r.allowance);
    const absentDeduction = safeNum(r.absents);
    const dtDeduction = safeNum(r.lateDeduction);
    const fines = safeNum(r.fine);
    const advance = safeNum(r.advanceAmount);
    const loanInstallment = safeNum(r.loan);
    const netAdjustmentBalance = otPay + allowances - absentDeduction - dtDeduction - fines - advance - loanInstallment;

    return {
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      designation: r.designation || 'WORKER',
      department: r.department || 'Operations',
      shiftSchedule: r.shift || 'Standard',
      dutyHours: r.dutyHours || 8,
      basicSalary: r.basicSalary || 0,
      paidDays: r.payableDays || r.workedDays || 0,
      presentDays: r.workedDays || 0,
      currentMonthDays: currentMonthDays,
      periodMonthYear: getPeriodLabel(payrollPeriod).toUpperCase(),
      dailyRecords: dailyRecords,
      otHours: r.otHours || 0,
      otPay: otPay,
      dtHours: r.lateComingHours || 0,
      dtDeduction: dtDeduction,
      absentDays: r.absentsCount || 0,
      absentDeduction: absentDeduction,
      fines: fines,
      allowances: allowances,
      advance: advance,
      loanInstallment: loanInstallment,
      netAdjustmentBalance: netAdjustmentBalance,
      netSalary: r.netSalary || 0
    };
  }, [selectedRecordForDetail, payrollPeriod, state.hr_uploaded_attendance]);

  const summaryTotals = useMemo(() => {
    return filteredList.reduce((acc, cur) => {
      acc.netPayout += safeNum(cur.netSalary);
      acc.headcount += 1;
      acc.overtime += safeNum(cur.overtime);
      acc.deductions += (safeNum(cur.lateDeduction) + safeNum(cur.absents) + safeNum(cur.fine) + safeNum(cur.loan) + safeNum(cur.advanceAmount));
      return acc;
    }, { netPayout: 0, headcount: 0, overtime: 0, deductions: 0 });
  }, [filteredList]);

  // History Records List (Deduplicated by month)
  const historyRecords = useMemo(() => {
    const map = new Map();
    const list = state.hr_generated_salaries || [];
    list.forEach(item => {
      if (item && item.month) {
        map.set(item.month, item); // latest entry overwrites older
      }
    });

    let records = Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));

    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase().trim();
      records = records.filter(r => {
        const [year, month] = r.month.split('-');
        const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
        const label = !isNaN(d.getTime()) ? d.toLocaleString('en-US', { month: 'long', year: 'numeric' }) : r.month;
        return label.toLowerCase().includes(q) || r.month.includes(q) || (r.generatedBy && r.generatedBy.toLowerCase().includes(q));
      });
    }

    return records;
  }, [state.hr_generated_salaries, historySearchQuery]);

  // Visible Columns
  const visibleColumns = useMemo(() => columns.filter(col => col.visible), [columns]);

  const toggleColumnVisibility = (colId) => {
    setColumns(prev => prev.map(col => col.id === colId ? { ...col, visible: !col.visible } : col));
  };

  const handleDragStart = (e, colId) => {
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetColId) return;

    setColumns(prevCols => {
      const draggedIndex = prevCols.findIndex(c => c.id === draggedColId);
      const targetIndex = prevCols.findIndex(c => c.id === targetColId);
      if (draggedIndex === -1 || targetIndex === -1) return prevCols;

      const newCols = [...prevCols];
      const [removed] = newCols.splice(draggedIndex, 1);
      newCols.splice(targetIndex, 0, removed);
      return newCols;
    });

    setDraggedColId(null);
  };

  // EXPORT HANDLERS: Unified single dropdown for CSV, PDF, Image, Print
  const handleExportCSV = (record) => {
    if (!record || !Array.isArray(record.records) || record.records.length === 0) {
      triggerToast('⚠️ No records to export in CSV.');
      return;
    }

    const csvCols = [
      { key: 'sr', label: 'Sr#' },
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee Name' },
      { key: 'designation', label: 'Designation' },
      { key: 'department', label: 'Department' },
      { key: 'division', label: 'Division' },
      { key: 'payableDays', label: 'Paid Days' },
      { key: 'basicSalary', label: `Basic Salary (${currSym})` },
      { key: 'otHours', label: 'OT Hours' },
      { key: 'overtime', label: `OT Amount (${currSym})` },
      { key: 'lateComingHours', label: 'Late Deduction Hours' },
      { key: 'lateDeduction', label: `Late Deduction (${currSym})` },
      { key: 'absentsCount', label: 'Absent Days' },
      { key: 'absents', label: `Absent Deduction (${currSym})` },
      { key: 'fine', label: `Fine (${currSym})` },
      { key: 'allowance', label: `Allowance (${currSym})` },
      { key: 'advanceAmount', label: `Advance (${currSym})` },
      { key: 'loan', label: `Loan (${currSym})` },
      { key: 'netSalary', label: `Net Salary (${currSym})` },
      { key: 'status', label: 'Status' }
    ];

    const filename = `Payroll_Statement_${record.month}_${record.division || 'All'}.csv`;
    const success = exportDocumentToCsv(csvCols, record.records, filename);
    if (success) {
      triggerToast(`✅ CSV file saved: ${filename}`);
    }
    setHistoryExportDropdownMonth(null);
  };

  const handleExportPDF = async (record) => {
    if (!record || !Array.isArray(record.records) || record.records.length === 0) {
      triggerToast('⚠️ No records to export in PDF.');
      return;
    }

    setIsExporting(true);
    setExportTargetRecord(record);
    setHistoryExportDropdownMonth(null);

    setTimeout(async () => {
      try {
        const filename = `Payroll_Statement_${record.month}.pdf`;
        await exportDocumentToPdf('#payroll-statement-print-template', filename, {
          paperSize: 'a4',
          orientation: 'landscape'
        });
        triggerToast(`✅ PDF successfully saved: ${filename}`);
      } catch (err) {
        console.error(err);
        triggerToast('Failed to export PDF.');
      } finally {
        setIsExporting(false);
      }
    }, 400);
  };

  const handleExportImage = async (record) => {
    if (!record || !Array.isArray(record.records) || record.records.length === 0) {
      triggerToast('⚠️ No records to export as image.');
      return;
    }

    setIsExporting(true);
    setExportTargetRecord(record);
    setHistoryExportDropdownMonth(null);

    setTimeout(async () => {
      try {
        const filename = `Payroll_Statement_${record.month}.png`;
        await exportDocumentToImage('#payroll-statement-print-template', filename);
        triggerToast(`✅ Image successfully saved: ${filename}`);
      } catch (err) {
        console.error(err);
        triggerToast('Failed to export image.');
      } finally {
        setIsExporting(false);
      }
    }, 400);
  };

  const handlePrintRecord = (record) => {
    if (!record || !Array.isArray(record.records) || record.records.length === 0) {
      triggerToast('⚠️ No records to print.');
      return;
    }
    setHistoryExportDropdownMonth(null);
    setExportTargetRecord(record);

    setTimeout(() => {
      const printContent = document.getElementById('payroll-statement-print-template');
      if (!printContent) {
        window.print();
        return;
      }
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Payroll Statement - ${record.month}</title>
            <style>
              @page { size: A4 landscape; margin: 10mm; }
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 10px; color: #111827; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 15px; }
              th, td { border: 1px solid #d1d5db; padding: 5px 8px; }
              th { background-color: #f3f4f6; text-transform: uppercase; font-size: 10px; font-weight: 700; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .font-bold { font-weight: 700; }
              .header { border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; }
              .company-title { font-size: 18px; font-weight: 900; color: #1e3a8a; }
              .sub-title { font-size: 13px; font-weight: 600; color: #4b5563; }
              .kpi-box { display: flex; gap: 15px; margin: 10px 0; }
              .kpi { border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 12px; background: #f9fafb; font-size: 11px; }
              .signatures { margin-top: 35px; display: flex; justify-content: space-between; font-size: 11px; }
              .sig-line { border-top: 1px solid #9ca3af; width: 180px; text-align: center; padding-top: 5px; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }, 300);
  };

  return (
    <div className="space-y-6 pb-20 max-w-full overflow-x-hidden">

      {/* Top Banner & Sub-Tabs Navigation */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/30 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[26px]">account_balance</span>
            <h2 className="text-xl font-black text-on-surface tracking-tight font-headline">Salary Generation & Payroll</h2>
          </div>
          <p className="text-xs text-on-surface-variant font-medium mt-1">
            Real-time biometric attendance calculations, allowances, automated deductions, and finalized history archive.
          </p>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center p-1 bg-surface-container-low rounded-xl border border-outline-variant/20 self-stretch sm:self-auto">
          <button
            onClick={() => setActiveSubTab('generate')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'generate'
                ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/20'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">sync</span>
            Generate Salary
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/20'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">history</span>
            Payroll History
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary">
              {historyRecords.length}
            </span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-[300] bg-on-surface text-surface px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold border border-outline-variant animate-in slide-in-from-top-4 duration-300">
          <span className="material-symbols-outlined text-primary text-[20px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Processing Loader Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-on-surface/30 backdrop-blur-sm z-[250] flex flex-col items-center justify-center p-4">
          <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-md w-full border border-outline-variant/30 text-center animate-in zoom-in-95">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <h4 className="text-base font-bold text-on-surface font-headline">Processing Payroll Engine</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">{processingMessage}</p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: GENERATE SALARY VIEW                               */}
      {/* ========================================================= */}
      {activeSubTab === 'generate' && (
        <>
          {/* Header, Period Picker & Division Filter */}
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
            
            <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
              {/* Payroll Period */}
              <div className="space-y-2 min-w-[220px]">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                  Payroll Period (Attendance Synced)
                </label>
                <div className="relative w-full">
                  <select 
                    value={payrollPeriod}
                    onChange={(e) => setPayrollPeriod(e.target.value)}
                    className="w-full h-11 pl-4 pr-10 text-sm border border-outline-variant rounded-xl bg-surface-container-lowest hover:border-primary transition-colors focus:border-primary focus:ring-4 focus:ring-primary/10 appearance-none cursor-pointer font-medium text-on-surface"
                  >
                    {monthsList.length === 0 ? (
                      <option value="" disabled>No pending attendance months available</option>
                    ) : (
                      monthsList.map(m => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))
                    )}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-outline">calendar_month</span>
                </div>
              </div>

              {/* Division Dropdown: Har dafa select kerna pare, no default */}
              <div className="space-y-2 min-w-[220px]">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">
                  Division Filter <span className="text-error">*</span>
                </label>
                <div className="relative w-full">
                  <select 
                    value={selectedDivision}
                    onChange={(e) => {
                      setSelectedDivision(e.target.value);
                      setLocalPayrollList([]); // Reset until fetched
                    }}
                    className="w-full h-11 pl-4 pr-10 text-sm border rounded-xl bg-surface-container-lowest transition-colors focus:ring-4 focus:ring-primary/10 appearance-none cursor-pointer font-medium text-on-surface border-outline-variant hover:border-primary focus:border-primary"
                  >
                    <option value="ALL">🏢 All Divisions (Whole Company)</option>
                    {availableDivisions.filter(d => d !== 'ALL').map(div => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-outline">apartment</span>
                </div>
              </div>
            </div>

            {/* Fetch Data & Calculate Button: Bina division select kiye kam nahi karega */}
            <div className="flex flex-wrap gap-3 w-full lg:w-auto">
              <button 
                onClick={runCalculationEngine}
                disabled={isProcessing || !payrollPeriod}
                title={!selectedDivision ? 'Please select a Division first' : 'Fetch Attendance & Calculate Salary'}
                className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 h-11 rounded-xl shadow-sm text-xs font-bold transition-all ${
                  !selectedDivision || !payrollPeriod
                    ? 'bg-neutral-300 dark:bg-neutral-700 text-neutral-500 cursor-not-allowed opacity-60'
                    : 'bg-primary text-on-primary hover:bg-primary-container active:scale-[0.98] cursor-pointer'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                Fetch Data & Calculate
              </button>
            </div>
          </section>

          {/* Informative Banner when no period is selected */}
          {!payrollPeriod && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3 text-xs text-on-surface font-medium">
              <span className="material-symbols-outlined text-primary text-[22px]">info</span>
              <span>
                Please select a <strong>Payroll Period</strong> above and click <strong>Fetch Data & Calculate</strong> to calculate monthly salaries for active staff.
              </span>
            </div>
          )}

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
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Paid Headcount</span>
              </div>
              <p className="text-2xl font-black text-on-surface tracking-tight font-headline">
                {summaryTotals.headcount}
              </p>
              <p className="text-[10px] text-on-surface-variant mt-1.5">
                {selectedDivision === 'ALL' ? 'Active with attendance across all divisions' : `Active with attendance in ${selectedDivision}`}
              </p>
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
            
            {/* Table Header Filter, Search Bar & Quick Filters */}
            <div className="p-5 border-b border-outline-variant/10 space-y-4 bg-surface-container-lowest">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-lg font-bold text-on-surface font-headline">Payroll Detail View</h4>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-bold">
                      <span className="material-symbols-outlined text-[13px]">calculate</span>
                      Formula: (Basic ÷ Days = 1d Rate) ÷ Duty Hrs = 1h Rate
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {`Showing active employees for ${selectedDivision === 'ALL' ? 'All Divisions' : `Division: ${selectedDivision}`} in ${getPeriodLabel(payrollPeriod)}`}
                  </p>
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

              {/* SEARCH BAR & FILTER KEYS ROW */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-outline-variant/10">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, ID, designation, department..."
                    className="w-full h-10 pl-9 pr-8 text-xs border border-outline-variant/40 rounded-xl bg-surface-container-low hover:border-primary focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/10 transition-all font-medium text-on-surface"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-outline hover:text-on-surface cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>

                {/* Filter Keys / Sorting Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Sort:</span>
                  
                  {/* Alphabetical A-Z */}
                  <button
                    onClick={() => setSortKey('az')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      sortKey === 'az'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                    title="Sort Alphabetically A to Z"
                  >
                    <span>A → Z</span>
                  </button>

                  {/* Alphabetical Z-A */}
                  <button
                    onClick={() => setSortKey('za')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      sortKey === 'za'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                    title="Sort Alphabetically Z to A"
                  >
                    <span>Z → A</span>
                  </button>

                  {/* Paid Days Sort */}
                  <button
                    onClick={() => setSortKey('paid_days')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      sortKey === 'paid_days'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                    title="Sort by Most Paid Days"
                  >
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    <span>Paid Days</span>
                  </button>

                  {/* Highest Salary */}
                  <button
                    onClick={() => setSortKey('highest_pay')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      sortKey === 'highest_pay'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                    title="Sort by Highest Net Salary"
                  >
                    <span>Highest Pay</span>
                  </button>

                  {/* Quick Filter: All vs OT vs Deductions */}
                  <div className="h-4 w-px bg-outline-variant/30 mx-1 hidden sm:block" />
                  
                  <button
                    onClick={() => setQuickFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      quickFilter === 'ALL'
                        ? 'bg-surface-container-high text-on-surface border border-outline-variant/30 font-black'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    All ({localPayrollList.length})
                  </button>

                  <button
                    onClick={() => setQuickFilter('WITH_OT')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      quickFilter === 'WITH_OT'
                        ? 'bg-secondary/15 text-secondary border border-secondary/30'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    With OT
                  </button>

                  <button
                    onClick={() => setQuickFilter('WITH_DEDUCTIONS')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      quickFilter === 'WITH_DEDUCTIONS'
                        ? 'bg-error/15 text-error border border-error/30'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Deductions
                  </button>

                  <button
                    onClick={() => setQuickFilter('FULL_ATTENDANCE')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      quickFilter === 'FULL_ATTENDANCE'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Full Month
                  </button>

                </div>
              </div>
            </div>

            {/* Dynamic Resizable Table */}
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
                          col.numeric ? (col.align === 'center' ? 'text-center' : 'text-right') : 'text-left'
                        }`}
                      >
                        <div className={`flex items-center gap-1 ${col.align === 'center' ? 'justify-center' : (col.numeric ? 'justify-end' : 'justify-between')}`}>
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
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-outline-variant/10">
                  {localPayrollList.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.length + 1} className="text-center py-16 text-sm text-on-surface-variant font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-[36px] text-primary/40">sync_alt</span>
                          <p className="font-bold text-on-surface">Click &quot;Fetch Data &amp; Calculate&quot; above to calculate salaries for this period.</p>
                          <p className="text-xs text-on-surface-variant">All employees with attendance recorded in Flash AM app or Attendance Management will be processed.</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.length + 1} className="text-center py-16 text-sm text-on-surface-variant font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-[36px] text-outline/40">search_off</span>
                          <p className="font-bold text-on-surface">
                            {localPayrollList.length === 0 
                              ? 'No records calculated yet. Click "Fetch Data & Calculate" above.' 
                              : 'No employee records match the active search / filter criteria.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((req) => (
                      <tr key={req.employeeId} className="hover:bg-primary/5 transition-colors group">
                        {visibleColumns.map((col) => {
                          // Dedicated Paid Days Column
                          if (col.id === 'payableDays') {
                            return (
                              <td key={col.id} className="p-3.5 text-center">
                                <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                  {req.payableDays ?? req.workedDays ?? 0} d
                                </span>
                              </td>
                            );
                          }

                          if (col.id === 'employeeName') {
                            return (
                              <td key={col.id} className="p-3.5 text-left font-bold text-on-surface">
                                <div className="truncate">{req.employeeName}</div>
                              </td>
                            );
                          }

                          if (col.id === 'netSalary') {
                            return (
                              <td key={col.id} className="p-3.5 text-right font-black text-primary font-headline">
                                {currSym} {safeMoney(req.netSalary)}
                              </td>
                            );
                          }

                          return (
                            <td 
                              key={col.id} 
                              style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}
                              className={`p-3.5 text-xs ${col.numeric ? (col.align === 'center' ? 'text-center' : 'text-right') : 'text-left'} ${
                                col.id === 'basicSalary' ? 'font-bold text-on-surface' : 'text-on-surface-variant'
                              }`}
                            >
                              {col.numeric && col.id !== 'otHours' && col.id !== 'lateComingHours'
                                ? `${currSym} ${safeMoney(req[col.id])}`
                                : req[col.id]}
                            </td>
                          );
                        })}
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => setSelectedRecordForDetail(req)}
                            className="p-1.5 rounded-lg hover:bg-surface-container-high text-primary hover:text-primary-container transition-colors cursor-pointer"
                            title="View Individual Salary Slip"
                          >
                            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Footer Totals */}
                {filteredList.length > 0 && (
                  <tfoot>
                    <tr className="bg-surface-container-low font-bold text-xs text-on-surface border-t border-outline-variant/30">
                      {visibleColumns.map((col, idx) => {
                        if (idx === 0) return <td key={col.id} className="p-3.5 text-left font-black">Totals:</td>;
                        if (col.id === 'payableDays') {
                          const totalPaidDays = filteredList.reduce((acc, c) => acc + safeNum(c.payableDays), 0);
                          return <td key={col.id} className="p-3.5 text-center font-black">{totalPaidDays} d</td>;
                        }
                        if (col.id === 'netSalary') {
                          return <td key={col.id} className="p-3.5 text-right font-black text-primary font-headline">{currSym} {safeMoney(summaryTotals.netPayout)}</td>;
                        }
                        if (col.numeric) {
                          const colSum = filteredList.reduce((acc, c) => acc + safeNum(c[col.id]), 0);
                          return (
                            <td key={col.id} className="p-3.5 text-right font-black">
                              {col.id === 'otHours' || col.id === 'lateComingHours' ? colSum.toFixed(1) : `${currSym} ${safeMoney(colSum)}`}
                            </td>
                          );
                        }
                        return <td key={col.id} className="p-3.5" />;
                      })}
                      <td className="p-3.5" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          {/* Bottom Finalize Bar */}
          {filteredList.length > 0 && payrollStatus !== 'finalized' && (
            <footer className="p-5 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[24px]">lock_clock</span>
                <div>
                  <h5 className="text-xs font-bold text-on-surface uppercase tracking-wider">Ready for Finalization</h5>
                  <p className="text-[11px] text-on-surface-variant">
                    Finalizing will lock these {filteredList.length} verified attendance records and archive them into Payroll History.
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
        </>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PAYROLL HISTORY VIEW (Save As PDF/CSV/IMG, Delete)  */}
      {/* ========================================================= */}
      {activeSubTab === 'history' && (
        <section className="space-y-6 animate-in fade-in duration-200">
          
          {/* History Header Toolbar */}
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-lg font-bold text-on-surface font-headline">Finalized Payroll History</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">
                View, export (PDF, CSV, Image, Print), or delete finalized monthly salary records.
              </p>
            </div>

            {/* History Search Bar */}
            <div className="relative w-full md:w-72">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">search</span>
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="Search history by month..."
                className="w-full h-10 pl-9 pr-8 text-xs border border-outline-variant rounded-xl bg-surface-container-low hover:border-primary focus:border-primary focus:bg-surface-container-lowest transition-all font-medium text-on-surface"
              />
              {historySearchQuery && (
                <button
                  onClick={() => setHistorySearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-outline hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          </div>

          {/* History Records Cards / Table */}
          {historyRecords.length === 0 ? (
            <div className="bg-surface-container-lowest p-12 rounded-xl border border-outline-variant/30 text-center space-y-3">
              <span className="material-symbols-outlined text-[48px] text-outline/40">history_toggle_off</span>
              <h4 className="text-base font-bold text-on-surface">No Payroll History Available</h4>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                No finalized payroll records exist yet. Once you calculate and click "Generate & Finalize Payroll", records will appear here with full export and management options.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {historyRecords.map((hist) => {
                const [year, month] = hist.month.split('-');
                const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
                const monthTitle = !isNaN(d.getTime()) ? d.toLocaleString('en-US', { month: 'long', year: 'numeric' }) : hist.month;

                const records = Array.isArray(hist.records) ? hist.records : [];
                const totalNet = records.reduce((acc, r) => acc + safeNum(r.netSalary), 0);
                const totalOT = records.reduce((acc, r) => acc + safeNum(r.overtime), 0);
                const totalDeduct = records.reduce((acc, r) => acc + (safeNum(r.lateDeduction) + safeNum(r.absents) + safeNum(r.fine) + safeNum(r.loan) + safeNum(r.advanceAmount)), 0);
                const isDropdownOpen = historyExportDropdownMonth === hist.month;

                return (
                  <div 
                    key={hist.month}
                    className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-sm hover:border-primary/40 transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
                  >
                    {/* Left Month Details */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="p-2.5 rounded-xl bg-primary/10 text-primary material-symbols-outlined text-[24px]">calendar_month</span>
                        <div>
                          <h4 className="text-lg font-black text-on-surface font-headline">{monthTitle}</h4>
                          <p className="text-[11px] text-on-surface-variant font-semibold">
                            Period Key: {hist.month} {hist.division ? `• Division: ${hist.division}` : ''}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          {hist.status || 'Finalized'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-on-surface-variant pt-1">
                        <span>Generated: <strong>{hist.generatedAt ? new Date(hist.generatedAt).toLocaleDateString() : 'Recorded'}</strong></span>
                        <span>Processed by: <strong>{hist.generatedBy || 'Administrator'}</strong></span>
                        <span>Employees: <strong>{records.length}</strong></span>
                      </div>
                    </div>

                    {/* Middle Financial Stats */}
                    <div className="grid grid-cols-3 gap-4 border-y lg:border-y-0 lg:border-x border-outline-variant/15 py-3 lg:py-0 lg:px-6 w-full lg:w-auto">
                      <div>
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Net Disbursed</span>
                        <p className="text-base font-black text-primary font-headline mt-0.5">
                          {currSym} {safeMoney(totalNet)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Overtime</span>
                        <p className="text-base font-bold text-secondary font-headline mt-0.5">
                          {currSym} {safeMoney(totalOT)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Deductions</span>
                        <p className="text-base font-bold text-error font-headline mt-0.5">
                          {currSym} {safeMoney(totalDeduct)}
                        </p>
                      </div>
                    </div>

                    {/* Right Actions: View Details, Single Organized Save As Dropdown, Delete */}
                    <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
                      
                      {/* View Details Button */}
                      <button
                        onClick={() => setViewingHistoryRecord(hist)}
                        className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface text-xs font-bold border border-outline-variant/30 transition-all cursor-pointer"
                        title="View Full Month Details"
                      >
                        <span className="material-symbols-outlined text-[17px] text-primary">visibility</span>
                        View Details
                      </button>

                      {/* UNIFIED "SAVE AS" DROPDOWN BUTTON (PDF, CSV, Image, Print) */}
                      <div className="relative" ref={isDropdownOpen ? exportDropdownRef : null}>
                        <button
                          type="button"
                          onClick={() => setHistoryExportDropdownMonth(isDropdownOpen ? null : hist.month)}
                          className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-bold shadow-sm transition-all cursor-pointer"
                          title="Save or Export Payroll"
                        >
                          <span className="material-symbols-outlined text-[17px]">download</span>
                          Save As
                          <span className="material-symbols-outlined text-[15px]">expand_more</span>
                        </button>

                        {/* Dropdown Menu Popover */}
                        {isDropdownOpen && (
                          <div className="absolute right-0 top-full mt-2 w-52 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-2xl z-[160] p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                            
                            {/* Save as PDF */}
                            <button
                              onClick={() => handleExportPDF(hist)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-primary/5 text-xs font-semibold text-on-surface transition-colors cursor-pointer text-left"
                            >
                              <span className="material-symbols-outlined text-red-500 text-[18px]">picture_as_pdf</span>
                              Save as PDF
                            </button>

                            {/* Save as CSV */}
                            <button
                              onClick={() => handleExportCSV(hist)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-primary/5 text-xs font-semibold text-on-surface transition-colors cursor-pointer text-left"
                            >
                              <span className="material-symbols-outlined text-emerald-600 text-[18px]">table_chart</span>
                              Save as CSV
                            </button>

                            {/* Save as Image */}
                            <button
                              onClick={() => handleExportImage(hist)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-primary/5 text-xs font-semibold text-on-surface transition-colors cursor-pointer text-left"
                            >
                              <span className="material-symbols-outlined text-blue-500 text-[18px]">image</span>
                              Save as Image
                            </button>

                            {/* Print */}
                            <button
                              onClick={() => handlePrintRecord(hist)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-primary/5 text-xs font-semibold text-on-surface transition-colors cursor-pointer text-left"
                            >
                              <span className="material-symbols-outlined text-amber-600 text-[18px]">print</span>
                              Print Statement
                            </button>

                          </div>
                        )}
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={() => {
                          setMonthToDelete(hist.month);
                          setIsDeleteModalOpen(true);
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl border border-error/20 bg-error/5 hover:bg-error/15 text-error transition-all cursor-pointer"
                        title="Delete Payroll Record (Restores to Dropdown)"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </section>
      )}

      {/* ========================================================= */}
      {/* HISTORY DETAILS MODAL (When clicking "View Details")       */}
      {/* ========================================================= */}
      {viewingHistoryRecord && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-6xl w-full max-h-[92vh] rounded-3xl border border-outline-variant/30 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-outline-variant/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-low/30">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[24px]">receipt_long</span>
                  <h3 className="text-xl font-black text-on-surface font-headline">
                    Payroll Statement - {getPeriodLabel(viewingHistoryRecord.month)}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    {viewingHistoryRecord.status}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant font-medium mt-1">
                  Finalized on {viewingHistoryRecord.generatedAt ? new Date(viewingHistoryRecord.generatedAt).toLocaleString() : 'N/A'} • Processed by {viewingHistoryRecord.generatedBy}
                </p>
              </div>

              {/* Modal Top Actions */}
              <div className="flex items-center gap-2">
                {/* Save As Single Button inside Modal */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setHistoryExportDropdownMonth(historyExportDropdownMonth === 'modal' ? null : 'modal')}
                    className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[17px]">download</span>
                    Save As
                    <span className="material-symbols-outlined text-[15px]">expand_more</span>
                  </button>

                  {historyExportDropdownMonth === 'modal' && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-2xl z-[260] p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      <button
                        onClick={() => handleExportPDF(viewingHistoryRecord)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-primary/5 text-xs font-semibold text-on-surface cursor-pointer text-left"
                      >
                        <span className="material-symbols-outlined text-red-500 text-[18px]">picture_as_pdf</span>
                        Save as PDF
                      </button>
                      <button
                        onClick={() => handleExportCSV(viewingHistoryRecord)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-primary/5 text-xs font-semibold text-on-surface cursor-pointer text-left"
                      >
                        <span className="material-symbols-outlined text-emerald-600 text-[18px]">table_chart</span>
                        Save as CSV
                      </button>
                      <button
                        onClick={() => handleExportImage(viewingHistoryRecord)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-primary/5 text-xs font-semibold text-on-surface cursor-pointer text-left"
                      >
                        <span className="material-symbols-outlined text-blue-500 text-[18px]">image</span>
                        Save as Image
                      </button>
                      <button
                        onClick={() => handlePrintRecord(viewingHistoryRecord)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-primary/5 text-xs font-semibold text-on-surface cursor-pointer text-left"
                      >
                        <span className="material-symbols-outlined text-amber-600 text-[18px]">print</span>
                        Print Statement
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setViewingHistoryRecord(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Modal Body - Full Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* Quick Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-surface-container-low p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Headcount</span>
                  <p className="text-xl font-black text-on-surface font-headline mt-1">
                    {(viewingHistoryRecord.records || []).length}
                  </p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Total Net Payout</span>
                  <p className="text-xl font-black text-primary font-headline mt-1">
                    {currSym} {safeMoney((viewingHistoryRecord.records || []).reduce((acc, r) => acc + safeNum(r.netSalary), 0))}
                  </p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Total Overtime</span>
                  <p className="text-xl font-bold text-secondary font-headline mt-1">
                    {currSym} {safeMoney((viewingHistoryRecord.records || []).reduce((acc, r) => acc + safeNum(r.overtime), 0))}
                  </p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Total Deductions</span>
                  <p className="text-xl font-bold text-error font-headline mt-1">
                    {currSym} {safeMoney((viewingHistoryRecord.records || []).reduce((acc, r) => acc + (safeNum(r.lateDeduction) + safeNum(r.absents) + safeNum(r.fine) + safeNum(r.loan) + safeNum(r.advanceAmount)), 0))}
                  </p>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-outline-variant/20 rounded-xl custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px]">
                    <tr>
                      <th className="p-3">Sr#</th>
                      <th className="p-3">Employee ID</th>
                      <th className="p-3">Employee Name</th>
                      <th className="p-3">Designation</th>
                      <th className="p-3">Department</th>
                      <th className="p-3 text-center">Paid Days</th>
                      <th className="p-3 text-right">Basic Salary</th>
                      <th className="p-3 text-right">OT Pay</th>
                      <th className="p-3 text-right">Deductions</th>
                      <th className="p-3 text-right">Net Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {(viewingHistoryRecord.records || []).map((row, idx) => {
                      const deductions = safeNum(row.lateDeduction) + safeNum(row.absents) + safeNum(row.fine) + safeNum(row.loan) + safeNum(row.advanceAmount);
                      return (
                        <tr key={row.employeeId || idx} className="hover:bg-primary/5 transition-colors">
                          <td className="p-3 text-on-surface-variant">{idx + 1}</td>
                          <td className="p-3 font-semibold text-on-surface-variant">{row.employeeId}</td>
                          <td className="p-3 font-bold text-on-surface">{row.employeeName}</td>
                          <td className="p-3 text-on-surface-variant">{row.designation}</td>
                          <td className="p-3 text-on-surface-variant">{row.department}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                              {row.payableDays ?? row.workedDays ?? 0} d
                            </span>
                          </td>
                          <td className="p-3 text-right">{currSym} {safeMoney(row.basicSalary)}</td>
                          <td className="p-3 text-right text-secondary font-semibold">{currSym} {safeMoney(row.overtime)}</td>
                          <td className="p-3 text-right text-error font-semibold">-{currSym} {safeMoney(deductions)}</td>
                          <td className="p-3 text-right font-black text-primary font-headline">{currSym} {safeMoney(row.netSalary)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-surface-container-low/40 border-t border-outline-variant/15 flex justify-end">
              <button
                onClick={() => setViewingHistoryRecord(null)}
                className="px-6 py-2.5 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container-highest cursor-pointer transition-colors"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FINALIZE CONFIRMATION MODAL                                */}
      {/* ========================================================= */}
      {isFinalizeModalOpen && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-3xl border border-outline-variant/30 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-primary/10 text-primary material-symbols-outlined text-[26px]">
                verified_user
              </span>
              <div>
                <h4 className="text-base font-black text-on-surface font-headline">Confirm Payroll Finalization</h4>
                <p className="text-[11px] text-on-surface-variant font-medium">Please review payroll summary before locking.</p>
              </div>
            </div>

            {/* Summary details */}
            <div className="bg-surface-container-low p-4 rounded-2xl space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant font-semibold">Payroll Period:</span>
                <span className="font-bold text-on-surface">{getPeriodLabel(payrollPeriod)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant font-semibold">Division:</span>
                <span className="font-bold text-on-surface">{selectedDivision || 'All'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant font-semibold">Paid Staff Count:</span>
                <span className="font-bold text-on-surface">{summaryTotals.headcount} Employees</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant font-semibold">Total Overtime:</span>
                <span className="font-bold text-secondary">{currSym} {safeMoney(summaryTotals.overtime)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant font-semibold">Total Deductions:</span>
                <span className="font-bold text-error">-{currSym} {safeMoney(summaryTotals.deductions)}</span>
              </div>
              <div className="pt-2 border-t border-outline-variant/20 flex justify-between items-center">
                <span className="text-sm font-black text-on-surface">Total Net Disbursal:</span>
                <span className="text-base font-black text-primary font-headline">
                  {currSym} {safeMoney(summaryTotals.netPayout)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Are you sure you want to lock and finalize this payroll? Once finalized, it will be safely archived into <strong>Payroll History</strong> with printable vouchers.
            </p>

            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setIsFinalizeModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-outline-variant text-on-surface hover:bg-surface-container-low cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeFinalizePayroll}
                className="px-6 py-2.5 rounded-xl text-xs font-black bg-primary text-on-primary hover:bg-primary-container shadow-md cursor-pointer transition-all active:scale-[0.98] flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Confirm & Finalize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DELETE CONFIRMATION MODAL                                  */}
      {/* ========================================================= */}
      {isDeleteModalOpen && monthToDelete && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl border border-outline-variant/30 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-error">
              <span className="p-2.5 rounded-xl bg-error/10 material-symbols-outlined text-[24px]">warning</span>
              <h4 className="text-base font-bold text-on-surface font-headline">Delete Generated Payroll?</h4>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Are you sure you want to delete the finalized payroll record for <strong>{getPeriodLabel(monthToDelete)}</strong>?
            </p>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-900 dark:text-amber-300 font-medium">
              💡 <strong>Automatic Restoration:</strong> Deleting this record will remove it from History and immediately restore <strong>{getPeriodLabel(monthToDelete)}</strong> in the <strong>Payroll Period dropdown</strong> so you can recalculate and regenerate it anytime!
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setMonthToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-outline-variant text-on-surface hover:bg-surface-container-low cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteGeneratedMonth(monthToDelete)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-error text-on-error hover:bg-error-container shadow-sm cursor-pointer transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* OFFICIAL 31-DAY PAYSLIP MODAL (Screenshot 4 Required Template) */}
      {/* ========================================================= */}
      <HRPayslipModal
        isOpen={Boolean(selectedRecordForDetail)}
        onClose={() => setSelectedRecordForDetail(null)}
        slip={formattedDetailSlip}
      />

      {/* ========================================================= */}
      {/* HIDDEN PRINT / PDF / IMAGE STATEMENT EXPORT TEMPLATE       */}
      {/* ========================================================= */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div 
          id="payroll-statement-print-template" 
          ref={printStatementRef} 
          style={{ width: '1120px', padding: '24px', backgroundColor: '#ffffff', color: '#111827', fontFamily: 'Arial, sans-serif' }}
        >
          {exportTargetRecord && (
            <div>
              {/* Company Letterhead */}
              <div style={{ borderBottom: '2.5px solid #2563eb', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#1e3a8a', letterSpacing: '-0.5px' }}>
                    FLASHVISION ERP
                  </h1>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 700, color: '#4b5563' }}>
                    OFFICIAL MONTHLY SALARY STATEMENT / PAYROLL SHEET
                  </h3>
                </div>
                <div style={{ textAlign: 'right', fontSize: '11px', color: '#6b7280' }}>
                  <p style={{ margin: 0 }}><strong>Period:</strong> {getPeriodLabel(exportTargetRecord.month)}</p>
                  <p style={{ margin: '2px 0 0 0' }}><strong>Generated Date:</strong> {new Date().toLocaleDateString()}</p>
                  <p style={{ margin: '2px 0 0 0' }}><strong>Division:</strong> {exportTargetRecord.division || 'All Divisions'}</p>
                </div>
              </div>

              {/* Financial KPI Summary Bar */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', background: '#f9fafb' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Headcount</span>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#111827', marginTop: '2px' }}>
                    {(exportTargetRecord.records || []).length} Staff
                  </div>
                </div>
                <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', background: '#f9fafb' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Total Net Disbursed</span>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#2563eb', marginTop: '2px' }}>
                    {currSym} {safeMoney((exportTargetRecord.records || []).reduce((acc, r) => acc + safeNum(r.netSalary), 0))}
                  </div>
                </div>
                <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', background: '#f9fafb' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Total Overtime</span>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
                    {currSym} {safeMoney((exportTargetRecord.records || []).reduce((acc, r) => acc + safeNum(r.overtime), 0))}
                  </div>
                </div>
                <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px', background: '#f9fafb' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700 }}>Total Deductions</span>
                  <div style={{ fontSize: '16px', fontWeight: 900, color: '#dc2626', marginTop: '2px' }}>
                    {currSym} {safeMoney((exportTargetRecord.records || []).reduce((acc, r) => acc + (safeNum(r.lateDeduction) + safeNum(r.absents) + safeNum(r.fine) + safeNum(r.loan) + safeNum(r.advanceAmount)), 0))}
                  </div>
                </div>
              </div>

              {/* Full Statement Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'left' }}>Sr#</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'left' }}>Emp ID</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'left' }}>Employee Name</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'left' }}>Designation</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'left' }}>Department</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'center' }}>Paid Days</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'right' }}>Basic Salary</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'right' }}>OT (Hrs)</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'right' }}>OT Pay</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'right' }}>Deductions</th>
                    <th style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'right' }}>Net Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {(exportTargetRecord.records || []).map((row, idx) => {
                    const deduct = safeNum(row.lateDeduction) + safeNum(row.absents) + safeNum(row.fine) + safeNum(row.loan) + safeNum(row.advanceAmount);
                    return (
                      <tr key={row.employeeId || idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                        <td style={{ border: '1px solid #e5e7eb', padding: '5px 8px' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '5px 8px' }}>{row.employeeId}</td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '5px 8px', fontWeight: 'bold' }}>{row.employeeName}</td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '5px 8px' }}>{row.designation}</td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '5px 8px' }}>{row.department}</td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '5px 8px', textAlign: 'center', fontWeight: 'bold' }}>
                          {row.payableDays ?? row.workedDays ?? 0} d
                        </td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '5px 8px', textAlign: 'right' }}>{safeMoney(row.basicSalary)}</td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '5px 8px', textAlign: 'right' }}>{safeNum(row.otHours)}</td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '5px 8px', textAlign: 'right', color: '#0284c7' }}>{safeMoney(row.overtime)}</td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '5px 8px', textAlign: 'right', color: '#dc2626' }}>-{safeMoney(deduct)}</td>
                        <td style={{ border: '1px solid #e5e7eb', padding: '5px 8px', textAlign: 'right', fontWeight: 'bold', color: '#2563eb' }}>
                          {safeMoney(row.netSalary)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold' }}>
                    <td colSpan={5} style={{ border: '1px solid #d1d5db', padding: '6px 8px' }}>Totals:</td>
                    <td style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'center' }}>
                      {(exportTargetRecord.records || []).reduce((acc, r) => acc + safeNum(r.payableDays), 0)} d
                    </td>
                    <td style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'right' }}>
                      {safeMoney((exportTargetRecord.records || []).reduce((acc, r) => acc + safeNum(r.basicSalary), 0))}
                    </td>
                    <td style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'right' }}>
                      {(exportTargetRecord.records || []).reduce((acc, r) => acc + safeNum(r.otHours), 0).toFixed(1)}
                    </td>
                    <td style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'right', color: '#0284c7' }}>
                      {safeMoney((exportTargetRecord.records || []).reduce((acc, r) => acc + safeNum(r.overtime), 0))}
                    </td>
                    <td style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'right', color: '#dc2626' }}>
                      -{safeMoney((exportTargetRecord.records || []).reduce((acc, r) => acc + (safeNum(r.lateDeduction) + safeNum(r.absents) + safeNum(r.fine) + safeNum(r.loan) + safeNum(r.advanceAmount)), 0))}
                    </td>
                    <td style={{ border: '1px solid #d1d5db', padding: '6px 8px', textAlign: 'right', color: '#2563eb' }}>
                      {safeMoney((exportTargetRecord.records || []).reduce((acc, r) => acc + safeNum(r.netSalary), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Signatures */}
              <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <div style={{ borderTop: '1px solid #9ca3af', width: '200px', textAlign: 'center', paddingTop: '6px' }}>
                  <strong>Prepared By</strong>
                  <div style={{ color: '#6b7280', fontSize: '10px' }}>HR & Payroll Specialist</div>
                </div>
                <div style={{ borderTop: '1px solid #9ca3af', width: '200px', textAlign: 'center', paddingTop: '6px' }}>
                  <strong>Verified By</strong>
                  <div style={{ color: '#6b7280', fontSize: '10px' }}>Accounts & Audit Officer</div>
                </div>
                <div style={{ borderTop: '1px solid #9ca3af', width: '200px', textAlign: 'center', paddingTop: '6px' }}>
                  <strong>Approved By</strong>
                  <div style={{ color: '#6b7280', fontSize: '10px' }}>Director / CEO</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
