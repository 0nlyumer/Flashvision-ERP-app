import React from 'react';
import { amountInWords, fmtQty, ensureContrastText, uomSymbol } from '../../utils/printDesign';

// ---------------------------------------------------------------------------
// Shared print sheet parts — the finalized print family (Meta-Grid header,
// accent title band, styled table, phase matrix). SINGLE source of truth
// for how a printed sheet looks: the Universal Print Studio renders its
// pages from these components, PrintLayout's slips mirror the same
// header, and the Print Settings & Layout Designer's WYSIWYG preview
// renders THESE components too (Omer, 2026-10-25 — the designer must
// show exactly the layout that prints, and customizations made there
// are the same saved layout the studio loads).
// ---------------------------------------------------------------------------

// Approved design tokens (from the signed-off samples)
export const DESIGN = {
  ink: '#1b1e2e',
  dark: '#232946',
  muted: '#71748c',
  line: '#dde0ea',
  zebra: '#f6f7fb',
  soft: '#eef0f8'
};

// ---------------------------------------------------------------------------
// Approved Meta-Grid sheet header: party | company/division | meta grid
// strip, with the accent title band under it. headerAlign left/center/
// right is a Print Settings option (Omer, 2026-10-24).
//
// Band text (Omer, 2026-10-25, rider 10 + band-title fix): the band's
// text color is resolved ONCE through the contrast guard and applied
// EXPLICITLY to the band container, the title and the doc sub — never
// left to inheritance — so a dark band can never render a dark title,
// whatever a saved layout carries in bandTextColor.
// ---------------------------------------------------------------------------
export function MetaGridHeader({ layout, companyName, companyLegal, companyAddress, party, metaRows, docTitle, docSub, planVariant, onSelectMeta = null, selectedMetaKey = null, onSelectParty = null, partySelected = false }) {
  const band = `linear-gradient(90deg, ${layout.bandColor || '#4338ca'}, ${layout.bandColor2 || layout.bandColor || '#4f46e5'})`;
  const bandText = ensureContrastText(band, layout.bandTextColor || '#fff');
  const align = layout.headerAlign || 'left';
  const accent = layout.bandColor || '#4338ca';

  const companyBlock = (centered = false) => (
    <div style={{ textAlign: centered ? 'center' : 'left' }}>
      <div style={{ fontSize: '6.5pt', fontWeight: 700, letterSpacing: '1.6px', color: accent, textTransform: 'uppercase', marginBottom: '1.4mm' }}>
        {planVariant ? 'Division' : 'Company'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3mm', justifyContent: centered ? 'center' : 'flex-start' }}>
        {planVariant && (
          <div style={{ width: '11mm', height: '9mm', border: '1.6px solid #232946', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '11pt', color: '#232946', flexShrink: 0 }}>
            AJ
          </div>
        )}
        <div style={{ fontSize: '13.5pt', fontWeight: 800, letterSpacing: '.4px', lineHeight: 1.2, color: DESIGN.ink }}>{companyName}</div>
      </div>
      {planVariant && (
        <div style={{ fontSize: '8pt', color: DESIGN.muted, marginTop: '0.8mm' }}>Production &amp; Planning Division</div>
      )}
      {companyLegal && (
        <div style={{ fontSize: '7.5pt', color: DESIGN.muted, lineHeight: 1.45, marginTop: '1mm' }}>{companyLegal}</div>
      )}
      {!planVariant && layout.showHeaderDetails !== false && companyAddress && (
        <div style={{ fontSize: '7.5pt', color: DESIGN.muted, lineHeight: 1.45, marginTop: '1mm' }}>{companyAddress}</div>
      )}
    </div>
  );

  const bandEl = (
    <div
      style={{
        marginTop: '3mm', background: band, color: bandText, borderRadius: '6px',
        padding: '2.4mm 4.5mm', display: 'flex', justifyContent: align === 'center' ? 'center' : 'space-between',
        alignItems: 'center', gap: '4mm', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact'
      }}
    >
      <div style={{ fontSize: '13pt', fontWeight: 700, letterSpacing: '3.5px', textAlign: align === 'center' ? 'center' : 'left', color: bandText }}>{docTitle}</div>
      {docSub && align !== 'center' && (
        <div style={{ fontSize: '7.5pt', fontWeight: 600, letterSpacing: '1.6px', textTransform: 'uppercase', opacity: 0.9, color: bandText }}>{docSub}</div>
      )}
    </div>
  );

  if (align === 'center') {
    return (
      <>
        <div style={{ border: `1px solid ${DESIGN.line}`, borderRadius: '8px', padding: '3mm 4mm', textAlign: 'center' }}>
          {companyBlock(true)}
          {party && (
            <div
              style={{ marginTop: '2mm', fontSize: '10pt', fontWeight: 700, color: DESIGN.ink, ...(onSelectParty ? { cursor: 'pointer', boxShadow: partySelected ? 'inset 0 0 0 2px #3b82f6' : 'none', borderRadius: '4px' } : {}) }}
              onClick={onSelectParty || undefined}
            >
              <span style={{ fontSize: '6.5pt', fontWeight: 700, letterSpacing: '1.6px', color: accent, textTransform: 'uppercase', display: 'block' }}>{party.label}</span>
              {party.value}
            </div>
          )}
          {metaRows.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1mm 6mm', marginTop: '2mm' }}>
              {metaRows.map((row, i) => (
                <span
                  key={i}
                  style={{ fontSize: '8.5pt', color: DESIGN.ink, ...(onSelectMeta ? { cursor: 'pointer', boxShadow: selectedMetaKey && row.key === selectedMetaKey ? 'inset 0 0 0 2px #3b82f6' : 'none', borderRadius: '4px', padding: '0 2px' } : {}) }}
                  onClick={onSelectMeta ? () => onSelectMeta(row, i) : undefined}
                >
                  <span style={{ fontSize: '7pt', fontWeight: 600, letterSpacing: '1px', color: DESIGN.muted, textTransform: 'uppercase' }}>{row.label}: </span>
                  <strong>{row.value}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
        {bandEl}
      </>
    );
  }

  // Meta fields: full-width compact grid strip UNDER the party/company
  // row, inside the same bordered box (Omer, 2026-10-25 — the old 33%
  // side rail crushed 8 Sale Order fields into per-word wraps and ate
  // ~40% of the page). Label sits ABOVE the value; up to 4 fields per
  // row; a long value (address / contact) takes 2 columns when the
  // field count leaves room in the 2-row budget for typical documents.
  const metaSpanFor = (row) => {
    const isLong = /address|contact/i.test(row.label || '') || String(row.value || '').length > 34;
    return isLong && metaRows.length <= 7 ? 2 : 1;
  };

  return (
    <>
      <div style={{ border: `1px solid ${DESIGN.line}`, borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
          {party && (
            <div
              style={{ width: '38%', padding: '3.2mm 4mm 3.4mm', ...(onSelectParty ? { cursor: 'pointer', boxShadow: partySelected ? 'inset 0 0 0 2px #3b82f6' : 'none' } : {}) }}
              onClick={onSelectParty || undefined}
            >
              <div style={{ fontSize: '6.5pt', fontWeight: 700, letterSpacing: '1.6px', color: accent, textTransform: 'uppercase', marginBottom: '1.4mm' }}>{party.label}</div>
              <div style={{ fontSize: '12.5pt', fontWeight: 700, lineHeight: 1.25, color: DESIGN.ink }}>{party.value}</div>
            </div>
          )}
          <div style={{ flex: 1, padding: '3.2mm 4mm 3.4mm', borderLeft: party ? `1px solid ${DESIGN.line}` : 'none' }}>
            {companyBlock(!party)}
          </div>
        </div>
        {metaRows.length > 0 && (
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              borderTop: `1px solid ${DESIGN.line}`, background: '#fbfcfe'
            }}
          >
            {metaRows.map((row, i) => (
              <div
                key={i}
                style={{ padding: '1.9mm 4mm 2.1mm', gridColumn: `span ${metaSpanFor(row)}`, minWidth: 0, ...(onSelectMeta ? { cursor: 'pointer', boxShadow: selectedMetaKey && row.key === selectedMetaKey ? 'inset 0 0 0 2px #3b82f6' : 'none' } : {}) }}
                onClick={onSelectMeta ? () => onSelectMeta(row, i) : undefined}
              >
                <div style={{ fontSize: '6.3pt', fontWeight: 700, letterSpacing: '1.2px', color: DESIGN.muted, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.label}</div>
                <div style={{ fontSize: '9.3pt', fontWeight: row.strong ? 800 : 600, color: DESIGN.ink, lineHeight: 1.3, marginTop: '0.5mm', fontVariantNumeric: 'tabular-nums', overflowWrap: 'break-word' }}>{row.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {bandEl}
    </>
  );
}

// ---------------------------------------------------------------------------
// Phase-Matrix sheet (BOM / Consumption): slim header + title band, then
// item sections whose phase panels flow side-by-side and wrap to the next
// panel row (phasesPerRow, default 4) — never squeezed. Phase totals live
// inside the panels; there is deliberately NO category grand total.
// Quantities carry ONLY the unit symbol (uomSymbol — Omer, 2026-10-25).
// ---------------------------------------------------------------------------
export function PhaseMatrixSheet({ record, layout, companyName, companyLegal, margins, paperWidth, paperHeight, pageIdx = 0, pageCount = 1 }) {
  const perRow = Math.max(2, Math.min(6, Number(layout.phasesPerRow) || 4));
  const gapMm = 3.5;
  const basis = `calc((100% - ${(perRow - 1) * gapMm}mm) / ${perRow})`;
  const align = layout.headerAlign || 'left';

  return (
    <div
      className="bg-white text-slate-900 shadow-2xl relative print-preview-page"
      style={{
        width: paperWidth,
        minHeight: paperHeight,
        maxWidth: paperWidth,
        fontFamily: layout.fontFamily || 'Inter',
        padding: `${margins.top} ${margins.right} ${margins.bottom} ${margins.left}`,
        color: DESIGN.ink,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div className="no-print absolute top-2 right-2 bg-slate-900/80 text-white text-[9px] font-mono px-2 py-0.5 rounded shadow pointer-events-none">
        Page {pageIdx + 1} of {pageCount}
      </div>

      <MetaGridHeader
        layout={layout}
        companyName={companyName}
        companyLegal={companyLegal}
        companyAddress=""
        party={null}
        metaRows={(record.metaRows || []).map((r) => ({ label: r.key, value: r.value, strong: r.key.toLowerCase().includes('id') }))}
        docTitle={record.docTitle}
        docSub={record.docSub}
      />

      {(record.sections || []).map((section, sIdx) => (
        <div key={sIdx} style={{ marginTop: sIdx === 0 ? '1mm' : '3mm' }}>
          {section.name && (
            <div
              style={{
                marginTop: '2mm', background: DESIGN.soft, border: `1px solid ${DESIGN.line}`,
                borderLeft: `3.5px solid ${layout.bandColor || '#4f46e5'}`, borderRadius: '6px',
                padding: '1.3mm 4mm', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'
              }}
            >
              <div style={{ fontSize: '9.5pt', fontWeight: 800, letterSpacing: '.4px' }}>
                {section.code && <span style={{ color: layout.bandColor2 || '#4338ca' }}>{section.code} · </span>}
                {section.name}
              </div>
              {section.qtyLabel && (
                <div style={{ fontSize: '8.5pt', fontWeight: 700, color: '#3c4060', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{section.qtyLabel}</div>
              )}
            </div>
          )}

          <div
            style={{
              display: 'flex', gap: `${gapMm}mm`, flexWrap: 'wrap', marginTop: '2.5mm',
              alignItems: layout.phaseRowHeight === 'equal' ? 'stretch' : 'flex-start'
            }}
          >
            {(section.phases || []).map((phase, pIdx) => (
              <div
                key={pIdx}
                style={{
                  flex: `0 0 ${basis}`, border: `1px solid ${DESIGN.line}`, borderRadius: '8px',
                  overflow: 'hidden', breakInside: 'avoid', pageBreakInside: 'avoid',
                  display: 'flex', flexDirection: 'column'
                }}
              >
                <div style={{ background: layout.tableHeaderBgColor || DESIGN.dark, color: ensureContrastText(layout.tableHeaderBgColor || DESIGN.dark, layout.tableHeaderTextColor || '#fff'), padding: '1.8mm 3mm 2mm', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                  <div style={{ fontSize: '6.3pt', fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', opacity: 0.75 }}>
                    Phase {pIdx + 1}
                  </div>
                  <div style={{ fontSize: '9.5pt', fontWeight: 700, lineHeight: 1.25, marginTop: '.4mm' }}>{phase.name}</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ background: DESIGN.soft, color: '#3c4060', fontSize: '6.8pt', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '1.4mm 3mm', textAlign: 'left' }}>Raw Material</th>
                      <th style={{ background: DESIGN.soft, color: '#3c4060', fontSize: '6.8pt', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '1.4mm 3mm', textAlign: 'right', whiteSpace: 'nowrap' }}>{record.qtyColumnLabel || 'Qty'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(phase.rows || []).map((row, rIdx) => (
                      <tr key={rIdx} style={{ background: rIdx % 2 === 1 ? DESIGN.zebra : '#fff' }}>
                        <td style={{ fontSize: '8.6pt', fontWeight: 600, padding: '1.3mm 3mm', borderTop: `1px solid ${DESIGN.line}`, verticalAlign: 'middle' }}>{row.name}</td>
                        <td style={{ fontSize: '8.6pt', padding: '1.3mm 3mm', borderTop: `1px solid ${DESIGN.line}`, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtQty(row.qty)} {uomSymbol(row.uom)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {layout.showPhaseTotals !== false && (phase.totals || []).length > 0 && (
                    <tfoot>
                      <tr>
                        <td style={{ fontSize: '8.6pt', fontWeight: 700, padding: '1.4mm 3mm', borderTop: `2px solid ${layout.tableHeaderBgColor || DESIGN.dark}`, background: DESIGN.soft }}>Phase Total</td>
                        <td style={{ fontSize: '8.6pt', fontWeight: 700, padding: '1.4mm 3mm', borderTop: `2px solid ${layout.tableHeaderBgColor || DESIGN.dark}`, background: DESIGN.soft, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {phase.totals.map((t) => `${fmtQty(t.qty)} ${uomSymbol(t.uom)}`).join(' · ')}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ))}
            {(section.phases || []).length === 0 && (
              <p style={{ fontSize: '9pt', color: DESIGN.muted, fontStyle: 'italic', padding: '2mm 0' }}>No phase data recorded for this item.</p>
            )}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 'auto', paddingTop: '6mm', textAlign: align === 'left' ? 'center' : align, fontSize: '7pt', letterSpacing: '1.2px', color: '#a2a6ba', textTransform: 'uppercase' }}>
        Powered by Flashvision
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta-Grid table sheet — ONE page of a table document in the finalized
// family. The studio paginates and renders one of these per page; the
// Print Settings designer renders a single one holding every sample row.
// Cell values come from the caller's getCellValue(colKey, row, index).
// Optional designer callbacks (onSelectColumn / onSelectMeta /
// onSelectParty / onSelectSignature) make canvas elements clickable for
// the Inspector; the studio passes none.
// ---------------------------------------------------------------------------
export function PrintTableSheet({
  layout, companyName, companyLegal, companyAddress, party, metaRows,
  docTitle, docSub, planVariant = false,
  columns, items, getCellValue, startItemNo = 0, columnTotals = {},
  grandTotal, showHeader = true, showTotals = true, isLastPage = true,
  pageLabel = null, footerPageText = null,
  margins, paperWidth, paperHeight, fixedHeight = true, fitScale = 1,
  pageRef = null,
  onSelectColumn = null, selectedColumnKey = null,
  onSelectMeta = null, selectedMetaKey = null, onSelectParty = null, partySelected = false,
  onSelectSignature = null, selectedSignatureKey = null
}) {
  const totalsBarBg = layout.goldenTotalRow ? '#fbbf24' : (layout.totalsColor || '#232946');
  const totalsBarText = layout.goldenTotalRow ? '#232946' : ensureContrastText(totalsBarBg, '#ffffff');
  let runningItems = startItemNo;

  return (
    <div
      ref={pageRef || undefined}
      className="bg-white text-slate-900 shadow-2xl relative print-preview-page"
      style={{
        width: paperWidth,
        height: fixedHeight ? paperHeight : 'auto',
        minHeight: paperHeight,
        maxWidth: paperWidth,
        fontFamily: layout.fontFamily || 'Inter',
        padding: `${margins.top} ${margins.right} ${margins.bottom} ${margins.left}`,
        color: DESIGN.ink,
        display: 'flex',
        flexDirection: 'column',
        overflow: fixedHeight ? 'hidden' : 'visible'
      }}
    >
      {pageLabel && (
        <div className="no-print absolute top-2 right-2 bg-slate-900/80 text-white text-[9px] font-mono px-2 py-0.5 rounded shadow pointer-events-none">
          {pageLabel}
        </div>
      )}
      <div data-fit-content style={{ transform: fitScale !== 1 ? `scale(${fitScale})` : undefined, transformOrigin: 'top left', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {showHeader && (
          <MetaGridHeader
            layout={layout}
            companyName={companyName}
            companyLegal={companyLegal}
            companyAddress={companyAddress}
            party={party}
            metaRows={metaRows}
            docTitle={docTitle}
            docSub={docSub}
            planVariant={planVariant}
            onSelectMeta={onSelectMeta}
            selectedMetaKey={selectedMetaKey}
            onSelectParty={onSelectParty}
            partySelected={partySelected}
          />
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '3mm' }}>
          <thead>
            <tr>
              {columns.map((col, ci) => (
                <th
                  key={ci}
                  onClick={onSelectColumn ? () => onSelectColumn(col, ci) : undefined}
                  style={{ background: layout.tableHeaderBgColor || DESIGN.dark, color: ensureContrastText(layout.tableHeaderBgColor || DESIGN.dark, layout.tableHeaderTextColor || '#fff'), fontSize: '7pt', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', padding: '2mm 2.5mm', textAlign: col.align || 'left', width: col.width, printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact', ...(onSelectColumn ? { cursor: 'pointer', boxShadow: selectedColumnKey && col.key === selectedColumnKey ? 'inset 0 0 0 2px #facc15' : 'none' } : {}) }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row, rIdx) => {
              if (row._isGroup) {
                return (
                  <tr key={rIdx}>
                    <td colSpan={Math.max(1, columns.length)} style={{ background: DESIGN.soft, borderTop: `1px solid ${DESIGN.line}`, borderBottom: `1px solid ${DESIGN.line}`, padding: '1.8mm 3mm', fontSize: '8.6pt', fontWeight: 800, color: DESIGN.ink }}>
                      {row._group}
                      <span style={{ fontWeight: 600, color: DESIGN.muted, marginLeft: '3mm' }}>
                        {row._count} order{row._count === 1 ? '' : 's'}
                        {columns.filter((c) => c.total).map((c) => ` · ${c.label}: ${Number(row._sums[c.key] || 0).toLocaleString()}`).join('')}
                      </span>
                    </td>
                  </tr>
                );
              }
              runningItems += 1;
              const itemNo = runningItems;
              return (
                <tr key={rIdx} style={{ background: rIdx % 2 === 1 ? DESIGN.zebra : '#fff' }}>
                  {columns.map((col, ci) => {
                    let val;
                    if (['serial_no', 'sr', 'sr_no'].includes(col.key) && (row[col.key] === undefined || row[col.key] === null)) {
                      val = String(itemNo).padStart(2, '0');
                    } else {
                      val = getCellValue(col.key, row, itemNo - 1);
                    }
                    return (
                      <td key={ci} style={{ fontSize: '8.8pt', padding: '1.6mm 2.5mm', borderTop: `1px solid ${DESIGN.line}`, textAlign: col.align || 'left', fontVariantNumeric: 'tabular-nums', fontWeight: col.total ? 700 : 400 }}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={Math.max(1, columns.length)} style={{ padding: '4mm', textAlign: 'center', color: DESIGN.muted, fontStyle: 'italic', fontSize: '9pt' }}>No rows to display.</td></tr>
            )}
          </tbody>
          {showTotals && columns.some((c) => c.total) && (
            <tfoot>
              <tr>
                {columns.map((col, ci) => (
                  <td key={ci} style={{ background: totalsBarBg, color: totalsBarText, fontSize: '9pt', fontWeight: 800, padding: '2.2mm 2.5mm', borderTop: `2px solid ${totalsBarBg}`, textAlign: col.align || 'left', fontVariantNumeric: 'tabular-nums', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
                    {col.total ? Number(columnTotals[col.key] || 0).toLocaleString() : (ci === 0 ? 'TOTAL' : '')}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>

        {showTotals && grandTotal !== undefined && grandTotal !== null && (
          <div style={{ marginTop: '2.5mm', border: `1px solid ${DESIGN.line}`, borderRadius: '6px', padding: '2.2mm 4mm', display: 'flex', justifyContent: 'space-between', gap: '4mm', background: '#fff' }}>
            <span style={{ fontSize: '8.5pt', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: DESIGN.muted }}>Amount in Words</span>
            <span style={{ fontSize: '9.5pt', fontWeight: 700, textAlign: 'right' }}>Rupees {amountInWords(grandTotal)} Only</span>
          </div>
        )}

        {isLastPage && layout.termsConditions && (
          <div style={{ marginTop: '3mm', fontSize: '8pt', color: DESIGN.muted, lineHeight: 1.5 }}>
            <strong>Terms &amp; Conditions: </strong>{layout.termsConditions}
          </div>
        )}

        {isLastPage && (layout.signatures || []).length > 0 && (
          <div style={{ display: 'flex', gap: '8mm', marginTop: '8mm' }}>
            {(layout.signatures || []).map((sig, si) => (
              <div
                key={si}
                style={{ flex: 1, textAlign: 'center', ...(onSelectSignature ? { cursor: 'pointer', boxShadow: selectedSignatureKey && (sig.key || sig.label) === selectedSignatureKey ? 'inset 0 0 0 2px #3b82f6' : 'none', borderRadius: '4px' } : {}) }}
                onClick={onSelectSignature ? () => onSelectSignature(sig, si) : undefined}
              >
                <div style={{ borderTop: `1.5px solid ${DESIGN.ink}`, paddingTop: '1.5mm', fontSize: '8.5pt', fontWeight: 700 }}>{sig.label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '4mm', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '7pt', letterSpacing: '1.2px', color: '#a2a6ba', textTransform: 'uppercase' }}>
          <span>{layout.customFooterText || 'Powered by Flashvision'}</span>
          {layout.showPageNumbers !== false && footerPageText && <span>{footerPageText}</span>}
        </div>
      </div>
    </div>
  );
}
