// Smoke — Request-history privacy (Omer, 2026-10-26): on the four HR
// request screens (Leave / Loan / Overtime / Advance) a signed-in user
// sees ONLY their own request history.
//
// A: ownRequests / isOwnRequest (real util imported) — two employees
//    A/B, records in BOTH employeeId conventions the app stamps:
//    Leave/Overtime stamp the USER row id, Loan/Advance stamp the
//    hr_employees id. A sees exactly A's, B sees exactly B's, in every
//    convention, plus the name-match path and the duplicate-employee-
//    name case (an employee can exist twice in hr_employees_list).
// B: Purity — inputs never mutated; no user / empty list -> empty.
// C: Source contracts — each of the four screens derives its history
//    (and Advance's header print button) from the scoped list.
import fs from 'fs';

const APP = '/home/hatch/workspace/erp/sale_orders_app';
const read = (p) => fs.readFileSync(p, 'utf8');
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name); } };

const { ownRequests, isOwnRequest, myEmployeeIds, normalizePersonName } =
  await import(`${APP}/src/utils/requestOwnership.js`);

// --- Fixtures -------------------------------------------------------------
const EMPLOYEES = [
  { id: 'EMP-A', name: 'Ayesha Khan' },
  { id: 'EMP-B', name: 'Bilal Ahmed' },
  // Same person twice in the list (live data has UMER ALI as EMP-034 + EMP-088)
  { id: 'EMP-034', name: 'UMER ALI' },
  { id: 'EMP-088', name: 'Umer Ali' },
];
const USER_A = { id: 'user-a-001', username: 'ayesha', name: 'Ayesha Khan' };
const USER_B = { id: 'user-b-002', username: 'bilal', name: 'Bilal Ahmed' };
const USER_C = { id: 'user-c-003', username: 'only.umer', name: 'UMER ALI' };

const RECORDS = [
  // Leave / Overtime convention: employeeId = user row id
  { id: 'LVR-A1', employeeId: 'user-a-001', employeeName: 'Ayesha Khan' },
  { id: 'LVR-B1', employeeId: 'user-b-002', employeeName: 'Bilal Ahmed' },
  // Loan / Advance convention: employeeId = hr_employees id
  { id: '#LR-A1', employeeId: 'EMP-A', employeeName: 'Ayesha Khan' },
  { id: '#LR-B1', employeeId: 'EMP-B', employeeName: 'Bilal Ahmed' },
  // Name-only ownership: stale/fallback employeeId, name carries it
  { id: 'OTR-A1', employeeId: 'EMP-4091', employeeName: 'Ayesha Khan' },
  { id: 'OTR-B1', employeeId: 'EMP-4091', employeeName: 'Bilal Ahmed' },
  // Whitespace/case-drifted name still resolves to its owner
  { id: '#ADV-A1', employeeId: 'EMP-XXX', employeeName: '  ayesha   KHAN ' },
  // Duplicate-name employee: both employee ids belong to user C
  { id: '#LR-C1', employeeId: 'EMP-034', employeeName: 'UMER ALI' },
  { id: '#LR-C2', employeeId: 'EMP-088', employeeName: 'Umer Ali' },
  { id: 'LVR-C1', employeeId: 'user-c-003', employeeName: 'UMER ALI' },
  // A record owned by nobody in the fixture users
  { id: 'LVR-Z1', employeeId: 'EMP-Z', employeeName: 'Zara Sheikh' },
];
const ids = (list) => list.map((r) => r.id).sort();

// --- A: scoping behaviour ---------------------------------------------------
{
  const aOwn = ownRequests(RECORDS, USER_A, EMPLOYEES);
  check('A sees exactly A records (both conventions + name path)', JSON.stringify(ids(aOwn)) === JSON.stringify(['#ADV-A1', '#LR-A1', 'LVR-A1', 'OTR-A1']));
  const bOwn = ownRequests(RECORDS, USER_B, EMPLOYEES);
  check('B sees exactly B records', JSON.stringify(ids(bOwn)) === JSON.stringify(['#LR-B1', 'LVR-B1', 'OTR-B1']));
  check('A list has zero B records', !aOwn.some((r) => r.employeeName === 'Bilal Ahmed'));
  check('B list has zero A records', !bOwn.some((r) => r.employeeName === 'Ayesha Khan'));
  const cOwn = ownRequests(RECORDS, USER_C, EMPLOYEES);
  check('C (duplicate-name employee) sees both employee-id records + own user-id record', JSON.stringify(ids(cOwn)) === JSON.stringify(['#LR-C1', '#LR-C2', 'LVR-C1']));
  check('unowned record (Z) invisible to A, B and C', ![...aOwn, ...bOwn, ...cOwn].some((r) => r.id === 'LVR-Z1'));
  check('isOwnRequest: A owns #LR-A1', isOwnRequest(RECORDS[2], USER_A, EMPLOYEES) === true);
  check('isOwnRequest: A does NOT own #LR-B1', isOwnRequest(RECORDS[3], USER_A, EMPLOYEES) === false);
  check('isOwnRequest: B does NOT own LVR-A1', isOwnRequest(RECORDS[0], USER_B, EMPLOYEES) === false);
  check('myEmployeeIds(A) = user id + EMP-A', JSON.stringify([...myEmployeeIds(USER_A, EMPLOYEES)].sort()) === JSON.stringify(['EMP-A', 'user-a-001']));
  check('myEmployeeIds(C) collects BOTH duplicate employee ids', JSON.stringify([...myEmployeeIds(USER_C, EMPLOYEES)].sort()) === JSON.stringify(['EMP-034', 'EMP-088', 'user-c-003']));
  check('normalizePersonName trims/collapses/lowercases', normalizePersonName('  Umer   ALI ') === 'umer ali');
}

// --- B: purity / edges --------------------------------------------------------
{
  const before = JSON.stringify(RECORDS);
  ownRequests(RECORDS, USER_A, EMPLOYEES);
  check('input list + records not mutated', JSON.stringify(RECORDS) === before);
  check('no signed-in user -> empty list', ownRequests(RECORDS, null, EMPLOYEES).length === 0);
  check('null/undefined list -> empty list', ownRequests(null, USER_A, EMPLOYEES).length === 0 && ownRequests(undefined, USER_A, EMPLOYEES).length === 0);
  check('user with no employee + no records -> empty list', ownRequests(RECORDS, { id: 'nobody', name: 'Nobody Here' }, EMPLOYEES).length === 0);
  check('record without employeeId/employeeName is never owned', isOwnRequest({ id: 'X' }, USER_A, EMPLOYEES) === false);
}

// --- C: source contracts ------------------------------------------------------
{
  const leave = read(`${APP}/src/components/hr/HRLeaveRequest.jsx`);
  check('Leave: imports ownRequests', leave.includes("from '../../utils/requestOwnership'"));
  check('Leave: history derives from scoped list', leave.includes('ownRequests(state.hr_leave_requests, state.currentUser, state.hr_employees_list).filter('));

  const loan = read(`${APP}/src/components/hr/HRLoanRequest.jsx`);
  check('Loan: imports ownRequests', loan.includes("from '../../utils/requestOwnership'"));
  check('Loan: scoped list computed from full list + currentUser', loan.includes('ownRequests(loanRequests, state.currentUser, state.hr_employees_list)'));
  check('Loan: history filter runs on scoped list', loan.includes('const filteredRequests = myLoanRequests.filter('));

  const ot = read(`${APP}/src/components/hr/HROvertime.jsx`);
  check('Overtime: imports ownRequests', ot.includes("from '../../utils/requestOwnership'"));
  check('Overtime: history derives from scoped list', ot.includes('ownRequests(state.hr_overtime_requests, state.currentUser, state.hr_employees_list).filter('));
  check('Overtime: approved-hours-this-month total is scoped to own', ot.includes('ownRequests(state.hr_overtime_requests, state.currentUser, state.hr_employees_list).reduce('));

  const adv = read(`${APP}/src/components/hr/HRAdvanceRequest.jsx`);
  check('Advance: imports ownRequests', adv.includes("from '../../utils/requestOwnership'"));
  check('Advance: scoped list computed from full list + currentUser', adv.includes('ownRequests(advanceRequests, currentUser, state.hr_employees_list)'));
  check('Advance: history filter runs on scoped list', adv.includes('const filteredRequests = myAdvanceRequests.filter('));
  check('Advance: header print button prints latest OWN request', adv.includes('handlePrintRequest(myAdvanceRequests[0])'));
  check('Advance: header print button no longer prints company-latest', !adv.includes('handlePrintRequest(advanceRequests[0])'));
}

console.log(`\nsmoke-request-history-privacy: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
