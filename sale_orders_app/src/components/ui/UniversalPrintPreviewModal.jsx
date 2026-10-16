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
      <header className="no-print bg-slate-900/90 border-b border-slate-800/80 px-5 py-3 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 text-slate-300 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">print</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 id="universal-preview-title" data-keep-color="true" className="text-sm font-semibold text-white tracking-tight leading-none">
                {documentTitle || docMeta.name}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono tabular-nums font-semibold bg-slate-800 text-slate-300 border border-slate-700/80">
                {docMeta.code || 'DOC'}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Active Layout
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Theme: <span className="font-medium text-slate-200 capitalize">{effectiveLayout.activeTheme || 'Classic'}</span></span>
              <span className="text-slate-600">•</span>
              <span>Paper: <span className="font-medium text-slate-200">{paperFormat}</span></span>
              <span className="text-slate-600">•</span>
              <span>Pagination: <span className="font-mono tabular-nums text-slate-200">{effectiveLayout.firstPageRows} / {effectiveLayout.continuationPageRows} rows</span></span>
              <span className="text-slate-600">•</span>
              <span>Items: <span className="font-mono tabular-nums font-semibold text-slate-200">{lineItems.length}</span></span>
            </div>
          </div>
        </div>

        {/* Close Button with Esc Hint */}
        <button
          onClick={onClose}
          className="h-8 px-2.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer text-xs font-medium"
          title="Close Preview (Esc)"
          aria-label="Close Preview"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-900 border border-slate-700/80 rounded">Esc</kbd>
        </button>
      </header>

      {/* TOOLBAR CONTROLS BAR */}
      <div className="preview-controls-bar no-print bg-slate-900/95 border-b border-slate-800/80 px-5 py-2 flex items-center justify-between gap-3 flex-wrap shrink-0 backdrop-blur-sm">
        
        {/* Left: Orientation Switcher, Page Navigation & Zoom */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Orientation Switcher (Per-print Override) */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-950/70 border border-slate-800">
            <button
              type="button"
              onClick={() => handleToggleOrientation('portrait')}
              className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                effectiveLayout.orientation === 'portrait'
                  ? 'bg-slate-800 text-white shadow-xs border border-slate-700/80 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
              title="Portrait Orientation"
            >
              <span className="material-symbols-outlined text-[16px]">crop_portrait</span>
              <span>Portrait</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleOrientation('landscape')}
              className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                effectiveLayout.orientation === 'landscape'
                  ? 'bg-slate-800 text-white shadow-xs border border-slate-700/80 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
              title="Landscape Orientation"
            >
              <span className="material-symbols-outlined text-[16px]">crop_landscape</span>
              <span>Landscape</span>
            </button>
          </div>

          {/* Multi-Page Stepper */}
          {computedPageCount > 1 && (
            <div className="inline-flex items-center h-8 bg-slate-950/70 border border-slate-800 rounded-lg px-2 text-xs font-medium text-slate-300 gap-1.5">
              <span className="text-slate-400 text-[11px]">Page</span>
              <span className="font-mono tabular-nums text-white font-semibold">{currentPageIndex + 1}</span>
              <span className="text-slate-500">/</span>
              <span className="font-mono tabular-nums text-slate-300">{computedPageCount}</span>
              <div className="flex items-center gap-0.5 ml-1 border-l border-slate-800 pl-1">
                <button
                  type="button"
                  disabled={currentPageIndex <= 0}
                  onClick={() => setCurrentPageIndex(p => Math.max(0, p - 1))}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                  title="Previous Page"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                <button
                  type="button"
                  disabled={currentPageIndex >= computedPageCount - 1}
                  onClick={() => setCurrentPageIndex(p => Math.min(computedPageCount - 1, p + 1))}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                  title="Next Page"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          )}

          {/* Zoom controls */}
          <div className="hidden md:inline-flex items-center h-8 bg-slate-950/70 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setZoomScale(z => Math.max(0.5, parseFloat((z - 0.1).toFixed(1))))}
              className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined text-[16px]">remove</span>
            </button>
            <span className="font-mono tabular-nums text-[11px] font-medium text-slate-200 w-12 text-center select-none">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomScale(z => Math.min(1.5, parseFloat((z + 0.1).toFixed(1))))}
              className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
              title="Zoom In"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
            </button>
            {zoomScale !== 1 && (
              <button
                type="button"
                onClick={() => setZoomScale(1)}
                className="h-6 px-1.5 rounded text-[10px] text-slate-400 hover:text-white hover:bg-slate-800 font-medium cursor-pointer ml-0.5 border-l border-slate-800"
                title="Reset to 100%"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Right: Export & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* CSV Export */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting !== null}
            className="h-8 px-3 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Export line item data to CSV spreadsheet"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-400">table_chart</span>
            <span className="hidden sm:inline">CSV</span>
          </button>

          {/* PNG/Image Export */}
          <button
            type="button"
            onClick={handleExportImage}
            disabled={exporting !== null}
            className="h-8 px-3 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Download high-resolution PNG image"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-400">
              {exporting === 'img' ? 'sync' : 'image'}
            </span>
            <span className="hidden sm:inline">{exporting === 'img' ? 'Exporting...' : 'PNG'}</span>
          </button>

          {/* PDF Export */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting !== null}
            className="h-8 px-3.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Download document as PDF"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-400">
              {exporting === 'pdf' ? 'sync' : 'picture_as_pdf'}
            </span>
            <span>{exporting === 'pdf' ? 'Generating...' : 'Download PDF'}</span>
          </button>

          {/* Native Print Dialog Button (Prominent Primary Action) */}
          <button
            type="button"
            onClick={handlePrint}
            className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Open native browser print dialog"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* CENTER PREVIEW CANVAS (Tactile Document Inspection Desk) */}
      <main 
        className="flex-1 overflow-auto bg-[#0a0d14] p-6 sm:p-10 flex justify-center items-start scrollbar-thin"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      >
        <div
          ref={previewContainerRef}
          className="preview-wrapper transition-transform duration-150 origin-top flex flex-col items-center py-2"
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
