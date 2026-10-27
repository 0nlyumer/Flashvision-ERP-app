// smoke-loan-lifecycle — the loan deduction flaw fix (Omer, 2026-10-28:
// "ye bohat bara masla hai, theek karna hoga").
//
// The flaw: a loan request stayed 'Approved' forever after its ledger
// entry was fully recovered ('Completed'), so payroll's request branch
// kept deducting the full installment every month — uncapped, endless.
//
// This smoke asserts the FIXED behaviour against the REAL
// computePayrollRecords (payrollCalc.js), its read-only mirror
// (hrPrintRecords.resolvePayrollLoanDeduction) and the lifecycle rules
// (loanLifecycle.js):
//   1. Settled ledger + still-'Approved' request  -> deduction 0.
//   2. settleRepaidLoanRequests flips that request to 'Repaid'.
//   3. Active ledger loan still deducts min(installment, balance).
//   4. Approved request with NO ledger entry still deducts (fallback).
//   5. Zero-balance-but-'Active' entry also blocks (balance test).
//   6. A fresh loan is never settled by an older same-amount loan.
// Run: node scripts/smoke-loan-lifecycle.mjs   (exit 0 = all pass)

import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); } catch (e) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.(js|mjs|json)$/.test(specifier)) {
      return next(specifier + '.js', context);
    }
    throw e;
  }
}`));

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const { computePayrollRecords } = await import('../src/utils/payrollCalc.js');
const { resolvePayrollLoanDeduction } = await import('../src/utils/hrPrintRecords.js');
const { settleRepaidLoanRequests, ledgerEntryForRequest, isLedgerSettled } = await import('../src/utils/loanLifecycle.js');

const octAttendance = {};
for (let d = 1; d <= 31; d++) octAttendance[`2026-10-${String(d).padStart(2, '0')}`] = { status: 'present' };
const mkEmp = (id, extra = {}) => ({
  id, employeeCode: `EMP-${id}`, name: `Emp ${id}`, status: 'Active',
  division: 'AJ Synthetic', department: 'Production', basicSalary: 60000,
  attendance: { ...octAttendance }, ...extra
});
const ledgerItem = (id, emp, extra = {}) => ({
  id, employeeId: emp.id, employeeCode: emp.employeeCode, employeeName: emp.name,
  department: 'Production', loanType: 'Personal Loan', totalLoanAmount: 12000,
  monthlyInstallment: 1000, paidAmount: 0, remainingBalance: 12000, termMonths: 12,
  repaymentStartDate: '2026-08-01', nextDeductionDate: '2026-11-01', status: 'Active',
  loanRequestId: `LR-${emp.id}`, deductionsHistory: [], ...extra
});
const loanReq = (id, emp, extra = {}) => ({
  id, employeeId: emp.id, employeeName: emp.name, department: 'Production',
  dateApplied: '2026-07-01', repaymentStartDate: '2026-08-01', type: 'Personal Loan',
  amount: 12000, termMonths: 12, monthlyInstallment: 1000, purpose: 'x',
  status: 'Approved', createdAt: '2026-07-01T00:00:00.000Z', ...extra
});

// A — THE FLAW: ledger fully recovered, request still 'Approved'.
const EA = mkEmp('EA');
const LA = ledgerItem('LED-A', EA, { status: 'Completed', paidAmount: 12000, remainingBalance: 0 });
const RA = loanReq('LR-EA', EA);

// B — normal active loan (entry mid-recovery, balance below installment).
const EB = mkEmp('EB');
const LB = ledgerItem('LED-B', EB, { paidAmount: 11500, remainingBalance: 500 });
const RB = loanReq('LR-EB', EB);

// C — approved request, NO ledger entry yet (fallback path).
const EC = mkEmp('EC');
const RC = loanReq('LR-EC', EC, { monthlyInstallment: 2500, amount: 30000 });

// D — entry never marked Completed but balance is zero.
const ED = mkEmp('ED');
const LD = ledgerItem('LED-D', ED, { paidAmount: 12000, remainingBalance: 0 });
const RD = loanReq('LR-ED', ED);

// E — two loans, same employee + same amount: old settled, new active.
const EE = mkEmp('EE');
const LE_OLD = ledgerItem('LED-E-OLD', EE, { status: 'Completed', paidAmount: 12000, remainingBalance: 0, loanRequestId: 'LR-EE-OLD' });
const LE_NEW = ledgerItem('LED-E-NEW', EE, { paidAmount: 3000, remainingBalance: 9000, loanRequestId: 'LR-EE-NEW' });
const RE_OLD = loanReq('LR-EE-OLD', EE);
const RE_NEW = loanReq('LR-EE-NEW', EE);

const state = {
  hr_employees_list: [EA, EB, EC, ED, EE],
  hr_uploaded_attendance: [],
  hr_overtime_requests: [],
  hr_loan_requests: [RA, RB, RC, RD, RE_OLD, RE_NEW],
  hr_loan_ledger: [LA, LB, LD, LE_OLD, LE_NEW],
  hr_leave_requests: [], hr_advance_requests: []
};

console.log('Part 1 — payroll + mirror on the flaw fixtures');
const payroll = computePayrollRecords(state, '2026-10', 'ALL');
const payrollLoan = (emp) => {
  const rec = payroll.find((r) => String(r.employeeId) === String(emp.id) || r.employeeName === emp.name || r.name === emp.name);
  return rec ? parseFloat(rec.loan || 0) : null;
};
const cases = [
  ['A settled ledger + Approved request', EA, 0],
  ['B active ledger capped at balance', EB, 500],
  ['C no-ledger Approved request (fallback)', EC, 2500],
  ['D zero-balance Active-status entry', ED, 0],
  ['E fresh loan deducts via its own entry', EE, 1000]
];
for (const [label, emp, expected] of cases) {
  const real = payrollLoan(emp);
  const mirror = resolvePayrollLoanDeduction(state, emp);
  check(`${label}: payrollCalc = ${expected}`, real === expected, `payroll=${real}`);
  check(`${label}: mirror agrees (${expected})`, mirror.amount === expected, JSON.stringify(mirror));
}

console.log('Part 2 — lifecycle settle rule');
const settled = settleRepaidLoanRequests(state.hr_loan_requests, state.hr_loan_ledger);
const byId = (arr, id) => arr.find((r) => r.id === id);
check('settle reports a change', settled.changed === true);
check('A request flipped to Repaid', byId(settled.requests, 'LR-EA')?.status === 'Repaid');
check('D request flipped to Repaid (balance test)', byId(settled.requests, 'LR-ED')?.status === 'Repaid');
check('B request stays Approved (entry active)', byId(settled.requests, 'LR-EB')?.status === 'Approved');
check('C request stays Approved (no entry)', byId(settled.requests, 'LR-EC')?.status === 'Approved');
check('E old request Repaid, new request untouched',
  byId(settled.requests, 'LR-EE-OLD')?.status === 'Repaid' && byId(settled.requests, 'LR-EE-NEW')?.status === 'Approved');
const again = settleRepaidLoanRequests(settled.requests, state.hr_loan_ledger);
check('settle is idempotent', again.changed === false);
check('ledger pairing prefers the id link', ledgerEntryForRequest(state.hr_loan_ledger, RE_NEW)?.id === 'LED-E-NEW');
check('isLedgerSettled: Completed / zero-balance / active',
  isLedgerSettled(LA) === true && isLedgerSettled(LD) === true && isLedgerSettled(LB) === false);

console.log('Part 3 — employee-wise loan statement builder');
const { buildEmployeeLoanStatement } = await import('../src/utils/hrPrintRecords.js');
const EW = mkEmp('EW');
const LW1 = ledgerItem('LED-W1', EW, {
  status: 'Completed', paidAmount: 12000, remainingBalance: 0, createdAt: '2026-01-05T00:00:00.000Z',
  deductionsHistory: [
    { id: 'D1', date: '2026-02-01', amount: 6000, type: 'Scheduled Payroll Deduction', remainingBalanceAfter: 6000, notes: '' },
    { id: 'D2', date: '2026-03-01', amount: 6000, type: 'Manual Repayment', remainingBalanceAfter: 0, notes: '' }
  ]
});
const LW2 = ledgerItem('LED-W2', EW, {
  totalLoanAmount: 30000, monthlyInstallment: 2500, paidAmount: 2500, remainingBalance: 27500,
  createdAt: '2026-09-01T00:00:00.000Z', loanRequestId: 'LR-EW2',
  deductionsHistory: [
    { id: 'D3', date: '2026-10-01', amount: 2500, type: 'Scheduled Payroll Deduction', remainingBalanceAfter: 27500, notes: '' }
  ]
});
const stateW = { ...state, hr_employees_list: [EW], hr_loan_ledger: [LW1, LW2], hr_loan_requests: [] };
const stmt = buildEmployeeLoanStatement(stateW, EW);
check('statement covers both loans', stmt.loans.length === 2 && stmt.summary.loanCount === 2);
check('statement totals: taken 42000 / recovered 14500 / balance 27500',
  stmt.summary.totalLoan === 42000 && stmt.summary.totalRecovered === 14500 && stmt.summary.balanceRemaining === 27500,
  JSON.stringify(stmt.summary));
check('statement events: 2 disbursements + 3 recoveries', stmt.events.length === 5, `events=${stmt.events.length}`);
check('statement running balance foots to the balance remaining',
  stmt.events[stmt.events.length - 1].balance_after === '27,500.00', stmt.events[stmt.events.length - 1].balance_after);
check('statement first event is the first disbursement', stmt.events[0].loan_amount === '12,000.00' && /Disbursed/.test(stmt.events[0].description));

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES PRESENT'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
