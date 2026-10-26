import React from 'react';
import { useApp } from '../../context/AppContext';
import { DEFAULT_DOCUMENT_SCHEMAS, DEFAULT_LAYOUT_SETTINGS } from '../../utils/printSchemaRegistry';
import { resolveMargins, ensureContrastText, resolveBandTextColor } from '../../utils/printDesign';

export default function PrintLayout({
  documentTitle,
  documentId,
  date,
  disclaimerKey = 'sales',
  children,
  extraMeta = [],
  documentType,
  customerName,
  hideMetaBlock = false
}) {
  const { state } = useApp() || {};
  const companyName = state?.adminSetup?.companyName || 'FLASHVISION';
  const printSettings = state?.adminSetup?.printSettings || {};

  const docTypeMap = {
    sales: 'sale_order',
    deliveries: 'delivery_challan',
    adjustments: 'inventory_adjustment',
    returns: 'inventory_return',
    production: 'batch_closing_history',
    inventory: 'inventory_ledger'
  };

  const activeDocType = documentType || docTypeMap[disclaimerKey] || 'sale_order';
  const fallbackSchema = DEFAULT_DOCUMENT_SCHEMAS[activeDocType] || DEFAULT_LAYOUT_SETTINGS;
  
  const savedLocalConfig = (() => {
    try {
      const saved = localStorage.getItem(`fv_print_layout_${activeDocType}`);
      return saved ? JSON.parse(saved) : null;
    } catch(e) { return null; }
  })();

  // SERVER RULE (Omer, 2026-10-26): the server layout wins; the per-browser
  // fv_print_layout_<doc> copy is only a fallback cache.
  const layoutConfig = printSettings.documentLayouts?.[activeDocType] || savedLocalConfig || fallbackSchema;

  // Layout Properties — sheet model (2026-10-24): @page margin is 0 and
  // the margins live as padding on this sheet, so the on-screen layout and
  // the browser print output are the same sheet.
  const orientation = layoutConfig.orientation || 'portrait';
  const paperSize = layoutConfig.paperSize || 'A4';
  const margins = resolveMargins(layoutConfig);
  const bandColor = layoutConfig.bandColor || '#4338ca';
  const bandColor2 = layoutConfig.bandColor2 || layoutConfig.bandColor || '#4f46e5';
  // Band text derives from the band colors alone (resolveBandTextColor) —
  // never from a stored bandTextColor (Omer, 2026-10-25).
  const bandTextColor = resolveBandTextColor(`linear-gradient(90deg, ${bandColor}, ${bandColor2})`);
  const headerAlign = layoutConfig.headerAlign || 'left';

  const fontFamily = layoutConfig.fontFamily || 'Inter';
  const primaryColor = layoutConfig.primaryColor || '#004277';
  const tableHeaderBgColor = layoutConfig.tableHeaderBgColor || primaryColor;
  const tableHeaderTextColor = ensureContrastText(tableHeaderBgColor, layoutConfig.tableHeaderTextColor || '#ffffff');

  const logoUrl = printSettings.logoUrl || state?.adminSetup?.logo || state?.adminSetup?.logoUrl || '';
  const address = printSettings.address || state?.adminSetup?.address || 'Plot 42-B, Industrial Zone Phase III, Karachi, Pakistan';
  const phone = printSettings.phone || state?.adminSetup?.phone || '+92-21-34567890';
  const email = printSettings.email || state?.adminSetup?.email || 'info@flashvision.com';

  const showHeader = layoutConfig.showHeader !== false;
  const showFooter = layoutConfig.showFooter !== false;
  const showHeaderLogo = layoutConfig.showHeaderLogo !== false && !!logoUrl;
  const showHeaderDetails = layoutConfig.showHeaderDetails !== false;

  // Extractor for Customer / Supplier / Party Name
  const extractPartyName = (metaArray) => {
    const found = metaArray.find(
      (m) =>
        m.label.toLowerCase().includes('customer') ||
        m.label.toLowerCase().includes('party') ||
        m.label.toLowerCase().includes('supplier') ||
        m.label.toLowerCase().includes('bill to')
    );
    return found ? found.value : null;
  };

  const finalParty = customerName || extractPartyName(extraMeta);

  // Dynamic Print CSS Generator
  const generateDynamicStyles = () => {
    let css = `
      @media print {
        @page {
          size: ${paperSize} ${orientation} !important;
          margin: 0 !important;
        }
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          font-family: ${fontFamily}, sans-serif !important;
        }
      }
      .print-layout-wrapper table:not(.print-wrapper-table) tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .print-layout-wrapper table:not(.print-wrapper-table) th {
        background-color: ${tableHeaderBgColor} !important;
        color: ${tableHeaderTextColor} !important;
      }
    `;

    if (layoutConfig.gridColumns && Array.isArray(layoutConfig.gridColumns)) {
      layoutConfig.gridColumns.forEach((c, colIdx) => {
        const nth = colIdx + 1;
        if (c.width) {
          css += `
            .print-layout-wrapper table:not(.print-wrapper-table) th:nth-child(${nth}),
            .print-layout-wrapper table:not(.print-wrapper-table) td:nth-child(${nth}) {
              width: ${c.width} !important;
            }
          `;
        }
        if (c.align) {
          css += `
            .print-layout-wrapper table:not(.print-wrapper-table) th:nth-child(${nth}),
            .print-layout-wrapper table:not(.print-wrapper-table) td:nth-child(${nth}) {
              text-align: ${c.align} !important;
            }
          `;
        }
        if (c.enabled === false) {
          css += `
            .print-layout-wrapper table:not(.print-wrapper-table) th:nth-child(${nth}),
            .print-layout-wrapper table:not(.print-wrapper-table) td:nth-child(${nth}) {
              display: none !important;
            }
          `;
        }
      });
    }

    return css;
  };


  // Meta-Grid header (approved family, 2026-10-24): party | company | meta
  // grid, then the accent title band. Alignment follows Print Settings.
  const metaEntries = [
    ...(date ? [{ label: 'Date', value: date }] : []),
    ...extraMeta
  ];
  // Meta strip (rider 8-b, 2026-10-25): the meta fields no longer stack
  // in a narrow side rail — they run side-by-side in a compact grid
  // under the party/company row, inside the same bordered box: small
  // caps label ABOVE the value, up to 4 per row; long values span 2
  // columns when the field count leaves room. Same shape as the
  // Universal Print Studio header.
  const allMetaEntries = [
    ...metaEntries,
    ...(documentId ? [{ label: 'Document No', value: documentId, mono: true }] : [])
  ];
  const metaSpanFor = (meta) => {
    const isLong = /address|contact/i.test(meta.label || '') || String(meta.value || '').length > 34;
    return isLong && allMetaEntries.length <= 7 ? 2 : 1;
  };
  const metaStrip = allMetaEntries.length > 0 ? (
    <div
      style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        borderTop: '1px solid #dde0ea', background: '#fbfcfe'
      }}
    >
      {allMetaEntries.map((meta, i) => (
        <div key={i} style={{ padding: '7px 14px 8px', gridColumn: `span ${metaSpanFor(meta)}`, minWidth: 0 }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.2px', color: '#71748c', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.label}</div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1b1e2e', lineHeight: 1.3, marginTop: '2px', fontFamily: meta.mono ? 'monospace' : 'inherit', overflowWrap: 'break-word' }}>{meta.value}</div>
        </div>
      ))}
    </div>
  ) : null;
  const partyCell = finalParty ? (
    <div style={{ width: '38%', padding: '12px 14px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.6px', color: bandColor, textTransform: 'uppercase', marginBottom: '5px' }}>Party / Customer</div>
      <div style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.25, color: '#1b1e2e' }}>{finalParty}</div>
    </div>
  ) : null;
  const companyCell = (
    <div style={{ flex: 1, padding: '12px 14px', borderLeft: finalParty ? '1px solid #dde0ea' : 'none' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.6px', color: bandColor, textTransform: 'uppercase', marginBottom: '5px' }}>Company</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {showHeaderLogo && <img src={logoUrl} alt="Logo" style={{ height: '44px', objectFit: 'contain' }} />}
        <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '.4px', lineHeight: 1.2, color: '#1b1e2e' }}>{companyName}</div>
      </div>
      {showHeaderDetails && address && <div style={{ fontSize: '11px', color: '#71748c', lineHeight: 1.45, marginTop: '4px' }}>{address}</div>}
      {showHeaderDetails && (phone || email) && (
        <div style={{ fontSize: '11px', color: '#71748c', marginTop: '4px', display: 'flex', gap: '12px' }}>
          {phone && <span>Tel: {phone}</span>}
          {email && <span>Email: {email}</span>}
        </div>
      )}
    </div>
  );
  const titleBand = (
    <div
      style={{
        marginTop: '10px', background: `linear-gradient(90deg, ${bandColor}, ${bandColor2})`, color: bandTextColor,
        borderRadius: '6px', padding: '9px 16px', display: 'flex',
        justifyContent: headerAlign === 'center' ? 'center' : 'space-between', alignItems: 'center', gap: '12px',
        printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact',
        '--fv-bandtext': bandTextColor
      }}
    >
      <div className="fv-bandtext" style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '3px', textAlign: headerAlign === 'center' ? 'center' : 'left', color: bandTextColor }}>
        {(documentTitle || activeDocType.replace(/_/g, ' ').toUpperCase())}
      </div>
      {documentId && headerAlign !== 'center' && (
        <div className="fv-bandtext" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.6px', textTransform: 'uppercase', opacity: 0.9, color: bandTextColor }}>{documentId}</div>
      )}
    </div>
  );

  const headerJsx = (
    <>
      {!hideMetaBlock && headerAlign === 'center' ? (
        <div style={{ border: '1px solid #dde0ea', borderRadius: '8px', padding: '12px 14px', textAlign: 'center', marginBottom: '6px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.6px', color: bandColor, textTransform: 'uppercase', marginBottom: '5px' }}>Company</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#1b1e2e' }}>{companyName}</div>
          {showHeaderDetails && address && <div style={{ fontSize: '11px', color: '#71748c', marginTop: '4px' }}>{address}</div>}
          {finalParty && <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 700, color: '#1b1e2e' }}>{finalParty}</div>}
          {metaEntries.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 20px', marginTop: '8px' }}>
              {metaEntries.map((m, i) => (
                <span key={i} style={{ fontSize: '12px', color: '#1b1e2e' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', color: '#71748c', textTransform: 'uppercase' }}>{m.label}: </span>
                  <strong>{m.value}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        !hideMetaBlock && (
          <div style={{ border: '1px solid #dde0ea', borderRadius: '8px', overflow: 'hidden', marginBottom: '6px' }}>
            <div style={{ display: 'flex', flexDirection: headerAlign === 'right' ? 'row-reverse' : 'row' }}>
              {partyCell}
              {companyCell}
            </div>
            {metaStrip}
          </div>
        )
      )}
      {titleBand}
      <div style={{ height: '18px' }} />
    </>
  );

  return (
    <div
      data-contrast-ignore
      className="w-full bg-white text-slate-900 m-0 font-sans print-layout-wrapper"
      style={{ fontFamily, padding: `${margins.top} ${margins.right} ${margins.bottom} ${margins.left}` }}
    >
      <style dangerouslySetInnerHTML={{ __html: generateDynamicStyles() }} />

      <table className="w-full border-collapse print-wrapper-table">
        {showHeader && (
          <thead>
            <tr>
              <td>
                {headerJsx}
              </td>
            </tr>
          </thead>
        )}

        <tbody>
          <tr>
            <td className="align-top py-2">
              {children}

              {showFooter && (
                <div className="mt-12 border-t-[2px] border-slate-900 pt-6 pb-6" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  {/* Dynamic Signature Blocks */}
                  <div className="flex justify-between items-end gap-4 mb-6">
                    {(layoutConfig.signatures || [
                      { label: 'Prepared By' },
                      { label: 'Verified By' },
                      { label: 'Authorized Signatory' }
                    ]).map((sig, idx) => (
                      <div key={idx} className="flex-1 text-center">
                        <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                          {sig.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="text-center text-[9px] text-slate-400 font-mono pt-2 border-t border-slate-100">
                    {layoutConfig.customFooterText || 'Computer Generated Document. Powered by Flashvision ERP.'}
                  </div>
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
