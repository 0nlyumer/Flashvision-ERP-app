# ERP Round 8 brief — HR module overhaul mirroring the owner's live salary Google Sheet

You are the coding agent for FlashVision ERP. Work in repo `/home/hatch/workspace/erp`, app source at `/home/hatch/workspace/erp/sale_orders_app`. Verify the branch is `print-reporting-themes` with `git branch --show-current` BEFORE any code change; work ONLY on that branch. Do not create any other branch. Read `sale_orders_app/AGENTS.md` and apply its skill standards (design/UI skills for UI work, react best practices, clean code).

Model note: use your installed design/UI skills wherever UI is touched, as in previous rounds. All new/changed UI must be highly professional and readable in BOTH light and dark themes. Do NOT regress any Round 4–7 print behavior (UniversalPrintPreviewModal, print theme engine) or the manufacturing department pipeline (`state.departments` and the inventory/production department-wise item pipeline).

## SOURCE DATA (verified)
- Import source (USE THIS, exactly as-is): `/home/hatch/workspace/hr-employee-import.json` — 178 employees. Fields: `sheet_id`, `emp_id` (e.g. "EMP-00002", may be empty), `name`, `designation`, `basic` (e.g. "29,700.00"), `department` ("AJ SYNTHETIC"/"AAA"/blank → this is the ERP DIVISION, not department), `status` ("ACTIVE"/"UNACTIVE"), `shift` ("GENERAL SHIFT"/"8 HOURS SHIFT"/blank/"."), `onboarding` ("DONE"/blank/"."), `date_of_joining` (mostly blank). This file is OUTSIDE the repo — read it, do NOT copy it into the repo.
- Verified stats: ACTIVE 92, UNACTIVE 86 (normalize to INACTIVE in ERP); AJ SYNTHETIC 83, AAA 57, blank 38; 88 have EMP ID, 90 do not; onboarding DONE 88 (one "." entry → treat as blank).
- Live sheet fallback (only to double-check a value, never import columns AF:DT): `hatch_gws_cli sheets spreadsheets values get --params '{"spreadsheetId":"1daE2U_jk6MnLszwHF1FSGSBNcPEx7DzxoMMP9ji0cM0","range":"'"'"'SALARY SHEET.'"'"'!A1:AE600"}'`

## EXACT SALARY RULES — implement VERBATIM as the single calculation core
- hourly = basic / 240
- OT amount = OT hours × hourly
- deduction amount = deduction hours × hourly
- absent deduction = absent days × (basic / 30)
- TOTAL SALARY = basic + OT amount + allowance − deduction amount − absent deduction − fine − advance − loan

## ERP FACTS (all verified first-hand in this repo)
- Employees live in `hr_employees_list` (AppContext state → localStorage, synced to Supabase `hr_employees` via `syncToStandaloneTables` in `src/context/AppContext.jsx`). IMPORTANT: I probed Supabase directly — the table `public.hr_employees` DOES NOT EXIST (PostgREST error PGRST205). Therefore do NOT extend the Supabase upsert row mapping; persist via the existing localStorage/state flow and leave the upsert mapping exactly as-is.
- `src/components/hr/HRSettings.jsx` departments come from `hr_departments_config` (localStorage), synced from global manufacturing departments (Finishgood, Production, Row Meterial, Mechanical), each with sections/subsections + managers/operators/incharges UI — KEEP ALL OF THAT WORKING.
- GOTCHA (verified at HRSettings.jsx lines ~43–101): the sync effect DELETES any HR department not present in the global manufacturing list (`hrDepts.filter(hrD => globalDepts.some(...))`). Your new HR-only "AAA" department must survive this — give it an `hrOnly: true` flag (or equivalent) that the removal filter skips. Do not let the sync wipe it, and do not push HR-only departments back into the global list.
- HR screens are registered in `src/pages/HRModule.jsx` (`allTabs` array + conditional render). Existing tabs: dashboard, directory, onboarding, attendance, overtime, leave, loan, loanLedger, advance, salary (HRSalaryGeneration), settings. Permission screenIds: hrDashboard, hrDirectory, hrOnboarding, hrAttendance, hrOvertime, hrLeave, hrLoan, hrLoanLedger, hrAdvance, hrSalary, hrSettings.
- Existing HR components in `src/components/hr/`: HRAdvanceRequest, HRAttendance (3401 lines — daily present/absent, OT add, fines, late-coming deduction hours, comments), HRDashboard, HRDirectory, HRLeaveRequest, HRLoanLedger, HRLoanRequest, HROnboarding, HROvertime, HRSettings, PayrollAccountMapping, SalaryAllowanceConfig.
- Attendance data canonical shape: per-employee `attendance` object keyed by date (e.g. `att['2026-10-16'] = { status, ot, fines, deductions, explicitStatus }`) stored on each `hr_employees_list` entry (see AppContext.jsx lines ~370–390 and ~510–540 for the approval/OT sync that writes this shape), plus `hr_uploaded_attendance` state key. Salary computation must read the month's daily records from this shape.
- `HRSalaryGeneration.jsx` currently exists (1222 lines) using UniversalPrintPreviewModal and column configs — rework it onto the new engine but keep the universal print preview path intact (do not break Round 4–7 print behavior).
- Pay-slip template to replicate EXACTLY on a single page: visual reference `/home/hatch/workspace/pay-slip/template-reference-waleed-qamar-sep-2026.pdf` and exact layout specs in `/home/hatch/workspace/pay-slip/generate_payslip.py` (450 lines: banner AJ Synthetic Payroll Audit Division, employee info grid, 31-day attendance/OT/deduction register two panels, Time & Attendance Breakdown, Financials & Advance Recovery, Total Net Payable with amount in words, footer Confidential Pay Sheet / Powered by Flashvision). Read both files carefully before building the slip screen.

## BUILD — in this order

### 1. DIVISION LEVEL (new, HR-scoped)
Add a Division entity in HR Settings, ABOVE Department. Create exactly two divisions: "AJ Synthetic" and "AAA". Put all existing HR departments under "AJ Synthetic". Create ONE new department "AAA" under the "AAA" division (HR-scoped, `hrOnly` flag so the global sync keeps it). CRITICAL: do NOT alter the global manufacturing departments list (`state.departments`) or the inventory/production department-wise item pipeline — divisions are an HR/payroll concept only. Persist divisions in AppContext state + localStorage (suggested key `hr_divisions_config`, state key `hr_divisions`). Supabase: no clean pattern exists for this (hr_employees table doesn't exist) — keep it state + localStorage only.

### 2. EMPLOYEE IMPORT
Deliver as seed data + idempotent merge: `src/data/hrEmployeeSeed.json` (clean array from the import JSON) + a merge function run on app init (in AppContext) guarded by a version flag in localStorage (e.g. `hr_employee_seed_version`), so re-runs never duplicate. Matching against existing `hr_employees_list` entries: by EMP ID NUMERIC part (sheet "EMP-00002" ≡ ERP "EMP-002") or by trimmed case-insensitive name. Add every sheet employee missing from the ERP; NEVER create duplicates. Per employee:
- `id` = sheet EMP ID normalized to ERP "EMP-xxx" style (numeric part zero-padded to 3, e.g. "EMP-00002" → "EMP-002"); sheet employees with NO id keep the ERP id blank (owner assigns later — do NOT invent IDs).
- `status`: UNACTIVE → "INACTIVE", ACTIVE stays.
- `division`: "AJ SYNTHETIC" → "AJ Synthetic", "AAA" → "AAA", blank → "AJ Synthetic".
- `department`: employees in the AAA division → the new "AAA" department; everyone else KEEPS their existing department (do not overwrite existing).
- carry `designation`, `basicSalary` (parse "29,700.00" → 29700), per-employee duty-hours config from `shift` ("8 HOURS SHIFT" → 8; "GENERAL SHIFT" → 8 default, marked adjustable in settings — note: default chosen since factory general shift is 8h; owner adjusts per employee in HR Settings), `onboarding` ("DONE" → completed, blank → pending), `dateOfJoining`.
Report exact import stats: added / skipped-as-duplicate / blank-ID.

### 3. SALARY ENGINE
Implement `src/utils/salaryEngine.js`: the EXACT rules above as one shared `calculateEmployeeSalary(employee, monthContext)` core used by salary generation AND the pay slip. Include `amountInWords` helper (Pakistani numbering: thousand/lakh/crore) for the slip. HR Settings must expose: per-employee duty-hours configuration (editable per employee), allowance rules, deduction rules, late-coming-hours calculation — mirroring the sheet's behavior. The attendance calendar (HRAttendance) must default to the CURRENT month with every Sunday highlighted. (Sunday is the factory's weekly off day.)

### 4. SALARY GENERATION SCREEN (`HRSalaryGeneration.jsx`)
Make it fully working on the new engine: select payroll month + division/department filter, "Fetch data + Calculate", render the FULL salary sheet (every employee row with computed values per the engine) with per-employee drill-down. It must read that month's attendance data (from the per-employee date-keyed attendance in `hr_employees_list` + approved overtime requests) and apply the engine rules. Keep the existing UniversalPrintPreviewModal print path working.

### 5. PAY SLIP SCREEN (new)
Add a "Pay Slip" tab in `HRModule.jsx` (id `payslip`, screenId `hrPayslip`, label "Pay Slip") + new component `src/components/hr/HRPaySlip.jsx` replicating the TANVEER template EXACTLY on a single page: banner, employee info grid, 31-day register, Time & Attendance Breakdown, Financials & Advance Recovery, Total Net Payable with amount in words, footer. Month selector → pick any employee (search) → render that month's slip from engine-computed values + that month's attendance. Professional, single page, light+dark readable, printable via the existing universal print preview pattern.

### 6. KEEP WORKING — wire into the engine where they feed salary
Do not break existing screens; wire them into the engine where they feed salary: advance request form, loan request + loan ledger, leave request (paid/unpaid affecting salary), overtime request with approval (approved OT auto-applies to that date — the AppContext OT sync already writes into employee attendance; keep/extend that), onboarding detail entry, HR dashboard basics. The Attendance Management screen's daily present/absent, OT add, fines, late-coming deduction hours and comments must all feed the salary engine for the selected month.

## CONSTRAINTS
- All new/changed UI highly professional, readable in BOTH light and dark themes.
- Do not regress Round 4–7 print behavior or the manufacturing department pipeline.
- Report anything you could not determine — do not guess.

## DELIVERY
- `npm run build` in `/home/hatch/workspace/erp/sale_orders_app` MUST pass with zero errors. Fix all build/TS errors yourself.
- Commit with message: `Round 8: HR divisions (AJ Synthetic/AAA), 178-employee import, sheet-exact salary engine, pay slip screen`. Push to `origin print-reporting-themes`. Do NOT deploy.
- Write a brief build report at the end of your run: what was built per numbered item above (files changed), import stats (added / skipped-as-duplicate / blank-ID), build result, commit hash, push result, anything undetermined.
