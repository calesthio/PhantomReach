/**
 * OpenAI provider implementation.
 *
 * Single frontier model: GPT-4.1 — reliable, widely available, tool-use capable.
 *
 * Auth priority (highest to lowest):
 *   1. Codex (chatgpt.com/backend-api/codex/responses) — uses ChatGPT subscription
 *      Auto-detected from ~/.codex/auth.json or CODEX_ACCESS_TOKEN env var
 *   2. OAuth Bearer token (OPENAI_OAUTH_TOKEN) — standard api.openai.com
 *   3. API key (OPENAI_API_KEY) — standard api.openai.com
 *
 * Each level falls back to the next on auth failure, with detailed logging.
 */

import OpenAI from "openai";
import type {
  LLMProvider,
  LLMCapabilities,
  CompletionRequest,
  CompletionResponse,
  AgenticRequest,
  AgenticResponse,
} from "../types";
import {
  getCodexCredentials,
  resetCodexCredentials,
  codexComplete,
  codexCompleteWithTools,
  isCodexAuthError,
  type CodexCredentials,
} from "./codex-client";

// ---------------------------------------------------------------------------
// Model constants
// ---------------------------------------------------------------------------

/** Model for standard OpenAI API (api.openai.com). */
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

/** Model for Codex endpoint (chatgpt.com/backend-api/codex/responses).
 *  Only codex-specific models work — gpt-4.1 etc. return 400. */
const CODEX_MODEL = process.env.CODEX_MODEL || "gpt-5.2-codex";

// ---------------------------------------------------------------------------
// Codex state
// ---------------------------------------------------------------------------

let _codexFailed = false;

function getCodexCreds(): CodexCredentials | null {
  if (_codexFailed) return null;
  return getCodexCredentials();
}

// ---------------------------------------------------------------------------
// Standard OpenAI API client (fallback)
// ---------------------------------------------------------------------------

let _client: OpenAI | null | undefined;
let _usingOAuth = false;
let _oauthFailed = false;

function buildClient(credential: string): OpenAI {
  return new OpenAI({
    apiKey: credential,
    ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    ...(process.env.OPENAI_ORG_ID ? { organization: process.env.OPENAI_ORG_ID } : {}),
  });
}

function getClient(): OpenAI | null {
  if (_client !== undefined) return _client;

  const oauthToken = process.env.OPENAI_OAUTH_TOKEN;
  const apiKey = process.env.OPENAI_API_KEY;

  // Try OAuth first (unless it already failed this session)
  if (oauthToken && !_oauthFailed) {
    console.log("[ai/openai] Using OAuth Bearer token for standard API authentication");
    _usingOAuth = true;
    _client = buildClient(oauthToken);
    return _client;
  }

  // Fallback to API key
  if (apiKey) {
    if (_oauthFailed) {
      console.log("[ai/openai] OAuth failed, using API key fallback");
    } else {
      console.log("[ai/openai] Using API key for authentication");
    }
    _usingOAuth = false;
    _client = buildClient(apiKey);
    return _client;
  }

  // No standard API credentials — might still have Codex
  if (!_codexFailed && getCodexCredentials()) {
    console.log("[ai/openai] No standard API credentials, but Codex is available");
    _client = null;
    return null;
  }

  console.warn(
    "[ai/openai] No authentication configured (no Codex, no OPENAI_API_KEY, no OPENAI_OAUTH_TOKEN) — OpenAI provider disabled"
  );
  _client = null;
  return null;
}

function handleOAuthFailure(error: unknown): boolean {
  if (!_usingOAuth) return false;

  const apiKey = process.env.OPENAI_API_KEY;
  const status = (error as any)?.status ?? (error as any)?.statusCode;
  const msg = error instanceof Error ? error.message : String(error);

  console.warn(
    `[ai/openai] ⚠️ OAuth token authentication failed (status=${status}): ${msg}`
  );

  if (apiKey) {
    console.log("[ai/openai] Falling back to API key authentication...");
    _oauthFailed = true;
    _client = undefined; // force rebuild on next getClient()
    return true;
  }

  console.error("[ai/openai] No OPENAI_API_KEY available for fallback — request will fail");
  return false;
}

/** Returns whether the provider is currently using Codex mode. */
export function isUsingCodex(): boolean {
  return !_codexFailed && getCodexCredentials() !== null;
}

/** Returns whether the provider is currently using an OAuth token (standard API). */
export function isUsingOAuth(): boolean {
  return _usingOAuth && !_oauthFailed;
}

/** Reset all client state (used when auth config changes at runtime). */
export function resetOpenAIClient(): void {
  _client = undefined;
  _oauthFailed = false;
  _usingOAuth = false;
  _codexFailed = false;
  resetCodexCredentials();
}

// ---------------------------------------------------------------------------
// Robust JSON extraction — reuses same strategies as Anthropic provider
// ---------------------------------------------------------------------------

function robustParseJSON<T>(text: string): T | null {
  const trimmed = text.trim();

  // Strategy 1: Direct parse
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // continue
  }

  // Strategy 2: Strip markdown code fences
  const fencePattern = /```(?:json)?\s*\n?([\s\S]*?)(?:\n?```\s*$|$)/i;
  const fenceMatch = trimmed.match(fencePattern);
  if (fenceMatch?.[1]) {
    const inner = fenceMatch[1].trim();
    try {
      return JSON.parse(inner) as T;
    } catch {
      const balanced = extractBalancedJSON(inner);
      if (balanced) {
        try { return JSON.parse(balanced) as T; } catch { /* continue */ }
      }
      const repaired = repairTruncatedJSON(inner);
      if (repaired) {
        try { return JSON.parse(repaired) as T; } catch { /* continue */ }
      }
    }
  }

  // Strategy 3: Extract balanced JSON object
  const balanced = extractBalancedJSON(trimmed);
  if (balanced) {
    try { return JSON.parse(balanced) as T; } catch { /* continue */ }
  }

  // Strategy 4: Find first { and attempt to parse
  const firstBrace = trimmed.indexOf("{");
  if (firstBrace >= 0) {
    const jsonCandidate = trimmed.slice(firstBrace);
    try {
      return JSON.parse(jsonCandidate) as T;
    } catch {
      const repaired = repairTruncatedJSON(jsonCandidate);
      if (repaired) {
        try { return JSON.parse(repaired) as T; } catch { /* exhausted */ }
      }
    }
  }

  console.error("[ai/openai] robustParseJSON: all strategies failed, text starts with:", trimmed.slice(0, 200));
  return null;
}

function extractBalancedJSON(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function repairTruncatedJSON(json: string): string | null {
  let s = json.trim();
  s = s.replace(/,\s*$/, "");

  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      if (stack.length > 0 && stack[stack.length - 1] === ch) stack.pop();
    }
  }

  if (inString) s += '"';
  while (stack.length > 0) s += stack.pop();
  return s;
}

// ---------------------------------------------------------------------------
// Auth error detection
// ---------------------------------------------------------------------------

function isAuthError(error: unknown): boolean {
  const status = (error as any)?.status ?? (error as any)?.statusCode;
  if (status === 401 || status === 403) return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return msg.includes("unauthorized") || msg.includes("invalid api key") ||
    msg.includes("invalid_api_key") || msg.includes("authentication");
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

class OpenAIProvider implements LLMProvider {
  // ---- Codex completions (Responses API via chatgpt.com) ----

  private async _doCodexComplete(req: CompletionRequest, creds: CodexCredentials): Promise<CompletionResponse> {
    const result = await codexComplete(creds, {
      model: CODEX_MODEL,
      system: req.system,
      prompt: req.prompt,
      maxTokens: req.maxTokens ?? 65536,
      temperature: req.temperature ?? 0.3,
    });
    return { text: result.text, usage: result.usage };
  }

  private async _doCodexCompleteWithTools(req: AgenticRequest, creds: CodexCredentials): Promise<AgenticResponse> {
    return codexCompleteWithTools(creds, {
      model: CODEX_MODEL,
      system: req.system,
      prompt: req.prompt,
      tools: req.tools,
      executeTools: req.executeTools,
      maxTokens: req.maxTokens ?? 65536,
      temperature: req.temperature ?? 0.4,
      maxTurns: req.maxTurns ?? 15,
    });
  }

  // ---- Standard API completions (Chat Completions via api.openai.com) ----

  private async _doComplete(req: CompletionRequest): Promise<CompletionResponse> {
    const client = getClient();
    if (!client) return { text: null };

    const {
      system,
      prompt,
      maxTokens = 65536,
      temperature = 0.3,
    } = req;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (system) {
      messages.push({ role: "developer", content: system });
    }
    messages.push({ role: "user", content: prompt });

    const response = await client.chat.completions.create({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
    });

    if (response.choices[0]?.finish_reason === "length") {
      console.warn(
        `[ai/openai] Response TRUNCATED (finish_reason=length). ` +
        `max_tokens=${maxTokens}, completion_tokens=${response.usage?.completion_tokens}. ` +
        `Consider increasing maxTokens.`
      );
    }

    const text = response.choices[0]?.message?.content ?? null;

    return {
      text,
      usage: response.usage
        ? {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
        }
        : undefined,
    };
  }

  private async _doCompleteWithTools(req: AgenticRequest): Promise<AgenticResponse> {
    const client = getClient();
    if (!client) return { text: null, toolCalls: [] };

    const {
      system,
      prompt,
      tools,
      executeTools,
      maxTokens = 65536,
      temperature = 0.4,
      maxTurns = 15,
    } = req;

    // Convert our tool definitions to OpenAI function calling format
    const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (system) {
      messages.push({ role: "developer", content: system });
    }
    messages.push({ role: "user", content: prompt });

    const allToolCalls: { name: string; input: any; result: any }[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let turn = 0; turn < maxTurns; turn++) {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
        tools: openaiTools,
        tool_choice: "auto",
      });

      // Track usage
      if (response.usage) {
        totalInputTokens += response.usage.prompt_tokens;
        totalOutputTokens += response.usage.completion_tokens;
      }

      const choice = response.choices[0];

      // Check if the model wants to call tools
      if (choice.finish_reason === "tool_calls" && choice.message.tool_calls) {
        // Add assistant's message (with tool_calls) to conversation
        messages.push(choice.message);

        // Execute each tool call (only function-type tool calls)
        for (const toolCall of choice.message.tool_calls) {
          // Narrow to function tool calls (skip custom tool calls)
          if (toolCall.type !== "function") continue;

          const functionName = toolCall.function.name;
          let functionArgs: Record<string, unknown>;

          try {
            functionArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            console.error(`[ai/openai] Failed to parse tool args for ${functionName}:`, toolCall.function.arguments);
            functionArgs = {};
          }

          console.log(`[ai/openai] Tool call: ${functionName}`, JSON.stringify(functionArgs).slice(0, 200));

          let result: string;
          try {
            result = await executeTools(functionName, functionArgs);
          } catch (err) {
            result = `Error executing tool ${functionName}: ${err instanceof Error ? err.message : String(err)}`;
            console.error(`[ai/openai] Tool error:`, result);
          }

          allToolCalls.push({ name: functionName, input: functionArgs, result });

          // Add tool result to conversation
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        // Continue loop — model may call more tools or produce final text
      } else {
        // Model produced a final text response (finish_reason=stop or no tool_calls)
        const text = choice.message.content ?? null;
        return {
          text,
          toolCalls: allToolCalls,
          usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
        };
      }
    }

    // Hit max turns
    console.warn(`[ai/openai] Hit max turns (${maxTurns}) in agentic loop`);
    return {
      text: "Analysis incomplete — reached maximum tool call limit. Results may be partial.",
      toolCalls: allToolCalls,
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    };
  }

  // ---- Public interface with Codex → OAuth → API key fallback chain ----

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    // Try Codex first (ChatGPT subscription — free for Plus/Pro users)
    const creds = getCodexCreds();
    if (creds) {
      try {
        return await this._doCodexComplete(req, creds);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (isCodexAuthError(error)) {
          console.warn(`[ai/openai] ⚠️ Codex authentication failed: ${msg}`);
          console.log("[ai/openai] Codex token may be expired — run `npx @openai/codex login` to refresh");
        } else {
          console.warn(`[ai/openai] ⚠️ Codex endpoint error: ${msg}`);
        }
        _codexFailed = true;
        console.log("[ai/openai] Falling back to standard OpenAI API...");
      }
    }

    // Standard API with OAuth → API key fallback
    try {
      return await this._doComplete(req);
    } catch (error) {
      if (isAuthError(error) && handleOAuthFailure(error)) {
        return await this._doComplete(req);
      }
      throw error;
    }
  }

  async extractJSON<T = unknown>(req: CompletionRequest): Promise<T | null> {
    console.log(`[ai/openai] extractJSON called (maxTokens=${req.maxTokens}, promptLen=${req.prompt.length})`);

    let text: string | null;
    try {
      const response = await this.complete(req);
      text = response.text;
    } catch (apiError) {
      console.error("[ai/openai] extractJSON: API call failed:", apiError instanceof Error ? apiError.message : String(apiError));
      throw apiError;
    }

    if (!text) {
      console.error("[ai/openai] extractJSON: API returned empty/null text");
      return null;
    }

    console.log(`[ai/openai] extractJSON: got response (${text.length} chars), starts with: ${JSON.stringify(text.slice(0, 100))}`);
    console.log(`[ai/openai] extractJSON: ends with: ${JSON.stringify(text.slice(-100))}`);

    try {
      const parsed = robustParseJSON<T>(text);
      if (parsed !== null) {
        console.log("[ai/openai] extractJSON: successfully parsed JSON");
        return parsed;
      }

      console.error(
        "[ai/openai] extractJSON: FAILED to parse. Response length:",
        text.length,
        "First 500 chars:", text.slice(0, 500)
      );
      return null;
    } catch (e) {
      console.error(
        "[ai/openai] extractJSON: exception during parse:",
        e instanceof Error ? e.message : String(e),
        "Response first 300 chars:", text.slice(0, 300)
      );
      return null;
    }
  }

  async completeWithTools(req: AgenticRequest): Promise<AgenticResponse> {
    // Try Codex first
    const creds = getCodexCreds();
    if (creds) {
      try {
        return await this._doCodexCompleteWithTools(req, creds);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (isCodexAuthError(error)) {
          console.warn(`[ai/openai] ⚠️ Codex authentication failed (tools): ${msg}`);
          console.log("[ai/openai] Codex token may be expired — run `npx @openai/codex login` to refresh");
        } else {
          console.warn(`[ai/openai] ⚠️ Codex endpoint error (tools): ${msg}`);
        }
        _codexFailed = true;
        console.log("[ai/openai] Falling back to standard OpenAI API for tool use...");
      }
    }

    // Standard API with OAuth → API key fallback
    try {
      return await this._doCompleteWithTools(req);
    } catch (error) {
      if (isAuthError(error) && handleOAuthFailure(error)) {
        return await this._doCompleteWithTools(req);
      }
      throw error;
    }
  }

  isConfigured(): boolean {
    // Configured if we have Codex creds OR standard API creds
    return getCodexCreds() !== null || getClient() !== null;
  }

  getCapabilities(): LLMCapabilities {
    return {
      supportsExtendedThinking: false,
      supportsParallelToolCalls: true,
      supportsStructuredOutput: true,
      maxContextTokens: 128_000,
    };
  }

  getProviderName(): string {
    return "openai";
  }
}

// ---------------------------------------------------------------------------
// Export singleton instance
// ---------------------------------------------------------------------------

export const openaiProvider = new OpenAIProvider();
