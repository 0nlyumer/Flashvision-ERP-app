// smoke-daily-activity — the Daily Activity File builder
// (src/utils/dailyActivity.js): one virtual file per date, assembled
// live from state. Fixtures cover: category/group assembly + counts,
// date resolution (ISO + DD/MM/YYYY), voucher slip shaping, the Daily
// Petty Cash report (opening balance carried in, running balance,
// closing), gate pass summary cards, HR request records, and the
// empty-day case.
// Run: node scripts/smoke-daily-activity.mjs   (exit 0 = all pass)

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

const { buildDailyActivity, buildPettyCashReport, recordDateStr } = await import('../src/utils/dailyActivity.js');

console.log('Part 1 — date resolution');
check('ISO date string', recordDateStr({ date: '2026-10-28' }) === '2026-10-28');
check('ISO datetime keeps its date', recordDateStr({ createdAt: '2026-10-28T23:30:00.000Z' }) === '2026-10-28');
check('DD/MM/YYYY read as written', recordDateStr({ date: '28/10/2026' }) === '2026-10-28');
check('falls through the field chain', recordDateStr({ planDate: '2026-10-27', createdAt: '2026-10-28T00:00:00.000Z' }) === '2026-10-27');
check('no date -> null', recordDateStr({ id: 'X' }) === null);

const DAY = '2026-10-28';
const state = {
  customers: [{ id: 'C1', name: 'Acme Traders', contactPerson: 'Mr Acme' }],
  chartOfAccounts: [{ id: '111020', name: 'Petty Cash - Head Office & Admin' }, { id: '511000', name: 'Office Supplies' }],
  vouchers: [
    { id: 'JV-001', type: 'JV', date: DAY, status: 'Posted', narration: 'Adjustment', totalDebit: 5000, totalCredit: 5000,
      lines: [{ accountId: '511000', accountName: 'Office Supplies', narration: 'adj', debit: 5000, credit: 0 }] },
    { id: 'CPV-001', type: 'CPV', date: DAY, status: 'Posted', narration: 'Petty supplies', totalDebit: 1500, totalCredit: 1500,
      lines: [
        { accountId: '511000', accountName: 'Office Supplies', narration: 'stationery', debit: 1500, credit: 0 },
        { accountId: '111020', narration: 'paid from petty', debit: 0, credit: 1500 }
      ] },
    { id: 'CRV-001', type: 'CRV', date: DAY, status: 'Posted', narration: 'Petty top-up', totalDebit: 10000, totalCredit: 10000,
      lines: [
        { accountId: '111020', narration: 'top up', debit: 10000, credit: 0 },
        { accountId: '111010', accountName: 'Cash in Hand', narration: '', debit: 0, credit: 10000 }
      ] },
    // yesterday's posted petty movement (opening balance) + a draft (excluded)
    { id: 'CPV-000', type: 'CPV', date: '2026-10-27', status: 'Posted', narration: 'old', totalDebit: 2000, totalCredit: 2000,
      lines: [{ accountId: '111020', narration: 'old out', debit: 0, credit: 2000 }, { accountId: '511000', debit: 2000, credit: 0 }] },
    { id: 'CPV-002', type: 'CPV', date: DAY, status: 'Draft', narration: 'draft', totalDebit: 999, totalCredit: 999,
      lines: [{ accountId: '111020', narration: 'draft out', debit: 0, credit: 999 }] },
    { id: 'BPV-OLD', type: 'BPV', date: '2026-10-20', status: 'Posted', narration: 'other day', lines: [] }
  ],
  paymentVouchers: [],
  saleOrders: [{ id: 'SO-100', customerId: 'C1', customerName: 'Acme Traders', date: DAY, status: 'Pending', items: [] }],
  deliveries: [{ id: 'DC-100', dcNumber: 'DC-100', customerName: 'Acme Traders', date: DAY, items: [{ itemName: 'FG-001', quantity: 10 }] }],
  salesInvoices: [{ id: 'SI-100', customerName: 'Acme Traders', date: DAY, items: [] }],
  purchaseOrders: [{ id: 'PO-100', supplierName: 'Supplier Co', date: DAY, items: [] }],
  purchaseInvoices: [],
  approvals: [{ id: 'GRN-100', type: 'GRN Log', date: DAY, status: 'Approved' }],
  stockReceiving: [],
  inwardGatePasses: [{ id: 'IGP-100', supplierName: 'Supplier Co', date: DAY, status: 'Pending', items: [] }],
  productionPlans: [{ id: 'PLAN-100', planDate: DAY, items: [], consumptions: {} }],
  productionOutputs: [{ id: 'OUT-100', date: DAY, itemName: 'FG-001' }],
  otherConsumptions: [{ id: 'OC-100', date: DAY, itemName: 'Glue', itemCode: 'RM-050', quantity: 2, price: 100, unit: 'Kg', department: 'Production' }],
  gatePassActivities: [
    { id: 'OGP-001', type: 'Outward', description: 'FG dispatch', timestamp: `${DAY}T10:15:00.000Z`, sender: 'guard', photos: [1, 2], videos: [], documents: [] },
    { id: 'IGP-001', type: 'Inward', description: 'Cloth in', timestamp: `${DAY}T09:00:00.000Z`, sender: 'guard', photos: [], videos: [], documents: [1] }
  ],
  hr_employees_list: [{ id: 'EMP-1', name: 'Test Emp', department: 'Production' }],
  hr_leave_requests: [{ id: 'LVR-1', employeeId: 'EMP-1', employeeName: 'Test Emp', leaveType: 'annual', startDate: DAY, endDate: DAY, category: 'paid', days: 1, status: 'Approved', createdAt: `${DAY}T08:00:00.000Z`, dateApplied: DAY }],
  hr_loan_requests: [],
  hr_overtime_requests: [],
  hr_advance_requests: []
};

console.log('Part 2 — assembly');
const day = buildDailyActivity(state, DAY);
const cat = (id) => day.categories.find((c) => c.id === id);
const grp = (cid, gid) => cat(cid)?.groups.find((g) => g.id === gid);
check('finance present with voucher groups + petty', !!cat('finance') && !!grp('finance', 'vouchers-JV') && !!grp('finance', 'vouchers-CPV') && !!grp('finance', 'petty-cash'));
check('JV slip record shaped (header + account lines)', (() => {
  const d = grp('finance', 'vouchers-JV').docs[0];
  return d.slip === true && d.docType === 'voucher_journal' && d.record.header.voucher_no === 'JV-001' && d.record.items[0].account_head.includes('Office Supplies');
})());
check('sales groups complete', !!grp('sales', 'sale-orders') && !!grp('sales', 'delivery-challans') && !!grp('sales', 'sale-invoices'));
check('sale order record enriched with customer string', grp('sales', 'sale-orders').docs[0].record.customer === 'Acme Traders');
check('purchase groups complete', !!grp('purchase', 'purchase-orders') && !!grp('purchase', 'grns') && !!grp('purchase', 'inward-gate-passes'));
check('production groups complete', !!grp('production', 'production-plans') && !!grp('production', 'production-outputs') && !!grp('production', 'other-consumptions'));
check('no consumptions group when plans carry none', !grp('production', 'consumptions'));
check('gate pass is ONE summary entry with both activities', (() => {
  const g = grp('gatepass', 'gate-pass-activities');
  return g && g.docs.length === 1 && g.docs[0].kind === 'gatepass' && g.docs[0].activities.length === 2 && g.docs[0].activities[0].photos === 2;
})());
check('HR leave group present, built record', !!grp('hr', 'leave-requests') && grp('hr', 'leave-requests').docs[0].record.header.emp_name === 'Test Emp');
check('counts foot: total = sum of categories', day.totalDocs === day.categories.reduce((s, c) => s + c.count, 0), `total=${day.totalDocs}`);
check('other-day documents excluded', !JSON.stringify(day).includes('BPV-OLD'));

console.log('Part 3 — petty cash report');
const petty = buildPettyCashReport(state, DAY);
check('petty report exists for the day', !!petty);
check('opening balance carries earlier days only (-2,000)', petty.header.opening_balance === '-2,000.00', petty.header.opening_balance);
check('draft voucher excluded from movements', petty.items.length === 2, `items=${petty.items.length}`);
check('running balance: -3,500 after out, 6,500 after in',
  petty.items[0].balance === '-3,500.00' && petty.items[1].balance === '6,500.00',
  JSON.stringify(petty.items.map((i) => i.balance)));
check('closing = opening + day movement', petty.header.closing_balance === '6,500.00');
check('no movements -> no report', buildPettyCashReport(state, '2026-10-25') === null);

console.log('Part 4 — empty day');
const empty = buildDailyActivity(state, '2026-12-01');
check('empty day: no categories, zero docs', empty.categories.length === 0 && empty.totalDocs === 0);

console.log(`\n${fail === 0 ? 'ALL PASS' : 'FAILURES PRESENT'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
