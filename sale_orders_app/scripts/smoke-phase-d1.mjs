// Smoke test — Phase D Step D1 (2026-10-23).
//
// Table-maps the last blob-only entities (users, departments, boms,
// finishedGoodPhases, rawMaterialPhases) and moves counters +
// batchOutputTypes into app_config, mirroring the Phase C patterns.
//
// Part 1: buildEntityRow shape for the 5 entities against REAL live
//   records — the users row must carry username (the one extra NOT NULL
//   column found by live probe); departments must carry dept_value from
//   record.value; phases must carry the boolean enabled.
// Part 2: LIVE write-through round-trips with the REAL
//   syncEntityDiffToTable — a probe record per entity must be inserted,
//   then removed by a second diff, leaving every table at baseline.
// Part 3: app_config round-trips for counters / batchOutputTypes with the
//   REAL load/sync helpers (probe value written, read back, restored).
// Part 4: end-state — users table data JSON-equals the blob users,
//   app_config has 9 keys, no probe rows anywhere.
//
// Run: node scripts/smoke-phase-d1.mjs   (exit 0 = all pass)

// The app sources use Vite-style extensionless relative imports; register a
// resolve hook that retries with '.js' so plain Node can load them.
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); } catch (e) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.(js|mjs|json)$/.test(specifier)) {
      return next(specifier + '.js', context);
    }
    throw e;
  }
}`));

const {
  STEP1_ENTITY_TABLES, buildEntityRow, fetchEntityTable, syncEntityDiffToTable,
  recordKeyWithFallback, loadCountersFromTable, syncCountersToTable,
  loadBatchOutputTypesFromTable, syncBatchOutputTypesToTable,
} = await import('../src/utils/entityTables.js');
const { supabase } = await import('../src/utils/supabaseClient.js');

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`); }
};
const snapOf = (stateKey, records) => {
  const snap = new Map(); const seen = new Map();
  (records || []).forEach((rec) => {
    const k = recordKeyWithFallback(stateKey, rec, seen);
    if (k !== null) snap.set(k, JSON.stringify(rec));
  });
  return snap;
};
const tableIds = async (table) => {
  const { data, error } = await supabase.from(table).select('id');
  if (error) throw error;
  return data.map((r) => String(r.id)).sort();
};

// Baseline live contents
const live = {};
for (const key of ['users', 'departments', 'boms', 'finishedGoodPhases', 'rawMaterialPhases']) {
  live[key] = await fetchEntityTable(STEP1_ENTITY_TABLES[key]);
}
const { data: blobRows } = await supabase.from('erp_state').select('state_data').eq('id', 'main_state');
let blobState = blobRows[0].state_data;
if (typeof blobState === 'string') blobState = JSON.parse(blobState);

// ---------------------------------------------------------------- Part 1
console.log('Part 1 — buildEntityRow against live records');
check('STEP1 map has all 5 new entities',
  STEP1_ENTITY_TABLES.users === 'users' && STEP1_ENTITY_TABLES.departments === 'departments' &&
  STEP1_ENTITY_TABLES.boms === 'boms' && STEP1_ENTITY_TABLES.finishedGoodPhases === 'finished_good_phases' &&
  STEP1_ENTITY_TABLES.rawMaterialPhases === 'raw_material_phases');

const uRow = buildEntityRow('users', live.users.find((u) => u.username === 'only.umer'));
check('users row: id + verbatim data', uRow && String(uRow.id) === String(live.users.find((u) => u.username === 'only.umer').id) && uRow.data.username === 'only.umer');
check('users row: username populated (NOT NULL)', uRow.username === 'only.umer');
check('users row: full_name sourced from name', uRow.full_name === uRow.data.name);
check('users row: granular_permissions from granularPermissions',
  JSON.stringify(uRow.granular_permissions) === JSON.stringify(uRow.data.granularPermissions ?? null) || uRow.granular_permissions === undefined);

const dRow = buildEntityRow('departments', live.departments[0]);
check('departments row: dept_value sourced from record.value', dRow.dept_value === live.departments[0].value && typeof dRow.dept_value === 'string');
check('departments row: name + label populated', dRow.name === live.departments[0].name && dRow.label === live.departments[0].label);

const bRow = buildEntityRow('boms', live.boms.find((b) => b.finishedGoodName) || live.boms[0]);
check('boms row: finished_good_id from finishedGoodId', bRow.finished_good_id === bRow.data.finishedGoodId);

const fgRow = buildEntityRow('finished_good_phases', live.finishedGoodPhases[0]);
check('finished_good_phases row: enabled boolean + label/title/type',
  fgRow.enabled === live.finishedGoodPhases[0].enabled && fgRow.label === live.finishedGoodPhases[0].label && fgRow.type === live.finishedGoodPhases[0].type);
const rmRow = buildEntityRow('raw_material_phases', live.rawMaterialPhases[0]);
check('raw_material_phases row: enabled boolean + label', rmRow.enabled === live.rawMaterialPhases[0].enabled && rmRow.label === live.rawMaterialPhases[0].label);

// ---------------------------------------------------------------- Part 2
console.log('Part 2 — live write-through round-trips (probe insert + delete)');
const probes = {
  users: { id: '__probe__', username: 'probe.user', name: 'Probe User', role: 'Probe', permissions: [], granularPermissions: {}, email: '', phone: '', status: 'Active' },
  departments: { id: '__probe__', name: 'Probe Dept', label: 'Probe Dept', value: 'Probe Dept', itemIds: [], itemTypes: [], disabled: false },
  boms: { id: '__probe__', finishedGoodId: '__probe__', finishedGoodName: 'Probe BOM', status: 'Active', phases: [] },
  finishedGoodPhases: { id: '__probe__', label: 'Probe', title: 'Probe', type: 'Raw Material', enabled: true, tank: '', unit: 'kg', width: 420 },
  rawMaterialPhases: { id: '__probe__', label: 'Probe', title: 'Probe', type: 'Raw Material', enabled: true, tank: '', unit: 'kg', width: 420 },
};
for (const key of Object.keys(probes)) {
  const table = STEP1_ENTITY_TABLES[key];
  const baselineIds = await tableIds(table);
  const snap = snapOf(key, live[key]);
  await syncEntityDiffToTable(key, [...live[key], probes[key]], snap);
  const withProbe = await tableIds(table);
  check(`${key}: probe inserted via write-through`, withProbe.includes('__probe__') && withProbe.length === baselineIds.length + 1);
  await syncEntityDiffToTable(key, live[key], snap);
  const restored = await tableIds(table);
  check(`${key}: probe removed, table back to baseline`, JSON.stringify(restored) === JSON.stringify(baselineIds));
}

// ---------------------------------------------------------------- Part 3
console.log('Part 3 — app_config round-trips (counters / batchOutputTypes)');
const counters0 = await loadCountersFromTable();
check('counters load == blob counters', JSON.stringify(counters0) === JSON.stringify(blobState.counters));
await syncCountersToTable({ ...counters0, __probe: true });
const counters1 = await loadCountersFromTable();
check('counters write-through round-trip', counters1 && counters1.__probe === true && counters1.lineCode === counters0.lineCode);
await syncCountersToTable(counters0);
const counters2 = await loadCountersFromTable();
check('counters restored', JSON.stringify(counters2) === JSON.stringify(counters0));

const batch0 = await loadBatchOutputTypesFromTable();
check('batchOutputTypes load == blob array', JSON.stringify(batch0) === JSON.stringify(blobState.batchOutputTypes));
await syncBatchOutputTypesToTable([...batch0, { id: '__probe__', name: 'Probe', unit: 'Meters' }]);
const batch1 = await loadBatchOutputTypesFromTable();
check('batchOutputTypes write-through round-trip', Array.isArray(batch1) && batch1.length === batch0.length + 1 && batch1[batch1.length - 1].id === '__probe__');
await syncBatchOutputTypesToTable(batch0);
const batch2 = await loadBatchOutputTypesFromTable();
check('batchOutputTypes restored', JSON.stringify(batch2) === JSON.stringify(batch0));

// ---------------------------------------------------------------- Part 4
console.log('Part 4 — end state');
const usersNow = await fetchEntityTable('users');
const byId = new Map(usersNow.map((u) => [String(u.id), u]));
check('users table data JSON-equals blob users (all 4)',
  usersNow.length === 4 && blobState.users.every((u) => JSON.stringify(byId.get(String(u.id))) === JSON.stringify(u)));
const { data: cfg } = await supabase.from('app_config').select('key');
check('app_config has 9 keys incl. counters + batchOutputTypes',
  cfg.length === 9 && cfg.some((r) => r.key === 'counters') && cfg.some((r) => r.key === 'batchOutputTypes'));
for (const key of Object.keys(probes)) {
  const ids = await tableIds(STEP1_ENTITY_TABLES[key]);
  check(`${key}: no probe rows left`, !ids.includes('__probe__'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
