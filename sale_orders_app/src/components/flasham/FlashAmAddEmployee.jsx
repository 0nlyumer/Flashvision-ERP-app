import React, { useEffect, useRef, useState } from 'react';
import { normalizePkMobile } from '../../utils/loginIdentifier';
import { loadHrDepartments } from '../../utils/hrDepartments';
import { assessGrayscaleFrame, detectDocumentBounds } from '../../utils/imageQuality';

// FlashAM gate Add New Employee (Omer, 2026-10-26).
//
// A new man arriving at the gate is added right at the terminal:
// name, LIVE photo (camera, at that moment), a CamScanner-style
// document scan (CNIC / B-Form — auto-cropped to the document edges,
// checked for blur/darkness with a retake prompt, or Skipped when he
// has no documents yet), a validated mobile number, division +
// department. The record starts a 7-day probation (see
// utils/probation.js) and lands in the hr_employees table — online it
// is written immediately, offline it rides the terminal's existing
// pending queue and syncs on reconnect. Persistence itself lives in
// FlashAM.jsx (this component only collects + validates).
//
// Fields mirror the HR employee record shape so HR Attendance, the
// Directory and Salary Generation read the man exactly like any other
// employee.

export const GATE_DIVISIONS = ['AJ Synthetic', 'AAA'];
export const GATE_DOC_TYPES = ['CNIC', 'B-Form', 'Other Document'];

export function nextGateEmployeeId(employees) {
  let max = 0;
  (employees || []).forEach((emp) => {
    const m = String(emp?.id || '').match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  });
  return `EMP-${String(max + 1).padStart(5, '0')}`;
}

export function buildGateEmployeeRecord(form, employees) {
  const id = nextGateEmployeeId(employees);
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const doc = form.docSkipped ? null : form.document;
  return {
    id,
    employeeCode: id,
    name: form.name.trim(),
    phone: normalizePkMobile(form.phone) || '',
    division: form.division,
    department: form.department,
    designation: '',
    avatar: form.photo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(form.name.trim())}`,
    photo: form.photo || null,
    documents: doc ? [{
      type: form.docType,
      name: `${form.docType} — ${form.name.trim()}`,
      dataUrl: doc.dataUrl,
      capturedAt: new Date().toISOString(),
      quality: { sharpness: Math.round(doc.sharpness), verdict: doc.keptAnyway ? 'kept-despite-warning' : 'readable' }
    }] : [],
    documentsSkipped: Boolean(form.docSkipped),
    legalDocName: doc ? form.docType : '',
    legalDocUrl: doc ? doc.dataUrl : null,
    dateOfJoining: dateKey,
    joiningDate: dateKey,
    probationStart: dateKey,
    probationDays: 7,
    probationOnboardingNotified: false,
    onboarding: null,
    attendance: {},
    status: 'Active',
    source: 'FlashAM_GateAdd',
    shift: 'GENERAL SHIFT',
    dutyHours: 8,
    dutyHoursAdjustable: true,
    basicSalary: 0,
    salary: 0,
    allowance: 0,
    advance: 0,
    loan: 0,
    fine: 0
  };
}

// Draw an image/video source into a canvas capped at maxW, return it.
function drawCapped(source, sw, sh, maxW) {
  const scale = Math.min(1, maxW / sw);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function grayscaleOf(canvas) {
  const ctx = canvas.getContext('2d');
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return { gray, width, height };
}

export default function FlashAmAddEmployee({ open, onClose, onSubmit, employees, isDark, isOnline }) {
  const departments = React.useMemo(() => loadHrDepartments().map((d) => d.name).filter(Boolean), []);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [division, setDivision] = useState(GATE_DIVISIONS[0]);
  const [department, setDepartment] = useState('');
  const [photo, setPhoto] = useState(null);
  const [docType, setDocType] = useState(GATE_DOC_TYPES[0]);
  const [documentScan, setDocumentScan] = useState(null); // { dataUrl, sharpness, ok, issues }
  const [docSkipped, setDocSkipped] = useState(false);
  const [cameraMode, setCameraMode] = useState(null); // 'photo' | 'doc' | null
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const photoFileRef = useRef(null);
  const docFileRef = useRef(null);

  useEffect(() => {
    if (open && !department && departments.length > 0) setDepartment(departments[0]);
  }, [open, departments, department]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraMode(null);
  };

  useEffect(() => () => stopCamera(), []);
  useEffect(() => { if (!open) stopCamera(); }, [open ]);

  const startCamera = async (mode) => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode === 'doc' ? 'environment' : 'user', width: { ideal: 1600 }, height: { ideal: 1200 } },
        audio: false
      });
      streamRef.current = stream;
      setCameraMode(mode);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch (e) {
      setError('Camera could not be opened. Check camera permission, or upload a picture instead.');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = drawCapped(video, video.videoWidth, video.videoHeight, 960);
    setPhoto(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
  };

  // Document capture: analyze a downscaled copy for sharpness +
  // document bounds, crop the full-resolution save to the document,
  // keep the quality verdict with the scan.
  const processDocumentImage = (source, sw, sh) => {
    const analysis = drawCapped(source, sw, sh, 480);
    const { gray, width, height } = grayscaleOf(analysis);
    const verdict = assessGrayscaleFrame(gray, width, height);
    const bounds = detectDocumentBounds(gray, width, height);
    let saveCanvas = drawCapped(source, sw, sh, 1600);
    if (bounds) {
      const sx = saveCanvas.width / width;
      const sy = saveCanvas.height / height;
      const crop = document.createElement('canvas');
      crop.width = Math.max(1, Math.round(bounds.w * sx));
      crop.height = Math.max(1, Math.round(bounds.h * sy));
      crop.getContext('2d').drawImage(
        saveCanvas,
        bounds.x * sx, bounds.y * sy, bounds.w * sx, bounds.h * sy,
        0, 0, crop.width, crop.height
      );
      saveCanvas = crop;
    }
    setDocumentScan({
      dataUrl: saveCanvas.toDataURL('image/jpeg', 0.88),
      sharpness: verdict.sharpness,
      ok: verdict.ok,
      issues: verdict.issues,
      autoCropped: Boolean(bounds)
    });
    setDocSkipped(false);
  };

  const captureDocument = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    processDocumentImage(video, video.videoWidth, video.videoHeight);
    stopCamera();
  };

  const onDocFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => { processDocumentImage(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  const onPhotoFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Employee name is required.'); return; }
    const canonical = normalizePkMobile(phone);
    if (!canonical) { setError('Enter a valid mobile number (e.g. 0300 1234567).'); return; }
    if (!division) { setError('Select a division.'); return; }
    if (!department) { setError('Select a department.'); return; }
    if (!docSkipped && documentScan && !documentScan.ok) {
      setError('The document scan looks unreadable — retake it, or choose "Use anyway" under the scan.');
      return;
    }
    setSubmitting(true);
    try {
      const record = buildGateEmployeeRecord(
        { name, phone, division, department, photo, document: documentScan, docType, docSkipped },
        employees
      );
      await onSubmit(record);
      // reset for the next man
      setName(''); setPhone(''); setPhoto(null); setDocumentScan(null); setDocSkipped(false); setError('');
      onClose();
    } catch (err) {
      setError('Could not save the employee. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const panel = isDark ? 'bg-[#121927] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900';
  const inputCls = `w-full px-3 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'}`;
  const labelCls = `text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <form onSubmit={handleSubmit} className={`w-full max-w-lg max-h-[94vh] overflow-y-auto p-5 rounded-3xl border shadow-2xl ${panel}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">person_add</span>
            </div>
            <div>
              <h3 className="text-base font-bold font-manrope leading-tight">Add New Employee</h3>
              <p className="text-[11px] text-slate-400">Gate entry — 7-day probation starts today{isOnline ? '' : ' • offline: will sync on reconnect'}</p>
            </div>
          </div>
          <button type="button" onClick={() => { stopCamera(); onClose(); }} className="w-8 h-8 rounded-full hover:bg-slate-700/40 flex items-center justify-center text-slate-400 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {error && (
          <div className="mt-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold p-3 rounded-xl">{error}</div>
        )}

        {/* Live photo */}
        <div className="mt-4">
          <span className={labelCls}>Photo (live capture)</span>
          <div className="flex items-center gap-3 mt-1.5">
            <div className={`w-16 h-16 rounded-2xl overflow-hidden border flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
              {photo ? <img src={photo} alt="Employee" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-slate-500 text-3xl">person</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => startCamera('photo')} className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                <span className="material-symbols-outlined text-[16px]">photo_camera</span> Take Photo
              </button>
              <button type="button" onClick={() => photoFileRef.current?.click()} className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                Upload
              </button>
              <input type="file" ref={photoFileRef} accept="image/*" className="hidden" onChange={onPhotoFile} />
              {photo && (
                <button type="button" onClick={() => setPhoto(null)} className="px-3 py-2 rounded-xl text-xs font-bold text-red-400 cursor-pointer">Remove</button>
              )}
            </div>
          </div>
        </div>

        {/* Camera view (photo or document) */}
        {cameraMode && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-slate-700 bg-black">
            <video ref={videoRef} autoPlay playsInline className="w-full max-h-64 object-cover" />
            <div className="flex items-center justify-between p-2 bg-slate-900">
              <span className="text-[11px] font-bold text-slate-300">{cameraMode === 'doc' ? `Hold the ${docType} steady inside the frame` : 'Face the camera'}</span>
              <div className="flex gap-2">
                <button type="button" onClick={stopCamera} className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 text-[11px] font-bold cursor-pointer">Cancel</button>
                <button type="button" onClick={cameraMode === 'doc' ? captureDocument : capturePhoto} className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-[11px] font-black cursor-pointer">
                  {cameraMode === 'doc' ? 'Scan Document' : 'Capture'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Name / phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div>
            <span className={labelCls}>Full Name *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Muhammad Ahmad" className={`${inputCls} mt-1`} />
          </div>
          <div>
            <span className={labelCls}>Mobile Number *</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300 1234567" inputMode="tel" className={`${inputCls} mt-1`} />
            {phone && (normalizePkMobile(phone)
              ? <p className="text-[10px] font-bold text-emerald-400 mt-1">Valid — will be saved as {normalizePkMobile(phone)}</p>
              : <p className="text-[10px] font-bold text-red-400 mt-1">Not a valid mobile number yet</p>)}
          </div>
          <div>
            <span className={labelCls}>Division *</span>
            <select value={division} onChange={(e) => setDivision(e.target.value)} className={`${inputCls} mt-1`}>
              {GATE_DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <span className={labelCls}>Department *</span>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={`${inputCls} mt-1`}>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Document scanner */}
        <div className={`mt-4 p-3 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className={labelCls}>Document (CNIC / B-Form)</span>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className={`text-[11px] font-bold rounded-lg px-2 py-1 border ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
              {GATE_DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {docSkipped ? (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs font-bold text-amber-400">Documentation skipped — can be added later from HR.</p>
              <button type="button" onClick={() => setDocSkipped(false)} className="text-[11px] font-bold text-cyan-400 hover:underline cursor-pointer">Scan instead</button>
            </div>
          ) : documentScan ? (
            <div className="mt-2">
              <img src={documentScan.dataUrl} alt="Document scan" className="w-full max-h-44 object-contain rounded-xl bg-black/30" />
              {documentScan.ok ? (
                <p className="text-[11px] font-bold text-emerald-400 mt-2">
                  Scan looks readable{documentScan.autoCropped ? ' • auto-cropped to the document' : ''}.
                </p>
              ) : (
                <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
                  <p className="text-[11px] font-bold text-amber-400">
                    This scan looks {documentScan.issues.join(' and ')} — the text may not be readable. Please retake it in better light, holding the camera steady.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => { setDocumentScan(null); startCamera('doc'); }} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-black cursor-pointer">Retake</button>
                    <button type="button" onClick={() => setDocumentScan((s) => ({ ...s, ok: true, keptAnyway: true }))} className="px-3 py-1.5 rounded-lg border border-amber-500/50 text-amber-400 text-[11px] font-bold cursor-pointer">Use anyway</button>
                  </div>
                </div>
              )}
              {documentScan.ok && (
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => { setDocumentScan(null); startCamera('doc'); }} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Rescan</button>
                  <button type="button" onClick={() => setDocumentScan(null)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-400 cursor-pointer">Remove</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" onClick={() => startCamera('doc')} className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                <span className="material-symbols-outlined text-[16px]">document_scanner</span> Scan {docType}
              </button>
              <button type="button" onClick={() => docFileRef.current?.click()} className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                Upload Image
              </button>
              <input type="file" ref={docFileRef} accept="image/*" className="hidden" onChange={onDocFile} />
              <button type="button" onClick={() => setDocSkipped(true)} className="px-3 py-2 rounded-xl text-xs font-bold text-amber-400 cursor-pointer">
                Skip — no documents yet
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button type="button" onClick={() => { stopCamera(); onClose(); }} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider cursor-pointer">
            {submitting ? 'Saving…' : isOnline ? 'Add Employee' : 'Add (will sync)'}
          </button>
        </div>
      </form>
    </div>
  );
}
