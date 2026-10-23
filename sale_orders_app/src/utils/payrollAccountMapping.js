// --- Payroll Account Mapping (app_config key 'payrollAccountMapping') -----
// The HR Settings -> Payroll Account Mapping screen links each payroll
// expense category to a General Ledger account. The mappings used to live
// ONLY in each browser's localStorage (key 'hr_payroll_account_mappings'),
// so they diverged per browser and were lost on a browser swap. They now
// ride in app_config via AppContext (state key 'payroll_account_mapping'),
// mirroring the Flash AM config / Salary Print Settings pattern: a DEFAULT
// constant + a normalize function that validates saved rows, so older or
// partial saved mappings keep working. Persisted ONLY in app_config —
// never in the blob. The finance engine (financeEngine.js) resolves the
// salary GL accounts through these mappings at report time.
//
// A mapping row's `account` is the Chart-of-Accounts display string exactly
// as the mapping screen stores it: "<code> - <account name>" (e.g.
// "512010 - Direct Factory Labor & Overtime Wages"); '' means unmapped.

export const PAYROLL_MAPPING_LEGACY_STORAGE_KEY = 'hr_payroll_account_mappings';

// Exactly the PayrollAccountMapping screen's built-in defaults.
export const DEFAULT_PAYROLL_MAPPINGS = [
  { id: 'base_salary', category: 'Base Salary', description: 'Core monthly remuneration', color: 'bg-primary', account: '', status: 'Missing' },
  { id: 'overtime_pay', category: 'Overtime Pay', description: 'Hours exceeding standard roster', color: 'bg-secondary', account: '', status: 'Missing' },
  { id: 'attendance_bonus', category: 'Attendance Bonus', description: 'Monthly reward for perfect attendance', color: 'bg-amber-600', account: '', status: 'Missing' },
  { id: 'special_allowance', category: 'Special Allowances', description: 'Housing and transport subsidies', color: 'bg-blue-500', account: '', status: 'Missing' },
  { id: 'performance_bonus', category: 'Performance Bonus', description: 'Quarterly KPI-based incentives', color: 'bg-indigo-500', account: '', status: 'Missing' },
  { id: 'deductions', category: 'Deductions', description: 'Tax, Pension and Insurance', color: 'bg-error', account: '', status: 'Missing' }
];

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
  return rows.length > 0 ? rows : DEFAULT_PAYROLL_MAPPINGS.map((m) => ({ ...m }));
}

export function getInitialPayrollMappings() {
  return normalizePayrollMappings(null);
}

// The GL account code out of a mapping row's stored account string
// ("512010 - Direct Factory Labor & Overtime Wages" -> "512010").
// Returns '' when the category is unmapped.
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
