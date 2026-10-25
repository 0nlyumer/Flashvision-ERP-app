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
  getSampleRecordFromState,
  FONT_OPTIONS,
  HEADER_DESIGNS
} from '../../utils/printSchemaRegistry';
import {
  exportDocumentToPdf,
  exportDocumentToImage,
  exportDocumentToCsv,
  buildDocumentPdfBlob,
  buildDocumentPngBlob,
  buildCsvBlob
} from '../../utils/printExportUtils';
import PrintStudioShell from './PrintStudioShell';
import { resolveMargins, ensurePhaseMatrixRecord, uomSymbol } from '../../utils/printDesign';
import { PhaseMatrixSheet, PrintTableSheet } from './PrintSheetParts';
import { getDivisionPrintFullName } from '../../utils/divisionPrintName';

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


// ---------------------------------------------------------------------------
// Main modal component (part 2): layout load/discovery/save/reset (same
// persistence contract as before — Supabase print_layout_settings +
// localStorage + AppContext), the settings toolbox, Meta-Grid table pages
// with group rows + column totals + words strip + signatures, the
// phase-matrix branch, exports, and the SEND wiring through PrintStudioShell.
// ---------------------------------------------------------------------------
function UniversalPrintStudioModalInner({
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
  const pageRefs = useRef([]);

  const [activeTab, setActiveTab] = useState('pagination');
  // Settings panel is hidden by default (2026-10-25, Omer): the popup opens
  // as a clean sheet preview; the toolbar "Customize" button toggles the
  // panel, and it resets to hidden on every new open.
  const [showCustomize, setShowCustomize] = useState(false);
  useEffect(() => { if (isOpen) setShowCustomize(false); }, [isOpen]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [fitScales, setFitScales] = useState([]);

  const companyName = state?.adminSetup?.companyName || 'FLASHVISION';
  const companyAddress = state?.adminSetup?.address || 'Plot 42-B, Industrial Zone Phase III, Karachi, Pakistan';

  // 1. Resolve document record: explicit data > state sample > mock.
  //    For BOM, the sample/mock path is normalized into the phase-matrix
  //    shape (raw BOM → real builder; nothing usable → representative
  //    sample) so the test preview is never an empty sheet (2026-10-25).
  const resolvedRecord = useMemo(() => {
    if (documentData && typeof documentData === 'object') return documentData;
    const fromState = getSampleRecordFromState ? getSampleRecordFromState(documentType, state) : null;
    if (fromState) return ensurePhaseMatrixRecord(fromState, documentType, state);
    return ensurePhaseMatrixRecord(getMockPreviewData(documentType), documentType, state);
  }, [documentData, documentType, state]);

  const isPhaseDoc = resolvedRecord?.renderMode === 'phase_matrix'
    || documentType === 'bom_master' || documentType === 'consumption_history';
  const isPlanDoc = documentType === 'production_plan';
  const isBatchDoc = documentType === 'master_batch_record';
  const isPendingDoc = documentType === 'pending_orders';

  // 2. Load stored layout configuration (defaults + schema + saved).
  const buildInitialLayout = (record) => {
    const defaultSchema = DEFAULT_DOCUMENT_SCHEMAS[documentType] || DEFAULT_LAYOUT_SETTINGS;
    let localSaved = null;
    try {
      const item = localStorage.getItem(`fv_print_layout_${documentType}`);
      localSaved = item ? JSON.parse(item) : null;
    } catch (e) { localSaved = null; }
    const stateLayout = state?.adminSetup?.printSettings?.documentLayouts?.[documentType];
    const initial = {
      ...DEFAULT_LAYOUT_SETTINGS,
      ...defaultSchema,
      ...(stateLayout || {}),
      ...(localSaved || {})
    };
    return discoverDocumentSchema(documentType, record, initial, state);
  };

  const [layoutConfig, setLayoutConfig] = useState(() => buildInitialLayout(resolvedRecord));

  // Re-run discovery ONLY when the document itself changes — never on
  // unrelated state updates, so in-popup edits are never wiped mid-edit.
  const appliedKeyRef = useRef(null);
  useEffect(() => {
    const key = `${documentType}::${resolvedRecord?.id || resolvedRecord?.so_number || ''}`;
    if (appliedKeyRef.current === key) return;
    appliedKeyRef.current = key;
    setLayoutConfig(buildInitialLayout(resolvedRecord));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentType, resolvedRecord]);

  // 3. Line items.
  const resolvedLineItems = useMemo(() => {
    if (!resolvedRecord) return [];
    if (Array.isArray(resolvedRecord.items)) return resolvedRecord.items;
    if (Array.isArray(resolvedRecord.lineItems)) return resolvedRecord.lineItems;
    if (Array.isArray(resolvedRecord.rows)) return resolvedRecord.rows;
    if (Array.isArray(resolvedRecord.details)) return resolvedRecord.details;
    if (Array.isArray(resolvedRecord.records)) return resolvedRecord.records;
    return [];
  }, [resolvedRecord]);

  const updateLayout = (keyOrFn, val) => {
    setLayoutConfig((prev) => {
      if (typeof keyOrFn === 'function') return keyOrFn(prev);
      return { ...prev, [keyOrFn]: val };
    });
  };

  const getCellValue = (colKey, item, index = 0) => {
    if (!item) return '---';
    if (colKey === 'serial_no' || colKey === 'sr' || colKey === 'sr_no') return String(index + 1).padStart(2, '0');
    if (item[colKey] !== undefined && item[colKey] !== null) {
      const val = item[colKey];
      if ((colKey === 'uom' || colKey === 'unit') && typeof val === 'string') return uomSymbol(val);
      return typeof val === 'number' ? val.toLocaleString() : String(val);
    }
    if (colKey === 'item_name' || colKey === 'product_name' || colKey === 'description') {
      return item.name || item.itemName || item.productName || item.description || '---';
    }
    if (colKey === 'item_code' || colKey === 'sku' || colKey === 'code') {
      return item.itemCode || item.code || item.sku || '---';
    }
    if (colKey === 'qty' || colKey === 'quantity') return String(item.quantity ?? item.qty ?? '0');
    if (colKey === 'rolls' || colKey === 'roll_qty') return String(item.rolls || item.rollQty || item.rollsCount || '-');
    if (colKey === 'uom' || colKey === 'unit') return uomSymbol(item.uom || item.unit || 'Mtr');
    if (colKey === 'rate' || colKey === 'price') return Number(item.price || item.rate || 0).toLocaleString();
    if (colKey === 'sub_total' || colKey === 'total') {
      if (item.sub_total !== undefined) return Number(item.sub_total).toLocaleString();
      const q = Number(item.quantity || item.qty || 0);
      const r = Number(item.price || item.rate || 0);
      const d = Number(item.discount || 0);
      return Number(q * r - d).toLocaleString();
    }
    return item[colKey] !== undefined ? String(item[colKey]) : '---';
  };

  const numericValue = (colKey, item) => {
    if (!item) return 0;
    const direct = item[colKey];
    if (typeof direct === 'number') return direct;
    if (colKey === 'sub_total' || colKey === 'total') {
      if (typeof item.sub_total === 'number') return item.sub_total;
      const q = Number(item.quantity || item.qty || 0);
      const r = Number(item.price || item.rate || 0);
      const d = Number(item.discount || 0);
      return q * r - d;
    }
    if (colKey === 'qty' || colKey === 'quantity') return Number(item.quantity ?? item.qty ?? 0);
    if (colKey === 'rate' || colKey === 'price') return Number(item.price ?? item.rate ?? 0);
    const n = Number(direct);
    return Number.isFinite(n) ? n : 0;
  };

  const getHeaderFieldValue = (fieldKey) => {
    if (!resolvedRecord) return '---';
    if (resolvedRecord[fieldKey] !== undefined && resolvedRecord[fieldKey] !== null) {
      const val = resolvedRecord[fieldKey];
      if (fieldKey === 'date' || fieldKey.includes('_date')) {
        const d = new Date(val);
        return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      return String(val);
    }
    if (resolvedRecord.header && resolvedRecord.header[fieldKey] !== undefined) {
      return String(resolvedRecord.header[fieldKey]);
    }
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

  // Column / header-field / signature manipulations (same as before).
  const toggleColumn = (idx) => {
    const nextCols = [...(layoutConfig.gridColumns || [])];
    nextCols[idx] = { ...nextCols[idx], enabled: !nextCols[idx].enabled };
    updateLayout('gridColumns', nextCols);
  };
  const moveColumn = (idx, direction) => {
    const nextCols = [...(layoutConfig.gridColumns || [])];
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= nextCols.length) return;
    const temp = nextCols[idx]; nextCols[idx] = nextCols[targetIdx]; nextCols[targetIdx] = temp;
    updateLayout('gridColumns', nextCols);
  };
  const updateColumnProp = (idx, prop, value) => {
    const nextCols = [...(layoutConfig.gridColumns || [])];
    nextCols[idx] = { ...nextCols[idx], [prop]: value };
    updateLayout('gridColumns', nextCols);
  };
  const addCustomColumn = () => {
    const nextCols = [...(layoutConfig.gridColumns || [])];
    nextCols.push({ key: `custom_${Date.now().toString().slice(-4)}`, label: 'New Column', enabled: true, width: '15%', align: 'left' });
    updateLayout('gridColumns', nextCols);
  };
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
  const addSignatureBlock = () => {
    const sigs = [...(layoutConfig.signatures || [])];
    sigs.push({ key: `sig_${Date.now().toString().slice(-4)}`, label: 'Authorized Signatory', size: '1/3', type: 'text' });
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

  const handleSaveLayout = async () => {
    setSaving(true);
    try {
      await supabase.from('print_layout_settings').upsert(
        { tenant_id: 'default_tenant', document_type: documentType, layout_config: layoutConfig, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id,document_type' }
      );
      localStorage.setItem(`fv_print_layout_${documentType}`, JSON.stringify(layoutConfig));
      if (setCollection) {
        const cur = state?.adminSetup?.printSettings || {};
        const layouts = { ...(cur.documentLayouts || {}), [documentType]: layoutConfig };
        setCollection('adminSetup', { ...(state?.adminSetup || {}), printSettings: { ...cur, documentLayouts: layouts } });
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

  const handleResetDefaults = () => {
    const defaultSchema = DEFAULT_DOCUMENT_SCHEMAS[documentType] || DEFAULT_LAYOUT_SETTINGS;
    setLayoutConfig(defaultSchema);
    localStorage.removeItem(`fv_print_layout_${documentType}`);
    appAlert?.('Layout reset to default preset.');
  };

  // 4. Display rows: regrouped when groupBy is set (pending_orders report),
  // otherwise the plain item list. Group rows carry _isGroup markers.
  const activeCols = useMemo(
    () => (layoutConfig.gridColumns || []).filter((c) => c.enabled !== false),
    [layoutConfig.gridColumns]
  );

  const displayRows = useMemo(() => {
    const groupBy = layoutConfig.groupBy || 'none';
    if (!isPendingDoc || groupBy === 'none') return resolvedLineItems;
    const keyOf = (item) => (groupBy === 'status' ? (item.status || '—') : (item.customer_name || item.customerName || item._group || '—'));
    const groups = [];
    const byKey = new Map();
    resolvedLineItems.forEach((item) => {
      const k = keyOf(item);
      if (!byKey.has(k)) { byKey.set(k, []); groups.push(k); }
      byKey.get(k).push(item);
    });
    const out = [];
    groups.forEach((k) => {
      const items = byKey.get(k);
      const sums = {};
      activeCols.forEach((c) => { if (c.total) sums[c.key] = items.reduce((s, it) => s + numericValue(c.key, it), 0); });
      out.push({ _isGroup: true, _group: k, _count: items.length, _sums: sums });
      out.push(...items);
    });
    return out;
  }, [isPendingDoc, layoutConfig.groupBy, resolvedLineItems, activeCols]);

  // 5. Multi-page chunking over display rows.
  const basePages = useMemo(() => {
    if (isPhaseDoc) return [[]];
    const items = displayRows || [];
    const firstPageLimit = Math.max(1, Number(layoutConfig.firstPageRows || 8));
    const continuationLimit = Math.max(1, Number(layoutConfig.continuationPageRows || 14));
    if (items.length === 0) return [[]];
    const chunks = [];
    const copy = [...items];
    chunks.push(copy.splice(0, firstPageLimit));
    while (copy.length > 0) chunks.push(copy.splice(0, continuationLimit));
    return chunks;
  }, [displayRows, isPhaseDoc, layoutConfig.firstPageRows, layoutConfig.continuationPageRows]);

  // Measured pagination (Browser Print Program, 2026-10-25): the row-count
  // chunks above are estimates. The effect below (after the paper/scale
  // constants) measures each rendered sheet and moves rows down from any
  // sheet whose content is taller than the printable area, so in 'fill'
  // mode every sheet is exactly one printed page — page labels stay true
  // and no row is ever dropped. The grow-don't-clip print CSS remains as a
  // safety net for a single row taller than a page.
  const [fittedPages, setFittedPages] = useState(null);
  const pages = fittedPages || basePages;
  useEffect(() => { setFittedPages(null); }, [basePages]);

  const columnTotals = useMemo(() => {
    const totals = {};
    activeCols.forEach((c) => {
      if (c.total) totals[c.key] = resolvedLineItems.reduce((s, it) => s + numericValue(c.key, it), 0);
    });
    return totals;
  }, [activeCols, resolvedLineItems]);

  // Paper + margins + scaling.
  const currentPaper = PAPER_DIMENSIONS[layoutConfig.paperSize] || PAPER_DIMENSIONS.A4;
  const isLandscape = layoutConfig.orientation === 'landscape';
  const paperWidth = isLandscape ? currentPaper.minHeight : currentPaper.width;
  const paperHeight = isLandscape ? currentPaper.width : currentPaper.minHeight;
  const margins = resolveMargins(layoutConfig);
  const scaleMode = layoutConfig.scaleMode || 'fill';

  const docTitleDisplay =
    documentTitle ||
    SYSTEM_DOCUMENTS.find((d) => d.id === documentType)?.name ||
    documentType.replace(/_/g, ' ').toUpperCase();

  const docNo = resolvedRecord?.id || resolvedRecord?.so_number || resolvedRecord?.dcNumber || resolvedRecord?.header?.plan_id || 'Document';
  const filenameBase = `${documentType.toUpperCase()}_${docNo}`;

  // Header meta: enabled header fields, with the customer field lifted out
  // as the party block (Meta-Grid pattern from the approved samples).
  const headerFields = (layoutConfig.headerFields || []).filter((f) => f.enabled !== false);
  const partyField = headerFields.find((f) => ['customer', 'customer_name', 'party_name'].includes(f.key));
  const party = partyField && getHeaderFieldValue(partyField.key) !== '---'
    ? { label: partyField.label || 'Customer', value: getHeaderFieldValue(partyField.key) }
    : null;
  const metaRows = headerFields
    .filter((f) => f !== partyField)
    .map((f) => ({ label: f.label || f.key, value: getHeaderFieldValue(f.key) }));

  // Measured pagination: in 'fill' mode, move rows down from any sheet
  // whose rendered content exceeds the printable height (see basePages).
  useEffect(() => {
    if (scaleMode !== 'fill' || isPhaseDoc) return;
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      // A sheet left holding only a group header merges into the next sheet.
      for (let i = 0; i < pages.length - 1; i++) {
        if (pages[i].length === 1 && pages[i][0]?._isGroup) {
          const next = pages.map((p) => [...p]);
          const [head] = next.splice(i, 1);
          next[i] = [...head, ...next[i]];
          setFittedPages(next);
          return;
        }
      }
      for (let i = 0; i < pages.length; i++) {
        const el = pageRefs.current[i];
        if (!el) continue;
        const inner = el.querySelector('[data-fit-content]');
        if (!inner) continue;
        const avail = (parseFloat(getComputedStyle(el).minHeight) || el.clientHeight)
          - parseFloat(getComputedStyle(el).paddingTop || 0)
          - parseFloat(getComputedStyle(el).paddingBottom || 0);
        if (inner.scrollHeight > avail + 2 && pages[i].length > 1) {
          const next = pages.map((p) => [...p]);
          const moved = [];
          moved.unshift(next[i].pop());
          while (next[i].length > 1 && next[i][next[i].length - 1]?._isGroup) moved.unshift(next[i].pop());
          if (i + 1 < next.length) next[i + 1] = [...moved, ...next[i + 1]];
          else next.push(moved);
          setFittedPages(next);
          return;
        }
      }
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [pages, scaleMode, isPhaseDoc, layoutConfig, paperWidth, paperHeight]);

  // Fit-to-page: measure each page's content and shrink (never enlarge).
  useEffect(() => {
    if (scaleMode !== 'fit') { setFitScales([]); return; }
    const raf = requestAnimationFrame(() => {
      const next = pageRefs.current.map((el) => {
        if (!el) return 1;
        const inner = el.querySelector('[data-fit-content]');
        if (!inner) return 1;
        const avail = (parseFloat(getComputedStyle(el).minHeight) || el.clientHeight)
          - parseFloat(getComputedStyle(el).paddingTop || 0)
          - parseFloat(getComputedStyle(el).paddingBottom || 0);
        const content = inner.scrollHeight;
        if (content <= 0 || avail <= 0) return 1;
        return Math.min(1, avail / content);
      });
      setFitScales((prev) => (
        prev.length === next.length && prev.every((v, i) => Math.abs(v - next[i]) < 0.001) ? prev : next
      ));
    });
    return () => cancelAnimationFrame(raf);
  }, [scaleMode, pages, layoutConfig, paperWidth, paperHeight]);

  // Exports (shell bottom bar) + SEND file builder (shared by both).
  const flattenedPhaseRows = useMemo(() => {
    if (!isPhaseDoc) return [];
    const rows = [];
    (resolvedRecord.sections || []).forEach((section) => {
      (section.phases || []).forEach((phase) => {
        (phase.rows || []).forEach((row) => {
          rows.push({ section: section.name || section.code || '', phase: phase.name || '', material: row.name || '', qty: row.qty, uom: uomSymbol(row.uom || '') });
        });
      });
    });
    return rows;
  }, [isPhaseDoc, resolvedRecord]);

  const makeSendFile = async (format) => {
    const el = printContainerRef.current;
    if (format === 'pdf') {
      return buildDocumentPdfBlob(el, { paperSize: layoutConfig.paperSize, orientation: layoutConfig.orientation });
    }
    if (format === 'png') {
      return buildDocumentPngBlob(el, 3);
    }
    if (format === 'csv') {
      if (isPhaseDoc) {
        return buildCsvBlob(
          [
            { key: 'section', label: 'Item', enabled: true },
            { key: 'phase', label: 'Phase', enabled: true },
            { key: 'material', label: 'Raw Material', enabled: true },
            { key: 'qty', label: 'Qty', enabled: true },
            { key: 'uom', label: 'UOM', enabled: true }
          ],
          flattenedPhaseRows
        );
      }
      return buildCsvBlob(activeCols, resolvedLineItems);
    }
    return null;
  };

  const downloadBlob = (blob, filename) => {
    if (!blob) { appAlert?.('Could not build this file.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleDownloadPdf = async () => {
    setExporting('pdf');
    try {
      const blob = await buildDocumentPdfBlob(printContainerRef.current, { paperSize: layoutConfig.paperSize, orientation: layoutConfig.orientation });
      downloadBlob(blob, `${filenameBase}.pdf`);
    } finally { setExporting(null); }
  };
  const handleDownloadImage = async () => {
    setExporting('img');
    try {
      const blob = await buildDocumentPngBlob(printContainerRef.current, 3);
      downloadBlob(blob, `${filenameBase}.png`);
    } finally { setExporting(null); }
  };
  const handleExportCsv = () => {
    setExporting('csv');
    try {
      if (isPhaseDoc) {
        downloadBlob(buildCsvBlob(
          [
            { key: 'section', label: 'Item', enabled: true },
            { key: 'phase', label: 'Phase', enabled: true },
            { key: 'material', label: 'Raw Material', enabled: true },
            { key: 'qty', label: 'Qty', enabled: true },
            { key: 'uom', label: 'UOM', enabled: true }
          ],
          flattenedPhaseRows
        ), `${filenameBase}.csv`);
      } else {
        exportDocumentToCsv(activeCols, resolvedLineItems, `${filenameBase}.csv`);
      }
    } finally { setExporting(null); }
  };
  const handlePrintNow = () => { window.print(); };

  if (!isOpen) return null;

  // Phase-matrix print CSS: long sheets flow to further printed pages
  // instead of being clipped at one page height.
  // Print pagination contract (Browser Print Program, 2026-10-25): sheets
  // GROW, never clip. Row-count chunking is only an estimate — when wrapped
  // rows make a chunk taller than one page, the sheet flows onto the next
  // page (table headers repeat) instead of silently dropping rows under
  // overflow:hidden. 'fit' is the exception: it shrink-scales each sheet to
  // one page by measurement, so it keeps the fixed page box.
  const extraPrintCss = (isPhaseDoc || scaleMode === 'actual')
    ? `.print-preview-page { height: auto !important; min-height: ${paperHeight} !important; overflow: visible !important; page-break-after: auto !important; break-after: auto !important; }`
    : scaleMode === 'fit'
      ? ''
      : `.print-preview-page { height: auto !important; min-height: ${paperHeight} !important; overflow: visible !important; } .print-preview-page tr { break-inside: avoid !important; }`;

  // ---- Settings toolbox (left column inside the shell frame) ----
  const tabBtn = (id, label, icon) => (
    <button
      key={id}
      type="button"
      onClick={() => setActiveTab(id)}
      className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer text-xs font-bold ${activeTab === id ? 'bg-blue-600 text-white shadow' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/60'}`}
    >
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {label}
    </button>
  );

  const settingsPanel = (
    <div className="no-print w-full lg:w-[400px] xl:w-[440px] bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden z-10">
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 p-1.5 gap-1 overflow-x-auto">
        {tabBtn('pagination', 'Pages & Rows', 'auto_stories')}
        {!isPhaseDoc && tabBtn('columns', `Columns (${activeCols.length})`, 'view_column')}
        {!isPhaseDoc && tabBtn('header', 'Header Fields', 'badge')}
        {tabBtn('branding', 'Style & Theme', 'style')}
        {!isPhaseDoc && tabBtn('signatures', 'Footer & Sigs', 'draw')}
        {isPhaseDoc && tabBtn('phases', 'Phases', 'view_module')}
        {isPendingDoc && tabBtn('report', 'Report', 'summarize')}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-600 dark:text-slate-300">
        {activeTab === 'pagination' && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs">Multi-Page Splitting &amp; Row Limits</h3>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[11px] font-semibold">Rows on First Page:</label>
                  <span className="font-mono text-blue-600 font-bold">{layoutConfig.firstPageRows || 8} rows</span>
                </div>
                <input type="range" min="2" max="25" value={layoutConfig.firstPageRows || 8} onChange={(e) => updateLayout('firstPageRows', parseInt(e.target.value))} className="w-full accent-blue-500 cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[11px] font-semibold">Rows on Continuation Pages:</label>
                  <span className="font-mono text-blue-600 font-bold">{layoutConfig.continuationPageRows || 14} rows</span>
                </div>
                <input type="range" min="4" max="35" value={layoutConfig.continuationPageRows || 14} onChange={(e) => updateLayout('continuationPageRows', parseInt(e.target.value))} className="w-full accent-blue-500 cursor-pointer" />
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-[11px]">
                <div className="font-bold">Active Layout Distribution:</div>
                {pages.map((pItems, idx) => (
                  <div key={idx} className="flex justify-between"><span>Page {idx + 1}:</span><strong>{isPhaseDoc ? flattenedPhaseRows.length : pItems.length} rows</strong></div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs">Page Repetition &amp; Totals</h3>
              <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border cursor-pointer">
                <span className="text-[11px] font-medium">Repeat Table Header Row on Each Page</span>
                <input type="checkbox" checked={layoutConfig.repeatTableHeader !== false} onChange={(e) => updateLayout('repeatTableHeader', e.target.checked)} className="accent-blue-500" />
              </label>
              <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border cursor-pointer">
                <span className="text-[11px] font-medium">Repeat Document Header on Each Page</span>
                <input type="checkbox" checked={layoutConfig.repeatHeader === true} onChange={(e) => updateLayout('repeatHeader', e.target.checked)} className="accent-blue-500" />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium">Totals Position</span>
                <select value={layoutConfig.totalsPosition || 'last_page'} onChange={(e) => updateLayout('totalsPosition', e.target.value)} className="bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-[11px] font-bold cursor-pointer">
                  <option value="last_page">Last Page Only</option>
                  <option value="every_page">Every Page</option>
                </select>
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium">Paper Format</span>
                <select value={layoutConfig.paperSize || 'A4'} onChange={(e) => updateLayout('paperSize', e.target.value)} className="bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-[11px] font-bold cursor-pointer">
                  {Object.keys(PAPER_DIMENSIONS).map((k) => (<option key={k} value={k}>{PAPER_DIMENSIONS[k].label}</option>))}
                </select>
              </label>
              {layoutConfig.marginPreset === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  {['marginTop', 'marginRight', 'marginBottom', 'marginLeft'].map((k) => (
                    <label key={k} className="flex items-center gap-1 text-[11px] font-medium">
                      {k.replace('margin', '')}
                      <input value={layoutConfig[k] || '12mm'} onChange={(e) => updateLayout(k, e.target.value)} className="w-full bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 font-mono text-[11px]" />
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-400">Orientation, margins and scaling live in the top toolbar; custom margin values are edited here.</p>
            </div>
          </div>
        )}

        {activeTab === 'columns' && !isPhaseDoc && (
          <div className="space-y-2">
            {(layoutConfig.gridColumns || []).map((col, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border">
                <input type="checkbox" checked={col.enabled !== false} onChange={() => toggleColumn(idx)} className="accent-blue-500" />
                <input value={col.label} onChange={(e) => updateColumnProp(idx, 'label', e.target.value)} className="flex-1 min-w-0 bg-white dark:bg-slate-900 border rounded-lg px-2 py-1 text-[11px] font-bold" />
                <select value={col.align || 'left'} onChange={(e) => updateColumnProp(idx, 'align', e.target.value)} className="bg-white dark:bg-slate-900 border rounded-lg px-1 py-1 text-[11px] cursor-pointer">
                  <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                </select>
                <button type="button" onClick={() => moveColumn(idx, -1)} disabled={idx === 0} className="px-1.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-[11px] font-bold disabled:opacity-40 cursor-pointer">↑</button>
                <button type="button" onClick={() => moveColumn(idx, 1)} disabled={idx === (layoutConfig.gridColumns || []).length - 1} className="px-1.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-[11px] font-bold disabled:opacity-40 cursor-pointer">↓</button>
                <label className="flex items-center gap-1 text-[10px] font-bold" title="Show column total">
                  Σ<input type="checkbox" checked={col.total === true} onChange={(e) => updateColumnProp(idx, 'total', e.target.checked)} className="accent-blue-500" />
                </label>
              </div>
            ))}
            <button type="button" onClick={addCustomColumn} className="w-full py-2 rounded-xl bg-blue-600 text-white text-[11px] font-bold cursor-pointer">+ Add Custom Column</button>
          </div>
        )}

        {activeTab === 'header' && !isPhaseDoc && (
          <div className="space-y-2">
            {(layoutConfig.headerFields || []).map((field, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border">
                <input type="checkbox" checked={field.enabled !== false} onChange={() => toggleHeaderField(idx)} className="accent-blue-500" />
                <input value={field.label} onChange={(e) => updateHeaderFieldProp(idx, 'label', e.target.value)} className="flex-1 min-w-0 bg-white dark:bg-slate-900 border rounded-lg px-2 py-1 text-[11px] font-bold" />
                <span className="font-mono text-[10px] text-slate-400">{field.key}</span>
              </div>
            ))}
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border cursor-pointer">
              <span className="text-[11px] font-medium">Show Company Address in Header</span>
              <input type="checkbox" checked={layoutConfig.showHeaderDetails !== false} onChange={(e) => updateLayout('showHeaderDetails', e.target.checked)} className="accent-blue-500" />
            </label>
          </div>
        )}

        {activeTab === 'branding' && (
          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-2xl border space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs">Header Band &amp; Alignment</h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium w-24 shrink-0">Band Start</span>
                <input type="color" value={layoutConfig.bandColor || '#4338ca'} onChange={(e) => updateLayout('bandColor', e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
                <input value={layoutConfig.bandColor || '#4338ca'} onChange={(e) => updateLayout('bandColor', e.target.value)} className="flex-1 bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 font-mono text-[11px]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium w-24 shrink-0">Band End</span>
                <input type="color" value={layoutConfig.bandColor2 || '#4f46e5'} onChange={(e) => updateLayout('bandColor2', e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
                <input value={layoutConfig.bandColor2 || '#4f46e5'} onChange={(e) => updateLayout('bandColor2', e.target.value)} className="flex-1 bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 font-mono text-[11px]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium w-24 shrink-0">Totals Bar</span>
                <input type="color" value={layoutConfig.totalsColor || '#232946'} onChange={(e) => updateLayout('totalsColor', e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
                <input value={layoutConfig.totalsColor || '#232946'} onChange={(e) => updateLayout('totalsColor', e.target.value)} className="flex-1 bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 font-mono text-[11px]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium w-24 shrink-0">Table Header</span>
                <input type="color" value={layoutConfig.tableHeaderBgColor || '#004277'} onChange={(e) => updateLayout('tableHeaderBgColor', e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
                <input value={layoutConfig.tableHeaderBgColor || '#004277'} onChange={(e) => updateLayout('tableHeaderBgColor', e.target.value)} className="flex-1 bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 font-mono text-[11px]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium w-24 shrink-0">Table Hdr Text</span>
                <input type="color" value={layoutConfig.tableHeaderTextColor || '#ffffff'} onChange={(e) => updateLayout('tableHeaderTextColor', e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
                <input value={layoutConfig.tableHeaderTextColor || '#ffffff'} onChange={(e) => updateLayout('tableHeaderTextColor', e.target.value)} className="flex-1 bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 font-mono text-[11px]" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-medium w-24 shrink-0">Presets</span>
                {BRAND_PALETTES.map((p) => (
                  <button key={p.name} type="button" title={p.name} onClick={() => { updateLayout('bandColor', p.primary); updateLayout('bandColor2', p.primary); }} className="w-7 h-7 rounded-full border-2 border-white shadow cursor-pointer" style={{ background: p.primary }} />
                ))}
              </div>
              <div>
                <span className="text-[11px] font-medium block mb-1">Header Block Alignment</span>
                <div className="flex gap-1.5">
                  {['left', 'center', 'right'].map((a) => (
                    <button key={a} type="button" onClick={() => updateLayout('headerAlign', a)} className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold capitalize cursor-pointer ${layoutConfig.headerAlign === a ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>{a}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-2xl border space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs">Theme &amp; Type</h3>
              <label className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium">Header Theme</span>
                <select value={layoutConfig.headerTheme || 'classic_split'} onChange={(e) => updateLayout('headerTheme', e.target.value)} className="bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-[11px] font-bold cursor-pointer">
                  {HEADER_THEMES.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium">Header Design</span>
                <select value={layoutConfig.headerDesign || 'classic'} onChange={(e) => updateLayout('headerDesign', e.target.value)} className="bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-[11px] font-bold cursor-pointer">
                  {HEADER_DESIGNS.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium">Font Family</span>
                <select value={layoutConfig.fontFamily || 'Inter'} onChange={(e) => updateLayout('fontFamily', e.target.value)} className="bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-[11px] font-bold cursor-pointer">
                  {FONT_OPTIONS.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium">Body Font Size</span>
                <input value={layoutConfig.bodyFontSize || '11px'} onChange={(e) => updateLayout('bodyFontSize', e.target.value)} className="w-24 bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 font-mono text-[11px]" />
              </label>
              <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border cursor-pointer">
                <span className="text-[11px] font-medium">Show Header Logo</span>
                <input type="checkbox" checked={layoutConfig.showHeaderLogo !== false} onChange={(e) => updateLayout('showHeaderLogo', e.target.checked)} className="accent-blue-500" />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'signatures' && !isPhaseDoc && (
          <div className="space-y-2">
            {(layoutConfig.signatures || []).map((sig, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border">
                <input value={sig.label} onChange={(e) => updateSignatureProp(idx, 'label', e.target.value)} className="flex-1 min-w-0 bg-white dark:bg-slate-900 border rounded-lg px-2 py-1 text-[11px] font-bold" />
                <button type="button" onClick={() => removeSignatureBlock(idx)} className="px-2 py-1 rounded-lg bg-red-100 text-red-700 text-[11px] font-bold cursor-pointer">Remove</button>
              </div>
            ))}
            <button type="button" onClick={addSignatureBlock} className="w-full py-2 rounded-xl bg-blue-600 text-white text-[11px] font-bold cursor-pointer">+ Add Signature</button>
            <label className="block">
              <span className="text-[11px] font-medium">Terms &amp; Conditions</span>
              <textarea value={layoutConfig.termsConditions || ''} onChange={(e) => updateLayout('termsConditions', e.target.value)} rows={3} className="w-full mt-1 bg-white dark:bg-slate-900 border rounded-xl px-2 py-1.5 text-[11px]" />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium">Custom Footer Text</span>
              <input value={layoutConfig.customFooterText || ''} onChange={(e) => updateLayout('customFooterText', e.target.value)} className="w-full mt-1 bg-white dark:bg-slate-900 border rounded-xl px-2 py-1.5 text-[11px]" />
            </label>
          </div>
        )}

        {activeTab === 'phases' && isPhaseDoc && (
          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-2xl border space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs">Phase Panels — This Print Only</h3>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[11px] font-semibold">Phases Per Row:</label>
                  <span className="font-mono text-blue-600 font-bold">{layoutConfig.phasesPerRow || 4}</span>
                </div>
                <input type="range" min="2" max="6" value={layoutConfig.phasesPerRow || 4} onChange={(e) => updateLayout('phasesPerRow', parseInt(e.target.value))} className="w-full accent-blue-500 cursor-pointer" />
                <p className="text-[10px] text-slate-400">Extra phases wrap to the next panel row — never squeezed.</p>
              </div>
              <label className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium">Panel Row Height</span>
                <select value={layoutConfig.phaseRowHeight || 'natural'} onChange={(e) => updateLayout('phaseRowHeight', e.target.value)} className="bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-[11px] font-bold cursor-pointer">
                  <option value="natural">Natural (each panel its own height)</option>
                  <option value="equal">Equal (panels stretch to row height)</option>
                </select>
              </label>
              <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border cursor-pointer">
                <span className="text-[11px] font-medium">Show Phase Totals Inside Panels</span>
                <input type="checkbox" checked={layoutConfig.showPhaseTotals !== false} onChange={(e) => updateLayout('showPhaseTotals', e.target.checked)} className="accent-blue-500" />
              </label>
              <p className="text-[10px] text-slate-400">There is deliberately no category grand total on BOM / Consumption prints — phase totals inside the panels are enough.</p>
            </div>
          </div>
        )}

        {activeTab === 'report' && isPendingDoc && (
          <div className="space-y-3">
            <div className="bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-2xl border space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs">Orders Report Grouping</h3>
              <label className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium">Group Rows By</span>
                <select value={layoutConfig.groupBy || 'customer'} onChange={(e) => updateLayout('groupBy', e.target.value)} className="bg-white dark:bg-slate-900 border rounded-lg px-2 py-1.5 text-[11px] font-bold cursor-pointer">
                  <option value="customer">Customer</option>
                  <option value="status">Status</option>
                  <option value="none">No Grouping</option>
                </select>
              </label>
              <p className="text-[10px] text-slate-400">Group header rows show the order count and the summed ORDER (M) / PRODUCED (M) for that group. The status filter itself is chosen on the Order Management screen before opening this print.</p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 p-3 flex items-center gap-2">
        <button type="button" onClick={handleSaveLayout} disabled={saving} className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
          {saveSuccess ? 'Saved Default!' : saving ? 'Saving...' : 'Save as Default'}
        </button>
        <button type="button" onClick={handleResetDefaults} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border text-xs font-bold cursor-pointer">Reset</button>
      </div>
    </div>
  );

  // ---- Page rendering ----
  const phaseDocTitle = documentType === 'consumption_history' ? 'CONSUMPTION' : documentType === 'bom_master' ? 'BILL OF MATERIALS' : docTitleDisplay;
  const phaseRecord = isPhaseDoc
    ? { ...resolvedRecord, docTitle: phaseDocTitle, docSub: resolvedRecord.docSub || '' }
    : null;

  // Page rendering delegates to the shared PrintTableSheet (the same
  // component the Print Settings designer preview renders — one layout
  // family, one source of truth).
  const renderTablePage = (pageItems, pageIdx) => {
    const isLastPage = pageIdx === pages.length - 1;
    const showTotals = layoutConfig.totalsPosition === 'every_page' || isLastPage;
    const showHeader = pageIdx === 0 || layoutConfig.repeatHeader === true;
    const fitScale = scaleMode === 'fit' ? (fitScales[pageIdx] ?? 1) : 1;
    let startItemNo = 0;
    pages.slice(0, pageIdx).forEach((pg) => { startItemNo += pg.filter((r) => !r._isGroup).length; });
    return (
      <PrintTableSheet
        key={pageIdx}
        pageRef={(el) => { pageRefs.current[pageIdx] = el; }}
        layout={layoutConfig}
        companyName={isPlanDoc || isBatchDoc ? 'AJ SYNTHETIC' : companyName}
        companyLegal={isPlanDoc ? 'AJ Synthetic Leather & Footwear Industries Pvt. Limited' : isBatchDoc ? (getDivisionPrintFullName('AJ Synthetic') || 'AJ Synthetic Leather & Footwear Industries Pvt. Limited') : ''}
        companyAddress={isPlanDoc || isBatchDoc ? '' : companyAddress}
        party={party}
        metaRows={metaRows}
        docTitle={docTitleDisplay}
        docSub={isPlanDoc ? 'ORDER LIST' : documentType === 'general_ledger' ? (resolvedRecord?.docSub || null) : null}
        planVariant={isPlanDoc}
        columns={activeCols}
        items={pageItems}
        getCellValue={getCellValue}
        startItemNo={startItemNo}
        columnTotals={columnTotals}
        grandTotal={resolvedRecord?.totals?.grandTotal}
        showHeader={showHeader}
        showTotals={showTotals}
        isLastPage={isLastPage}
        pageLabel={`Page ${pageIdx + 1} of ${pages.length}`}
        footerPageText={`Page ${pageIdx + 1} of ${pages.length}`}
        margins={margins}
        paperWidth={paperWidth}
        paperHeight={paperHeight}
        fixedHeight={scaleMode === 'fit'}
        fitScale={fitScale}
      />
    );
  };

  return (
    <PrintStudioShell
      onClose={onClose}
      title={docTitleDisplay}
      subtitle={`Universal Print Studio • Rows: ${isPhaseDoc ? flattenedPhaseRows.length : resolvedLineItems.length} • Pages: ${isPhaseDoc ? 1 : pages.length}`}
      paperLabel={currentPaper.label}
      paperWidth={paperWidth}
      paperHeight={paperHeight}
      orientation={layoutConfig.orientation || 'portrait'}
      onOrientationChange={(v) => updateLayout('orientation', v)}
      marginPreset={layoutConfig.marginPreset || 'default'}
      onMarginPresetChange={(v) => updateLayout('marginPreset', v)}
      scaleMode={scaleMode}
      onScaleModeChange={(v) => updateLayout('scaleMode', v)}
      onPrint={handlePrintNow}
      onExportCsv={handleExportCsv}
      onExportImage={handleDownloadImage}
      onExportPdf={handleDownloadPdf}
      exporting={exporting}
      sendConfig={{
        documentTitle: docTitleDisplay,
        filenameBase,
        makeFile: makeSendFile,
        csvAvailable: isPhaseDoc ? flattenedPhaseRows.length > 0 : resolvedLineItems.length > 0
      }}
      customizeActive={showCustomize}
      onToggleCustomize={() => setShowCustomize((v) => !v)}
      settingsPanel={showCustomize ? settingsPanel : null}
      extraPrintCss={extraPrintCss}
    >
      <div ref={printContainerRef} className="flex flex-col gap-8 items-center w-full">
        {isPhaseDoc ? (
          <PhaseMatrixSheet
            record={phaseRecord}
            layout={layoutConfig}
            companyName="AJ SYNTHETIC"
            companyLegal="AJ Synthetic Leather & Footwear Industries Pvt. Limited"
            margins={margins}
            paperWidth={paperWidth}
            paperHeight={paperHeight}
            pageIdx={0}
            pageCount={1}
          />
        ) : (
          pages.map((pageItems, pageIdx) => renderTablePage(pageItems, pageIdx))
        )}
      </div>
    </PrintStudioShell>
  );
}

// ---------------------------------------------------------------------------
// Error boundary (2026-10-24 entry-point fix): if anything in the studio's
// render throws (bad saved layout, unexpected record shape), the user must
// SEE the failure with a way out — never a silently dead screen / vanished
// popup, which is how the dead Print BOM entry point presented itself.
// ---------------------------------------------------------------------------
class PrintStudioErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[PrintStudio] render failed:', error, info);
  }
  render() {
    if (this.state.error) {
      const { onClose } = this.props;
      return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(2,6,23,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ background: '#fff', color: '#0f172a', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px' }}>Print preview could not be opened</h3>
            <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 6px' }}>
              Something in this document&apos;s print data or saved layout failed to render. Your data is safe — nothing was changed.
            </p>
            <p style={{ fontSize: '12px', color: '#b91c1c', fontFamily: 'monospace', margin: '0 0 18px', wordBreak: 'break-word' }}>
              {String(this.state.error?.message || this.state.error)}
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => this.setState({ error: null })}
                style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f1f5f9', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => { this.setState({ error: null }); onClose?.(); }}
                style={{ padding: '8px 14px', borderRadius: '10px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function UniversalPrintStudioModal(props) {
  return (
    <PrintStudioErrorBoundary onClose={props.onClose}>
      <UniversalPrintStudioModalInner {...props} />
    </PrintStudioErrorBoundary>
  );
}
