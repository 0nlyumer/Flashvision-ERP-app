import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

export default function HRLoanRequest({ isMobile }) {
  const { state, setCollection, startRoutingWorkflow, currencySymbol } = useApp();
  const navigate = useNavigate();
  const currSym = currencySymbol || 'Rs.';

  // Employees list from global context
  const employees = (state.hr_employees_list || []).filter(e => (e.status || 'Active').toLowerCase() === 'active').length > 0 ? (state.hr_employees_list || []).filter(e => (e.status || 'Active').toLowerCase() === 'active') : [
    { id: 'EMP-2024-8841', name: 'Ahmed Khan', department: 'Operations', designation: 'Senior Associate' },
    { id: 'EMP-4012', name: 'Rehan Khan', department: 'Logistics', designation: 'Foam Mixing Lead' },
    { id: 'EMP-4088', name: 'Sarah Jenkins', department: 'Quality Assurance', designation: 'QA Specialist' },
    { id: 'EMP-4033', name: 'Marcus Chen', department: 'Frontend Dev', designation: 'Software Engineer' }
  ];

  // Form Inputs State
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || 'EMP-2024-8841');
  const [loanType, setLoanType] = useState('Personal Loan');
  const [loanAmount, setLoanAmount] = useState(50000);
  const [termMonths, setTermMonths] = useState(12);
  const [purpose, setPurpose] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);

  // User Selectable Repayment Start Date (default to 1st of next month YYYY-MM-01)
  const getNextMonthStartDateISO = () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const yyyy = nextMonth.getFullYear();
    const mm = String(nextMonth.getMonth() + 1).padStart(2, '0');
    const dd = String(nextMonth.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [repaymentStartDate, setRepaymentStartDate] = useState(getNextMonthStartDateISO());

  // Toast alert & status messages
  const [toastMessage, setToastMessage] = useState('');
  const [selectedRequestForDetail, setSelectedRequestForDetail] = useState(null);
  const [statusTabFilter, setStatusTabFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [divisionFilter, setDivisionFilter] = useState('ALL');

  // Selected Employee Details
  const selectedEmp = employees.find(e => String(e.id) === String(selectedEmpId)) || {
    id: selectedEmpId || 'EMP-2024-8841',
    name: 'Ahmed Khan',
    department: 'Operations',
    designation: 'Senior Associate'
  };

  // Live Calculations (0% Interest Rate as requested - Interest rate field completely removed)
  const amount = parseFloat(loanAmount) || 0;
  const term = parseInt(termMonths) || 1;
  const monthlyInstallment = term > 0 ? (amount / term) : 0;
  const totalRepayable = amount; // No interest added

  // Helper toast alert
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  // Loan requests list from global state
  const loanRequests = state.hr_loan_requests || [];

  // Approval Handlers
  const handleApproveRequest = (reqId) => {
    const updated = loanRequests.map(r => {
      if (r.id === reqId) {
        return { ...r, status: 'Approved', approvedAt: new Date().toISOString() };
      }
      return r;
    });
    setCollection('hr_loan_requests', updated);
    triggerToast(`Loan request ${reqId} approved & added to Loan Ledger!`);
    if (selectedRequestForDetail && selectedRequestForDetail.id === reqId) {
      setSelectedRequestForDetail(prev => ({ ...prev, status: 'Approved' }));
    }
  };

  const handleRejectRequest = (reqId) => {
    const updated = loanRequests.map(r => {
      if (r.id === reqId) {
        return { ...r, status: 'Rejected', rejectedAt: new Date().toISOString() };
      }
      return r;
    });
    setCollection('hr_loan_requests', updated);
    triggerToast(`Loan request ${reqId} rejected.`);
    if (selectedRequestForDetail && selectedRequestForDetail.id === reqId) {
      setSelectedRequestForDetail(prev => ({ ...prev, status: 'Rejected' }));
    }
  };

  // Submit Application Handler with Document Routing Integration
  const handleSubmitApplication = (e) => {
    if (e) e.preventDefault();
    if (!amount || amount <= 0) {
      alert('Please enter a valid loan request amount.');
      return;
    }

    const newReqId = `#LR-${Math.floor(1000 + Math.random() * 9000)}`;

    // Check if an approval rule / routing workflow is set for Loan Request
    let rules = state.routingRules || [];
    if (rules.length === 0) {
      try {
        const savedRules = localStorage.getItem('hr_routing_rules_config');
        if (savedRules) rules = JSON.parse(savedRules);
      } catch (e) {}
    }
    const isApprovalRequired = rules.some(r => r.status === 'Active' && r.steps?.some(s => s.type === 'document_trigger' && (s.config?.selectAll || s.config?.selectedDocTypes?.includes('Loan Request') || s.config?.selectedDocTypes?.includes('hr_loan_request'))));

    const initialStatus = isApprovalRequired ? 'Pending' : 'Approved';

    const newRecord = {
      id: newReqId,
      employeeId: selectedEmp.id,
      employeeName: selectedEmp.name,
      department: selectedEmp.department || 'Operations',
      dateApplied: new Date().toISOString().substring(0, 10),
      repaymentStartDate: repaymentStartDate,
      type: loanType,
      amount: amount,
      termMonths: term,
      monthlyInstallment: parseFloat(monthlyInstallment.toFixed(2)),
      purpose: purpose || 'Standard Loan Request',
      status: initialStatus,
      fileName: attachedFile ? attachedFile.name : null,
      createdAt: new Date().toISOString()
    };

    const updatedList = [newRecord, ...loanRequests];
    setCollection('hr_loan_requests', updatedList);
    
    if (isApprovalRequired) {
      // Add approval item to Chat Approvals Center
      const newApprovalItem = {
        id: `APP-LN-${Math.floor(1000 + Math.random() * 9000)}`,
        type: 'Loan Request',
        requestedTo: 'admin',
        requestedBy: state.currentUser?.username || 'admin',
        details: `${loanType} of ${currSym} ${amount.toLocaleString()} requested by ${selectedEmp.name} (${selectedEmp.id}) for ${term} months.`,
        value: `${currSym} ${amount.toLocaleString()}`,
        loanRequestId: newReqId,
        status: 'Pending',
        createdAt: new Date().toISOString(),
        timestamp: Date.now()
      };
      setCollection('approvals', [...(state.approvals || []), newApprovalItem]);

      if (startRoutingWorkflow) {
        startRoutingWorkflow({
          id: newReqId,
          type: 'Loan Request',
          title: `Loan Request - ${selectedEmp.name} (${currSym} ${amount.toLocaleString()})`,
          createdBy: state.currentUser?.username || 'admin',
          details: `${loanType} of ${currSym} ${amount.toLocaleString()} requested by ${selectedEmp.name} (${selectedEmp.id}) for ${term} months starting ${repaymentStartDate}.`
        });
      }
      triggerToast(`Loan application ${newReqId} submitted! Sent to Chat Approvals Center for authorization.`);
    } else {
      triggerToast(`Loan application ${newReqId} approved & added to Loan Ledger directly!`);
    }

    // Reset form
    setPurpose('');
    setAttachedFile(null);
  };

  
  // Distinct Departments & Divisions for Loan Request Filtering (Cascaded)
  const departmentsList = React.useMemo(() => {
    const set = new Set();
    employees.forEach(emp => {
      const div = emp.division || emp.section;
      if (divisionFilter === 'ALL' || !divisionFilter || div === divisionFilter) {
        if (emp.department) set.add(emp.department);
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [employees, divisionFilter]);

  const divisionsList = React.useMemo(() => {
    const set = new Set();
    employees.forEach(emp => {
      const div = emp.division || emp.section;
      if (div && (departmentFilter === 'ALL' || !departmentFilter || emp.department === departmentFilter)) {
        set.add(div);
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [employees, departmentFilter]);

  // Filtered loan requests
  const filteredRequests = loanRequests.filter(item => {
    const emp = employees.find(e => String(e.id) === String(item.employeeId) || e.name === item.employeeName);
    const itemDept = item.department || emp?.department || '';
    const itemDiv = item.division || item.section || emp?.division || emp?.section || '';

    const matchDept = departmentFilter === 'ALL' || !departmentFilter || itemDept === departmentFilter;
    const matchDiv = divisionFilter === 'ALL' || !divisionFilter || itemDiv === divisionFilter;
    if (!matchDept || !matchDiv) return false;

    if (statusTabFilter === 'All') return true;
    return item.status.toLowerCase() === statusTabFilter.toLowerCase();
  });

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 font-sans">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-green-500 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-6 duration-300 font-semibold font-manrope">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Actions & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-on-surface font-headline tracking-tight">New Loan Request</h2>
          <p className="text-xs text-on-surface-variant mt-1">Initiate a loan application with custom repayment start date & document routing.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button 
            type="button"
            onClick={() => navigate('/settings/print-settings?docType=hr_loan_request')}
            className="flex-1 sm:flex-none px-4 py-2 border border-outline-variant rounded-xl font-bold text-xs text-on-surface-variant hover:bg-surface-container-low transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Print Settings & Customize
          </button>
          <button 
            type="button"
            onClick={() => triggerToast('Draft saved successfully!')}
            className="flex-1 sm:flex-none px-5 py-2 border border-outline-variant rounded-xl font-bold text-xs text-primary hover:bg-surface-container-low transition-all cursor-pointer"
          >
            Save as Draft
          </button>
          <button 
            type="button"
            onClick={handleSubmitApplication}
            className="flex-1 sm:flex-none px-6 py-2 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-sm hover:bg-primary-container active:scale-[0.98] transition-all cursor-pointer"
          >
            Submit Application
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Form Configuration */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Employee Selection Card */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="p-2 bg-primary/10 text-primary rounded-xl material-symbols-outlined text-[20px]">person_search</span>
              <div>
                <h3 className="text-base font-bold text-on-surface font-headline">Select Applicant Employee</h3>
                <p className="text-xs text-on-surface-variant">Choose employee profile to auto-bind loan application.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Employee Name / ID</label>
                <select 
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full h-11 px-4 text-xs font-bold border border-outline-variant rounded-xl bg-surface focus:ring-2 focus:ring-primary focus:border-primary text-on-surface cursor-pointer"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.id}) - {emp.department}</option>
                  ))}
                </select>
              </div>

              <div className="bg-surface-container-low p-3.5 rounded-xl border border-outline-variant/20 flex flex-col justify-center">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Designation & Dept</span>
                <span className="text-xs font-bold text-on-surface truncate">{selectedEmp.designation} • {selectedEmp.department}</span>
              </div>
            </div>
          </div>

          {/* Loan Setup & Term Slider */}
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm space-y-6">
            
            <div className="flex items-center gap-3 border-b border-outline-variant/10 pb-4">
              <span className="p-2 bg-secondary/10 text-secondary rounded-xl material-symbols-outlined text-[20px]">account_balance_wallet</span>
              <div>
                <h3 className="text-base font-bold text-on-surface font-headline">Loan Configuration</h3>
                <p className="text-xs text-on-surface-variant">Set loan category, principal amount, and repayment duration.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Loan Type */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Loan Type</label>
                <select 
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                  className="w-full h-11 px-4 text-xs font-bold border border-outline-variant rounded-xl bg-surface focus:ring-2 focus:ring-primary focus:border-primary text-on-surface cursor-pointer"
                >
                  <option value="Personal Loan">Personal Loan</option>
                  <option value="Emergency Loan">Emergency Loan</option>
                  <option value="Salary Advance">Salary Advance</option>
                  <option value="Medical Assistance">Medical Assistance</option>
                  <option value="Vehicle Purchase">Vehicle Purchase</option>
                </select>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Request Amount ({currSym})</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-xs font-bold text-outline">{currSym}</span>
                  <input 
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 text-sm font-extrabold border border-outline-variant rounded-xl bg-surface focus:ring-2 focus:ring-primary focus:border-primary text-on-surface"
                    placeholder="50000"
                  />
                </div>
              </div>

            </div>

            {/* Repayment Term Range Slider */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Repayment Term: <span className="text-primary font-black text-sm ml-1">{termMonths} Months</span>
                </label>
                <span className="text-[11px] font-bold text-outline">1 - 36 Months</span>
              </div>
              
              <input 
                type="range"
                min="1"
                max="36"
                value={termMonths}
                onChange={(e) => setTermMonths(e.target.value)}
                className="w-full h-2 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-primary"
              />
              
              <div className="flex justify-between text-[10px] text-outline font-semibold">
                <span>1 Month</span>
                <span>12 Months</span>
                <span>24 Months</span>
                <span>36 Months</span>
              </div>
            </div>

            {/* Purpose / Justification */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Purpose / Justification
              </label>
              <textarea 
                rows="3"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Explain the detailed reason for this loan request..."
                className="w-full border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary bg-surface text-xs font-medium text-on-surface p-3 transition-all"
              />
            </div>

            {/* File Upload Box */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Supporting Documents <span className="text-outline font-normal lowercase">(Optional)</span>
              </label>
              <div className="border-2 border-dashed border-outline-variant/50 rounded-2xl p-6 flex flex-col items-center justify-center bg-surface-container-low hover:bg-surface-container-high/40 transition-colors cursor-pointer group text-center">
                <input 
                  type="file" 
                  onChange={(e) => setAttachedFile(e.target.files[0])}
                  className="hidden" 
                  id="loanFileInput"
                />
                <label htmlFor="loanFileInput" className="cursor-pointer flex flex-col items-center">
                  <span className="material-symbols-outlined text-3xl text-outline mb-2 group-hover:text-primary transition-colors">cloud_upload</span>
                  <p className="text-xs font-semibold text-on-surface-variant">
                    {attachedFile ? attachedFile.name : <>Drag and drop files here, or <span className="text-primary font-bold">browse</span></>}
                  </p>
                  <p className="text-[10px] text-outline mt-1">PDF, JPG, or PNG (Max 5MB)</p>
                </label>
              </div>
            </div>

          </div>

        </div>

        {/* Right Column: Live Calculation Summary Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 shadow-sm space-y-6 sticky top-6">
            
            <div className="border-b border-outline-variant/10 pb-4">
              <h3 className="text-base font-bold text-on-surface font-headline">Loan Calculation Summary</h3>
              <p className="text-xs text-on-surface-variant">Real-time breakdown of deductions & repayment timeline.</p>
            </div>

            <div className="space-y-4">
              
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-1">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Monthly Installment</p>
                <p className="text-2xl font-black text-primary font-headline">
                  {currSym} {monthlyInstallment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-on-surface-variant font-medium">Deducted automatically from payroll</p>
              </div>

              <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/20 space-y-1">
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Total Repayable Amount</p>
                <p className="text-lg font-extrabold text-on-surface font-headline">
                  {currSym} {totalRepayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-green-600 font-bold">0% Interest Rate Applied</p>
              </div>

              {/* User Selectable Repayment Start Date Input */}
              <div className="p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/30 space-y-1.5">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block">
                  Repayment Start Date
                </label>
                <input 
                  type="date"
                  value={repaymentStartDate}
                  onChange={(e) => setRepaymentStartDate(e.target.value)}
                  className="w-full h-10 px-3 text-xs font-bold text-on-surface bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer shadow-xs"
                />
              </div>

            </div>

            {/* Informational Note Box */}
            <div className="bg-secondary/10 p-3.5 rounded-xl border border-secondary/20 flex items-start gap-2 text-secondary">
              <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">info</span>
              <p className="text-[11px] font-semibold leading-relaxed">
                Repayments are automatically deducted from monthly payroll starting from the selected Repayment Start Date.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-outline-variant/20">
              <button 
                type="button"
                onClick={handleSubmitApplication}
                className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-xs shadow-md hover:bg-primary-container active:scale-[0.98] transition-all cursor-pointer"
              >
                Confirm & Submit Application
              </button>
              <button 
                type="button"
                onClick={() => {
                  setLoanAmount(50000);
                  setTermMonths(12);
                  setPurpose('');
                  triggerToast('Form cleared.');
                }}
                className="w-full py-3 border border-outline-variant text-on-surface-variant rounded-xl font-bold text-xs hover:bg-surface-container-high transition-all cursor-pointer"
              >
                Cancel / Reset Form
              </button>
            </div>

          </div>
        </div>

        {/* Bottom Section: Recent Loan Requests Table */}
        <div className="lg:col-span-12 pt-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm space-y-4">
            
            <div className="p-6 border-b border-outline-variant/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-on-surface font-headline">Recent Loan Requests</h3>
                <p className="text-xs text-on-surface-variant">Track status of submitted loan applications and approvals.</p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Division Filter Dropdown */}
                <div className="relative flex items-center bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 rounded-xl px-3 py-1.5 transition-all shadow-xs group">
                  <span className="material-symbols-outlined text-[16px] text-primary mr-1.5 group-hover:scale-110 transition-transform">apartment</span>
                  <select
                    value={divisionFilter}
                    onChange={(e) => {
                      setDivisionFilter(e.target.value);
                      setDepartmentFilter('ALL');
                    }}
                    className="bg-transparent text-on-surface outline-none cursor-pointer font-bold text-xs border-none focus:ring-0 pr-5 appearance-none"
                    title="Filter Loans by Division"
                  >
                    {divisionsList.map(div => (
                      <option key={div} value={div} className="bg-surface-container-lowest text-on-surface">
                        {div === 'ALL' ? '🏬 All Divisions' : div}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined text-[14px] text-outline absolute right-1.5 pointer-events-none">arrow_drop_down</span>
                </div>

                {/* Department Filter Dropdown (Cascaded) */}
                <div className="relative flex items-center bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 rounded-xl px-3 py-1.5 transition-all shadow-xs group">
                  <span className="material-symbols-outlined text-[16px] text-primary mr-1.5 group-hover:scale-110 transition-transform">domain</span>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="bg-transparent text-on-surface outline-none cursor-pointer font-bold text-xs border-none focus:ring-0 pr-5 appearance-none"
                    title="Filter Loans by Department"
                  >
                    {departmentsList.map(dept => (
                      <option key={dept} value={dept} className="bg-surface-container-lowest text-on-surface">
                        {dept === 'ALL' ? '🏢 All Departments' : dept}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined text-[14px] text-outline absolute right-1.5 pointer-events-none">arrow_drop_down</span>
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/10">
                {['All', 'Pending', 'Approved', 'Rejected', 'Repaid'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setStatusTabFilter(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      statusTabFilter === tab 
                        ? 'bg-surface-container-lowest text-primary shadow-xs' 
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant/10 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    <th className="p-4">Request ID</th>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Date Applied</th>
                    <th className="p-4">Repayment Start</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Term</th>
                    <th className="p-4">Monthly Installment</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center py-10 text-xs font-semibold text-on-surface-variant">
                        No loan applications matching active status filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map(req => (
                      <tr key={req.id} className="hover:bg-primary/5 transition-colors">
                        <td className="p-4 font-mono font-bold text-xs text-on-surface">{req.id}</td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-on-surface">{req.employeeName}</span>
                            <span className="text-[10px] text-outline font-mono">{req.employeeId} • {req.department}</span>
                          </div>
                        </td>
                        <td className="p-4 text-xs font-medium text-on-surface-variant">{req.dateApplied}</td>
                        <td className="p-4 text-xs font-bold text-on-surface">{req.repaymentStartDate || '2026-08-01'}</td>
                        <td className="p-4 text-xs font-semibold text-on-surface">{req.type}</td>
                        <td className="p-4 text-xs font-bold text-on-surface">{currSym} {req.amount.toLocaleString()}</td>
                        <td className="p-4 text-xs font-medium text-on-surface-variant">{req.termMonths} Months</td>
                        <td className="p-4 text-xs font-bold text-primary">{currSym} {req.monthlyInstallment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                            req.status === 'Approved' ? 'bg-green-500/10 text-green-700 border-green-200' :
                            req.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-700 border-yellow-200' :
                            req.status === 'Repaid' ? 'bg-blue-500/10 text-blue-700 border-blue-200' :
                            'bg-red-500/10 text-red-700 border-red-200'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => setSelectedRequestForDetail(req)}
                              className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>

      {/* Details Breakdown Modal */}
      {selectedRequestForDetail && (
        <div className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl border border-outline-variant shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-outline-variant/10 bg-primary/[0.02] flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-on-surface font-headline">Loan Application Summary</h3>
                <p className="text-[10px] text-on-surface-variant font-medium">{selectedRequestForDetail.id}</p>
              </div>
              <button 
                onClick={() => setSelectedRequestForDetail(null)}
                className="text-on-surface-variant hover:bg-surface-container-high p-1 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-medium">
              <div className="bg-surface-container-low p-4 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm text-on-surface">{selectedRequestForDetail.employeeName}</p>
                  <p className="text-[11px] text-on-surface-variant font-semibold">{selectedRequestForDetail.employeeId} • {selectedRequestForDetail.department}</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                  selectedRequestForDetail.status === 'Approved' ? 'bg-green-500/10 text-green-700 border-green-200' : 'bg-yellow-500/10 text-yellow-700 border-yellow-200'
                }`}>
                  {selectedRequestForDetail.status}
                </span>
              </div>

              <div className="space-y-2 border-b border-outline-variant/10 pb-3">
                <div className="flex justify-between">
                  <span className="text-outline">Loan Type:</span>
                  <span className="font-bold text-on-surface">{selectedRequestForDetail.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Principal Amount:</span>
                  <span className="font-bold text-on-surface">{currSym} {selectedRequestForDetail.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Repayment Duration:</span>
                  <span className="font-bold text-on-surface">{selectedRequestForDetail.termMonths} Months</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Repayment Start Date:</span>
                  <span className="font-bold text-on-surface">{selectedRequestForDetail.repaymentStartDate || '2026-08-01'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-outline">Monthly Payroll Deduction:</span>
                  <span className="font-bold text-primary">{currSym} {selectedRequestForDetail.monthlyInstallment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-outline block text-[10px] uppercase font-bold">Purpose / Remarks</span>
                <p className="bg-surface p-3 rounded-xl border border-outline-variant/20 text-on-surface leading-relaxed">
                  {selectedRequestForDetail.purpose}
                </p>
              </div>

              {selectedRequestForDetail.fileName && (
                <div className="flex items-center gap-2 p-3 bg-surface-container-low rounded-xl text-primary font-bold">
                  <span className="material-symbols-outlined text-[18px]">description</span>
                  <span className="truncate">{selectedRequestForDetail.fileName}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-container-low/50 border-t border-outline-variant/10 flex justify-between items-center">
              <button 
                onClick={() => navigate('/settings/print-settings?docType=hr_loan_request')}
                className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Print Loan Slip
              </button>
              <button 
                onClick={() => setSelectedRequestForDetail(null)}
                className="bg-primary text-on-primary px-5 py-2 rounded-xl text-xs font-bold hover:bg-primary-container transition-all cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
