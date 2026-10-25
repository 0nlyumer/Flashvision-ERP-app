import React, { useEffect, useState } from 'react';

// BinderFormModal — the shared "Add File / Edit File" form for Document
// Warehouse binders (Files Cabinet, 2026-10-25). Used by the Warehouse's
// Add File / Edit File flows AND by the Routing Center's archive-step
// "Create File" prompt, so a binder created from either place is identical.
//
// The form is presentation-only: the parent owns creation. `onSubmit`
// receives { name, colorClass } and returns null on success (the modal
// closes) or an error string to display (the modal stays open). For the
// edit flow the parent decides what the colour means — in the Warehouse the
// edit colour writes only the current user's per-user override; the name
// still renames the shared record.
//
// Deletion is confirmed IN-APP: the Delete action first swaps this modal
// to a confirmation panel, and only the panel's "Delete File" button calls
// `onDelete` (the parent then performs the delete and closes the modal).
// The previous flow gated deletion behind the native `window.confirm(...)`
// in the parent — in the live environment that dialog never resolves true,
// which left the Delete button completely dead (live check, 2026-10-25).

export const BINDER_COLOR_OPTIONS = [
  { value: 'binder-blue-spine', label: 'Royal Indigo Blue', preview: 'linear-gradient(90deg, #1e3a8a, #2563eb)' },
  { value: 'binder-red-spine', label: 'Crimson Corporate Red', preview: 'linear-gradient(90deg, #7f1d1d, #dc2626)' },
  { value: 'binder-green-spine', label: 'Emerald Forest Green', preview: 'linear-gradient(90deg, #064e3b, #059669)' },
  { value: 'binder-amber-spine', label: 'Golden Mustard Amber', preview: 'linear-gradient(90deg, #78350f, #d97706)' },
  { value: 'binder-purple-spine', label: 'Imperial Violet Purple', preview: 'linear-gradient(90deg, #4c1d95, #7c3aed)' },
  { value: 'binder-teal-spine', label: 'Ocean Teal Slate', preview: 'linear-gradient(90deg, #134e4a, #0d9488)' },
];

export default function BinderFormModal({
  isOpen,
  mode = 'create', // 'create' | 'edit'
  initialName = '',
  initialColor = 'binder-blue-spine',
  onClose,
  onSubmit,
  onDelete = null, // edit mode only: renders the Delete File action
}) {
  const [name, setName] = useState(initialName);
  const [colorClass, setColorClass] = useState(initialColor);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      setColorClass(initialColor || 'binder-blue-spine');
      setError('');
      setConfirmingDelete(false);
    }
  }, [isOpen, initialName, initialColor]);

  if (!isOpen) return null;

  const isEdit = mode === 'edit';

  const handleClose = () => {
    setConfirmingDelete(false);
    onClose && onClose();
  };

  const handleConfirmDelete = () => {
    setConfirmingDelete(false);
    onDelete && onDelete();
  };

  const handleSubmit = () => {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      setError('Please enter a file name.');
      return;
    }
    const result = onSubmit && onSubmit({ name: trimmed, colorClass });
    if (typeof result === 'string' && result) {
      setError(result);
      return;
    }
    onClose && onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#131926] rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-scaleIn">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <span className="material-symbols-outlined text-[20px]">{isEdit ? 'edit_note' : 'create_new_folder'}</span>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-none">{isEdit ? 'Edit File' : 'Create New File'}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Document Warehouse Registry</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body — the delete confirmation replaces the form in place */}
        {confirmingDelete ? (
          <div className="p-6 space-y-5">
            <div className="flex flex-col items-center text-center gap-3 py-2">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <span className="material-symbols-outlined text-[24px]">delete_forever</span>
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">Delete this file?</h4>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  &ldquo;{initialName || name}&rdquo; will be removed from the cabinet, along with its list of filed documents. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer"
              >
                Keep File
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/25 transition-all cursor-pointer"
              >
                Delete File
              </button>
            </div>
          </div>
        ) : (
        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block">File Name</label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. SALES_INVOICES, HR_PROFILES..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-white placeholder:font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block">Spine Colour Accent</label>
            <div className="grid grid-cols-2 gap-2">
              {BINDER_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColorClass(opt.value)}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                    colorClass === opt.value
                      ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10 ring-1 ring-indigo-500/50'
                      : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-white/[0.02]'
                  }`}
                >
                  <span className="w-6 h-6 rounded-md shadow-inner shrink-0" style={{ background: opt.preview }}></span>
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
            {isEdit && (
              <p className="text-[10px] font-medium text-slate-400 leading-relaxed">
                The colour you pick here applies to your view only — everyone else keeps seeing the file's own colour until they pick their own.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl px-3 py-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span className="text-[11px] font-bold">{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            {isEdit && onDelete && (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="py-2.5 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">delete</span>
                Delete
              </button>
            )}
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
            >
              {isEdit ? 'Save Changes' : 'Create File'}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
