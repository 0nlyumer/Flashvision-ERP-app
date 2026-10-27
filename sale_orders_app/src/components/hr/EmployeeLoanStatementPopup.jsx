import React, { useMemo, useState } from 'react';
import PrintLayout from '../ui/PrintLayout';
import { useApp } from '../../context/AppContext';
import { buildEmployeeLoanStatement, formatPrintMoney } from '../../utils/hrPrintRecords';

// EmployeeLoanStatementPopup — the employee-wise Loan Ledger print
// (Omer's order, 2026-10-27): pick an employee, see and print their FULL
// loan position across every loan — total disbursed, total recovered,
// balance remaining — with each disbursement and deduction as a dated
// event with a running balance. Same popup pattern and shared slip
// renderer (PrintLayout, documentType 'hr_loan_ledger') as the per-entry
// Loan Ledger Statement; the registry's Loan Ledger PRINT action gates
// it (canPrint prop from HRLoanLedger).
export default function EmployeeLoanStatementPopup({ isOpen, onClose, canPrint = true }) {
  const { state } = useApp() || {};
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const employees = state?.hr_employees_list || [];
  const loanLedger = state?.hr_loan_ledger || [];

  // Employees with loans first (most relevant), then everyone else.
  const employeeOptions = useMemo(() => {
    const withLoans = [];
    const withoutLoans = [];
    employees.forEach((emp) => {
      const count = loanLedger.filter((l) =>
        String(l?.employeeId ?? '') === String(emp.id ?? '') ||
        String(l?.employeeName ?? '').toLowerCase() === String(emp.name ?? '').toLowerCase()
      ).length;
      (count > 0 ? withLoans : withoutLoans).push({ emp, count });
    });
    const byName = (a, b) => String(a.emp.name || '').localeCompare(String(b.emp.name || ''));
    return [...withLoans.sort(byName), ...withoutLoans.sort(byName)];
  }, [employees, loanLedger]);

  const selectedEmployee = useMemo(() => {
    if (selectedEmployeeId) return employees.find((e) => String(e.id) === String(selectedEmployeeId)) || null;
    return employeeOptions[0]?.emp || employees[0] || null;
  }, [selectedEmployeeId, employees, employeeOptions]);

  const statement = useMemo(
    () => (isOpen && selectedEmployee ? buildEmployeeLoanStatement(state, selectedEmployee) : null),
    [isOpen, selectedEmployee, state]
  );

  if (!isOpen) return null;
  const today = new Date().toLocaleDateString('en-GB');
  const { header, summary, deduction, loans, events } = statement || {
    header: {}, summary: {}, deduction: { amount: 0, source: null }, loans: [], events: []
  };

  const metaFields = [
    { label: 'Employee Name', value: header.emp_name || '—' },
    { label: 'Employee Code', value: header.emp_code || '—' },
    { label: 'Department', value: header.department || '—' },
    { label: 'Statement Date', value: today },
    { label: 'Total Loans', value: String(summary.loanCount ?? 0) },
    { label: 'Active Loans', value: String(summary.activeLoans ?? 0) },
    { label: 'Settled Loans', value: String(summary.settledLoans ?? 0) },
    {
      label: 'Salary Deduction',
      value: deduction && deduction.amount > 0
        ? `Running — Rs ${formatPrintMoney(deduction.amount)} / month`
        : 'Not running'
    }
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-scaleIn">
        <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] shrink-0 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-indigo-600 dark:text-indigo-400">print</span>
            <span className="font-bold text-sm">Employee Loan Statement — Print</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedEmployee ? String(selectedEmployee.id) : ''}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white cursor-pointer max-w-[260px]"
            >
              {employeeOptions.map(({ emp, count }) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.name}{count > 0 ? ` — ${count} loan${count === 1 ? '' : 's'}` : ' — no loans'}
                </option>
              ))}
            </select>
            <button
              onClick={() => window.print()}
              disabled={!canPrint}
              className={`px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${canPrint ? 'hover:bg-indigo-700 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
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
          {statement && summary.loanCount > 0 ? (
            <PrintLayout
              documentTitle="EMPLOYEE LOAN STATEMENT"
              documentId={header.emp_code}
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

              <div className="my-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Total Loan Taken', value: `Rs ${formatPrintMoney(summary.totalLoan)}` },
                  { label: 'Total Recovered', value: `Rs ${formatPrintMoney(summary.totalRecovered)}` },
                  { label: 'Balance Remaining', value: `Rs ${formatPrintMoney(summary.balanceRemaining)}` }
                ].map((s, idx) => (
                  <div key={idx} className="border border-slate-300 rounded-lg p-3 bg-white">
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{s.label}</div>
                    <div className="text-base font-black text-slate-900 mt-1">{s.value}</div>
                  </div>
                ))}
              </div>

              <table className="w-full border-collapse border border-slate-300 text-xs my-4">
                <thead>
                  <tr className="bg-slate-800 text-white font-bold">
                    <th className="border border-slate-300 p-2 text-left">Loan #</th>
                    <th className="border border-slate-300 p-2 text-left">Type</th>
                    <th className="border border-slate-300 p-2 text-center">Date</th>
                    <th className="border border-slate-300 p-2 text-right">Principal (Rs)</th>
                    <th className="border border-slate-300 p-2 text-right">Installment (Rs)</th>
                    <th className="border border-slate-300 p-2 text-right">Recovered (Rs)</th>
                    <th className="border border-slate-300 p-2 text-right">Balance (Rs)</th>
                    <th className="border border-slate-300 p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => (
                    <tr key={loan.id}>
                      <td className="border border-slate-300 p-2 font-bold">{loan.id}</td>
                      <td className="border border-slate-300 p-2">{loan.loan_type}</td>
                      <td className="border border-slate-300 p-2 text-center">{loan.date}</td>
                      <td className="border border-slate-300 p-2 text-right">{loan.principal}</td>
                      <td className="border border-slate-300 p-2 text-right">{loan.installment}</td>
                      <td className="border border-slate-300 p-2 text-right">{loan.recovered}</td>
                      <td className="border border-slate-300 p-2 text-right font-bold">{loan.balance}</td>
                      <td className="border border-slate-300 p-2 text-center">{loan.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="w-full border-collapse border border-slate-300 text-xs my-4">
                <thead>
                  <tr className="bg-slate-800 text-white font-bold">
                    <th className="border border-slate-300 p-2 text-center">Sr #</th>
                    <th className="border border-slate-300 p-2 text-center">Date</th>
                    <th className="border border-slate-300 p-2 text-left">Description</th>
                    <th className="border border-slate-300 p-2 text-right">Loan Given (Rs)</th>
                    <th className="border border-slate-300 p-2 text-right">Recovered (Rs)</th>
                    <th className="border border-slate-300 p-2 text-right">Balance After (Rs)</th>
                    <th className="border border-slate-300 p-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((row) => (
                    <tr key={row.serial_no}>
                      <td className="border border-slate-300 p-2 text-center">{row.serial_no}</td>
                      <td className="border border-slate-300 p-2 text-center">{row.date}</td>
                      <td className="border border-slate-300 p-2">{row.description}</td>
                      <td className="border border-slate-300 p-2 text-right font-bold">{row.loan_amount}</td>
                      <td className="border border-slate-300 p-2 text-right">{row.recovered}</td>
                      <td className="border border-slate-300 p-2 text-right">{row.balance_after}</td>
                      <td className="border border-slate-300 p-2">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PrintLayout>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <span className="material-symbols-outlined text-5xl text-slate-400">account_balance</span>
              <p className="mt-3 text-sm font-bold text-slate-600">
                {selectedEmployee ? `${selectedEmployee.name} has no loans on the ledger.` : 'No employees found.'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Pick another employee from the selector above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
