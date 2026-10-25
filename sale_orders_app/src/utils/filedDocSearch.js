// filedDocSearch.js — in-file search for the Document Warehouse viewer
// (Files viewer polish, 2026-10-25).
//
// The search is scoped to the OPEN binder only. A document matches when
// the query appears in any of:
//   - its code / reference (docId, falling back to the attachment id),
//   - its title,
//   - its date — the stored display date, plus the filed date rendered as
//     ISO (2026-10-24), en-GB (24/10/2026) and long form (24 Oct 2026),
//   - its registry detail labels / values (kept from the original book
//     search, so field highlighting after a jump keeps working).

const normalize = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const filedDateForms = (doc) => {
  const forms = [];
  if (doc?.date) forms.push(String(doc.date));
  if (doc?.filedAt) {
    const parsed = new Date(doc.filedAt);
    if (!Number.isNaN(parsed.getTime())) {
      forms.push(parsed.toISOString().slice(0, 10)); // 2026-10-24
      forms.push(parsed.toLocaleDateString('en-GB')); // 24/10/2026
      forms.push(parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })); // 24 Oct 2026
    } else {
      forms.push(String(doc.filedAt));
    }
  }
  return forms;
};

/**
 * The lowercase searchable text of one filed document.
 */
export function filedDocumentSearchText(doc) {
  if (!doc || typeof doc !== 'object') return '';
  const parts = [
    doc.docId,
    doc.id,
    doc.title,
    ...filedDateForms(doc),
    ...(Array.isArray(doc.details)
      ? doc.details.flatMap((d) => [d?.label, d?.value])
      : []),
  ];
  return normalize(parts.filter((p) => p !== undefined && p !== null && p !== '').join(' '));
}

/**
 * Search one binder's documents. Returns [{ index, doc }] in filed order.
 * An exact substring match wins; a multi-word query also matches when
 * every word appears somewhere in the document's searchable text.
 */
export function searchFiledDocuments(documents, query) {
  const list = Array.isArray(documents) ? documents : [];
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(' ').filter(Boolean);
  const matches = [];
  list.forEach((doc, index) => {
    const haystack = filedDocumentSearchText(doc);
    if (!haystack) return;
    if (haystack.includes(q) || (tokens.length > 1 && tokens.every((t) => haystack.includes(t)))) {
      matches.push({ index, doc });
    }
  });
  return matches;
}
