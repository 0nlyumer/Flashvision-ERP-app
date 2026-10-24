// --- Sale Invoice source documents (Omer's order, 2026-10-24) ---
// A Sale Invoice can be raised four ways:
//   DC         against a Delivery Challan (the original flow, unchanged)
//   GRN        against a Goods Receive Note
//   IGP        against an Inward Gate Pass
//   STANDALONE no source document: pick a department, that department's
//              items load, and an invoice can be raised for any of them.
//
// Every invoice records its source (sourceType + sourceId) so it stays
// linked to the document it was raised against.
//
// LINK-ONLY RULE for GRN / IGP: those documents carry an `isInvoiced`
// flag that belongs to the PURCHASE Invoice flow — addPurchaseInvoice
// sets it, the Purchase Invoice dropdown filters on it, and PI
// update/delete clear it. A Sale Invoice therefore NEVER touches that
// flag (setting it would hide the document from the Purchase Invoice
// flow and break it); the SI only records the link on itself. The DC
// flag is different: deliveries belong to the sales flow, and the SI
// keeps marking them exactly as before — on POST, never on draft
// (drafts hold nothing; see siLinkedSourceIds).

export const SI_SOURCE_TYPES = ['DC', 'GRN', 'IGP', 'STANDALONE'];

// The invoice's source type. Legacy invoices (saved before sourceType
// existed) were all raised against a delivery challan.
export const invoiceSourceType = (invoice) => {
  if (!invoice) return null;
  if (invoice.sourceType) return invoice.sourceType;
  return invoice.deliveryId ? 'DC' : null;
};

// The source document's id (null for standalone invoices).
export const invoiceSourceId = (invoice) => {
  if (!invoice) return null;
  return invoice.sourceId || invoice.deliveryId || null;
};

const SOURCE_SHORT = { DC: 'DC', GRN: 'GRN', IGP: 'IGP' };

// Short human label for lists / detail views / print, e.g.
// "DC · DC-2026-001", "GRN · GRN-001", "Standalone · Production Department".
export const invoiceSourceLabel = (invoice) => {
  const type = invoiceSourceType(invoice);
  if (!type) return '—';
  if (type === 'STANDALONE') {
    return invoice.department ? `Standalone · ${invoice.department}` : 'Standalone';
  }
  const id = invoiceSourceId(invoice);
  const short = SOURCE_SHORT[type] || type;
  return id ? `${short} · ${id}` : short;
};

// Normalize a GRN / IGP document's lines into the SI line shape.
//   GRN lines: { itemCode, itemName, qty, receivedQty, rejectedQty, unitPrice, uom }
//   IGP lines: { itemId, itemCode, itemName, orderQty, receivedQty, unitPrice, uom }
// The invoiced quantity is the RECEIVED quantity when the document
// carries one (that is what physically came in), else qty / orderQty.
export const normalizeSourceDocLines = (doc) => {
  if (!doc || !Array.isArray(doc.items)) return [];
  return doc.items.map((line) => {
    const rawQty = (line.receivedQty !== undefined && line.receivedQty !== null)
      ? line.receivedQty
      : (line.qty !== undefined && line.qty !== null ? line.qty : line.orderQty);
    const carried = (line.unitPrice !== undefined && line.unitPrice !== null)
      ? line.unitPrice
      : (line.price !== undefined && line.price !== null ? line.price : null);
    return {
      itemId: line.itemId || null,
      itemCode: line.itemCode || line.sku || '',
      productName: line.itemName || line.productName || line.itemSpecification || line.itemCode || '',
      qty: parseFloat(rawQty) || 0,
      uom: line.uom || 'Units',
      carriedRate: carried
    };
  });
};

// Items belonging to a department, per the Inventory department mapping.
// The department record's itemIds list is the authoritative mapping;
// when a department record carries no item list, fall back to the item's
// own department string (comma-separated department names).
export const itemsForDepartment = (items, department) => {
  const all = items || [];
  if (!department) return [];
  const ids = Array.isArray(department.itemIds) ? department.itemIds : [];
  if (ids.length > 0) {
    const idSet = new Set(ids);
    return all.filter(it => idSet.has(it.id));
  }
  const name = department.name || department.value || '';
  if (!name) return [];
  return all.filter(it =>
    String(it.department || '').split(',').map(s => s.trim()).includes(name)
  );
};

// Source document ids already held by a POSTED sales invoice of the
// given type — used to keep a document from being invoiced twice from
// the SI dropdowns. Drafts are excluded on purpose: a draft holds
// nothing (finance rule — a draft leaves its source available), so a
// document linked only to a draft stays selectable.
export const siLinkedSourceIds = (salesInvoices, sourceType) => {
  const out = new Set();
  (salesInvoices || []).forEach(inv => {
    if (!inv || inv.status === 'Draft') return;
    if (invoiceSourceType(inv) !== sourceType) return;
    const id = invoiceSourceId(inv);
    if (id) out.add(id);
  });
  return out;
};
