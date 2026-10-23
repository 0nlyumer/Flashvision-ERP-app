// Smoke test — Phase D Step D3 (FINAL, 2026-10-23).
//
// Stops erp_state blob writes entirely: the three AppContext upsert sites
// are removed, FlashAM reads `users` from the users table (probe +
// realtime moved off the frozen blob), and the blob row stays in Supabase
// as a read-only backup with a dated export alongside.
//
// Part 1 (static): zero erp_state write verbs anywhere in src/ — every
//   remaining `from('erp_state')` chain must be a select (read) only.
// Part 2 (live): every STEP1 entity table's `data` rows JSON-equal the
//   final blob export (~/workspace/erp-table-migration/
//   final-blob-export-2026-10-23.json), compared as sorted multisets.
// Part 3 (live): app_config still has exactly 9 keys; the config values
//   equal the export (fgComboConfig compared AFTER normalizeFGConfig —
//   its stored form omits autoSelect.typePacking, which normalize
//   re-seeds deterministically from the packings list; scalars compared
//   on the fields that are read back: buildVersion / productionTarget /
//   isGlobalPaginated — lastUpdatedBy is a per-client mirror stamp and
//   is never read back).
// Part 4 (live): the live blob still JSON-equals the export file and its
//   updated_at is reported — the row is untouched by this step.
//
// Run: node scripts/smoke-phase-d3.mjs   (exit 0 = all pass)

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

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  STEP1_ENTITY_TABLES, fetchEntityTable,
  loadAdminSetupFromTable, loadFGComboConfigFromTable, loadCategoryPrefixesFromTable,
  loadScalarsFromTable, loadCountersFromTable, loadBatchOutputTypesFromTable,
} = await import('../src/utils/entityTables.js');
const { normalizeFGConfig } = await import('../src/utils/fgCombinationUtils.js');
const { supabase } = await import('../src/utils/supabaseClient.js');

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`); }
};

const exportPath = fileURLToPath(new URL('../../../erp-table-migration/final-blob-export-2026-10-23.json', import.meta.url));
const blobExport = JSON.parse(readFileSync(exportPath, 'utf8'));

// ---------------------------------------------------------------- Part 1
console.log('Part 1 — static: zero erp_state writes in src/');
const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|jsx)$/.test(name)) files.push(p);
  }
};
walk(srcRoot);
let writeHits = 0;
let erpRefs = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const re = /from\(\s*['"]erp_state['"]\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    erpRefs++;
    const window = text.slice(m.index, m.index + 400);
    if (/\.(upsert|update|insert|delete)\s*\(/.test(window)) {
      writeHits++;
      console.log(`    WRITE VERB after erp_state in ${file}: ...${window.slice(0, 120).replace(/\n/g, ' ')}`);
    }
  }
}
check(`scanned ${files.length} source files, ${erpRefs} erp_state query chains`, files.length > 0 && erpRefs > 0);
check('zero erp_state write verbs (upsert/update/insert/delete)', writeHits === 0);

// ---------------------------------------------------------------- Part 2
console.log('Part 2 — live: entity tables JSON-equal the final blob export');
const asMultiset = (records) => (records || []).map((r) => JSON.stringify(r)).sort();
let entityMismatch = 0;
for (const [stateKey, table] of Object.entries(STEP1_ENTITY_TABLES)) {
  const rows = await fetchEntityTable(table);
  const eq = JSON.stringify(asMultiset(rows)) === JSON.stringify(asMultiset(blobExport[stateKey]));
  if (!eq) {
    entityMismatch++;
    console.log(`    MISMATCH ${stateKey} -> ${table}: table=${rows?.length} export=${(blobExport[stateKey] || []).length}`);
  }
}
check(`all ${Object.keys(STEP1_ENTITY_TABLES).length} entity tables equal the export`, entityMismatch === 0);

// ---------------------------------------------------------------- Part 3
console.log('Part 3 — live: app_config (9 keys, values equal the export)');
const { data: cfgRows, error: cfgErr } = await supabase.from('app_config').select('key');
check('app_config readable', !cfgErr && Array.isArray(cfgRows));
check('app_config has exactly 9 keys', cfgRows.length === 9);
check('adminSetup == export', JSON.stringify(await loadAdminSetupFromTable()) === JSON.stringify(blobExport.adminSetup));
check('categoryPrefixes == export', JSON.stringify(await loadCategoryPrefixesFromTable()) === JSON.stringify(blobExport.categoryPrefixes));
check('counters == export', JSON.stringify(await loadCountersFromTable()) === JSON.stringify(blobExport.counters));
check('batchOutputTypes == export', JSON.stringify(await loadBatchOutputTypesFromTable()) === JSON.stringify(blobExport.batchOutputTypes));
const fgTable = await loadFGComboConfigFromTable();
check('fgComboConfig == export after normalizeFGConfig',
  JSON.stringify(normalizeFGConfig(fgTable)) === JSON.stringify(normalizeFGConfig(blobExport.fg_combinations_config)));
const scalars = await loadScalarsFromTable();
check('scalars read-back fields == export (buildVersion/productionTarget/isGlobalPaginated)',
  scalars && scalars.buildVersion === blobExport.buildVersion &&
  scalars.productionTarget === blobExport.productionTarget &&
  scalars.isGlobalPaginated === blobExport.isGlobalPaginated);

// ---------------------------------------------------------------- Part 4
console.log('Part 4 — live: blob row untouched since the export');
const { data: blobRows } = await supabase.from('erp_state').select('state_data, updated_at').eq('id', 'main_state');
let liveBlob = blobRows[0].state_data;
if (typeof liveBlob === 'string') liveBlob = JSON.parse(liveBlob);
check('live blob state_data JSON-equals the export file', JSON.stringify(liveBlob) === JSON.stringify(blobExport));
console.log(`  blob updated_at (frozen backup): ${blobRows[0].updated_at}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
