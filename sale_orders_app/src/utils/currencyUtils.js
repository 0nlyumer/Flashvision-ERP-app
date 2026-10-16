/**
 * Currency utility helpers for uniform PKR / Rs. formatting across FlashVision ERP.
 * Standard format: "Rs. X,XXX.XX" (always with a space between 'Rs.' and the amount).
 */

export const parseCurrencyNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

export const formatCurrencyPKR = (val) => {
  const num = parseCurrencyNumber(val);
  return `Rs. ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
