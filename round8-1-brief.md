# Round 8.1 — HR import identity fix + directory/calendar gaps

## 0. Non-negotiable context
- Repo: /home/hatch/workspace/erp, app: /home/hatch/workspace/erp/sale_orders_app, branch: `print-reporting-themes` (already checked out — verify, do not switch).
- NEVER invent/demo data. No fabricated departments, salaries, or names. Blank stays blank (display "—").
- Do NOT touch: `src/utils/salaryEngine.js`, the divisions setup, the Pay Slip screen.
- The September-2026 salary totals differing from the Google Sheet is EXPECTED (owner forbade importing historical attendance) — not a bug.

## 1. Root cause (verified by project lead in code + live data)
- `mergeHREmployeeSeed` matched/normalized by EMP-ID **numeric part** (EMP-00002 → EMP-002), but the sheet's EMP IDs and the ERP's existing EMP-xxx IDs are **different ID spaces**. Sheet EMP-00010 (ARFAN JAMEEL) collided with the ERP's existing EMP-010 (a different person) → ID was blanked. TANVEER HUSAIN has no sheet ID → blank.
- `smartUnionMerge` builds its dedup key as `item?.id || item?.orderId || ...` — records with a falsy id resolve to `undefined` and are **silently dropped** on every Supabase sync. All blank-ID seeds vanished → directory stuck at 89, TANVEER HUSAIN missing.
- The `hr_employee_seed_version = 'round_8_v1'` guard is already stamped in browsers → merge never re-runs. Stuck forever without a version bump.

## 2. Fix the seed merge (`mergeHREmployeeSeed` in src/context/AppContext.jsx)
- Bump version to `round_8_v2`.
- **Regenerate `src/data/hrEmployeeSeed.json` IDs from `/home/hatch/workspace/hr-employee-import.json` using the VERBATIM `emp_id` values** (e.g. `EMP-00002` stays `EMP-00002` — do NOT normalize to `EMP-002`). All other seed fields stay as they are.
- Match existing ERP employees to seed records by **trimmed case-insensitive NAME ONLY**. Delete all numeric-ID matching (`extractNum` logic).
- Name match → enrich the existing record, KEEP the existing ERP id: set division (from seed), department (AAA-division → 'AAA', else keep existing), shift, dutyHours, onboarding, dateOfJoining, basicSalary/salary ONLY if currently blank. Normalize status to title case: `Active` / `Inactive` (seed currently writes `ACTIVE`/`INACTIVE`; the directory counts `Active`/`Inactive`).
- No name match → add as new: `id` = verbatim sheet id if present AND not already used (exact string comparison); otherwise `id = ''` (display stays blank per owner). New AAA-division employees → department `'AAA'`.
- Duplicate sheet id `EMP-00010` (ARFAN JAMEEL = first occurrence in seed order, ABID HUSAIN = second): first keeps the verbatim id, second gets blank. Report this in your final summary.

## 3. Fix `smartUnionMerge` key extraction (~line 1211)
Records with a falsy id must NOT be dropped. Replace the key computation (both for `remoteMap` and for local items) with:
```js
const mergeKeyOf = (item) => {
  const id = item?.id || item?.orderId || item?.invoiceNumber || item?.itemCode || item?.username;
  if (id !== undefined && id !== null && String(id).trim() !== '') return String(id);
  const nm = (item?.name || '').trim().toLowerCase();
  return nm || undefined;
};
```
Behavior for records with real ids is unchanged; blank-id employee records now survive sync keyed by name.

## 4. Fix `normalizeEmployeeRecord` (src/components/hr/HRDirectory.jsx)
- REMOVE the invented-department branch (`variedDepartments[idx % variedDepartments.length]`) — an employee with no department keeps no department (display "—").
- REMOVE the invented-salary heuristic (35000/140000/85000/45000/32000) — no valid salary stays 0/blank (display "—").
- Normalize `status` to title case `Active`/`Inactive` so pills, filters and row badges agree.
- It must never persist invented values back via `setEmployees`.

## 5. HRDirectory columns + counts
- Add `Division` and `Shift / Duty Hours` to `ALL_COLUMNS` with working cell renderers (division badge; e.g. `GENERAL SHIFT (8h)`), include them in the default visible columns, and make sure Column Settings lists them.
- Fix the header count pills so they agree with the visible rows (they currently compare case-sensitively against the wrong case).
- Investigate: the directory row shows stored name `AJ ARFAN JAMEEL` (EMP-078) while Salary Generation / Pay Slip show `ARFAN JAMEEL` for the same EMP-078. Find where the name is transformed and make the displayed name consistent everywhere (use the stored name; do not silently strip prefixes).

## 6. HRAttendance calendar view
- Add a third `viewMode`: `'calendar'` (alongside `'grid'` / `'reconcile'`), with a UI switcher.
- Month grid for `selectedMonth`/`selectedYear` (which default to the current month already). **Every Sunday highlighted**, in both light and dark themes. Day cells show the attendance summary for that date; keep it read-only-safe (must not break grid/reconcile or existing mark-attendance flows).

## 7. Delivery
- `npm run build` in `sale_orders_app` — zero errors.
- Commit message: `Round 8.1: fix HR employee import identity (name-only matching, merge survival), attendance calendar view, directory columns/counts`
- Push to `origin print-reporting-themes`. Do NOT deploy.
- Final summary must include: expected personnel count after merge (~86 existing + 178 seed − name overlaps), TANVEER HUSAIN present Y/N (verify in the seed: he is there with blank id), EMP-00010 handling, build/commit/push results, and anything undetermined (do not guess).
