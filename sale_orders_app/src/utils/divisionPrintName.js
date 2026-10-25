// Division "Full Name (for prints)" resolution (Omer, 2026-10-24).
//
// Division records live in the HR Settings divisions config
// (localStorage key 'hr_divisions_config' — the same records the
// Divisions create/edit form in HRSettings.jsx maintains). Each record
// may carry `printFullName`, used on print headers (pay slip subtitle,
// salary sheet header). Resolution order:
//   1. The division record's own printFullName (set via the form).
//   2. Built-in seeds (Omer's ordered defaults): AJ Synthetic and AAA.
//   3. '' — callers fall back (pay slip: current company text;
//      salary sheet: the division name itself).
// AAA's full name (Omer, 2026-10-25, corrected the same day): "AAA
// Industry" — three capital A's; the word "Triple" must NEVER be written.

export const DIVISIONS_CONFIG_KEY = 'hr_divisions_config';
export const AJ_SYNTHETIC_PRINT_NAME = 'AJ Synthetic Leather & Footwear Industries Pvt. Limited';
export const AAA_PRINT_NAME = 'AAA Industry';

export function getDivisionPrintFullName(divisionName) {
  const target = (divisionName || '').trim().toLowerCase();
  if (!target) return '';
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(DIVISIONS_CONFIG_KEY);
      if (saved) {
        const list = JSON.parse(saved);
        const hit = (Array.isArray(list) ? list : []).find(
          (d) => (d?.name || '').trim().toLowerCase() === target
        );
        if (hit && typeof hit.printFullName === 'string' && hit.printFullName.trim()) {
          return normalizeDivisionPrintName(hit.printFullName);
        }
      }
    }
  } catch (e) { /* config unreadable — fall through to seed */ }
  if (target === 'aj synthetic') return AJ_SYNTHETIC_PRINT_NAME;
  if (target === 'aaa') return AAA_PRINT_NAME;
  return '';
}

// Legacy spelling guard: configs saved before the 2026-10-25 correction
// may still carry the old "Triple A Industry" string — it always
// resolves to the corrected name.
export function normalizeDivisionPrintName(name) {
  const v = (name || '').trim();
  return v === 'Triple A Industry' ? AAA_PRINT_NAME : v;
}

// Pay slip identity (Omer, 2026-10-25): the slip's big heading, monogram
// and footer name line follow the EMPLOYEE's division. AJ Synthetic
// slips render exactly as they always have; AAA slips carry 'AAA' /
// 'AAA' / 'AAA Industry'. `slip` is the object HRPayslipModal receives
// (division may ride on slip.division/section when the builder set it;
// otherwise the resolved printFullName decides).
export function getPayslipIdentity(slip) {
  const rawDiv = ((slip && (slip.division || slip.section)) || '').trim().toLowerCase();
  const full = normalizeDivisionPrintName((slip && slip.printFullName) || '');
  const isAAA = rawDiv === 'aaa' || full === AAA_PRINT_NAME;
  if (isAAA) {
    return { heading: 'AAA', monogram: 'AAA', fullName: full || AAA_PRINT_NAME };
  }
  return { heading: 'AJ SYNTHETIC', monogram: 'AJ', fullName: full || AJ_SYNTHETIC_PRINT_NAME };
}
