// ==============================================================================
// Supabase Edge Function: gemini-proxy
// Location: supabase_functions/gemini-proxy/index.ts
// Runtime: Deno (TypeScript)
// Description: Secure server-side proxy for Google Gemini API key rotation,
//              cooldown management, and model failover. Eliminates hardcoded
//              API keys from client-side bundles.
// ==============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Standard CORS headers allowing secure invocations from Web, Capacitor & Electron
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Supported Gemini Models in priority order
const DEFAULT_LLM_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-flash-latest"
];

// Server-side Key Pool Manager
class ServerKeyPoolManager {
  private keys: string[] = [];
  private currentIndex = 0;
  private keyFailures: Record<string, number> = {};
  private keyCooldowns: Record<string, number> = {};

  constructor() {
    this.reloadKeys();
  }

  public reloadKeys(): void {
    // Read keys from environment secret GEMINI_API_KEYS (comma-separated or JSON array)
    const rawEnv = Deno.env.get("GEMINI_API_KEYS") || Deno.env.get("GEMINI_API_KEY") || "";
    if (!rawEnv) {
      console.error("[gemini-proxy] GEMINI_API_KEYS secret is missing from Supabase environment!");
      this.keys = [];
      return;
    }

    try {
      if (rawEnv.trim().startsWith("[")) {
        this.keys = JSON.parse(rawEnv);
      } else {
        this.keys = rawEnv.split(",").map(k => k.trim()).filter(Boolean);
      }
    } catch {
      this.keys = rawEnv.split(",").map(k => k.trim()).filter(Boolean);
    }

    console.log(`[gemini-proxy] Initialized with ${this.keys.length} API keys in server pool.`);
  }

  public getKey(): { key: string; index: number } | null {
    if (this.keys.length === 0) {
      this.reloadKeys();
      if (this.keys.length === 0) return null;
    }

    const now = Date.now();
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[idx];
      const cooldownUntil = this.keyCooldowns[key] || 0;
      if (now >= cooldownUntil) {
        this.currentIndex = idx;
        return { key, index: idx };
      }
    }

    // If all keys are in cooldown, pick next round-robin anyway
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    return { key: this.keys[this.currentIndex], index: this.currentIndex };
  }

  public recordFailure(key: string, status: number): void {
    const now = Date.now();
    this.keyFailures[key] = (this.keyFailures[key] || 0) + 1;
    let cooldownDuration = 30000; // 30s default
    if (status === 429) cooldownDuration = 45000;  // 45s rate limit
    else if (status === 401) cooldownDuration = 300000; // 5m invalid/expired key
    else if (status === 503) cooldownDuration = 15000;  // 15s service overload

    this.keyCooldowns[key] = now + cooldownDuration;
    console.warn(`[gemini-proxy] Key index cooled down for ${cooldownDuration / 1000}s (HTTP ${status})`);
    if (this.keys.length > 0) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    }
  }

  public recordSuccess(key: string): void {
    this.keyFailures[key] = 0;
    delete this.keyCooldowns[key];
  }

  public getKeyCount(): number {
    return this.keys.length;
  }
}

const keyManager = new ServerKeyPoolManager();

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json();
    const {
      contents,
      systemInstruction,
      tools,
      generationConfig,
      models = DEFAULT_LLM_MODELS
    } = body;

    if (!contents || !Array.isArray(contents)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: 'contents' array is required." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const totalAvailable = keyManager.getKeyCount();
    if (totalAvailable === 0) {
      return new Response(
        JSON.stringify({
          error: "Edge function error: No Gemini API keys configured on server. Please set GEMINI_API_KEYS secret in Supabase dashboard.",
          success: false
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    let lastError = "Unknown error";
    const modelsToTry = Array.isArray(models) && models.length > 0 ? models : DEFAULT_LLM_MODELS;
    const maxAttempts = Math.min(totalAvailable * modelsToTry.length, 10);

    // Multi-key failover loop
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const keyInfo = keyManager.getKey();
      if (!keyInfo) break;
      const { key, index: keyIdx } = keyInfo;

      for (const model of modelsToTry) {
        try {
          const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);

          const geminiReqBody = {
            contents,
            ...(systemInstruction ? { systemInstruction } : {}),
            ...(tools ? { tools } : {}),
            generationConfig: generationConfig || {
              temperature: 0.2,
              maxOutputTokens: 1000
            }
          };

          const res = await fetch(googleApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify(geminiReqBody)
          });
          clearTimeout(timeout);

          if (!res.ok) {
            keyManager.recordFailure(key, res.status);
            lastError = `Google API HTTP ${res.status}: ${res.statusText}`;
            continue; // Try next model or next key
          }

          const geminiData = await res.json();
          const candidate = geminiData?.candidates?.[0];

          if (!candidate) {
            lastError = "Google API returned empty candidates";
            continue;
          }

          keyManager.recordSuccess(key);

          // Extract response parts
          let textReply = "";
          let toolCall = null;

          for (const part of candidate.content?.parts || []) {
            if (part.text) {
              textReply += part.text;
            }
            if (part.functionCall) {
              toolCall = part.functionCall;
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              data: geminiData,
              candidate,
              text: textReply.trim(),
              toolCall,
              modelUsed: model,
              keyIndex: keyIdx // Masked index, raw key is never returned
            }),
            { status: 200, headers: corsHeaders }
          );
        } catch (fetchErr) {
          const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          lastError = msg;
          keyManager.recordFailure(key, 500);
        }
      }
    }

    // If loop finishes without returning, all attempts failed
    return new Response(
      JSON.stringify({
        success: false,
        error: `All Gemini failover attempts exhausted. Last error: ${lastError}`,
        fallbackText: "Mohtaram, network traffic ki wajah se response delay ho gaya hai. Aapka sawal note kar liya hai, dobara try kijiye."
      }),
      { status: 502, headers: corsHeaders }
    );

  } catch (parseErr) {
    return new Response(
      JSON.stringify({ error: `Bad Request: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}` }),
      { status: 400, headers: corsHeaders }
    );
  }
});
