// --- Type-wise pricing resolver (Item Rate Profile -> DC -> Sale Invoice) ---
// Omer's settled sales design: type-wise rates (A / A2 / B / Cut piece) are
// maintained ONLY in the Item Rate Profile as item.pricesByType. Goods leave
// solely through a Delivery Challan (DC) and the Sale Invoice (SI) is raised
// against that challan, so the rate resolved here at challan time is the rate
// the invoice carries. pricesByType values are stored as display strings
// (e.g. 'Rs. 500.00'), exactly like item.price, so every read goes through
// parsePriceValue.

// Parse a stored price (number, 'Rs. 500.00', '$ 10', '500') to a number.
// Returns 0 when nothing numeric can be read.
// NOTE: the naive strip-and-parseFloat used elsewhere in the app turns
// 'Rs. 500.00' into 0.5 (the '.' of "Rs." survives the strip and becomes the
// decimal point). The Item Rate Profile stores every type rate in exactly
// that 'Rs. X.XX' format, so this parser extracts the first real numeric
// token instead — 'Rs. 500.00' -> 500, 'Rs. 85,007.00' -> 85007, '$1.00' -> 1.
export const parsePriceValue = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const match = String(value).replace(/,/g, '').match(/[0-9]+(\.[0-9]+)?/);
  return match ? parseFloat(match[0]) : 0;
};

// The type rate from the Item Rate Profile for one stock/output type.
// Chain: pricesByType[type] -> pricesByType['Base Item'] -> null (no type rate set).
export const resolveTypeRate = (item, type) => {
  if (!item || !item.pricesByType) return null;
  const byType = parsePriceValue(item.pricesByType[type]);
  if (byType > 0) return byType;
  const base = parsePriceValue(item.pricesByType['Base Item']);
  if (base > 0) return base;
  return null;
};

// Rate for a Delivery Challan line. Chain (brief order):
//   1. Item Rate Profile type rate (resolveTypeRate: type -> 'Base Item')
//   2. the rate the line already carries (sale-order rate / picked item rate)
//   3. the item master's base price, parsed the same way SalesInvoice does
//   4. 0
// For an item with NO pricesByType this returns exactly what the challan
// used before this link existed (its carried rate, else the master price).
export const resolveDcLineRate = (item, type, existingRate) => {
  const typeRate = resolveTypeRate(item, type);
  if (typeRate !== null) return typeRate;
  const carried = parsePriceValue(existingRate);
  if (carried > 0) return carried;
  const master = parsePriceValue(item?.price);
  if (master > 0) return master;
  return 0;
};

// Rate for a Sale Invoice line built from a Delivery Challan line. Chain:
//   1. an explicit unitPrice already on the challan line (legacy behaviour)
//   2. the challan line's rate (di.price) — resolved at challan time from the
//      Item Rate Profile by type, and editable on the challan, so the invoice
//      carries the challan's type rate verbatim
//   3. the Item Rate Profile type rate for the line's stock type (covers
//      challans saved before DC lines carried a rate)
//   4. the pre-link fallback, mirroring the old SalesInvoice logic and its
//      defaults: master price from item.price (default 50 when unreadable;
//      '$'-prefixed master prices convert at 280 when billing in PKR);
//      12000 when the item cannot be matched at all. The only deliberate
//      difference from the old inline code is that the master price is read
//      through parsePriceValue, so an 'Rs. 500.00' master price yields 500
//      where the old strip-parse silently yielded 0.5.
export const resolveSalesLineRate = (dcLine, item, currencyCode) => {
  const explicit = parsePriceValue(dcLine?.unitPrice);
  if (explicit > 0) return explicit;

  const challanRate = parsePriceValue(dcLine?.price);
  if (challanRate > 0) return challanRate;

  const typeRate = resolveTypeRate(item, dcLine?.stockType);
  if (typeRate !== null) return typeRate;

  if (item) {
    const rawPrice = parsePriceValue(item.price) || 50;
    return (String(item.price ?? '').startsWith('$') && currencyCode === 'PKR')
      ? rawPrice * 280
      : rawPrice;
  }
  return 12000;
};
