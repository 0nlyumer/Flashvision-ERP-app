import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { generateBankReconciliation, formatMoney, round2 } from '../../utils/financeEngine';
import ResizableHeader from '../ui/ResizableHeader';
import UniversalPrintPreviewModal from '../ui/UniversalPrintPreviewModal';

export default function BankReconciliation() {
  const { state } = useApp();
  const currencyCode = state.adminSetup?.baseCurrency ? state.adminSetup.baseCurrency.split(' ')[0] : 'PKR';

  // Selected Bank Account ID
  const [selectedBankId, setSelectedBankId] = useState('112010');

  // Physical Bank Statement Input
  const [statementBalanceInput, setStatementBalanceInput] = useState('');

  // Cleared Status Tracking Map: entryId -> boolean
  const [clearedMap, setClearedMap] = useState({});
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Bank Account Options
  const bankAccounts = [
    { id: '112010', name: 'HBL Main Operations A/C 0019284', branch: 'Gulberg Industrial Branch, Lahore' },
    { id: '112020', name: 'Meezan Bank Industrial A/C 099214', branch: 'Islamic Banking Corporate Wing' },
    { id: '112030', name: 'MCB Foreign Exchange A/C 772109', branch: 'Main Boulevard Branch' },
    { id: '111010', name: 'Cash in Hand - Factory Floor', branch: 'Factory Vault #1' }
  ];

  // Base Reconciliation Data
  const baseRecon = useMemo(() => {
    return generateBankReconciliation(state, selectedBankId);
  }, [state, selectedBankId]);

  // Derived effective statement balance
  const effectiveStatementBalance = statementBalanceInput !== ''
    ? Number(statementBalanceInput) || 0
    : baseRecon.statementBalance;

  // Entries with local cleared state override
  const allReconEntries = useMemo(() => {
    const raw = [...baseRecon.clearedEntries, ...baseRecon.unclearedDeposits, ...baseRecon.unclearedPayments];
    return raw.map(e => ({
      ...e,
      isCleared: clearedMap[e.id] !== undefined ? clearedMap[e.id] : !baseRecon.unclearedDeposits.includes(e) && !baseRecon.unclearedPayments.includes(e)
    }));
  }, [baseRecon, clearedMap]);

  // Dynamic calculations based on checklist
  const unclearedDepositsList = allReconEntries.filter(e => !e.isCleared && e.debit > 0);
  const unclearedPaymentsList = allReconEntries.filter(e => !e.isCleared && e.credit > 0);

  const totalUnclearedDeposits = round2(unclearedDepositsList.reduce((sum, e) => sum + e.debit, 0));
  const totalUnclearedPayments = round2(unclearedPaymentsList.reduce((sum, e) => sum + e.credit, 0));

  const bookBalance = baseRecon.bookBalance;
  const adjustedBankBalance = round2(effectiveStatementBalance + totalUnclearedDeposits - totalUnclearedPayments);
  const difference = round2(bookBalance - adjustedBankBalance);
  const isReconciled = Math.abs(difference) < 0.01;

  const toggleClearEntry = (id) => {
    setClearedMap(prev => {
      const current = prev[id] !== undefined ? prev[id] : allReconEntries.find(e => e.id === id)?.isCleared;
      return {
        ...prev,
        [id]: !current
      };
    });
  };

  const handleClearAll = () => {
    const nextMap = {};
    allReconEntries.forEach(e => {
      nextMap[e.id] = true;
    });
    setClearedMap(nextMap);
  };

  const currentBank = bankAccounts.find(b => b.id === selectedBankId) || bankAccounts[0];

  const printData = useMemo(() => {
    const reconcilingItems = allReconEntries.map((e, idx) => ({
      serial_no: idx + 1,
      date: e.date || new Date().toISOString().split('T')[0],
      reference_no: e.ref || e.voucherNo || e.id || '—',
      description: `${e.party ? e.party + ' — ' : ''}${e.narration || e.description || (e.isCleared ? 'Cleared Entry' : 'In-Transit Entry')}`,
      debit: e.debit || 0,
      credit: e.credit || 0
    }));

    return {
      statement_date: new Date().toISOString().split('T')[0],
      bank_name: `${currentBank.name} (${currentBank.branch})`,
      account_number: currentBank.id,
      closing_bank_balance: effectiveStatementBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      header: {
        statement_date: new Date().toISOString().split('T')[0],
        bank_name: `${currentBank.name} (${currentBank.branch})`,
        account_number: currentBank.id,
        closing_bank_balance: effectiveStatementBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }),
        book_balance: bookBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }),
        adjusted_bank_balance: adjustedBankBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }),
        reconciliation_status: isReconciled ? '100% Reconciled' : 'Variance Pending'
      },
      items: reconcilingItems,
      totals: {
        'Book Balance': bookBalance,
        'Bank Statement Balance': effectiveStatementBalance,
        'Uncleared Deposits': totalUnclearedDeposits,
        'Uncleared Payments': totalUnclearedPayments,
        'Adjusted Bank Balance': adjustedBankBalance,
        'Variance / Difference': difference
      }
    };
  }, [currentBank, effectiveStatementBalance, bookBalance, adjustedBankBalance, isReconciled, allReconEntries, totalUnclearedDeposits, totalUnclearedPayments, difference]);

  const handlePrint = () => {
    setShowPrintModal(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-full w-full mx-auto space-y-6">
      {showPrintModal && (
        <UniversalPrintPreviewModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          documentType="bank_reconciliation"
          documentData={printData}
          documentTitle={`BRS - ${currentBank.name}`}
        />
      )}
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-headline font-black text-on-surface tracking-tight">Bank Reconciliation Statement (BRS)</h2>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              isReconciled ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
            }`}>
              {isReconciled ? '100% Reconciled ✓' : 'Variance Pending'}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Reconcile ERP General Ledger Book Balances against Physical Bank Statements
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-xl text-xs font-bold border border-outline-variant/15 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">done_all</span>
            Clear All Items
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print BRS
          </button>
        </div>
      </div>

      {/* Account Selector & Statement Input Panel */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-1/2 space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Select Bank / Cash Account</label>
          <select
            value={selectedBankId}
            onChange={(e) => {
              setSelectedBankId(e.target.value);
              setStatementBalanceInput('');
              setClearedMap({});
            }}
            className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2.5 text-xs text-on-surface font-bold outline-none focus:ring-2 focus:ring-primary/20"
          >
            {bankAccounts.map(b => (
              <option key={b.id} value={b.id}>
                {b.id} - {b.name} ({b.branch})
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-1/2 space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Bank Statement Ending Balance (Per Physical Statement)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={statementBalanceInput !== '' ? statementBalanceInput : baseRecon.statementBalance}
              onChange={(e) => setStatementBalanceInput(e.target.value)}
              placeholder="Enter ending balance from bank statement..."
              className="w-full bg-surface-container-low border border-outline-variant/15 rounded-xl px-3 py-2.5 text-xs text-on-surface font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={() => setStatementBalanceInput('')}
              className="px-3 py-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs text-on-surface-variant font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Reconciliation KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">ERP Book Balance</span>
            <span className="p-2 bg-blue-500/10 text-blue-600 rounded-xl material-symbols-outlined text-[18px]">menu_book</span>
          </div>
          <div className="text-2xl font-headline font-black text-on-surface">
            {formatMoney(bookBalance, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">General Ledger balance</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Bank Statement Balance</span>
            <span className="p-2 bg-purple-500/10 text-purple-600 rounded-xl material-symbols-outlined text-[18px]">account_balance</span>
          </div>
          <div className="text-2xl font-headline font-black text-purple-600">
            {formatMoney(effectiveStatementBalance, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">Official bank statement figure</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Unreconciled Difference</span>
            <span className={`p-2 rounded-xl material-symbols-outlined text-[18px] ${
              isReconciled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
            }`}>
              {isReconciled ? 'check_circle' : 'pending'}
            </span>
          </div>
          <div className={`text-2xl font-headline font-black ${
            isReconciled ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            {formatMoney(difference, currencyCode)}
          </div>
          <span className="text-[11px] text-on-surface-variant mt-1">
            {isReconciled ? 'Perfect Reconciliation ✓' : 'Adjust checkoff checklist'}
          </span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Adjusted Bank Balance</span>
            <span className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl material-symbols-outlined text-[18px]">fact_check</span>
          </div>
          <div className="text-2xl font-headline font-black text-emerald-600">
            {formatMoney(adjustedBankBalance, currencyCode)}
          </div>
          <span className="text-[11px] text-emerald-600 font-bold mt-1">
            Statement + Deposits - Checks
          </span>
        </div>
      </div>

      {/* Reconciliation Checklist Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden space-y-0">
        <div className="p-4 bg-surface-container-low/40 border-b border-outline-variant/10 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-black text-on-surface">Bank Transactions Verification Checklist</h3>
            <p className="text-xs text-on-surface-variant">Check off transactions that appear on the bank statement to verify clearance</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold text-blue-600">
              Uncleared Deposits: {formatMoney(totalUnclearedDeposits, currencyCode)}
            </span>
            <span>•</span>
            <span className="font-bold text-rose-600">
              Uncleared Checks: {formatMoney(totalUnclearedPayments, currencyCode)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-outline-variant/10">
                <th className="py-3 px-4 w-12 text-center">Cleared</th>
                <ResizableHeader columnKey="date" defaultWidth={110}>Posting Date</ResizableHeader>
                <ResizableHeader columnKey="id" defaultWidth={110}>Voucher No</ResizableHeader>
                <ResizableHeader columnKey="party" defaultWidth={220}>Party / Payee / Depositor</ResizableHeader>
                <ResizableHeader columnKey="narration" defaultWidth={260}>Narration / Description</ResizableHeader>
                <ResizableHeader columnKey="deposit" defaultWidth={140} className="text-right">Deposit (Debit)</ResizableHeader>
                <ResizableHeader columnKey="withdrawal" defaultWidth={140} className="text-right">Withdrawal (Credit)</ResizableHeader>
                <ResizableHeader columnKey="status" defaultWidth={110} className="text-center">Status</ResizableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10 text-xs">
              {allReconEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                    No transactions recorded for this account.
                  </td>
                </tr>
              ) : (
                allReconEntries.map(e => (
                  <tr key={e.id} className={`hover:bg-surface-container-low/40 transition-colors ${
                    e.isCleared ? 'bg-emerald-500/5' : ''
                  }`}>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={e.isCleared}
                        onChange={() => toggleClearEntry(e.id)}
                        className="rounded text-primary focus:ring-0 cursor-pointer h-4 w-4"
                      />
                    </td>
                    <td className="py-3 px-4 font-mono text-on-surface-variant">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-mono font-bold text-primary">{e.voucherNo}</td>
                    <td className="py-3 px-4 font-bold text-on-surface">{e.party || '-'}</td>
                    <td className="py-3 px-4 text-on-surface-variant truncate max-w-[260px]">{e.narration}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-600">
                      {e.debit > 0 ? formatMoney(e.debit, '') : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                      {e.credit > 0 ? formatMoney(e.credit, '') : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        e.isCleared
                          ? 'bg-emerald-500/15 text-emerald-700'
                          : 'bg-amber-500/15 text-amber-700'
                      }`}>
                        {e.isCleared ? 'Cleared ✓' : 'In-Transit'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
