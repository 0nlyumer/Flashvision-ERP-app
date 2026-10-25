import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PrintSendModal from './PrintSendModal';
import { MARGIN_PRESETS, SCALE_MODES } from '../../utils/printDesign';

// --- Print Studio Shell (2026-10-24) ------------------------------------------
// The one frame for every print popup: a big CENTERED modal (~94vw x 92vh)
// with ALL controls inside its own frame — top toolbar (title, orientation,
// margin presets, Excel-style scaling, zoom), a settings column, the sheet
// preview area, and a bottom action bar (Save CSV / Save Image / Save PDF /
// SEND / Print / Close). Nothing floats at the screen edges.
// Print fidelity follows the paper-css sheet model: @page margin 0, the
// sheet itself carries the margins as padding, colors forced exact — so the
// browser's print output matches this preview.

export default function PrintStudioShell({
  containerId = 'fv-print-studio-container',
  onClose,
  title,
  subtitle,
  paperLabel,
  paperWidth,
  paperHeight,
  orientation,
  onOrientationChange,
  marginPreset,
  onMarginPresetChange,
  scaleMode,
  onScaleModeChange,
  onPrint,
  onExportCsv,
  onExportImage,
  onExportPdf,
  exporting = null,
  sendConfig = null, // { documentTitle, filenameBase, makeFile, csvAvailable }
  customizeActive = false,
  onToggleCustomize = null, // when provided, a "Customize" toolbar button toggles the settings panel
  settingsPanel = null,
  extraPrintCss = '',
  children
}) {
  const [sendOpen, setSendOpen] = useState(false);
  const [zoomFit, setZoomFit] = useState(true);
  const viewportRef = useRef(null);
  const pagesRef = useRef(null);
  const [zoom, setZoom] = useState(1);

  // Fit-width zoom for the on-screen preview only (print is unaffected).
  useEffect(() => {
    const compute = () => {
      if (!zoomFit || !viewportRef.current) { setZoom(1); return; }
      const mm = parseFloat(paperWidth);
      const pagePx = (paperWidth.includes('in') ? mm * 96 : mm * 3.7795275591);
      const avail = viewportRef.current.clientWidth - 48;
      if (pagePx > 0 && avail > 0) setZoom(Math.min(1, avail / pagePx));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [zoomFit, paperWidth, settingsPanel]);

  // Portalled to <body> (SalaryPrintStudio pattern): the print-isolation
  // CSS below hides every other body child, which only works when this
  // backdrop is itself a direct body child carrying the container id.
  const shell = (
    <div id={containerId} className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 md:p-4 font-sans">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { size: ${paperWidth} ${paperHeight} !important; margin: 0 !important; }
              body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; zoom: 1 !important; width: auto !important; height: auto !important; }
              body > *:not(#${containerId}) { display: none !important; }
              #${containerId}, #${containerId} * { visibility: visible !important; }
              #${containerId} {
                position: static !important; display: block !important;
                padding: 0 !important; margin: 0 !important; overflow: visible !important;
                background: #ffffff !important; height: auto !important; width: auto !important;
              }
              #${containerId} .fv-frame {
                width: auto !important; height: auto !important; max-width: none !important;
                border: none !important; box-shadow: none !important; border-radius: 0 !important;
                display: block !important; overflow: visible !important; background: #ffffff !important;
              }
              #${containerId} .fv-frame-body { display: block !important; overflow: visible !important; }
              #${containerId} .no-print { display: none !important; }
              #${containerId} .fv-pages-viewport { overflow: visible !important; display: block !important; padding: 0 !important; background: #ffffff !important; }
              #${containerId} .fv-pages-zoom { zoom: 1 !important; display: block !important; }
              .print-preview-page {
                box-shadow: none !important; border: none !important; margin: 0 !important;
                width: ${paperWidth} !important; height: ${paperHeight} !important;
                page-break-after: always !important; break-after: page !important;
                overflow: hidden !important;
              }
              .print-preview-page:last-child { page-break-after: auto !important; break-after: auto !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              ${extraPrintCss}
            }
          `
        }}
      />

      <div
        className="fv-frame bg-slate-100 dark:bg-slate-950 w-[94vw] h-[92vh] max-w-[1600px] rounded-3xl shadow-2xl border border-slate-300/60 dark:border-slate-800 overflow-hidden flex flex-col animate-fade-in"
      >
        {/* ===== TOP TOOLBAR (inside the frame) ===== */}
        <div className="no-print w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-5 py-3 flex flex-wrap items-center gap-3 shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">print</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight truncate">{title}</h2>
                {paperLabel && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-mono font-bold uppercase whitespace-nowrap">
                    {paperLabel}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* Orientation toggle */}
            {onOrientationChange && (
              <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" title="Orientation">
                <button
                  type="button"
                  onClick={() => onOrientationChange('portrait')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${orientation === 'portrait' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  <span className="material-symbols-outlined text-sm">smartphone</span> Portrait
                </button>
                <button
                  type="button"
                  onClick={() => onOrientationChange('landscape')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${orientation === 'landscape' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  <span className="material-symbols-outlined text-sm">tablet</span> Landscape
                </button>
              </div>
            )}

            {/* Margin presets */}
            {onMarginPresetChange && (
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Margins
                <select
                  value={marginPreset || 'default'}
                  onChange={(e) => onMarginPresetChange(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {Object.entries(MARGIN_PRESETS).map(([id, p]) => (
                    <option key={id} value={id}>{p.label}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Excel-style scaling */}
            {onScaleModeChange && (
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Scaling
                <select
                  value={scaleMode || 'fill'}
                  onChange={(e) => onScaleModeChange(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {SCALE_MODES.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>
            )}

            {/* Customize — toggles the settings panel (hidden by default) */}
            {onToggleCustomize && (
              <button
                type="button"
                onClick={onToggleCustomize}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all ${customizeActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                title="Show or hide the print settings panel"
              >
                <span className="material-symbols-outlined text-sm">settings</span>
                Customize
              </button>
            )}

            {/* Preview zoom */}
            <button
              type="button"
              onClick={() => setZoomFit((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
              title="Toggle fit-width preview zoom"
            >
              <span className="material-symbols-outlined text-sm">zoom_in</span>
              {zoomFit ? 'Fit Width' : '100%'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
              title="Close"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* ===== BODY: settings column + preview ===== */}
        <div className="fv-frame-body flex-1 w-full flex flex-col lg:flex-row overflow-hidden relative min-h-0">
          {settingsPanel}
          <div ref={viewportRef} className="fv-pages-viewport flex-1 bg-slate-300/70 dark:bg-slate-950/95 overflow-y-auto p-4 md:p-8 relative select-none min-w-0">
            <div ref={pagesRef} className="fv-pages-zoom flex flex-col gap-8 items-center w-full" style={{ zoom }}>
              {children}
            </div>
          </div>
        </div>

        {/* ===== BOTTOM ACTION BAR (inside the frame) ===== */}
        <div className="no-print w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 md:px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
          <span className="text-[10px] text-slate-400 hidden md:flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">info</span>
            For an exact match in Chrome print: Margins = None, Scale = 100%. (Colours print automatically.)
          </span>
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {onExportCsv && (
              <button
                type="button"
                onClick={onExportCsv}
                disabled={exporting !== null}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base text-emerald-500">table_view</span>
                Save CSV
              </button>
            )}
            {onExportImage && (
              <button
                type="button"
                onClick={onExportImage}
                disabled={exporting !== null}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base text-amber-500">image</span>
                Save Image
              </button>
            )}
            {onExportPdf && (
              <button
                type="button"
                onClick={onExportPdf}
                disabled={exporting !== null}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base text-red-500">picture_as_pdf</span>
                Save PDF
              </button>
            )}
            {sendConfig && (
              <button
                type="button"
                onClick={() => setSendOpen(true)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-sky-900/30 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">send</span>
                Send
              </button>
            )}
            {onPrint && (
              <button
                type="button"
                onClick={onPrint}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Print
              </button>
            )}
          </div>
        </div>
      </div>

      {sendConfig && (
        <PrintSendModal
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          documentTitle={sendConfig.documentTitle}
          filenameBase={sendConfig.filenameBase}
          makeFile={sendConfig.makeFile}
          csvAvailable={sendConfig.csvAvailable !== false}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(shell, document.body) : shell;
}
