import HRPayslipModal from './HRPayslipModal';
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { getEffectiveDutyHours, getEffectiveOvertimeMultiplier } from '../../utils/hrDutyHours';

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

export default function HRPayslip({ isMobile }) {
  const { state, currencySymbol } = useApp();
  const currSym = currencySymbol || state.adminSetup?.baseCurrency?.match(/\(([^)]+)\)/)?.[1] || 'Rs';

  // 1. Collect ALL distinct payroll months where:
  //    - Finalized salaries exist
  //    - Attendance exists in Attendance Management (uploaded, live punch, or mark in employee attendance register)
  //    - Overtime requests exist
  //    - Current month
  // Even if attendance is NOT saved/finalized into salary history, the month MUST show in dropdown!
  const availableMonths = useMemo(() => {
    const monthSet = new Set();
    const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])/;

    // A. From finalized/generated salaries history
    const genList = state.hr_generated_salaries || [];
    genList.forEach(item => {
      if (item && item.month && MONTH_REGEX.test(item.month)) {
        monthSet.add(item.month);
      }
    });

    // B. From uploaded or biometric attendance logs (state + localStorage)
    let uploadedLogs = state.hr_uploaded_attendance || [];
    try {
      const savedUploaded = localStorage.getItem('hr_uploaded_attendance');
      if (savedUploaded) {
        const parsed = JSON.parse(savedUploaded);
        if (Array.isArray(parsed)) uploadedLogs = [...uploadedLogs, ...parsed];
      }
      const flashAmCached = localStorage.getItem('flasham_cached_attendance');
      if (flashAmCached) {
        const parsed = JSON.parse(flashAmCached);
        if (Array.isArray(parsed)) uploadedLogs = [...uploadedLogs, ...parsed];
      }
    } catch (e) {}

    uploadedLogs.forEach(log => {
      const rawDate = log?.date || log?.logDate || log?.punchDate;
      const norm = normalizeDate(rawDate);
      if (norm && MONTH_REGEX.test(norm)) {
        monthSet.add(norm.substring(0, 7));
      }
    });

    // C. From employee list attendance objects (state + localStorage)
    let employeesList = state.hr_employees_list || [];
    try {
      const savedEmps = localStorage.getItem('hr_employees_list');
      if (savedEmps) {
        const parsed = JSON.parse(savedEmps);
        if (Array.isArray(parsed) && parsed.length > 0) employeesList = parsed;
      }
    } catch (e) {}

    employeesList.forEach(emp => {
      if (emp && emp.attendance && typeof emp.attendance === 'object') {
        Object.keys(emp.attendance).forEach(dayKey => {
          const normKey = normalizeDate(dayKey);
          if (normKey && MONTH_REGEX.test(normKey)) {
            monthSet.add(normKey.substring(0, 7));
          }
        });
      }
    });

    // D. From overtime requests
    const otList = state.hr_overtime_requests || [];
    otList.forEach(req => {
      const norm = normalizeDate(req?.date);
      if (norm && MONTH_REGEX.test(norm)) {
        monthSet.add(norm.substring(0, 7));
      }
    });

    // E. From saved user filters in Attendance Management
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('hr_attendance_filters_')) {
          const filterData = JSON.parse(localStorage.getItem(k));
          if (filterData && filterData.selectedYear && filterData.selectedMonth !== undefined) {
            const mKey = `${filterData.selectedYear}-${String(parseInt(filterData.selectedMonth) + 1).padStart(2, '0')}`;
            if (MONTH_REGEX.test(mKey)) monthSet.add(mKey);
          }
        }
      }
    } catch (e) {}

    // F. Always include current calendar month as well
    const curMonthKey = new Date().toISOString().substring(0, 7);
    monthSet.add(curMonthKey);

    return Array.from(monthSet).sort().reverse();
  }, [state.hr_generated_salaries, state.hr_uploaded_attendance, state.hr_employees_list, state.hr_overtime_requests]);

  // Selected period state
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    return availableMonths[0] || new Date().toISOString().substring(0, 7);
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

  // Active month finalized salary record (if generated)
  const currentMonthRecord = useMemo(() => {
    return (state.hr_generated_salaries || []).find(s => s.month === selectedPeriod) || null;
  }, [state.hr_generated_salaries, selectedPeriod]);

  // 2. Comprehensive Employee Records for the selected month:
  //    - If salary was finalized in Salary Generation, use finalized record
  //    - If NOT finalized (or for any employee not in finalized batch), but employee has ANY
  //      attendance logged (at least a single day of punch, status, OT, or draft) in Attendance Management:
  //      Compute their verified payroll dynamically on the fly!
  const rawRecords = useMemo(() => {
    if (!selectedPeriod) return [];

    const [yearStr, monthStr] = selectedPeriod.split('-');
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    if (!y || !m) return [];

    const currentMonthDays = new Date(y, m, 0).getDate();

    // Map to hold unique records per employee
    const recordMap = new Map();

    // A. Populate from finalized salary records if available
    if (currentMonthRecord && Array.isArray(currentMonthRecord.records)) {
      currentMonthRecord.records.forEach(r => {
        if (r && r.employeeId) {
          recordMap.set(String(r.employeeId).trim(), {
            ...r,
            status: r.status || 'Finalized'
          });
        }
      });
    }

    // B. Load active duty hours settings
    let dutySettings = state?.hr_duty_settings || null;
    try {
      if (!dutySettings) {
        const savedDuty = localStorage.getItem('hr_duty_settings');
        if (savedDuty) dutySettings = JSON.parse(savedDuty);
      }
    } catch (e) {}

    // C. Uploaded/punch attendance logs (including Flash AM mobile app cache)
    let uploadedLogs = state.hr_uploaded_attendance || [];
    try {
      const savedUploaded = localStorage.getItem('hr_uploaded_attendance');
      if (savedUploaded) {
        const parsed = JSON.parse(savedUploaded);
        if (Array.isArray(parsed)) uploadedLogs = [...uploadedLogs, ...parsed];
      }
      const flashAmCached = localStorage.getItem('flasham_cached_attendance');
      if (flashAmCached) {
        const parsed = JSON.parse(flashAmCached);
        if (Array.isArray(parsed)) uploadedLogs = [...uploadedLogs, ...parsed];
      }
    } catch (e) {}

    // D. Overtime requests
    const overtimeRequests = state.hr_overtime_requests || [];

    // E. Loan ledger & requests
    const loanLedger = state.hr_loan_ledger || [];
    const loanRequests = state.hr_loan_requests || [];

    // F. Active employees list
    let allEmployees = (state.hr_employees_list || []).filter(e => (e.status || 'Active').toLowerCase() === 'active');
    if (allEmployees.length === 0) {
      try {
        const savedEmps = localStorage.getItem('hr_employees_list');
        if (savedEmps) {
          const parsed = JSON.parse(savedEmps);
          if (Array.isArray(parsed)) {
            allEmployees = parsed.filter(e => (e.status || 'Active').toLowerCase() === 'active');
          }
        }
      } catch (e) {}
    }

    // G. Scan each employee to check if they have at least 1 day of attendance in selectedPeriod
    allEmployees.forEach(emp => {
      const empIdStr = String(emp.id || emp.employeeCode || '').trim();
      const empCodeStr = String(emp.employeeCode || emp.id || '').trim();
      const empNameLower = String(emp.name || '').trim().toLowerCase();

      // If already present in finalized records, skip dynamic generation
      if (recordMap.has(empIdStr) || recordMap.has(empCodeStr)) {
        return;
      }

      const attObj = emp.attendance || {};
      let hasAnyAttendance = false;
      let workedDays = 0;
      let leavesCount = 0;
      let absentsCount = 0;
      let totalOtHours = 0;
      let totalLateHours = 0;
      let totalFines = 0;

      for (let d = 1; d <= currentMonthDays; d++) {
        const dateStr = String(d).padStart(2, '0');
        const fullDate = `${y}-${String(m).padStart(2, '0')}-${dateStr}`;

        const dayRecord = attObj[fullDate] || attObj[`${y}-${m}-${d}`] || attObj[d] || null;

        const punch = uploadedLogs.find(u => 
          ((u.employeeId && (String(u.employeeId).trim() === empIdStr || String(u.employeeId).trim() === empCodeStr)) ||
           (u.employeeCode && String(u.employeeCode).trim() === empIdStr) ||
           (u.employeeName && String(u.employeeName).trim().toLowerCase() === empNameLower)) &&
          (u.date === fullDate || normalizeDate(u.date) === fullDate)
        );

        const otReq = overtimeRequests.find(r => 
          r.status === 'Approved' &&
          ((r.employeeId && (String(r.employeeId).trim() === empIdStr || String(r.employeeId).trim() === empCodeStr)) ||
           (r.employeeName && String(r.employeeName).trim().toLowerCase() === empNameLower)) &&
          (r.date === fullDate || normalizeDate(r.date) === fullDate)
        );

        let status = dayRecord?.status || punch?.status;
        if (!status && punch?.inTime) status = 'present';

        let ot = parseFloat(dayRecord?.ot || punch?.ot || punch?.overtimeHours || otReq?.hours || 0) || 0;
        if (otReq && parseFloat(otReq.hours || 0) > 0) {
          ot = Math.max(ot, parseFloat(otReq.hours || 0));
        }

        let dt = parseFloat(dayRecord?.deductions || punch?.lateHours || punch?.dt || 0) || 0;
        let fines = parseFloat(dayRecord?.fines || punch?.fines || punch?.fine || 0) || 0;

        // Check if there is ANY logged activity or explicit attendance on this day
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        const hasExplicitLog = dayRecord?.userEdited || punch?.inTime || punch?.status || ot > 0 || dt > 0 || fines > 0;
        const sLower = String(status || '').toLowerCase();

        if (hasExplicitLog || sLower.includes('present') || sLower === 'completed' || sLower === 'p' || sLower.includes('half') || sLower.includes('leave') || sLower.includes('holiday')) {
          hasAnyAttendance = true;
        }

        if (!status) {
          if (dayOfWeek === 0) status = 'leave';
          else status = 'absent';
        }

        const statNorm = String(status).toLowerCase();
        if (statNorm.includes('present') || statNorm === 'p') {
          workedDays += 1;
        } else if (statNorm.includes('half')) {
          workedDays += 0.5;
        } else if (statNorm.includes('leave') || statNorm === 'l' || statNorm === 'holiday' || statNorm === 'offday') {
          leavesCount += 1;
        } else {
          absentsCount += 1;
        }

        totalOtHours += ot;
        totalLateHours += dt;
        totalFines += fines;
      }

      // If employee has even a single day of attendance logged:
      if (hasAnyAttendance || workedDays > 0 || totalOtHours > 0) {
        const baseSalary = Number(emp.basicSalary || emp.salary || emp.baseSalary || 20000);
        const dutyInfo = getEffectiveDutyHours(emp, dutySettings);
        const empDutyHours = Number(dutyInfo?.hours) || 8;

        const oneDayAmount = currentMonthDays > 0 ? (baseSalary / currentMonthDays) : 0;
        const oneHourAmount = empDutyHours > 0 ? (oneDayAmount / empDutyHours) : 0;

        const otMultiplier = getEffectiveOvertimeMultiplier(emp, dutySettings);
        const otHourlyRate = oneHourAmount * otMultiplier;

        const payableDays = Math.min(currentMonthDays, Math.max(0, workedDays + leavesCount));
        const finalAbsentsCount = Math.max(0, currentMonthDays - payableDays);

        const earnedBasicSalary = Math.round(oneDayAmount * payableDays * 100) / 100;
        const absentDeduction = Math.round(oneDayAmount * finalAbsentsCount * 100) / 100;
        const otPay = Math.round(totalOtHours * otHourlyRate * 100) / 100;
        const lateDeduction = Math.round(totalLateHours * oneHourAmount * 100) / 100;

        // Custom employee allowances
        let allowances = 0;
        try {
          const savedMap = localStorage.getItem('hr_employee_allowance_map');
          if (savedMap) {
            const parsed = JSON.parse(savedMap);
            if (parsed && (parsed[emp.id] !== undefined || parsed[emp.name] !== undefined)) {
              allowances = Number(parsed[emp.id] !== undefined ? parsed[emp.id] : parsed[emp.name]) || 0;
            } else if (emp.allowance) {
              allowances = Number(emp.allowance) || 0;
            }
          } else if (emp.allowance) {
            allowances = Number(emp.allowance) || 0;
          }
        } catch (e) {}
        if (finalAbsentsCount > 0) allowances = 0;

        // Advance & Loan installments
        let advance = Number(emp.advance || emp.advanceAmount || 0);
        let loan = Number(emp.loan || emp.loanInstallment || 0);
        const activeLedgerItem = loanLedger.find(l => 
          (String(l.employeeId) === empIdStr || String(l.employeeName || '').toLowerCase() === empNameLower) && 
          l.status === 'Active' && 
          (Number(l.remainingBalance) || 0) > 0
        );
        if (activeLedgerItem && activeLedgerItem.monthlyInstallment) {
          loan = Math.min(Number(activeLedgerItem.monthlyInstallment) || 0, Number(activeLedgerItem.remainingBalance) || 0);
        }

        const netSalary = Math.max(0, Math.round((earnedBasicSalary + otPay + allowances - lateDeduction - totalFines - advance - loan) * 100) / 100);

        const liveRecord = {
          employeeId: emp.employeeCode || emp.id,
          employeeName: emp.name,
          designation: emp.designation || emp.role || emp.jobTitle || 'Staff',
          department: emp.department || 'Operations',
          division: emp.division || emp.section || 'General',
          section: emp.section || emp.division || 'General',
          shift: emp.shift || 'Standard',
          dutyHours: empDutyHours,
          basicSalary: baseSalary,
          workedDays: workedDays,
          payableDays: payableDays,
          paidDays: payableDays,
          absentsCount: finalAbsentsCount,
          absents: absentDeduction,
          otHours: totalOtHours,
          overtime: otPay,
          lateComingHours: totalLateHours,
          lateDeduction: lateDeduction,
          fine: totalFines,
          allowance: allowances,
          advanceAmount: advance,
          loan: loan,
          netSalary: netSalary,
          currentMonthDays: currentMonthDays,
          status: 'Live Attendance'
        };

        recordMap.set(empIdStr, liveRecord);
      }
    });

    return Array.from(recordMap.values());
  }, [selectedPeriod, currentMonthRecord, state.hr_generated_salaries, state.hr_employees_list, state.hr_uploaded_attendance, state.hr_overtime_requests, state.hr_duty_settings, state.hr_loan_ledger]);

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

  // 3. Exact 100% Alignment of Daily Attendance Register for HRPayslipModal:
  //    Matches dates (1..31), status (P, L, HLD, ABS), overtime (+X.Xh), and deduction (-X.Xh)
  //    strictly with Attendance Management screen for that employee and month!
  const formattedSlipData = useMemo(() => {
    if (!selectedSlipForDetail) return null;
    const r = selectedSlipForDetail;
    const [yStr, mStr] = (selectedPeriod || '').split('-');
    const y = parseInt(yStr, 10) || new Date().getFullYear();
    const m = parseInt(mStr, 10) || (new Date().getMonth() + 1);
    const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const periodMonthYear = `${monthNames[m - 1] || 'CURRENT'} ${y}`;
    const currentMonthDays = r.currentMonthDays || new Date(y, m, 0).getDate();

    const empIdStr = String(r.employeeId || '').trim();
    const empNameLower = String(r.employeeName || '').toLowerCase().trim();

    // Look up full employee record from state or localStorage
    let allEmployees = state.hr_employees_list || [];
    try {
      const savedEmps = localStorage.getItem('hr_employees_list');
      if (savedEmps) {
        const parsed = JSON.parse(savedEmps);
        if (Array.isArray(parsed) && parsed.length > 0) allEmployees = parsed;
      }
    } catch (e) {}

    const empObj = allEmployees.find(e => 
      (e.id && String(e.id).trim() === empIdStr) ||
      (e.employeeCode && String(e.employeeCode).trim() === empIdStr) ||
      (e.name && String(e.name).toLowerCase().trim() === empNameLower)
    );
    const empAttendance = empObj?.attendance || {};

    let uploadedLogs = state.hr_uploaded_attendance || [];
    try {
      const savedUploaded = localStorage.getItem('hr_uploaded_attendance');
      if (savedUploaded) {
        const parsed = JSON.parse(savedUploaded);
        if (Array.isArray(parsed)) uploadedLogs = [...uploadedLogs, ...parsed];
      }
      const flashAmCached = localStorage.getItem('flasham_cached_attendance');
      if (flashAmCached) {
        const parsed = JSON.parse(flashAmCached);
        if (Array.isArray(parsed)) uploadedLogs = [...uploadedLogs, ...parsed];
      }
    } catch (e) {}

    const overtimeRequests = state.hr_overtime_requests || [];

    const dailyRecords = [];
    for (let d = 1; d <= currentMonthDays; d++) {
      const dateStr = String(d).padStart(2, '0');
      const fullDate = `${y}-${String(m).padStart(2, '0')}-${dateStr}`;

      // 1. Check employee attendance register
      const dayRecord = empAttendance[fullDate] || empAttendance[`${y}-${m}-${d}`] || empAttendance[d] || null;

      // 2. Check biometric / uploaded logs strictly matching fullDate
      const punch = uploadedLogs.find(u => 
        ((u.employeeId && (String(u.employeeId).trim() === empIdStr || String(u.employeeId).trim() === String(empObj?.employeeCode || ''))) ||
         (u.employeeCode && String(u.employeeCode).trim() === empIdStr) ||
         (u.employeeName && String(u.employeeName).toLowerCase().trim() === empNameLower)) &&
        (u.date === fullDate || normalizeDate(u.date) === fullDate)
      );

      // 3. Check approved overtime requests strictly matching fullDate
      const otReq = overtimeRequests.find(req => 
        req.status === 'Approved' &&
        ((req.employeeId && (String(req.employeeId).trim() === empIdStr || String(req.employeeId).trim() === String(empObj?.employeeCode || ''))) ||
         (req.employeeName && String(req.employeeName).toLowerCase().trim() === empNameLower)) &&
        (req.date === fullDate || normalizeDate(req.date) === fullDate)
      );

      let status = dayRecord?.status || punch?.status;
      if (!status && punch?.inTime) status = 'present';

      const dayOfWeek = new Date(y, m - 1, d).getDay();
      if (!status) {
        if (dayOfWeek === 0) {
          status = 'leave';
        } else {
          status = 'absent';
        }
      }

      let att = 'ABS';
      const s = String(status || '').toLowerCase();
      if (s.includes('present') || s === 'p') att = 'P';
      else if (s.includes('leave') || s === 'l' || s === 'paid_leave' || s === 'holiday' || s === 'offday') att = 'L';
      else if (s.includes('half')) att = 'HLD';
      else att = 'ABS';

      let otVal = parseFloat(dayRecord?.ot || punch?.ot || punch?.overtimeHours || otReq?.hours || 0) || 0;
      if (otReq && parseFloat(otReq.hours || 0) > 0) {
        otVal = Math.max(otVal, parseFloat(otReq.hours || 0));
      }
      const ot = otVal > 0 ? `+${otVal.toFixed(1)}h` : '-';

      let dtVal = parseFloat(dayRecord?.deductions || punch?.dt || punch?.lateHours || 0) || 0;
      const dt = dtVal > 0 ? `-${dtVal.toFixed(1)}h` : '-';

      const remarks = dayRecord?.remarks || punch?.remarks || (att === 'L' && dayOfWeek === 0 ? 'Weekly Off' : '-');

      dailyRecords.push({ dateStr, att, ot, dt, remarks });
    }

    const otPay = Number(r.overtime) || 0;
    const allowances = Number(r.allowance) || 0;
    const absentDeduction = Number(r.absents) || 0;
    const dtDeduction = Number(r.lateDeduction) || 0;
    const fines = Number(r.fine) || 0;
    const advance = Number(r.advanceAmount) || 0;
    const loanInstallment = Number(r.loan) || 0;
    const netAdjustmentBalance = otPay + allowances - absentDeduction - dtDeduction - fines - advance - loanInstallment;

    return {
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      designation: r.designation || 'WORKER',
      department: r.department || 'Operations',
      shiftSchedule: r.shift || 'Standard',
      dutyHours: r.dutyHours || 8,
      basicSalary: r.basicSalary || 0,
      paidDays: r.payableDays || r.paidDays || 0,
      presentDays: r.workedDays || r.presentDays || 0,
      currentMonthDays: currentMonthDays,
      periodMonthYear: periodMonthYear,
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
  }, [selectedSlipForDetail, selectedPeriod, state.hr_employees_list, state.hr_uploaded_attendance, state.hr_overtime_requests]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/20 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
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
                  <option value="" disabled>No Attendance / Periods Found</option>
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
                  <option key={div} value={div}>{div === 'ALL' ? '🏢 All Divisions' : div}</option>
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
          <p className="text-[10px] text-on-surface-variant font-semibold mt-0.5">Final Disbursals</p>
        </div>
      </div>

      {/* Main Payslip Cards / Table Area */}
      {availableMonths.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-3xl p-12 text-center border border-outline-variant/20 shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">hourglass_empty</span>
          </div>
          <h3 className="font-headline text-lg font-bold text-on-surface">No Attendance or Payslips Found</h3>
          <p className="text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
            Record or upload attendance logs in the <b>Attendance Management</b> screen to automatically view and generate payslips for that month.
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
                        {r.status === 'Live Attendance' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25 inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">bolt</span>
                            Live Attendance
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                            Finalized
                          </span>
                        )}
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

      {/* Exactly 110% Formatted AJ Synthetic Payslip Modal */}
      <HRPayslipModal
        isOpen={Boolean(selectedSlipForDetail)}
        onClose={() => setSelectedSlipForDetail(null)}
        slip={formattedSlipData}
      />

    </div>
  );
}
