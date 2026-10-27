// printSheetData — the Universal Print Studio's record-access helpers,
// extracted from UniversalPrintStudioModal (2026-10-28) so OTHER surfaces
// render the same documents with the same values — the Daily Activity
// File viewer above all. The modal imports these too; there is exactly
// one implementation of "what does this cell/header show for this
// record", so a document can never read differently in two places.

import { uomSymbol } from './printDesign';

// Line items of a studio record, whatever key the record carries them on.
export function resolveRecordLineItems(record) {
  if (!record) return [];
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.lineItems)) return record.lineItems;
  if (Array.isArray(record.rows)) return record.rows;
  if (Array.isArray(record.details)) return record.details;
  if (Array.isArray(record.records)) return record.records;
  return [];
}

export function getPrintCellValue(colKey, item, index = 0) {
  if (!item) return '---';
  if (colKey === 'serial_no' || colKey === 'sr' || colKey === 'sr_no') return String(index + 1).padStart(2, '0');
  if (item[colKey] !== undefined && item[colKey] !== null) {
    const val = item[colKey];
    if ((colKey === 'uom' || colKey === 'unit') && typeof val === 'string') return uomSymbol(val);
    return typeof val === 'number' ? val.toLocaleString() : String(val);
  }
  if (colKey === 'item_name' || colKey === 'product_name' || colKey === 'description') {
    return item.name || item.itemName || item.productName || item.description || '---';
  }
  if (colKey === 'item_code' || colKey === 'sku' || colKey === 'code') {
    return item.itemCode || item.code || item.sku || '---';
  }
  if (colKey === 'qty' || colKey === 'quantity') return String(item.quantity ?? item.qty ?? '0');
  if (colKey === 'rolls' || colKey === 'roll_qty') return String(item.rolls || item.rollQty || item.rollsCount || '-');
  if (colKey === 'uom' || colKey === 'unit') return uomSymbol(item.uom || item.unit || 'Mtr');
  if (colKey === 'rate' || colKey === 'price') return Number(item.price || item.rate || 0).toLocaleString();
  if (colKey === 'sub_total' || colKey === 'total') {
    if (item.sub_total !== undefined) return Number(item.sub_total).toLocaleString();
    const q = Number(item.quantity || item.qty || 0);
    const r = Number(item.price || item.rate || 0);
    const d = Number(item.discount || 0);
    return Number(q * r - d).toLocaleString();
  }
  return item[colKey] !== undefined ? String(item[colKey]) : '---';
}

export function getPrintNumericValue(colKey, item) {
  if (!item) return 0;
  const direct = item[colKey];
  if (typeof direct === 'number') return direct;
  if (colKey === 'sub_total' || colKey === 'total') {
    if (typeof item.sub_total === 'number') return item.sub_total;
    const q = Number(item.quantity || item.qty || 0);
    const r = Number(item.price || item.rate || 0);
    const d = Number(item.discount || 0);
    return q * r - d;
  }
  if (colKey === 'qty' || colKey === 'quantity') return Number(item.quantity ?? item.qty ?? 0);
  if (colKey === 'rate' || colKey === 'price') return Number(item.price ?? item.rate ?? 0);
  const n = Number(direct);
  return Number.isFinite(n) ? n : 0;
}

export function getPrintHeaderFieldValue(record, fieldKey, state) {
  if (!record) return '---';
  if (record[fieldKey] !== undefined && record[fieldKey] !== null) {
    const val = record[fieldKey];
    if (fieldKey === 'date' || fieldKey.includes('_date')) {
      const d = new Date(val);
      return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return String(val);
  }
  if (record.header && record.header[fieldKey] !== undefined) {
    return String(record.header[fieldKey]);
  }
  if (fieldKey === 'customer' || fieldKey === 'customer_name' || fieldKey === 'party_name') {
    if (record.customerName) return record.customerName;
    if (record.customerId) {
      const c = state?.customers?.find((x) => x.id === record.customerId);
      return c ? c.name : record.customerId;
    }
  }
  if (fieldKey === 'contact' || fieldKey === 'contact_details') {
    if (record.contactPerson) return record.contactPerson;
    if (record.consignee?.contactNumber) return record.consignee.contactNumber;
  }
  if (fieldKey === 'shipping_address') {
    return record.shippingAddress || record.consignee?.address || 'Standard Delivery Address';
  }
  return '---';
}
