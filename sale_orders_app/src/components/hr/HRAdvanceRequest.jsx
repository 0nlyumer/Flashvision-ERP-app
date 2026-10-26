import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDialog } from '../../context/DialogContext';
import HRRequestPrintPopup from './HRRequestPrintPopup';
import { buildAdvanceRequestPrintRecord } from '../../utils/hrPrintRecords';

export default function HRAdvanceRequest({ isMobile }) {
  const { state, setCollection, startRoutingWorkflow, currencySymbol, currentUser } = useApp();
  const { appAlert } = useDialog();
  const currSym = currencySymbol || 'Rs.';

  // Employees list from global state
  const employees = React.useMemo(() => (state.hr_employees_list || []).filter(e => (e.status || 'Active').toLowerCase() === 'active'), [state.hr_employees_list]);

  // Current date & default deduction month (YYYY-MM)
  const getCurrentMonthISO = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  };

  // Form Inputs State
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || 'EMP-304');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [deductionMonth, setDeductionMonth] = useState(getCurrentMonthISO());
  const [justification, setJustification] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);

  // Searchable Employee Dropdown State
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);

  // Filters & Selected Details Modal State
  const [statusTabFilter, setStatusTabFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequestForDetail, setSelectedRequestForDetail] = useState(null);
  const [printingRequest, setPrintingRequest] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Selected Employee Record
  const selectedEmp = employees.find(e => String(e.id) === String(selectedEmpId)) || employees[0] || {
    id: 'EMP-304',
    name: currentUser?.name || 'Umer Ali',
    department: 'Operations',
    designation: 'Senior Associate',
    basicSalary: 250000
  };

  const filteredEmpList = employees.filter(emp => 
    !empSearchQuery ||
    (emp.name && emp.name.toLowerCase().includes(empSearchQuery.toLowerCase())) ||
    (emp.id && String(emp.id).toLowerCase().includes(empSearchQuery.toLowerCase())) ||
    (emp.department && emp.department.toLowerCase().includes(empSearchQuery.toLowerCase()))
  );

  // Compute exact Net Salary with Attendance & Deduction sync
  const computeEmployeeNetSalary = (emp) => {
    if (!emp) return 0;
    const baseSalary = parseFloat(emp.basicSalary || emp.salary || 35000);
    
    let absentsCount = 0;
    let lateHours = 0;
    let fines = 0;
    let otHours = 0;
    let workedDays = 0;

    const targetMonth = deductionMonth || getCurrentMonthISO();
    const attendanceLogs = state.hr_uploaded_attendance || [];
    const empNameLower = String(emp.name || '').trim().toLowerCase();

    const empLogs = attendanceLogs.filter(a => 
      ((a.employeeId && String(a.employeeId) === String(emp.id)) || (a.employeeName && String(a.employeeName).trim().toLowerCase() === empNameLower)) && 
      (a.date && a.date.startsWith(targetMonth))
    );

    if (empLogs.length > 0) {
      empLogs.forEach(a => {
        const st = (a.status || '').toLowerCase();
        if (st === 'present' || st === 'off day' || st === 'offday' || st === 'holiday' || st === 'leave') workedDays++;
        else if (st === 'absent') absentsCount++;
        lateHours += parseFloat(a.deductions || a.lateHours || 0) || 0;
        fines += parseFloat(a.fines || a.fine || 0) || 0;
        otHours += parseFloat(a.ot || a.overtimeHours || 0) || 0;
      });
    } else if (emp.attendance) {
      Object.entries(emp.attendance).forEach(([dayKey, rec]) => {
        const st = (rec.status || '').toLowerCase();
        if (st === 'present' || st === 'off day' || st === 'offday' || st === 'holiday' || st === 'leave') workedDays++;
        else if (st === 'absent') absentsCount++;
        lateHours += parseFloat(rec.deductions || rec.lateHours || 0) || 0;
        fines += parseFloat(rec.fines || rec.fine || 0) || 0;
        otHours += parseFloat(rec.ot || rec.overtime || 0) || 0;
      });
    }

    const totalWorkingDays = 22;
    const hourlyRate = baseSalary / 176;
    const absentDeduction = absentsCount * (baseSalary / totalWorkingDays);
    const lateDeduction = lateHours * hourlyRate;
    const otAmount = otHours * hourlyRate * 1.5;

    let allowance = 0;
    if (absentsCount === 0) {
      try {
        const savedConfig = localStorage.getItem('hr_salary_allowance_config');
        if (savedConfig) {
          const salaryConfig = JSON.parse(savedConfig);
          allowance = parseFloat(salaryConfig?.attendanceAllowance?.bonusAmount ?? 150) || 150;
        } else { allowance = 150; }
      } catch(e) { allowance = 150; }
    }

    const loanDeduction = parseFloat(emp.loan || emp.loanAmount || 0) || 0;
    const advanceDeduction = parseFloat(emp.advance || emp.advanceAmount || 0) || 0;

    const totalDeductions = absentDeduction + lateDeduction + fines + loanDeduction + advanceDeduction;
    const totalAdditions = otAmount + allowance;

    return Math.max(0, Math.round(baseSalary + totalAdditions - totalDeductions));
  };

  const netSalary = computeEmployeeNetSalary(selectedEmp);
  const maxAdvanceAvailable = Math.round(netSalary * 0.5); // 50% limit of net salary

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Requests list from global state
  const advanceRequests = state.hr_advance_requests || [];

  // Filtered requests for table
  const filteredRequests = advanceRequests.filter(r => {
    const matchesTab = statusTabFilter === 'All' || r.status === statusTabFilter;
    const matchesSearch = !searchTerm || 
      (r.id && r.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.employeeName && r.employeeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.department && r.department.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachedFile(file.name);
    }
  };

  const handleSubmitApplication = (e) => {
    if (e) e.preventDefault();

    const amountNum = parseFloat(advanceAmount);
    if (!amountNum || amountNum <= 0) {
      appAlert('Please enter a valid advance amount.', 'error');
      return;
    }

    if (amountNum > maxAdvanceAvailable) {
      appAlert(`Requested amount exceeds maximum advance limit (${currSym} ${maxAdvanceAvailable.toLocaleString()}).`, 'error');
      return;
    }

    const newReqId = `#ADV-${Math.floor(1000 + Math.random() * 9000)}`;

    // Check if Document Routing Automation rule exists for Advance Request
    let rules = state.routingRules || [];
    if (rules.length === 0) {
      try {
        const savedRules = localStorage.getItem('hr_routing_rules_config');
        if (savedRules) rules = JSON.parse(savedRules);
      } catch (err) {}
    }

    const isApprovalRequired = rules.some(r => 
      r.status === 'Active' && 
      r.steps?.some(s => 
        s.type === 'document_trigger' && 
        (s.config?.selectAll || s.config?.selectedDocTypes?.includes('Advance Request') || s.config?.selectedDocTypes?.includes('hr_advance_requests'))
      )
    );

    const initialStatus = isApprovalRequired ? 'Pending' : 'Approved';

    const newRecord = {
      id: newReqId,
      employeeId: selectedEmp.id,
      employeeName: selectedEmp.name,
      department: selectedEmp.department || 'Operations',
      designation: selectedEmp.designation || 'Staff',
      dateApplied: new Date().toISOString().substring(0, 10),
      deductionMonth: deductionMonth,
      type: 'Single Month Advance',
      amount: amountNum,
      purpose: justification || 'Salary Advance Request',
      status: initialStatus,
      fileName: attachedFile || null,
      createdAt: new Date().toISOString()
    };

    const updatedList = [newRecord, ...advanceRequests];
    setCollection('hr_advance_requests', updatedList);

    // If approval workflow is active, generate approval item
    if (isApprovalRequired) {
      const approvalItem = {
        id: `APP-ADV-${newReqId.replace('#', '')}`,
        type: 'Advance Request',
        requestedTo: 'admin',
        requestedBy: currentUser?.username || 'user',
        details: `[Single Month Advance] ${selectedEmp.name} (${selectedEmp.department}) - Amount: ${currSym} ${amountNum.toLocaleString()} (Recovery: ${deductionMonth})`,
        value: `${currSym} ${amountNum.toLocaleString()}`,
        documentId: newReqId,
        loanRequestId: newReqId,
        status: 'Pending',
        timestamp: Date.now()
      };
      setCollection('approvals', [approvalItem, ...(state.approvals || [])]);

      startRoutingWorkflow({
        id: newReqId,
        title: `Salary Advance Request - ${selectedEmp.name} (${currSym} ${amountNum.toLocaleString()})`,
        type: 'Advance Request',
        details: `Salary advance requested by ${selectedEmp.name} for deduction in ${deductionMonth}. Reason: ${justification || 'N/A'}`,
        createdBy: currentUser?.username || 'user'
      });

      triggerToast(`Advance Request ${newReqId} submitted for Routing Approval!`);
    } else {
      triggerToast(`Advance Request ${newReqId} approved directly!`);
    }

    // Reset Form
    setAdvanceAmount('');
    setJustification('');
    setAttachedFile(null);
  };

  // Print — shared slip popup (request prints final, 2026-10-26). This
  // handler previously navigated to a '/print' route that does not exist
  // in the router, so every Advance print button landed on the route
  // error boundary.
  const handlePrintRequest = (req) => {
    if (req) setPrintingRequest(req);
  };

  return (
    <div className="w-full flex-1 bg-surface py-6 px-4 md:px-8 font-body animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto flex flex-col gap-6">

        {/* Top Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">account_balance</span>
              </div>
              <div>
                <h1 className="text-2xl font-black text-on-surface font-headline tracking-tight">Single Month Salary Advance</h1>
                <p className="text-xs font-semibold text-on-surface-variant">Request a one-time salary advance to be recovered in full from the next payroll cycle.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => handlePrintRequest(advanceRequests[0])}
              disabled={advanceRequests.length === 0}
              title={advanceRequests.length === 0 ? 'No advance requests to print yet' : 'Print the most recent advance request'}
              className="flex-1 md:flex-none primary-gradient text-on-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              Print Document
            </button>
          </div>
        </div>

        {/* Main Grid: Left Form (Col-8) & Right Summary (Col-4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Form & History Table */}
          <div className="lg:col-span-8 flex flex-col gap-6">

            {/* Section 1: Employee Selection */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <span className="material-symbols-outlined text-[20px]">person_search</span>
                <span>Select Employee</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                {/* Searchable Employee Selector */}
                <div className="relative flex-1">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1.5">Search Employee ID or Name</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                    <input 
                      type="text"
                      value={isEmpDropdownOpen ? empSearchQuery : `${selectedEmp.id} — ${selectedEmp.name}`}
                      onFocus={() => { setIsEmpDropdownOpen(true); setEmpSearchQuery(''); }}
                      onChange={(e) => { setEmpSearchQuery(e.target.value); setIsEmpDropdownOpen(true); }}
                      placeholder="Type employee name or ID..."
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-9 pr-8 py-2.5 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">
                      {isEmpDropdownOpen ? 'unfold_less' : 'unfold_more'}
                    </span>
                  </div>

                  {isEmpDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto p-1.5 space-y-1">
                      {filteredEmpList.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400 font-semibold">No matching employee found</div>
                      ) : (
                        filteredEmpList.map(emp => (
                          <div 
                            key={emp.id}
                            onClick={() => {
                              setSelectedEmpId(emp.id);
                              setIsEmpDropdownOpen(false);
                              setEmpSearchQuery('');
                            }}
                            className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                              String(emp.id) === String(selectedEmpId)
                                ? 'bg-primary/10 border border-primary/20 text-primary font-bold'
                                : 'hover:bg-slate-100 text-on-surface'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs">
                                {emp.name?.charAt(0) || 'E'}
                              </div>
                              <div>
                                <p className="text-xs font-bold leading-none">{emp.name} <span className="text-[10px] text-slate-400 font-normal">({emp.id})</span></p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{emp.department || 'Operations'} • {emp.designation || 'Staff'}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-secondary">
                              {currSym} {parseFloat(emp.basicSalary || emp.salary || 250000).toLocaleString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Employee Info Card */}
                <div className="bg-primary/5 rounded-xl p-3.5 border border-primary/10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
                    {selectedEmp.name?.charAt(0) || 'E'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-primary truncate">{selectedEmp.name} ({selectedEmp.id})</p>
                    <p className="text-[11px] text-on-surface-variant truncate">{selectedEmp.department || 'Operations'} • {selectedEmp.designation || 'Staff'}</p>
                    <p className="text-[11px] font-bold text-secondary mt-0.5">Net Salary: {currSym} {netSalary.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Advance Configuration Form */}
            <form onSubmit={handleSubmitApplication} className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm flex flex-col gap-6">
              <div className="flex items-center gap-2 text-primary font-bold text-sm border-b border-outline-variant/15 pb-3">
                <span className="material-symbols-outlined text-[20px]">tune</span>
                <span>Advance Configuration</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Advance Amount */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Advance Amount ({currSym})</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{currSym}</span>
                    <input
                      type="number"
                      value={advanceAmount}
                      onChange={(e) => setAdvanceAmount(e.target.value)}
                      placeholder={`e.g. 50000`}
                      className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3 pl-10 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] mt-1 font-medium">
                    <span className="text-on-surface-variant">Max Available Limit (50%):</span>
                    <span className="font-bold text-primary">{currSym} {maxAdvanceAvailable.toLocaleString()}</span>
                  </div>
                </div>

                {/* Deduction Month */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Deduction Payroll Month</label>
                  <input
                    type="month"
                    value={deductionMonth}
                    onChange={(e) => setDeductionMonth(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-3 py-2.5 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  />
                  <span className="text-[10px] text-on-surface-variant">Amount will be recovered in full from this payroll.</span>
                </div>
              </div>

              {/* Justification / Reason */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Reason / Justification</label>
                <textarea
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="State operational or personal emergency requiring salary advance..."
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl p-3 text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>

              {/* File Attachment */}
              <div className="flex items-center gap-4">
                <label className="cursor-pointer bg-surface-container-low border border-dashed border-outline-variant/40 hover:border-primary px-4 py-3 rounded-xl text-xs font-bold text-primary transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">attach_file</span>
                  <span>{attachedFile ? attachedFile : 'Attach Supporting Document'}</span>
                  <input type="file" onChange={handleFileUpload} className="hidden" />
                </label>
                {attachedFile && (
                  <button type="button" onClick={() => setAttachedFile(null)} className="text-xs text-red-500 font-bold hover:underline">
                    Remove
                  </button>
                )}
              </div>

              {/* Form Action */}
              <div className="flex justify-end gap-3 pt-3 border-t border-outline-variant/15">
                <button
                  type="submit"
                  className="primary-gradient text-on-primary px-6 py-3 rounded-xl text-xs font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Submit Advance Request
                </button>
              </div>
            </form>

            {/* Section 3: Salary Advance History Table */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 bg-surface-container-low border-b border-outline-variant/15 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">history</span>
                  <h3 className="text-sm font-bold text-on-surface font-headline">Salary Advance History</h3>
                  <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-full">{filteredRequests.length}</span>
                </div>

                {/* Filter Tabs & Search */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                  <input
                    type="text"
                    placeholder="Search request..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-white border border-outline-variant/20 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
                  />
                  {['All', 'Pending', 'Approved', 'Rejected'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setStatusTabFilter(tab)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        statusTabFilter === tab 
                          ? 'bg-primary text-white shadow-sm' 
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-outline-variant/15'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table Data */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-high/50 border-b border-outline-variant/15 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                      <th className="p-4">Request ID</th>
                      <th className="p-4">Employee</th>
                      <th className="p-4">Deduction Month</th>
                      <th className="p-4 text-right">Amount ({currSym})</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/15 text-xs font-medium">
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          <span className="material-symbols-outlined text-[36px] opacity-40 mb-1">payments</span>
                          <p className="font-semibold text-xs">No salary advance requests found.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map(req => (
                        <tr key={req.id} className="hover:bg-primary/5 transition-colors group">
                          <td className="p-4 font-bold text-primary">{req.id}</td>
                          <td className="p-4">
                            <p className="font-bold text-on-surface">{req.employeeName}</p>
                            <p className="text-[10px] text-on-surface-variant">{req.department}</p>
                          </td>
                          <td className="p-4 font-semibold text-on-surface">{req.deductionMonth}</td>
                          <td className="p-4 text-right font-black text-on-surface">{currSym} {parseFloat(req.amount || 0).toLocaleString()}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' :
                              req.status === 'Rejected' ? 'bg-red-500/10 text-red-700 border border-red-500/20' :
                              'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                            }`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="p-4 text-right flex items-center justify-end gap-2">
                            <button
                              onClick={() => handlePrintRequest(req)}
                              title="Print Advance Form"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">print</span>
                            </button>
                            <button
                              onClick={() => setSelectedRequestForDetail(req)}
                              title="View Details"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Column: Impact Summary & Guidelines (Col-4) */}
          <div className="lg:col-span-4 flex flex-col gap-6 sticky top-6">

            {/* Impact Summary Box */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden shadow-sm flex flex-col">
              <div className="p-5 primary-gradient text-on-primary">
                <h3 className="font-bold text-sm font-headline">Impact Summary</h3>
                <p className="text-[11px] opacity-80 mt-0.5">One-time deduction review for {selectedEmp.name}</p>
              </div>

              <div className="p-5 flex flex-col gap-4 text-xs font-semibold">
                <div className="flex justify-between items-center pb-3 border-b border-outline-variant/15">
                  <span className="text-on-surface-variant">Net Monthly Salary</span>
                  <span className="font-bold text-on-surface">{currSym} {netSalary.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-outline-variant/15">
                  <span className="text-on-surface-variant">Requested Advance</span>
                  <span className="font-black text-primary">{currSym} {(parseFloat(advanceAmount) || 0).toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center pb-3 border-b border-outline-variant/15">
                  <span className="text-on-surface-variant">Recovery Mode</span>
                  <span className="font-bold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">Single Payroll Deduct</span>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-on-surface-variant">Expected Net Pay ({deductionMonth})</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {currSym} {Math.max(0, netSalary - (parseFloat(advanceAmount) || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Policy Guidelines Box */}
            <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/15 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <span className="material-symbols-outlined text-[18px]">info</span>
                <span>Advance Policy Guidelines</span>
              </div>
              <ul className="text-[11px] text-on-surface-variant space-y-2 list-disc pl-4 font-medium">
                <li>Salary advance is limited to maximum 50% of the employee's net monthly salary.</li>
                <li>Full advance amount is recovered in a single installment from the specified payroll month.</li>
                <li>If active Document Routing is configured, requests will require management authorization.</li>
              </ul>
            </div>

          </div>

        </div>

      </div>

      {/* Details Modal */}
      {selectedRequestForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white max-w-lg w-full rounded-3xl p-6 shadow-2xl flex flex-col gap-5 border border-outline-variant/15">
            <div className="flex justify-between items-center border-b border-outline-variant/15 pb-4">
              <div>
                <h3 className="text-lg font-black text-on-surface font-headline">{selectedRequestForDetail.id} Details</h3>
                <p className="text-xs font-semibold text-on-surface-variant">{selectedRequestForDetail.employeeName} ({selectedRequestForDetail.department})</p>
              </div>
              <button onClick={() => setSelectedRequestForDetail(null)} className="text-slate-400 hover:text-slate-700">
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Advance Amount:</span>
                <span className="font-bold text-primary">{currSym} {parseFloat(selectedRequestForDetail.amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Recovery Month:</span>
                <span className="font-bold text-slate-800">{selectedRequestForDetail.deductionMonth}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Application Date:</span>
                <span className="font-bold text-slate-800">{selectedRequestForDetail.dateApplied}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Status:</span>
                <span className="font-extrabold uppercase text-amber-600">{selectedRequestForDetail.status}</span>
              </div>
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-slate-500 font-bold">Reason:</span>
                <p className="bg-slate-50 p-2.5 rounded-xl border text-slate-700">{selectedRequestForDetail.purpose || 'No reason provided.'}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => handlePrintRequest(selectedRequestForDetail)}
                className="px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-xs shadow hover:bg-primary-container"
              >
                Print Slip
              </button>
              <button
                onClick={() => setSelectedRequestForDetail(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print — shared slip popup (Print Settings design for hr_advance_request) */}
      <HRRequestPrintPopup
        isOpen={!!printingRequest}
        onClose={() => setPrintingRequest(null)}
        docType="hr_advance_request"
        record={printingRequest ? buildAdvanceRequestPrintRecord(printingRequest) : null}
        sourceRecord={printingRequest}
      />
    </div>
  );
}
