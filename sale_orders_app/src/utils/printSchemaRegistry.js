// Comprehensive Print Schema Registry for 26 ERP System Documents

import { buildSampleBatchRecordPrintRecord } from './printDesign';

export const DOCUMENT_MODULES = [
  { id: 'oms', name: 'OMS Module', icon: 'shopping_cart' },
  { id: 'production', name: 'Production Module', icon: 'precision_manufacturing' },
  { id: 'inventory', name: 'Inventory Module', icon: 'inventory_2' },
  { id: 'delivery', name: 'Delivery Module', icon: 'local_shipping' },
  { id: 'finance', name: 'Finance Module', icon: 'account_balance_wallet' },
  { id: 'hr', name: 'HR Module', icon: 'badge' }
];

export const SYSTEM_DOCUMENTS = [
  // 1. OMS Module
  { id: 'sale_order', name: 'Sale Order', module: 'oms', icon: 'shopping_basket', code: 'SO' },
  { id: 'planning_history', name: 'Planning History', module: 'oms', icon: 'event_note', code: 'PLN' },
  { id: 'pending_orders', name: 'Orders Report (Pending / All)', module: 'oms', icon: 'list_alt', code: 'ORD' },

  // 2. Production Module
  { id: 'bom_master', name: 'BOM Master', module: 'production', icon: 'account_tree', code: 'BOM' },
  { id: 'production_plan', name: 'Production Plan', module: 'production', icon: 'event_note', code: 'PLN' },
  { id: 'batch_closing_history', name: 'Batch Closing History', module: 'production', icon: 'fact_check', code: 'BCH' },
  { id: 'stock_receiving_history', name: 'Stock Receiving History', module: 'production', icon: 'move_to_inbox', code: 'SRH' },
  { id: 'consumption_history', name: 'Consumption History', module: 'production', icon: 'history_edu', code: 'CSH' },
  { id: 'inventory_ledger', name: 'Inventory Ledger', module: 'production', icon: 'receipt_long', code: 'IVL' },
  { id: 'inventory_adjustment', name: 'Inventory Adjustment', module: 'production', icon: 'tune', code: 'ADJ' },
  { id: 'master_batch_record', name: 'Master Batch Record', module: 'production', icon: 'science', code: 'MBR' },
  { id: 'stock_demand', name: 'Stock Demand', module: 'production', icon: 'request_quote', code: 'SKD' },
  { id: 'other_consumptions', name: 'Other Consumptions', module: 'production', icon: 'opacity', code: 'OTC' },

  // 3. Inventory Module
  { id: 'inventory_return', name: 'Inventory Return', module: 'inventory', icon: 'assignment_return', code: 'IRT' },
  { id: 'purchase_demand', name: 'Purchase Demand', module: 'inventory', icon: 'shopping_bag', code: 'PRD' },
  { id: 'purchase_order', name: 'Purchase Order', module: 'inventory', icon: 'shopping_cart_checkout', code: 'PO' },
  { id: 'inward_gate_pass', name: 'Inward Gate Pass', module: 'inventory', icon: 'login', code: 'IGP' },
  { id: 'grn_note', name: 'Goods Receiving Note (GRN)', module: 'inventory', icon: 'inventory', code: 'GRN' },
  { id: 'stock_transfer', name: 'Stock Transfer', module: 'inventory', icon: 'swap_horiz', code: 'STF' },

  // 4. Delivery Module
  { id: 'delivery_challan', name: 'Delivery Challan (DC)', module: 'delivery', icon: 'local_shipping', code: 'DC' },

  // 5. Finance Module
  { id: 'sale_invoice', name: 'Sale Invoice', module: 'finance', icon: 'description', code: 'INV' },
  { id: 'purchase_invoice', name: 'Purchase Invoice', module: 'finance', icon: 'receipt', code: 'PINV' },
  { id: 'chart_of_accounts', name: 'Chart of Accounts', module: 'finance', icon: 'account_tree', code: 'COA' },
  { id: 'tax_ledger_reports', name: 'Tax & Ledger Reports', module: 'finance', icon: 'analytics', code: 'TLR' },
  { id: 'general_ledger', name: 'General Ledger', module: 'finance', icon: 'menu_book', code: 'GL' },
  { id: 'voucher_receipt', name: 'Receipt Voucher', module: 'finance', icon: 'price_check', code: 'RVR' },
  { id: 'voucher_payment', name: 'Payment Voucher', module: 'finance', icon: 'payments', code: 'PVR' },
  { id: 'voucher_journal', name: 'Journal Voucher', module: 'finance', icon: 'book', code: 'JVR' },
  { id: 'voucher_contra', name: 'Contra Voucher', module: 'finance', icon: 'sync_alt', code: 'CVR' },

  // 6. HR Module
  { id: 'hr_onboarding', name: 'Onboarding Wizard Slip', module: 'hr', icon: 'person_add', code: 'ONB' },
  { id: 'hr_leave_request', name: 'Leave Request Form', module: 'hr', icon: 'time_to_leave', code: 'LRF' },
  { id: 'hr_overtime_request', name: 'Overtime Request Form', module: 'hr', icon: 'more_time', code: 'OTR' },
  { id: 'hr_loan_request', name: 'Loan Request Form', module: 'hr', icon: 'account_balance_wallet', code: 'LNR' },
  { id: 'hr_advance_request', name: 'Advance Request Form', module: 'hr', icon: 'account_balance', code: 'ADV' },
  { id: 'hr_payslip', name: 'Salary Generation / Payslip', module: 'hr', icon: 'payments', code: 'PAY' }
];

// Graphic header designs for the print family (Omer, 2026-10-25): the
// company-name block at the top of a sheet can render as a graphic shape
// (ribbon / wave / side block / top strip / corporate frame) instead of
// the classic plain box. Per-document opt-in via the layout field
// `headerDesign`; 'classic' is the default for EVERY document and renders
// exactly the pre-design header. One list shared by the Print Settings
// designer (and any future picker) so names never drift.
export const HEADER_DESIGNS = [
  { id: 'classic', name: 'Classic (current header)' },
  { id: 'ribbon', name: 'Graphic — Ribbon' },
  { id: 'wave', name: 'Graphic — Wave' },
  { id: 'sideblock', name: 'Graphic — Side Block' },
  { id: 'topstrip', name: 'Graphic — Top Strip' },
  { id: 'frame', name: 'Graphic — Corporate Frame' },
  // Round 5 (Omer, 2026-10-25): the Round 3 set read "thoda classical
  // zyada" — these six are the stylish, graphic-rich set. Same opt-in
  // field, same classic default everywhere.
  { id: 'diagonal', name: 'Graphic — Diagonal Split' },
  { id: 'ribbonfold', name: 'Graphic — Ribbon Fold' },
  { id: 'medallion', name: 'Graphic — Medallion' },
  { id: 'swoosh', name: 'Graphic — Double Swoosh' },
  { id: 'watermark', name: 'Graphic — Watermark' },
  { id: 'premium', name: 'Graphic — Premium Dark' },
  // Round 6 (Omer, 2026-10-25): TOP TEN premium designs shortlisted
  // from web research over premium invoice/letterhead header sets
  // (gradient mesh, geometric/angular, executive, blueprint/technical,
  // arch, hexagon, duotone patterns). Same opt-in field, same classic
  // default everywhere.
  { id: 'aurora', name: 'Graphic — Aurora Gradient' },
  { id: 'facet', name: 'Graphic — Geometric Facet' },
  { id: 'cornerslash', name: 'Graphic — Corner Slash' },
  { id: 'arch', name: 'Graphic — Modern Arch' },
  { id: 'hexbadge', name: 'Graphic — Hexagon Badge' },
  { id: 'blueprint', name: 'Graphic — Blueprint' },
  { id: 'crest', name: 'Graphic — Executive Crest' },
  { id: 'steps', name: 'Graphic — Stacked Steps' },
  { id: 'duotone', name: 'Graphic — Duotone Split' },
  { id: 'pinstripe', name: 'Graphic — Pinstripe Edge' }
];

// Font choices for the print studio's Font Family picker (same list the
// Print Settings designer offers — one source so the two never drift).
export const FONT_OPTIONS = [
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

export const DEFAULT_LAYOUT_SETTINGS = {
  paperSize: 'A4', // A4, Letter, Thermal, A5, Legal
  orientation: 'portrait',
  headerTheme: 'classic_split',
  primaryColor: '#004277',
  fontFamily: 'Inter',
  headerFontSize: '20px',
  bodyFontSize: '11px',
  tableHeaderBgColor: '#004277',
  tableHeaderTextColor: '#ffffff',
  // Multi-Page Pagination Engine Rules (pdfme & jsreport style)
  firstPageRows: 8,
  continuationPageRows: 14,
  rowsPerPage: 10,
  repeatHeader: false,
  repeatTableHeader: true,
  totalsPosition: 'last_page',
  pageBreakRule: 'smart_row_count',

  marginTop: '15mm',
  marginBottom: '15mm',
  marginLeft: '15mm',
  marginRight: '15mm',

  // Approved print family (2026-10-24): title band + totals colors, header
  // block alignment, margin presets, Excel-style scaling, phase-matrix and
  // grouped-report options. All changeable per document in Print Settings.
  bandColor: '#4338ca',
  bandColor2: '#4f46e5',
  bandTextColor: '#ffffff',
  totalsColor: '#232946',
  headerAlign: 'left', // 'left' | 'center' | 'right'
  headerDesign: 'classic', // graphic header design (HEADER_DESIGNS); 'classic' = today's header, unchanged
  marginPreset: 'default', // 'default' | 'minimum' | 'low' | 'custom'
  scaleMode: 'fill', // 'fill' | 'fit' | 'actual'
  phasesPerRow: 4, // phase-matrix documents (BOM / Consumption)
  phaseRowHeight: 'natural', // 'natural' | 'equal'
  showPhaseTotals: true,
  groupBy: 'customer', // grouped reports (Orders Report): 'customer' | 'status' | 'none'
  goldenTotalRow: false, // plan-format golden total row (Production Plan)

  showHeaderLogo: true,
  showHeaderDetails: true,
  showCompanyAddress: true,
  showPageNumbers: true,
  pageNumberFormat: 'Page X of Y',
  wrapText: true,
  footerAlign: 'left',
  showCustomFooterText: true,
  customFooterText: 'Computer Generated Official Copy. Powered by Flashvision ERP.',
  showDisclaimer: true,
  disclaimerText: 'Notice: Inspect all items upon receipt. System generated document.',
  termsConditions: '1. Standard terms apply.\n2. E&OE. Any discrepancy must be reported within 48 hours.',

  headerFields: [],
  gridColumns: [],
  signatures: [
    { key: 'sig_prepared', label: 'Prepared By', size: '1/3', type: 'text' },
    { key: 'sig_verified', label: 'Verified By', size: '1/3', type: 'text' },
    { key: 'sig_authorized', label: 'Authorized Signatory', size: '1/3', type: 'stamp' }
  ],
  totalsStyle: { width: '35%', bgColor: '#f8fafc', textColor: '#0f172a', borderStyle: 'solid' }
};

// Generate default schema presets for all 26 documents
export const DEFAULT_DOCUMENT_SCHEMAS = {
  sale_order: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'so_number', label: 'Sale Order #', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Order Date', enabled: true, width: 'span-1' },
      { key: 'status', label: 'Status', enabled: true, width: 'span-1' },
      { key: 'customer', label: 'Customer Name', enabled: true, width: 'span-2' },
      { key: 'contact', label: 'Contact Details', enabled: true, width: 'span-1' },
      { key: 'shipping_address', label: 'Shipping Address', enabled: true, width: 'span-3' },
      { key: 'salesperson', label: 'Sales Representative', enabled: true, width: 'span-1' },
      { key: 'payment_terms', label: 'Payment Terms', enabled: true, width: 'span-1' },
      { key: 'delivery_date', label: 'Expected Delivery Date', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '15%', align: 'left' },
      { key: 'item_name', label: 'Item Name / Description', enabled: true, width: '30%', align: 'left' },
      { key: 'rolls', label: 'Rolls Qty', enabled: true, width: '9%', align: 'center' },
      { key: 'qty', label: 'Quantity / Meters', enabled: true, width: '12%', align: 'right' },
      { key: 'uom', label: 'UOM', enabled: true, width: '8%', align: 'center' },
      { key: 'rate', label: 'Unit Rate ($)', enabled: true, width: '12%', align: 'right' },
      { key: 'discount', label: 'Discount', enabled: true, width: '8%', align: 'right' },
      { key: 'sub_total', label: 'Sub-Total ($)', enabled: true, width: '15%', align: 'right' }
    ]
  },

  planning_history: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'plan_id', label: 'Plan Reference #', enabled: true, width: 'span-1' },
      { key: 'plan_date', label: 'Planning Date', enabled: true, width: 'span-1' },
      { key: 'planner_name', label: 'Planner Name', enabled: true, width: 'span-1' },
      { key: 'production_line', label: 'Target Line', enabled: true, width: 'span-1' },
      { key: 'status', label: 'Plan Status', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'order_ref', label: 'SO Ref #', enabled: true, width: '18%', align: 'left' },
      { key: 'item_name', label: 'Planned Item', enabled: true, width: '32%', align: 'left' },
      { key: 'target_qty', label: 'Target Qty', enabled: true, width: '14%', align: 'right' },
      { key: 'allocated_shift', label: 'Shift', enabled: true, width: '14%', align: 'center' },
      { key: 'est_hours', label: 'Est. Machine Hours', enabled: true, width: '14%', align: 'right' }
    ]
  },

  production_plan: {
    // Sheet-based plan format (approved): landscape, ORDER (M) before STATUS,
    // dark title band, system dark-navy total row (2026-10-25: the sheet's
    // golden total row was replaced with the ERP system totals style —
    // totalsColor #232946, white bold text, same as the band),
    // 'Production & Planning Division'.
    ...DEFAULT_LAYOUT_SETTINGS,
    orientation: 'landscape',
    bandColor: '#232946',
    bandColor2: '#232946',
    tableHeaderBgColor: '#232946',
    primaryColor: '#232946',
    goldenTotalRow: false,
    firstPageRows: 16,
    continuationPageRows: 20,
    headerFields: [
      { key: 'plan_id', label: 'Plan ID', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Plan Date', enabled: true, width: 'span-1' },
      { key: 'status', label: 'Status', enabled: true, width: 'span-1' },
      { key: 'created_by', label: 'Created By', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'sr_no', label: 'SR.NO', enabled: true, width: '7%', align: 'center' },
      { key: 'order_date', label: 'ORDER DATE', enabled: true, width: '12%', align: 'center' },
      { key: 'customer_name', label: 'CUSTOMER NAME', enabled: true, width: '20%', align: 'left' },
      { key: 'item_name', label: 'ITEM NAME', enabled: true, width: '38%', align: 'left' },
      { key: 'order_m', label: 'ORDER (M)', enabled: true, width: '11%', align: 'right', total: true },
      { key: 'status', label: 'STATUS', enabled: true, width: '12%', align: 'center' }
    ],
    signatures: []
  },

  pending_orders: {
    // OMS Orders Report — pending-orders format, landscape by default,
    // grouping (customer / status / none) chosen inside the print popup.
    ...DEFAULT_LAYOUT_SETTINGS,
    orientation: 'landscape',
    firstPageRows: 18,
    continuationPageRows: 24,
    groupBy: 'customer',
    headerFields: [
      { key: 'report_date', label: 'Report Date', enabled: true, width: 'span-1' },
      { key: 'status_filter', label: 'Status Filter', enabled: true, width: 'span-1' },
      { key: 'total_orders', label: 'Total Orders', enabled: true, width: 'span-1' },
      { key: 'total_meters', label: 'Total Meters', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'sr_no', label: 'SR.NO', enabled: true, width: '6%', align: 'center' },
      { key: 'order_date', label: 'ORDER DATE', enabled: true, width: '10%', align: 'center' },
      { key: 'order_id', label: 'ORDER #', enabled: true, width: '10%', align: 'left' },
      { key: 'customer_name', label: 'CUSTOMER NAME', enabled: true, width: '18%', align: 'left' },
      { key: 'item_name', label: 'ITEM NAME', enabled: true, width: '30%', align: 'left' },
      { key: 'order_m', label: 'ORDER (M)', enabled: true, width: '10%', align: 'right', total: true },
      { key: 'produced_m', label: 'PRODUCED (M)', enabled: true, width: '9%', align: 'right', total: true },
      { key: 'status', label: 'STATUS', enabled: true, width: '7%', align: 'center' }
    ],
    signatures: [
      { key: 'sig_prepared', label: 'Prepared By', size: '1/3', type: 'text' },
      { key: 'sig_approved', label: 'Approved By', size: '1/3', type: 'text' }
    ]
  },

  bom_master: {
    ...DEFAULT_LAYOUT_SETTINGS,
    orientation: 'landscape',
    headerFields: [
      { key: 'bom_code', label: 'BOM Code', enabled: true, width: 'span-1' },
      { key: 'bom_name', label: 'BOM Name', enabled: true, width: 'span-2' },
      { key: 'product_code', label: 'Finished Product Code', enabled: true, width: 'span-1' },
      { key: 'version', label: 'Version / Revision', enabled: true, width: 'span-1' },
      { key: 'std_batch_size', label: 'Standard Batch Size', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'component_code', label: 'Raw Material Code', enabled: true, width: '20%', align: 'left' },
      { key: 'component_name', label: 'Raw Material Name', enabled: true, width: '34%', align: 'left' },
      { key: 'phase', label: 'Process Phase', enabled: true, width: '14%', align: 'center' },
      { key: 'qty_per_batch', label: 'Qty per Batch', enabled: true, width: '12%', align: 'right' },
      { key: 'uom', label: 'UOM', enabled: true, width: '12%', align: 'center' }
    ]
  },

  batch_closing_history: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'batch_no', label: 'Batch #', enabled: true, width: 'span-1' },
      { key: 'closing_date', label: 'Closing Date', enabled: true, width: 'span-1' },
      { key: 'supervisor', label: 'Batch Supervisor', enabled: true, width: 'span-1' },
      { key: 'output_yield_percent', label: 'Yield Percentage', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'step_name', label: 'Process Stage', enabled: true, width: '25%', align: 'left' },
      { key: 'planned_qty', label: 'Planned Input', enabled: true, width: '15%', align: 'right' },
      { key: 'actual_output', label: 'Actual Output', enabled: true, width: '15%', align: 'right' },
      { key: 'waste_qty', label: 'Wastage Qty', enabled: true, width: '15%', align: 'right' },
      { key: 'variance', label: 'Variance %', enabled: true, width: '22%', align: 'center' }
    ]
  },

  stock_receiving_history: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'receiving_no', label: 'Receipt #', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Receipt Date', enabled: true, width: 'span-1' },
      { key: 'supplier', label: 'Supplier Name', enabled: true, width: 'span-2' },
      { key: 'grn_ref', label: 'GRN Ref #', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '20%', align: 'left' },
      { key: 'item_name', label: 'Item Description', enabled: true, width: '35%', align: 'left' },
      { key: 'received_qty', label: 'Received Qty', enabled: true, width: '15%', align: 'right' },
      { key: 'accepted_qty', label: 'Accepted Qty', enabled: true, width: '12%', align: 'right' },
      { key: 'rejected_qty', label: 'Rejected Qty', enabled: true, width: '10%', align: 'right' }
    ]
  },

  consumption_history: {
    ...DEFAULT_LAYOUT_SETTINGS,
    orientation: 'landscape',
    headerFields: [
      { key: 'log_id', label: 'Log #', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Date', enabled: true, width: 'span-1' },
      { key: 'batch_no', label: 'Batch Ref', enabled: true, width: 'span-1' },
      { key: 'department', label: 'Department', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'material_code', label: 'Material Code', enabled: true, width: '22%', align: 'left' },
      { key: 'material_name', label: 'Material Description', enabled: true, width: '38%', align: 'left' },
      { key: 'consumed_qty', label: 'Consumed Qty', enabled: true, width: '16%', align: 'right' },
      { key: 'uom', label: 'UOM', enabled: true, width: '16%', align: 'center' }
    ]
  },

  inventory_ledger: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'ledger_id', label: 'Ledger Code', enabled: true, width: 'span-1' },
      { key: 'period', label: 'Date Period', enabled: true, width: 'span-2' },
      { key: 'warehouse', label: 'Warehouse / Store', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'date', label: 'Tx Date', enabled: true, width: '12%', align: 'center' },
      { key: 'ref_no', label: 'Document Ref #', enabled: true, width: '18%', align: 'left' },
      { key: 'item_name', label: 'Item Name', enabled: true, width: '28%', align: 'left' },
      { key: 'qty_in', label: 'Inward Qty', enabled: true, width: '14%', align: 'right' },
      { key: 'qty_out', label: 'Outward Qty', enabled: true, width: '14%', align: 'right' },
      { key: 'balance', label: 'Closing Balance', enabled: true, width: '14%', align: 'right' }
    ]
  },

  inventory_adjustment: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'adj_id', label: 'Adjustment ID', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Adjustment Date', enabled: true, width: 'span-1' },
      { key: 'approved_by', label: 'Auditor Approved', enabled: true, width: 'span-1' },
      { key: 'reason', label: 'Primary Reason', enabled: true, width: 'span-2' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '20%', align: 'left' },
      { key: 'item_name', label: 'Item Description', enabled: true, width: '32%', align: 'left' },
      { key: 'system_qty', label: 'Book Qty', enabled: true, width: '12%', align: 'right' },
      { key: 'physical_qty', label: 'Physical Qty', enabled: true, width: '14%', align: 'right' },
      { key: 'adj_qty', label: 'Variance Qty', enabled: true, width: '14%', align: 'right' }
    ]
  },

  master_batch_record: {
    // Real Batch Record print (finalized 2026-10-25): the record is built
    // by buildBatchRecordPrintRecord (utils/printDesign) from the actual
    // batch — meta + costing summary as header fields (including the
    // Estimated Labor Cost line), consumption details as the line table.
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'id', label: 'Record ID', enabled: false, width: 'span-1' },
      { key: 'batch_code', label: 'Batch Reference', enabled: true, width: 'span-1' },
      { key: 'product_name', label: 'Product Name', enabled: true, width: 'span-2' },
      { key: 'production_date', label: 'Production Date', enabled: true, width: 'span-1' },
      { key: 'plan_id', label: 'Plan ID', enabled: true, width: 'span-1' },
      { key: 'status', label: 'Batch Status', enabled: true, width: 'span-1' },
      { key: 'requested_qty', label: 'Requested Output', enabled: true, width: 'span-1' },
      { key: 'produced_qty', label: 'Actual Output', enabled: true, width: 'span-1' },
      { key: 'efficiency', label: 'Yield Efficiency', enabled: true, width: 'span-1' },
      { key: 'finished_goods_value', label: 'Finished Goods Value', enabled: true, width: 'span-1' },
      { key: 'wastage_value', label: 'Wastage Loss Value', enabled: true, width: 'span-1' },
      { key: 'raw_material_cost', label: 'Raw Material Cost (BOM)', enabled: true, width: 'span-1' },
      { key: 'other_consumption_cost', label: 'Other Consumption Cost', enabled: true, width: 'span-1' },
      { key: 'est_labor_cost', label: 'Estimated Labor Cost', enabled: true, width: 'span-1' },
      { key: 'cost_per_unit', label: 'Cost per Unit Finished Good', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '6%', align: 'center' },
      { key: 'material_name', label: 'Material Name', enabled: true, width: '30%', align: 'left' },
      { key: 'target_qty', label: 'Target Qty', enabled: true, width: '14%', align: 'right' },
      { key: 'actual_qty', label: 'Actual Qty', enabled: true, width: '14%', align: 'right' },
      { key: 'unit_price', label: 'Unit Price (Rs.)', enabled: true, width: '12%', align: 'right' },
      { key: 'total_cost', label: 'Total Cost (Rs.)', enabled: true, width: '14%', align: 'right', total: true },
      { key: 'variance', label: 'Variance', enabled: true, width: '10%', align: 'center' }
    ],
    signatures: [
      { key: 'sig_produced', label: 'Produced By (Operator)', size: '1/3', type: 'text' },
      { key: 'sig_qc', label: 'Quality Control Assurance', size: '1/3', type: 'text' },
      { key: 'sig_manager', label: 'Plant Manager Sign-Off', size: '1/3', type: 'text' }
    ]
  },

  stock_demand: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'demand_no', label: 'Stock Demand #', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Request Date', enabled: true, width: 'span-1' },
      { key: 'from_dept', label: 'Demanding Dept', enabled: true, width: 'span-1' },
      { key: 'to_store', label: 'Target Store', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Material Code', enabled: true, width: '22%', align: 'left' },
      { key: 'item_name', label: 'Material Description', enabled: true, width: '36%', align: 'left' },
      { key: 'demanded_qty', label: 'Required Qty', enabled: true, width: '17%', align: 'right' },
      { key: 'uom', label: 'UOM', enabled: true, width: '17%', align: 'center' }
    ]
  },

  other_consumptions: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'ref_no', label: 'Consumption Ref #', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Date', enabled: true, width: 'span-1' },
      { key: 'cost_center', label: 'Cost Center', enabled: true, width: 'span-1' },
      { key: 'category', label: 'Consumption Category', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '7%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '13%', align: 'left' },
      { key: 'item_name', label: 'Material / Chemical Name', enabled: true, width: '28%', align: 'left' },
      { key: 'qty', label: 'Qty Used', enabled: true, width: '11%', align: 'right', total: true },
      { key: 'uom', label: 'UOM', enabled: true, width: '9%', align: 'center' },
      { key: 'unit_price', label: 'Unit Price', enabled: true, width: '12%', align: 'right' },
      { key: 'amount', label: 'Total Cost', enabled: true, width: '12%', align: 'right', total: true },
      { key: 'remarks', label: 'Remarks / Purpose', enabled: true, width: '8%', align: 'left' }
    ],
    signatures: [
      { key: 'sig_prepared', label: 'Prepared By', size: '1/3', type: 'text' },
      { key: 'sig_authorized', label: 'Authorized Signature', size: '1/3', type: 'text' }
    ]
  },

  inventory_return: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'return_no', label: 'Return Note #', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Return Date', enabled: true, width: 'span-1' },
      { key: 'party_name', label: 'Customer / Supplier', enabled: true, width: 'span-2' },
      { key: 'reason', label: 'Reason for Return', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '20%', align: 'left' },
      { key: 'item_name', label: 'Item Description', enabled: true, width: '32%', align: 'left' },
      { key: 'inv_qty', label: 'Invoiced Qty', enabled: true, width: '12%', align: 'right' },
      { key: 'returned_qty', label: 'Returned Qty', enabled: true, width: '14%', align: 'right' },
      { key: 'unit_price', label: 'Unit Price ($)', enabled: true, width: '14%', align: 'right' }
    ]
  },

  purchase_demand: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'pr_no', label: 'Requisition #', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Date', enabled: true, width: 'span-1' },
      { key: 'requestor', label: 'Requested By', enabled: true, width: 'span-1' },
      { key: 'priority', label: 'Urgency Priority', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '20%', align: 'left' },
      { key: 'item_name', label: 'Item Name / Spec', enabled: true, width: '36%', align: 'left' },
      { key: 'required_qty', label: 'Req Qty', enabled: true, width: '18%', align: 'right' },
      { key: 'needed_by', label: 'Required Date', enabled: true, width: '18%', align: 'center' }
    ]
  },

  purchase_order: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'po_number', label: 'PO Number', enabled: true, width: 'span-1' },
      { key: 'po_date', label: 'Order Date', enabled: true, width: 'span-1' },
      { key: 'supplier_name', label: 'Vendor / Supplier', enabled: true, width: 'span-2' },
      { key: 'payment_terms', label: 'Payment Terms', enabled: true, width: 'span-1' },
      { key: 'delivery_location', label: 'Delivery Location', enabled: true, width: 'span-3' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '18%', align: 'left' },
      { key: 'item_name', label: 'Description', enabled: true, width: '30%', align: 'left' },
      { key: 'qty', label: 'PO Qty', enabled: true, width: '12%', align: 'right' },
      { key: 'unit_price', label: 'Unit Cost ($)', enabled: true, width: '14%', align: 'right' },
      { key: 'tax', label: 'Tax %', enabled: true, width: '8%', align: 'right' },
      { key: 'amount', label: 'Total Amount ($)', enabled: true, width: '10%', align: 'right' }
    ]
  },

  inward_gate_pass: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'gate_pass_no', label: 'Inward Gate Pass #', enabled: true, width: 'span-1' },
      { key: 'entry_time', label: 'Date & Entry Time', enabled: true, width: 'span-1' },
      { key: 'driver_name', label: 'Driver Name', enabled: true, width: 'span-1' },
      { key: 'vehicle_no', label: 'Vehicle Number', enabled: true, width: 'span-1' },
      { key: 'supplier', label: 'Supplier / Origin', enabled: true, width: 'span-2' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_description', label: 'Goods Description', enabled: true, width: '40%', align: 'left' },
      { key: 'chalan_qty', label: 'Challan Qty', enabled: true, width: '18%', align: 'right' },
      { key: 'no_of_packages', label: 'Packages Count', enabled: true, width: '17%', align: 'center' },
      { key: 'weight', label: 'Gross Weight (kg)', enabled: true, width: '17%', align: 'right' }
    ]
  },

  grn_note: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'grn_number', label: 'GRN Number', enabled: true, width: 'span-1' },
      { key: 'grn_date', label: 'GRN Date', enabled: true, width: 'span-1' },
      { key: 'po_ref', label: 'PO Ref #', enabled: true, width: 'span-1' },
      { key: 'supplier_name', label: 'Supplier Name', enabled: true, width: 'span-2' },
      { key: 'inspector', label: 'QC Inspector', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '18%', align: 'left' },
      { key: 'item_name', label: 'Material Description', enabled: true, width: '30%', align: 'left' },
      { key: 'ordered_qty', label: 'PO Qty', enabled: true, width: '11%', align: 'right' },
      { key: 'received_qty', label: 'Rec Qty', enabled: true, width: '11%', align: 'right' },
      { key: 'accepted_qty', label: 'Pass Qty', enabled: true, width: '11%', align: 'right' },
      { key: 'rejected_qty', label: 'Reject Qty', enabled: true, width: '11%', align: 'right' }
    ]
  },

  stock_transfer: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'transfer_no', label: 'Transfer Note #', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Transfer Date', enabled: true, width: 'span-1' },
      { key: 'from_warehouse', label: 'Source Warehouse', enabled: true, width: 'span-1' },
      { key: 'to_warehouse', label: 'Destination Warehouse', enabled: true, width: 'span-1' },
      { key: 'status', label: 'Status', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '22%', align: 'left' },
      { key: 'item_name', label: 'Item Description', enabled: true, width: '38%', align: 'left' },
      { key: 'transfer_qty', label: 'Transfer Qty', enabled: true, width: '16%', align: 'right', total: true },
      { key: 'uom', label: 'UOM', enabled: true, width: '16%', align: 'center' }
    ]
  },

  delivery_challan: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'challan_no', label: 'Challan Number', enabled: true, width: 'span-1' },
      { key: 'dispatch_date', label: 'Dispatch Date', enabled: true, width: 'span-1' },
      { key: 'so_ref', label: 'Sales Order Ref', enabled: true, width: 'span-1' },
      { key: 'customer_name', label: 'Customer Name', enabled: true, width: 'span-2' },
      { key: 'shipping_address', label: 'Delivery Address', enabled: true, width: 'span-3' },
      { key: 'vehicle_no', label: 'Vehicle Number', enabled: true, width: 'span-1' },
      { key: 'driver_name', label: 'Driver Name', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '18%', align: 'left' },
      { key: 'item_name', label: 'Item Name', enabled: true, width: '32%', align: 'left' },
      { key: 'dispatch_qty', label: 'Dispatched Qty', enabled: true, width: '14%', align: 'right' },
      { key: 'packing_type', label: 'Packaging', enabled: true, width: '14%', align: 'center' },
      { key: 'net_weight', label: 'Weight (kg)', enabled: true, width: '14%', align: 'right' }
    ]
  },

  sale_invoice: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'invoice_no', label: 'Invoice Number', enabled: true, width: 'span-1' },
      { key: 'invoice_date', label: 'Invoice Date', enabled: true, width: 'span-1' },
      { key: 'due_date', label: 'Due Date', enabled: true, width: 'span-1' },
      { key: 'customer_name', label: 'Billed To Customer', enabled: true, width: 'span-2' },
      { key: 'salesperson', label: 'Sales Executive', enabled: true, width: 'span-1' },
      { key: 'billing_address', label: 'Billing Address', enabled: true, width: 'span-3' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '15%', align: 'left' },
      { key: 'item_name', label: 'Description', enabled: true, width: '30%', align: 'left' },
      { key: 'qty', label: 'Qty', enabled: true, width: '10%', align: 'right' },
      { key: 'unit_price', label: 'Price ($)', enabled: true, width: '12%', align: 'right' },
      { key: 'tax_rate', label: 'Tax %', enabled: true, width: '10%', align: 'right' },
      { key: 'amount', label: 'Total ($)', enabled: true, width: '15%', align: 'right' }
    ]
  },

  purchase_invoice: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'bill_no', label: 'Supplier Bill #', enabled: true, width: 'span-1' },
      { key: 'bill_date', label: 'Bill Date', enabled: true, width: 'span-1' },
      { key: 'po_ref', label: 'PO Ref #', enabled: true, width: 'span-1' },
      { key: 'supplier_name', label: 'Supplier Name', enabled: true, width: 'span-2' },
      { key: 'payment_status', label: 'Payment Status', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '18%', align: 'left' },
      { key: 'item_name', label: 'Material Description', enabled: true, width: '32%', align: 'left' },
      { key: 'qty', label: 'Billed Qty', enabled: true, width: '12%', align: 'right' },
      { key: 'unit_rate', label: 'Unit Rate ($)', enabled: true, width: '14%', align: 'right' },
      { key: 'total_amount', label: 'Amount ($)', enabled: true, width: '16%', align: 'right' }
    ]
  },

  chart_of_accounts: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'report_title', label: 'Report Title', enabled: true, width: 'span-2' },
      { key: 'print_date', label: 'Print Date', enabled: true, width: 'span-1' },
      { key: 'filtered_by', label: 'Account Category', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'account_code', label: 'Account Code', enabled: true, width: '18%', align: 'left' },
      { key: 'account_name', label: 'Account Title', enabled: true, width: '38%', align: 'left' },
      { key: 'type', label: 'Type', enabled: true, width: '18%', align: 'center' },
      { key: 'current_balance', label: 'Balance ($)', enabled: true, width: '26%', align: 'right' }
    ]
  },

  tax_ledger_reports: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'tax_period', label: 'Tax Period', enabled: true, width: 'span-2' },
      { key: 'ntn_number', label: 'Company NTN / Tax ID', enabled: true, width: 'span-1' },
      { key: 'generated_on', label: 'Report Date', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'date', label: 'Tx Date', enabled: true, width: '12%', align: 'center' },
      { key: 'voucher_no', label: 'Voucher Ref', enabled: true, width: '18%', align: 'left' },
      { key: 'party_name', label: 'Taxpayer / Customer', enabled: true, width: '30%', align: 'left' },
      { key: 'taxable_val', label: 'Taxable Amount ($)', enabled: true, width: '20%', align: 'right' },
      { key: 'tax_amount', label: 'Tax Output ($)', enabled: true, width: '20%', align: 'right' }
    ]
  },

  general_ledger: {
    // Finance → General Ledger studio print (2026-10-25): wide double-entry
    // book, landscape, totals row from the filtered debit/credit columns.
    ...DEFAULT_LAYOUT_SETTINGS,
    orientation: 'landscape',
    firstPageRows: 22,
    continuationPageRows: 28,
    headerFields: [
      { key: 'account', label: 'Account', enabled: true, width: 'span-2' },
      { key: 'period', label: 'Period', enabled: true, width: 'span-1' },
      { key: 'voucher_type', label: 'Voucher Type', enabled: true, width: 'span-1' },
      { key: 'party', label: 'Party', enabled: true, width: 'span-1' },
      { key: 'generated_on', label: 'Generated On', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'entry_date', label: 'Date', enabled: true, width: '9%', align: 'center' },
      { key: 'voucher', label: 'Voucher', enabled: true, width: '13%', align: 'left' },
      { key: 'account', label: 'Account', enabled: true, width: '20%', align: 'left' },
      { key: 'party', label: 'Party', enabled: true, width: '13%', align: 'left' },
      { key: 'narration', label: 'Narration', enabled: true, width: '19%', align: 'left' },
      { key: 'debit', label: 'Debit', enabled: true, width: '9%', align: 'right', total: true },
      { key: 'credit', label: 'Credit', enabled: true, width: '9%', align: 'right', total: true },
      { key: 'balance', label: 'Running Balance', enabled: true, width: '10%', align: 'right' }
    ],
    signatures: []
  },

  voucher_receipt: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'voucher_no', label: 'Receipt Voucher #', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Date', enabled: true, width: 'span-1' },
      { key: 'received_from', label: 'Received From', enabled: true, width: 'span-2' },
      { key: 'payment_mode', label: 'Payment Mode', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'account_head', label: 'Account Head Code & Name', enabled: true, width: '42%', align: 'left' },
      { key: 'narration', label: 'Particulars / Description', enabled: true, width: '32%', align: 'left' },
      { key: 'amount', label: 'Received Amount ($)', enabled: true, width: '18%', align: 'right' }
    ]
  },

  voucher_payment: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'voucher_no', label: 'Payment Voucher #', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Date', enabled: true, width: 'span-1' },
      { key: 'paid_to', label: 'Paid To', enabled: true, width: 'span-2' },
      { key: 'cheque_no', label: 'Cheque / Ref #', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'account_head', label: 'Account Head', enabled: true, width: '42%', align: 'left' },
      { key: 'narration', label: 'Particulars', enabled: true, width: '32%', align: 'left' },
      { key: 'amount', label: 'Paid Amount ($)', enabled: true, width: '18%', align: 'right' }
    ]
  },

  voucher_journal: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'voucher_no', label: 'JV Number', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Date', enabled: true, width: 'span-1' },
      { key: 'prepared_by', label: 'Accountant', enabled: true, width: 'span-1' },
      { key: 'notes', label: 'General Note', enabled: true, width: 'span-2' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'account_head', label: 'Account Title', enabled: true, width: '34%', align: 'left' },
      { key: 'narration', label: 'Narration Details', enabled: true, width: '30%', align: 'left' },
      { key: 'debit', label: 'Debit ($)', enabled: true, width: '14%', align: 'right' },
      { key: 'credit', label: 'Credit ($)', enabled: true, width: '14%', align: 'right' }
    ]
  },

  voucher_contra: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'voucher_no', label: 'Contra Voucher #', enabled: true, width: 'span-1' },
      { key: 'date', label: 'Date', enabled: true, width: 'span-1' },
      { key: 'bank_account', label: 'Bank Account Name', enabled: true, width: 'span-2' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'account_head', label: 'Account Title', enabled: true, width: '40%', align: 'left' },
      { key: 'debit', label: 'Deposit / Debit ($)', enabled: true, width: '26%', align: 'right' },
      { key: 'credit', label: 'Withdrawal / Credit ($)', enabled: true, width: '26%', align: 'right' }
    ]
  },

  hr_onboarding: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'emp_id', label: 'Employee ID', enabled: true, width: 'span-1' },
      { key: 'emp_name', label: 'Employee Name', enabled: true, width: 'span-2' },
      { key: 'designation', label: 'Designation', enabled: true, width: 'span-1' },
      { key: 'department', label: 'Department', enabled: true, width: 'span-1' },
      { key: 'joining_date', label: 'Joining Date', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'step_no', label: 'Step #', enabled: true, width: '10%', align: 'center' },
      { key: 'clearance_item', label: 'Clearance Requirement', enabled: true, width: '45%', align: 'left' },
      { key: 'status', label: 'Completion Status', enabled: true, width: '25%', align: 'center' },
      { key: 'sign', label: 'Sign Off', enabled: true, width: '20%', align: 'center' }
    ]
  },

  hr_leave_request: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'leave_id', label: 'Leave Slip #', enabled: true, width: 'span-1' },
      { key: 'emp_name', label: 'Employee Name', enabled: true, width: 'span-2' },
      { key: 'department', label: 'Department', enabled: true, width: 'span-1' },
      { key: 'leave_type', label: 'Leave Category', enabled: true, width: 'span-1' },
      { key: 'duration', label: 'Date Range', enabled: true, width: 'span-2' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '10%', align: 'center' },
      { key: 'date', label: 'Leave Date', enabled: true, width: '25%', align: 'center' },
      { key: 'type', label: 'Type (Paid/Unpaid)', enabled: true, width: '25%', align: 'center' },
      { key: 'reason', label: 'Reason Description', enabled: true, width: '40%', align: 'left' }
    ]
  },

  hr_overtime_request: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'ot_id', label: 'Overtime Claim #', enabled: true, width: 'span-1' },
      { key: 'emp_name', label: 'Employee Name', enabled: true, width: 'span-2' },
      { key: 'month_year', label: 'Month / Year', enabled: true, width: 'span-1' },
      { key: 'department', label: 'Department', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'work_date', label: 'Date', enabled: true, width: '20%', align: 'center' },
      { key: 'hours', label: 'OT Hours', enabled: true, width: '18%', align: 'right' },
      { key: 'rate_multiplier', label: 'Rate (1.5x/2.0x)', enabled: true, width: '20%', align: 'center' },
      { key: 'task_description', label: 'Approved Task', enabled: true, width: '34%', align: 'left' }
    ]
  },

  hr_payslip: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'payslip_no', label: 'Payslip Ref #', enabled: true, width: 'span-1' },
      { key: 'pay_period', label: 'Pay Month', enabled: true, width: 'span-1' },
      { key: 'emp_id', label: 'Employee ID', enabled: true, width: 'span-1' },
      { key: 'emp_name', label: 'Employee Name', enabled: true, width: 'span-2' },
      { key: 'designation', label: 'Designation', enabled: true, width: 'span-1' },
      { key: 'bank_account', label: 'Bank Account #', enabled: true, width: 'span-2' }
    ],
    gridColumns: [
      { key: 'type', label: 'Component Type', enabled: true, width: '25%', align: 'left' },
      { key: 'earnings', label: 'Earnings Description', enabled: true, width: '35%', align: 'left' },
      { key: 'earn_amount', label: 'Earned ($)', enabled: true, width: '20%', align: 'right' },
      { key: 'ded_amount', label: 'Deductions ($)', enabled: true, width: '20%', align: 'right' }
    ]
  },

  hr_loan_request: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'request_id', label: 'Loan Request ID', enabled: true, width: 'span-1' },
      { key: 'date_applied', label: 'Date Applied', enabled: true, width: 'span-1' },
      { key: 'employee_id', label: 'Employee ID', enabled: true, width: 'span-1' },
      { key: 'employee_name', label: 'Employee Name', enabled: true, width: 'span-2' },
      { key: 'department', label: 'Department', enabled: true, width: 'span-1' },
      { key: 'loan_type', label: 'Loan Type', enabled: true, width: 'span-1' },
      { key: 'loan_amount', label: 'Loan Amount (Rs.)', enabled: true, width: 'span-1' },
      { key: 'repayment_term', label: 'Repayment Term (Months)', enabled: true, width: 'span-1' },
      { key: 'monthly_installment', label: 'Monthly Installment (Rs.)', enabled: true, width: 'span-1' },
      { key: 'repayment_start_date', label: 'Repayment Start Date', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'month_no', label: 'Installment #', enabled: true, width: '15%', align: 'center' },
      { key: 'due_date', label: 'Deduction Month', enabled: true, width: '35%', align: 'left' },
      { key: 'installment_amount', label: 'Installment Amount (Rs.)', enabled: true, width: '25%', align: 'right' },
      { key: 'status', label: 'Status', enabled: true, width: '25%', align: 'center' }
    ]
  },

  hr_advance_request: {
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'request_id', label: 'Advance Request ID', enabled: true, width: 'span-1' },
      { key: 'date_applied', label: 'Date Applied', enabled: true, width: 'span-1' },
      { key: 'employee_id', label: 'Employee ID', enabled: true, width: 'span-1' },
      { key: 'employee_name', label: 'Employee Name', enabled: true, width: 'span-2' },
      { key: 'department', label: 'Department', enabled: true, width: 'span-1' },
      { key: 'advance_amount', label: 'Advance Amount (Rs.)', enabled: true, width: 'span-1' },
      { key: 'deduction_month', label: 'Deduction Month', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '15%', align: 'center' },
      { key: 'recovery_month', label: 'Recovery Payroll Month', enabled: true, width: '45%', align: 'left' },
      { key: 'deduction_amount', label: 'Deduction Amount (Rs.)', enabled: true, width: '40%', align: 'right' }
    ]
  }
};

/**
 * Dynamic Schema Discovery Engine
 * Scans runtime data structures and returns a complete layout schema.
 * Future-proofs system when developers add new fields to database objects.
 */

/**
 * Map document type to real collection in AppContext state
 */
export function getSampleRecordFromState(docType, state) {
  if (!state || typeof state !== 'object') return null;
  try {
    const map = {
      sale_order: (state.saleOrders && state.saleOrders[0]) ? {
        ...state.saleOrders[0],
        customer: state.customers?.find(c => c && c.id === state.saleOrders[0].customerId)?.name || state.saleOrders[0].customerName || 'Customer',
        contact: state.customers?.find(c => c && c.id === state.saleOrders[0].customerId)?.contactPerson || 'N/A',
        shipping_address: state.saleOrders[0].shippingAddress || 'Factory Gate, Industrial Estate'
      } : null,
      planning_history: state.productionPlans?.[0] || null,
      bom_master: state.boms?.[0] || null,
      batch_closing_history: state.productionOutputs?.[0] || null,
      delivery_challan: (state.deliveries && state.deliveries[0]) ? {
        ...state.deliveries[0],
        customer: state.deliveries[0].customerName || 'Consignee Party',
        contact: state.deliveries[0].consignee?.contactNumber || 'N/A',
        shipping_address: state.deliveries[0].consignee?.deliveryAddress || state.deliveries[0].consignee?.address || 'Site Delivery',
        items: Array.isArray(state.deliveries[0].items) ? state.deliveries[0].items : []
      } : null,
      inventory_ledger: (state.items && state.items[0]) ? {
        id: 'INV-LEDGER-01',
        date: new Date().toISOString(),
        department: state.items[0].department || 'Raw Material Department',
        items: (state.items || []).slice(0, 15).map((it, idx) => ({
          serial_no: idx + 1,
          item_code: it?.itemCode || it?.sku || `ITEM-${idx + 1}`,
          item_name: it?.name || it?.description || 'Inventory Item',
          category: it?.category || 'General',
          department: it?.department || 'Warehouse',
          stock_level: it?.stockLevel || it?.quantity || 0,
          rolls: it?.rolls || '-',
          uom: it?.uom || 'Meters'
        }))
      } : null,
      inventory_adjustment: (state.inventoryAdjustments || state.adjustments)?.[0] || null,
      inventory_return: state.returns?.[0] || null,
      purchase_demand: state.purchaseDemands?.[0] || null,
      purchase_order: state.purchaseOrders?.[0] || null,
      inward_gate_pass: state.gatePassActivities?.[0] || null,
      grn_note: state.approvals?.find(a => a && a.type === 'GRN Log') || state.stockReceiving?.[0] || null,
      sale_invoice: state.salesInvoices?.[0] || null,
      purchase_invoice: state.purchaseInvoices?.[0] || null,
      voucher_receipt: state.paymentVouchers?.[0] || null,
      voucher_payment: state.paymentVouchers?.[0] || null,
      voucher_journal: state.paymentVouchers?.[0] || null,
      hr_payslip: state.hr_generated_salaries?.[0] || null,
      hr_overtime_request: state.hr_overtime_requests?.[0] || null,
      hr_leave_request: state.hr_leave_requests?.[0] || null,
      hr_loan_request: state.hr_loan_requests?.[0] || null
    };
    return map[docType] || null;
  } catch (e) {
    console.warn('Error in getSampleRecordFromState:', e);
    return null;
  }
}

export function discoverDocumentSchema(docType, sampleRecord = null, existingLayout = null, state = null) {
  const baseSchema = existingLayout || DEFAULT_DOCUMENT_SCHEMAS[docType] || DEFAULT_LAYOUT_SETTINGS;
  let record = sampleRecord;
  if ((!record || typeof record !== 'object') && state) {
    try {
      record = getSampleRecordFromState(docType, state);
    } catch (e) {
      record = null;
    }
  }
  if (!record || typeof record !== 'object') {
    try {
      record = getMockPreviewData(docType);
    } catch (e) {
      record = null;
    }
  }
  if (!record || typeof record !== 'object' || record === null) {
    return baseSchema || DEFAULT_LAYOUT_SETTINGS;
  }

  const discoveredHeaderFields = [...((baseSchema && baseSchema.headerFields) || [])];
  const discoveredColumns = [...((baseSchema && baseSchema.gridColumns) || [])];

  // Inspect resolved record keys for new header fields
  if (record && typeof record === 'object' && record !== null && !Array.isArray(record)) {
    try {
      Object.keys(record).forEach((key) => {
        if (!key || key === 'items' || key === 'lineItems' || key === 'rows' || Array.isArray(record[key])) {
          return; // line items array handled separately below
        }

        const exists = discoveredHeaderFields.some((f) => f && f.key === key);
        if (!exists && typeof record[key] !== 'object' && record[key] !== null && record[key] !== undefined) {
          const formattedLabel = String(key).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
          discoveredHeaderFields.push({
            key,
            label: formattedLabel,
            enabled: true,
            width: 'span-1'
          });
        }
      });
    } catch (e) {
      console.warn('Error reading record keys in discoverDocumentSchema:', e);
    }

    // Inspect line items array for new table columns
    try {
      const lineItems = record.items || record.lineItems || record.rows || [];
      if (Array.isArray(lineItems) && lineItems.length > 0) {
        const itemSample = lineItems[0];
        if (itemSample && typeof itemSample === 'object' && itemSample !== null && !Array.isArray(itemSample)) {
          Object.keys(itemSample).forEach((colKey) => {
            const colExists = discoveredColumns.some((c) => c && c.key === colKey);
            if (!colExists && typeof itemSample[colKey] !== 'object' && itemSample[colKey] !== null && itemSample[colKey] !== undefined) {
              const formattedLabel = String(colKey).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
              discoveredColumns.push({
                key: colKey,
                label: formattedLabel,
                enabled: true,
                width: '12%',
                align: typeof itemSample[colKey] === 'number' ? 'right' : 'left'
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('Error reading itemSample keys in discoverDocumentSchema:', e);
    }
  }

  return {
    ...(baseSchema || DEFAULT_LAYOUT_SETTINGS),
    headerFields: discoveredHeaderFields,
    gridColumns: discoveredColumns
  };
}

// Generate Realistic Mock Data for Live Paper Preview across all 26 document types
export function getMockPreviewData(docType) {
  const commonHeader = {
    company: 'FLASHVISION',
    address: 'Plot 42-B, Industrial Zone Phase III, Karachi, Pakistan',
    phone: '+92-21-34567890',
    email: 'info@flashvision.com'
  };

  switch (docType) {
    case 'sale_order':
      return {
        header: {
          ...commonHeader,
          so_number: 'SO-2026-081',
          date: '2026-07-27',
          status: 'Approved',
          customer: 'Al-Haq Enterprises',
          contact: 'Ahmed Ali (+92-300-1234567)',
          shipping_address: 'Warehouse #B-4, Industrial Area, Lahore',
          salesperson: 'Sara Khan',
          payment_terms: 'Net 30 Days',
          delivery_date: '2026-08-10'
        },
        items: [
          { serial_no: '1', item_code: 'FG-WC-001', item_name: 'Synthetic Winter Coat Fabric', qty: 1500, uom: 'Meters', rate: 10.0, discount: '5%', sub_total: 14250.0 },
          { serial_no: '2', item_code: 'RM-PS-120', item_name: 'Polyester Silk 120g Yarn', qty: 1000, uom: 'kg', rate: 4.5, discount: '0%', sub_total: 4500.0 },
          { serial_no: '3', item_code: 'RM-CB-080', item_name: 'Cotton Blend 80g Fabric', qty: 2000, uom: 'Meters', rate: 3.5, discount: '2%', sub_total: 6860.0 }
        ],
        totals: { subtotal: 25610.0, tax: 4609.8, discount: 1250.0, grandTotal: 28969.8 }
      };

    case 'production_plan':
      return {
        header: {
          ...commonHeader,
          plan_id: 'PLN-2026-0142',
          date: '2026-10-26',
          status: 'In Process',
          created_by: 'System Admin'
        },
        items: [
          { sr_no: 1, order_date: '24/10/2026', customer_name: 'NADEEM LEATHER STORE', item_name: '170 PK DTY BLACK (BLACK)', order_m: 1500, status: 'PENDING' },
          { sr_no: 2, order_date: '22/10/2026', customer_name: 'IMRAN LEATHER', item_name: '106 SHINE MISMA REGULAR BROWN (PC BLACK)', order_m: 1000, status: 'PENDING' },
          { sr_no: 3, order_date: '22/10/2026', customer_name: 'IMRAN LEATHER', item_name: '106 S PK COLLAR CREAM (PC WHITE)', order_m: 1000, status: 'IN PROCESS' }
        ],
        totals: { order_m: 3500 }
      };

    case 'pending_orders':
      return {
        header: {
          ...commonHeader,
          report_date: '24/10/2026',
          status_filter: 'Pending',
          total_orders: 3,
          total_meters: '4,500'
        },
        items: [
          { sr_no: 1, order_date: '24/10/2026', order_id: 'SO-011', customer_name: 'NADEEM LEATHER STORE', item_name: '170 PK DTY BLACK (BLACK)', order_m: 2000, produced_m: 0, status: 'PENDING', _group: 'NADEEM LEATHER STORE' },
          { sr_no: 2, order_date: '24/10/2026', order_id: 'SO-012', customer_name: 'NADEEM LEATHER STORE', item_name: '170 PK DTY NO:10 PINK (WHITE)', order_m: 2000, produced_m: 0, status: 'PENDING', _group: 'NADEEM LEATHER STORE' },
          { sr_no: 3, order_date: '23/10/2026', order_id: 'SO-009', customer_name: 'IMRAN LEATHER', item_name: '106 SHINE MISMA REGULAR BLACK (PC BLACK)', order_m: 500, produced_m: 0, status: 'PENDING', _group: 'IMRAN LEATHER' }
        ],
        totals: { order_m: 4500, produced_m: 0 }
      };

    case 'general_ledger':
      return {
        docSub: 'DOUBLE-ENTRY ACCOUNTING BOOK',
        header: {
          ...commonHeader,
          account: 'All Accounts (Consolidated)',
          period: '01/10/2026 – 25/10/2026',
          voucher_type: 'All Voucher Types',
          party: 'All',
          generated_on: '25/10/2026'
        },
        items: [
          { entry_date: '20/10/2026', voucher: 'Sales Invoice INV-2026-031', account: '113010 — Accounts Receivable', party: 'NADEEM LEATHER STORE', narration: 'Sale of 170 PK DTY BLACK (BLACK) — 1,500 m', debit: 285000, credit: 0, balance: '285,000.00 Dr' },
          { entry_date: '22/10/2026', voucher: 'Bank Payment Voucher PVR-2026-014', account: '112010 — Bank Account', party: 'Apex Chemicals Ltd.', narration: 'Payment against Purchase Invoice PINV-2026-009', debit: 0, credit: 120000, balance: '165,000.00 Dr' },
          { entry_date: '24/10/2026', voucher: 'Journal Voucher JV-2026-007', account: '521010 — Executive & Admin Management Salaries', party: 'Staff Payroll', narration: 'October 2026 salary accrual — Admin department', debit: 45000, credit: 0, balance: '210,000.00 Dr' }
        ],
        totals: { debit: 330000, credit: 120000, balance: '210,000.00 Dr' }
      };

    case 'other_consumptions':
      return {
        header: {
          ...commonHeader,
          ref_no: 'OC-2026-0042',
          date: '2026-10-24',
          cost_center: 'Production Department',
          category: 'Plan PLN-2026-0142'
        },
        items: [
          { item_code: 'RM-091', item_name: 'Diesel (HSD)', qty: 120, uom: 'Liters', unit_price: 282, amount: 33840, remarks: 'Generator fuel' },
          { item_code: 'RM-104', item_name: 'LPG Gas', qty: 45, uom: 'kg', unit_price: 320, amount: 14400, remarks: 'Heating' }
        ],
        totals: { qty: 165, amount: 48240 }
      };

    case 'stock_transfer':
      return {
        header: {
          ...commonHeader,
          transfer_no: 'ST-2026-0018',
          date: '2026-10-24',
          from_warehouse: 'Raw Material Department',
          to_warehouse: 'Production Department',
          status: 'Pending Receipt'
        },
        items: [
          { item_code: 'RM-004', item_name: 'PK DTY BLACK', transfer_qty: 500, uom: 'kg' },
          { item_code: 'RM-003', item_name: 'PC WHITE', transfer_qty: 350, uom: 'kg' },
          { item_code: 'RM-026', item_name: 'Polyester Silk 120g', transfer_qty: 1000, uom: 'Meters' }
        ],
        totals: { transfer_qty: 1850 }
      };

    case 'stock_receiving_history':
      return {
        header: {
          ...commonHeader,
          receiving_no: 'ST-2026-0015',
          date: '2026-10-23',
          supplier: 'Production Department',
          grn_ref: 'ST-2026-0015'
        },
        items: [
          { item_code: 'RM-004', item_name: 'PK DTY BLACK', received_qty: 500, accepted_qty: 500, rejected_qty: 0 },
          { item_code: 'RM-003', item_name: 'PC WHITE', received_qty: 350, accepted_qty: 340, rejected_qty: 10 }
        ],
        totals: { received_qty: 850, accepted_qty: 840, rejected_qty: 10 }
      };

    case 'planning_history':
      return {
        header: {
          ...commonHeader,
          plan_id: 'PLN-2026-042',
          plan_date: '2026-07-25',
          planner_name: 'Muhammad Tariq',
          production_line: 'Line #3 (Weaving)',
          status: 'Active'
        },
        items: [
          { serial_no: '1', order_ref: 'SO-2026-081', item_name: 'Synthetic Winter Coat Fabric', target_qty: 1500, allocated_shift: 'Morning', est_hours: 24 },
          { serial_no: '2', order_ref: 'SO-2026-079', item_name: 'Cotton Blend 80g Fabric', target_qty: 2000, allocated_shift: 'Night', est_hours: 18 }
        ],
        totals: { totalPlannedQty: 3500, totalHours: 42 }
      };

    case 'bom_master':
      return {
        header: {
          ...commonHeader,
          bom_code: 'BOM-FG-001-V2',
          bom_name: 'Winter Coat Outer Layer Master Recipe',
          product_code: 'FG-WC-001',
          version: 'Rev 2.1',
          std_batch_size: '1,000 Meters'
        },
        items: [
          { serial_no: '1', component_code: 'RM-YRN-01', component_name: 'High-Tenacity Nylon Yarn', phase: 'TOP Phase', qty_per_batch: 650, uom: 'kg' },
          { serial_no: '2', component_code: 'RM-DYE-04', component_name: 'Waterproof Polymer Coating Dye', phase: 'FOAM Phase', qty_per_batch: 80, uom: 'Liters' },
          { serial_no: '3', component_code: 'RM-PAK-02', component_name: 'Heavy Duty Plastic Wrap Film', phase: 'Packing', qty_per_batch: 50, uom: 'Rolls' }
        ],
        totals: { batchComponentsCount: 3 }
      };

    case 'master_batch_record':
      // Filled representative batch record (same shape the real builder
      // produces) so the test preview is never a generic mock.
      return buildSampleBatchRecordPrintRecord();

    case 'batch_closing_history':
      return {
        header: {
          ...commonHeader,
          batch_no: 'BATCH-2026-901',
          closing_date: '2026-07-26',
          supervisor: 'Eng. Kamran Raza',
          output_yield_percent: '98.4%'
        },
        items: [
          { serial_no: '1', step_name: 'Yarn Spinning & Conditioning', planned_qty: 1000, actual_output: 990, waste_qty: 10, variance: '-1.0%' },
          { serial_no: '2', step_name: 'Fabric Dyeing & Chemical Wash', planned_qty: 990, actual_output: 984, waste_qty: 6, variance: '-0.6%' }
        ],
        totals: { totalInput: 1000, totalOutput: 984, totalWaste: 16 }
      };

    case 'grn_note':
      return {
        header: {
          ...commonHeader,
          grn_number: 'GRN-2026-0512',
          grn_date: '2026-07-27',
          po_ref: 'PO-2026-019',
          supplier_name: 'Apex Chemicals Ltd.',
          inspector: 'Zaid Mahmood (QA Lead)'
        },
        items: [
          { serial_no: '1', item_code: 'RM-CHEM-10', item_name: 'Industrial Solvent Chemical', ordered_qty: 500, received_qty: 500, accepted_qty: 490, rejected_qty: 10 },
          { serial_no: '2', item_code: 'RM-TH-02', item_name: 'Polyester Thread Spools', ordered_qty: 200, received_qty: 200, accepted_qty: 200, rejected_qty: 0 }
        ],
        totals: { totalReceived: 700, totalAccepted: 690, totalRejected: 10 }
      };

    case 'delivery_challan':
      return {
        header: {
          ...commonHeader,
          challan_no: 'DC-2026-0310',
          dispatch_date: '2026-07-27',
          so_ref: 'SO-2026-081',
          customer_name: 'Al-Haq Enterprises',
          shipping_address: 'Plot 12-A, Industrial Zone, Korangi, Karachi',
          vehicle_no: 'KBL-8921',
          driver_name: 'Shaukat Khan'
        },
        items: [
          { serial_no: '1', item_code: 'FG-WC-001', item_name: 'Synthetic Winter Coat Fabric', dispatch_qty: 1500, packing_type: 'Rolls (30 pcs)', net_weight: '450.0' },
          { serial_no: '2', item_code: 'RM-PS-120', item_name: 'Polyester Silk 120g Yarn', dispatch_qty: 1000, packing_type: 'Bags (20 pcs)', net_weight: '1000.0' }
        ],
        totals: { totalPackages: 50, totalWeight: 1450.0 }
      };

    case 'sale_invoice':
      return {
        header: {
          ...commonHeader,
          invoice_no: 'INV-2026-1049',
          invoice_date: '2026-07-27',
          due_date: '2026-08-26',
          customer_name: 'Premier Textile Corp',
          salesperson: 'Sara Khan',
          billing_address: 'Suite 401, Business Avenue, Clifton, Karachi'
        },
        items: [
          { serial_no: '1', item_code: 'FG-WC-001', item_name: 'Synthetic Winter Coat Fabric', qty: 1000, unit_price: 12.0, tax_rate: '18%', amount: 14160.0 },
          { serial_no: '2', item_code: 'RM-PS-120', item_name: 'Polyester Silk Yarn 120g', qty: 500, unit_price: 5.0, tax_rate: '18%', amount: 2950.0 }
        ],
        totals: { subtotal: 14500.0, tax: 2610.0, discount: 0.0, grandTotal: 17110.0 }
      };

    case 'hr_payslip':
      return {
        header: {
          ...commonHeader,
          payslip_no: 'PAY-2026-07-018',
          pay_period: 'July 2026',
          emp_id: 'EMP-1042',
          emp_name: 'Bilal Hassan',
          designation: 'Senior Production Engineer',
          bank_account: 'PK36MEZN00019283741'
        },
        items: [
          { type: 'Earnings', earnings: 'Basic Salary', earn_amount: 150000.0, ded_amount: 0.0 },
          { type: 'Earnings', earnings: 'House Rent Allowance', earn_amount: 45000.0, ded_amount: 0.0 },
          { type: 'Earnings', earnings: 'Overtime Allowance (14 hrs)', earn_amount: 18500.0, ded_amount: 0.0 },
          { type: 'Deduction', earnings: 'Income Tax (FBR Withholding)', earn_amount: 0.0, ded_amount: 14200.0 },
          { type: 'Deduction', earnings: 'Provident Fund Contribution', earn_amount: 0.0, ded_amount: 7500.0 }
        ],
        totals: { totalEarnings: 213500.0, totalDeductions: 21700.0, grandTotal: 191800.0 }
      };

    case 'hr_overtime_request':
      return {
        header: {
          ...commonHeader,
          ot_id: 'OTR-2026-089',
          emp_id: 'EMP-4091',
          emp_name: 'Elena Rodriguez',
          month_year: 'July 2026',
          department: 'Assembly & Manufacturing',
          work_date: '2026-07-28',
          hours: '2.00 hrs',
          status: 'Approved'
        },
        items: [
          { serial_no: '1', work_date: '2026-07-28', hours: '2.00', rate_multiplier: '1.5x (Regular)', task_description: 'Urgent assembly line recalibration for Batch-72 and raw materials checks' }
        ],
        totals: { totalHours: '2.00 hrs' }
      };

    case 'hr_loan_request':
      return {
        header: {
          ...commonHeader,
          request_id: 'LR-2026-9921',
          date_applied: '2026-07-28',
          employee_id: 'EMP-2024-8841',
          employee_name: 'Ahmed Khan',
          department: 'Operations',
          loan_type: 'Personal Loan',
          loan_amount: '50,000.00',
          repayment_term: '12 Months',
          monthly_installment: '4,166.67',
          repayment_start_date: 'August 1, 2026'
        },
        items: [
          { month_no: '1', due_date: 'August 2026', installment_amount: '4,166.67', status: 'Scheduled' },
          { month_no: '2', due_date: 'September 2026', installment_amount: '4,166.67', status: 'Scheduled' },
          { month_no: '3', due_date: 'October 2026', installment_amount: '4,166.67', status: 'Scheduled' }
        ],
        totals: { totalLoanAmount: '50,000.00', totalInstallments: 12, monthlyDeduction: '4,166.67' }
      };

    case 'hr_advance_request':
      return {
        header: {
          ...commonHeader,
          request_id: 'ADV-S-2026-001',
          date_applied: '2026-07-29',
          employee_id: 'EMP-304',
          employee_name: 'Umer Ali',
          department: 'Operations',
          advance_amount: '122,500.00',
          deduction_month: 'August 2026'
        },
        items: [
          { serial_no: '1', recovery_month: 'August 2026 Payroll', deduction_amount: '122,500.00' }
        ],
        totals: { grandTotal: 122500 }
      };

    default:
      // Generic mock fallback for all other documents
      return {
        header: {
          ...commonHeader,
          ref_no: `${docType.toUpperCase()}-2026-001`,
          date: '2026-07-27',
          status: 'Confirmed',
          party_name: 'Sample Entity / Customer'
        },
        items: [
          { serial_no: '1', item_code: 'ITEM-001', item_name: 'Standard ERP Line Item 1', qty: 100, uom: 'Units', rate: 25.0, sub_total: 2500.0 },
          { serial_no: '2', item_code: 'ITEM-002', item_name: 'Standard ERP Line Item 2', qty: 50, uom: 'Units', rate: 40.0, sub_total: 2000.0 }
        ],
        totals: { subtotal: 4500.0, tax: 810.0, grandTotal: 5310.0 }
      };
  }
}
