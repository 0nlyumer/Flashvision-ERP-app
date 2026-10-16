You are working on the FlashVision ERP web app (React + Vite) at /home/hatch/workspace/erp/sale_orders_app, git branch print-reporting-themes (stay on this branch, do not switch). This is a real production app owned by Omer; he personally tested the deployed print flow at https://flashvision-erp.web.app and reported 5 concrete issues below. Fix ALL of them, then build, commit, push, and deploy.

FIRST: read the installed skill at /opt/muse/skills/app-creation/SKILL.md and apply its professional-UI principles to everything you build or change in this task. The owner demands highly professional, enterprise-grade UI on every new surface. Also follow the project's existing design tokens in src/utils/printThemeEngine.js and keep all new UI consistent with the existing premium dark/teal/gold aesthetic. Also read /opt/muse/skills/form-design/SKILL.md for the settings-panel UX.

Then read these files fully before changing anything:
- src/components/settings/PrintSettings.jsx (the Print Studio — lives ONLY here)
- src/components/ui/UniversalPrintPreviewModal.jsx (the large preview popup)
- src/components/print/UnifiedPrintDocument.jsx (the document renderer)
- src/utils/printSchemaRegistry.js (document schemas)
- src/utils/printExportUtils.js (Print/PDF/PNG/CSV export)
- src/utils/printThemeEngine.js

THE 5 ISSUES (verified live by the owner — treat as ground truth):

ISSUE 1 — Print Settings preview missing the totals block.
In Settings → Print Settings & Layout, when the Sale Order document is selected, the live preview/alignment area does NOT render the totals section (totals/amounts block at the bottom) at all. Fix: every document type that has totals must render its full totals block in the settings preview, exactly as it will print. Audit ALL document types in the schema registry for this.

ISSUE 2 — Preview popup backdrop is wrong.
Pressing Print on any document opens the large in-app preview popup, but the backdrop is a fully opaque blue covering the entire screen behind the centered popup. Fix: the backdrop must be a translucent dim overlay that respects the app's active theme (light theme → soft dark translucent dim such as rgba(15,23,42,0.55); dark theme → appropriately dimmed), so the app behind is dimmed, not replaced by solid blue. The popup panel itself follows the app theme. Professional, subtle, no harsh colors.

ISSUE 3 — CRITICAL: printed output does not match the in-app preview.
In the preview popup, clicking the Print button opens the Chrome/system print dialog, and its preview shows a BROKEN layout: only the totals section at the bottom plus maybe an address line at the top — the designed Sale Order layout/alignment is gone. The owner calls this a very serious matter. Fix the real print path so it is faithful to the in-app preview and the saved layout, every time, in every export form (Print, PDF, PNG/image, CSV):
- Dedicated @media print CSS that isolates and prints ONLY the document node (the same node rendered in the in-app preview, with the saved layout AND the temporary portrait/landscape override applied), hiding ALL app chrome (sidebars, headers, modals, backdrops, the popup frame itself).
- print-color-adjust: exact and -webkit-print-color-adjust: exact so designed colors/backgrounds survive printing.
- Correct @page size and margins matching the chosen orientation; the portrait/landscape override selected in the popup must be respected by the real print output.
VERIFY THIS FOR REAL: after building, prove the fix by rendering the print path in headless Chromium (e.g. chromium --headless --print-to-pdf) against representative documents (Sale Order at minimum, plus Delivery Challan and Sales Invoice) and visually compare the resulting PDF against the in-app preview rendering. Describe the before/after in your final summary. If the in-app preview and the print-dialog output disagree for any document, keep fixing until they agree.

ISSUE 4 — Full end-to-end print audit across the whole app.
Walk EVERY document print in the app — Sale Order, Delivery Challan, Sales Invoice, GRN, Production Job Slip/Batch, Salary Slip, Attendance register, Stock Ledger / Stock reports, Payment/Receipt Voucher, Leave Application, Production Planning, and anything else with a Print button — through the complete production flow so you understand how each works. Where a document type has no data yet (e.g. GRN prints), create sample entries YOURSELF using LOCAL fixtures/mocks or a local dev run, and check their prints. CONSTRAINT: NEVER write test/seed data into the live Supabase project — local fixtures/mocks or a local dev run only, and clean up anything temporary afterwards. For each document, verify the layout BOTH in the in-app preview popup AND in the browser's real print preview (headless Chromium --print-to-pdf is acceptable), and fix every mismatch so the two always agree. Report per-document results in your final summary (pass/fail + what was fixed).

ISSUE 5 — NEW FEATURE: click-to-edit inside Print Settings.
In Settings → Print Settings & Layout, the document preview must be interactive: clicking ANY table column (header or cell) or ANY text/section field in the preview selects that element and opens its customization options in a side panel — alignment (left/center/right), text wrap, font size, font weight, text style, and whatever other per-column/per-field options already exist. The point: the owner should never have to hunt through nested settings sections — he clicks the element in the preview, and edits it right there in the panel. The selected element must be visually highlighted in the preview. This must work for all document types. Design this interaction to a highly professional standard.

STANDING CONSTRAINTS (do NOT regress):
- The full Print Studio lives ONLY in Settings → Print Settings & Layout. Do NOT add gear/Studio/customization icons anywhere else (no module, row, or action column).
- Print buttons everywhere open the large preview-only popup (saved layout applied; temporary Portrait/Landscape override; Print, PDF, PNG/image, CSV, Close buttons). Keep this flow exactly.
- Per-document pagination settings (max rows on first page, max rows on following pages, repeated table headers, Page X of Y, totals placement rule) must keep working.
- Saved layouts must persist and apply to every print/preview.
- The earlier Delivery Challan field-mapping fixes must keep working.

DELIVERABLE — do all of the following, in order:
1. Implement all 5 fixes.
2. Run `npm run build` in /home/hatch/workspace/erp/sale_orders_app — it MUST pass with ZERO errors.
3. `git add` the changed files, commit on branch print-reporting-themes with a clear message (e.g. "fix(print): owner-reported round 4 — totals in settings preview, theme-aware backdrop, faithful real-print output, full print audit, click-to-edit in studio").
4. `git push origin print-reporting-themes`.
5. `firebase deploy --only hosting` from /home/hatch/workspace/erp/sale_orders_app (this project hosts https://flashvision-erp.web.app). Confirm the deploy succeeds.

Your final summary must contain: (a) each of the 5 issues with what you changed and the files touched; (b) how you verified each — especially #3 (before/after of the real print-dialog output, with specifics) and #4 (a per-document table: document, in-app preview OK?, real print preview OK?, fix applied); (c) the commit hash; (d) confirmation the Firebase deploy succeeded. Be precise and honest about what you actually verified versus what you could not.
