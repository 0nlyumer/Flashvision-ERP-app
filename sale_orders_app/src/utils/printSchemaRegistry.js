import { getDefaultThemeForDoc, CURATED_PALETTES } from './printThemeEngine';

// Comprehensive Print Schema Registry for FlashVision ERP System Documents

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

  // 2. Production Module
  { id: 'bom_master', name: 'BOM Master', module: 'production', icon: 'account_tree', code: 'BOM' },
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
  { id: 'hr_payslip', name: 'Salary Generation / Payslip', module: 'hr', icon: 'payments', code: 'PAY' },
  { id: 'attendance_sheet', name: 'Biometric Attendance Audit', module: 'hr', icon: 'fingerprint', code: 'ATT' }
];

export const DEFAULT_LAYOUT_SETTINGS = {
  paperSize: 'A4', // A4, Letter, Thermal, A5, Legal
  orientation: 'portrait',
  activeTheme: 'classic', // 'classic' | 'modern' | 'industrial'
  paletteId: 'navy_enterprise',
  headerTheme: 'classic_split',
  primaryColor: '#004277',
  fontFamily: 'Inter',
  headerFontSize: '20px',
  bodyFontSize: '11px',
  tableHeaderBgColor: '#004277',
  tableHeaderTextColor: '#ffffff',
  // Manufacturing Floor Extras
  enableFloorCheckboxes: false,
  showMachineAllocation: false,
  showBatchYieldBlock: false,
  inkSaverMode: false,
  logoSize: 'medium',
  logoPosition: 'left',
  showBarcode: true,
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

  bom_master: {
    ...DEFAULT_LAYOUT_SETTINGS,
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
    ...DEFAULT_LAYOUT_SETTINGS,
    headerFields: [
      { key: 'mbr_no', label: 'MBR Code', enabled: true, width: 'span-1' },
      { key: 'product_name', label: 'Product Name', enabled: true, width: 'span-2' },
      { key: 'batch_size', label: 'Target Batch Size', enabled: true, width: 'span-1' },
      { key: 'qa_sign', label: 'QA Clear Code', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'step_no', label: 'Step #', enabled: true, width: '10%', align: 'center' },
      { key: 'operation', label: 'Operation Name', enabled: true, width: '30%', align: 'left' },
      { key: 'parameters', label: 'Standard Parameters', enabled: true, width: '30%', align: 'left' },
      { key: 'spec_limit', label: 'Specification Limit', enabled: true, width: '15%', align: 'center' },
      { key: 'sign_off', label: 'Operator Sign', enabled: true, width: '15%', align: 'center' }
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
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_name', label: 'Material / Chemical Name', enabled: true, width: '42%', align: 'left' },
      { key: 'qty', label: 'Qty Used', enabled: true, width: '16%', align: 'right' },
      { key: 'uom', label: 'UOM', enabled: true, width: '14%', align: 'center' },
      { key: 'remarks', label: 'Remarks / Purpose', enabled: true, width: '20%', align: 'left' }
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
      { key: 'to_warehouse', label: 'Destination Warehouse', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '8%', align: 'center' },
      { key: 'item_code', label: 'Item Code', enabled: true, width: '22%', align: 'left' },
      { key: 'item_name', label: 'Item Description', enabled: true, width: '38%', align: 'left' },
      { key: 'transfer_qty', label: 'Transfer Qty', enabled: true, width: '16%', align: 'right' },
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
  },

  attendance_sheet: {
    ...DEFAULT_LAYOUT_SETTINGS,
    activeTheme: 'industrial',
    paletteId: 'industrial_steel',
    enableFloorCheckboxes: true,
    headerFields: [
      { key: 'report_title', label: 'Report Title', enabled: true, width: 'span-2' },
      { key: 'department', label: 'Target Department', enabled: true, width: 'span-1' },
      { key: 'date_range', label: 'Audit Period', enabled: true, width: 'span-1' },
      { key: 'generated_on', label: 'Generated At', enabled: true, width: 'span-1' },
      { key: 'operator', label: 'Shift Supervisor', enabled: true, width: 'span-1' }
    ],
    gridColumns: [
      { key: 'serial_no', label: 'Sr #', enabled: true, width: '6%', align: 'center' },
      { key: 'emp_code', label: 'Badge Code', enabled: true, width: '12%', align: 'left' },
      { key: 'emp_name', label: 'Employee Name', enabled: true, width: '22%', align: 'left' },
      { key: 'department', label: 'Department', enabled: true, width: '14%', align: 'left' },
      { key: 'date', label: 'Punch Date', enabled: true, width: '12%', align: 'center' },
      { key: 'clock_in', label: 'Clock IN', enabled: true, width: '11%', align: 'center' },
      { key: 'clock_out', label: 'Clock OUT', enabled: true, width: '11%', align: 'center' },
      { key: 'duration', label: 'Duration', enabled: true, width: '12%', align: 'right' }
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
  if (!state) return null;
  const map = {
    sale_order: state.saleOrders?.[0] ? {
      ...state.saleOrders[0],
      customer: state.customers?.find(c => c.id === state.saleOrders[0].customerId)?.name || state.saleOrders[0].customerName || 'Customer',
      contact: state.customers?.find(c => c.id === state.saleOrders[0].customerId)?.contactPerson || 'N/A',
      shipping_address: state.saleOrders[0].shippingAddress || 'Factory Gate, Industrial Estate'
    } : null,
    planning_history: state.productionPlans?.[0],
    bom_master: state.boms?.[0],
    batch_closing_history: state.productionOutputs?.[0],
    delivery_challan: state.deliveries?.[0] ? {
      ...state.deliveries[0],
      customer: state.deliveries[0].customerName || 'Consignee Party',
      contact: state.deliveries[0].consignee?.contactNumber || 'N/A',
      shipping_address: state.deliveries[0].consignee?.address || 'Site Delivery',
      items: state.deliveries[0].items || []
    } : null,
    inventory_ledger: state.items?.[0] ? {
      id: 'INV-LEDGER-01',
      date: new Date().toISOString(),
      department: state.items[0].department || 'Raw Material Department',
      items: (state.items || []).slice(0, 15).map((it, idx) => ({
        serial_no: idx + 1,
        item_code: it.itemCode || it.sku || `ITEM-${idx + 1}`,
        item_name: it.name || it.description || 'Inventory Item',
        category: it.category || 'General',
        department: it.department || 'Warehouse',
        stock_level: it.stockLevel || it.quantity || 0,
        rolls: it.rolls || '-',
        uom: it.uom || 'Meters'
      }))
    } : null,
    inventory_adjustment: (state.inventoryAdjustments || state.adjustments)?.[0],
    inventory_return: state.returns?.[0],
    purchase_demand: state.purchaseDemands?.[0],
    purchase_order: state.purchaseOrders?.[0],
    inward_gate_pass: state.gatePassActivities?.[0],
    grn_note: state.approvals?.find(a => a.type === 'GRN Log') || state.stockReceiving?.[0],
    sale_invoice: state.salesInvoices?.[0],
    purchase_invoice: state.purchaseInvoices?.[0],
    voucher_receipt: state.paymentVouchers?.[0],
    voucher_payment: state.paymentVouchers?.[0],
    voucher_journal: state.paymentVouchers?.[0],
    hr_payslip: state.hr_generated_salaries?.[0],
    hr_overtime_request: state.hr_overtime_requests?.[0],
    hr_leave_request: state.hr_leave_requests?.[0],
    hr_loan_request: state.hr_loan_requests?.[0],
    attendance_sheet: state.attendanceRecords?.[0] || state.hr_attendance?.[0] || null
  };
  return map[docType] || null;
}

export function discoverDocumentSchema(docType, sampleRecord = null, existingLayout = null, state = null) {
  const baseSchema = existingLayout || DEFAULT_DOCUMENT_SCHEMAS[docType] || DEFAULT_LAYOUT_SETTINGS;
  let record = sampleRecord;
  if ((!record || typeof record !== 'object') && state) {
    record = getSampleRecordFromState(docType, state);
  }
  if (!record || typeof record !== 'object') {
    record = getMockPreviewData(docType);
  }
  if (!record || typeof record !== 'object') {
    return baseSchema;
  }

  const discoveredHeaderFields = [...(baseSchema.headerFields || [])];
  const discoveredColumns = [...(baseSchema.gridColumns || [])];

  // Inspect resolved record keys for new header fields
  if (record && typeof record === 'object') {
    Object.keys(record).forEach((key) => {
      if (key === 'items' || key === 'lineItems' || key === 'rows' || Array.isArray(record[key])) {
        return; // line items array handled separately below
      }

      const exists = discoveredHeaderFields.some((f) => f.key === key);
      if (!exists && typeof record[key] !== 'object' && record[key] !== null && record[key] !== undefined) {
        const formattedLabel = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        discoveredHeaderFields.push({
          key,
          label: formattedLabel,
          enabled: true,
          width: 'span-1'
        });
      }
    });

    // Inspect line items array for new table columns
    const lineItems = record.items || record.lineItems || record.rows || [];
    if (Array.isArray(lineItems) && lineItems.length > 0) {
      const itemSample = lineItems[0];
      if (itemSample && typeof itemSample === 'object') {
        Object.keys(itemSample).forEach((colKey) => {
          const colExists = discoveredColumns.some((c) => c.key === colKey);
          if (!colExists && typeof itemSample[colKey] !== 'object') {
            const formattedLabel = colKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
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
  }

  return {
    ...baseSchema,
    headerFields: discoveredHeaderFields,
    gridColumns: discoveredColumns
  };
}

// Generate Realistic Enterprise Mock Data for Live Paper Preview across ALL 33 document types
export function getMockPreviewData(docType) {
  const commonHeader = {
    company: 'FLASHVISION LOGISTICS & ENTERPRISE ERP',
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
          { serial_no: '1', item_code: 'FG-WC-001', item_name: 'Synthetic Winter Coat Fabric', rolls: '30', qty: 1500, uom: 'Meters', rate: 10.0, discount: '5%', sub_total: 14250.0 },
          { serial_no: '2', item_code: 'RM-PS-120', item_name: 'Polyester Silk 120g Yarn', rolls: '20', qty: 1000, uom: 'kg', rate: 4.5, discount: '0%', sub_total: 4500.0 },
          { serial_no: '3', item_code: 'RM-CB-080', item_name: 'Cotton Blend 80g Fabric', rolls: '40', qty: 2000, uom: 'Meters', rate: 3.5, discount: '2%', sub_total: 6860.0 }
        ],
        totals: { subtotal: 25610.0, tax: 4609.8, discount: 1250.0, grandTotal: 28969.8 }
      };

    case 'planning_history':
      return {
        header: {
          ...commonHeader,
          plan_id: 'PLN-2026-042',
          plan_date: '2026-07-25',
          planner_name: 'Muhammad Tariq',
          production_line: 'Line #3 (Weaving Loom)',
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

    case 'master_batch_record':
      return {
        header: {
          ...commonHeader,
          mbr_no: 'MBR-FG-001-B902',
          product_name: 'High-Tenacity Industrial Synthetic Fabric',
          batch_size: '2,500 Meters',
          qa_sign: 'QA-PASSED-CERT-992'
        },
        items: [
          { step_no: '1', operation: 'Raw Material Dispensing & Verification', parameters: 'High-Tenacity Yarn 1,625 kg, Dye 200L', spec_limit: '±0.5% Tolerance', sign_off: 'OP: Tariq (08:30)' },
          { step_no: '2', operation: 'Loom Beam Loading & Tension Calibration', parameters: 'Tension 45 N/cm, Speed 650 RPM', spec_limit: '42 - 48 N/cm', sign_off: 'OP: Tariq (10:15)' },
          { step_no: '3', operation: 'Polymer Waterproof Coating Application', parameters: 'Coating Temp 145°C, Viscosity 2800 cP', spec_limit: '140°C - 150°C', sign_off: 'CHEM: Raza (13:00)' },
          { step_no: '4', operation: 'Curing & High-Speed Heat Setting', parameters: 'Chamber Dwell Time 45s, Temp 180°C', spec_limit: '175°C - 185°C', sign_off: 'ENG: Kamran (15:20)' },
          { step_no: '5', operation: 'Finished Fabric Inspection & QC Rolling', parameters: 'Defect Density < 2 points/100m', spec_limit: 'Grade A Export', sign_off: 'QC: Zaid (17:00)' }
        ],
        totals: { totalSteps: 5, massBalanceEfficiency: '98.8%', standardRunHours: '8.5 hrs' }
      };

    case 'inventory_ledger':
      return {
        header: {
          ...commonHeader,
          ledger_id: 'IVL-TEX-2026',
          period: '01-Jul-2026 to 31-Jul-2026',
          warehouse: 'Central Raw Material Store (Store #2)',
          item_name: 'Polyester Silk 120g Yarn (RM-PS-120)'
        },
        items: [
          { date: '2026-07-01', ref_no: 'OPN-BAL', item_name: 'Opening Balance Carried Forward', qty_in: '-', qty_out: '-', balance: 12500 },
          { date: '2026-07-05', ref_no: 'GRN-2026-0512', item_name: 'Import Consignment - Apex Ltd', qty_in: 5000, qty_out: '-', balance: 17500 },
          { date: '2026-07-12', ref_no: 'ISS-BATCH-901', item_name: 'Production Issue - Weaving Line #3', qty_in: '-', qty_out: 4200, balance: 13300 },
          { date: '2026-07-18', ref_no: 'ADJ-2026-019', item_name: 'Physical Audit Weight Recalibration', qty_in: '-', qty_out: 50, balance: 13250 },
          { date: '2026-07-26', ref_no: 'DC-2026-0310', item_name: 'Direct Dispatch Consignee', qty_in: '-', qty_out: 1000, balance: 12250 }
        ],
        totals: { totalInward: 5000, totalOutward: 5250, closingBalance: 12250 }
      };

    case 'attendance_sheet':
      return {
        header: {
          ...commonHeader,
          report_title: 'FACTORY WORKFORCE BIOMETRIC ATTENDANCE AUDIT',
          department: 'Weaving & Dyeing Operations',
          date_range: '10-Oct-2026 to 16-Oct-2026',
          generated_on: '2026-10-16 11:30 AM',
          operator: 'Rashid Mehmood (Shift Lead)'
        },
        items: [
          { serial_no: '1', emp_code: 'EMP-1042', emp_name: 'Bilal Hassan', department: 'Weaving', date: '2026-10-16', clock_in: '07:55 AM', clock_out: '04:15 PM', duration: '8.33 hrs', status: 'Present' },
          { serial_no: '2', emp_code: 'EMP-2089', emp_name: 'Elena Rodriguez', department: 'Assembly', date: '2026-10-16', clock_in: '08:02 AM', clock_out: '05:00 PM', duration: '8.96 hrs', status: 'Present (OT)' },
          { serial_no: '3', emp_code: 'EMP-3041', emp_name: 'Kashif Ali', department: 'Spinning', date: '2026-10-16', clock_in: '07:48 AM', clock_out: '04:05 PM', duration: '8.28 hrs', status: 'Present' },
          { serial_no: '4', emp_code: 'EMP-4105', emp_name: 'Zubair Ahmed', department: 'Maintenance', date: '2026-10-16', clock_in: '08:15 AM', clock_out: '04:30 PM', duration: '8.25 hrs', status: 'Grace Period' }
        ],
        totals: { totalEmp: 48, totalPunches: 96, presentCount: 46, completedCount: 44, totalHours: '394.5 hrs' }
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

    case 'purchase_order':
      return {
        header: {
          ...commonHeader,
          po_number: 'PO-2026-0941',
          po_date: '2026-07-25',
          supplier_name: 'Orient Chemical Industries Ltd',
          payment_terms: 'Net 45 Days',
          delivery_location: 'Central Plant Dock 4, Karachi'
        },
        items: [
          { serial_no: '1', item_code: 'RM-CHEM-10', item_name: 'Industrial Solvent Chemical Grade A', qty: 500, unit_price: 18.5, tax: '18%', amount: 10915.0 },
          { serial_no: '2', item_code: 'RM-YRN-01', item_name: 'High-Tenacity Nylon Yarn 240D', qty: 1200, unit_price: 6.2, tax: '18%', amount: 8779.2 }
        ],
        totals: { subtotal: 16690.0, taxAmount: 3004.2, grandTotal: 19694.2 }
      };

    case 'purchase_demand':
      return {
        header: {
          ...commonHeader,
          pr_no: 'PRD-2026-118',
          date: '2026-07-24',
          requestor: 'Eng. Kamran Raza (Plant Manager)',
          priority: 'Urgent Priority'
        },
        items: [
          { serial_no: '1', item_code: 'SP-BEAR-04', item_name: 'High-Precision Loom Bearings SKF-6205', required_qty: 12, needed_by: '2026-07-30' },
          { serial_no: '2', item_code: 'RM-DYE-04', item_name: 'Waterproof Polymer Coating Dye Resin', required_qty: 250, needed_by: '2026-08-02' }
        ],
        totals: { totalRequestedItems: 2 }
      };

    case 'inward_gate_pass':
      return {
        header: {
          ...commonHeader,
          gate_pass_no: 'IGP-2026-4402',
          entry_time: '2026-07-27 09:45 AM',
          driver_name: 'Shaukat Khan (CNIC: 42101-9876543-1)',
          vehicle_no: 'TK-8921 (10-Wheeler Truck)',
          supplier: 'Orient Chemical Industries Ltd'
        },
        items: [
          { serial_no: '1', item_description: 'Industrial Solvent Drums (200L each)', chalan_qty: 15, no_of_packages: '15 Drums', weight: 3450.0 },
          { serial_no: '2', item_description: 'Nylon Yarn Spools Palletized', chalan_qty: 40, no_of_packages: '4 Pallets', weight: 2200.0 }
        ],
        totals: { totalPackages: 19, grossWeight: '5,650 kg' }
      };

    case 'stock_transfer':
      return {
        header: {
          ...commonHeader,
          transfer_no: 'STF-2026-088',
          date: '2026-07-26',
          from_warehouse: 'Raw Material Store (Main Plant)',
          to_warehouse: 'Weaving Sub-Store (Line #3)'
        },
        items: [
          { serial_no: '1', item_code: 'RM-YRN-01', item_name: 'High-Tenacity Nylon Yarn 240D', transfer_qty: 650, uom: 'kg' },
          { serial_no: '2', item_code: 'RM-DYE-04', item_name: 'Waterproof Polymer Coating Dye', transfer_qty: 80, uom: 'Liters' }
        ],
        totals: { totalTransferQty: 730 }
      };

    case 'inventory_return':
      return {
        header: {
          ...commonHeader,
          return_no: 'IRT-2026-031',
          date: '2026-07-27',
          party_name: 'National Textiles Ltd',
          reason: 'Defective Selvedge / Shade Variance'
        },
        items: [
          { serial_no: '1', item_code: 'FG-WC-001', item_name: 'Synthetic Winter Coat Fabric', inv_qty: 500, returned_qty: 50, unit_price: 10.0 }
        ],
        totals: { totalReturnedQty: 50, totalReturnValue: 500.0 }
      };

    case 'inventory_adjustment':
      return {
        header: {
          ...commonHeader,
          adj_id: 'ADJ-2026-049',
          date: '2026-07-26',
          approved_by: 'Zaid Mahmood (Chief Stock Auditor)',
          reason: 'Quarterly Physical Count Variance'
        },
        items: [
          { serial_no: '1', item_code: 'RM-YRN-01', item_name: 'High-Tenacity Nylon Yarn', system_qty: 1200, physical_qty: 1185, adj_qty: -15 },
          { serial_no: '2', item_code: 'RM-PAK-02', item_name: 'Heavy Duty Plastic Wrap Film', system_qty: 45, physical_qty: 50, adj_qty: 5 }
        ],
        totals: { totalVariance: '-10 Units Net' }
      };

    case 'stock_demand':
      return {
        header: {
          ...commonHeader,
          demand_no: 'SKD-2026-204',
          date: '2026-07-27',
          from_dept: 'Weaving Section (Line #3)',
          to_store: 'Central Chemical & Yarn Store'
        },
        items: [
          { serial_no: '1', item_code: 'RM-YRN-01', item_name: 'High-Tenacity Nylon Yarn', demanded_qty: 500, uom: 'kg' },
          { serial_no: '2', item_code: 'RM-TH-02', item_name: 'Polyester Thread Spools', demanded_qty: 50, uom: 'Spools' }
        ],
        totals: { totalDemandedItems: 550 }
      };

    case 'other_consumptions':
      return {
        header: {
          ...commonHeader,
          ref_no: 'OTC-2026-092',
          date: '2026-07-26',
          cost_center: 'CC-DYEING-01',
          category: 'General Chemical & Lubricant'
        },
        items: [
          { serial_no: '1', item_name: 'Machine Synthetic Lubricant ISO-68', qty: 25, uom: 'Liters', remarks: 'Routine 250hr maintenance Line 3' },
          { serial_no: '2', item_name: 'Equipment Degreaser Solvent', qty: 10, uom: 'Cans', remarks: 'Roll cleaner wash' }
        ],
        totals: { totalConsumedQty: 35 }
      };

    case 'purchase_invoice':
      return {
        header: {
          ...commonHeader,
          bill_no: 'PINV-2026-892',
          bill_date: '2026-07-25',
          po_ref: 'PO-2026-019',
          supplier_name: 'Apex Chemicals Ltd',
          payment_status: 'Pending Verification'
        },
        items: [
          { serial_no: '1', item_code: 'RM-CHEM-10', item_name: 'Industrial Solvent Chemical', qty: 500, unit_rate: 18.0, total_amount: 9000.0 },
          { serial_no: '2', item_code: 'RM-TH-02', item_name: 'Polyester Thread Spools', qty: 200, unit_rate: 4.5, total_amount: 900.0 }
        ],
        totals: { subtotal: 9900.0, tax: 1782.0, netPayable: 11682.0 }
      };

    case 'chart_of_accounts':
      return {
        header: {
          ...commonHeader,
          report_title: 'GENERAL LEDGER CHART OF ACCOUNTS AUDIT',
          print_date: '2026-07-27',
          filtered_by: 'All Active Balance Sheet Accounts'
        },
        items: [
          { account_code: '1000-01', account_name: 'Meezan Bank Operations Account', type: 'Current Asset', current_balance: 4520000.0 },
          { account_code: '1100-02', account_name: 'Accounts Receivable (Trade Debtors)', type: 'Current Asset', current_balance: 8940500.0 },
          { account_code: '1200-01', account_name: 'Raw Material Inventory Valuation', type: 'Current Asset', current_balance: 14250000.0 },
          { account_code: '2000-01', account_name: 'Accounts Payable (Trade Creditors)', type: 'Current Liability', current_balance: 6120000.0 }
        ],
        totals: { totalDebitBalance: 27710500.0, totalCreditBalance: 6120000.0 }
      };

    case 'tax_ledger_reports':
      return {
        header: {
          ...commonHeader,
          tax_period: 'July 2026 Tax Return',
          ntn_number: 'NTN: 8923410-7 (FBR)',
          generated_on: '2026-07-27'
        },
        items: [
          { date: '2026-07-10', voucher_no: 'INV-2026-1042', party_name: 'Premier Textile Corp', taxable_val: 125000.0, tax_amount: 22500.0 },
          { date: '2026-07-18', voucher_no: 'INV-2026-1045', party_name: 'Al-Haq Enterprises', taxable_val: 84000.0, tax_amount: 15120.0 }
        ],
        totals: { totalTaxableValue: 209000.0, totalTaxCollected: 37620.0 }
      };

    case 'voucher_receipt':
      return {
        header: {
          ...commonHeader,
          voucher_no: 'RV-2026-0412',
          date: '2026-07-26',
          received_from: 'Al-Haq Enterprises (Customer #CU-081)',
          payment_mode: 'Crossed Cheque / Bank Transfer'
        },
        items: [
          { serial_no: '1', account_head: '1100-02 Trade Debtors Receivable', narration: 'Advance clearance against Sale Order SO-2026-081', amount: 500000.0 }
        ],
        totals: { totalReceivedAmount: 500000.0 }
      };

    case 'voucher_payment':
      return {
        header: {
          ...commonHeader,
          voucher_no: 'PV-2026-0391',
          date: '2026-07-25',
          paid_to: 'Apex Chemicals Ltd (Vendor #SU-104)',
          cheque_no: 'CHQ-892104 (Meezan Bank)'
        },
        items: [
          { serial_no: '1', account_head: '2000-01 Accounts Payable Creditors', narration: 'Full settlement of Raw Material Invoice PINV-2026-892', amount: 350000.0 }
        ],
        totals: { totalPaidAmount: 350000.0 }
      };

    case 'voucher_journal':
      return {
        header: {
          ...commonHeader,
          voucher_no: 'JV-2026-0182',
          date: '2026-07-27',
          prepared_by: 'M. Faisal (Senior Accountant)',
          notes: 'Monthly depreciation amortization entry for plant equipment'
        },
        items: [
          { serial_no: '1', account_head: '5010-04 Plant Machinery Depreciation Exp', narration: 'Monthly straight-line depreciation allocation', debit: 85000.0, credit: 0.0 },
          { serial_no: '2', account_head: '1500-02 Accumulated Depreciation Loom Plant', narration: 'Contra asset adjustment', debit: 0.0, credit: 85000.0 }
        ],
        totals: { totalDebit: 85000.0, totalCredit: 85000.0 }
      };

    case 'voucher_contra':
      return {
        header: {
          ...commonHeader,
          voucher_no: 'CV-2026-0045',
          date: '2026-07-26',
          bank_account: 'Meezan Bank Main Operating A/C'
        },
        items: [
          { serial_no: '1', account_head: '1000-01 Meezan Bank Current Account', debit: 200000.0, credit: 0.0 },
          { serial_no: '2', account_head: '1000-05 Petty Cash Safe Drawer #1', debit: 0.0, credit: 200000.0 }
        ],
        totals: { totalDebit: 200000.0, totalCredit: 200000.0 }
      };

    case 'hr_onboarding':
      return {
        header: {
          ...commonHeader,
          emp_id: 'EMP-5021',
          emp_name: 'Zaryab Khan',
          designation: 'Assistant Mechanical Engineer',
          department: 'Plant Maintenance',
          joining_date: '2026-08-01'
        },
        items: [
          { step_no: '1', clearance_item: 'CNIC, Degrees & Background Verification', status: 'Verified & Cleared', sign: 'HR: Sara' },
          { step_no: '2', clearance_item: 'Safety Gear (Boots, Helmet, Ear-pro) Handover', status: 'Issued', sign: 'STORE: Tariq' },
          { step_no: '3', clearance_item: 'Biometric Access Enrollment (Flash AM Terminal)', status: 'Fingerprint Enrolled', sign: 'IT: Usman' },
          { step_no: '4', clearance_item: 'Plant Machinery Standard Safety Briefing', status: 'Completed', sign: 'HOD: Kamran' }
        ],
        totals: { stepsCompleted: '4 of 4 Steps Cleared' }
      };

    case 'hr_leave_request':
      return {
        header: {
          ...commonHeader,
          leave_id: 'LR-2026-091',
          emp_name: 'Hamza Farooq',
          department: 'Quality Assurance',
          leave_type: 'Annual Paid Leave',
          duration: '01-Aug-2026 to 05-Aug-2026'
        },
        items: [
          { serial_no: '1', date: '2026-08-01 to 2026-08-05', type: 'Annual Paid Leave (5 Days)', reason: 'Family commitment and travel' }
        ],
        totals: { totalDays: '5 Working Days' }
      };

    case 'stock_receiving_history':
      return {
        header: {
          ...commonHeader,
          receiving_no: 'SRH-2026-302',
          date: '2026-07-27',
          supplier: 'Apex Chemicals Ltd',
          grn_ref: 'GRN-2026-0512'
        },
        items: [
          { serial_no: '1', item_code: 'RM-CHEM-10', item_name: 'Industrial Solvent Chemical', received_qty: 500, accepted_qty: 490, rejected_qty: 10 },
          { serial_no: '2', item_code: 'RM-TH-02', item_name: 'Polyester Thread Spools', received_qty: 200, accepted_qty: 200, rejected_qty: 0 }
        ],
        totals: { totalReceived: 700, totalAccepted: 690, totalRejected: 10 }
      };

    case 'consumption_history':
      return {
        header: {
          ...commonHeader,
          log_id: 'CSH-2026-891',
          date: '2026-07-26',
          batch_no: 'BATCH-2026-901',
          department: 'Weaving Section #3'
        },
        items: [
          { serial_no: '1', material_code: 'RM-YRN-01', material_name: 'High-Tenacity Nylon Yarn', consumed_qty: 650, uom: 'kg' },
          { serial_no: '2', material_code: 'RM-DYE-04', material_name: 'Waterproof Polymer Coating Dye', consumed_qty: 80, uom: 'Liters' }
        ],
        totals: { totalConsumed: 730 }
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
