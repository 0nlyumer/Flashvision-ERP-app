import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { getPayslipIdentity } from '../../utils/divisionPrintName';

// Number to Words Converter (Pakistani / South Asian & Western standard)
// Paisa included when non-zero (Omer, 2026-10-24): "Rupees … and Paisa …
// Only"; when paisa is 0 the output is exactly the old format.
export function numberToWords(num) {
  const abs = Math.abs(num || 0);
  let n = Math.floor(abs);
  let paisa = Math.round((abs - n) * 100);
  if (paisa === 100) { n += 1; paisa = 0; }
  if (n === 0 && paisa === 0) return 'Rupees Zero Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(val) {
    if (val < 20) return ones[val];
    if (val < 100) return tens[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + ones[val % 10] : '');
    if (val < 1000) return ones[Math.floor(val / 100)] + ' Hundred' + (val % 100 !== 0 ? ' ' + convert(val % 100) : '');
    if (val < 100000) return convert(Math.floor(val / 1000)) + ' Thousand' + (val % 1000 !== 0 ? ' ' + convert(val % 1000) : '');
    if (val < 10000000) return convert(Math.floor(val / 100000)) + ' Lakh' + (val % 100000 !== 0 ? ' ' + convert(val % 100000) : '');
    return convert(Math.floor(val / 10000000)) + ' Crore' + (val % 10000000 !== 0 ? ' ' + convert(val % 10000000) : '');
  }

  const rupeesWords = n === 0 ? 'Zero' : convert(n);
  return 'Rupees ' + rupeesWords + (paisa > 0 ? ' and Paisa ' + convert(paisa) : '') + ' Only';
}

export default function HRPayslipModal({ isOpen, onClose, slip }) {
  const printRef = useRef(null);

  if (!isOpen || !slip) return null;

  const handlePrint = () => {
    window.print();
  };

  const formatPKR = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Signed money lines (Omer, 2026-10-24): the amount is always formatted
  // absolute so a stored negative can never double up with the line's sign
  // prefix ("+ Rs -18,155.17" bug). Lines whose output was already correct
  // (positive magnitudes) render byte-identically.
  const formatAbsPKR = (val) => formatPKR(Math.abs(Number(val) || 0));
  // For the one truly signed line (Net Overtime & Adjustment Balance):
  // the sign comes from the value itself; zero renders "+ Rs 0.00".
  const formatSignedPKR = (val) => `${(Number(val) || 0) < 0 ? '-' : '+'} Rs ${formatAbsPKR(val)}`;

  // Division identity (Omer, 2026-10-25): heading, monogram and footer
  // name follow the employee's division — AJ slips unchanged, AAA slips
  // carry 'AAA' / 'AAA Industry' (never the AJ legal name).
  const identity = getPayslipIdentity(slip);

  const netAdjBal = slip.netAdjustmentBalance || (slip.otPay + slip.allowances - slip.absentDeduction - slip.dtDeduction - slip.fines - slip.advance - slip.loanInstallment);

  const totalCalendarDays = slip.currentMonthDays || 30;
  const halfDays = Math.ceil(totalCalendarDays / 2); // e.g. 15 for 30, 16 for 31

  // Prepare 31-day entries
  const dailyList = slip.dailyRecords || [];
  const leftColumnDays = dailyList.slice(0, halfDays);
  const rightColumnDays = dailyList.slice(halfDays, totalCalendarDays);

  const amountInWords = slip.amountInWords || numberToWords(slip.netSalary);

  const modalContent = (
    <div id="fv-payslip-print-root" className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white animate-fade-in">
      {/* Container Box */}
      <div className="fv-payslip-sheet bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Top Actions Bar (Hidden in Print) */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">receipt_long</span>
            <span className="font-headline font-bold text-sm text-slate-800">
              Employee Pay Slip & Time Log
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-primary text-on-primary hover:bg-primary-container rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              Print Pay Slip
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Printable Payslip Body */}
        <div className="fv-payslip-body flex-1 overflow-y-auto p-6 sm:p-8 space-y-4 print:p-0 print:space-y-3 font-sans custom-scrollbar select-none" ref={printRef}>
          
          {/* 1. Header (Brand & Month Badge) */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3.5">
              {/* AJ mark — Omer's approved sheet-template logo (2026-10-24):
                  rounded-corner outline box ~44×34, dark border, no fill,
                  bold "AJ" centered (generate_payslip.py reference). */}
              <div className="w-[44px] h-[34px] rounded-[6px] border-2 border-slate-900 flex items-center justify-center text-slate-900 font-headline font-bold text-[19px] shrink-0">
                {identity.monogram}
              </div>
              <div>
                <h1 className="font-headline text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  {identity.heading}
                </h1>
                <p className="text-[11px] text-slate-500 font-medium">
                  Payroll Audit Division • {identity.fullName}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block border-2 border-slate-900 rounded-xl px-4 py-1.5 font-headline font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide">
                {slip.periodMonthYear || 'SEPTEMBER 2026'}
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                Monthly Pay Slip &amp; Time Log
              </p>
            </div>
          </div>

          {/* 2. Employee Info Grid (Two Rows of 4 Columns) */}
          <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
            {/* Row 1 */}
            <div className="grid grid-cols-4 divide-x divide-slate-300 border-b border-slate-300 bg-white">
              <div className="p-2.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">EMPLOYEE ID</span>
                <span className="font-bold text-slate-900 text-xs mt-0.5 block">{slip.employeeId || '-'}</span>
              </div>
              <div className="p-2.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">EMPLOYEE NAME</span>
                <span className="font-black text-slate-900 text-xs mt-0.5 block truncate">{slip.employeeName || '-'}</span>
              </div>
              <div className="p-2.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">DESIGNATION / ROLE</span>
                <span className="font-bold text-slate-900 text-xs mt-0.5 block truncate">{slip.designation || 'WORKER'}</span>
              </div>
              <div className="p-2.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">BASIC MONTHLY SALARY</span>
                <span className="font-black text-blue-600 text-xs mt-0.5 block">
                  Rs {formatPKR(slip.basicSalary)}
                </span>
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-4 divide-x divide-slate-300 bg-white">
              <div className="p-2.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">DEPARTMENT</span>
                <span className="font-bold text-slate-900 text-xs mt-0.5 block truncate">{slip.department || 'Operations'}</span>
              </div>
              <div className="p-2.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">SHIFT SCHEDULE</span>
                <span className="font-bold text-slate-900 text-[11px] mt-0.5 block leading-tight">
                  {slip.shiftSchedule || 'Standard'}<br />{slip.dutyHours || 8}h Duty
                </span>
              </div>
              <div className="p-2.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">WORKING DAYS</span>
                <span className="font-black text-teal-600 text-[11px] mt-0.5 block leading-tight">
                  {(Number(slip.paidDays) || Number(slip.payableDays) || 0).toFixed(1)} Paid /<br />{slip.presentDays || 0} Present
                </span>
              </div>
              <div className="p-2.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">TOTAL CALENDAR DAYS</span>
                <span className="font-black text-slate-900 text-xs mt-0.5 block">
                  {totalCalendarDays} Days
                </span>
              </div>
            </div>
          </div>

          {/* 3. Register Header Banner */}
          <div className="border border-slate-300 rounded-lg py-1.5 px-3 bg-slate-50 text-center font-headline font-black text-[11px] text-slate-800 uppercase tracking-wider">
            {totalCalendarDays}-DAY ATTENDANCE, OVERTIME (OT) &amp; DEDUCTION (DT) REGISTER
          </div>

          {/* 4. Two-Column Side-by-Side Attendance Register Grid */}
          <div className="border border-slate-300 rounded-xl overflow-hidden grid grid-cols-2 divide-x divide-slate-300 text-[10px]">
            {/* Left Column (Days 01 to Half) */}
            <div>
              <table className="w-full text-center border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-300 text-[9px] uppercase tracking-wider">
                  <tr>
                    <th className="py-1 px-1.5 border-r border-slate-200 w-10">DATE</th>
                    <th className="py-1 px-1.5 border-r border-slate-200 w-11">ATT</th>
                    <th className="py-1 px-1.5 border-r border-slate-200 w-13">OT</th>
                    <th className="py-1 px-1.5 border-r border-slate-200 w-13">DT</th>
                    <th className="py-1 px-2 text-left">REMARKS / EVENT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {leftColumnDays.map(item => (
                    <tr key={item.dateStr} className="hover:bg-slate-50">
                      <td className="py-1 px-1.5 font-bold text-slate-700 border-r border-slate-200">{item.dateStr}</td>
                      <td className="py-1 px-1.5 font-black border-r border-slate-200">
                        <span className={
                          item.att === 'P' ? 'text-teal-600 font-bold' :
                          item.att === 'ABS' ? 'text-rose-600 font-bold' :
                          item.att === 'L' ? 'text-blue-600 font-bold' :
                          item.att === 'OFF' ? 'text-indigo-600 font-black' :
                          item.att === 'HOL' ? 'text-purple-600 font-bold' :
                          item.att === 'HLD' ? 'text-cyan-600 font-bold' : 'text-slate-500'
                        }>
                          {item.att || '-'}
                        </span>
                      </td>
                      <td className="py-1 px-1.5 font-bold text-teal-600 border-r border-slate-200">{item.ot || '-'}</td>
                      <td className="py-1 px-1.5 font-bold text-rose-600 border-r border-slate-200">{item.dt || '-'}</td>
                      <td className="py-1 px-2 text-left text-slate-500 truncate">{item.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Right Column (Days Half+1 to End) */}
            <div>
              <table className="w-full text-center border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-300 text-[9px] uppercase tracking-wider">
                  <tr>
                    <th className="py-1 px-1.5 border-r border-slate-200 w-10">DATE</th>
                    <th className="py-1 px-1.5 border-r border-slate-200 w-11">ATT</th>
                    <th className="py-1 px-1.5 border-r border-slate-200 w-13">OT</th>
                    <th className="py-1 px-1.5 border-r border-slate-200 w-13">DT</th>
                    <th className="py-1 px-2 text-left">REMARKS / EVENT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rightColumnDays.map(item => (
                    <tr key={item.dateStr} className="hover:bg-slate-50">
                      <td className="py-1 px-1.5 font-bold text-slate-700 border-r border-slate-200">{item.dateStr}</td>
                      <td className="py-1 px-1.5 font-black border-r border-slate-200">
                        <span className={
                          item.att === 'P' ? 'text-teal-600 font-bold' :
                          item.att === 'ABS' ? 'text-rose-600 font-bold' :
                          item.att === 'L' ? 'text-blue-600 font-bold' :
                          item.att === 'OFF' ? 'text-indigo-600 font-black' :
                          item.att === 'HOL' ? 'text-purple-600 font-bold' :
                          item.att === 'HLD' ? 'text-cyan-600 font-bold' : 'text-slate-500'
                        }>
                          {item.att || '-'}
                        </span>
                      </td>
                      <td className="py-1 px-1.5 font-bold text-teal-600 border-r border-slate-200">{item.ot || '-'}</td>
                      <td className="py-1 px-1.5 font-bold text-rose-600 border-r border-slate-200">{item.dt || '-'}</td>
                      <td className="py-1 px-2 text-left text-slate-500 truncate">{item.remarks || '-'}</td>
                    </tr>
                  ))}
                  {/* Fill placeholder row if odd count */}
                  {rightColumnDays.length < leftColumnDays.length && (
                    <tr>
                      <td className="py-1 px-1.5 text-slate-300 border-r border-slate-200">-</td>
                      <td className="py-1 px-1.5 text-slate-300 border-r border-slate-200">-</td>
                      <td className="py-1 px-1.5 text-slate-300 border-r border-slate-200">-</td>
                      <td className="py-1 px-1.5 text-slate-300 border-r border-slate-200">-</td>
                      <td className="py-1 px-2 text-left text-slate-300">-</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Bottom Two Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Card 1: Time & Attendance Breakdown */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3.5 py-1.5 border-b border-slate-300 flex justify-between items-center text-[10px] font-headline font-black text-slate-800 uppercase tracking-wider">
                <span>TIME &amp; ATTENDANCE BREAKDOWN</span>
                <span className="text-slate-500 font-bold">MONTHLY UNITS</span>
              </div>
              <div className="p-3 space-y-2 font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Overtime Hours (OT)</span>
                  <span className="font-bold text-teal-600 font-mono">
                    {(Number(slip.otHours) || 0).toFixed(1)} Hrs (+ Rs {formatAbsPKR(slip.otPay)})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Decrease / Short Hours (DT)</span>
                  <span className="font-bold text-rose-600 font-mono">
                    {(Number(slip.dtHours) || 0).toFixed(1)} Hrs (- Rs {formatAbsPKR(slip.dtDeduction)})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Unpaid Absence Days</span>
                  <span className="font-bold text-rose-600 font-mono">
                    {slip.absentDays || 0} Day (- Rs {formatAbsPKR(slip.absentDeduction)})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Fine / Disciplinary Penalty</span>
                  <span className="font-bold text-rose-600 font-mono">
                    - Rs {formatAbsPKR(slip.fines)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Financials & Advance Recovery */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3.5 py-1.5 border-b border-slate-300 flex justify-between items-center text-[10px] font-headline font-black text-slate-800 uppercase tracking-wider">
                <span>FINANCIALS &amp; ADVANCE RECOVERY</span>
                <span className="text-slate-500 font-bold">AMOUNT (PKR)</span>
              </div>
              <div className="p-3 space-y-2 font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Attendance / Incharge Allowance</span>
                  <span className="font-bold text-teal-600 font-mono">
                    + Rs {formatAbsPKR(slip.allowances)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Company Advance Amount</span>
                  <span className="font-bold text-rose-600 font-mono">
                    - Rs {formatAbsPKR(slip.advance)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Personal Loan Installment</span>
                  <span className="font-bold text-rose-600 font-mono">
                    - Rs {formatAbsPKR(slip.loanInstallment)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700">Net Overtime &amp; Adjustment Balance</span>
                  <span className={`font-bold font-mono ${netAdjBal < 0 ? 'text-rose-600' : 'text-teal-600'}`}>
                    {formatSignedPKR(netAdjBal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Total Net Payable Amount Box */}
          <div className="border-2 border-slate-900 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white">
            <div>
              <h3 className="font-headline font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wider">
                TOTAL NET PAYABLE AMOUNT
              </h3>
              <p className="text-[11px] text-slate-500 italic mt-0.5">
                {amountInWords}
              </p>
            </div>

            <div className="font-headline font-black text-2xl sm:text-3xl text-slate-900 tracking-tight shrink-0">
              Rs {formatPKR(slip.netSalary)}
            </div>
          </div>

          {/* 7. Footer */}
          <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500 font-medium">
            <span>{identity.fullName} • Confidential Pay Sheet</span>
            <span className="font-headline font-black text-slate-800 tracking-wider">POWERED BY FLASHVISION</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      </div>

      {/* Embedded CSS for one-page A4 printing (HR Prints fix).
          Root causes of the old 2-page spill: (1) the slip was rendered
          deep inside the app tree and the old rules only used
          `visibility: hidden` on the rest of the app — hidden content
          still occupies layout height, so Chrome paginated it; the modal
          is now portaled to <body> (same pattern as FGQuickConfigModal)
          and sibling content is display:none'd out of the print flow.
          (2) The scrollable body kept `overflow-y: auto` + the 96vh cap
          in print, which mis-paginates; both are released below.
          (3) A small print-only zoom guarantees the (design-final) slip
          fits the A4 printable height with headroom. Screen UI unchanged. */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm 6mm 8mm;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          body > *:not(#fv-payslip-print-root) {
            display: none !important;
          }
          #fv-payslip-print-root {
            position: static !important;
            display: block !important;
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #fv-payslip-print-root * {
            visibility: visible !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .fv-payslip-sheet {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .fv-payslip-body {
            display: block !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            flex: none !important;
            padding: 0 !important;
            zoom: 0.94;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
