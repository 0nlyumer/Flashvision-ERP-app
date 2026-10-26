import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import HRRequestPrintPopup from './HRRequestPrintPopup';
import { buildLeaveRequestPrintRecord } from '../../utils/hrPrintRecords';
import { ownRequests } from '../../utils/requestOwnership';

export default function HRLeaveRequest({ isMobile }) {
  const { state, setCollection, startRoutingWorkflow } = useApp();

  // Form states
  const [leaveType, setLeaveType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveCategory, setLeaveCategory] = useState('paid'); // 'paid' | 'unpaid'
  const [estimatedDays, setEstimatedDays] = useState('--');
  const [reason, setReason] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [activeTabFilter, setActiveTabFilter] = useState('All'); // 'All' | 'Drafts' | 'Pending' | 'Approved' | 'Rejected'
  
  // UI states
  const [successToast, setSuccessToast] = useState('');
  const [formError, setFormError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Edit / Delete states (2026-10-26, Omer's order): submitted requests
  // can be edited and deleted from Leave History. Delete uses the in-app
  // confirmation modal below — never window.confirm (known live failure
  // pattern in this codebase).
  const [printingRequest, setPrintingRequest] = useState(null);
  const [editingRequest, setEditingRequest] = useState(null);
  const [editLeaveType, setEditLeaveType] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editCategory, setEditCategory] = useState('paid');
  const [editReason, setEditReason] = useState('');
  const [editError, setEditError] = useState('');
  const [deletingRequest, setDeletingRequest] = useState(null);

  const computeDays = (startStr, endStr) => {
    if (!startStr || !endStr) return '--';
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (end < start) return '--';
    return Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
  };
  const editDays = computeDays(editStartDate, editEndDate);

  // Dynamic days calculation
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end >= start) {
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setEstimatedDays(diffDays);
      } else {
        setEstimatedDays('--');
      }
    } else {
      setEstimatedDays('--');
    }
  }, [startDate, endDate]);

  // File Upload Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  const addFiles = (fileList) => {
    const newFiles = Array.from(fileList).map(file => ({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
    }));
    setAttachments(prev => [...prev, ...newFiles]);
  };

  const removeFile = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // Helper date formatter
  const formatDateRange = (startStr, endStr) => {
    if (!startStr) return '';
    
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}`;
    };

    if (startStr === endStr) {
      const date = new Date(startStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
    }

    const startFormatted = formatDate(startStr);
    const endFormatted = formatDate(endStr);
    const endYear = new Date(endStr).getFullYear();
    
    return `${startFormatted} - ${endFormatted}, ${endYear}`;
  };

  const formatAppliedDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
  };

  const formatLeaveType = (type) => {
    switch (type) {
      case 'annual': return 'Annual Leave';
      case 'sick': return 'Sick Leave';
      case 'casual': return 'Casual Leave';
      case 'maternity': return 'Maternity/Paternity Leave';
      case 'unpaid': return 'Unpaid Leave';
      default: return 'Leave';
    }
  };

  // Submit Handler
  const handleSave = (status) => {
    setFormError('');

    if (!leaveType) {
      setFormError('Please select a leave type.');
      return;
    }
    if (!startDate || !endDate) {
      setFormError('Please select start and end dates.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setFormError('End Date must be after or equal to Start Date.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      setFormError('Please provide a reason (minimum 5 characters).');
      return;
    }

    const newRequest = {
      id: `LVR-${Date.now()}`,
      employeeId: state.currentUser?.id || 'EMP-4091',
      employeeName: state.currentUser?.name || 'Marcus Thorne',
      leaveType: leaveType,
      startDate: startDate,
      endDate: endDate,
      category: leaveCategory,
      days: estimatedDays,
      reason: reason.trim(),
      status: status, // 'Pending' or 'Draft'
      attachments: attachments.map(a => a.name),
      createdAt: new Date().toISOString()
    };

    const currentRequests = state.hr_leave_requests || [];
    setCollection('hr_leave_requests', [newRequest, ...currentRequests]);

    if (status === 'Pending' && startRoutingWorkflow) {
      startRoutingWorkflow({
        id: newRequest.id,
        title: `Leave Request - ${newRequest.employeeName} (${formatLeaveType(newRequest.leaveType)})`,
        type: 'Leave Request',
        createdBy: state.currentUser?.username || 'admin',
        details: newRequest.reason
      });
    }

    // Reset Form
    setLeaveType('');
    setStartDate('');
    setEndDate('');
    setLeaveCategory('paid');
    setReason('');
    setAttachments([]);
    
    setSuccessToast(status === 'Draft' ? 'Leave request saved as draft!' : 'Leave request submitted successfully!');
    setTimeout(() => {
      setSuccessToast('');
    }, 4000);
  };

  const handleSubmitDraft = (draftReq) => {
    const updated = (state.hr_leave_requests || []).map(r => {
      if (r.id === draftReq.id) {
        return { ...r, status: 'Pending' };
      }
      return r;
    });
    setCollection('hr_leave_requests', updated);

    if (startRoutingWorkflow) {
      startRoutingWorkflow({
        id: draftReq.id,
        title: `Leave Request - ${draftReq.employeeName} (${formatLeaveType(draftReq.leaveType)})`,
        type: 'Leave Request',
        createdBy: state.currentUser?.username || 'admin',
        details: draftReq.reason
      });
    }

    setSuccessToast('Draft leave request submitted for approval!');
    setTimeout(() => setSuccessToast(''), 4000);
  };

  const openEditRequest = (req) => {
    setEditingRequest(req);
    setEditLeaveType(req.leaveType || '');
    setEditStartDate(req.startDate || '');
    setEditEndDate(req.endDate || '');
    setEditCategory(req.category || 'paid');
    setEditReason(req.reason || '');
    setEditError('');
  };

  // Edit uses the exact same fields + validation as the request form
  // (reason minimum 5 characters included). Only the editable fields
  // change — id, employee, status, attachments and createdAt are
  // preserved, and the record shape is untouched. The write-through
  // syncs the updated row to hr_leave_requests, and routing-filed views
  // resolve live-first, so they show the edited record. Attendance and
  // payroll never read this collection (they classify emp.attendance
  // day records), so editing a request cannot disturb payroll or
  // finalized months.
  const handleEditSave = () => {
    setEditError('');

    if (!editLeaveType) {
      setEditError('Please select a leave type.');
      return;
    }
    if (!editStartDate || !editEndDate) {
      setEditError('Please select start and end dates.');
      return;
    }
    if (new Date(editEndDate) < new Date(editStartDate)) {
      setEditError('End Date must be after or equal to Start Date.');
      return;
    }
    if (!editReason.trim() || editReason.trim().length < 5) {
      setEditError('Please provide a reason (minimum 5 characters).');
      return;
    }

    const updated = (state.hr_leave_requests || []).map(r => {
      if (r.id !== editingRequest.id) return r;
      return {
        ...r,
        leaveType: editLeaveType,
        startDate: editStartDate,
        endDate: editEndDate,
        category: editCategory,
        days: computeDays(editStartDate, editEndDate),
        reason: editReason.trim()
      };
    });
    setCollection('hr_leave_requests', updated);
    setEditingRequest(null);
    setSuccessToast('Leave request updated successfully!');
    setTimeout(() => setSuccessToast(''), 4000);
  };

  // Delete removes the request (the write-through deletes its table
  // row). Documents already filed into binders stay as filed copies —
  // the cabinet's freshness resolver then shows "Filed copy", which is
  // the designed behaviour.
  const handleDeleteRequest = () => {
    const updated = (state.hr_leave_requests || []).filter(r => r.id !== deletingRequest.id);
    setCollection('hr_leave_requests', updated);
    setDeletingRequest(null);
    setSuccessToast('Leave request deleted.');
    setTimeout(() => setSuccessToast(''), 4000);
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-green-500 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-6 duration-300 font-semibold font-manrope">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Header Section */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-on-surface font-headline mb-2">Leave Request</h1>
          <p className="text-sm text-on-surface-variant max-w-2xl">
            Submit and manage your leave applications. Ensure all mandatory fields are filled and evidence is uploaded for medical or special leave types.
          </p>
        </div>
        <div className="bg-primary/5 text-primary px-4 py-3.5 rounded-xl flex items-center gap-3 border border-primary/10">
          <span className="material-symbols-outlined text-primary text-[20px]">info</span>
          <span className="text-xs font-semibold">Standard approval time: 48 working hours.</span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="space-y-8">
        
        {/* Form Card */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-outline-variant/30 shadow-sm space-y-6">
          <div className="flex items-center gap-2 mb-2 text-primary border-b border-outline-variant/10 pb-4">
            <span className="material-symbols-outlined text-2xl">edit_note</span>
            <h3 className="text-lg font-bold text-on-surface font-headline">New Request Form</h3>
          </div>

          {formError && (
            <div className="p-4 bg-error-container text-error rounded-xl flex items-center gap-3 border border-error/20 text-sm font-semibold">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Leave Type */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Leave Type <span className="text-primary">*</span>
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface-container-lowest text-on-surface"
                required
              >
                <option value="" disabled>Select Type</option>
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="casual">Casual Leave</option>
                <option value="maternity">Maternity/Paternity Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>

            {/* Date Ranges */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Start Date
                </label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface-container-lowest"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  End Date
                </label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface-container-lowest"
                  required
                />
              </div>
            </div>

            {/* Leave Category */}
            <div className="flex flex-col gap-2 col-span-1">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Leave Category <span className="text-primary">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex-1 flex items-center gap-3 p-3 bg-surface-container-low border border-outline-variant/30 rounded-xl cursor-pointer hover:bg-surface-container-high transition-all">
                  <input 
                    type="radio" 
                    name="leave-category"
                    value="paid"
                    checked={leaveCategory === 'paid'}
                    onChange={() => setLeaveCategory('paid')}
                    className="w-4 h-4 text-primary focus:ring-primary/20 border-outline-variant"
                  />
                  <span className="text-xs font-semibold text-on-surface">Paid Leave</span>
                </label>
                <label className="flex-1 flex items-center gap-3 p-3 bg-surface-container-low border border-outline-variant/30 rounded-xl cursor-pointer hover:bg-surface-container-high transition-all">
                  <input 
                    type="radio" 
                    name="leave-category"
                    value="unpaid"
                    checked={leaveCategory === 'unpaid'}
                    onChange={() => setLeaveCategory('unpaid')}
                    className="w-4 h-4 text-primary focus:ring-primary/20 border-outline-variant"
                  />
                  <span className="text-xs font-semibold text-on-surface">Unpaid Leave</span>
                </label>
              </div>
            </div>

            {/* Days Calculation */}
            <div className="bg-primary/5 rounded-xl p-4 flex justify-between items-center border border-primary/10">
              <span className="text-sm font-semibold text-primary">Total Estimated Days:</span>
              <span className="text-3xl font-black text-primary font-headline">
                {estimatedDays}
              </span>
            </div>

            {/* Reason */}
            <div className="col-span-full flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Reason / Description
              </label>
              <textarea 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly describe the reason for your leave request..."
                rows="3"
                className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none bg-surface-container-lowest"
                required
              />
            </div>

            {/* File Upload */}
            <div className="col-span-full flex flex-col gap-2">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Attachments (Optional)
              </label>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect}
                multiple
                className="hidden"
              />
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors duration-200 ${
                  isDragging 
                    ? 'border-primary bg-primary/5' 
                    : 'border-outline-variant hover:border-primary hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined text-4xl text-outline mb-2">cloud_upload</span>
                <p className="font-semibold text-xs text-on-surface mb-1">
                  Drag and drop files here or <span className="text-primary font-semibold">Browse</span>
                </p>
                <p className="text-[10px] text-on-surface-variant italic">
                  PDF, JPG up to 10MB (Medical certificates, receipts, etc.)
                </p>
              </div>

              {/* Uploaded Gallery */}
              {attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center justify-between bg-surface-container-low rounded-xl p-3 border border-outline-variant/20">
                      <div className="flex items-center gap-3 truncate">
                        <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                        <div className="truncate">
                          <p className="text-xs font-bold truncate text-on-surface">{file.name}</p>
                          <p className="text-[10px] text-on-surface-variant">{file.size}</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-error hover:bg-error/10 p-1 rounded-lg transition-colors flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-4 pt-4 border-t border-outline-variant/10">
            <button 
              type="button" 
              onClick={() => handleSave('Pending')}
              className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold text-xs hover:bg-primary-container transition-all active:scale-95 shadow-sm"
            >
              Submit Request
            </button>
            <button 
              type="button"
              onClick={() => handleSave('Draft')}
              className="border border-outline-variant text-on-surface px-8 py-3 rounded-xl font-semibold text-xs hover:bg-surface-container-high transition-all active:scale-95"
            >
              Save as Draft
            </button>
          </div>
        </section>

        {/* Leave History Section */}
        <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-outline-variant/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3 text-on-surface">
              <span className="material-symbols-outlined text-primary text-[26px]">history</span>
              <h3 className="text-lg font-bold text-on-surface font-headline">Leave History</h3>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl overflow-x-auto">
              {['All', 'Drafts', 'Pending', 'Approved', 'Rejected'].map(filterTab => (
                <button
                  key={filterTab}
                  type="button"
                  onClick={() => setActiveTabFilter(filterTab)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                    activeTabFilter === filterTab
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {filterTab}
                </button>
              ))}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-center">Days</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Applied On</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {(() => {
                  // Privacy (Omer, 2026-10-26): Leave History shows ONLY
                  // the signed-in user's own requests — the scoped list
                  // feeds the rows and every Print/Edit/Delete action on
                  // them, so another employee's record can never be
                  // opened from this screen.
                  const requests = ownRequests(state.hr_leave_requests, state.currentUser, state.hr_employees_list).filter(req => {
                    if (activeTabFilter === 'Drafts') return req.status === 'Draft';
                    if (activeTabFilter === 'Pending') return req.status === 'Pending';
                    if (activeTabFilter === 'Approved') return req.status === 'Approved';
                    if (activeTabFilter === 'Rejected') return req.status === 'Rejected';
                    return true;
                  });

                  if (requests.length === 0) {
                    return (
                      <tr>
                        <td colSpan="6" className="text-center py-8 text-xs text-on-surface-variant font-semibold">
                          No leave history records found ({activeTabFilter}).
                        </td>
                      </tr>
                    );
                  }

                  return requests.map((req) => (
                    <tr key={req.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            req.leaveType === 'sick' 
                              ? 'bg-red-500' 
                              : req.leaveType === 'casual' 
                                ? 'bg-amber-500' 
                                : req.leaveType === 'unpaid' 
                                  ? 'bg-slate-500'
                                  : 'bg-blue-500'
                          }`}></div>
                          <span className="text-xs font-bold text-on-surface">
                            {formatLeaveType(req.leaveType)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-on-surface-variant font-medium">
                        {formatDateRange(req.startDate, req.endDate)}
                      </td>
                      <td className="px-6 py-4 text-xs text-center font-bold text-on-surface">
                        {req.days}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          req.status === 'Approved' 
                            ? 'bg-green-500/10 text-green-700 border-green-200' 
                            : req.status === 'Rejected' 
                              ? 'bg-red-500/10 text-red-700 border-red-200' 
                              : req.status === 'Draft'
                                ? 'bg-slate-500/10 text-slate-700 border-slate-200'
                                : 'bg-yellow-500/10 text-yellow-700 border-yellow-200'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-on-surface-variant font-medium">
                        {formatAppliedDate(req.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {req.status === 'Draft' && (
                            <button
                              type="button"
                              onClick={() => handleSubmitDraft(req)}
                              className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
                            >
                              Submit Now
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPrintingRequest(req)}
                            title="Print leave request form"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">print</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditRequest(req)}
                            title="Edit leave request"
                            className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingRequest(req)}
                            title="Delete leave request"
                            className="p-1.5 rounded-lg text-error hover:bg-error/10 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {/* Print — shared slip popup (Print Settings design for hr_leave_request) */}
      <HRRequestPrintPopup
        isOpen={!!printingRequest}
        onClose={() => setPrintingRequest(null)}
        docType="hr_leave_request"
        record={printingRequest ? buildLeaveRequestPrintRecord(printingRequest, state.hr_employees_list || []) : null}
        sourceRecord={printingRequest}
      />

      {/* Edit Leave Request Modal — same fields + validation as the form */}
      {editingRequest && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEditingRequest(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-4">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-2xl">edit_note</span>
                <h3 className="text-lg font-bold text-on-surface font-headline">Edit Leave Request</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRequest(null)}
                className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant font-medium">
              {editingRequest.employeeName} · {editingRequest.id} · Status: {editingRequest.status}
            </p>

            {editError && (
              <div className="p-4 bg-error-container text-error rounded-xl flex items-center gap-3 border border-error/20 text-sm font-semibold">
                <span className="material-symbols-outlined text-[20px]">error</span>
                <span>{editError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Leave Type */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Leave Type <span className="text-primary">*</span>
                </label>
                <select
                  value={editLeaveType}
                  onChange={(e) => setEditLeaveType(e.target.value)}
                  className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface-container-lowest text-on-surface"
                  required
                >
                  <option value="" disabled>Select Type</option>
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="maternity">Maternity/Paternity Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              {/* Date Ranges */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface-container-lowest"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface-container-lowest"
                    required
                  />
                </div>
              </div>

              {/* Leave Category */}
              <div className="flex flex-col gap-2 col-span-1">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Leave Category <span className="text-primary">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex-1 flex items-center gap-3 p-3 bg-surface-container-low border border-outline-variant/30 rounded-xl cursor-pointer hover:bg-surface-container-high transition-all">
                    <input
                      type="radio"
                      name="edit-leave-category"
                      value="paid"
                      checked={editCategory === 'paid'}
                      onChange={() => setEditCategory('paid')}
                      className="w-4 h-4 text-primary focus:ring-primary/20 border-outline-variant"
                    />
                    <span className="text-xs font-semibold text-on-surface">Paid Leave</span>
                  </label>
                  <label className="flex-1 flex items-center gap-3 p-3 bg-surface-container-low border border-outline-variant/30 rounded-xl cursor-pointer hover:bg-surface-container-high transition-all">
                    <input
                      type="radio"
                      name="edit-leave-category"
                      value="unpaid"
                      checked={editCategory === 'unpaid'}
                      onChange={() => setEditCategory('unpaid')}
                      className="w-4 h-4 text-primary focus:ring-primary/20 border-outline-variant"
                    />
                    <span className="text-xs font-semibold text-on-surface">Unpaid Leave</span>
                  </label>
                </div>
              </div>

              {/* Days Calculation */}
              <div className="bg-primary/5 rounded-xl p-4 flex justify-between items-center border border-primary/10">
                <span className="text-sm font-semibold text-primary">Total Estimated Days:</span>
                <span className="text-3xl font-black text-primary font-headline">
                  {editDays}
                </span>
              </div>

              {/* Reason */}
              <div className="col-span-full flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Reason / Description
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Briefly describe the reason for your leave request..."
                  rows="3"
                  className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none bg-surface-container-lowest"
                  required
                />
              </div>

              <p className="col-span-full text-[11px] text-on-surface-variant font-medium">
                Attachments on this request stay as they are: {(editingRequest.attachments || []).length ? editingRequest.attachments.join(', ') : 'none'}.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-4 pt-4 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={handleEditSave}
                className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold text-xs hover:bg-primary-container transition-all active:scale-95 shadow-sm"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditingRequest(null)}
                className="border border-outline-variant text-on-surface px-8 py-3 rounded-xl font-semibold text-xs hover:bg-surface-container-high transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal — in-app, never window.confirm */}
      {deletingRequest && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDeletingRequest(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-error/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-error text-[22px]">delete</span>
              </div>
              <h3 className="text-lg font-bold text-on-surface font-headline">Delete this leave request?</h3>
            </div>

            <div className="text-sm text-on-surface-variant space-y-1">
              <p className="font-semibold text-on-surface">
                {formatLeaveType(deletingRequest.leaveType)} — {formatDateRange(deletingRequest.startDate, deletingRequest.endDate)} ({deletingRequest.days} days)
              </p>
              <p>{deletingRequest.employeeName} · {deletingRequest.id}</p>
              {deletingRequest.reason && <p className="italic">“{deletingRequest.reason}”</p>}
            </div>

            <p className="text-xs text-on-surface-variant">
              This cannot be undone. Any copy already filed in the Document Warehouse stays there as a filed copy.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRequest(null)}
                className="border border-outline-variant text-on-surface px-5 py-2.5 rounded-xl font-semibold text-xs hover:bg-surface-container-high transition-all active:scale-95"
              >
                Keep Request
              </button>
              <button
                type="button"
                onClick={handleDeleteRequest}
                className="bg-error text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 transition-all active:scale-95 shadow-sm"
              >
                Delete Request
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
