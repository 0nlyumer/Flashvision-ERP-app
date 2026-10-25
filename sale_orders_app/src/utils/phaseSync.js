// FG phase global sync (Omer, 2026-10-25 — Round 4).
//
// Omer's decision: when Plan Consumption creates a new phase, it must ALSO
// land in the global `finishedGoodPhases` list, so it appears as a column in
// Raw Material Configuration and items can be pre-ticked for it. The same
// propagation must happen on plan save for any phase that exists only inside
// a plan item's `phaseConfig` (e.g. arrived via a BOM's phaseConfig or an
// older saved plan).
//
// Pure + immutable helpers, smoke-testable without the UI:
// - mergePhasesIntoGlobal(globalList, phases): appends every phase whose id
//   is missing from the global list. Dedupe by id — an id that already exists
//   globally is NEVER overwritten by the local copy. Returns the SAME array
//   reference when nothing was appended, so callers can skip the write.
// - collectPhasesFromConsumption(consumptionData): flattens every item's
//   phaseConfig in a plan's consumptionData into one deduped phase list.

export function mergePhasesIntoGlobal(globalList, phases) {
  const base = Array.isArray(globalList) ? [...globalList] : [];
  if (!Array.isArray(phases) || phases.length === 0) return Array.isArray(globalList) ? globalList : base;
  const seen = new Set(base.map((p) => p && p.id).filter(Boolean));
  let changed = false;
  for (const phase of phases) {
    if (!phase || !phase.id) continue;
    if (seen.has(phase.id)) continue;
    seen.add(phase.id);
    base.push({ ...phase });
    changed = true;
  }
  return changed ? base : (Array.isArray(globalList) ? globalList : base);
}

export function collectPhasesFromConsumption(consumptionData) {
  const out = [];
  if (!consumptionData || typeof consumptionData !== 'object') return out;
  const seen = new Set();
  for (const itemData of Object.values(consumptionData)) {
    const cfg = itemData && itemData.phaseConfig;
    if (!Array.isArray(cfg)) continue;
    for (const phase of cfg) {
      if (!phase || !phase.id || seen.has(phase.id)) continue;
      seen.add(phase.id);
      out.push(phase);
    }
  }
  return out;
}
