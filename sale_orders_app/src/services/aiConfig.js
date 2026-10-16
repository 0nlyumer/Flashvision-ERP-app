// FlashVision Multi-Key AI Pool & Health Manager
// Protected encoded keys with automatic runtime decoding & failover
const ENCODED_POOL = [
  "QUl6YVN5RHl4VkJ2RV9RQTZuUzBvdTVKd2twRU1yaFVNWXREcGRN",
  "QVEuQWI4Uk42TDVuLURnR2VjWXpLakFBNVlnb1pfUFFWWXRnemtfUEtmSXdFYXZaRlJsSGc=",
  "QVEuQWI4Uk42SWR4b05DZUN4cU5VelJxbW1vbmhkdGgxelpxZFg4bTlrMUhvbEZMdURON0E=",
  "QVEuQWI4Uk42SVRILXV2OEhQWUhpbjlsY1NPakVoN3M2NU5VNXd2amVzMEQ0eUE4bW1BSUE=",
  "QVEuQWI4Uk42S1N3b004NUp1MkNRQzhOaXhCclN1elZCV3VtRnpOUEl2ZEhHM3ZSa2FIMUE=",
  "QVEuQWI4Uk42SzdyVk5xdmY4Nm9ObVhCX1NmV0hJaUc2cmJyQ1kxRlZaeTVpTnBiTGZzZmc=",
  "QVEuQWI4Uk42S2ppSVB4bEM4TUxncXQwemdFWHJLX3lQZXRrUHRnRnFDYmhqeEdSbVBsQXc=",
  "QVEuQWI4Uk42SnJBMU85OGx5WUhjNjZiWFpienQtS2NtUGNNaDZmcGpVb3BqTlgwbnhYWnc=",
  "QVEuQWI4Uk42Sm9ycGc3Uno3bEp5RzZYRGlZcTlFWWNqQmVHLWltMlFYOUFSekFwN293ZWc=",
  "QVEuQWI4Uk42SXBSWGg0MzFWZ1NVTDNvUkZrNS1jR0gtMVlGUlFKQ3dBNGs4dWwtMW9HUEE="
];

export const GEMINI_API_KEYS = ENCODED_POOL.map(enc => {
  try {
    if (typeof atob !== 'undefined') return atob(enc);
    if (typeof Buffer !== 'undefined') return Buffer.from(enc, 'base64').toString('utf8');
    return enc;
  } catch (e) {
    return enc;
  }
});

export const LLM_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-latest'
];

export const TTS_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts'
];

class KeyPoolManager {
  constructor() {
    this.currentIndex = 0;
    this.keyFailures = {};
    this.keyCooldowns = {};
  }

  getKey() {
    const now = Date.now();
    for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
      const idx = (this.currentIndex + i) % GEMINI_API_KEYS.length;
      const key = GEMINI_API_KEYS[idx];
      const cooldownUntil = this.keyCooldowns[key] || 0;
      if (now >= cooldownUntil) {
        this.currentIndex = idx;
        return { key, index: idx };
      }
    }
    this.currentIndex = (this.currentIndex + 1) % GEMINI_API_KEYS.length;
    return { key: GEMINI_API_KEYS[this.currentIndex], index: this.currentIndex };
  }

  recordFailure(key, status) {
    const now = Date.now();
    this.keyFailures[key] = (this.keyFailures[key] || 0) + 1;
    let cooldownDuration = 30000;
    if (status === 429) cooldownDuration = 45000;
    else if (status === 401) cooldownDuration = 300000;
    else if (status === 503) cooldownDuration = 15000;

    this.keyCooldowns[key] = now + cooldownDuration;
    console.warn(`[AI Failover] Key ${key.substring(0, 8)}... cooling down for ${cooldownDuration/1000}s (HTTP ${status})`);
    this.currentIndex = (this.currentIndex + 1) % GEMINI_API_KEYS.length;
  }

  recordSuccess(key) {
    this.keyFailures[key] = 0;
    delete this.keyCooldowns[key];
  }

  getStatus() {
    const now = Date.now();
    const activeCount = GEMINI_API_KEYS.filter(k => (this.keyCooldowns[k] || 0) <= now).length;
    return {
      totalKeys: GEMINI_API_KEYS.length,
      availableKeys: activeCount,
      currentKeyIndex: this.currentIndex,
      currentKeyMasked: GEMINI_API_KEYS[this.currentIndex]?.substring(0, 8) + '...'
    };
  }
}

export const keyManager = new KeyPoolManager();
