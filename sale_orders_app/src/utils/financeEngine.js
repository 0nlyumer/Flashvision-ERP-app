
// Universal filter for legacy mock/dummy invoice & voucher identifiers
const DUMMY_IDS = new Set([
  'INV-8901', 'INV-8902', 'INV-8903', 'INV-8904',
  'PINV-7801', 'PINV-7802', 'PINV-7803',
  'PV-001', 'PV-002', 'PV-003', 'PV-004',
  'VOUCH-1001', 'VOUCH-1002', 'VOUCH-1003', 'VOUCH-1004',
  'JV-2026-0001', 'CPV-2026-0002'
]);

export const isDummyFinancialRecord = (item) => {
  if (!item) return false;
  const id = item.id || item.voucherNo || item.invoiceNo || '';
  const ref = item.invoiceId || item.reference || '';
  return DUMMY_IDS.has(id) || DUMMY_IDS.has(ref);
};
/**
 * FlashVision Synthetic Leather ERP - Enterprise Finance Engine
 * Benchmarked against ERPNext & SAP Accounting Standard
 * 
 * 100% REAL TRANSACTION DRIVEN - ZERO DUMMY/MOCK DATA
 * Integrates directly with:
 * - Sales Invoices (salesInvoices)
 * - Purchase Invoices (purchaseInvoices)
 * - Multi-line Vouchers (vouchers, paymentVouchers)
 * - Sales Returns (returns)
 * - HR Generated Salaries (hr_generated_salaries)
 * - Inventory Material Consumptions (otherConsumptions)
 * - Customers & Suppliers Masters
 */

export const round2 = (num) => {
  const val = Number(num) || 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

export const formatMoney = (val, currencyCode = 'PKR') => {
  const num = round2(val);
  const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currencyCode} ${formatted}`;
};

// ----------------------------------------------------------------------------
// 1. STANDARD 5-TIER CHART OF ACCOUNTS FOR SYNTHETIC LEATHER MANUFACTURING
// (Clean zero opening balances - user can configure opening balances as needed)
// ----------------------------------------------------------------------------
export const DEFAULT_CHART_OF_ACCOUNTS = [
  // 100000 - ASSETS
  { id: '100000', code: '100000', name: 'Application of Funds (Assets)', rootType: 'Asset', category: 'Root', isGroup: true, parentId: null, isDebitNormal: true },
  { id: '110000', code: '110000', name: 'Current Assets', rootType: 'Asset', category: 'Current Asset', isGroup: true, parentId: '100000', isDebitNormal: true },
  { id: '111010', code: '111010', name: 'Cash in Hand - Factory Floor', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '111020', code: '111020', name: 'Petty Cash - Head Office & Admin', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '112010', code: '112010', name: 'HBL Main Operations A/C 0019284', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '112020', code: '112020', name: 'Meezan Bank Industrial A/C 099214', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '112030', code: '112030', name: 'MCB Foreign Exchange A/C 772109', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '113010', code: '113010', name: 'Accounts Receivable (Debtors Control)', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '114010', code: '114010', name: 'Stock in Hand - PVC & PU Resins', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '114020', code: '114020', name: 'Stock in Hand - Backing Fabric & Scrim', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '114030', code: '114030', name: 'Stock in Hand - Plasticizers (DOP) & Pigments', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '114040', code: '114040', name: 'Work in Progress (WIP Coating Lines)', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '114050', code: '114050', name: 'Finished Synthetic Leather Rolls Warehouse', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '115010', code: '115010', name: 'Advances to Chemical & Raw Material Suppliers', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '116010', code: '116010', name: 'Sales Tax Input / Claimable (FBR)', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '116020', code: '116020', name: 'Advance Income Tax Deducted (Sec 147/236)', rootType: 'Asset', category: 'Current Asset', isGroup: false, parentId: '110000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  
  { id: '120000', code: '120000', name: 'Non-Current / Fixed Assets', rootType: 'Asset', category: 'Fixed Asset', isGroup: true, parentId: '100000', isDebitNormal: true },
  { id: '121010', code: '121010', name: 'Synthetic Leather Coating & Foaming Line', rootType: 'Asset', category: 'Fixed Asset', isGroup: false, parentId: '120000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '121020', code: '121020', name: 'Coagulation & Wet Treatment Facility', rootType: 'Asset', category: 'Fixed Asset', isGroup: false, parentId: '120000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '121030', code: '121030', name: 'Embossing, Lacquering & Printing Machinery', rootType: 'Asset', category: 'Fixed Asset', isGroup: false, parentId: '120000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '122010', code: '122010', name: 'Factory Land & Industrial Sheds', rootType: 'Asset', category: 'Fixed Asset', isGroup: false, parentId: '120000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '123010', code: '123010', name: 'Commercial Transport & Forklifts', rootType: 'Asset', category: 'Fixed Asset', isGroup: false, parentId: '120000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '124010', code: '124010', name: 'Factory Lab Equipment & Spectrophotometers', rootType: 'Asset', category: 'Fixed Asset', isGroup: false, parentId: '120000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '129010', code: '129010', name: 'Accumulated Depreciation - Plant & Machinery', rootType: 'Asset', category: 'Fixed Asset', isGroup: false, parentId: '120000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },

  // 200000 - LIABILITIES
  { id: '200000', code: '200000', name: 'Source of Funds (Liabilities)', rootType: 'Liability', category: 'Root', isGroup: true, parentId: null, isDebitNormal: false },
  { id: '210000', code: '210000', name: 'Current Liabilities', rootType: 'Liability', category: 'Current Liability', isGroup: true, parentId: '200000', isDebitNormal: false },
  { id: '211010', code: '211010', name: 'Accounts Payable (Creditors Control)', rootType: 'Liability', category: 'Current Liability', isGroup: false, parentId: '210000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },
  { id: '212010', code: '212010', name: 'Sales Tax Output / Payable (FBR 18%)', rootType: 'Liability', category: 'Current Liability', isGroup: false, parentId: '210000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },
  { id: '213010', code: '213010', name: 'Withholding Tax (WHT) Payable (Sec 153)', rootType: 'Liability', category: 'Current Liability', isGroup: false, parentId: '210000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },
  { id: '214010', code: '214010', name: 'Accrued Factory Wages & Admin Salaries', rootType: 'Liability', category: 'Current Liability', isGroup: false, parentId: '210000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },
  { id: '215010', code: '215010', name: 'Customer Advances & Booking Deposits', rootType: 'Liability', category: 'Current Liability', isGroup: false, parentId: '210000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },
  { id: '216010', code: '216010', name: 'Accrued Electricity (LESCO/K-Electric) & Gas Bills', rootType: 'Liability', category: 'Current Liability', isGroup: false, parentId: '210000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },
  
  { id: '220000', code: '220000', name: 'Non-Current Liabilities', rootType: 'Liability', category: 'Non-Current Liability', isGroup: true, parentId: '200000', isDebitNormal: false },
  { id: '221010', code: '221010', name: 'Long-Term Industrial Expansion Facility', rootType: 'Liability', category: 'Non-Current Liability', isGroup: false, parentId: '220000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },
  { id: '222010', code: '222010', name: 'Directors Subordinated Loan', rootType: 'Liability', category: 'Non-Current Liability', isGroup: false, parentId: '220000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },

  // 300000 - EQUITY
  { id: '300000', code: '300000', name: 'Capital & Reserves (Equity)', rootType: 'Equity', category: 'Root', isGroup: true, parentId: null, isDebitNormal: false },
  { id: '310000', code: '310000', name: 'Paid-Up Share Capital', rootType: 'Equity', category: 'Equity', isGroup: false, parentId: '300000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },
  { id: '320000', code: '320000', name: 'Retained Earnings / General Reserves', rootType: 'Equity', category: 'Equity', isGroup: false, parentId: '300000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },
  { id: '330000', code: '330000', name: 'Current Period Retained Profit / Loss', rootType: 'Equity', category: 'Equity', isGroup: false, parentId: '300000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },

  // 400000 - INCOME / REVENUE
  { id: '400000', code: '400000', name: 'Income / Revenue', rootType: 'Income', category: 'Root', isGroup: true, parentId: null, isDebitNormal: false },
  { id: '410000', code: '410000', name: 'Operating Revenue', rootType: 'Income', category: 'Operating Revenue', isGroup: true, parentId: '400000', isDebitNormal: false },
  { id: '411010', code: '411010', name: 'Sales Revenue - Synthetic Leather Rolls', rootType: 'Income', category: 'Operating Revenue', isGroup: false, parentId: '410000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },
  { id: '411020', code: '411020', name: 'Contract Coating & Job Work Revenue', rootType: 'Income', category: 'Operating Revenue', isGroup: false, parentId: '410000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },
  { id: '412010', code: '412010', name: 'Sales Discounts & Trade Allowances', rootType: 'Income', category: 'Operating Revenue', isGroup: false, parentId: '410000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '413010', code: '413010', name: 'Sales Returns & Quality Deductions', rootType: 'Income', category: 'Operating Revenue', isGroup: false, parentId: '410000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '420000', code: '420000', name: 'Other Non-Operating Income', rootType: 'Income', category: 'Other Income', isGroup: true, parentId: '400000', isDebitNormal: false },
  { id: '421010', code: '421010', name: 'Scrap Sales - Trimmings & Offcut Rolls', rootType: 'Income', category: 'Other Income', isGroup: false, parentId: '420000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },
  { id: '422010', code: '422010', name: 'Gain on Foreign Currency Revaluation', rootType: 'Income', category: 'Other Income', isGroup: false, parentId: '420000', isDebitNormal: false, openingDebit: 0, openingCredit: 0 },

  // 500000 - EXPENSES
  { id: '500000', code: '500000', name: 'Expenses', rootType: 'Expense', category: 'Root', isGroup: true, parentId: null, isDebitNormal: true },
  { id: '510000', code: '510000', name: 'Cost of Goods Sold (COGS)', rootType: 'Expense', category: 'COGS', isGroup: true, parentId: '500000', isDebitNormal: true },
  { id: '511010', code: '511010', name: 'Raw Material Consumed - PVC / PU Resin', rootType: 'Expense', category: 'COGS', isGroup: false, parentId: '510000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '511020', code: '511020', name: 'Backing Fabric & Knitting Consumed', rootType: 'Expense', category: 'COGS', isGroup: false, parentId: '510000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '511030', code: '511030', name: 'Chemicals, Plasticizer (DOP) & Solvent Consumed', rootType: 'Expense', category: 'COGS', isGroup: false, parentId: '510000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '512010', code: '512010', name: 'Direct Factory Labor & Overtime Wages', rootType: 'Expense', category: 'COGS', isGroup: false, parentId: '510000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '513010', code: '513010', name: 'High-Tension Industrial Electricity & Gas', rootType: 'Expense', category: 'COGS', isGroup: false, parentId: '510000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '514010', code: '514010', name: 'Release Paper Wear & Line Roll Consumables', rootType: 'Expense', category: 'COGS', isGroup: false, parentId: '510000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '515010', code: '515010', name: 'Packaging, Polythene Tube & Core Spools', rootType: 'Expense', category: 'COGS', isGroup: false, parentId: '510000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },

  { id: '520000', code: '520000', name: 'Operating & Admin Expenses', rootType: 'Expense', category: 'Operating Expense', isGroup: true, parentId: '500000', isDebitNormal: true },
  { id: '521010', code: '521010', name: 'Executive & Admin Management Salaries', rootType: 'Expense', category: 'Operating Expense', isGroup: false, parentId: '520000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '522010', code: '522010', name: 'Freight Outward & Logistics Deliveries', rootType: 'Expense', category: 'Operating Expense', isGroup: false, parentId: '520000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '523010', code: '523010', name: 'QC Lab Chemicals & Quality Certification', rootType: 'Expense', category: 'Operating Expense', isGroup: false, parentId: '520000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '524010', code: '524010', name: 'Plant Repairs, Maintenance & Lubrication', rootType: 'Expense', category: 'Operating Expense', isGroup: false, parentId: '520000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '525010', code: '525010', name: 'Depreciation Charge - Machinery & Equipment', rootType: 'Expense', category: 'Operating Expense', isGroup: false, parentId: '520000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '526010', code: '526010', name: 'Bank Transaction Fees & Finance Charges', rootType: 'Expense', category: 'Operating Expense', isGroup: false, parentId: '520000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '527010', code: '527010', name: 'Audit, Tax Advisory & Legal Consultation', rootType: 'Expense', category: 'Operating Expense', isGroup: false, parentId: '520000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 },
  { id: '528010', code: '528010', name: 'Security Staff, Insurance & Environmental Compliance', rootType: 'Expense', category: 'Operating Expense', isGroup: false, parentId: '520000', isDebitNormal: true, openingDebit: 0, openingCredit: 0 }
];

// ----------------------------------------------------------------------------
// 2. COST CENTERS FOR SYNTHETIC LEATHER PRODUCTION
// ----------------------------------------------------------------------------
export const DEFAULT_COST_CENTERS = [
  { id: 'CC-DRY-01', name: 'Dry Coating & Foaming Line', code: 'DRY-LINE', manager: 'M. Naveed (Prod Mgr)', monthlyBudget: 8500000, color: '#3b82f6' },
  { id: 'CC-WET-02', name: 'Coagulation & Wet Treatment Line', code: 'WET-LINE', manager: 'Rashid Minhas (Line Sup)', monthlyBudget: 6200000, color: '#06b6d4' },
  { id: 'CC-CAST-03', name: 'Casting & Release Paper Line', code: 'CAST-LINE', manager: 'Tariq Mehmood', monthlyBudget: 4500000, color: '#8b5cf6' },
  { id: 'CC-EMB-04', name: 'Embossing, Lacquer & Finish Line', code: 'EMB-LINE', manager: 'Suleman Butt', monthlyBudget: 3800000, color: '#ec4899' },
  { id: 'CC-QC-05', name: 'Quality Assurance & Spectro Lab', code: 'QC-LAB', manager: 'Dr. Asad (QC Chemist)', monthlyBudget: 1200000, color: '#10b981' },
  { id: 'CC-MAINT-06', name: 'Factory Power & Engineering Workshop', code: 'MAINT-PLANT', manager: 'Engr. Kamran', monthlyBudget: 5500000, color: '#f59e0b' },
  { id: 'CC-ADMIN-07', name: 'General Management & Executive Office', code: 'ADMIN-HQ', manager: 'Accounts & HR Dept', monthlyBudget: 2800000, color: '#64748b' }
];

// ----------------------------------------------------------------------------
// 3. GENERAL LEDGER GENERATOR (100% Real Transaction Powered)
// ----------------------------------------------------------------------------
export const generateGeneralLedger = (state = {}, filters = {}) => {
  const chart = (state.chartOfAccounts && state.chartOfAccounts.length > 0)
    ? state.chartOfAccounts
    : DEFAULT_CHART_OF_ACCOUNTS;

  const accountMap = new Map();
  chart.forEach(acc => accountMap.set(acc.id || acc.code, acc));

  // Purely actual ERP transactions - ZERO dummy records
  const salesInvoices = (Array.isArray(state.salesInvoices) ? state.salesInvoices : []).filter(x => !isDummyFinancialRecord(x));
  const purchaseInvoices = (Array.isArray(state.purchaseInvoices) ? state.purchaseInvoices : []).filter(x => !isDummyFinancialRecord(x));
  
  // Vouchers can be in state.vouchers or state.paymentVouchers
  const rawVouchers = (Array.isArray(state.vouchers) && state.vouchers.length > 0
    ? state.vouchers
    : (Array.isArray(state.paymentVouchers) ? state.paymentVouchers : [])).filter(x => !isDummyFinancialRecord(x));

  const returns = Array.isArray(state.returns) ? state.returns : [];
  const hrSalaries = Array.isArray(state.hr_generated_salaries) ? state.hr_generated_salaries : [];
  const otherConsumptions = Array.isArray(state.otherConsumptions) ? state.otherConsumptions : [];

  const rawEntries = [];
  let seq = 1;

  // A. Actual Sales Invoices -> Post to GL
  salesInvoices.forEach(inv => {
    const invDate = inv.date || new Date().toISOString();
    const invId = inv.id || `INV-${seq}`;
    const custName = inv.customerName || 'Customer';
    const grandTotal = round2(inv.grandTotal || 0);
    const subtotal = round2(inv.subtotal || (grandTotal - (inv.tax || 0)));
    const tax = round2(inv.tax || (grandTotal - subtotal));

    if (grandTotal > 0 || subtotal > 0) {
      // Entry 1: Debit Debtors / Accounts Receivable (113010)
      rawEntries.push({
        id: `GLE-${seq++}`,
        date: invDate,
        voucherType: 'Sales Invoice',
        voucherNo: invId,
        sourceDocId: invId,
        accountId: '113010',
        accountName: accountMap.get('113010')?.name || 'Accounts Receivable (Debtors Control)',
        party: custName,
        partyType: 'Customer',
        costCenter: 'CC-ADMIN-07',
        narration: `Sales Invoice ${invId} for ${custName} - ${inv.remarks || 'Finished Goods'}`,
        debit: grandTotal,
        credit: 0
      });

      // Entry 2: Credit Sales Revenue (411010)
      rawEntries.push({
        id: `GLE-${seq++}`,
        date: invDate,
        voucherType: 'Sales Invoice',
        voucherNo: invId,
        sourceDocId: invId,
        accountId: '411010',
        accountName: accountMap.get('411010')?.name || 'Sales Revenue - Synthetic Leather Rolls',
        party: custName,
        partyType: 'Customer',
        costCenter: 'CC-DRY-01',
        narration: `Revenue recognition for invoice ${invId}`,
        debit: 0,
        credit: subtotal
      });

      // Entry 3: Credit Sales Tax Output (212010)
      if (tax > 0) {
        rawEntries.push({
          id: `GLE-${seq++}`,
          date: invDate,
          voucherType: 'Sales Invoice',
          voucherNo: invId,
          sourceDocId: invId,
          accountId: '212010',
          accountName: accountMap.get('212010')?.name || 'Sales Tax Output / Payable (FBR 18%)',
          party: custName,
          partyType: 'Tax Authority',
          costCenter: 'CC-ADMIN-07',
          narration: `Output Sales Tax payable on invoice ${invId}`,
          debit: 0,
          credit: tax
        });
      }
    }
  });

  // B. Actual Purchase Invoices -> Post to GL
  purchaseInvoices.forEach(pinv => {
    const pinvDate = pinv.date || new Date().toISOString();
    const pinvId = pinv.id || `PINV-${seq}`;
    const vendorName = pinv.vendorName || 'Supplier';
    const grandTotal = round2(pinv.grandTotal || 0);
    const subtotal = round2(pinv.subtotal || (grandTotal - (pinv.tax || 0)));
    const tax = round2(pinv.tax || (grandTotal - subtotal));

    if (grandTotal > 0 || subtotal > 0) {
      // Entry 1: Debit Raw Materials / Cost (511010)
      rawEntries.push({
        id: `GLE-${seq++}`,
        date: pinvDate,
        voucherType: 'Purchase Invoice',
        voucherNo: pinvId,
        sourceDocId: pinvId,
        accountId: '511010',
        accountName: accountMap.get('511010')?.name || 'Raw Material Consumed - PVC / PU Resin',
        party: vendorName,
        partyType: 'Supplier',
        costCenter: 'CC-DRY-01',
        narration: `Direct raw material purchase bill ${pinvId} from ${vendorName}`,
        debit: subtotal,
        credit: 0
      });

      // Entry 2: Debit Sales Tax Input (116010)
      if (tax > 0) {
        rawEntries.push({
          id: `GLE-${seq++}`,
          date: pinvDate,
          voucherType: 'Purchase Invoice',
          voucherNo: pinvId,
          sourceDocId: pinvId,
          accountId: '116010',
          accountName: accountMap.get('116010')?.name || 'Sales Tax Input / Claimable (FBR)',
          party: vendorName,
          partyType: 'Tax Authority',
          costCenter: 'CC-ADMIN-07',
          narration: `Input sales tax claimable on ${pinvId}`,
          debit: tax,
          credit: 0
        });
      }

      // Entry 3: Credit Accounts Payable (211010)
      rawEntries.push({
        id: `GLE-${seq++}`,
        date: pinvDate,
        voucherType: 'Purchase Invoice',
        voucherNo: pinvId,
        sourceDocId: pinvId,
        accountId: '211010',
        accountName: accountMap.get('211010')?.name || 'Accounts Payable (Creditors Control)',
        party: vendorName,
        partyType: 'Supplier',
        costCenter: 'CC-ADMIN-07',
        narration: `Trade payable bill ${pinvId} to ${vendorName}`,
        debit: 0,
        credit: grandTotal
      });
    }
  });

  // C. Actual Vouchers (JV, CPV, CRV, BPV, BRV) -> Post to GL
  rawVouchers.forEach(v => {
    const vDate = v.date || new Date().toISOString();
    const vId = v.id || v.voucherNo || `VOUCH-${seq}`;
    const vType = v.type || 'Journal Voucher';
    const costCenter = v.costCenter || 'CC-ADMIN-07';

    if (Array.isArray(v.lines) && v.lines.length > 0) {
      v.lines.forEach(l => {
        const accInfo = accountMap.get(l.accountId) || { name: l.accountName || l.accountId };
        const d = round2(l.debit || 0);
        const c = round2(l.credit || 0);

        if (d > 0 || c > 0) {
          rawEntries.push({
            id: `GLE-${seq++}`,
            date: vDate,
            voucherType: vType,
            voucherNo: vId,
            sourceDocId: vId,
            accountId: l.accountId || '111010',
            accountName: l.accountName || accInfo.name,
            party: v.party || v.paidTo || v.receivedFrom || (d > 0 ? 'Debit Party' : 'Credit Party'),
            partyType: 'General',
            costCenter: l.costCenter || costCenter,
            narration: l.narration || v.narration || `${vType} entry`,
            debit: d,
            credit: c
          });
        }
      });
    } else if (v.amount || v.totalAmount) {
      const amt = round2(v.amount || v.totalAmount || 0);
      if (amt > 0) {
        const isReceipt = v.type === 'Receipt' || v.type === 'Cash Receipt' || v.type === 'Bank Receipt' || v.type === 'CRV' || v.type === 'BRV' || v.invoiceType === 'Sales';
        if (isReceipt) {
          // Cash/Bank Receipt from Customer: Debit Cash & Bank (112010), Credit Accounts Receivable (113010)
          rawEntries.push({
            id: `GLE-${seq++}`,
            date: vDate,
            voucherType: vType || 'Cash Receipt',
            voucherNo: vId,
            sourceDocId: vId,
            accountId: '112010',
            accountName: accountMap.get('112010')?.name || 'HBL Main Operations A/C 0019284',
            party: v.receivedFrom || v.party || v.customerName || 'Customer',
            partyType: 'Customer',
            costCenter,
            narration: v.narration || `Customer payment received for ${v.invoiceId || vId}`,
            debit: amt,
            credit: 0
          });
          rawEntries.push({
            id: `GLE-${seq++}`,
            date: vDate,
            voucherType: vType || 'Cash Receipt',
            voucherNo: vId,
            sourceDocId: vId,
            accountId: '113010',
            accountName: accountMap.get('113010')?.name || 'Accounts Receivable (Debtors Control)',
            party: v.receivedFrom || v.party || v.customerName || 'Customer',
            partyType: 'Customer',
            costCenter,
            narration: v.narration || `AR settled via ${vId}`,
            debit: 0,
            credit: amt
          });
        } else {
          // Cash/Bank Payment to Supplier: Debit Accounts Payable (211010), Credit Cash & Bank (112010)
          rawEntries.push({
            id: `GLE-${seq++}`,
            date: vDate,
            voucherType: vType || 'Payment Voucher',
            voucherNo: vId,
            sourceDocId: vId,
            accountId: '211010',
            accountName: accountMap.get('211010')?.name || 'Accounts Payable (Creditors Control)',
            party: v.paidTo || v.party || v.vendorName || 'Supplier',
            partyType: 'Supplier',
            costCenter,
            narration: v.narration || `Supplier payment for ${v.invoiceId || vId}`,
            debit: amt,
            credit: 0
          });
          rawEntries.push({
            id: `GLE-${seq++}`,
            date: vDate,
            voucherType: vType || 'Payment Voucher',
            voucherNo: vId,
            sourceDocId: vId,
            accountId: '112010',
            accountName: accountMap.get('112010')?.name || 'HBL Main Operations A/C 0019284',
            party: v.paidTo || v.party || v.vendorName || 'Supplier',
            partyType: 'Supplier',
            costCenter,
            narration: v.narration || `Payment disbursement via ${vId}`,
            debit: 0,
            credit: amt
          });
        }
      }
    }
  });

  // D. Actual Sales Returns -> Post to GL
  returns.forEach(ret => {
    const retDate = ret.date || ret.createdAt || new Date().toISOString();
    const retId = ret.id || ret.returnId || `RTN-${seq}`;
    const custName = ret.customerName || 'Customer';
    const retAmount = round2(ret.totalAmount || ret.amount || (ret.items ? ret.items.reduce((s, it) => s + (it.qty * (it.rate || it.unitPrice || 0)), 0) : 0));

    if (retAmount > 0) {
      // Debit: Sales Returns (413010)
      rawEntries.push({
        id: `GLE-${seq++}`,
        date: retDate,
        voucherType: 'Sales Return',
        voucherNo: retId,
        sourceDocId: retId,
        accountId: '413010',
        accountName: accountMap.get('413010')?.name || 'Sales Returns & Quality Deductions',
        party: custName,
        partyType: 'Customer',
        costCenter: 'CC-DRY-01',
        narration: `Customer sales return ${retId} for ${custName} (${ret.reason || 'Damaged'})`,
        debit: retAmount,
        credit: 0
      });

      // Credit: Accounts Receivable (113010)
      rawEntries.push({
        id: `GLE-${seq++}`,
        date: retDate,
        voucherType: 'Sales Return',
        voucherNo: retId,
        sourceDocId: retId,
        accountId: '113010',
        accountName: accountMap.get('113010')?.name || 'Accounts Receivable (Debtors Control)',
        party: custName,
        partyType: 'Customer',
        costCenter: 'CC-ADMIN-07',
        narration: `Credit note adjustment for return ${retId}`,
        debit: 0,
        credit: retAmount
      });
    }
  });

  // E. Actual HR Generated Salaries -> Post to GL
  hrSalaries.forEach(sal => {
    const salDate = sal.date || sal.month || new Date().toISOString();
    const salId = sal.id || `PAY-${seq}`;
    const netSal = round2(sal.netSalary || sal.amount || 0);

    if (netSal > 0) {
      rawEntries.push({
        id: `GLE-${seq++}`,
        date: salDate,
        voucherType: 'Payroll Disbursement',
        voucherNo: salId,
        sourceDocId: salId,
        accountId: '512010',
        accountName: accountMap.get('512010')?.name || 'Direct Factory Labor & Overtime Wages',
        party: sal.employeeName || 'Staff Payroll',
        partyType: 'Employee',
        costCenter: 'CC-DRY-01',
        narration: `Monthly salary disbursement for ${sal.employeeName || 'Staff'}`,
        debit: netSal,
        credit: 0
      });

      rawEntries.push({
        id: `GLE-${seq++}`,
        date: salDate,
        voucherType: 'Payroll Disbursement',
        voucherNo: salId,
        sourceDocId: salId,
        accountId: '112010',
        accountName: accountMap.get('112010')?.name || 'HBL Main Operations A/C 0019284',
        party: sal.employeeName || 'Staff Payroll',
        partyType: 'Employee',
        costCenter: 'CC-ADMIN-07',
        narration: `Net payroll paid via HBL Direct Transfer`,
        debit: 0,
        credit: netSal
      });
    }
  });

  // F. Actual Material Consumptions -> Post to GL
  otherConsumptions.forEach(cons => {
    const consDate = cons.date || new Date().toISOString();
    const consId = cons.id || `CONS-${seq}`;
    const consVal = round2(cons.totalValue || (cons.qty * (cons.rate || 0)));

    if (consVal > 0) {
      rawEntries.push({
        id: `GLE-${seq++}`,
        date: consDate,
        voucherType: 'Material Consumption',
        voucherNo: consId,
        sourceDocId: consId,
        accountId: '511010',
        accountName: accountMap.get('511010')?.name || 'Raw Material Consumed - PVC / PU Resin',
        party: cons.department || 'Production Line',
        partyType: 'Department',
        costCenter: cons.costCenter || 'CC-DRY-01',
        narration: `Material consumption ${consId}: ${cons.itemName || 'Raw Materials'}`,
        debit: consVal,
        credit: 0
      });

      rawEntries.push({
        id: `GLE-${seq++}`,
        date: consDate,
        voucherType: 'Material Consumption',
        voucherNo: consId,
        sourceDocId: consId,
        accountId: '114010',
        accountName: accountMap.get('114010')?.name || 'Stock in Hand - PVC & PU Resins',
        party: cons.department || 'Production Line',
        partyType: 'Department',
        costCenter: cons.costCenter || 'CC-DRY-01',
        narration: `Inventory issue for line processing`,
        debit: 0,
        credit: consVal
      });
    }
  });

  // Sort chronologically
  rawEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Compute sequential running balance per account
  const accountBalances = new Map();
  const entriesWithRunning = rawEntries.map(entry => {
    const acc = accountMap.get(entry.accountId);
    const isDebitNormal = acc ? acc.isDebitNormal !== false : true;
    const current = accountBalances.get(entry.accountId) || 0;
    const change = isDebitNormal ? (entry.debit - entry.credit) : (entry.credit - entry.debit);
    const newBal = round2(current + change);
    accountBalances.set(entry.accountId, newBal);

    return {
      ...entry,
      runningBalance: newBal
    };
  });

  // Apply filters
  let filtered = entriesWithRunning;
  if (filters.accountId && filters.accountId !== 'all') {
    filtered = filtered.filter(e => e.accountId === filters.accountId);
  }
  if (filters.party && filters.party.trim()) {
    const p = filters.party.toLowerCase();
    filtered = filtered.filter(e => e.party && e.party.toLowerCase().includes(p));
  }
  if (filters.voucherType && filters.voucherType !== 'all') {
    filtered = filtered.filter(e => e.voucherType === filters.voucherType);
  }
  if (filters.fromDate) {
    const fDate = new Date(filters.fromDate).getTime();
    filtered = filtered.filter(e => new Date(e.date).getTime() >= fDate);
  }
  if (filters.toDate) {
    const tDate = new Date(filters.toDate).getTime();
    filtered = filtered.filter(e => new Date(e.date).getTime() <= tDate);
  }
  if (filters.searchTerm && filters.searchTerm.trim()) {
    const s = filters.searchTerm.toLowerCase();
    filtered = filtered.filter(e => 
      e.voucherNo?.toLowerCase().includes(s) ||
      e.narration?.toLowerCase().includes(s) ||
      e.accountName?.toLowerCase().includes(s) ||
      e.party?.toLowerCase().includes(s)
    );
  }

  const totalDebit = round2(filtered.reduce((sum, e) => sum + e.debit, 0));
  const totalCredit = round2(filtered.reduce((sum, e) => sum + e.credit, 0));
  const diff = round2(totalDebit - totalCredit);

  return {
    entries: filtered,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(diff) < 0.01,
    difference: diff,
    count: filtered.length
  };
};

// ----------------------------------------------------------------------------
// 4. TRIAL BALANCE GENERATOR
// ----------------------------------------------------------------------------
export const generateTrialBalance = (state = {}, fromDate = null, toDate = null) => {
  const chart = (state.chartOfAccounts && state.chartOfAccounts.length > 0)
    ? state.chartOfAccounts
    : DEFAULT_CHART_OF_ACCOUNTS;

  const glResult = generateGeneralLedger(state, { fromDate, toDate });
  const glEntries = glResult.entries;

  const movements = new Map();
  glEntries.forEach(e => {
    const existing = movements.get(e.accountId) || { debit: 0, credit: 0 };
    existing.debit = round2(existing.debit + e.debit);
    existing.credit = round2(existing.credit + e.credit);
    movements.set(e.accountId, existing);
  });

  const trialRows = [];
  let grandOpeningDebit = 0;
  let grandOpeningCredit = 0;
  let grandMovementDebit = 0;
  let grandMovementCredit = 0;
  let grandClosingDebit = 0;
  let grandClosingCredit = 0;

  chart.forEach(acc => {
    if (acc.isGroup) return;

    const opDr = round2(acc.openingDebit || 0);
    const opCr = round2(acc.openingCredit || 0);
    const mov = movements.get(acc.id || acc.code) || { debit: 0, credit: 0 };

    const movDr = round2(mov.debit);
    const movCr = round2(mov.credit);

    let closingDr = 0;
    let closingCr = 0;

    if (acc.isDebitNormal !== false) {
      const net = round2((opDr - opCr) + (movDr - movCr));
      if (net >= 0) {
        closingDr = net;
      } else {
        closingCr = Math.abs(net);
      }
    } else {
      const net = round2((opCr - opDr) + (movCr - movDr));
      if (net >= 0) {
        closingCr = net;
      } else {
        closingDr = Math.abs(net);
      }
    }

    grandOpeningDebit = round2(grandOpeningDebit + opDr);
    grandOpeningCredit = round2(grandOpeningCredit + opCr);
    grandMovementDebit = round2(grandMovementDebit + movDr);
    grandMovementCredit = round2(grandMovementCredit + movCr);
    grandClosingDebit = round2(grandClosingDebit + closingDr);
    grandClosingCredit = round2(grandClosingCredit + closingCr);

    trialRows.push({
      id: acc.id || acc.code,
      code: acc.code || acc.id,
      name: acc.name,
      rootType: acc.rootType,
      category: acc.category,
      isDebitNormal: acc.isDebitNormal !== false,
      openingDebit: opDr,
      openingCredit: opCr,
      movementDebit: movDr,
      movementCredit: movCr,
      closingDebit: closingDr,
      closingCredit: closingCr
    });
  });

  const grouped = {
    Asset: trialRows.filter(r => r.rootType === 'Asset'),
    Liability: trialRows.filter(r => r.rootType === 'Liability'),
    Equity: trialRows.filter(r => r.rootType === 'Equity'),
    Income: trialRows.filter(r => r.rootType === 'Income'),
    Expense: trialRows.filter(r => r.rootType === 'Expense')
  };

  const diffClosing = round2(grandClosingDebit - grandClosingCredit);

  return {
    rows: trialRows,
    grouped,
    totals: {
      openingDebit: grandOpeningDebit,
      openingCredit: grandOpeningCredit,
      movementDebit: grandMovementDebit,
      movementCredit: grandMovementCredit,
      closingDebit: grandClosingDebit,
      closingCredit: grandClosingCredit,
      isBalanced: Math.abs(diffClosing) < 0.01,
      difference: diffClosing
    }
  };
};

// ----------------------------------------------------------------------------
// 5. PROFIT & LOSS STATEMENT (INCOME STATEMENT)
// ----------------------------------------------------------------------------
export const generateProfitAndLoss = (state = {}, fromDate = null, toDate = null) => {
  const tb = generateTrialBalance(state, fromDate, toDate);

  const incomeAccounts = tb.rows.filter(r => r.rootType === 'Income');
  const grossSalesAcc = incomeAccounts.find(r => r.code === '411010');
  const jobWorkAcc = incomeAccounts.find(r => r.code === '411020');
  const discAcc = incomeAccounts.find(r => r.code === '412010');
  const returnAcc = incomeAccounts.find(r => r.code === '413010');
  const scrapAcc = incomeAccounts.find(r => r.code === '421010');
  const fxAcc = incomeAccounts.find(r => r.code === '422010');

  const grossSales = round2((grossSalesAcc?.closingCredit || 0) + (jobWorkAcc?.closingCredit || 0));
  const discounts = round2(discAcc?.closingDebit || 0);
  const returns = round2(returnAcc?.closingDebit || 0);
  const netSales = round2(grossSales - discounts - returns);

  const otherIncome = round2((scrapAcc?.closingCredit || 0) + (fxAcc?.closingCredit || 0));
  const totalRevenue = round2(netSales + otherIncome);

  const cogsAccounts = tb.rows.filter(r => r.category === 'COGS');
  const cogsBreakdown = cogsAccounts.map(a => ({
    code: a.code,
    name: a.name,
    amount: a.closingDebit || 0
  }));
  const totalCOGS = round2(cogsBreakdown.reduce((sum, a) => sum + a.amount, 0));

  const grossProfit = round2(totalRevenue - totalCOGS);
  const grossMarginPercent = totalRevenue > 0 ? round2((grossProfit / totalRevenue) * 100) : 0;

  const opExAccounts = tb.rows.filter(r => r.category === 'Operating Expense');
  const opExBreakdown = opExAccounts.map(a => ({
    code: a.code,
    name: a.name,
    amount: a.closingDebit || 0
  }));
  const totalOperatingExpenses = round2(opExBreakdown.reduce((sum, a) => sum + a.amount, 0));

  const operatingProfit = round2(grossProfit - totalOperatingExpenses);
  const netProfit = operatingProfit;
  const netMarginPercent = totalRevenue > 0 ? round2((netProfit / totalRevenue) * 100) : 0;

  return {
    revenue: {
      grossSales,
      discounts,
      returns,
      netSales,
      otherIncome,
      totalRevenue,
      breakdown: incomeAccounts
    },
    cogs: {
      total: totalCOGS,
      breakdown: cogsBreakdown
    },
    grossProfit,
    grossMarginPercent,
    operatingExpenses: {
      total: totalOperatingExpenses,
      breakdown: opExBreakdown
    },
    operatingProfit,
    netProfit,
    netMarginPercent
  };
};

// ----------------------------------------------------------------------------
// 6. BALANCE SHEET STATEMENT
// ----------------------------------------------------------------------------
export const generateBalanceSheet = (state = {}, asOfDate = null) => {
  const tb = generateTrialBalance(state, null, asOfDate);
  const pnl = generateProfitAndLoss(state, null, asOfDate);

  const currentAssets = tb.rows.filter(r => r.category === 'Current Asset');
  const fixedAssets = tb.rows.filter(r => r.category === 'Fixed Asset');

  const totalCurrentAssets = round2(currentAssets.reduce((sum, r) => sum + (r.closingDebit - r.closingCredit), 0));
  const totalFixedAssets = round2(fixedAssets.reduce((sum, r) => sum + (r.closingDebit - r.closingCredit), 0));
  const totalAssets = round2(totalCurrentAssets + totalFixedAssets);

  const currentLiabilities = tb.rows.filter(r => r.category === 'Current Liability');
  const nonCurrentLiabilities = tb.rows.filter(r => r.category === 'Non-Current Liability');

  const totalCurrentLiabilities = round2(currentLiabilities.reduce((sum, r) => sum + (r.closingCredit - r.closingDebit), 0));
  const totalNonCurrentLiabilities = round2(nonCurrentLiabilities.reduce((sum, r) => sum + (r.closingCredit - r.closingDebit), 0));
  const totalLiabilities = round2(totalCurrentLiabilities + totalNonCurrentLiabilities);

  const equityRows = tb.rows.filter(r => r.rootType === 'Equity');
  let totalEquityBase = round2(equityRows.reduce((sum, r) => sum + (r.closingCredit - r.closingDebit), 0));
  
  const currentNetProfit = pnl.netProfit;
  const totalEquity = round2(totalEquityBase + currentNetProfit);

  const totalLiabilitiesAndEquity = round2(totalLiabilities + totalEquity);
  const diff = round2(totalAssets - totalLiabilitiesAndEquity);
  const isBalanced = Math.abs(diff) < 0.05;

  return {
    assets: {
      current: currentAssets,
      totalCurrent: totalCurrentAssets,
      fixed: fixedAssets,
      totalFixed: totalFixedAssets,
      total: totalAssets
    },
    liabilities: {
      current: currentLiabilities,
      totalCurrent: totalCurrentLiabilities,
      nonCurrent: nonCurrentLiabilities,
      totalNonCurrent: totalNonCurrentLiabilities,
      total: totalLiabilities
    },
    equity: {
      rows: equityRows,
      baseEquity: totalEquityBase,
      currentPeriodProfit: currentNetProfit,
      total: totalEquity
    },
    totalLiabilitiesAndEquity,
    isBalanced,
    difference: diff
  };
};

// ----------------------------------------------------------------------------
// 7. CASH FLOW STATEMENT
// ----------------------------------------------------------------------------
export const generateCashFlow = (state = {}, fromDate = null, toDate = null) => {
  const gl = generateGeneralLedger(state, { fromDate, toDate });

  const cashAccounts = ['111010', '111020', '112010', '112020', '112030'];
  let customerCollections = 0;
  let supplierPayments = 0;
  let operatingCashOutflows = 0;
  let financingInflows = 0;

  gl.entries.forEach(e => {
    if (cashAccounts.includes(e.accountId)) {
      if (e.debit > 0) {
        if (e.voucherType.includes('Receipt') || e.voucherType.includes('Sales')) {
          customerCollections = round2(customerCollections + e.debit);
        } else {
          financingInflows = round2(financingInflows + e.debit);
        }
      }
      if (e.credit > 0) {
        if (e.voucherType.includes('Payment') && e.partyType === 'Supplier') {
          supplierPayments = round2(supplierPayments + e.credit);
        } else {
          operatingCashOutflows = round2(operatingCashOutflows + e.credit);
        }
      }
    }
  });

  const netOperatingCash = round2(customerCollections - supplierPayments - operatingCashOutflows);
  const netInvestingCash = 0;
  const netFinancingCash = financingInflows;
  const netCashFlow = round2(netOperatingCash + netInvestingCash + netFinancingCash);

  // Opening Cash Balance from chart of accounts
  const chart = (state.chartOfAccounts && state.chartOfAccounts.length > 0)
    ? state.chartOfAccounts
    : DEFAULT_CHART_OF_ACCOUNTS;

  let openingCash = 0;
  chart.forEach(a => {
    if (cashAccounts.includes(a.id || a.code)) {
      openingCash = round2(openingCash + (a.openingDebit || 0) - (a.openingCredit || 0));
    }
  });

  const closingCash = round2(openingCash + netCashFlow);

  return {
    operating: {
      customerCollections,
      supplierPayments,
      operatingCashOutflows,
      net: netOperatingCash
    },
    investing: {
      capex: 0,
      net: netInvestingCash
    },
    financing: {
      inflows: financingInflows,
      net: netFinancingCash
    },
    netCashFlow,
    openingCash,
    closingCash
  };
};

// ----------------------------------------------------------------------------
// 8. ACCOUNTS RECEIVABLE & CUSTOMER AGING ANALYSIS (100% Real Invoices & Customers)
// ----------------------------------------------------------------------------
export const generateARAging = (state = {}) => {
  const salesInvoices = (Array.isArray(state.salesInvoices) ? state.salesInvoices : []).filter(x => !isDummyFinancialRecord(x));
  const rawCustomers = Array.isArray(state.customers) ? state.customers : [];

  const customerMap = new Map();

  // Populate from customer masters first if any
  rawCustomers.forEach(cust => {
    const cId = cust.id || cust.customerId || cust.code || 'CUST';
    const cName = cust.name || cust.customerName || 'Customer';
    customerMap.set(cId, {
      customerId: cId,
      customerName: cName,
      totalInvoiced: 0,
      totalPaid: 0,
      outstanding: 0,
      bucket_0_30: 0,
      bucket_31_60: 0,
      bucket_61_90: 0,
      bucket_90_plus: 0,
      invoices: []
    });
  });

  // Reconcile real sales invoices
  salesInvoices.forEach(inv => {
    const custId = inv.customerId || inv.customerName || 'CUST-GEN';
    const custName = inv.customerName || 'Customer';
    const total = round2(inv.grandTotal || 0);
    const invDate = new Date(inv.date || Date.now());
    const daysOld = Math.max(0, Math.floor((Date.now() - invDate.getTime()) / (1000 * 60 * 60 * 24)));

    if (!customerMap.has(custId)) {
      customerMap.set(custId, {
        customerId: custId,
        customerName: custName,
        totalInvoiced: 0,
        totalPaid: 0,
        outstanding: 0,
        bucket_0_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_90_plus: 0,
        invoices: []
      });
    }

    const c = customerMap.get(custId);
    c.totalInvoiced = round2(c.totalInvoiced + total);

    const isPaid = inv.status === 'Paid' || inv.status === 'Settled';
    if (isPaid) {
      c.totalPaid = round2(c.totalPaid + total);
    } else {
      c.outstanding = round2(c.outstanding + total);
      if (daysOld <= 30) c.bucket_0_30 = round2(c.bucket_0_30 + total);
      else if (daysOld <= 60) c.bucket_31_60 = round2(c.bucket_31_60 + total);
      else if (daysOld <= 90) c.bucket_61_90 = round2(c.bucket_61_90 + total);
      else c.bucket_90_plus = round2(c.bucket_90_plus + total);
    }

    c.invoices.push({
      id: inv.id,
      date: inv.date,
      amount: total,
      tax: inv.tax || 0,
      status: inv.status || 'Pending',
      daysOld,
      remarks: inv.remarks || ''
    });
  });

  const customersList = Array.from(customerMap.values()).filter(c => c.totalInvoiced > 0 || c.outstanding > 0 || rawCustomers.length <= 10);
  const grandTotalReceivables = round2(customersList.reduce((sum, c) => sum + c.outstanding, 0));
  const totalBilled = round2(customersList.reduce((sum, c) => sum + c.totalInvoiced, 0));
  const totalCollected = round2(customersList.reduce((sum, c) => sum + c.totalPaid, 0));

  const bucketTotals = {
    current: round2(customersList.reduce((sum, c) => sum + c.bucket_0_30, 0)),
    days_31_60: round2(customersList.reduce((sum, c) => sum + c.bucket_31_60, 0)),
    days_61_90: round2(customersList.reduce((sum, c) => sum + c.bucket_61_90, 0)),
    days_90_plus: round2(customersList.reduce((sum, c) => sum + c.bucket_90_plus, 0))
  };

  return {
    customers: customersList,
    grandTotalReceivables,
    totalBilled,
    totalCollected,
    bucketTotals
  };
};

// ----------------------------------------------------------------------------
// 9. ACCOUNTS PAYABLE & SUPPLIER AGING ANALYSIS (100% Real Bills & Vendors)
// ----------------------------------------------------------------------------
export const generateAPAging = (state = {}) => {
  const purchaseInvoices = (Array.isArray(state.purchaseInvoices) ? state.purchaseInvoices : []).filter(x => !isDummyFinancialRecord(x));
  const rawSuppliers = Array.isArray(state.suppliers) ? state.suppliers : [];

  const vendorMap = new Map();

  rawSuppliers.forEach(sup => {
    const sId = sup.id || sup.supplierId || sup.vendorId || 'VND';
    const sName = sup.name || sup.supplierName || 'Vendor';
    vendorMap.set(sId, {
      vendorId: sId,
      vendorName: sName,
      totalInvoiced: 0,
      totalPaid: 0,
      outstanding: 0,
      bucket_0_30: 0,
      bucket_31_60: 0,
      bucket_61_90: 0,
      bucket_90_plus: 0,
      invoices: []
    });
  });

  purchaseInvoices.forEach(pinv => {
    const vId = pinv.vendorId || pinv.vendorName || 'VND-GEN';
    const vName = pinv.vendorName || 'Supplier';
    const total = round2(pinv.grandTotal || 0);
    const pinvDate = new Date(pinv.date || Date.now());
    const daysOld = Math.max(0, Math.floor((Date.now() - pinvDate.getTime()) / (1000 * 60 * 60 * 24)));

    if (!vendorMap.has(vId)) {
      vendorMap.set(vId, {
        vendorId: vId,
        vendorName: vName,
        totalInvoiced: 0,
        totalPaid: 0,
        outstanding: 0,
        bucket_0_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_90_plus: 0,
        invoices: []
      });
    }

    const v = vendorMap.get(vId);
    v.totalInvoiced = round2(v.totalInvoiced + total);

    const isPaid = pinv.status === 'Paid';
    if (isPaid) {
      v.totalPaid = round2(v.totalPaid + total);
    } else {
      v.outstanding = round2(v.outstanding + total);
      if (daysOld <= 30) v.bucket_0_30 = round2(v.bucket_0_30 + total);
      else if (daysOld <= 60) v.bucket_31_60 = round2(v.bucket_31_60 + total);
      else if (daysOld <= 90) v.bucket_61_90 = round2(v.bucket_61_90 + total);
      else v.bucket_90_plus = round2(v.bucket_90_plus + total);
    }

    v.invoices.push({
      id: pinv.id,
      date: pinv.date,
      amount: total,
      tax: pinv.tax || 0,
      status: pinv.status || 'Posted',
      daysOld,
      remarks: pinv.remarks || ''
    });
  });

  const vendorsList = Array.from(vendorMap.values()).filter(v => v.totalInvoiced > 0 || v.outstanding > 0 || rawSuppliers.length <= 10);
  const grandTotalPayables = round2(vendorsList.reduce((sum, v) => sum + v.outstanding, 0));
  const totalInvoiced = round2(vendorsList.reduce((sum, v) => sum + v.totalInvoiced, 0));
  const totalPaid = round2(vendorsList.reduce((sum, v) => sum + v.totalPaid, 0));

  const bucketTotals = {
    current: round2(vendorsList.reduce((sum, v) => sum + v.bucket_0_30, 0)),
    days_31_60: round2(vendorsList.reduce((sum, v) => sum + v.bucket_31_60, 0)),
    days_61_90: round2(vendorsList.reduce((sum, v) => sum + v.bucket_61_90, 0)),
    days_90_plus: round2(vendorsList.reduce((sum, v) => sum + v.bucket_90_plus, 0))
  };

  return {
    vendors: vendorsList,
    grandTotalPayables,
    totalInvoiced,
    totalPaid,
    bucketTotals
  };
};

// ----------------------------------------------------------------------------
// 10. TAXATION & WITHHOLDING TAX REGISTERS (100% Real Invoices)
// ----------------------------------------------------------------------------
export const generateTaxRegisters = (state = {}) => {
  const salesInvoices = Array.isArray(state.salesInvoices) ? state.salesInvoices : [];
  const purchaseInvoices = Array.isArray(state.purchaseInvoices) ? state.purchaseInvoices : [];
  const rawVouchers = Array.isArray(state.vouchers) ? state.vouchers : (Array.isArray(state.paymentVouchers) ? state.paymentVouchers : []);

  const outputRegister = salesInvoices.map(inv => ({
    id: inv.id,
    date: inv.date,
    partyName: inv.customerName || 'Customer',
    taxId: inv.strn || 'STRN-Registered',
    taxableValue: round2(inv.subtotal || (inv.grandTotal - (inv.tax || 0))),
    taxRate: '18%',
    taxAmount: round2(inv.tax || 0),
    invoiceTotal: round2(inv.grandTotal || 0)
  }));

  const totalOutputTax = round2(outputRegister.reduce((sum, r) => sum + r.taxAmount, 0));

  const inputRegister = purchaseInvoices.map(pinv => ({
    id: pinv.id,
    date: pinv.date,
    partyName: pinv.vendorName || 'Supplier',
    taxId: pinv.strn || 'STRN-Vendor',
    taxableValue: round2(pinv.subtotal || (pinv.grandTotal - (pinv.tax || 0))),
    taxRate: '18%',
    taxAmount: round2(pinv.tax || 0),
    invoiceTotal: round2(pinv.grandTotal || 0)
  }));

  const totalInputTax = round2(inputRegister.reduce((sum, r) => sum + r.taxAmount, 0));
  const netSalesTaxPayable = round2(totalOutputTax - totalInputTax);

  // Extract WHT deductions from vouchers where lines match 213010 or WHT is noted
  const whtRegister = [];
  rawVouchers.forEach(v => {
    if (Array.isArray(v.lines)) {
      v.lines.forEach(l => {
        if (l.accountId === '213010' || (l.accountName && l.accountName.toLowerCase().includes('withholding'))) {
          const amt = round2(l.credit || l.debit || 0);
          if (amt > 0) {
            whtRegister.push({
              id: `WHT-${v.id}`,
              date: v.date,
              party: v.party || v.paidTo || l.accountName,
              section: 'Sec 153 Withholding',
              grossAmount: amt * 20, // estimated gross
              rate: '5.0%',
              whtAmount: amt,
              cprNo: v.reference || 'Pending Deposit',
              status: 'Deducted'
            });
          }
        }
      });
    }
  });

  const totalWht = round2(whtRegister.reduce((sum, r) => sum + r.whtAmount, 0));

  return {
    outputRegister,
    totalOutputTax,
    inputRegister,
    totalInputTax,
    netSalesTaxPayable,
    whtRegister,
    totalWht
  };
};

// ----------------------------------------------------------------------------
// 11. BANK & CASH RECONCILIATION
// ----------------------------------------------------------------------------
export const generateBankReconciliation = (state = {}, accountId = '112010', statementEndingBalance = null) => {
  const gl = generateGeneralLedger(state, { accountId });
  const chart = (state.chartOfAccounts && state.chartOfAccounts.length > 0)
    ? state.chartOfAccounts
    : DEFAULT_CHART_OF_ACCOUNTS;
  
  const acc = chart.find(a => (a.id === accountId || a.code === accountId));
  const openingBalance = round2(acc?.openingDebit || 0);

  const entries = gl.entries;
  const netMovement = round2(entries.reduce((sum, e) => sum + (e.debit - e.credit), 0));
  const bookBalance = round2(openingBalance + netMovement);

  const clearedEntries = [...entries];
  const unclearedDeposits = [];
  const unclearedPayments = [];

  const totalUnclearedDeposits = 0;
  const totalUnclearedPayments = 0;

  const targetStatement = statementEndingBalance !== null
    ? Number(statementEndingBalance)
    : bookBalance;

  const adjustedBankBalance = round2(targetStatement + totalUnclearedDeposits - totalUnclearedPayments);
  const difference = round2(bookBalance - adjustedBankBalance);

  return {
    accountId,
    accountName: acc?.name || 'Bank Account',
    bookBalance,
    statementBalance: targetStatement,
    clearedEntries,
    unclearedDeposits,
    totalUnclearedDeposits,
    unclearedPayments,
    totalUnclearedPayments,
    adjustedBankBalance,
    difference,
    isReconciled: Math.abs(difference) < 0.01
  };
};

// ----------------------------------------------------------------------------
// 12. COST CENTERS & DEPARTMENTAL BUDGETS
// ----------------------------------------------------------------------------
export const generateCostCenterReport = (state = {}) => {
  const gl = generateGeneralLedger(state);
  const costCenters = DEFAULT_COST_CENTERS;

  const actualsMap = new Map();
  gl.entries.forEach(e => {
    if (e.costCenter && e.debit > 0) {
      const current = actualsMap.get(e.costCenter) || 0;
      actualsMap.set(e.costCenter, round2(current + e.debit));
    }
  });

  const rows = costCenters.map(cc => {
    const actual = actualsMap.get(cc.id) || 0;
    const budget = cc.monthlyBudget;
    const variance = round2(budget - actual);
    const percentUsed = budget > 0 ? round2((actual / budget) * 100) : 0;

    return {
      ...cc,
      actualSpent: actual,
      variance,
      percentUsed,
      isOverBudget: actual > budget
    };
  });

  const totalBudget = round2(costCenters.reduce((sum, cc) => sum + cc.monthlyBudget, 0));
  const totalSpent = round2(rows.reduce((sum, r) => sum + r.actualSpent, 0));
  const netVariance = round2(totalBudget - totalSpent);

  return {
    rows,
    totalBudget,
    totalSpent,
    netVariance
  };
};

// ----------------------------------------------------------------------------
// 13. EXECUTIVE FINANCE OVERVIEW KPIS (100% Real-Time Calculated)
// ----------------------------------------------------------------------------
export const generateFinanceOverviewKpis = (state = {}) => {
  const pnl = generateProfitAndLoss(state);
  const bs = generateBalanceSheet(state);
  const ar = generateARAging(state);
  const ap = generateAPAging(state);
  const cash = generateCashFlow(state);
  const gl = generateGeneralLedger(state);

  const cashAndBank = cash.closingCash;
  const totalReceivables = ar.grandTotalReceivables;
  const totalPayables = ap.grandTotalPayables;
  const netRevenue = pnl.revenue.netSales;
  const netProfit = pnl.netProfit;
  const grossProfit = pnl.grossProfit;
  const grossMargin = pnl.grossMarginPercent;
  const netMargin = pnl.netMarginPercent;

  const currentRatio = bs.liabilities.totalCurrent > 0
    ? round2(bs.assets.totalCurrent / bs.liabilities.totalCurrent)
    : 0;

  const quickAssets = round2(cashAndBank + totalReceivables);
  const quickRatio = bs.liabilities.totalCurrent > 0
    ? round2(quickAssets / bs.liabilities.totalCurrent)
    : 0;

  const dso = netRevenue > 0
    ? Math.round((totalReceivables / netRevenue) * 90)
    : 0;

  return {
    cashAndBank,
    totalReceivables,
    totalPayables,
    netRevenue,
    netProfit,
    grossProfit,
    grossMargin,
    netMargin,
    currentRatio,
    quickRatio,
    dso,
    recentTransactions: gl.entries.slice(-10).reverse()
  };
};
