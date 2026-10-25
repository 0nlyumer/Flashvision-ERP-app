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
