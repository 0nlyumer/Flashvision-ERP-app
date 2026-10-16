import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import { supabase } from '../../utils/supabaseClient';
import {
  SYSTEM_DOCUMENTS,
  DOCUMENT_MODULES,
  DEFAULT_DOCUMENT_SCHEMAS,
  DEFAULT_LAYOUT_SETTINGS,
  discoverDocumentSchema,
  sanitizeColumnsForDoc,
  getMockPreviewData,
  getSampleRecordFromState
} from '../../utils/printSchemaRegistry';
import {
  CURATED_PALETTES,
  THEME_ARCHETYPES,
  getDefaultThemeForDoc,
  applyThemeToLayout,
  getSafeContrastTextColor
} from '../../utils/printThemeEngine';
import UnifiedPrintDocument, { PAPER_DIMENSIONS } from '../print/UnifiedPrintDocument';
import {
  exportDocumentToPdf,
  exportDocumentToImage,
  exportDocumentToCsv
} from '../../utils/printExportUtils';

const FONT_FAMILIES = [
  { id: 'Inter', name: 'Inter (Enterprise Clean Sans)' },
  { id: 'Roboto', name: 'Roboto (Standard Technical)' },
  { id: 'Outfit', name: 'Outfit (Modern Geometric)' },
  { id: 'Playfair Display', name: 'Playfair (Executive Formal Serif)' },
  { id: 'Courier Prime', name: 'Courier Prime (Industrial Monospace)' }
];

export default function PrintSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, setCollection } = useApp() || {};
  const { appAlert } = useDialog() || {};

  const initialDoc = searchParams.get('doc') || 'sale_order';
  const initialModule = searchParams.get('module') || 'all';

  const [activeModuleFilter, setActiveModuleFilter] = useState(initialModule);
  const [selectedDocId, setSelectedDocId] = useState(initialDoc);
  const [searchQuery, setSearchQuery] = useState('');

  // Right Studio Tab
  const [activeRightTab, setActiveRightTab] = useState('themes'); 
  // 'themes' | 'palette' | 'paper' | 'header' | 'columns' | 'floor' | 'totals'

  // Interactive Click-to-Edit Selected Element (Issue 5)
  const [selectedElement, setSelectedElement] = useState(null);

  // Canvas View Scale
  const [zoomScale, setZoomScale] = useState(1);

  // States
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(null); // 'pdf' | 'img' | 'csv' | null
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Reference to center preview container for exports
  const previewContainerRef = useRef(null);

  // Local storage of all layouts
  const [documentLayouts, setDocumentLayouts] = useState({});

  // Company Global Metadata
  const companyName = state?.adminSetup?.companyName || 'FLASHVISION LOGISTICS & ENTERPRISE ERP';
  const companyLogo = state?.adminSetup?.logo || state?.adminSetup?.logoUrl || '';
  const companyInfo = useMemo(() => ({
    companyName,
    logoUrl: companyLogo,
    address: state?.adminSetup?.address || 'Plot 42-B, Industrial Zone Phase III, Karachi, Pakistan',
    phone: state?.adminSetup?.phone || '+92-21-34567890',
    email: state?.adminSetup?.email || 'operations@flashvision.com',
    taxId: state?.adminSetup?.taxId || 'NTN: 8923410-7 • STRN: 3277876123456'
  }), [state?.adminSetup, companyName, companyLogo]);

  // 1. Initial Load: Fetch saved layouts from Supabase print_layout_settings & AppContext state
  useEffect(() => {
    const loadLayouts = async () => {
      try {
        const { data } = await supabase
          .from('print_layout_settings')
          .select('document_type, active_theme_id, layout_config, customizations')
          .eq('tenant_id', 'default_tenant');

        const dbMap = {};
        if (data && data.length > 0) {
          data.forEach((row) => {
            if (row.document_type && row.layout_config) {
              dbMap[row.document_type] = {
                ...row.layout_config,
                activeTheme: row.active_theme_id || row.layout_config.activeTheme
              };
            }
          });
        }

        const initialMap = {};
        SYSTEM_DOCUMENTS.forEach((doc) => {
          const docId = doc.id;
          const defaultSchema = DEFAULT_DOCUMENT_SCHEMAS[docId] || DEFAULT_LAYOUT_SETTINGS;
          const defaultTheme = getDefaultThemeForDoc(docId);
          const stateLayout = state?.adminSetup?.printSettings?.documentLayouts?.[docId];
          const dbLayout = dbMap[docId];

          const localSaved = (() => {
            try {
              const item = localStorage.getItem(`fv_print_layout_${docId}`);
              return item ? JSON.parse(item) : null;
            } catch (e) {
              return null;
            }
          })();

          const merged = {
            ...DEFAULT_LAYOUT_SETTINGS,
            ...defaultSchema,
            activeTheme: defaultTheme,
            ...(stateLayout || {}),
            ...(dbLayout || {}),
            ...(localSaved || {})
          };

          if (merged.gridColumns) {
            merged.gridColumns = sanitizeColumnsForDoc(docId, merged.gridColumns);
          }

          // Guarantee safe contrast on table header
          const safeTheme = merged.activeTheme || defaultTheme;
          initialMap[docId] = applyThemeToLayout(merged, safeTheme, docId);
        });

        setDocumentLayouts(initialMap);
      } catch (err) {
        console.warn('Error loading print layout settings:', err);
        const fallbackMap = {};
        SYSTEM_DOCUMENTS.forEach((doc) => {
          const defTheme = getDefaultThemeForDoc(doc.id);
          const schema = DEFAULT_DOCUMENT_SCHEMAS[doc.id] || DEFAULT_LAYOUT_SETTINGS;
          fallbackMap[doc.id] = applyThemeToLayout({ ...schema, activeTheme: defTheme }, defTheme, doc.id);
        });
        setDocumentLayouts(fallbackMap);
      }
    };

    loadLayouts();
  }, [state?.adminSetup]);

  // Selected Document Meta
  const currentDocMeta = useMemo(() => {
    return SYSTEM_DOCUMENTS.find((d) => d.id === selectedDocId) || SYSTEM_DOCUMENTS[0];
  }, [selectedDocId]);

  // Compute Active Layout
  const activeLayout = useMemo(() => {
    try {
      const raw = documentLayouts[selectedDocId] || DEFAULT_DOCUMENT_SCHEMAS[selectedDocId] || DEFAULT_LAYOUT_SETTINGS;
      const sampleRecord = getSampleRecordFromState ? getSampleRecordFromState(selectedDocId, state) : null;
      const discovered = discoverDocumentSchema(selectedDocId, sampleRecord, raw, state);
      return discovered;
    } catch (e) {
      console.error('Error computing active layout:', e);
      return DEFAULT_DOCUMENT_SCHEMAS[selectedDocId] || DEFAULT_LAYOUT_SETTINGS;
    }
  }, [documentLayouts, selectedDocId, state]);

  // Updater helper
  const updateActiveLayout = (updaterFn) => {
    setDocumentLayouts((prev) => {
      const current = prev[selectedDocId] || DEFAULT_DOCUMENT_SCHEMAS[selectedDocId] || DEFAULT_LAYOUT_SETTINGS;
      const updated = typeof updaterFn === 'function' ? updaterFn(current) : { ...current, ...updaterFn };
      return {
        ...prev,
        [selectedDocId]: updated
      };
    });
  };

  // Switch Theme Archetype
  const handleThemeChange = (themeId) => {
    updateActiveLayout((prev) => applyThemeToLayout(prev, themeId, selectedDocId));
  };

  // Switch Curated Color Palette
  const handlePaletteChange = (palette) => {
    updateActiveLayout((prev) => {
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

  // Filtered documents list
  const filteredDocuments = useMemo(() => {
    let docs = SYSTEM_DOCUMENTS;
    if (activeModuleFilter !== 'all') {
      docs = docs.filter((d) => d.module === activeModuleFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      docs = docs.filter((d) => 
        d.name.toLowerCase().includes(q) || 
        d.code.toLowerCase().includes(q) || 
        d.id.toLowerCase().includes(q)
      );
    }
    return docs;
  }, [activeModuleFilter, searchQuery]);

  const handleSelectDocument = (docId) => {
    setSelectedDocId(docId);
    setSelectedElement(null);
    const docMeta = SYSTEM_DOCUMENTS.find((d) => d.id === docId);
    if (docMeta) {
      if (activeModuleFilter !== 'all' && activeModuleFilter !== docMeta.module) {
        setActiveModuleFilter(docMeta.module);
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'print_settings');
        next.set('module', docMeta.module);
        next.set('doc', docId);
        return next;
      });
    }
  };

  // Interactive Click-to-Edit Dispatcher (Issue 5)
  const handleSelectElement = (el) => {
    if (!el) {
      setSelectedElement(null);
      return;
    }
    setSelectedElement(el);
    if (el.type === 'column') {
      setActiveRightTab('columns');
    } else if (el.type === 'header_field' || el.type === 'company' || el.type === 'title') {
      setActiveRightTab('header');
    } else if (el.type === 'totals' || el.type === 'signatures') {
      setActiveRightTab('totals');
    } else if (el.type === 'footer') {
      setActiveRightTab('advanced');
    }
  };

  // Column Manipulations
  const moveColumn = (index, delta) => {
    const target = index + delta;
    updateActiveLayout((prev) => {
      const cols = [...(prev.gridColumns || [])];
      if (target < 0 || target >= cols.length) return prev;
      const temp = cols[index];
      cols[index] = cols[target];
      cols[target] = temp;
      return { ...prev, gridColumns: cols };
    });
  };

  const toggleColumnVisibility = (index) => {
    updateActiveLayout((prev) => {
      const cols = [...(prev.gridColumns || [])];
      cols[index] = { ...cols[index], enabled: cols[index].enabled === false ? true : false };
      return { ...prev, gridColumns: cols };
    });
  };

  const updateColumnProperty = (index, field, value) => {
    updateActiveLayout((prev) => {
      const cols = [...(prev.gridColumns || [])];
      cols[index] = { ...cols[index], [field]: value };
      return { ...prev, gridColumns: cols };
    });
  };

  const handleAddCustomColumn = () => {
    const newKey = `col_${Date.now().toString().slice(-4)}`;
    updateActiveLayout((prev) => {
      const cols = [...(prev.gridColumns || [])];
      cols.push({
        key: newKey,
        label: 'New Column',
        enabled: true,
        width: '15%',
        align: 'left'
      });
      return { ...prev, gridColumns: cols };
    });
  };

  // Header Field Manipulations
  const toggleHeaderField = (key) => {
    updateActiveLayout((prev) => {
      const fields = [...(prev.headerFields || [])];
      const idx = fields.findIndex((f) => f.key === key);
      if (idx > -1) {
        fields[idx] = { ...fields[idx], enabled: fields[idx].enabled === false ? true : false };
      }
      return { ...prev, headerFields: fields };
    });
  };

  const updateHeaderFieldProp = (key, prop, value) => {
    updateActiveLayout((prev) => {
      const fields = [...(prev.headerFields || [])];
      const idx = fields.findIndex((f) => f.key === key);
      if (idx > -1) {
        fields[idx] = { ...fields[idx], [prop]: value };
      }
      return { ...prev, headerFields: fields };
    });
  };

  // Signatures Manipulations
  const handleAddSignature = () => {
    const newKey = `sig_${Date.now().toString().slice(-4)}`;
    updateActiveLayout((prev) => {
      const sigs = [...(prev.signatures || [])];
      sigs.push({
        key: newKey,
        label: 'Authorized Signatory',
        type: 'text'
      });
      return { ...prev, signatures: sigs };
    });
  };

  const handleRemoveSignature = (index) => {
    updateActiveLayout((prev) => {
      const sigs = [...(prev.signatures || [])];
      sigs.splice(index, 1);
      return { ...prev, signatures: sigs };
    });
  };

  const handleUpdateSignature = (index, prop, value) => {
    updateActiveLayout((prev) => {
      const sigs = [...(prev.signatures || [])];
      sigs[index] = { ...sigs[index], [prop]: value };
      return { ...prev, signatures: sigs };
    });
  };

  // Reset to Factory Preset
  const handleResetToPreset = () => {
    const defaultTheme = getDefaultThemeForDoc(selectedDocId);
    const schema = DEFAULT_DOCUMENT_SCHEMAS[selectedDocId] || DEFAULT_LAYOUT_SETTINGS;
    const cleanConfig = applyThemeToLayout({ ...schema, activeTheme: defaultTheme }, defaultTheme, selectedDocId);
    updateActiveLayout(cleanConfig);
    try {
      localStorage.removeItem(`fv_print_layout_${selectedDocId}`);
    } catch (e) {}
    appAlert?.(`Layout reset to factory defaults with recommended ${defaultTheme.toUpperCase()} theme.`);
  };

  // Save Settings to Supabase print_layout_settings table + LocalStorage + AppContext
  const handleSaveConfigurations = async () => {
    setSaving(true);
    try {
      const activeTheme = activeLayout.activeTheme || getDefaultThemeForDoc(selectedDocId);

      // 1. Supabase upsert
      const { error: dbError } = await supabase.from('print_layout_settings').upsert(
        {
          tenant_id: 'default_tenant',
          document_type: selectedDocId,
          active_theme_id: activeTheme,
          layout_config: activeLayout,
          customizations: {
            theme: activeTheme,
            paletteId: activeLayout.paletteId,
            paperSize: activeLayout.paperSize,
            orientation: activeLayout.orientation,
            margins: {
              top: activeLayout.marginTop,
              bottom: activeLayout.marginBottom,
              left: activeLayout.marginLeft,
              right: activeLayout.marginRight
            }
          },
          updated_at: new Date().toISOString()
        },
        { onConflict: 'tenant_id,document_type' }
      );

      if (dbError) {
        console.warn('Notice: Supabase save fallback to local state:', dbError.message);
      }

      // 2. AppContext State
      if (setCollection) {
        const currentPrintSettings = state?.adminSetup?.printSettings || {};
        const updatedDocLayouts = {
          ...(currentPrintSettings.documentLayouts || {}),
          [selectedDocId]: activeLayout
        };

        setCollection('adminSetup', {
          ...(state?.adminSetup || {}),
          printSettings: {
            ...currentPrintSettings,
            documentLayouts: updatedDocLayouts
          }
        });
      }

      // 3. LocalStorage persistence
      try {
        localStorage.setItem(`fv_print_layout_${selectedDocId}`, JSON.stringify(activeLayout));
      } catch (e) {}

      setShowSaveSuccess(true);
    } catch (err) {
      console.error('Exception saving print settings:', err);
      appAlert?.('Failed to save print configurations.');
    } finally {
      setSaving(false);
    }
  };

  // Live Sample Document Record (Issue 1: Guarantee Full Totals Block)
  const mockData = useMemo(() => {
    try {
      const fromState = getSampleRecordFromState ? getSampleRecordFromState(selectedDocId, state) : null;
      const fallback = getMockPreviewData(selectedDocId) || { header: {}, items: [], totals: {} };
      if (fromState) {
        return {
          ...fromState,
          header: { ...(fallback.header || {}), ...(fromState.header || {}) },
          items: (fromState.items && fromState.items.length > 0) ? fromState.items : (fallback.items || []),
          totals: { ...(fallback.totals || {}), ...(fromState.totals || {}) }
        };
      }
      return fallback;
    } catch (e) {
      console.error('Error computing mock data:', e);
      return getMockPreviewData(selectedDocId) || { header: {}, items: [], totals: {} };
    }
  }, [selectedDocId, state]);

  // Export handlers
  const handleExportPdf = async () => {
    if (!previewContainerRef.current) return;
    setExporting('pdf');
    const filename = `${selectedDocId.toUpperCase()}_PREVIEW.pdf`;
    await exportDocumentToPdf(previewContainerRef.current, filename, {
      paperSize: activeLayout.paperSize || 'A4',
      orientation: activeLayout.orientation || 'portrait'
    });
    setExporting(null);
  };

  const handleExportImage = async () => {
    if (!previewContainerRef.current) return;
    setExporting('img');
    const filename = `${selectedDocId.toUpperCase()}_PREVIEW.png`;
    await exportDocumentToImage(previewContainerRef.current, filename);
    setExporting(null);
  };

  const handleExportCsv = () => {
    setExporting('csv');
    const activeCols = (activeLayout.gridColumns || []).filter((c) => c.enabled !== false);
    const lineItems = mockData.items || mockData.lineItems || mockData.rows || [];
    const filename = `${selectedDocId.toUpperCase()}_DATA.csv`;
    exportDocumentToCsv(activeCols, lineItems, filename);
    setExporting(null);
  };

  const handlePrintTest = () => {
    window.print();
  };

  // Derive selected element details for Click-to-Edit Inspector (Issue 5)
  const selectedColKey = selectedElement?.type === 'column' 
    ? (selectedElement.data?.key || selectedElement.id?.replace(/^col_/, '')) 
    : null;
  const selectedColIndex = selectedColKey 
    ? (activeLayout.gridColumns || []).findIndex(c => c.key === selectedColKey) 
    : -1;
  const activeSelectedCol = selectedColIndex > -1 ? activeLayout.gridColumns[selectedColIndex] : (selectedElement?.data || null);

  const selectedFieldKey = selectedElement?.type === 'header_field' 
    ? (selectedElement.data?.key || selectedElement.id?.replace(/^header_/, '')) 
    : null;
  const selectedField = selectedFieldKey 
    ? (activeLayout.headerFields || []).find(f => f.key === selectedFieldKey) 
    : null;

  return (
    <>
      <div className="w-full bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans p-3 md:p-6 rounded-3xl min-h-[calc(100vh-5rem)] flex flex-col space-y-4 animate-fade-in border border-slate-200 dark:border-slate-800 shadow-sm">
        
        {/* ============================================================== */}
        {/* 1. TOP HEADER & WORKSPACE ACTION BAR                           */}
        {/* ============================================================== */}
        <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 md:p-5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-200 flex items-center justify-center font-bold border border-slate-700/80 shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[20px]">print</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 data-keep-color="true" className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                  Print & Report Designer Studio
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  33 Documents • 3 Archetypes
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configure enterprise document layouts, certified archetypes, typography, paper formats, and table columns.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={handleResetToPreset}
              className="h-9 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Reset current document layout to factory defaults"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">restart_alt</span>
              Reset to Default
            </button>

            <button
              type="button"
              onClick={handleSaveConfigurations}
              disabled={saving}
              className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">{saving ? 'sync' : 'save'}</span>
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </header>

        {/* ============================================================== */}
        {/* 2. 3-PANEL INTERACTIVE STUDIO GRID                             */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
          
          {/* ------------------------------------------------------------ */}
          {/* PANEL 1: LEFT DOCUMENT BROWSER & MODULE FILTERS (Col 3/12)   */}
          {/* ------------------------------------------------------------ */}
          <aside className="col-span-12 lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col h-[800px] overflow-hidden">
            {/* Header & Search */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Document Catalog
                </span>
                <span className="text-[10px] font-mono tabular-nums font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                  {filteredDocuments.length} / {SYSTEM_DOCUMENTS.length}
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-[16px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents or codes..."
                  className="h-8 w-full pl-8 pr-7 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-colors font-normal"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                )}
              </div>

              {/* Module Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                <button
                  onClick={() => setActiveModuleFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    activeModuleFilter === 'all'
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs font-semibold'
                      : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/80'
                  }`}
                >
                  All
                </button>
                {DOCUMENT_MODULES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveModuleFilter(m.id)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                      activeModuleFilter === m.id
                        ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs font-semibold'
                        : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/80'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">{m.icon}</span>
                    {m.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Document List Scrollable */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredDocuments.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                const docLayout = documentLayouts[doc.id] || DEFAULT_DOCUMENT_SCHEMAS[doc.id] || DEFAULT_LAYOUT_SETTINGS;
                const currentTheme = docLayout.activeTheme || getDefaultThemeForDoc(doc.id);
                const recommendedTheme = getDefaultThemeForDoc(doc.id);

                return (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectDocument(doc.id)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all border text-left flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-l-2 border-l-blue-600 border-slate-200 dark:border-slate-800 shadow-xs'
                        : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded font-mono tabular-nums font-bold text-[10px] shrink-0 uppercase ${
                        isSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80'
                      }`}>
                        {doc.code}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-xs font-medium leading-tight truncate ${isSelected ? 'text-blue-950 dark:text-white font-semibold' : 'text-slate-800 dark:text-slate-200'}`}>
                          {doc.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {currentTheme}
                          </span>
                          {currentTheme === recommendedTheme && (
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                              Recommended
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="material-symbols-outlined text-[16px] text-blue-600 dark:text-blue-400 shrink-0">
                        check
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ------------------------------------------------------------ */}
          {/* PANEL 2: CENTER LIVE A4 INTERACTIVE PREVIEW (Col 5/12)       */}
          {/* ------------------------------------------------------------ */}
          <main className="col-span-12 lg:col-span-5 bg-slate-100/90 dark:bg-slate-950 rounded-xl p-4 border border-slate-200/90 dark:border-slate-800 flex flex-col h-[800px] overflow-hidden shadow-xs">
            
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tracking-tight truncate max-w-[140px]">
                  {currentDocMeta.name}
                </span>
                <span className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-slate-600 dark:text-slate-400">
                  {activeLayout.paperSize || 'A4'} • {activeLayout.orientation || 'portrait'}
                </span>
              </div>

              {/* Zoom & Quick Print Controls */}
              <div className="flex items-center gap-1.5">
                <div className="inline-flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 h-7">
                  <button
                    onClick={() => setZoomScale(0.75)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${zoomScale === 0.75 ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                  >
                    75%
                  </button>
                  <button
                    onClick={() => setZoomScale(1)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${zoomScale === 1 ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                  >
                    100%
                  </button>
                  <button
                    onClick={() => setZoomScale(1.15)}
                    className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${zoomScale === 1.15 ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                  >
                    115%
                  </button>
                </div>

                {/* Print & Export Strip (Clean, uniform, monochromatic) */}
                <button
                  onClick={handlePrintTest}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="Print Document"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                </button>

                <button
                  onClick={handleExportPdf}
                  disabled={exporting === 'pdf'}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                  title="Download High-Res PDF"
                >
                  <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                </button>

                <button
                  onClick={handleExportImage}
                  disabled={exporting === 'img'}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                  title="Download High-Res Image"
                >
                  <span className="material-symbols-outlined text-[16px]">image</span>
                </button>

                <button
                  onClick={handleExportCsv}
                  disabled={exporting === 'csv'}
                  className="h-7 w-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                  title="Export CSV"
                >
                  <span className="material-symbols-outlined text-[16px]">table_view</span>
                </button>
              </div>
            </div>

            {/* Scrollable Paper Canvas */}
            <div 
              ref={previewContainerRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex justify-center items-start scrollbar-thin"
              style={{
                backgroundImage: 'radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            >
              <div style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}>
                <UnifiedPrintDocument
                  documentType={selectedDocId}
                  documentData={mockData}
                  layoutConfig={activeLayout}
                  companyInfo={companyInfo}
                  isPrintOnly={false}
                  interactive={true}
                  selectedElementId={selectedElement?.id}
                  onSelectElement={handleSelectElement}
                />
              </div>
            </div>
          </main>

          {/* ------------------------------------------------------------ */}
          {/* PANEL 3: RIGHT CUSTOMIZATION & THEME STUDIO (Col 4/12)       */}
          {/* ------------------------------------------------------------ */}
          <aside className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col h-[780px] overflow-hidden">
            
            {/* Top Sub-Tab Navigation Strip - Sleek horizontal scrollable pill bar */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-1.5 shrink-0">
              {[
                { id: 'themes', label: 'Themes', icon: 'style' },
                { id: 'palette', label: 'Palette & Fonts', icon: 'palette' },
                { id: 'paper', label: 'Paper & Margins', icon: 'aspect_ratio' },
                { id: 'header', label: 'Headers', icon: 'view_headline' },
                { id: 'columns', label: 'Columns', icon: 'view_column' },
                { id: 'floor', label: 'Shop Floor', icon: 'precision_manufacturing' },
                { id: 'totals', label: 'Totals & Sign', icon: 'calculate' },
                { id: 'advanced', label: 'Legal & Footer', icon: 'gavel' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveRightTab(tab.id)}
                  className={`whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                    activeRightTab === tab.id
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border border-slate-200/90 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Scrollable Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* ========================================================== */}
              {/* ACTIVE ELEMENT INSPECTOR (Issue 5: Click-to-Edit Studio)   */}
              {/* ========================================================== */}
              {selectedElement && (
                <div className="bg-gradient-to-br from-blue-50/90 to-indigo-50/60 dark:from-blue-950/40 dark:to-slate-900 border-2 border-blue-500/60 dark:border-blue-700 rounded-xl p-3.5 shadow-sm space-y-3 animate-fade-in shrink-0">
                  <div className="flex items-center justify-between pb-2 border-b border-blue-200/80 dark:border-blue-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        Editing {selectedElement.type.replace('_', ' ')}:
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {selectedElement.type === 'column'
                          ? (activeSelectedCol?.label || selectedColKey)
                          : selectedElement.type === 'header_field'
                          ? (selectedField?.label || selectedFieldKey)
                          : selectedElement.type === 'company'
                          ? 'Company Header'
                          : selectedElement.type === 'title'
                          ? 'Document Title'
                          : selectedElement.type === 'totals'
                          ? 'Totals Block'
                          : selectedElement.type === 'signatures'
                          ? 'Signatures Block'
                          : 'Footer / Terms'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedElement(null)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md hover:bg-white/60 dark:hover:bg-slate-800 cursor-pointer"
                      title="Close Inspector"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>

                  {/* COLUMN CONTROLS */}
                  {selectedElement.type === 'column' && activeSelectedCol && selectedColIndex > -1 && (
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Header Title
                        </label>
                        <input
                          type="text"
                          value={activeSelectedCol.label || activeSelectedCol.key}
                          onChange={(e) => updateColumnProperty(selectedColIndex, 'label', e.target.value)}
                          className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                          placeholder="Header Title"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Alignment
                          </label>
                          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 p-0.5 h-8">
                            {['left', 'center', 'right'].map((align) => (
                              <button
                                key={align}
                                type="button"
                                onClick={() => updateColumnProperty(selectedColIndex, 'align', align)}
                                className={`flex-1 h-full text-[10px] font-semibold rounded capitalize transition-all cursor-pointer ${
                                  (activeSelectedCol.align || 'left') === align
                                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                              >
                                {align}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Column Width
                          </label>
                          <input
                            type="text"
                            value={activeSelectedCol.width || '15%'}
                            onChange={(e) => updateColumnProperty(selectedColIndex, 'width', e.target.value)}
                            className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-center font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                            placeholder="e.g. 15% or 80px"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Font Size
                          </label>
                          <select
                            value={activeSelectedCol.fontSize || ''}
                            onChange={(e) => updateColumnProperty(selectedColIndex, 'fontSize', e.target.value)}
                            className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 text-[11px] font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Default</option>
                            <option value="9px">9px (Micro)</option>
                            <option value="10px">10px (Compact)</option>
                            <option value="11px">11px (Regular)</option>
                            <option value="12px">12px (Medium)</option>
                            <option value="13px">13px (Large)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Font Weight
                          </label>
                          <select
                            value={activeSelectedCol.fontWeight || ''}
                            onChange={(e) => updateColumnProperty(selectedColIndex, 'fontWeight', e.target.value)}
                            className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 text-[11px] font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Default</option>
                            <option value="normal">Normal</option>
                            <option value="medium">Medium</option>
                            <option value="semibold">SemiBold</option>
                            <option value="bold">Bold</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Text Wrap
                          </label>
                          <select
                            value={activeSelectedCol.wrap || 'wrap'}
                            onChange={(e) => updateColumnProperty(selectedColIndex, 'wrap', e.target.value)}
                            className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 text-[11px] font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="wrap">Wrap</option>
                            <option value="nowrap">NoWrap (Clip)</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeSelectedCol.enabled !== false}
                            onChange={() => toggleColumnVisibility(selectedColIndex)}
                            className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Show on Print</span>
                        </label>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveColumn(selectedColIndex, -1)}
                            disabled={selectedColIndex === 0}
                            className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10.5px] font-medium text-slate-700 dark:text-slate-300 disabled:opacity-40 flex items-center gap-0.5 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[13px]">arrow_upward</span> Left
                          </button>
                          <button
                            type="button"
                            onClick={() => moveColumn(selectedColIndex, 1)}
                            disabled={selectedColIndex === (activeLayout.gridColumns?.length || 1) - 1}
                            className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10.5px] font-medium text-slate-700 dark:text-slate-300 disabled:opacity-40 flex items-center gap-0.5 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[13px]">arrow_downward</span> Right
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* HEADER FIELD CONTROLS */}
                  {selectedElement.type === 'header_field' && selectedField && (
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          Field Label ({selectedFieldKey})
                        </label>
                        <input
                          type="text"
                          value={selectedField.label || selectedField.key}
                          onChange={(e) => updateHeaderFieldProp(selectedField.key, 'label', e.target.value)}
                          className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Width in Header Grid
                          </label>
                          <select
                            value={selectedField.width || 'span-1'}
                            onChange={(e) => updateHeaderFieldProp(selectedField.key, 'width', e.target.value)}
                            className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="span-1">1 Column (Default)</option>
                            <option value="span-2">2 Columns</option>
                            <option value="span-3">Full Width (3 Columns)</option>
                          </select>
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer pt-4">
                          <input
                            type="checkbox"
                            checked={selectedField.enabled !== false}
                            onChange={() => toggleHeaderField(selectedField.key)}
                            className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Show on Print</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* COMPANY HEADER CONTROLS */}
                  {selectedElement.type === 'company' && (
                    <div className="space-y-2 text-xs">
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        Company identity is retrieved from global settings. Configure logo appearance:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeLayout.showHeaderLogo !== false}
                            onChange={(e) => updateActiveLayout({ showHeaderLogo: e.target.checked })}
                            className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Show Logo</span>
                        </label>
                        <select
                          value={activeLayout.logoPosition || 'left'}
                          onChange={(e) => updateActiveLayout({ logoPosition: e.target.value })}
                          className="h-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 text-[11px]"
                        >
                          <option value="left">Align Left</option>
                          <option value="center">Align Center</option>
                          <option value="right">Align Right</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* TITLE CONTROLS */}
                  {selectedElement.type === 'title' && (
                    <div className="space-y-2 text-xs">
                      <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 block">
                        Custom Document Title
                      </label>
                      <input
                        type="text"
                        value={activeLayout.documentTitle || ''}
                        onChange={(e) => updateActiveLayout({ documentTitle: e.target.value })}
                        placeholder={currentDocMeta.name.toUpperCase()}
                        className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                    </div>
                  )}

                  {/* TOTALS CONTROLS */}
                  {selectedElement.type === 'totals' && (
                    <div className="space-y-2 text-xs">
                      <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 block">
                        Totals Placement
                      </label>
                      <select
                        value={activeLayout.totalsPosition || 'last_page'}
                        onChange={(e) => updateActiveLayout({ totalsPosition: e.target.value })}
                        className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      >
                        <option value="last_page">Last Page Only (Standard Corporate)</option>
                        <option value="every_page">Every Page Bottom (Running Cumulative)</option>
                      </select>
                    </div>
                  )}

                  {/* SIGNATURES CONTROLS */}
                  {selectedElement.type === 'signatures' && (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Signatory Authorization Blocks ({(activeLayout.signatures || []).length})
                        </span>
                        <button
                          type="button"
                          onClick={handleAddSignature}
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[13px]">add</span> Add Signatory
                        </button>
                      </div>
                    </div>
                  )}

                  {/* FOOTER CONTROLS */}
                  {selectedElement.type === 'footer' && (
                    <div className="space-y-2 text-xs">
                      <label className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 block">
                        Document Footer Line
                      </label>
                      <input
                        type="text"
                        value={activeLayout.customFooterText || ''}
                        onChange={(e) => updateActiveLayout({ customFooterText: e.target.value })}
                        placeholder="Computer Generated Document. Powered by Flashvision ERP."
                        className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                    </div>
                  )}
                </div>
              )}
              
              {/* ========================================================== */}
              {/* TAB 1: THEMES (3 DEDICATED ARCHETYPES)                      */}
              {/* ========================================================== */}
              {activeRightTab === 'themes' && (
                <div className="space-y-3.5 animate-fade-in">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                      Document Archetype
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Select one of the 3 engineered enterprise themes for this document:
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {Object.values(THEME_ARCHETYPES).map((theme) => {
                      const isCurrent = (activeLayout.activeTheme || 'classic') === theme.id;
                      const isRecommended = theme.id === getDefaultThemeForDoc(selectedDocId);

                      return (
                        <div
                          key={theme.id}
                          onClick={() => handleThemeChange(theme.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                            isCurrent
                              ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 ring-1 ring-blue-500/20 shadow-xs'
                              : 'bg-white dark:bg-slate-800/40 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`material-symbols-outlined text-[18px] ${isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                {theme.icon}
                              </span>
                              <h4 data-keep-color="true" className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                                {theme.name}
                              </h4>
                            </div>
                            {isRecommended && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                                Recommended
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-2.5">
                            {theme.tagline}
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <span>Best for: <strong className="text-slate-700 dark:text-slate-300 font-medium">{theme.bestFor.split(',')[0]}</strong></span>
                            {isCurrent && (
                              <span className="text-blue-600 dark:text-blue-400 font-semibold text-[11px] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span> Selected
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 2: PALETTE & TYPOGRAPHY                                 */}
              {/* ========================================================== */}
              {activeRightTab === 'palette' && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                      WCAG 2.1 AA/AAA Palettes
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2.5">
                      High-contrast ink profiles verified for razor-sharp physical printouts:
                    </p>

                    <div className="grid grid-cols-1 gap-2">
                      {CURATED_PALETTES.map((pal) => {
                        const isCurrent = (activeLayout.paletteId || 'navy_enterprise') === pal.id;
                        return (
                          <div
                            key={pal.id}
                            onClick={() => handlePaletteChange(pal)}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                              isCurrent
                                ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-500 ring-1 ring-blue-500/20 shadow-xs'
                                : 'bg-white dark:bg-slate-800/40 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Swatch preview */}
                              <div className="flex items-center rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs shrink-0">
                                <div className="w-5 h-5 flex items-center justify-center font-bold text-[9px]" style={{ backgroundColor: pal.headerBg, color: pal.headerText }}>
                                  H
                                </div>
                                <div className="w-3.5 h-5" style={{ backgroundColor: pal.primary }} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                                  {pal.name}
                                </span>
                                <span className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate block">
                                  {pal.description.split('with')[0]}
                                </span>
                              </div>
                            </div>

                            <span className="text-[9.5px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 px-1.5 py-0.5 rounded shrink-0">
                              AAA
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Typography Font Selector */}
                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Typography Font Family
                    </label>
                    <select
                      value={activeLayout.fontFamily || 'Inter'}
                      onChange={(e) => updateActiveLayout({ fontFamily: e.target.value })}
                      className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 shadow-xs"
                    >
                      {FONT_FAMILIES.map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Base Text Size */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Body & Table Font Scale
                    </label>
                    <select
                      value={activeLayout.bodyFontSize || '11px'}
                      onChange={(e) => updateActiveLayout({ bodyFontSize: e.target.value })}
                      className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 shadow-xs"
                    >
                      <option value="9px">9px (Ultra Compact Shop-Floor)</option>
                      <option value="10px">10px (Compact Manufacturing Standard)</option>
                      <option value="11px">11px (Executive Balance Standard)</option>
                      <option value="12px">12px (Spacious Large Print)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 3: PAPER & MARGINS                                     */}
              {/* ========================================================== */}
              {activeRightTab === 'paper' && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Paper Size Format
                    </label>
                    <select
                      value={activeLayout.paperSize || 'A4'}
                      onChange={(e) => updateActiveLayout({ paperSize: e.target.value })}
                      className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 shadow-xs"
                    >
                      <option value="A4">A4 (210 × 297 mm) — Standard International</option>
                      <option value="Letter">Letter (8.5 × 11 in) — North American Standard</option>
                      <option value="Thermal">Thermal POS (80 mm) — Gate Slip / Kitchen</option>
                      <option value="A5">A5 (148 × 210 mm) — Compact Half Sheet</option>
                      <option value="Legal">Legal (8.5 × 14 in) — Extended Contracts</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Orientation
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                      <button
                        onClick={() => updateActiveLayout({ orientation: 'portrait' })}
                        className={`h-8 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                          (activeLayout.orientation || 'portrait') === 'portrait'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-xs border border-slate-200/60 dark:border-slate-700'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">portrait</span>
                        Portrait
                      </button>
                      <button
                        onClick={() => updateActiveLayout({ orientation: 'landscape' })}
                        className={`h-8 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                          activeLayout.orientation === 'landscape'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-xs border border-slate-200/60 dark:border-slate-700'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">landscape</span>
                        Landscape
                      </button>
                    </div>
                  </div>

                  {/* Margins */}
                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                      Print Page Margins
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block mb-1">Top Margin:</span>
                        <input
                          type="text"
                          value={activeLayout.marginTop || '12mm'}
                          onChange={(e) => updateActiveLayout({ marginTop: e.target.value })}
                          className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 font-mono tabular-nums text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block mb-1">Bottom Margin:</span>
                        <input
                          type="text"
                          value={activeLayout.marginBottom || '12mm'}
                          onChange={(e) => updateActiveLayout({ marginBottom: e.target.value })}
                          className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 font-mono tabular-nums text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block mb-1">Left Margin:</span>
                        <input
                          type="text"
                          value={activeLayout.marginLeft || '12mm'}
                          onChange={(e) => updateActiveLayout({ marginLeft: e.target.value })}
                          className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 font-mono tabular-nums text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block mb-1">Right Margin:</span>
                        <input
                          type="text"
                          value={activeLayout.marginRight || '12mm'}
                          onChange={(e) => updateActiveLayout({ marginRight: e.target.value })}
                          className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 font-mono tabular-nums text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-Page Row Limits */}
                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">
                        Table Row Limits per Page
                      </label>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                        Line-item pagination rules for multi-page tables
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                        <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 block mb-0.5">
                          First page max rows
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={activeLayout.firstPageRows ?? 20}
                          onChange={(e) => updateActiveLayout({ firstPageRows: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                          className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 font-mono tabular-nums font-semibold text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                        />
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                        <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 block mb-0.5">
                          Following pages max
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={activeLayout.continuationPageRows ?? 25}
                          onChange={(e) => updateActiveLayout({ continuationPageRows: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                          className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 font-mono tabular-nums font-semibold text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 4: HEADER FIELDS                                       */}
              {/* ========================================================== */}
              {activeRightTab === 'header' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Company Logo Configuration Section */}
                  <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-blue-600 dark:text-blue-400">branding_watermark</span>
                        Company Logo
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeLayout.showHeaderLogo !== false}
                          onChange={(e) => updateActiveLayout({ showHeaderLogo: e.target.checked })}
                          className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Show on Print</span>
                      </label>
                    </div>

                    {/* Logo Preview or Clean Omission notice */}
                    <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                      {activeLayout.logoUrl || companyLogo ? (
                        <div className="flex items-center gap-3">
                          <img
                            src={activeLayout.logoUrl || companyLogo}
                            alt="Company Logo Preview"
                            className="h-10 max-h-10 max-w-[120px] object-contain rounded border border-slate-200 dark:border-slate-700 p-1 bg-white"
                          />
                          <div className="text-xs space-y-0.5">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">Logo Active</p>
                            <button
                              type="button"
                              onClick={() => {
                                updateActiveLayout({ logoUrl: '' });
                                if (setCollection) {
                                  setCollection('adminSetup', { ...(state?.adminSetup || {}), logo: '', logoUrl: '' });
                                }
                              }}
                              className="text-[11px] font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
                            >
                              Remove Logo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-slate-400">hide_image</span>
                          <span>No logo configured — clean omission on prints (no placeholder box).</span>
                        </div>
                      )}
                    </div>

                    {/* Upload New Logo */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Upload Logo File (PNG, JPG, SVG, WebP):
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
                              updateActiveLayout({ logoUrl: dataUrl, showHeaderLogo: true });
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
                        className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 hover:file:bg-slate-200 file:text-slate-700 dark:file:bg-slate-800 dark:file:text-slate-200 cursor-pointer"
                      />
                    </div>

                    {/* Logo Size and Position Controls */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[10.5px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Logo Size
                        </label>
                        <select
                          value={activeLayout.logoSize || 'medium'}
                          onChange={(e) => updateActiveLayout({ logoSize: e.target.value })}
                          className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                        >
                          <option value="small">Small (32px)</option>
                          <option value="medium">Medium (48px)</option>
                          <option value="large">Large (64px)</option>
                          <option value="xl">Extra Large (80px)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Alignment
                        </label>
                        <select
                          value={activeLayout.logoPosition || 'left'}
                          onChange={(e) => updateActiveLayout({ logoPosition: e.target.value })}
                          className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                        >
                          <option value="left">Left Aligned</option>
                          <option value="center">Center</option>
                          <option value="right">Right Aligned</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                      Header Metadata Fields
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2.5">
                      Toggle, rename, and set grid layout for header information blocks:
                    </p>
                  </div>

                  <div className="space-y-2">
                    {(activeLayout.headerFields || []).map((field) => {
                      const isFieldSelected = selectedFieldKey === field.key;
                      return (
                        <div
                          key={field.key}
                          className={`p-2.5 rounded-xl border space-y-2 transition-all ${
                            isFieldSelected
                              ? 'ring-2 ring-blue-500 bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 shadow-xs'
                              : field.enabled !== false
                              ? 'bg-white dark:bg-slate-800/40 border-slate-200/90 dark:border-slate-800'
                              : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/40 opacity-60'
                          }`}
                        >
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.enabled !== false}
                              onChange={() => toggleHeaderField(field.key)}
                              className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {field.key}
                            </span>
                          </label>

                          <select
                            value={field.width || 'span-1'}
                            onChange={(e) => updateHeaderFieldProp(field.key, 'width', e.target.value)}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-0.5 text-[10.5px] font-medium text-slate-700 dark:text-slate-300"
                          >
                            <option value="span-1">1 Col</option>
                            <option value="span-2">2 Cols</option>
                            <option value="span-3">Full Width (3 Cols)</option>
                          </select>
                        </div>

                        <input
                          type="text"
                          value={field.label || field.key}
                          onChange={(e) => updateHeaderFieldProp(field.key, 'label', e.target.value)}
                          className="w-full h-8 bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                          placeholder="Display Label"
                        />
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 5: TABLE COLUMNS                                       */}
              {/* ========================================================== */}
              {activeRightTab === 'columns' && (
                <div className="space-y-3.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                        Table Columns
                      </span>
                      <p className="text-xs text-slate-600 dark:text-slate-400">Reorder, rename, align, and size columns:</p>
                    </div>
                    <button
                      onClick={handleAddCustomColumn}
                      className="h-7 px-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span> Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(activeLayout.gridColumns || []).map((col, idx) => {
                      const isColSelected = selectedColKey === col.key;
                      return (
                        <div
                          key={col.key || idx}
                          className={`p-2.5 rounded-xl border space-y-2 transition-all ${
                            isColSelected
                              ? 'ring-2 ring-blue-500 bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 shadow-xs'
                              : col.enabled !== false
                              ? 'bg-white dark:bg-slate-800/40 border-slate-200/90 dark:border-slate-800'
                              : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/40 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={col.enabled !== false}
                                onChange={() => toggleColumnVisibility(idx)}
                                className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {col.key}
                              </span>
                            </label>

                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => moveColumn(idx, -1)}
                                disabled={idx === 0}
                                className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                title="Move Up"
                              >
                                <span className="material-symbols-outlined text-[15px]">arrow_upward</span>
                              </button>
                              <button
                                onClick={() => moveColumn(idx, 1)}
                                disabled={idx === (activeLayout.gridColumns?.length || 1) - 1}
                                className="p-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                                title="Move Down"
                              >
                                <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={col.label || col.key}
                              onChange={(e) => updateColumnProperty(idx, 'label', e.target.value)}
                              className="h-8 bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 font-medium"
                              placeholder="Header Title"
                            />
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={col.width || '15%'}
                                onChange={(e) => updateColumnProperty(idx, 'width', e.target.value)}
                                className="w-14 h-8 bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 text-xs font-mono tabular-nums text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 font-medium"
                                placeholder="Width"
                              />
                              <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800/80 p-0.5">
                                {['left', 'center', 'right'].map((align) => (
                                  <button
                                    key={align}
                                    onClick={() => updateColumnProperty(idx, 'align', align)}
                                    className={`px-1.5 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
                                      (col.align || 'left') === align
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                    title={`Align ${align}`}
                                  >
                                    {align === 'left' ? 'L' : align === 'center' ? 'C' : 'R'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-[10px]">
                            <select
                              value={col.fontSize || ''}
                              onChange={(e) => updateColumnProperty(idx, 'fontSize', e.target.value)}
                              className="h-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 text-slate-700 dark:text-slate-300 font-medium"
                            >
                              <option value="">Font: Auto</option>
                              <option value="9px">9px (Micro)</option>
                              <option value="10px">10px (Small)</option>
                              <option value="11px">11px (Normal)</option>
                              <option value="12px">12px (Medium)</option>
                              <option value="13px">13px (Large)</option>
                            </select>
                            <select
                              value={col.fontWeight || ''}
                              onChange={(e) => updateColumnProperty(idx, 'fontWeight', e.target.value)}
                              className="h-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 text-slate-700 dark:text-slate-300 font-medium"
                            >
                              <option value="">Weight: Auto</option>
                              <option value="normal">Normal</option>
                              <option value="medium">Medium</option>
                              <option value="semibold">SemiBold</option>
                              <option value="bold">Bold</option>
                            </select>
                            <select
                              value={col.wrap || 'wrap'}
                              onChange={(e) => updateColumnProperty(idx, 'wrap', e.target.value)}
                              className="h-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 text-slate-700 dark:text-slate-300 font-medium"
                            >
                              <option value="wrap">Wrap</option>
                              <option value="nowrap">NoWrap</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 6: SHOP FLOOR & MANUFACTURING CONTROLS                 */}
              {/* ========================================================== */}
              {activeRightTab === 'floor' && (
                <div className="space-y-3.5 animate-fade-in">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                      Shop-Floor Controls
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2.5">
                      Functional modules for factory floor execution, work orders, and batch tracking:
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <label className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/60 flex items-center justify-between cursor-pointer transition-colors">
                      <div className="pr-3">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                          Physical Checkbox Column [✓]
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Adds printed square check-boxes for floor operator tick-offs
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeLayout.enableFloorCheckboxes !== false}
                        onChange={(e) => updateActiveLayout({ enableFloorCheckboxes: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>

                    <label className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/60 flex items-center justify-between cursor-pointer transition-colors">
                      <div className="pr-3">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                          Machine & Shift Allocation Matrix
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Shows Line, Shift, Operator in-charge, and Target Yield
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeLayout.showMachineAllocation !== false}
                        onChange={(e) => updateActiveLayout({ showMachineAllocation: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>

                    <label className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/60 flex items-center justify-between cursor-pointer transition-colors">
                      <div className="pr-3">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                          Monochrome Ink-Saver Mode
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Removes heavy header ink tints; safe for fast black-and-white laser printers
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeLayout.inkSaverMode === true}
                        onChange={(e) => updateActiveLayout({ 
                          inkSaverMode: e.target.checked,
                          tableHeaderBgColor: e.target.checked ? '#FFFFFF' : '#004277',
                          tableHeaderTextColor: e.target.checked ? '#000000' : '#FFFFFF'
                        })}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 7: TOTALS & SIGNATURES                                 */}
              {/* ========================================================== */}
              {activeRightTab === 'totals' && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                      Totals Breakdown
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2.5">
                      Configure summary position and signatory authorization blocks:
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Totals Placement
                    </label>
                    <select
                      value={activeLayout.totalsPosition || 'last_page'}
                      onChange={(e) => updateActiveLayout({ totalsPosition: e.target.value })}
                      className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 shadow-xs"
                    >
                      <option value="last_page">Last Page Only (Standard Corporate)</option>
                      <option value="every_page">Every Page Bottom (Running Cumulative)</option>
                    </select>
                  </div>

                  {/* Signatures Manager */}
                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Signatures & Approvals
                      </span>
                      <button
                        onClick={handleAddSignature}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span> Add Signatory
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(activeLayout.signatures || []).map((sig, sIdx) => (
                        <div key={sig.key || sIdx} className="flex items-center gap-2 bg-white dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200/90 dark:border-slate-800">
                          <input
                            type="text"
                            value={sig.label || ''}
                            onChange={(e) => handleUpdateSignature(sIdx, 'label', e.target.value)}
                            className="flex-1 h-8 bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500"
                            placeholder="Signatory Label (e.g. Authorized Signatory)"
                          />
                          <select
                            value={sig.type || 'text'}
                            onChange={(e) => handleUpdateSignature(sIdx, 'type', e.target.value)}
                            className="h-8 bg-slate-50/60 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-[11px] font-medium text-slate-700 dark:text-slate-300"
                          >
                            <option value="text">Line</option>
                            <option value="stamp">Stamp</option>
                          </select>
                          <button
                            onClick={() => handleRemoveSignature(sIdx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Remove Signatory"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 8: LEGAL & FOOTER                                      */}
              {/* ========================================================== */}
              {activeRightTab === 'advanced' && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Terms & Standard Operating Conditions
                    </label>
                    <textarea
                      rows={4}
                      value={activeLayout.termsConditions || ''}
                      onChange={(e) => updateActiveLayout({ termsConditions: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs font-normal text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 leading-relaxed shadow-xs"
                      placeholder="e.g. Goods once sold will not be taken back without QA clearance..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                      Computer-Generated Document Footer Line
                    </label>
                    <input
                      type="text"
                      value={activeLayout.customFooterText || ''}
                      onChange={(e) => updateActiveLayout({ customFooterText: e.target.value })}
                      className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 font-mono text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500 shadow-xs"
                      placeholder="Computer Generated Document. Powered by Flashvision ERP."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm flex items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2 py-0.5 rounded truncate">
                Doc: {currentDocMeta.code}
              </span>

              <button
                onClick={handleSaveConfigurations}
                disabled={saving}
                className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px]">{saving ? 'sync' : 'save'}</span>
                <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </aside>
        </div>

        {/* ============================================================== */}
        {/* 3. SAVE SUCCESS POPUP MODAL                                    */}
        {/* ============================================================== */}
        {showSaveSuccess && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-xl space-y-4 border border-slate-200 dark:border-slate-800 animate-scale-in">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-100 dark:border-emerald-900/80">
                <span className="material-symbols-outlined text-[26px]">check</span>
              </div>
              <div className="space-y-1">
                <h3 data-keep-color="true" className="text-base font-semibold text-slate-900 dark:text-white">
                  Print Settings Saved
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Layout and theme for <strong className="font-semibold text-slate-800 dark:text-slate-200">{currentDocMeta.name}</strong> have been updated and persisted to the ERP database.
                </p>
              </div>
              <button
                onClick={() => setShowSaveSuccess(false)}
                className="w-full h-9 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-xs font-semibold transition-all shadow-xs"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
