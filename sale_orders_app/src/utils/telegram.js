// --- Telegram integration plumbing — 2026-10-24 ---------------------------
// The FlashVision ERP bot (@flashvision_erp_bot) is configured ONLY in the
// Supabase `app_config` row with key 'telegramConfig' (botUsername, botName,
// token, enabled, createdAt). The token is NEVER stored in source, NEVER
// logged, and NEVER rendered in any UI. This module reads the config from
// app_config at runtime and hands the token only to the Telegram Bot API
// URL inside sendTelegramMessage — nowhere else.
//
// SENDING IS HARD-GATED OFF: sendTelegramMessage refuses to make any
// network call while config.enabled is false (the live value today), and
// there is currently NO caller wired to it — no automatic trigger, no
// Chat-module path, no send button. dryRunTelegramSend builds the exact
// payload without any network call and is the only verification allowed
// until the owner explicitly enables sending.

import { supabase } from './supabaseClient';

export const TELEGRAM_BOT_USERNAME = 'flashvision_erp_bot';
export const TELEGRAM_BOT_LINK = 'https://t.me/flashvision_erp_bot';

// --- Config (app_config, mirrors the loadAdminSetupFromTable pattern) -----
export const loadTelegramConfigFromTable = async () => {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('key', 'telegramConfig')
      .maybeSingle();
    if (error || !data || typeof data.data !== 'object' || data.data === null) return null;
    return data.data;
  } catch (_) {
    return null;
  }
};

// --- Per-user Telegram fields (stored on the user record, via updateUser) --
export const normalizeTelegramUsername = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/^@+/, '');
};

// A Telegram chat id is an integer (private chats are positive; group and
// channel ids are negative). Empty means "not linked" — never an error.
export const isValidTelegramChatId = (value) => {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return /^-?\d+$/.test(text);
};

export const getTelegramLinkedStatus = (user) => {
  if (!user) return 'Not linked';
  return isValidTelegramChatId(user.telegramChatId) ? 'Linked' : 'Not linked';
};

export const isTelegramLinked = (user) => getTelegramLinkedStatus(user) === 'Linked';

// --- Send payload (pure: no network, no token handling) --------------------
export const buildTelegramSendPayload = ({ chatId, text, document } = {}) => {
  const payload = { chat_id: String(chatId).trim() };
  if (document) {
    payload.document = document;
    if (text) payload.caption = text;
    return { method: 'sendDocument', payload };
  }
  payload.text = text || '';
  return { method: 'sendMessage', payload };
};

// Dry run only: returns exactly what WOULD be sent, and whether the gate
// blocks it. Makes NO network call and never touches the token.
export const dryRunTelegramSend = ({ config, chatId, text, document } = {}) => {
  if (!config || config.enabled !== true) {
    return { sent: false, wouldSend: false, reason: 'telegram_disabled' };
  }
  if (!config.token) {
    return { sent: false, wouldSend: false, reason: 'telegram_not_configured' };
  }
  if (!isValidTelegramChatId(chatId)) {
    return { sent: false, wouldSend: false, reason: 'invalid_chat_id' };
  }
  const { method, payload } = buildTelegramSendPayload({ chatId, text, document });
  return { sent: false, wouldSend: true, method, payload };
};

// The ONLY live-send entry point. Hard gate first: while enabled is not
// true, this returns without any fetch. The token is used only inside the
// request URL and is never logged or returned.
export const sendTelegramMessage = async ({ config, chatId, text, document } = {}) => {
  const dry = dryRunTelegramSend({ config, chatId, text, document });
  if (!dry.wouldSend) {
    return { ok: false, sent: false, reason: dry.reason };
  }
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.token}/${dry.method}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dry.payload),
      }
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true) {
      return { ok: false, sent: false, reason: 'telegram_api_error' };
    }
    return { ok: true, sent: true, method: dry.method };
  } catch (_) {
    return { ok: false, sent: false, reason: 'telegram_network_error' };
  }
};
