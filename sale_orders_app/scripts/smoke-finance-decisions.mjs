// Smoke test — Finance/Payroll decisions bundle (Omer's orders, 2026-10-24).
//
// Part 1 (static): no bank brand names anywhere in src; the default
//   chart carries the generic cash/bank accounts + the 9 payroll
//   accounts; the UI wiring for the bundle is present (counter-based
//   voucher numbering, SI Save Draft handler, promise-style appConfirm
//   in the payroll mapping screen).
// Part 2 (unit): the REAL finance engine over synthetic state —
//   draft voucher/SI/PI excluded from GL + aging, posted included;
//   tax-off PI posts no tax leg (even with a stale tax figure), tax-on
//   posts it; a salary month posts itemised through the payroll
//   mapping with Salary Payable returning to zero and the net credited
//   to Cash in Hand; voucher numbering + mapping-normalize behaviour.
// Part 3 (live REST): chart_of_accounts + app_config alignment after
//   the data migration, counters undisturbed, blob updated_at frozen.
//
// Run: node scripts/smoke-finance-decisions.mjs   (exit 0 = all pass)

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

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(fileURLToPath(new URL('.', import.meta.url)), '..');
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

// ---------------------------------------------------------------- Part 1
console.log('Part 1 — static source checks');
const brandRe = /HBL|Meezan|\bMCB\b/;
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const srcFiles = walk(join(appDir, 'src')).filter((p) => /\.(js|jsx)$/.test(p));
const brandHits = srcFiles.filter((p) => brandRe.test(readFileSync(p, 'utf8')));
check('no HBL/Meezan/MCB strings anywhere in src', brandHits.length === 0, brandHits.join(','));

const { DEFAULT_CHART_OF_ACCOUNTS, BANK_ACCOUNT_IDS, generateGeneralLedger, generateTrialBalance, generateARAging, generateAPAging } = await import('../src/utils/financeEngine.js');
const { normalizePayrollMappings, DEFAULT_PAYROLL_MAPPINGS } = await import('../src/utils/payrollAccountMapping.js');
const { nextVoucherNumber, formatVoucherId, parseVoucherSeq } = await import('../src/utils/voucherNumbering.js');

const byCode = new Map(DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
check("default chart 111010 is 'Cash in Hand'", byCode.get('111010')?.name === 'Cash in Hand');
check("default chart 112010 is 'Bank Account'", byCode.get('112010')?.name === 'Bank Account');
check('default chart has no 112020/112030', !byCode.has('112020') && !byCode.has('112030'));
check('BANK_ACCOUNT_IDS is only 112010', JSON.stringify(BANK_ACCOUNT_IDS) === JSON.stringify(['112010']));
const NEW_ACCOUNTS = {
  '117010': 'Employee Advances', '117020': 'Employee Loans', '217010': 'Salary Payable',
  '423010': 'Fines Recovery', '423020': 'Late Coming Deductions', '423030': 'Loan Recovery',
  '516010': 'Basic Salary Expense', '516020': 'Overtime Wages', '516030': 'Staff Allowances'
};
check('default chart carries all 9 payroll accounts with professional names',
  Object.entries(NEW_ACCOUNTS).every(([code, name]) => byCode.get(code)?.name === name));

const vouchersSrc = readFileSync(join(appDir, 'src/components/finance/Vouchers.jsx'), 'utf8');
check('Vouchers allocates numbers from persisted counters', vouchersSrc.includes('voucherCounterKey') && vouchersSrc.includes("setCollection('counters'"));
check('Vouchers stores taxApplied + states tax in the save confirmation', vouchersSrc.includes('taxApplied') && vouchersSrc.includes('Tax on this voucher:'));
const siSrc = readFileSync(join(appDir, 'src/components/finance/SalesInvoice.jsx'), 'utf8');
check("SI 'Save Draft' button is wired to a handler", siSrc.includes('onClick={handleSaveDraft}') && siSrc.includes("buildInvoice(invoiceId, 'Draft')"));
const siHistSrc = readFileSync(join(appDir, 'src/components/finance/SalesInvoiceHistory.jsx'), 'utf8');
check('SI History can post a draft (postSalesInvoice)', siHistSrc.includes('postSalesInvoice') && siHistSrc.includes("invoice.status === 'Draft'"));
const piSrc = readFileSync(join(appDir, 'src/components/finance/PurchaseInvoice.jsx'), 'utf8');
check('PI has tax toggle + taxApplied stored', piSrc.includes('setTaxApplied') && piSrc.includes('taxApplied,'));
const mappingSrc = readFileSync(join(appDir, 'src/components/hr/PayrollAccountMapping.jsx'), 'utf8');
check('Payroll mapping delete uses promise-style appConfirm', mappingSrc.includes('const ok = await appConfirm(') && !mappingSrc.includes("'Delete Payroll Category',\n      `Are you sure"));
const hrSettingsSrc = readFileSync(join(appDir, 'src/components/hr/HRSettings.jsx'), 'utf8');
check("HR Settings card count is data-driven (no hardcoded '12 Categories')", hrSettingsSrc.includes('{payrollCategoryCount} Categories') && !hrSettingsSrc.includes('>12 Categories<'));

// ---------------------------------------------------------------- Part 2
console.log('Part 2 — engine behaviour on synthetic state');
const baseState = {
  chartOfAccounts: DEFAULT_CHART_OF_ACCOUNTS,
  salesInvoices: [], purchaseInvoices: [], vouchers: [], paymentVouchers: [],
  returns: [], hr_generated_salaries: [], otherConsumptions: [],
  customers: [], suppliers: [], payroll_account_mapping: DEFAULT_PAYROLL_MAPPINGS
};
const glOf = (state) => generateGeneralLedger(state).entries;
const forDoc = (entries, id) => entries.filter((e) => e.sourceDocId === id);
const moveOf = (entries, accountId) => entries.filter((e) => e.accountId === accountId)
  .reduce((s, e) => s + e.debit - e.credit, 0);

// Draft vs posted voucher
const voucherLines = [{ accountId: '511010', accountName: 'Raw Material Consumed', debit: 5000, credit: 0 }, { accountId: '111010', accountName: 'Cash in Hand', debit: 0, credit: 5000 }];
const draftVoucher = { id: 'JV-001', type: 'JV', status: 'Draft', date: '2026-10-24', lines: voucherLines };
const postedVoucher = { ...draftVoucher, status: 'Posted' };
check('draft voucher produces NO GL entries', forDoc(glOf({ ...baseState, vouchers: [draftVoucher] }), 'JV-001').length === 0);
const postedGl = glOf({ ...baseState, vouchers: [postedVoucher] });
check('posted voucher produces its GL entries', forDoc(postedGl, 'JV-001').length === 2);
check('posted voucher GL is balanced', generateGeneralLedger({ ...baseState, vouchers: [postedVoucher] }).isBalanced);

// Draft vs posted sales invoice
const draftSI = { id: 'INV-8901', date: '2026-10-24', customerName: 'Test Customer', subtotal: 10000, tax: 1700, grandTotal: 11700, taxApplied: true, status: 'Draft' };
const settledSI = { ...draftSI, status: 'Settled' };
check('draft SI produces NO GL entries', forDoc(glOf({ ...baseState, salesInvoices: [draftSI] }), 'INV-8901').length === 0);
check('draft SI excluded from AR aging', generateARAging({ ...baseState, salesInvoices: [draftSI] }).totalBilled === 0);
const siGl = glOf({ ...baseState, salesInvoices: [settledSI] });
check('posted SI: Dr AR = grand total', moveOf(forDoc(siGl, 'INV-8901'), '113010') === 11700);
check('posted SI: Cr revenue = subtotal, Cr tax = 1700',
  moveOf(forDoc(siGl, 'INV-8901'), '411010') === -10000 && moveOf(forDoc(siGl, 'INV-8901'), '212010') === -1700);
check('posted SI counted in AR aging', generateARAging({ ...baseState, salesInvoices: [settledSI] }).totalBilled === 11700);

// Tax optional on PI
const piNoTax = { id: 'PINV-7801', date: '2026-10-24', vendorName: 'Test Vendor', subtotal: 20000, tax: 0, grandTotal: 20000, taxApplied: false, status: 'Posted' };
const piStaleTax = { ...piNoTax, id: 'PINV-7802', tax: 3400 };
const piTax = { id: 'PINV-7803', date: '2026-10-24', vendorName: 'Test Vendor', subtotal: 20000, tax: 3400, grandTotal: 23400, taxApplied: true, status: 'Posted' };
const piDraft = { ...piTax, id: 'PINV-7804', status: 'Draft' };
check('tax-off PI posts NO input-tax leg', forDoc(glOf({ ...baseState, purchaseInvoices: [piNoTax] }), 'PINV-7801').every((e) => e.accountId !== '116010'));
check('tax-off PI credits AP with the subtotal only', moveOf(forDoc(glOf({ ...baseState, purchaseInvoices: [piNoTax] }), 'PINV-7801'), '211010') === -20000);
check('taxApplied=false overrides a stale tax figure', forDoc(glOf({ ...baseState, purchaseInvoices: [piStaleTax] }), 'PINV-7802').every((e) => e.accountId !== '116010'));
check('tax-on PI posts the input-tax leg', moveOf(forDoc(glOf({ ...baseState, purchaseInvoices: [piTax] }), 'PINV-7803'), '116010') === 3400);
check('draft PI produces NO GL entries and no AP aging', forDoc(glOf({ ...baseState, purchaseInvoices: [piDraft] }), 'PINV-7804').length === 0
  && generateAPAging({ ...baseState, purchaseInvoices: [piDraft] }).totalInvoiced === 0);

// Salary month through the mapping
const salaryMonth = {
  id: 'SAL-TEST-2026-10', month: '2026-10', generatedAt: '2026-10-24', status: 'Finalized',
  records: [{
    employeeName: 'Test Employee', earnedBasicSalary: 30000, overtime: 2000, allowance: 1500,
    fine: 500, lateDeduction: 300, loan: 1000, advanceAmount: 700, absents: 9999, netSalary: 31000
  }]
};
const salState = { ...baseState, hr_generated_salaries: [salaryMonth] };
const salGl = generateGeneralLedger(salState);
check('salary GL is balanced overall', salGl.isBalanced, `diff=${salGl.difference}`);
const salEntries = forDoc(salGl.entries, 'SAL-TEST-2026-10');
check('basic salary debited to Basic Salary Expense (516010)', moveOf(salEntries, '516010') === 30000);
check('overtime debited to Overtime Wages (516020)', moveOf(salEntries, '516020') === 2000);
check('allowance debited to Staff Allowances (516030)', moveOf(salEntries, '516030') === 1500);
check('fines credited to Fines Recovery (423010)', moveOf(salEntries, '423010') === -500);
check('late coming credited to Late Coming Deductions (423020)', moveOf(salEntries, '423020') === -300);
check('loan deduction credited to Loan Recovery (423030)', moveOf(salEntries, '423030') === -1000);
check('advance recovery credited to Employee Advances (117010)', moveOf(salEntries, '117010') === -700);
check('absents amount is NOT double-deducted (no 9999 anywhere)', salEntries.every((e) => e.debit !== 9999 && e.credit !== 9999));
check('Salary Payable (217010) returns to ZERO', moveOf(salEntries, '217010') === 0);
check('net credited to Cash in Hand (111010)', moveOf(salEntries, '111010') === -31000);
check('nothing posts to the old bank account for salary', forDoc(salGl.entries, 'SAL-TEST-2026-10').every((e) => e.accountId !== '112010'));
const tb = generateTrialBalance(salState);
const payableRow = tb.rows.find((r) => r.code === '217010');
check('trial balance: Salary Payable closing is zero', payableRow && payableRow.closingDebit === 0 && payableRow.closingCredit === 0);
// Same result with NO saved mapping (code fallbacks to the seeded accounts)
const salGlNoMap = generateGeneralLedger({ ...salState, payroll_account_mapping: [] });
check('salary posts identically with an empty mapping (fallbacks)', moveOf(forDoc(salGlNoMap.entries, 'SAL-TEST-2026-10'), '217010') === 0
  && moveOf(forDoc(salGlNoMap.entries, 'SAL-TEST-2026-10'), '111010') === -31000
  && moveOf(forDoc(salGlNoMap.entries, 'SAL-TEST-2026-10'), '516010') === 30000);

// Voucher numbering
check('numbering starts at BPV-001', formatVoucherId('BPV', nextVoucherNumber({}, [], 'BPV')) === 'BPV-001');
check('numbering increments from the persisted counter', formatVoucherId('BPV', nextVoucherNumber({ voucherBPV: 1 }, [{ id: 'BPV-001', type: 'BPV' }], 'BPV')) === 'BPV-002');
check('numbering never re-issues an existing short number', formatVoucherId('JV', nextVoucherNumber({ voucherJV: 0 }, [{ id: 'JV-007', type: 'JV' }], 'JV')) === 'JV-008');
check('legacy long ids do not disturb the short series', nextVoucherNumber({}, [{ id: 'BPV-2026-0001', type: 'BPV' }], 'BPV') === 1);
check('parseVoucherSeq reads only the short format', parseVoucherSeq('CPV-042', 'CPV') === 42 && parseVoucherSeq('CPV-2026-0042', 'CPV') === 0);

// Mapping normalize migration
const OLD_LIVE = ['base_salary', 'overtime_pay', 'attendance_bonus', 'special_allowance', 'performance_bonus', 'deductions']
  .map((id) => ({ id, category: id, description: '', color: 'bg-primary', account: '', status: 'Missing' }));
const migrated = normalizePayrollMappings(OLD_LIVE);
check("normalize rebuilds Omer's 9 categories", migrated.length === 9
  && ['base_salary', 'overtime_pay', 'special_allowance', 'advance', 'loan', 'fines', 'late_deduction', 'loan_deduction', 'salary_payable'].every((id) => migrated.some((m) => m.id === id)));
check('normalize drops the obsolete categories', migrated.every((m) => !['attendance_bonus', 'performance_bonus', 'deductions'].includes(m.id)));
check('normalize links every category to its default GL account', migrated.every((m) => m.account && m.status === 'Linked'));
const withCustom = normalizePayrollMappings([...OLD_LIVE, { id: 'cat_123', category: 'Custom Thing', description: '', color: 'bg-primary', account: '511010 - Raw Material Consumed - PVC / PU Resin', status: 'Linked' }]);
check('normalize preserves user-added custom categories', withCustom.some((m) => m.id === 'cat_123' && m.category === 'Custom Thing'));
const withUserAccount = normalizePayrollMappings([{ id: 'base_salary', category: 'Base Salary', description: '', color: 'bg-primary', account: '512010 - Direct Factory Labor & Overtime Wages', status: 'Linked' }]);
check("normalize preserves a user's chosen account on a kept category", withUserAccount.find((m) => m.id === 'base_salary').account.startsWith('512010'));

// ---------------------------------------------------------------- Part 3
console.log('Part 3 — live data alignment (REST)');
const clientSrc = readFileSync(join(appDir, 'src/utils/supabaseClient.js'), 'utf8');
const SUPABASE_URL = /SUPABASE_URL\s*=\s*"([^"]+)"/.exec(clientSrc)[1];
const SUPABASE_KEY = /SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/.exec(clientSrc)[1];
const rest = async (path) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!res.ok) throw new Error(`REST ${path} -> ${res.status}`);
  return res.json();
};
const chart = await rest('chart_of_accounts?select=id,name,data');
check('live chart has 80 accounts (73 - 2 brand + 9 payroll)', chart.length === 80, `got ${chart.length}`);
check('live chart has zero brand-named accounts', chart.every((r) => !brandRe.test((r.data?.name || '') + ' ' + (r.name || ''))));
const liveByCode = new Map(chart.map((r) => [r.data?.code || r.id, r.data?.name]));
check("live 111010 = 'Cash in Hand', 112010 = 'Bank Account'", liveByCode.get('111010') === 'Cash in Hand' && liveByCode.get('112010') === 'Bank Account');
check('live chart: brand accounts deleted, payroll accounts present',
  !liveByCode.has('112020') && !liveByCode.has('112030') && Object.keys(NEW_ACCOUNTS).every((c) => liveByCode.get(c) === NEW_ACCOUNTS[c]));
const mappingRows = (await rest('app_config?select=data&key=eq.payrollAccountMapping'))[0]?.data;
check("live payroll mapping = Omer's 9 categories, all linked", Array.isArray(mappingRows) && mappingRows.length === 9 && mappingRows.every((m) => m.account));
const counters = (await rest('app_config?select=data&key=eq.counters'))[0]?.data;
check('live counters undisturbed ({lineCode: 0}, voucher keys appear on first use)', counters && counters.lineCode === 0);
const blob = (await rest('erp_state?id=eq.main_state&select=updated_at'))[0];
check('blob updated_at still frozen at Phase D value', blob.updated_at === '2026-10-23T17:09:47.335688+00:00', blob.updated_at);
for (const t of ['vouchers', 'purchase_invoices', 'sales_invoices', 'hr_generated_salaries']) {
  const rows = await rest(`${t}?select=id`);
  check(`live ${t} still at baseline (0 rows — no test data left)`, rows.length === 0, `got ${rows.length}`);
}

console.log(`\nSMOKE RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
