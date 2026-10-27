// Loan lifecycle helpers — the single source of truth for how a loan
// REQUEST (state.hr_loan_requests) and its LEDGER entry
// (state.hr_loan_ledger) relate. Used by payroll (payrollCalc), the
// payroll mirror behind the loan prints (hrPrintRecords), the HR
// reconcile in AppContext and the Loan Ledger screen.
//
// THE FLAW THIS FIXES (Omer-approved fix, 2026-10-28): a loan request
// stayed 'Approved' forever, even after its ledger entry was fully
// recovered ('Completed'). Payroll's request branch then kept deducting
// the full installment every month — uncapped and endless — because
// salary generation never debits the ledger and nothing ever closed
// the request. The rules now:
//   1. The LEDGER is the source of truth for recovery. An 'Approved'
//      request deducts through payroll ONLY when no ledger entry
//      tracks it. (An entry is created for every approved loan; until
//      it exists, the request path keeps the deduction running — the
//      pre-ledger behaviour — and once it exists, the ledger branch
//      governs: Active entry -> min(installment, remaining balance);
//      settled entry -> 0. The loan can never be over-recovered.)
//   2. When a ledger entry is settled, its request is settled too:
//      status 'Repaid' — the status HRLoanRequest has always displayed
//      but nothing ever set. reconcileHRApprovalsAndLedgers applies
//      this on every state pass (self-healing), and the Loan Ledger
//      screen applies it the moment an entry completes.

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// Does this ledger entry belong to the request's employee?
const sameEmployee = (l, req) => {
  if (!l || !req) return false;
  if (req.employeeId && String(l.employeeId ?? '') === String(req.employeeId)) return true;
  if (
    req.employeeName &&
    String(l.employeeName ?? '').toLowerCase() === String(req.employeeName).toLowerCase()
  ) {
    return true;
  }
  return false;
};

// The ledger entry tracking a request, or null. Pairing mirrors the
// ledger creators (AppContext reconcile + the setCollection hook):
// the explicit loanRequestId link first, then employee + principal
// amount. An id match that also belongs to the same employee always
// wins (ids are unique per request in real data; the employee check
// keeps the pairing exact even if legacy data ever reuses an id).
// Among amount-pair matches an ACTIVE entry wins, so a fresh loan is
// never shadowed by an older settled loan of the same amount.
export function ledgerEntryForRequest(loanLedger, req) {
  if (!Array.isArray(loanLedger) || !req) return null;
  if (req.id) {
    const byId = loanLedger.filter(
      (l) => l && l.loanRequestId && String(l.loanRequestId) === String(req.id)
    );
    if (byId.length) return byId.find((l) => sameEmployee(l, req)) || byId[0];
  }
  const amount = num(req.amount ?? req.loanAmount);
  const pairMatches = loanLedger.filter(
    (l) => l && num(l.totalLoanAmount) === amount && sameEmployee(l, req)
  );
  if (pairMatches.length === 0) return null;
  return pairMatches.find((l) => l.status === 'Active') || pairMatches[0];
}

// Every ledger entry tracking a request (id link or employee+amount pair).
export function ledgerEntriesForRequest(loanLedger, req) {
  if (!Array.isArray(loanLedger) || !req) return [];
  const amount = num(req.amount ?? req.loanAmount);
  const idMatches = req.id
    ? loanLedger.filter(
        (l) => l && l.loanRequestId && String(l.loanRequestId) === String(req.id)
      )
    : [];
  const consistentIdMatches = idMatches.filter((l) => sameEmployee(l, req));
  const idSet = new Set(consistentIdMatches.length ? consistentIdMatches : idMatches);
  return loanLedger.filter((l) => {
    if (!l) return false;
    if (idSet.has(l)) return true;
    return num(l.totalLoanAmount) === amount && sameEmployee(l, req);
  });
}

// A ledger entry is settled when the loan is fully recovered: the
// screen marks it 'Completed' at zero balance; the balance test also
// covers entries whose status was never updated.
export function isLedgerSettled(entry) {
  if (!entry) return false;
  if (entry.status === 'Completed') return true;
  return num(entry.totalLoanAmount) > 0 && num(entry.remainingBalance) <= 0;
}

// Rule 2: flip every 'Approved' request whose loan is settled to
// 'Repaid'. The linked (preferred) entry decides; when a request is
// tracked only by amount-pair matches, ALL of them must be settled —
// an ambiguous pairing never closes a request. Returns the (possibly
// new) array plus whether anything changed, so callers skip no-op
// writes.
export function settleRepaidLoanRequests(loanRequests, loanLedger) {
  if (!Array.isArray(loanRequests)) return { requests: loanRequests, changed: false };
  let changed = false;
  const requests = loanRequests.map((req) => {
    if (!req || req.status !== 'Approved') return req;
    const preferred = ledgerEntryForRequest(loanLedger, req);
    if (!preferred) return req;
    let settled = isLedgerSettled(preferred);
    if (settled && !(req.id && preferred.loanRequestId && String(preferred.loanRequestId) === String(req.id))) {
      // Amount-pair tracking only: require every tracking entry settled.
      settled = ledgerEntriesForRequest(loanLedger, req).every((l) => isLedgerSettled(l));
    }
    if (!settled) return req;
    changed = true;
    return { ...req, status: 'Repaid' };
  });
  return { requests, changed };
}
