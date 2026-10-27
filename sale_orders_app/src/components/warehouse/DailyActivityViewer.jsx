import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { buildDailyActivity } from '../../utils/dailyActivity';
import { DEFAULT_DOCUMENT_SCHEMAS, DEFAULT_LAYOUT_SETTINGS, SYSTEM_DOCUMENTS, discoverDocumentSchema } from '../../utils/printSchemaRegistry';
import { resolveMargins, ensurePhaseMatrixRecord } from '../../utils/printDesign';
import { getPrintCellValue, getPrintNumericValue, getPrintHeaderFieldValue, resolveRecordLineItems } from '../../utils/printSheetData';
import { buildDocumentPdfBlob } from '../../utils/printExportUtils';
import { getDivisionPrintFullName } from '../../utils/divisionPrintName';
import { PhaseMatrixSheet, PrintTableSheet } from '../ui/PrintSheetParts';
import SlipDocumentPopup, { SlipDocumentSheet } from './SlipDocumentPopup';
import UniversalPrintStudioModal from '../ui/UniversalPrintStudioModal';

// DailyActivityViewer — the Daily Activity File (Omer's approved
// design, 2026-10-26; implemented 2026-10-28). One virtual file per
// date, assembled LIVE from server state on open (utils/dailyActivity):
// categories on the left with counts; the selected group's documents on
// the right, each rendered in its final Print Settings design (graphic
// studio sheets via the shared PrintTableSheet, slip documents via the
// shared SlipDocumentSheet); Next / Previous pages through the group
// with "Document X of Y"; and the whole day saves as ONE combined PDF
// (summary page first, then every document in sequence).
//
// Permissions (registry screen files/dailyActivity): view gates the
// file's card in the cabinet; print gates the per-document print;
// exportPdf gates the combined-PDF save.

const PAPER_DIMENSIONS = {
  A4: { width: '210mm', minHeight: '297mm' },
  Letter: { width: '8.5in', minHeight: '11in' }
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const longDate = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// One graphic document rendered exactly as the Print Studio renders it:
// the saved server layout for the document type + the shared sheet.
function GraphicSheet({ docType, record, state }) {
  const layout = useMemo(() => {
    const defaultSchema = DEFAULT_DOCUMENT_SCHEMAS[docType] || DEFAULT_LAYOUT_SETTINGS;
    const stateLayout = state?.adminSetup?.printSettings?.documentLayouts?.[docType];
    const initial = { ...DEFAULT_LAYOUT_SETTINGS, ...defaultSchema, ...(stateLayout || {}) };
    return discoverDocumentSchema(docType, record, initial, state);
  }, [docType, record, state]);

  const resolvedRecord = useMemo(
    () => ensurePhaseMatrixRecord(record, docType, state),
    [record, docType, state]
  );

  const items = useMemo(() => resolveRecordLineItems(resolvedRecord), [resolvedRecord]);
  const columns = useMemo(
    () => (layout.gridColumns || []).filter((c) => c.enabled !== false),
    [layout.gridColumns]
  );
  const columnTotals = useMemo(() => {
    const totals = {};
    columns.forEach((c) => {
      if (c.total) totals[c.key] = items.reduce((s, it) => s + getPrintNumericValue(c.key, it), 0);
    });
    return totals;
  }, [columns, items]);

  const headerFields = (layout.headerFields || []).filter((f) => f.enabled !== false);
  const partyField = headerFields.find((f) => ['customer', 'customer_name', 'party_name'].includes(f.key));
  const partyValue = partyField ? getPrintHeaderFieldValue(resolvedRecord, partyField.key, state) : '---';
  const party = partyField && partyValue !== '---'
    ? { label: partyField.label || 'Customer', value: partyValue }
    : null;
  const metaRows = headerFields
    .filter((f) => f !== partyField)
    .map((f) => ({ label: f.label || f.key, value: getPrintHeaderFieldValue(resolvedRecord, f.key, state) }));

  const currentPaper = PAPER_DIMENSIONS[layout.paperSize] || PAPER_DIMENSIONS.A4;
  const isLandscape = layout.orientation === 'landscape';
  const paperWidth = isLandscape ? currentPaper.minHeight : currentPaper.width;
  const paperHeight = isLandscape ? currentPaper.width : currentPaper.minHeight;
  const margins = resolveMargins(layout);

  const isPhaseDoc = resolvedRecord?.renderMode === 'phase_matrix' || docType === 'consumption_history' || docType === 'bom_master';
  const isPlanDoc = docType === 'production_plan';
  const isBatchDoc = docType === 'master_batch_record';
  const docTitle = SYSTEM_DOCUMENTS.find((d) => d.id === docType)?.name || docType.replace(/_/g, ' ').toUpperCase();
  const companyName = state?.adminSetup?.companyName || 'Flashvision';

  if (isPhaseDoc) {
    return (
      <PhaseMatrixSheet
        record={{ ...resolvedRecord, docTitle: docType === 'consumption_history' ? 'CONSUMPTION' : docTitle.toUpperCase(), docSub: resolvedRecord.docSub || '' }}
        layout={layout}
        companyName={companyName}
        companyLegal={getDivisionPrintFullName('AJ Synthetic') || ''}
        margins={margins}
        paperWidth={paperWidth}
        paperHeight={paperHeight}
      />
    );
  }

  return (
    <PrintTableSheet
      layout={layout}
      companyName={isPlanDoc || isBatchDoc ? 'AJ SYNTHETIC' : companyName}
      companyLegal={isPlanDoc ? 'AJ Synthetic Leather & Footwear Industries Pvt. Limited' : isBatchDoc ? (getDivisionPrintFullName('AJ Synthetic') || 'AJ Synthetic Leather & Footwear Industries Pvt. Limited') : ''}
      companyAddress={isPlanDoc || isBatchDoc ? '' : (state?.adminSetup?.address || '')}
      party={party}
      metaRows={metaRows}
      docTitle={docTitle.toUpperCase()}
      docSub={isPlanDoc ? 'ORDER LIST' : null}
      planVariant={isPlanDoc}
      columns={columns}
      items={items}
      getCellValue={getPrintCellValue}
      columnTotals={columnTotals}
      grandTotal={resolvedRecord?.totals?.grandTotal}
      showHeader
      showTotals
      isLastPage
      margins={margins}
      paperWidth={paperWidth}
      paperHeight={paperHeight}
      fixedHeight={false}
    />
  );
}

// The gate-pass group page: summary cards only (per the design — gate
// passes are photographed activities, not printable documents).
function GatePassCards({ entry, forExport = false }) {
  return (
    <div
      className={forExport ? 'print-preview-page' : ''}
      style={forExport ? { width: '210mm', minHeight: '297mm', background: '#ffffff', padding: '14mm', fontFamily: 'Inter, sans-serif' } : undefined}
    >
      <div className={forExport ? '' : 'bg-white text-slate-900 shadow-2xl p-8'} style={forExport ? {} : { minHeight: '60vh' }}>
        <h3 className="text-lg font-black tracking-wide text-slate-900">GATE PASS ACTIVITIES</h3>
        <p className="text-xs font-semibold text-slate-500 mt-1">{entry.activities.length} gate pass activities this day — summary only.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          {entry.activities.map((a) => (
            <div key={a.id} className="border border-slate-300 rounded-xl p-4 bg-white">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-slate-900">{a.id}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${a.type === 'Inward' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>{a.type}</span>
              </div>
              <p className="text-xs font-medium text-slate-700 mt-2 leading-relaxed">{a.description || '—'}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] font-semibold text-slate-500">
                {a.time && <span>Time {a.time}</span>}
                {a.sender && <span>By {a.sender}</span>}
                <span>{a.photos} photo{a.photos === 1 ? '' : 's'} · {a.videos} video{a.videos === 1 ? '' : 's'} · {a.documents} doc{a.documents === 1 ? '' : 's'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DailyActivityViewer({ isOpen, onClose }) {
  const { state, hasPermission } = useApp() || {};
  const [dateStr, setDateStr] = useState(todayStr);
  const [selection, setSelection] = useState(null); // { categoryId, groupId }
  const [docIdx, setDocIdx] = useState(0);
  const [printEntry, setPrintEntry] = useState(null);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef(null);

  const canPrint = typeof hasPermission === 'function' ? hasPermission('files', 'dailyActivity', 'print') : true;
  const canExport = typeof hasPermission === 'function' ? hasPermission('files', 'dailyActivity', 'exportPdf') : true;

  const day = useMemo(() => buildDailyActivity(state, dateStr), [state, dateStr]);

  // Keep the selection valid as the date / data changes.
  useEffect(() => {
    if (!day.categories.length) { setSelection(null); return; }
    const valid = selection && day.categories.some((c) => c.id === selection.categoryId && c.groups.some((g) => g.id === selection.groupId));
    if (!valid) {
      const first = day.categories[0];
      setSelection({ categoryId: first.id, groupId: first.groups[0].id });
      setDocIdx(0);
    }
  }, [day, selection]);

  useEffect(() => { if (isOpen) { setDateStr(todayStr()); setSelection(null); setDocIdx(0); } }, [isOpen]);

  if (!isOpen) return null;

  const activeCategory = day.categories.find((c) => c.id === selection?.categoryId) || null;
  const activeGroup = activeCategory?.groups.find((g) => g.id === selection?.groupId) || null;
  const docs = activeGroup?.docs || [];
  const entry = docs[Math.min(docIdx, Math.max(0, docs.length - 1))] || null;

  const selectGroup = (categoryId, groupId) => { setSelection({ categoryId, groupId }); setDocIdx(0); };

  const flatEntries = day.categories.flatMap((c) => c.groups.flatMap((g) => g.docs));

  const handleSaveDayPdf = async () => {
    if (!canExport || exporting || flatEntries.length === 0) return;
    setExporting(true);
    // Let the hidden export container mount + lay out before capture.
    await new Promise((r) => setTimeout(r, 350));
    try {
      const blob = await buildDocumentPdfBlob(exportRef.current, { paperSize: 'a4', orientation: 'portrait' });
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DAILY_ACTIVITY_${dateStr}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } finally {
      setExporting(false);
    }
  };

  const renderEntrySheet = (e, forExport) => {
    if (!e) return null;
    if (e.kind === 'gatepass') return <GatePassCards entry={e} forExport={forExport} />;
    if (e.slip) {
      const sheet = (
        <SlipDocumentSheet
          docType={e.docType}
          record={e.record}
          documentId={e.ref}
          date={dateStr}
          docName={SYSTEM_DOCUMENTS.find((d) => d.id === e.docType)?.name || e.title}
        />
      );
      // Slip sheets are not .print-preview-page themselves — wrap them
      // for the combined-PDF capture (graphic sheets self-mark).
      return forExport
        ? <div className="print-preview-page" style={{ width: '210mm', minHeight: '297mm', background: '#ffffff' }}>{sheet}</div>
        : sheet;
    }
    return <GraphicSheet docType={e.docType} record={e.record} state={state} />;
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-3xl w-full max-w-[1400px] h-[94vh] shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] shrink-0 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-indigo-600 dark:text-indigo-400">calendar_month</span>
            <div>
              <div className="font-black text-sm sm:text-base leading-tight">Daily Activity — {longDate(dateStr)}</div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {day.totalDocs} document{day.totalDocs === 1 ? '' : 's'} across {day.categories.length} categor{day.categories.length === 1 ? 'y' : 'ies'} · assembled live from server data
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateStr}
              onChange={(e) => { setDateStr(e.target.value || todayStr()); setSelection(null); setDocIdx(0); }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white cursor-pointer"
            />
            <button
              onClick={handleSaveDayPdf}
              disabled={!canExport || exporting || flatEntries.length === 0}
              title={canExport ? 'Save the whole day as one combined PDF (summary first)' : 'No export permission for the Daily Activity File'}
              className={`px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${canExport && flatEntries.length > 0 ? 'hover:bg-emerald-700 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
            >
              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
              {exporting ? 'Building PDF…' : 'Save Day as PDF'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-900/10 dark:hover:bg-white/10 text-slate-500 dark:text-white/80 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        <div className="flex-grow flex min-h-0">
          {/* Left rail — categories & groups */}
          <div className="w-60 shrink-0 border-r border-slate-200 dark:border-white/10 overflow-y-auto p-3 space-y-4 bg-slate-50/60 dark:bg-white/[0.01]">
            {day.categories.length === 0 && (
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">No activity recorded on this date.</p>
            )}
            {day.categories.map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center gap-2 px-1">
                  <span className="material-symbols-outlined text-base text-indigo-500">{cat.icon}</span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">{cat.label}</span>
                  <span className="ml-auto text-[11px] font-black text-slate-400">{cat.count}</span>
                </div>
                <div className="mt-1.5 space-y-1">
                  {cat.groups.map((g) => {
                    const active = selection?.categoryId === cat.id && selection?.groupId === g.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => selectGroup(cat.id, g.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between gap-2 ${active ? 'bg-indigo-600 text-white shadow' : 'bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 hover:border-indigo-300'}`}
                      >
                        <span className="truncate">{g.label}</span>
                        <span className={active ? 'text-white/80' : 'text-slate-400'}>{g.count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Main pane — the selected group's current document */}
          <div className="flex-grow flex flex-col min-w-0">
            <div className="flex-grow overflow-auto bg-slate-200/70 dark:bg-black/30 p-4">
              {entry ? (
                <div className="flex justify-center">{renderEntrySheet(entry, false)}</div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-400">event_busy</span>
                  <p className="mt-3 text-sm font-bold text-slate-500">No documents for this date yet.</p>
                  <p className="text-xs text-slate-400 mt-1">The Daily Activity file fills itself as the day&rsquo;s documents are created.</p>
                </div>
              )}
            </div>

            {/* Pager + print */}
            {entry && (
              <div className="shrink-0 border-t border-slate-200 dark:border-white/10 px-4 py-3 flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-white/[0.02]">
                <div className="min-w-0">
                  <div className="text-xs font-black truncate">{entry.title}</div>
                  <div className="text-[11px] font-semibold text-slate-500">{activeCategory?.label} · {activeGroup?.label}{entry.sub ? ` · ${entry.sub}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDocIdx((i) => Math.max(0, i - 1))}
                    disabled={docIdx <= 0}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">chevron_left</span> Previous
                  </button>
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    Document {Math.min(docIdx + 1, docs.length)} of {docs.length}
                  </span>
                  <button
                    onClick={() => setDocIdx((i) => Math.min(docs.length - 1, i + 1))}
                    disabled={docIdx >= docs.length - 1}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    Next <span className="material-symbols-outlined text-base">chevron_right</span>
                  </button>
                  <button
                    onClick={() => canPrint && setPrintEntry(entry)}
                    disabled={!canPrint || entry.kind === 'gatepass'}
                    title={entry.kind === 'gatepass' ? 'Gate pass activities are summaries — they print inside the day PDF' : (canPrint ? 'Open this document\u2019s print view' : 'No print permission for the Daily Activity File')}
                    className={`px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${canPrint && entry.kind !== 'gatepass' ? 'hover:bg-indigo-700 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                  >
                    <span className="material-symbols-outlined text-base">print</span> Print Document
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Per-document print — the module's own print path */}
      {printEntry && !printEntry.slip && (
        <UniversalPrintStudioModal
          isOpen
          onClose={() => setPrintEntry(null)}
          documentType={printEntry.docType}
          documentData={printEntry.record}
        />
      )}
      {printEntry && printEntry.slip && (
        <SlipDocumentPopup
          isOpen
          onClose={() => setPrintEntry(null)}
          titleSuffix="Daily Activity"
          attachment={{
            docType: printEntry.docType,
            studioRecord: printEntry.record,
            docId: printEntry.ref,
            date: dateStr,
            title: printEntry.title
          }}
        />
      )}

      {/* Hidden combined-PDF render: summary page first, then every
          document of the day in category order. Mounted only while an
          export is being captured. */}
      {exporting && (
        <div ref={exportRef} style={{ position: 'absolute', left: '-12000px', top: 0 }} aria-hidden="true">
          <div className="print-preview-page" style={{ width: '210mm', minHeight: '297mm', background: '#ffffff', padding: '14mm', fontFamily: 'Inter, sans-serif', color: '#0f172a' }}>
            <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '1px' }}>{(state?.adminSetup?.companyName || 'Flashvision').toUpperCase()}</div>
            <div style={{ fontSize: '15px', fontWeight: 800, marginTop: '10px' }}>DAILY ACTIVITY FILE — {longDate(dateStr)}</div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginTop: '4px' }}>
              {day.totalDocs} documents · generated {new Date().toLocaleString('en-GB')}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '18px', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', background: '#1e293b', color: '#ffffff' }}>Category</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'left', background: '#1e293b', color: '#ffffff' }}>Group</th>
                  <th style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', background: '#1e293b', color: '#ffffff' }}>Documents</th>
                </tr>
              </thead>
              <tbody>
                {day.categories.flatMap((c) => c.groups.map((g) => (
                  <tr key={`${c.id}-${g.id}`}>
                    <td style={{ border: '1px solid #cbd5e1', padding: '8px', fontWeight: 700 }}>{c.label}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>{g.label}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', fontWeight: 700 }}>{g.count}</td>
                  </tr>
                )))}
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #cbd5e1', padding: '8px', fontWeight: 900 }}>TOTAL</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'right', fontWeight: 900 }}>{day.totalDocs}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: '11px', color: '#64748b', marginTop: '14px', lineHeight: 1.6 }}>
              Every document of the day follows in sequence, in its final print design. Gate pass activities appear as summary cards.
            </p>
          </div>
          {flatEntries.map((e) => (
            <React.Fragment key={e.key}>{renderEntrySheet(e, true)}</React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
