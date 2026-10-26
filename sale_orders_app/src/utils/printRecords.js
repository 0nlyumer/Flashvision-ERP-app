// Print-record builders for the Universal Print Studio.
//
// Records follow the established studio shape:
//   { docTitle?, docSub?, header: {...}, items: [...], totals: {...} }
// Header keys and item keys match the document's schema in
// printSchemaRegistry.js (DEFAULT_DOCUMENT_SCHEMAS).

const fmtDateGB = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB');
};

const fmtMoney2 = (value) => {
  const n = Number(value) || 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Running balance exactly as the GL screen shows it: absolute value + Dr/Cr.
export function formatLedgerBalance(runningBalance) {
  const n = Number(runningBalance) || 0;
  return `${fmtMoney2(Math.abs(n))} ${n >= 0 ? 'Dr' : 'Cr'}`;
}

/**
 * General Ledger studio record, built from the CURRENTLY FILTERED entries
 * (the same array the GL screen totals — every filtered row, not just the
 * visible page).
 *
 * filters: { accountLabel, voucherType ('all' allowed), party,
 *            fromDate, toDate, generatedOn }
 */
export function buildGeneralLedgerRecord(entries = [], filters = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const items = list.map((e) => ({
    entry_date: fmtDateGB(e.date),
    voucher: [e.voucherType, e.voucherNo].filter(Boolean).join(' '),
    account: [e.accountId, e.accountName].filter(Boolean).join(' — '),
    party: e.party || '—',
    narration: e.narration || '',
    debit: Number(e.debit) || 0,
    credit: Number(e.credit) || 0,
    balance: formatLedgerBalance(e.runningBalance)
  }));

  const totalDebit = list.reduce((s, e) => s + (Number(e.debit) || 0), 0);
  const totalCredit = list.reduce((s, e) => s + (Number(e.credit) || 0), 0);
  const lastBalance = list.length ? list[list.length - 1].runningBalance : 0;

  const period = filters.fromDate || filters.toDate
    ? `${filters.fromDate ? fmtDateGB(filters.fromDate) : '…'} – ${filters.toDate ? fmtDateGB(filters.toDate) : '…'}`
    : 'All Time';

  return {
    docSub: 'DOUBLE-ENTRY ACCOUNTING BOOK',
    header: {
      account: filters.accountLabel || 'All Accounts (Consolidated)',
      period,
      voucher_type: !filters.voucherType || filters.voucherType === 'all' ? 'All Voucher Types' : filters.voucherType,
      party: filters.party ? filters.party : 'All',
      generated_on: filters.generatedOn || fmtDateGB(new Date())
    },
    items,
    totals: {
      debit: Math.round(totalDebit * 100) / 100,
      credit: Math.round(totalCredit * 100) / 100,
      balance: formatLedgerBalance(lastBalance)
    }
  };
}

/**
 * Chart of Accounts studio record, built from the accounts exactly as the
 * CoA screen displays them (live GL balances merged, filters applied, tree
 * order: root type → group → children → standalones).
 *
 * accounts: enriched rows { code, name, rootType, category, isGroup,
 *           netBalance, isDebitNormal } in final display order.
 * options:  { filteredBy, generatedOn }
 */
// Sale Order studio record (approved batch Part 6, 2026-10-26): the record
// shape the Universal Print Studio expects for documentType 'sale_order' —
// the SAME enrichment getSampleRecordFromState applies to its sample:
// customer / contact / shipping_address as display STRINGS (the studio
// header resolver stringifies record fields directly, so object values
// would render as "[object Object]"). Used by SaleOrderModule's Print
// buttons now that the legacy Digital Twin renderer is removed.
export function buildSaleOrderRecord(state, order) {
  if (!order) return null;
  const customer = (state?.customers || []).find((c) => c && c.id === order.customerId);
  return {
    ...order,
    customer: customer?.name || order.customerName || 'Customer',
    contact: customer?.contactPerson || order.contactPerson || 'N/A',
    shipping_address: order.shippingAddress || 'Factory Gate, Industrial Estate'
  };
}

export function buildChartOfAccountsRecord(accounts = [], options = {}) {
  const list = Array.isArray(accounts) ? accounts : [];
  const items = list.map((acc) => {
    const net = Number(acc.netBalance) || 0;
    const debitNormal = acc.isDebitNormal !== false;
    const drCr = net >= 0 ? (debitNormal ? 'Dr' : 'Cr') : (debitNormal ? 'Cr' : 'Dr');
    return {
      account_code: acc.code || acc.id || '',
      account_name: acc.isGroup ? `${acc.name} (Group)` : (acc.name || ''),
      type: acc.rootType || '',
      current_balance: `${fmtMoney2(Math.abs(net))} ${drCr}`
    };
  });

  return {
    docSub: 'MASTER CHART OF ACCOUNTS',
    header: {
      report_title: 'Chart of Accounts',
      print_date: options.generatedOn || fmtDateGB(new Date()),
      filtered_by: options.filteredBy || 'All Categories'
    },
    items,
    totals: {}
  };
}

/**
 * Other Consumption studio record (document `other_consumptions`).
 * Accepts ONE saved otherConsumptions record (the history row being
 * printed — the same single voucher the old window.open print produced)
 * or an array of records (printed as one multi-line voucher).
 *
 * Record shape: { id, planId, itemCode, itemName, unit, price, quantity,
 *                 cost, department, date }
 */
export function buildOtherConsumptionRecord(input) {
  const list = (Array.isArray(input) ? input : [input]).filter(Boolean);
  const first = list[0] || {};
  const sameDept = list.every((r) => r.department === first.department);
  const samePlan = list.every((r) => r.planId === first.planId);

  const items = list.map((r) => {
    const qty = Number(r.quantity) || 0;
    const price = Number(r.price) || 0;
    return {
      item_code: r.itemCode || '',
      item_name: r.itemName || '',
      qty,
      uom: r.unit || '',
      unit_price: price,
      amount: r.cost !== undefined && r.cost !== null && r.cost !== '' ? Number(r.cost) || 0 : qty * price,
      remarks: r.remarks || ''
    };
  });

  return {
    id: list.length === 1 ? first.id : undefined,
    header: {
      ref_no: list.length === 1 ? (first.id || '') : `${list.length} Records`,
      date: first.date || new Date().toISOString(),
      cost_center: sameDept ? (first.department || '') : 'Multiple Departments',
      category: samePlan && first.planId ? `Plan ${first.planId}` : 'General Consumption'
    },
    items,
    totals: {
      qty: items.reduce((s, i) => s + i.qty, 0),
      amount: Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100
    }
  };
}

/**
 * Stock Transfer note studio record (document `stock_transfer`), built from
 * the actual transfer record: { id, date, source, destination, status,
 * items: [{ itemCode, itemName, quantity, uom? }] }.
 * `catalogItems` (state.items) resolves each line's UOM when the transfer
 * line itself carries none.
 */
export function buildStockTransferRecord(transfer = {}, catalogItems = []) {
  const lines = Array.isArray(transfer.items) ? transfer.items : [];
  const catalog = Array.isArray(catalogItems) ? catalogItems : [];
  const items = lines.map((line) => {
    const cat = catalog.find((i) => String(i.sku) === String(line.itemCode) || String(i.id) === String(line.itemCode));
    return {
      item_code: line.itemCode || '',
      item_name: line.itemName || line.name || '',
      transfer_qty: Number(line.quantity ?? line.qty) || 0,
      uom: line.uom || line.unit || cat?.uom || cat?.unit || '—'
    };
  });

  return {
    id: transfer.id,
    header: {
      transfer_no: transfer.id || '',
      date: transfer.date || '',
      from_warehouse: transfer.source || '',
      to_warehouse: transfer.destination || '',
      status: transfer.status || ''
    },
    items,
    totals: {
      transfer_qty: items.reduce((s, i) => s + i.transfer_qty, 0)
    }
  };
}

/**
 * Stock Receiving note studio record (document `stock_receiving_history`),
 * built from a RECEIVED transfer record: received quantities come from
 * transfer.receivedItems ([{ itemCode, receivedQty }]); accepted = received,
 * rejected = transferred − received (never below 0).
 */
export function buildStockReceivingRecord(transfer = {}) {
  const lines = Array.isArray(transfer.items) ? transfer.items : [];
  const received = Array.isArray(transfer.receivedItems) ? transfer.receivedItems : [];
  const items = lines.map((line) => {
    const rec = received.find((r) => String(r.itemCode) === String(line.itemCode));
    const sentQty = Number(line.quantity ?? line.qty) || 0;
    const receivedQty = rec ? (Number(rec.receivedQty) || 0) : sentQty;
    return {
      item_code: line.itemCode || '',
      item_name: line.itemName || line.name || '',
      received_qty: receivedQty,
      accepted_qty: receivedQty,
      rejected_qty: Math.max(0, sentQty - receivedQty)
    };
  });

  return {
    id: transfer.id,
    header: {
      receiving_no: String(transfer.id || '').replace('TRF', 'RCV'),
      date: transfer.date || '',
      supplier: transfer.source || '',
      grn_ref: transfer.id || ''
    },
    items,
    totals: {
      received_qty: items.reduce((s, i) => s + i.received_qty, 0),
      accepted_qty: items.reduce((s, i) => s + i.accepted_qty, 0),
      rejected_qty: items.reduce((s, i) => s + i.rejected_qty, 0)
    }
  };
}
