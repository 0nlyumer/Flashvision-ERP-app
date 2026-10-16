# FlashVision ERP — Round 3 Print Architecture Summary

**Branch:** `print-reporting-themes`  
**Date:** October 2026  
**Status:** Successfully Implemented & Verified (`npm run build` passing with 0 errors)

---

## 1. Executive Summary & Goals

Following the owner's review of the deployed application, Round 3 consolidates and streamlines the entire ERP print and reporting architecture:
1. **Centralized Configuration:** Removed all row-level, table-level, and module-level "Print Studio", "Customize Print Layout", and gear/settings icon buttons. Print layout configuration now lives in **exactly one location**: `Settings → Print Settings & Layout`.
2. **Automatic Saved Layout Application:** The saved layout, theme, color palette, column visibility, and row limits configured in Print Settings apply automatically whenever any document is printed. No per-print reconfiguration is required.
3. **Universal Print Preview Modal:** Every Print button in every module opens a large, responsive A4 preview modal rendered with the saved layout. It provides a per-print Portrait/Landscape orientation toggle, page navigation ("Page X of Y"), and honest export options (Native Print, High-Res PDF, High-Res PNG, and CSV). It never triggers the native print dialog on open.
4. **Per-Page Row Limits (Pagination Engine):** Added configurable numeric controls in the Print Settings designer for "Rows on first page" (default: 20) and "Rows on following pages" (default: 25). `UnifiedPrintDocument` paginates line items accordingly with repeated table headers, page numbers, and configurable totals placement.
5. **Round 1 & 2 Preservation:** All theme engines, palettes, column mapping fixes, logistics field coverage, and the 3-panel studio designer in Settings remain completely intact.

---

## 2. Key Changes by Component & Module

### A. Centralized Studio & Removal of Per-Row / Per-Module Gear Icons
- **Sale Orders (`SaleOrderModule.jsx`):**
  - Removed row-level gear/settings button in the active orders table.
  - Removed card-level gear/settings button in order history list.
  - Replaced legacy ~600-line DOM portal with `<UniversalPrintPreviewModal>`.
  - Removed dead `DEFAULT_SALE_ORDER_LAYOUT` constant and unused studio modal state.
- **Delivery Challan (`DelRecord.jsx` & `DelCreationSlip.jsx`):**
  - Removed row-level gear studio button in `DelRecord.jsx`.
  - Removed old legacy hidden chunked `PrintLayout` DOM blocks.
  - Renamed `Print Challan (Studio)` button to `Print Challan` in `DelCreationSlip.jsx`.
  - Routed all print buttons to `<UniversalPrintPreviewModal documentType="delivery_challan" />`.
- **Finance Vouchers (`Vouchers.jsx`):**
  - Replaced direct studio modal with `<UniversalPrintPreviewModal>`.
  - Kept voucher type detection (`voucher_cash_payment`, `voucher_bank_payment`, `voucher_journal`, etc.).
- **HR & Payroll (`HRAttendance.jsx`, `HRLeaveRequest.jsx`, `HRSalaryGeneration.jsx`, `HROvertime.jsx`):**
  - Removed dead embedded `PrintSettings` modal and unused states in `HROvertime.jsx`.
  - Standardized print button labels and tooltips across attendance, leave requests, and payslips (removed `(Studio)` suffix).
  - Routed all print actions to `<UniversalPrintPreviewModal>`.
- **Inventory Ledger (`InvLedger.jsx`):**
  - Replaced legacy print chunks with `<UniversalPrintPreviewModal documentType="inventory_ledger" />`.
- **Production & BOM (`ProductionModule.jsx`, `CreateNewBOM.jsx`, `MasterBatchRecord.jsx`):**
  - Routed "Print Manifest", "Print BOM", and "Print Batch Record" to `<UniversalPrintPreviewModal>`.
  - Cleaned up button titles and removed old studio modal references.

---

### B. Single Universal Print Preview Popup (`UniversalPrintPreviewModal.jsx`)
- **Portal Rendering:** Renders via `createPortal(..., document.body)` with `z-[99999]` and backdrop blur to isolate from underlying viewports.
- **Saved Layout Loading:** Automatically resolves layout from AppContext state (`state.adminSetup.printSettings.documentLayouts`), `localStorage` (`fv_print_layout_${documentType}`), and Supabase (`print_layout_settings` table), with fallback to schema defaults.
- **Per-Print Orientation Switcher:**
  - Interactive **Portrait** and **Landscape** toggle in the modal toolbar.
  - Re-renders preview immediately for this print invocation without mutating or overwriting the saved configuration in Settings.
- **Page Navigation & Smooth Scroll:**
  - Multi-page indicator: `"Page X of Y"` with previous/next controls.
  - Automatically scrolls to the target page smoothly (`scrollIntoView`).
  - Zoom controls (50% to 150%, plus 100% reset).
- **Export Action Suite:**
  - **Print:** Opens native browser print dialog (`window.print()`).
  - **Download PDF:** Uses `exportDocumentToPdf` matching chosen orientation and layout.
  - **Download PNG:** Uses `exportDocumentToImage` for crisp multi-page captures.
  - **Export CSV:** Uses `exportDocumentToCsv` exporting active columns and line items.
- **CSS Isolation (`index.css` & component `<style>`):**
  - Clean print stylesheet ensures only the modal content prints (`#universal-print-preview-modal` and `.unified-print-container` whitelisted; all outer ERP sidebars, navbars, and headers hidden).

---

### C. Per-Page Row Limits & Table Pagination Engine
- **Print Settings Designer (`PrintSettings.jsx`):**
  - Added dedicated inputs under the **"Paper & Margins"** tab:
    - **Rows on first page:** Numeric input (min: 1, max: 100, default: 20) with helper text: *"Maximum line-item rows rendered on page 1 before continuing to page 2."*
    - **Rows on following pages:** Numeric input (min: 1, max: 100, default: 25) with helper text: *"Maximum line-item rows rendered on each continuation page (page 2, 3, ...)."*
  - Persists directly into `documentLayouts[docId].firstPageRows` and `.continuationPageRows`.
- **Defaults in Registry (`printSchemaRegistry.js`):**
  - Updated `DEFAULT_LAYOUT_SETTINGS` and theme engines:
    - `firstPageRows: 20`
    - `continuationPageRows: 25`
    - `rowsPerPage: 20`
- **Pagination in Renderer (`UnifiedPrintDocument.jsx`):**
  - Page 1 receives up to `firstLimit` items.
  - Pages 2+ receive up to `contLimit` items.
  - Table headers repeat cleanly across all pages.
  - Page numbers format dynamically as `"Page X of Y"`.
  - Totals block renders per `totalsPosition` setting (`last_page` vs `every_page`).

---

## 3. Verification & Build Results

- **Build Command:** `npm run build`
- **Result:** Exit code `0` (Successful compilation in 9.69s with zero errors).
- **Bundle Output:** `dist/assets/UniversalPrintPreviewModal-4rVhl2-h.js` (14.15 kB).
- **Security Check:** Zero API keys, passwords, or secrets leaked into source files or diffs.
- **Git Branch:** `print-reporting-themes` (clean working tree ready for commit).
