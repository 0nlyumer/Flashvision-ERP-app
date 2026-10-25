// Phase-mapping cleanup (Omer, 2026-10-25).
//
// Deleting a production phase must also remove its ticks from every item's
// `consumptionPhases` array — otherwise the deleted phase id lives on as an
// invisible orphan tick in the items table (found live: 13 cloth items still
// carried a deleted custom phase's id). Pure + immutable: returns the SAME
// array reference when nothing changed, so callers can skip the write.

export function stripPhaseFromItems(items, phaseId) {
  if (!Array.isArray(items) || !phaseId) return items;
  let changed = false;
  const next = items.map((item) => {
    if (item && Array.isArray(item.consumptionPhases) && item.consumptionPhases.includes(phaseId)) {
      changed = true;
      return { ...item, consumptionPhases: item.consumptionPhases.filter((p) => p !== phaseId) };
    }
    return item;
  });
  return changed ? next : items;
}
