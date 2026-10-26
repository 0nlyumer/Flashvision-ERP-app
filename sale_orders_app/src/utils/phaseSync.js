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

// Rename propagation (Omer, 2026-10-26 — approved batch Part 3).
//
// Round 4 deliberately NEVER overwrote an existing global phase (a stale
// plan copy must not clobber the global record). Omer's follow-up decision:
// a phase RENAME is the one exception — when a phase is renamed in Plan
// Consumption and the plan is saved, the matching global column (same id)
// takes the new name, so Raw Material Configuration shows the new title too.
// ONLY the name moves: every other global field (tank, unit, width, enabled,
// type) keeps the global record's own value, and item ticks — stored as
// phase ids in item.consumptionPhases — are untouched by construction.
// Old plans/BOMs keep their own snapshot phaseConfig (history never
// rewritten): these helpers are pure and mutate nothing they are given.

export function renamePhaseInGlobal(globalList, phaseId, newTitle) {
  if (!Array.isArray(globalList) || !phaseId) return globalList;
  const title = String(newTitle ?? '').trim();
  if (!title) return globalList;
  let changed = false;
  const next = globalList.map((p) => {
    if (!p || p.id !== phaseId || p.title === title) return p;
    changed = true;
    const out = { ...p, title };
    // Some phase records mirror the name in `label` (the RM editor writes
    // both); keep a mirrored label in step, never invent one.
    if (p.label !== undefined && p.label === p.title) out.label = title;
    return out;
  });
  return changed ? next : globalList;
}

export function applyPhaseRenamesToGlobal(globalList, phases) {
  if (!Array.isArray(globalList) || !Array.isArray(phases) || phases.length === 0) {
    return globalList;
  }
  let out = globalList;
  for (const phase of phases) {
    if (!phase || !phase.id) continue;
    out = renamePhaseInGlobal(out, phase.id, phase.title);
  }
  return out;
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
