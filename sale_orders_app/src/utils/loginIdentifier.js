// --- Login identifier resolution (username / email / mobile number) -------
// Omer's order (2026-10-25): sign-in accepts the username OR the account's
// mobile number (email keeps working — it always did). User records carry
// the number in their `phone` field; the stored convention (User Control)
// is the Pakistani mobile in international digits form, e.g. '923079418134'
// — country code 92, no '+', no leading 0, no separators.
//
// normalizePkMobile reduces any typed/stored value to that canonical form
// so '0307 9418134', '+92-307-9418134', '0092 307 9418134', '3079418134'
// and '923079418134' all compare equal. Anything that is not a plausible
// Pakistani mobile (including placeholders like the literal string 'Null',
// empty values and null) normalizes to null and can never match.

export function normalizePkMobile(value) {
  if (value === null || value === undefined) return null;
  let digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0092')) digits = digits.slice(2); // 0092… → 92…
  if (digits.startsWith('0')) digits = '92' + digits.slice(1); // 03… → 923…
  else if (digits.length === 10 && digits.startsWith('3')) digits = '92' + digits; // 3… → 923…
  return /^923\d{9}$/.test(digits) ? digits : null;
}

// Find the account for a login identifier. Username and email keep their
// exact historical behaviour (case-insensitive exact match, tried first);
// the mobile number is tried only when the identifier normalizes as a
// Pakistani mobile and the stored phone normalizes to the same value.
export function findUserByLoginIdentifier(users, identifier) {
  const id = String(identifier || '').trim();
  if (!id || !Array.isArray(users)) return null;
  const lower = id.toLowerCase();
  const byNameOrEmail = users.find((u) =>
    (u.username && u.username.toLowerCase() === lower) ||
    (u.email && u.email.toLowerCase() === lower)
  );
  if (byNameOrEmail) return byNameOrEmail;
  const phone = normalizePkMobile(id);
  if (!phone) return null;
  return users.find((u) => normalizePkMobile(u.phone) === phone) || null;
}
