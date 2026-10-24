// --- Salary Print Settings (app_config key 'salaryPrintSettings') ----------
// Print-studio settings for the Salary Generation statement: header/division
// title override, slogan, orientation, rows-per-page, signature blocks and
// the last-saved print column widths. Mirrors the Flash AM config pattern
// (flashAmConfig.js): a DEFAULT constant + a normalize function that
// deep-merges saved values over the defaults, so older/partial saved
// settings keep working. Persisted ONLY in app_config via AppContext
// (state key 'salary_print_settings') — never in the blob, never localStorage.

export const DEFAULT_SALARY_PRINT_SETTINGS = {
  // '' = automatic: the selected division's name, or the company name
  // (adminSetup.companyName) when printing All Divisions.
  headerTitle: '',
  slogan: 'Monthly Salary Statement',
  orientation: 'landscape', // Salary statements default to Landscape (Omer's spec)
  rowsPerPage: 25,
  marginPreset: 'default', // 'default' | 'minimum' | 'low' | 'custom' (print family, 2026-10-24)
  marginTop: '10mm',
  marginRight: '10mm',
  marginBottom: '10mm',
  marginLeft: '10mm',
  scaleMode: 'fill', // 'fill' | 'fit' | 'actual'
  signatureAlign: 'spread', // 'spread' | 'left' | 'center' | 'right'
  signatures: [
    { key: 'sig_prepared', label: 'Prepared By' },
    { key: 'sig_verified', label: 'Verified By' },
    { key: 'sig_approved', label: 'Approved By' }
  ],
  // Print column widths (px) keyed by Salary Generation column id. The
  // screen's column config stays the live editor; the widths saved here are
  // applied back onto the screen columns so the printed statement always
  // matches what was last saved from the print studio.
  columnWidths: {}
};

const toNum = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const toStr = (v, fallback) => (typeof v === 'string' ? v : fallback);

export function normalizeSalaryPrintSettings(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
  }
  if (!parsed || typeof parsed !== 'object') parsed = {};
  const d = DEFAULT_SALARY_PRINT_SETTINGS;

  const signatures = Array.isArray(parsed.signatures)
    ? parsed.signatures
        .filter((s) => s && typeof s === 'object')
        .map((s, i) => ({
          key: typeof s.key === 'string' && s.key ? s.key : `sig_${i + 1}`,
          label: toStr(s.label, '')
        }))
        .filter((s) => s.label.trim() !== '')
    : null;

  const columnWidths = {};
  if (parsed.columnWidths && typeof parsed.columnWidths === 'object') {
    Object.entries(parsed.columnWidths).forEach(([id, w]) => {
      const n = Number(w);
      if (Number.isFinite(n) && n > 0) columnWidths[id] = Math.round(n);
    });
  }

  return {
    headerTitle: toStr(parsed.headerTitle, d.headerTitle),
    slogan: toStr(parsed.slogan, d.slogan),
    orientation: parsed.orientation === 'portrait' ? 'portrait' : 'landscape',
    rowsPerPage: Math.min(200, Math.max(1, Math.round(toNum(parsed.rowsPerPage, d.rowsPerPage)))),
    marginPreset: ['default', 'minimum', 'low', 'custom'].includes(parsed.marginPreset) ? parsed.marginPreset : d.marginPreset,
    marginTop: toStr(parsed.marginTop, d.marginTop),
    marginRight: toStr(parsed.marginRight, d.marginRight),
    marginBottom: toStr(parsed.marginBottom, d.marginBottom),
    marginLeft: toStr(parsed.marginLeft, d.marginLeft),
    scaleMode: ['fill', 'fit', 'actual'].includes(parsed.scaleMode) ? parsed.scaleMode : d.scaleMode,
    signatureAlign: ['spread', 'left', 'center', 'right'].includes(parsed.signatureAlign)
      ? parsed.signatureAlign
      : d.signatureAlign,
    signatures: signatures && signatures.length > 0
      ? signatures
      : d.signatures.map((s) => ({ ...s })),
    columnWidths
  };
}

export function getInitialSalaryPrintSettings() {
  return normalizeSalaryPrintSettings(null);
}
