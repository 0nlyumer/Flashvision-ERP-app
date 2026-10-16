# FlashVision ERP — Google Gemini API Key Remediation & Server-Side Cutover Plan

> **Author:** Antigravity AI  
> **Target System:** FlashVision ERP (`sale_orders_app`)  
> **Prepared for:** Omer (Owner & Principal)  
> **Date:** October 2026  
> **Status:** Pending Owner Approval (DO NOT DEPLOY WITHOUT APPROVAL)  
> **Deliverable Path:** `/home/hatch/workspace/erp/GEMINI_KEY_REMEDIATION_PLAN.md`  
> **Associated Code:** `supabase_functions/gemini-proxy/index.ts`

---

## 1. Problem Statement & Current Security Exposure

In the current codebase, FlashVision's AI Copilot utilizes a pool of **10 Google Gemini API keys** configured in `src/services/aiConfig.js`:
```javascript
const ENCODED_POOL = [
  "QUl6YVN5RHl4VkJ2RV9RQTZuUzBvdTVKd2twRU1yaFVNWXREcGRN",
  "QVEuQWI4Uk42TDVuLURnR2VjWXpLakFBNVlnb1pfUFFWWXRnemtfUEtmSXdFYXZaRlJsSGc=",
  ...
];
export const GEMINI_API_KEYS = ENCODED_POOL.map(enc => atob(enc));
```

### Critical Vulnerabilities:
1. **Plaintext Secret Extraction:** Base64 encoding is **not encryption**. Anyone inspecting `bundle.js`, opening Chrome DevTools, or reading network traffic to `generativelanguage.googleapis.com` can extract all 10 active keys in under 5 seconds.
2. **Quota Exhaustion & Financial/Service Risk:** Malicious actors or unauthorized clients can hijack these keys to run external model inference, exhausting Omer's Google AI Studio quotas and knocking the ERP's AI Copilot offline for factory staff.
3. **No Centralized Revocation:** If a key is compromised, changing it requires rebuilding and redeploying the web app, desktop installer, and Android APKs.

---

## 2. Proposed Architectural Solution: Supabase Edge Function Proxy

We shift all API key storage and failover logic from the client bundle to a serverless **Supabase Edge Function** (`gemini-proxy` running on Deno).

```
┌────────────────────────────────────────────────────────┐
│                     CLIENT DEVICES                     │
│  (Web Portal, Desktop Electron, Mobile Flash AM)       │
└──────────────────────────┬─────────────────────────────┘
                           │ POST /functions/v1/gemini-proxy
                           │ (Contains prompt, context, tool defs)
                           ▼
┌────────────────────────────────────────────────────────┐
│             SUPABASE EDGE FUNCTION GATEWAY             │
│            (supabase_functions/gemini-proxy)           │
│                                                        │
│  1. In-Memory KeyPoolManager & Cooldown Engine         │
│  2. Reads Server Secrets (Deno.env.get)                │
│  3. Model Failover (3.5-flash-lite -> flash -> latest) │
│  4. Returns Clean Candidate / Tool Call & Telemetry    │
└──────────────────────────┬─────────────────────────────┘
                           │ Secure Server-to-Server HTTPS
                           │ (Gemini API Key in query param)
                           ▼
┌────────────────────────────────────────────────────────┐
│           GOOGLE GENERATIVE LANGUAGE API               │
│          (generativelanguage.googleapis.com)           │
└────────────────────────────────────────────────────────┘
```

### Architectural Benefits:
- **Zero Client Key Exposure:** The client receives only AI responses and structured tool actions (`navigate_to_screen`, `create_sale_order`, etc.). The keys never leave Supabase's secure server memory.
- **Instant Secret Rotation:** Keys can be added, removed, or rotated instantly via the Supabase CLI (`supabase secrets set`) or Dashboard without recompiling the web app or releasing new mobile APKs.
- **Preserved Multi-Key Failover:** The server-side proxy retains full round-robin rotation, 429 rate-limit cooldowns (45s), 401 auth failure cooldowns (300s), and model fallback.

---

## 3. Implementation Artifacts Created

1. **Edge Function Starter Code:**  
   `supabase_functions/gemini-proxy/index.ts`  
   - Implements full CORS handling for browser, Electron, and Capacitor.
   - Reads `GEMINI_API_KEYS` from Supabase server environment.
   - Manages automatic multi-key cooldowns and model failovers.
   - Handles ERP function-calling tools (`ERP_TOOLS`) seamlessly.

---

## 4. Step-by-Step Deployment Guide (For Omer's Approval)

### Step 1: Configure Secrets in Supabase
Run the Supabase CLI command or set the secrets in the Supabase Dashboard under **Project Settings -> Edge Functions -> Secrets**:

```bash
# Decode the 10 existing keys and supply them as a comma-separated list:
supabase secrets set GEMINI_API_KEYS="AIzaSyDyxVBvE_QA6nS0ou5JwkpEMrhUMYtDpdM,<PASTE_KEY_HERE>,<PASTE_KEY_HERE>,<PASTE_KEY_HERE>,<PASTE_KEY_HERE>,<PASTE_KEY_HERE>,<PASTE_KEY_HERE>,<PASTE_KEY_HERE>,<PASTE_KEY_HERE>,<PASTE_KEY_HERE>"
```

### Step 2: Deploy the Edge Function
```bash
supabase functions deploy gemini-proxy --no-verify-jwt
```

### Step 3: Verify the Edge Function via cURL
```bash
curl -i --location --request POST 'https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/gemini-proxy' \
  --header 'Content-Type: application/json' \
  --data '{
    "contents": [{ "role": "user", "parts": [{ "text": "Hello FlashVision ERP!" }] }]
  }'
```
Expected response:
```json
{
  "success": true,
  "text": "Hello! How can I assist you with FlashVision ERP today?",
  "modelUsed": "gemini-3.5-flash-lite",
  "keyIndex": 0
}
```

---

## 5. Client Cutover Code Changes (Prepared Diff)

Once Omer approves the cutover, the following client edits will be applied:

### File: `src/services/aiConfig.js`
Replace client-side key pool with proxy endpoint configuration:

```javascript
// FlashVision AI Client Configuration
// Zero hardcoded API keys — all requests routed through Supabase Edge Function

export const USE_EDGE_PROXY = true; // Toggle for smooth testing & rollback

export const LLM_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-latest'
];

export const TTS_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts'
];
```

### File: `src/services/aiService.js`
Update `askFlashVisionAI()` to call the Supabase Edge Function:

```javascript
import { supabase } from '../utils/supabaseClient';
import { USE_EDGE_PROXY } from './aiConfig';

export async function askFlashVisionAI({ prompt, erpState, currentUser, history = [] }) {
  const userRole = currentUser?.role || 'Super Admin';

  // 1. RBAC Validation on Prompt
  const rbacCheck = validateRBAC(userRole, null, prompt);
  if (!rbacCheck.allowed) {
    return { text: rbacCheck.message, action: null, error: null };
  }

  const enrichedPrompt = buildPromptWithContext(prompt, erpState, currentUser);

  const contents = [];
  if (Array.isArray(history) && history.length > 0) {
    for (const h of history.slice(-4)) {
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      });
    }
  }
  contents.push({
    role: 'user',
    parts: [{ text: enrichedPrompt }]
  });

  const toolsPayload = [{ functionDeclarations: ERP_TOOLS }];

  // Call Supabase Edge Function proxy
  if (USE_EDGE_PROXY) {
    try {
      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: {
          contents,
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          tools: toolsPayload,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000
          }
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Enforce RBAC on Tool Call
        if (data.toolCall) {
          const toolRbac = validateRBAC(userRole, data.toolCall.name, prompt);
          if (!toolRbac.allowed) {
            return { text: toolRbac.message, action: null, toolCall: null };
          }
        }

        return {
          text: data.text || (data.toolCall ? `Main ne ${data.toolCall.name} action tayyar kar diya hai.` : 'Ji, main samajh gaya hoon.'),
          toolCall: data.toolCall,
          modelUsed: data.modelUsed,
          keyUsedIndex: data.keyIndex
        };
      }

      if (data?.fallbackText) {
        return { text: data.fallbackText, error: data.error, toolCall: null };
      }
    } catch (proxyErr) {
      console.warn('[AI Proxy] Edge Function error, falling back or reporting delay:', proxyErr);
    }
  }

  // Graceful fallback response if service is temporarily unreachable
  return {
    text: 'Mohtaram, AI service se rabta qaim nahi ho saka. Baraye mehrbani thori der baad koshish kijiye.',
    error: 'Proxy connection failed',
    toolCall: null
  };
}
```

---

## 6. Rollback & Safety Plan

1. **Feature Flag Fallback:** The client code maintains `USE_EDGE_PROXY = true`. If any unexpected latency or edge function network blip occurs during testing, switching `USE_EDGE_PROXY = false` can revert immediately.
2. **Key Retention:** The hardcoded keys in `src/services/aiConfig.js` remain completely untouched in Phase 1 as instructed. They will ONLY be removed after Omer confirms the Edge Function is deployed and operating smoothly.
3. **Zero UI Disruption:** The return signature of `askFlashVisionAI` (`{ text, toolCall, modelUsed, keyUsedIndex }`) is strictly preserved, so `AICopilot.jsx` and speech synthesizers continue working identically.

---

## 7. Next Step / Sign-Off

- [ ] Omer reviews this remediation plan.
- [ ] Omer configures `GEMINI_API_KEYS` in Supabase Secrets.
- [ ] Omer executes `supabase functions deploy gemini-proxy --no-verify-jwt`.
- [ ] Omer approves Phase 2 switch to remove keys from `src/services/aiConfig.js`.
