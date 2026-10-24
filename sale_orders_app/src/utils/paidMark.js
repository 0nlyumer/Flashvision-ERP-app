// --- Salary Paid-Mark flow (Omer's decision, 2026-10-24) -------------------
// Salary Generation recognises the liability only: the net of every
// finalized batch stays OUTSTANDING in Salary Payable (217010). The
// salary is actually paid later, per batch, through the "Mark Paid"
// action on the Salary Generation history screen, which posts ONE
// clearing voucher through the normal voucher system:
//     Dr Salary Payable (payroll-mapping account, fallback 217010)
//     Cr Cash in Hand (111010) — salary is paid in cash, never via a bank
// The batch record (one row of hr_generated_salaries, keyed by month)
// then carries paidAt / paidDate / paidVoucherId / paidAmount, which is
// also the double-mark guard: a batch with a paidVoucherId can never be
// marked again, and it cannot be deleted while paid (the payment would
// be orphaned in the GL) — the clearing voucher must stay posted.
//
// These helpers are pure so the flow is smoke-testable outside the UI.

import { round2 } from './financeEngine';

export const SALARY_CASH_ACCOUNT_ID = '111010'; // Cash in Hand
export const SALARY_PAYABLE_FALLBACK_ID = '217010'; // Salary Payable

// Total net payable of a generation batch (sum of its records' netSalary).
export const salaryBatchNet = (batch) => {
  const records = batch && Array.isArray(batch.records) ? batch.records : [];
  return round2(records.reduce((sum, r) => sum + (Number(r?.netSalary) || 0), 0));
};

// A batch is PAID once a clearing voucher has been recorded against it.
export const isSalaryBatchPaid = (batch) => !!(batch && (batch.paidVoucherId || batch.paidAt));

// Deleting a PAID batch is blocked: its clearing voucher would keep a
// cash payment in the GL with no salary behind it. Unpaid batches can
// be deleted freely (their payable simply disappears with the records).
export const canDeleteSalaryBatch = (batch) => {
  if (isSalaryBatchPaid(batch)) {
    return {
      ok: false,
      reason: `This payroll is marked PAID (voucher ${batch.paidVoucherId || '—'}). A paid payroll cannot be deleted — the salary payment is already posted in the General Ledger.`
    };
  }
  return { ok: true };
};

// Builds the ONE clearing voucher for a batch in the exact record shape
// the Vouchers screen saves (src/components/finance/Vouchers.jsx), so it
// posts through section C of the finance engine like any other voucher.
// status 'Posted' — never a draft: this is a real payment.
export const buildSalaryClearingVoucher = ({
  batch,
  voucherId,
  paidDate,
  payableAccountId = SALARY_PAYABLE_FALLBACK_ID,
  payableAccountName = 'Salary Payable',
  cashAccountId = SALARY_CASH_ACCOUNT_ID,
  cashAccountName = 'Cash in Hand',
  monthLabel = ''
}) => {
  const net = salaryBatchNet(batch);
  const label = monthLabel || batch?.month || '';
  return {
    id: voucherId,
    date: paidDate,
    type: 'JV',
    reference: batch?.month || '',
    narration: `Salary payment for ${label} — clearing Salary Payable`,
    status: 'Posted',
    taxApplied: false,
    totalDebit: net,
    totalCredit: net,
    salaryBatchMonth: batch?.month || null,
    isSalaryPayment: true,
    lines: [
      {
        accountId: payableAccountId,
        accountName: payableAccountName,
        narration: `Salary payable cleared for ${label}`,
        debit: net,
        credit: 0
      },
      {
        accountId: cashAccountId,
        accountName: cashAccountName,
        narration: `Net salary paid in cash for ${label}`,
        debit: 0,
        credit: net
      }
    ]
  };
};
