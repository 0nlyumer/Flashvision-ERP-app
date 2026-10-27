// --- Shared Payroll Calculation Engine (EK HI RULE) -----------------------
// Omer's decision (2026-10-24): the Pay Slip and Salary Generation must
// ALWAYS agree — "payslip jab bane, jab salary generate ho". This module
// is the SINGLE calculation path for both screens. It is the verbatim
// engine that used to live inside HRSalaryGeneration.jsx
// (computePayrollForPeriod); HRPayslip's old separate live engine — which
// counted UNRECORDED Sundays as paid off-days and still produced slips
// for absent-only / zero-payable employees — is gone.
//
// Generation rule (what this engine does):
//   * Only RECORDED days count — an unrecorded day (e.g. a Sunday with
//     no attendance entry) is never a paid day by itself; paid status
//     for off days / holidays / leave comes only from a recorded entry,
//     subject to hr_duty_settings attendanceStatusRules.
//   * Employees with no attendance records and no approved OT are
//     excluded, and so are employees whose payable days, worked days
//     and OT are all zero — no slip, no generation row.
// Inputs ride in explicitly (AppContext `state` + period + division) so
// the function stays pure and smoke-testable; browser-only sources
// (localStorage fallbacks) are read defensively in try/catch exactly as
// the original component code did.

import { getEffectiveDutyHours, getEffectiveOvertimeMultiplier } from './hrDutyHours';
import { getCutSundays, normalizeSundayCutRules } from './sundayCut';
import { ledgerEntryForRequest, isLedgerSettled } from './loanLifecycle';

// Defensive number helpers to guarantee 0 crashes
const safeNum = (val) => {
  if (val === null || val === undefined) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
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

// Comprehensive Realtime Payroll Calculation Engine
// RULE: Calculates for all active employees with >= 1 day attendance in that month (Supports All Divisions & App Punches)
export const computePayrollRecords = (state, period, divisionToUse) => {
    if (!period) return [];
    const divFilter = (divisionToUse || 'ALL').trim().toLowerCase();

    let allEmployees = (state.hr_employees_list || []).filter(emp => {
      const isAct = (emp.status || 'Active').toLowerCase() === 'active';
      if (!isAct) return false;
      if (divFilter === 'all') return true;
      const empDiv = (emp.division || emp.section || 'AJ Synthetic').trim().toLowerCase();
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
              const empDiv = (emp.division || emp.section || 'AJ Synthetic').trim().toLowerCase();
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

    // Sunday Cut Rules (hr_duty_settings.sundayCutRules): when a rule is
    // enabled for an employee, a cut Sunday is classified Absent below
    // instead of taking the paid Off-Day branch. Both rules ship
    // disabled — with them off, no cut set is ever computed and this
    // engine's output is exactly what it was before the feature.
    const sundayCutRules = normalizeSundayCutRules(dutySettings?.sundayCutRules);
    const sundayCutActive = Boolean(sundayCutRules.twoAbsence.enabled || sundayCutRules.continuous.enabled);

    const [yearStr, monthStr] = period.split('-');
    const currentMonthDays = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
    const daysInMonth = currentMonthDays;
    const totalWorkingDays = currentMonthDays;

    const results = allEmployees.map(emp => {
      const baseSalary = safeNum(emp.basicSalary || emp.salary || emp.baseSalary || 35000);
      const doj = emp.doj || emp.dateOfJoining || '2024-01-15';
      const designation = emp.designation || emp.jobTitle || emp.role || 'Associate';
      const department = emp.department || 'General';
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
              shortPunch: Boolean(log.shortPunch) || Boolean(dailyMap[logDate]?.shortPunch),
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

      // Sunday Cut Rules: this employee's cut Sundays for the period
      // (empty unless a rule is enabled and in scope for them). The
      // helper reads the FULL attendance data, so week windows and the
      // continuous-absence sandwich can reach into neighbouring months.
      const cutSundays = sundayCutActive ? getCutSundays(emp, period, state, sundayCutRules, attendanceLogs) : null;

      // Aggregate mapped attendance (supports Flash AM 'Completed', 'Present', 'inTime', etc.)
      Object.entries(dailyMap).forEach(([dateKey, rec]) => {
        const st = String(rec.status || '').toLowerCase().trim();
        const hasPunch = Boolean(rec.inTime || rec.outTime);

        if (cutSundays && cutSundays.has(dateKey)) {
          // Cut Sunday — counts as Absent (unpaid); OT / late / fines on
          // the record still aggregate below like any other day.
          absentsCount += 1;
        } else if (rec.shortPunch) {
          // FLASHAM PHASE A: a short punch the terminal marked not-counted
          // (status 'Absent' + shortPunch flag) is never a worked day, even
          // though the record still carries its punch times for audit.
          absentsCount += 1;
        } else if (st.includes('present') || st === 'completed' || st === 'p' || hasPunch) {
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
          // LOAN SETTLEMENT GUARD (Omer-approved fix, 2026-10-28 —
          // loanLifecycle rule 1; hrPrintRecords' mirror applies the
          // identical rule): the request path is ONLY a fallback for a
          // loan with no ledger entry yet. When a ledger entry tracks
          // this request and is settled (Completed / fully recovered),
          // the loan is over — deducting the installment again would
          // recover more than was lent, forever. The request itself is
          // flipped to 'Repaid' by the reconcile (loanLifecycle rule 2);
          // this guard holds even before that flip lands.
          const trackingEntry = ledgerEntryForRequest(loanLedger, activeLoanReq);
          if (!isLedgerSettled(trackingEntry)) {
            loanAmount = safeNum(activeLoanReq.monthlyInstallment);
          }
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
