// Smoke test — Sunday Cut Rules (Omer's order, 2026-10-25).
//
// Employee-wise, configurable rules that CUT a Sunday (count it Absent /
// unpaid instead of a paid Off Day):
//   Rule 1 (twoAbsence): >= minAbsences Absent days in the Mon–Sat week
//     before the Sunday.
//   Rule 2 (continuous): Absent on the Saturday before AND the Monday
//     after the Sunday (sandwich).
// Triggers count ABSENT days only — Leave never counts, short-punch
// Absent does. Holiday / worked Sundays are protected.
//
// Part 1 (unit): the REAL helper (src/utils/sundayCut.js) over
//   fabricated attendance — the 11 brief scenarios.
// Part 2 (engine): the REAL computePayrollRecords — payable days move
//   exactly by the cut Sundays, and with the rules disabled (or absent)
//   the full engine output is byte-identical to the pre-feature engine.
// Part 3 (static): wiring — config defaults + normalize in HR Settings,
//   helper consumed by both money paths and all three display builders,
//   the settings card + EmployeeMultiSelect reuse, and the cut is never
//   written into emp.attendance.
//
// Run: node scripts/smoke-sunday-cut.mjs   (exit 0 = all pass)

// The app sources use Vite-style extensionless relative imports; register
// a resolve hook that retries with '.js' so plain Node can load them.
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
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

const { getCutSundays, normalizeSundayCutRules, DEFAULT_SUNDAY_CUT_RULES } = await import('../src/utils/sundayCut.js');
const { computePayrollRecords } = await import('../src/utils/payrollCalc.js');

// Oct 2026: Sundays 4/11/18/25, Saturdays 3/10/17/24/31, Mondays 5/12/19/26.
// Nov 1 2026 is also a Sunday (window reaches back into October).
const P = (d) => ({ status: 'present' });
const A = (d) => ({ status: 'absent' });
const OFF = () => ({ status: 'off day' });
const LEAVE = () => ({ status: 'leave' });
const HOL = () => ({ status: 'holiday' });
const SHORTY = () => ({ status: 'Absent', shortPunch: true, inTime: '09:00', outTime: '10:00' });
const att = (obj) => obj; // readability

const mkEmp = (id, attendance) => ({
  id, employeeCode: `EMP-${id}`, name: `Test ${id}`, status: 'Active',
  division: 'AJ Synthetic', department: 'Production', basicSalary: 31000,
  attendance
});

const RULES_BOTH_SELECTED = {
  twoAbsence: { enabled: true, minAbsences: 2, applyToAll: false, employeeIds: ['E1'] },
  continuous: { enabled: true, applyToAll: false, employeeIds: ['E1'] }
};
const RULE1_ONLY = {
  twoAbsence: { enabled: true, minAbsences: 2, applyToAll: false, employeeIds: ['E1'] },
  continuous: { enabled: false, applyToAll: false, employeeIds: [] }
};
const RULE2_ONLY = {
  twoAbsence: { enabled: false, minAbsences: 2, applyToAll: false, employeeIds: [] },
  continuous: { enabled: true, applyToAll: false, employeeIds: ['E1'] }
};
const emptyState = { hr_uploaded_attendance: [] };
const cuts = (emp, period, rules) => getCutSundays(emp, period, emptyState, rules);

// ---------------------------------------------------------------- Part 1
console.log('Part 1 — helper scenarios');

// Normalize discipline
check('normalize(null) equals shipped defaults (both rules disabled)',
  JSON.stringify(normalizeSundayCutRules(null)) === JSON.stringify(DEFAULT_SUNDAY_CUT_RULES));
check('normalize fills a partial block and coerces employee ids to strings',
  (() => { const n = normalizeSundayCutRules({ twoAbsence: { enabled: true, employeeIds: [7] } });
    return n.twoAbsence.enabled === true && n.twoAbsence.minAbsences === 2 && n.twoAbsence.employeeIds[0] === '7'
      && n.continuous.enabled === false; })());

// Scenario 4 (threshold) + 2 (basic Rule 1): Sun Oct 4 window (Sep 28–Oct 3)
// has exactly 2 absents (Oct 1, Oct 2) → cut. Sun Oct 11 window (Oct 5–10)
// has exactly 1 absent (Oct 5) → no cut.
const empS2 = mkEmp('E1', att({
  '2026-10-01': A(), '2026-10-02': A(), '2026-10-04': OFF(),
  '2026-10-05': A(), '2026-10-06': P(), '2026-10-07': P(), '2026-10-08': P(),
  '2026-10-09': P(), '2026-10-10': P(), '2026-10-11': OFF(), '2026-10-12': P()
}));
const s2 = cuts(empS2, '2026-10', RULE1_ONLY);
check('S2/S4: exactly 2 absents in the window cuts the Sunday (Oct 4)', s2.has('2026-10-04'));
check('S2/S4: exactly 1 absent in the window does NOT cut (Oct 11)', !s2.has('2026-10-11'));

// Scenario 3: rule on, employee NOT selected, applyToAll off → no cut.
const s3 = cuts(empS2, '2026-10', {
  twoAbsence: { enabled: true, minAbsences: 2, applyToAll: false, employeeIds: ['SOMEONE-ELSE'] },
  continuous: { enabled: false, applyToAll: false, employeeIds: [] }
});
check('S3: employee not selected -> no cut', s3.size === 0);
const s3b = cuts(empS2, '2026-10', {
  twoAbsence: { enabled: true, minAbsences: 2, applyToAll: true, employeeIds: [] },
  continuous: { enabled: false, applyToAll: false, employeeIds: [] }
});
check('S3b: applyToAll on -> cut applies without a selection', s3b.has('2026-10-04'));

// Scenario 5: Leave never counts — 2 leave days in Oct 11's window.
const empS5 = mkEmp('E1', att({
  '2026-10-06': LEAVE(), '2026-10-07': LEAVE(), '2026-10-11': OFF()
}));
check('S5: 2 leave days in the window do NOT cut the Sunday', !cuts(empS5, '2026-10', RULE1_ONLY).has('2026-10-11'));

// Scenario 6: short-punch Absent counts — Oct 18 window (Oct 12–17):
// 1 plain absent + 1 short-punch absent => cut.
const empS6 = mkEmp('E1', att({
  '2026-10-12': A(), '2026-10-13': SHORTY(), '2026-10-18': OFF()
}));
check('S6: absent + short-punch absent in the window cuts (Oct 18)', cuts(empS6, '2026-10', RULE1_ONLY).has('2026-10-18'));

// Scenario 7: Rule 2 sandwich alone (Rule 1 disabled).
const empS7 = mkEmp('E1', att({
  '2026-10-10': A(), '2026-10-11': OFF(), '2026-10-12': A(),       // sandwich -> cut
  '2026-10-17': A(), '2026-10-18': OFF(), '2026-10-19': P(),       // Monday present -> no cut
  '2026-10-24': A(), '2026-10-25': OFF()                            // Monday unrecorded -> no cut
}));
const s7 = cuts(empS7, '2026-10', RULE2_ONLY);
check('S7: Sat absent + Mon absent cuts the Sunday (Oct 11)', s7.has('2026-10-11'));
check('S7: Sat absent + Mon present does NOT cut (Oct 18)', !s7.has('2026-10-18'));
check('S7: Sat absent + Mon unrecorded does NOT cut (Oct 25)', !s7.has('2026-10-25'));

// Scenario 8: continuous run Sat Oct 10 -> Mon Oct 19 cuts both Sundays.
const runAtt = {};
for (let d = 10; d <= 19; d++) runAtt[`2026-10-${String(d).padStart(2, '0')}`] = A();
const empS8 = mkEmp('E1', att(runAtt));
const s8 = cuts(empS8, '2026-10', RULE2_ONLY);
check('S8: continuous run cuts the first Sunday (Oct 11)', s8.has('2026-10-11'));
check('S8: continuous run cuts the second Sunday (Oct 18)', s8.has('2026-10-18'));
check('S8: Sunday after the run ends is not cut (Oct 25)', !s8.has('2026-10-25'));

// Scenario 9: worked / holiday Sundays are protected.
const empS9 = mkEmp('E1', att({
  '2026-10-10': A(), '2026-10-11': P(), '2026-10-12': A(),
  '2026-10-13': A(), '2026-10-14': A(), '2026-10-18': HOL()
}));
const s9 = cuts(empS9, '2026-10', RULES_BOTH_SELECTED);
check('S9: a worked (present) Sunday is never cut', !s9.has('2026-10-11'));
check('S9: a holiday Sunday is never cut', !s9.has('2026-10-18'));

// Scenario 11: month boundary — Sun Nov 1 2026, window Oct 26–31 lives in
// the previous month; its 2 absents must count.
const empS11 = mkEmp('E1', att({
  '2026-10-27': A(), '2026-10-29': A(), '2026-11-01': OFF(), '2026-11-02': P()
}));
check('S11: previous-month window absences cut Nov 1', cuts(empS11, '2026-11', RULE1_ONLY).has('2026-11-01'));

// Uploaded-log records feed the helper too (FlashAM / biometric source).
const empLog = mkEmp('E1', att({ '2026-10-04': OFF() }));
const logState = { hr_uploaded_attendance: [
  { employeeId: 'E1', date: '2026-10-01', status: 'Absent' },
  { employeeId: 'E1', date: '2026-10-02', status: 'Absent' }
] };
check('Helper counts absences that only exist in uploaded logs',
  getCutSundays(empLog, '2026-10', logState, RULE1_ONLY).has('2026-10-04'));

// ---------------------------------------------------------------- Part 2
console.log('Part 2 — payroll engine');

const statusRules = {
  present: { isPaid: true }, absent: { isPaid: false }, leave: { isPaid: true },
  holiday: { isPaid: true }, offday: { isPaid: true }, halfday: { isPaid: true }
};
const mkState = (emp, sundayCutRules) => ({
  hr_employees_list: [emp],
  hr_uploaded_attendance: [], hr_overtime_requests: [], hr_loan_requests: [], hr_loan_ledger: [],
  hr_duty_settings: sundayCutRules === undefined
    ? { standardHours: 8, attendanceStatusRules: statusRules }
    : { standardHours: 8, attendanceStatusRules: statusRules, sundayCutRules }
});
const runEngine = (emp, rules) => computePayrollRecords(mkState(emp, rules), '2026-10', 'ALL')[0];

// Scenario 1: baseline — 2 present + 4 recorded Off Sundays => 6 payable,
// and the full output is identical with (a) no sundayCutRules key at all
// (pre-feature state), (b) the block present but disabled, (c) rules on
// but the employee out of scope.
const empBase = mkEmp('E1', att({
  '2026-10-01': P(), '2026-10-02': P(),
  '2026-10-04': OFF(), '2026-10-11': OFF(), '2026-10-18': OFF(), '2026-10-25': OFF(),
  '2026-10-05': A(), '2026-10-06': LEAVE(), '2026-10-07': { status: 'half day' },
  '2026-10-08': HOL(), '2026-10-13': SHORTY(), '2026-10-14': { status: 'present', ot: 2 }
}));
const baseNoKey = computePayrollRecords(mkState(empBase, undefined), '2026-10', 'ALL');
const baseDisabled = computePayrollRecords(mkState(empBase, normalizeSundayCutRules(null)), '2026-10', 'ALL');
const baseOutOfScope = computePayrollRecords(mkState(empBase, {
  twoAbsence: { enabled: true, minAbsences: 1, applyToAll: false, employeeIds: ['NOBODY'] },
  continuous: { enabled: true, applyToAll: false, employeeIds: ['NOBODY'] }
}), '2026-10', 'ALL');
check('S1: baseline fixture produces a record', Array.isArray(baseNoKey) && baseNoKey.length === 1);
check('S1: baseline payableDays = 10 (3 present + 0.5 half worked; 4 Off + leave + 0.5 half + holiday paid)',
  baseNoKey[0].payableDays === 10, `got ${baseNoKey[0].payableDays}`);
check('S1: disabled-rules output is byte-identical to pre-feature output',
  JSON.stringify(baseDisabled) === JSON.stringify(baseNoKey));
check('S1: enabled-but-out-of-scope output is byte-identical too',
  JSON.stringify(baseOutOfScope) === JSON.stringify(baseNoKey));

// Scenario 2 (engine): empS2 with Rule 1 on + selected.
const engS2 = runEngine(empS2, RULE1_ONLY);
check('S2 engine: cut Sunday drops payableDays by exactly 1 (8 -> 7)', engS2.payableDays === 7, `got ${engS2.payableDays}`);
check('S2 engine: absentsCount rises by exactly 1 (23 -> 24)', engS2.absentsCount === 24, `got ${engS2.absentsCount}`);
const engS2Off = runEngine(empS2, normalizeSundayCutRules(null));
check('S2 engine: same fixture with rules off pays both Sundays (payableDays 8)', engS2Off.payableDays === 8, `got ${engS2Off.payableDays}`);

// Scenario 10: unrecorded Sunday with triggers firing — helper reports
// the cut, but the engine money is unchanged vs baseline (it was
// already unpaid).
const empS10 = mkEmp('E1', att({ '2026-10-08': A(), '2026-10-09': A(), '2026-10-06': P() }));
check('S10: helper still reports the unrecorded Sunday as cut',
  cuts(empS10, '2026-10', RULE1_ONLY).has('2026-10-11'));
const engS10On = runEngine(empS10, RULE1_ONLY);
const engS10Off = runEngine(empS10, normalizeSundayCutRules(null));
check('S10: engine money unchanged for an unrecorded cut Sunday',
  JSON.stringify(engS10On) === JSON.stringify(engS10Off));

// Scenario 11 (engine): Nov 1 cut removes its paid Off Day from November.
const engS11 = computePayrollRecords(
  { ...mkState(empS11, RULE1_ONLY) }, '2026-11', 'ALL')[0];
check('S11 engine: Nov payableDays = 1 (only Nov 2 present; Nov 1 Sunday cut)',
  engS11 && engS11.payableDays === 1, `got ${engS11 && engS11.payableDays}`);

// ---------------------------------------------------------------- Part 3
console.log('Part 3 — static wiring checks');
const read = (p) => readFileSync(join(appDir, p), 'utf8');
const hrSettings = read('src/components/hr/HRSettings.jsx');
const payroll = read('src/utils/payrollCalc.js');
const hrAtt = read('src/components/hr/HRAttendance.jsx');
const hrPay = read('src/components/hr/HRPayslip.jsx');
const hrGen = read('src/components/hr/HRSalaryGeneration.jsx');
const flashCfg = read('src/components/hr/FlashAMConfig.jsx');
const helper = read('src/utils/sundayCut.js');

check('HR Settings default duty settings carry the sundayCutRules block',
  hrSettings.includes('sundayCutRules: normalizeSundayCutRules(null)'));
check('HR Settings load path merges/normalizes the block (older saves gain it)',
  hrSettings.includes('parsed.sundayCutRules = normalizeSundayCutRules(parsed.sundayCutRules)'));
check('HR Settings renders the Sunday Cut Rules card in the status_rules tab',
  hrSettings.includes('Weekly Off (Sunday) Cut Rules') && hrSettings.includes('renderSundayCutRulesCard()'));
check('HR Settings note mentions Sunday Cut Rules', hrSettings.includes('Sundays can be cut for selected employees'));
check('HR Settings reuses EmployeeMultiSelect for rule scope',
  hrSettings.includes('EmployeeMultiSelect') && flashCfg.includes('export function EmployeeMultiSelect'));
check('Payroll engine classifies cut Sundays via the shared helper',
  payroll.includes("from './sundayCut'") && payroll.includes('cutSundays.has(dateKey)'));
check('Live payslip modal applies the cut overlay',
  hrAtt.includes('cutSundays.has(dayDateStr)') && hrAtt.includes("remarks = 'Sunday Cut'"));
check('Attendance grid displays cut Sundays as absent',
  hrAtt.includes('getGridCutSundays') && hrAtt.includes("rec = { ...rec, status: 'absent' }"));
check('Payslip register prints ABS / Sunday Cut for cut Sundays',
  hrPay.includes('isCutSunday') && hrPay.includes("'Sunday Cut'"));
check('Salary Generation slip prints ABS / Sunday Cut for cut Sundays',
  hrGen.includes('isCutSunday') && hrGen.includes("'Sunday Cut'"));
check('Helper never writes attendance (no setCollection / emp.attendance assignment)',
  !helper.includes('setCollection') && !/attendance\s*\[[^\]]*\]\s*=/.test(helper));

console.log(`\nSunday Cut Rules smoke: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
