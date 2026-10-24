// --- Voucher numbering (Omer's order, 2026-10-24) ------------------------
// Voucher numbers are SHORT, per-type series starting at 001:
// JV-001, CPV-001, CRV-001, BPV-001, BRV-001 — the old long format
// (BPV-2026-0001) was impossible for him to follow. Existing documents
// keep their existing numbers; only NEW documents get the new format.
//
// The per-type counters persist server-side in the app_config `counters`
// object (keys `voucherJV`, `voucherCPV`, ...), riding the exact same
// AppContext write-through as the line-code counter, so a reload can
// never rewind or reset a series. Allocation also scans the existing
// vouchers of the type for already-issued short numbers, so a number is
// never re-issued even if a counter somehow lags the documents.

export const VOUCHER_TYPES = ['JV', 'CPV', 'CRV', 'BPV', 'BRV', 'PV'];

export const voucherCounterKey = (type) => `voucher${type}`;

// Sequence number out of a short-format voucher id ("BPV-007" -> 7 for
// type BPV). Legacy long ids ("BPV-2026-0001") and foreign ids return 0.
export function parseVoucherSeq(id, type) {
  if (typeof id !== 'string' || !type) return 0;
  const m = new RegExp(`^${type}-(\\d{1,6})$`).exec(id.trim());
  return m ? parseInt(m[1], 10) : 0;
}

// The next sequence number for a type: one past the higher of the
// persisted counter and the highest short number already in use.
export function nextVoucherNumber(counters, vouchers, type) {
  const fromCounter = Number(counters?.[voucherCounterKey(type)] || 0) || 0;
  const fromExisting = (Array.isArray(vouchers) ? vouchers : []).reduce(
    (max, v) => (v && v.type === type ? Math.max(max, parseVoucherSeq(v.id || v.voucherNo, type)) : max),
    0
  );
  return Math.max(fromCounter, fromExisting) + 1;
}

export function formatVoucherId(type, n) {
  return `${type}-${String(n).padStart(3, '0')}`;
}

export function suggestVoucherId(counters, vouchers, type) {
  if (!type) return '';
  return formatVoucherId(type, nextVoucherNumber(counters, vouchers, type));
}
