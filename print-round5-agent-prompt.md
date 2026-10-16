# ERP Print/QA Round 5 — bug-fix brief

You are working in the FlashVision ERP app at `~/workspace/erp/sale_orders_app` (branch `print-reporting-themes`).
Use the relevant installed skills for this work (UI/UX design, typography, color theory, design-system skills) — every new or changed UI surface must look highly professional, enterprise-grade.

## CRITICAL CONTEXT
Round 4 (commit 0761f8b, already on this branch) fixed: totals block in Print Settings preview, theme-aware preview popup backdrop, faithful real-print output (print-isolation CSS), full print audit, click-to-edit inspector in Print Settings. DO NOT regress any of that. The QA below ran against the live site which still serves OLD code, so round-4 items may still look broken there — that is expected; treat them as done.

## BUGS TO FIX (all verified live by the QA lead)

### MAJOR
1. **Delivery → DC Record → DC-003 print preview**: the "GRAND" pill shows 52,380 while the sum of the 12 DISPATCHED QTY lines is 6,050 — the grand total does not reconcile with the line items. Also the printed "CHALLAN NUMBER" field is blank (only REF CODE DC-003 is shown). Fix: render the correct document/challan number and make the grand total reconcile with the line items (derive it from the lines, or fix the data source feeding it).

2. **Finance → Finance Overview**: every KPI shows PKR 0.00 / 0% while the status labels read "High Profitability" and "Fully Solvent". Fix: status labels must reflect the actual numbers — with zero data they must be neutral/hidden (e.g. "No data yet"), never contradict the numbers.

3. **Inventory → Inventory Stock**: the table shows "No items found / 0 of 0 entries" while the dashboard header claims "120 Items" / "$6316.5k". Fix: the stock list must show the items the dashboard counts (or fix the dashboard count) — the two must agree. (Also note item 5: the "$" here should be PKR/Rs.)

4. **OMS → first table row → View Timeline panel**: "Production Steps History" shows chips reading "Invalid Date". Fix: format timestamps properly (handle null/malformed dates gracefully with a sensible fallback like "—"); never render the literal text "Invalid Date" to the user.

### MINOR
5. **Currency**: Sale Order print preview totals show "$" (e.g. "Grand Total $500"); HR → Employee Directory shows salaries in "$" too. This is a Pakistani company — use PKR (or "Rs") everywhere currency is displayed. Also sanity-check HR seed/demo data: it shows a pay inversion (HELPER $18,000 vs HR MANAGER $3,500) — fix the demo data so it is plausible.
6. **Footer**: reads "© 2024AJ SYNTHETIC" (stale year AND missing space). Fix to the current year with proper spacing, e.g. "© 2026 AJ SYNTHETIC".
7. **Production home**: "Total Production Output (Metres): 0 Metres /150,000M" while the Batch Production History cards below show real output (1050m, 1000m, 250m). Fix the contradictory zero — the header total must aggregate the real batch data.
8. **Batch #ITM-003** shows "Yield Efficiency 108.1%" (1000m output from 925m input) with no validation warning. Over-100% yield is impossible — add a visible warning flag/badge on impossible yields (and clamp or flag in any related computation).
9. **OMS first row**: sale order "-" and customer "Unknown" with status IN PROCESS (orphan production line). Either link it to its real sale order/customer or clearly flag the row as orphan/unlinked (badge); never silently show "Unknown".
10. **Dashboard calendar widget** renders "May 2026" while today is October 2026. Fix: default to the current month.
11. **Inventory → FG Combination Builder**: the panel overlaps the search toolbar (green search button and column headers obscured). Fix the layout overlap (proper stacking/z-index and spacing).
12. **Inventory → Multi-Item Ledger**: closing the Print Ledger preview resets the ledger to "No Item Selected". Fix: closing the preview must preserve the item selection and ledger state.
13. **HR → Employee Directory**: every row renders "N/A" after the employee name (an empty father-name field leaking into the display) — hide empty fields instead of rendering "N/A". Also all employees show department "Global Logistics" — verify and fix the seed/demo data to use realistic varied departments.
14. **HR → Add Employee form**: phone placeholders use US format "+1 (555) 019-2834" — use Pakistani +92 format placeholders (e.g. "+92 300 1234567").
15. **Copy fixes**: the GL header says "conforming to ERPNext standards" (competitor name — remove or replace with a neutral phrase); DC Creation has the typo "Finishgood Department" → must read "Finished Goods Department".
16. **OMS rows have no print/preview option at all** (verified gap). GRN prints exist and are fine — do NOT touch those. Add a print/preview affordance for OMS production rows, consistent with the universal preview popup flow (large preview popup, saved layout applied, Portrait/Landscape override, Print / PDF / PNG / CSV / Close). If OMS needs a print schema, add one to the schema registry following the existing pattern.

### Verified OK — no action needed
- The "confusing blue shine" on checkboxes was NOT reproduced (selected states are clear).
- Light/dark themes are both readable (only slightly low-contrast "MANUAL" badges in dark mode — polish those if trivial, otherwise leave).

## STANDING CONSTRAINTS (never regress)
- The full Print Studio lives ONLY in Settings → Print Settings & Layout. Do not add gear/Studio/customization icons anywhere else (modules, rows, action columns).
- Print buttons open the large preview-only popup (saved layout applied; temporary Portrait/Landscape override; Print, PDF, PNG/image, CSV, Close).
- Per-document pagination settings keep working. Saved layouts keep persisting and applying. Delivery Challan field mapping stays correct.

## DONE CRITERIA
- Every numbered item above is fixed in source.
- `npm run build` in `~/workspace/erp/sale_orders_app` passes with ZERO errors.
- Summarize each fix (file + what changed) for the final report.
