# FlashVision ERP — Comprehensive Print & Reporting System Audit
**Document File:** `/home/hatch/workspace/erp/PRINT_AUDIT.md`  
**Generated For:** FlashVision ERP Print & Reporting Architecture Overhaul  
**Target Application:** `sale_orders_app` (Vite + React 19 + Tailwind CSS)  
**Date:** October 2026  
**Auditor:** Antigravity AI Senior Design & Architecture Specialist  

---

## 1. Executive Summary & Problem Diagnosis

### The Core Problem
The FlashVision ERP printing system suffered from a fundamental architectural limitation: **all printed documents were forced into a single generic commercial billing template** (a standard dual-column header with small logo and basic blue/slate bordered table). 

While a classic billing template works adequately for Sale Orders or Invoices, it is completely unsuitable for:
1. **Manufacturing Floor & Job Slips:** Factory operators need heavy bold typography, prominent batch/job identifiers readable from 3 meters away, machine & shift assignment badges, physical sign-off checkboxes for step-by-step clearance, and high-contrast ink-saving monochrome layouts that remain legible when printed on low-cost thermal or grayscale laser printers.
2. **Warehouse & Logistics Documents (DC, Gate Passes, GRN):** Require driver identification blocks, vehicle number badges, carrier consignee acknowledgment boxes, and physical inspection pass/reject tally columns.
3. **Financial Ledgers & Tax Reports:** Require high data density, tabular numeric alignment (`tabular-nums`), multi-page repeating table headers, running balance columns, and audit stamp boxes.
4. **Human Resources & Workforce Documents:** Require confidentiality watermarks, employee identity badges, earnings vs. deductions dual-split grids, and biometric punch audit times.

### Architectural Root Causes
1. **Generic Layout Container:** `src/components/ui/PrintLayout.jsx` and `src/components/ui/UniversalPrintStudioModal.jsx` shared a single hardcoded HTML structure with minimal style variation.
2. **Disconnected Print Methods:** Several modules (`FlashAM.jsx`, `MasterBatchRecord.jsx`, `SalesInvoiceHistory.jsx`, `Vouchers.jsx`) bypassed the schema registry completely and generated raw, un-themeable HTML strings inside detached `window.open()` popups.
3. **Contrast & Color Hazards:** Header background colors lacked strict programmatic contrast enforcement, resulting in low readability when users selected saturated or dark accent colors without tested WCAG AA pairings.
4. **Lack of Per-Document Theming:** The existing settings allowed customizing margins and fonts, but could not switch between distinct layout archetypes (e.g., **Classic Corporate**, **Modern Minimal**, **Industrial Shop-Floor**).

---

## 2. Complete Catalog of Print Entry Points Across Modules

| # | File / Component | Module / Route | Trigger Mechanism | Target Document / Output | Current Implementation |
|---|---|---|---|---|---|
| 1 | `src/pages/SaleOrderModule.jsx` (L2468) | OMS (`/sale-orders`) | Action Menu -> Print Studio | Sale Order (`sale_order`) | `UniversalPrintStudioModal` |
| 2 | `src/pages/SaleOrderModule.jsx` (L548) | OMS (`/sale-orders`) | Quick Print Button | Sale Order Print Slip | Direct `window.print()` with CSS |
| 3 | `src/components/delivery/DelRecord.jsx` (L79, L242) | Delivery (`/delivery-dashboard`) | Gear Studio Button | Delivery Challan (`delivery_challan`) | `UniversalPrintStudioModal` |
| 4 | `src/components/delivery/DelRecord.jsx` (L25, L248) | Delivery (`/delivery-dashboard`) | Quick Print Icon | Delivery Challan (`delivery_challan`) | Direct `window.print()` via `PrintLayout` |
| 5 | `src/components/delivery/DelCreationSlip.jsx` (L267, L618) | Delivery (`/delivery-dashboard`) | Print Button in Wizard | Delivery Challan Draft | Direct `window.print()` via `PrintLayout` |
| 6 | `src/components/settings/PrintSettings.jsx` (L72, L364) | Settings (`/settings?tab=print_settings`) | Studio Preview / Test | All 32+ ERP Documents | Dedicated preview + `UniversalPrintStudioModal` |
| 7 | `src/components/oms/OmsSlip.jsx` (L29, L155) | OMS / Flow (`/production-flow`) | Print Slip Button | Final Production Slip / Routing | Direct `window.print()` via `PrintLayout` |
| 8 | `src/components/oms/OmsHistory.jsx` (L19, L314) | OMS / Flow (`/production-flow`) | History Print Button | Planning History Slip | Direct `window.print()` via `PrintLayout` |
| 9 | `src/pages/ProductionModule.jsx` (L751, L837) | Production (`/production`) | Action Buttons (BOM / Run) | BOM Slip & Production Order | Direct `window.print()` |
| 10 | `src/components/production/CreateNewBOM.jsx` (L250) | Production (`/production`) | View Mode -> Print BOM | BOM Formulation Sheet | Direct `window.print()` |
| 11 | `src/components/production/BatchClosing.jsx` (L31, L157) | Production (`/production`) | Print Summary Button | Batch Closing Report | Direct `window.print()` via `PrintLayout` |
| 12 | `src/components/production/MasterBatchRecord.jsx` (L513) | Production (`/production`) | Print Record Button | Master Batch Record (MBR) | Detached `window.open` raw HTML |
| 13 | `src/components/production/ConsumptionHistory.jsx` (L310) | Production (`/production`) | Print Log Action | Material Consumption History | Direct `window.print()` |
| 14 | `src/components/production/OtherConsumption.jsx` (L366) | Production (`/production`) | Print Log Action | Other Consumptions Slip | Direct `window.print()` |
| 15 | `src/components/production/StockDemandHistory.jsx` (L153) | Production (`/production`) | Print Demand Action | Stock Demand / Requisition | Direct `window.print()` |
| 16 | `src/components/production/StockReceivingHistory.jsx` (L137) | Production (`/production`) | Print Receipt Action | Stock Receiving Note | Direct `window.print()` |
| 17 | `src/components/inventory/InvLedger.jsx` (L401, L814) | Inventory (`/inventory`) | Print Ledger Button | Inventory Stock Ledger | Direct `window.print()` via `PrintLayout` |
| 18 | `src/components/inventory/InvAdjustment.jsx` (L203, L559) | Inventory (`/inventory`) | Print Adjustment Button | Stock Adjustment Note | Direct `window.print()` via `PrintLayout` |
| 19 | `src/components/inventory/InventoryAdjustmentHistory.jsx` (L244) | Inventory (`/inventory`) | Print Row Action | Stock Adjustment Note | Direct `window.print()` |
| 20 | `src/components/inventory/InvReturn.jsx` (L133, L456) | Inventory (`/inventory`) | Print Return Slip | Inventory Return Note | Direct `window.print()` via `PrintLayout` |
| 21 | `src/components/inventory/StockTransferHistory.jsx` (L192) | Inventory (`/inventory`) | Print Row Action | Stock Transfer Note | Direct `window.print()` |
| 22 | `src/pages/SaleOrderReturn.jsx` (L22, L134) | OMS (`/sale-order-return`) | Print Return Button | Sale Order Return Note | Direct `window.print()` via `PrintLayout` |
| 23 | `src/components/finance/SalesInvoiceHistory.jsx` (L281, L457) | Finance (`/finance`) | Print Invoice Action | Tax Sale Invoice | Detached `window.open` raw HTML |
| 24 | `src/components/finance/PurchaseInvoiceHistory.jsx` (L280, L461) | Finance (`/finance`) | Print Bill Action | Purchase Invoice / Bill | Detached `window.open` raw HTML |
| 25 | `src/components/finance/Vouchers.jsx` (L458, L1152) | Finance (`/finance`) | Print Voucher Action | Receipt / Payment / Journal Voucher | Detached `window.open` raw HTML |
| 26 | `src/components/finance/LedgerTaxDashboard.jsx` (L232, L474) | Finance (`/finance`) | Print Voucher Action | General Ledger / Tax Voucher | Detached `window.open` raw HTML |
| 27 | `src/components/finance/GeneralLedger.jsx` (L103, L161) | Finance (`/finance`) | Print Ledger Action | Financial General Ledger | Direct `window.print()` |
| 28 | `src/components/finance/AccountsPayable.jsx` (L38, L59, L350) | Finance (`/finance`) | Print AP / Statement | AP Summary & Vendor Aging | Direct `window.print()` |
| 29 | `src/components/finance/AccountsReceivable.jsx` (L39, L60, L351) | Finance (`/finance`) | Print AR / Statement | AR Summary & Customer Aging | Direct `window.print()` |
| 30 | `src/components/finance/FinancialStatements.jsx` (L72, L121) | Finance (`/finance`) | Print Report Button | Balance Sheet & Profit & Loss | Direct `window.print()` |
| 31 | `src/components/finance/BankReconciliation.jsx` (L77, L107) | Finance (`/finance`) | Print BRS Button | Bank Reconciliation Sheet | Direct `window.print()` |
| 32 | `src/components/finance/CostCenters.jsx` (L17, L38) | Finance (`/finance`) | Print Variance Report | Cost Center Performance | Direct `window.print()` |
| 33 | `src/components/finance/TaxManagement.jsx` (L32, L53, L372) | Finance (`/finance`) | Print Return / WHT Cert | Tax Return & WHT Certificate | Direct `window.print()` |
| 34 | `src/components/hr/HRAdvanceRequest.jsx` (L273, L520) | HR (`/hr`) | Print Advance Form | Employee Advance Slip | Direct `window.print()` |
| 35 | `src/components/hr/HROvertime.jsx` (L901, L918) | HR (`/hr`) | Print Overtime Form | Overtime Claim Sheet | Direct `window.print()` via `PrintLayout` |
| 36 | `src/components/hr/HROnboarding.jsx` (L1096, L1253) | HR (`/hr`) | Print Clearance Slip | Employee Onboarding Form | Detached `window.open` raw HTML |
| 37 | `src/components/hr/HRLoanRequest.jsx` (L200) | HR (`/hr`) | Print Loan Request | Employee Loan Form | Route redirect to Print Studio |
| 38 | `src/pages/FlashAM.jsx` (L1084, L1169) | Attendance Terminal (`/flash-am`) | Export Printable Report | Biometric Attendance Sheet | Detached `window.open` raw HTML |
| 39 | `src/pages/ChatModule.jsx` (L4557, L5680) | Chat / Copilot (`/chat`) | Print Transaction Button | Transaction Receipt / Summary | Direct `window.print()` via `PrintLayout` |
| 40 | `src/components/settings/ProfileCardModal.jsx` (L7) | Settings / Profile (`/profile`) | Print ID Card | Employee Identity Card | Direct `window.print()` |

---

## 3. Comprehensive Document Type Catalog

The FlashVision ERP schema registry encompasses **33 distinct document types** across 6 business divisions. Below is the field-level catalog:

---

### Module 1: Order Management System (OMS)

#### 1. Sale Order (`sale_order`)
- **Document Code:** `SO`
- **Archetype:** Commercial Billing & Quotation
- **Header Fields:**
  - `so_number` (Sale Order #) — `span-1`, enabled
  - `date` (Order Date) — `span-1`, enabled
  - `status` (Order Status: Draft / Confirmed / Approved) — `span-1`, enabled
  - `customer` (Customer Name) — `span-2`, enabled
  - `contact` (Contact Person / Phone) — `span-1`, enabled
  - `shipping_address` (Delivery Destination) — `span-3`, enabled
  - `salesperson` (Sales Representative) — `span-1`, enabled
  - `payment_terms` (Payment Terms: Net 30, Advance, COD) — `span-1`, enabled
  - `delivery_date` (Expected Delivery Date) — `span-1`, enabled
- **Grid Columns:**
  - `serial_no` (Sr #) — 8%, center
  - `item_code` (Item Code / SKU) — 15%, left
  - `item_name` (Item Name & Specification) — 30%, left
  - `rolls` (Rolls Count) — 9%, center
  - `qty` (Quantity / Length in Meters) — 12%, right
  - `uom` (Unit of Measure) — 8%, center
  - `rate` (Unit Rate in Currency) — 12%, right
  - `discount` (Discount Percentage/Amount) — 8%, right
  - `sub_total` (Line Total Amount) — 15%, right
- **Totals / Financials:** `subtotal`, `tax` (Sales Tax / GST), `discount`, `grandTotal`
- **Footers & Signatures:**
  - Signatures: Prepared By (text), Verified By (text), Authorized Signatory (stamp box)
  - Terms: Standard payment terms, inspection grace period (48h), delivery terms
  - Disclaimer: Official computer-generated document notice

#### 2. Planning History / Production Job Slip (`planning_history`)
- **Document Code:** `PLN`
- **Archetype:** Manufacturing Floor Routing Slip
- **Header Fields:**
  - `plan_id` (Plan Reference #) — `span-1`, enabled
  - `plan_date` (Planning Date) — `span-1`, enabled
  - `planner_name` (Master Production Scheduler) — `span-1`, enabled
  - `production_line` (Allocated Machine / Line #) — `span-1`, enabled
  - `status` (Execution Status: Scheduled / Running / Closed) — `span-1`, enabled
- **Grid Columns:**
  - `serial_no` (Sr #) — 8%, center
  - `order_ref` (SO Reference #) — 18%, left
  - `item_name` (Target Product / Article) — 32%, left
  - `target_qty` (Planned Batch Quantity) — 14%, right
  - `allocated_shift` (Shift: Morning / Evening / Night) — 14%, center
  - `est_hours` (Estimated Machine Hours) — 14%, right
- **Totals / Floor Metrics:** `totalPlannedQty`, `totalHours`
- **Footers & Signatures:**
  - Signatures: Machine Allocation Sign, Shift Operator Sign, Floor Supervisor Sign
  - Floor Notes: Machine setup instructions, safety guidelines, tool requirements

---

### Module 2: Manufacturing & Production Module

#### 3. BOM Master (`bom_master`)
- **Document Code:** `BOM`
- **Archetype:** Technical Engineering Recipe
- **Header Fields:**
  - `bom_code` (BOM Formulation Code) — `span-1`, enabled
  - `bom_name` (Formula Description) — `span-2`, enabled
  - `product_code` (Finished Product SKU) — `span-1`, enabled
  - `version` (Engineering Revision Rev X.X) — `span-1`, enabled
  - `std_batch_size` (Standard Formulation Batch Size) — `span-1`, enabled
- **Grid Columns:**
  - `serial_no` (Sr #) — 8%, center
  - `component_code` (Raw Material Code) — 20%, left
  - `component_name` (Chemical / Fabric Ingredient) — 34%, left
  - `phase` (Production Phase: Top / Foam / Packing) — 14%, center
  - `qty_per_batch` (Required Qty per Batch) — 12%, right
  - `uom` (Unit of Measure: kg, L, m) — 12%, center
- **Totals:** `batchComponentsCount`
- **Footers & Signatures:**
  - Signatures: Formulated By Chemist, Approved By Technical Director, QA Verification

#### 4. Batch Closing History (`batch_closing_history`)
- **Document Code:** `BCH`
- **Archetype:** Floor Quality & Yield Audit
- **Header Fields:**
  - `batch_no` (Production Batch #) — `span-1`, enabled
  - `closing_date` (Batch Completion Date) — `span-1`, enabled
  - `supervisor` (Floor In-Charge) — `span-1`, enabled
  - `output_yield_percent` (Yield Efficiency %) — `span-1`, enabled
- **Grid Columns:**
  - `serial_no` (Sr #) — 8%, center
  - `step_name` (Process Stage / Operation) — 25%, left
  - `planned_qty` (Input Raw Material Qty) — 15%, right
  - `actual_output` (Actual Finished Output) — 15%, right
  - `waste_qty` (Scrap / Wastage Qty) — 15%, right
  - `variance` (Variance Percentage) — 22%, center
- **Totals:** `totalInput`, `totalOutput`, `totalWaste`
- **Footers & Signatures:**
  - Signatures: Machine Operator, Quality Control Inspector, Factory Manager

#### 5. Master Batch Record (`master_batch_record`)
- **Document Code:** `MBR`
- **Archetype:** GMP / Floor Compliance Routing Record
- **Header Fields:**
  - `mbr_no` (Master Batch Code) — `span-1`, enabled
  - `product_name` (Finished Product Description) — `span-2`, enabled
  - `batch_size` (Standard Batch Target Size) — `span-1`, enabled
  - `qa_sign` (QA Release Authorization Code) — `span-1`, enabled
- **Grid Columns:**
  - `step_no` (Process Step #) — 10%, center
  - `operation` (Standard Operating Procedure Step) — 30%, left
  - `parameters` (Process Parameters: Temp, Speed, Pressure) — 30%, left
  - `spec_limit` (Acceptable Tolerance Limits) — 15%, center
  - `sign_off` (Operator Physical Initial & Time) — 15%, center
- **Totals:** `totalSteps`, `massBalanceEfficiency`
- **Footers & Signatures:**
  - Signatures: Produced By Operator, QC Assurance Officer, Plant Manager Sign-off

#### 6. Stock Receiving History (`stock_receiving_history`)
- **Document Code:** `SRH`
- **Header Fields:** `receiving_no`, `date`, `supplier`, `grn_ref`
- **Grid Columns:** `serial_no`, `item_code`, `item_name`, `received_qty`, `accepted_qty`, `rejected_qty`
- **Totals:** `totalReceived`, `totalAccepted`, `totalRejected`
- **Footers:** Store In-charge, Quality Inspector

#### 7. Consumption History (`consumption_history`)
- **Document Code:** `CSH`
- **Header Fields:** `log_id`, `date`, `batch_no`, `department`
- **Grid Columns:** `serial_no`, `material_code`, `material_name`, `consumed_qty`, `uom`
- **Totals:** `totalConsumed`
- **Footers:** Material Dispenser, Line Operator

#### 8. Inventory Adjustment (`inventory_adjustment`)
- **Document Code:** `ADJ`
- **Header Fields:** `adj_id`, `date`, `approved_by`, `reason`
- **Grid Columns:** `serial_no`, `item_code`, `item_name`, `system_qty`, `physical_qty`, `adj_qty`
- **Totals:** `totalVariance`
- **Footers:** Stock Auditor, Warehouse Manager, Financial Controller

#### 9. Stock Demand / Store Requisition (`stock_demand`)
- **Document Code:** `SKD`
- **Header Fields:** `demand_no`, `date`, `from_dept`, `to_store`
- **Grid Columns:** `serial_no`, `item_code`, `item_name`, `demanded_qty`, `uom`
- **Totals:** `totalDemandedItems`
- **Footers:** Requested By, Approved HOD, Store Keeper

#### 10. Other Consumptions (`other_consumptions`)
- **Document Code:** `OTC`
- **Header Fields:** `ref_no`, `date`, `cost_center`, `category`
- **Grid Columns:** `serial_no`, `item_name`, `qty`, `uom`, `remarks`
- **Totals:** `totalConsumedQty`
- **Footers:** Logged By, Verified HOD

---

### Module 3: Inventory & Warehouse Management

#### 11. Inventory Stock Ledger (`inventory_ledger`)
- **Document Code:** `IVL`
- **Archetype:** Accounting & Stock Movement Ledger
- **Header Fields:**
  - `ledger_id` (Ledger Account Code) — `span-1`, enabled
  - `period` (Audit Period / Date Range) — `span-2`, enabled
  - `warehouse` (Store / Warehouse Facility) — `span-1`, enabled
- **Grid Columns:**
  - `date` (Transaction Date / Timestamp) — 12%, center
  - `ref_no` (Document Reference #) — 18%, left
  - `item_name` (Inventory Description & SKU) — 28%, left
  - `qty_in` (Inward Received Qty) — 14%, right
  - `qty_out` (Outward Issued Qty) — 14%, right
  - `balance` (Running Stock Balance) — 14%, right
- **Totals:** `totalInward`, `totalOutward`, `closingBalance`
- **Footers:** Warehouse Custodian, Chief Inventory Auditor

#### 12. Goods Receiving Note (`grn_note`)
- **Document Code:** `GRN`
- **Archetype:** Inward Receiving & QC Gate Note
- **Header Fields:**
  - `grn_number` (GRN #) — `span-1`, enabled
  - `grn_date` (Receiving Date) — `span-1`, enabled
  - `po_ref` (Purchase Order Ref #) — `span-1`, enabled
  - `supplier_name` (Supplier / Vendor) — `span-2`, enabled
  - `inspector` (QC Inspector Name) — `span-1`, enabled
- **Grid Columns:**
  - `serial_no` (Sr #) — 8%, center
  - `item_code` (Item SKU) — 18%, left
  - `item_name` (Material Description) — 30%, left
  - `ordered_qty` (PO Quantity) — 11%, right
  - `received_qty` (Delivered Quantity) — 11%, right
  - `accepted_qty` (Passed Inspection Qty) — 11%, right
  - `rejected_qty` (Rejected / Defective Qty) — 11%, right
- **Totals:** `totalReceived`, `totalAccepted`, `totalRejected`
- **Footers & Signatures:** QC Inspector, Store Receiving Officer, Accounts Verification

#### 13. Inward Gate Pass (`inward_gate_pass`)
- **Document Code:** `IGP`
- **Archetype:** Security Gate Clearance Manifest
- **Header Fields:**
  - `gate_pass_no` (Gate Pass #) — `span-1`, enabled
  - `entry_time` (Date & Inward Timestamp) — `span-1`, enabled
  - `driver_name` (Driver Name / CNIC) — `span-1`, enabled
  - `vehicle_no` (Truck / Vehicle Registration) — `span-1`, enabled
  - `supplier` (Vendor / Source Origin) — `span-2`, enabled
- **Grid Columns:**
  - `serial_no` (Sr #) — 8%, center
  - `item_description` (Consignment Description) — 40%, left
  - `chalan_qty` (Delivery Challan Qty) — 18%, right
  - `no_of_packages` (Package / Carton Count) — 17%, center
  - `weight` (Gross Weighbridge Weight kg) — 17%, right
- **Totals:** `totalPackages`, `grossWeight`
- **Footers & Signatures:** Security Gate Officer, Transporter / Driver, Store Officer

#### 14. Purchase Order (`purchase_order`)
- **Document Code:** `PO`
- **Header Fields:** `po_number`, `po_date`, `supplier_name`, `payment_terms`, `delivery_location`
- **Grid Columns:** `serial_no`, `item_code`, `item_name`, `qty`, `unit_price`, `tax`, `amount`
- **Totals:** `subtotal`, `taxAmount`, `grandTotal`
- **Footers:** Procurement Manager, Finance Approver, Supplier Acceptance

#### 15. Purchase Demand / Requisition (`purchase_demand`)
- **Document Code:** `PRD`
- **Header Fields:** `pr_no`, `date`, `requestor`, `priority`
- **Grid Columns:** `serial_no`, `item_code`, `item_name`, `required_qty`, `needed_by`
- **Totals:** `totalRequestedItems`
- **Footers:** Requesting Department HOD, Procurement Head

#### 16. Inventory Return (`inventory_return`)
- **Document Code:** `IRT`
- **Header Fields:** `return_no`, `date`, `party_name`, `reason`
- **Grid Columns:** `serial_no`, `item_code`, `item_name`, `inv_qty`, `returned_qty`, `unit_price`
- **Totals:** `totalReturnedQty`, `totalReturnValue`
- **Footers:** Returned By, Store Acceptance, Quality Recheck

#### 17. Stock Transfer (`stock_transfer`)
- **Document Code:** `STF`
- **Header Fields:** `transfer_no`, `date`, `from_warehouse`, `to_warehouse`
- **Grid Columns:** `serial_no`, `item_code`, `item_name`, `transfer_qty`, `uom`
- **Totals:** `totalTransferQty`
- **Footers:** Dispatching Store Officer, Driver / Carrier, Receiving Store Officer

---

### Module 4: Delivery & Logistics

#### 18. Delivery Challan (`delivery_challan`)
- **Document Code:** `DC`
- **Archetype:** Logistics Dispatch & Consignee Acknowledgment
- **Header Fields:**
  - `challan_no` (Delivery Challan #) — `span-1`, enabled
  - `dispatch_date` (Date & Time of Departure) — `span-1`, enabled
  - `so_ref` (Sale Order Reference #) — `span-1`, enabled
  - `customer_name` (Consignee / Customer Name) — `span-2`, enabled
  - `shipping_address` (Destination Delivery Address) — `span-3`, enabled
  - `vehicle_no` (Dispatch Vehicle Number) — `span-1`, enabled
  - `driver_name` (Driver Name & Cell #) — `span-1`, enabled
- **Grid Columns:**
  - `serial_no` (Sr #) — 8%, center
  - `item_code` (Product SKU) — 18%, left
  - `item_name` (Finished Good Description) — 32%, left
  - `dispatch_qty` (Quantity Dispatched) — 14%, right
  - `packing_type` (Packaging: Rolls / Bales / Cartons) — 14%, center
  - `net_weight` (Net Weight in kg) — 14%, right
- **Totals:** `totalPackages`, `totalWeight`
- **Footers & Signatures:**
  - Dispatch Officer, Driver Signature, Receiver Name / Stamp & CNIC # line

---

### Module 5: Finance & Accounting

#### 19. Sale Invoice (`sale_invoice`)
- **Document Code:** `INV`
- **Archetype:** Formal Tax Invoice
- **Header Fields:** `invoice_no`, `invoice_date`, `due_date`, `customer_name`, `salesperson`, `billing_address`
- **Grid Columns:** `serial_no`, `item_code`, `item_name`, `qty`, `unit_price`, `tax_rate`, `amount`
- **Totals:** `subtotal`, `tax`, `discount`, `grandTotal`
- **Footers:** Bank wire transfer details, NTN/STRN registration, Authorized Signatory

#### 20. Purchase Invoice / Bill (`purchase_invoice`)
- **Document Code:** `PINV`
- **Header Fields:** `bill_no`, `bill_date`, `po_ref`, `supplier_name`, `payment_status`
- **Grid Columns:** `serial_no`, `item_code`, `item_name`, `qty`, `unit_rate`, `total_amount`
- **Totals:** `subtotal`, `tax`, `netPayable`
- **Footers:** Accounts Payable Officer, CFO Approval

#### 21. Chart of Accounts (`chart_of_accounts`)
- **Document Code:** `COA`
- **Header Fields:** `report_title`, `print_date`, `filtered_by`
- **Grid Columns:** `account_code`, `account_name`, `type`, `current_balance`
- **Totals:** `totalDebitBalance`, `totalCreditBalance`
- **Footers:** Chief Accountant, External Auditor

#### 22. Tax & Ledger Reports (`tax_ledger_reports`)
- **Document Code:** `TLR`
- **Header Fields:** `tax_period`, `ntn_number`, `generated_on`
- **Grid Columns:** `date`, `voucher_no`, `party_name`, `taxable_val`, `tax_amount`
- **Totals:** `totalTaxableValue`, `totalTaxCollected`
- **Footers:** Tax Manager, Financial Controller

#### 23. Receipt Voucher (`voucher_receipt`)
- **Document Code:** `RVR`
- **Header Fields:** `voucher_no`, `date`, `received_from`, `payment_mode`
- **Grid Columns:** `serial_no`, `account_head`, `narration`, `amount`
- **Totals:** `totalReceivedAmount`
- **Footers:** Cashier / Accountant, Verified By, Receiver

#### 24. Payment Voucher (`voucher_payment`)
- **Document Code:** `PVR`
- **Header Fields:** `voucher_no`, `date`, `paid_to`, `cheque_no`
- **Grid Columns:** `serial_no`, `account_head`, `narration`, `amount`
- **Totals:** `totalPaidAmount`
- **Footers:** Prepared By, Verified By, CFO, Payee Signature

#### 25. Journal Voucher (`voucher_journal`)
- **Document Code:** `JVR`
- **Header Fields:** `voucher_no`, `date`, `prepared_by`, `notes`
- **Grid Columns:** `serial_no`, `account_head`, `narration`, `debit`, `credit`
- **Totals:** `totalDebit`, `totalCredit`
- **Footers:** Accountant, Internal Auditor, Head of Accounts

#### 26. Contra Voucher (`voucher_contra`)
- **Document Code:** `CVR`
- **Header Fields:** `voucher_no`, `date`, `bank_account`
- **Grid Columns:** `serial_no`, `account_head`, `debit`, `credit`
- **Totals:** `totalDebit`, `totalCredit`
- **Footers:** Cashier, Treasury Manager

---

### Module 6: Human Resources & Workforce Management

#### 27. Salary Slip / Payslip (`hr_payslip`)
- **Document Code:** `PAY`
- **Archetype:** Confidential Payroll Record
- **Header Fields:**
  - `payslip_no` (Payslip Ref #) — `span-1`, enabled
  - `pay_period` (Salary Month & Year) — `span-1`, enabled
  - `emp_id` (Employee ID Code) — `span-1`, enabled
  - `emp_name` (Full Employee Name) — `span-2`, enabled
  - `designation` (Job Title) — `span-1`, enabled
  - `bank_account` (Bank IBAN / Account #) — `span-2`, enabled
- **Grid Columns:**
  - `type` (Component: Earnings / Deduction) — 25%, left
  - `earnings` (Description: Basic, Rent, OT, Tax, PF) — 35%, left
  - `earn_amount` (Earned Amount) — 20%, right
  - `ded_amount` (Deduction Amount) — 20%, right
- **Totals:** `totalEarnings`, `totalDeductions`, `grandTotal` (Net Disbursed Salary)
- **Footers & Signatures:** Payroll Accountant, Employee Acknowledgment Signature

#### 28. Employee Onboarding Wizard Slip (`hr_onboarding`)
- **Document Code:** `ONB`
- **Header Fields:** `emp_id`, `emp_name`, `designation`, `department`, `joining_date`
- **Grid Columns:** `step_no`, `clearance_item`, `status`, `sign`
- **Totals:** `stepsCompleted`
- **Footers:** HR Executive, Department Head, Candidate Signature

#### 29. Leave Request Form (`hr_leave_request`)
- **Document Code:** `LRF`
- **Header Fields:** `leave_id`, `emp_name`, `department`, `leave_type`, `duration`
- **Grid Columns:** `serial_no`, `date`, `type`, `reason`
- **Totals:** `totalDays`
- **Footers:** Employee, Supervisor, HR Authorization

#### 30. Overtime Request Form (`hr_overtime_request`)
- **Document Code:** `OTR`
- **Header Fields:** `ot_id`, `emp_name`, `month_year`, `department`
- **Grid Columns:** `serial_no`, `work_date`, `hours`, `rate_multiplier`, `task_description`
- **Totals:** `totalHours`
- **Footers:** Employee, Production In-charge, HR Generalist

#### 31. Loan Request Form (`hr_loan_request`)
- **Document Code:** `LNR`
- **Header Fields:** `request_id`, `date_applied`, `employee_id`, `employee_name`, `department`, `loan_type`, `loan_amount`, `repayment_term`, `monthly_installment`, `repayment_start_date`
- **Grid Columns:** `month_no`, `due_date`, `installment_amount`, `status`
- **Totals:** `totalLoanAmount`, `totalInstallments`, `monthlyDeduction`
- **Footers:** Employee, Guarantor, Managing Director

#### 32. Advance Request Form (`hr_advance_request`)
- **Document Code:** `ADV`
- **Header Fields:** `request_id`, `date_applied`, `employee_id`, `employee_name`, `department`, `advance_amount`, `deduction_month`
- **Grid Columns:** `serial_no`, `recovery_month`, `deduction_amount`
- **Totals:** `grandTotal`
- **Footers:** Employee Signature, HR Manager, Finance Approval

#### 33. Attendance Sheet / Daily Biometric Log (`attendance_sheet`)
- **Document Code:** `ATT`
- **Archetype:** Workforce Timekeeping Audit Sheet
- **Header Fields:**
  - `report_title` (Attendance Audit Report Title) — `span-2`, enabled
  - `department` (Target Department) — `span-1`, enabled
  - `date_range` (Audit Date Range) — `span-1`, enabled
  - `generated_on` (Generation Timestamp) — `span-1`, enabled
  - `operator` (Authorized Supervisor) — `span-1`, enabled
- **Grid Columns:**
  - `serial_no` (Sr #) — 6%, center
  - `emp_code` (Employee Badge Code) — 12%, left
  - `emp_name` (Employee Full Name) — 22%, left
  - `department` (Department) — 14%, left
  - `date` (Punch Date) — 12%, center
  - `clock_in` (First Clock-IN Time) — 11%, center
  - `clock_out` (Last Clock-OUT Time) — 11%, center
  - `duration` (Total Working Hours) — 12%, right
- **Totals / Department KPIs:** `totalEmp`, `totalPunches`, `presentCount`, `completedCount`, `totalHours`
- **Footers & Signatures:** Shift Timekeeper, Department HOD, HR Attendance Officer

---

## 4. Architectural Summary: The 3 Theme Personas Needed Per Document

To resolve Omer's core pain point, every document type must support **3 distinctly engineered theme styles**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               THE 3 THEME ARCHETYPES                                   │
├─────────────────────────┬────────────────────────────┬─────────────────────────────────┤
│ 1. CLASSIC CORPORATE    │ 2. MODERN MINIMAL          │ 3. INDUSTRIAL / COMPACT         │
│ (Formal & Authoritative)│ (Clean, Crisp & Modular)   │ (Shop-Floor, High-Density & B&W)│
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ • Formal serif headings │ • Geometric sans (Inter)   │ • Technical mono/sans           │
│ • Full-width accent bar │ • Floating metadata cards  │ • High-contrast bold box layout │
│ • Subtle bordered table │ • Zebra-banded soft rows   │ • Checkbox columns for workers  │
│ • Detailed legal terms  │ • Modern pill summary card │ • Dense row height (ink-saver)  │
│ • Formal corporate seal │ • Minimalist single-line   │ • Machine/Shift allocation box  │
│   and signature lines   │   signatures & QR position │ • 100% grayscale laser friendly │
│ • Ideal for Invoices,   │ • Ideal for Delivery, POs, │ • Essential for BOM, Batch Slips│
│   Quotations & Vouchers │   HR Slips & Executive Brief│  Job Cards & Stock Ledgers      │
└─────────────────────────┴────────────────────────────┴─────────────────────────────────┘
```

---

## 5. Non-Negotiable Accessibility & Paper-Readiness Standards

1. **Tested WCAG 2.1 AA Contrast Ratios (Minimum 4.5:1 for normal text, 3:1 for bold headers):**
   - Dark headers (`#0F172A`, `#004277`, `#047857`, `#1E40AF`): Text **strictly pure `#FFFFFF`** (Contrast > 7.1:1).
   - Light headers (`#F1F5F9`, `#E2E8F0`, `#FEF3C7`): Text **strictly deep `#0F172A`** (Contrast > 11:1).
   - Uncalibrated or free color pickers that allow low contrast combinations are disabled.
2. **Paper CSS Calibration:**
   - Standard `@page { size: A4 portrait; margin: 12mm 12mm 14mm 12mm; }`.
   - `page-break-inside: avoid` on table rows and totals blocks.
   - Repeating `thead` headers on multi-page overflows.
   - No cut-off columns or horizontal overflow on 210mm printable width.
