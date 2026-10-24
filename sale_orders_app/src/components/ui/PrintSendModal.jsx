import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  loadTelegramConfigFromTable,
  sendTelegramFile,
  isTelegramLinked,
  normalizeTelegramUsername
} from '../../utils/telegram';

// --- Print SEND flow (Omer, 2026-10-24) --------------------------------------
// Opened from the SEND button inside print popups. Lists ONLY ERP users;
// a document can only be received by a user whose Telegram is LINKED to the
// ERP (chat ID present) — unlinked users are shown but cannot be selected.
// Before sending, the format is chosen: PDF / CSV / PNG (PNG is rendered
// at 3x, ~300 dpi, so it stays crisp when zoomed). The file is built once
// by the caller's makeFile(format) and sent via the @flashvision_erp_bot
// (config read from app_config 'telegramConfig'; the send stays gated on
// that config's `enabled` flag — nothing is ever auto-sent).

const REASON_TEXT = {
  telegram_disabled: 'Telegram sending is not enabled yet — the bot must be enabled in the Telegram config (app_config) before documents can be sent.',
  telegram_not_configured: 'Telegram bot is not configured (no token in app_config).',
  invalid_chat_id: 'This user has no valid Telegram chat ID linked.',
  telegram_api_error: 'Telegram rejected the file (the user may not have started the bot yet).',
  telegram_network_error: 'Network error while contacting Telegram.',
  file_build_failed: 'The document file could not be generated.'
};

const FORMATS = [
  { id: 'pdf', label: 'PDF', icon: 'picture_as_pdf', hint: 'Best for printing & records' },
  { id: 'csv', label: 'CSV', icon: 'table_view', hint: 'Spreadsheet data' },
  { id: 'png', label: 'PNG Image', icon: 'image', hint: 'High quality (3x) — stays sharp on zoom' }
];

export default function PrintSendModal({
  open,
  onClose,
  documentTitle = 'Document',
  filenameBase = 'document',
  makeFile,
  csvAvailable = true
}) {
  const { state } = useApp() || {};
  const users = useMemo(() => (Array.isArray(state?.users) ? state.users : []), [state?.users]);

  const [config, setConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [format, setFormat] = useState('pdf');
  const [selected, setSelected] = useState(() => new Set());
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null); // [{ user, ok, reason }]

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setResults(null);
    setFormat('pdf');
    setConfigLoaded(false);
    loadTelegramConfigFromTable().then((cfg) => {
      setConfig(cfg);
      setConfigLoaded(true);
    });
  }, [open ]);

  if (!open) return null;

  const toggleUser = (user) => {
    if (!isTelegramLinked(user)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(user.id)) next.delete(user.id);
      else next.add(user.id);
      return next;
    });
  };

  const handleSend = async () => {
    const targets = users.filter((u) => selected.has(u.id) && isTelegramLinked(u));
    if (targets.length === 0 || typeof makeFile !== 'function') return;
    setSending(true);
    setResults(null);
    let built = null;
    try {
      built = await makeFile(format);
    } catch (e) {
      built = null;
    }
    const out = [];
    for (const user of targets) {
      if (!built || !built.blob) {
        out.push({ user, ok: false, reason: 'file_build_failed' });
        continue;
      }
      const res = await sendTelegramFile({
        config,
        chatId: user.telegramChatId,
        blob: built.blob,
        filename: built.filename || `${filenameBase}.${format}`,
        caption: documentTitle
      });
      out.push({ user, ok: !!res.ok, reason: res.reason });
    }
    setResults(out);
    setSending(false);
  };

  const linkedCount = users.filter((u) => isTelegramLinked(u)).length;
  const botOff = configLoaded && (!config || config.enabled !== true);

  return (
    <div className="no-print fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 border border-sky-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">send</span>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">Send on Telegram</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[300px]">{documentTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {botOff && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-200 flex gap-2">
              <span className="material-symbols-outlined text-base shrink-0">info</span>
              <span>{REASON_TEXT.telegram_disabled} You can still pick users and a format — sending will report this until it is enabled.</span>
            </div>
          )}

          {/* Format picker */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Format</p>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => {
                const disabled = f.id === 'csv' && !csvAvailable;
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setFormat(f.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      format === f.id
                        ? 'bg-sky-600/10 border-sky-500 text-sky-700 dark:text-sky-300'
                        : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg block mb-1">{f.icon}</span>
                    <span className="text-xs font-extrabold block">{f.label}</span>
                    <span className="text-[9px] text-slate-400 block leading-tight mt-0.5">{disabled ? 'No tabular data' : f.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User picker — ERP users only */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
              ERP Users ({linkedCount} linked of {users.length})
            </p>
            <div className="space-y-1.5">
              {users.length === 0 && (
                <p className="text-xs text-slate-400 italic p-3">No ERP users found.</p>
              )}
              {users.map((user) => {
                const linked = isTelegramLinked(user);
                const isSel = selected.has(user.id);
                const tgName = normalizeTelegramUsername(user.telegramUsername);
                return (
                  <button
                    key={user.id}
                    type="button"
                    disabled={!linked}
                    onClick={() => toggleUser(user)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                      !linked
                        ? 'bg-slate-50 dark:bg-slate-950/30 border-slate-200/60 dark:border-slate-800/50 opacity-60 cursor-not-allowed'
                        : isSel
                          ? 'bg-sky-600/10 border-sky-500 cursor-pointer'
                          : 'bg-white dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${isSel ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent'}`}>
                      <span className="material-symbols-outlined text-sm">check</span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">
                        {user.name || user.username || user.id}
                        {user.role ? <span className="text-slate-400 font-semibold"> • {user.role}</span> : null}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {tgName ? `@${tgName}` : 'No Telegram username'}
                      </span>
                    </span>
                    {linked ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-black uppercase shrink-0">Linked</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/20 text-[9px] font-black uppercase shrink-0" title="Is user ne apna Telegram link nahi kiya — document receive nahi kar sakta">
                        Telegram link nahi hai
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results */}
          {results && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Result</p>
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                    r.ok
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-base shrink-0">{r.ok ? 'check_circle' : 'error'}</span>
                  <span>
                    <strong>{r.user.name || r.user.username || r.user.id}</strong>
                    {r.ok ? ' — document sent on Telegram.' : ` — not sent. ${REASON_TEXT[r.reason] || 'Unknown error.'}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-400">
            {selected.size > 0 ? `${selected.size} user(s) selected • ${format.toUpperCase()}` : 'Select at least one linked user'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || selected.size === 0}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-sky-900/30 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">{sending ? 'sync' : 'send'}</span>
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
