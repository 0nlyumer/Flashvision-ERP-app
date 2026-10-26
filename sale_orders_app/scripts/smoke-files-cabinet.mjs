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
  resolveFiledDocumentView,
  getFiledDocumentViewSource,
  resolveBinderColor,
  BINDER_FRAME_TOKENS,
  resolveBinderFrameToken,
} = await import('../src/utils/studioSnapshot.js');

const { searchFiledDocuments } = await import('../src/utils/filedDocSearch.js');

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
// (2026-10-26: the entry builder + binder matching moved into the shared
// utils/routingArchive helper — the same contract is asserted there, and
// AppContext must file through it.)
const routingArchiveSrc = read('src/utils/routingArchive.js');
check('archive: attachment carries docType/docId/filedAt/studioRecord',
  routingArchiveSrc.includes('filedAt,') && routingArchiveSrc.includes('docType,') && routingArchiveSrc.includes('docId: task.document.id') && routingArchiveSrc.includes('studioRecord,'));
check('archive: snapshot built via buildFiledDocumentSnapshot',
  appCtx.includes('buildFiledDocumentSnapshot('));
check('archive: binder match accepts id OR legacy name',
  routingArchiveSrc.includes('sel.includes(binder.id) || sel.includes(binder.name)') && appCtx.includes('applyFilingToBinders(updatedBinders, currentStep, entry)'));

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

// ---------------------------------------------------------------- Part 3
console.log('Part 3 — viewer freshness (live-first), frame tokens, in-file search');

const filedAttachment = { docType: 'hr_leave_request', docId: 'LVR-100', id: 'LVR-100', studioRecord: { id: 'LVR-100', employeeName: 'STALE SNAPSHOT NAME' } };
const liveView = resolveFiledDocumentView(fakeState, filedAttachment);
check('freshness: edited live record wins over the filed snapshot',
  liveView.source === 'live' && liveView.studioRecord?.employeeName === 'Test Emp');
check('freshness: source classification agrees (live)',
  getFiledDocumentViewSource(fakeState, filedAttachment) === 'live');

const orphanedAttachment = { docType: 'hr_leave_request', docId: 'LVR-GONE', id: 'LVR-GONE', studioRecord: { id: 'LVR-GONE', employeeName: 'Filed Person' } };
const filedView = resolveFiledDocumentView(fakeState, orphanedAttachment);
check('freshness: missing source record falls back to the filed snapshot',
  filedView.source === 'snapshot' && filedView.studioRecord?.employeeName === 'Filed Person');
check('freshness: source classification agrees (snapshot)',
  getFiledDocumentViewSource(fakeState, orphanedAttachment) === 'snapshot');

const bareAttachment = { docType: 'hr_leave_request', docId: 'LVR-GONE', id: 'LVR-GONE', studioRecord: null };
check('freshness: neither live record nor snapshot -> no printable copy',
  resolveFiledDocumentView(fakeState, bareAttachment).source === null &&
  resolveFiledDocumentView(fakeState, bareAttachment).studioRecord === null &&
  getFiledDocumentViewSource(fakeState, bareAttachment) === null);
check('freshness: details-only attachments (docType null) stay unchanged',
  resolveFiledDocumentView(fakeState, { docType: null, id: 'CTR-1', studioRecord: { a: 1 } }).source === null);

const frozenBefore = JSON.stringify(filedAttachment.studioRecord);
resolveFiledDocumentView(fakeState, filedAttachment);
check('freshness: viewing never mutates the stored snapshot',
  JSON.stringify(filedAttachment.studioRecord) === frozenBefore);

const soAttachment = { docType: 'sale_order', docId: 'SO-1', id: 'SO-1', studioRecord: { id: 'SO-1', customerName: 'OLD' } };
const soView = resolveFiledDocumentView(fakeState, soAttachment);
check('freshness: sale order resolves live with studio enrichment',
  soView.source === 'live' && soView.studioRecord?.customer?.name === 'ACME' && soView.studioRecord?.contact?.phone === '0300');

check('frame tokens: every spine colour has a token set',
  ['binder-blue-spine', 'binder-green-spine', 'binder-red-spine', 'binder-purple-spine', 'binder-amber-spine', 'binder-teal-spine']
    .every(c => BINDER_FRAME_TOKENS[c]?.deep && BINDER_FRAME_TOKENS[c]?.mid && BINDER_FRAME_TOKENS[c]?.pale));
check('frame tokens: the per-user override drives the interior colour',
  resolveBinderFrameToken({ 'BND-1': 'binder-amber-spine' }, { id: 'BND-1', colorClass: 'binder-green-spine' }) === BINDER_FRAME_TOKENS['binder-amber-spine']);
check('frame tokens: fall back to the binder colour, then blue',
  resolveBinderFrameToken({}, { id: 'BND-1', colorClass: 'binder-teal-spine' }) === BINDER_FRAME_TOKENS['binder-teal-spine'] &&
  resolveBinderFrameToken(null, null) === BINDER_FRAME_TOKENS['binder-blue-spine']);

const searchDocs = [
  { id: 'LVR-100', docId: 'LVR-100', title: 'Leave Request — Ahmed Raza', date: '24/10/2026', filedAt: '2026-10-24T09:30:00.000Z', details: [{ label: 'Document ID', value: 'LVR-100' }] },
  { id: 'LVR-200', docId: 'LVR-200', title: 'Leave Request — Bilal Hussain', date: '20/10/2026', filedAt: '2026-10-20T08:00:00.000Z', details: [{ label: 'Document ID', value: 'LVR-200' }] },
  { id: 'SO-77', docId: 'SO-77', title: 'Sales Order — ACME Textiles', date: '18/10/2026', filedAt: '2026-10-18T12:00:00.000Z', details: [] },
];
check('search: matches by document code/reference (docId)',
  searchFiledDocuments(searchDocs, 'LVR-200').length === 1 && searchFiledDocuments(searchDocs, 'LVR-200')[0].index === 1);
check('search: matches by title (case-insensitive)',
  searchFiledDocuments(searchDocs, 'bilal').length === 1 && searchFiledDocuments(searchDocs, 'bilal')[0].index === 1);
check('search: matches by filed date (ISO and en-GB forms)',
  searchFiledDocuments(searchDocs, '2026-10-24')[0]?.index === 0 &&
  searchFiledDocuments(searchDocs, '24/10/2026')[0]?.index === 0 &&
  searchFiledDocuments(searchDocs, '18 Oct 2026')[0]?.index === 2);
check('search: no match returns an empty list (clean no-match state)',
  searchFiledDocuments(searchDocs, 'zzz-no-such-doc').length === 0);
check('search: blank query returns nothing; results keep filed order',
  searchFiledDocuments(searchDocs, '  ').length === 0 &&
  searchFiledDocuments(searchDocs, 'leave request').map(m => m.index).join(',') === '0,1');
check('search: scoped to the list it is given (open file only)',
  searchFiledDocuments([searchDocs[2]], 'LVR').length === 0);

// ---------------------------------------------------------------- Part 4
console.log('Part 4 — delete fix, freshness wiring, coloured interior, search UI');

const slipPopup = read('src/components/warehouse/SlipDocumentPopup.jsx');

check('delete: warehouse no longer gates deletion behind a native confirm call',
  !warehouse.includes('window.confirm('));
check('delete: handler deletes the binder and closes the edit modal',
  warehouse.includes('allCabinetBinders.filter(b => b.id !== editingBinder.id)') &&
  warehouse.includes('onDelete={handleDeleteBinder}'));
check('delete: modal confirms in-app before calling onDelete',
  binderForm.includes('Delete this file?') && binderForm.includes('setConfirmingDelete(true)') &&
  binderForm.includes('handleConfirmDelete'));
check('delete: modal delete button opens the confirmation (no direct onDelete)',
  !binderForm.includes('onClick={onDelete}'));

check('freshness: warehouse resolves the print view live-first',
  warehouse.includes('resolveFiledDocumentView(state, doc)') && warehouse.includes('viewSource: view.source'));
check('freshness: marker states live vs filed copy on the print-view bar',
  warehouse.includes('Live version') && warehouse.includes('Filed copy'));
check('freshness: slip popup carries the same marker',
  slipPopup.includes("attachment.viewSource === 'live'") && slipPopup.includes('Filed copy'));

check('interior: opened file frame uses the resolved colour token',
  warehouse.includes('resolveBinderFrameToken(binderColors, activeFolder)') && warehouse.includes('activeFrameToken.deep'));
check('interior: file name tab rides the frame edge',
  warehouse.includes('activeFrameToken.mid} 0%') && warehouse.includes('-top-3 left-8'));
check('search: viewer searches the open file via the shared matcher',
  warehouse.includes('searchFiledDocuments(activeFolder.documents || [], searchQuery)'));
check('search: picking a result jumps to its page',
  warehouse.includes('jumpToDocument(searchMatches[0].index)') && warehouse.includes('onClick={() => jumpToDocument(index)}'));
check('search: clean inline no-match state (old alert gone)',
  warehouse.includes('No documents match') && !warehouse.includes('No matching record sheet'));

check('polish: cabinet shell has a min-height (first-paint collapse guard)',
  warehouse.includes('min-h-[600px]'));
check('polish: routing create-rule button no longer uses the near-black gradient',
  !routingCenter.includes('#0f172a, #1e293b') && routingCenter.includes('#4f46e5, #2563eb'));

console.log(`\nFiles Cabinet smoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
