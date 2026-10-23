import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import PrintSettings from '../settings/PrintSettings';
import PrintLayout from '../ui/PrintLayout';

export default function HROvertime({ isMobile }) {
  const { state, setCollection, startRoutingWorkflow } = useApp();
  
  // Form states
  const [overtimeDate, setOvertimeDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('19:00');
  const [calculatedHours, setCalculatedHours] = useState('2.00');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [activeTabFilter, setActiveTabFilter] = useState('All'); // 'All' | 'Drafts' | 'Pending' | 'Approved' | 'Rejected'
  
  // UI feedback states
  const [successToast, setSuccessToast] = useState('');
  const [formError, setFormError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // WhatsApp-style Camera Modal states
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' | 'environment'
  const [cameraFilter, setCameraFilter] = useState('none');
  const [cameraPhotos, setCameraPhotos] = useState([]);
  const [cameraVideos, setCameraVideos] = useState([]);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCamRecording, setIsCamRecording] = useState(false);
  const [camRecordTime, setCamRecordTime] = useState(0);
  const camRecordTimerRef = useRef(null);
  const camMediaRecorderRef = useRef(null);
  const camVideoChunksRef = useRef([]);

  // Print Customization Modal state
  const [showPrintSettingsModal, setShowPrintSettingsModal] = useState(false);
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false);
  const [selectedRequestForPrint, setSelectedRequestForPrint] = useState(null);

  // Recalculate duration automatically when times change
  useEffect(() => {
    if (!startTime || !endTime) {
      setCalculatedHours('0.00');
      return;
    }
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    let diffMins = (endH * 60 + endM) - (startH * 60 + startM);
    if (diffMins < 0) {
      // Overnight overtime (e.g. 22:00 to 06:00)
      diffMins += 24 * 60;
    }
    setCalculatedHours((diffMins / 60).toFixed(2));
  }, [startTime, endTime]);

  // Approved hours this month calculation
  const getApprovedHoursThisMonth = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-11
    
    const total = (state.hr_overtime_requests || []).reduce((acc, req) => {
      if (req.status !== 'Approved') return acc;
      const reqDate = new Date(req.date);
      if (reqDate.getFullYear() === currentYear && reqDate.getMonth() === currentMonth) {
        return acc + parseFloat(req.hours || 0);
      }
      return acc;
    }, 0);
    return total.toFixed(1);
  };

  // Mock File Drag & Drop Handlers
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
      addMockFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addMockFiles(e.target.files);
    }
  };

  const addMockFiles = (fileList) => {
    const newFiles = Array.from(fileList).map(file => ({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
      type: file.type
    }));
    setAttachments(prev => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (indexToRemove) => {
    setAttachments(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  // Camera Integration Handlers (WhatsApp-Style Camera Modal)
  const openCameraModal = () => {
    setShowCameraModal(true);
    setCameraPhotos([]);
    setCameraVideos([]);
    setIsCamRecording(false);
    setCamRecordTime(0);
    startCameraStream('environment');
  };

  const closeCameraModal = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (camRecordTimerRef.current) clearInterval(camRecordTimerRef.current);
    setShowCameraModal(false);
    setIsCamRecording(false);
  };

  const startCameraStream = async (faceMode = 'environment') => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: faceMode } },
        audio: true
      });
      setCameraStream(stream);
      setTimeout(() => {
        const videoElem = document.getElementById('hr-camera-video');
        if (videoElem) {
          videoElem.srcObject = stream;
        }
      }, 300);
    } catch (err) {
      console.warn("Hardware camera unavailable, running sandbox simulator camera: ", err);
    }
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCameraStream(nextMode);
  };

  const cameraFilters = ['none', 'grayscale(100%)', 'sepia(70%)', 'invert(100%)', 'hue-rotate(90deg)'];
  const toggleCameraFilter = () => {
    setCameraFilter(current => {
      const idx = cameraFilters.indexOf(current);
      return cameraFilters[(idx + 1) % cameraFilters.length];
    });
  };

  const snapPhoto = () => {
    const videoElem = document.getElementById('hr-camera-video');
    if (cameraStream && videoElem) {
      const canvas = document.createElement('canvas');
      canvas.width = videoElem.videoWidth || 640;
      canvas.height = videoElem.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (cameraFilter && cameraFilter !== 'none') {
        ctx.filter = cameraFilter;
      }
      ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setCameraPhotos(prev => [...prev, dataUrl]);
    } else {
      const mockPhotos = [
        'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=300&q=80',
        'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=300&q=80',
        'https://images.unsplash.com/photo-1549194388-f61be84a6e9e?auto=format&fit=crop&w=300&q=80'
      ];
      const randomPhoto = mockPhotos[Math.floor(Math.random() * mockPhotos.length)];
      setCameraPhotos(prev => [...prev, randomPhoto]);
    }
  };

  const startCamVideoRecording = () => {
    if (cameraStream) {
      camVideoChunksRef.current = [];
      try {
        const recorder = new MediaRecorder(cameraStream);
        camMediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) camVideoChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(camVideoChunksRef.current, { type: 'video/mp4' });
          const videoUrl = URL.createObjectURL(blob);
          setCameraVideos(prev => [...prev, videoUrl]);
        };
        recorder.start();
      } catch (e) {
        console.warn(e);
      }
    }
    setIsCamRecording(true);
    setCamRecordTime(0);
    if (camRecordTimerRef.current) clearInterval(camRecordTimerRef.current);
    camRecordTimerRef.current = setInterval(() => {
      setCamRecordTime(t => t + 1);
    }, 1000);
  };

  const stopCamVideoRecording = () => {
    if (camRecordTimerRef.current) clearInterval(camRecordTimerRef.current);
    if (camMediaRecorderRef.current && camMediaRecorderRef.current.state !== 'inactive') {
      try {
        camMediaRecorderRef.current.stop();
      } catch (e) {
        console.warn(e);
      }
    } else {
      const dummyVideo = 'https://www.w3schools.com/html/mov_bbb.mp4';
      setCameraVideos(prev => [...prev, dummyVideo]);
    }
    setIsCamRecording(false);
  };

  const applyCapturedEvidence = () => {
    const newAttachments = [];
    cameraPhotos.forEach((photo, idx) => {
      newAttachments.push({
        name: `Camera_Capture_${Date.now()}_${idx + 1}.jpg`,
        size: '1.2 MB',
        type: 'image/jpeg',
        url: photo
      });
    });
    cameraVideos.forEach((video, idx) => {
      newAttachments.push({
        name: `Camera_Video_${Date.now()}_${idx + 1}.mp4`,
        size: '4.5 MB',
        type: 'video/mp4',
        url: video
      });
    });
    if (newAttachments.length === 0) {
      newAttachments.push({
        name: `Evidence_Capture_${Date.now()}.jpg`,
        size: '1.4 MB',
        type: 'image/jpeg',
        url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=300&q=80'
      });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    closeCameraModal();
    setSuccessToast('Camera evidence attached successfully!');
    setTimeout(() => setSuccessToast(''), 3000);
  };

  // Submit & Save Draft Handler
  const handleSubmit = (e, targetStatus = 'Pending') => {
    if (e) e.preventDefault();
    setFormError('');

    if (!overtimeDate) {
      setFormError('Please select the date of overtime.');
      return;
    }
    if (!startTime || !endTime) {
      setFormError('Please provide start and end times.');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setFormError('Please describe the reason (minimum 10 characters).');
      return;
    }

    const currentUserName = state.currentUser?.name || state.currentUser?.username || 'Employee';
    const currentUserId = state.currentUser?.id || 'EMP-4091';

    // Duplicate Check: Same employee + Same date
    const currentRequests = state.hr_overtime_requests || [];
    const attendanceLogs = state.hr_uploaded_attendance || [];

    const existingOtReq = currentRequests.find(r => 
      (String(r.employeeId) === String(currentUserId) || r.employeeName === currentUserName) &&
      r.date === overtimeDate &&
      r.status !== 'Rejected'
    );

    const existingAttendanceOt = attendanceLogs.find(a => 
      (String(a.employeeId) === String(currentUserId) || a.employeeName === currentUserName || String(a.id) === String(currentUserId)) &&
      a.date === overtimeDate &&
      parseFloat(a.ot || a.overtimeHours || 0) > 0
    );

    if (existingOtReq || existingAttendanceOt) {
      setFormError(`An overtime entry/request already exists for date ${overtimeDate}. Cannot submit multiple overtime requests for the same date.`);
      return;
    }

    const newRequest = {
      id: `OTR-${Date.now()}`,
      employeeId: currentUserId,
      employeeName: currentUserName,
      date: overtimeDate,
      startTime: startTime,
      endTime: endTime,
      hours: calculatedHours,
      reason: description.trim(),
      status: targetStatus, // 'Draft' or 'Pending'
      attachments: attachments.map(a => a.name),
      createdAt: new Date().toISOString()
    };

    setCollection('hr_overtime_requests', [newRequest, ...currentRequests]);

    if (targetStatus === 'Pending' && startRoutingWorkflow) {
      startRoutingWorkflow({
        id: newRequest.id,
        title: `Overtime Request - ${newRequest.employeeName} (${newRequest.hours} hrs)`,
        type: 'Overtime Request',
        createdBy: state.currentUser?.username || 'admin',
        details: newRequest.reason
      });
    }

    // Success state resets
    setDescription('');
    setAttachments([]);
    setSuccessToast(targetStatus === 'Draft' ? 'Overtime request saved as draft!' : 'Overtime request submitted for approval!');
    
    setTimeout(() => {
      setSuccessToast('');
    }, 4000);
  };

  const handleSubmitDraft = (draftReq) => {
    const updated = (state.hr_overtime_requests || []).map(r => {
      if (r.id === draftReq.id) {
        return { ...r, status: 'Pending' };
      }
      return r;
    });
    setCollection('hr_overtime_requests', updated);

    if (startRoutingWorkflow) {
      startRoutingWorkflow({
        id: draftReq.id,
        title: `Overtime Request - ${draftReq.employeeName} (${draftReq.hours} hrs)`,
        type: 'Overtime Request',
        createdBy: state.currentUser?.username || 'admin',
        details: draftReq.reason
      });
    }

    setSuccessToast('Draft overtime request submitted for approval!');
    setTimeout(() => setSuccessToast(''), 4000);
  };

  const handleOpenPrintPreview = (req = null) => {
    const defaultReq = req || {
      id: `OTR-${Date.now()}`,
      employeeName: state.currentUser?.name || state.currentUser?.username || 'Umer Ali',
      employeeId: state.currentUser?.id || 'EMP-4091',
      date: overtimeDate,
      hours: calculatedHours,
      reason: description || 'Urgent operational necessity overtime',
      status: 'Pending'
    };
    setSelectedRequestForPrint(defaultReq);
    setShowPrintPreviewModal(true);
  };

  return (
    <div className="w-full max-w-full p-3 sm:p-6 animate-in fade-in slide-in-from-bottom-2 duration-300 font-sans">
      
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 bg-green-500 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-6 duration-300 font-semibold font-manrope">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{successToast}</span>
        </div>
      )}

      {/* Clean Header & Action Controls */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-on-surface font-headline leading-tight">Submit Overtime Request</h2>
          <p className="text-sm text-on-surface-variant font-body mt-1">
            Provide precise details and required evidence for your additional operational hours for payroll processing.
          </p>
        </div>

        {/* Print Action Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            type="button"
            onClick={() => handleOpenPrintPreview()}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 text-on-surface rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            Print Overtime Form
          </button>
        </div>
      </div>

      {/* Auto Adjustable Form and Sidebar Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start">
        
        {/* Form Section (Main Responsive Card) */}
        <form onSubmit={handleSubmit} className="xl:col-span-8 space-y-6 w-full">
          
          {formError && (
            <div className="p-4 bg-error-container text-error rounded-xl flex items-center gap-3 border border-error/20 text-sm font-semibold">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <span>{formError}</span>
            </div>
          )}

          <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-6 shadow-sm border border-outline-variant/30 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full">
              
              {/* Date of Overtime */}
              <div className="flex flex-col gap-2 w-full">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Date of Overtime <span className="text-primary">*</span>
                </label>
                <input 
                  type="date"
                  value={overtimeDate}
                  onChange={(e) => setOvertimeDate(e.target.value)}
                  className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface-container-lowest"
                  required
                />
              </div>

              {/* Start Time */}
              <div className="flex flex-col gap-2 w-full">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Start Time <span className="text-primary">*</span>
                </label>
                <input 
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface-container-lowest"
                  required
                />
              </div>

              {/* End Time */}
              <div className="flex flex-col gap-2 w-full">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  End Time <span className="text-primary">*</span>
                </label>
                <input 
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-surface-container-lowest"
                  required
                />
              </div>

              {/* Total Hours Display Banner */}
              <div className="col-span-full bg-surface-container-low rounded-xl p-4 flex items-center justify-between border border-outline-variant/20">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[22px]">schedule</span>
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Calculated Overtime Duration
                  </span>
                </div>
                <div className="text-2xl font-black text-primary animate-in fade-in duration-200">
                  {calculatedHours} hrs
                </div>
              </div>

              {/* Reason / Description */}
              <div className="col-span-full flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Reason / Description <span className="text-primary">*</span>
                </label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the task or operational necessity requiring overtime..."
                  rows="4"
                  className="w-full border border-outline-variant rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none bg-surface-container-lowest"
                  required
                />
              </div>

            </div>
          </div>

          {/* Evidence & Proof Section */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-6 shadow-sm border border-outline-variant/30 w-full">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-lg font-bold text-on-surface">Evidence & Proof</h3>
              
              {/* WhatsApp Style Camera Trigger */}
              <button 
                type="button"
                onClick={openCameraModal}
                className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                Capture with Camera
              </button>
            </div>
            
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
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                isDragging 
                  ? 'border-primary bg-primary-container/10 scale-[0.99]' 
                  : 'border-outline-variant hover:border-primary hover:bg-primary-container/5'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-primary text-2xl">cloud_upload</span>
              </div>
              <p className="font-semibold text-sm text-on-surface mb-1">Drag and drop files here or click to browse</p>
              <p className="text-xs text-on-surface-variant">Supported formats: JPG, PNG, MP4 (Max 50MB per file)</p>
            </div>

            {/* Attachment Gallery */}
            {attachments.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-surface-container-low rounded-xl p-3 border border-outline-variant/20">
                    <div className="flex items-center gap-3 truncate">
                      {file.url ? (
                        <img src={file.url} alt="Attachment" className="w-10 h-10 rounded-lg object-cover border border-outline-variant/30" />
                      ) : (
                        <span className="material-symbols-outlined text-primary text-[20px]">
                          {file.type?.includes('video') ? 'videocam' : 'image'}
                        </span>
                      )}
                      <div className="truncate">
                        <p className="text-xs font-bold truncate text-on-surface">{file.name}</p>
                        <p className="text-[10px] text-on-surface-variant">{file.size}</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="text-error hover:bg-error/10 p-1.5 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button 
              type="button"
              onClick={() => {
                setDescription('');
                setAttachments([]);
              }}
              className="px-5 py-2.5 rounded-xl font-semibold text-xs text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              Reset
            </button>
            <button 
              type="button"
              onClick={(e) => handleSubmit(e, 'Draft')}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-surface-container-high border border-outline-variant/30 text-on-surface hover:bg-surface-container-highest transition-all active:scale-[0.98] cursor-pointer"
            >
              Save as Draft
            </button>
            <button 
              type="button"
              onClick={(e) => handleSubmit(e, 'Pending')}
              className="px-6 py-2.5 rounded-xl font-bold text-xs bg-primary text-on-primary hover:bg-primary-container hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              Submit Overtime Request
            </button>
          </div>

        </form>

        {/* Sidebar Responsive Sections */}
        <div className="xl:col-span-4 space-y-6 w-full">
          
          {/* User Statistics Card */}
          <div className="bg-primary text-on-primary rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-[10px] font-bold tracking-wider uppercase opacity-80 mb-1">
                This Month's Overtime
              </p>
              <h4 className="text-3xl font-black font-headline tracking-tight">
                {getApprovedHoursThisMonth()} <span className="text-sm font-normal opacity-70">hrs</span>
              </h4>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="material-symbols-outlined text-[16px]">trending_up</span>
                <span className="font-semibold">Calculated from approved requests</span>
              </div>
            </div>
            <div className="absolute -right-6 -bottom-6 opacity-10">
              <span className="material-symbols-outlined text-[100px] fill-icon">timer</span>
            </div>
          </div>

          {/* Recent Requests */}
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/30 w-full">
            <div className="flex flex-col gap-3 mb-4">
              <h3 className="text-xs font-black text-on-surface uppercase tracking-wider">
                Recent Requests
              </h3>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl overflow-x-auto">
                {['All', 'Drafts', 'Pending', 'Approved', 'Rejected'].map(filterTab => (
                  <button
                    key={filterTab}
                    type="button"
                    onClick={() => setActiveTabFilter(filterTab)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors shrink-0 cursor-pointer ${
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
            
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {(() => {
                const requests = (state.hr_overtime_requests || []).filter(req => {
                  if (activeTabFilter === 'Drafts') return req.status === 'Draft';
                  if (activeTabFilter === 'Pending') return req.status === 'Pending';
                  if (activeTabFilter === 'Approved') return req.status === 'Approved';
                  if (activeTabFilter === 'Rejected') return req.status === 'Rejected';
                  return true;
                });

                if (requests.length === 0) {
                  return (
                    <div className="text-center py-6 text-xs text-on-surface-variant font-semibold">
                      No overtime requests found ({activeTabFilter}).
                    </div>
                  );
                }

                return requests.map((req) => (
                  <div 
                    key={req.id} 
                    className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20 hover:border-primary/20 transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-xs font-bold text-on-surface block">
                          {req.date}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-medium">
                          Req By: {req.employeeName}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        req.status === 'Approved' 
                          ? 'bg-green-100 text-green-800' 
                          : req.status === 'Rejected' 
                            ? 'bg-red-100 text-red-800' 
                            : req.status === 'Draft'
                              ? 'bg-slate-200 text-slate-800'
                              : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-2 mb-2 font-medium">
                      {req.reason}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-outline font-semibold gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span>{req.hours} hours</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenPrintPreview(req)}
                          className="px-2 py-0.5 bg-surface-container-high text-on-surface text-[9px] font-bold rounded-lg hover:bg-surface-container-highest transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[12px]">print</span>
                          Print
                        </button>
                        {req.status === 'Draft' && (
                          <button
                            type="button"
                            onClick={() => handleSubmitDraft(req)}
                            className="px-2 py-0.5 bg-primary text-white text-[9px] font-bold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
                          >
                            Submit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Policy Reminder */}
          <div className="bg-tertiary-container/10 border border-tertiary-container/20 rounded-2xl p-4 flex gap-3">
            <span className="material-symbols-outlined text-tertiary text-[20px] shrink-0">info</span>
            <div>
              <p className="text-xs font-bold text-tertiary mb-1">Policy Reminder</p>
              <p className="text-xs text-on-tertiary-container leading-relaxed">
                All overtime must be submitted within 48 hours of the shift completion. Evidence is mandatory for claims exceeding 2 hours.
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* WHATSAPP STYLE CAMERA MODAL POPUP */}
      {showCameraModal && (
        <div className="fixed inset-0 z-[99999] bg-black/95 flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200">
          
          {/* Top Bar Controls */}
          <div className="flex items-center justify-between text-white z-20">
            <button 
              onClick={closeCameraModal} 
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>

            <div className="flex items-center gap-3">
              <button 
                onClick={toggleCameraFilter}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer text-xs font-bold flex items-center gap-1"
                title="Toggle Filter"
              >
                <span className="material-symbols-outlined text-xl">auto_fix_high</span>
                <span className="hidden sm:inline capitalize">{cameraFilter}</span>
              </button>
              <button 
                onClick={switchCamera}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
                title="Flip Camera"
              >
                <span className="material-symbols-outlined text-xl">flip_camera_ios</span>
              </button>
            </div>
          </div>

          {/* Center Live Video / Camera Feed Viewport */}
          <div className="relative flex-grow my-4 rounded-3xl overflow-hidden bg-slate-900 border border-white/10 flex items-center justify-center max-w-4xl mx-auto w-full">
            <video 
              id="hr-camera-video"
              autoPlay 
              playsInline 
              muted 
              style={{ filter: cameraFilter }}
              className="w-full h-full object-cover rounded-3xl"
            />

            {!cameraStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-900/90 gap-3">
                <span className="material-symbols-outlined text-5xl text-primary animate-pulse">photo_camera</span>
                <p className="font-semibold text-sm">Simulated Camera Active</p>
                <p className="text-xs text-white/70">Click the shutter below to take evidence photo/video capture.</p>
              </div>
            )}

            {isCamRecording && (
              <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-2 animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                <span>REC {camRecordTime}s</span>
              </div>
            )}
          </div>

          {/* Captured Gallery Preview Strip */}
          {(cameraPhotos.length > 0 || cameraVideos.length > 0) && (
            <div className="max-w-4xl mx-auto w-full mb-3 flex items-center gap-3 overflow-x-auto py-2">
              {cameraPhotos.map((photo, i) => (
                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-primary shrink-0">
                  <img src={photo} alt="Cap" className="w-full h-full object-cover" />
                </div>
              ))}
              {cameraVideos.map((vid, i) => (
                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-red-500 bg-black shrink-0 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-xl">play_circle</span>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Action Control Bar */}
          <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-4 z-20">
            <button 
              onClick={() => {
                if (isCamRecording) stopCamVideoRecording();
                else startCamVideoRecording();
              }}
              className={`p-3 rounded-full transition-all cursor-pointer font-bold text-xs flex items-center gap-1.5 ${
                isCamRecording ? 'bg-red-600 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-xl">videocam</span>
              <span>{isCamRecording ? 'Stop Rec' : 'Rec Video'}</span>
            </button>

            {/* Main Shutter Button */}
            <button 
              onClick={snapPhoto}
              className="w-18 h-18 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 active:scale-90 transition-all cursor-pointer flex items-center justify-center shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-white"></div>
            </button>

            <button 
              onClick={applyCapturedEvidence}
              className="px-5 py-3 rounded-2xl bg-primary text-white font-bold text-xs hover:bg-primary-container transition-all cursor-pointer shadow-lg active:scale-95 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">check</span>
              <span>Use ({cameraPhotos.length + cameraVideos.length || 1})</span>
            </button>
          </div>

        </div>
      )}

      {/* PRINT SETTINGS CUSTOMIZATION MODAL */}
      {showPrintSettingsModal && (
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-3xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-outline-variant/30">
            <div className="p-4 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-2xl">print</span>
                <div>
                  <h3 className="font-bold text-base text-on-surface">Overtime Request Print Settings</h3>
                  <p className="text-xs text-on-surface-variant">Customize page margins, header colors, user name visibility & signatures.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrintSettingsModal(false)}
                className="p-2 rounded-xl hover:bg-surface-container-high text-on-surface-variant transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="flex-grow overflow-y-auto">
              <PrintSettings />
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {showPrintPreviewModal && (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-primary dark:text-primary-container">print</span>
                <span className="font-bold text-sm">Overtime Request Official Print Document</span>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  Print Document
                </button>
                <button 
                  onClick={() => setShowPrintPreviewModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-900/10 dark:hover:bg-white/10 text-slate-500 dark:text-white/80 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-6 sm:p-10 bg-slate-100">
              {selectedRequestForPrint && (
                <PrintLayout 
                  documentTitle="OVERTIME REQUEST FORM"
                  documentId={selectedRequestForPrint.id}
                  date={selectedRequestForPrint.date}
                  documentType="hr_overtime_request"
                  customerName={selectedRequestForPrint.employeeName}
                  extraMeta={[
                    { label: 'Requesting User Name', value: selectedRequestForPrint.employeeName },
                    { label: 'Employee ID', value: selectedRequestForPrint.employeeId || 'EMP-4091' },
                    { label: 'Duration Hours', value: `${selectedRequestForPrint.hours} hrs` },
                    { label: 'Approval Status', value: selectedRequestForPrint.status }
                  ]}
                >
                  <div className="my-6 border border-slate-300 rounded-lg p-4 bg-white">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-2">Overtime Purpose & Reason</h4>
                    <p className="text-sm text-slate-900 leading-relaxed font-medium">
                      {selectedRequestForPrint.reason}
                    </p>
                  </div>

                  <table className="w-full border-collapse border border-slate-300 text-xs my-4">
                    <thead>
                      <tr className="bg-slate-800 text-white font-bold">
                        <th className="border border-slate-300 p-2 text-center">Sr #</th>
                        <th className="border border-slate-300 p-2 text-left">Employee Name</th>
                        <th className="border border-slate-300 p-2 text-center">Date</th>
                        <th className="border border-slate-300 p-2 text-right">OT Duration</th>
                        <th className="border border-slate-300 p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 p-2.5 text-center">1</td>
                        <td className="border border-slate-300 p-2.5 font-bold">{selectedRequestForPrint.employeeName}</td>
                        <td className="border border-slate-300 p-2.5 text-center">{selectedRequestForPrint.date}</td>
                        <td className="border border-slate-300 p-2.5 text-right font-bold">{selectedRequestForPrint.hours} hrs</td>
                        <td className="border border-slate-300 p-2.5 text-center font-bold text-green-700">{selectedRequestForPrint.status}</td>
                      </tr>
                    </tbody>
                  </table>
                </PrintLayout>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
