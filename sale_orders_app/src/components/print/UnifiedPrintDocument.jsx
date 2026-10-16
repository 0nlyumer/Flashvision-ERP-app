import React from 'react';
import { CURATED_PALETTES, getSafeContrastTextColor } from '../../utils/printThemeEngine';

export const PAPER_DIMENSIONS = {
  A4: { width: '210mm', minHeight: '297mm', printSize: 'A4' },
  Letter: { width: '8.5in', minHeight: '11in', printSize: 'letter' },
  Thermal: { width: '80mm', minHeight: '180mm', printSize: '80mm auto' },
  A5: { width: '148mm', minHeight: '210mm', printSize: 'A5' },
  Legal: { width: '8.5in', minHeight: '14in', printSize: 'legal' }
};

/**
 * UnifiedPrintDocument — Enterprise Quality Print Renderer
 * Renders any ERP document using one of the 3 certified themes:
 *   - 'classic': Classic Corporate (Formal, structured, executive)
 *   - 'modern': Modern Minimalist (Clean accents, floating cards, zebra banding)
 *   - 'industrial': Industrial Shop-Floor (Compact, floor checkboxes, big bold batch ID, B&W laser safe)
 */
export default function UnifiedPrintDocument({
  documentType = 'sale_order',
  documentData = null,
  layoutConfig = {},
  pages = null,
  companyInfo = {},
  isPrintOnly = false,
  scale = 1
}) {
  const activeTheme = layoutConfig.activeTheme || 'classic';
  const isIndustrial = activeTheme === 'industrial';
  const isModern = activeTheme === 'modern';
  const isClassic = activeTheme === 'classic';

  // Paper & Typography Settings
  const paperFormat = layoutConfig.paperSize || 'A4';
  const orientation = layoutConfig.orientation || 'portrait';
  const paperSpec = PAPER_DIMENSIONS[paperFormat] || PAPER_DIMENSIONS.A4;
  const paperWidth = orientation === 'landscape' ? paperSpec.minHeight : paperSpec.width;
  const paperHeight = orientation === 'landscape' ? paperSpec.width : paperSpec.minHeight;

  const fontFamily = layoutConfig.fontFamily || 'Inter';
  const bodyFontSize = layoutConfig.bodyFontSize || (isIndustrial ? '10px' : '11px');

  // Palette & Contrast Protection
  const activePalette = CURATED_PALETTES.find(p => p.id === layoutConfig.paletteId) || CURATED_PALETTES[0];
  const primaryColor = isIndustrial ? '#000000' : (layoutConfig.primaryColor || activePalette.primary);
  const tableHeaderBg = isIndustrial 
    ? '#FFFFFF' 
    : (layoutConfig.tableHeaderBgColor || activePalette.headerBg);
  const tableHeaderColor = isIndustrial 
    ? '#000000' 
    : (layoutConfig.tableHeaderTextColor || getSafeContrastTextColor(tableHeaderBg));

  // Company Details
  const companyName = companyInfo.companyName || 'FLASHVISION LOGISTICS & ENTERPRISE ERP';
  const resolvedLogoUrl = layoutConfig.logoUrl || companyInfo.logoUrl || '';
  const showLogo = layoutConfig.showHeaderLogo !== false && Boolean(resolvedLogoUrl);
  const logoSize = layoutConfig.logoSize || 'medium';
  const logoHeightClass = logoSize === 'small' ? 'h-8 max-h-8' : logoSize === 'large' ? 'h-16 max-h-16' : logoSize === 'xl' ? 'h-20 max-h-20' : 'h-12 max-h-12';
  const logoPosition = layoutConfig.logoPosition || 'left';
  const address = companyInfo.address || 'Plot 42-B, Industrial Zone Phase III, Karachi, Pakistan';
  const phone = companyInfo.phone || '+92-21-34567890';
  const email = companyInfo.email || 'operations@flashvision.com';
  const taxId = companyInfo.taxId || 'NTN: 8923410-7 • STRN: 3277876123456';

  // Resolved Document Data
  const record = documentData || {};
  const headerData = record.header || record;
  const lineItems = Array.isArray(record.items) 
    ? record.items 
    : Array.isArray(record.lineItems) 
    ? record.lineItems 
    : Array.isArray(record.rows)
    ? record.rows 
    : [];

  // Multi-Page Chunking if not pre-chunked
  const computedPages = React.useMemo(() => {
    if (pages && Array.isArray(pages) && pages.length > 0) return pages;
    const items = [...lineItems];
    if (items.length === 0) return [[]];

    const firstLimit = Math.max(1, parseInt(layoutConfig.firstPageRows, 10) || 20);
    const contLimit = Math.max(1, parseInt(layoutConfig.continuationPageRows, 10) || 25);

    const chunks = [];
    chunks.push(items.splice(0, firstLimit));
    while (items.length > 0) {
      chunks.push(items.splice(0, contLimit));
    }
    return chunks;
  }, [pages, lineItems, layoutConfig.firstPageRows, layoutConfig.continuationPageRows, isIndustrial]);

  // Active Enabled Columns & Header Fields
  const activeColumns = (layoutConfig.gridColumns || []).filter(c => c.enabled !== false);
  const activeHeaderFields = (layoutConfig.headerFields || []).filter(f => f.enabled !== false);

  // Field Value Resolver
  const getHeaderValue = (key) => {
    if (!key) return '—';

    // 1. Direct match on headerData or top-level record
    if (headerData[key] !== undefined && headerData[key] !== null && String(headerData[key]).trim() !== '') {
      return String(headerData[key]);
    }
    if (record[key] !== undefined && record[key] !== null && String(record[key]).trim() !== '') {
      return String(record[key]);
    }

    // 2. Specific Document Key Mappings (Delivery Challan, OMS, HR, Production, Finance)
    const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Logistics & Delivery Challan fields
    if (normKey === 'drivername') {
      return headerData.driver_name || headerData.driverName || headerData.logistics?.driverName || headerData.logistics?.driver_name || record.logistics?.driverName || '—';
    }
    if (normKey === 'drivercontact' || normKey === 'drivernumber' || normKey === 'driverphone') {
      return headerData.driver_contact || headerData.driverContact || headerData.logistics?.driverNumber || headerData.logistics?.driver_number || headerData.logistics?.driverContact || record.logistics?.driverNumber || '—';
    }
    if (normKey === 'vehicleno' || normKey === 'vehiclenumber') {
      return headerData.vehicle_no || headerData.vehicleNo || headerData.vehicleNumber || headerData.logistics?.vehicleNumber || headerData.logistics?.vehicle_number || record.logistics?.vehicleNumber || '—';
    }
    if (normKey === 'contactperson') {
      return headerData.contact_person || headerData.contactPerson || headerData.consignee?.contactPerson || headerData.consignee?.contact_person || record.consignee?.contactPerson || headerData.contact || '—';
    }
    if (normKey === 'contactnumber' || normKey === 'contact' || normKey === 'phone') {
      return headerData.contact_number || headerData.contactNumber || headerData.consignee?.contactNumber || headerData.consignee?.contact_number || headerData.consignee?.phone || record.consignee?.contactNumber || headerData.contact || '—';
    }
    if (normKey === 'shippingaddress' || normKey === 'deliveryaddress' || normKey === 'destination') {
      return headerData.shipping_address || headerData.deliveryAddress || headerData.consignee?.deliveryAddress || headerData.consignee?.address || record.consignee?.deliveryAddress || headerData.address || '—';
    }
    if (normKey === 'dcmode' || normKey === 'dispatchmode') {
      return headerData.dc_mode || headerData.dcMode || headerData.dispatch_mode || headerData.dispatchMode || headerData.logistics?.dispatchMode || record.dcMode || 'Direct Delivery';
    }
    if (normKey === 'deliverymode') {
      return headerData.delivery_mode || headerData.deliveryMode || headerData.mode || 'Standard Delivery';
    }
    if (normKey === 'specialinstructions' || normKey === 'specialnotes' || normKey === 'instructions') {
      return headerData.special_instructions || headerData.specialInstructions || headerData.instructions || headerData.notes || headerData.remarks || 'None';
    }
    if (normKey === 'soref' || normKey === 'orderref' || normKey === 'saleorderref') {
      return headerData.so_ref || headerData.saleOrderId || headerData.orderId || headerData.items?.[0]?.orderId || record.items?.[0]?.orderId || headerData.so_number || headerData.id || '—';
    }
    if (normKey === 'challanno') {
      return headerData.challan_no || headerData.challanNumber || headerData.dc_number || headerData.id || record.id || '—';
    }
    if (normKey === 'dispatchdate') {
      return headerData.dispatch_date || headerData.date || record.date || new Date().toISOString().split('T')[0];
    }
    if (normKey === 'customer' || normKey === 'customername') {
      return headerData.customer_name || headerData.customerName || headerData.customer || record.customerName || 'Al-Haq Enterprises';
    }

    // HR Leave & Attendance Fields
    if (normKey === 'leaveid') {
      return headerData.leave_id || headerData.id || record.id || 'LR-2026-001';
    }
    if (normKey === 'leavetype') {
      return headerData.leave_type || headerData.leaveType || 'Annual';
    }
    if (normKey === 'leavecategory' || normKey === 'category') {
      return headerData.leave_category || headerData.leaveCategory || (headerData.leaveType === 'unpaid' ? 'Unpaid' : 'Paid') || 'Paid';
    }
    if (normKey === 'startdate') {
      return headerData.start_date || headerData.startDate || '—';
    }
    if (normKey === 'enddate') {
      return headerData.end_date || headerData.endDate || '—';
    }
    if (normKey === 'totaldays' || normKey === 'days') {
      return headerData.total_days || headerData.days || (headerData.estimatedDays !== '--' ? headerData.estimatedDays : null) || '—';
    }
    if (normKey === 'reason') {
      return headerData.reason || headerData.purpose || '—';
    }
    if (normKey === 'empcode' || normKey === 'employeeid' || normKey === 'empid') {
      return headerData.emp_code || headerData.employeeId || headerData.emp_id || headerData.empId || '—';
    }
    if (normKey === 'empname' || normKey === 'employeename') {
      return headerData.emp_name || headerData.employeeName || headerData.empName || headerData.name || 'Staff Member';
    }
    if (normKey === 'department') {
      return headerData.department || headerData.dept || 'Operations';
    }
    if (normKey === 'applieddate') {
      return headerData.applied_date || headerData.appliedOn || (headerData.createdAt ? new Date(headerData.createdAt).toLocaleDateString() : new Date().toLocaleDateString());
    }
    if (normKey === 'sheettitle') {
      return headerData.sheet_title || headerData.report_title || 'WORKFORCE ATTENDANCE REGISTER';
    }
    if (normKey === 'monthyear') {
      return headerData.month_year || headerData.audit_period || 'Current Period';
    }
    if (normKey === 'shift') {
      return headerData.shift || headerData.allocated_shift || 'Regular Shift';
    }
    if (normKey === 'totalstaff') {
      return headerData.total_staff || headerData.totalHeadcount || (record.items?.length ? String(record.items.length) : '—');
    }
    if (normKey === 'presentcount') {
      return headerData.present_count || headerData.present || '—';
    }
    if (normKey === 'absentcount') {
      return headerData.absent_count || headerData.absent || '—';
    }
    if (normKey === 'latecount') {
      return headerData.late_count || headerData.late || '—';
    }

    // Generic Fallbacks (SAFE: do not match vehicle_no or contact_number as doc id!)
    if (normKey === 'id' || normKey === 'no' || normKey === 'number' || normKey === 'docno' || normKey === 'refno') {
      return headerData.id || headerData.so_number || headerData.invoice_no || headerData.challan_no || headerData.batch_no || 'DOC-2026-001';
    }
    if (key.includes('date')) return headerData.date || new Date().toISOString().split('T')[0];
    if (key.includes('status')) return headerData.status || 'Approved';
    if (key.includes('customer') || key.includes('supplier') || key.includes('party')) {
      return headerData.customerName || headerData.supplierName || headerData.party_name || 'Al-Haq Industrial Corp';
    }

    return '—';
  };

  const getCellValue = (colKey, item, index) => {
    if (!item) return '—';

    // 1. Serial Number
    if (colKey === 'serial_no' || colKey === 'sr' || colKey === 'sr_no' || colKey === 'step_no' || colKey === 'month_no') {
      return String(index + 1).padStart(2, '0');
    }

    // 2. Direct property match
    if (item[colKey] !== undefined && item[colKey] !== null && String(item[colKey]).trim() !== '') {
      const val = item[colKey];
      return typeof val === 'number' ? val.toLocaleString() : String(val);
    }

    const norm = colKey.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 3. Item Code & Name aliases
    if (norm === 'itemcode' || norm === 'code' || norm === 'sku') {
      return item.itemCode || item.ITEMCODE || item.item_code || item.code || item.sku || item.itemId || item.ITEMID || '—';
    }
    if (norm === 'itemname' || norm === 'productname' || norm === 'description') {
      return item.productName || item.PRODUCTNAME || item.itemName || item.item_name || item.name || item.description || item.operation || '—';
    }

    // 4. Quantities & Rolls aliases
    if (norm === 'orderedqty' || norm === 'orderqty' || norm === 'targetqty') {
      const val = item.ordered_qty ?? item.orderedQty ?? item.ORDEREDQTY ?? item.readyQty ?? item.ready_qty ?? item.target_qty ?? item.targetQty ?? item.quantity ?? item.qty;
      return val !== undefined && val !== null ? (typeof val === 'number' ? val.toLocaleString() : String(val)) : '—';
    }
    if (norm === 'dispatchqty' || norm === 'dispatchedqty') {
      const val = item.dispatch_qty ?? item.dispatched_qty ?? item.dispatchedQty ?? item.DISPATCHEDQTY ?? item.dispatchQty ?? item.editedQty ?? item.qty;
      return val !== undefined && val !== null ? (typeof val === 'number' ? val.toLocaleString() : String(val)) : '—';
    }
    if (norm === 'packingtype' || norm === 'stocktype' || norm === 'packaging') {
      return item.packing_type || item.packingType || item.stockType || item.STOCKTYPE || item.type || (item.rollSize ? `${item.rollSize}m` : null) || 'Standard';
    }
    if (norm === 'weight' || norm === 'netweight') {
      if (item.weight !== undefined && item.weight !== null) return String(item.weight);
      if (item.net_weight !== undefined && item.net_weight !== null) return String(item.net_weight);
      if (item.dispatchedRolls) return `${item.dispatchedRolls} Rolls`;
      if (item.DISPATCHEDROLLS) return `${item.DISPATCHEDROLLS} Rolls`;
      if (item.rolls) return `${item.rolls} Rolls`;
      return '—';
    }
    if (norm === 'rolls' || norm === 'rollsready' || norm === 'dispatchedrolls') {
      const val = item.rolls ?? item.dispatchedRolls ?? item.DISPATCHEDROLLS ?? item.no_of_packages;
      return val !== undefined && val !== null ? String(val) : '—';
    }
    if (norm === 'qty' || norm === 'quantity') {
      const val = item.qty ?? item.quantity ?? item.dispatchedQty ?? item.target_qty ?? item.actual_output ?? item.chalan_qty;
      return val !== undefined && val !== null ? (typeof val === 'number' ? val.toLocaleString() : String(val)) : '—';
    }

    // 5. Rates & Pricing aliases
    if (norm === 'rate' || norm === 'unitrate' || norm === 'unitprice' || norm === 'price') {
      const val = item.rate ?? item.unitRate ?? item.unit_rate ?? item.unit_price ?? item.unitPrice ?? item.price;
      return val !== undefined && val !== null ? (typeof val === 'number' ? val.toFixed(2) : String(val)) : '—';
    }
    if (norm === 'subtotal' || norm === 'amount' || norm === 'totalamount') {
      const val = item.sub_total ?? item.subTotal ?? item.amount ?? item.total_amount ?? item.total;
      return val !== undefined && val !== null ? (typeof val === 'number' ? val.toFixed(2) : String(val)) : '—';
    }
    if (norm === 'discount') {
      return item.discount !== undefined && item.discount !== null ? String(item.discount) : '0%';
    }
    if (norm === 'uom' || norm === 'unit') {
      return item.uom || item.unit || 'Units';
    }
    if (norm === 'remarks' || norm === 'notes') {
      return item.remarks || item.notes || item.task_description || '—';
    }

    // 6. HR Line Item Aliases
    if (norm === 'leavetype') return item.leave_type || item.leaveType || item.type || 'Annual';
    if (norm === 'category') return item.category || item.leave_category || item.leaveCategory || 'Paid';
    if (norm === 'days') return item.days ?? item.total_days ?? '1';
    if (norm === 'clockin') return item.clock_in || item.inTime || '—';
    if (norm === 'clockout') return item.clock_out || item.outTime || '—';
    if (norm === 'duration') return item.duration || item.hours || '—';
    if (norm === 'empcode') return item.emp_code || item.empId || item.employeeId || '—';
    if (norm === 'empname') return item.emp_name || item.employeeName || item.name || '—';
    if (norm === 'status') return item.status || '—';

    // 7. Finance Vouchers & General Ledger
    if (norm === 'accounthead') return item.account_head || item.accountName || item.accountTitle || (item.accountId ? `${item.accountId} - ${item.accountName || ''}` : '—');
    if (norm === 'narration') return item.narration || item.particulars || item.description || '—';
    if (norm === 'debit') {
      const val = item.debit;
      return val !== undefined && val !== null ? (typeof val === 'number' ? val.toFixed(2) : String(val)) : '0.00';
    }
    if (norm === 'credit') {
      const val = item.credit;
      return val !== undefined && val !== null ? (typeof val === 'number' ? val.toFixed(2) : String(val)) : '0.00';
    }
    if (norm === 'balance') {
      const val = item.balance ?? item.current_balance;
      return val !== undefined && val !== null ? (typeof val === 'number' ? val.toFixed(2) : String(val)) : '—';
    }

    return '—';
  };

  // Document Title Display
  const documentTitle = layoutConfig.documentTitle || headerData.report_title || documentType
    .replace(/_/g, ' ')
    .toUpperCase();

  const docCode = headerData.id || headerData.so_number || headerData.invoice_no || headerData.challan_no || headerData.batch_no || headerData.bom_code || headerData.ledger_id || 'DOC-2026-OFFICIAL';

  // Generate dynamic print CSS
  const dynamicPrintStyles = `
    @media print {
      @page {
        size: ${paperFormat.toLowerCase()} ${orientation} !important;
        margin: ${layoutConfig.marginTop || '12mm'} ${layoutConfig.marginRight || '12mm'} ${layoutConfig.marginBottom || '12mm'} ${layoutConfig.marginLeft || '12mm'} !important;
      }
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      .no-print { display: none !important; }
      .print-preview-page {
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        page-break-after: always !important;
      }
      .print-preview-page:last-child {
        page-break-after: auto !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .avoid-break {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  `;

  return (
    <div 
      className={`unified-print-container flex flex-col items-center gap-8 ${isPrintOnly ? 'w-full' : ''}`}
      style={{ transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: 'top center' }}
    >
      <style dangerouslySetInnerHTML={{ __html: dynamicPrintStyles }} />

      {computedPages.map((pageItems, pageIdx) => {
        const isFirstPage = pageIdx === 0;
        const isLastPage = pageIdx === computedPages.length - 1;
        const shouldShowHeader = isFirstPage || layoutConfig.repeatHeader === true;
        const shouldShowTotals = layoutConfig.totalsPosition === 'every_page' || isLastPage;

        return (
          <div
            key={pageIdx}
            className={`print-preview-page bg-white text-slate-900 relative transition-all duration-200 overflow-hidden flex flex-col ${
              isPrintOnly ? 'p-0 shadow-none' : 'shadow-2xl border border-slate-200/80 mb-6'
            }`}
            style={{
              width: paperWidth,
              minHeight: paperHeight,
              maxWidth: paperWidth,
              fontFamily,
              fontSize: bodyFontSize,
              padding: isPrintOnly ? '0' : `${layoutConfig.marginTop || '12mm'} ${layoutConfig.marginRight || '12mm'} ${layoutConfig.marginBottom || '12mm'} ${layoutConfig.marginLeft || '12mm'}`
            }}
          >
            {/* Screen Page Badge */}
            {!isPrintOnly && (
              <div className="no-print absolute top-3 right-3 bg-slate-900/80 text-white text-[10px] font-mono px-2.5 py-1 rounded-md shadow-md pointer-events-none z-10 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Page {pageIdx + 1} of {computedPages.length} • {activeTheme.toUpperCase()}
              </div>
            )}

            {/* ============================================================== */}
            {/* 1. DOCUMENT HEADER BLOCK (Theme Differentiated)                 */}
            {/* ============================================================== */}
            {shouldShowHeader && (
              <header className="mb-4">
                {/* ---------------- THEME A: CLASSIC CORPORATE ---------------- */}
                {isClassic && (
                  <div className="border-b-[3px] border-slate-900 pb-3">
                    <div className="flex justify-between items-start gap-4">
                      {/* Left: Company Logo & Details */}
                      <div className="flex items-center gap-3.5 max-w-[60%]">
                        {showLogo && (
                          <img src={resolvedLogoUrl} alt="Company Logo" className={`${logoHeightClass} object-contain max-w-[160px]`} />
                        )}
                        <div>
                          <h1 className="text-lg font-black uppercase tracking-tight leading-tight" style={{ color: primaryColor }}>
                            {companyName}
                          </h1>
                          {layoutConfig.showHeaderDetails !== false && (
                            <div className="text-[10px] text-slate-500 leading-tight mt-1 space-y-0.5">
                              <p>{address}</p>
                              <p>Tel: {phone} • Email: {email}</p>
                              <p className="font-mono text-[9px] text-slate-400">{taxId}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Formal Title & Code */}
                      <div className="text-right">
                        <h2 className="text-xl font-extrabold tracking-tight uppercase text-slate-900">
                          {documentTitle}
                        </h2>
                        <div className="mt-1 inline-flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Document #:</span>
                          <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-300 text-slate-900">
                            {docCode}
                          </span>
                        </div>
                        {headerData.date && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            Date: <strong className="text-slate-800">{headerData.date}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Classic Metadata 3-Column Grid */}
                    {activeHeaderFields.length > 0 && (
                      <div className="grid grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-slate-200 text-[10px]">
                        {activeHeaderFields.map(field => {
                          const val = getHeaderValue(field.key);
                          const spanClass = field.width === 'span-3' ? 'col-span-3' : field.width === 'span-2' ? 'col-span-2' : 'col-span-1';
                          return (
                            <div key={field.key} className={`${spanClass} flex flex-col bg-slate-50/80 p-1.5 rounded border border-slate-200/60`}>
                              <span className="text-[8.5px] uppercase font-bold tracking-wider text-slate-500">
                                {field.label}:
                              </span>
                              <span className="font-bold text-slate-900 truncate mt-0.5">{val}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ---------------- THEME B: MODERN MINIMALIST ---------------- */}
                {isModern && (
                  <div className="pb-3 border-b border-slate-200">
                    {/* Top Accent Stripe */}
                    <div className="h-1.5 w-full rounded-full mb-3" style={{ backgroundColor: primaryColor }} />

                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-3">
                        {showLogo && (
                          <img src={resolvedLogoUrl} alt="Logo" className={`${logoHeightClass} object-contain max-w-[160px]`} />
                        )}
                        <div>
                          <span className="text-xs uppercase tracking-widest font-bold text-slate-400">
                            {companyName}
                          </span>
                          <h2 className="text-2xl font-black tracking-tight text-slate-900 leading-none mt-0.5">
                            {documentTitle}
                          </h2>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 flex flex-col items-end">
                          <span className="text-[8.5px] uppercase font-bold text-slate-400">Ref Code</span>
                          <span className="font-mono text-xs font-black text-slate-900">{docCode}</span>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase text-white shadow-sm" style={{ backgroundColor: primaryColor }}>
                          {headerData.status || 'Confirmed'}
                        </div>
                      </div>
                    </div>

                    {/* Modern Metadata Floating Pill Cards */}
                    {activeHeaderFields.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-3 text-[10px]">
                        {activeHeaderFields.map(field => {
                          const val = getHeaderValue(field.key);
                          const spanClass = field.width === 'span-3' ? 'col-span-3' : field.width === 'span-2' ? 'col-span-2' : 'col-span-1';
                          return (
                            <div key={field.key} className={`${spanClass} p-2 rounded-xl bg-slate-50 border border-slate-200/80`}>
                              <span className="text-[8.5px] uppercase font-bold text-slate-400 block">{field.label}</span>
                              <span className="font-bold text-slate-800 text-[11px] truncate block mt-0.5">{val}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ---------------- THEME C: INDUSTRIAL SHOP-FLOOR (COMPACT) ---------------- */}
                {isIndustrial && (
                  <div className="border-2 border-black p-2.5 mb-2 bg-white">
                    {/* High-Visibility Job/Batch Floor Banner */}
                    <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2">
                      <div className="max-w-[50%]">
                        {showLogo && (
                          <img src={resolvedLogoUrl} alt="Logo" className={`${logoHeightClass} object-contain max-w-[120px] mb-1.5`} />
                        )}
                        <span className="text-[8.5px] font-black uppercase tracking-widest text-black block">
                          FACTORY FLOOR ROUTING & AUDIT SHEET
                        </span>
                        <h2 className="text-xl font-black uppercase tracking-tight text-black leading-none mt-1">
                          {documentTitle}
                        </h2>
                        <div className="text-[9px] font-mono text-black mt-1">
                          {companyName} • Plant Facility #1
                        </div>
                      </div>

                      {/* Giant Readable Batch Identifier */}
                      <div className="border-2 border-black px-4 py-1.5 bg-black text-white text-center rounded">
                        <span className="text-[8px] uppercase tracking-widest font-mono text-slate-300 block">BATCH / ORDER #</span>
                        <span className="text-lg font-black font-mono tracking-wider">{docCode}</span>
                      </div>
                    </div>

                    {/* Shop-Floor Allocation Matrix */}
                    <div className="grid grid-cols-4 gap-1.5 text-[9px] font-mono border border-black p-1.5 bg-slate-50">
                      <div className="border-r border-black pr-2">
                        <span className="font-bold text-slate-600 block">MACHINE / LINE:</span>
                        <span className="font-black text-black text-[10px] uppercase">
                          {headerData.production_line || headerData.machine || 'LINE-03 (WEAVING)'}
                        </span>
                      </div>
                      <div className="border-r border-black pr-2">
                        <span className="font-bold text-slate-600 block">ALLOCATED SHIFT:</span>
                        <span className="font-black text-black text-[10px] uppercase">
                          {headerData.allocated_shift || headerData.shift || 'MORNING (08:00 - 16:00)'}
                        </span>
                      </div>
                      <div className="border-r border-black pr-2">
                        <span className="font-bold text-slate-600 block">OPERATOR IN-CHARGE:</span>
                        <span className="font-black text-black text-[10px]">
                          {headerData.supervisor || headerData.planner_name || 'M. TARIQ (OP-42)'}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-600 block">TARGET YIELD:</span>
                        <span className="font-black text-black text-[10px]">
                          {headerData.output_yield_percent || '98.5% STD'}
                        </span>
                      </div>
                    </div>

                    {/* Floor Header Fields */}
                    {activeHeaderFields.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-2 pt-1.5 border-t border-black text-[9px]">
                        {activeHeaderFields.map(field => {
                          const val = getHeaderValue(field.key);
                          const spanClass = field.width === 'span-3' ? 'col-span-3' : field.width === 'span-2' ? 'col-span-2' : 'col-span-1';
                          return (
                            <div key={field.key} className={`${spanClass} flex gap-1 items-baseline`}>
                              <strong className="uppercase font-mono text-black">{field.label}:</strong>
                              <span className="font-bold text-black truncate">{val}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </header>
            )}

            {/* ============================================================== */}
            {/* 2. LINE ITEMS DATA TABLE (Theme Specific Table Style)           */}
            {/* ============================================================== */}
            <main className="flex-1 w-full overflow-hidden">
              <table 
                className={`w-full border-collapse text-left ${
                  isIndustrial ? 'border-2 border-black' : isModern ? 'border border-slate-200' : 'border border-slate-300'
                }`}
                style={{ fontSize: bodyFontSize }}
              >
                {/* Table Header Row (Repeatable across multi-pages) */}
                {(isFirstPage || layoutConfig.repeatTableHeader !== false) && (
                  <thead>
                    <tr
                      style={{
                        backgroundColor: tableHeaderBg,
                        color: tableHeaderColor,
                        borderBottom: isIndustrial ? '2px solid #000000' : '1px solid #cbd5e1'
                      }}
                    >
                      {/* Industrial Floor Physical Checkbox Column */}
                      {isIndustrial && (
                        <th className="py-1 px-1.5 font-black uppercase text-[8.5px] border-r border-black text-center w-8 bg-black text-white">
                          ✓
                        </th>
                      )}
                      {activeColumns.map(col => (
                        <th
                          key={col.key}
                          className={`py-1.5 px-2 font-bold uppercase text-[9px] tracking-wider ${
                            isIndustrial ? 'border-r border-black text-black' : 'border-r border-slate-200/50'
                          } ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                          style={{ 
                            width: col.width || 'auto',
                            color: isIndustrial ? '#000000' : tableHeaderColor 
                          }}
                        >
                          {col.label || col.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}

                {/* Table Data Rows */}
                <tbody>
                  {pageItems.length > 0 ? (
                    pageItems.map((item, itemIdx) => {
                      const absoluteIndex = computedPages.slice(0, pageIdx).reduce((acc, p) => acc + p.length, 0) + itemIdx;
                      const isZebra = isModern && itemIdx % 2 === 1;

                      return (
                        <tr
                          key={absoluteIndex}
                          className={`${
                            isIndustrial 
                              ? 'border-b border-black hover:bg-slate-100' 
                              : isZebra 
                              ? 'bg-slate-50/80 border-b border-slate-200' 
                              : 'border-b border-slate-200 hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Industrial Floor Sign-off Checkbox */}
                          {isIndustrial && (
                            <td className="py-1 px-1 text-center border-r border-black w-8">
                              <span className="inline-block w-3.5 h-3.5 border border-black rounded-none"></span>
                            </td>
                          )}

                          {activeColumns.map(col => {
                            const cellVal = getCellValue(col.key, item, absoluteIndex);
                            return (
                              <td
                                key={col.key}
                                className={`${isIndustrial ? 'py-1 px-1.5 border-r border-black text-black font-medium' : 'py-1.5 px-2 border-r border-slate-200 text-slate-800'} ${
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
                      <td 
                        colSpan={activeColumns.length + (isIndustrial ? 1 : 0)} 
                        className="text-center py-6 text-slate-400 italic"
                      >
                        No records available for this section.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </main>

            {/* ============================================================== */}
            {/* 3. TOTALS & SUMMARY SECTION                                     */}
            {/* ============================================================== */}
            {shouldShowTotals && record.totals && (
              <div className="avoid-break mt-3 flex justify-end">
                {/* Classic Executive Totals Box */}
                {isClassic && (
                  <div className="p-3 rounded-lg border border-slate-300 bg-slate-50 text-xs w-[40%] space-y-1.5 shadow-sm">
                    {record.totals.subtotal !== undefined && (
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Subtotal:</span>
                        <span className="font-mono font-bold">{Number(record.totals.subtotal).toLocaleString()}</span>
                      </div>
                    )}
                    {record.totals.tax !== undefined && (
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Tax / GST:</span>
                        <span className="font-mono font-bold">{Number(record.totals.tax).toLocaleString()}</span>
                      </div>
                    )}
                    {record.totals.discount !== undefined && (
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Discount:</span>
                        <span className="font-mono font-bold">{Number(record.totals.discount).toLocaleString()}</span>
                      </div>
                    )}
                    {record.totals.grandTotal !== undefined && (
                      <div className="flex justify-between font-bold text-sm pt-2 border-t-2 border-slate-900 text-slate-900">
                        <span>Grand Total:</span>
                        <span className="font-mono" style={{ color: primaryColor }}>
                          ${Number(record.totals.grandTotal).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Modern Pill Totals Card */}
                {isModern && (
                  <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/90 text-xs w-[42%] space-y-1.5">
                    {Object.entries(record.totals).map(([tKey, tVal]) => {
                      const isGrand = tKey.toLowerCase().includes('grand') || tKey.toLowerCase().includes('total');
                      return (
                        <div 
                          key={tKey} 
                          className={`flex justify-between items-center ${
                            isGrand ? 'pt-2 border-t border-slate-300 font-bold text-slate-900' : 'text-[11px] text-slate-500'
                          }`}
                        >
                          <span className="uppercase text-[9px] tracking-wider">{tKey.replace(/([A-Z])/g, ' $1')}:</span>
                          <span className={`font-mono ${isGrand ? 'text-xs text-white px-2 py-0.5 rounded-lg' : 'font-semibold text-slate-800'}`} style={isGrand ? { backgroundColor: primaryColor } : undefined}>
                            {typeof tVal === 'number' ? tVal.toLocaleString() : tVal}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Industrial Floor Metrics Block */}
                {isIndustrial && (
                  <div className="border-2 border-black p-2 bg-white text-xs w-[45%] font-mono space-y-1">
                    <div className="font-black text-[9px] uppercase border-b border-black pb-0.5 text-black">
                      PRODUCTION SUMMARY & AUDIT BALANCE
                    </div>
                    {Object.entries(record.totals).map(([tKey, tVal]) => (
                      <div key={tKey} className="flex justify-between text-[10px] text-black">
                        <span className="uppercase">{tKey.replace(/([A-Z])/g, ' $1')}:</span>
                        <span className="font-black">
                          {typeof tVal === 'number' ? tVal.toLocaleString() : tVal}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* 4. FOOTER: TERMS & CONDITIONS + SIGNATURE MATRIX               */}
            {/* ============================================================== */}
            <footer className="avoid-break mt-auto pt-4 border-t border-slate-200">
              {/* Terms & Instructions */}
              {layoutConfig.termsConditions && (
                <div className="text-[9px] text-slate-500 mb-3 whitespace-pre-line leading-tight">
                  <strong className="text-slate-800 font-bold">Standard Operating Terms: </strong>
                  {layoutConfig.termsConditions}
                </div>
              )}

              {/* ---------------- THEME SIGNATURE BLOCKS ---------------- */}
              {isIndustrial ? (
                /* Industrial Floor 4-Party Sign-Off Matrix */
                <div className="grid grid-cols-4 border-2 border-black divide-x-2 divide-black text-center my-2 font-mono text-[9px]">
                  <div className="p-1.5 flex flex-col justify-between h-14">
                    <span className="font-bold text-black text-[8px] uppercase">1. Machine Operator</span>
                    <span className="text-[8px] text-slate-400">Sign / Stamp</span>
                  </div>
                  <div className="p-1.5 flex flex-col justify-between h-14">
                    <span className="font-bold text-black text-[8px] uppercase">2. QA Clearance Pass</span>
                    <span className="text-[8px] text-slate-400">QC Official Stamp</span>
                  </div>
                  <div className="p-1.5 flex flex-col justify-between h-14">
                    <span className="font-bold text-black text-[8px] uppercase">3. Store Custodian</span>
                    <span className="text-[8px] text-slate-400">Receiving Signature</span>
                  </div>
                  <div className="p-1.5 flex flex-col justify-between h-14">
                    <span className="font-bold text-black text-[8px] uppercase">4. Plant In-Charge</span>
                    <span className="text-[8px] text-slate-400">Final Verification</span>
                  </div>
                </div>
              ) : (
                /* Classic / Modern Signatures */
                (layoutConfig.signatures || []).length > 0 && (
                  <div className="flex justify-between items-end gap-6 my-2 pt-4">
                    {layoutConfig.signatures.map((sig, sIdx) => (
                      <div key={sig.key || sIdx} className="flex-1 flex flex-col items-center">
                        {sig.type === 'stamp' ? (
                          <div className="w-24 h-12 border-2 border-dashed border-slate-300 rounded mb-1 flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                            OFFICIAL STAMP
                          </div>
                        ) : (
                          <div className="w-full border-t border-slate-800 mb-1" />
                        )}
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-700 text-center">
                          {sig.label || 'Authorized Signature'}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Legal & Page Number Bar */}
              <div className="flex justify-between items-center text-[8.5px] text-slate-400 pt-2 border-t border-slate-100 mt-2">
                <span>{layoutConfig.customFooterText || 'Computer Generated Document • FlashVision ERP Architecture'}</span>
                <span className="font-mono">
                  Page {pageIdx + 1} of {computedPages.length}
                </span>
              </div>
            </footer>
          </div>
        );
      })}
    </div>
  );
}
