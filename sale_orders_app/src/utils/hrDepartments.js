// Canonical HR departments (Omer, 2026-10-25).
//
// HR keeps its OWN department list — exactly these five, names/spellings
// exactly as Omer confirmed (no renaming). This list is independent of
// the three STOCK departments in the `departments` table (Production
// Department / Raw Material Department / Finishing Department), which
// are stock units with per-department balances and must never be
// merged with, seeded from, or overwritten by the HR list.
//
// The list persists per-browser in localStorage under
// 'hr_departments_config' (maintained by the HR Settings form). This
// module is the single seed/fallback every HR screen uses when no
// saved config exists, so all HR screens show the same five.

export const HR_DEPARTMENTS_CONFIG_KEY = 'hr_departments_config';

export const CANONICAL_HR_DEPARTMENTS = [
  { id: 101, name: 'Finishgood', tagline: 'Company Department', managers: [], operators: [], incharges: [], sections: [], subSections: [] },
  { id: 102, name: 'Production', tagline: 'Company Department', managers: [], operators: [], incharges: [], sections: [], subSections: [] },
  { id: 103, name: 'Row Meterial', tagline: 'Company Department', managers: [], operators: [], incharges: [], sections: [], subSections: [] },
  { id: 104, name: 'Mechanical', tagline: 'Company Department', managers: [], operators: [], incharges: [], sections: [], subSections: [] },
  { id: 105, name: 'AAA', tagline: 'Company Department', managers: [], operators: [], incharges: [], sections: [], subSections: [] }
];

export function seedHrDepartments() {
  return CANONICAL_HR_DEPARTMENTS.map((d) => ({
    ...d,
    managers: [...d.managers],
    operators: [...d.operators],
    incharges: [...d.incharges],
    sections: [...d.sections],
    subSections: [...d.subSections]
  }));
}

// A saved config holding only the old demo departments counts as unset.
function isDummyHrConfig(parsed) {
  return (
    Array.isArray(parsed) &&
    parsed.length === 3 &&
    parsed.some((d) => d && (d.name === 'Production Department' || d.name === 'Assembly Division'))
  );
}

// Saved config (if valid) wins; otherwise the canonical five.
export function loadHrDepartments() {
  try {
    const saved = localStorage.getItem(HR_DEPARTMENTS_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0 && !isDummyHrConfig(parsed)) {
        return parsed;
      }
    }
  } catch (e) { /* unreadable config — fall through to the seed */ }
  return seedHrDepartments();
}
