// Division "Full Name (for prints)" resolution (Omer, 2026-10-24).
//
// Division records live in the HR Settings divisions config
// (localStorage key 'hr_divisions_config' — the same records the
// Divisions create/edit form in HRSettings.jsx maintains). Each record
// may carry `printFullName`, used on print headers (pay slip subtitle,
// salary sheet header). Resolution order:
//   1. The division record's own printFullName (set via the form).
//   2. Built-in seed for AJ Synthetic (Omer's ordered default).
//   3. '' — callers fall back (pay slip: current company text;
//      salary sheet: the division name itself).
// AAA has NO seed on purpose — Omer will provide its full name later;
// never invent one.

export const DIVISIONS_CONFIG_KEY = 'hr_divisions_config';
export const AJ_SYNTHETIC_PRINT_NAME = 'AJ Synthetic Leather & Footwear Industries Pvt. Limited';

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
          return hit.printFullName.trim();
        }
      }
    }
  } catch (e) { /* config unreadable — fall through to seed */ }
  if (target === 'aj synthetic') return AJ_SYNTHETIC_PRINT_NAME;
  return '';
}
