// Smoke — Browser Print Program (2026-10-25) source contracts.
// Pins the three print fixes so a future edit cannot silently regress them:
//  1. The display scale (body zoom) is reset for print — globally and in
//     every self-contained print studio/modal style block.
//  2. Colours print exactly regardless of the dialog's background toggle.
//  3. Sheets GROW instead of clipping (no fixed-height + overflow:hidden on
//     print pages outside 'fit' mode, which shrink-measures instead).
//  4. Measured pagination exists in all three paginated studios (rows are
//     moved down from overfull sheets; nothing is dropped).
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; } else { fail++; console.log('FAIL:', label); } };

// --- 1+2. Global print layer (index.css) ---
const css = read('src/index.css');
const printBlock = css.slice(css.indexOf('@media print'));
ok(/body\s*\{[^}]*zoom:\s*1\s*!important/.test(printBlock), 'index.css @media print resets body zoom');
ok(/body\s*\{[^}]*width:\s*auto\s*!important/.test(printBlock), 'index.css @media print resets body width');
ok(/\*,\s*\*::before,\s*\*::after\s*\{[^}]*print-color-adjust:\s*exact/.test(printBlock), 'index.css forces print-color-adjust: exact on all elements');

// --- PrintStudioShell: zoom reset + colour rule + guidance copy ---
const shell = read('src/components/ui/PrintStudioShell.jsx');
ok(/body \{[^}]*zoom: 1 !important/.test(shell), 'PrintStudioShell print CSS resets body zoom');
ok(shell.includes('print-color-adjust: exact !important'), 'PrintStudioShell keeps universal colour rule');
ok(!shell.includes('Background graphics = ON'), 'PrintStudioShell no longer demands Background graphics = ON');

// --- UniversalPrintStudioModal: measured pagination + grow CSS + fit-only fixed height ---
const modal = read('src/components/ui/UniversalPrintStudioModal.jsx');
ok(modal.includes('const [fittedPages, setFittedPages] = useState(null);'), 'studio modal has fittedPages state');
ok(modal.includes('const pages = fittedPages || basePages;'), 'studio modal renders fitted pages');
ok(/inner\.scrollHeight > avail \+ 2/.test(modal), 'studio modal measures sheet overflow');
ok(modal.includes('_isGroup'), 'studio modal keeps group headers with their rows when re-chunking');
ok(modal.includes("fixedHeight={scaleMode === 'fit'}"), 'fixed-height sheets only in fit mode');
ok(/scaleMode === 'fit'\s*\?\s*''/.test(modal), 'fit mode gets no grow override in print CSS');
ok(modal.includes('.print-preview-page tr { break-inside: avoid !important; }'), 'fill mode print CSS avoids mid-row breaks');
ok(modal.includes('parseFloat(getComputedStyle(el).minHeight) || el.clientHeight'), 'fit measurer uses paper min-height, not stretched client height');

// --- SalaryPrintStudio: grow pages + measured pagination ---
const salary = read('src/components/hr/SalaryPrintStudio.jsx');
ok(/body \{[^}]*zoom: 1 !important/.test(salary), 'SalaryPrintStudio print CSS resets body zoom');
ok(salary.includes('const pages = fittedPages || basePages;'), 'salary studio renders fitted pages');
ok(/el\.scrollHeight > limit \+ 2/.test(salary), 'salary studio measures sheet overflow');
ok(!salary.includes("; height: ${paper.height} !important;"), 'salary print CSS no longer fixes page height');
ok(salary.includes(".salary-print-page tr { break-inside: avoid !important; }"), 'salary print CSS avoids mid-row breaks');

// --- StockReportStudio: grow pages + measured pagination with subtotal guard ---
const stock = read('src/components/inventory/StockReportStudio.jsx');
ok(/body \{[^}]*zoom: 1 !important/.test(stock), 'StockReportStudio print CSS resets body zoom');
ok(stock.includes('const pages = fittedPages || basePages;'), 'stock studio renders fitted pages');
ok(stock.includes("lastKind === 'subtotal' || lastKind === 'grand'"), 'stock studio never moves subtotal/grand rows');
ok(!stock.includes("; height: ${paper.height} !important;"), 'stock print CSS no longer fixes page height');
ok(stock.includes(".stock-report-page tr { break-inside: avoid !important; }"), 'stock print CSS avoids mid-row breaks');

// --- HRPayslipModal: zoom reset in its own print block ---
const payslip = read('src/components/hr/HRPayslipModal.jsx');
ok(/body \{[^}]*zoom: 1 !important/s.test(payslip), 'HRPayslipModal print CSS resets body zoom');

console.log(`\nPrint Program smoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
