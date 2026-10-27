// dailyActivity — the Daily Activity File (design approved by Omer
// 2026-10-26; implemented 2026-10-28 on his "implement kar do" order).
//
// In the Files cabinet, every date has ONE Daily Activity file. It is a
// VIRTUAL file: nothing is stored for it anywhere. Opening it assembles
// the day live from the same server collections the modules write —
// vouchers, sale orders, deliveries, plans, outputs, gate passes, HR
// requests — so the file can never disagree with the modules, and the
// SERVER RULE holds (the browser keeps nothing of its own here).
//
// Shape returned by buildDailyActivity(state, dateStr):
//   {
//     date, totalDocs,
//     categories: [{ id, label, icon, count, groups: [
//       { id, label, count, docs: [entry] }
//     ]}]
//   }
// entry = { key, kind: 'doc' | 'petty' | 'gatepass', docType, slip,
//           record, title, ref, sub }
// 'petty' is the day's Daily Petty Cash report (one document, docType
// 'daily_petty_cash'); 'gatepass' is ONE summary entry for the whole
// group (summary cards only — no per-pass prints, per the design).
// A category/group with no documents that day is omitted entirely.
//
// Release Paper inspections join Production as their own group the day
// that module's data exists in state (releasePaperInspections) — the
// design reserves the group; the module is not built yet.

import { buildSaleOrderRecord, buildOtherConsumptionRecord } from './printRecords';
import { buildConsumptionPrintRecord } from './printDesign';
import { isSlipFamilyDocType } from './studioSnapshot';
import {
  buildLeaveRequestPrintRecord,
  buildOvertimeRequestPrintRecord,
  buildLoanRequestPrintRecord,
  buildAdvanceRequestPrintRecord
} from './hrPrintRecords';

export const PETTY_CASH_ACCOUNT_ID = '111020';
export const PETTY_CASH_ACCOUNT_LABEL = '111020 — Petty Cash - Head Office & Admin';

const DATE_FIELDS = [
  'date', 'planDate', 'creationDate', 'invoiceDate', 'orderDate', 'dcDate',
  'issueDate', 'voucherDate', 'dateApplied', 'startDate', 'createdAt',
  'generatedAt', 'timestamp', 'filedAt'
];

// The calendar day a record belongs to, as 'YYYY-MM-DD'. ISO strings
// keep their own date part (no timezone shifting); 'DD/MM/YYYY'
// strings are read as written; anything else goes through Date.
export function recordDateStr(rec) {
  if (!rec || typeof rec !== 'object') return null;
  for (const field of DATE_FIELDS) {
    const v = rec[field];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'string') {
      const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
      const gb = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (gb) return `${gb[3]}-${gb[2]}-${gb[1]}`;
    }
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().substring(0, 10);
  }
  return null;
}

const onDate = (list, dateStr) =>
  (Array.isArray(list) ? list : []).filter((rec) => recordDateStr(rec) === dateStr);

const money = (v) => {
  const n = Number(v) || 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const docEntry = (key, docType, record, title, ref, sub = '') => ({
  key,
  kind: 'doc',
  docType,
  slip: isSlipFamilyDocType(docType),
  record,
  title: title || ref || docType,
  ref: ref || '',
  sub
});

// --- Finance ---------------------------------------------------------------

const VOUCHER_TYPE_GROUPS = [
  { type: 'JV', docType: 'voucher_journal', label: 'Journal Vouchers' },
  { type: 'CPV', docType: 'voucher_payment', label: 'Cash Payment Vouchers' },
  { type: 'BPV', docType: 'voucher_payment', label: 'Bank Payment Vouchers' },
  { type: 'CRV', docType: 'voucher_receipt', label: 'Cash Receipt Vouchers' },
  { type: 'BRV', docType: 'voucher_receipt', label: 'Bank Receipt Vouchers' }
];

const accountNameOf = (state, accountId) => {
  const acc = (state?.chartOfAccounts || []).find((a) => a && String(a.id) === String(accountId));
  return acc?.name || '';
};

// Studio-shaped slip record for a finance voucher (state.vouchers):
// header per the voucher schemas + one item per ledger line.
const voucherSlipRecord = (state, voucher) => {
  const lines = Array.isArray(voucher.lines) ? voucher.lines : [];
  return {
    id: voucher.id,
    header: {
      voucher_no: voucher.id,
      date: voucher.date || '',
      narration: voucher.narration || '',
      notes: voucher.narration || '',
      reference: voucher.reference || '',
      status: voucher.status || '',
      prepared_by: voucher.createdBy || ''
    },
    items: lines.map((l, idx) => ({
      serial_no: idx + 1,
      account_head: `${l.accountId || ''}${l.accountName || accountNameOf(state, l.accountId) ? ` — ${l.accountName || accountNameOf(state, l.accountId)}` : ''}`,
      narration: l.narration || '',
      amount: money((Number(l.debit) || 0) + (Number(l.credit) || 0)),
      debit: money(l.debit),
      credit: money(l.credit)
    })),
    totals: { amount: money(voucher.totalDebit) }
  };
};

// The day's Daily Petty Cash report: every POSTED voucher line touching
// the petty cash account, with the balance carried in from all earlier
// days. Debit = cash in, credit = cash out (asset account).
export function buildPettyCashReport(state, dateStr) {
  const posted = (state?.vouchers || []).filter((v) => v && v.status === 'Posted');
  const movements = [];
  posted.forEach((v) => {
    (Array.isArray(v.lines) ? v.lines : []).forEach((l) => {
      if (String(l.accountId) !== PETTY_CASH_ACCOUNT_ID) return;
      movements.push({
        date: recordDateStr(v),
        voucher: v.id,
        narration: l.narration || v.narration || '',
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0
      });
    });
  });
  let opening = 0;
  movements.forEach((m) => { if (m.date && m.date < dateStr) opening += m.debit - m.credit; });
  const dayMovements = movements
    .filter((m) => m.date === dateStr)
    .sort((a, b) => String(a.voucher).localeCompare(String(b.voucher)));
  if (dayMovements.length === 0) return null;

  let running = opening;
  const items = dayMovements.map((m, idx) => {
    running = parseFloat((running + m.debit - m.credit).toFixed(2));
    return {
      serial_no: idx + 1,
      voucher: m.voucher,
      narration: m.narration,
      cash_in: m.debit > 0 ? money(m.debit) : '—',
      cash_out: m.credit > 0 ? money(m.credit) : '—',
      balance: money(running)
    };
  });

  return {
    id: `PETTY-${dateStr}`,
    header: {
      report_date: dateStr,
      account: PETTY_CASH_ACCOUNT_LABEL,
      opening_balance: money(opening),
      closing_balance: money(running)
    },
    items,
    totals: { closing_balance: money(running) }
  };
}

function financeCategory(state, dateStr) {
  const groups = [];
  const vouchers = onDate(state?.vouchers, dateStr);
  VOUCHER_TYPE_GROUPS.forEach(({ type, docType, label }) => {
    const docs = vouchers
      .filter((v) => v.type === type)
      .map((v) => docEntry(`voucher-${v.id}`, docType, voucherSlipRecord(state, v), `${label.replace(/s$/, '')} ${v.id}`, v.id, v.narration || ''));
    if (docs.length) groups.push({ id: `vouchers-${type}`, label, docs });
  });

  const paymentVouchers = onDate(state?.paymentVouchers, dateStr);
  if (paymentVouchers.length) {
    groups.push({
      id: 'payment-vouchers',
      label: 'Payment Vouchers',
      docs: paymentVouchers.map((pv) =>
        docEntry(`pv-${pv.id}`, 'voucher_payment', pv, `Payment Voucher ${pv.id}`, pv.id, pv.narration || pv.paidTo || ''))
    });
  }

  const petty = buildPettyCashReport(state, dateStr);
  if (petty) {
    groups.push({
      id: 'petty-cash',
      label: 'Daily Petty Cash',
      docs: [{
        key: `petty-${dateStr}`,
        kind: 'petty',
        docType: 'daily_petty_cash',
        slip: true,
        record: petty,
        title: `Daily Petty Cash — ${dateStr}`,
        ref: petty.id,
        sub: `Closing balance Rs ${petty.totals.closing_balance}`
      }]
    });
  }
  return { id: 'finance', label: 'Finance', icon: 'account_balance', groups };
}

// --- Sales -----------------------------------------------------------------

function salesCategory(state, dateStr) {
  const groups = [];
  const orders = onDate(state?.saleOrders, dateStr);
  if (orders.length) {
    groups.push({
      id: 'sale-orders',
      label: 'Sale Orders',
      docs: orders.map((so) => docEntry(
        `so-${so.id}`, 'sale_order', buildSaleOrderRecord(state, so),
        `${so.customerName || 'Sale Order'} — ${so.id}`, so.id, so.status || ''))
    });
  }
  const deliveries = onDate(state?.deliveries, dateStr);
  if (deliveries.length) {
    groups.push({
      id: 'delivery-challans',
      label: 'Delivery Challans',
      docs: deliveries.map((d) => docEntry(
        `dc-${d.id}`, 'delivery_challan',
        {
          ...d,
          customer: d.customerName || 'Consignee Party',
          contact: d.consignee?.contactNumber || 'N/A',
          shipping_address: d.consignee?.deliveryAddress || d.consignee?.address || 'Site Delivery',
          items: Array.isArray(d.items) ? d.items : []
        },
        `${d.customerName || 'Delivery Challan'} — ${d.dcNumber || d.id}`, d.dcNumber || d.id, d.status || ''))
    });
  }
  const invoices = onDate(state?.salesInvoices, dateStr);
  if (invoices.length) {
    groups.push({
      id: 'sale-invoices',
      label: 'Sale Invoices',
      docs: invoices.map((inv) => docEntry(
        `si-${inv.id}`, 'sale_invoice', inv,
        `${inv.customerName || 'Sale Invoice'} — ${inv.id}`, inv.id, inv.status || ''))
    });
  }
  return { id: 'sales', label: 'Sales', icon: 'point_of_sale', groups };
}

// --- Purchase ---------------------------------------------------------------

function purchaseCategory(state, dateStr) {
  const groups = [];
  const pos = onDate(state?.purchaseOrders, dateStr);
  if (pos.length) {
    groups.push({
      id: 'purchase-orders',
      label: 'Purchase Orders',
      docs: pos.map((po) => docEntry(`po-${po.id}`, 'purchase_order', po, `${po.supplierName || 'Purchase Order'} — ${po.id}`, po.id, po.status || ''))
    });
  }
  const pis = onDate(state?.purchaseInvoices, dateStr);
  if (pis.length) {
    groups.push({
      id: 'purchase-invoices',
      label: 'Purchase Invoices',
      docs: pis.map((pi) => docEntry(`pi-${pi.id}`, 'purchase_invoice', pi, `${pi.supplierName || 'Purchase Invoice'} — ${pi.id}`, pi.id, pi.status || ''))
    });
  }
  const grnSources = [
    ...(state?.approvals || []).filter((a) => a && a.type === 'GRN Log'),
    ...(Array.isArray(state?.stockReceiving) ? state.stockReceiving : [])
  ];
  const grns = onDate(grnSources, dateStr);
  if (grns.length) {
    groups.push({
      id: 'grns',
      label: 'GRN',
      docs: grns.map((g) => docEntry(`grn-${g.id}`, 'grn_note', g, `GRN — ${g.id}`, g.id, g.status || ''))
    });
  }
  const igps = onDate(state?.inwardGatePasses, dateStr);
  if (igps.length) {
    groups.push({
      id: 'inward-gate-passes',
      label: 'Inward Gate Passes',
      docs: igps.map((g) => docEntry(`igp-${g.id}`, 'inward_gate_pass', g, `${g.supplierName || 'Inward Gate Pass'} — ${g.id}`, g.id, g.status || ''))
    });
  }
  return { id: 'purchase', label: 'Purchase', icon: 'shopping_cart', groups };
}

// --- Production ---------------------------------------------------------------

function productionCategory(state, dateStr) {
  const groups = [];
  const plans = onDate(state?.productionPlans, dateStr);
  if (plans.length) {
    groups.push({
      id: 'production-plans',
      label: 'Production Plans',
      docs: plans.map((p) => docEntry(`plan-${p.id}`, 'production_plan', p, `Plan — ${p.id}`, p.id, p.status || ''))
    });
  }
  const outputs = onDate(state?.productionOutputs, dateStr);
  if (outputs.length) {
    groups.push({
      id: 'production-outputs',
      label: 'Outputs / Batch Closing',
      docs: outputs.map((o) => docEntry(`out-${o.id}`, 'batch_closing_history', o, `Output — ${o.id}`, o.id, o.itemName || o.status || ''))
    });
  }
  const consumptionDocs = plans
    .filter((p) => p.consumptions && Object.keys(p.consumptions).length > 0)
    .map((p) => docEntry(
      `cons-${p.id}`, 'consumption_history', buildConsumptionPrintRecord(p, state),
      `Consumption — Plan ${p.id}`, p.id, ''));
  if (consumptionDocs.length) {
    groups.push({ id: 'consumptions', label: 'Consumptions', docs: consumptionDocs });
  }
  const others = onDate(state?.otherConsumptions, dateStr);
  if (others.length) {
    groups.push({
      id: 'other-consumptions',
      label: 'Other Consumption',
      docs: others.map((r) => docEntry(`oc-${r.id}`, 'other_consumptions', buildOtherConsumptionRecord(r), `${r.itemName || 'Other Consumption'} — ${r.id}`, r.id, r.department || ''))
    });
  }
  // Release Paper inspections: their own group, present only when the
  // module's data exists in state (reserved by the approved design).
  const inspections = onDate(state?.releasePaperInspections, dateStr);
  if (inspections.length) {
    groups.push({
      id: 'release-paper',
      label: 'Release Paper Inspections',
      docs: inspections.map((r) => docEntry(`rp-${r.id}`, 'release_paper_inspection', r, `Inspection — ${r.id}`, r.id, ''))
    });
  }
  return { id: 'production', label: 'Production', icon: 'factory', groups };
}

// --- Gate Pass FG (summary cards only) ---------------------------------------

function gatePassCategory(state, dateStr) {
  const activities = onDate(state?.gatePassActivities, dateStr);
  if (!activities.length) return { id: 'gatepass', label: 'Gate Pass FG', icon: 'door_open', groups: [] };
  const summaryEntry = {
    key: `gatepass-${dateStr}`,
    kind: 'gatepass',
    docType: null,
    slip: false,
    record: null,
    title: `Gate Pass Activities — ${dateStr}`,
    ref: `${activities.length} activities`,
    sub: '',
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type || '—',
      time: a.timestamp ? new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
      description: a.description || '',
      sender: a.sender || '',
      photos: Array.isArray(a.photos) ? a.photos.length : 0,
      videos: Array.isArray(a.videos) ? a.videos.length : 0,
      documents: Array.isArray(a.documents) ? a.documents.length : 0
    }))
  };
  return {
    id: 'gatepass',
    label: 'Gate Pass FG',
    icon: 'door_open',
    groups: [{ id: 'gate-pass-activities', label: 'Gate Pass Activities', docs: [summaryEntry] }]
  };
}

// --- HR -----------------------------------------------------------------------

function hrCategory(state, dateStr) {
  const employees = state?.hr_employees_list || [];
  const groups = [];
  const leaves = onDate(state?.hr_leave_requests, dateStr);
  if (leaves.length) {
    groups.push({
      id: 'leave-requests',
      label: 'Leave Requests',
      docs: leaves.map((r) => docEntry(`leave-${r.id}`, 'hr_leave_request', buildLeaveRequestPrintRecord(r, employees), `${r.employeeName || 'Leave'} — ${r.id}`, r.id, r.status || ''))
    });
  }
  const loans = onDate(state?.hr_loan_requests, dateStr);
  if (loans.length) {
    groups.push({
      id: 'loan-requests',
      label: 'Loan Requests',
      docs: loans.map((r) => docEntry(`loan-${r.id}`, 'hr_loan_request', buildLoanRequestPrintRecord(r), `${r.employeeName || 'Loan'} — ${r.id}`, r.id, r.status || ''))
    });
  }
  const ots = onDate(state?.hr_overtime_requests, dateStr);
  if (ots.length) {
    groups.push({
      id: 'overtime-requests',
      label: 'Overtime Requests',
      docs: ots.map((r) => docEntry(`ot-${r.id}`, 'hr_overtime_request', buildOvertimeRequestPrintRecord(r, employees), `${r.employeeName || 'Overtime'} — ${r.id}`, r.id, r.status || ''))
    });
  }
  const advances = onDate(state?.hr_advance_requests, dateStr);
  if (advances.length) {
    groups.push({
      id: 'advance-requests',
      label: 'Advance Requests',
      docs: advances.map((r) => docEntry(`adv-${r.id}`, 'hr_advance_request', buildAdvanceRequestPrintRecord(r), `${r.employeeName || 'Advance'} — ${r.id}`, r.id, r.status || ''))
    });
  }
  return { id: 'hr', label: 'HR', icon: 'badge', groups };
}

// --- Assembly -------------------------------------------------------------------

export function buildDailyActivity(state, dateStr) {
  const categories = [
    financeCategory(state, dateStr),
    salesCategory(state, dateStr),
    purchaseCategory(state, dateStr),
    productionCategory(state, dateStr),
    gatePassCategory(state, dateStr),
    hrCategory(state, dateStr)
  ]
    .map((cat) => ({
      ...cat,
      groups: cat.groups.map((g) => ({ ...g, count: g.docs.length })),
      count: cat.groups.reduce((s, g) => s + g.docs.length, 0)
    }))
    .filter((cat) => cat.count > 0);
  return {
    date: dateStr,
    categories,
    totalDocs: categories.reduce((s, c) => s + c.count, 0)
  };
}
