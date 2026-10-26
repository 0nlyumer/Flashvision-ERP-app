import React, { useMemo } from 'react';
import PrintLayout from '../ui/PrintLayout';
import { useApp } from '../../context/AppContext';
import { buildLoanLedgerStatement, formatPrintMoney, formatPrintDate } from '../../utils/hrPrintRecords';

// LoanLedgerPrintPopup — the finalized Loan Ledger statement print
// (Omer's order, 2026-10-26). Restores the 'Print Ledger Statement' the
// ledger modal lost in the tables migration, through the shared slip
// renderer (PrintLayout, documentType 'hr_loan_ledger') — the same popup
// pattern as every other slip document.
//
// Per Omer's explicit requirement, the statement makes the SALARY
// DEDUCTION status unmissable: whether payroll actually deducts this
// loan's installment with salary, how much, and via which source —
// computed by resolvePayrollLoanDeduction, a read-only mirror of
// payrollCalc's own loan resolution, so the print states the same truth
// payroll applies.
export default function LoanLedgerPrintPopup({ isOpen, onClose, ledgerItem }) {
  const { state } = useApp() || {};
  const statement = useMemo(
    () => (isOpen && ledgerItem ? buildLoanLedgerStatement(state, ledgerItem) : null),
    [isOpen, ledgerItem, state]
  );

  if (!isOpen || !ledgerItem || !statement) return null;
  const { header, summary, deduction, history } = statement;
  const today = new Date().toLocaleDateString('en-GB');

  const deductionStyle = deduction.running
    ? deduction.viaThisLedger
      ? 'border-emerald-600 bg-emerald-50'
      : 'border-amber-500 bg-amber-50'
    : 'border-red-400 bg-red-50';
  const deductionTitle = deduction.running
    ? `SALARY DEDUCTION: RUNNING — Rs ${formatPrintMoney(deduction.amount)} / month`
    : 'SALARY DEDUCTION: NOT RUNNING';

  const metaFields = [
    { label: 'Ledger #', value: header.ledger_id },
    { label: 'Employee Name', value: header.emp_name },
    { label: 'Department', value: header.department },
    { label: 'Loan Type', value: header.loan_type },
    { label: 'Ledger Status', value: header.status },
    { label: 'Loan Request Ref', value: summary.loanRequestId || '—' },
    { label: 'Repayment Start', value: formatPrintDate(summary.repaymentStartDate) },
    { label: 'Next Deduction Date', value: summary.nextDeductionDate ? formatPrintDate(summary.nextDeductionDate) : '—' }
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-scaleIn">
        <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-indigo-600 dark:text-indigo-400">print</span>
            <span className="font-bold text-sm">Loan Ledger Statement — Print</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">print</span>
              Print Document
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-900/10 dark:hover:bg-white/10 text-slate-500 dark:text-white/80 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-6 sm:p-10 bg-slate-100">
          <PrintLayout
            documentTitle="LOAN LEDGER STATEMENT"
            documentId={header.ledger_id}
            date={today}
            documentType="hr_loan_ledger"
            customerName={header.emp_name}
            extraMeta={metaFields.slice(0, 4)}
          >
            <div className="my-6 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
              {metaFields.map((f, idx) => (
                <div key={idx} className="border-b border-dashed border-slate-300 pb-1.5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{f.label}</div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">{f.value}</div>
                </div>
              ))}
            </div>

            {/* Salary deduction status — the clarity Omer ordered */}
            <div className={`my-4 border-2 rounded-lg p-4 ${deductionStyle}`}>
              <div className="font-black text-sm tracking-wide text-slate-900">{deductionTitle}</div>
              <p className="text-xs font-semibold text-slate-700 mt-1 leading-relaxed">{deduction.note}</p>
              {deduction.running && !deduction.viaThisLedger && (
                <p className="text-xs font-semibold text-slate-700 mt-1 leading-relaxed">
                  This ledger entry&rsquo;s own installment is Rs {formatPrintMoney(summary.monthlyInstallment)} / month.
                </p>
              )}
            </div>

            <div className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Principal Amount', value: `Rs ${formatPrintMoney(summary.totalLoanAmount)}` },
                { label: 'Monthly Installment', value: `Rs ${formatPrintMoney(summary.monthlyInstallment)}` },
                { label: 'Total Recovered', value: `Rs ${formatPrintMoney(summary.paidAmount)}` },
                { label: 'Balance Due', value: `Rs ${formatPrintMoney(summary.remainingBalance)}` }
              ].map((s, idx) => (
                <div key={idx} className="border border-slate-300 rounded-lg p-3 bg-white">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{s.label}</div>
                  <div className="text-sm font-black text-slate-900 mt-1">{s.value}</div>
                </div>
              ))}
            </div>

            {history.length > 0 ? (
              <table className="w-full border-collapse border border-slate-300 text-xs my-4">
                <thead>
                  <tr className="bg-slate-800 text-white font-bold">
                    <th className="border border-slate-300 p-2 text-center">Sr #</th>
                    <th className="border border-slate-300 p-2 text-center">Date</th>
                    <th className="border border-slate-300 p-2 text-left">Type</th>
                    <th className="border border-slate-300 p-2 text-right">Amount (Rs)</th>
                    <th className="border border-slate-300 p-2 text-right">Balance After (Rs)</th>
                    <th className="border border-slate-300 p-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.serial_no}>
                      <td className="border border-slate-300 p-2 text-center">{row.serial_no}</td>
                      <td className="border border-slate-300 p-2 text-center">{row.date}</td>
                      <td className="border border-slate-300 p-2">{row.type}</td>
                      <td className="border border-slate-300 p-2 text-right font-bold">{row.amount}</td>
                      <td className="border border-slate-300 p-2 text-right">{row.balance_after}</td>
                      <td className="border border-slate-300 p-2">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="my-4 text-center text-xs font-semibold text-slate-500">
                No deductions or payments recorded against this loan yet.
              </div>
            )}
          </PrintLayout>
        </div>
      </div>
    </div>
  );
}
