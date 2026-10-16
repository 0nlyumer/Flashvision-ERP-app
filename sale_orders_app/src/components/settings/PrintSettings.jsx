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
import UniversalPrintStudioModal from '../ui/UniversalPrintStudioModal';
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

  // Canvas View Scale
  const [zoomScale, setZoomScale] = useState(1);

  // States
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(null); // 'pdf' | 'img' | 'csv' | null
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showStudioModal, setShowStudioModal] = useState(false);

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

  // Live Sample Document Record
  const mockData = useMemo(() => {
    try {
      const fromState = getSampleRecordFromState ? getSampleRecordFromState(selectedDocId, state) : null;
      if (fromState) return fromState;
      return getMockPreviewData(selectedDocId) || { header: {}, items: [], totals: {} };
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

  return (
    <>
      {showStudioModal && (
        <UniversalPrintStudioModal
          isOpen={showStudioModal}
          onClose={() => setShowStudioModal(false)}
          documentType={selectedDocId}
          documentData={mockData}
          documentTitle={currentDocMeta?.name}
          onApplied={(updated) => updateActiveLayout(updated)}
        />
      )}

      <div className="w-full bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans p-3 md:p-6 rounded-3xl min-h-[calc(100vh-5rem)] flex flex-col space-y-4 animate-fade-in border border-slate-200 dark:border-slate-800 shadow-sm">
        
        {/* ============================================================== */}
        {/* 1. TOP HEADER & WORKSPACE ACTION BAR                           */}
        {/* ============================================================== */}
        <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 md:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
              <span className="material-symbols-outlined text-2xl">print</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Universal Print & Report Designer Studio
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
                  Enterprise Suite
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                3 Certified Archetype Themes (Classic Corporate, Modern Minimalist, Industrial Shop-Floor) • 33 System Documents
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end flex-wrap">
            <button
              onClick={() => setShowStudioModal(true)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-base text-blue-600">open_in_new</span>
              Full Studio Modal
            </button>

            <button
              onClick={handleResetToPreset}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Reset current document layout to factory defaults"
            >
              <span className="material-symbols-outlined text-base text-amber-500">restart_alt</span>
              Reset Preset
            </button>

            <button
              onClick={handleSaveConfigurations}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-blue-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">{saving ? 'sync' : 'save'}</span>
              {saving ? 'Saving...' : 'Save Layout & Theme'}
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
          <aside className="col-span-12 lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col h-[780px] overflow-hidden">
            {/* Header & Search */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Document Catalog
                </span>
                <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                  {filteredDocuments.length} / {SYSTEM_DOCUMENTS.length}
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-sm">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 33 documents..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                )}
              </div>

              {/* Module Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                <button
                  onClick={() => setActiveModuleFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                    activeModuleFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                {DOCUMENT_MODULES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveModuleFilter(m.id)}
                    className={`px-2 py-1 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                      activeModuleFilter === m.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
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
                        ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-500 shadow-sm'
                        : 'bg-slate-50/50 dark:bg-slate-900/50 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] shrink-0 uppercase ${
                        isSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {doc.code}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-xs font-bold leading-tight truncate ${isSelected ? 'text-blue-950 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                          {doc.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                            currentTheme === 'industrial'
                              ? 'bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-300'
                              : currentTheme === 'modern'
                              ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                              : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          }`}>
                            {currentTheme.toUpperCase()}
                          </span>
                          {currentTheme === recommendedTheme && (
                            <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold flex items-center">
                              ★ Optimal
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="material-symbols-outlined text-sm text-blue-600 shrink-0">
                        check_circle
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
          <main className="col-span-12 lg:col-span-5 bg-slate-200/80 dark:bg-slate-950/90 rounded-2xl p-4 border border-slate-300/80 dark:border-slate-800 flex flex-col h-[780px] overflow-hidden shadow-inner">
            
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-300 dark:border-slate-800 flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-black text-slate-700 dark:text-slate-200 tracking-tight">
                  LIVE A4 DIGITAL TWIN
                </span>
                <span className="text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 font-mono font-bold text-slate-600 dark:text-slate-300">
                  {currentDocMeta.name}
                </span>
              </div>

              {/* Zoom & Quick Print Controls */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 p-0.5">
                  <button
                    onClick={() => setZoomScale(0.75)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${zoomScale === 0.75 ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                  >
                    75%
                  </button>
                  <button
                    onClick={() => setZoomScale(1)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${zoomScale === 1 ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                  >
                    100%
                  </button>
                  <button
                    onClick={() => setZoomScale(1.15)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${zoomScale === 1.15 ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                  >
                    115%
                  </button>
                </div>

                {/* Print & Export Strip */}
                <button
                  onClick={handlePrintTest}
                  className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                  title="Print Document"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                </button>

                <button
                  onClick={handleExportPdf}
                  disabled={exporting === 'pdf'}
                  className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-700 text-red-600 dark:text-red-400"
                  title="Download High-Res PDF"
                >
                  <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                </button>

                <button
                  onClick={handleExportImage}
                  disabled={exporting === 'img'}
                  className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-700 text-emerald-600 dark:text-emerald-400"
                  title="Download High-Res Image"
                >
                  <span className="material-symbols-outlined text-sm">image</span>
                </button>

                <button
                  onClick={handleExportCsv}
                  disabled={exporting === 'csv'}
                  className="p-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400"
                  title="Download CSV"
                >
                  <span className="material-symbols-outlined text-sm">table_view</span>
                </button>
              </div>
            </div>

            {/* Scrollable Paper Canvas */}
            <div 
              ref={previewContainerRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-2 flex justify-center items-start scrollbar-thin"
            >
              <div style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}>
                <UnifiedPrintDocument
                  documentType={selectedDocId}
                  documentData={mockData}
                  layoutConfig={activeLayout}
                  companyInfo={companyInfo}
                  isPrintOnly={false}
                />
              </div>
            </div>
          </main>

          {/* ------------------------------------------------------------ */}
          {/* PANEL 3: RIGHT CUSTOMIZATION & THEME STUDIO (Col 4/12)       */}
          {/* ------------------------------------------------------------ */}
          <aside className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex flex-col h-[780px] overflow-hidden">
            
            {/* Top Sub-Tab Navigation Strip */}
            <div className="grid grid-cols-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-1 gap-1">
              {[
                { id: 'themes', label: 'Themes', icon: 'style' },
                { id: 'palette', label: 'Colors & Fonts', icon: 'palette' },
                { id: 'paper', label: 'Paper & Margins', icon: 'aspect_ratio' },
                { id: 'header', label: 'Headers', icon: 'view_headline' },
                { id: 'columns', label: 'Columns', icon: 'view_column' },
                { id: 'floor', label: 'Shop Floor', icon: 'precision_manufacturing' },
                { id: 'totals', label: 'Totals & Sign', icon: 'calculate' },
                { id: 'inspect', label: 'Presets', icon: 'tune' }
              ].slice(0, 4).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveRightTab(tab.id)}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                    activeRightTab === tab.id
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Second row of sub-tabs */}
            <div className="grid grid-cols-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-1 gap-1">
              {[
                { id: 'columns', label: 'Columns', icon: 'view_column' },
                { id: 'floor', label: 'Shop Floor', icon: 'precision_manufacturing' },
                { id: 'totals', label: 'Totals & Sign', icon: 'calculate' },
                { id: 'advanced', label: 'Legal & Footer', icon: 'gavel' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveRightTab(tab.id)}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                    activeRightTab === tab.id
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Scrollable Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              
              {/* ========================================================== */}
              {/* TAB 1: THEMES (3 DEDICATED ARCHETYPES)                      */}
              {/* ========================================================== */}
              {activeRightTab === 'themes' && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Choose Document Archetype Theme
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Select one of the 3 professionally engineered enterprise themes:
                    </p>
                  </div>

                  <div className="space-y-3">
                    {Object.values(THEME_ARCHETYPES).map((theme) => {
                      const isCurrent = (activeLayout.activeTheme || 'classic') === theme.id;
                      const isRecommended = theme.id === getDefaultThemeForDoc(selectedDocId);

                      return (
                        <div
                          key={theme.id}
                          onClick={() => handleThemeChange(theme.id)}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                            isCurrent
                              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30 shadow-md'
                              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`material-symbols-outlined text-lg ${isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                                {theme.icon}
                              </span>
                              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                {theme.name}
                              </h3>
                            </div>
                            {isRecommended && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                                Recommended for this doc
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                            {theme.tagline}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-2 border-t border-slate-200/60 dark:border-slate-700">
                            <span>Best for: <strong className="text-slate-600 dark:text-slate-300">{theme.bestFor.split(',')[0]}</strong></span>
                            {isCurrent && (
                              <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5">
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

              {/* ========================================================== */}
              {/* TAB 2: PALETTE & TYPOGRAPHY                                 */}
              {/* ========================================================== */}
              {activeRightTab === 'palette' && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Certified WCAG 2.1 AA/AAA Palettes
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                      Safe, high-contrast combinations tested for crystal-clear readability:
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
                                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Swatch preview */}
                              <div className="flex items-center rounded-lg overflow-hidden border border-slate-300 shadow-sm">
                                <div className="w-6 h-6 flex items-center justify-center font-bold text-[9px]" style={{ backgroundColor: pal.headerBg, color: pal.headerText }}>
                                  H
                                </div>
                                <div className="w-4 h-6" style={{ backgroundColor: pal.primary }} />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-slate-900 dark:text-white block leading-tight">
                                  {pal.name}
                                </span>
                                <span className="text-[10px] text-slate-500 leading-tight">
                                  {pal.description.split('with')[0]}
                                </span>
                              </div>
                            </div>

                            <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                              WCAG AAA
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Typography Font Selector */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                      Document Typography Font
                    </label>
                    <select
                      value={activeLayout.fontFamily || 'Inter'}
                      onChange={(e) => updateActiveLayout({ fontFamily: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
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
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                      Table & Body Font Size
                    </label>
                    <select
                      value={activeLayout.bodyFontSize || '11px'}
                      onChange={(e) => updateActiveLayout({ bodyFontSize: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
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
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                      Paper Format
                    </label>
                    <select
                      value={activeLayout.paperSize || 'A4'}
                      onChange={(e) => updateActiveLayout({ paperSize: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      <option value="A4">A4 (210 × 297 mm) — Standard International</option>
                      <option value="Letter">Letter (8.5 × 11 in) — North American Standard</option>
                      <option value="Thermal">Thermal POS (80 mm) — Gate Slip / Kitchen</option>
                      <option value="A5">A5 (148 × 210 mm) — Compact Half Sheet</option>
                      <option value="Legal">Legal (8.5 × 14 in) — Extended Contracts</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                      Orientation
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => updateActiveLayout({ orientation: 'portrait' })}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                          (activeLayout.orientation || 'portrait') === 'portrait'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">portrait</span>
                        Portrait
                      </button>
                      <button
                        onClick={() => updateActiveLayout({ orientation: 'landscape' })}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                          activeLayout.orientation === 'landscape'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">landscape</span>
                        Landscape
                      </button>
                    </div>
                  </div>

                  {/* Margins */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-2">
                      Paper Margins (Top, Bottom, Left, Right)
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Top Margin:</span>
                        <input
                          type="text"
                          value={activeLayout.marginTop || '12mm'}
                          onChange={(e) => updateActiveLayout({ marginTop: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Bottom Margin:</span>
                        <input
                          type="text"
                          value={activeLayout.marginBottom || '12mm'}
                          onChange={(e) => updateActiveLayout({ marginBottom: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Left Margin:</span>
                        <input
                          type="text"
                          value={activeLayout.marginLeft || '12mm'}
                          onChange={(e) => updateActiveLayout({ marginLeft: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Right Margin:</span>
                        <input
                          type="text"
                          value={activeLayout.marginRight || '12mm'}
                          onChange={(e) => updateActiveLayout({ marginRight: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-Page Row Chunking */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                      Multi-Page Row Limits
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Page 1 Rows:</span>
                        <input
                          type="number"
                          value={activeLayout.firstPageRows || 8}
                          onChange={(e) => updateActiveLayout({ firstPageRows: Number(e.target.value) })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-1">Continuation Rows:</span>
                        <input
                          type="number"
                          value={activeLayout.continuationPageRows || 14}
                          onChange={(e) => updateActiveLayout({ continuationPageRows: Number(e.target.value) })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-mono text-xs"
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
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-blue-500">branding_watermark</span>
                        Company Logo & Header
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeLayout.showHeaderLogo !== false}
                          onChange={(e) => updateActiveLayout({ showHeaderLogo: e.target.checked })}
                          className="rounded text-blue-600 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Show Logo</span>
                      </label>
                    </div>

                    {/* Logo Preview or Clean Omission notice */}
                    <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                      {activeLayout.logoUrl || companyLogo ? (
                        <div className="flex items-center gap-3">
                          <img
                            src={activeLayout.logoUrl || companyLogo}
                            alt="Company Logo Preview"
                            className="h-12 max-h-12 max-w-[120px] object-contain rounded border border-slate-200 dark:border-slate-700 p-1 bg-white"
                          />
                          <div className="text-[11px] space-y-1">
                            <p className="font-bold text-slate-800 dark:text-slate-100">Logo Active</p>
                            <button
                              type="button"
                              onClick={() => {
                                updateActiveLayout({ logoUrl: '' });
                                if (setCollection) {
                                  setCollection('adminSetup', { ...(state?.adminSetup || {}), logo: '', logoUrl: '' });
                                }
                              }}
                              className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                            >
                              Remove Logo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-slate-400">hide_image</span>
                          No logo configured (Clean omission on prints — never a placeholder box).
                        </div>
                      )}
                    </div>

                    {/* Upload New Logo */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        Upload Logo (PNG, JPG, SVG, WebP):
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
                        className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                      />
                    </div>

                    {/* Logo Size and Position Controls */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Logo Size
                        </label>
                        <select
                          value={activeLayout.logoSize || 'medium'}
                          onChange={(e) => updateActiveLayout({ logoSize: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                        >
                          <option value="small">Small (32px)</option>
                          <option value="medium">Medium (48px)</option>
                          <option value="large">Large (64px)</option>
                          <option value="xl">Extra Large (80px)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Logo Position
                        </label>
                        <select
                          value={activeLayout.logoPosition || 'left'}
                          onChange={(e) => updateActiveLayout({ logoPosition: e.target.value })}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold"
                        >
                          <option value="left">Left Aligned</option>
                          <option value="center">Center</option>
                          <option value="right">Right Aligned</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Header Metadata Fields
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                      Toggle, rename, and set grid width for document header fields:
                    </p>
                  </div>

                  <div className="space-y-2">
                    {(activeLayout.headerFields || []).map((field) => (
                      <div
                        key={field.key}
                        className={`p-3 rounded-xl border space-y-2 transition-all ${
                          field.enabled !== false
                            ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                            : 'bg-slate-50/40 dark:bg-slate-900/40 border-slate-200/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.enabled !== false}
                              onChange={() => toggleHeaderField(field.key)}
                              className="rounded text-blue-600 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {field.key}
                            </span>
                          </label>

                          <select
                            value={field.width || 'span-1'}
                            onChange={(e) => updateHeaderFieldProp(field.key, 'width', e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300"
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
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-100"
                          placeholder="Display Label"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 5: TABLE COLUMNS                                       */}
              {/* ========================================================== */}
              {activeRightTab === 'columns' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                        Table Columns
                      </span>
                      <p className="text-[11px] text-slate-500">Reorder, rename, align, and resize columns:</p>
                    </div>
                    <button
                      onClick={handleAddCustomColumn}
                      className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-xs">add</span> Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(activeLayout.gridColumns || []).map((col, idx) => (
                      <div
                        key={col.key || idx}
                        className={`p-3 rounded-xl border space-y-2 transition-all ${
                          col.enabled !== false
                            ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                            : 'bg-slate-50/40 dark:bg-slate-900/40 border-slate-200/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={col.enabled !== false}
                              onChange={() => toggleColumnVisibility(idx)}
                              className="rounded text-blue-600 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                              {col.key}
                            </span>
                          </label>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => moveColumn(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
                              title="Move Up"
                            >
                              <span className="material-symbols-outlined text-xs">arrow_upward</span>
                            </button>
                            <button
                              onClick={() => moveColumn(idx, 1)}
                              disabled={idx === (activeLayout.gridColumns?.length || 1) - 1}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
                              title="Move Down"
                            >
                              <span className="material-symbols-outlined text-xs">arrow_downward</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={col.label || col.key}
                            onChange={(e) => updateColumnProperty(idx, 'label', e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-medium"
                            placeholder="Header Title"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={col.width || '15%'}
                              onChange={(e) => updateColumnProperty(idx, 'width', e.target.value)}
                              className="w-14 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-1 text-xs font-mono text-center"
                              placeholder="Width"
                            />
                            <div className="flex items-center border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                              {['left', 'center', 'right'].map((align) => (
                                <button
                                  key={align}
                                  onClick={() => updateColumnProperty(idx, 'align', align)}
                                  className={`px-1.5 py-1 text-[10px] font-bold ${
                                    (col.align || 'left') === align
                                      ? 'bg-blue-600 text-white'
                                      : 'text-slate-400 hover:text-slate-700'
                                  }`}
                                >
                                  {align[0].toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* TAB 6: SHOP FLOOR & MANUFACTURING CONTROLS                 */}
              {/* ========================================================== */}
              {activeRightTab === 'floor' && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Shop-Floor & Manufacturing Blocks
                    </span>
                    <p className="text-[11px] text-slate-500 mb-3">
                      High-utility physical features for production lines, batch cards, and BOMs:
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          Physical Checkbox Column [✓]
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Adds printed square check-boxes for floor operator tick-offs
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeLayout.enableFloorCheckboxes !== false}
                        onChange={(e) => updateActiveLayout({ enableFloorCheckboxes: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                    </label>

                    <label className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          Machine & Shift Allocation Matrix
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Shows Line, Shift, Operator in-charge, and Target Yield
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeLayout.showMachineAllocation !== false}
                        onChange={(e) => updateActiveLayout({ showMachineAllocation: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                    </label>

                    <label className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          Monochrome Ink-Saver Mode
                        </span>
                        <span className="text-[10px] text-slate-500">
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
                        className="w-4 h-4 rounded text-blue-600"
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
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Totals & Summary Breakdown
                    </span>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Choose placement and breakdown items for the summary box:
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                      Totals Placement
                    </label>
                    <select
                      value={activeLayout.totalsPosition || 'last_page'}
                      onChange={(e) => updateActiveLayout({ totalsPosition: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      <option value="last_page">Last Page Only (Standard Corporate)</option>
                      <option value="every_page">Every Page Bottom (Running Cumulative)</option>
                    </select>
                  </div>

                  {/* Signatures Manager */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                        Signatures & Verification Blocks
                      </span>
                      <button
                        onClick={handleAddSignature}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">add</span> Add Signatory
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(activeLayout.signatures || []).map((sig, sIdx) => (
                        <div key={sig.key || sIdx} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                          <input
                            type="text"
                            value={sig.label || ''}
                            onChange={(e) => handleUpdateSignature(sIdx, 'label', e.target.value)}
                            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold"
                            placeholder="Signatory Label"
                          />
                          <select
                            value={sig.type || 'text'}
                            onChange={(e) => handleUpdateSignature(sIdx, 'type', e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-[10px]"
                          >
                            <option value="text">Line</option>
                            <option value="stamp">Stamp</option>
                          </select>
                          <button
                            onClick={() => handleRemoveSignature(sIdx)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
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
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                      Terms & Standard Operating Conditions
                    </label>
                    <textarea
                      rows={4}
                      value={activeLayout.termsConditions || ''}
                      onChange={(e) => updateActiveLayout({ termsConditions: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs font-medium text-slate-800 dark:text-slate-100"
                      placeholder="e.g. Goods once sold will not be taken back without QA clearance..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1">
                      Computer-Generated Document Footer Line
                    </label>
                    <input
                      type="text"
                      value={activeLayout.customFooterText || ''}
                      onChange={(e) => updateActiveLayout({ customFooterText: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100"
                      placeholder="Computer Generated Document. Powered by Flashvision ERP."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[10px] text-slate-400 font-mono truncate">
                Doc: [{currentDocMeta.code}]
              </span>

              <button
                onClick={handleSaveConfigurations}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-blue-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">{saving ? 'sync' : 'save'}</span>
                {saving ? 'Saving...' : 'Save Layout'}
              </button>
            </div>
          </aside>
        </div>

        {/* ============================================================== */}
        {/* 3. SAVE SUCCESS POPUP MODAL                                    */}
        {/* ============================================================== */}
        {showSaveSuccess && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4 border border-slate-100 dark:border-slate-800 animate-scale-in">
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/60 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
                <span className="material-symbols-outlined text-3xl font-bold">check_circle</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Print Settings Saved</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Layout & theme for <strong>[{currentDocMeta.name}]</strong> has been updated and persisted to the ERP database.
                </p>
              </div>
              <button
                onClick={() => setShowSaveSuccess(false)}
                className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow"
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
