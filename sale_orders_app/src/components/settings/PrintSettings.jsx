import React, { useState, useEffect, useMemo } from 'react';
import UniversalPrintStudioModal from '../ui/UniversalPrintStudioModal';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import { supabase } from '../../utils/supabaseClient';
import {
  SYSTEM_DOCUMENTS,
  DOCUMENT_MODULES,
  DEFAULT_DOCUMENT_SCHEMAS,
  DEFAULT_LAYOUT_SETTINGS,
  discoverDocumentSchema,
  getMockPreviewData,
  getSampleRecordFromState
} from '../../utils/printSchemaRegistry';

const PAPER_DIMENSIONS = {
  A4: { width: '210mm', minHeight: '297mm' },
  Letter: { width: '8.5in', minHeight: '11in' },
  Thermal: { width: '80mm', minHeight: '180mm' },
  A5: { width: '148mm', minHeight: '210mm' },
  Legal: { width: '8.5in', minHeight: '14in' }
};

const HEADER_THEMES = [
  { id: 'classic_split', name: 'Classic Split (Logo L, Title R)' },
  { id: 'centered_brand', name: 'Centered Branding & Header Details' },
  { id: 'left_heavy', name: 'Left Heavy Title & Right Details' },
  { id: 'right_heavy', name: 'Right Heavy Title & Left Details' },
  { id: 'accent_stripe', name: 'Modern Accent Stripe Banner' },
  { id: 'minimalist_grid', name: 'Minimalist 3-Column Grid' },
  { id: 'corporate_boxed', name: 'Corporate Boxed Identity' },
  { id: 'editorial_vogue', name: 'Editorial Vogue Layout' }
];

const EXCEL_COLORS = [
  { name: 'Navy', primary: '#004277', headerBg: '#004277' },
  { name: 'Slate', primary: '#0f172a', headerBg: '#1e293b' },
  { name: 'Indigo', primary: '#4f46e5', headerBg: '#4f46e5' },
  { name: 'Emerald', primary: '#059669', headerBg: '#059669' },
  { name: 'Crimson', primary: '#dc2626', headerBg: '#991b1b' },
  { name: 'Charcoal', primary: '#27272a', headerBg: '#27272a' }
];

const FONT_FAMILIES = [
  { id: 'Inter', name: 'Inter (Sans-serif)' },
  { id: 'Roboto', name: 'Roboto' },
  { id: 'Outfit', name: 'Outfit' },
  { id: 'Playfair Display', name: 'Playfair (Serif)' },
  { id: 'Courier Prime', name: 'Courier Prime (Monospace)' },
  { id: 'Poppins', name: 'Poppins' },
  { id: 'Montserrat', name: 'Montserrat' },
  { id: 'Open Sans', name: 'Open Sans' },
  { id: 'Lato', name: 'Lato' },
  { id: 'Nunito', name: 'Nunito' },
  { id: 'Rubik', name: 'Rubik' },
  { id: 'Work Sans', name: 'Work Sans' },
  { id: 'DM Sans', name: 'DM Sans' },
  { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans' },
  { id: 'IBM Plex Sans', name: 'IBM Plex Sans' },
  { id: 'Source Sans 3', name: 'Source Sans 3' },
  { id: 'Figtree', name: 'Figtree' }
];

export default function PrintSettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, setCollection, currencySymbol } = useApp();
  const currSym = currencySymbol || state?.adminSetup?.baseCurrency?.match(/\(([^)]+)\)/)?.[1] || 'Rs';
  const { appAlert } = useDialog();

  const initialDoc = searchParams.get('doc') || 'sale_order';
  const initialModule = searchParams.get('module') || 'all';

  const [activeModuleFilter, setActiveModuleFilter] = useState(initialModule);
  const [selectedDocId, setSelectedDocId] = useState(initialDoc);

  // Editor Tabs
  const [leftTab, setLeftTab] = useState('toolbox'); // 'toolbox' | 'setup' | 'inspector'
  const [selectedElement, setSelectedElement] = useState(null); // { type: 'header_field' | 'column' | 'signature' | 'terms', key: string, index?: number }

  const [saving, setSaving] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showStudioModal, setShowStudioModal] = useState(false);


  const handleResetToDefaultLayout = () => {
    if (confirm(`Reset layout for ${currentDocMeta?.name || selectedDocId} to default factory template?`)) {
      const defaultSchema = DEFAULT_DOCUMENT_SCHEMAS[selectedDocId] || DEFAULT_LAYOUT_SETTINGS;
      setDocumentLayouts(prev => ({
        ...prev,
        [selectedDocId]: defaultSchema
      }));
      if (setCollection) {
        const currentPrintSettings = state?.adminSetup?.printSettings || {};
        const updatedDocLayouts = {
          ...(currentPrintSettings.documentLayouts || {}),
          [selectedDocId]: defaultSchema
        };
        setCollection('adminSetup', {
          ...(state?.adminSetup || {}),
          printSettings: {
            ...currentPrintSettings,
            documentLayouts: updatedDocLayouts
          }
        });
      }
      try {
        localStorage.removeItem(`fv_print_layout_${selectedDocId}`);
      } catch (e) {}
    }
  };

  // Local state for layout configurations of all 26 documents
  const [documentLayouts, setDocumentLayouts] = useState({});

  // Company Global Metadata
  const companyName = state?.adminSetup?.companyName || 'FLASHVISION';
  const companyLogo = state?.adminSetup?.logo || state?.adminSetup?.logoUrl || '';

  // 1. Initial Load: Fetch saved layouts from Supabase print_layout_settings & AppContext state
  useEffect(() => {
    const loadLayouts = async () => {
      try {
        const { data } = await supabase
          .from('print_layout_settings')
          .select('document_type, layout_config')
          .eq('tenant_id', 'default_tenant');

        const dbMap = {};
        if (data && data.length > 0) {
          data.forEach((row) => {
            if (row.document_type && row.layout_config) {
              dbMap[row.document_type] = row.layout_config;
            }
          });
        }

        const initialMap = {};
        SYSTEM_DOCUMENTS.forEach((doc) => {
          const docId = doc.id;
          const defaultSchema = DEFAULT_DOCUMENT_SCHEMAS[docId] || DEFAULT_LAYOUT_SETTINGS;
          const stateLayout = state?.adminSetup?.printSettings?.documentLayouts?.[docId];
          const dbLayout = dbMap[docId];

          initialMap[docId] = {
            ...defaultSchema,
            ...(stateLayout || {}),
            ...(dbLayout || {})
          };
        });

        setDocumentLayouts(initialMap);
      } catch (err) {
        console.warn('Error loading print layout settings:', err);
        const fallbackMap = {};
        SYSTEM_DOCUMENTS.forEach((doc) => {
          fallbackMap[doc.id] = DEFAULT_DOCUMENT_SCHEMAS[doc.id] || DEFAULT_LAYOUT_SETTINGS;
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

  // Get active layout with schema discovery
  const activeLayout = useMemo(() => {
    try {
      const raw = documentLayouts[selectedDocId] || DEFAULT_DOCUMENT_SCHEMAS[selectedDocId] || DEFAULT_LAYOUT_SETTINGS;
      const sampleRecord = getSampleRecordFromState ? getSampleRecordFromState(selectedDocId, state) : (state?.[selectedDocId] || null);
      return discoverDocumentSchema(selectedDocId, sampleRecord, raw, state);
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

  // Filtered documents dropdown
  const filteredDocuments = useMemo(() => {
    if (activeModuleFilter === 'all') return SYSTEM_DOCUMENTS;
    return SYSTEM_DOCUMENTS.filter((d) => d.module === activeModuleFilter);
  }, [activeModuleFilter]);

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

  // Column reordering
  const moveColumnUp = (index) => {
    if (index === 0) return;
    updateActiveLayout((prev) => {
      const cols = [...(prev.gridColumns || [])];
      const temp = cols[index - 1];
      cols[index - 1] = cols[index];
      cols[index] = temp;
      return { ...prev, gridColumns: cols };
    });
  };

  const moveColumnDown = (index) => {
    updateActiveLayout((prev) => {
      const cols = [...(prev.gridColumns || [])];
      if (index >= cols.length - 1) return prev;
      const temp = cols[index + 1];
      cols[index + 1] = cols[index];
      cols[index] = temp;
      return { ...prev, gridColumns: cols };
    });
  };

  const toggleColumnVisibility = (index) => {
    updateActiveLayout((prev) => {
      const cols = [...(prev.gridColumns || [])];
      cols[index] = { ...cols[index], enabled: !cols[index].enabled };
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
    const newKey = `custom_col_${Date.now().toString().slice(-4)}`;
    updateActiveLayout((prev) => {
      const cols = [...(prev.gridColumns || [])];
      cols.push({
        key: newKey,
        label: 'New Custom Column',
        enabled: true,
        width: '15%',
        align: 'left'
      });
      return { ...prev, gridColumns: cols };
    });
  };

  const handleAddSignature = () => {
    const newKey = `sig_${Date.now().toString().slice(-4)}`;
    updateActiveLayout((prev) => {
      const sigs = [...(prev.signatures || [])];
      sigs.push({
        key: newKey,
        label: 'Authorized Signatory',
        size: '1/3',
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

  // Save Settings to Supabase print_layout_settings table & AppContext state
  const handleSaveConfigurations = async () => {
    setSaving(true);
    try {
      const { error: dbError } = await supabase.from('print_layout_settings').upsert(
        {
          tenant_id: 'default_tenant',
          document_type: selectedDocId,
          layout_config: activeLayout,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'tenant_id,document_type' }
      );

      if (dbError) {
        console.error('Error saving layout to Supabase:', dbError);
      }

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

  // Mock data for live paper preview
  const mockData = useMemo(() => {
    try {
      const fromState = getSampleRecordFromState ? getSampleRecordFromState(selectedDocId, state) : null;
    const baseMock = getMockPreviewData(selectedDocId) || { header: {}, items: [], totals: {} };

    const companyAddr = state?.adminSetup?.address || 'Plot 42-B, Industrial Zone Phase III, Karachi, Pakistan';
    const companyPh = state?.adminSetup?.phone || '+92-21-34567890';
    const companyEm = state?.adminSetup?.email || 'operations@flashvision.com';

    if (!fromState) {
      return {
        ...baseMock,
        header: {
          address: companyAddr,
          phone: companyPh,
          email: companyEm,
          ...(baseMock.header || {})
        }
      };
    }

    const rawItems = Array.isArray(fromState.items) ? fromState.items :
                     Array.isArray(fromState.lineItems) ? fromState.lineItems :
                     Array.isArray(fromState.rows) ? fromState.rows : (baseMock.items || []);

    const header = {
      address: companyAddr,
      phone: companyPh,
      email: companyEm,
      ...(baseMock.header || {}),
      ...(fromState.header || {}),
      so_number: fromState.id || fromState.so_number || `${currentDocMeta?.code || 'DOC'}-2026-001`,
      grn_number: fromState.id || fromState.grn_number || `${currentDocMeta?.code || 'DOC'}-2026-001`,
      invoice_no: fromState.id || fromState.invoice_no || `${currentDocMeta?.code || 'DOC'}-2026-001`,
      ref_no: fromState.id || fromState.ref_no || `${currentDocMeta?.code || 'DOC'}-2026-001`,
      date: fromState.date || fromState.created_at || new Date().toISOString().split('T')[0],
      customer: fromState.customerName || fromState.customer || 'Al-Haq Enterprises',
      contact: fromState.contactPerson || fromState.contact || 'N/A'
    };

    if (fromState && typeof fromState === 'object' && !Array.isArray(fromState)) {
      try {
        Object.keys(fromState).forEach(k => {
          if (k !== 'items' && k !== 'lineItems' && k !== 'rows') {
            header[k] = fromState[k];
          }
        });
      } catch (e) {
        console.warn('Error reading fromState keys in PrintSettings:', e);
      }
    }

    return {
      header,
      items: rawItems.length > 0 ? rawItems : (baseMock.items || []),
      totals: fromState.totals || baseMock.totals || { subtotal: 0, tax: 0, grandTotal: 0 }
    };
    } catch (e) {
      console.error('Error computing mock data:', e);
      return getMockPreviewData(selectedDocId) || { header: {}, items: [], totals: {} };
    }
  }, [selectedDocId, state, currentDocMeta]);

  return (
    <>
      {showStudioModal && (
        <UniversalPrintStudioModal
          isOpen={showStudioModal}
          onClose={() => setShowStudioModal(false)}
          documentType={selectedDocId}
          documentTitle={currentDocMeta?.name}
        />
      )}
    <div className="w-full bg-[#f8f9fb] text-slate-800 font-sans p-4 md:p-6 rounded-3xl min-h-[calc(100vh-6rem)] flex flex-col space-y-6 animate-fade-in border border-slate-200/80 shadow-sm">
      {/* ============================================================== */}
      {/* 1. TOP HEADER & DOCUMENT SELECTION BAR                        */}
      {/* ============================================================== */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <span className="material-symbols-outlined text-2xl">print</span>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Print Settings & Layout Designer
            </h1>
            <p className="text-xs text-slate-500">
              Configure paper dimensions, dynamic line-item columns, headers, footers & signatures (26 Documents)
            </p>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={() => setShowStudioModal(true)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
          >
            <span className="material-symbols-outlined text-base">visibility</span>
            Test Print Modal
          </button>

          <button
            onClick={handleSaveConfigurations}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">{saving ? 'sync' : 'save'}</span>
            {saving ? 'Saving...' : 'Save Configurations'}
          </button>
        </div>
      </div>

      {/* Module Filters & Document Dropdown Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Module Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <button
            onClick={() => { setActiveModuleFilter('all'); setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('tab', 'print_settings'); n.set('module', 'all'); return n; }); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeModuleFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-sm">grid_view</span>
            All ({SYSTEM_DOCUMENTS.length})
          </button>

          {DOCUMENT_MODULES.map((mod) => (
            <button
              key={mod.id}
              onClick={() => {
                setActiveModuleFilter(mod.id);
                const firstDocOfMod = SYSTEM_DOCUMENTS.find((d) => d.module === mod.id);
                if (firstDocOfMod) {
                  setSelectedDocId(firstDocOfMod.id);
                  setSearchParams((prev) => {
                    const n = new URLSearchParams(prev);
                    n.set('tab', 'print_settings');
                    n.set('module', mod.id);
                    n.set('doc', firstDocOfMod.id);
                    return n;
                  });
                } else {
                  setSearchParams((prev) => {
                    const n = new URLSearchParams(prev);
                    n.set('tab', 'print_settings');
                    n.set('module', mod.id);
                    return n;
                  });
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeModuleFilter === mod.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{mod.icon}</span>
              {mod.name}
            </button>
          ))}
        </div>

        {/* Document Selection Select */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
            Document:
          </span>
          <div className="relative flex-1 md:w-72">
            <select
              value={selectedDocId}
              onChange={(e) => handleSelectDocument(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none pr-8"
            >
              {filteredDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  [{doc.code}] {doc.name}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-2 text-slate-400 pointer-events-none text-base">
              unfold_more
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. INTERACTIVE 3-PANE DESIGN WORKSPACE                        */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
        {/* LEFT PANEL: TOOLBOX & SETUP */}
        <aside className="col-span-12 lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
          {/* Sub-Tabs */}
          <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50/70">
            <button
              onClick={() => setLeftTab('toolbox')}
              className={`py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                leftTab === 'toolbox'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-base">view_module</span>
              Toolbox
            </button>

            <button
              onClick={() => setLeftTab('setup')}
              className={`py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                leftTab === 'setup'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-base">settings</span>
              Paper & Style
            </button>

            <button
              onClick={() => setLeftTab('inspector')}
              className={`py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                leftTab === 'inspector'
                  ? 'border-blue-600 text-blue-600 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-base">tune</span>
              Inspector
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-6 flex-1">
            {/* TOOLBOX TAB */}
            {leftTab === 'toolbox' && (
              <div className="space-y-6">
                {/* Header Fields Section */}
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Header Fields</h3>
                  <div className="space-y-2">
                    {(activeLayout.headerFields || []).map((field) => (
                      <div
                        key={field.key}
                        onClick={() => {
                          setSelectedElement({ type: 'header_field', key: field.key });
                          setLeftTab('inspector');
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          selectedElement?.key === field.key
                            ? 'bg-blue-50 border-blue-500 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={field.enabled !== false}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateActiveLayout((prev) => {
                                const fields = [...(prev.headerFields || [])];
                                const fIdx = fields.findIndex((f) => f.key === field.key);
                                if (fIdx > -1) fields[fIdx] = { ...fields[fIdx], enabled: e.target.checked };
                                return { ...prev, headerFields: fields };
                              });
                            }}
                            className="rounded text-blue-600 cursor-pointer"
                          />
                          <span className="text-xs font-bold">{field.label}</span>
                        </div>
                        <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded font-mono font-bold text-slate-600">
                          {field.width || 'span-1'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Table Line Item Columns */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Line Item Columns</h3>
                    <button
                      onClick={handleAddCustomColumn}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">add_circle</span>
                      Add Column
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(activeLayout.gridColumns || []).map((col, cIdx) => (
                      <div
                        key={col.key || cIdx}
                        onClick={() => {
                          setSelectedElement({ type: 'column', key: col.key, index: cIdx });
                          setLeftTab('inspector');
                        }}
                        className={`p-3 rounded-xl border space-y-2 cursor-pointer transition-all ${
                          selectedElement?.key === col.key
                            ? 'bg-blue-50 border-blue-500 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={col.enabled !== false}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleColumnVisibility(cIdx);
                              }}
                              className="rounded text-blue-600 cursor-pointer"
                            />
                            <span className="text-xs font-bold">{col.label}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                moveColumnUp(cIdx);
                              }}
                              disabled={cIdx === 0}
                              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                            >
                              <span className="material-symbols-outlined text-xs">arrow_upward</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                moveColumnDown(cIdx);
                              }}
                              disabled={cIdx === (activeLayout.gridColumns?.length || 1) - 1}
                              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                            >
                              <span className="material-symbols-outlined text-xs">arrow_downward</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>Width: {col.width || '15%'}</span>
                          <span className="uppercase">Align: {col.align || 'left'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dynamic Signature Blocks */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Signatures</h3>
                    <button
                      onClick={handleAddSignature}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">add</span>
                      Add Box
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(activeLayout.signatures || []).map((sig, sIdx) => (
                      <div key={sig.key || sIdx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <input
                          type="text"
                          value={sig.label}
                          onChange={(e) => {
                            const sigs = [...(activeLayout.signatures || [])];
                            sigs[sIdx].label = e.target.value;
                            updateActiveLayout({ signatures: sigs });
                          }}
                          className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                        />
                        <button
                          onClick={() => handleRemoveSignature(sIdx)}
                          className="p-1 rounded text-red-500 hover:bg-red-50"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SETUP TAB */}
            {leftTab === 'setup' && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Paper Format</label>
                  <select
                    value={activeLayout.paperSize}
                    onChange={(e) => updateActiveLayout({ paperSize: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="A4">A4 (210 x 297 mm)</option>
                    <option value="Letter">Letter (8.5 x 11 in)</option>
                    <option value="Thermal">Thermal Roll (80 mm)</option>
                    <option value="A5">A5 (148 x 210 mm)</option>
                    <option value="Legal">Legal (8.5 x 14 in)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Page Orientation</label>
                  <select
                    value={activeLayout.orientation}
                    onChange={(e) => updateActiveLayout({ orientation: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2">Header Theme</label>
                  <div className="space-y-1.5">
                    {HEADER_THEMES.map((theme) => (
                      <label
                        key={theme.id}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                          activeLayout.headerTheme === theme.id
                            ? 'bg-blue-50 border-blue-500 text-blue-900'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="theme"
                          value={theme.id}
                          checked={activeLayout.headerTheme === theme.id}
                          onChange={() => updateActiveLayout({ headerTheme: theme.id })}
                          className="text-blue-600"
                        />
                        {theme.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Font Family</label>
                  <select
                    value={activeLayout.fontFamily || 'Inter'}
                    onChange={(e) => updateActiveLayout({ fontFamily: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    {FONT_FAMILIES.map((font) => (
                      <option key={font.id} value={font.id}>
                        {font.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2">Brand Preset Color</label>
                  <div className="grid grid-cols-3 gap-2">
                    {EXCEL_COLORS.map((col) => (
                      <button
                        key={col.name}
                        onClick={() =>
                          updateActiveLayout({
                            primaryColor: col.primary,
                            tableHeaderBgColor: col.headerBg
                          })
                        }
                        className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:border-slate-300 flex items-center gap-2 text-xs font-semibold"
                      >
                        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: col.primary }} />
                        {col.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Approved print family (2026-10-24): header alignment, title
                    band + totals colors, margin presets, scaling, phases. */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-2">Header Block Alignment</label>
                  <div className="flex gap-2">
                    {['left', 'center', 'right'].map((a) => (
                      <button
                        key={a}
                        onClick={() => updateActiveLayout({ headerAlign: a })}
                        className={`flex-1 py-2 rounded-xl border text-xs font-bold capitalize transition-all ${activeLayout.headerAlign === a ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Title Band Start</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeLayout.bandColor || '#4338ca'}
                        onChange={(e) => updateActiveLayout({ bandColor: e.target.value })}
                        className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer shrink-0"
                      />
                      <input
                        value={activeLayout.bandColor || '#4338ca'}
                        onChange={(e) => updateActiveLayout({ bandColor: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Title Band End</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeLayout.bandColor2 || '#4f46e5'}
                        onChange={(e) => updateActiveLayout({ bandColor2: e.target.value })}
                        className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer shrink-0"
                      />
                      <input
                        value={activeLayout.bandColor2 || '#4f46e5'}
                        onChange={(e) => updateActiveLayout({ bandColor2: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Totals Bar</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={activeLayout.totalsColor || '#232946'}
                        onChange={(e) => updateActiveLayout({ totalsColor: e.target.value })}
                        className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer shrink-0"
                      />
                      <input
                        value={activeLayout.totalsColor || '#232946'}
                        onChange={(e) => updateActiveLayout({ totalsColor: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Margin Preset</label>
                  <select
                    value={activeLayout.marginPreset || 'default'}
                    onChange={(e) => updateActiveLayout({ marginPreset: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="default">Default (12mm)</option>
                    <option value="minimum">Minimum (5mm)</option>
                    <option value="low">Low (8mm)</option>
                    <option value="custom">Custom</option>
                  </select>
                  {activeLayout.marginPreset === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['marginTop', 'marginRight', 'marginBottom', 'marginLeft'].map((k) => (
                        <label key={k} className="block">
                          <span className="text-[10px] font-bold text-slate-500">{k.replace('margin', '')}</span>
                          <input
                            value={activeLayout[k] || '12mm'}
                            onChange={(e) => updateActiveLayout({ [k]: e.target.value })}
                            className="w-full mt-0.5 bg-slate-50 border border-slate-300 rounded-xl px-2 py-2 text-xs font-mono font-bold text-slate-800"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Scaling (Excel-style)</label>
                  <select
                    value={activeLayout.scaleMode || 'fill'}
                    onChange={(e) => updateActiveLayout({ scaleMode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="fill">Fill Page</option>
                    <option value="fit">Fit to Page (shrink only)</option>
                    <option value="actual">Actual Size (100%)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Phases Per Row (BOM / Consumption prints)</label>
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={activeLayout.phasesPerRow || 4}
                    onChange={(e) => updateActiveLayout({ phasesPerRow: parseInt(e.target.value) || 4 })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Extra phases wrap to the next panel row — never squeezed. Only applies to BOM / Consumption prints.</p>
                </div>
              </div>
            )}

            {/* INSPECTOR TAB */}
            {leftTab === 'inspector' && (
              <div className="space-y-6">
                {!selectedElement ? (
                  <div className="text-center py-12 text-slate-400 text-xs font-medium">
                    Click on any header field, column, or signature on the live paper canvas to inspect & edit its properties.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <span className="text-xs font-bold text-blue-600 uppercase font-mono">
                        Inspect: {selectedElement.key}
                      </span>
                      <button
                        onClick={() => setSelectedElement(null)}
                        className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                      >
                        Clear Selection
                      </button>
                    </div>

                    {selectedElement.type === 'column' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Column Label</label>
                          <input
                            type="text"
                            value={activeLayout.gridColumns?.[selectedElement.index]?.label || ''}
                            onChange={(e) => updateColumnProperty(selectedElement.index, 'label', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Column Width</label>
                          <input
                            type="text"
                            value={activeLayout.gridColumns?.[selectedElement.index]?.width || ''}
                            onChange={(e) => updateColumnProperty(selectedElement.index, 'width', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                            placeholder="e.g. 20% or 150px"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Text Alignment</label>
                          <select
                            value={activeLayout.gridColumns?.[selectedElement.index]?.align || 'left'}
                            onChange={(e) => updateColumnProperty(selectedElement.index, 'align', e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {selectedElement.type === 'header_field' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Field Label</label>
                          <input
                            type="text"
                            value={
                              activeLayout.headerFields?.find((f) => f.key === selectedElement.key)?.label || ''
                            }
                            onChange={(e) => {
                              const fields = [...(activeLayout.headerFields || [])];
                              const idx = fields.findIndex((f) => f.key === selectedElement.key);
                              if (idx > -1) {
                                fields[idx].label = e.target.value;
                                updateActiveLayout({ headerFields: fields });
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Grid Column Span</label>
                          <select
                            value={
                              activeLayout.headerFields?.find((f) => f.key === selectedElement.key)?.width ||
                              'span-1'
                            }
                            onChange={(e) => {
                              const fields = [...(activeLayout.headerFields || [])];
                              const idx = fields.findIndex((f) => f.key === selectedElement.key);
                              if (idx > -1) {
                                fields[idx].width = e.target.value;
                                updateActiveLayout({ headerFields: fields });
                              }
                            }}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                          >
                            <option value="span-1">Span 1 Column</option>
                            <option value="span-2">Span 2 Columns</option>
                            <option value="span-3">Span 3 Columns (Full Width)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER PANEL: LIVE INTERACTIVE WYSIWYG PAPER CANVAS */}
        <main className="col-span-12 lg:col-span-8 bg-slate-200/60 rounded-2xl p-6 border border-slate-300/60 overflow-y-auto flex justify-center items-start min-h-[650px]">
          <div className="w-full max-w-3xl flex flex-col items-center">
            <div className="w-full mb-3 flex items-center justify-between text-xs text-slate-500 font-medium px-2">
              <span className="flex items-center gap-1 font-bold text-slate-700">
                <span className="material-symbols-outlined text-sm text-emerald-600">wysiwyg</span>
                Live Interactive WYSIWYG Paper
              </span>
              <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-slate-300 text-slate-600 font-bold">
                {currentDocMeta.name}
              </span>
            </div>

            {/* LIVE PAPER CANVAS */}
            <div
              className="bg-white text-slate-900 shadow-xl rounded-md transition-all relative overflow-hidden"
              style={{
                width: PAPER_DIMENSIONS[activeLayout.paperSize]?.width || '210mm',
                minHeight: PAPER_DIMENSIONS[activeLayout.paperSize]?.minHeight || '297mm',
                paddingTop: activeLayout.marginTop || '15mm',
                paddingBottom: activeLayout.marginBottom || '15mm',
                paddingLeft: activeLayout.marginLeft || '15mm',
                paddingRight: activeLayout.marginRight || '15mm',
                fontFamily: activeLayout.fontFamily || 'Inter'
              }}
            >
              {/* Dynamic Header Theme Rendering */}
              <div className="border-b-2 border-slate-900 pb-4 mb-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    {activeLayout.showHeaderLogo !== false && companyLogo && (
                      <img src={companyLogo} alt="Logo" className="h-14 object-contain" />
                    )}
                    {activeLayout.showHeaderDetails !== false && (
                      <div>
                        <h2
                          className="text-xl font-black uppercase tracking-tight"
                          style={{ color: activeLayout.primaryColor || '#004277' }}
                        >
                          {companyName}
                        </h2>
                        <p className="text-[10px] text-slate-600 leading-tight mt-0.5">
                          {(mockData?.header?.address || 'Plot 42-B, Industrial Zone Phase III, Karachi')} | Tel: {(mockData?.header?.phone || '+92-21-34567890')}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <h3 className="text-2xl font-black uppercase tracking-widest text-slate-900">
                      {currentDocMeta.name}
                    </h3>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded bg-slate-100 font-mono text-xs font-bold text-slate-700">
                      {mockData?.header?.so_number || mockData?.header?.grn_number || mockData?.header.invoice_no || mockData?.header.ref_no || `${currentDocMeta.code}-2026-001`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Header Fields Grid */}
              <div className="grid grid-cols-3 gap-3 mb-6 bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs">
                {(activeLayout.headerFields || []).map((field) => {
                  if (field.enabled === false) return null;
                  const val = mockData?.header?.[field.key] || mockData?.[field.key] || 'N/A';
                  const isSelected = selectedElement?.key === field.key;
                  return (
                    <div
                      key={field.key}
                      onClick={() => {
                        setSelectedElement({ type: 'header_field', key: field.key });
                        setLeftTab('inspector');
                      }}
                      className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                        isSelected ? 'ring-2 ring-blue-500 bg-blue-50/80' : 'hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">{field.label}:</span>
                      <span className="font-bold text-slate-800">{val}</span>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Line-Items Table */}
              <div className="mb-6 overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr style={{ backgroundColor: activeLayout.tableHeaderBgColor || '#004277', color: activeLayout.tableHeaderTextColor || '#ffffff' }}>
                      {(activeLayout.gridColumns || []).map((col, colIndex) => {
                        if (col.enabled === false) return null;
                        const isSelected = selectedElement?.key === col.key;
                        return (
                          <th
                            key={col.key || colIndex}
                            onClick={() => {
                              setSelectedElement({ type: 'column', key: col.key, index: colIndex });
                              setLeftTab('inspector');
                            }}
                            className={`p-2 border border-slate-300 font-bold uppercase text-[10px] cursor-pointer transition-all ${
                              isSelected ? 'ring-2 ring-yellow-400' : ''
                            }`}
                            style={{ width: col.width || 'auto', textAlign: col.align || 'left' }}
                          >
                            {col.label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {(mockData.items || []).map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {(activeLayout.gridColumns || []).map((col, colIndex) => {
                          if (col.enabled === false) return null;
                          const cellVal = row[col.key] !== undefined ? row[col.key] : '-';
                          return (
                            <td
                              key={col.key || colIndex}
                              className="p-2 border border-slate-200 text-[11px]"
                              style={{ textAlign: col.align || 'left' }}
                            >
                              {cellVal}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Terms & Totals Section */}
              <div className="flex justify-between items-start gap-6 mb-8 pt-2">
                <div className="flex-1 pr-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Terms & Conditions
                  </h4>
                  <p className="text-[10px] text-slate-600 whitespace-pre-line leading-relaxed border-l-2 border-slate-300 pl-2">
                    {activeLayout.termsConditions || 'Standard ERP terms apply.'}
                  </p>
                </div>

                {mockData.totals && (
                  <div className="w-56 bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-1.5 text-xs">
                    {mockData.totals.subtotal !== undefined && (
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span className="font-mono font-bold">{currSym} {Number(mockData.totals.subtotal || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {mockData.totals.tax !== undefined && (
                      <div className="flex justify-between text-slate-600">
                        <span>Tax:</span>
                        <span className="font-mono font-bold">{currSym} {Number(mockData.totals.tax || 0).toLocaleString()}</span>
                      </div>
                    )}
                    {mockData.totals.grandTotal !== undefined && (
                      <div className="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-300">
                        <span>Grand Total:</span>
                        <span className="font-mono" style={{ color: activeLayout.primaryColor || '#004277' }}>
                          {currSym} {Number(mockData.totals.grandTotal || 0).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dynamic Signatures Footer */}
              <div className="mt-12 pt-4 flex justify-between items-end gap-4 border-t border-slate-200">
                {(activeLayout.signatures || []).map((sig, sIdx) => (
                  <div key={sig.key || sIdx} className="flex-1 text-center">
                    <div className="border-b border-slate-400 w-3/4 mx-auto mb-1.5"></div>
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                      {sig.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer text */}
              <div className="mt-8 text-center text-[9px] text-slate-400 border-t border-slate-100 pt-2 font-mono">
                {activeLayout.customFooterText || 'Computer Generated Document. Powered by Flashvision ERP.'}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ============================================================== */}
      {/* 3. SUCCESS POPUP MODAL                                         */}
      {/* ============================================================== */}
      {showSaveSuccess && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4 border border-slate-100">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
              <span className="material-symbols-outlined text-3xl font-bold">check_circle</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">Print Settings Saved</h3>
              <p className="text-xs text-slate-500 mt-1">
                Layout configuration for <strong>[{currentDocMeta.name}]</strong> has been updated and saved to database.
              </p>
            </div>
            <button
              onClick={() => setShowSaveSuccess(false)}
              className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
