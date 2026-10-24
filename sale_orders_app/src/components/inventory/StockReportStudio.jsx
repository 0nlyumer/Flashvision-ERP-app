import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { exportDocumentToPdf, exportDocumentToImage } from '../../utils/printExportUtils';

/**
 * Stock Report Studio — preview popup for the FG Stock Report and the
 * Stock Transactions Report (InvLedger). Modelled on SalaryPrintStudio:
 * paginated A4 pages (.print-preview-page), Portrait/Landscape switch,
 * Print / Save PDF / Save Image (high quality) / Save CSV actions.
 *
 * The report arrives as a plain model so exports always match the screen:
 * {
 *   title, companyName, scopeLines: [], generatedAtLabel,
 *   columns: [{ key, label, numeric, width }],
 *   groups: [{ label, rows: [{ kind: 'data'|'subhead'|'subtotal'|'grand',
 *                              values: { colKey: string } }] }],
 *   footnotes: [], filenameBase, csvText
 * }
 * Value data is only ever present in the model when the generating user
 * holds the inventory/stockValue permission — nothing to hide here.
 */

const PAPER = {
  portrait: { width: '210mm', height: '297mm', rowsPerPage: 36 },
  landscape: { width: '297mm', height: '210mm', rowsPerPage: 25 },
};

export default function StockReportStudio({ isOpen, onClose, model }) {
  const [orientation, setOrientation] = useState('landscape');
  const [exporting, setExporting] = useState(null);
  const printContainerRef = useRef(null);

  const paper = PAPER[orientation];

  const pages = useMemo(() => {
    if (!model) return [];
    const flat = [];
    (model.groups || []).forEach((g) => {
      if (g.label) flat.push({ kind: 'grouphead', values: { __label: g.label } });
      (g.rows || []).forEach((r) => flat.push(r));
    });
    if (flat.length === 0) return [[]];
    const chunks = [];
    for (let i = 0; i < flat.length; i += paper.rowsPerPage) {
      chunks.push(flat.slice(i, i + paper.rowsPerPage));
    }
    return chunks;
  }, [model, paper.rowsPerPage]);

  if (!isOpen || !model) return null;

  const totalWidth = (model.columns || []).reduce((s, c) => s + (c.width || 100), 0) || 1;

  const handleExportCsv = () => {
    try {
      const blob = new Blob(['\ufeff' + (model.csvText || '')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${model.filenameBase}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('CSV export failed', e);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      await exportDocumentToPdf(printContainerRef.current, `${model.filenameBase}.pdf`, {
        paperSize: 'a4',
        orientation,
      });
    } catch (e) {
      console.error('PDF export failed', e);
    }
    setExporting(null);
  };

  const handleExportImage = async () => {
    setExporting('img');
    try {
      await exportDocumentToImage(printContainerRef.current, `${model.filenameBase}.png`);
    } catch (e) {
      console.error('Image export failed', e);
    }
    setExporting(null);
  };

  const cellStyle = (col, row) => {
    const base = {
      border: '1px solid #e5e7eb',
      padding: '4px 6px',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      textAlign: col.numeric ? 'right' : 'left',
    };
    if (row.kind === 'subtotal') return { ...base, fontWeight: 700, backgroundColor: '#eef2ff', borderTop: '2px solid #6366f1' };
    if (row.kind === 'grand') return { ...base, fontWeight: 800, backgroundColor: '#e0e7ff', borderTop: '2.5px solid #4338ca' };
    return base;
  };

  const studioContent = (
    <div id="fv-stock-report-container" className="fixed inset-0 z-[210] bg-slate-950/70 backdrop-blur-sm flex flex-col overflow-hidden animate-fade-in font-sans">
      {/* Print isolation CSS (SalaryPrintStudio pattern) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: ${paper.width} ${paper.height} !important; margin: 0 !important; }
              body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }
              body > *:not(#fv-stock-report-container) { display: none !important; }
              #fv-stock-report-container, #fv-stock-report-container * { visibility: visible !important; }
              #fv-stock-report-container {
                position: static !important; display: block !important;
                padding: 0 !important; margin: 0 !important; overflow: visible !important;
                background: #ffffff !important; height: auto !important;
              }
              #fv-stock-report-container .no-print { display: none !important; }
              #fv-stock-report-pages { overflow: visible !important; display: block !important; padding: 0 !important; background: #ffffff !important; }
              .stock-report-page {
                box-shadow: none !important; border: none !important; margin: 0 !important;
                width: ${paper.width} !important; height: ${paper.height} !important;
                page-break-after: always !important; break-after: page !important;
                overflow: hidden !important;
              }
              .stock-report-page:last-child { page-break-after: auto !important; break-after: auto !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
          `,
        }}
      />

      {/* TOP TOOLBAR */}
      <div className="no-print w-full bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">print</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">{model.title} — Report Studio</h2>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-mono font-bold uppercase">
                A4 {orientation}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Pages: <strong className="text-slate-800">{pages.length}</strong> • {model.generatedAtLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${orientation === 'portrait' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <span className="material-symbols-outlined text-sm">smartphone</span> Portrait
            </button>
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${orientation === 'landscape' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <span className="material-symbols-outlined text-sm">tablet</span> Landscape
            </button>
          </div>

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
            {exporting === 'pdf' ? 'Saving…' : 'Save PDF'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
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

      {/* PAGES */}
      <div id="fv-stock-report-pages" ref={printContainerRef} className="flex-1 w-full overflow-y-auto bg-slate-300/50 p-4 md:p-8 space-y-8">
        {pages.map((pageRows, pageIdx) => (
          <div
            key={pageIdx}
            className="stock-report-page print-preview-page mx-auto bg-white shadow-2xl flex flex-col"
            style={{ width: paper.width, minHeight: paper.height, padding: '10mm', color: '#111827', fontFamily: 'Arial, sans-serif' }}
          >
            {pageIdx === 0 ? (
              <div style={{ borderBottom: '2.5px solid #4338ca', paddingBottom: '10px', marginBottom: '12px' }}>
                <h1 style={{ margin: 0, fontSize: '21px', fontWeight: 900, color: '#1e1b4b', letterSpacing: '-0.3px', textTransform: 'uppercase', textAlign: 'center' }}>
                  {model.companyName}
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 700, color: '#374151', textAlign: 'center' }}>
                  {model.title}
                </p>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#374151', textAlign: 'center' }}>
                  {(model.scopeLines || []).map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                  <div>{model.generatedAtLabel}</div>
                </div>
              </div>
            ) : (
              <div style={{ borderBottom: '1.5px solid #4338ca', paddingBottom: '6px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#374151' }}>
                <span style={{ fontWeight: 700 }}>{model.companyName} — {model.title}</span>
                <span>Page {pageIdx + 1} of {pages.length}</span>
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10.5px' }}>
              <colgroup>
                {(model.columns || []).map((col) => (
                  <col key={col.key} style={{ width: `${(((col.width || 100) / totalWidth) * 100).toFixed(2)}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr style={{ backgroundColor: '#eef2ff' }}>
                  {(model.columns || []).map((col) => (
                    <th
                      key={col.key}
                      style={{ border: '1px solid #c7d2fe', padding: '5px 6px', textTransform: 'uppercase', fontSize: '9px', fontWeight: 700, textAlign: col.numeric ? 'right' : 'left', overflow: 'hidden' }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={(model.columns || []).length} style={{ border: '1px solid #e5e7eb', padding: '16px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
                      No records in this report.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row, rIdx) => {
                    if (row.kind === 'grouphead') {
                      return (
                        <tr key={rIdx} style={{ backgroundColor: '#312e81' }}>
                          <td colSpan={(model.columns || []).length} style={{ padding: '5px 6px', color: '#ffffff', fontWeight: 800, fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            {row.values.__label}
                          </td>
                        </tr>
                      );
                    }
                    if (row.kind === 'subhead') {
                      return (
                        <tr key={rIdx} style={{ backgroundColor: '#e0e7ff' }}>
                          <td colSpan={(model.columns || []).length} style={{ padding: '4px 6px', fontWeight: 700, fontSize: '10.5px', color: '#1e1b4b' }}>
                            {row.values.__label}
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={rIdx} style={{ backgroundColor: row.kind === 'data' && rIdx % 2 === 1 ? '#f9fafb' : '#ffffff' }}>
                        {(model.columns || []).map((col) => (
                          <td key={col.key} style={cellStyle(col, row)}>
                            {row.values[col.key] ?? ''}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {pageIdx === pages.length - 1 && (model.footnotes || []).length > 0 && (
              <div style={{ marginTop: '12px', fontSize: '10px', color: '#6b7280' }}>
                {(model.footnotes || []).map((f, i) => (
                  <div key={i}>* {f}</div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#9ca3af' }}>
              <span>Powered by FlashVision ERP</span>
              <span>Page {pageIdx + 1} of {pages.length}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return createPortal(studioContent, document.body);
}
