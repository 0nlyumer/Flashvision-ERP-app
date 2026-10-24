// --- Payroll Account Mapping (app_config key 'payrollAccountMapping') -----
// The HR Settings -> Payroll Account Mapping screen links each payroll
// category to a General Ledger account. The mappings used to live ONLY in
// each browser's localStorage (key 'hr_payroll_account_mappings'), so they
// diverged per browser and were lost on a browser swap. They now ride in
// app_config via AppContext (state key 'payroll_account_mapping'),
// mirroring the Flash AM config / Salary Print Settings pattern: a DEFAULT
// constant + a normalize function that validates saved rows, so older or
// partial saved mappings keep working. Persisted ONLY in app_config —
// never in the blob. The finance engine (financeEngine.js) resolves the
// salary GL accounts through these mappings at report time.
//
// A mapping row's `account` is the Chart-of-Accounts display string exactly
// as the mapping screen stores it: "<code> - <account name>" (e.g.
// "516010 - Basic Salary Expense"); '' means unmapped.
//
// CATEGORY SET (Omer's order, 2026-10-24): his business runs ONLY these
// payroll categories — there are NO tax / home-loan style categories:
//   Earnings:          Basic Salary, Overtime (an EARNING, never a
//                      deduction), Allowance
//   Employee balances: Advance, Loan
//   Deductions:        Fines, Late Coming Deduction, Loan Deduction
//   Net:               Salary Payable
// The defaults below link every category to its professional GL account
// (seeded into the Chart of Accounts with the same codes). The obsolete
// categories attendance_bonus / performance_bonus / deductions are
// dropped by normalizePayrollMappings wherever an old saved copy still
// carries them.

export const PAYROLL_MAPPING_LEGACY_STORAGE_KEY = 'hr_payroll_account_mappings';

export const DEFAULT_PAYROLL_MAPPINGS = [
  { id: 'base_salary', category: 'Basic Salary', description: 'Core monthly remuneration', color: 'bg-primary', account: '516010 - Basic Salary Expense', status: 'Linked' },
  { id: 'overtime_pay', category: 'Overtime', description: 'Pay for hours exceeding the standard roster (earning)', color: 'bg-secondary', account: '516020 - Overtime Wages', status: 'Linked' },
  { id: 'special_allowance', category: 'Allowance', description: 'Attendance and staff allowances', color: 'bg-blue-500', account: '516030 - Staff Allowances', status: 'Linked' },
  { id: 'advance', category: 'Advance', description: 'Salary advances given to employees (recoverable balance)', color: 'bg-amber-600', account: '117010 - Employee Advances', status: 'Linked' },
  { id: 'loan', category: 'Loan', description: 'Loans given to employees (recoverable balance)', color: 'bg-indigo-500', account: '117020 - Employee Loans', status: 'Linked' },
  { id: 'fines', category: 'Fines', description: 'Deduction — disciplinary fines', color: 'bg-error', account: '423010 - Fines Recovery', status: 'Linked' },
  { id: 'late_deduction', category: 'Late Coming Deduction', description: 'Deduction — late arrival minutes/hours', color: 'bg-orange-500', account: '423020 - Late Coming Deductions', status: 'Linked' },
  { id: 'loan_deduction', category: 'Loan Deduction', description: 'Deduction — monthly loan installment recovery', color: 'bg-rose-500', account: '423030 - Loan Recovery', status: 'Linked' },
  { id: 'salary_payable', category: 'Salary Payable', description: 'Net salary payable to employees (paid in cash)', color: 'bg-emerald-600', account: '217010 - Salary Payable', status: 'Linked' }
];

// Category ids from the retired pre-2026-10-24 default set. A saved
// mapping still carrying them is migrated: these rows are dropped (the
// lumped 'deductions' category is replaced by the itemised fines /
// late_deduction / loan_deduction / advance rows of Omer's set).
const OBSOLETE_PAYROLL_CATEGORY_IDS = new Set(['attendance_bonus', 'performance_bonus', 'deductions']);

const toStr = (v, fallback) => (typeof v === 'string' ? v : fallback);

export function normalizePayrollMappings(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
  }
  if (!Array.isArray(parsed)) {
    return DEFAULT_PAYROLL_MAPPINGS.map((m) => ({ ...m }));
  }
  const rows = parsed
    .filter((m) => m && typeof m === 'object' && typeof m.id === 'string' && m.id.trim() !== '')
    .filter((m) => !OBSOLETE_PAYROLL_CATEGORY_IDS.has(m.id))
    .map((m) => {
      const account = toStr(m.account, '');
      const isMapped = account.trim() !== '' && account !== 'Unmapped';
      return {
        id: m.id,
        category: toStr(m.category, m.id),
        description: toStr(m.description, ''),
        color: toStr(m.color, 'bg-primary'),
        account,
        status: isMapped ? 'Linked' : 'Missing'
      };
    });
  if (rows.length === 0) {
    return DEFAULT_PAYROLL_MAPPINGS.map((m) => ({ ...m }));
  }
  // Migration to Omer's 2026-10-24 category set: every canonical category
  // must be present — append any that are missing (with their default GL
  // link), and fill the default link for a canonical row that was saved
  // unmapped before its account existed. Custom user-added categories
  // (any other id) are preserved exactly as saved.
  const byId = new Map(rows.map((r) => [r.id, r]));
  DEFAULT_PAYROLL_MAPPINGS.forEach((def) => {
    const existing = byId.get(def.id);
    if (!existing) {
      rows.push({ ...def });
    } else if (!existing.account || existing.account.trim() === '' || existing.account === 'Unmapped') {
      existing.account = def.account;
      existing.status = 'Linked';
    }
  });
  return rows;
}

export function getInitialPayrollMappings() {
  return normalizePayrollMappings(null);
}

// The GL account code out of a mapping row's stored account string
// ("516010 - Basic Salary Expense" -> "516010"). Returns '' when the
// category is unmapped.
export function extractPayrollAccountCode(account) {
  if (typeof account !== 'string') return '';
  const trimmed = account.trim();
  if (!trimmed || trimmed === 'Unmapped') return '';
  return trimmed.split(' - ')[0].trim();
}

// Resolve the GL account code for a payroll category: the mapped code when
// the category is linked, otherwise the caller-provided fallback code.
export function resolvePayrollAccountCode(mappings, categoryId, fallbackCode) {
  const rows = Array.isArray(mappings) ? mappings : [];
  const row = rows.find((m) => m && m.id === categoryId);
  return extractPayrollAccountCode(row?.account) || fallbackCode;
}
