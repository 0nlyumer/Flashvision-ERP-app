// itemCodes.js — Phase C Step 3: settled master-code scheme (PREFIX-NNN) and
// sale-order line codes (ITEM-NNN).
//
// Master codes: Finished Good = FG-001…, Raw Material = RM-001…,
// Mechanical = MC-001… — category prefix + hyphen + number, no middle word.
// Other categories fall back to state.categoryPrefixes, then to initials
// derived from the category name.

export const CATEGORY_CODE_PREFIXES = {
  'Finished Goods': 'FG',
  'Finished Good': 'FG',
  'Raw Material': 'RM',
  'Mechanical': 'MC',
};

export const codePrefixForCategory = (category, categoryPrefixes) => {
  const cat = String(category || '').trim();
  if (CATEGORY_CODE_PREFIXES[cat]) return CATEGORY_CODE_PREFIXES[cat];
  if (categoryPrefixes && categoryPrefixes[cat]) return String(categoryPrefixes[cat]).toUpperCase();
  const initials = cat.split(/\s+/).map(w => w.charAt(0)).join('').toUpperCase();
  return initials || 'ITM';
};

// Next master code for a category: prefix + (max numeric suffix among ALL
// existing items whose sku is exactly PREFIX-<digits>) + 1, zero-padded to 3.
export const nextItemCode = (items, category, categoryPrefixes) => {
  const prefix = codePrefixForCategory(category, categoryPrefixes);
  const re = new RegExp('^' + prefix + '-(\\d+)$');
  let max = 0;
  (items || []).forEach(it => {
    const m = re.exec(String(it?.sku || ''));
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  });
  return prefix + '-' + String(max + 1).padStart(3, '0');
};

// Sale-order line codes: one global running series ITEM-001, ITEM-002, …
export const formatLineCode = (n) => 'ITEM-' + String(n).padStart(3, '0');

export const parseLineCodeNumber = (code) => {
  const m = /^ITEM-(\d+)$/.exec(String(code || ''));
  return m ? (parseInt(m[1], 10) || 0) : 0;
};

// Highest line-code number already used anywhere in the given sale orders.
export const maxLineCodeNumber = (saleOrders) => {
  let max = 0;
  (saleOrders || []).forEach(o => (o.items || []).forEach(line => {
    max = Math.max(max, parseLineCodeNumber(line?.lineCode));
  }));
  return max;
};
