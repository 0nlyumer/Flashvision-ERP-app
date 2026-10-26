// Request-history ownership scoping (Omer, 2026-10-26).
//
// Rule: on the four HR request screens (Leave / Loan / Overtime /
// Advance), a signed-in user sees ONLY their own request history —
// never another employee's. Approvals do NOT happen on these screens
// (decisions live in the Chat Approvals Center + routing tasks and are
// synced back by AppContext's reconcile), so no approver queue is kept
// here: every user, admin included, gets their own history only.
//
// Ownership test — the same id-or-name identity test the codebase
// already uses for "is this record mine" (overtime duplicate check,
// attendance matching, loan-ledger resolution). Request records carry
// two different employeeId conventions, and both are covered:
//   - Leave / Overtime records stamp employeeId = the USER row id and
//     employeeName = the user's display name at creation time.
//   - Loan / Advance records stamp employeeId = the hr_employees id of
//     the applicant and employeeName = the employee's name.
// A record is "mine" when its employeeId is my user id OR the id of an
// hr_employees record whose name matches mine, OR its employeeName
// matches my display name (case/space-normalized).

export const normalizePersonName = (name) =>
  String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

// All identifiers that mean "me" across the request collections: my
// user id plus the hr_employees ids of employee records carrying my
// display name (an employee can legitimately appear more than once in
// hr_employees_list, so every match counts).
export function myEmployeeIds(currentUser, employees) {
  const ids = new Set();
  if (currentUser?.id !== undefined && currentUser?.id !== null && currentUser?.id !== '') {
    ids.add(String(currentUser.id));
  }
  const myName = normalizePersonName(currentUser?.name);
  if (myName) {
    (employees || []).forEach((emp) => {
      if (emp && emp.id !== undefined && emp.id !== null && normalizePersonName(emp.name) === myName) {
        ids.add(String(emp.id));
      }
    });
  }
  return ids;
}

export function isOwnRequest(record, currentUser, employees) {
  if (!record || !currentUser) return false;
  const ids = myEmployeeIds(currentUser, employees);
  if (record.employeeId !== undefined && record.employeeId !== null && record.employeeId !== '' && ids.has(String(record.employeeId))) {
    return true;
  }
  const myName = normalizePersonName(currentUser?.name);
  if (myName && record.employeeName && normalizePersonName(record.employeeName) === myName) {
    return true;
  }
  return false;
}

// The scoped view of a request collection for the signed-in user.
// Pure: never mutates the input list or its records.
export function ownRequests(requests, currentUser, employees) {
  return (requests || []).filter((record) => isOwnRequest(record, currentUser, employees));
}
