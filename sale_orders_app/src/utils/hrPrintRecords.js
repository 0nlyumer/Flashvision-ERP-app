// hrPrintRecords.js — Request prints + Loan Ledger print FINAL
// (Omer's order, 2026-10-26).
//
// Builders that turn the RAW HR records (hr_leave_requests,
// hr_overtime_requests, hr_loan_requests, hr_advance_requests,
// hr_loan_ledger) into the studio-shaped records the shared slip renderer
// (PrintLayout via SlipDocumentPopup) resolves from the Print Settings
// schemas in printSchemaRegistry.js: `{ header: {...schema keys},
// items: [...grid rows], totals: {...} }` plus top-level long-text fields
// (reason / purpose) the popup renders as note blocks.
//
// resolvePayrollLoanDeduction is a READ-ONLY mirror of the loan branch of
// computePayrollRecords (src/utils/payrollCalc.js) — it changes no money
// behaviour; it exists so the Loan Ledger statement print can state, per
// employee, whether a loan deduction actually runs with salary, using the
// SAME resolution order payroll uses:
//   1. employee record loan / loanAmount (base amount)
//   2. an Active ledger item with remainingBalance > 0 OVERRIDES with
//      min(monthlyInstallment, remainingBalance)
//   3. otherwise an Approved loan request's monthlyInstallment applies
// smoke-request-prints.mjs cross-checks this mirror against the real
// computePayrollRecords on fixtures covering every branch.

import { ledgerEntryForRequest, isLedgerSettled } from './loanLifecycle.js';

const safeNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const formatPrintMoney = (v) =>
  safeNum(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatPrintDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB'); // dd/mm/yyyy
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// '2026-08' or '2026-08-01' -> 'August 2026'
export const monthYearLabel = (value) => {
  if (!value) return '—';
  const m = String(value).match(/^(\d{4})-(\d{2})/);
  if (!m) return String(value);
  const idx = parseInt(m[2], 10) - 1;
  return `${MONTH_NAMES[idx] || m[2]} ${m[1]}`;
};

// Add `count` months to a 'YYYY-MM-DD' / 'YYYY-MM' value -> { key: 'YYYY-MM', label: 'Month YYYY' }
const addMonths = (value, count) => {
  const m = String(value || '').match(/^(\d{4})-(\d{2})/);
  if (!m) return { key: '', label: '—' };
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1 + count, 1);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { key, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
};

const findEmployee = (employees, req) => {
  if (!Array.isArray(employees) || !req) return null;
  return employees.find((e) =>
    String(e.id) === String(req.employeeId) ||
    String(e.employeeCode || e.code || '') === String(req.employeeId) ||
    String(e.name || '').toLowerCase() === String(req.employeeName || '').toLowerCase()
  ) || null;
};

const departmentOf = (req, employees) =>
  req?.department || findEmployee(employees, req)?.department || '—';

const LEAVE_TYPE_LABELS = {
  annual: 'Annual Leave',
  sick: 'Sick Leave',
  casual: 'Casual Leave',
  maternity: 'Maternity/Paternity Leave',
  unpaid: 'Unpaid Leave'
};

export const leaveTypeLabel = (t) => LEAVE_TYPE_LABELS[String(t || '').toLowerCase()] || (t || '—');

// ---------------------------------------------------------------------------
// Leave Request — header mirrors the registry schema (leave_id, emp_name,
// department, leave_type, duration); items are one row per leave day
// (serial_no, date, type = Paid/Unpaid, reason) exactly as the schema's
// grid columns describe.
// ---------------------------------------------------------------------------
export function buildLeaveRequestPrintRecord(req, employees = []) {
  if (!req) return null;
  const categoryLabel = String(req.category || 'paid').toLowerCase() === 'unpaid' ? 'Unpaid' : 'Paid';
  const items = [];
  const start = req.startDate ? new Date(req.startDate) : null;
  const end = req.endDate ? new Date(req.endDate) : null;
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    const cursor = new Date(start);
    let guard = 0;
    while (cursor <= end && guard < 366) {
      items.push({
        serial_no: String(items.length + 1),
        date: formatPrintDate(cursor.toISOString().substring(0, 10)),
        type: categoryLabel,
        reason: req.reason || ''
      });
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
  }
  const days = items.length || safeNum(req.days) || 0;
  return {
    header: {
      leave_id: req.id,
      emp_name: req.employeeName || '—',
      department: departmentOf(req, employees),
      leave_type: leaveTypeLabel(req.leaveType),
      duration: `${formatPrintDate(req.startDate)} → ${formatPrintDate(req.endDate)} (${days} day${days === 1 ? '' : 's'})`,
      status: req.status || '—',
      category: `${categoryLabel} Leave`,
      applied_on: formatPrintDate(req.createdAt || req.dateApplied)
    },
    items,
    totals: { totalDays: days },
    reason: req.reason || ''
  };
}

// ---------------------------------------------------------------------------
// Overtime Request — schema header (ot_id, emp_name, month_year,
// department); one grid row (work_date, hours, rate_multiplier,
// task_description). The raw record carries no rate multiplier, so the
// column states the shift window instead of inventing a rate.
// ---------------------------------------------------------------------------
export function buildOvertimeRequestPrintRecord(req, employees = []) {
  if (!req) return null;
  const hours = safeNum(req.hours);
  const window = req.startTime && req.endTime ? `${req.startTime} – ${req.endTime}` : '—';
  return {
    header: {
      ot_id: req.id,
      emp_name: req.employeeName || '—',
      month_year: monthYearLabel(req.date),
      department: departmentOf(req, employees),
      work_date: formatPrintDate(req.date),
      hours: `${hours.toFixed(2)} hrs`,
      status: req.status || '—'
    },
    items: [
      {
        serial_no: '1',
        work_date: formatPrintDate(req.date),
        hours: hours.toFixed(2),
        rate_multiplier: window,
        task_description: req.reason || ''
      }
    ],
    totals: { totalHours: `${hours.toFixed(2)} hrs` },
    reason: req.reason || ''
  };
}

// ---------------------------------------------------------------------------
// Loan Request — schema header (request_id, date_applied, employee_id,
// employee_name, department, loan_type, loan_amount, repayment_term,
// monthly_installment, repayment_start_date); items are the installment
// schedule from the Repayment Start Date. The final installment absorbs
// the rounding remainder so the schedule sums EXACTLY to the loan amount.
// ---------------------------------------------------------------------------
export function buildLoanRequestPrintRecord(req) {
  if (!req) return null;
  const amount = safeNum(req.amount);
  const term = Math.max(0, Math.round(safeNum(req.termMonths)));
  const installment = safeNum(req.monthlyInstallment) || (term > 0 ? parseFloat((amount / term).toFixed(2)) : 0);
  const items = [];
  let allocated = 0;
  for (let i = 0; i < term; i++) {
    const isLast = i === term - 1;
    const rowAmount = isLast ? parseFloat((amount - allocated).toFixed(2)) : installment;
    allocated = parseFloat((allocated + rowAmount).toFixed(2));
    items.push({
      month_no: String(i + 1),
      due_date: addMonths(req.repaymentStartDate, i).label,
      installment_amount: formatPrintMoney(rowAmount),
      status: 'Scheduled'
    });
  }
  return {
    header: {
      request_id: req.id,
      date_applied: formatPrintDate(req.dateApplied || req.createdAt),
      employee_id: req.employeeId || '—',
      employee_name: req.employeeName || '—',
      department: req.department || '—',
      loan_type: req.type || '—',
      loan_amount: formatPrintMoney(amount),
      repayment_term: `${term} Months`,
      monthly_installment: formatPrintMoney(installment),
      repayment_start_date: formatPrintDate(req.repaymentStartDate),
      status: req.status || '—'
    },
    items,
    totals: { totalLoanAmount: formatPrintMoney(amount), totalInstallments: term, monthlyDeduction: formatPrintMoney(installment) },
    purpose: req.purpose || ''
  };
}

// ---------------------------------------------------------------------------
// Advance Request — schema header (request_id, date_applied, employee_id,
// employee_name, department, advance_amount, deduction_month); one
// recovery row (the full advance is recovered in its deduction month).
// ---------------------------------------------------------------------------
export function buildAdvanceRequestPrintRecord(req) {
  if (!req) return null;
  const amount = safeNum(req.amount);
  return {
    header: {
      request_id: req.id,
      date_applied: formatPrintDate(req.dateApplied || req.createdAt),
      employee_id: req.employeeId || '—',
      employee_name: req.employeeName || '—',
      department: req.department || '—',
      advance_amount: formatPrintMoney(amount),
      deduction_month: monthYearLabel(req.deductionMonth),
      status: req.status || '—'
    },
    items: [
      {
        serial_no: '1',
        recovery_month: `${monthYearLabel(req.deductionMonth)} Payroll`,
        deduction_amount: formatPrintMoney(amount)
      }
    ],
    totals: { grandTotal: amount },
    purpose: req.purpose || ''
  };
}

// ---------------------------------------------------------------------------
// Payroll loan-deduction resolution — READ-ONLY mirror of payrollCalc.
// Returns { amount, source, item } where source is 'ledger' | 'request' |
// 'employee' | null. Matching keys mirror payrollCalc exactly:
// employeeId vs emp.id / emp.employeeCode / emp.code, else employeeName
// (case-insensitive).
// ---------------------------------------------------------------------------
export function resolvePayrollLoanDeduction(state, employee) {
  if (!employee) return { amount: 0, source: null, item: null };
  const empIdStr = String(employee.id || '').trim();
  const empCodeStr = String(employee.employeeCode || employee.code || '').trim();
  const empNameLower = String(employee.name || '').trim().toLowerCase();
  const matches = (rec) =>
    String(rec?.employeeId ?? '') === empIdStr ||
    String(rec?.employeeCode ?? '') === empCodeStr ||
    String(rec?.employeeName ?? '').toLowerCase() === empNameLower;

  let amount = safeNum(employee.loan || employee.loanAmount);
  let source = amount > 0 ? 'employee' : null;
  let item = null;

  const loanLedger = state?.hr_loan_ledger || [];
  const activeLedgerItem = loanLedger.find((l) =>
    matches(l) && l.status === 'Active' && safeNum(l.remainingBalance) > 0
  );
  if (activeLedgerItem && activeLedgerItem.monthlyInstallment) {
    amount = Math.min(safeNum(activeLedgerItem.monthlyInstallment), safeNum(activeLedgerItem.remainingBalance));
    source = 'ledger';
    item = activeLedgerItem;
  } else {
    const loanRequests = state?.hr_loan_requests || [];
    const activeLoanReq = loanRequests.find((r) => matches(r) && r.status === 'Approved');
    if (activeLoanReq && activeLoanReq.monthlyInstallment) {
      // LOAN SETTLEMENT GUARD — identical to payrollCalc (2026-10-28,
      // loanLifecycle rule 1): a request tracked by a SETTLED ledger
      // entry deducts nothing; the loan is fully recovered.
      const trackingEntry = ledgerEntryForRequest(loanLedger, activeLoanReq);
      if (!isLedgerSettled(trackingEntry)) {
        amount = safeNum(activeLoanReq.monthlyInstallment);
        source = 'request';
        item = activeLoanReq;
      }
    }
  }
  return { amount: parseFloat(amount.toFixed(2)), source, item };
}

// ---------------------------------------------------------------------------
// Loan Ledger statement data — per-employee loan position PLUS the salary
// deduction truth for THIS ledger entry:
//   - 'this-ledger'  payroll's deduction comes from this very entry.
//   - 'other-source' payroll deducts, but via the employee record / an
//                    approved loan request — NOT via this entry.
//   - 'none'         payroll deducts nothing for this employee's loan.
// The reason strings explain, in plain words, why payroll does or does
// not deduct — the exact thing Omer asked the print to make clear.
// ---------------------------------------------------------------------------
export function buildLoanLedgerStatement(state, ledgerItem) {
  if (!ledgerItem) return null;
  const employees = state?.hr_employees_list || [];
  const employee = findEmployee(employees, ledgerItem) || {
    id: ledgerItem.employeeId,
    name: ledgerItem.employeeName,
    department: ledgerItem.department
  };
  const resolution = resolvePayrollLoanDeduction(state, employee);

  let deduction = { running: false, viaThisLedger: false, amount: 0, source: null, note: '' };
  if (resolution.amount > 0 && resolution.source === 'ledger' && resolution.item && String(resolution.item.id) === String(ledgerItem.id)) {
    deduction = {
      running: true,
      viaThisLedger: true,
      amount: resolution.amount,
      source: 'ledger',
      note: 'Payroll deducts this installment with salary every month while the balance remains.'
    };
  } else if (resolution.amount > 0) {
    const note = resolution.source === 'request'
      ? 'Payroll is deducting via the employee\u2019s Approved loan request, not via this ledger entry.'
      : resolution.source === 'ledger'
        ? `Payroll is deducting via another Active ledger entry (${resolution.item?.id || '—'}), not via this one.`
        : 'Payroll is deducting the amount set on the employee record, not via this ledger entry.';
    deduction = {
      running: true,
      viaThisLedger: false,
      amount: resolution.amount,
      source: resolution.source,
      note
    };
  } else {
    let why = 'No active deduction source exists for this employee.';
    if (ledgerItem.status !== 'Active') why = `This ledger entry is ${ledgerItem.status} — payroll only deducts from Active entries.`;
    else if (safeNum(ledgerItem.remainingBalance) <= 0) why = 'The remaining balance is zero — nothing left to deduct.';
    else if (!safeNum(ledgerItem.monthlyInstallment)) why = 'This ledger entry has no monthly installment set.';
    deduction = { running: false, viaThisLedger: false, amount: 0, source: null, note: why };
  }

  const history = (ledgerItem.deductionsHistory || []).map((h, idx) => ({
    serial_no: String(idx + 1),
    date: formatPrintDate(h.date),
    type: h.type || 'Deduction',
    amount: formatPrintMoney(h.amount),
    balance_after: formatPrintMoney(h.remainingBalanceAfter),
    notes: h.notes || ''
  }));

  return {
    header: {
      ledger_id: ledgerItem.id,
      emp_name: ledgerItem.employeeName || '—',
      department: ledgerItem.department || departmentOf(ledgerItem, employees),
      loan_type: ledgerItem.loanType || '—',
      status: ledgerItem.status || '—'
    },
    summary: {
      totalLoanAmount: safeNum(ledgerItem.totalLoanAmount),
      monthlyInstallment: safeNum(ledgerItem.monthlyInstallment),
      paidAmount: safeNum(ledgerItem.paidAmount),
      remainingBalance: safeNum(ledgerItem.remainingBalance),
      termMonths: safeNum(ledgerItem.termMonths),
      repaymentStartDate: ledgerItem.repaymentStartDate || null,
      nextDeductionDate: ledgerItem.nextDeductionDate || null,
      loanRequestId: ledgerItem.loanRequestId || null
    },
    deduction,
    history,
    employee
  };
}

// ---------------------------------------------------------------------------
// Employee-wise loan statement (Omer's order, 2026-10-27): select an
// employee, print their FULL loan position across every loan — how much
// was disbursed in total, how much has been recovered, how much remains.
// Events are chronological: each loan's disbursement plus every recorded
// deduction / repayment from its deductionsHistory, with a running
// balance. The summary figures come from the ledger entries themselves
// (authoritative); if itemised history does not add up to them (legacy
// entries), one explicit adjustment event closes the gap so the printed
// table always foots to the printed balance.
// ---------------------------------------------------------------------------
export function buildEmployeeLoanStatement(state, employee) {
  if (!employee) return null;
  const employees = state?.hr_employees_list || [];
  const loanLedger = state?.hr_loan_ledger || [];
  const empIdStr = String(employee.id ?? '');
  const empNameLower = String(employee.name ?? '').toLowerCase();
  const matchesEmp = (l) =>
    String(l?.employeeId ?? '') === empIdStr ||
    String(l?.employeeName ?? '').toLowerCase() === empNameLower;

  const entries = loanLedger
    .filter(matchesEmp)
    .slice()
    .sort((a, b) => String(a.createdAt || a.repaymentStartDate || '').localeCompare(String(b.createdAt || b.repaymentStartDate || '')));

  const rawEvents = [];
  entries.forEach((entry) => {
    rawEvents.push({
      date: entry.createdAt || entry.repaymentStartDate || '',
      kind: 'loan',
      ref: entry.id,
      label: `Loan Disbursed — ${entry.loanType || 'Personal Loan'}`,
      debit: safeNum(entry.totalLoanAmount),
      credit: 0,
      notes: entry.loanRequestId ? `Request ${entry.loanRequestId}` : ''
    });
    (entry.deductionsHistory || []).forEach((h) => {
      rawEvents.push({
        date: h.date || '',
        kind: 'recovery',
        ref: entry.id,
        label: `${h.type || 'Deduction'} — ${entry.id}`,
        debit: 0,
        credit: safeNum(h.amount),
        notes: h.notes || ''
      });
    });
  });
  // Chronological; a disbursement precedes same-day recoveries.
  rawEvents.sort((a, b) =>
    String(a.date).localeCompare(String(b.date)) ||
    (a.kind === b.kind ? 0 : a.kind === 'loan' ? -1 : 1)
  );

  const totalLoan = entries.reduce((s, e) => s + safeNum(e.totalLoanAmount), 0);
  const totalRecovered = entries.reduce((s, e) => s + safeNum(e.paidAmount), 0);
  const balanceRemaining = entries.reduce((s, e) => s + safeNum(e.remainingBalance), 0);

  let running = 0;
  const events = rawEvents.map((ev, idx) => {
    running = parseFloat((running + ev.debit - ev.credit).toFixed(2));
    return {
      serial_no: String(idx + 1),
      date: formatPrintDate(ev.date),
      description: ev.label,
      ref: ev.ref,
      loan_amount: ev.debit > 0 ? formatPrintMoney(ev.debit) : '—',
      recovered: ev.credit > 0 ? formatPrintMoney(ev.credit) : '—',
      balance_after: formatPrintMoney(running),
      notes: ev.notes
    };
  });
  if (events.length > 0 && Math.abs(running - balanceRemaining) > 0.005) {
    const diff = parseFloat((balanceRemaining - running).toFixed(2));
    running = balanceRemaining;
    events.push({
      serial_no: String(events.length + 1),
      date: events[events.length - 1].date,
      description: 'Adjustment — recovery recorded on the ledger without itemised history',
      ref: '—',
      loan_amount: diff > 0 ? formatPrintMoney(diff) : '—',
      recovered: diff < 0 ? formatPrintMoney(-diff) : '—',
      balance_after: formatPrintMoney(running),
      notes: 'Balances the statement to the ledger totals'
    });
  }

  const loans = entries.map((entry) => ({
    id: entry.id,
    loan_type: entry.loanType || '—',
    date: formatPrintDate(entry.createdAt || entry.repaymentStartDate),
    principal: formatPrintMoney(entry.totalLoanAmount),
    recovered: formatPrintMoney(entry.paidAmount),
    balance: formatPrintMoney(entry.remainingBalance),
    installment: formatPrintMoney(entry.monthlyInstallment),
    status: entry.status || '—'
  }));

  const resolution = resolvePayrollLoanDeduction(state, employee);

  return {
    header: {
      emp_name: employee.name || '—',
      emp_code: employee.employeeCode || employee.code || employee.id || '—',
      department: employee.department || departmentOf({ employeeId: employee.id, employeeName: employee.name }, employees)
    },
    summary: {
      totalLoan,
      totalRecovered,
      balanceRemaining,
      loanCount: entries.length,
      activeLoans: entries.filter((e) => e.status === 'Active').length,
      settledLoans: entries.filter((e) => e.status !== 'Active').length
    },
    deduction: resolution,
    loans,
    events,
    employee
  };
}
