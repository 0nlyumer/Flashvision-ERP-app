/**
 * FlashVision ERP - Single Salary Calculation Core
 * Mirrors the owner's live salary Google Sheet VERBATIM.
 * 
 * EXACT SALARY RULES:
 * - hourly = basic / 240
 * - OT amount = OT hours * hourly
 * - deduction amount = deduction hours * hourly
 * - absent deduction = absent days * (basic / 30)
 * - TOTAL SALARY = basic + OT amount + allowance - deduction amount - absent deduction - fine - advance - loan
 */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertBelowThousand(n) {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred';
    n %= 100;
    if (n > 0) str += ' ';
  }
  if (n > 0) {
    if (n < 20) {
      str += ONES[n];
    } else {
      str += TENS[Math.floor(n / 10)];
      if (n % 10 > 0) {
        str += ' ' + ONES[n % 10];
      }
    }
  }
  return str;
}

/**
 * Convert numeric amount into words using Pakistani numbering system (Thousand, Lakh, Crore)
 * e.g. 150000 -> "Rupees One Lakh Fifty Thousand Only"
 */
export function amountInWords(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'Rupees Zero Only';

  let remainder = n;
  const parts = [];

  // Crore (1,00,00,000)
  const crore = Math.floor(remainder / 10000000);
  if (crore > 0) {
    parts.push(convertBelowThousand(crore) + ' Crore');
    remainder %= 10000000;
  }

  // Lakh (1,00,000)
  const lakh = Math.floor(remainder / 100000);
  if (lakh > 0) {
    parts.push(convertBelowThousand(lakh) + ' Lakh');
    remainder %= 100000;
  }

  // Thousand (1,000)
  const thousand = Math.floor(remainder / 1000);
  if (thousand > 0) {
    parts.push(convertBelowThousand(thousand) + ' Thousand');
    remainder %= 1000;
  }

  // Remainder below 1000
  if (remainder > 0) {
    parts.push(convertBelowThousand(remainder));
  }

  return 'Rupees ' + parts.join(' ') + ' Only';
}

export function formatMoney(val, showPrefix = true, decimals = 2) {
  const n = parseFloat(val) || 0;
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return showPrefix ? `Rs ${formatted}` : formatted;
}

export function safeNum(val) {
  if (val === null || val === undefined) return 0;
  const n = parseFloat(String(val).replace(/,/g, '').replace(/Rs/gi, '').trim());
  return isNaN(n) ? 0 : n;
}

/**
 * Normalizes period into { year, month } (month is 1-indexed: 1..12)
 */
export function parseMonthContext(period) {
  if (!period) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  if (typeof period === 'string') {
    const parts = period.split('-');
    if (parts.length >= 2) {
      return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) };
    }
  }
  if (typeof period === 'object') {
    const y = period.year || new Date().getFullYear();
    const m = period.month !== undefined ? period.month : (new Date().getMonth() + 1);
    return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/**
 * calculateEmployeeSalary - The single calculation core for salary generation & payslip
 * 
 * @param {Object} employee - Employee object from hr_employees_list
 * @param {Object} monthContext - Contains month, year, attendance, overtime, advance, loan records
 * @returns {Object} Complete calculated salary record
 */
export function calculateEmployeeSalary(employee, monthContext = {}) {
  const { year, month } = parseMonthContext(monthContext.payrollPeriod || monthContext);
  const calDays = new Date(year, month, 0).getDate(); // 28, 29, 30, or 31

  const basic = safeNum(employee?.basicSalary ?? employee?.salary ?? 0);
  // Hourly rate: basic / 240
  const hourly = basic > 0 ? (basic / 240) : 0;

  // Month prefix e.g. "2026-09"
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const uploadedAtt = monthContext.uploadedAttendance || [];
  const otRequests = monthContext.overtimeRequests || [];
  const advRequests = monthContext.advanceRequests || [];
  const loanReqs = monthContext.loanRequests || [];
  const loanLedger = monthContext.loanLedger || [];
  const leaveReqs = monthContext.leaveRequests || [];
  const salaryConfig = monthContext.salaryConfig || {};

  // Build 31-day attendance / OT / DT register
  const days = [];
  let otHoursSum = 0;
  let dedHoursSum = 0;
  let absentCount = 0;
  let presentCount = 0;
  let leaveCount = 0;
  let finesSum = 0;

  const empAtt = employee?.attendance || {};

  for (let d = 1; d <= 31; d++) {
    if (d > calDays) {
      days.push({
        day: d,
        date: '',
        att: '-',
        ot: 0,
        ded: 0,
        fine: 0,
        remarks: '-',
        isSunday: false,
        isOutOfRange: true
      });
      continue;
    }

    const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month - 1, d).getDay(); // 0 is Sunday
    const isSunday = dayOfWeek === 0;

    // Check embedded employee attendance object
    const dayRecord = empAtt[dateStr] || {};

    // Check uploaded attendance record
    const uploadedRecord = uploadedAtt.find(u => 
      (String(u.employeeId) === String(employee.id) || u.employeeName === employee.name || (u.id && String(u.id) === String(employee.id))) &&
      (u.date === dateStr || String(u.date).startsWith(dateStr))
    );

    // Overtime from approved overtime requests
    const approvedOtForDay = otRequests
      .filter(r => 
        (r.employeeName === employee.name || String(r.employeeId) === String(employee.id)) &&
        r.status === 'Approved' &&
        (r.date === dateStr || String(r.date).startsWith(dateStr))
      )
      .reduce((sum, r) => sum + safeNum(r.hours), 0);

    // Check approved leave request on this date
    const approvedLeaveForDay = leaveReqs.find(l => 
      (l.employeeName === employee.name || String(l.employeeId) === String(employee.id)) &&
      l.status === 'Approved' &&
      l.startDate && l.endDate &&
      dateStr >= l.startDate.substring(0, 10) &&
      dateStr <= l.endDate.substring(0, 10)
    );

    // Determine status
    let rawStatus = dayRecord.status || uploadedRecord?.status;
    let explicitStatus = dayRecord.explicitStatus || !!uploadedRecord;

    if (!rawStatus && approvedLeaveForDay) {
      rawStatus = 'leave';
      explicitStatus = true;
    }

    let attCode = '-';
    let remarks = isSunday ? 'Sunday' : '-';

    if (rawStatus) {
      const st = String(rawStatus).toLowerCase();
      if (st === 'p' || st === 'present') {
        attCode = 'P';
        presentCount++;
      } else if (st === 'a' || st === 'absent') {
        attCode = 'ABS';
        absentCount++;
      } else if (st === 'l' || st === 'leave' || st === 'half_day' || st === 'late') {
        attCode = 'L';
        leaveCount++;
        // Check if leave was unpaid
        if (approvedLeaveForDay && String(approvedLeaveForDay.leaveCategory || approvedLeaveForDay.paidStatus).toLowerCase() === 'unpaid') {
          absentCount++;
        }
        if (approvedLeaveForDay?.reason) remarks = approvedLeaveForDay.reason;
      } else if (st === 'holiday') {
        attCode = 'H';
        remarks = 'Holiday';
      } else if (st === 'offday' || st === 'off') {
        attCode = '-';
        remarks = isSunday ? 'Sunday' : 'Weekly Off';
      }
    } else if (isSunday) {
      attCode = '-';
      remarks = 'Sunday';
    }

    // Daily OT & DT
    const dailyOt = safeNum(dayRecord.ot || dayRecord.overtime || uploadedRecord?.ot || uploadedRecord?.overtimeHours || 0) + approvedOtForDay;
    const dailyDed = safeNum(dayRecord.deductions || dayRecord.lateHours || dayRecord.lateComingHours || uploadedRecord?.deductions || 0);
    const dailyFine = safeNum(dayRecord.fines || dayRecord.fine || uploadedRecord?.fines || 0);

    otHoursSum += dailyOt;
    dedHoursSum += dailyDed;
    finesSum += dailyFine;

    days.push({
      day: d,
      date: dateStr,
      att: attCode,
      ot: dailyOt,
      ded: dailyDed,
      fine: dailyFine,
      remarks: remarks,
      isSunday: isSunday,
      isOutOfRange: false
    });
  }

  // Exact Salary Rules Core:
  // - hourly = basic / 240
  // - OT amount = OT hours * hourly
  // - deduction amount = deduction hours * hourly
  // - absent deduction = absent days * (basic / 30)
  // - TOTAL SALARY = basic + OT amount + allowance - deduction amount - absent deduction - fine - advance - loan

  const otAmount = Math.round(otHoursSum * hourly * 100) / 100;
  const deductionAmount = Math.round(dedHoursSum * hourly * 100) / 100;
  const absentDeduction = Math.round(absentCount * (basic > 0 ? (basic / 30) : 0) * 100) / 100;
  const paidDays = Math.max(0, calDays - absentCount);

  // Allowance: employee configured allowance, or attendance allowance bonus if zero absents
  let allowance = safeNum(employee.allowance || employee.allowanceAmount || 0);
  if (salaryConfig?.attendanceAllowance?.enabled && absentCount === 0) {
    const bonus = safeNum(salaryConfig.attendanceAllowance.bonusAmount);
    if (bonus > 0 && allowance === 0) {
      allowance = bonus;
    }
  }

  // Fines: daily fines + direct employee fine
  const fine = Math.round((finesSum + safeNum(employee.fine || 0)) * 100) / 100;

  // Company Advance: employee field or approved advance requests for this month
  let advance = safeNum(employee.advance || employee.advanceAmount || 0);
  const matchingAdvance = advRequests.find(a => 
    (String(a.employeeId) === String(employee.id) || a.employeeName === employee.name) &&
    (a.status === 'Approved' || a.status === 'Paid') &&
    (a.deductionMonth === monthPrefix || !a.deductionMonth)
  );
  if (matchingAdvance) {
    advance = Math.max(advance, safeNum(matchingAdvance.advanceAmount || matchingAdvance.amount));
  }

  // Personal Loan Installment: from active loan ledger or requests or direct employee loan
  let loan = safeNum(employee.loan || employee.loanAmount || 0);
  const activeLedger = loanLedger.find(l => 
    (String(l.employeeId) === String(employee.id) || l.employeeName === employee.name) &&
    l.status === 'Active' &&
    safeNum(l.remainingBalance) > 0
  );
  if (activeLedger && activeLedger.monthlyInstallment) {
    loan = Math.min(safeNum(activeLedger.monthlyInstallment), safeNum(activeLedger.remainingBalance));
  } else {
    const activeLoanReq = loanReqs.find(r => 
      (String(r.employeeId) === String(employee.id) || r.employeeName === employee.name) &&
      r.status === 'Approved'
    );
    if (activeLoanReq && activeLoanReq.monthlyInstallment) {
      loan = safeNum(activeLoanReq.monthlyInstallment);
    }
  }

  // Final Total Salary calculation (never negative)
  const exactTotal = basic + otAmount + allowance - deductionAmount - absentDeduction - fine - advance - loan;
  const totalSalary = Math.max(0, Math.round(exactTotal * 100) / 100);

  const netAdjustment = Math.round((totalSalary - basic) * 100) / 100;
  const netAdjTxt = netAdjustment >= 0 
    ? `+ ${formatMoney(netAdjustment)}` 
    : `- ${formatMoney(Math.abs(netAdjustment))}`;
  const netAdjCol = netAdjustment >= 0 ? '#0d9488' : '#dc2626';

  return {
    employeeId: employee.id || '',
    employeeName: employee.name || 'Staff Member',
    designation: employee.designation || 'Staff',
    department: employee.department || (employee.division === 'AAA' ? 'AAA' : 'AJ Synthetic'),
    division: employee.division || 'AJ Synthetic',
    shift: employee.shift || 'GENERAL SHIFT',
    dutyHours: employee.dutyHours || 8,
    dateOfJoining: employee.dateOfJoining || employee.joiningDate || '',
    calDays: calDays,
    paidDays: paidDays,
    presentDays: presentCount,
    absentDays: absentCount,
    leaveDays: leaveCount,
    basic: basic,
    hourly: hourly,
    otHours: otHoursSum,
    otAmount: otAmount,
    deductionHours: dedHoursSum,
    deductionAmount: deductionAmount,
    absentDeduction: absentDeduction,
    allowance: allowance,
    fine: fine,
    advance: advance,
    loan: loan,
    totalSalary: totalSalary,
    netAdjustment: netAdjustment,
    netAdjTxt: netAdjTxt,
    netAdjCol: netAdjCol,
    words: amountInWords(totalSalary),
    days: days
  };
}
