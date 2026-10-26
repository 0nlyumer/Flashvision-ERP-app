// Smoke — Approved batch Part 3 (Omer, 2026-10-26): FG phase rename
// propagation to the global finishedGoodPhases list.
// A: renamePhaseInGlobal / applyPhaseRenamesToGlobal (real util imported)
//    — renames by id, name only, ticks (ids) untouched, no-ops are
//    reference-identical, inputs never mutated.
// B: Round-4 contract intact — mergePhasesIntoGlobal still never overwrites
//    an existing global record's fields.
// C: PlanConsumption source contract — title edits tracked per session,
//    save applies session renames before the merge; snapshots untouched.
import fs from 'fs';
import { execSync } from 'child_process';

const APP = '/home/hatch/workspace/erp/sale_orders_app';
const read = (p) => fs.readFileSync(p, 'utf8');
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name); } };

execSync(`rm -rf /tmp/phase-rename-smoke && mkdir -p /tmp/phase-rename-smoke/utils`);
execSync(`cp ${APP}/src/utils/phaseSync.js /tmp/phase-rename-smoke/utils/phaseSync.js`);
const { renamePhaseInGlobal, applyPhaseRenamesToGlobal, mergePhasesIntoGlobal, collectPhasesFromConsumption } =
  await import('/tmp/phase-rename-smoke/utils/phaseSync.js');

const GLOBAL = [
  { id: 'top', title: 'TOP Phase', tank: 'Tank A', unit: 'kg', width: 420, enabled: true, type: 'Raw Material' },
  { id: 'foam', title: 'FOAM Phase', tank: 'Tank B', unit: 'kg', width: 420, enabled: true, type: 'Raw Material' },
  { id: 'custom-1', title: 'Old Name', label: 'Old Name', tank: 'Custom', unit: 'kg', width: 420, enabled: true, type: 'Raw Material' }
];
const ITEMS = [
  { id: 'RM-1', consumptionPhases: ['top', 'custom-1'] },
  { id: 'FG-1', consumptionPhases: ['foam'] }
];

// A: rename behaviour
{
  const before = JSON.parse(JSON.stringify(GLOBAL));
  const out = renamePhaseInGlobal(GLOBAL, 'custom-1', 'New Name');
  check('rename: returns new array', out !== GLOBAL);
  check('rename: title updated', out.find(p => p.id === 'custom-1').title === 'New Name');
  check('rename: mirrored label updated', out.find(p => p.id === 'custom-1').label === 'New Name');
  check('rename: other fields preserved (tank)', out.find(p => p.id === 'custom-1').tank === 'Custom');
  check('rename: other phases untouched', out.find(p => p.id === 'top').title === 'TOP Phase');
  check('rename: input not mutated', JSON.stringify(GLOBAL) === JSON.stringify(before));
  check('rename: missing id is reference no-op', renamePhaseInGlobal(GLOBAL, 'nope', 'X') === GLOBAL);
  check('rename: same title is reference no-op', renamePhaseInGlobal(GLOBAL, 'top', 'TOP Phase') === GLOBAL);
  check('rename: blank title is reference no-op', renamePhaseInGlobal(GLOBAL, 'top', '  ') === GLOBAL);
  check('rename: ticks are ids — item tick lists unchanged by rename',
    ITEMS[0].consumptionPhases.includes('custom-1') && ITEMS[0].consumptionPhases.length === 2);
}

// A2: applyPhaseRenamesToGlobal with a collected plan list + snapshot safety
{
  const plan = { id: 'PLAN-OLD', consumptions: { 'FG-9': { phaseConfig: [
    { id: 'foam', title: 'FOAM Phase', tank: 'STALE', unit: 'kg' },
    { id: 'top', title: 'TOP Phase Renamed', tank: 'STALE', unit: 'kg' }
  ] } } };
  const planBefore = JSON.parse(JSON.stringify(plan));
  const collected = collectPhasesFromConsumption(plan.consumptions);
  const renamed = applyPhaseRenamesToGlobal(GLOBAL, collected);
  check('apply: renamed phase takes new title', renamed.find(p => p.id === 'top').title === 'TOP Phase Renamed');
  check('apply: matching title stays', renamed.find(p => p.id === 'foam').title === 'FOAM Phase');
  check('apply: non-name fields NOT overwritten by plan copy', renamed.find(p => p.id === 'top').tank === 'Tank A');
  check('apply: old plan snapshot object unchanged', JSON.stringify(plan) === JSON.stringify(planBefore));
  check('apply: empty phases list is reference no-op', applyPhaseRenamesToGlobal(GLOBAL, []) === GLOBAL);
}

// B: Round-4 merge contract intact
{
  const merged = mergePhasesIntoGlobal(GLOBAL, [{ id: 'top', title: 'Sneaky Overwrite', tank: 'ZZZ' }]);
  check('merge: existing id never overwritten', merged === GLOBAL);
  const appended = mergePhasesIntoGlobal(GLOBAL, [{ id: 'brand-new', title: 'Brand New', tank: 'T' }]);
  check('merge: new id still appended', appended.length === GLOBAL.length + 1 && appended !== GLOBAL);
}

// C: PlanConsumption source contract
{
  const src = read(`${APP}/src/components/production/PlanConsumption.jsx`);
  check('source: imports applyPhaseRenamesToGlobal', src.includes('applyPhaseRenamesToGlobal'));
  check('source: title edits tracked in session ref', src.includes('phaseRenamesRef.current[phaseId] = updates.title'));
  check('source: save applies renames before merge', src.indexOf('applyPhaseRenamesToGlobal(') < src.indexOf('mergePhasesIntoGlobal(\n                renamedGlobalPhases'));
  check('source: save still merges collected phases', src.includes('collectPhasesFromConsumption(consumptionData)'));
}

console.log(`\nPhase Rename smoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
