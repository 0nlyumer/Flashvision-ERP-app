import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../utils/supabaseClient';
import {
  DEFAULT_DOCUMENT_SCHEMAS,
  DEFAULT_LAYOUT_SETTINGS,
  SYSTEM_DOCUMENTS,
  getMockPreviewData,
  getSampleRecordFromState
} from '../../utils/printSchemaRegistry';
import { getDefaultThemeForDoc } from '../../utils/printThemeEngine';
import UnifiedPrintDocument, { PAPER_DIMENSIONS } from '../print/UnifiedPrintDocument';
import {
  exportDocumentToPdf,
  exportDocumentToImage,
  exportDocumentToCsv
} from '../../utils/printExportUtils';

/**
 * UniversalPrintPreviewModal — The Single Universal Print Entry Flow
 * 
 * Round 3 Owner Specifications:
 * 1. Opened by every Print button across modules.
 * 2. Automatically loads and applies the saved layout/theme from Print Settings.
 * 3. Shows full, readable preview of the document (A4, scaled to fit, with page navigation).
 * 4. Per-print Orientation Switcher: Portrait / Landscape toggle that immediately re-renders
 *    for this print only without mutating saved configuration.
 * 5. Export buttons: Print (native dialog), Download PDF, Download PNG/Image, Export CSV.
 *    All exports strictly reflect the current preview & chosen orientation.
 * 6. Never triggers native print dialog automatically on open.
 */
export default function UniversalPrintPreviewModal({
  isOpen,
  onClose,
  documentType = 'sale_order',
  documentData = null,
  documentTitle = null,
  companyInfo: customCompanyInfo = null
}) {
  const { state } = useApp() || {};
  const previewContainerRef = useRef(null);

  // Per-print orientation override (local state, does not overwrite saved setting)
  const [orientationOverride, setOrientationOverride] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [exporting, setExporting] = useState(null); // 'pdf' | 'img' | 'csv' | null
  const [loadedLayout, setLoadedLayout] = useState(null);

  // Company Global Metadata
  const companyName = state?.adminSetup?.companyName || 'FLASHVISION LOGISTICS & ENTERPRISE ERP';
  const companyLogo = state?.adminSetup?.logo || state?.adminSetup?.logoUrl || '';
  const companyAddress = state?.adminSetup?.address || 'Plot 42-B, Industrial Zone Phase III, Karachi, Pakistan';
  const companyPhone = state?.adminSetup?.phone || '+92-21-34567890';
  const companyEmail = state?.adminSetup?.email || 'operations@flashvision.com';
  const taxId = state?.adminSetup?.taxId || 'NTN: 8923410-7 • STRN: 3277876123456';

  const companyInfo = useMemo(() => {
    if (customCompanyInfo) return customCompanyInfo;
    return {
      companyName,
      logoUrl: companyLogo,
      address: companyAddress,
      phone: companyPhone,
      email: companyEmail,
      taxId
    };
  }, [customCompanyInfo, companyName, companyLogo, companyAddress, companyPhone, companyEmail, taxId]);

  // Document metadata
  const docMeta = useMemo(() => {
    return SYSTEM_DOCUMENTS.find(d => d.id === documentType) || {
      id: documentType,
      name: documentTitle || 'ERP Document',
      code: 'DOC'
    };
  }, [documentType, documentTitle]);

  // Load Saved Layout Configuration for this Document Type
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const defaultSchema = DEFAULT_DOCUMENT_SCHEMAS[documentType] || DEFAULT_LAYOUT_SETTINGS;
    const defaultTheme = getDefaultThemeForDoc(documentType);

    // 1. LocalStorage
    const localSaved = (() => {
      try {
        const item = localStorage.getItem(`fv_print_layout_${documentType}`);
        return item ? JSON.parse(item) : null;
      } catch (e) {
        return null;
      }
    })();

    // 2. AppContext State
    const stateLayout = state?.adminSetup?.printSettings?.documentLayouts?.[documentType];

    // Merge baseline
    const merged = {
      ...DEFAULT_LAYOUT_SETTINGS,
      ...defaultSchema,
      activeTheme: defaultTheme,
      firstPageRows: defaultSchema.firstPageRows || DEFAULT_LAYOUT_SETTINGS.firstPageRows || 20,
      continuationPageRows: defaultSchema.continuationPageRows || DEFAULT_LAYOUT_SETTINGS.continuationPageRows || 25,
      ...(stateLayout || {}),
      ...(localSaved || {})
    };

    setLoadedLayout(merged);
    setOrientationOverride(merged.orientation || 'portrait');

    // 3. Async fetch from Supabase to ensure freshest configuration
    const fetchRemote = async () => {
      try {
        const { data, error } = await supabase
          .from('print_layout_settings')
          .select('active_theme_id, layout_config')
          .eq('tenant_id', 'default_tenant')
          .eq('document_type', documentType)
          .single();

        if (!error && data && data.layout_config && isMounted) {
          const remoteConfig = {
            ...merged,
            ...data.layout_config,
            activeTheme: data.active_theme_id || data.layout_config.activeTheme || merged.activeTheme
          };
          setLoadedLayout(remoteConfig);
          setOrientationOverride(remoteConfig.orientation || 'portrait');
        }
      } catch (err) {
        // Silently use cached/local layout
      }
    };

    fetchRemote();

    return () => {
      isMounted = false;
    };
  }, [isOpen, documentType, state?.adminSetup?.printSettings]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Resolved record to print
  const resolvedRecord = useMemo(() => {
    if (documentData && typeof documentData === 'object' && Object.keys(documentData).length > 0) {
      return documentData;
    }
    const fromState = getSampleRecordFromState ? getSampleRecordFromState(documentType, state) : null;
    if (fromState) return fromState;
    return getMockPreviewData(documentType);
  }, [documentData, documentType, state]);

  // Active Layout with per-print orientation override applied
  const effectiveLayout = useMemo(() => {
    const base = loadedLayout || DEFAULT_DOCUMENT_SCHEMAS[documentType] || DEFAULT_LAYOUT_SETTINGS;
    return {
      ...base,
      orientation: orientationOverride || base.orientation || 'portrait',
      firstPageRows: Math.max(1, parseInt(base.firstPageRows, 10) || 20),
      continuationPageRows: Math.max(1, parseInt(base.continuationPageRows, 10) || 25)
    };
  }, [loadedLayout, documentType, orientationOverride]);

  // Calculate total pages for navigation
  const lineItems = useMemo(() => {
    const rec = resolvedRecord || {};
    return Array.isArray(rec.items)
      ? rec.items
      : Array.isArray(rec.lineItems)
      ? rec.lineItems
      : Array.isArray(rec.rows)
      ? rec.rows
      : [];
  }, [resolvedRecord]);

  const computedPageCount = useMemo(() => {
    if (lineItems.length === 0) return 1;
    const firstLimit = effectiveLayout.firstPageRows;
    const contLimit = effectiveLayout.continuationPageRows;
    if (lineItems.length <= firstLimit) return 1;
    const remaining = lineItems.length - firstLimit;
    return 1 + Math.ceil(remaining / contLimit);
  }, [lineItems.length, effectiveLayout.firstPageRows, effectiveLayout.continuationPageRows]);

  // Reset page index if orientation or line items change
  useEffect(() => {
    if (currentPageIndex >= computedPageCount) {
      setCurrentPageIndex(Math.max(0, computedPageCount - 1));
    }
  }, [computedPageCount, currentPageIndex]);

  // Scroll target page into view when currentPageIndex changes
  useEffect(() => {
    if (!previewContainerRef.current) return;
    const pages = previewContainerRef.current.querySelectorAll('.print-preview-page');
    if (pages[currentPageIndex]) {
      pages[currentPageIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentPageIndex]);

  if (!isOpen) return null;

  // Paper details
  const paperFormat = effectiveLayout.paperSize || 'A4';
  const paperSpec = PAPER_DIMENSIONS[paperFormat] || PAPER_DIMENSIONS.A4;
  const paperWidth = effectiveLayout.orientation === 'landscape' ? paperSpec.minHeight : paperSpec.width;
  const paperHeight = effectiveLayout.orientation === 'landscape' ? paperSpec.width : paperSpec.minHeight;

  // Handlers
  const handleToggleOrientation = (orient) => {
    setOrientationOverride(orient);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    if (!previewContainerRef.current) return;
    setExporting('pdf');
    try {
      const filename = `${(documentTitle || docMeta.name).replace(/[^a-zA-Z0-9_-]/g, '_')}_${effectiveLayout.orientation.toUpperCase()}.pdf`;
      await exportDocumentToPdf(previewContainerRef.current, filename, {
        paperSize: effectiveLayout.paperSize || 'A4',
        orientation: effectiveLayout.orientation
      });
    } catch (e) {
      console.error('PDF export error:', e);
    } finally {
      setExporting(null);
    }
  };

  const handleExportImage = async () => {
    if (!previewContainerRef.current) return;
    setExporting('img');
    try {
      const filename = `${(documentTitle || docMeta.name).replace(/[^a-zA-Z0-9_-]/g, '_')}_${effectiveLayout.orientation.toUpperCase()}.png`;
      await exportDocumentToImage(previewContainerRef.current, filename);
    } catch (e) {
      console.error('Image export error:', e);
    } finally {
      setExporting(null);
    }
  };

  const handleExportCsv = () => {
    setExporting('csv');
    try {
      const activeCols = (effectiveLayout.gridColumns || []).filter(c => c.enabled !== false);
      const filename = `${(documentTitle || docMeta.name).replace(/[^a-zA-Z0-9_-]/g, '_')}_DATA.csv`;
      exportDocumentToCsv(activeCols, lineItems, filename);
    } catch (e) {
      console.error('CSV export error:', e);
    } finally {
      setExporting(null);
    }
  };

  return createPortal(
    <div
      id="universal-print-preview-modal"
      className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex flex-col overflow-hidden text-slate-100 font-sans animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="universal-preview-title"
    >
      {/* Dynamic print-specific styles ensuring only document is printed */}
      <style>{`
        @media print {
          body, html, #root {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            overflow: visible !important;
          }
          #universal-print-preview-modal {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            overflow: visible !important;
            z-index: 999999 !important;
          }
          #universal-print-preview-modal .no-print,
          #universal-print-preview-modal header,
          #universal-print-preview-modal .preview-controls-bar {
            display: none !important;
          }
          #universal-print-preview-modal .unified-print-container {
            transform: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            visibility: visible !important;
          }
          #universal-print-preview-modal .unified-print-container * {
            visibility: visible !important;
          }
          .print-preview-page {
            box-shadow: none !important;
            border: none !important;
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* TOP HEADER BAR */}
      <header className="no-print bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">print</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="universal-preview-title" className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {documentTitle || docMeta.name}
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {docMeta.code || 'DOC'}
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Saved Layout Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Theme: <strong className="text-slate-200 capitalize">{effectiveLayout.activeTheme || 'Classic'}</strong></span>
              <span>•</span>
              <span>Paper: <strong className="text-slate-200">{paperFormat}</strong></span>
              <span>•</span>
              <span>Rows/Page: <strong className="text-slate-200">{effectiveLayout.firstPageRows} (P1) / {effectiveLayout.continuationPageRows} (Cont.)</strong></span>
              <span>•</span>
              <span>Total Items: <strong className="text-slate-200">{lineItems.length}</strong></span>
            </p>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close Preview (Esc)"
          aria-label="Close Preview"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </header>

      {/* TOOLBAR CONTROLS BAR */}
      <div className="preview-controls-bar no-print bg-slate-900/95 border-b border-slate-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap shrink-0">
        
        {/* Left: Orientation Switcher & Page Navigation */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Orientation Switcher (Per-print Override) */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 select-none">
              Orientation:
            </span>
            <button
              type="button"
              onClick={() => handleToggleOrientation('portrait')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                effectiveLayout.orientation === 'portrait'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Portrait Orientation (Print override)"
            >
              <span className="material-symbols-outlined text-[16px]">crop_portrait</span>
              <span>Portrait</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleOrientation('landscape')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                effectiveLayout.orientation === 'landscape'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Landscape Orientation (Print override)"
            >
              <span className="material-symbols-outlined text-[16px]">crop_landscape</span>
              <span>Landscape</span>
            </button>
          </div>

          {/* Multi-Page Navigation (if multi-page) */}
          {computedPageCount > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-800/90 px-3 py-1 rounded-xl border border-slate-700/80 text-xs font-bold text-slate-300">
              <span className="text-slate-400 font-normal">Page:</span>
              <span className="font-mono text-white">{currentPageIndex + 1}</span>
              <span className="text-slate-500">of</span>
              <span className="font-mono text-white">{computedPageCount}</span>
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  disabled={currentPageIndex <= 0}
                  onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
                  className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  title="Previous Page"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button
                  disabled={currentPageIndex >= computedPageCount - 1}
                  onClick={() => setCurrentPageIndex(p => Math.min(computedPageCount - 1, p + 1))}
                  className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  title="Next Page"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          )}

          {/* Zoom controls */}
          <div className="hidden md:flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 text-xs">
            <button
              onClick={() => setZoomScale(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))))}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined text-sm">remove</span>
            </button>
            <span className="font-mono px-2 text-[11px] font-bold text-slate-200 min-w-[42px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale(z => Math.min(1.5, parseFloat((z + 0.1).toFixed(1))))}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              title="Zoom In"
            >
              <span className="material-symbols-outlined text-sm">add</span>
            </button>
            <button
              onClick={() => setZoomScale(1)}
              className="px-2 py-1 rounded hover:bg-slate-700 text-[10px] text-slate-400 hover:text-white font-bold cursor-pointer ml-0.5"
              title="Reset Zoom"
            >
              100%
            </button>
          </div>
        </div>

        {/* Right: Export & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* CSV Export */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting !== null}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Export CSV data"
          >
            <span className="material-symbols-outlined text-base text-emerald-400">table_chart</span>
            <span className="hidden sm:inline">CSV</span>
          </button>

          {/* PNG/Image Export */}
          <button
            type="button"
            onClick={handleExportImage}
            disabled={exporting !== null}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Download PNG image"
          >
            <span className="material-symbols-outlined text-base text-amber-400">
              {exporting === 'img' ? 'sync' : 'image'}
            </span>
            <span className="hidden sm:inline">{exporting === 'img' ? 'Rendering...' : 'PNG'}</span>
          </button>

          {/* PDF Export */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting !== null}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Download PDF"
          >
            <span className="material-symbols-outlined text-base text-red-400">
              {exporting === 'pdf' ? 'sync' : 'picture_as_pdf'}
            </span>
            <span>{exporting === 'pdf' ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>

          {/* Native Print Dialog Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all cursor-pointer"
            title="Open native browser print dialog"
          >
            <span className="material-symbols-outlined text-base">print</span>
            <span>Print</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* CENTER PREVIEW CANVAS */}
      <main className="flex-1 overflow-auto bg-slate-950 p-4 sm:p-8 flex justify-center items-start">
        <div
          ref={previewContainerRef}
          className="preview-wrapper transition-transform duration-150 origin-top flex flex-col items-center"
          style={{
            transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined,
            width: paperWidth,
            maxWidth: '100%'
          }}
        >
          <UnifiedPrintDocument
            documentType={documentType}
            documentData={resolvedRecord}
            layoutConfig={effectiveLayout}
            companyInfo={companyInfo}
            isPrintOnly={false}
          />
        </div>
      </main>
    </div>,
    document.body
  );
}
