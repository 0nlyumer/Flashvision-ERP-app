// HR onboarding history — a browser-local record list (localStorage key
// 'hr_onboarding_history') written by HROnboarding and read by the HR
// Dashboard Live Activity feed, the Document Warehouse and the Smart
// Archive Shelf. Entries were auto-seeded from each employee's
// department AT SEED TIME, so a department renamed later in the tables
// (e.g. 'Global Logistics' → 'General', decisions bundle 2026-10-25)
// kept showing its old name from this frozen local copy — the HR
// Dashboard Live Activity still displayed 'Global Logistics • HR
// MANAGER' for Umer Ali long after hr_employees was cleaned.
//
// Fix (same load-migration pattern as the AAA print-name correction):
// every read goes through loadOnboardingHistory(), which normalizes
// legacy department labels in the stored records and writes the
// cleaned list back, so the old name cannot surface on any screen and
// the stored copy heals itself on first load. Only the department
// label is touched; every other field is preserved as-is.

export const ONBOARDING_HISTORY_KEY = 'hr_onboarding_history';

const LEGACY_DEPARTMENT_LABELS = {
  'Global Logistics': 'General'
};

const normalizeDept = (value) => {
  if (typeof value !== 'string') return value;
  return LEGACY_DEPARTMENT_LABELS[value.trim()] || value;
};

export function normalizeOnboardingHistory(list) {
  if (!Array.isArray(list)) return { list: [], changed: false };
  let changed = false;
  const next = list.map((item) => {
    if (!item || typeof item !== 'object') return item;
    let out = item;
    if (typeof item.department === 'string' && normalizeDept(item.department) !== item.department) {
      out = { ...out, department: normalizeDept(item.department) };
      changed = true;
    }
    if (item.formData && typeof item.formData === 'object'
      && typeof item.formData.department === 'string'
      && normalizeDept(item.formData.department) !== item.formData.department) {
      out = { ...out, formData: { ...item.formData, department: normalizeDept(item.formData.department) } };
      changed = true;
    }
    return out;
  });
  return { list: next, changed };
}

export function loadOnboardingHistory() {
  try {
    const raw = localStorage.getItem(ONBOARDING_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const { list, changed } = normalizeOnboardingHistory(parsed);
    if (changed) {
      try { localStorage.setItem(ONBOARDING_HISTORY_KEY, JSON.stringify(list)); } catch (e) { /* storage full/blocked — normalized list still returned */ }
    }
    return list;
  } catch (e) {
    return [];
  }
}

export function saveOnboardingHistory(list) {
  const { list: normalized } = normalizeOnboardingHistory(list);
  try { localStorage.setItem(ONBOARDING_HISTORY_KEY, JSON.stringify(normalized)); } catch (e) { /* ignore */ }
  return normalized;
}
