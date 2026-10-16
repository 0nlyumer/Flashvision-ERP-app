import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import { supabase } from '../../utils/supabaseClient';
import {
  SYSTEM_DOCUMENTS,
  DEFAULT_DOCUMENT_SCHEMAS,
  DEFAULT_LAYOUT_SETTINGS,
  discoverDocumentSchema,
  sanitizeColumnsForDoc,
  getMockPreviewData,
  getSampleRecordFromState
} from '../../utils/printSchemaRegistry';
import {
  THEME_ARCHETYPES,
  CURATED_PALETTES,
  applyThemeToLayout,
  getDefaultThemeForDoc,
  getSafeContrastTextColor
} from '../../utils/printThemeEngine';
import UnifiedPrintDocument, { PAPER_DIMENSIONS } from '../print/UnifiedPrintDocument';
import {
  exportDocumentToPdf,
  exportDocumentToImage,
  exportDocumentToCsv
} from '../../utils/printExportUtils';

const FONT_OPTIONS = [
  { id: 'Inter', name: 'Inter (Enterprise Clean Sans)' },
  { id: 'Roboto', name: 'Roboto (Standard Technical)' },
  { id: 'Outfit', name: 'Outfit (Modern Geometric)' },
  { id: 'Playfair Display', name: 'Playfair (Executive Formal Serif)' },
  { id: 'Courier Prime', name: 'Courier Prime (Industrial Monospace)' }
];

export default function UniversalPrintStudioModal({
  isOpen,
  onClose,
  documentType = 'sale_order',
  documentData = null,
  documentTitle = null,
  onApplied = null
}) {
  const { state, setCollection } = useApp() || {};
  const { appAlert } = useDialog() || {};
  const printContainerRef = useRef(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('themes'); 
  // 'themes' | 'pagination' | 'columns' | 'header' | 'branding' | 'signatures' | 'floor'
  
  const [zoomScale, setZoomScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(null); // 'pdf' | 'img' | 'csv' | null
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Company Global Metadata
  const companyName = state?.adminSetup?.companyName || 'FLASHVISION LOGISTICS & ENTERPRISE ERP';
  const companyLogo = state?.adminSetup?.logo || state?.adminSetup?.logoUrl || '';
  const companyAddress = state?.adminSetup?.address || 'Plot 42-B, Industrial Zone Phase III, Karachi, Pakistan';
  const companyPhone = state?.adminSetup?.phone || '+92-21-34567890';
  const companyEmail = state?.adminSetup?.email || 'operations@flashvision.com';
  const taxId = state?.adminSetup?.taxId || 'NTN: 8923410-7 • STRN: 3277876123456';

  const companyInfo = useMemo(() => ({
    companyName,
    logoUrl: companyLogo,
    address: companyAddress,
    phone: companyPhone,
    email: companyEmail,
    taxId
  }), [companyName, companyLogo, companyAddress, companyPhone, companyEmail, taxId]);

  // 1. Resolve Document Record (Real Document passed in OR fetched from State OR Mock)
  const resolvedRecord = useMemo(() => {
    if (documentData && typeof documentData === 'object') {
      return documentData;
    }
    const fromState = getSampleRecordFromState ? getSampleRecordFromState(documentType, state) : null;
    if (fromState) return fromState;
    return getMockPreviewData(documentType);
  }, [documentData, documentType, state]);

  // 2. Load Stored Layout Configuration
  const [layoutConfig, setLayoutConfig] = useState(() => {
    const defaultSchema = DEFAULT_DOCUMENT_SCHEMAS[documentType] || DEFAULT_LAYOUT_SETTINGS;
    const defaultTheme = getDefaultThemeForDoc(documentType);
    const localSaved = (() => {
      try {
        const item = localStorage.getItem(`fv_print_layout_${documentType}`);
        return item ? JSON.parse(item) : null;
      } catch (e) {
        return null;
      }
    })();
    const stateLayout = state?.adminSetup?.printSettings?.documentLayouts?.[documentType];
    const initial = {
      ...DEFAULT_LAYOUT_SETTINGS,
      ...defaultSchema,
      activeTheme: defaultTheme,
      ...(stateLayout || {}),
      ...(localSaved || {})
    };
    if (initial.gridColumns) {
      initial.gridColumns = sanitizeColumnsForDoc(documentType, initial.gridColumns);
    }
    const discovered = discoverDocumentSchema(documentType, resolvedRecord, initial, state);
    return applyThemeToLayout(discovered, discovered.activeTheme || defaultTheme, documentType);
  });

  // Re-run discovery if documentType or record changes
  useEffect(() => {
    const defaultSchema = DEFAULT_DOCUMENT_SCHEMAS[documentType] || DEFAULT_LAYOUT_SETTINGS;
    const defaultTheme = getDefaultThemeForDoc(documentType);
    const localSaved = (() => {
      try {
        const item = localStorage.getItem(`fv_print_layout_${documentType}`);
        return item ? JSON.parse(item) : null;
      } catch (e) {
        return null;
      }
    })();
    const stateLayout = state?.adminSetup?.printSettings?.documentLayouts?.[documentType];
    const merged = {
      ...DEFAULT_LAYOUT_SETTINGS,
      ...defaultSchema,
      activeTheme: defaultTheme,
      ...(stateLayout || {}),
      ...(localSaved || {})
    };
    if (merged.gridColumns) {
      merged.gridColumns = sanitizeColumnsForDoc(documentType, merged.gridColumns);
    }
    const discovered = discoverDocumentSchema(documentType, resolvedRecord, merged, state);
    setLayoutConfig(applyThemeToLayout(discovered, discovered.activeTheme || defaultTheme, documentType));
  }, [documentType, resolvedRecord, state]);

  // Extract Line Items
  const resolvedLineItems = useMemo(() => {
    if (!resolvedRecord) return [];
    if (Array.isArray(resolvedRecord.items)) return resolvedRecord.items;
    if (Array.isArray(resolvedRecord.lineItems)) return resolvedRecord.lineItems;
    if (Array.isArray(resolvedRecord.rows)) return resolvedRecord.rows;
    if (Array.isArray(resolvedRecord.details)) return resolvedRecord.details;
    if (Array.isArray(resolvedRecord.records)) return resolvedRecord.records;
    return [];
  }, [resolvedRecord]);

  // Updaters
  const updateLayout = (keyOrFn, val) => {
    setLayoutConfig((prev) => {
      if (typeof keyOrFn === 'function') return keyOrFn(prev);
      return { ...prev, [keyOrFn]: val };
    });
  };

  const handleThemeChange = (themeId) => {
    setLayoutConfig((prev) => applyThemeToLayout(prev, themeId, documentType));
  };

  const handlePaletteChange = (palette) => {
    setLayoutConfig((prev) => {
      const isIndustrial = (prev.activeTheme || 'classic') === 'industrial';
      const headerBg = isIndustrial ? '#FFFFFF' : palette.headerBg;
      const headerText = isIndustrial ? '#000000' : getSafeContrastTextColor(headerBg);
      return {
        ...prev,
        paletteId: palette.id,
        primaryColor: isIndustrial ? '#000000' : palette.primary,
        tableHeaderBgColor: headerBg,
        tableHeaderTextColor: headerText
      };
    });
  };

  // Column Manipulations
  const toggleColumn = (idx) => {
    const nextCols = [...(layoutConfig.gridColumns || [])];
    nextCols[idx] = { ...nextCols[idx], enabled: nextCols[idx].enabled === false ? true : false };
    updateLayout('gridColumns', nextCols);
  };

  const moveColumn = (idx, direction) => {
    const nextCols = [...(layoutConfig.gridColumns || [])];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= nextCols.length) return;
    const temp = nextCols[idx];
    nextCols[idx] = nextCols[targetIdx];
    nextCols[targetIdx] = temp;
    updateLayout('gridColumns', nextCols);
  };

  const updateColumnProp = (idx, prop, value) => {
    const nextCols = [...(layoutConfig.gridColumns || [])];
    nextCols[idx] = { ...nextCols[idx], [prop]: value };
    updateLayout('gridColumns', nextCols);
  };

  const addCustomColumn = () => {
    const nextCols = [...(layoutConfig.gridColumns || [])];
    const key = `custom_${Date.now().toString().slice(-4)}`;
    nextCols.push({
      key,
      label: 'New Column',
      enabled: true,
      width: '15%',
      align: 'left'
    });
    updateLayout('gridColumns', nextCols);
  };

  // Header Field Manipulations
  const toggleHeaderField = (idx) => {
    const nextFields = [...(layoutConfig.headerFields || [])];
    nextFields[idx] = { ...nextFields[idx], enabled: nextFields[idx].enabled === false ? true : false };
    updateLayout('headerFields', nextFields);
  };

  const updateHeaderFieldProp = (idx, prop, value) => {
    const nextFields = [...(layoutConfig.headerFields || [])];
    nextFields[idx] = { ...nextFields[idx], [prop]: value };
    updateLayout('headerFields', nextFields);
  };

  // Signatures Manipulations
  const addSignatureBlock = () => {
    const sigs = [...(layoutConfig.signatures || [])];
    sigs.push({
      key: `sig_${Date.now().toString().slice(-4)}`,
      label: 'Authorized Signatory',
      size: '1/3',
      type: 'text'
    });
    updateLayout('signatures', sigs);
  };

  const removeSignatureBlock = (idx) => {
    const sigs = [...(layoutConfig.signatures || [])];
    sigs.splice(idx, 1);
    updateLayout('signatures', sigs);
  };

  const updateSignatureProp = (idx, prop, value) => {
    const sigs = [...(layoutConfig.signatures || [])];
    sigs[idx] = { ...sigs[idx], [prop]: value };
    updateLayout('signatures', sigs);
  };

  // SAVE Layout permanently to Supabase + LocalStorage + AppContext
  const handleSaveLayout = async () => {
    setSaving(true);
    try {
      const activeTheme = layoutConfig.activeTheme || getDefaultThemeForDoc(documentType);

      // 1. Supabase print_layout_settings
      await supabase.from('print_layout_settings').upsert(
        {
          tenant_id: 'default_tenant',
          document_type: documentType,
          active_theme_id: activeTheme,
          layout_config: layoutConfig,
          customizations: {
            theme: activeTheme,
            paletteId: layoutConfig.paletteId,
            paperSize: layoutConfig.paperSize,
            orientation: layoutConfig.orientation,
            margins: {
              top: layoutConfig.marginTop,
              bottom: layoutConfig.marginBottom,
              left: layoutConfig.marginLeft,
              right: layoutConfig.marginRight
            }
          },
          updated_at: new Date().toISOString()
        },
        { onConflict: 'tenant_id,document_type' }
      );

      // 2. LocalStorage
      localStorage.setItem(`fv_print_layout_${documentType}`, JSON.stringify(layoutConfig));

      // 3. AppContext
      if (setCollection) {
        const cur = state?.adminSetup?.printSettings || {};
        const layouts = { ...(cur.documentLayouts || {}), [documentType]: layoutConfig };
        setCollection('adminSetup', {
          ...(state?.adminSetup || {}),
          printSettings: { ...cur, documentLayouts: layouts }
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      if (onApplied) onApplied(layoutConfig);
    } catch (err) {
      console.error('Error saving layout:', err);
      appAlert?.('Failed to save layout configuration.');
    } finally {
      setSaving(false);
    }
  };

  // Reset to default factory schema
  const handleResetDefaults = () => {
    const defaultTheme = getDefaultThemeForDoc(documentType);
    const defaultSchema = DEFAULT_DOCUMENT_SCHEMAS[documentType] || DEFAULT_LAYOUT_SETTINGS;
    const clean = applyThemeToLayout(defaultSchema, defaultTheme, documentType);
    setLayoutConfig(clean);
    try {
      localStorage.removeItem(`fv_print_layout_${documentType}`);
    } catch (e) {}
    appAlert?.(`Layout reset to factory default ${defaultTheme.toUpperCase()} theme.`);
  };

  // Export Handlers
  const handleDownloadPdf = async () => {
    if (!printContainerRef.current) return;
    setExporting('pdf');
    const docNo = resolvedRecord?.id || resolvedRecord?.so_number || resolvedRecord?.dcNumber || 'Document';
    const filename = `${documentType.toUpperCase()}_${docNo}.pdf`;
    await exportDocumentToPdf(printContainerRef.current, filename, {
      paperSize: layoutConfig.paperSize,
      orientation: layoutConfig.orientation
    });
    setExporting(null);
  };

  const handleDownloadImage = async () => {
    if (!printContainerRef.current) return;
    setExporting('img');
    const docNo = resolvedRecord?.id || resolvedRecord?.so_number || resolvedRecord?.dcNumber || 'Document';
    const filename = `${documentType.toUpperCase()}_${docNo}.png`;
    await exportDocumentToImage(printContainerRef.current, filename);
    setExporting(null);
  };

  const handleExportCsv = () => {
    setExporting('csv');
    const docNo = resolvedRecord?.id || resolvedRecord?.so_number || resolvedRecord?.dcNumber || 'Document';
    const filename = `${documentType.toUpperCase()}_${docNo}.csv`;
    const activeCols = (layoutConfig.gridColumns || []).filter((c) => c.enabled !== false);
    exportDocumentToCsv(activeCols, resolvedLineItems, filename);
    setExporting(null);
  };

  const handlePrintNow = () => {
    window.print();
  };

  if (!isOpen) return null;

  const currentPaper = PAPER_DIMENSIONS[layoutConfig.paperSize] || PAPER_DIMENSIONS.A4;
  const docTitleDisplay =
    documentTitle ||
    SYSTEM_DOCUMENTS.find((d) => d.id === documentType)?.name ||
    documentType.replace(/_/g, ' ').toUpperCase();

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-between overflow-hidden animate-fade-in font-sans">
      
      {/* TOP CONTROL TOOLBAR */}
      <header className="no-print w-full bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-xl">print</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white tracking-tight">{docTitleDisplay}</h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono font-bold uppercase">
                {currentPaper.printSize || layoutConfig.paperSize || 'A4'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase">
                {layoutConfig.activeTheme || 'CLASSIC'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Universal Print Studio • Rows: <strong className="text-white">{resolvedLineItems.length}</strong> • WCAG 2.1 AA Contrast Certified
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800 rounded-xl border border-slate-700 p-0.5 mr-2">
            <button
              onClick={() => setZoomScale(0.75)}
              className={`px-2 py-1 text-[10px] font-bold rounded-lg ${zoomScale === 0.75 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              75%
            </button>
            <button
              onClick={() => setZoomScale(1)}
              className={`px-2 py-1 text-[10px] font-bold rounded-lg ${zoomScale === 1 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              100%
            </button>
            <button
              onClick={() => setZoomScale(1.15)}
              className={`px-2 py-1 text-[10px] font-bold rounded-lg ${zoomScale === 1.15 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              115%
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting !== null}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Export Line Items to CSV"
          >
            <span className="material-symbols-outlined text-base text-blue-400">table_view</span>
            Export CSV
          </button>

          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={exporting !== null}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download PNG Image"
          >
            <span className="material-symbols-outlined text-base text-emerald-400">image</span>
            Save Image
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={exporting !== null}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download Multi-Page PDF"
          >
            <span className="material-symbols-outlined text-base text-red-400">picture_as_pdf</span>
            Download PDF
          </button>

          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-900/20 cursor-pointer disabled:opacity-50"
            title="Save custom layout as permanent ERP default"
          >
            <span className="material-symbols-outlined text-base">{saveSuccess ? 'check_circle' : 'save'}</span>
            {saveSuccess ? 'Saved!' : saving ? 'Saving...' : 'Save Default'}
          </button>

          <button
            type="button"
            onClick={handlePrintNow}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">print</span>
            Print Now
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all ml-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </header>

      {/* MAIN BODY: SPLIT VIEW (LEFT TOOLBOX DRAWER + RIGHT LIVE PREVIEW) */}
      <div className="flex-1 w-full flex flex-col lg:flex-row overflow-hidden relative">
        {/* ============================================================== */}
        {/* LEFT TOOLBOX & INSPECTOR DRAWER                                */}
        {/* ============================================================== */}
        <aside className="no-print w-full lg:w-[440px] xl:w-[480px] bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden shadow-2xl z-10">
          
          {/* Tab Navigation */}
          <div className="flex items-center border-b border-slate-800 bg-slate-950/70 p-1.5 gap-1 overflow-x-auto text-xs font-bold scrollbar-none">
            <button
              onClick={() => setActiveTab('themes')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'themes'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">style</span>
              Themes (3)
            </button>

            <button
              onClick={() => setActiveTab('branding')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'branding'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">palette</span>
              Colors & Fonts
            </button>

            <button
              onClick={() => setActiveTab('columns')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'columns'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">view_column</span>
              Columns ({layoutConfig.gridColumns?.filter((c) => c.enabled !== false).length})
            </button>

            <button
              onClick={() => setActiveTab('header')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'header'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">badge</span>
              Header
            </button>

            <button
              onClick={() => setActiveTab('floor')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'floor'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">precision_manufacturing</span>
              Shop Floor
            </button>

            <button
              onClick={() => setActiveTab('pagination')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'pagination'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">aspect_ratio</span>
              Paper
            </button>

            <button
              onClick={() => setActiveTab('signatures')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                activeTab === 'signatures'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">draw</span>
              Signatures
            </button>
          </div>

          {/* Drawer Body Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* ------------------------------------------------------------ */}
            {/* TAB: THEMES (3 DEDICATED ARCHETYPES)                         */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'themes' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Theme Archetype Selector
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Switch between the 3 distinct document styles instantly:
                  </p>
                </div>

                <div className="space-y-3">
                  {Object.values(THEME_ARCHETYPES).map((theme) => {
                    const isCurrent = (layoutConfig.activeTheme || 'classic') === theme.id;
                    const isRecommended = theme.id === getDefaultThemeForDoc(documentType);

                    return (
                      <div
                        key={theme.id}
                        onClick={() => handleThemeChange(theme.id)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/30 shadow-md'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-lg ${isCurrent ? 'text-blue-400' : 'text-slate-500'}`}>
                              {theme.icon}
                            </span>
                            <h3 className="text-xs font-black text-white uppercase tracking-tight">
                              {theme.name}
                            </h3>
                          </div>
                          {isRecommended && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                              Recommended
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-300 leading-relaxed mb-2">
                          {theme.tagline}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800">
                          <span>Best for: <strong className="text-slate-200">{theme.bestFor.split(',')[0]}</strong></span>
                          {isCurrent && (
                            <span className="text-blue-400 font-bold flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-xs">done</span> Active
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* TAB: BRANDING & WCAG PALETTES                                */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'branding' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">
                    WCAG 2.1 AA/AAA Curated Palettes
                  </span>
                  <p className="text-[11px] text-slate-400 mb-2">
                    Guaranteed readable text on contrast-tested background headers:
                  </p>

                  <div className="grid grid-cols-1 gap-2">
                    {CURATED_PALETTES.map((pal) => {
                      const isCurrent = (layoutConfig.paletteId || 'navy_enterprise') === pal.id;
                      return (
                        <div
                          key={pal.id}
                          onClick={() => handlePaletteChange(pal)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                            isCurrent
                              ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500/20'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center rounded-lg overflow-hidden border border-slate-700 shadow-sm">
                              <div className="w-6 h-6 flex items-center justify-center font-bold text-[9px]" style={{ backgroundColor: pal.headerBg, color: pal.headerText }}>
                                Aa
                              </div>
                              <div className="w-4 h-6" style={{ backgroundColor: pal.primary }} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-white block leading-tight">
                                {pal.name}
                              </span>
                              <span className="text-[10px] text-slate-400 leading-tight">
                                {pal.description.split('with')[0]}
                              </span>
                            </div>
                          </div>

                          <span className="text-[9px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                            WCAG AAA
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Typography */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-white mb-1">Typography Font:</label>
                    <select
                      value={layoutConfig.fontFamily || 'Inter'}
                      onChange={(e) => updateLayout('fontFamily', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white mb-1">Base Body Text Size:</label>
                    <select
                      value={layoutConfig.bodyFontSize || '11px'}
                      onChange={(e) => updateLayout('bodyFontSize', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                    >
                      <option value="9px">9px (Ultra Compact)</option>
                      <option value="10px">10px (Compact Floor)</option>
                      <option value="11px">11px (Executive Balance)</option>
                      <option value="12px">12px (Spacious Large)</option>
                    </select>
                  </div>
                </div>

                {/* Company Logo Configuration & Controls */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-blue-400">branding_watermark</span>
                      Company Logo Configuration
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={layoutConfig.showHeaderLogo !== false}
                        onChange={(e) => updateLayout('showHeaderLogo', e.target.checked)}
                        className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                      />
                      <span className="text-[11px] text-slate-300 font-semibold">Show Logo</span>
                    </label>
                  </div>

                  {/* Logo Preview or Clean Omission notice */}
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                    {layoutConfig.logoUrl || companyLogo ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={layoutConfig.logoUrl || companyLogo}
                          alt="Logo Preview"
                          className="h-10 max-h-10 max-w-[100px] object-contain rounded bg-white p-1"
                        />
                        <div className="text-[10px] space-y-0.5">
                          <span className="text-white font-bold block">Configured Logo</span>
                          <button
                            type="button"
                            onClick={() => {
                              updateLayout('logoUrl', '');
                              if (setCollection) {
                                setCollection('adminSetup', { ...(state?.adminSetup || {}), logo: '', logoUrl: '' });
                              }
                            }}
                            className="text-red-400 hover:text-red-300 font-bold underline cursor-pointer"
                          >
                            Remove Logo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-slate-500">hide_image</span>
                        No logo configured (Clean omission on prints).
                      </div>
                    )}
                  </div>

                  {/* Upload Logo File */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Upload Logo Image:
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const dataUrl = event.target?.result;
                          if (dataUrl) {
                            updateLayout('logoUrl', dataUrl);
                            updateLayout('showHeaderLogo', true);
                            if (setCollection) {
                              setCollection('adminSetup', {
                                ...(state?.adminSetup || {}),
                                logo: dataUrl,
                                logoUrl: dataUrl
                              });
                            }
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                    />
                  </div>

                  {/* Logo Size and Position Controls */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Logo Size
                      </label>
                      <select
                        value={layoutConfig.logoSize || 'medium'}
                        onChange={(e) => updateLayout('logoSize', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white font-medium"
                      >
                        <option value="small">Small (32px)</option>
                        <option value="medium">Medium (48px)</option>
                        <option value="large">Large (64px)</option>
                        <option value="xl">Extra Large (80px)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Logo Position
                      </label>
                      <select
                        value={layoutConfig.logoPosition || 'left'}
                        onChange={(e) => updateLayout('logoPosition', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white font-medium"
                      >
                        <option value="left">Left Aligned</option>
                        <option value="center">Center</option>
                        <option value="right">Right Aligned</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                    <span className="text-[11px] text-slate-200">Show Address & Contact Info</span>
                    <input
                      type="checkbox"
                      checked={layoutConfig.showHeaderDetails !== false}
                      onChange={(e) => updateLayout('showHeaderDetails', e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* TAB: SHOP FLOOR & MANUFACTURING CONTROLS                     */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'floor' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Shop Floor & Batch Controls
                  </span>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Manufacturing floor-ready tools for production slips, batch cards, and BOMs:
                  </p>
                </div>

                <div className="space-y-2.5">
                  <label className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Physical Checkbox Column [✓]
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Adds square checkboxes for shop-floor operator sign-offs
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={layoutConfig.enableFloorCheckboxes !== false}
                      onChange={(e) => updateLayout('enableFloorCheckboxes', e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                  </label>

                  <label className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Machine & Shift Allocation Block
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Displays Machine Line, Shift, Operator, and Yield Target
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={layoutConfig.showMachineAllocation !== false}
                      onChange={(e) => updateLayout('showMachineAllocation', e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                  </label>

                  <label className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Monochrome Ink-Saver Mode
                      </span>
                      <span className="text-[10px] text-slate-400">
                        100% laser-safe black & white header tints
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={layoutConfig.inkSaverMode === true}
                      onChange={(e) => updateLayout('inkSaverMode', e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* TAB: COLUMNS                                                 */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'columns' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Line Item Grid Columns</span>
                  <button
                    type="button"
                    onClick={addCustomColumn}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">add</span> Add Column
                  </button>
                </div>

                <div className="space-y-2">
                  {(layoutConfig.gridColumns || []).map((col, idx) => (
                    <div
                      key={col.key || idx}
                      className={`p-2.5 rounded-xl border transition-all ${
                        col.enabled !== false
                          ? 'bg-slate-950/80 border-slate-800'
                          : 'bg-slate-950/30 border-slate-800/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="checkbox"
                            checked={col.enabled !== false}
                            onChange={() => toggleColumn(idx)}
                            className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={col.label || col.key}
                            onChange={(e) => updateColumnProp(idx, 'label', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-blue-500 text-xs font-bold text-white px-1 py-0.5 outline-none flex-1"
                          />
                        </div>

                        {/* Reorder Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveColumn(idx, -1)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300"
                            title="Move Up"
                          >
                            <span className="material-symbols-outlined text-xs">arrow_upward</span>
                          </button>
                          <button
                            type="button"
                            disabled={idx === (layoutConfig.gridColumns || []).length - 1}
                            onClick={() => moveColumn(idx, 1)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300"
                            title="Move Down"
                          >
                            <span className="material-symbols-outlined text-xs">arrow_downward</span>
                          </button>
                        </div>
                      </div>

                      {/* Width & Alignment */}
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">Width:</span>
                          <input
                            type="text"
                            value={col.width || '15%'}
                            onChange={(e) => updateColumnProp(idx, 'width', e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-white w-14 text-center font-mono"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-1">
                          {['left', 'center', 'right'].map((align) => (
                            <button
                              key={align}
                              type="button"
                              onClick={() => updateColumnProp(idx, 'align', align)}
                              className={`p-1 rounded text-xs ${
                                (col.align || 'left') === align
                                  ? 'bg-blue-600 text-white font-bold'
                                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                format_align_{align}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* TAB: HEADER FIELDS                                           */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'header' && (
              <div className="space-y-3 animate-fade-in">
                <span className="text-xs font-bold text-white block">Document Header Metadata Fields</span>
                <div className="space-y-2">
                  {(layoutConfig.headerFields || []).map((field, idx) => (
                    <div
                      key={field.key || idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                        field.enabled !== false
                          ? 'bg-slate-950/80 border-slate-800'
                          : 'bg-slate-950/30 border-slate-800/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={field.enabled !== false}
                          onChange={() => toggleHeaderField(idx)}
                          className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={field.label || field.key}
                          onChange={(e) => updateHeaderFieldProp(idx, 'label', e.target.value)}
                          className="bg-transparent border-b border-transparent focus:border-blue-500 text-xs font-bold text-white px-1 py-0.5 outline-none flex-1"
                        />
                      </div>

                      <select
                        value={field.width || 'span-1'}
                        onChange={(e) => updateHeaderFieldProp(idx, 'width', e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-300"
                      >
                        <option value="span-1">1 Col</option>
                        <option value="span-2">2 Cols</option>
                        <option value="span-3">Full Width</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* TAB: PAGINATION & PAPER                                      */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'pagination' && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold text-white mb-1">Paper Format:</label>
                  <select
                    value={layoutConfig.paperSize || 'A4'}
                    onChange={(e) => updateLayout('paperSize', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  >
                    {Object.keys(PAPER_DIMENSIONS).map((key) => (
                      <option key={key} value={key}>
                        {key} ({PAPER_DIMENSIONS[key].printSize})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-white mb-1">Orientation:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateLayout('orientation', 'portrait')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                        (layoutConfig.orientation || 'portrait') === 'portrait'
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">portrait</span>
                      Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => updateLayout('orientation', 'landscape')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                        layoutConfig.orientation === 'landscape'
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">landscape</span>
                      Landscape
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Page 1 Rows:</label>
                    <input
                      type="number"
                      value={layoutConfig.firstPageRows || 8}
                      onChange={(e) => updateLayout('firstPageRows', Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Continuation Rows:</label>
                    <input
                      type="number"
                      value={layoutConfig.continuationPageRows || 14}
                      onChange={(e) => updateLayout('continuationPageRows', Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {/* Margins */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-xs font-bold text-white mb-2">Paper Margins (mm):</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Top Margin:</span>
                      <input
                        type="text"
                        value={layoutConfig.marginTop || '12mm'}
                        onChange={(e) => updateLayout('marginTop', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Bottom Margin:</span>
                      <input
                        type="text"
                        value={layoutConfig.marginBottom || '12mm'}
                        onChange={(e) => updateLayout('marginBottom', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Left Margin:</span>
                      <input
                        type="text"
                        value={layoutConfig.marginLeft || '12mm'}
                        onChange={(e) => updateLayout('marginLeft', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Right Margin:</span>
                      <input
                        type="text"
                        value={layoutConfig.marginRight || '12mm'}
                        onChange={(e) => updateLayout('marginRight', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* TAB: SIGNATURES & TERMS                                      */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'signatures' && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Signature Blocks</span>
                    <button
                      type="button"
                      onClick={addSignatureBlock}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">add</span> Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(layoutConfig.signatures || []).map((sig, idx) => (
                      <div key={sig.key || idx} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={sig.label || 'Signature'}
                            onChange={(e) => updateSignatureProp(idx, 'label', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-blue-500 text-xs font-bold text-white px-1 py-0.5 outline-none flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => removeSignatureBlock(idx)}
                            className="text-slate-500 hover:text-red-400 p-1"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[10px]">
                          <select
                            value={sig.type || 'text'}
                            onChange={(e) => updateSignatureProp(idx, 'type', e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300"
                          >
                            <option value="text">Signature Line</option>
                            <option value="stamp">Official Stamp Box</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label className="block text-xs font-bold text-white">Terms & Operating Conditions:</label>
                  <textarea
                    rows={3}
                    value={layoutConfig.termsConditions || ''}
                    onChange={(e) => updateLayout('termsConditions', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>

                {/* Custom Footer Text */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-white">Custom Computer-Generated Footer:</label>
                  <input
                    type="text"
                    value={layoutConfig.customFooterText || ''}
                    onChange={(e) => updateLayout('customFooterText', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* RESET BUTTON */}
            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="w-full py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">restart_alt</span>
                Reset to Default Preset
              </button>
            </div>
          </div>
        </aside>

        {/* ============================================================== */}
        {/* RIGHT LIVE PRINT PREVIEW (DIGITAL TWIN MULTI-PAGE RENDERER)   */}
        {/* ============================================================== */}
        <main className="flex-1 bg-slate-950/95 overflow-y-auto p-4 md:p-8 flex flex-col items-center gap-8 relative select-none">
          <div
            id="fv-print-studio-container"
            ref={printContainerRef}
            className="flex flex-col gap-8 items-center w-full"
            style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}
          >
            <UnifiedPrintDocument
              documentType={documentType}
              documentData={resolvedRecord}
              layoutConfig={layoutConfig}
              companyInfo={companyInfo}
              isPrintOnly={false}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
