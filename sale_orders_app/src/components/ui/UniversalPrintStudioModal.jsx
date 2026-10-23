import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import { supabase } from '../../utils/supabaseClient';
import {
  SYSTEM_DOCUMENTS,
  DEFAULT_DOCUMENT_SCHEMAS,
  DEFAULT_LAYOUT_SETTINGS,
  discoverDocumentSchema,
  getMockPreviewData,
  getSampleRecordFromState
} from '../../utils/printSchemaRegistry';
import {
  exportDocumentToPdf,
  exportDocumentToImage,
  exportDocumentToCsv
} from '../../utils/printExportUtils';

const PAPER_DIMENSIONS = {
  A4: { width: '210mm', minHeight: '297mm', label: 'A4 (210 × 297 mm)' },
  Letter: { width: '8.5in', minHeight: '11in', label: 'Letter (8.5 × 11 in)' },
  Thermal: { width: '80mm', minHeight: '180mm', label: 'POS Thermal (80 mm)' },
  A5: { width: '148mm', minHeight: '210mm', label: 'A5 (148 × 210 mm)' },
  Legal: { width: '8.5in', minHeight: '14in', label: 'Legal (8.5 × 14 in)' }
};

const HEADER_THEMES = [
  { id: 'classic_split', name: 'Classic Split (Logo L, Title R)' },
  { id: 'centered_brand', name: 'Centered Branding & Meta' },
  { id: 'accent_stripe', name: 'Modern Accent Stripe Banner' },
  { id: 'minimalist_grid', name: 'Minimalist 3-Column Clean' },
  { id: 'corporate_boxed', name: 'Corporate Boxed Enterprise' },
  { id: 'editorial_vogue', name: 'Editorial High-Contrast Vogue' },
  { id: 'left_heavy', name: 'Left Heavy Title & Details' },
  { id: 'right_heavy', name: 'Right Heavy Identity' }
];

const BRAND_PALETTES = [
  { name: 'Obsidian Slate', primary: '#0f172a', bg: '#0f172a', text: '#ffffff' },
  { name: 'Navy Enterprise', primary: '#004277', bg: '#004277', text: '#ffffff' },
  { name: 'Royal Indigo', primary: '#4338ca', bg: '#4338ca', text: '#ffffff' },
  { name: 'Emerald Forest', primary: '#047857', bg: '#047857', text: '#ffffff' },
  { name: 'Crimson Wine', primary: '#b91c1c', bg: '#b91c1c', text: '#ffffff' },
  { name: 'Warm Charcoal', primary: '#27272a', bg: '#27272a', text: '#ffffff' }
];

const FONT_OPTIONS = [
  { id: 'Inter', name: 'Inter (Modern Clean)' },
  { id: 'Roboto', name: 'Roboto (Enterprise)' },
  { id: 'Outfit', name: 'Outfit (Geometric UI)' },
  { id: 'Courier Prime', name: 'Courier Prime (Technical)' },
  { id: 'Playfair Display', name: 'Playfair Display (Executive)' },
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
  const [activeTab, setActiveTab] = useState('pagination'); // 'pagination' | 'columns' | 'header' | 'branding' | 'signatures'
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(null); // 'pdf' | 'img' | 'csv' | null
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Company Global Metadata
  const companyName = state?.adminSetup?.companyName || 'FLASHVISION LOGISTICS & ENTERPRISE ERP';
  const companyLogo = state?.adminSetup?.logo || state?.adminSetup?.logoUrl || '';
  const companyAddress = state?.adminSetup?.address || 'Plot 42-B, Industrial Zone Phase III, Karachi, Pakistan';
  const companyPhone = state?.adminSetup?.phone || '+92-21-34567890';
  const companyEmail = state?.adminSetup?.email || 'operations@flashvision.com';

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
      ...(stateLayout || {}),
      ...(localSaved || {})
    };
    return discoverDocumentSchema(documentType, resolvedRecord, initial, state);
  });

  // Re-run discovery if documentType or record changes
  useEffect(() => {
    const defaultSchema = DEFAULT_DOCUMENT_SCHEMAS[documentType] || DEFAULT_LAYOUT_SETTINGS;
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
      ...(stateLayout || {}),
      ...(localSaved || {})
    };
    setLayoutConfig(discoverDocumentSchema(documentType, resolvedRecord, merged, state));
  }, [documentType, resolvedRecord, state]);

  // 3. Extract Line Items and Totals from Record
  const resolvedLineItems = useMemo(() => {
    if (!resolvedRecord) return [];
    if (Array.isArray(resolvedRecord.items)) return resolvedRecord.items;
    if (Array.isArray(resolvedRecord.lineItems)) return resolvedRecord.lineItems;
    if (Array.isArray(resolvedRecord.rows)) return resolvedRecord.rows;
    if (Array.isArray(resolvedRecord.details)) return resolvedRecord.details;
    if (Array.isArray(resolvedRecord.records)) return resolvedRecord.records;
    return [];
  }, [resolvedRecord]);

  // 4. Multi-Page Chunking Engine (The user's key requirement)
  const pages = useMemo(() => {
    const items = resolvedLineItems || [];
    const firstPageLimit = Math.max(1, Number(layoutConfig.firstPageRows || 8));
    const continuationLimit = Math.max(1, Number(layoutConfig.continuationPageRows || 14));

    if (items.length === 0) return [[]];

    const chunks = [];
    const copy = [...items];

    // Page 1
    chunks.push(copy.splice(0, firstPageLimit));

    // Subsequent pages
    while (copy.length > 0) {
      chunks.push(copy.splice(0, continuationLimit));
    }

    return chunks;
  }, [resolvedLineItems, layoutConfig.firstPageRows, layoutConfig.continuationPageRows]);

  // Value Resolver for Column Data
  const getCellValue = (colKey, item, index = 0) => {
    if (!item) return '---';
    if (colKey === 'serial_no' || colKey === 'sr' || colKey === 'sr_no') {
      return String(index + 1).padStart(2, '0');
    }
    if (item[colKey] !== undefined && item[colKey] !== null) {
      const val = item[colKey];
      return typeof val === 'number' ? val.toLocaleString() : String(val);
    }
    // Aliases
    if (colKey === 'item_name' || colKey === 'product_name' || colKey === 'description') {
      return item.name || item.itemName || item.productName || item.description || '---';
    }
    if (colKey === 'item_code' || colKey === 'sku' || colKey === 'code') {
      return item.itemCode || item.code || item.sku || '---';
    }
    if (colKey === 'qty' || colKey === 'quantity') {
      return String(item.quantity ?? item.qty ?? '0');
    }
    if (colKey === 'rolls' || colKey === 'roll_qty') {
      return String(item.rolls || item.rollQty || item.rollsCount || '-');
    }
    if (colKey === 'uom' || colKey === 'unit') {
      return item.uom || item.unit || 'Mtr';
    }
    if (colKey === 'rate' || colKey === 'price') {
      return Number(item.price || item.rate || 0).toLocaleString();
    }
    if (colKey === 'sub_total' || colKey === 'total') {
      if (item.sub_total !== undefined) return Number(item.sub_total).toLocaleString();
      const q = Number(item.quantity || item.qty || 0);
      const r = Number(item.price || item.rate || 0);
      const d = Number(item.discount || 0);
      return Number(q * r - d).toLocaleString();
    }
    return item[colKey] !== undefined ? String(item[colKey]) : '---';
  };

  // Header Field Resolver
  const getHeaderFieldValue = (fieldKey) => {
    if (!resolvedRecord) return '---';
    // Direct match
    if (resolvedRecord[fieldKey] !== undefined && resolvedRecord[fieldKey] !== null) {
      const val = resolvedRecord[fieldKey];
      if (fieldKey === 'date' || fieldKey.includes('_date')) {
        return new Date(val).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      return String(val);
    }
    // Nested header
    if (resolvedRecord.header && resolvedRecord.header[fieldKey] !== undefined) {
      return String(resolvedRecord.header[fieldKey]);
    }
    // Customer
    if (fieldKey === 'customer' || fieldKey === 'customer_name' || fieldKey === 'party_name') {
      if (resolvedRecord.customerName) return resolvedRecord.customerName;
      if (resolvedRecord.customerId) {
        const c = state?.customers?.find((x) => x.id === resolvedRecord.customerId);
        return c ? c.name : resolvedRecord.customerId;
      }
    }
    if (fieldKey === 'contact' || fieldKey === 'contact_details') {
      if (resolvedRecord.contactPerson) return resolvedRecord.contactPerson;
      if (resolvedRecord.consignee?.contactNumber) return resolvedRecord.consignee.contactNumber;
    }
    if (fieldKey === 'shipping_address') {
      return resolvedRecord.shippingAddress || resolvedRecord.consignee?.address || 'Standard Delivery Address';
    }
    return '---';
  };

  // Updaters
  const updateLayout = (keyOrFn, val) => {
    setLayoutConfig((prev) => {
      if (typeof keyOrFn === 'function') return keyOrFn(prev);
      return { ...prev, [keyOrFn]: val };
    });
  };

  // Column Manipulations
  const toggleColumn = (idx) => {
    const nextCols = [...(layoutConfig.gridColumns || [])];
    nextCols[idx] = { ...nextCols[idx], enabled: !nextCols[idx].enabled };
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
    nextFields[idx] = { ...nextFields[idx], enabled: !nextFields[idx].enabled };
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
      // 1. Supabase print_layout_settings
      await supabase.from('print_layout_settings').upsert(
        {
          tenant_id: 'default_tenant',
          document_type: documentType,
          layout_config: layoutConfig,
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
    const defaultSchema = DEFAULT_DOCUMENT_SCHEMAS[documentType] || DEFAULT_LAYOUT_SETTINGS;
    setLayoutConfig(defaultSchema);
    localStorage.removeItem(`fv_print_layout_${documentType}`);
    appAlert?.('Layout reset to default preset.');
  };

  // Export Handlers
  const handleDownloadPdf = async () => {
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
  const isLandscape = layoutConfig.orientation === 'landscape';
  const paperWidth = isLandscape ? currentPaper.minHeight : currentPaper.width;
  const paperHeight = isLandscape ? currentPaper.width : currentPaper.minHeight;

  const docTitleDisplay =
    documentTitle ||
    SYSTEM_DOCUMENTS.find((d) => d.id === documentType)?.name ||
    documentType.replace(/_/g, ' ').toUpperCase();

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-between overflow-hidden animate-fade-in font-sans">
      {/* Dynamic Print CSS for isolation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: ${paperWidth} ${paperHeight} !important;
                margin: 0 !important;
              }
              body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
              }
              body > *:not(#fv-print-studio-container) {
                display: none !important;
              }
              #fv-print-studio-container, #fv-print-studio-container * {
                visibility: visible !important;
              }
              #fv-print-studio-container {
                position: static !important;
                display: block !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .no-print {
                display: none !important;
              }
              .print-preview-page {
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                padding: ${layoutConfig.marginTop || '12mm'} ${layoutConfig.marginRight || '12mm'} ${layoutConfig.marginBottom || '12mm'} ${layoutConfig.marginLeft || '12mm'} !important;
                width: ${paperWidth} !important;
                height: ${paperHeight} !important;
                page-break-after: always !important;
                break-after: page !important;
              }
            }
          `
        }}
      />

      {/* TOP CONTROL TOOLBAR */}
      <div className="no-print w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-xl">palette</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">{docTitleDisplay}</h2>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-mono font-bold uppercase">
                {currentPaper.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Universal Print Studio • Total Rows: <strong className="text-slate-900 dark:text-white">{resolvedLineItems.length}</strong> •{' '}
              Pages: <strong className="text-slate-900 dark:text-white">{pages.length}</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting !== null}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Export Line Items into CSV Spreadsheet"
          >
            <span className="material-symbols-outlined text-base text-emerald-400">table_view</span>
            Export CSV
          </button>

          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={exporting !== null}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download High-Resolution PNG Image"
          >
            <span className="material-symbols-outlined text-base text-amber-400">image</span>
            Save Image
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={exporting !== null}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Generate and Download Vector PDF"
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
            {saveSuccess ? 'Saved Default!' : saving ? 'Saving...' : 'Save Default'}
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
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all ml-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </div>

      {/* MAIN BODY: SPLIT VIEW (LEFT TOOLBOX DRAWER + RIGHT LIVE PREVIEW) */}
      <div className="flex-1 w-full flex flex-col lg:flex-row overflow-hidden relative">
        {/* ============================================================== */}
        {/* LEFT TOOLBOX & INSPECTOR DRAWER                                */}
        {/* ============================================================== */}
        <div className="no-print w-full lg:w-[420px] xl:w-[460px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden shadow-2xl z-10">
          {/* Tab Navigation */}
          <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 p-1.5 gap-1 overflow-x-auto text-xs font-bold">
            <button
              onClick={() => setActiveTab('pagination')}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'pagination'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">auto_stories</span>
              Pages & Rows
            </button>
            <button
              onClick={() => setActiveTab('columns')}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'columns'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">view_column</span>
              Columns ({layoutConfig.gridColumns?.filter((c) => c.enabled !== false).length})
            </button>
            <button
              onClick={() => setActiveTab('header')}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'header'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">badge</span>
              Header Fields
            </button>
            <button
              onClick={() => setActiveTab('branding')}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'branding'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">style</span>
              Style & Theme
            </button>
            <button
              onClick={() => setActiveTab('signatures')}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'signatures'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-sm">draw</span>
              Footer & Sigs
            </button>
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-600 dark:text-slate-300">
            {/* ------------------------------------------------------------ */}
            {/* TAB 1: PAGINATION & ROWS PER PAGE ENGINE                     */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'pagination' && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500 dark:text-blue-400 text-base">pageview</span>
                    Multi-Page Splitting & Row Limits
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Control exactly how many data rows appear on the 1st page versus continuation pages (Page 2, 3...).
                  </p>

                  {/* Rows on Page 1 */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Rows on First Page (Page 1):</label>
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{layoutConfig.firstPageRows || 8} rows</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="25"
                      value={layoutConfig.firstPageRows || 8}
                      onChange={(e) => updateLayout('firstPageRows', parseInt(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>2 (More header room)</span>
                      <span>15 (Compact)</span>
                    </div>
                  </div>

                  {/* Rows on Subsequent Pages */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Rows on Continuation Pages (Page 2+):</label>
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{layoutConfig.continuationPageRows || 14} rows</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="35"
                      value={layoutConfig.continuationPageRows || 14}
                      onChange={(e) => updateLayout('continuationPageRows', parseInt(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>4</span>
                      <span>35 (Maximum density)</span>
                    </div>
                  </div>

                  {/* Live Distribution Status */}
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-800 dark:text-blue-200">
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-blue-500 dark:text-blue-400">info</span>
                      Active Layout Distribution:
                    </div>
                    <div className="mt-1 space-y-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                      {pages.map((pItems, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>Page {idx + 1}:</span>
                          <strong className="text-slate-900 dark:text-white">{pItems.length} rows</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Repeat Controls */}
                <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500 dark:text-blue-400 text-base">repeat</span>
                    Page Repetition Rules
                  </h3>

                  <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60">
                    <span className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">Repeat Table Header Row on Each Page</span>
                    <input
                      type="checkbox"
                      checked={layoutConfig.repeatTableHeader !== false}
                      onChange={(e) => updateLayout('repeatTableHeader', e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60">
                    <span className="text-[11px] text-slate-700 dark:text-slate-200 font-medium">Repeat Document Header / Logo on Page 2+</span>
                    <input
                      type="checkbox"
                      checked={layoutConfig.repeatHeader === true}
                      onChange={(e) => updateLayout('repeatHeader', e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                  </label>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Totals & Summary Placement:</label>
                    <select
                      value={layoutConfig.totalsPosition || 'last_page'}
                      onChange={(e) => updateLayout('totalsPosition', e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="last_page">Last Page Only (Recommended Standard)</option>
                      <option value="every_page">Bottom of Every Page</option>
                    </select>
                  </div>
                </div>

                {/* Paper Sizing */}
                <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500 dark:text-blue-400 text-base">crop_free</span>
                    Paper Size & Orientation
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Paper Format:</label>
                      <select
                        value={layoutConfig.paperSize || 'A4'}
                        onChange={(e) => updateLayout('paperSize', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="A4">A4 (210 × 297 mm)</option>
                        <option value="Letter">Letter (8.5 × 11 in)</option>
                        <option value="Thermal">Thermal POS (80 mm)</option>
                        <option value="A5">A5 (148 × 210 mm)</option>
                        <option value="Legal">Legal (8.5 × 14 in)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Orientation:</label>
                      <select
                        value={layoutConfig.orientation || 'portrait'}
                        onChange={(e) => updateLayout('orientation', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </div>
                  </div>

                  {/* Margins */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Document Margins:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500">Top / Bottom:</span>
                        <input
                          type="text"
                          value={layoutConfig.marginTop || '12mm'}
                          onChange={(e) => {
                            updateLayout('marginTop', e.target.value);
                            updateLayout('marginBottom', e.target.value);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-1.5 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500">Left / Right:</span>
                        <input
                          type="text"
                          value={layoutConfig.marginLeft || '12mm'}
                          onChange={(e) => {
                            updateLayout('marginLeft', e.target.value);
                            updateLayout('marginRight', e.target.value);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-1.5 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* TAB 2: COLUMNS ENGINE (Show/Hide, Move, Reorder, Width)      */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'columns' && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Table Columns Editor</span>
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
                          ? 'bg-white dark:bg-slate-950/80 border-slate-200 dark:border-slate-800'
                          : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200/60 dark:border-slate-800/40 opacity-60'
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
                            className="bg-transparent border-b border-transparent focus:border-blue-500 text-xs font-bold text-slate-900 dark:text-white px-1 py-0.5 outline-none flex-1"
                          />
                        </div>

                        {/* Reorder Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveColumn(idx, -1)}
                            className="p-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300"
                            title="Move Up / Left"
                          >
                            <span className="material-symbols-outlined text-xs">arrow_upward</span>
                          </button>
                          <button
                            type="button"
                            disabled={idx === (layoutConfig.gridColumns || []).length - 1}
                            onClick={() => moveColumn(idx, 1)}
                            className="p-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300"
                            title="Move Down / Right"
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
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-1.5 py-0.5 text-slate-900 dark:text-white w-14 text-center font-mono"
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
                                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                format_align_${align}
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
            {/* TAB 3: HEADER FIELDS & DOCUMENT METADATA                     */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'header' && (
              <div className="space-y-3 animate-fade-in">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Document Header Fields & Badges</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Toggle which fields appear in the document header block (Customer, Order #, Dates, Address, etc.).
                </p>

                <div className="space-y-2">
                  {(layoutConfig.headerFields || []).map((field, idx) => (
                    <div
                      key={field.key || idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                        field.enabled !== false
                          ? 'bg-white dark:bg-slate-950/80 border-slate-200 dark:border-slate-800'
                          : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200/60 dark:border-slate-800/40 opacity-60'
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
                          className="bg-transparent border-b border-transparent focus:border-blue-500 text-xs font-bold text-slate-900 dark:text-white px-1 py-0.5 outline-none flex-1"
                        />
                      </div>

                      <select
                        value={field.width || 'span-1'}
                        onChange={(e) => updateHeaderFieldProp(idx, 'width', e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-[10px] text-slate-700 dark:text-slate-300"
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
            {/* TAB 4: BRANDING, THEMES & TYPOGRAPHY                         */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'branding' && (
              <div className="space-y-4 animate-fade-in">
                {/* Header Theme */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">Header Layout Style:</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {HEADER_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => updateLayout('headerTheme', theme.id)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center justify-between ${
                          (layoutConfig.headerTheme || 'classic_split') === theme.id
                            ? 'bg-blue-600/15 border-blue-500 text-blue-700 dark:text-white font-bold'
                            : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                        }`}
                      >
                        <span>{theme.name}</span>
                        {(layoutConfig.headerTheme || 'classic_split') === theme.id && (
                          <span className="material-symbols-outlined text-sm text-blue-500 dark:text-blue-400">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Brand Color */}
                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">Accent & Table Header Color:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {BRAND_PALETTES.map((pal) => (
                      <button
                        key={pal.name}
                        type="button"
                        onClick={() => {
                          updateLayout('primaryColor', pal.primary);
                          updateLayout('tableHeaderBgColor', pal.bg);
                        }}
                        className="p-2 rounded-xl border border-slate-300 dark:border-slate-800 flex items-center gap-2 text-[10px] hover:border-slate-400 dark:hover:border-slate-600 transition-all text-left"
                      >
                        <span className="w-4 h-4 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: pal.primary }} />
                        <span className="truncate">{pal.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Typography */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Font Family:</label>
                    <select
                      value={layoutConfig.fontFamily || 'Inter'}
                      onChange={(e) => updateLayout('fontFamily', e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Body Text Size:</label>
                    <select
                      value={layoutConfig.bodyFontSize || '11px'}
                      onChange={(e) => updateLayout('bodyFontSize', e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="9px">9px (Micro Dense)</option>
                      <option value="10px">10px (Compact)</option>
                      <option value="11px">11px (Standard)</option>
                      <option value="12px">12px (Spacious)</option>
                    </select>
                  </div>
                </div>

                {/* Company Logo & Address toggles */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <span className="text-[11px] text-slate-700 dark:text-slate-200">Show Company Logo</span>
                    <input
                      type="checkbox"
                      checked={layoutConfig.showHeaderLogo !== false}
                      onChange={(e) => updateLayout('showHeaderLogo', e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <span className="text-[11px] text-slate-700 dark:text-slate-200">Show Address & Contact Info</span>
                    <input
                      type="checkbox"
                      checked={layoutConfig.showHeaderDetails !== false}
                      onChange={(e) => updateLayout('showHeaderDetails', e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-500"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------ */}
            {/* TAB 5: FOOTERS, SIGNATURES & TERMS                           */}
            {/* ------------------------------------------------------------ */}
            {activeTab === 'signatures' && (
              <div className="space-y-4 animate-fade-in">
                {/* Signatures Manager */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Signature Blocks</span>
                    <button
                      type="button"
                      onClick={addSignatureBlock}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">add</span> Add Signature
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(layoutConfig.signatures || []).map((sig, idx) => (
                      <div key={sig.key || idx} className="p-2.5 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={sig.label || 'Signature'}
                            onChange={(e) => updateSignatureProp(idx, 'label', e.target.value)}
                            className="bg-transparent border-b border-transparent focus:border-blue-500 text-xs font-bold text-slate-900 dark:text-white px-1 py-0.5 outline-none flex-1"
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
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
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
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <label className="block text-xs font-bold text-slate-900 dark:text-white">Terms & Conditions:</label>
                  <textarea
                    rows={3}
                    value={layoutConfig.termsConditions || ''}
                    onChange={(e) => updateLayout('termsConditions', e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>

                {/* Custom Footer Text */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-900 dark:text-white">Custom Computer-Generated Footer:</label>
                  <input
                    type="text"
                    value={layoutConfig.customFooterText || ''}
                    onChange={(e) => updateLayout('customFooterText', e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* RESET BUTTON */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="w-full py-2.5 rounded-xl border border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">restart_alt</span>
                Reset to Default Preset
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT LIVE PRINT PREVIEW (DIGITAL TWIN MULTI-PAGE RENDERER)   */}
        {/* ============================================================== */}
        <div className="flex-1 bg-slate-300/70 dark:bg-slate-950/95 overflow-y-auto p-4 md:p-8 flex flex-col items-center gap-8 relative select-none">
          <div
            id="fv-print-studio-container"
            ref={printContainerRef}
            className="flex flex-col gap-8 items-center w-full"
          >
            {pages.map((pageItems, pageIdx) => {
              const isFirstPage = pageIdx === 0;
              const isLastPage = pageIdx === pages.length - 1;
              const activeGridCols = (layoutConfig.gridColumns || []).filter((c) => c.enabled !== false);
              const activeHeaderFields = (layoutConfig.headerFields || []).filter((f) => f.enabled !== false);

              const shouldShowHeader = isFirstPage || layoutConfig.repeatHeader === true;
              const shouldShowTotals = layoutConfig.totalsPosition === 'every_page' || isLastPage;

              return (
                <div
                  key={pageIdx}
                  className="bg-white text-slate-900 shadow-2xl rounded-none relative transition-all duration-200 overflow-hidden print-preview-page flex flex-col"
                  style={{
                    width: paperWidth,
                    minHeight: paperHeight,
                    maxWidth: paperWidth,
                    fontFamily: layoutConfig.fontFamily || 'Inter',
                    fontSize: layoutConfig.bodyFontSize || '11px',
                    padding: `${layoutConfig.marginTop || '12mm'} ${layoutConfig.marginRight || '12mm'} ${layoutConfig.marginBottom || '12mm'} ${layoutConfig.marginLeft || '12mm'}`
                  }}
                >
                  {/* Page Badge (Screen only) */}
                  <div className="no-print absolute top-2 right-2 bg-slate-900/80 text-white text-[9px] font-mono px-2 py-0.5 rounded shadow pointer-events-none">
                    Page {pageIdx + 1} of {pages.length}
                  </div>

                  {/* 1. DOCUMENT HEADER (Logo, Company Identity, Document Title) */}
                  {shouldShowHeader && (
                    <div className="border-b-2 border-slate-900 pb-3 mb-4">
                      <div className="flex justify-between items-start gap-4">
                        {/* Company Left */}
                        <div className="flex items-center gap-3 max-w-[60%]">
                          {layoutConfig.showHeaderLogo !== false && (
                            companyLogo ? (
                              <img src={companyLogo} alt="Logo" className="h-12 object-contain" />
                            ) : (
                              <div className="w-12 h-12 bg-slate-100 border border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-[8px] text-slate-400 font-bold shrink-0">
                                LOGO
                              </div>
                            )
                          )}
                          <div>
                            <h1
                              className="text-lg font-black uppercase tracking-tight leading-none"
                              style={{ color: layoutConfig.primaryColor || '#004277' }}
                            >
                              {companyName}
                            </h1>
                            {layoutConfig.showHeaderDetails !== false && (
                              <p className="text-[10px] text-slate-500 leading-tight mt-1">
                                {companyAddress} • Tel: {companyPhone}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Document Title Right */}
                        <div className="text-right">
                          <h2 className="text-xl font-black uppercase tracking-wider text-slate-900">
                            {docTitleDisplay}
                          </h2>
                          <div className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-100 font-mono text-xs font-bold text-slate-800 border border-slate-200">
                            {resolvedRecord?.id || resolvedRecord?.so_number || resolvedRecord?.dcNumber || 'DOC-OFFICIAL'}
                          </div>
                        </div>
                      </div>

                      {/* Header Fields Grid (Party, Date, Reference etc.) */}
                      {activeHeaderFields.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-[10px]">
                          {activeHeaderFields.map((field) => {
                            const val = getHeaderFieldValue(field.key);
                            const spanClass = field.width === 'span-3' ? 'col-span-3' : field.width === 'span-2' ? 'col-span-2' : 'col-span-1';
                            return (
                              <div key={field.key} className={`${spanClass} flex flex-col`}>
                                <span className="text-[9px] uppercase font-bold text-slate-400">
                                  {field.label}:
                                </span>
                                <span className="font-bold text-slate-800 truncate">{val}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. TABLE GRID */}
                  <div className="flex-1 w-full overflow-hidden">
                    <table className="w-full border-collapse text-left" style={{ fontSize: layoutConfig.bodyFontSize || '11px' }}>
                      {/* Table Header (Repeatable) */}
                      {(isFirstPage || layoutConfig.repeatTableHeader !== false) && (
                        <thead>
                          <tr
                            style={{
                              backgroundColor: layoutConfig.tableHeaderBgColor || layoutConfig.primaryColor || '#004277',
                              color: layoutConfig.tableHeaderTextColor || '#ffffff'
                            }}
                          >
                            {activeGridCols.map((col) => (
                              <th
                                key={col.key}
                                className={`py-1.5 px-2 font-bold uppercase text-[9px] tracking-wider border border-slate-200/40 ${
                                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                                }`}
                                style={{ width: col.width || 'auto' }}
                              >
                                {String(col.label || col.key).replace('($)', `(${state?.adminSetup?.baseCurrency?.match(/\(([^)]+)\)/)?.[1] || '$'})`)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}

                      {/* Table Rows */}
                      <tbody>
                        {pageItems.length > 0 ? (
                          pageItems.map((item, itemIdx) => {
                            const absoluteIndex =
                              pages.slice(0, pageIdx).reduce((acc, p) => acc + p.length, 0) + itemIdx;
                            return (
                              <tr key={absoluteIndex} className="border-b border-slate-200/60 hover:bg-slate-50/50">
                                {activeGridCols.map((col) => {
                                  const cellVal = getCellValue(col.key, item, absoluteIndex);
                                  return (
                                    <td
                                      key={col.key}
                                      className={`py-1.5 px-2 border-r border-l border-slate-200/50 text-slate-800 ${
                                        col.align === 'right' ? 'text-right font-mono' : col.align === 'center' ? 'text-center' : 'text-left'
                                      }`}
                                    >
                                      {cellVal}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={activeGridCols.length} className="text-center py-6 text-slate-400 italic">
                              No line items available in this document.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 3. TOTALS & SUMMARY BLOCK */}
                  {shouldShowTotals && resolvedRecord?.totals && (
                    <div className="mt-3 flex justify-end">
                      <div
                        className="p-2.5 rounded-lg border border-slate-300 text-xs text-right space-y-1"
                        style={{
                          width: layoutConfig.totalsStyle?.width || '35%',
                          backgroundColor: layoutConfig.totalsStyle?.bgColor || '#f8fafc'
                        }}
                      >
                        {resolvedRecord.totals.subtotal !== undefined && (
                          <div className="flex justify-between text-[10px] text-slate-600">
                            <span>Subtotal:</span>
                            <span className="font-mono font-bold">
                              {Number(resolvedRecord.totals.subtotal).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {resolvedRecord.totals.tax !== undefined && (
                          <div className="flex justify-between text-[10px] text-slate-600">
                            <span>Tax / GST:</span>
                            <span className="font-mono font-bold">
                              {Number(resolvedRecord.totals.tax).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {resolvedRecord.totals.discount !== undefined && (
                          <div className="flex justify-between text-[10px] text-slate-600">
                            <span>Discount:</span>
                            <span className="font-mono font-bold">
                              {Number(resolvedRecord.totals.discount).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {resolvedRecord.totals.grandTotal !== undefined && (
                          <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300 text-slate-900">
                            <span>Grand Total:</span>
                            <span className="font-mono">
                              {Number(resolvedRecord.totals.grandTotal).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 4. FOOTER: TERMS & CONDITIONS + SIGNATURES */}
                  <div className="mt-auto pt-3 border-t border-slate-200">
                    {/* Terms & Conditions */}
                    {layoutConfig.termsConditions && (
                      <div className="text-[9px] text-slate-500 mb-3 whitespace-pre-line leading-tight">
                        <strong className="text-slate-700">Terms & Conditions: </strong>
                        {layoutConfig.termsConditions}
                      </div>
                    )}

                    {/* Signatures */}
                    {(layoutConfig.signatures || []).length > 0 && (
                      <div className="flex justify-between items-end gap-4 my-2 pt-4">
                        {layoutConfig.signatures.map((sig) => (
                          <div key={sig.key} className="flex-1 flex flex-col items-center">
                            {sig.type === 'stamp' ? (
                              <div className="w-24 h-12 border border-dashed border-slate-300 rounded mb-1 flex items-center justify-center text-[8px] text-slate-400">
                                OFFICIAL STAMP
                              </div>
                            ) : (
                              <div className="w-full border-t border-slate-800 mb-1" />
                            )}
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700 text-center">
                              {sig.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Computer Generated Disclaimer */}
                    <div className="flex justify-between items-center text-[8px] text-slate-400 pt-2 border-t border-slate-100">
                      <span>{layoutConfig.customFooterText || 'Computer Generated Document'}</span>
                      <span>
                        Page {pageIdx + 1} of {pages.length}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
