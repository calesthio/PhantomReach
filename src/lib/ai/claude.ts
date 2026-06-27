/**
 * LLM Provider Router for Phantom Reach.
 *
 * Routes AI calls to the active provider (Anthropic, OpenAI, or Google).
 * Defaults to Anthropic. Configurable via LLM_PROVIDER env var.
 *
 * One frontier model per provider. No tiering. No cost compromises.
 *
 * Backward-compatible: existing imports of `complete`, `extractJSON`,
 * `isAIConfigured`, `MODELS`, and `ModelTier` continue to work.
 *
 * Auth modes supported per provider:
 *   - OpenAI:    Codex (auto-detected from ~/.codex/auth.json) → OPENAI_OAUTH_TOKEN → OPENAI_API_KEY
 *   - Anthropic: ANTHROPIC_OAUTH_TOKEN → ANTHROPIC_API_KEY
 *   - Google:    GOOGLE_VERTEX_PROJECT (Vertex AI w/ ADC) → GOOGLE_AI_API_KEY / GEMINI_API_KEY
 */

import type { LLMProvider, AgenticRequest, AgenticResponse } from "./types";
import { anthropicProvider, resetAnthropicClient } from "./providers/anthropic";
import { openaiProvider, resetOpenAIClient, isUsingCodex } from "./providers/openai";
import { googleProvider, resetGoogleClient } from "./providers/google";

// ---------------------------------------------------------------------------
// Backward-compat exports (KEEP — orchestrator imports these)
// ---------------------------------------------------------------------------

/** @deprecated Use getProvider() instead. Kept for backward compatibility. */
export const MODELS = {
  sonnet: "claude-opus-4-6",
  haiku: "claude-haiku-4-5-20241022",
} as const;

/** @deprecated Use getProvider() instead. Kept for backward compatibility. */
export type ModelTier = keyof typeof MODELS;

// ---------------------------------------------------------------------------
// Provider registry & router
// ---------------------------------------------------------------------------

const providers: Record<string, LLMProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  google: googleProvider,
};

let _activeProvider: LLMProvider | undefined;

/**
 * Get the active LLM provider.
 * Reads LLM_PROVIDER env var on first call (default: "anthropic").
 */
export function getProvider(): LLMProvider {
  if (_activeProvider) return _activeProvider;

  const providerName = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  const provider = providers[providerName];

  if (!provider) {
    console.warn(
      `[ai/claude] Unknown LLM_PROVIDER "${providerName}" — falling back to anthropic`
    );
    _activeProvider = anthropicProvider;
  } else {
    _activeProvider = provider;
  }

  return _activeProvider;
}

/**
 * Reset the active provider selection and all provider clients.
 * Call this after changing auth environment variables at runtime.
 */
export function resetProviders(): void {
  _activeProvider = undefined;
  resetAnthropicClient();
  resetOpenAIClient();
  resetGoogleClient();
}

/**
 * Get information about how the active provider is authenticated.
 * Useful for UI display and diagnostics.
 */
export function getAuthInfo(): {
  provider: string;
  authMode: "codex" | "api_key" | "oauth_token" | "vertex_ai" | "unconfigured";
  configured: boolean;
} {
  const providerName = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  const provider = getProvider();
  const configured = provider.isConfigured();

  let authMode: "codex" | "api_key" | "oauth_token" | "vertex_ai" | "unconfigured" = "unconfigured";

  if (configured) {
    switch (providerName) {
      case "openai":
        // Codex takes priority over OAuth and API key
        if (isUsingCodex()) {
          authMode = "codex";
        } else if (process.env.OPENAI_OAUTH_TOKEN) {
          authMode = "oauth_token";
        } else {
          authMode = "api_key";
        }
        break;
      case "anthropic":
        authMode = process.env.ANTHROPIC_OAUTH_TOKEN ? "oauth_token" : "api_key";
        break;
      case "google":
        authMode = process.env.GOOGLE_VERTEX_PROJECT
          ? "vertex_ai"
          : "api_key";
        break;
    }
  }

  return { provider: providerName, authMode, configured };
}

// ---------------------------------------------------------------------------
// Backward-compatible exports — delegate to active provider
// ---------------------------------------------------------------------------

/** Check whether the active LLM provider is configured and usable. */
export function isAIConfigured(): boolean {
  return getProvider().isConfigured();
}

/**
 * Backward-compatible completion options.
 * The `model` field is accepted but ignored — the active provider's
 * single frontier model is always used.
 */
export interface CompletionOptions {
  /** @deprecated Ignored. The provider's frontier model is always used. */
  model?: ModelTier;
  /** System prompt. */
  system?: string;
  /** User message content. */
  prompt: string;
  /** Max tokens to generate. Defaults to 1024. */
  maxTokens?: number;
  /** Temperature 0-1. Defaults to 0.3 for deterministic output. */
  temperature?: number;
}

/**
 * Send a single-turn message to the active LLM provider.
 * Returns `null` if the provider is not configured.
 */
export async function complete(options: CompletionOptions): Promise<string | null> {
  const provider = getProvider();
  if (!provider.isConfigured()) return null;

  const { system, prompt, maxTokens, temperature } = options;
  const response = await provider.complete({ system, prompt, maxTokens, temperature });
  return response.text;
}

/**
 * Send a prompt to the active LLM provider and parse the response as JSON.
 * Returns `null` if the provider is not configured or parsing fails.
 */
export async function extractJSON<T = unknown>(
  options: Omit<CompletionOptions, "model"> & { model?: ModelTier }
): Promise<T | null> {
  const provider = getProvider();
  if (!provider.isConfigured()) return null;

  const { system, prompt, maxTokens, temperature } = options;
  return provider.extractJSON<T>({ system, prompt, maxTokens, temperature });
}

/**
 * Run an agentic tool-use completion.
 * The model is given tools and calls them in a loop until it produces a final response.
 *
 * Supported by all three providers (Anthropic, OpenAI, Google).
 * Falls back to single completion if the provider doesn't implement completeWithTools.
 */
export async function completeWithTools(req: AgenticRequest): Promise<AgenticResponse> {
  const provider = getProvider();
  if (!provider.isConfigured()) return { text: null, toolCalls: [] };

  // Use the typed interface — all providers now implement completeWithTools
  if (provider.completeWithTools) {
    return provider.completeWithTools(req);
  }

  // Fallback: single completion without tools
  console.warn("[ai/claude] Provider does not support tool use — falling back to single completion");
  const response = await provider.complete({
    system: req.system,
    prompt: req.prompt,
    maxTokens: req.maxTokens,
    temperature: req.temperature,
  });
  return { text: response.text, toolCalls: [], usage: response.usage };
}
