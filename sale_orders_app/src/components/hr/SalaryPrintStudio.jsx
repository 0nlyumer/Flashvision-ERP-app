import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { exportDocumentToPdf, exportDocumentToImage, exportDocumentToCsv } from '../../utils/printExportUtils';
import { normalizeSalaryPrintSettings } from '../../utils/salaryPrintSettings';

// Salary Generation — Print Studio (HR Prints phase)
// The big preview popup in the UniversalPrintStudioModal pattern (top
// toolbar + gear-opened settings panel + paginated A4 preview sheets),
// rendered in the ERP's light theme. The statement is built from the LIVE
// Salary Generation screen state: exactly the currently VISIBLE columns, in
// screen order, at their screen widths; totals mirror the screen's footer
// totals logic. Settings (header text, slogan, orientation, rows-per-page,
// signatures, column widths) persist to the database via AppContext
// (app_config key 'salaryPrintSettings') — never localStorage.

const safeNum = (val) => {
  if (val === null || val === undefined) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

const safeMoney = (val, decimals = 2) => {
  const n = safeNum(val);
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const PAPER = {
  portrait: { width: '210mm', height: '297mm' },
  landscape: { width: '297mm', height: '210mm' }
};

export default function SalaryPrintStudio({
  isOpen,
  onClose,
  initialSettingsOpen = false,
  columns = [],          // visibleColumns from the Salary Generation screen
  rows = [],             // filteredList from the screen (what is on screen prints)
  divisionName = '',     // resolved header title (division name / company name)
  divisionPrintName = '', // selected division's "Full Name (for prints)" (Fix 4/6, Omer 2026-10-24)
  periodLabel = '',
  periodKey = '',
  currencySymbol = 'Rs.',
  settings,              // normalized salary print settings (from AppContext state)
  onSaveSettings,        // (nextSettings) => void — persists via setCollection
  onColumnWidthChange,   // (colId, widthPx) => void — writes through to screen columns
  onNotify               // (msg) => void — screen toast
}) {
  const currSym = currencySymbol || 'Rs.';
  const printContainerRef = useRef(null);
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);
  const [exporting, setExporting] = useState(null);
  const [draft, setDraft] = useState(() => normalizeSalaryPrintSettings(settings));

  // Re-seed the draft every time the popup opens so it always starts from
  // the persisted settings + the screen's current column widths.
  useEffect(() => {
    if (isOpen) {
      setSettingsOpen(initialSettingsOpen);
      const base = normalizeSalaryPrintSettings(settings);
      const widths = { ...(base.columnWidths || {}) };
      columns.forEach((c) => { widths[c.id] = c.width; });
      setDraft({ ...base, columnWidths: widths });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const orientation = draft.orientation === 'portrait' ? 'portrait' : 'landscape';
  const paper = PAPER[orientation];
  const rowsPerPage = Math.max(1, Math.round(safeNum(draft.rowsPerPage)) || 25);

  const pages = useMemo(() => {
    if (!rows || rows.length === 0) return [[]];
    const chunks = [];
    for (let i = 0; i < rows.length; i += rowsPerPage) {
      chunks.push(rows.slice(i, i + rowsPerPage));
    }
    return chunks;
  }, [rows, rowsPerPage]);

  // Totals — mirrors the Salary Generation screen's footer totals exactly:
  // per numeric column a straight sum over the printed rows; Paid Days
  // summed as days; OT/Late hours at 1 decimal; money at 2 decimals.
  const totals = useMemo(() => {
    const t = {};
    columns.forEach((col) => {
      if (col.numeric) t[col.id] = rows.reduce((acc, r) => acc + safeNum(r[col.id]), 0);
    });
    return t;
  }, [columns, rows]);

  const totalWidth = useMemo(
    () => columns.reduce((acc, c) => acc + (safeNum(draft.columnWidths?.[c.id]) || c.width || 100), 0),
    [columns, draft.columnWidths]
  );

  const formatCell = (col, row) => {
    if (col.id === 'payableDays') return `${row.payableDays ?? row.workedDays ?? 0} d`;
    if (col.numeric) {
      if (col.id === 'otHours' || col.id === 'lateComingHours') return row[col.id] ?? 0;
      return `${currSym} ${safeMoney(row[col.id])}`;
    }
    const v = row[col.id];
    return v === undefined || v === null || v === '' ? '—' : String(v);
  };

  const formatTotal = (col) => {
    if (col.id === 'payableDays') return `${totals[col.id]} d`;
    if (col.id === 'otHours' || col.id === 'lateComingHours') return safeNum(totals[col.id]).toFixed(1);
    return `${currSym} ${safeMoney(totals[col.id])}`;
  };

  const alignClass = (col) => (col.align === 'center' ? 'text-center' : col.numeric ? 'text-right' : 'text-left');

  const sigJustify = { spread: 'justify-between', left: 'justify-start', center: 'justify-center', right: 'justify-end' }[draft.signatureAlign] || 'justify-between';

  const filenameBase = `Salary_Statement_${periodKey || 'period'}_${(divisionName || 'All').replace(/[^\w]+/g, '_')}`;

  // --- Settings draft helpers -------------------------------------------------
  const patchDraft = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const handleWidthChange = (colId, rawVal) => {
    const w = Math.max(50, Math.min(500, Math.round(safeNum(rawVal)) || 50));
    setDraft((prev) => ({ ...prev, columnWidths: { ...(prev.columnWidths || {}), [colId]: w } }));
    if (onColumnWidthChange) onColumnWidthChange(colId, w);
  };

  const updateSignature = (idx, label) => {
    setDraft((prev) => {
      const sigs = [...(prev.signatures || [])];
      sigs[idx] = { ...sigs[idx], label };
      return { ...prev, signatures: sigs };
    });
  };

  const addSignature = () => {
    setDraft((prev) => ({
      ...prev,
      signatures: [...(prev.signatures || []), { key: `sig_${Date.now().toString().slice(-4)}`, label: 'New Signature' }]
    }));
  };

  const removeSignature = (idx) => {
    setDraft((prev) => {
      const sigs = [...(prev.signatures || [])];
      sigs.splice(idx, 1);
      return { ...prev, signatures: sigs };
    });
  };

  const handleSaveSettings = () => {
    const next = normalizeSalaryPrintSettings(draft);
    if (onSaveSettings) onSaveSettings(next);
    setDraft(next);
    if (onNotify) onNotify('✅ Salary print settings saved to database.');
  };

  // --- Exports ---------------------------------------------------------------
  const handleExportCsv = () => {
    if (rows.length === 0) { if (onNotify) onNotify('⚠️ No records to export in CSV.'); return; }
    setExporting('csv');
    const csvCols = columns.map((c) => ({ key: c.id, label: c.label }));
    const totalsRow = {};
    columns.forEach((col, i) => {
      if (i === 0) totalsRow[col.id] = 'TOTALS';
      else if (col.numeric) totalsRow[col.id] = col.id === 'payableDays' || col.id === 'otHours' || col.id === 'lateComingHours' ? safeNum(totals[col.id]).toFixed(1) : safeNum(totals[col.id]).toFixed(2);
      else totalsRow[col.id] = '';
    });
    const ok = exportDocumentToCsv(csvCols, [...rows, totalsRow], `${filenameBase}.csv`);
    if (onNotify) onNotify(ok ? `✅ CSV file saved: ${filenameBase}.csv` : 'Failed to export CSV.');
    setExporting(null);
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const ok = await exportDocumentToPdf(printContainerRef.current, `${filenameBase}.pdf`, { paperSize: 'a4', orientation });
      if (onNotify) onNotify(ok ? `✅ PDF successfully saved: ${filenameBase}.pdf` : 'Failed to export PDF.');
    } catch (e) {
      if (onNotify) onNotify('Failed to export PDF.');
    }
    setExporting(null);
  };

  const handleExportImage = async () => {
    setExporting('img');
    try {
      const ok = await exportDocumentToImage(printContainerRef.current, `${filenameBase}.png`);
      if (onNotify) onNotify(ok ? `✅ Image successfully saved: ${filenameBase}.png` : 'Failed to export image.');
    } catch (e) {
      if (onNotify) onNotify('Failed to export image.');
    }
    setExporting(null);
  };

  if (!isOpen) return null;

  // Rendered through a portal to <body> (see the return at the bottom):
  // inside the HR page tree an animated ancestor becomes the containing
  // block for `fixed`, which pushed this overlay against the left edge,
  // clipped behind the sidebar. Same pattern as HRPayslipModal.
  const studioContent = (
    <div id="fv-salary-print-container" className="fixed inset-0 z-[210] bg-slate-950/70 backdrop-blur-sm flex flex-col overflow-hidden animate-fade-in font-sans">
      {/* Print isolation CSS (UniversalPrintStudioModal pattern) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: ${paper.width} ${paper.height} !important; margin: 0 !important; }
              body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
              body > *:not(#fv-salary-print-container) { display: none !important; }
              #fv-salary-print-container, #fv-salary-print-container * { visibility: visible !important; }
              #fv-salary-print-container {
                position: static !important; display: block !important;
                padding: 0 !important; margin: 0 !important; overflow: visible !important;
                background: #ffffff !important; height: auto !important;
              }
              #fv-salary-print-container .no-print { display: none !important; }
              #fv-salary-print-pages { overflow: visible !important; display: block !important; padding: 0 !important; background: #ffffff !important; }
              .salary-print-page {
                box-shadow: none !important; border: none !important; margin: 0 !important;
                width: ${paper.width} !important; height: ${paper.height} !important;
                page-break-after: always !important; break-after: page !important;
                overflow: hidden !important;
              }
              .salary-print-page:last-child { page-break-after: auto !important; break-after: auto !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          `
        }}
      />

      {/* TOP TOOLBAR (light) */}
      <div className="no-print w-full bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">print</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">Salary Statement — Print Studio</h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-mono font-bold uppercase">
                A4 {orientation}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {divisionName} • {periodLabel} • Rows: <strong className="text-slate-800">{rows.length}</strong> • Pages: <strong className="text-slate-800">{pages.length}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Orientation switch */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => patchDraft({ orientation: 'portrait' })}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${orientation === 'portrait' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <span className="material-symbols-outlined text-sm">smartphone</span> Portrait
            </button>
            <button
              type="button"
              onClick={() => patchDraft({ orientation: 'landscape' })}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${orientation === 'landscape' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <span className="material-symbols-outlined text-sm">tablet</span> Landscape
            </button>
          </div>

          {/* Gear — this print's settings */}
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${settingsOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}
            title="Print settings for this statement"
          >
            <span className="material-symbols-outlined text-base">settings</span>
            Settings
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting !== null}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base text-emerald-500">table_view</span>
            Save CSV
          </button>

          <button
            type="button"
            onClick={handleExportImage}
            disabled={exporting !== null}
            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base text-amber-500">image</span>
            Save Image
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting !== null}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base text-red-500">picture_as_pdf</span>
            Save PDF
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">print</span>
            Print
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-200 transition-all ml-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </div>

      {/* BODY: settings panel + preview */}
      <div className="flex-1 w-full flex flex-col lg:flex-row overflow-hidden relative">
        {/* SETTINGS PANEL (gear) */}
        {settingsOpen && (
          <div className="no-print w-full lg:w-[360px] bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto shadow-xl z-10 p-4 space-y-5 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-blue-600">tune</span>
                Salary Print Settings
              </h3>
              <button type="button" onClick={() => setSettingsOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Header */}
            <div className="space-y-2.5">
              <p className="font-black text-[10px] uppercase tracking-wider text-slate-400">Header</p>
              <label className="block">
                <span className="font-semibold text-slate-600">Header / Division Name Text</span>
                <input
                  type="text"
                  value={draft.headerTitle}
                  onChange={(e) => patchDraft({ headerTitle: e.target.value })}
                  placeholder={divisionPrintName || divisionName}
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs font-medium"
                />
                <span className="text-[10px] text-slate-400">Leave blank for automatic: selected division's Full Name (for prints) — division name when unset (company name for All Divisions).</span>
              </label>
              <label className="block">
                <span className="font-semibold text-slate-600">Slogan Line</span>
                <input
                  type="text"
                  value={draft.slogan}
                  onChange={(e) => patchDraft({ slogan: e.target.value })}
                  placeholder="Monthly Salary Statement"
                  className="mt-1 w-full h-9 px-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs font-medium"
                />
              </label>
            </div>

            {/* Page */}
            <div className="space-y-2.5">
              <p className="font-black text-[10px] uppercase tracking-wider text-slate-400">Page & Pagination</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="font-semibold text-slate-600">Orientation</span>
                  <select
                    value={orientation}
                    onChange={(e) => patchDraft({ orientation: e.target.value })}
                    className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs font-medium cursor-pointer"
                  >
                    <option value="landscape">Landscape</option>
                    <option value="portrait">Portrait</option>
                  </select>
                </label>
                <label className="block">
                  <span className="font-semibold text-slate-600">Rows Per Page</span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={draft.rowsPerPage}
                    onChange={(e) => patchDraft({ rowsPerPage: e.target.value })}
                    className="mt-1 w-full h-9 px-3 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs font-medium"
                  />
                </label>
              </div>
            </div>

            {/* Column widths */}
            <div className="space-y-2">
              <p className="font-black text-[10px] uppercase tracking-wider text-slate-400">Column Widths (px) — visible columns only</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {columns.map((col) => (
                  <div key={col.id} className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-slate-600">{col.label}</span>
                    <input
                      type="number"
                      min={50}
                      max={500}
                      value={safeNum(draft.columnWidths?.[col.id]) || col.width}
                      onChange={(e) => handleWidthChange(col.id, e.target.value)}
                      className="w-20 h-8 px-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs font-medium text-right"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">Width changes also update the Salary Generation table live.</p>
            </div>

            {/* Signatures */}
            <div className="space-y-2.5">
              <p className="font-black text-[10px] uppercase tracking-wider text-slate-400">Signatures</p>
              <label className="block">
                <span className="font-semibold text-slate-600">Position / Alignment</span>
                <select
                  value={draft.signatureAlign}
                  onChange={(e) => patchDraft({ signatureAlign: e.target.value })}
                  className="mt-1 w-full h-9 px-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs font-medium cursor-pointer"
                >
                  <option value="spread">Spread across page</option>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <div className="space-y-1.5">
                {(draft.signatures || []).map((sig, idx) => (
                  <div key={sig.key || idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sig.label}
                      onChange={(e) => updateSignature(idx, e.target.value)}
                      className="flex-1 h-8 px-2 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs font-medium"
                    />
                    <button type="button" onClick={() => removeSignature(idx)} className="text-slate-400 hover:text-red-500 cursor-pointer" title="Remove signature">
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSignature}
                  className="text-blue-600 font-bold text-[11px] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">add</span> Add Signature
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">save</span>
                Save Settings to Database
              </button>
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">Saved in the database — survives reload and follows your account.</p>
            </div>
          </div>
        )}

        {/* PREVIEW */}
        <div id="fv-salary-print-pages" ref={printContainerRef} className="flex-1 min-w-0 overflow-y-auto bg-slate-300/50 p-4 md:p-8 space-y-8">
          {pages.map((pageRows, pageIdx) => {
            const isLastPage = pageIdx === pages.length - 1;
            const pageStartIndex = pageIdx * rowsPerPage;
            return (
              <div
                key={pageIdx}
                className="salary-print-page print-preview-page mx-auto bg-white shadow-2xl flex flex-col"
                style={{ width: paper.width, minHeight: paper.height, padding: '10mm', color: '#111827', fontFamily: 'Arial, sans-serif' }}
              >
                {/* Header (first page only) */}
                {pageIdx === 0 && (
                  <div style={{ borderBottom: '2.5px solid #2563eb', paddingBottom: '10px', marginBottom: '12px' }}>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#1e3a8a', letterSpacing: '-0.3px', textTransform: 'uppercase', textAlign: 'center' }}>
                      {draft.headerTitle?.trim() ? draft.headerTitle : (divisionPrintName || divisionName)}
                    </h1>
                    {/* Audit-report line (Omer, 2026-10-24 — his printed-sheet
                        reference): DIVISION wording, per his order. */}
                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', fontWeight: 700, color: '#374151', textAlign: 'center', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                      Monthly Salary Audit Report - {periodLabel} - Division: {divisionName}
                    </p>
                    {draft.slogan?.trim() && (
                      <p style={{ margin: '3px 0 0 0', fontSize: '12px', fontWeight: 600, color: '#6b7280', textAlign: 'center', fontStyle: 'italic' }}>
                        {draft.slogan}
                      </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#374151' }}>
                      <span><strong>Month:</strong> {periodLabel}</span>
                      <span><strong>Division:</strong> {divisionName}</span>
                      <span><strong>Date:</strong> {new Date().toLocaleDateString()}</span>
                    </div>
                  </div>
                )}

                {/* Statement table — exactly the screen's visible columns */}
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10.5px' }}>
                  <colgroup>
                    {columns.map((col) => (
                      <col key={col.id} style={{ width: `${(((safeNum(draft.columnWidths?.[col.id]) || col.width || 100) / (totalWidth || 1)) * 100).toFixed(2)}%` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: '#f3f4f6' }}>
                      {columns.map((col) => (
                        <th key={col.id} className={alignClass(col)} style={{ border: '1px solid #d1d5db', padding: '5px 6px', textTransform: 'uppercase', fontSize: '9px', fontWeight: 700, overflow: 'hidden' }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} style={{ border: '1px solid #e5e7eb', padding: '16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
                          No payroll records to print.
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, rIdx) => (
                        <tr key={row.employeeId || pageStartIndex + rIdx} style={{ backgroundColor: rIdx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                          {columns.map((col) => (
                            <td
                              key={col.id}
                              className={alignClass(col)}
                              style={{
                                border: '1px solid #e5e7eb',
                                padding: '4px 6px',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                fontWeight: col.id === 'employeeName' || col.id === 'netSalary' ? 700 : 400,
                                color: col.id === 'netSalary' ? '#1d4ed8' : '#111827'
                              }}
                            >
                              {formatCell(col, row)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {/* Totals row — last page only, mirrors the screen footer */}
                  {isLastPage && rows.length > 0 && (
                    <tfoot>
                      <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 800 }}>
                        {columns.map((col, i) => (
                          <td key={col.id} className={alignClass(col)} style={{ border: '1px solid #d1d5db', padding: '5px 6px', color: col.id === 'netSalary' ? '#1d4ed8' : '#111827' }}>
                            {i === 0 ? 'Totals:' : col.numeric ? formatTotal(col) : ''}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>

                {/* Signatures (last page) */}
                {isLastPage && (draft.signatures || []).length > 0 && (
                  <div className={`mt-auto flex ${sigJustify} gap-10`} style={{ paddingTop: '28px' }}>
                    {draft.signatures.map((sig) => (
                      <div key={sig.key} style={{ width: '170px', textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #6b7280', paddingTop: '5px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#374151' }}>
                          {sig.label}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Page footer */}
                <div className="flex justify-between items-center" style={{ marginTop: isLastPage ? '10px' : 'auto', paddingTop: '6px', borderTop: '1px solid #e5e7eb', fontSize: '8px', color: '#9ca3af' }}>
                  <span>Powered by FlashVision ERP</span>
                  <span>Page {pageIdx + 1} of {pages.length}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(studioContent, document.body) : studioContent;
}
