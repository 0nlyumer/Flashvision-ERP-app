import React from 'react';
import { TELEGRAM_BOT_LINK, getTelegramLinkedStatus, isValidTelegramChatId } from '../../utils/telegram';

// Shared Telegram link fields, used by the admin user form (User Control)
// and by the user's own profile screen. Saving happens through the host
// form's existing updateUser path — this component only edits the values.
// Linking only stores the user's Telegram details. No message is sent from
// here, and sending stays OFF until the owner explicitly enables it.
export default function TelegramFields({
  telegramUsername = '',
  telegramChatId = '',
  onUsernameChange,
  onChatIdChange,
  inputClassName,
}) {
  const linked = isValidTelegramChatId(telegramChatId);
  const status = getTelegramLinkedStatus({ telegramChatId });
  const inputCls = inputClassName
    || 'w-full bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all font-semibold';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Telegram</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${linked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {linked ? '● Linked' : '○ Not linked'}
          <span className="sr-only">{status}</span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Telegram Username (optional)</label>
        <input
          type="text"
          value={telegramUsername}
          onChange={(e) => onUsernameChange && onUsernameChange(e.target.value)}
          placeholder="@username"
          className={inputCls}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Telegram Chat ID</label>
        <input
          type="text"
          inputMode="numeric"
          value={telegramChatId}
          onChange={(e) => onChatIdChange && onChatIdChange(e.target.value)}
          placeholder="e.g. 123456789"
          className={inputCls}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500 font-medium">
        Link karne ke liye:{' '}
        <a href={TELEGRAM_BOT_LINK} target="_blank" rel="noreferrer" className="text-blue-600 font-bold">@flashvision_erp_bot</a>
        {' '}kholein, /start dabayein, phir apna Chat ID yahan paste karke save karein.
        Sirf link karne se koi message nahi jayega — Telegram se bhejna filhal OFF hai.
      </p>
    </div>
  );
}
