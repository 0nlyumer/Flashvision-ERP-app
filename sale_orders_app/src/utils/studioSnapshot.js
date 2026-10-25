// studioSnapshot.js — Files Cabinet archive upgrade (Omer's order, 2026-10-25).
//
// When the routing engine files a document into a Document Warehouse binder
// (the `archive_binder` step), the attachment now carries everything the
// cabinet viewer needs to re-render that document as a print later:
//
//   docType      — the Print Studio document id (e.g. 'hr_leave_request')
//   docId        — the source record's id
//   filedAt      — ISO timestamp of the filing
//   studioRecord — a deep-cloned snapshot of the source record, in exactly
//                  the shape the studio renders for that document type (the
//                  same record `getSampleRecordFromState` returns for HR
//                  documents; sale orders get the studio's customer/contact/
//                  shipping enrichment). Filed content is FROZEN at filing
//                  time; the print DESIGN applied in the viewer is always
//                  the current Print Settings layout.
//
// VIEW RESOLUTION (freshness, 2026-10-25): the cabinet viewer resolves a
// filed document LIVE-FIRST via `resolveFiledDocumentView` — while the
// source record still exists, its current (edited) content is what the
// print view renders; the frozen snapshot below is the fallback for a
// source record that no longer exists. The stored snapshot itself is
// never mutated by viewing.
//
// Document types with no studio document (or whose source record cannot be
// found at filing time) return a null studioRecord — the attachment is still
// filed with docType/docId and the viewer falls back to the stored
// label/value details. Nothing is ever filed silently unrenderable without
// the docType marker that lets the viewer (and this file's callers) see it.

import { loadOnboardingHistory } from './onboardingHistory.js';

// Routing document type (the string used by HR screens / the Routing Center
// simulator when a workflow starts) -> studio document + state collection.
export const ROUTING_DOC_STUDIO_MAP = {
  'Leave Request': { studioType: 'hr_leave_request', collection: 'hr_leave_requests' },
  'Overtime Request': { studioType: 'hr_overtime_request', collection: 'hr_overtime_requests' },
  'Loan Request': { studioType: 'hr_loan_request', collection: 'hr_loan_requests' },
  'Advance Request': { studioType: 'hr_advance_request', collection: 'hr_advance_requests' },
  'Onboarding Document': { studioType: 'hr_onboarding', collection: null }, // onboarding history store
  'Sales Order': { studioType: 'sale_order', collection: 'saleOrders' },
  'Vendor Invoice': { studioType: 'purchase_invoice', collection: 'purchaseInvoices' },
  'GRN Log': { studioType: 'grn_note', collection: null }, // approvals / stock receiving
  'Salary Sheet': { studioType: 'hr_payslip', collection: 'hr_generated_salaries' },
  // 'Contract Renewal' and 'Inventory Audit' have no studio document type;
  // they file with docType null (legacy label/value view only).
};

// The 12 documents that render through the slip renderer (PrintLayout)
// rather than the graphic studio sheet: vouchers, HR forms, inventory
// adjustment / return. Filed attachments of these types open the slip print
// popup in the cabinet viewer instead of the studio modal.
export const SLIP_FAMILY_DOC_TYPES = [
  'voucher_receipt',
  'voucher_payment',
  'voucher_journal',
  'voucher_contra',
  'hr_onboarding',
  'hr_leave_request',
  'hr_overtime_request',
  'hr_loan_request',
  'hr_advance_request',
  'hr_payslip',
  'inventory_adjustment',
  'inventory_return',
];

export const isSlipFamilyDocType = (docType) => SLIP_FAMILY_DOC_TYPES.includes(docType);

const deepClone = (value) => {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return null;
  }
};

const findById = (list, docId) => {
  if (!Array.isArray(list) || docId === undefined || docId === null) return null;
  return list.find((rec) => rec && String(rec.id) === String(docId)) || null;
};

// Mirror of the sale_order enrichment in getSampleRecordFromState: the
// studio header expects customer / contact / shipping_address objects on
// the record, resolved from the customers collection.
const enrichSaleOrder = (state, order) => {
  if (!order) return null;
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const customerByName = customers.find((c) => c?.name === order.customerName);
  const customerContact = order.contactPerson
    ? (customerByName?.contacts || []).find((ct) => ct?.name === order.contactPerson) || customerByName?.contacts?.[0]
    : customerByName?.contacts?.[0];
  return {
    ...order,
    customer: customerByName || { name: order.customerName || 'Customer', city: '' },
    contact: customerContact || { name: order.contactPerson || '', phone: '', email: '' },
    shipping_address: { city: order.shippingCity || customerByName?.city || '', address: '' },
  };
};

/**
 * Resolve the studio document type + frozen studio record for a routing
 * document at filing time.
 *
 * @param {object} state  App state (collections are looked up by id here).
 * @param {string} routingDocType  e.g. 'Leave Request' (task.document.type).
 * @param {string} docId           The source record id (task.document.id).
 * @returns {{ docType: string|null, studioRecord: object|null }}
 *   docType is null when the routing type has no studio document at all;
 *   studioRecord is null when the type is known but the source record could
 *   not be found/cloned at filing time (the viewer then tries a live lookup
 *   by docId, and finally falls back to the label/value details).
 */
export function buildFiledDocumentSnapshot(state, routingDocType, docId) {
  const mapping = ROUTING_DOC_STUDIO_MAP[routingDocType];
  if (!mapping) return { docType: null, studioRecord: null };
  const { studioType, collection } = mapping;

  let record = null;
  if (routingDocType === 'Onboarding Document') {
    record = findById(loadOnboardingHistory(), docId);
  } else if (routingDocType === 'GRN Log') {
    record = findById(state?.approvals, docId) || findById(state?.stockReceiving, docId);
  } else if (collection) {
    record = findById(state?.[collection], docId);
  }

  if (!record) return { docType: studioType, studioRecord: null };
  const snapshotSource = routingDocType === 'Sales Order' ? enrichSaleOrder(state, record) : record;
  return { docType: studioType, studioRecord: deepClone(snapshotSource) };
}

// Raw live-source lookup shared by the viewer resolvers below: the source
// record as it exists in the CURRENT state (no clone, no enrichment).
const findLiveSource = (state, docType, docId) => {
  if (!state || !docType || docId === undefined || docId === null) return null;
  const entry = Object.entries(ROUTING_DOC_STUDIO_MAP).find(([, m]) => m.studioType === docType);
  if (!entry) return null;
  const [routingDocType, mapping] = entry;
  let record = null;
  if (routingDocType === 'Onboarding Document') {
    record = findById(loadOnboardingHistory(), docId);
  } else if (routingDocType === 'GRN Log') {
    record = findById(state?.approvals, docId) || findById(state?.stockReceiving, docId);
  } else if (mapping.collection) {
    record = findById(state[mapping.collection], docId);
  }
  return record ? { routingDocType, record } : null;
};

/**
 * Live record for the viewer: the source record in its current state,
 * shaped exactly as the studio renders it (deep clone + sale-order
 * enrichment). Returns null when the source record no longer exists.
 */
export function resolveLiveStudioRecord(state, docType, docId) {
  const found = findLiveSource(state, docType, docId);
  if (!found) return null;
  const shaped = found.routingDocType === 'Sales Order' ? enrichSaleOrder(state, found.record) : found.record;
  return deepClone(shaped);
}

/**
 * FRESHNESS (Omer, 2026-10-25 — "file mein hamesha taza version aye"):
 * which version of a filed document the viewer shows.
 *   'live'     — the source record still exists; its CURRENT content wins,
 *                so later edits are always reflected in the filed view.
 *   'snapshot' — the source record is gone; the frozen filing snapshot is
 *                shown, so the file never loses its document.
 *   null       — no docType, or neither a live record nor a snapshot.
 * Cheap classification only (no cloning) — safe to call while rendering.
 */
export function getFiledDocumentViewSource(state, attachment) {
  if (!attachment?.docType) return null;
  const docId = attachment.docId ?? attachment.id;
  if (findLiveSource(state, attachment.docType, docId)) return 'live';
  if (attachment.studioRecord) return 'snapshot';
  return null;
}

/**
 * Resolve the record a filed document's print view renders, LIVE-FIRST:
 * the current source record when it still exists, otherwise the frozen
 * filing snapshot. The stored snapshot is only ever READ here — viewing a
 * filed document never mutates what was filed.
 *
 * @returns {{ source: 'live'|'snapshot'|null, studioRecord: object|null }}
 */
export function resolveFiledDocumentView(state, attachment) {
  if (!attachment?.docType) return { source: null, studioRecord: null };
  const docId = attachment.docId ?? attachment.id;
  const live = resolveLiveStudioRecord(state, attachment.docType, docId);
  if (live) return { source: 'live', studioRecord: live };
  if (attachment.studioRecord) return { source: 'snapshot', studioRecord: attachment.studioRecord };
  return { source: null, studioRecord: null };
}

/**
 * The colour a binder spine renders with for the current user: the user's
 * own per-user override (user_settings `binderColors`) wins; otherwise the
 * binder record's own colour (the creator's choice) is everyone's default.
 */
export function resolveBinderColor(binderColors, binder) {
  if (!binder) return 'binder-blue-spine';
  const override = binderColors && typeof binderColors === 'object' ? binderColors[binder.id] : undefined;
  return override || binder.colorClass || 'binder-blue-spine';
}

// Frame tokens for the viewer's OPEN-FILE interior (Files viewer polish,
// 2026-10-25): when a binder is opened, the inside of the book presents in
// the binder's own colour — the same per-user resolved colour as the
// spine. The stops mirror the spine gradients in DocumentWarehouse's CSS
// (and the BinderFormModal colour previews), so spine and interior always
// agree. `pale` is the near-white tint the paper pages sit against.
export const BINDER_FRAME_TOKENS = {
  'binder-blue-spine': { deep: '#1e3a8a', mid: '#2563eb', light: '#60a5fa', soft: 'rgba(37, 99, 235, 0.10)', pale: '#eff6ff' },
  'binder-green-spine': { deep: '#064e3b', mid: '#059669', light: '#34d399', soft: 'rgba(5, 150, 105, 0.10)', pale: '#ecfdf5' },
  'binder-red-spine': { deep: '#7f1d1d', mid: '#dc2626', light: '#f87171', soft: 'rgba(220, 38, 38, 0.10)', pale: '#fef2f2' },
  'binder-purple-spine': { deep: '#4c1d95', mid: '#7c3aed', light: '#a78bfa', soft: 'rgba(124, 58, 237, 0.10)', pale: '#f5f3ff' },
  'binder-amber-spine': { deep: '#78350f', mid: '#d97706', light: '#fbbf24', soft: 'rgba(217, 119, 6, 0.12)', pale: '#fffbeb' },
  'binder-teal-spine': { deep: '#155e75', mid: '#0891b2', light: '#22d3ee', soft: 'rgba(8, 145, 178, 0.10)', pale: '#f0fdfa' },
};

/**
 * The open-file frame token for the current user + binder: resolves the
 * binder's colour exactly like the spine does (per-user override first),
 * then maps it to its frame token set.
 */
export function resolveBinderFrameToken(binderColors, binder) {
  const colorClass = resolveBinderColor(binderColors, binder);
  return BINDER_FRAME_TOKENS[colorClass] || BINDER_FRAME_TOKENS['binder-blue-spine'];
}
