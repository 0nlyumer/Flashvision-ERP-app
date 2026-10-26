// Smoke test — Routing archive filing fix (2026-10-26, Part A).
//
// Incident: leave LVR-1792956775880's routing execution log claimed
// "Saved and attached document inside selected binders: TEST_ROUTE" yet
// the document never persisted in the binder. The archive step's success
// was decided by an in-memory push alone, with a fallback that printed
// the raw selection list when nothing had been filed, and no
// post-commit verification existed anywhere.
//
// Part 1: the REAL helpers from src/utils/routingArchive.js — filing
//   into a just-created binder, rapid successive filings, dedupe,
//   legacy name selections, select-all, no-match, and the
//   verify/recover contract (findUnverifiedFilings +
//   fileEntryIntoBindersById) incl. the binder-deleted skip.
// Part 2: source contracts in AppContext.jsx (Failed instead of a
//   fabricated success; reconciliation wired) and HRLeaveRequest.jsx
//   (Part B: edit/delete present, in-app confirm, no window.confirm).
// Part 3: LIVE write-through proof — a probe binder through the REAL
//   syncEntityDiffToTable: create, file two documents in rapid
//   succession, read both back from document_warehouse_binders, then
//   clean up to the exact baseline.
//
// Run: node scripts/smoke-routing-archive-filing.mjs   (exit 0 = pass)

// The app sources use Vite-style extensionless relative imports; register
// a resolve hook that retries with '.js' so plain Node can load them.
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

import { readFileSync } from 'node:fs';

const {
  buildArchiveEntry, applyFilingToBinders, getClaimedArchiveFilings,
  findUnverifiedFilings, fileEntryIntoBindersById, binderAlreadyHasDoc
} = await import('../src/utils/routingArchive.js');
const { fetchEntityTable, syncEntityDiffToTable, recordKeyWithFallback } = await import('../src/utils/entityTables.js');
const { supabase } = await import('../src/utils/supabaseClient.js');

let pass = 0, fail = 0;
const check = (name, cond) => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`); }
};

const archiveStep = (selectedBinders, selectAll = false) => ({
  id: 'step-4', name: 'Folder Storage Archiver', type: 'archive_binder',
  config: { selectedBinders, selectAll }
});
const makeTask = (docId, reason) => ({
  id: `TASK-${docId}`, ruleName: 'Smoke Rule',
  document: { id: docId, type: 'Leave Request', title: `Leave Request - SMOKE (${reason})`, createdBy: 'only.umer' },
  steps: [], history: []
});

// ---------------------------------------------------------------- Part 1
console.log('Part 1 — filing helpers (incident scenario)');

const step = archiveStep(['BND-CUSTOM-1']);
const task1 = makeTask('LVR-SMOKE-1', 'TEST-01');
const entry1 = buildArchiveEntry(task1, 'hr_leave_request', { sample: 1 });

// Just-created binder (empty documents) — the incident's first filing.
const binders = [{ id: 'BND-CUSTOM-1', name: 'TEST_ROUTE', documents: [] }];
const r1 = applyFilingToBinders(binders, step, entry1);
check('filing into just-created binder reports the binder name', JSON.stringify(r1.filedNames) === JSON.stringify(['TEST_ROUTE']));
check('document is in the binder after filing', binders[0].documents.length === 1 && binders[0].documents[0].docId === 'LVR-SMOKE-1');

// Rapid successive second filing into the same binder.
const task2 = makeTask('LVR-SMOKE-2', 'TEST-02');
const entry2 = buildArchiveEntry(task2, 'hr_leave_request', { sample: 2 });
const r2 = applyFilingToBinders(binders, step, entry2);
check('second rapid filing also lands', r2.filedNames.length === 1 && binders[0].documents.length === 2);
check('both filings present, in order', binders[0].documents.map(d => d.docId).join(',') === 'LVR-SMOKE-1,LVR-SMOKE-2');

// Idempotency: re-filing the same document never duplicates it.
const r1b = applyFilingToBinders(binders, step, entry1);
check('re-filing same document counts as filed without duplicating', r1b.filedNames.length === 1 && binders[0].documents.length === 2);

// Legacy name-based selection still files.
const nameBinders = [{ id: 'BND-9', name: 'LEGACY_FILE', documents: [] }];
const rn = applyFilingToBinders(nameBinders, archiveStep(['LEGACY_FILE']), entry1);
check('legacy NAME selection files into the binder', rn.filedNames.length === 1 && nameBinders[0].documents.length === 1);

// Select-all files into every binder.
const allBinders = [{ id: 'A', name: 'FA', documents: [] }, { id: 'B', name: 'FB', documents: [] }];
const ra = applyFilingToBinders(allBinders, archiveStep([], true), entry1);
check('select-all files into all binders', ra.filedNames.length === 2 && allBinders.every(b => b.documents.length === 1));

// No matching binder → nothing filed (the engine records Failed here).
const noBinders = [{ id: 'OTHER', name: 'OTHER_FILE', documents: [] }];
const r0 = applyFilingToBinders(noBinders, step, entry1);
check('no-match filing files nothing and reports empty', r0.filedNames.length === 0 && noBinders[0].documents.length === 0);

// Claim detection + the lost-filing shape + recovery.
const claimedTask = {
  ...task1,
  steps: [archiveStep(['BND-CUSTOM-1'])],
  history: [{
    stepId: 'step-4', stepName: 'Folder Storage Archiver', status: 'Success',
    timestamp: 'smoke', message: 'Saved and attached document inside selected binders: TEST_ROUTE.'
  }]
};
check('success history entry is detected as a claim', getClaimedArchiveFilings(claimedTask).length === 1);

const lostBinders = [{ id: 'BND-CUSTOM-1', name: 'TEST_ROUTE', documents: [] }];
const missing = findUnverifiedFilings([claimedTask], lostBinders);
check('claimed-but-absent filing is flagged unverified', missing.length === 1 && missing[0].docId === 'LVR-SMOKE-1' && missing[0].targetBinderIds.join() === 'BND-CUSTOM-1');

const rec = fileEntryIntoBindersById(lostBinders, missing[0].targetBinderIds, entry1);
check('recovery files the missing document', rec.filedIds.length === 1 && binderAlreadyHasDoc(lostBinders[0], 'LVR-SMOKE-1'));
check('after recovery the filing verifies clean', findUnverifiedFilings([claimedTask], lostBinders).length === 0);

// A filing that IS present is not flagged.
check('present filing is not flagged', findUnverifiedFilings([claimedTask], binders).length === 0);

// Binder deleted after filing → unverifiable, deliberately skipped.
check('deleted-binder filing is skipped (not flagged)', findUnverifiedFilings([claimedTask], []).length === 0);
check('renamed-away binder filing is skipped', findUnverifiedFilings([claimedTask], [{ id: 'BND-OTHER', name: 'ELSEWHERE', documents: [] }]).length === 0);

// A failed archive entry is not a claim.
const failedTask = {
  ...task1,
  steps: [archiveStep(['BND-CUSTOM-1'])],
  history: [{ stepId: 'step-4', stepName: 'Folder Storage Archiver', status: 'Failed', timestamp: 'smoke', message: 'Archive step could NOT file the document.' }]
};
check('Failed archive entry is not treated as a claim', getClaimedArchiveFilings(failedTask).length === 0);

// ---------------------------------------------------------------- Part 2
console.log('Part 2 — source contracts');

const appCtx = readFileSync(new URL('../src/context/AppContext.jsx', import.meta.url), 'utf8');
check('engine records Failed when nothing was filed', appCtx.includes('Archive step could NOT file the document'));
check('old fabricated-success fallback is gone', !appCtx.includes('filedBinderNames.length ? filedBinderNames.join'));
check('engine files via the shared helper', appCtx.includes('applyFilingToBinders(updatedBinders, currentStep, entry)'));
check('reconciliation effect is wired', appCtx.includes('findUnverifiedFilings') && appCtx.includes('Filing verified & recovered'));
check('recovery rebuilds the entry via the shared builder', appCtx.includes('fileEntryIntoBindersById(nextBinders, m.targetBinderIds, entry)'));

const leaveSrc = readFileSync(new URL('../src/components/hr/HRLeaveRequest.jsx', import.meta.url), 'utf8');
check('leave page has an edit save handler', leaveSrc.includes('const handleEditSave'));
check('leave page has a delete handler', leaveSrc.includes('const handleDeleteRequest'));
check('delete uses an in-app confirmation modal', leaveSrc.includes('Delete this leave request?'));
check('leave page never calls window.confirm', !leaveSrc.includes('window.confirm('));
check('edit keeps the reason >= 5 chars validation', (leaveSrc.match(/minimum 5 characters/g) || []).length >= 2);
check('history rows render edit + delete actions', leaveSrc.includes('title="Edit leave request"') && leaveSrc.includes('title="Delete leave request"'));

// ---------------------------------------------------------------- Part 3
console.log('Part 3 — live write-through (just-created binder, rapid filings)');

const seedSnapshot = (stateKey, records) => {
  const snap = new Map(); const seen = new Map();
  (records || []).forEach(rec => {
    const k = recordKeyWithFallback(stateKey, rec, seen);
    if (k !== null) snap.set(k, JSON.stringify(rec));
  });
  return snap;
};

const baseline = await fetchEntityTable('document_warehouse_binders');
check('baseline binders fetched', Array.isArray(baseline));
const snap = seedSnapshot('documentWarehouseBinders', baseline);

const probe = { id: 'BND-PROBE-ARCHIVE-SMOKE', name: 'ZZ_PROBE_ARCHIVE', icon: 'receipt_long', documents: [], colorClass: 'binder-blue-spine' };
try {
  await syncEntityDiffToTable('documentWarehouseBinders', [...baseline, probe], snap);
  let rows = await fetchEntityTable('document_warehouse_binders');
  let live = (rows || []).find(b => b.id === probe.id);
  check('probe binder created in the table', !!live && Array.isArray(live.documents) && live.documents.length === 0);

  // File doc 1 into the just-created binder (state copy → sync → read back).
  const state1 = JSON.parse(JSON.stringify([...baseline, probe]));
  applyFilingToBinders(state1, archiveStep([probe.id]), entry1);
  await syncEntityDiffToTable('documentWarehouseBinders', state1, snap);
  rows = await fetchEntityTable('document_warehouse_binders');
  live = (rows || []).find(b => b.id === probe.id);
  check('first filing persisted to the table', !!live && live.documents.some(d => d.docId === 'LVR-SMOKE-1'));

  // Rapid second filing.
  const state2 = JSON.parse(JSON.stringify(state1));
  applyFilingToBinders(state2, archiveStep([probe.id]), entry2);
  await syncEntityDiffToTable('documentWarehouseBinders', state2, snap);
  rows = await fetchEntityTable('document_warehouse_binders');
  live = (rows || []).find(b => b.id === probe.id);
  check('second rapid filing persisted too', !!live && live.documents.length === 2 && live.documents.some(d => d.docId === 'LVR-SMOKE-2'));
} finally {
  await syncEntityDiffToTable('documentWarehouseBinders', baseline, snap);
  await supabase.from('document_warehouse_binders').delete().eq('id', probe.id);
}

const after = await fetchEntityTable('document_warehouse_binders');
check('cleanup: binders back to baseline ids',
  JSON.stringify((after || []).map(b => b.id).sort()) === JSON.stringify((baseline || []).map(b => b.id).sort()));

console.log(`\nSMOKE RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
