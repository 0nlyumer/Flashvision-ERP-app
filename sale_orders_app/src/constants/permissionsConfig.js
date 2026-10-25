export const permissionsConfig = {
  dashboard: {
    title: 'Main ERP Dashboard',
    icon: 'dashboard',
    screens: [
      {
        id: 'mainDashboard',
        title: 'Main Dashboard Overview',
        description: 'Access the primary ERP overview, executive metrics, KPI cards, and shortcuts.',
        icon: 'dashboard',
        perms: [
          { id: 'view', label: 'View Dashboard', desc: 'Browse executive metrics, delivery KPIs, and system shortcuts.' }
        ]
      }
    ]
  },
  salesOrders: {
    title: 'Sales Orders',
    icon: 'trending_up',
    screens: [
      {
        id: 'saleOrderList',
        title: 'Order List',
        description: 'Browse, filter, and manage all historical sales orders.',
        icon: 'format_list_bulleted',
        perms: [
          { id: 'view', label: 'View Records', desc: 'Browse and filter all historical orders across the cluster.' },
          { id: 'print', label: 'Print Manifests', desc: 'Export and print PDF shipping documents and labels.' }
        ]
      },
      {
        id: 'createSaleOrder',
        title: 'Create Order',
        description: 'Manual order entry interface and workflow.',
        icon: 'add_box',
        perms: [
          { id: 'create', label: 'Create New Entries', desc: 'Full access to manual order entry interface and workflow.' },
          { id: 'batchUpload', label: 'Batch Upload', desc: 'Import CSV/Excel files for bulk order processing.' }
        ]
      },
      {
        id: 'saleOrderDetails',
        title: 'Order Details',
        description: 'Edit existing orders and line items.',
        icon: 'edit_square',
        perms: [
          { id: 'edit', label: 'Edit Data', desc: 'Modify existing line items or delivery information.' },
          { id: 'delete', label: 'Delete Order', desc: 'Permanent removal of records from the central database.', isError: true }
        ]
      },
      {
        id: 'saleOrderReturn',
        title: 'Sales Return',
        description: 'Process customer returns and credit notes.',
        icon: 'keyboard_return',
        perms: [
          { id: 'view', label: 'View Returns', desc: 'Browse sales return logs and history.' },
          { id: 'create', label: 'Process Return', desc: 'Create and confirm sales return entries.' }
        ]
      }
    ]
  },
  oms: {
    title: 'OMS (Order Management)',
    icon: 'local_shipping',
    screens: [
      {
        id: 'omsDashboard',
        title: 'OMS Dashboard',
        description: 'View unassigned orders and system analytics.',
        icon: 'dashboard',
        perms: [
          { id: 'view', label: 'View Dashboard', desc: 'Access the main OMS dashboard and analytics.' }
        ]
      },
      {
        id: 'productionPlanning',
        title: 'Production Planning',
        description: 'Allocate orders to production.',
        icon: 'precision_manufacturing',
        perms: [
          { id: 'assign', label: 'Plan Production', desc: 'Move orders into production planning.' },
          { id: 'confirm', label: 'Confirm Plan', desc: 'Confirm production plans.' }
        ]
      },
      {
        id: 'stockAllocation',
        title: 'Stock Allocation',
        description: 'Allocate available stock to orders directly.',
        icon: 'inventory_2',
        perms: [
          { id: 'allocate', label: 'Allocate Stock', desc: 'Assign finished goods directly to pending orders.' }
        ]
      }
    ]
  },
  productionPlanning: {
    title: 'Production Planning',
    icon: 'precision_manufacturing',
    screens: [
      {
        id: 'productionDashboard',
        title: 'Production Dashboard',
        description: 'View ongoing and planned production batches.',
        icon: 'dashboard',
        perms: [
          { id: 'view', label: 'View Dashboard', desc: 'Access production tracking screens.' }
        ]
      },
      {
        id: 'batchClosing',
        title: 'Batch Closing',
        description: 'Close out production batches and record output.',
        icon: 'check_circle',
        perms: [
          { id: 'close', label: 'Close Batches', desc: 'Process and close active production batches.' },
          { id: 'editOutput', label: 'Edit Output', desc: 'Modify output qualities and quantities.' }
        ]
      },
      {
        id: 'bomMaster',
        title: 'BOM Calculator & Master Setup',
        description: 'Manage Bill of Materials and manufacturing recipes.',
        icon: 'account_tree',
        perms: [
          { id: 'view', label: 'View BOMs', desc: 'View existing BOM recipes.' },
          { id: 'edit', label: 'Edit BOMs', desc: 'Create and edit BOM recipes.' },
          { id: 'print', label: 'Print BOMs', desc: 'Print BOM details.' }
        ]
      },
      {
        id: 'stockDemand',
        title: 'Stock Demand',
        description: 'Manage stock demands from inventory.',
        icon: 'assignment_turned_in',
        perms: [
          { id: 'view', label: 'View Demands', desc: 'View stock demand history.' },
          { id: 'create', label: 'Create Demand', desc: 'Create new stock demands.' }
        ]
      },
      {
        id: 'stockReceivingNote',
        title: 'Stock Receiving Note',
        description: 'Receive transferred stock into production.',
        icon: 'inventory',
        perms: [
          { id: 'view', label: 'View Receiving Notes', desc: 'View receiving history.' },
          { id: 'receive', label: 'Receive Stock', desc: 'Process stock receiving.' }
        ]
      },
      {
        id: 'rawMaterialProduction',
        title: 'Raw Material Composite Manufacturing',
        description: 'Manufacture composite raw materials by consuming ingredients.',
        icon: 'fact_check',
        perms: [
          { id: 'view', label: 'View Manufacturing Log', desc: 'View composite manufacturing logs.' },
          { id: 'create', label: 'Process Composite Batch', desc: 'Execute composite ingredient manufacturing.' }
        ]
      },
      {
        id: 'consumptionHistory',
        title: 'Consumption History',
        description: 'Track material consumption logs across production lines.',
        icon: 'history_toggle_off',
        perms: [
          { id: 'view', label: 'View Consumption History', desc: 'Browse production material usage history.' }
        ]
      }
    ]
  },
  inventory: {
    title: 'Inventory',
    icon: 'inventory_2',
    screens: [
      {
        id: 'inventoryList',
        title: 'Inventory List',
        description: 'View stock levels for finished goods and raw materials.',
        icon: 'list_alt',
        perms: [
          { id: 'view', label: 'View Inventory', desc: 'Access stock lists and current balances.' },
          { id: 'print', label: 'Print Reports', desc: 'Print inventory stock reports.' }
        ]
      },
      {
        id: 'stockValue',
        title: 'Stock Value',
        description: 'View stock values and item rates in inventory reports.',
        icon: 'attach_money',
        perms: [
          { id: 'view', label: 'View Stock Value', desc: 'Allows viewing stock value (quantity × rate) in the stock register and the FG stock report.' }
        ]
      },
      {
        id: 'adjustStock',
        title: 'Adjust Stock',
        description: 'Manual adjustment of stock levels.',
        icon: 'tune',
        perms: [
          { id: 'adjust', label: 'Stock Adjustments', desc: 'Add or deduct stock manually.' }
        ]
      },
      {
        id: 'masterSetup',
        title: 'Item Library & Master Setup',
        description: 'Create new items, raw materials, customers, and suppliers.',
        icon: 'database',
        perms: [
          { id: 'createItems', label: 'Create Items', desc: 'Add new items and raw materials to the system.' },
          { id: 'createEntities', label: 'Manage Entities', desc: 'Add or edit customers and suppliers.' },
          { id: 'batchUpload', label: 'Batch Upload Data', desc: 'Upload master data via CSV.' }
        ]
      },
      {
        id: 'stockTransfer',
        title: 'Stock Transfer',
        description: 'Transfer stock between warehouses and production.',
        icon: 'move_up',
        perms: [
          { id: 'view', label: 'View Transfers', desc: 'View stock transfer history.' },
          { id: 'transfer', label: 'Transfer Stock', desc: 'Transfer stock against demand or manually.' }
        ]
      },
      {
        id: 'otherConsumption',
        title: 'Other Consumption & Wastage',
        description: 'Log non-production stock consumption and wastage.',
        icon: 'delete_sweep',
        perms: [
          { id: 'view', label: 'View Wastage Logs', desc: 'Browse stock wastage and consumption history.' },
          { id: 'create', label: 'Record Consumption', desc: 'Log item consumption or damage notes.' }
        ]
      }
    ]
  },
  delivery: {
    title: 'Delivery',
    icon: 'local_shipping',
    screens: [
      {
        id: 'deliveryList',
        title: 'Delivery Records',
        description: 'View historical delivery challans.',
        icon: 'history',
        perms: [
          { id: 'view', label: 'View Records', desc: 'Access all past delivery records.' },
          { id: 'print', label: 'Print DC', desc: 'Print or reprint Delivery Challans.' }
        ]
      },
      {
        id: 'createDc',
        title: 'Create Delivery',
        description: 'Process outbound deliveries.',
        icon: 'add_shopping_cart',
        perms: [
          { id: 'create', label: 'Create DC', desc: 'Generate new delivery challans.' },
          { id: 'edit', label: 'Edit Delivery', desc: 'Modify active delivery details.' },
          { id: 'delete', label: 'Delete DC', desc: 'Delete an active or incorrect delivery.', isError: true }
        ]
      }
    ]
  },
  userManagement: {
    title: 'User Management',
    icon: 'admin_panel_settings',
    screens: [
      {
        id: 'userControl',
        title: 'User Control',
        description: 'Manage system users, security roles, and access levels.',
        icon: 'manage_accounts',
        perms: [
          { id: 'view', label: 'View Users', desc: 'View list of all active and inactive users.' },
          { id: 'create', label: 'Create User', desc: 'Add new users to the system.' },
          { id: 'edit', label: 'Edit Permissions', desc: 'Modify roles, permissions, and details of existing users.' },
          { id: 'delete', label: 'Delete User', desc: 'Remove users from the system.', isError: true }
        ]
      },
      {
        id: 'auditLogs',
        title: 'Audit Logs',
        description: 'View system-wide security and action logs.',
        icon: 'policy',
        perms: [
          { id: 'view', label: 'View Logs', desc: 'Access system audit trails.' }
        ]
      }
    ]
  },
  settings: {
    title: 'Settings',
    icon: 'settings',
    screens: [
      {
        id: 'displayScale',
        title: 'Screen Size & Display Settings',
        description: 'Adjust UI zoom level, mobile/web scaling, and sidebar position.',
        icon: 'aspect_ratio',
        perms: [
          { id: 'view', label: 'View Display Settings', desc: 'View screen zoom and UI scale controls.' },
          { id: 'edit', label: 'Modify Screen Scale', desc: 'Adjust web/mobile UI scaling and layout.' }
        ]
      },
      {
        id: 'masterData',
        title: 'Master Data Setup',
        description: 'Manage customers, suppliers, and item definitions.',
        icon: 'database',
        perms: [
          { id: 'view', label: 'View Master Data', desc: 'View lists of entities and items.' },
          { id: 'create', label: 'Create Entries', desc: 'Add new customers, suppliers, or items.' },
          { id: 'edit', label: 'Edit Entries', desc: 'Modify existing master data.' },
          { id: 'delete', label: 'Delete Entries', desc: 'Remove entries from the system.', isError: true }
        ]
      },
      {
        id: 'systemConfig',
        title: 'System Configuration & Print Setup',
        description: 'Manage global app settings, print layouts, and company headers.',
        icon: 'tune',
        perms: [
          { id: 'view', label: 'View Settings', desc: 'View current system configuration and print setup.' },
          { id: 'edit', label: 'Edit Settings', desc: 'Modify global settings and print layouts.' }
        ]
      },
      {
        id: 'documentRouting',
        title: 'Document Routing Center',
        description: 'Configure approval workflows and document routing rules.',
        icon: 'account_tree',
        perms: [
          { id: 'view', label: 'View Routing Rules', desc: 'Access routing rule list and triggers.' },
          { id: 'edit', label: 'Manage Workflows', desc: 'Create, edit, or toggle document routing workflows.' }
        ]
      },
      {
        id: 'departmentSettings',
        title: 'Department & Sub-Section Setup',
        description: 'Configure company departments and organizational units.',
        icon: 'corporate_fare',
        perms: [
          { id: 'view', label: 'View Departments', desc: 'Browse active departments and sections.' },
          { id: 'edit', label: 'Manage Departments', desc: 'Create or modify department definitions.' }
        ]
      }
    ]
  },
  hr: {
    title: 'HR Management',
    icon: 'badge',
    screens: [
      {
        id: 'hrDashboard',
        title: 'HR Dashboard',
        description: 'Employee details, attendance, salary summaries, and department statistics.',
        icon: 'dashboard',
        perms: [
          { id: 'view', label: 'View Dashboard', desc: 'Browse employee statistics, salary summaries, and profiles.' },
          { id: 'edit', label: 'Edit Dashboard', desc: 'Update employee information or department configurations.' }
        ]
      },
      {
        id: 'hrDirectory',
        title: 'Employee Directory',
        description: 'Browse, search, and manage all employee records and files.',
        icon: 'groups',
        perms: [
          { id: 'view', label: 'View Directory', desc: 'Access employee directory and profiles.' },
          { id: 'edit', label: 'Manage Employees', desc: 'Add or edit employee profiles and records.' }
        ]
      },
      {
        id: 'hrOnboarding',
        title: 'Onboarding Wizard',
        description: 'Process new employee clearance and onboarding steps.',
        icon: 'person_add',
        perms: [
          { id: 'view', label: 'View Onboarding', desc: 'Access onboarding wizard and clearance slips.' },
          { id: 'create', label: 'Create Onboarding', desc: 'Process new employee onboarding.' }
        ]
      },
      {
        id: 'hrAttendance',
        title: 'Attendance Management',
        description: 'Track daily attendance, shifts, fines, and overtime hours.',
        icon: 'pending_actions',
        perms: [
          { id: 'view', label: 'View Attendance Grid (Read Only)', desc: 'Access attendance grid in read-only mode.' },
          { id: 'add_employee', label: 'Add New Employee Button', desc: 'Permission to see and click + Add New Employee button.' },
          { id: 'upload_csv', label: 'Upload CSV & Download Template', desc: 'Permission to see Upload CSV/Excel & Download Template buttons.' },
          { id: 'reconcile', label: 'Verify & Reconcile Button', desc: 'Permission to see and click Verify & Reconcile button.' },
          { id: 'date_filter', label: 'Month, Year & Date Range Filters', desc: 'Permission to see and use Month, Year, and Date Range filter controls.' },
          { id: 'filter_attendance', label: 'Attendance Status Filter & Column', desc: 'Permission to see, edit and toggle Attendance Status column.' },
          { id: 'status_present', label: 'Status Option: Present', desc: 'Permission to mark or select Present status.' },
          { id: 'status_absent', label: 'Status Option: Absent', desc: 'Permission to mark or select Absent status.' },
          { id: 'status_leave', label: 'Status Option: Leave', desc: 'Permission to mark or select Leave status.' },
          { id: 'status_holiday', label: 'Status Option: Holiday', desc: 'Permission to mark or select Holiday status.' },
          { id: 'status_offday', label: 'Status Option: Off Day', desc: 'Permission to mark or select Off Day status.' },
          { id: 'filter_overtime', label: 'Overtime Filter & Column', desc: 'Permission to see, edit and toggle Overtime hours column.' },
          { id: 'filter_fines', label: 'Fines Filter & Column', desc: 'Permission to see, edit and toggle Fine amount column.' },
          { id: 'filter_deductions', label: 'Late Coming Filter & Column', desc: 'Permission to see, edit and toggle Late Coming hours column.' },
          { id: 'filter_toggles', label: 'Attendance Column Toggles', desc: 'Permission to see and toggle all Attendance, Overtime, Fines & Late Coming filters.' },
          { id: 'edit', label: 'Edit Attendance & Save Changes', desc: 'Modify attendance logs, overtime, fines, and click Save Changes.' }
        ]
      },
      {
        id: 'hrOvertime',
        title: 'Overtime Request',
        description: 'Submit, review, and approve employee overtime requests.',
        icon: 'more_time',
        perms: [
          { id: 'view', label: 'View Overtime Requests', desc: 'Access overtime claim forms and history.' },
          { id: 'create', label: 'Submit Request', desc: 'Submit new overtime requests.' },
          { id: 'approve', label: 'Approve Overtime', desc: 'Approve or reject overtime requests.' }
        ]
      },
      {
        id: 'hrLeave',
        title: 'Leave Request',
        description: 'Submit and process employee leave applications.',
        icon: 'event_busy',
        perms: [
          { id: 'view', label: 'View Leave Requests', desc: 'Access leave request forms and logs.' },
          { id: 'create', label: 'Apply Leave', desc: 'Submit new leave applications.' }
        ]
      },
      {
        id: 'hrLoan',
        title: 'Loan Request',
        description: 'Submit, review, and approve employee loan applications.',
        icon: 'payments',
        perms: [
          { id: 'view', label: 'View Loan Requests', desc: 'Access loan request forms and history.' },
          { id: 'create', label: 'Submit Loan Request', desc: 'Apply for employee loan.' },
          { id: 'approve', label: 'Approve Loan Request', desc: 'Approve or reject employee loan applications.' }
        ]
      },
      {
        id: 'hrAdvance',
        title: 'Advance Request',
        description: 'Submit and process single-month salary advance requests.',
        icon: 'price_change',
        perms: [
          { id: 'view', label: 'View Advance Requests', desc: 'Access advance request logs and status.' },
          { id: 'create', label: 'Submit Advance Request', desc: 'Apply for single-month salary advance.' }
        ]
      },
      {
        id: 'hrLoanLedger',
        title: 'Loan Ledger',
        description: 'Track active employee loans, installments, and repayment progress.',
        icon: 'account_balance',
        perms: [
          { id: 'view', label: 'View Loan Ledger', desc: 'Access loan ledger balances and deduction schedules.' },
          { id: 'edit', label: 'Manage Deductions', desc: 'Record manual repayments or adjust loan ledgers.' }
        ]
      },
      {
        id: 'hrSalary',
        title: 'Salary Generation',
        description: 'Generate monthly payroll, allowances, deductions, and payslips.',
        icon: 'account_balance_wallet',
        perms: [
          { id: 'view', label: 'View Salary Records', desc: 'Access payroll calculations and payslips.' },
          { id: 'generate', label: 'Generate Payroll', desc: 'Process monthly salary generation.' }
        ]
      },
      {
        id: 'salaryAllowanceConfig',
        title: 'Salary & Allowance Config',
        description: 'Configure global payroll percentages, allowances, and tax brackets.',
        icon: 'tune',
        perms: [
          { id: 'view', label: 'View Config', desc: 'Access allowance percentage and tax configuration.' },
          { id: 'edit', label: 'Update Rules', desc: 'Modify default allowance percentages and limits.' }
        ]
      },
      {
        id: 'payrollAccountMapping',
        title: 'Payroll Account Mapping',
        description: 'Map payroll expense heads to Chart of Accounts.',
        icon: 'swap_horiz',
        perms: [
          { id: 'view', label: 'View Mappings', desc: 'Access payroll account mapping table.' },
          { id: 'edit', label: 'Edit Mappings', desc: 'Map salary expenses to GL heads.' }
        ]
      },
      {
        id: 'hrSettings',
        title: 'HR Settings',
        description: 'Manage HR departments, sub-sections, permissions, and roles.',
        icon: 'settings',
        perms: [
          { id: 'view', label: 'View Settings', desc: 'View HR Settings.' },
          { id: 'edit', label: 'Edit Settings', desc: 'Modify HR Settings.' }
        ]
      }
    ]
  },
  chat: {
    title: 'Chat Workspace',
    icon: 'chat',
    screens: [
      {
        id: 'chatWorkspace',
        title: 'Chat Messaging',
        description: 'Access 1-on-1 team messaging and group channels.',
        icon: 'forum',
        perms: [
          { id: 'view', label: 'Access Chat', desc: 'Send and receive messages in Chat Workspace.' }
        ]
      },
      {
        id: 'liveActivities',
        title: 'Live Activities Stream',
        description: 'Access the live ERP inward & outward activity stream in chat.',
        icon: 'event_upcoming',
        perms: [
          { id: 'view', label: 'View Activities', desc: 'Allows viewing of inward and outward gate pass entries.' }
        ]
      },
      {
        id: 'prices',
        title: 'Prices Access',
        description: 'View prices and monetary details in live activities.',
        icon: 'attach_money',
        perms: [
          { id: 'view', label: 'View Prices', desc: 'Allows viewing price logs in activities.' }
        ]
      }
    ]
  },
  finance: {
    title: 'Finance & Accounts',
    icon: 'account_balance_wallet',
    screens: [
      {
        id: 'overview',
        title: 'Finance Overview',
        description: 'Access the main financial overview, charts and KPI reports.',
        icon: 'monitoring',
        perms: [
          { id: 'view', label: 'View Dashboard', desc: 'Browse main accounts statistics and financial KPIs.' }
        ]
      },
      {
        id: 'sales-invoice',
        title: 'Sales Invoice',
        description: 'Manage sales invoices and payments.',
        icon: 'receipt',
        perms: [
          { id: 'view', label: 'View Invoices', desc: 'View list of all generated sales invoices.' },
          { id: 'create', label: 'Generate Invoice', desc: 'Create new invoices against dispatch logs.' },
          { id: 'edit', label: 'Edit Invoice', desc: 'Modify details of existing sales invoices.' },
          { id: 'delete', label: 'Delete Invoice', desc: 'Remove invoices from database.', isError: true }
        ]
      },
      {
        id: 'purchase-invoice',
        title: 'Purchase Invoice',
        description: 'Manage supplier and purchase invoices.',
        icon: 'shopping_bag',
        perms: [
          { id: 'view', label: 'View Invoices', desc: 'Browse all posted purchase invoices.' },
          { id: 'create', label: 'Post Invoice', desc: 'Post new invoices against GRNs.' },
          { id: 'edit', label: 'Edit Invoice', desc: 'Modify existing purchase invoices.' },
          { id: 'delete', label: 'Delete Invoice', desc: 'Remove purchase invoices from system.', isError: true }
        ]
      },
      {
        id: 'chart-of-accounts',
        title: 'Chart of Accounts',
        description: 'Manage accounting head groups and ledgers.',
        icon: 'account_tree',
        perms: [
          { id: 'view', label: 'View Chart', desc: 'View COA heads and balances.' },
          { id: 'edit', label: 'Edit Chart', desc: 'Add or modify accounts and ledger heads.' }
        ]
      },
      {
        id: 'ledger-tax',
        title: 'Ledger & Tax',
        description: 'View ledgers, balance sheets, and tax reports.',
        icon: 'receipt_long',
        perms: [
          { id: 'view', label: 'View Ledgers', desc: 'Browse and print general ledger and tax records.' }
        ]
      },
      {
        id: 'vouchers',
        title: 'Vouchers',
        description: 'Record financial transactions and payment vouchers.',
        icon: 'account_balance_wallet',
        perms: [
          { id: 'view', label: 'View Vouchers', desc: 'Browse general journals and posted vouchers.' },
          { id: 'create', label: 'Post Voucher', desc: 'Create payment or receipt vouchers.' }
        ]
      }
    ]
  },
  flasham: {
    title: 'Flash AM Terminal',
    icon: 'fingerprint',
    screens: [
      {
        id: 'punch',
        title: 'Attendance Punch',
        description: 'Clock employees in and out on the Flash AM terminal and view the attendance list.',
        icon: 'fingerprint',
        perms: [
          { id: 'access', label: 'Punch Attendance', desc: 'Allows punch in / punch out, manual time entry, and viewing the Flash AM attendance list.' }
        ]
      },
      {
        id: 'deduction',
        title: 'Deduction Entry',
        description: 'Add per-day deduction hours for employees on the Flash AM terminal (attendance itself stays hidden).',
        icon: 'remove_circle',
        perms: [
          { id: 'access', label: 'Add Deductions', desc: 'Allows entering deduction hours per employee for a selected date.' }
        ]
      },
      {
        id: 'overtime',
        title: 'Overtime Entry',
        description: 'Add per-day overtime hours for employees on the Flash AM terminal (attendance itself stays hidden).',
        icon: 'more_time',
        perms: [
          { id: 'access', label: 'Add Overtime', desc: 'Allows entering overtime hours per employee for a selected date.' }
        ]
      },
      {
        id: 'fine',
        title: 'Fine Entry',
        description: 'Add per-day fines for employees on the Flash AM terminal (attendance itself stays hidden).',
        icon: 'money_off',
        perms: [
          { id: 'access', label: 'Add Fines', desc: 'Allows entering a fine amount (with an optional note) per employee for a selected date.' }
        ]
      }
    ]
  }
};
