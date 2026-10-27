// Smoke — Request prints + Loan Ledger print FINAL (Omer's order, 2026-10-26).
//
// Part 1 (unit): the REAL print-record builders (src/utils/hrPrintRecords.js)
//   produce schema-complete studio records for all four request forms and
//   the loan ledger statement.
// Part 2 (payroll truth): resolvePayrollLoanDeduction (the read-only mirror
//   the ledger print uses) is cross-checked against the REAL
//   computePayrollRecords loan output on fixtures covering every branch —
//   the print must state the same deduction truth payroll applies.
// Part 3 (static): wiring — all four HR request modules open the shared
//   slip popup; the dead '/print' navigation is gone; Overtime's bespoke
//   modal + dead Print Settings embed are gone; the Ledger modal carries
//   the restored 'Print Ledger Statement' button; SlipDocumentPopup keeps
//   its filed-view default.
//
// Run: node scripts/smoke-request-prints.mjs   (exit 0 = all pass)

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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (p) => readFileSync(join(appDir, p), 'utf8');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const {
  buildLeaveRequestPrintRecord,
  buildOvertimeRequestPrintRecord,
  buildLoanRequestPrintRecord,
  buildAdvanceRequestPrintRecord,
  buildLoanLedgerStatement,
  resolvePayrollLoanDeduction
} = await import('../src/utils/hrPrintRecords.js');
const { computePayrollRecords } = await import('../src/utils/payrollCalc.js');

// ---------------------------------------------------------------- Part 1
console.log('Part 1 — builders');

const leave = buildLeaveRequestPrintRecord({
  id: 'LVR-1001', employeeId: 'EMP-4012', employeeName: 'Alexander Wright',
  leaveType: 'annual', startDate: '2026-10-12', endDate: '2026-10-15',
  category: 'paid', days: 4, reason: 'Planned family vacation and rest',
  status: 'Approved', createdAt: '2026-10-01T09:00:00.000Z'
}, [{ id: 'EMP-4012', name: 'Alexander Wright', department: 'Production' }]);
check('leave header complete', leave.header.leave_id === 'LVR-1001' && leave.header.emp_name === 'Alexander Wright' && leave.header.department === 'Production' && leave.header.leave_type === 'Annual Leave');
check('leave duration label', leave.header.duration.includes('4 days'), leave.header.duration);
check('leave items = one row per day', leave.items.length === 4 && leave.items[0].date === '12/10/2026' && leave.items[3].date === '15/10/2026');
check('leave items carry Paid type + reason', leave.items.every((i) => i.type === 'Paid' && i.reason.includes('vacation')));
check('leave long-text reason at top level', leave.reason.includes('vacation'));

const ot = buildOvertimeRequestPrintRecord({
  id: 'OTR-1002', employeeId: 'EMP-4088', employeeName: 'Sarah Jenkins',
  date: '2026-07-15', startTime: '05:00', endTime: '07:00', hours: '2.00',
  reason: 'Urgent logistics override', status: 'Approved', createdAt: '2026-07-15T07:15:00.000Z'
}, [{ id: 'EMP-4088', name: 'Sarah Jenkins', department: 'Finishing' }]);
check('overtime header complete', ot.header.ot_id === 'OTR-1002' && ot.header.emp_name === 'Sarah Jenkins' && ot.header.month_year === 'July 2026' && ot.header.department === 'Finishing');
check('overtime item row', ot.items.length === 1 && ot.items[0].hours === '2.00' && ot.items[0].rate_multiplier === '05:00 – 07:00');

const loan = buildLoanRequestPrintRecord({
  id: '#LR-1234', employeeId: 'EMP-1', employeeName: 'Test One', department: 'Production',
  dateApplied: '2026-07-28', repaymentStartDate: '2026-08-01', type: 'Personal Loan',
  amount: 50000, termMonths: 12, monthlyInstallment: 4166.67,
  purpose: 'Home repair', status: 'Approved', createdAt: '2026-07-28T00:00:00.000Z'
});
check('loan header complete', loan.header.request_id === '#LR-1234' && loan.header.loan_amount === '50,000.00' && loan.header.repayment_term === '12 Months' && loan.header.monthly_installment === '4,166.67');
check('loan schedule has term rows', loan.items.length === 12 && loan.items[0].due_date === 'August 2026' && loan.items[11].due_date === 'July 2027');
const schedSum = loan.items.reduce((s, i) => s + parseFloat(i.installment_amount.replace(/,/g, '')), 0);
check('loan schedule sums exactly to amount', Math.abs(schedSum - 50000) < 0.001, `sum=${schedSum}`);

const adv = buildAdvanceRequestPrintRecord({
  id: '#ADV-1234', employeeId: 'EMP-2', employeeName: 'Test Two', department: 'Finishing',
  dateApplied: '2026-07-29', deductionMonth: '2026-08', amount: 122500,
  purpose: 'Salary Advance Request', status: 'Approved', createdAt: '2026-07-29T00:00:00.000Z'
});
check('advance header complete', adv.header.request_id === '#ADV-1234' && adv.header.advance_amount === '122,500.00' && adv.header.deduction_month === 'August 2026');
check('advance recovery row', adv.items.length === 1 && adv.items[0].recovery_month === 'August 2026 Payroll' && adv.items[0].deduction_amount === '122,500.00');

// ---------------------------------------------------------------- Part 2
console.log('Part 2 — deduction mirror vs real payrollCalc');

const octAttendance = {};
for (let d = 1; d <= 31; d++) octAttendance[`2026-10-${String(d).padStart(2, '0')}`] = { status: 'present' };
const mkEmp = (id, extra = {}) => ({
  id, employeeCode: `EMP-${id}`, name: `Emp ${id}`, status: 'Active',
  division: 'AJ Synthetic', department: 'Production', basicSalary: 60000,
  attendance: { ...octAttendance }, ...extra
});

const ledgerItem = (id, emp, extra = {}) => ({
  id, employeeId: emp.id, employeeCode: emp.employeeCode, employeeName: emp.name,
  department: 'Production', loanType: 'Personal Loan', totalLoanAmount: 60000,
  monthlyInstallment: 5000, paidAmount: 0, remainingBalance: 60000, termMonths: 12,
  repaymentStartDate: '2026-08-01', nextDeductionDate: '2026-11-01', status: 'Active',
  loanRequestId: '#LR-X', deductionsHistory: [], ...extra
});
const loanReq = (emp, extra = {}) => ({
  id: '#LR-Y', employeeId: emp.id, employeeName: emp.name, department: 'Production',
  dateApplied: '2026-07-01', repaymentStartDate: '2026-08-01', type: 'Personal Loan',
  amount: 36000, termMonths: 12, monthlyInstallment: 3000, purpose: 'x',
  status: 'Approved', createdAt: '2026-07-01T00:00:00.000Z', ...extra
});

const E1 = mkEmp('E1'); // ledger active
const E2 = mkEmp('E2'); // ledger completed + approved request (trap)
const E3 = mkEmp('E3', { loan: 2500 }); // employee-record loan only
const E4 = mkEmp('E4'); // ledger remaining < installment
const E5 = mkEmp('E5'); // ledger active, zero installment + approved request
const E6 = mkEmp('E6'); // nothing
const E7 = mkEmp('E7', { loan: 9000 }); // emp loan AND ledger (ledger wins)

const L1 = ledgerItem('LED-E1', E1);
const L2 = ledgerItem('LED-E2', E2, { status: 'Completed', remainingBalance: 0, paidAmount: 60000 });
const L4 = ledgerItem('LED-E4', E4, { remainingBalance: 2000 });
const L5 = ledgerItem('LED-E5', E5, { monthlyInstallment: 0 });
const L7 = ledgerItem('LED-E7', E7, { monthlyInstallment: 5000 });

const state = {
  hr_employees_list: [E1, E2, E3, E4, E5, E6, E7],
  hr_uploaded_attendance: [],
  hr_overtime_requests: [],
  // E2's request is the ledger entry's own request (same id + amount —
  // the shape the creators always produce): the settled-loan trap.
  hr_loan_requests: [loanReq(E2, { id: '#LR-X', amount: 60000, monthlyInstallment: 5000 }), loanReq(E5, { id: '#LR-E5', monthlyInstallment: 4000 })],
  hr_loan_ledger: [L1, L2, L4, L5, L7],
  hr_leave_requests: [], hr_advance_requests: []
};

const payroll = computePayrollRecords(state, '2026-10', 'ALL');
const payrollLoan = (emp) => {
  const rec = payroll.find((r) => String(r.employeeId) === String(emp.id) || r.employeeName === emp.name || r.name === emp.name);
  return rec ? parseFloat(rec.loan || 0) : null;
};

const scenarios = [
  ['E1 ledger active', E1, 5000, 'ledger'],
  // E2 WAS the flaw (completed ledger + still-Approved request deducting
  // forever). Fixed 2026-10-28 (loanLifecycle): the settled ledger blocks
  // the request path — deduction 0. See smoke-loan-lifecycle.mjs.
  ['E2 completed ledger + approved request (settled — no deduction)', E2, 0, null],
  ['E3 employee-record loan', E3, 2500, 'employee'],
  ['E4 installment capped at remaining', E4, 2000, 'ledger'],
  ['E5 zero-installment ledger falls to request', E5, 4000, 'request'],
  ['E6 no loan', E6, 0, null],
  ['E7 ledger overrides employee loan', E7, 5000, 'ledger']
];
for (const [label, emp, expected, source] of scenarios) {
  const mine = resolvePayrollLoanDeduction(state, emp);
  const real = payrollLoan(emp);
  check(`${label}: mirror = ${expected}/${source}`, mine.amount === expected && mine.source === source, JSON.stringify(mine));
  check(`${label}: payrollCalc agrees (${real})`, real === expected, `payroll=${real}`);
}

// Ledger statement verdicts
const st1 = buildLoanLedgerStatement(state, L1);
check('statement E1: running via this ledger', st1.deduction.running === true && st1.deduction.viaThisLedger === true && st1.deduction.amount === 5000);
const st2 = buildLoanLedgerStatement(state, L2);
check('statement E2: settled loan — deduction NOT running (flaw fixed 2026-10-28)', st2.deduction.running === false && st2.deduction.viaThisLedger === false && st2.deduction.amount === 0 && /Completed/.test(st2.deduction.note), st2.deduction.note);
const st6 = buildLoanLedgerStatement(state, ledgerItem('LED-E6', E6, { status: 'Completed', remainingBalance: 0, paidAmount: 60000 }));
check('statement E6-style completed, no other source: NOT running', st6.deduction.running === false && /Completed/.test(st6.deduction.note), st6.deduction.note);
const stHist = buildLoanLedgerStatement(state, { ...L1, deductionsHistory: [{ id: 'D1', date: '2026-09-01', amount: 5000, type: 'Scheduled Payroll Deduction', remainingBalanceAfter: 55000, notes: 'Auto deduction for 2026-09' }] });
check('statement history rows shaped', stHist.history.length === 1 && stHist.history[0].amount === '5,000.00' && stHist.history[0].balance_after === '55,000.00');

// ---------------------------------------------------------------- Part 3
console.log('Part 3 — wiring (static)');

const leaveSrc = read('src/components/hr/HRLeaveRequest.jsx');
const loanSrc = read('src/components/hr/HRLoanRequest.jsx');
const otSrc = read('src/components/hr/HROvertime.jsx');
const advSrc = read('src/components/hr/HRAdvanceRequest.jsx');
const ledgerSrc = read('src/components/hr/HRLoanLedger.jsx');
const slipSrc = read('src/components/warehouse/SlipDocumentPopup.jsx');
const registrySrc = read('src/utils/printSchemaRegistry.js');

check('leave module opens shared print popup', leaveSrc.includes('HRRequestPrintPopup') && leaveSrc.includes('buildLeaveRequestPrintRecord') && leaveSrc.includes('setPrintingRequest(req)'));
check('loan module opens shared print popup', loanSrc.includes('HRRequestPrintPopup') && loanSrc.includes('buildLoanRequestPrintRecord') && loanSrc.includes('Print Loan Slip'));
check('overtime module opens shared print popup', otSrc.includes('HRRequestPrintPopup') && otSrc.includes('buildOvertimeRequestPrintRecord'));
check('overtime bespoke print modal removed', !otSrc.includes('Overtime Request Official Print Document') && !otSrc.includes('<PrintSettings />') && !otSrc.includes('showPrintSettingsModal'));
check('advance module opens shared print popup', advSrc.includes('HRRequestPrintPopup') && advSrc.includes('buildAdvanceRequestPrintRecord'));
check('advance dead /print navigation removed', !advSrc.includes('`/print?docType=') && !advSrc.includes('useNavigate'));
check('advance header button no longer raw window.print', !/onClick=\{\(\) => window\.print\(\)\}/.test(advSrc));
check('ledger modal has Print Ledger Statement button', ledgerSrc.includes('Print Ledger Statement') && ledgerSrc.includes('LoanLedgerPrintPopup'));
check('slip popup filed-view default preserved', slipSrc.includes("titleSuffix = 'Filed Print'"));
check('slip popup: no duplicate serial column (width alignment)', slipSrc.includes('hasSerialCol') && slipSrc.includes("cols[0]?.key === 'serial_no'"));
check('ledger schema registered (defaults only)', registrySrc.includes('hr_loan_ledger: {'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
