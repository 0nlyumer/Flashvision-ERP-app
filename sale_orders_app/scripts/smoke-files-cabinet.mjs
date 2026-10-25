// Smoke test — Files Cabinet (Omer's approved design, 2026-10-25).
//
// The cabinet cleanup package:
//   1. Resurrection traps closed — the Warehouse seed fires only when
//      binders were never initialized (null/undefined), never on an empty
//      array; binders leave user_settings/localStorage entirely (table is
//      the only source); the sanitized-state guard persists an empty array
//      as empty instead of substituting an old copy.
//   2. Viewer — filed documents page in stored order with a "Document X of
//      Y" indicator; studio attachments open the UniversalPrintStudioModal
//      with the frozen snapshot; slip-family attachments open the slip
//      popup; empty binders show a clean "no documents yet" state; new
//      binders start EMPTY (no synthetic inaugural record).
//   3. Archive upgrade — the routing archive step files docType + docId +
//      ISO filedAt + the studio-record snapshot, matching binders by id OR
//      legacy name.
//   4. Per-user colours — binderColors rides the user-settings plumbing;
//      displayed colour = user override ?? binder's own colorClass; the
//      Warehouse edit colour writes ONLY the override.
//   5. Routing prompt — the 9-name dummy fallback is gone; an empty
//      cabinet shows the create-a-file prompt with the SHARED Warehouse
//      form; creating auto-selects the new binder's ID.
//
// Part 1 (unit): studioSnapshot logic (mapping, cloning, enrichment,
//   colour resolution, slip-family membership, live fallback).
// Part 2 (static): the wiring/guard text in AppContext, DocumentWarehouse
//   and DocumentRoutingCenter.
//
// Run: node scripts/smoke-files-cabinet.mjs   (exit 0 = all pass)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(fileURLToPath(new URL('.', import.meta.url)), '..');
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};
const read = (rel) => readFileSync(join(appDir, rel), 'utf8');

// Minimal localStorage stub so the onboarding-history path can run in Node.
const lsStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (lsStore.has(k) ? lsStore.get(k) : null),
  setItem: (k, v) => lsStore.set(k, String(v)),
  removeItem: (k) => lsStore.delete(k),
};

const {
  ROUTING_DOC_STUDIO_MAP,
  SLIP_FAMILY_DOC_TYPES,
  isSlipFamilyDocType,
  buildFiledDocumentSnapshot,
  resolveLiveStudioRecord,
  resolveBinderColor,
} = await import('../src/utils/studioSnapshot.js');

// ---------------------------------------------------------------- Part 1
console.log('Part 1 — studioSnapshot unit logic');

check('routing map covers the HR forms + sale order + PI + GRN + salary',
  ROUTING_DOC_STUDIO_MAP['Leave Request']?.studioType === 'hr_leave_request' &&
  ROUTING_DOC_STUDIO_MAP['Overtime Request']?.studioType === 'hr_overtime_request' &&
  ROUTING_DOC_STUDIO_MAP['Loan Request']?.studioType === 'hr_loan_request' &&
  ROUTING_DOC_STUDIO_MAP['Advance Request']?.studioType === 'hr_advance_request' &&
  ROUTING_DOC_STUDIO_MAP['Onboarding Document']?.studioType === 'hr_onboarding' &&
  ROUTING_DOC_STUDIO_MAP['Sales Order']?.studioType === 'sale_order' &&
  ROUTING_DOC_STUDIO_MAP['Vendor Invoice']?.studioType === 'purchase_invoice' &&
  ROUTING_DOC_STUDIO_MAP['GRN Log']?.studioType === 'grn_note' &&
  ROUTING_DOC_STUDIO_MAP['Salary Sheet']?.studioType === 'hr_payslip');

check('unmapped types (Contract Renewal / Inventory Audit) have no studio doc',
  !('Contract Renewal' in ROUTING_DOC_STUDIO_MAP) && !('Inventory Audit' in ROUTING_DOC_STUDIO_MAP));

check('slip family = exactly the 12 PrintLayout documents',
  SLIP_FAMILY_DOC_TYPES.length === 12 &&
  isSlipFamilyDocType('hr_leave_request') && isSlipFamilyDocType('hr_payslip') &&
  isSlipFamilyDocType('voucher_receipt') && isSlipFamilyDocType('inventory_return') &&
  !isSlipFamilyDocType('sale_order') && !isSlipFamilyDocType('purchase_invoice'));

const leaveRecord = { id: 'LVR-100', employeeName: 'Test Emp', status: 'Pending', nested: { a: 1 } };
const fakeState = {
  hr_leave_requests: [leaveRecord],
  hr_overtime_requests: [],
  saleOrders: [{ id: 'SO-1', customerName: 'ACME', contactPerson: 'Ali', total: 5000 }],
  customers: [{ name: 'ACME', city: 'Lahore', contacts: [{ name: 'Ali', phone: '0300' }] }],
  approvals: [{ id: 'GRN-1', type: 'GRN Log', status: 'Approved' }],
};

const snap = buildFiledDocumentSnapshot(fakeState, 'Leave Request', 'LVR-100');
check('snapshot: leave request resolves docType + record',
  snap.docType === 'hr_leave_request' && snap.studioRecord?.employeeName === 'Test Emp');
snap.studioRecord.nested.a = 999;
check('snapshot: the filed record is a frozen deep clone',
  fakeState.hr_leave_requests[0].nested.a === 1);

const missing = buildFiledDocumentSnapshot(fakeState, 'Leave Request', 'LVR-DOES-NOT-EXIST');
check('snapshot: missing record -> docType kept, studioRecord null (flagged, not silent)',
  missing.docType === 'hr_leave_request' && missing.studioRecord === null);

const unmapped = buildFiledDocumentSnapshot(fakeState, 'Contract Renewal', 'X-1');
check('snapshot: unmapped type -> docType null, studioRecord null',
  unmapped.docType === null && unmapped.studioRecord === null);

const soSnap = buildFiledDocumentSnapshot(fakeState, 'Sales Order', 'SO-1');
check('snapshot: sale order gets studio customer/contact enrichment',
  soSnap.docType === 'sale_order' &&
  soSnap.studioRecord?.customer?.name === 'ACME' &&
  soSnap.studioRecord?.contact?.phone === '0300' &&
  typeof soSnap.studioRecord?.shipping_address === 'object');

const grnSnap = buildFiledDocumentSnapshot(fakeState, 'GRN Log', 'GRN-1');
check('snapshot: GRN resolves from approvals', grnSnap.docType === 'grn_note' && grnSnap.studioRecord?.id === 'GRN-1');

lsStore.set('hr_onboarding_history', JSON.stringify([{ id: 'ONB-9', employeeName: 'New Joiner' }]));
const onbSnap = buildFiledDocumentSnapshot(fakeState, 'Onboarding Document', 'ONB-9');
check('snapshot: onboarding resolves from the history store',
  onbSnap.docType === 'hr_onboarding' && onbSnap.studioRecord?.employeeName === 'New Joiner');

const live = resolveLiveStudioRecord(fakeState, 'hr_leave_request', 'LVR-100');
check('live fallback resolves a snapshot-less attachment by docId', live?.employeeName === 'Test Emp');
check('live fallback returns null for unknown docId', resolveLiveStudioRecord(fakeState, 'hr_leave_request', 'NOPE') === null);

check('colour resolution: user override wins',
  resolveBinderColor({ 'BND-1': 'binder-red-spine' }, { id: 'BND-1', colorClass: 'binder-blue-spine' }) === 'binder-red-spine');
check('colour resolution: falls back to the binder (creator) colour',
  resolveBinderColor({}, { id: 'BND-1', colorClass: 'binder-green-spine' }) === 'binder-green-spine');
check('colour resolution: default blue when nothing is set',
  resolveBinderColor(null, { id: 'BND-1' }) === 'binder-blue-spine');

// ---------------------------------------------------------------- Part 2
console.log('Part 2 — static wiring (traps, viewer, archive, colours, prompt)');

const appCtx = read('src/context/AppContext.jsx');
const warehouse = read('src/pages/DocumentWarehouse.jsx');
const routingCenter = read('src/components/settings/DocumentRoutingCenter.jsx');
const binderForm = read('src/components/warehouse/BinderFormModal.jsx');

// Trap 1 — seed only when never initialized
check('warehouse seed fires only on null/undefined binders',
  warehouse.includes('savedBinders === null || savedBinders === undefined'));
check('warehouse no longer seeds on an empty array',
  !warehouse.includes('parsedBinders.length === 0'));

// Trap 2 — binders out of user settings / localStorage, binderColors in
check('appcontext: no localStorage binder copies remain',
  !appCtx.includes('documentWarehouseBinders_${') && !appCtx.includes('cachedBinders'));
check('appcontext: user-settings payload carries binderColors, not binders',
  appCtx.includes('binderColors: state.binderColors || {}') &&
  !appCtx.includes('documentWarehouseBinders: state.documentWarehouseBinders || null'));
check('appcontext: settings load applies binderColors',
  appCtx.includes("assignIfDiff('binderColors', sData.binderColors || {})"));
check('appcontext: binderColors stripped from blob writes (user_settings only)',
  appCtx.includes('delete cleanState.binderColors'));
check('appcontext: binderColors default exists in initial state',
  appCtx.includes('binderColors: {},'));

// Trap 3 — sanitized guard keeps empty as empty
check('guard: non-array binders normalize to [] (no old-copy substitution)',
  appCtx.includes('cleanState.documentWarehouseBinders = [];') && !appCtx.includes('lastGoodBindersCache'));

// Routing localStorage fallback removed
check('routing: startRoutingWorkflow has no localStorage binder fallback',
  !appCtx.includes("localStorage.getItem(`documentWarehouseBinders_"));

// Archive upgrade
check('archive: attachment carries docType/docId/filedAt/studioRecord',
  appCtx.includes('filedAt,') && appCtx.includes('docType,') && appCtx.includes('docId: task.document.id') && appCtx.includes('studioRecord,'));
check('archive: snapshot built via buildFiledDocumentSnapshot',
  appCtx.includes('buildFiledDocumentSnapshot('));
check('archive: binder match accepts id OR legacy name',
  appCtx.includes('selectedBinders.includes(binder.id) || selectedBinders.includes(binder.name)'));

// Viewer
check('viewer: studio modal wired with the frozen snapshot',
  warehouse.includes('UniversalPrintStudioModal') && warehouse.includes('documentData={studioAttachment?.studioRecord || null}'));
check('viewer: slip-family attachments route to the slip popup',
  warehouse.includes('SlipDocumentPopup') && warehouse.includes('isSlipFamilyDocType(doc.docType)'));
check('viewer: Document X of Y indicator',
  warehouse.includes('`Document ${currentPage + 1} of ${activeFolder.documents.length}`'));
check('viewer: empty binder renders the no-documents state',
  warehouse.includes('No documents filed in this file yet.') && warehouse.includes('No documents yet'));
check('viewer: new binders start empty (no synthetic inaugural record)',
  !warehouse.includes('DOC-NEW-') && warehouse.includes('documents: [],'));
check('viewer: spine colour resolved per user',
  warehouse.includes('resolveBinderColor(binderColors, binder)'));
check('viewer: edit colour writes ONLY the per-user override',
  warehouse.includes('binderColors: { ...(prev.binderColors || {}), [editingBinder.id]: colorClass }'));
check('viewer: shared BinderFormModal used for add + edit',
  (warehouse.match(/<BinderFormModal/g) || []).length >= 2);

// Routing prompt
check('routing: dummy fallback binders removed',
  !routingCenter.includes('fallbackBinders'));
check('routing: empty cabinet shows the create-a-file prompt',
  routingCenter.includes('No file exists yet — create a file first'));
check('routing: prompt uses the shared BinderFormModal',
  routingCenter.includes("from '../warehouse/BinderFormModal'") && routingCenter.includes('<BinderFormModal'));
check('routing: creation auto-selects the new binder id',
  routingCenter.includes('selectedBinders: [...current, newBinder.id]'));
check('routing: picker stores binder ids',
  routingCenter.includes('getBindersList().map(b => b.id)') && routingCenter.includes('key={binder.id}'));
check('routing: deploy refuses an archive step with zero binders',
  routingCenter.includes('The archive step needs at least one file'));
check('shared form: canonical colour classes incl. amber (not yellow)',
  binderForm.includes("'binder-amber-spine'") && !binderForm.includes('binder-yellow-spine'));

console.log(`\nFiles Cabinet smoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
