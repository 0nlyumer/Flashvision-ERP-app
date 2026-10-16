import React from 'react';
import { useApp } from '../../context/AppContext';
import { DEFAULT_DOCUMENT_SCHEMAS, DEFAULT_LAYOUT_SETTINGS } from '../../utils/printSchemaRegistry';
import { getSafeContrastTextColor, CURATED_PALETTES } from '../../utils/printThemeEngine';

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
  const companyName = state?.adminSetup?.companyName || 'FLASHVISION LOGISTICS & ENTERPRISE ERP';
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

  const layoutConfig = savedLocalConfig || printSettings.documentLayouts?.[activeDocType] || fallbackSchema;

  // Layout Properties
  const orientation = layoutConfig.orientation || 'portrait';
  const paperSize = layoutConfig.paperSize || 'A4';
  const marginTop = layoutConfig.marginTop || '15mm';
  const marginBottom = layoutConfig.marginBottom || '15mm';
  const marginLeft = layoutConfig.marginLeft || '15mm';
  const marginRight = layoutConfig.marginRight || '15mm';

  const fontFamily = layoutConfig.fontFamily || 'Inter';
  const isIndustrial = layoutConfig.activeTheme === 'industrial';
  const activePalette = CURATED_PALETTES.find(p => p.id === layoutConfig.paletteId) || CURATED_PALETTES[0];
  const primaryColor = isIndustrial ? '#000000' : (layoutConfig.primaryColor || activePalette.primary);
  const tableHeaderBgColor = isIndustrial ? '#FFFFFF' : (layoutConfig.tableHeaderBgColor || activePalette.headerBg);
  const tableHeaderTextColor = isIndustrial ? '#000000' : (layoutConfig.tableHeaderTextColor || getSafeContrastTextColor(tableHeaderBgColor));

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
          margin: ${marginTop} ${marginRight} ${marginBottom} ${marginLeft} !important;
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

  return (
    <div className="w-full bg-white text-slate-900 p-0 m-0 font-sans print-layout-wrapper" style={{ fontFamily }}>
      <style dangerouslySetInnerHTML={{ __html: generateDynamicStyles() }} />

      <table className="w-full border-collapse print-wrapper-table">
        {showHeader && (
          <thead>
            <tr>
              <td>
                <div className="flex justify-between items-start border-b-[3px] border-slate-900 pb-4 mb-6">
                  <div className="flex items-center gap-4 max-w-[50%]">
                    {showHeaderLogo && <img src={logoUrl} alt="Logo" className="h-14 object-contain" />}
                    {showHeaderDetails && (
                      <div className="flex flex-col">
                        <h1 className="text-xl font-black uppercase tracking-tight" style={{ color: primaryColor }}>
                          {companyName}
                        </h1>
                        {address && <p className="text-xs text-slate-600 leading-tight mt-1">{address}</p>}
                        <div className="text-xs text-slate-600 mt-1 flex gap-3">
                          {phone && <span>Tel: {phone}</span>}
                          {email && <span>Email: {email}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-black uppercase tracking-widest text-slate-900">
                      {documentTitle || activeDocType.replace(/_/g, ' ').toUpperCase()}
                    </h2>
                    {documentId && (
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded bg-slate-100 font-mono text-xs font-bold text-slate-700">
                        {documentId}
                      </span>
                    )}
                  </div>
                </div>

                {!hideMetaBlock && (
                  <div className="grid grid-cols-2 gap-4 mb-6 border border-slate-200 p-4 rounded-xl text-xs">
                    <div>
                      {finalParty && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Party / Customer:</span>
                          <span className="font-bold text-sm text-slate-800">{finalParty}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right flex flex-col justify-end gap-1">
                      {date && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400">Date: </span>
                          <span className="font-mono font-bold">{date}</span>
                        </div>
                      )}
                      {extraMeta.map((meta, i) => (
                        <div key={i}>
                          <span className="text-[10px] uppercase font-bold text-slate-400">{meta.label}: </span>
                          <span className="font-bold">{meta.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
